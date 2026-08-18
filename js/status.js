// ============================================================
// status.js — Zustandsermittlung
//
// Die eine Stelle, an der die Regeln für assign und quiz stehen.
// Bildet Moodle-Rohwerte auf die fünf Zustände ab.
// ============================================================

export const ZUSTAND = {
    NICHT_BEGONNEN: 'nicht-begonnen',
    ENTWURF: 'entwurf',
    ABGEGEBEN: 'abgegeben',
    BEWERTET: 'bewertet',
    UNBEKANNT: 'unbekannt'
};

/**
 * Beschriftungen für die Anzeige.
 */
export const ZUSTAND_TEXT = {
    [ZUSTAND.NICHT_BEGONNEN]: 'Nicht begonnen',
    [ZUSTAND.ENTWURF]: 'Entwurf',
    [ZUSTAND.ABGEGEBEN]: 'Abgegeben',
    [ZUSTAND.BEWERTET]: 'Bewertet',
    [ZUSTAND.UNBEKANNT]: 'Unklar'
};

/**
 * Zustände, die für den Fortschritt zählen.
 * Abgegeben zählt — unabhängig von der Bewertung.
 */
const ZAEHLT = new Set([ZUSTAND.ABGEGEBEN, ZUSTAND.BEWERTET]);

export function zaehltFuerFortschritt(zustand) {
    return ZAEHLT.has(zustand);
}

/**
 * Ermittelt Zustand und Bewertung einer Pflichtaufgabe.
 *
 * @param {Object} aufgabe - Aufgabe aus dem Plan (mit typ)
 * @param {Object|undefined} rohstatus - Moodle-Rohstatus oder undefined
 * @param {boolean} kursGesperrt - ob der Kurs noch gesperrt ist
 * @returns {{zustand: string, bewertung: number|null, bewertungText: string|null}}
 */
export function ermittleZustand(aufgabe, rohstatus, kursGesperrt) {
    // Ohne Moodle-Zeile: nicht begonnen. Das gilt für den gesperrten
    // Kurs 2 ebenso wie für eine umgezogene oder gelöschte Aktivität.
    // Die Aufgabe bleibt dabei im Nenner.
    if (kursGesperrt || !rohstatus) {
        return leer();
    }

    const { bewertung, bewertungText } = leseBewertung(aufgabe, rohstatus);
    const hatBewertung = bewertung !== null;

    if (aufgabe.typ === 'quiz') {
        // Tests haben keine Abgabespalte. Da alle Pflicht-Tests
        // automatisch bewertet werden, dient die Bewertung als
        // Ersatzsignal für die Abgabe.
        return hatBewertung
            ? { zustand: ZUSTAND.BEWERTET, bewertung, bewertungText }
            : leer();
    }

    // Aufgaben: submissionstatus ist die Leitgröße. completion
    // bedeutet je nach Aktivität etwas anderes und taugt nicht.
    const abgabe = (rohstatus.abgabestatus ?? '').toLowerCase();

    // Eine Bewertung schlägt den Abgabestatus. Lehrkräfte bewerten
    // auch ohne digitale Abgabe — etwa nach einem Gespräch oder für
    // etwas auf Papier. Dann steht in Moodle "Keine Abgabe" neben
    // einer echten Note; diese Bewertung darf nicht verloren gehen.
    if (hatBewertung) {
        return { zustand: ZUSTAND.BEWERTET, bewertung, bewertungText };
    }

    if (abgabe === '' || abgabe.includes('keine abgabe')) {
        return leer();
    }

    if (abgabe.includes('zur bewertung abgegeben')) {
        return { zustand: ZUSTAND.ABGEGEBEN, bewertung: null, bewertungText: null };
    }

    if (abgabe.includes('entwurf')) {
        return { zustand: ZUSTAND.ENTWURF, bewertung: null, bewertungText: null };
    }

    // Unbekannter Wert: defensiv werten (zählt nicht), den Rohwert
    // aber für die Fehlersuche mitführen.
    console.warn(`Unbekannter Abgabestatus "${rohstatus.abgabestatus}" bei cmid ${aufgabe.cmid}`);
    return { zustand: ZUSTAND.UNBEKANNT, bewertung: null, bewertungText: null };
}

