# Übergabe: So wird an PUNKTLANDUNG gearbeitet

Dieses Dokument ist für jeden neuen Chat, der am Projekt weiterarbeitet. Es fasst zusammen,
wie bisher gearbeitet wurde, welche Entscheidungen gelten und welche Fallen es gibt.
Bitte vollständig lesen, bevor du etwas änderst.

## Der Auftraggeber

Nick, spricht informelles Deutsch, schickt oft Sprachnachrichten mit Tippfehlern.
Er will kurze, handlungsorientierte Antworten und ehrliche Einschätzungen statt Schönfärberei.
Wenn etwas nicht getestet ist oder nicht geht, sag es klar.

**Grundregel: Niemals deployen ohne seine ausdrückliche Freigabe.** Er spielt oft gerade
mit Freunden. Pushen auf GitHub ist unkritisch, Render deployt nur über `trigger_deploy`.

## Technik in einem Satz

Node + Express + Socket.IO, PostgreSQL auf Render (Speicher-Fallback lokal), das komplette
Frontend ist die eine Datei `public/index.html` mit Template-Strings. Kein Build-Schritt.

- `server.js`: REST-Endpunkte, Auth, Karten, Casino, Tagesbelohnung, Push
- `lib/game.js`: Match-Logik, Socket-Events, Zuschauer, Wetten, KI-Vorbereitung
- `lib/store.js`: Speicher. Neue Nutzerfelder in `NUM_KEYS` oder `TEXT_KEYS` eintragen,
  die Spalten entstehen dann automatisch. Neue Tabellen im `init()` anlegen
- `lib/ai.js`: KI-Fragen über die Anthropic-API
- `lib/cards.js`, `lib/frames.js`: Embleme, Titel, Rahmen mit `cond(u)` und `need`-Text
- `lib/progress.js`: XP, Prestige, Herausforderungen
- `lib/tcg.js`: Sammelkarten, Varianten, Booster, Chancen
- `lib/casino.js`: Roulette und Blackjack (serverseitig, der Client zeigt nur an)
- `lib/daily.js`: Tagesbelohnung

## Testen, bevor irgendetwas rausgeht

1. `npm test` (Simulation in `test/sim.js`). Muss mit „OK: alle Prüfungen bestanden“ enden.
2. Für neue Serverfunktionen ein kleines Node-Skript schreiben, das den Server mit
   `DATABASE_URL=''` startet, sich registriert und die Endpunkte aufruft.
3. Für Oberflächen Playwright mit Chromium. **Testnamen mindestens 3 Zeichen lang**,
   sonst schlägt die Registrierung still fehl und alle Folgeschritte laufen ins Leere.
4. Bilder im Test mit `ctx.route('**/tcg/*.webp', lambda r: r.abort())` blockieren,
   sonst hängen Screenshots beim Laden.
5. Admin im Test: `ADMIN_NAME=zimmerbiest` setzen, dann gehen `/api/admin/*` Aufrufe.

## Bilder erzeugen (Higgsfield)

Modell `gpt_image_2_5`, Stapel bis 12 Bilder, danach `jobs_wait` mit höchstens 15 Sekunden.
Bei `429 rate_limit_reached` kurz warten und die fehlenden neu schicken.

**Immer auf reinem Schwarz generieren**, dann freistellen mit `tools/assets/cutout.py`:
- Embleme: „single video game emblem, 3D rendered like a AAA UI icon ... isolated on a pure solid black background. No text“
- Rahmen: „circular avatar frame ring ... THE CENTER MUST BE COMPLETELY EMPTY AND PURE BLACK“, dann `ring`
- Titel-Banner: 16:9 ohne Text generieren, dann `banner` (880×200)
- Kartenmotive: 1:1 „Trading card creature artwork, no text no frame“

Die Bild-URL folgt dem Muster
`https://d8j0ntlcm91z4.cloudfront.net/user_39aVoqY53oq3Jdj6I9OW6CyRDyZ/hf_JJJJMMTT_HHMMSS_<job-id>.png`.
Die Uhrzeit weicht zwischen Bildern eines Stapels um 1 bis 2 Sekunden ab, beim Laden mehrere probieren.

Dateinamen: Embleme `public/emblems/pc_<id>.webp`, Titel `title_<id>.webp`, Rahmen `<id>.webp`,
Karten `public/tcg/<kartenid>_<variante>.webp`. Bei neuen Assets `AVER` in index.html erhöhen,
falls Browser alte Versionen zeigen.

## Kronen-Pass (Season-Pass)

