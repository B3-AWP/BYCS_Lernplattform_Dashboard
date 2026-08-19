// ============================================================
// view.js — Darstellung
//
// Rendert Kopfzeile, Kurskacheln und Aufgabenliste aus dem
// berechneten Modell. Kein Fetch, keine Rechnung.
// ============================================================

import { ZUSTAND, ZUSTAND_TEXT, ZUSTAND_HINWEIS } from './status.js';
import { formatStunden, formatProzent, ermittleNote } from './bilanz.js';

const BASIS = 'https://lernplattform.bycs.de';

// Fortlaufende Nummer für die Verknüpfung von Hilfeknopf und
// Erklärungstext über aria-describedby.
let hilfeZaehler = 0;

// Ein Klick irgendwo sonst schließt offene Erklärungen wieder.
document.addEventListener('click', ereignis => {
    document.querySelectorAll('.hilfe-offen').forEach(offen => {
        if (offen.contains(ereignis.target)) return;
        offen.classList.remove('hilfe-offen');
        offen.querySelector('.hilfe-zeichen')?.setAttribute('aria-expanded', 'false');
    });
});

/**
 * Rendert das gesamte Dashboard.
 *
 * @param {HTMLElement} wurzel - Zielelement
 * @param {Object} bilanz - Ergebnis aus berechneBilanz
 */
export function zeichne(wurzel, bilanz) {
    wurzel.replaceChildren(
        kopfzeile(bilanz),
        kursKacheln(bilanz.kurse),
        aufgabenListe(bilanz.kurse, bilanz.notenschluessel)
    );
}

/**
 * Zeichnet die Testleiste über dem Dashboard.
 *
 * Sie erscheint nur im Testmodus und ist bewusst auffällig, damit
 * niemand einen Probelauf für den echten Stand hält.
 *
 * @param {HTMLElement} ziel - Element für die Leiste
 * @param {Object} einstellungen - { datum, schiene, daten, schienen }
 * @param {Object} rueckrufe - { beiAenderung, beiVerlassen }
 */
export function zeichneTestleiste(ziel, einstellungen, rueckrufe) {
    const leiste = el('div', 'testleiste');

    leiste.append(el('span', 'testleiste-marke', 'Probelauf'));

    // Datum
    const datumFeld = document.createElement('input');
    datumFeld.type = 'date';
    datumFeld.className = 'testfeld';
    datumFeld.value = alsIsoDatum(einstellungen.datum);
    datumFeld.setAttribute('aria-label', 'Fiktives Datum');
    datumFeld.addEventListener('change', () => {
        rueckrufe.beiAenderung('datum', datumFeld.value);
    });
    leiste.append(feldGruppe('Datum', datumFeld));

    // Schiene
    const schienenFeld = document.createElement('select');
    schienenFeld.className = 'testfeld';
    schienenFeld.setAttribute('aria-label', 'Schiene');
    Object.values(einstellungen.schienen).forEach(schiene => {
        const option = document.createElement('option');
        option.value = schiene.name;
        option.textContent = schiene.titel;
        option.selected = schiene.name === einstellungen.schiene;
        schienenFeld.append(option);
    });
    schienenFeld.addEventListener('change', () => {
        rueckrufe.beiAenderung('schiene', schienenFeld.value);
    });
    leiste.append(feldGruppe('Schiene', schienenFeld));

    // Beispieldaten
    const datenFeld = document.createElement('select');
    datenFeld.className = 'testfeld';
    datenFeld.setAttribute('aria-label', 'Datenquelle');
    [
        ['', 'Echte Daten'],
        ['leer', 'Nichts begonnen'],
        ['haelfte', 'Halb geschafft'],
        ['voll', 'Alles abgegeben'],
        ['gemischt', 'Alle Zustände']
    ].forEach(([wert, text]) => {
        const option = document.createElement('option');
        option.value = wert;
        option.textContent = text;
        option.selected = wert === (einstellungen.daten ?? '');
        datenFeld.append(option);
    });
    datenFeld.addEventListener('change', () => {
        rueckrufe.beiAenderung('daten', datenFeld.value);
    });
    leiste.append(feldGruppe('Daten', datenFeld));

    const beenden = document.createElement('button');
    beenden.type = 'button';
    beenden.className = 'testbeenden';
    beenden.textContent = 'Beenden';
    beenden.addEventListener('click', rueckrufe.beiVerlassen);
    leiste.append(beenden);

    ziel.replaceChildren(leiste);
}

