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

- 100 Motive in `lib/gn.js` (erzeugt von `tools/cards/hw/gen_defs.py`), 145 Varianten: 40 Häufig, 25 Selten (+Holo), 15 Legendär (+Ultra), 10 nur Ultra, 5 nur Extended, 5 Extended + Mythisch (bewegt). 50 Rahmen A (`hw/frame_a.png`), 50 Rahmen B.
- Bilder: `tools/cards/hw/gn_jobs.json` enthält je Karte Prompt und Higgsfield-Job-ID (leer = noch erzeugen). Querformat 4:3 für normale Karten, 3:4 für Extended/Mythisch.
- Rendern: `tools/cards/build_hw.py` (statisch, schneidet unten statt oben), `tools/cards/anim_card.py` (Mythisch aus Wan-3.0-Video).
- Set zählt nicht zur Sammlung, bis es freigeschaltet wird (COLLECT in server.js schließt set 'gn' aus). Booster `gn` ist `locked`.
- Achtung: Rate-Limit bei gpt_image_2_5, höchstens etwa 10 Bilder pro Schub.
