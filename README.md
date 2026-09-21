# PUNKTLANDUNG

Multiplayer-Schätzspiel für bis zu 8 Spieler pro Match, maximal 2 Matches gleichzeitig.

## Start lokal
    npm install
    INVITE_CODE=meincode node server.js
Dann http://localhost:3000 öffnen.

## Umgebungsvariablen
| Variable | Zweck |
|---|---|
| `INVITE_CODE` | Optionaler Code für die Registrierung. Leer oder nicht gesetzt: jeder kann sich ohne Code anmelden |
| `MAX_MATCHES` | Wie viele Matches gleichzeitig laufen dürfen (Standard 2) |
| `ADMIN_NAME` | Spielername, der im Profil Passwörter anderer Spieler neu setzen darf |
| `SECRET` | Schlüssel für Login-Tokens. Fest setzen, sonst fliegen alle nach jedem Neustart raus |
| `DATABASE_URL` | Postgres-URL. Ohne sie liegen Accounts und Statistiken nur im Arbeitsspeicher |
| `ANTHROPIC_API_KEY` | Schaltet live generierte Fragen während des Countdowns ein |
| `ANTHROPIC_MODEL` | Standard `claude-sonnet-5` |

## Punkte
- Schätzfrage: 0 bis 100 Punkte nach Nähe (0 Punkte ab 50 % Abweichung, bei Jahreszahlen ab 50/100/200 Jahren)
- Sehr nah dran (innerhalb 4 % dieser Spanne): 200 Punkte (×2)
- Punktlandung: 500 Punkte (×5); der Punkteabfall ist quadratisch, weit daneben gibt fast nichts
- Am nächsten dran: +25
- Auswahlfrage: 100 Punkte, kein Multiplikator

## Sammelkarten
- Diamanten richten sich nach den erreichten Punkten: Sieg bis 1000 Punkte ≈ 230, bis 4000 Punkte ≈ 660; Niederlagen bringen etwa die Hälfte. Admin setzt sie über `/api/admin/diamonds`
- Booster kosten 300 (Standard), 550 (Premium) und 800 (Geister), also etwa 2, 3 bis 4 und 5 Siege
- 110 Karten in `lib/tcg.js`: je 50 im Standard- und Premium-Booster, dazu 10 eigene Ghost-Rare-Karten
- Der Geister-Booster (800 Diamanten) enthält alle Karten beider Sets, aber kein Extended Art; dafür als einziger die Ghost-Rare-Karten (0,6 %)
- Häufige Karten gibt es nur einstufig, seltene und legendäre je in drei Stufen (Selten/Holo/Ultra bzw. Legendär/Ultra/Extended Art)
- Kartenseite über die Startseite: Sammlung, Booster-Inventar, Shop, Börse und Tausch
- Sammlung: eigene Karten zuerst, Filter nach Besitz und Seltenheit, Seltenheits-Symbol auf jeder Kachel
- Tippen auf eine Karte öffnet die Großansicht: Neigen per Maus oder Gyroskop, Holo-Schimmer, Werte und Effekt darunter
- Börse: Karte gegen Diamanten anbieten, kaufen, Angebot zurückziehen. Tausch: Karte gegen Karte mit Freunden, mit Push-Nachricht
- Die Duell-Logik fehlt noch, der Knopf im Kartenbereich ist ausgegraut

## Benachrichtigungen
- Web-Push über eigenen Service Worker (`public/sw.js`), Schlüssel werden beim ersten Start erzeugt und in der Tabelle `settings` abgelegt
- Auf dem iPhone nur, wenn die Seite auf dem Homescreen liegt (iOS 16.4+); Hinweis dazu steht auf der Startseite
- Push bei Herausforderung, dazu Rundruf an alle über das Mod-Menü
- Ein- und ausschalten im Profil unter „Benachrichtigungen“

## Aktion GRACE
- Eigenes Fragenthema `GRACE` (Kategorie `GRACE` in `lib/questions.js`, dort eintragen)
- Läuft bis zum Zeitpunkt in `lib/event.js` bzw. der Variable `GRACE_END`
- Wer in dieser Zeit eine Runde mit dem Thema GRACE gewinnt, schaltet Rahmen `fgrace`, Titel `tgrace` und Emblem `egrace` frei
- Nach Ablauf verschwindet das Thema aus der Auswahl, freigeschaltete Sachen bleiben

## Profilrahmen
- 22 runde Rahmen ums Profilbild (`lib/frames.js`), 20 über Herausforderungen, „Pink Pages“ über den Code `GRACE`, „DEV“ nur für Admin und Co-Admins
- Fünf davon sind animiert (Flamme, Blitz, Gift, Sternenstaub, Lavagold), der DEV-Rahmen rotiert und wechselt die Farbe
- Auswahl im Profil unter „Rahmen“, abwählbar