function feldGruppe(beschriftung, feld) {
    const gruppe = el('label', 'testgruppe');
    gruppe.append(el('span', 'testgruppe-name', beschriftung), feld);
    return gruppe;
}

function alsIsoDatum(datum) {
    const jahr = datum.getFullYear();
    const monat = String(datum.getMonth() + 1).padStart(2, '0');
    const tag = String(datum.getDate()).padStart(2, '0');
    return `${jahr}-${monat}-${tag}`;
}

/**
 * Fragt die Schiene ab, wenn sie sich nicht aus der Klasse ergibt.
 *
 * @param {HTMLElement} wurzel - Zielelement
 * @param {Object} schienen - Schienen aus dem Plan
 * @param {(schiene: string) => void} beiAuswahl
 */
export function zeigeSchienenAuswahl(wurzel, schienen, beiAuswahl) {
    const block = el('section', 'auswahl');

    block.append(
        el('h2', 'auswahl-titel', 'Welche Schiene besuchst du?'),
        el('p', 'auswahl-text',
            'Deine Klasse konnte nicht automatisch erkannt werden. Die Schiene ' +
            'bestimmt, welche Blockwochen für deinen Zeitplan gelten.'
        )
    );

    const knoepfe = el('div', 'auswahl-knoepfe');

    Object.values(schienen).forEach(schiene => {
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = 'knopf knopf-auswahl';
        knopf.addEventListener('click', () => beiAuswahl(schiene.name));

        knopf.append(
            el('span', 'auswahl-name', schiene.titel),
            el('span', 'auswahl-wochen',
                `${schiene.wochenGesamt} Blockwochen · ab ${formatDatum(schiene.schulwochen[0]?.start)}`)
        );

        knoepfe.append(knopf);
    });

    block.append(knoepfe);
    wurzel.replaceChildren(block);
}

// ------------------------------------------------------------
// Kopfzeile — Soll/Ist-Vergleich und Delta in Stunden
// ------------------------------------------------------------

function kopfzeile(bilanz) {
    const abschnitt = el('section', 'bilanz');
    const vorsprung = bilanz.deltaStunden >= 0;
    const betrag = Math.abs(bilanz.deltaStunden);

    // Balken auf gemeinsamer Skala: der größere Wert bestimmt die Breite.
    const skala = Math.max(bilanz.soll, bilanz.ist, 0.01);

    abschnitt.append(
        el('p', 'bilanz-woche', wochenText(bilanz)),

        el('p', `delta ${vorsprung ? 'delta-vor' : 'delta-zurueck'}`, deltaText(bilanz)),

        balken(
            'Bis jetzt vorgesehen', bilanz.soll, bilanz.stundenSoll,
            bilanz.stundenGesamt, skala, 'soll',
            'So viele Unterrichtsstunden sind in deiner Schiene bisher vergangen — ' +
            'gemessen an den Blockwochen im Schuljahr. Dieser Wert steigt nur, ' +
            'wenn eine neue Blockwoche beginnt, und sagt nichts darüber aus, ' +
            'was du getan hast.'
        ),
        balken(
            'Von dir abgegeben', bilanz.ist, bilanz.stundenAbgegeben,
            bilanz.stundenGesamt, skala, 'ist',
            'So viele Stunden entfallen auf Pflichtaufgaben, die du bereits ' +
            'abgegeben hast. Gezählt wird die für eine Aufgabe vorgesehene Zeit, ' +
            'nicht die, die du wirklich gebraucht hast. Ob eine Abgabe schon ' +
            'bewertet wurde, spielt keine Rolle.'
        ),

        el('p', 'hinweis',
            'Beide Balken messen dasselbe Schuljahr: oben, wie weit der Unterricht ' +
            'ist, unten, wie weit du bist. Der eine Wert ist kein Teil des anderen. ' +
            'Gezählt wird jeweils das ganze Schuljahr, auch Abschnitte, die noch ' +
            'gesperrt sind — dadurch springt die Anzeige nicht, sobald ein Abschnitt ' +
            'freigeschaltet wird.'
        ),

        qualitaetsKarte(bilanz.qualitaet, bilanz.notenschluessel)
    );

    return abschnitt;
}

