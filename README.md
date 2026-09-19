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
| `ADMIN_NAME` | Spielername, der im Profil Passwörter anderer Spieler neu setzen darf |
| `SECRET` | Schlüssel für Login-Tokens. Fest setzen, sonst fliegen alle nach jedem Neustart raus |
| `DATABASE_URL` | Postgres-URL. Ohne sie liegen Accounts und Statistiken nur im Arbeitsspeicher |
| `ANTHROPIC_API_KEY` | Schaltet live generierte Fragen während des Countdowns ein |
| `ANTHROPIC_MODEL` | Standard `claude-sonnet-5` |
| `MAX_MATCHES` | Standard 2 |

## Punkte
- Schätzfrage: 0 bis 100 Punkte nach Nähe (0 Punkte ab 50 % Abweichung, bei Jahreszahlen ab 50/100/200 Jahren)
- Sehr nah dran (innerhalb 4 % dieser Spanne): 200 Punkte
- Punktlandung: 1000 Punkte
- Am nächsten dran: +25
- Auswahlfrage: 100 Punkte, kein Multiplikator

## Fortschritt
- XP pro Match: 100 fürs Beenden, halbe Punktzahl, 10 pro beantworteter Frage, 250 für den Sieg, 500 pro Punktlandung, dazu Herausforderungs-Stufen
- 30 Level pro Prestige (15.225 XP), 10 Prestige-Ränge mit eigenen Emblemen und Profilbild-Rahmen
- Prestige braucht Level 30 plus Bedingungen je Rang (Rang 1: 3 Siege ... Rang 10: 100 Siege, 15 Punktlandungen, 5 Siege in Folge). Werte stehen in `lib/progress.js`
- Wer ein Match vorzeitig verlässt, bekommt keine XP

## Test
    npm test
Simuliert ein komplettes Match mit drei Spielern.