function leer() {
    return { zustand: ZUSTAND.NICHT_BEGONNEN, bewertung: null, bewertungText: null };
}

/**
 * Liest die Bewertung, bei Bedarf über eine Skala.
 *
 * Skalenbewertungen liefern im Attribut eine Stufennummer
 * ("1.00000") und im Text die Beschriftung ("* Nicht akzeptabel").
 * Ohne Umrechnung erschiene Stufe 1 von 4 als "1 %" und damit als
 * schlechteste Note, obwohl sie nur die unterste von vier Stufen ist.
 *
 * @returns {{bewertung: number|null, bewertungText: string|null}}
 */
function leseBewertung(aufgabe, rohstatus) {
    const roh = parseBewertung(rohstatus.bewertung);
    if (roh === null) {
        return { bewertung: null, bewertungText: null };
    }

    if (!aufgabe.skala) {
        return { bewertung: roh, bewertungText: rohstatus.bewertung };
    }

    const stufe = aufgabe.skala.stufen.find(s => s.wert === roh);
    if (!stufe) {
        console.warn(
            `Skalenwert ${roh} bei cmid ${aufgabe.cmid} ist in Skala ` +
            `"${aufgabe.skala.name}" nicht definiert`
        );
        return { bewertung: null, bewertungText: null };
    }

    return { bewertung: stufe.prozent, bewertungText: stufe.name };
}

/**
 * Parst einen Bewertungswert.
 *
 * Moodle liefert je nach Bewertungsart Unterschiedliches:
 *   "-" oder leer      — keine Bewertung
 *   "82,64"            — Prozent- oder Punktwert, deutsch geschrieben
 *   "1.234,50"         — mit Tausenderpunkt
 *   "7,00/10,00"       — erreicht von möglich
 *   "1.00000"          — Stufennummer einer Skala, englisch geschrieben
 *
 * Bei "7,00/10,00" zählt der erreichte Teil; die Umrechnung auf
 * Prozent leistet diese Funktion nicht.
 *
 * @param {string|null} text
 * @returns {number|null}
 */
export function parseBewertung(text) {
    if (typeof text !== 'string') return null;

    const bereinigt = text.trim();
    if (bereinigt === '' || bereinigt === '-') return null;

    const ersterTeil = bereinigt.split('/')[0].trim();

    // Enthält der Wert ein Komma, ist es das Dezimaltrennzeichen und
    // Punkte sind Tausendertrenner ("1.234,50"). Ohne Komma ist ein
    // Punkt das Dezimaltrennzeichen — so liefert Moodle Skalenwerte
    // ("1.00000").
    const normalisiert = ersterTeil.includes(',')
        ? ersterTeil.replace(/\./g, '').replace(',', '.')
        : ersterTeil;

    const zahl = parseFloat(normalisiert);
    return Number.isFinite(zahl) ? zahl : null;
}

/**
 * Verbindet Plan und Status zu einer Liste ausgewerteter Aufgaben.
 *
 * Moodle-Zeilen ohne Gegenstück im Plan werden ignoriert — sie
 * sind keine Pflichtaufgaben.
 *
 * @param {Object} plan - validierter Plan
 * @param {Map<string,Object>} status - cmid → Rohstatus
 * @returns {Object[]} Aufgaben mit Zustand und Bewertung
 */
export function verbinde(plan, status) {
    return plan.aufgaben.map(aufgabe => ({
        ...aufgabe,
        ...ermittleZustand(aufgabe, status.get(aufgabe.cmid), aufgabe.kursGesperrt)
    }));
}