/**
 * Fragezeichen mit Erklärung bei Mouseover und Tastaturfokus.
 *
 * Als <button> statt <span>, damit die Erklärung auch ohne Maus
 * erreichbar ist. Kein title: der würde als zweiter, konkurrierender
 * Tooltip über dem eigenen Kasten liegen und den Text zusätzlich ein
 * weiteres Mal in den Accessibility-Tree bringen.
 *
 * Der Text hängt über aria-describedby am Knopf — als Beschreibung,
 * nicht als Name. So heißt der Knopf schlicht "Erklärung" und der
 * Absatz wird genau einmal vorgelesen.
 *
 * @param {string} text - die Erklärung
 * @param {string} thema - worauf sich die Erklärung bezieht
 * @returns {HTMLElement}
 */
function hilfe(text, thema) {
    const behaelter = el('span', 'hilfe');
    const kennung = `hilfe-${++hilfeZaehler}`;

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'hilfe-zeichen';
    knopf.textContent = '?';
    knopf.setAttribute('aria-label', thema ? `Erklärung: ${thema}` : 'Erklärung');
    knopf.setAttribute('aria-describedby', kennung);
    knopf.setAttribute('aria-expanded', 'false');

    const erklaerung = el('span', 'hilfe-text', text);
    erklaerung.id = kennung;

    // Klick hält die Erklärung offen — für alle, die zum Lesen nicht
    // auf dem Knopf stehen bleiben können oder wollen.
    knopf.addEventListener('click', () => {
        const offen = behaelter.classList.toggle('hilfe-offen');
        knopf.setAttribute('aria-expanded', String(offen));
    });

    // Esc schließt, solange der Fokus im Bereich liegt (WCAG 1.4.13).
    behaelter.addEventListener('keydown', ereignis => {
        if (ereignis.key !== 'Escape') return;
        if (!behaelter.classList.contains('hilfe-offen')) return;
        behaelter.classList.remove('hilfe-offen');
        knopf.setAttribute('aria-expanded', 'false');
        knopf.focus();
        ereignis.stopPropagation();
    });

    behaelter.append(knopf, erklaerung);
    return behaelter;
}

/**
 * Die große Zahl über den Balken.
 *
 * Vor Beginn der ersten Blockwoche ist das Soll null, also ist jede
 * Abgabe rechnerisch "Vorsprung" — ein Vergleich mit nichts. Dann
 * wird nur benannt, was schon geschafft ist.
 */
function deltaText(bilanz) {
    const betrag = Math.abs(bilanz.deltaStunden);

    if (bilanz.woche === 0) {
        return betrag < 0.05
            ? 'Noch nichts abgegeben'
            : `${formatStunden(bilanz.stundenAbgegeben)} Stunden schon geschafft`;
    }

    if (betrag < 0.05) return 'Genau im Plan';

    return `${formatStunden(betrag)} Stunden `
        + (bilanz.deltaStunden >= 0 ? 'Vorsprung' : 'Rückstand');
}

/**
 * Beschreibt den Stand im Schuljahr.
 *
 * Zwischen zwei Blöcken steht die Wochennummer still — das wird
 * benannt, damit ein gleichbleibendes Soll nicht als Fehler wirkt.
 */
function wochenText(bilanz) {
    if (bilanz.woche === 0) {
        return `${bilanz.schienenTitel} · Der Unterricht hat noch nicht begonnen`;
    }

    const stand = `Blockwoche ${bilanz.woche} von ${bilanz.wochenGesamt}`;

    return bilanz.imBlock
        ? `${bilanz.schienenTitel} · ${stand} läuft`
        : `${bilanz.schienenTitel} · nach ${stand}`;
}

function balken(beschriftung, anteil, stunden, gesamt, skala, art, erklaerung) {
    const zeile = el('div', 'balken-zeile');

    const name = el('span', 'balken-name');
    name.append(document.createTextNode(beschriftung));
    if (erklaerung) name.append(hilfe(erklaerung, beschriftung));

    const kopf = el('div', 'balken-kopf');
    kopf.append(
        name,
        el('span', 'balken-wert',
            `${formatStunden(stunden)} h · ${formatProzent(anteil)}`)
    );

    // Die Breite folgt der gemeinsamen Skala beider Balken, der
    // angesagte Wert dem angezeigten Prozentsatz — sonst meldete der
    // Screenreader "100 %", wo "11 %" steht.
    const spur = fortschrittsSpur(
        anteil / skala,
        art,
        beschriftung,
        `${formatStunden(stunden)} von ${formatStunden(gesamt)} Stunden`,
        anteil
    );

    zeile.append(kopf, spur);
    return zeile;
}

