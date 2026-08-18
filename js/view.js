// ============================================================
// view.js — Darstellung
//
// Rendert Kopfzeile, Kurskacheln und Aufgabenliste aus dem
// berechneten Modell. Kein Fetch, keine Rechnung.
// ============================================================

import { ZUSTAND, ZUSTAND_TEXT } from './status.js';
import { formatStunden, formatProzent } from './bilanz.js';

const BASIS = 'https://lernplattform.bycs.de';

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
        aufgabenListe(bilanz.kurse)
    );
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
        el('p', 'bilanz-woche',
            bilanz.woche === 0
                ? `${bilanz.schienenTitel} · Der Unterricht hat noch nicht begonnen`
                : `${bilanz.schienenTitel} · Blockwoche ${bilanz.woche} von ${bilanz.wochenGesamt}`
        ),

        el('p', `delta ${vorsprung ? 'delta-vor' : 'delta-zurueck'}`,
            betrag < 0.05
                ? 'Genau im Plan'
                : `${formatStunden(betrag)} Stunden ${vorsprung ? 'Vorsprung' : 'Rückstand'}`
        ),

        balken('Soll', bilanz.soll, bilanz.stundenSoll, skala, 'soll'),
        balken('Ist', bilanz.ist, bilanz.stundenAbgegeben, skala, 'ist'),

        el('p', 'hinweis',
            'Gewichtet mit geplanter, nicht mit tatsächlich aufgewendeter Zeit. ' +
            'Bezugsgröße ist das gesamte Schuljahr einschließlich noch nicht ' +
            'freigeschalteter Kursteile.'
        ),

        qualitaetsKarte(bilanz.qualitaet)
    );

    return abschnitt;
}

function balken(beschriftung, anteil, stunden, skala, art) {
    const zeile = el('div', 'balken-zeile');

    const kopf = el('div', 'balken-kopf');
    kopf.append(
        el('span', 'balken-name', beschriftung),
        el('span', 'balken-wert',
            `${formatStunden(stunden)} h · ${formatProzent(anteil)}`)
    );

    const spur = el('div', 'balken-spur');
    const fuellung = el('div', `balken-fuellung balken-${art}`);
    fuellung.style.width = `${Math.min(100, (anteil / skala) * 100)}%`;
    spur.append(fuellung);

    zeile.append(kopf, spur);
    return zeile;
}

function qualitaetsKarte({ durchschnitt, anzahl }) {
    const karte = el('div', 'qualitaet');

    karte.append(
        el('span', 'qualitaet-name', 'Qualität'),
        el('span', 'qualitaet-wert',
            durchschnitt === null
                ? '–'
                : durchschnitt.toLocaleString('de-DE', { maximumFractionDigits: 1 })
        ),
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
    zahlen.append(
        kennzahl(`${formatStunden(kurs.stundenGeplant)} h`, 'geplant'),
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
        const spur = el('div', 'balken-spur');
        const fuellung = el('div', 'balken-fuellung balken-ist');
        fuellung.style.width = `${Math.min(100, kurs.anteil * 100)}%`;
        spur.append(fuellung);
        karte.append(spur);
    }

    return karte;
}

function kennzahl(wert, beschriftung) {
    const block = el('div', 'kennzahl');
    block.append(
        el('span', 'kennzahl-wert', wert),
        el('span', 'kennzahl-name', beschriftung)
    );
    return block;
}

// ------------------------------------------------------------
// Aufgabenliste
// ------------------------------------------------------------

function aufgabenListe(kurse) {
    const abschnitt = el('section', 'aufgaben');
    abschnitt.append(el('h2', 'abschnitt-titel', 'Pflichtaufgaben'));

    kurse.forEach(kurs => {
        const gruppen = gruppiereNachBereich(kurs.aufgaben);

        gruppen.forEach(([bereich, aufgaben]) => {
            abschnitt.append(el('h3', 'bereich-titel', bereich || kurs.titel));

            const liste = el('ul', 'aufgaben-liste');
            aufgaben.forEach(aufgabe => liste.append(aufgabenZeile(aufgabe)));
            abschnitt.append(liste);
        });
    });

    return abschnitt;
}

function aufgabenZeile(aufgabe) {
    const zeile = el('li', 'aufgabe');

    const haupt = el('div', 'aufgabe-haupt');
    haupt.append(
        el('span', 'aufgabe-titel', aufgabe.titel),
        el('span', 'aufgabe-stunden', `${formatStunden(aufgabe.stunden)} h`)
    );

    const rand = el('div', 'aufgabe-rand');
    rand.append(zustandsChip(aufgabe.zustand));

    if (aufgabe.bewertungText !== null) {
        rand.append(bewertungsLink(aufgabe));
    }

    zeile.append(haupt, rand);
    return zeile;
}

function zustandsChip(zustand) {
    const chip = el('span', `chip chip-${zustand}`);
    chip.append(el('span', 'chip-marke'), document.createTextNode(ZUSTAND_TEXT[zustand]));
    return chip;
}

/**
 * Bewertung mit Link auf den offiziellen Bewertungsbericht.
 * Die Bewertung im Dashboard ist eine Anzeige, nicht die Quelle.
 */
function bewertungsLink(aufgabe) {
    const link = document.createElement('a');
    link.className = 'bewertung';
    link.href = `${BASIS}/mod/${aufgabe.typ}/view.php?id=${aufgabe.cmid}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = aufgabe.bewertungText;
    link.title = 'Zum offiziellen Bewertungsbericht';
    return link;
}

function gruppiereNachBereich(aufgaben) {
    const gruppen = new Map();

    aufgaben.forEach(aufgabe => {
        const schluessel = aufgabe.bereich ?? '';
        if (!gruppen.has(schluessel)) gruppen.set(schluessel, []);
        gruppen.get(schluessel).push(aufgabe);
    });

    return [...gruppen];
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