- Logik in `lib/pass.js`: SEASON (id, Name, Start/Ende, Banner), 30 Stufen à 2.000 Pass-XP, FREE/PREM-Belohnungen, Wochenaufgaben, Bonus-Tresor.
- Pass-XP kommen in `lib/game.js` nach jedem Match dazu (Match-XP ohne Herausforderungs-XP, kein Casino). Neue Saison: `norm()` setzt alles zurück, sobald `pass_season` nicht mehr passt.
- Endpunkte in `server.js`: GET /api/pass, POST /api/pass/buy (15.000 💎), /claim (tier oder 'all'), /bank, /task, Admin-Test /api/admin/passxp.
- Saison-Kosmetik ist `event: true` in cards.js/frames.js und wird über `unlocks` freigeschaltet.
- Neue Saison anlegen: SEASON-Objekt tauschen (neue id!), Belohnungen und Item-IDs anpassen, 4 Bilder + 2 Wan-Videos erzeugen, News-Beitrag.

## Bewegte Titel und Embleme (Wan 3.0)

1. Standbild mit `gpt_image_2_5` erzeugen. Titel 16:9 als Panorama: „All important content is arranged in one flat
   horizontal band across the exact vertical middle ... the top third and bottom third contain only soft dark background“.
   Embleme 1:1 „Centered, fully visible with generous margin, isolated on a pure solid black background. No text“.
2. Bild mit `media_import_url` zu Higgsfield holen, dann `generate_video_batch` mit `model: wan3_0`, `resolution: 720p`,
   `duration: 5`, `generate_audio: false`, Startbild als `start_image`. Prompt immer mit „The camera stays completely still ...
   The composition stays exactly the same, nothing moves out of frame. Seamless loop.“
3. Umwandeln: `tools/anim/towebp.sh video.mp4 public/emblems/title_<id>.webp banner <YPOS>` (560×127, Schleife überblendet),
   Embleme mit `python3 tools/anim/emb.py video.mp4 public/emblems/pc_<id>.webp` (180×180, Maske von den Rändern).
4. **Gegen abgeschnittene Titel:** Zwei Einzelbilder (Anfang und Mitte) nebeneinander ansehen. Fehlt oben etwas
   (Krone, Kopf), YPOS senken: bisher 0.30 (Komplettist), 0.22 (Violetter Flush), 0.0 (König des Pokers).
5. Im Code `anim: 'video'` am Titel oder Emblem setzen. Rahmen bleiben Standbilder mit CSS-Animation (`spin`, `crown` usw.).
6. Vorschau für Nick: Playwright-Aufnahme im Spiel plus Untertitel per ffmpeg `drawtext`, oder Vergleichsseite als Artifact.

## Karten rendern

`tools/cards/build3.py` baut eine Karte aus Motiv plus Rahmenvorlage `frame2.png`
(magentafarbene Flächen werden ersetzt). Stufen: haeufig, selten, holo, ultra, legend, ext, ghost.
`renderall.py START ENDE` rendert alle Varianten aus `lib/tcg.js`, in Blöcken von etwa 120,
weil ein Lauf sonst die 300-Sekunden-Grenze reißt. Die Motive liegen nicht im Repo;
für neue Karten neu generieren.

Regeln: Häufige Karten nur einstufig. Seltene: selten, holo, ultra. Legendäre: legend, ultra, ext.
Ghost-Karten sind 10 eigene Motive nur im Geister-Booster. Je 50 Karten pro Standard/Premium.

## Toon-Welt-Set

`tools/toon/render.py` baut die 30 Toon-Karten aus `tools/toon/cards.json` und den Motiven in
`tools/toon/motifs/`. Rahmen: `frame_grimoire.png` (Häufig, Selten) und `frame_arcane.png` (Holo, Ultra,
Legendär), jeweils mit magentafarbenen Flächen für Name, Bild, Text und die zwei Medaillons.
Extended Art wird ohne Vorlage als Vollbild mit Glasflächen gebaut. Die Motive liegen diesmal im Repo,
damit Karten jederzeit neu gerendert werden können.

## Bekannte Fallen

- **KI: kein Vorfüllen der Antwort.** Sonnet 5 lehnt eine vorgefüllte Assistant-Nachricht mit
  Fehler 400 ab. Das hat einmal alle Anläufe sofort scheitern lassen.
- **KI: in Häppchen fragen.** Bei 25 Fragen auf einmal verbraucht das Modell das Budget beim
  Nachdenken und liefert eine leere Antwort (`stop_reason: max_tokens`). Deshalb 8 pro Anfrage.
