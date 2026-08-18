# Stundenbilanz

Dashboard für Lernende auf der BYCS-Lernplattform. Es zeigt den eigenen Stand
über alle Kursteile eines Schuljahres: geplante Stunden gegen verstrichene
Schulwochen, ausgewiesen als Rückstand oder Vorsprung in Stunden.

Kein Lehrkraft- oder Klassenblick, keine Fremddaten.

## Aufbau

```
index.html      Gerüst
style.css       Darstellung
plan.json       Planung — Kurse, Pflichtaufgaben, Stunden, Schulwochen
js/plan.js      Laden und Validieren der Planung
js/moodle.js    Statusabruf aus den Kursübersichten
js/status.js    Zustandsregeln für assign und quiz
js/bilanz.js    Soll, Ist, Delta, Qualität
js/view.js      Darstellung des berechneten Modells
js/app.js       Ablaufsteuerung
```

Vanilla JavaScript als ES-Module, kein Build-Schritt, keine externen
Abhängigkeiten.

## Datenquellen

Die Trennung ist strikt:

| Quelle | Liefert | Liefert nicht |
|---|---|---|
| `plan.json` | Kurse, Pflichtaufgaben, geplante Stunden, Anzeigenamen, Schulwochenkalender | keinen Status |
| Moodle | Abgabestatus und Bewertung je Aufgabe | keine Planung |

Aufgabennamen in Moodle tragen zwar Stundenangaben, aber uneinheitlich
(`8h`, `2 Std`, `20 Min`) und teils mehrfach identisch. Auch die
Pflicht-Kennzeichnung ist dort unzuverlässig. Beides kommt deshalb aus
`plan.json`, referenziert über `cmid`.

## Rechnung

```
Soll(w)  = Σ Stunden Schulwoche 1..w / Σ Stunden gesamt
Ist      = Σ geplante Stunden abgegebener Pflichtaufgaben / Σ Stunden gesamt
Delta    = (Ist − Soll) × Σ Stunden gesamt        → in Stunden
Qualität = Ø Bewertung, ungewichtet über bewertete Abgaben
```

Bezugsgröße ist immer das gesamte Schuljahr einschließlich noch gesperrter
Kursteile. Dadurch bleibt der Nenner beim Freischalten konstant — es kommt
kein Nenner hinzu, es wandern nur Aufgaben von „nicht begonnen" nach
„abgegeben".

Der Fortschritt ist mit geplanter, nicht mit tatsächlich aufgewendeter Zeit
gewichtet. Das benennt das Dashboard einmal offen. Die Qualität fließt nicht
in den Fortschritt ein.

## Zustände

Fortschrittswirksam ist **abgegeben** — unabhängig von der Bewertung.

**Aufgaben** (`assign`) — Leitgröße ist `submissionstatus`, nicht
`completion`. Letzteres bedeutet je nach Aktivität etwas anderes, mal „Abgabe
einreichen", mal „Eine Bewertung erhalten", und wäre als Fortschrittsmaß von
der Konfiguration der einzelnen Aufgabe abhängig.

| Abgabestatus | Bewertung | Zustand | zählt |
|---|---|---|---|
| Keine Abgabe | – | Nicht begonnen | nein |
| Entwurf (nicht abgegeben) | – | Entwurf | nein |
| Zur Bewertung abgegeben | `-` | Abgegeben | ja |
| Zur Bewertung abgegeben | Wert | Bewertet | ja |

**Tests** (`quiz`) — ihre Übersichtstabelle hat keine Abgabespalte. Da alle
Pflicht-Tests automatisch bewertet werden, dient die Bewertung als
Ersatzsignal: liegt eine vor, wurde abgegeben.

Die Bestehensgrenze prüft Moodle in der Aktivität selbst. Das Dashboard
unterscheidet nicht zwischen bestanden und nicht bestanden.

## Planungsdatei pflegen

`plan.json` liegt im Hauptkurs neben dem Dashboard. Beim Laden wird sie
validiert; fehlende Pflichtfelder und doppelte `cmid` werden im Klartext
gemeldet, statt still weiterzurechnen.

Die `cmid` einer Aktivität steht in ihrer URL:
`.../mod/assign/view.php?id=94824799` → `"cmid": "94824799"`.

Stunden sind Dezimalzahlen: `0.33` für 20 Minuten, `2.5` für zweieinhalb
Stunden. Ferienwochen bleiben mit `"stunden": 0` im Kalender.

Der gesperrte Kurs wird mit `"gesperrt": true` geführt. Seine Aufgaben werden
vollständig gepflegt, obwohl der Kurs noch nicht erreichbar ist — diese
Stunden stehen von Tag eins im Nenner. Ein Statusabruf findet für ihn nicht
statt.

## Betrieb

Die Dateien liegen als Aktivität „Datei" im Hauptkurs, `index.html` als
Hauptdatei. Weil die Seite damit unter `lernplattform.bycs.de` läuft, kann
sie die Kursübersichten in der Sitzung der angemeldeten Person lesen.

Pro Unterkurs werden zwei Seiten abgerufen — je eine für Aufgaben und Tests.
Es gibt kein Caching über die Sitzung hinaus; der Zustand lebt nur im
Speicher der Seite.

## Kurse

| Kurs | ID | Stand |
|---|---|---|
| OOP und Frontend | 2491549 | offen |
| Backend und Datenbanken | 2491870 | gesperrt |