/**
 * Ein Fortschrittsbalken mit Semantik.
 *
 * Ohne role/aria-value* ist der Balken für Screenreader ein leeres
 * div — die Information steckt allein in der CSS-Breite. Bei den
 * Kacheln gibt es daneben keinen Zahlenwert, dort wäre sie sonst
 * ganz verloren.
 *
 * @param {number} anteil - 0..1, bestimmt die gezeichnete Breite
 * @param {string} art - 'soll' oder 'ist'
 * @param {string} name - Beschriftung für die Ansage
 * @param {string} [text] - Klartext statt der reinen Prozentzahl
 * @param {number} [wertAnteil] - 0..1 für die Ansage, falls er von
 *        der gezeichneten Breite abweicht
 */
function fortschrittsSpur(anteil, art, name, text, wertAnteil = anteil) {
    const spur = el('div', 'balken-spur');
    const breite = Math.min(100, Math.max(0, Math.round(anteil * 100)));
    const prozent = Math.min(100, Math.max(0, Math.round(wertAnteil * 100)));

    spur.setAttribute('role', 'progressbar');
    spur.setAttribute('aria-valuenow', String(prozent));
    spur.setAttribute('aria-valuemin', '0');
    spur.setAttribute('aria-valuemax', '100');
    spur.setAttribute('aria-label', name);
    if (text) spur.setAttribute('aria-valuetext', text);

    const fuellung = el('div', `balken-fuellung balken-${art}`);
    fuellung.style.width = `${breite}%`;
    spur.append(fuellung);

    return spur;
}

function qualitaetsKarte({ durchschnitt, anzahl }, notenschluessel) {
    const karte = el('div', 'qualitaet');

    const name = el('span', 'qualitaet-name');
    name.append(document.createTextNode('Bewertungsschnitt'));
    name.append(hilfe(
        'Der Durchschnitt aller Bewertungen, die du bisher bekommen hast. ' +
        'Jede bewertete Aufgabe zählt gleich viel, unabhängig von ihrem Umfang. ' +
        'Dieser Wert ist vom Fortschritt getrennt: Eine gute Bewertung bringt ' +
        'dich zeitlich nicht weiter, und eine schlechte wirft dich nicht zurück.',
        'Bewertungsschnitt'
    ));

    const wert = el('span', 'qualitaet-wert');
    if (durchschnitt === null) {
        wert.textContent = '–';
    } else {
        wert.append(document.createTextNode(formatBewertung(durchschnitt)));
        const stufe = ermittleNote(notenschluessel, durchschnitt);
        if (stufe) {
            const marke = el('span', 'note note-gross', String(stufe.note));
            if (stufe.farbe) {
                marke.style.color = stufe.farbe;
                marke.style.borderColor = stufe.farbe;
            }
            marke.title = `Note ${stufe.note} — ${stufe.name}`;
            wert.append(marke);
        }
    }

    karte.append(
        name,
        wert,
        el('span', 'qualitaet-fuss',
            anzahl === 0
                ? 'noch keine Bewertung'
                : `Durchschnitt über ${anzahl} ${anzahl === 1 ? 'Bewertung' : 'Bewertungen'} · zählt nicht zum Fortschritt`
        )
    );

    return karte;
}

// ------------------------------------------------------------
// Kurskacheln
// ------------------------------------------------------------

function kursKacheln(kurse) {
    const abschnitt = el('section', 'kacheln');
    kurse.forEach(kurs => abschnitt.append(kursKachel(kurs)));
    return abschnitt;
}

