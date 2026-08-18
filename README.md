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
js/schiene.js   Klassenerkennung über die Kursgruppen und Schienenwahl
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
| Moodle | Abgabestatus und Bewertung je Aufgabe, Kursgruppen und damit die Klasse | keine Planung |

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

Die Klasse wird in dieser Reihenfolge ermittelt:

1. **Kursprofil** — die eigenen Gruppen auf `/user/view.php?course=<id>`.
2. **Auswahl** durch die lernende Person; die Wahl gilt für die Sitzung.

Moodle führt die Gruppen im Profil als Beschreibungsliste:

```html
<dl><dt>Gruppe</dt><dd>
  <a href="…&group=573229">K - IFA12A (6072)</a>, <a href="…">Testgruppe</a>
</dd></dl>
```

Gesucht wird gezielt in diesem `<dd>`, gefunden über das `<dt>` daneben —
Moodle schreibt je nach Anzahl und Sprache „Gruppe", „Gruppen" oder „Groups".
Der Abschnitt nennt genau die eigenen Gruppen, während anderswo auf der Seite
fremde Klassennamen stehen können. Fehlt er, dient die ganze Seite als
Rückfall.

Der Gruppenname ist nicht die Klasse: Gesucht wird der bekannte Klassenname
**innerhalb** des Gruppennamens, also `IFA12A` in `K - IFA12A (6072)`.
Wortgrenzen verhindern dabei, dass `IFA12A` in `IFA12AB` anschlägt. Gruppen
ohne Klassenbezug wie `Testgruppe` werden schlicht nicht erkannt und stören
nicht.

Abgefragt wird der erste **nicht gesperrte** Kurs aus `plan.json` — ein
gesperrter liefert eine Fehlerseite statt eines Profils.

Sind mehrere Klassen hinterlegt, die auf **dieselbe** Schiene zeigen, wird
diese übernommen. Zeigen sie auf **verschiedene** Schienen — oder wird keine
Klasse gefunden —, erscheint die Auswahl: Bei Mehrdeutigkeit zu raten hieße,
mit der falschen Blockwoche zu rechnen.

> **Warum nicht der ByCS-Selbstservice?** Dort steht die verbindlichere
> Zuordnung, doch `selfservice.bycs.de` sendet keinen
> `Access-Control-Allow-Origin`-Header. Der Browser verwirft die Antwort
> ungelesen, bevor sie ausgewertet werden kann — von
> `lernplattform.bycs.de` aus ist die Seite nicht abrufbar. Moodle ist
> dagegen dieselbe Herkunft wie das Dashboard.
>
> Welche Moodle-Seiten die Gruppe nennen, prüft `suche-gruppe.js` in der
> Browserkonsole. `/user/index.php` und `/group/index.php` sind für Lernende
> gesperrt (HTTP 404), das Kursprofil nicht.

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
| Keine Abgabe | `-` | Nicht begonnen | nein |
| Entwurf (nicht abgegeben) | `-` | Entwurf | nein |
| Zur Bewertung abgegeben | `-` | Abgegeben | ja |
| beliebig | Wert | Bewertet | ja |

**Eine Bewertung schlägt den Abgabestatus.** Lehrkräfte bewerten auch ohne
digitale Abgabe — nach einem Gespräch oder für etwas auf Papier. In Moodle
steht dann „Keine Abgabe" neben einer echten Note. Diese Bewertung zählt und
wird angezeigt.
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

## Skalenbewertungen

Manche Aufgaben werden nicht in Prozent bewertet, sondern über eine
Moodle-Skala. Der Rohwert ist dann eine Stufennummer:

```html
<td data-mdl-overview-value="2.00000">** Verbesserungsbedarf</td>
```
Ohne Umrechnung erschiene Stufe 2 von 4 als „2 %" und damit als Note 6. Die
Skala wird deshalb in `plan.json` hinterlegt und der Aufgabe zugewiesen:

```json
"skalen": {
  "sterne4": {
    "stufen": [
      { "wert": 1, "name": "Nicht akzeptabel",    "prozent": 25 },
      { "wert": 2, "name": "Verbesserungsbedarf", "prozent": 50 },
      { "wert": 3, "name": "Gut",                 "prozent": 75 },
      { "wert": 4, "name": "Exzellent",           "prozent": 100 }
    ]
  }
}
```

```json
{ "cmid": "94824799", "skala": "sterne4", ... }
```
`wert` ist die Stufennummer aus Moodle, `prozent` der Wert, über den Note und
Qualität berechnet werden. In der Tabelle steht die Stufenbezeichnung; der
Prozentwert erscheint im Mouseover.
Aufgaben ohne `skala` werden weiterhin als Prozentwert gelesen. Verweist eine
Aufgabe auf eine nicht definierte Skala, meldet die Validierung das beim Laden.

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
