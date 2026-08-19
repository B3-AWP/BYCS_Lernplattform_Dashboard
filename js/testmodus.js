// ============================================================
// testmodus.js — Probelauf mit fiktivem Datum und Beispieldaten
//
// Aktiv nur, wenn die Adresse "?test" enthält. Im Regelbetrieb
// ist dieses Modul stumm: keine Leiste, kein veraendertes
// Verhalten, keine Attrappen.
//
// Zweck: Das Dashboard haengt an Datum und Schiene. Beides laesst
// sich hier verstellen, ohne den Rechner umzustellen oder auf die
// naechste Blockwoche zu warten.
// ============================================================

import { ZUSTAND } from './status.js';

const SCHALTER = 'test';

/**
 * Ist der Testmodus aktiv?
 * @returns {boolean}
 */
export function istTestmodus() {
    return new URLSearchParams(location.search).has(SCHALTER);
}

/**
 * Liest das eingestellte Datum aus der Adresse.
 * Ohne Angabe gilt der heutige Tag.
 *
 * @returns {Date}
 */
export function testDatum() {
    const wert = new URLSearchParams(location.search).get('datum');
    if (!wert) return new Date();

    const datum = new Date(wert);
    return Number.isNaN(datum.getTime()) ? new Date() : datum;
}

/**
 * Liest die erzwungene Schiene aus der Adresse.
 * @returns {string|null}
 */
export function testSchiene() {
    return new URLSearchParams(location.search).get('schiene');
}

/**
 * Sollen Beispieldaten statt echter Moodle-Abrufe verwendet werden?
 * Nuetzlich ausserhalb der Lernplattform, wo kein Abruf moeglich ist.
 *
 * @returns {string|null} Name des Musters oder null
 */
export function testDaten() {
    return new URLSearchParams(location.search).get('daten');
}

/**
 * Sollen auch die Kurse erscheinen, die im Regelbetrieb
 * ausgeblendet sind ("anzeigen": false)?
 *
 * Damit laesst sich der Stand nach der Freischaltung des naechsten
 * Halbjahrs ansehen, ohne plan.json anzufassen.
 *
 * @returns {boolean}
 */
export function testAlleKurse() {
    return new URLSearchParams(location.search).get('kurse') === 'alle';
}

/**
 * Baut einen Status aus Beispieldaten.
 *
 * Muster:
 *   leer     — nichts begonnen
 *   haelfte  — die erste Haelfte abgegeben, davon einiges bewertet
 *   voll     — alles abgegeben und bewertet
 *   gemischt — alle fuenf Zustaende vertreten
 *
 * @param {Object} plan - validierter Plan
 * @param {string} muster
 * @returns {Map<string,Object>} wie ladeAllenStatus
 */
export function baueBeispielStatus(plan, muster) {
    const status = new Map();

    // Aufgaben gesperrter Kurse bleiben aussen vor — fuer sie
    // gaebe es in Moodle ebenfalls keine Zeile.
    const offene = plan.aufgaben.filter(aufgabe => !aufgabe.kursGesperrt);

    offene.forEach((aufgabe, index) => {
        const anteil = offene.length > 1 ? index / (offene.length - 1) : 0;
        let zustand;

        switch (muster) {
            case 'leer':
                zustand = ZUSTAND.NICHT_BEGONNEN;
                break;
            case 'voll':
                zustand = ZUSTAND.BEWERTET;
                break;
            case 'gemischt':
                zustand = [
                    ZUSTAND.BEWERTET, ZUSTAND.ABGEGEBEN, ZUSTAND.ENTWURF,
                    ZUSTAND.NICHT_BEGONNEN, ZUSTAND.BEWERTET
                ][index % 5];
                break;
            case 'haelfte':
            default:
                zustand = anteil > 0.5
                    ? ZUSTAND.NICHT_BEGONNEN
                    : (index % 3 === 0 ? ZUSTAND.ABGEGEBEN : ZUSTAND.BEWERTET);
        }

        const eintrag = baueEintrag(aufgabe, zustand, index);
        if (eintrag) status.set(aufgabe.cmid, eintrag);
    });

    return status;
}

/**
 * Uebersetzt einen Wunschzustand zurueck in Moodle-Rohwerte,
 * damit die echten Regeln aus status.js durchlaufen werden.
 */
function baueEintrag(aufgabe, zustand, index) {
    // Aufgaben mit Skala liefern eine Stufennummer, keinen Prozentwert —
    // sonst bliebe dieser Fall im Probelauf ungetestet.
    const alsText = aufgabe.skala
        ? `${aufgabe.skala.stufen[index % aufgabe.skala.stufen.length].wert}.00000`
        : (60 + ((index * 37) % 36)).toLocaleString('de-DE', { minimumFractionDigits: 2 });

    if (aufgabe.typ === 'quiz') {
        // Tests kennen nur zwei Zustaende
        return zustand === ZUSTAND.BEWERTET || zustand === ZUSTAND.ABGEGEBEN
            ? { typ: 'quiz', abgabestatus: null, bewertung: alsText }
            : { typ: 'quiz', abgabestatus: null, bewertung: '-' };
    }

    switch (zustand) {
        case ZUSTAND.BEWERTET:
            return { typ: 'assign', abgabestatus: 'Zur Bewertung abgegeben', bewertung: alsText };
        case ZUSTAND.ABGEGEBEN:
            return { typ: 'assign', abgabestatus: 'Zur Bewertung abgegeben', bewertung: '-' };
        case ZUSTAND.ENTWURF:
            return { typ: 'assign', abgabestatus: 'Entwurf (nicht abgegeben)', bewertung: '-' };
        default:
            return { typ: 'assign', abgabestatus: 'Keine Abgabe', bewertung: '-' };
    }
}

/**
 * Setzt einen Adressparameter und laedt die Seite neu.
 */
export function setzeParameter(name, wert) {
    const adresse = new URL(location.href);
    if (wert === null || wert === '') {
        adresse.searchParams.delete(name);
    } else {
        adresse.searchParams.set(name, wert);
    }
    adresse.searchParams.set(SCHALTER, '');
    location.href = adresse.toString();
}

/**
 * Verlaesst den Testmodus.
 */
export function verlasseTestmodus() {
    const adresse = new URL(location.href);
    adresse.search = '';
    location.href = adresse.toString();
}