function kursKachel(kurs) {
    const karte = el('article', `kachel${kurs.gesperrt ? ' kachel-gesperrt' : ''}`);

    karte.append(el('h2', 'kachel-titel', kurs.titel));

    if (kurs.gesperrt) {
        karte.append(el('p', 'kachel-sperre',
            kurs.freischaltung
                ? `Freischaltung am ${formatDatum(kurs.freischaltung)}`
                : 'Noch nicht freigeschaltet'
        ));
    }

    const zahlen = el('div', 'kachel-zahlen');

    // Unterrichtsstunden zuerst: das ist die Zeit, die in diesem
    // Halbjahr überhaupt zur Verfügung steht. Ohne Freischaltdaten
    // ist sie nicht zu ermitteln — dann entfällt die Kennzahl.
    if (kurs.stundenUnterricht !== null) {
        zahlen.append(kennzahl(
            `${formatStunden(kurs.stundenUnterricht)} h`,
            'Unterricht',
            'So viele Unterrichtsstunden sind in diesem Halbjahr vorgesehen — '
            + 'die Summe der Blockwochen, die in den Zeitraum fallen. Ein Teil '
            + 'davon geht für Pflichtaufgaben drauf, der Rest bleibt für '
            + 'Erklärungen, Übungen und Nachfragen.'
        ));
    }

    zahlen.append(
        // "Pflichtaufgaben", nicht "geplant": in der Kopfzeile steht
        // "vorgesehen" für den Zeitverlauf. Dasselbe Wort für zwei
        // verschiedene Größen wäre die häufigste Verwechslung hier.
        kennzahl(
            `${formatStunden(kurs.stundenGeplant)} h`,
            'Pflichtaufgaben',
            'So viel Zeit ist für die Pflichtaufgaben dieses Halbjahrs '
            + 'veranschlagt. Nur diese Stunden zählen für deinen Fortschritt.'
        ),
        kennzahl(
            kurs.gesperrt ? '–' : `${formatStunden(kurs.stundenAbgegeben)} h`,
            'abgegeben'
        ),
        kennzahl(
            kurs.gesperrt ? '–' : `${kurs.aufgabenAbgegeben} / ${kurs.aufgabenGesamt}`,
            'Aufgaben'
        )
    );
    karte.append(zahlen);

    if (!kurs.gesperrt) {
        karte.append(fortschrittsSpur(
            kurs.anteil,
            'ist',
            `Abgegeben in ${kurs.titel}`,
            `${formatStunden(kurs.stundenAbgegeben)} von `
            + `${formatStunden(kurs.stundenGeplant)} Stunden abgegeben`
        ));
    }

    return karte;
}

function kennzahl(wert, beschriftung, erklaerung) {
    const block = el('div', 'kennzahl');

    const name = el('span', 'kennzahl-name');
    name.append(document.createTextNode(beschriftung));
    if (erklaerung) name.append(hilfe(erklaerung, beschriftung));

    block.append(el('span', 'kennzahl-wert', wert), name);
    return block;
}

// ------------------------------------------------------------
// Aufgabenliste
// ------------------------------------------------------------

// Sortierzustand der Tabelle. Er überlebt ein Neuzeichnen, damit
// eine gewählte Sortierung nach dem Aktualisieren erhalten bleibt.
let sortierung = { spalte: null, absteigend: false };

// Reihenfolge für die Sortierung nach Status: von "noch nichts
// getan" zu "fertig", damit Offenes oben steht.
const ZUSTAND_RANG = {
    [ZUSTAND.NICHT_BEGONNEN]: 0,
    [ZUSTAND.UNBEKANNT]: 1,
    [ZUSTAND.ENTWURF]: 2,
    [ZUSTAND.ABGEGEBEN]: 3,
    [ZUSTAND.BEWERTET]: 4
};

// Spalten der Aufgabentabelle. Auf Modulebene, weil auch die
// Sortieransage die Beschriftungen braucht.
const SPALTEN = [
    { schluessel: 'titel', text: 'Titel' },
    { schluessel: 'lektion', text: 'Lektion' },
    { schluessel: 'status', text: 'Status' },
    { schluessel: 'bewertung', text: 'Bewertung', rechts: true }
];

