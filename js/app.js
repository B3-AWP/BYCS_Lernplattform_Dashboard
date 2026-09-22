// ============================================================
// app.js — Ablaufsteuerung
//
// Führt die Reihenfolge aus, hält den Zustand der Sitzung und
// behandelt Fehler. Kein Caching über die Session hinaus:
// der Zustand lebt nur im Speicher dieser Seite.
// ============================================================

import { ladePlan, waehleKurse, PlanFehler } from './plan.js';
import { ladeAllenStatus } from './moodle.js';
import { ermittleSchiene, merkeSchiene } from './schiene.js';
import { verbinde } from './status.js';
import { berechneBilanz } from './bilanz.js';
import {
    zeichne, zeigeLaden, zeigeFehler, zeigeWarnung,
    zeigeKlassenAuswahl, zeichneTestleiste, zeigeZeitraum
} from './view.js';
import {
    istTestmodus, testDatum, testSchiene, testDaten, testAlleKurse,
    baueBeispielStatus, setzeParameter, verlasseTestmodus
} from './testmodus.js';

const wurzel = document.getElementById('dashboard');
const testleiste = document.getElementById('testleiste');
const aktualisierenKnopf = document.getElementById('aktualisieren');
const zeitraum = document.getElementById('zeitraum');

// Plan, Schiene und Klasse ändern sich während einer Sitzung nicht
// und werden gehalten; der Status wird bei jeder Aktualisierung neu
// geholt. Die Klasse ist nur bekannt, wenn sie erkannt oder gewählt
// wurde — sie bestimmt das Stundenraster, für die Blockwochen selbst
// zählt allein die Schiene.
let plan = null;
let schiene = null;
let klasse = null;
let laueft = false;

/**
 * Lädt Plan, Schiene und Status und zeichnet das Dashboard.
 */
async function starte() {
    if (laueft) return;
    laueft = true;
    setzeKnopfZustand(true);

    try {
        if (!plan) {
            zeigeLaden(wurzel, 'Lade Planung …');
            plan = await ladePlan();
        }

        if (!schiene) {
            schiene = await bestimmeSchiene();

            // Ohne Schiene lässt sich kein Soll berechnen — hier wird
            // gefragt statt geraten.
            if (!schiene) {
                zeigeKlassenAuswahl(
                    wurzel, plan.klassenZuSchiene, plan.schienen, waehleKlasse
                );
                return;
            }
        }

        // Nur die zur Anzeige freigegebenen Kurse — im Probelauf auf Wunsch alle.
        // Der volle Plan reist als alleKurse mit, damit die Bilanz die
        // Blockwochen am ausgeblendeten Halbjahr abschneiden kann.
        const sicht = { ...waehleKurse(plan, zeigeAlleKurse()), alleKurse: plan.kurse };

        const { status, fehler } = await holeStatus(sicht);

        const aufgaben = verbinde(sicht, status);
        // Die Klasse reist als Liste, weil das Raster auch bei mehreren
        // erkannten Klassen eindeutig bleiben muss.
        const bilanz = berechneBilanz(
            sicht, aufgaben, schiene, stichtag(), klasse ? [klasse] : []
        );

        zeichne(wurzel, bilanz);
        zeigeZeitraum(zeitraum, bilanz);
        zeichneTestleisteFallsNoetig();

        // Teilausfälle blockieren die Anzeige nicht — die übrigen
        // Kurse sind ausgewertet, der Rest wird benannt.
        if (fehler.length > 0) {
            zeigeWarnung(wurzel, fehler);
        }

    } catch (fehler) {
        if (fehler instanceof PlanFehler) {
            zeigeFehler(
                wurzel,
                'Die Planungsdatei kann nicht verwendet werden',
                fehler.meldungen
            );
        } else {
            console.error(fehler);
            zeigeFehler(
                wurzel,
                'Das Dashboard konnte nicht geladen werden',
                [
                    fehler.message,
                    'Prüfe, ob du in der Lernplattform angemeldet bist, und lade die Seite neu.'
                ]
            );
        }
        zeichneTestleisteFallsNoetig();
    } finally {
        laueft = false;
        setzeKnopfZustand(false);
    }
}

/**
 * Ermittelt die Schiene und setzt nebenbei die erkannte Klasse,
 * aus der sich das Stundenraster ergibt.
 *
 * Im Testmodus hat eine dort gewählte Schiene Vorrang; eine Klasse
 * wird dann nicht erkannt, die laufende Blockwoche zählt also ganz.
 *
 * @returns {Promise<string|null>} Name der Schiene
 */
async function bestimmeSchiene() {
    if (istTestmodus()) {
        const gewaehlt = testSchiene();
        if (gewaehlt && gewaehlt in plan.schienen) return gewaehlt;
        // Ohne Angabe die erste Schiene, damit der Probelauf sofort etwas zeigt
        return Object.keys(plan.schienen)[0] ?? null;
    }

    zeigeLaden(wurzel, 'Ermittle deine Klasse …');
    const ergebnis = await ermittleSchiene(plan);

    // Nur bei einer einzigen Klasse ist die Zuordnung eindeutig;
    // bei mehreren bliebe offen, welche die eigene ist.
    if (ergebnis.schiene && ergebnis.klassen.length === 1) {
        klasse = ergebnis.klassen[0];
        merkeSchiene(ergebnis.schiene, klasse);
    }

    return ergebnis.schiene;
}

/**
 * Holt den Status — echt aus Moodle oder als Beispieldaten,
 * wenn im Testmodus ein Muster gewählt wurde.
 */
async function holeStatus(sicht) {
    const muster = istTestmodus() ? testDaten() : null;

    if (muster) {
        return { status: baueBeispielStatus(sicht, muster), fehler: [] };
    }

    zeigeLaden(wurzel, 'Lade Stand aus der Lernplattform …');
    return ladeAllenStatus(sicht.kurse);
}

/**
 * Sollen auch verborgene Kurse erscheinen? Nur im Probelauf möglich.
 */
function zeigeAlleKurse() {
    return istTestmodus() && testAlleKurse();
}

/**
 * Stichtag der Berechnung — im Testmodus das eingestellte Datum.
 */
function stichtag() {
    return istTestmodus() ? testDatum() : new Date();
}

function zeichneTestleisteFallsNoetig() {
    if (!istTestmodus() || !testleiste) return;

    zeichneTestleiste(
        testleiste,
        {
            datum: testDatum(),
            schiene,
            daten: testDaten(),
            kurse: testAlleKurse() ? 'alle' : '',
            schienen: plan?.schienen ?? {}
        },
        {
            beiAenderung: setzeParameter,
            beiVerlassen: verlasseTestmodus
        }
    );
}

/**
 * Übernimmt die manuell gewählte Klasse und lädt weiter.
 * Die Schiene ergibt sich aus der Zuordnung im Plan.
 */
function waehleKlasse(gewaehlt) {
    klasse = gewaehlt;
    schiene = plan.klassenZuSchiene[gewaehlt];
    merkeSchiene(schiene, klasse);
    starte();
}

function setzeKnopfZustand(aktiv) {
    if (!aktualisierenKnopf) return;
    aktualisierenKnopf.disabled = aktiv;
    aktualisierenKnopf.textContent = aktiv ? 'Wird geladen …' : 'Aktualisieren';
}

aktualisierenKnopf?.addEventListener('click', starte);
starte();