## Spielerkarten
- 30 Embleme und 31 Titel, jeweils an eine Bedingung geknüpft (siehe `lib/cards.js`)
- Titel sind eigene Banner-Grafiken (`public/emblems/title_*.webp`), Embleme eigene Icons (`pc_*.webp`)
- Die Spielerkarte zeigt Profilbild, Emblem, Clan-Tag, Name, Titel, Level-Balken, Prestige-Logo und die Siegesserie als Flamme (1 bis 5, Farbe steigt)
- Auswahl im Profil, sichtbar in Lobby, Punktestand, Auflösung, Endstand und den Ranglisten
- Geheime Freischaltung: Emblem „Pink Pages“ und Titel „BookTok-Legende“ über den Code `GRACE`
- Weitere Codes in `CODES` in `lib/cards.js` eintragen

## Ranglisten
- Weltrangliste nach Weltranglistenpunkten (nur Ranglisten-Matches)
- Bestenliste mit zwei Ansichten: nach Gesamtpunkten (Standard) und nach Rang (Prestige, Level, Siege)
- Zuletzt-online-Zeit wird bei jedem Verbinden und Trennen gespeichert und in Freundesliste, Ranglisten, Spielerprofil und Mod-Menü angezeigt
- Siegesserien erscheinen als Flamme neben dem Namen. Mit ⚔ lässt sich jeder Online-Spieler herausfordern: wer kein Match offen hat, eröffnet mit dem Klick automatisch eines. In der Lobby gibt es zusätzlich „Freunde einladen“

## Rollen und Mod-Menü
- `ADMIN_NAME` ist der Hauptadmin, er vergibt Rollen: `coadmin` (voller Zugriff aufs Mod-Menü, Regenbogen-Tag) und `supporter` (bisher nur eine Markierung)
- Mod-Menü im Profil: alle Spieler durchsuchen, Level, Prestige, WP, Siege, Serie usw. einzeln setzen (Level und Prestige unabhängig), Embleme und Titel freischalten oder alles zurücksetzen
- Reservierte Tags (DEV usw.) bleiben dem Hauptadmin vorbehalten

## Clan-Tags
- 2 bis 5 Zeichen vor dem Namen, Farbe wählbar
- `DEV`, `ADMIN`, `MOD` und der Regenbogen-Verlauf sind dem Admin (`ADMIN_NAME`) vorbehalten

## Auflösung
- Siegestreppe: die Zeilen bauen sich von unten nach oben auf, der schlechteste zuerst, der Sieger zuletzt
- Jede Zeile zeigt Platz, Profilbild, Name, Genauigkeitsbalken, Abweichung im Klartext, Wert und Punkte
- Danach erscheint der Sieger im goldenen Banner, bei einer Punktlandung zusätzlich das Bullseye-Abzeichen
- Jede einrastende Zeile hat einen eigenen Einschlagsound

## Einstellungen
- Punktelimit 500 bis 4000 (Server erlaubt bis 10.000), Fragen 15 bis 40, Countdown 30 bis 120 s
- Zeit pro Schätzfrage 8, 20, 30 oder 45 s; der Schnellmodus setzt 8 s
- „Auf frische Fragen warten“ hält den Start bis zu 2 Minuten an, der feste Pool sichert immer ab

## Toon-Welt-Set
- 30 Karten, 3 davon zusätzlich als Extended Art, eigener Booster (2.000 Diamanten, 2 Karten)
- Der Booster ist vorerst gesperrt (`locked: true` in lib/tcg.js); Admin und Co-Admins können ihn zum Testen kaufen
- Belohnungen fürs Sammeln: Titel Toon-Leser (5), Toon-Zauberer (15), Herrscher der Toon-Welt (alle 30, animiert);
  Embleme Toon-Grimoire (10), Arcane-Siegel (20), Herr der Toon-Welt (alle 30, animiert)

## Casino-Fortschritt
- Eigene Statistik: Runden, Siege, bester Gewinn, Bilanz und Casino-XP
- Casino-Rangliste auf der Startseite, sortiert nach Casino-XP
- Herausforderungen: Stammspieler, Glückssträhne, Großer Wurf
- Sammler-Herausforderungen: Sammler, Rarität, Vitrine (zählen den Kartenbestand)
- Dazu 4 Embleme, 4 Titel und 2 Rahmen für Casino und Sammeln
- Fünf legendäre, animierte Sätze für sehr harte Ziele: Höllenkessel, Teufelsblatt, Prismatresor, Münzdrache, Kronarchiv (Emblem, Titel und Rahmen je animiert)

