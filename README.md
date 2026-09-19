# Schätzspiel

Multiplayer-Schätzspiel für bis zu 6 Spieler pro Match, maximal 2 Matches gleichzeitig.

## Start lokal
    npm install
    INVITE_CODE=meincode node server.js
Dann http://localhost:3000 öffnen.

## Umgebungsvariablen
| Variable | Zweck |
|---|---|
| `INVITE_CODE` | Code, den neue Spieler bei der Registrierung brauchen (Standard: `schaetzen`) |
| `MAX_MATCHES` | Wie viele Matches gleichzeitig laufen dürfen (Standard 2) |
| `ADMIN_NAME` | Spielername, der im Profil Passwörter anderer Spieler neu setzen darf |
| `SECRET` | Schlüssel für Login-Tokens. Fest setzen, sonst fliegen alle nach jedem Neustart raus |
| `DATABASE_URL` | Postgres-URL. Ohne sie liegen Accounts und Statistiken nur im Arbeitsspeicher |
| `ANTHROPIC_API_KEY` | Schaltet live generierte Fragen während des Countdowns ein |
| `ANTHROPIC_MODEL` | Standard `claude-sonnet-5` |

## Punkte
- Schätzfrage: 0 bis 100 Punkte nach Nähe (0 Punkte ab 50 % Abweichung, bei Jahreszahlen ab 50/100/200 Jahren)
- Sehr nah dran (innerhalb 4 % dieser Spanne): 200 Punkte (×2)
- Punktlandung: 500 Punkte (×5)
- Am nächsten dran: +25
- Auswahlfrage: 100 Punkte, kein Multiplikator

## Spielerkarten
- 10 Embleme und 10 Titel, jeweils an eine Bedingung geknüpft (siehe `lib/cards.js`)
- Titel sind eigene Banner-Grafiken (`public/emblems/title_*.webp`), Embleme eigene Icons (`pc_*.webp`)
- Die Spielerkarte zeigt Profilbild, Emblem, Clan-Tag, Name, Titel, Level-Balken, Prestige-Logo und die Siegesserie als Flamme (1 bis 5, Farbe steigt)
- Auswahl im Profil, sichtbar in Lobby, Punktestand, Auflösung, Endstand und den Ranglisten
- Geheime Freischaltung: Emblem „Pink Pages“ und Titel „BookTok-Legende“ über den Code `GRACE`
- Weitere Codes in `CODES` in `lib/cards.js` eintragen

## Rollen und Mod-Menü
- `ADMIN_NAME` ist der Hauptadmin, er vergibt Rollen: `coadmin` (voller Zugriff aufs Mod-Menü, Regenbogen-Tag) und `supporter` (bisher nur eine Markierung)
- Mod-Menü im Profil: alle Spieler durchsuchen, Level, Prestige, WP, Siege, Serie usw. einzeln setzen (Level und Prestige unabhängig), Embleme und Titel freischalten oder alles zurücksetzen
- Reservierte Tags (DEV usw.) bleiben dem Hauptadmin vorbehalten

## Clan-Tags
- 2 bis 5 Zeichen vor dem Namen, Farbe wählbar
- `DEV`, `ADMIN`, `MOD` und der Regenbogen-Verlauf sind dem Admin (`ADMIN_NAME`) vorbehalten

## Ablauf
1. **Einrichten** — Host wählt Modus, Themen, Zugang und Regeln. Das Match taucht noch nirgends auf.
2. **Match eröffnen** — Pre-Lobby mit Code, Spielerliste und Chat. Ab jetzt können andere beitreten.
3. **Match starten** — Countdown, in dem die Fragen erstellt werden. Beitritt bleibt bis zum Start möglich, der Host kann abkürzen.
4. Ab der ersten Frage ist das Match geschlossen. Aussteigen geht jederzeit über das ✕ unten rechts, dann aber ohne XP und Weltranglistenpunkte für dieses Match.

Der Chat läuft in Pre-Lobby, Countdown und am Endstand. Er lebt nur solange das Match existiert und ist weg, sobald alle es verlassen haben.

## Modi
- **Rangliste**: Fragen aus allen Themen, am Ende Weltranglistenpunkte nach Platzierung (Werte in `lib/progress.js`)
- **Freies Spiel**: bis zu 8 Themen wählbar, keine Weltranglistenpunkte. Es kommen ausschließlich Fragen aus den gewählten Themen, auch die live erzeugten. Reicht der Themenpool nicht für die eingestellte Fragenzahl, wird die Runde kürzer statt themenfremd
- Themen und ihre Kategorien stehen in `lib/themes.js`

## Fortschritt
- XP pro Match: 100 fürs Beenden, halbe Punktzahl, 10 pro beantworteter Frage, 250 für den Sieg, 500 pro Punktlandung, dazu Herausforderungs-Stufen
- 30 Level pro Prestige (15.225 XP), 10 Prestige-Ränge mit eigenen Emblemen und Profilbild-Rahmen
- Prestige braucht Level 30 plus Bedingungen je Rang (Rang 1: 3 Siege ... Rang 10: 100 Siege, 15 Punktlandungen, 5 Siege in Folge). Werte stehen in `lib/progress.js`
- Wer ein Match vorzeitig verlässt, bekommt keine XP

## Test
    npm test
Simuliert ein komplettes Match mit drei Spielern.
