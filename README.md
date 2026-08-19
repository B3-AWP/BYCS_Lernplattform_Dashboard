# Dein Lernfortschritt

Dashboard für Lernende auf der BYCS-Lernplattform. Es zeigt den eigenen Stand
im laufenden Halbjahr: geplante Stunden gegen verstrichene Schulwochen,
ausgewiesen als Rückstand oder Vorsprung in Stunden.

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
js/bilanz.js    Soll, Ist, Delta, Bewertungsschnitt
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
> `/user/index.php` und `/group/index.php` sind für Lernende gesperrt
> (HTTP 404), das Kursprofil nicht.

Das ist keine Kosmetik: Am selben Tag kann Schiene 1 in Blockwoche 2 stehen
und Schiene 3 bereits in Blockwoche 3 — bei gleichem Stand ergibt sich damit
ein anderes Soll und ein anderes Delta.

## Rechnung

```
Soll(w)  = Σ Stunden Blockwoche 1..w / Σ Stunden im Zeitraum
Ist      = Σ geplante Stunden abgegebener Pflichtaufgaben / Σ Stunden gesamt
Delta    = (Ist − Soll) × Σ Stunden gesamt        → in Stunden
Ø Note   = Ø Bewertung, ungewichtet über bewertete Abgaben
```

Das Soll bezieht sich auf den Kalender der eigenen Schiene, das Ist auf die
Pflichtaufgaben. Zwischen zwei Blöcken bleibt das Soll konstant — es steigt
nur, wenn eine Blockwoche beginnt.

**Bezugsgröße ist der angezeigte Zeitraum.** Wird nur das 1. Halbjahr gezeigt,
zählen dessen Pflichtaufgaben im Nenner, und das Soll speist sich nur aus den
Blockwochen, die in dieses Halbjahr fallen — sonst erreichte der Soll-Balken
nie 100 %, obwohl alles Sichtbare geschafft ist. Innerhalb eines Zeitraums
bleibt der Nenner konstant, auch für noch gesperrte Abschnitte: Es wandern nur
Aufgaben von „nicht begonnen" nach „abgegeben".

Der Fortschritt ist mit geplanter, nicht mit tatsächlich aufgewendeter Zeit
gewichtet. Das benennt das Dashboard einmal offen. Der Bewertungsschnitt
fließt nicht in den Fortschritt ein.

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

## Halbjahre

Standardmäßig zeigt das Dashboard nur das laufende Halbjahr. Gesteuert wird
das je Kurs über `anzeigen` in `plan.json`:

```json
{ "id": "halbjahr-2", "gesperrt": true, "anzeigen": false, "freischaltung": "2027-01-11" }
```

Ein Kurs mit `"anzeigen": false` verschwindet vollständig — keine Kachel, kein
Tabellenabschnitt — und seine Stunden zählen weder im Nenner noch im Soll.
Fehlt das Feld, gilt der Kurs als sichtbar.

`gesperrt` und `anzeigen` beantworten verschiedene Fragen und sind deshalb
getrennt:

| | `gesperrt: true` | `anzeigen: false` |
|---|---|---|
| Kachel und Tabellenabschnitt | sichtbar, blass, mit Sperrhinweis | nicht vorhanden |
| Statusabruf aus Moodle | nein | nein |
| zählt im Nenner | ja | nein |
| Blockwochen im Soll | ja | nein |

