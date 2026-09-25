# Übergabe: So wird an PUNKTLANDUNG gearbeitet

Dieses Dokument ist für jeden neuen Chat, der am Projekt weiterarbeitet. Es fasst zusammen,
wie bisher gearbeitet wurde, welche Entscheidungen gelten und welche Fallen es gibt.
Bitte vollständig lesen, bevor du etwas änderst.

## Der Auftraggeber

Nick, spricht informelles Deutsch, schickt oft Sprachnachrichten mit Tippfehlern.
Er will kurze, handlungsorientierte Antworten und ehrliche Einschätzungen statt Schönfärberei.
Wenn etwas nicht getestet ist oder nicht geht, sag es klar.

**Deployen:** Nick erwartet inzwischen, dass fertige, getestete Änderungen direkt live gehen
(push nach `main` und `gruselnacht`, dann Render `trigger_deploy`). Nur bei riskanten Umbauten vorher fragen.
Render deployt NICHT automatisch beim Push. Ist das Render-Werkzeug nicht verfügbar: sagen, dass es
gepusht, aber nicht live ist, und Nick „Manual Deploy → Deploy latest commit“ im Render-Dashboard nennen.
Nach jedem Deploy `curl https://schaetzspiel-p0eb.onrender.com/api/version` prüfen (= AVER).

## Zugänge und Infrastruktur

- Live: https://schaetzspiel-p0eb.onrender.com · Version = `AVER` in `public/index.html` (bei jeder Änderung erhöhen)
- GitHub: `jillkeif-cmyk/schaetzspiel`, Zweige `main` (live) und `gruselnacht` (identisch halten: `git push … main:gruselnacht`)
- Push: `git push -q "https://x-access-token:<TOKEN>@github.com/jillkeif-cmyk/schaetzspiel.git" main`
  (Token steht in der Chat-Zusammenfassung; er stand im Chat und sollte erneuert werden)
- Render: Service `srv-dancluv40ujc73bgi7lg`, Workspace `tea-dahd3bp5efls73dj48n0`, Postgres `dpg-dancm40ae00c73eb1lmg-a`
  (**läuft am 19. Oktober 2026 ab → Umzug zu Neon.tech dringend**). Direkte SQL-Abfragen über das
  Render-Werkzeug scheitern (SSL), Protokolle über `list_logs` gehen.
- Admin im Spiel: `ADMIN_NAME=zimmerbiest` (Nick = ZimmerBiest)

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

**Werkzeuge:** Higgsfield-MCP. Standbilder mit `generate_image_batch` (Modell `gpt_image_2_5`),
Videos mit `generate_video` (Modell `wan3_0`), Warten mit `jobs_wait` (timeout höchstens 15 s,
bei längeren Jobs dazwischen `sleep` in bash). Stapel bis ~10 Bilder, bei `429 rate_limit_reached`
kurz warten und die fehlenden neu schicken. Kosten: Bild wenige Credits, Wan 5 s 720p ≈ 9 Credits,
Wan 30 s 720p ≈ 52,5 Credits (vorher mit `get_cost: true` prüfen).

**Referenzen:** Vorhandene Bilder als `medias: [{role: 'image', value: <job-id oder media-id>}]` mitgeben
(Stil übernehmen). Dateien von der Live-Seite holen: `media_import_url` mit der öffentlichen URL
→ `media_id`. Bei Wan: `start_image` (Animation eines Bildes) oder `image_references` (Trailer).

**Preset-Hinweis:** Higgsfield schlägt manchmal ein Preset vor („IN THE DARK“, „FLOAT SPIN“).
Dann denselben Aufruf mit `declined_preset_id: <id>` wiederholen, damit wörtlich generiert wird.

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

- Logik in `lib/pass.js`: SEASON (id, Name, Start/Ende, Banner), 30 Stufen à XP_PER_TIER (aktuell 4.000, im Admin einstellbar), FREE/PREM-Belohnungen, Wochenaufgaben, Bonus-Tresor.
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

## Kennungen von Titeln, Emblemen, Rahmen (WICHTIG)

