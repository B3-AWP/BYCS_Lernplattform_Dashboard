# Stundenbilanz

Dashboard für Lernende auf der BYCS-Lernplattform. Es zeigt den eigenen Stand
über alle Abschnitte eines Schuljahres: geplante Stunden gegen verstrichene
Schulwochen, ausgewiesen als Rückstand oder Vorsprung in Stunden.

Kein Lehrkraft- oder Klassenblick, keine Fremddaten.

## Aufbau

```
index.html      Gerüst
style.css       Darstellung
plan.json       Planung — Schienen, Kurse, Pflichtaufgaben, Stunden
js/plan.js      Laden und Validieren der Planung
js/moodle.js    Statusabruf aus den Kursübersichten
js/schiene.js   Klassenerkennung und Schienenwahl
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
| `plan.json` | Schienen mit Blockwochen, Klassenzuordnung, Kurse, Pflichtaufgaben, geplante Stunden, Anzeigenamen | keinen Status |
| Moodle | Abgabestatus und Bewertung je Aufgabe, Klasse aus den Kurs-Tabs | keine Planung |

Aufgabennamen in Moodle tragen zwar Stundenangaben, aber uneinheitlich
(`8h`, `2 Std`, `20 Min`) und teils mehrfach identisch. Auch die
Pflicht-Kennzeichnung ist dort unzuverlässig. Beides kommt deshalb aus
`plan.json`, referenziert über `cmid`.

## Schienen

Der Unterricht findet in Blockwochen statt, deren Anzahl und Termine sich je
Schiene unterscheiden. Die Schiene ergibt sich aus der Klasse:

| Klasse | Schiene |
|---|---|
| IFA12A, IFA12C | Schiene 1 |
| IFA12B, IFA12D | Schiene 3 |

Die Klasse wird aus den Tabs des Hauptkurses gelesen (`a.nav-link[title]`).
Schlägt das fehl, wählt die lernende Person die Schiene selbst; die Wahl gilt
für die Sitzung.

Das ist keine Kosmetik: Am selben Tag kann Schiene 1 in Blockwoche 2 stehen
und Schiene 3 bereits in Blockwoche 3 — bei gleichem Stand ergibt sich damit
ein anderes Soll und ein anderes Delta.

## Rechnung

```
Soll(w)  = Σ Stunden Blockwoche 1..w / Σ Stunden der Schiene
Ist      = Σ geplante Stunden abgegebener Pflichtaufgaben / Σ Stunden gesamt
Delta    = (Ist − Soll) × Σ Stunden gesamt        → in Stunden
Qualität = Ø Bewertung, ungewichtet über bewertete Abgaben
```

Das Soll bezieht sich auf den Kalender der eigenen Schiene, das Ist auf die
Pflichtaufgaben. Zwischen zwei Blöcken bleibt das Soll konstant — es steigt
nur, wenn eine Blockwoche beginnt.

Bezugsgröße des Ist ist immer das gesamte Schuljahr einschließlich noch
gesperrter Abschnitte. Dadurch bleibt der Nenner beim Freischalten konstant —
es kommt kein Nenner hinzu, es wandern nur Aufgaben von „nicht begonnen" nach
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
Stunden. Das gilt für Aufgaben wie für Blockwochen — eine verkürzte
Blockwoche bekommt entsprechend weniger Stunden als eine volle.

Das Feld `lektion` übernimmt die Angabe aus Moodle in der dortigen
Schreibweise `Abschnitt- Lerneinheit`. Das Dashboard teilt sie beim Laden
auf und zeigt beides in einer eigenen Spalte:

| `lektion` | Abschnitt | Lerneinheit |
|---|---|---|
| `Übersicht- Kursübersicht` | Übersicht | Kursübersicht |
| `OOP- Sprint 1 Klassen & Objekte` | OOP | Sprint 1 Klassen & Objekte |
| `OOP- Sprint 4 SOLID - Refactoring` | OOP | Sprint 4 SOLID - Refactoring |

Getrennt wird am ersten Bindestrich, dem ein Leerzeichen folgt. Dadurch
bleiben `HTML/CSS` als Abschnitt und Bindestriche innerhalb der Lerneinheit
erhalten. Ohne erkennbare Trennung gilt alles als Lerneinheit — der
Abschnitt bleibt leer, statt geraten zu werden.

Neue Schienen und Klassen werden unter `schienen` und `klassenZuSchiene`
ergänzt. Verweist eine Klasse auf eine nicht definierte Schiene, meldet die
Validierung das beim Laden.

Der gesperrte Kurs wird mit `"gesperrt": true` geführt. Seine Aufgaben werden
vollständig gepflegt, obwohl der Kurs noch nicht erreichbar ist — diese
Stunden stehen von Tag eins im Nenner. Ein Statusabruf findet für ihn nicht
statt.

Wie ein Kurs im Dashboard heißt, bestimmt `titel` — unabhängig davon, wie er
in Moodle benannt ist. Die `id` daneben ist nur ein interner Schlüssel und
taucht nirgends in der Anzeige auf.

## Betrieb

Die Dateien liegen als Aktivität „Datei" im Hauptkurs, `index.html` als
Hauptdatei. Weil die Seite damit unter `lernplattform.bycs.de` läuft, kann
sie die Kursübersichten in der Sitzung der angemeldeten Person lesen.

Pro Unterkurs werden zwei Seiten abgerufen — je eine für Aufgaben und Tests.
Es gibt kein Caching über die Sitzung hinaus; der Zustand lebt nur im
Speicher der Seite.

## Notenschlüssel

Neben jedem Prozentwert steht die zugehörige Note. Der Schlüssel liegt in
`plan.json` unter `notenschluessel`:

```json
{ "note": 2, "name": "gut", "abProzent": 80, "farbe": "#28a745" }
```

Es gilt die erste Stufe, deren Schwelle erreicht ist. Die unterste Stufe muss
`"abProzent": 0` haben, sonst blieben niedrige Werte ohne Note — das meldet
die Validierung beim Laden. Fehlt der Schlüssel ganz, zeigt das Dashboard nur
Prozentwerte und rechnet unverändert weiter.

Die Note richtet sich nach dem **angezeigten**, also gerundeten Prozentwert.
Sonst stünde bei 65,71 % die Anzeige „66 %" neben einer Note 4, obwohl der
Schlüssel ab 66 die Note 3 vorsieht.

## Probelauf

Das Dashboard hängt am Datum: Soll steigt nur, wenn eine Blockwoche beginnt.
Um das zu prüfen, ohne die Systemuhr zu stellen oder auf den nächsten Block
zu warten, hängt man `?test` an die Adresse. Es erscheint eine auffällige
Leiste mit Datum, Schiene und Datenquelle.

| Parameter | Wirkung |
|---|---|
| `?test` | schaltet den Probelauf ein |
| `&datum=2026-12-09` | rechnet mit diesem Stichtag |
| `&schiene=Schiene3` | erzwingt eine Schiene statt der Klassenerkennung |
| `&daten=haelfte` | Beispieldaten statt echter Moodle-Abrufe |

Für `daten` gibt es `leer`, `haelfte`, `voll` und `gemischt`. Die Muster
erzeugen Moodle-Rohwerte, die durch die echten Regeln aus `status.js`
laufen — geprüft wird also die tatsächliche Logik, nicht eine Attrappe.
Ohne `daten` werden echte Abrufe versucht; außerhalb der Lernplattform
scheitern die an der Same-Origin-Policy.

Lokal starten:

```bash
python -m http.server 8731
# dann http://localhost:8731/?test&daten=gemischt öffnen
```

Ohne `?test` ist der Probelauf vollständig aus: keine Leiste, keine
Beispieldaten, kein verändertes Verhalten.

Nützliche Stichtage:

| Datum | Schiene 1 | Schiene 3 |
|---|---|---|
| 2026-09-01 | vor Beginn | vor Beginn |
| 2026-09-16 | vor Beginn | Block 1 läuft |
| 2026-12-09 | Block 5 läuft | nach Block 5 |
| 2027-04-14 | Block 9 läuft | nach Block 9 |

## Kurse

| Kurs | ID | Stand |
|---|---|---|
| 1. Halbjahr | 2491549 | offen |
| 2. Halbjahr | 2491870 | gesperrt |
