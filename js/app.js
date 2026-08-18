// ============================================================
// app.js — Ablaufsteuerung
//
// Führt die Reihenfolge aus, hält den Zustand der Sitzung und
// behandelt Fehler. Kein Caching über die Session hinaus:
// der Zustand lebt nur im Speicher dieser Seite.
// ============================================================

import { ladePlan, PlanFehler } from './plan.js';
import { ladeAllenStatus } from './moodle.js';
import { verbinde } from './status.js';
import { berechneBilanz } from './bilanz.js';
import { zeichne, zeigeLaden, zeigeFehler, zeigeWarnung } from './view.js';

const wurzel = document.getElementById('dashboard');
const aktualisierenKnopf = document.getElementById('aktualisieren');

// Der Plan ändert sich während einer Sitzung nicht und wird
// einmal gehalten; der Status wird bei jeder Aktualisierung neu geholt.
let plan = null;
let laueft = false;

/**
 * Lädt Plan und Status und zeichnet das Dashboard.
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

        zeigeLaden(wurzel, 'Lade Stand aus der Lernplattform …');
        const { status, fehler } = await ladeAllenStatus(plan.kurse);

        const aufgaben = verbinde(plan, status);
        const bilanz = berechneBilanz(plan, aufgaben);

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

function setzeKnopfZustand(aktiv) {
    if (!aktualisierenKnopf) return;
    aktualisierenKnopf.disabled = aktiv;
    aktualisierenKnopf.textContent = aktiv ? 'Wird geladen …' : 'Aktualisieren';
}

aktualisierenKnopf?.addEventListener('click', starte);
starte();