- **Namenskonflikt in game.js:** Dort gibt es eine interne Funktion `push(m)`. Die Push-Bibliothek
  heißt deshalb `webpush`. Nicht wieder `push` nennen, das hat den Server abstürzen lassen.
- **`let`-Variablen vor der Nutzung deklarieren.** Ein `reprep` zwei Zeilen zu spät hat den Server
  in der Lobby abstürzen lassen.
- **Anzeige und Prüfung müssen dieselben Werte nutzen.** Sammler-Belohnungen brauchen die
  Kartenzahlen aus `cardStats()`, sowohl in `/api/home` als auch in `/api/card` und `/api/frame`.
- **GRACE ist ein Aktionsthema** und darf nicht in den Standardthemen stecken.
- **Roulette:** Farben kommen aus derselben Tabelle wie das Ergebnis, die Kugel sitzt im Rad.
  Nie wieder Grafikfarben mit berechneten Zahlen mischen.

## Arbeitsweise, die gut funktioniert hat

- Große Wünsche in Etappen, pro Etappe testen und kurz berichten
- Vor Designarbeit eine Vergleichsseite als Artifact veröffentlichen und Nick wählen lassen
- Antworten auf Deutsch, knapp, mit dem Ergebnis zuerst und ehrlichen Einschränkungen am Ende

## Offene Punkte

- Datenbank läuft am 19. Oktober 2026 aus, Umzug zu Neon.tech steht an
- GitHub-Token und Anthropic-Schlüssel standen im Chat und sollten erneuert werden
- Casino-Ausbau: Blackjack mit Splitten, Verdoppeln, Versicherung, Mehrspieler-Tische;
  Roulette-Tableau in Draufsicht mit allen Einsatzarten

## Gruselnacht-Set (in Arbeit, Zweig `gruselnacht`)

- Arbeit läuft auf dem Zweig `gruselnacht`. `main` = live. Fertige Einzel-Features werden per cherry-pick nach `main` übertragen (dabei `tools/cards/hw/gn_jobs.json` weglassen).
- 100 Motive in `lib/gn.js` (erzeugt von `tools/cards/hw/gen_defs.py`, Namen dort ändern und neu erzeugen), 145 Varianten: 40 Häufig, 25 Selten (+Holo), 15 Legendär (+Ultra), 10 nur Ultra, 5 nur Extended, 5 Extended + Mythisch (bewegt). 50 Rahmen A (`hw/frame_a.png`, Kürbis/Hexen/Monster), 50 Rahmen B (`hw/frame_b.png`, Geister/Tod).
- Mythisch = bewegte Top-Stufe, zählt wie Ghost Rare (Sammlung, Umwandeln 1.500, Börse, Doppelte hochladen). Keine eigene Extended-Plus-Stufe (Nick wollte Mythisch).
- Bilder: `tools/cards/hw/gn_jobs.json` enthält je Karte Prompt, Job-ID und fertige `url`. Hilfe: `tools/cards/hw/jobs.py next N | set 'i:job,...' | url 'i:url,...'`. Querformat 4:3 für normale Karten, 3:4 für Extended/Mythisch. Stand: alle 96 in Auftrag, letzter Schub (81, 82, 88-95) läuft.
- Noch offen: Animationen (Wan 3.0) für die 3 neuen Mythisch-Karten gn_a49 Kürbiskaiser, gn_b14 Lich-König, gn_b50 Auferstehung; statische Extended-Version für gn_schnitter und gn_koenig; alle 145 Varianten rendern (`build_hw.py`, `anim_card.py` mit rar='mythic'); Börsen-Filter „Meine Angebote“ mit Zurücknehmen; Update-Beitrag; Freischalten (Booster `gn` locked, Set in COLLECT ausgeschlossen).
- Rendern: `tools/cards/build_hw.py` schneidet unten statt oben (Köpfe bleiben). Rate-Limit gpt_image_2_5: etwa 10 Bilder pro Schub.

