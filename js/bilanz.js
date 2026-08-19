// ============================================================
// bilanz.js — Die Rechnung
//
// Soll, Ist, Delta und Qualität. Reine Funktionen ohne DOM und
// ohne Netzwerk. Bezugsgröße ist immer das gesamte Schuljahr
// einschließlich des gesperrten Kurses, damit der Nenner beim
// Freischalten konstant bleibt.
//
// Das Soll hängt an der Schiene: Anzahl und Termine der
// Blockwochen unterscheiden sich je Schiene.
// ============================================================

import { zaehltFuerFortschritt, ZUSTAND } from './status.js';

/**
 * Ermittelt die laufende Schulwoche zu einem Datum.
 *
 * Blockwochen liegen weit auseinander. Zwischen zwei Blöcken gilt
 * der Stand des zuletzt abgeschlossenen Blocks; innerhalb eines
 * Blocks zählt dieser bereits mit.
 *
 * @param {Object[]} schulwochen - aufsteigend sortierter Kalender
 * @param {Date} [heute]
 * @returns {number} Wochennummer, 0 vor Beginn der ersten Blockwoche
 */
export function aktuelleWoche(schulwochen, heute = new Date()) {
    const stichtag = datumOhneZeit(heute);
    let aktuell = 0;

    for (const woche of schulwochen) {
        if (datumOhneZeit(new Date(woche.start)) <= stichtag) {
            aktuell = woche.woche;
        } else {
            break;
        }
    }

    return aktuell;
}

/**
 * Läuft der Block der Woche w gerade, oder liegt er schon hinter uns?
 *
 * Zwischen zwei Blöcken bleibt die Wochennummer stehen — für die
 * Rechnung richtig, für die Anzeige aber ein Unterschied: „läuft
 * gerade" ist etwas anderes als „liegt zurück".
 *
 * @param {Object[]} schulwochen
 * @param {number} woche
 * @param {Date} heute
 * @returns {boolean}
 */
export function istImBlock(schulwochen, woche, heute = new Date()) {
    const eintrag = schulwochen.find(w => w.woche === woche);
    if (!eintrag) return false;

    const stichtag = datumOhneZeit(heute);
    const beginn = datumOhneZeit(new Date(eintrag.start));

    // Ohne Endedatum gilt die Woche ab Beginn als laufend.
    if (!eintrag.ende) return stichtag >= beginn;

    return stichtag >= beginn && stichtag <= datumOhneZeit(new Date(eintrag.ende));
}

/**
 * Soll(w) — Anteil der bis einschließlich Woche w verstrichenen Stunden.
 *
 *   Soll(w) = Σ Stunden Schulwoche 1..w / Σ Stunden gesamt
 *
 * @param {Object[]} schulwochen
 * @param {number} woche
 * @returns {number} Anteil zwischen 0 und 1
 */
export function sollAnteil(schulwochen, woche) {
    const gesamt = schulwochen.reduce((summe, w) => summe + w.stunden, 0);
    if (gesamt <= 0) return 0;

    const bisher = schulwochen
        .filter(w => w.woche <= woche)
        .reduce((summe, w) => summe + w.stunden, 0);

    return bisher / gesamt;
}

/**
 * Berechnet die vollständige Bilanz für eine Schiene.
 *
 * @param {Object} plan - validierter Plan
 * @param {Object[]} aufgaben - ausgewertete Aufgaben aus status.verbinde
 * @param {string} schienenName - Schiene der lernenden Person
 * @param {Date} [heute]
 * @returns {Object} Bilanz mit Soll, Ist, Delta, Qualität und Kursaufstellung
 * @throws {Error} wenn die Schiene im Plan nicht existiert
 */