function aufgabenListe(kurse, notenschluessel) {
    const abschnitt = el('section', 'aufgaben');
    abschnitt.append(el('h2', 'abschnitt-titel', 'Pflichtaufgaben'));

    // Kurse ohne Aufgaben bekommen keinen Abschnitt in der Tabelle.
    const mitAufgaben = kurse.filter(kurs => kurs.aufgaben.length > 0);
    if (mitAufgaben.length === 0) return abschnitt;

    const behaelter = el('div', 'tabelle-rahmen');

    // Scrollbereich: die Tabelle ist breiter als ein Handydisplay.
    // Ohne tabindex ließe sie sich nur mit der Maus verschieben.
    behaelter.tabIndex = 0;
    behaelter.setAttribute('role', 'region');
    behaelter.setAttribute('aria-label', 'Pflichtaufgaben, seitlich scrollbar');

    // Ansage für Screenreader nach dem Sortieren. Der Bereich steht
    // außerhalb der Tabelle, damit ihn das Neuzeichnen nicht mitnimmt.
    const ansage = el('p', 'nur-vorlesen');
    ansage.setAttribute('role', 'status');
    ansage.setAttribute('aria-live', 'polite');

    // Nach einem Klick auf die Überschrift wird nur die Tabelle neu
    // gezeichnet — die Daten bleiben, nur die Reihenfolge ändert sich.
    // Der geklickte Knopf wird dabei ersetzt; ohne das Zurücksetzen
    // des Fokus landet er auf <body> und die Tastaturbedienung reißt ab.
    const zeichneTabelle = (fokusSpalte = null) => {
        behaelter.replaceChildren(
            aufgabenTabelle(mitAufgaben, zeichneTabelle, notenschluessel)
        );

        if (!fokusSpalte) return;

        behaelter
            .querySelector(`.sortknopf[data-spalte="${fokusSpalte}"]`)
            ?.focus();

        const spaltenName = SPALTEN.find(s => s.schluessel === fokusSpalte)?.text ?? '';
        ansage.textContent = `Nach ${spaltenName} `
            + (sortierung.absteigend ? 'absteigend' : 'aufsteigend') + ' sortiert';
    };
    zeichneTabelle();

    abschnitt.append(ansage, behaelter);
    return abschnitt;
}

/**
 * Baut die Aufgabentabelle. Der Rückruf zeichnet sie nach einem
 * Klick auf eine Spaltenüberschrift neu.
 *
 * Je Kurs ein eigener tbody mit vorangestellter Zwischenzeile.
 * Sortiert wird innerhalb eines Kurses, nicht über alle hinweg:
 * Ein noch gesperrtes Halbjahr soll sich nicht zwischen die
 * Aufgaben des laufenden mischen.
 */
function aufgabenTabelle(kurse, neuZeichnen, notenschluessel) {
    const tabelle = el('table', 'aufgaben-tabelle');

    const spalten = SPALTEN;

    const kopf = el('thead');
    const kopfzeile = el('tr');

    spalten.forEach(spalte => {
        const zelle = el('th', spalte.rechts ? 'rechts' : '');
        zelle.scope = 'col';

        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = 'sortknopf';
        knopf.dataset.spalte = spalte.schluessel;
        knopf.append(document.createTextNode(spalte.text));

        const aktiv = sortierung.spalte === spalte.schluessel;
        const pfeil = el('span', 'sortpfeil', aktiv ? (sortierung.absteigend ? '▾' : '▴') : '⇅');
        pfeil.setAttribute('aria-hidden', 'true');
        knopf.append(pfeil);

        if (aktiv) {
            zelle.setAttribute('aria-sort', sortierung.absteigend ? 'descending' : 'ascending');
        }

        // Der sichtbare Text steht vorn im Namen — sonst greift eine
        // Sprachsteuerung ("Klick Titel") ins Leere (WCAG 2.5.3).
        knopf.setAttribute(
            'aria-label',
            `${spalte.text} — sortieren${aktiv ? ', Richtung umkehren' : ''}`
        );

        knopf.addEventListener('click', () => {
            if (sortierung.spalte === spalte.schluessel) {
                sortierung.absteigend = !sortierung.absteigend;
            } else {
                sortierung = { spalte: spalte.schluessel, absteigend: false };
            }
            neuZeichnen(spalte.schluessel);
        });

        zelle.append(knopf);
        kopfzeile.append(zelle);
    });

    kopf.append(kopfzeile);
    tabelle.append(kopf);

    kurse.forEach(kurs => {
        const koerper = el('tbody', kurs.gesperrt ? 'gruppe-gesperrt' : '');
        koerper.append(kursZwischenzeile(kurs, spalten.length));
        sortiere(kurs.aufgaben).forEach(
            aufgabe => koerper.append(aufgabenZeile(aufgabe, notenschluessel))
        );
        tabelle.append(koerper);
    });

    return tabelle;
}

