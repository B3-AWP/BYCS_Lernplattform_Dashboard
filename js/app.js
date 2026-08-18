// ============================================================
// app.js — Ablaufsteuerung
//
// Führt die Reihenfolge aus, hält den Zustand der Sitzung und
// behandelt Fehler. Kein Caching über die Session hinaus:
// der Zustand lebt nur im Speicher dieser Seite.
// ============================================================

import { ladePlan, PlanFehler } from './plan.js';
import { ladeAllenStatus } from './moodle.js';
import { ermittleSchiene, merkeSchiene } from './schiene.js';
import { verbinde } from './status.js';
import { berechneBilanz } from './bilanz.js';
import { zeichne, zeigeLaden, zeigeFehler, zeigeWarnung, zeigeSchienenAuswahl } from './view.js';

// Hauptkurs, in dem das Dashboard und plan.json liegen. Aus ihm
// wird die Klasse und damit die Schiene erkannt.
const HAUPTKURS_ID = '2491549';

const wurzel = document.getElementById('dashboard');
const aktualisierenKnopf = document.getElementById('aktualisieren');

// Plan und Schiene ändern sich während einer Sitzung nicht und
// werden gehalten; der Status wird bei jeder Aktualisierung neu geholt.
let plan = null;
let schiene = null;
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
            zeigeLaden(wurzel, 'Erkenne Klasse …');
            const ergebnis = await ermittleSchiene(plan, HAUPTKURS_ID);

            // Ohne Schiene lässt sich kein Soll berechnen — hier wird
            // gefragt statt geraten.
            if (!ergebnis.schiene) {
                zeigeSchienenAuswahl(wurzel, plan.schienen, waehleSchiene);
                return;
            }

            schiene = ergebnis.schiene;
        }

        zeigeLaden(wurzel, 'Lade Stand aus der Lernplattform …');
        const { status, fehler } = await ladeAllenStatus(plan.kurse);

        const aufgaben = verbinde(plan, status);
        const bilanz = berechneBilanz(plan, aufgaben, schiene);

        zeichne(wurzel, bilanz);

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
    } finally {
        laueft = false;
        setzeKnopfZustand(false);
    }
}

/**
 * Übernimmt die manuell gewählte Schiene und lädt weiter.
 */
function waehleSchiene(gewaehlt) {
    schiene = gewaehlt;
    merkeSchiene(gewaehlt);
    starte();
}

function setzeKnopfZustand(aktiv) {
    if (!aktualisierenKnopf) return;
    aktualisierenKnopf.disabled = aktiv;
    aktualisierenKnopf.textContent = aktiv ? 'Wird geladen …' : 'Aktualisieren';
}

aktualisierenKnopf?.addEventListener('click', starte);
starte();
