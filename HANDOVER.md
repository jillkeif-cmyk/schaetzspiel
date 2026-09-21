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

## Karten rendern

`tools/cards/build3.py` baut eine Karte aus Motiv plus Rahmenvorlage `frame2.png`
(magentafarbene Flächen werden ersetzt). Stufen: haeufig, selten, holo, ultra, legend, ext, ghost.
`renderall.py START ENDE` rendert alle Varianten aus `lib/tcg.js`, in Blöcken von etwa 120,
weil ein Lauf sonst die 300-Sekunden-Grenze reißt. Die Motive liegen nicht im Repo;
für neue Karten neu generieren.

Regeln: Häufige Karten nur einstufig. Seltene: selten, holo, ultra. Legendäre: legend, ultra, ext.
Ghost-Karten sind 10 eigene Motive nur im Geister-Booster. Je 50 Karten pro Standard/Premium.

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
