// ============================================================
// schiene.js — Ermittlung der Schiene
//
// Die Anzahl der Blockwochen und ihre Termine hängen von der
// Schiene ab, die Schiene wiederum von der Klasse.
//
// Erkannt wird die Klasse aus den Gruppen im eigenen Kursprofil.
// Der ByCS-Selbstservice wäre die verbindlichere Quelle, ist aber
// nicht nutzbar: Er liegt auf einer anderen Herkunft und sendet
// keinen CORS-Header, der Browser verwirft die Antwort ungelesen.
// Moodle ist dagegen dieselbe Herkunft wie das Dashboard.
//
// Bleibt die Erkennung ohne Ergebnis oder ist sie nicht eindeutig,
// wählt die lernende Person selbst.
// ============================================================

const BASIS = 'https://lernplattform.bycs.de';
const TIMEOUT_MS = 8000;
const SPEICHER_SCHLUESSEL = 'stundenbilanz.schiene';

/**
 * Ermittelt die Schiene in dieser Reihenfolge:
 *   1. zuvor getroffene Wahl aus dieser Sitzung
 *   2. Gruppen aus dem eigenen Kursprofil
 *   3. keine — die Person wählt selbst
 *
 * Mehrere gefundene Klassen mit widersprüchlichen Schienen gelten
 * als nicht erkannt: Lieber fragen als die falsche Blockwoche
 * unterstellen. Zeigen mehrere Klassen auf dieselbe Schiene, ist
 * das kein Widerspruch und wird übernommen.
 *
 * @param {Object} plan - validierter Plan
 * @returns {Promise<{schiene: string|null, klassen: string[], quelle: string}>}
 */
export async function ermittleSchiene(plan) {
    const gemerkt = leseGemerkteSchiene();
    if (gemerkt && gemerkt in plan.schienen) {
        return { schiene: gemerkt, klassen: [], quelle: 'auswahl' };
    }

    return erkenneAusProfil(plan.klassenZuSchiene, waehleKurs(plan.kurse));
}

/**
 * Wählt den Kurs, über dessen Profilseite gesucht wird.
 *
 * Gesperrte Kurse scheiden aus — sie liefern eine Fehlerseite
 * statt eines Profils. Ist keiner offen, bleibt null und die
 * Erkennung entfällt.
 *
 * @param {Object[]} kurse - Kurse aus dem Plan
 * @returns {string|null} Moodle-Kurs-ID
 */
export function waehleKurs(kurse) {
    return kurse.find(kurs => !kurs.gesperrt)?.moodleCourseId ?? null;
}

/**
 * Liest die Gruppen des eigenen Kursprofils und leitet daraus die
 * Schiene ab.
 *
 * @param {Object} klassenZuSchiene - Zuordnung aus dem Plan
 * @param {string|null} kursId - Moodle-Kurs-ID eines offenen Kurses
 * @returns {Promise<{schiene: string|null, klassen: string[], quelle: string}>}
 */
export async function erkenneAusProfil(klassenZuSchiene, kursId) {
    const leer = { schiene: null, klassen: [], quelle: 'offen' };
    if (!kursId || Object.keys(klassenZuSchiene).length === 0) return leer;

    try {
        const antwort = await fetch(`${BASIS}/user/view.php?course=${kursId}`, {
            credentials: 'include',
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
        if (!antwort.ok) return leer;

        const dokument = new DOMParser().parseFromString(await antwort.text(), 'text/html');
        return deuteGruppen(dokument, klassenZuSchiene);

    } catch (fehler) {
        console.warn('Kursprofil nicht lesbar:', fehler.message);
        return leer;
    }
}

/**
 * Wertet ein geparstes Kursprofil aus.
 * Getrennt, damit sie ohne Netzwerk prüfbar ist.
 *
 * Moodle führt die Gruppen in einer Beschreibungsliste:
 *
 *   <dl><dt>Gruppe</dt><dd><a …>K - IFA12A (6072)</a>, <a …>Testgruppe</a></dd></dl>
 *
 * Gesucht wird zuerst gezielt in diesem Abschnitt. Er nennt genau
 * die eigenen Gruppen, während anderswo auf der Seite fremde
 * Klassennamen stehen können. Fehlt er — anderes Theme, andere
 * Sprache —, dient die ganze Seite als Rückfall; das ist ungenauer,
 * aber besser als gar keine Erkennung.
 *
 * @param {Document} dokument
 * @param {Object} klassenZuSchiene
 * @returns {{schiene: string|null, klassen: string[], quelle: string}}
 */
export function deuteGruppen(dokument, klassenZuSchiene) {
    const bekannt = Object.keys(klassenZuSchiene);

    const ausAbschnitt = findeGruppenAbschnitt(dokument);
    const klassen = ausAbschnitt !== null
        ? findeKlassenImText(ausAbschnitt, bekannt)
        : findeKlassenImText(dokument.body?.textContent ?? '', bekannt);

    if (klassen.length === 0) {
        return { schiene: null, klassen: [], quelle: 'offen' };
    }

    const schienen = [...new Set(klassen.map(klasse => klassenZuSchiene[klasse]))];

    // Genau eine Schiene — auch wenn mehrere Klassen dorthin zeigen.
    if (schienen.length === 1) {
        return { schiene: schienen[0], klassen, quelle: 'gruppen' };
    }

    return { schiene: null, klassen, quelle: 'mehrdeutig' };
}

/**
 * Liefert den Text des Gruppen-Abschnitts im Profil.
 *
 * Die Beschriftung hängt an der Sprache und am Numerus: Moodle
 * schreibt "Gruppe" oder "Gruppen", englisch "Group"/"Groups".
 * Deshalb wird über die dt-Elemente gesucht statt über eine feste
 * Position.
 *
 * @param {Document} dokument
 * @returns {string|null} Text der Gruppen, sonst null
 */
function findeGruppenAbschnitt(dokument) {
    for (const dt of dokument.querySelectorAll('dt')) {
        if (!/^gruppen?$|^groups?$/i.test(dt.textContent.trim())) continue;

        const dd = dt.nextElementSibling;
        if (dd?.tagName === 'DD') return dd.textContent;
    }

    return null;
}

/**
 * Sucht bekannte Klassennamen in einem Text.
 *
 * Die Gruppen heißen in Moodle nicht wie die Klasse allein,
 * sondern etwa "K - IFA12A (6072)". Gesucht wird deshalb der
 * Klassenname innerhalb des Gruppennamens.
 *
 * Die Grenzen links und rechts verhindern Treffer innerhalb
 * längerer Bezeichner: "IFA12A" darf nicht in "IFA12AB"
 * anschlagen. \b genügt dafür nicht, weil Klassennamen auf einer
 * Ziffer oder einem Buchstaben enden können.
 *
 * @param {string} text
 * @param {string[]} bekannteKlassen
 * @returns {string[]} gefundene Klassen, ohne Dubletten
 */
export function findeKlassenImText(text, bekannteKlassen) {
    const gross = text.toUpperCase();

    return bekannteKlassen.filter(klasse => {
        const muster = new RegExp(
            `(^|[^A-Z0-9])${maskiere(klasse.toUpperCase())}([^A-Z0-9]|$)`
        );
        return muster.test(gross);
    });
}

function maskiere(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