/**
 * Zwischenzeile, die einen Kursabschnitt der Tabelle einleitet.
 *
 * Bei gesperrten Kursen steht hier im Klartext, dass die Aufgaben
 * noch nicht freigeschaltet sind. Die blasse Darstellung allein
 * ließe offen, ob nichts abgegeben wurde oder nichts abgegeben
 * werden konnte — das ist ein Unterschied, den die Zeile benennt.
 */
function kursZwischenzeile(kurs, spaltenAnzahl) {
    const zeile = el('tr', 'kurs-zwischenzeile');
    const zelle = el('th', 'kurs-zwischenzelle');
    zelle.colSpan = spaltenAnzahl;
    zelle.scope = 'colgroup';

    zelle.append(el('span', 'kurs-name', kurs.titel));

    if (kurs.gesperrt) {
        zelle.append(el(
            'span',
            'kurs-sperre',
            kurs.freischaltung
                ? `Noch nicht freigeschaltet — ab ${formatDatum(kurs.freischaltung)}`
                : 'Noch nicht freigeschaltet'
        ));
    }

    zelle.append(el(
        'span',
        'kurs-umfang',
        `${kurs.aufgaben.length} ${kurs.aufgaben.length === 1 ? 'Aufgabe' : 'Aufgaben'}`
        + ` · ${formatStunden(kurs.stundenGeplant)} h`
    ));

    zeile.append(zelle);
    return zeile;
}

/**
 * Sortiert nach der gewählten Spalte.
 * Ohne Wahl bleibt die Reihenfolge aus der Planungsdatei.
 */
function sortiere(aufgaben) {
    if (!sortierung.spalte) return aufgaben;

    const richtung = sortierung.absteigend ? -1 : 1;

    return [...aufgaben].sort((a, b) => {
        let vergleich;

        switch (sortierung.spalte) {
            case 'lektion':
                // Erst nach Abschnitt, dann nach Lerneinheit — damit
                // zusammengehörige Lektionen beieinander bleiben.
                vergleich = (a.abschnitt ?? '').localeCompare(b.abschnitt ?? '', 'de')
                    || (a.lerneinheit ?? '').localeCompare(b.lerneinheit ?? '', 'de');
                break;
            case 'status':
                vergleich = ZUSTAND_RANG[a.zustand] - ZUSTAND_RANG[b.zustand];
                break;
            case 'bewertung':
                // Unbewertetes sammelt sich am Ende, unabhängig von
                // der Richtung — sonst verdrängt es die Werte.
                if (a.bewertung === null && b.bewertung === null) vergleich = 0;
                else if (a.bewertung === null) return 1;
                else if (b.bewertung === null) return -1;
                else vergleich = a.bewertung - b.bewertung;
                break;
            default:
                vergleich = a.titel.localeCompare(b.titel, 'de');
        }

        // Gleichstand nach Titel auflösen, damit die Reihenfolge stabil ist
        return vergleich !== 0 ? vergleich * richtung : a.titel.localeCompare(b.titel, 'de');
    });
}