Jede Kennung darf es nur einmal geben, sonst überschreibt man Bilder und Items erscheinen doppelt
(ist einmal passiert). `npm test` startet mit `test/ids.js`, das Doppelte und fehlende Bilder meldet.
Vergeben: TC1-3/EC1-3/fC1-3 = GAMBLER-Code-Paket, TP1-3/EP1-3 = Poker, TH*/EH*/fp1 = Geisternacht-Pass,
TX1-4/EX1-5 = Casino-Strang des Passes (EX5 = Highroller, auch Prestige-Logo 12), TK*/EK*/FK* = Sammler, TSUP/ESUP/fsup = Supporter-Geschenk.
Vor jeder neuen Kennung `grep -n "id: 'XY" lib/cards.js lib/frames.js` und `ls public/emblems | grep XY`.

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
- Highroller-Prestige-Logo EX5 (pc_EX5.webp, bewegt): Casino-Strang Stufe 20 als item2; Prestige-Logo Nummer 12 (pres_shown=12, nur mit Freischaltung EX5, hasHighroller in server.js), in der Profil-Auswahl neben Master, gesperrt mit Hinweis. Update 12 (u12-casino) mit Einlöse-Baustein 'redeem' und Code GEISTERJACKPOT (10.000 💎, wird beim Start angelegt).
- Shop-Steuerung Displays + Tränke (display_cfg): im Verkauf, Preis, Bestand, Ausverkauft, Hinweis. Tränke standardmäßig aus und ohne Preis; im Shop sichtbar sobald „im Verkauf“, ohne Preis mit „Preis folgt“ und nicht kaufbar.
- Triple Crown Nieten: casinoStat mit risk = 10 % des Einsatzes (weniger Casino-XP pro verlorenem Dreh), Gewinne unverändert.
- Auflösung nach jeder Frage: Mehrspieler 7 s (REVEAL_MS, vorher 9 s), Solo 5,5 s (REVEAL_SOLO_MS).
- Solo-Sieggrenze je Fragenzahl: 15 Fragen 750 (min15), 25 Fragen 1.200 (min), einmalig gesetzt über Setting solo_rework2, solowin.need(q); volle Solo-Diamanten ab derselben Grenze.
- Solo fest: Punktelimit immer 2.000, Fragen nur 15 oder 25 (Server erzwingt in create_solo), im Setup kein Punkte- und Countdown-Regler.
- Quiz-Diamanten neu (lib/quizpay.js, Setting quiz_pay, Admin „💎 Quiz-Belohnung“, AN): Sieger bis 12.000 voll ab 2.000 Punkten, andere anteilig × 0,6, Solo bis 8.000 voll ab 1.500 (mit Solo-Sieg). Tagesbonus/Hot Time verdoppeln weiter. Kronen-Pass einmalig auf 2.500 Pass-XP pro Stufe (Setting pass_rework1) ≈ 60 Siege. Update 13 (u13-quiz).
- Solo-Sieg (lib/solowin.js, Setting solo_win, Admin „🏆 Solo-Sieg“, jetzt Standard AN): Solo zählt als Sieg bei >= min Punkten (1500) in <= maxQ Fragen (25); dann counted = true (Serie/Flammen wächst, reißt bei Verfehlen), Diamanten 70 % eines Siegs, Punktelimit im Solo mindestens min. Hinweis auf der Startseite, Anzeige „Solo-Sieg!“ am Ende.
- Narrenkappe (lib/jester.js): Slot nach Idee von Merkurs „Jolly's Cap“, Halloween-Hof. 5×3, 10 Linien, Gewinn von links (3–5), PAY × Einsatz/10, Kürbisnarr W = Wild, Narrenkappe N nur auf Walze 3: verwandelt zufällig 0/2/3/4/5/8 Felder in W (Gewichte 70/50/36/24/14/7). Auszahlung ≈ 95,8 % (Simulation), Treffer ≈ 31 %, Kappe alle ≈ 17 Drehs. Maschinen 3 und 4 (TC_MACHINES = 4, machineGame), Endpunkt /api/casino/jester, Risikoleiter/Karte/Autoplay/Zuschauen/Sitzplatz von Triple Crown mitgenutzt (tc.game = 'jester', jcSpin, jcAnimate, jcCap, jcLines, jcPaytable). Bilder public/jc/ (s_<Symbol>.webp, logo, bg). Casino-Reiter „🃏 Narrenkappe“.
- Auge des Anubis (lib/anubis.js, Idee wie Merkurs Eye of Horus, Nacht-Ägypten-Grafik in public/an/): 5×3, 10 Linien, Anubis W dehnt sich auf die Walze aus (ersetzt alles außer Grabtor P). 3+ Grabtore zahlen 1×/10×/25× Einsatz und geben 12 Freispiele (fest, laut Original-Gewinntabelle). In Freispielen: jeder Anubis +1 Freispiel und NACH der Auswertung Tafel +1 Stufe (Lotus→Ankh→Skarabäus→Falke→Schakal→Auge). Freispiele werden serverseitig am Stück berechnet (r.fs.spins). Walzen mit ≈ 41 % Bildsymbolen wie im Original (Karten 9 je, L6 H6 S5 B4 X3 E3, W 1, P 2): Auszahlung ≈ 95,6 % (1,5 Mio.), Freispiele ≈ alle 153 Drehs, Ø 66×, Höchstgewinn ≈ 926×. Maschinen 5–6 (TC_MACHINES 6, machineGame), /api/casino/anubis, Testphase anubis_test (Standard AN), Admin-Test-Knopf „👁 Freispiele“. Oberfläche: anPlay/anSpin/anExpand/anBeam/anPopup, Tafel #anTab, Zähler #anFs, Klänge anspin/anstop/anexp/anfs/anextra/anbeam.
- Casino-Reiter-Abzeichen (Setting tab_badges, Standard jester/anubis „NEU“): Admin „🏷 Abzeichen im Casino“ setzt frei wählbaren Text (bis 12 Zeichen) je Reiter oder entfernt ihn (/api/admin/tabbadge).
- Heimlicher Bonus beim Zuschauen: Admin sieht an beobachteter Maschine „🎁 …“ (Vollbild/Kappe/Freispiele), /api/admin/tcforce mit machine setzt tcForce für den dortigen Spieler; der merkt nichts (kein Knopf, nur Admin kann setzen).
- Buch der Gruft (lib/crypt.js, Idee wie Novomatics Book of Ra Deluxe, Halloween-Gruft-Grafik in public/cr/): 5×3, 10 Linien, Grimoire B = Wild + Scatter (2×/20×/200× Einsatz), 3+ → 10 Freispiele mit gelostem Bonus-Symbol, das jede Walze füllt, auf der es steht, und auf allen 10 Linien zahlt (zusätzlich). 3+ Grimoires in Freispielen: +10. Grabräuber und Mumien-Pharao ab 2. Gewinntabelle exakt wie Original. Auszahlung ≈ 95,3 % (1,5 Mio.), Freispiele ≈ alle 170, Ø 49×, max ≈ 5.025×. Maschinen 7–8, /api/casino/crypt, Testphase crypt_test (Standard AN), Admin-Test-Knopf „📖 Freispiele“, NEU-Abzeichen. Oberfläche crPlay/crSpin/crPick (Deckel erscheint, 3D-Buch klappt auf, Seite dreht sich um den Buchrücken, Symbol auf der linken Seite eingedruckt)/crExpand. Klänge aus der Book-of-Ra-Magic-Aufnahme in public/sfx (cr_start, cr_stop, cr_boom, cr_flip, cr_chosen, cr_expand) über smp(); Freispiel-Melodie public/music/cr_fs.mp3 ab dem Aufleuchten der Grimoires; Hintergrund vorerst Halloween-Soundtrack. MUSIC_V = 2.
- Casino-Navigation: drei Bereiche (cseg: Automaten / Tische / Mehr, Punkt bei Neuem) + eine wischbare Zeile (crow) mit den Spielen des Bereichs, gewähltes Spiel mittig; Bereich merkt sich das zuletzt gewählte Spiel (window.__clast). Einsatz-Leiste nicht mehr in den Casino-Einstellungen. Freundes-Status nennt das richtige Spiel und die Maschinennummer je Spiel.
- KI-Modell-Schalter (Admin → Befüllung): Sonnet 5 / Haiku 4.5 (claude-haiku-4-5-20251001), Setting ai_model, ai.setModel; bei Haiku wird output_config.effort weggelassen (laut Doku nicht unterstützt). Gilt für Befüllung und Live-Fragen.
- Gemeldete Fragen (Admin „🚩 Gemeldete Fragen“): question_reports speichert jetzt names, last_at, status (open/blocked/kept); /api/admin/reports GET/POST; Sperren = dauerhaft raus, Ist ok = Zähler auf 0 (kommt wieder). Ab 2 offenen Meldungen weiterhin automatisch aus dem Spiel.
- WICHTIG store.allUsers() liefert in Postgres nur id + daily_day! Für Aktivität store.activeUsers(since), für volle Spielerdaten store.usersFull(limit) (ohne Profilbild). Neue Features gegen echtes Postgres testen (lokal installierbar: apt-get install postgresql).
- Gemeldete Fragen: question_reports hat jetzt names, last_at, status (open/blocked/kept). Schon 1 Meldung sperrt die Frage (reportedIds: status <> kept), inkl. Umformulierungen (pick: repGroups). Admin „🚩 Gemeldete Fragen“ (/api/admin/reports): Frage, Lösung bzw. alle Auswahl-Antworten, Melder, Zeit; „Gesperrt lassen“ (blocked) oder „Entsperren“ (kept, Zähler 0).
- Fragenqualität: Schätzfragen müssen nach Menge/Zahl/Jahr fragen (ai.isQtyQuestion; „Welcher Ort …“, „Wie heißt …“ werden beim Erzeugen verworfen und im Pool gesperrt). Doppelte: MC-Regel „gleiche richtige Antwort + Textähnlichkeit“ war defekt (jaccard bekam Text statt Tokens), jetzt korrigiert; neu: exakt gleiche Zahl (> 12) + mind. 2 gemeinsame Stichwörter = gleicher Inhalt.
- Gemeldete Fragen (Admin „🚩 Gemeldete Fragen“): question_reports speichert jetzt names, last_at, status (open/blocked/kept); /api/admin/reports GET/POST; Sperren = dauerhaft raus, Ist ok = Zähler auf 0 (kommt wieder). Ab 2 offenen Meldungen weiterhin automatisch aus dem Spiel.
- Fragenqualität: Schätzfragen müssen nach Menge/Zahl/Jahr fragen (ai.isQtyQuestion, EST_QTY), sonst beim Erzeugen verworfen und im Pool gesperrt (isBad) – z. B. „Welcher Ort …“. Doppelten-Erkennung: Auswahlfragen-Regel war kaputt (jaccard bekam Text statt Tokens, ergab immer 0) → jetzt gleiche richtige Antwort + Jaccard > 0,3 oder ≥ 2 gemeinsame Stichwörter; Schätzfragen zusätzlich: exakt gleiche Zahl (> 12) + ≥ 2 gemeinsame Stichwörter. Gruppen werden beim Serverstart neu gebildet (keine Fragen gelöscht).
- Automatik (Häkchen „Automatisch nachfüllen“): nach jedem Match (qpool.afterMatch, 45 s gesammelt) für die Mitspieler und alle 5 Minuten für alle aktiven Spieler; bestellt add = max(20, (0,3·Bestand − ungesehen)/0,7), damit der Vielspieler danach ≥ 30 % neue hat. Admin-Liste und aufgeklappte Meldungen überstehen das 4-s-Neuladen (window.__lastNeed, __rpOpen).
- Bedarfsprüfung im Admin (Befüllung → „🔍 Bedarf prüfen“): needReport zeigt pro Kategorie den aktiven Spieler mit den wenigsten ungesehenen Fragen; „Nachfüllen, wo es knapp ist“ (fillNeeded) wirkt auch bei abgeschalteter Automatik. autoCheck nutzt dieselbe Logik.
- 80-%-Regel (autoCheck): alle Spieler mit last_seen in den letzten 14 Tagen und mind. 1 Match, nur spielbare Fragen, inhaltsgleiche gelten als gesehen (groupOf).
- Kostenanalyse 18.–24.09.: ≈ 50 $ mit Sonnet 5, 97 % als standard (Live-Fragen in Matches), nicht Batch. Quelle „Pool“ spart den Großteil.
- Befüllung Admin: Anzeige „unter dem Ziel“ zählt ausgeschlossene Kategorien (SKIP: grace) nicht mehr mit; Start-Knopf meldet, wenn alle aktiven Kategorien schon am Ziel sind.
- Ticket #10 (Knuspermolch): Einladen-Fenster zeigt oben Freunde, darunter alle Spieler (/api/invitable, online zuerst) mit Suchfeld; Spieler im laufenden Match ohne Knopf (vorher wurden sie still ausgeblendet). Freundesliste wird beim Öffnen frisch geladen.
- Ticket #9 (Knuspermolch): Profilbearbeitung lädt beim Öffnen den aktuellen Stand; Tipp auf ein scheinbar gesperrtes Emblem/Titel/Rahmen prüft per loadHome nach und wählt direkt aus, wenn es inzwischen frei ist.
- Casino-Navigation neu: oben drei Bereiche (.cseg: Automaten / Tische / Mehr, pinker Punkt bei NEU oder Glücksrad-Drehs), darunter eine wischbare Zeile (.crow) mit den Spielen des Bereichs; gewähltes Spiel wird mittig gescrollt, letztes Spiel je Bereich gemerkt (window.__clast). Einsatz-Leiste in den Casino-Einstellungen entfernt (nur Einzel-Blackjack). Freundes-Status nennt das richtige Automatenspiel und die Maschinennummer (game.hooks.table).
- Glücksrad neu (lib/vip.js WHEEL, 12 Felder): 1.000–50.000 💎, Premium/Geister/Gruselnacht/Toon-Booster, JACKPOT 150.000 (≈ 1 zu 400), Ø ≈ 3.300 💎 + Booster je Drehung. Tagesbonus (lib/daily.js): Serie 5.000 → 25.000 + Gruselnacht-Booster an Tag 7, Tagesaufgaben ×4 (1.600–4.800).
- Casino-XP (vip.xpFor): Grundwert (≤ 400 nach Einsatz) + Zuschlag nach Gewinnfaktor ab 5× + 1 % des Reingewinns ab 5×, max. 300.000 je Runde (vor Trank/Hot Time). 50.000 Einsatz / 10 Mio. Gewinn ≈ 106.646 XP (×4 Trank ≈ 426.584). Ø je Dreh bei 1.000 Einsatz 79 statt 68.
- Befüllung-Kopf neu: „🤖 Automatik AN/AUS“ mit festen Knöpfen (data-admauto) + „Jetzt gerade“ in Klartext; „Anhalten“ nur sichtbar, wenn eine Befüllung läuft.
- Wartungsmodus (Admin → 🏠 Startseite & Wartung, /api/admin/maintenance, Setting maintenance): Nicht-Admins sehen nur Wartungskarte (news/maint.webp) + Profil + Support; Server sperrt alle /api außer MAINT_OPEN (Profil, Tickets, Login, Home …) mit 503, Socket-Events per socket.use (außer idle/presence); beim Einschalten werden Automatenplätze freigegeben (tcRelease schreibt offene Gewinne gut). Laufende Quiz-Matches werden NICHT beendet → vorher prüfen.
- HAUPTURSACHE LAGS 25.09.: needReport (Fragen-Automatik) rief groupFor(q, true) für jede Frage × jeden aktiven Spieler auf → 25 s Blockade des Servers (Node ist einfädig: alles steht). Jetzt Nachschlagen in groupOf + setImmediate-Pausen → 46 ms. Nie wieder teure Suchen in Schleifen über alle Spieler × Fragen!
- Zweite Ebene: Sammlung nach Sets (colSet, data-colset; im Set eine Filterreihe .u2-frow nur mit vorhandenen Seltenheiten), Shop-Kategorien als Kacheln (shopCat 'hub', ← Shop), Shop als breite Kachel oben in der Karten-Übersicht, Update-Knopf wieder oben neben dem Zahnrad.
- Übersichten (Kacheln, u2Tiles): Casino Automaten (slotsHub), Tische (tablesHub: Roulette, Blackjack, BJ-Tische, Poker), Mehr (moreHub: Glücksrad, Belohnungen, Rangliste, Einstellungen), Karten (ctab khub: Sammlung, Booster, Tränke, Börse, Gegradet, Tausch, Umwandeln, Verlauf); Zurück-Knöpfe „← Tische/← Mehr/← Alle Automaten/← Alle Karten-Bereiche“; Spiele-Zeilen und #ctabs im neuen Design ausgeblendet. Icons public/ui2/i_roulette|blackjack|bjtables|album|graded|market|trade|history|melt. Admin-Funktionen: Geschenk/Nachricht/Doppel-XP als Seitenknöpfe nur wenn aktiv, Update-Knopf folgt „Update-Karte an/aus“, Pass-Box nur bei aktivem Pass, Testphase-Hinweis auf Automaten-Kacheln.
- Namenskollision behoben: Body-Klasse für „im Spiel“ heißt u2-inplay (vorher u2-play = gleicher Name wie der Spielbereich .u2-play → ganze Seite bekam Rahmen, Flex und Innenabstand; Ursache für Poker-Rahmen und Verrutschen). Leiste 46 px + (Safe Area − 18 px).
- Neues Design final: altes Design entfernt (ui2On = angemeldet, keine Umschalter mehr; homeCfg.ui2Live ungenutzt), Start-Fehler behoben (Kopf fehlte, weil loadHome nur update() ruft und die Seite vorher ohne Kopf gebaut war), Level mit Prestige-Logo (/emblems/p{n}, 12 = pc_EX5, sonst Emblem), Spielleiste Solo · SPIELEN (frei) · Rangliste ohne Modus-Vorauswahl (window.__u2mode), Leiste 62 px + Safe Area, html/body dunkel.
- Neues Design, Runde 3: Insel je Prestige statt Logo (public/ui2/isle_0…11.webp, Tipp = Hinweis „in Arbeit“), Hot Time nur während Hot Time, Automaten mit sichtbarer Leiste (u2-seat: Drumherum weg; Fix für das Verrutschen/weißen Streifen), Leiste bis zum unteren Rand, Roulette-Kessel immer sichtbar (klein, Zahlenkranz über --W), Diamanten im Casino neben „So spielst du“ statt eigener Zeile, Blackjack-Tisch wieder in voller Höhe. Sicherung vor dem Design: Zweig sicherung-vor-neuem-design / Tag v203-vor-neuem-design (6ecc58e).
- Neues Design, Runde 2: Update-Knopf rechts in der Seitenleiste (Titelbild des neuesten Beitrags, NEU), Update-Karte auf der Startseite aus; offene Matches (#openList per CSS order) direkt unter SPIELEN mit Hinweis, wenn keins läuft; Solo-Sieg-Hinweis nur bei der Solo-Einrichtung; Casino „Automaten“ = Übersicht aller vier (cgame 'slotsHub', renderSlotsHub), Tipp öffnet die Maschinenwahl.
- NEUES DESIGN (ui2): Leiste unten (Shop · Karten · Quiz · Casino · Freunde, #u2nav, z-index 7 unter Fenstern), neuer Startseiten-Kopf (#ui2Home: Level, Diamanten, Profil-Banner mit Titelbild, Neuigkeiten, Menü-Zahnrad, Kronenpass-Box, Seitenknöpfe, SPIELEN/Solo/Matches), Menü (u2Menu, Admin nur für Admin), Freunde-Seite (page 'social'). Baut auf den alten Knöpfen auf (u2Act ruft dieselben Aktionen). Schalter: Admin → Startseite & Wartung → „Für mich testen“ (localStorage ui2me) / „Für alle live“ (homeCfg.ui2Live, home:cfg). Spielmodus (u2-play): an Maschine/Poker/BJ-Tisch keine Leiste, alles passt auf 390×844. Roulette: Kessel nur beim Drehen als Einblendung (body.r-spin). Icons: public/ui2/i_*.webp.
- Updates aufgeräumt: nur noch u18-tempo (Schneller & stabiler, Infografik news/u18_zahlen.webp, Hero u18_hero), u17-rad und zusammengelegter Automaten-Beitrag u16-gruft (ver '14–16', Hero u14_16_hero, beide Einlöse-Codes AUTOMATEN + SOUNDTRACK). Nummer im Beitrag = p.ver oder Zahl aus der ID.
- Tiefenprüfung 25.09.: Startseite cached globale Listen 30 s (sharedGet: world/points/casino/leader/market), Kartendefinitionen (≈58 KB) nur bei neuer Version (DEF_V, /api/tcg?dv=, App: fillDef + localStorage tcg_static; ALLE tcgState-Antworten schicken nur def.packs/melt/v), Börse und Sammler-Rangliste mit einer Abfrage (usersByIds, store.allCards), Minuten-Aufgabe: store.addMinutes (eine UPDATE-Anweisung), cardStats-Cache je Spieler (verworfen in store.cardAdd-Hülle). Messung Testwelt: Startseite 14→5 Zugriffe, Börse 32→3, Sammler-Rangliste 33→3, Karten 79 KB→2 KB.
- DB-Last je Dreh gesenkt: auth() je Anfrage nur einmal (req._authP), checkProgress gebündelt (3 s, checkProgressNow liest Spieler + ganze Kartensammlung), tcEmit nur bei Zuschauern, casinoStat liest nach dem Speichern nicht erneut (me:cxp aus berechneten Werten), bigWin liest nur bei großem Gewinn (bestHit-Map für „bester Gewinn mit Spiel“). Freundesliste mit store.usersByIds (eine Abfrage). Dreh: vorher ~15 Zugriffe inkl. Fortschritt, jetzt 8.
- Gesperrte Casino-Spiele bleiben sichtbar (ausgegraut, „🔒 gesperrt“, data-cglock → nur Hinweis). Admin-Menü lädt alle 10 s statt 4 s, im Hintergrund gar nicht.
- Banner-Arten (Admin → Banner): ann 📢 / info ℹ️ blau / warn ⚠️ orange / maint 🛠️ rot pulsierend (banner.kind, .ann-<kind>).
- Banner-Arten (Admin → Banner): 📢 Ankündigung, ℹ️ Info (blau), ⚠️ Warnung (orange), 🛠️ Wartung (rot, pulsiert); banner.kind, .ann-info/.ann-warn/.ann-maint.
- Last gesenkt: Markt lädt jeden Verkäufer nur einmal (vorher 540 Abfragen bei 500 Angeboten → jetzt 7), /api/newplayers 30 s Server-Cache, Startseite holt Tagesbonus-Status und neue Spieler höchstens 1× pro Minute (window.__dailyC / __npC, geleert beim Öffnen/Abholen). Logs 25.09.: Staus = alle Handys laden gleichzeitig die Startseite + kostenlose DB (~250–300 ms je Zugriff unter Last); Quiz-Start wartete 7 s auf Live-KI-Fragen (Pool für die Mitspieler zu knapp).
- Diagnose Ruckeln: Server protokolliert Anfragen > 500 ms als „LANGSAM …“ mit Datenbankanteil (store.dbStat), meldet beim Start, ob DATABASE_URL die interne oder externe Adresse ist. DB-Pool 10 statt 5. Lasttest lokal (Postgres): 4 Spieler Dauerdreh, Nehmen Median 27 ms. Render: Server und DB beide Frankfurt, DB im FREE-Tarif (läuft 19.10. ab) → hochstufen.
- Risikoleiter: ein einziger Blink-Takt (tc.ladBlink), veraltete Leitern zeichnen nicht (tc.ladGen), Ergebnis wird übernommen (tc.ladRedraw). Tischbild poker_obsidian.webp.
- Shop: letzter Käufer bei Ausverkauf öffentlich („🏁 Das letzte Stück ging an …“), Setting shop_last, PACKS[id].lastBuyer, wird beim Auffüllen (soldout false) gelöscht. Casino-Rangliste: Spiel in eigener Zeile (.best-game), Text bricht um, Rang-Block 74–90 px. Casino-Navigation heißt jetzt .cnavrow (vorher .crow = Kollision mit Ranglisten-Zeilen .pl.crow).
- Höhere Tischeinsätze: Roulette-Chips 50 bis 5 Mio. (+ All in, chipTxt), Einzel-Blackjack und Blackjack-Tische Knöpfe bis 1 Mio., Einsatz-Schritte wachsen mit (cbStep: 100/1k/10k/100k), Poker-Tisch „Obsidian Crown“ (1,5 Mio., Blinds 50k/100k), Chipstapel mit 25k/100k/1M. Server ohne Obergrenze (MAX_BET Infinity).
- Update-Beitrag u17-rad (Glücksrad, Tagesbonus, Alle öffnen, Casino-XP, VIP-Embleme, Gruft-Videos, Außerdem-Liste), Bilder news/u17_hero|u17_rad|u17_booster.webp. VIP-Stufen als Embleme VIP0–VIP10 (pc_VIP*.webp = Kopie von vip*.webp, cond casino_xp ≥ Stufe). Admin Startseite: zwei feste Knöpfe Anzeigen/Ausblenden statt Umschalter. Glücksrad: bei > 10 Feldern kleinere Beschriftung (.ldisc.many).
- Casino-Rangliste: bester Gewinn mit Spiel (casino_best_game, gesetzt in bigWin bei neuem Bestwert); Altwerte aus dem Render-Protokoll nachgetragen (ZimmerBiest 19,8 Mio. Roulette, Smiiezeh 1,15 Mio. Roulette, paddy 824.000 Anubis).
- Start: statischer Startbildschirm (#bootSplash in #app, wird von render() ersetzt), nach 9 s Hinweis + „Neu laden“ (script#bootJs – Hauptskript bleibt der letzte <script> ohne Attribute). Deploy: autoDeploy steht zwar auf „yes“, löst bei Push aber NICHT aus (alle Deploys trigger=api) → nach dem Push immer trigger_deploy aufrufen. Empfehlung: Health Check Path /api/version in Render setzen.
- Alle Booster öffnen (Inventar → „📦 Alle öffnen“, /api/tcg/openall): Auswahl alle oder eine Sorte, Bestätigung ab 20, max. 1.000 pro Durchgang, Karten gesammelt gebucht (cardAdd je Sorte), Übersicht nur legend/ext/ghost/mythic mit NEU und ×Anzahl, Gruselnacht bleibt zu bis gnOpen.
- BANDBREITE: Bilder nutzen IMGV (eigene Bild-Version, NUR erhöhen, wenn sich ein Bild unter gleichem Namen ändert) statt AVER; Server liefert Bilder/Töne/Videos mit 7 Tagen Cache (setHeaders), App-Seite max-age 0. Vorher lud jedes Handy nach jedem Update alle Bilder neu. Render Hobby: 5 GB inkl., dann 0,15 $/GB; Verbrauch ~1–2 GB/Tag (Stand 25.09.).
- Shop-Katalog (drawShopAdmin): Entwürfe je Zeile in window.__shopDraft (orange markiert „nicht gespeichert“), Knöpfe zeichnen nur ihre Zeile neu, Katalog bleibt offen, Admin-Neuladen pausiert beim Tippen. Musik-Freischaltung nur einmal und stumm (GM.unlocked), vorher spielte bei jedem Tippen kurz das letzte Stück.
- Freispiel-Tafel (fsWinHtml, Anubis + Gruft): gewinnt der auslösende Dreh auch etwas, heißt sie „GESAMTGEWINN“ mit Aufteilung Freispiele + Auslöse-Dreh.
- Anti-Rutschen: .tc-msg feste Höhe (2 Zeilen); lockCasinoHeight (ResizeObserver): #cgame schrumpft nicht, solange Spiel/Sitz gleich bleiben (gilt für alle Casino-Spiele). Leere Startseiten-Bereiche (#giftBox, #annBar, #boostBar, #presHint) ohne Abstand.
- Startseite (Admin „🏠 Startseite“, Setting home_cfg): Update-Karte an/aus (newsCardOff), Automaten-Werbung (promo: game triple/jester/anubis/crypt, Text) mit zugeschnittenem Logo public/promo/*.webp; Tipp setzt an freie Maschine (promoGo), sonst Hinweis. Live per Socket home:cfg. Spielwechsel über Reiter/Bereich = aufstehen bzw. Zuschauen beenden (tcStandQuiet), gleicher Automat bleibt sitzen.
- Buch der Gruft Videos (Wan 3.0, public/cr/v, 1,1 MB gesamt, 30 Tage Cache, CR_VID bei neuen Videos erhöhen): fly.mp4 (Gruft-Flug zum Grimoire, läuft in jedem Buch-Feld), B.mp4 (Grimoire leuchtet, Schleife nach dem Flug), R3/M3/G3/C3.mp4 (Symbol-Animation 3× untereinander, ein Video pro gefüllter Walze). Karten A–10 ohne Video (CSS). Vorladen bei Hinsetzen/Zuschauen (crPreload). Ausdehnen: Walze mit durchgehendem Goldrahmen (.cr-col), Symbol bewegt sich (crsym: Zoom, Drehung, Glanz), andere Walzen sehr dunkel.
- Buch der Gruft Effekte wie im Original: Bücher-Szene (crShowBooks big: Rest grau, in jedem Grimoire-Feld dunkler Eingang → grünes Licht → Grimoire tritt hervor → Blitz → rot-goldener Rahmen, ~3,9 s); Ausdehnen (crExpand: alles grau außer Bonus-Symbol, Walzen füllen Feld für Feld, Leuchten, weißer Blitz, 10 Linien einzeln mit Betrag, zweiter Blitz). crLinesOff räumt vorherige Linien weg.
- Update 16 (u16-gruft): Buch der Gruft, ohne Code. Update-Vorschaubilder u14/u15/u16_hero.webp als freigestellte Motive (420×420, wie u13), Titelbild u16_art.webp, Figuren-Reihe u16_figuren.webp. Bildblöcke mit wide: true nutzen die volle Kartenbreite (.nw-img.wide).
- Prestige-Logos überall antippbar (data-pzoom in emblem() und Profilkopf, globaler Klick → zoomImg mit „Prestige X · Name“), außer in der Logo-Auswahl im Profil ([data-pres]): dort wählt ein Tipp aus, nur gesperrte öffnen die Großansicht.
- Update 15 (u15-sound): Sound - App im Hintergrund (visibilitychange Effekte, Bilder public/news/u15_*.webp (ohne Admin-Knöpfe), Code SOUNDTRACK (15.000 💎, 30 Tage) beim Start angelegt.
- App im Hintergrund (visibilitychange/pagehide): Musik sofort pausiert, Stelle gemerkt, Audio-Kontext pausiert, sfx stumm; bei Rückkehr weiter an derselben Stelle mit Einblenden.
- Musik-Ducking (gmDuck): bei Gewinnlinien, Kappe, Großgewinn und Anubis-Strahl wird die Musik kurz auf 20–30 % gesenkt; Grundlautstärke gmVol: Halloween 0,18, Egypt 0,26, Freispiele 0,38. Narrenkappe-Gewinnklänge (jcline, jcbass, jccount) lauter.
- Anubis-Laser-Klänge verstärkt: anchg (Sägezahn-Anschwellen 90→420 Hz), anlaser (Zischen 1600→780 Hz + 390 Hz mit Flirren), anzap (Knistern je Tafelplatz).
- Musikdateien (public/music, /music mit 30 Tagen Cache, MUSIC_V bei neuen Dateien erhöhen): jc_bg.mp3 (Halloween, Narrenkappe), an_bg.mp3 (Egypt, 4 min aus 15 min gekürzt), an_fs.mp3 (Freispiele: startet, wenn 3 Grabtore aufleuchten, bis Rundenende). Spieler gmusic() merkt sich die Stelle je Stück (GM.pos) und setzt den Hintergrund nach den Freispielen dort fort, 2 s Einblenden; ein Audio-Element über WebAudio-Gain (Lautstärke auch auf dem iPhone), freigeschaltet beim ersten Tippen; synthetische Musik bei diesen zwei Automaten aus. Grabtore leuchten beim Auslösen (.an-scatglow).
- Ticket-Fix: START mit offenem Gewinn und zu wenig Guthaben schreibt den Gewinn zuerst gut (tcTakeQuiet), statt „Nicht genug Diamanten“ zu melden (alle drei Automaten).
- Musik je Automat (tcmStep): Narrenkappe jcmStep (a-Moll-Tanz im 6/8, 138 bpm), Auge des Anubis anmStep (D Hijaz, Bordun + Handtrommel, 92 bpm), Triple Crown wie bisher. Anubis-Feld s_W neu: ganzer Kopf, goldener Rahmen ringsum, gespiegelt.
- Automaten-Klänge nach Merkur-Muster (Analyse der Online-Aufnahme): heller Start-Klick (3,2 kHz), jede Walze eigener ansteigender Stopp-Ton (jcstop0–4: C-Dur 523–1175 Hz, anstop0–4: D-Moll 294–587 Hz), Kappe: aufsteigender Glitzerlauf, Gewinn: Linienton + Bass-Schläge (jcbass) + Glocken. Kappen-Optik: Ursprungs-Kappe mit roten Strahlen (jc-src), Kappenfelder satt dunkelrot.
- Auge des Anubis Verbesserung wie im Original: Kopf lädt sich auf (.an-charge, Klang anchg: tiefes Grollen), Laser zur Tafel (anlaser: 780 + 390 Hz), danach drehen sich alle Bildsymbole der verbesserten Stufen auf den Walzen um (anFlipGrid, anflip: fallender Ton 2000→1050 Hz). Anubis-Klänge insgesamt ≈ 30 % leiser. Einblendungen (an-pop) ohne Zoom des ganzen Automaten (vorher Flackern).
- Heimlicher Bonus: Admin sieht beim Zuschauen „🎁 Vollbild/Kappe/Freispiele“, /api/admin/tcforce mit machine setzt tcForce für den Spieler dort (nur Admin kann setzen); nächster Dreh bekommt den Bonus, Spieler sieht nichts. Admin schaut unsichtbar zu (keine watch:new-Meldung, roomWatchers zählt Admin nicht).
- Prestige-Bedingungen zählen nur ab Erreichen der aktuellen Stufe: pres_base (Stand beim Aufstieg), p_best_score/p_best_streak (Bestwerte innerhalb der Stufe), progress.presVal/presSnapshot. Bisherige Spieler bekommen den Stand beim nächsten /api/home (zählt ab dann).
- Blackjack-Tische: Seitenwechsel (presence ≠ casino:tables) = aufstehen (bjTables.leave).
- Zuschauen von der Startseite: machGame/machLabel, richtiges Spiel und richtige Beschriftung je Maschine.
- Auge des Anubis: gestapelte Walzen (Grundspiel) + eigene Freispiel-Walzen FS_STRIPS: ≈ 95,5 %, Freispiele ≈ alle 145, Ø 63×, jede 5. Runde ≥ 100×, max ≈ 1.100×.
- Update 14 (u14-automaten) fest sichtbar (Freigabe-Knopf wieder entfernt), Code AUTOMATEN (15.000 💎, 30 Tage) wird beim Start angelegt. /api/admin/slotsrelease existiert noch, ist aber ohne Knopf. Admin-Test-Knöpfe: „👁 Freispiele“ (Anubis), „🃏 Kappe“, „👑 Vollbild“ (nur Admin).
- Level-Kurve prestige-abhängig (lib/progress.js need(lvl, p), capFor(p), levelInfo(xp, p)): bis Prestige 4 unverändert (15.225 XP bis Level 30), ab Prestige 5 steigend 400·1,12^(lvl−1)·(1+0,2·(p−5)) → Prestige 5: 85.830 XP (≈ 58 Matches), Meister: 188.860 XP. Alle CAP-Stellen nutzen capFor(prestige).
- Auge des Anubis Tafel-Verbesserung: anBeam(lvlAfter, lvlBefore): Anubis-Bilder sind fest gespiegelt (schauen zur Tafel), er leuchtet kurz (.an-glow) und schießt einen Laser (.an-laser, aus echten Positionen berechnet) auf jeden umgewandelten Tafelplatz.
- Casino-Reiter: gewählter Automat golden mit ▶ (vorher überdeckte ein !important-Hintergrund die Markierung).
- Autoplay (alle Automaten): bei riskierbarem Gewinn Pause mit 5-s-Countdown (tcAutoAfter), Risiko → danach weiter (tcAutoResume), START nimmt an und dreht weiter, sonst nach 5 s annehmen.
- Großgewinn-Banner tcBigWin ab 20× (Großer Gewinn), 50× (Riesengewinn), 100× (Mega-Gewinn), bei Triple Crown und Narrenkappe.
- Zuschauer: dauerhaftes 👀-Symbol mit Anzahl an der Maschine (#tcEye), Meldung mit richtigem Spielnamen. Glücksrad-Anzeige „noch X Drehungen (davon Y Bonus)“.
- Narrenkappe Admin-Test-Knopf „🃏 Kappe“ (tcForce): nächster Dreh Kappe auf Walze 3, 9 Felder. Walzenhöhe fest (kein Überlaufen beim Drehen).
- Narrenkappe: die Kappe selbst zählt immer als Narr (wie im Original, rot markiert), dazu 0–12 weitere Felder (CAP_W 4450/645/490/275/155/82/31/10), Auszahlung ≈ 95,7 % (2,5 Mio.).
- Narrenkappe Testphase (Setting jester_test, Standard AN): alle sehen, nur Admin darf sitzen/drehen, Zuschauen für alle; Schalter im Admin-Menü „🃏 Narrenkappe: Testphase“.
- Narrenkappe (lib/jester.js, Idee wie Merkurs Jolly's Cap, eigene Halloween-Symbole in public/jc/): 5 Walzen × 3, 10 Linien, Kürbisnarr W = Wild, Narrenkappe N nur auf Walze 3 verwandelt zufällig 0–8 Felder in W (CAP_K/CAP_W). Auszahlung ≈ 95,8 % (Simulation), Treffer ≈ 31 %, Kappe alle ≈ 17 Drehs. Maschinen 3 und 4 (TC_MACHINES = 4, machineGame), Endpunkt /api/casino/jester, Risikoleiter/Karte/Autoplay/Zuschauen über die Triple-Crown-Infrastruktur (tc.game = 'jester'). Oberfläche: jcSpin, jcAnimate (Streifen-Lauf wie Triple Crown), jcCap (Kappe fliegt auf das Symbol: Overlay public/jc/hat.webp, Feld rot, Ursprungs-Kappe kippt), jcLines; leise Klänge jcspin/jcstop/jcbell/jcpop/jccount, Nieten still.
- Triple Crown neue Walzen (Obst in 4er/5er-Blöcken) und Gewinne K 200, S 40, H 20, Obst 8, Chip 1: Vollbild ≈ 1 zu 600 (vorher 1 zu 6.100), Auszahlung 96,0 % exakt (Rechenwerkzeug /tmp/tc/calc.js-Prinzip: alle Walzenstellungen + Rad-Erwartung + Gratis-Kette).
- Roulette-Ergebnis-Pille (#rres): ausgeblendet mit opacity/visibility und genug Abstand über der Statusleiste; beim Verlassen des Roulettes sofort weg (Ticket #6 von paddy).
- Supporter-Set (nur per Geschenk): Titel TSUP „Supporter“ (bewegt), Emblem ESUP „Tüftel-Hamster“ (bewegt), Rahmen fsup „Tüftelwerk“ (Animation tuefte: Flackern + Pulsieren, dreht nicht, damit der Hamster oben bleibt). need: „Nur als Dankeschön vom Entwickler-Team (Support)“. Geschenke (Tabelle gifts) haben jetzt xp und items (GIFT_ITEMS in server.js), einzeln anhakbar beim Ticket-Abschluss und im Admin-Geschenk; Geschenk-Fenster zeigt XP und Stücke mit Bild.
- „Erneut spielen“ im Solo startet direkt die nächste Solo-Runde (again-Handler, gleiche Einstellungen), statt in eine offene Lobby zu wechseln (Ticket #4 von paddy).
- Fragenzähler (qTotal) = eingestellte Fragenzahl (vorher verfügbare Fragen, zeigte z. B. „8 von 14“). Luxus-Tisch-Schrift nur in der Lobby. Update 13 als u13b-quiz neu (Lesebonus erneut) mit Pokertischen.
- Fragen auffüllen: topUp(m) in lib/game.js füllt aus dem Fragenpool bzw. eingebauten Fragen auf, wenn die KI zu wenig liefert (nach dem KI-Lauf und vor dem Ende in nextQuestion). Match endet nur noch vorzeitig, wenn wirklich keine Frage mehr da ist (m.noMore). Solo-Sieggrenze anteilig, falls doch weniger Fragen. Test: TEST_QCAP=8.
- Gewinn-Meldung an alle: Schwelle im Admin (Setting bigwin_min, 0 = aus, Standard 50.000).
- Poker: Tische Diamond Lounge (15.000, Blinds 500/1.000, lux 1) und Royal Amethyst (150.000, Blinds 5.000/10.000, lux 2), Bilder public/tcg/poker_diamond|royal.webp (720×956, aus poker_high als Referenz), Luxus-Stil pk-lux1/2.
- Zuschauer-Meldung: notifyWatched() → Socket watch:new an den Spieler („X schaut dir bei Triple Crown/Roulette/Blackjack zu“), bei tc:watch und cw:watch.
- Triple Crown Zuschauer: tcEmit und tc:snap senden dia (Guthaben des Spielers); Anzeige beim Dreh erst ohne Gewinn, danach mit.
- Verlauf als PDF: GET /api/admin/ledger.pdf?name&kind&hours (pdfkit), Zeitfenster-Auswahl + „📄 Als PDF“ im Admin-Verlauf, teilen/herunterladen. Quellen-Namen aus LG_SRC in index.html.
- Zweite Ebene layer()/closeLayer() (#layer2) für Großansicht und Trophäen-Auswahl: Schließen führt zurück zum darunterliegenden Fenster. Trophäen-Knopf auch in „Profil bearbeiten“ (nur Admin).
- Trophäen-Vitrine (lib/trophies.js LIB, Setting trophies): nur beim Admin (profileExtras), gold umrandet über der Vitrine, antippbar (zoomImg). Bearbeiten nur Admin (/api/admin/trophies). Bilder in public/trophies/ (karambit Pattern 387, ak47 Pattern 661, freigestellt).
- Triple Crown Einsätze bis 50.000 (BETS in lib/triple.js und TC_BETS in index.html: ... 5000, 10000, 20000, 50000). Gewinne und Risiko-Spitze (50x) skalieren automatisch.
- „Alle Karten“-Ziele (EK2 Goldenes Album, TK2 Komplettist, FK1 Kartenkranz) in /api/home dynamisch = COLLECT.total (440 mit Gruselnacht); ITEM_GOALS wird nur beim Start berechnet, daher dort überschrieben. Herausforderung collect_unique: neue Stufe 440 (+20.000 XP).
- Casino-Stufennamen im Browser: TIER_NAMES mit allen 11 Stufen (wie lib/vip.js), tierName(); vorher „undefined“ ab Obsidianherz. Items-Übersicht zeigt Pass-Items (event true) immer.
- VIP-Stufen Geisterhand (vip8) und Schattenkrone (vip9) jetzt bewegt (Wan 3.0, nachgezeichnet auf Schwarz). VIP-Stufen in den Casino-Einstellungen antippbar: zoomImg() Großansicht (data-zoom). Emblem-Detail größer.
- Turbo-Öffnung: Schalter „⚡ Turbo“ oben rechts im Booster-Inventar (localStorage turbo_open), openTurbo(): 0,65 s Drehung, Aufreißen, alle Karten nebeneinander, Nächsten öffnen / Fertig.
- Shop als eigene Seite (ctab shop blendet Reiter aus): Kategorien Alles/Booster/Displays/Tränke (shopCat), je teuerste zuerst.
- Poker: Aktionsbereich feste Höhe + Scroll-Position gehalten (kein Springen), Pieptöne bei eigener Restzeit < 10 s (schneller werdend, sfx pkbeep/pkbeep2), Chip-Klänge (chips, chipswin).
- Börse Neu-Zähler: Server mkTimes in /api/home + Socket market:new; Client mk_seen in localStorage je Art, Zähler am Börse-Reiter und an Karten/Booster/Displays.
- Showroom-Sounds (sfx srspin, srglow, srtear, srflash, srcard), synthetisch, dezent.
- Casino-XP live: Server sendet nach jeder Casino-Runde und nach Herausforderungs-Casino-XP 'me:cxp' (cxp, pcxp, tier); Client zieht VIP-Kopf, Profil und Casino-Strang nach. Herausforderungs-Casino-XP zählen auch für den Strang.
- Kronen-Pass Casino-Strang (lib/pass.js CASINO, casNeed: 20 Stufen bis 2,5 Mio Casino-XP): Zähler users.pass_cxp (casinoStat + Poker, nur wenn Pass aktiv), abgeholt in pass_cc; track 'casino' in /api/pass/claim, 'all' holt mit ab. Titel TX1-4, Embleme EX1-4 (alle bewegt, Wan 3.0). ACHTUNG: TC1-3/EC1-3 = GAMBLER-Code-Items, TP1-3/EP1-3 = Poker-Items. test/ids.js prüft doppelte Kennungen. Stufe 20: Titel + Gruselnacht-Display.
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


## Stand Version 114 (23./24.09.2026) – alles live bis auf den letzten Deploy, siehe oben

Bild-Werkzeuge in dieser Session (Ablauf zum Nachmachen):
- Freistellen auf Schwarz: `python3 tools/assets/cutout.py in.png out.webp emblem 400` (auch für Packs/Displays)
- Freistellen auf Weiß/Grau (z. B. Trophäen): kleines PIL-Skript, Hintergrundfarbe an den Ecken messen,
  Alpha = Abstand zur Farbe (siehe Trophäen Karambit/AK in `public/trophies/`)
- Bewegte Embleme/VIP-Abzeichen: Bild in hoher Auflösung auf Schwarz (bei kleinen/transparenten Vorlagen erst mit
  `gpt_image_2_5` „Recreate this exact badge … high resolution … pure black background“ nachzeichnen lassen),
  dann Wan 3.0 5 s 1:1 720p, dann `tools/anim/emb.py` (180×180, 42 Bilder)
- Bewegte Titel: 21:9 ohne Text, Wan `aspect_ratio: auto`, dann `tools/anim/towebp.sh … banner <YPOS>`,
  Kopf abgeschnitten → YPOS kleiner (TX4 = 0.2)
- Update-Bilder zusammensetzen: mehrere freigestellte Assets mit PIL + weichem Leuchten (`public/news/u12_hero.webp`)
- Werbe-Trailer: Wan 3.0, 30 s, 9:16, `generate_audio: true`, `enable_thinking: true`, 6 `image_references`
  (Logo, Pass-Logo, Booster, Display, Kürbiskönig, Triple-Crown-Logo), Drehbuch mit Zeitmarken im Prompt,
  Endkarte per ffmpeg `drawtext` (Schrift Anton, keine Emojis)

Neu in dieser Session (Details in den Punkten weiter oben):
- Gruselnacht-Display (24 Booster), Tränke (×2/×4 für Level-, Casino-, Pass-XP, 60 Min echte Zeit, verlängerbar),
  Gutscheincodes mit mehreren Belohnungen, Ankündigungsbanner mit Einlösen, Update 12 mit Code GEISTERJACKPOT
- Kronen-Pass: Casino-Strang (20 Stufen bis 2,5 Mio Casino-XP) mit Umschalter, Fortschrittsleisten in beiden
  Strängen („Bis Stufe X: a / b“ und „Insgesamt“), Wochenaufgaben zählen erst ab Pass-Start
- Shop als eigene Seite (Kategorien, teuerste zuerst), Shop-Steuerung für Booster, Displays und Tränke
  (Preis, Bestand, Ausverkauft, Nicht im Verkauf, Hinweistext), Push an Admin beim Ausverkauf
- Showroom-Fixes (Kartenwechsel), Sounds, Turbo-Öffnung; Poker ohne Springen, Piepen, Chip-Klänge
- Börse: Neu-Zähler je Art, Displays-Reiter; Casino-XP live; Triple Crown bis 50.000 Einsatz, Nieten weniger XP,
  Zuschauer sehen Guthaben; Verlauf mit Klartext-Notizen und als gestalteter PDF-Kontoauszug
  (`tools/pdf/` Logo + Schriften Anton/Archivo, pdfkit)
- Trophäen-Vitrine nur für den Admin (Karambit Pattern 387, AK-47 Pattern 661)
- Roulette statistisch geprüft (1 Mio Drehungen: fair). Tischlimit weiterhin offen (Nick entscheidet)

Offen / Ideen von Nick:
- DB-Umzug vor 19.10.2026, Tokens erneuern
- Roulette-Höchsteinsatz, Admin: Spieler-Akte, Buchung rückgängig, Backup-Knopf, Statistik-Seite, Zeitsteuerung
- App-Symbol: Halloween-Logo als Icon (Nick noch nicht entschieden; iOS aktualisiert Homescreen-Icons nicht)
