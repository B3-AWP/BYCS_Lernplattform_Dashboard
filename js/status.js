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
        return { zustand: ZUSTAND.NICHT_BEGONNEN, bewertung: null, bewertungText: null };
    }

    const bewertung = parseBewertung(rohstatus.bewertung);
    const hatBewertung = bewertung !== null;

    if (aufgabe.typ === 'quiz') {
        // Tests haben keine Abgabespalte. Da alle Pflicht-Tests
        // automatisch bewertet werden, dient die Bewertung als
        // Ersatzsignal für die Abgabe.
        return {
            zustand: hatBewertung ? ZUSTAND.BEWERTET : ZUSTAND.NICHT_BEGONNEN,
            bewertung,
            bewertungText: hatBewertung ? rohstatus.bewertung : null
        };
    }

    // Aufgaben: submissionstatus ist die Leitgröße. completion
    // bedeutet je nach Aktivität etwas anderes und taugt nicht.
    const abgabe = (rohstatus.abgabestatus ?? '').toLowerCase();

    if (abgabe === '' || abgabe.includes('keine abgabe')) {
        return { zustand: ZUSTAND.NICHT_BEGONNEN, bewertung: null, bewertungText: null };
    }

    if (abgabe.includes('zur bewertung abgegeben')) {
        return {
            zustand: hatBewertung ? ZUSTAND.BEWERTET : ZUSTAND.ABGEGEBEN,
            bewertung,
            bewertungText: hatBewertung ? rohstatus.bewertung : null
        };
    }

    if (abgabe.includes('entwurf')) {
        return { zustand: ZUSTAND.ENTWURF, bewertung: null, bewertungText: null };
    }

    // Unbekannter Wert: defensiv als Entwurf werten (zählt nicht),
    // den Rohwert aber für die Fehlersuche mitführen.
    console.warn(`Unbekannter Abgabestatus "${rohstatus.abgabestatus}" bei cmid ${aufgabe.cmid}`);
    return {
        zustand: ZUSTAND.UNBEKANNT,
        bewertung,
        bewertungText: hatBewertung ? rohstatus.bewertung : null
    };
}

/**
 * Parst einen Bewertungswert.
 *
 * Moodle liefert "-", einen leeren Wert oder eine Zahl in
 * deutscher Schreibweise ("82,64"). Werte wie "7,00/10,00"
 * werden auf den erreichten Teil reduziert.
 *
 * @param {string|null} text
 * @returns {number|null}
 */
export function parseBewertung(text) {
    if (typeof text !== 'string') return null;

    const bereinigt = text.trim();
    if (bereinigt === '' || bereinigt === '-') return null;

    const ersterTeil = bereinigt.split('/')[0].trim();
    const zahl = parseFloat(ersterTeil.replace(',', '.'));

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