function aufgabenZeile(aufgabe, notenschluessel) {
    const zeile = el('tr', aufgabe.kursGesperrt ? 'zeile-gesperrt' : '');

    // Titel als Link auf die Aufgabe in der Lernplattform
    const titelZelle = el('td', 'zelle-titel');
    const link = document.createElement('a');
    link.className = 'aufgaben-link';
    link.href = `${BASIS}/mod/${aufgabe.typ}/view.php?id=${aufgabe.cmid}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = aufgabe.titel;
    link.setAttribute(
        'aria-label',
        `${aufgabe.titel} — in der Lernplattform öffnen, neuer Tab`
    );
    titelZelle.append(link, el('span', 'aufgabe-stunden', `${formatStunden(aufgabe.stunden)} h`));

    // Abschnitt über der Lerneinheit — die Lerneinheit ist die
    // konkretere Angabe und bekommt deshalb das stärkere Gewicht.
    const lektionZelle = el('td', 'zelle-lektion');
    if (aufgabe.abschnitt) {
        lektionZelle.append(el('span', 'lektion-abschnitt', aufgabe.abschnitt));
    }
    if (aufgabe.lerneinheit) {
        lektionZelle.append(el('span', 'lektion-einheit', aufgabe.lerneinheit));
    }
    if (!aufgabe.abschnitt && !aufgabe.lerneinheit) {
        lektionZelle.append(el('span', 'ohne-wert', '–'));
    }

    const statusZelle = el('td');
    statusZelle.append(zustandsChip(aufgabe.zustand));

    const noteZelle = el('td', 'rechts');
    noteZelle.append(
        aufgabe.bewertung !== null
            ? bewertungMitNote(
                aufgabe.bewertung,
                aufgabe.skala ? aufgabe.bewertungText : null,
                notenschluessel
              )
            : el('span', 'ohne-wert', '–')
    );

    zeile.append(titelZelle, lektionZelle, statusZelle, noteZelle);
    return zeile;
}

/**
 * Prozentwert mit der zugehörigen Note.
 *
 * Ohne hinterlegten Notenschlüssel bleibt es beim Prozentwert —
 * die Note ist eine Zugabe, keine Voraussetzung.
 *
 * @param {number} wert - Prozentwert
 * @returns {HTMLElement}
 */
function bewertungMitNote(wert, skalenText, notenschluessel) {
    const behaelter = el('span', 'bewertung-paar');

    // Bei Skalenbewertungen sagt die Stufenbezeichnung mehr als der
    // umgerechnete Prozentwert; dieser steht im title.
    if (skalenText) {
        const marke = el('span', 'skalenwert', skalenText);
        marke.title = `entspricht ${formatBewertung(wert)}`;
        behaelter.append(marke);
    } else {
        behaelter.append(el('span', 'bewertung', formatBewertung(wert)));
    }

    const stufe = ermittleNote(notenschluessel, wert);
    if (stufe) {
        const marke = el('span', 'note', String(stufe.note));
        if (stufe.farbe) {
            marke.style.color = stufe.farbe;
            marke.style.borderColor = stufe.farbe;
        }
        marke.title = `Note ${stufe.note} — ${stufe.name}`;
        behaelter.append(marke);
    }

    return behaelter;
}

/**
 * Bewertung als Prozentwert ohne Nachkommastellen.
 */
function formatBewertung(wert) {
    return `${Math.round(wert)} %`;
}

function zustandsChip(zustand) {
    const chip = el('span', `chip chip-${zustand}`);

    const marke = el('span', 'chip-marke');
    marke.setAttribute('aria-hidden', 'true');
    chip.append(marke, document.createTextNode(ZUSTAND_TEXT[zustand]));

    // Zustände, die den nächsten Schritt offen lassen, bekommen ihn
    // dazu — "Status unbekannt" allein hilft niemandem weiter.
    const hinweis = ZUSTAND_HINWEIS[zustand];
    if (hinweis) chip.append(hilfe(hinweis, ZUSTAND_TEXT[zustand]));

    return chip;
}

// ------------------------------------------------------------
// Zustandsanzeigen
// ------------------------------------------------------------

/**
 * Zeigt einen Ladehinweis.
 */
export function zeigeLaden(wurzel, text = 'Lade Daten …') {
    wurzel.replaceChildren(el('p', 'laden', text));
}

/**
 * Zeigt einen Fehler mit Klartext und, wo möglich, dem nächsten Schritt.
 */
export function zeigeFehler(wurzel, titel, meldungen) {
    const block = el('section', 'fehler');
    block.append(el('h2', 'fehler-titel', titel));

    const liste = el('ul', 'fehler-liste');
    (Array.isArray(meldungen) ? meldungen : [meldungen])
        .forEach(meldung => liste.append(el('li', '', meldung)));
    block.append(liste);

    wurzel.replaceChildren(block);
}

/**
 * Blendet eine Warnung über der bestehenden Darstellung ein —
 * für Teilausfälle, bei denen die übrigen Daten noch tragen.
 */
export function zeigeWarnung(wurzel, meldungen) {
    const block = el('div', 'warnung');
    block.append(
        el('strong', '', 'Nicht alle Daten konnten geladen werden.'),
        el('span', '', ` ${meldungen.join(' · ')}`)
    );
    wurzel.prepend(block);
}

// ------------------------------------------------------------
// Hilfsfunktionen
// ------------------------------------------------------------

function el(tag, klasse, text) {
    const element = document.createElement(tag);
    if (klasse) element.className = klasse;
    if (text !== undefined) element.textContent = text;
    return element;
}

function formatDatum(iso) {
    const datum = new Date(iso);
    return Number.isNaN(datum.getTime())
        ? iso
        : datum.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}
