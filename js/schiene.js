// ============================================================
// schiene.js — Ermittlung der Schiene
//
// Die Anzahl der Blockwochen und ihre Termine hängen von der
// Schiene ab, die Schiene wiederum von der Klasse. Erkannt wird
// sie aus den Kurs-Tabs; schlägt das fehl, wählt die lernende
// Person selbst.
// ============================================================

const BASIS = 'https://lernplattform.bycs.de';
const TIMEOUT_MS = 8000;
const SPEICHER_SCHLUESSEL = 'stundenbilanz.schiene';

/**
 * Ermittelt die Schiene in dieser Reihenfolge:
 *   1. zuvor getroffene Wahl aus dieser Sitzung
 *   2. Klasse aus den Kurs-Tabs
 *   3. keine — die Person wählt selbst
 *
 * @param {Object} plan - validierter Plan
 * @param {string} kursId - Moodle-Kurs-ID des Hauptkurses
 * @returns {Promise<{schiene: string|null, klasse: string|null, quelle: string}>}
 */
export async function ermittleSchiene(plan, kursId) {
    const gemerkt = leseGemerkteSchiene();
    if (gemerkt && gemerkt in plan.schienen) {
        return { schiene: gemerkt, klasse: null, quelle: 'auswahl' };
    }

    const klasse = await erkenneKlasse(plan.klassenZuSchiene, kursId);
    if (klasse) {
        return {
            schiene: plan.klassenZuSchiene[klasse],
            klasse,
            quelle: 'erkannt'
        };
    }

    return { schiene: null, klasse: null, quelle: 'offen' };
}

/**
 * Sucht die Klasse in den Kurs-Tabs.
 *
 * Der Kurs nutzt das Format "onetopic"; die Klassen stehen als
 * title-Attribut an den Tab-Links. Erkannt wird nur, was auch in
 * der Zuordnung des Plans steht.
 *
 * @param {Object} klassenZuSchiene - Zuordnung aus dem Plan
 * @param {string} kursId
 * @returns {Promise<string|null>} Klassenname oder null
 */
export async function erkenneKlasse(klassenZuSchiene, kursId) {
    const bekannt = Object.keys(klassenZuSchiene);
    if (bekannt.length === 0) return null;

    try {
        const antwort = await fetch(`${BASIS}/course/view.php?id=${kursId}`, {
            credentials: 'include',
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!antwort.ok) return null;

        const dokument = new DOMParser().parseFromString(await antwort.text(), 'text/html');
        return findeKlasseImDokument(dokument, bekannt);

    } catch (fehler) {
        console.warn('Klassenerkennung fehlgeschlagen:', fehler.message);
        return null;
    }
}

/**
 * Durchsucht ein geparstes Kursdokument nach einer bekannten Klasse.
 * Getrennt, damit sie ohne Netzwerk prüfbar ist.
 *
 * @param {Document} dokument
 * @param {string[]} bekannteKlassen
 * @returns {string|null}
 */
export function findeKlasseImDokument(dokument, bekannteKlassen) {
    const links = dokument.querySelectorAll('a.nav-link[title]');

    for (const link of links) {
        const titel = link.getAttribute('title')?.trim();
        if (titel && bekannteKlassen.includes(titel)) {
            return titel;
        }
    }

    return null;
}

/**
 * Merkt die gewählte Schiene für die Dauer der Sitzung.
 * Bewusst sessionStorage: kein Zustand über die Sitzung hinaus.
 */
export function merkeSchiene(schiene) {
    try {
        sessionStorage.setItem(SPEICHER_SCHLUESSEL, schiene);
    } catch {
        // Ohne sessionStorage funktioniert alles weiter, die Wahl
        // muss dann nur bei jedem Laden erneut getroffen werden.
    }
}

function leseGemerkteSchiene() {
    try {
        return sessionStorage.getItem(SPEICHER_SCHLUESSEL);
    } catch {
        return null;
    }
}