export function berechneBilanz(plan, aufgaben, schienenName, heute = new Date()) {
    const schiene = plan.schienen[schienenName];
    if (!schiene) {
        throw new Error(`Schiene "${schienenName}" ist im Plan nicht definiert.`);
    }

    // Nur die Blockwochen der angezeigten Kurse. alleKurse trägt den
    // ungefilterten Plan; ohne das Feld gilt der Plan als vollständig.
    const wochen = begrenzeSchulwochen(
        schiene.schulwochen, plan.kurse, plan.alleKurse ?? plan.kurse
    );

    const woche = aktuelleWoche(wochen, heute);
    const soll = sollAnteil(wochen, woche);
    const imBlock = istImBlock(wochen, woche, heute);

    const stundenGesamt = plan.stundenGesamt;
    const stundenAbgegeben = aufgaben
        .filter(aufgabe => zaehltFuerFortschritt(aufgabe.zustand))
        .reduce((summe, aufgabe) => summe + aufgabe.stunden, 0);

    const ist = stundenGesamt > 0 ? stundenAbgegeben / stundenGesamt : 0;

    // Unterrichtsstunden je Halbjahr — hängt an der Schiene, deshalb
    // erst hier und nicht schon beim Einlesen des Plans.
    const unterrichtsstunden = verteileUnterrichtsstunden(
        plan.alleKurse ?? plan.kurse, schiene.schulwochen
    );

    // Delta in Stunden — die Größe, die im Dashboard vorne steht.
    const deltaStunden = (ist - soll) * stundenGesamt;

    // Wird nur ein Teil des Schuljahrs gezeigt, benennen die Texte
    // ihn statt vom "Schuljahr" zu sprechen. Bei genau einem Kurs
    // trägt dessen Titel ("1. Halbjahr"), sonst bleibt es allgemein.
    const alleKurse = plan.alleKurse ?? plan.kurse;
    const nurTeilzeitraum = plan.kurse.length < alleKurse.length;
    const zeitraumTitel = nurTeilzeitraum && plan.kurse.length === 1
        ? plan.kurse[0].titel
        : null;

    return {
        schiene: schienenName,
        schienenTitel: schiene.titel,
        schuljahr: plan.schuljahr ?? null,
        notenschluessel: plan.notenschluessel,
        woche,
        wochenGesamt: wochen.length,
        nurTeilzeitraum,
        zeitraumTitel,
        imBlock,
        soll,
        ist,
        deltaStunden,
        stundenGesamt,
        stundenAbgegeben,
        stundenSoll: soll * stundenGesamt,
        qualitaet: berechneQualitaet(aufgaben),
        kurse: plan.kurse.map(
            kurs => kursBilanz(kurs, aufgaben, unterrichtsstunden.get(kurs.id))
        ),
        zaehlung: zaehleZustaende(aufgaben)
    };
}

/**
 * Qualität — ungewichteter Durchschnitt über bewertete Abgaben.
 * Fließt nicht in den Fortschritt ein.
 *
 * @param {Object[]} aufgaben
 * @returns {{durchschnitt: number|null, anzahl: number}}
 */
export function berechneQualitaet(aufgaben) {
    const bewertete = aufgaben.filter(
        aufgabe => aufgabe.zustand === ZUSTAND.BEWERTET && aufgabe.bewertung !== null
    );

    if (bewertete.length === 0) {
        return { durchschnitt: null, anzahl: 0 };
    }

    const summe = bewertete.reduce((wert, aufgabe) => wert + aufgabe.bewertung, 0);

    return {
        durchschnitt: summe / bewertete.length,
        anzahl: bewertete.length
    };
}

/**
 * Beschneidet den Wochenkalender auf die angezeigten Kurse.
 *
 * Wird nur das 1. Halbjahr gezeigt, darf sich das Soll nicht auf
 * Blockwochen stützen, die zum ausgeblendeten 2. Halbjahr gehören —
 * sonst bliebe der Balken dauerhaft unter 100 %, obwohl alles
 * Sichtbare geschafft ist.
 *
 * Geschnitten wird am Freischaltdatum des ersten ausgeblendeten
 * Kurses. Sind alle Kurse sichtbar, bleibt der Kalender ganz.
 *
 * @param {Object[]} schulwochen - Blockwochen der Schiene
 * @param {Object[]} kurse - die angezeigten Kurse
 * @param {Object[]} alleKurse - alle Kurse des Plans
 * @returns {Object[]} Blockwochen bis zum Schnitt
 */
export function begrenzeSchulwochen(schulwochen, kurse, alleKurse) {
    if (!Array.isArray(schulwochen) || schulwochen.length === 0) return schulwochen;
    if (!Array.isArray(alleKurse) || alleKurse.length === 0) return schulwochen;

    const gezeigt = new Set(kurse.map(kurs => kurs.id));

    // Der erste ausgeblendete Kurs, der ein Freischaltdatum trägt.
    const versteckt = alleKurse.find(
        kurs => !gezeigt.has(kurs.id) && kurs.freischaltung
    );
    if (!versteckt) return schulwochen;

    const schnitt = datumOhneZeit(new Date(versteckt.freischaltung));
    if (Number.isNaN(schnitt.getTime())) return schulwochen;

    const begrenzt = schulwochen.filter(
        woche => datumOhneZeit(new Date(woche.start)) < schnitt
    );

    // Bliebe nichts übrig, wäre kein Soll mehr berechenbar — dann
    // lieber der volle Kalender als eine Division durch null.
    return begrenzt.length > 0 ? begrenzt : schulwochen;
}

/**
 * Verteilt die Unterrichtsstunden der Schiene auf die Kurse.
 *
 * Die Blockwochen hängen an der Schiene, die Halbjahre an den
 * Kursen — verbunden werden beide über das Freischaltdatum: Wochen
 * davor gehören zum ersten Halbjahr, Wochen ab dem Datum zum
 * zweiten. Für die vorliegenden Schienen fällt die Grenze zwischen
 * zwei Blöcke, es wird also keine Blockwoche zerschnitten.
 *
 * Ohne Freischaltdatum lässt sich nicht trennen; dann bekommt kein
 * Kurs eine Angabe, statt eine erfundene zu zeigen.
 *
 * @param {Object[]} kurse - Kurse aus dem Plan, in Reihenfolge
 * @param {Object[]} schulwochen - Blockwochen der Schiene
 * @returns {Map<string, number>} Kurs-Id → Unterrichtsstunden
 */