## Stand Version 69 (alles live, Gruselnacht per Schalter gesperrt)
- Audio: auf iPhones mit navigator.audioSession kein stiller Mediaplayer mehr (nur audioSession.type = playback), damit kein „spielt Musik“ im Kontrollzentrum; alter Trick nur als Rückfall. Falls der Ton bei Stummschalter wieder fehlt: hier ansetzen.
- (showroom-v2) Audio: Ton aus = Tonausgabe komplett loslassen (releaseAudio, audioSession ambient, stiller Dauerton aus), beim Verlassen der App stiller Ton pausiert; damit laufen Spotify/Hörbücher weiter. Kronen-Pass: alle Booster (auch in Kürbis-Überraschungen) sind Gruselnacht-Booster. Vor der Freigabe sammelbar, aber Öffnen und Börse gesperrt (/api/tcg/open und sellpack prüfen gnOpen), Inventar zeigt „🔒 bald“.
- Gruselnacht: alle 145 Kartenbilder fertig (public/tcg/gn_*), Freigabe im Admin-Menü „🃏 Gruselnacht-Set“ (Setting gn_open): Booster kaufbar, Set zählt zur Sammlung, Update u11 (requires 'gn') erscheint. Vorher gibt der Pass statt Gruselnacht-Booster (Premium 12/22/26) einen Geister-Booster.
- Doppel-XP-Aktion (lib/boost.js, Setting boost): Level-XP, Casino-XP, Pass-XP einzeln schaltbar, Banner auf der Startseite.
- Verlauf im Admin-Menü: Diamanten, XP, Casino-XP, Pass-XP (Tabelle ledger, Spalte kind: dia/xp/cxp/pxp).
- Börse: bis 5.000 Angebote, Filter „Meine Angebote“, „Alle zurücknehmen“ (/api/tcg/cancel-all). Roulette-Chips bis 100k.
- Triple Crown Plätze: Client setzt sich bei tc:list mit freier eigener Maschine still wieder hin (statt „aufgestanden“). Bei Verbindungsabbruch 3 Min reserviert; jede Dreh-/Risiko-Anfrage schickt machine mit, tcSeated setzt automatisch wieder hin, wenn frei (z. B. nach Neustart/Deploy); sonst klare Meldung und zurück zur Auswahl.
- Kronen-Pass Wochenaufgaben: zählen erst ab Pass-Start (Setting pass_epoch, wird beim Einschalten neu gesetzt; beim ersten Start nach Einführung = Reset für alle). Aufgaben: 25 Matches (2.500), 8 Siege (2.500), 5 Punktlandungen (3.000).
- Tickets: offen = nur „eingereicht“ und „in Bearbeitung“ (openTicketCount), Zähler aktualisiert sich live bei Statuswechsel (ticket:count).
- Tickets: Push an den Admin mit Protokoll („Ticket-Push an …: N Gerät(e)“), live Hinweis + roter Zähler offener Tickets am Support-Knopf (nur Mods/Admin).

