// ============================================================
// moodle.js — Statusabruf aus den Kursübersichten
//
// Liest ausschließlich Status je Aufgabe: Abgabestatus und
// Bewertung. Kennt keine Planung, keine Stunden, keine Zustände.
// Ein Request pro Aktivitätstyp und Kurs.
// ============================================================

const BASIS = 'https://lernplattform.bycs.de';
const TIMEOUT_MS = 10000;

/**
 * Ruft den Status aller Aufgaben und Tests eines Kurses ab.
 *
 * Gesperrte Kurse werden übersprungen — ihr Abruf würde eine
 * Fehler- oder Anmeldeseite liefern und ist kein Verbindungsfehler.
 *
 * @param {Object} kurs - Kurs aus dem Plan
 * @returns {Promise<{status: Map<string,Object>, gesperrt: boolean, fehler: string|null}>}
 */
export async function ladeKursStatus(kurs) {
    if (kurs.gesperrt) {
        return { status: new Map(), gesperrt: true, fehler: null };
    }

    const [aufgaben, tests] = await Promise.all([
        ladeUebersicht(kurs.moodleCourseId, 'assign'),
        ladeUebersicht(kurs.moodleCourseId, 'quiz')
    ]);

    const status = new Map([...aufgaben.eintraege, ...tests.eintraege]);
    const fehlermeldungen = [aufgaben.fehler, tests.fehler].filter(Boolean);

    return {
        status,
        gesperrt: false,
        fehler: fehlermeldungen.length > 0 ? fehlermeldungen.join('; ') : null
    };
}

/**
 * Ruft den Status aller Kurse parallel ab.
 *
 * @param {Object[]} kurse - Kurse aus dem Plan
 * @returns {Promise<{status: Map<string,Object>, fehler: string[]}>}
 */
export async function ladeAllenStatus(kurse) {
    const ergebnisse = await Promise.all(kurse.map(ladeKursStatus));

    const status = new Map();
    const fehler = [];

    ergebnisse.forEach((ergebnis, index) => {
        ergebnis.status.forEach((wert, cmid) => status.set(cmid, wert));
        if (ergebnis.fehler) {
            fehler.push(`${kurse[index].titel}: ${ergebnis.fehler}`);
        }
    });

    return { status, fehler };
}

/**
 * Lädt und parst eine Übersichtstabelle.
 *
 * @param {string} kursId - Moodle-Kurs-ID
 * @param {'assign'|'quiz'} typ - Aktivitätstyp
 * @returns {Promise<{eintraege: Map<string,Object>, fehler: string|null}>}
 */
async function ladeUebersicht(kursId, typ) {
    const url = `${BASIS}/course/overview.php?id=${kursId}&expand[]=${typ}`;

    try {
        const antwort = await fetch(url, {
            credentials: 'include',
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });

        if (!antwort.ok) {
            return { eintraege: new Map(), fehler: `HTTP ${antwort.status} (${typ})` };
        }

        const html = await antwort.text();
        const dokument = new DOMParser().parseFromString(html, 'text/html');
        const eintraege = parseUebersicht(dokument, typ);

        // Der Parameter expand[] sorgt dafür, dass Moodle die Tabelle
        // serverseitig mitliefert, statt sie erst beim Aufklappen per
        // AJAX nachzuladen. Fehlt sie trotzdem, ist das ein Hinweis auf
        // ein geändertes Markup — und darf nicht als "nichts abgegeben"
        // durchgehen, denn das wäre eine falsche Aussage über den Stand.
        if (eintraege.size === 0 && !dokument.querySelector(`#${typ}_overview`)) {
            return {
                eintraege,
                fehler: `Übersicht für ${typ} nicht im Seiteninhalt gefunden`
            };
        }

        return { eintraege, fehler: null };

    } catch (fehler) {
        const grund = fehler.name === 'TimeoutError'
            ? `Zeitüberschreitung nach ${TIMEOUT_MS / 1000} s`
            : fehler.message;
        return { eintraege: new Map(), fehler: `${grund} (${typ})` };
    }
}

/**
 * Extrahiert die Statuszeilen aus einer geparsten Übersichtsseite.
 *
 * Aufgaben liefern zusätzlich eine Spalte "submissionstatus";
 * Tests haben diese Spalte nicht.
 *
 * @param {Document} dokument - geparste Übersichtsseite
 * @param {'assign'|'quiz'} typ - Aktivitätstyp
 * @returns {Map<string,Object>} cmid → Rohstatus
 */
export function parseUebersicht(dokument, typ) {
    const eintraege = new Map();
    const zeilen = dokument.querySelectorAll(
        `#${typ}_overview .course-overview-table tbody tr[data-mdl-overview-cmid]`
    );

    zeilen.forEach(zeile => {
        const cmid = zeile.getAttribute('data-mdl-overview-cmid');
        if (!cmid) return;

        eintraege.set(cmid, {
            typ,
            abgabestatus: zelleWert(zeile, 'submissionstatus'),
            bewertung: zelleWert(zeile, 'Bewertung'),
            abschluss: zelleWert(zeile, 'completion')
        });
    });

    return eintraege;
}

/**
 * Liest den Wert einer Übersichtszelle.
 *
 * Moodle führt den Wert im Attribut data-mdl-overview-value und
 * wiederholt ihn meist als Text. Das Attribut hat Vorrang; fehlt es,
 * dient der Text als Rückfall.
 *
 * @returns {string|null} getrimmter Wert oder null
 */
function zelleWert(zeile, feld) {
    const zelle = zeile.querySelector(`[data-mdl-overview-item="${feld}"]`);
    if (!zelle) return null;

    const attribut = zelle.getAttribute('data-mdl-overview-value');
    if (attribut !== null && attribut.trim() !== '') {
        return attribut.trim();
    }

    const text = zelle.textContent.trim();
    return text === '' ? null : text;
}