export function verteileUnterrichtsstunden(kurse, schulwochen) {
    const verteilung = new Map();
    if (!Array.isArray(schulwochen) || schulwochen.length === 0) return verteilung;

    // Grenzen aus den Freischaltdaten: jeder Kurs mit Datum eröffnet
    // einen neuen Zeitraum, der bis zum nächsten Datum reicht.
    const grenzen = kurse.map(kurs => ({
        id: kurs.id,
        ab: kurs.freischaltung ? datumOhneZeit(new Date(kurs.freischaltung)) : null
    }));

    // Nur der erste Kurs darf ohne Datum auskommen — er beginnt mit
    // dem Schuljahr. Fehlt bei einem späteren das Datum, ist die
    // Zuordnung nicht eindeutig.
    if (grenzen.slice(1).some(g => g.ab === null || Number.isNaN(g.ab?.getTime()))) {
        return verteilung;
    }

    grenzen.forEach(g => verteilung.set(g.id, 0));

    schulwochen.forEach(woche => {
        const start = datumOhneZeit(new Date(woche.start));

        // Der letzte Kurs, dessen Freischaltung schon erreicht ist.
        let treffer = grenzen[0];
        for (const g of grenzen) {
            if (g.ab && start >= g.ab) treffer = g;
        }

        verteilung.set(treffer.id, verteilung.get(treffer.id) + (woche.stunden || 0));
    });

    return verteilung;
}

/**
 * Bilanz eines einzelnen Unterkurses.
 * Der Anteil bezieht sich auf die Stunden dieses Kurses.
 */
function kursBilanz(kurs, aufgaben, unterrichtsstunden) {
    const eigene = aufgaben.filter(aufgabe => aufgabe.kursId === kurs.id);
    const abgegeben = eigene.filter(aufgabe => zaehltFuerFortschritt(aufgabe.zustand));
    const stundenAbgegeben = abgegeben.reduce((summe, aufgabe) => summe + aufgabe.stunden, 0);

    return {
        id: kurs.id,
        titel: kurs.titel,
        gesperrt: kurs.gesperrt,
        freischaltung: kurs.freischaltung,
        moodleCourseId: kurs.moodleCourseId,
        stundenGeplant: kurs.stundenGeplant,
        stundenUnterricht: unterrichtsstunden ?? null,
        stundenAbgegeben,
        anteil: kurs.stundenGeplant > 0 ? stundenAbgegeben / kurs.stundenGeplant : 0,
        aufgabenGesamt: eigene.length,
        aufgabenAbgegeben: abgegeben.length,
        aufgaben: eigene
    };
}

/**
 * Zählt die Aufgaben je Zustand — für die Übersicht.
 */
function zaehleZustaende(aufgaben) {
    const zaehlung = {};
    for (const zustand of Object.values(ZUSTAND)) {
        zaehlung[zustand] = 0;
    }
    aufgaben.forEach(aufgabe => {
        zaehlung[aufgabe.zustand] = (zaehlung[aufgabe.zustand] ?? 0) + 1;
    });
    return zaehlung;
}

/**
 * Schneidet die Uhrzeit ab, damit Wochenvergleiche stabil sind.
 */
function datumOhneZeit(datum) {
    return new Date(datum.getFullYear(), datum.getMonth(), datum.getDate());
}

/**
 * Ermittelt die Note zu einem Prozentwert.
 *
 * Der Schlüssel ist absteigend sortiert; es gilt die erste Stufe,
 * deren Schwelle erreicht ist.
 *
 * Gerechnet wird mit dem gerundeten Wert, weil genau dieser
 * angezeigt wird: Bei 65,71 % stünde sonst "66 %" neben einer
 * Note 4, obwohl der Schlüssel ab 66 die Note 3 vorsieht — für
 * Lernende ein nicht auflösbarer Widerspruch.
 *
 * @param {Object[]|null} notenschluessel - aus dem Plan
 * @param {number|null} prozent
 * @returns {{note: number|string, name: string, farbe: string|null}|null}
 */
export function ermittleNote(notenschluessel, prozent) {
    if (!notenschluessel || prozent === null || !Number.isFinite(prozent)) {
        return null;
    }

    const angezeigt = Math.round(prozent);
    return notenschluessel.find(stufe => angezeigt >= stufe.abProzent) ?? null;
}

/**
 * Formatiert eine Stundenzahl deutsch, ohne unnötige Nachkommastellen.
 *
 * @param {number} stunden
 * @returns {string} z. B. "12", "3,5"
 */
export function formatStunden(stunden) {
    const gerundet = Math.round(stunden * 10) / 10;
    return gerundet.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

/**
 * Formatiert einen Anteil als Prozentzahl ohne Nachkommastellen.
 */
export function formatProzent(anteil) {
    return `${Math.round(anteil * 100)} %`;
}