## Glücksspiel
- Im Kartenbereich unter „Gambling“: Roulette und Blackjack, Einsatz in Diamanten (50 bis 20.000)
- Roulette: einfache Chancen zahlen doppelt, Drittel dreifach, eine einzelne Zahl 36-fach
- Blackjack mit vollen Regeln: Teilen (bis 4 Hände, Asse nur eine Karte), Verdoppeln, Versicherung bei Ass der Bank (zahlt 2:1), Aufgeben (halber Einsatz zurück), Blackjack zahlt 3:2, Bank zieht bis 17
- Tisch in Draufsicht, Karten rutschen aus dem Schlitten auf den Tisch
- Mehrspieler-Tische (`lib/bjtables.js`): bis zu 6 Tische mit je 5 Plätzen, gemeinsame Bank, der Gastgeber teilt aus, alle spielen nacheinander, nach 7 Sekunden beginnt die nächste Runde
- Alle Ziehungen und Karten entscheidet der Server, der Client zeigt nur an

## Wetten
- In der Pre-Lobby kann jeder Diamanten auf den eigenen Sieg setzen (mindestens 50)
- Der Einsatz wird sofort gesperrt, bei Rücknahme oder Verlassen der Lobby gibt es ihn zurück
- Sieg: doppelter Einsatz zurück. Niederlage: der Einsatz geht zu gleichen Teilen an die Sieger
- Allein gespielte Runden zählen nicht, der Einsatz kommt zurück

## Zuschauen
- Wer einem laufenden oder vollen Match beitritt, landet automatisch als Zuschauer darin
- Zuschauer sehen Fragen, Auflösung und Punktestand, können aber nicht antworten
- Oben steht, wie viele zuschauen; Zuschauer dürfen jederzeit Reaktionen schicken

## Ablauf
1. **Einrichten** — Host wählt Modus, Themen, Zugang und Regeln. Das Match taucht noch nirgends auf.
2. **Match eröffnen** — Pre-Lobby mit Code, Spielerliste und Chat. Ab jetzt können andere beitreten.
3. **Match starten** — Countdown, in dem die Fragen erstellt werden. Steht „Auf frische Fragen warten“ an, startet das Match erst, wenn die KI fertig ist (höchstens eine Minute länger). Beitritt bleibt bis zum Start möglich, der Host kann abkürzen.
4. Ab der ersten Frage ist das Match geschlossen. Aussteigen geht jederzeit über das ✕ unten rechts, dann aber ohne XP und Weltranglistenpunkte für dieses Match.

Der Ton lässt sich jederzeit über den Lautsprecher-Knopf unten rechts umschalten; Lautstärke im Profil.

Der Chat läuft in Pre-Lobby, Countdown und am Endstand. Er lebt nur solange das Match existiert und ist weg, sobald alle es verlassen haben.

## Modi
- **Rangliste**: Fragen aus allen Themen, am Ende Weltranglistenpunkte nach Platzierung (Werte in `lib/progress.js`)
- **Freies Spiel**: bis zu 8 Themen wählbar, keine Weltranglistenpunkte. Es kommen ausschließlich Fragen aus den gewählten Themen, auch die live erzeugten. Reicht der Themenpool nicht für die eingestellte Fragenzahl, wird die Runde kürzer statt themenfremd
- 15 Themen, ihre Kategorien stehen in `lib/themes.js`; ein Thema kann dort einen `hint` haben, der der KI mitgegeben wird (BookTok: nur Bücher ab 2000)
- Innerhalb eines Matches wiederholt sich keine Frage, auch nicht nach „Nochmal spielen“. Geht der Themenpool zur Neige, wird die Runde kürzer; erst wenn alles durch ist, beginnt der Pool von vorn

## Fortschritt
- XP pro Match: 100 fürs Beenden, halbe Punktzahl, 10 pro beantworteter Frage, 250 für den Sieg, 500 pro Punktlandung, dazu Herausforderungs-Stufen
- 30 Level pro Prestige (15.225 XP), 10 Prestige-Ränge mit eigenen Emblemen und Profilbild-Rahmen
- Das getragene Prestige-Logo ist frei wählbar, bis zum erreichten Rang (oder ganz ohne)
- Prestige 11 ist das Meisterprestige mit eigenem animierten Logo und dem exklusiven Titel „Meister aller Klassen“
- Prestige braucht Level 30 plus Bedingungen je Rang (Rang 1: 3 Siege ... Rang 10: 100 Siege, 15 Punktlandungen, 5 Siege in Folge). Werte stehen in `lib/progress.js`
- Wer ein Match vorzeitig verlässt, bekommt keine XP

## Test
    npm test
Simuliert ein komplettes Match mit drei Spielern.
