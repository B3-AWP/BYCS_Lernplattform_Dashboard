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

        el('p', `delta ${vorsprung ? 'delta-vor' : 'delta-zurueck'}`,
            betrag < 0.05
                ? 'Genau im Plan'
                : `${formatStunden(betrag)} Stunden ${vorsprung ? 'Vorsprung' : 'Rückstand'}`
        ),

        balken(
            'Bis jetzt eingeplant', bilanz.soll, bilanz.stundenSoll, skala, 'soll',
            'So viele Unterrichtsstunden sind in deiner Schiene bisher vergangen — ' +
            'gemessen an den Blockwochen im Schuljahr. Dieser Wert steigt nur, ' +
            'wenn eine neue Blockwoche beginnt, und sagt nichts darüber aus, ' +
            'was du getan hast.'
        ),
        balken(
            'Davon abgegeben', bilanz.ist, bilanz.stundenAbgegeben, skala, 'ist',
            'So viele der eingeplanten Stunden entfallen auf Pflichtaufgaben, ' +
            'die du bereits abgegeben hast. Gezählt wird die für eine Aufgabe ' +
            'eingeplante Zeit, nicht die, die du wirklich gebraucht hast. ' +
            'Ob eine Abgabe schon bewertet wurde, spielt keine Rolle.'
        ),

        el('p', 'hinweis',
            'Beide Werte beziehen sich auf das ganze Schuljahr, auch auf Kursteile, ' +
            'die noch gesperrt sind. Dadurch springt die Anzeige nicht, sobald ein ' +
            'Kursteil freigeschaltet wird.'
        ),

        qualitaetsKarte(bilanz.qualitaet)
    );

    return abschnitt;
}

/**
 * Fragezeichen mit Erklärung bei Mouseover und Tastaturfokus.
 *
 * Als <button> statt <span>, damit die Erklärung auch ohne Maus
 * erreichbar ist; title dient zusätzlich als Rückfall.
 *
 * @param {string} text - die Erklärung
 * @returns {HTMLElement}
 */
function hilfe(text) {
    const behaelter = el('span', 'hilfe');

    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'hilfe-zeichen';
    knopf.textContent = '?';
    knopf.title = text;
    knopf.setAttribute('aria-label', `Erklärung: ${text}`);

    behaelter.append(knopf, el('span', 'hilfe-text', text));
    return behaelter;
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

function balken(beschriftung, anteil, stunden, skala, art, erklaerung) {
    const zeile = el('div', 'balken-zeile');

    const name = el('span', 'balken-name');
    name.append(document.createTextNode(beschriftung));
    if (erklaerung) name.append(hilfe(erklaerung));

    const kopf = el('div', 'balken-kopf');
    kopf.append(
        name,
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

    const name = el('span', 'qualitaet-name');
    name.append(document.createTextNode('Qualität'));
    name.append(hilfe(
        'Der Durchschnitt aller Bewertungen, die du bisher bekommen hast. ' +
        'Jede bewertete Aufgabe zählt gleich viel, unabhängig von ihrem Umfang. ' +
        'Dieser Wert ist vom Fortschritt getrennt: Eine gute Bewertung bringt ' +
        'dich zeitlich nicht weiter, und eine schlechte wirft dich nicht zurück.'
    ));

    karte.append(
        name,
        el('span', 'qualitaet-wert',
            durchschnitt === null ? '–' : formatBewertung(durchschnitt)
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

function aufgabenListe(kurse) {
    const abschnitt = el('section', 'aufgaben');
    abschnitt.append(el('h2', 'abschnitt-titel', 'Pflichtaufgaben'));

    const alle = kurse.flatMap(kurs => kurs.aufgaben);
    if (alle.length === 0) return abschnitt;

    const behaelter = el('div', 'tabelle-rahmen');

    // Nach einem Klick auf die Überschrift wird nur die Tabelle neu
    // gezeichnet — die Daten bleiben, nur die Reihenfolge ändert sich.
    const zeichneTabelle = () => {
        behaelter.replaceChildren(aufgabenTabelle(alle, zeichneTabelle));
    };
    zeichneTabelle();

    abschnitt.append(behaelter);
    return abschnitt;
}

/**
 * Baut die Aufgabentabelle. Der Rückruf zeichnet sie nach einem
 * Klick auf eine Spaltenüberschrift neu.
 */
function aufgabenTabelle(aufgaben, neuZeichnen) {
    const tabelle = el('table', 'aufgaben-tabelle');

    const spalten = [
        { schluessel: 'titel', text: 'Titel' },
        { schluessel: 'status', text: 'Status' },
        { schluessel: 'bewertung', text: 'Bewertung', rechts: true }
    ];

    const kopf = el('thead');
    const kopfzeile = el('tr');

    spalten.forEach(spalte => {
        const zelle = el('th', spalte.rechts ? 'rechts' : '');
        zelle.scope = 'col';

        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.className = 'sortknopf';
        knopf.append(document.createTextNode(spalte.text));

        const aktiv = sortierung.spalte === spalte.schluessel;
        knopf.append(el('span', 'sortpfeil', aktiv ? (sortierung.absteigend ? '▾' : '▴') : '⇅'));

        if (aktiv) {
            zelle.setAttribute('aria-sort', sortierung.absteigend ? 'descending' : 'ascending');
        }
        knopf.setAttribute(
            'aria-label',
            `Nach ${spalte.text} sortieren${aktiv ? ' (Richtung umkehren)' : ''}`
        );

        knopf.addEventListener('click', () => {
            if (sortierung.spalte === spalte.schluessel) {
                sortierung.absteigend = !sortierung.absteigend;
            } else {
                sortierung = { spalte: spalte.schluessel, absteigend: false };
            }
            neuZeichnen();
        });

        zelle.append(knopf);
        kopfzeile.append(zelle);
    });

    kopf.append(kopfzeile);
    tabelle.append(kopf);

    const koerper = el('tbody');
    sortiere(aufgaben).forEach(aufgabe => koerper.append(aufgabenZeile(aufgabe)));
    tabelle.append(koerper);

    return tabelle;
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

function aufgabenZeile(aufgabe) {
    const zeile = el('tr', aufgabe.kursGesperrt ? 'zeile-gesperrt' : '');

    // Titel als Link auf die Aufgabe in der Lernplattform
    const titelZelle = el('td', 'zelle-titel');
    const link = document.createElement('a');
    link.className = 'aufgaben-link';
    link.href = `${BASIS}/mod/${aufgabe.typ}/view.php?id=${aufgabe.cmid}`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = aufgabe.titel;
    link.title = 'In der Lernplattform öffnen';
    titelZelle.append(link, el('span', 'aufgabe-stunden', `${formatStunden(aufgabe.stunden)} h`));

    const statusZelle = el('td');
    statusZelle.append(zustandsChip(aufgabe.zustand));

    const noteZelle = el('td', 'rechts');
    noteZelle.append(
        aufgabe.bewertung !== null
            ? el('span', 'bewertung', formatBewertung(aufgabe.bewertung))
            : el('span', 'ohne-wert', '–')
    );

    zeile.append(titelZelle, statusZelle, noteZelle);
    return zeile;
}

/**
 * Bewertung als Prozentwert ohne Nachkommastellen.
 * Nicht-numerische Bewertungen (etwa Skalen) bleiben unverändert.
 */
function formatBewertung(wert) {
    return `${Math.round(wert)} %`;
}

function zustandsChip(zustand) {
    const chip = el('span', `chip chip-${zustand}`);
    chip.append(el('span', 'chip-marke'), document.createTextNode(ZUSTAND_TEXT[zustand]));
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