`gesperrt` folgt dem Moodle-Zustand („gibt es dazu schon Daten?"), `anzeigen`
ist eine redaktionelle Entscheidung („soll das jemand sehen?"). Dadurch lässt
sich ein Halbjahr als Ausblick zeigen, bevor Moodle es freigibt:
`"gesperrt": true, "anzeigen": true`.

Zum Umschalten am Stichtag genügt `"anzeigen": true` — Code muss dafür nicht
angefasst werden. Im Probelauf geht es auch ohne Dateiänderung, siehe
[Probelauf](#probelauf).

## Aufgabentabelle

Die Pflichtaufgaben stehen nach Kurs getrennt, jeder Abschnitt mit einer
Zwischenzeile aus Kursname, Umfang und — falls zutreffend — dem Sperrhinweis:

```
1. Halbjahr            14 Aufgaben · 58,5 h
2. Halbjahr   [Noch nicht freigeschaltet — ab 11. Januar 2027]   12 Aufgaben · 35,3 h
```

Die blasse Darstellung allein würde offenlassen, ob nichts abgegeben wurde
oder nichts abgegeben werden **konnte**. Der Hinweis benennt den Unterschied;
die Zwischenzeile bleibt dabei voll lesbar, weil sie die Begründung trägt.

Sortiert wird innerhalb eines Kurses, nicht über alle hinweg — ein gesperrtes
Halbjahr soll sich nicht zwischen die Aufgaben des laufenden mischen.

## Kacheln

Je Halbjahr steht eine Kachel mit vier Kennzahlen:

| Kennzahl | Bedeutung |
|---|---|
| Unterricht | Unterrichtsstunden des Halbjahrs, aus den Blockwochen der Schiene |
| Aufwand | für die Pflichtaufgaben veranschlagte Zeit |
| abgegeben | davon bereits abgegeben |
| erledigt | Anzahl abgegebener von allen Pflichtaufgaben |

„Unterricht" und „Aufwand" sind verschiedene Größen: Die Differenz ist die
Zeit, die im Unterricht für Erklärungen, Übungen und Nachfragen bleibt.
Die Unterrichtsstunden werden aus den Blockwochen abgeleitet, aufgeteilt am
`freischaltung`-Datum des folgenden Kurses — Wochen davor gehören zum ersten
Halbjahr, Wochen ab dem Datum zum zweiten. Ohne Freischaltdatum ist die
Zuordnung nicht eindeutig; dann entfällt die Kennzahl, statt eine erfundene
Zahl zu zeigen.

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
vollständig gepflegt, obwohl der Kurs noch nicht erreichbar ist. Ein
Statusabruf findet für ihn nicht statt. Ob er überhaupt erscheint, entscheidet
`anzeigen` — siehe [Halbjahre](#halbjahre).

Das Datum unter `freischaltung` erscheint in der Aufgabentabelle und teilt
zugleich die Unterrichtsstunden auf die Halbjahre auf. Fehlt es, steht in der
Tabelle nur, dass der Kurs noch gesperrt ist, und die Kennzahl „Unterricht"
entfällt.

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
{ "note": 2, "name": "gut", "abProzent": 81, "farbe": "#28a745" }
```

Es gilt die erste Stufe, deren Schwelle erreicht ist. Die unterste Stufe muss
`"abProzent": 0` haben, sonst blieben niedrige Werte ohne Note — das meldet
die Validierung beim Laden. Fehlt der Schlüssel ganz, zeigt das Dashboard nur
Prozentwerte und rechnet unverändert weiter.
Die Note richtet sich nach dem **angezeigten**, also gerundeten Prozentwert.
Sonst stünde bei 66,71 % die Anzeige „67 %" neben einer Note 4, obwohl der
Schlüssel ab 67 die Note 3 vorsieht.

Der vollständige Schlüssel steht in der Erklärung zum Bewertungsschnitt — mit
der Spanne je Note (`81–91 %`), nicht nur der unteren Schwelle. Die Obergrenze
ergibt sich aus der nächsthöheren Stufe.

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
    "titel": "Bewertungsskala",
    "stufen": [
      { "wert": 1, "name": "Nicht akzeptabel",    "prozent": 20 },
      { "wert": 2, "name": "Verbesserungsbedarf", "prozent": 75 },
      { "wert": 3, "name": "Solide Umsetzung",    "prozent": 90 },
      { "wert": 4, "name": "Exzellent",           "prozent": 100 }
    ]
  }
}
```

```json
{ "cmid": "94824799", "skala": "sterne4", ... }
```

`wert` ist die Stufennummer aus Moodle, `prozent` der Wert, über den Note und
Bewertungsschnitt berechnet werden. Die Prozentwerte müssen nicht gleichmäßig
verteilt sein — sie bilden ab, was eine Stufe wirklich wert ist. In der Tabelle steht die Stufenbezeichnung; der
Prozentwert erscheint im Mouseover.
Aufgaben ohne `skala` werden weiterhin als Prozentwert gelesen. Verweist eine
Aufgabe auf eine nicht definierte Skala, meldet die Validierung das beim Laden.

## Probelauf

Das Dashboard hängt am Datum: Soll steigt nur, wenn eine Blockwoche beginnt.
Um das zu prüfen, ohne die Systemuhr zu stellen oder auf den nächsten Block
zu warten, hängt man `?test` an die Adresse. Es erscheint eine auffällige
Leiste mit Datum, Schiene, Datenquelle und Kursauswahl.

| Parameter | Wirkung |
|---|---|
| `?test` | schaltet den Probelauf ein |
| `&datum=2026-12-09` | rechnet mit diesem Stichtag |
| `&schiene=Schiene3` | erzwingt eine Schiene statt der Klassenerkennung |
| `&daten=haelfte` | Beispieldaten statt echter Moodle-Abrufe |
| `&kurse=alle` | zeigt auch Kurse mit `"anzeigen": false` |

Mit `kurse=alle` lässt sich der Stand nach der Freischaltung des nächsten
Halbjahrs ansehen, ohne `plan.json` zu ändern. Nenner und Blockwochen beziehen
sich dann wieder auf das ganze Schuljahr.

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
| 2026-12-20 | 1. Halbjahr abgeschlossen | 1. Halbjahr abgeschlossen |
| 2027-04-14 | Block 9 läuft | nach Block 9 |

Ist die letzte Blockwoche des angezeigten Zeitraums vorbei, steht in der
Kopfzeile „1. Halbjahr abgeschlossen" statt einer Wochennummer — sonst
sähe der stehende Zähler bei vollem Soll-Balken nach einem Fehler aus.

## Kurse

| Kurs | ID | `gesperrt` | `anzeigen` |
|---|---|---|---|
| 1. Halbjahr | 2491549 | `false` | `true` |
| 2. Halbjahr | 2491870 | `true` | `false` |