- Admin-Menü enthält jetzt auch Passwort-Reset (mit Namensvorschlägen) und Mod-Menü; im Profil des Admins sind sie weg (Mods ohne Admin behalten das Mod-Menü im Profil). Funktion renderStaffBoxes().
- Booster-Showroom v3 (Zweig showroom-v2, noch nicht live): Kissenform aus 9x12 Kacheln je Seite (srBuildPack, matrix3d je Kachel), Licht je Kachel und Bild berechnet (srLight: Streulicht + Glanzpunkt, Licht von oben), weicher Lichtstrahl, Staub, verschwommene Booster im Hintergrund, Leuchten über --lum statt Filter (Filter auf preserve-3d macht in Safari alles flach!), dunkler Glasraum mit Licht von oben, Spiegelung der Karte.
- Booster-Showroom (openShowroom, packView): 3D-Drehung mit Glanz, Aufreißen, Blitz, Karten einzeln auf Podest; im Shop „👀 Ansehen“. Admin „🎬 Booster öffnen: Darstellung“ Showroom/Klassisch (Setting open_style, Standard showroom).
- Tränke (lib/potions.js): pot_xp2/4, pot_cxp2/4, pot_pxp2/4 als versteckte PACKS-Einträge (potion:true), eigener Reiter „🧪 Tränke“ auf der Kartenseite (potionsHtml, ctab traenke). /api/potion/use aktiviert: 60 Min echte Zeit ab Aktivierung ({m, until}), gleicher Trank verlängert um 60 Min, ×2 und ×4 derselben Art nicht kombinierbar. Stand in users.pot_active. Wirkung: game.js Level-XP und Pass-XP, casinoStat und Poker Casino-XP. Nicht verkaufbar, nicht öffnbar. Bilder /tcg/pot_xp|cxp|pxp.webp, ×2/×4 per CSS.
- Highroller-Prestige-Logo EC5 (pc_EC5.webp, bewegt): Casino-Strang Stufe 20 als item2; Prestige-Logo Nummer 12 (pres_shown=12, nur mit Freischaltung EC5, hasHighroller in server.js), in der Profil-Auswahl neben Master, gesperrt mit Hinweis. Update 12 (u12-casino) mit Einlöse-Baustein 'redeem' und Code GEISTERJACKPOT (10.000 💎, wird beim Start angelegt).
- Casino-XP live: Server sendet nach jeder Casino-Runde und nach Herausforderungs-Casino-XP 'me:cxp' (cxp, pcxp, tier); Client zieht VIP-Kopf, Profil und Casino-Strang nach. Herausforderungs-Casino-XP zählen auch für den Strang.
- Kronen-Pass Casino-Strang (lib/pass.js CASINO, casNeed: 20 Stufen bis 2,5 Mio Casino-XP): Zähler users.pass_cxp (casinoStat + Poker, nur wenn Pass aktiv), abgeholt in pass_cc; track 'casino' in /api/pass/claim, 'all' holt mit ab. Titel TC1-4, Embleme EC1-4 (alle bewegt, Wan 3.0). Stufe 20: Titel + Gruselnacht-Display.
- Guthaben-Protokoll mit Klartext-Notiz (ledger.note, via note() im Request-Kontext): Roulette (Einsätze je Feld, Zahl, Farbe, Auszahlung), Triple Crown (Einsatz, Auszahlung), Blackjack (Einsatz, Hand gegen Geber, Auszahlung). Roulette statistisch geprüft (1 Mio Drehungen): 48,65 % Rot, 97,29 % Auszahlung = fair.
- Gutscheincodes aus dem Admin (Setting admin_codes): beliebige Belohnung (dia + items: Booster, Displays, Tränke), max. Einlösungen, Ablauf, Liste wer eingelöst hat. /api/redeem prüft zuerst diese Codes, danach die festen aus cards.js.
- Ankündigungsbanner (Setting banner): Text, optional Belohnung mit „Einlösen“, für alle oder Namen; verschwindet nach dem Einlösen; Admin sieht eingelöst / noch nicht.
- Ausverkauf durch Kauf: Push + Live-Hinweis nur an den Admin, wer die letzten Stück gekauft hat (tag soldout-<id>).
- Booster „Nicht im Verkauf“ (offsale in shop_cfg) blendet ihn im Shop aus; Displays auch „Ausverkauft“ (soldout in display_cfg). Displays umwandeln: 60 % des Shop-Preises (/api/tcg/meltdisplay, Reiter Umwandeln). Startseite: „Karten, Booster & Börse“ direkt nach den Matches; Börse-Reiter grün hervorgehoben.
- Shop-Hinweis: je Booster und Display optionaler Text (note, max 120 Zeichen) in shop_cfg/display_cfg, erscheint als 📣-Zeile im Shop und im Kauffenster.
- Displays: PACKS.disp_gn (24 Gruselnacht-Booster, display:true, of:'gn', hidden, off). Admin schaltet im Shop-Steuerungs-Panel an/aus + Preis (Setting display_cfg, Standard aus, 60.000). Öffnen legt size Booster ins Inventar. Inventar-Kategorie „🗃 Displays“, Börse eigener Reiter „Displays“. Vor Gruselnacht-Freigabe gesperrt wie der Booster.
- Fragen-Befüllung: Anzeige zeigt jetzt „bereit · alle Kategorien am Ziel“ / „pausiert · unter Ziel“ / „KI-Schlüssel fehlt“ und ob die 80-%-Automatik an ist.
- Shop-Steuerung (Admin „🛒 Shop-Steuerung“, Setting shop_cfg): je Booster Preis, Bestand (leer = unbegrenzt, zählt bei Käufen runter, 0 = ausverkauft), Ausverkauft-Knopf. Shop zeigt „Nur noch X Stück“ bzw. „Ausverkauft“.

## Davor live gegangen (Version 67)
- Casino-Sperre je Spieler (Admin-Menü „🚫 Casino-Sperre“, Timer, unbefristet, aufheben; Feld `casino_ban`: 0 frei, 1 unbefristet, sonst Zeitstempel). Sperrbild mit Beratungstelefon Glücksspielsucht 0800 1 37 27 00.
- Holo-Effekt in der Kartenansicht neu (weicher Regenbogen am Lichtfleck, Glanzlicht, Glitzer). Kippen: Feder-Animation, größere Winkel, Finger relativ, Gyro relativ zur Haltung.
- Halloween-Look + separater Animations-Schalter, Kronen-Pass (gesperrt bis Freigabe), Pass-Vorschau per Tipp, Guthaben-Verlauf, Prestige-Hinweise, Versionsabgleich (Auto-Reload).
