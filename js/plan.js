// ============================================================
// plan.js — Laden und Validieren der Planungsdatei
//
// Einzige Quelle der Planung: Kurse, Pflichtaufgaben, geplante
// Stunden, Schulwochenkalender je Schiene. Kennt keinen Status
// und ruft Moodle nicht auf.
// ============================================================

const SCHEMA_VERSION = 3;
const AUFGABEN_TYPEN = ['assign', 'quiz'];

/**
 * Fehler mit gesammelten Validierungsmeldungen.
 */
export class PlanFehler extends Error {
    constructor(meldungen) {
        super(`Planungsdatei fehlerhaft:\n· ${meldungen.join('\n· ')}`);
        this.name = 'PlanFehler';
        this.meldungen = meldungen;
    }
}

/**
 * Lädt plan.json und gibt das validierte, angereicherte Modell zurück.
 *
 * @param {string} url - Pfad zur Planungsdatei
 * @returns {Promise<Object>} validierter Plan mit berechneten Summen
 * @throws {PlanFehler} bei Schema- oder Konsistenzfehlern
 */
export async function ladePlan(url = 'plan.json') {
    let rohdaten;

    try {
        const antwort = await fetch(url, { cache: 'no-store' });
        if (!antwort.ok) {
            throw new Error(`HTTP ${antwort.status} ${antwort.statusText}`);
        }
        rohdaten = await antwort.json();
    } catch (fehler) {
        if (fehler instanceof SyntaxError) {
            throw new PlanFehler([`${url} ist kein gültiges JSON: ${fehler.message}`]);
        }
        throw new PlanFehler([`${url} konnte nicht geladen werden: ${fehler.message}`]);
    }

    return pruefePlan(rohdaten);
}

/**
 * Validiert die Rohdaten und reichert sie um berechnete Summen an.
 * Getrennt von ladePlan, damit sie ohne Netzwerk testbar ist.
 *
 * @param {Object} rohdaten - geparste Planungsdatei
 * @returns {Object} angereicherter Plan
 * @throws {PlanFehler}
 */
export function pruefePlan(rohdaten) {
    const fehler = [];

    if (!rohdaten || typeof rohdaten !== 'object') {
        throw new PlanFehler(['Die Planungsdatei enthält kein Objekt.']);
    }

    if (rohdaten.schemaVersion !== SCHEMA_VERSION) {
        fehler.push(
            `schemaVersion ist ${JSON.stringify(rohdaten.schemaVersion)}, ` +
            `erwartet wird ${SCHEMA_VERSION}.`
        );
    }

    const notenschluessel = pruefeNotenschluessel(rohdaten.notenschluessel, fehler);
    const skalen = pruefeSkalen(rohdaten.skalen, fehler);
    const schienen = pruefeSchienen(rohdaten.schienen, fehler);
    const klassenZuSchiene = pruefeKlassenzuordnung(
        rohdaten.klassenZuSchiene, schienen, fehler
    );
    const kurse = pruefeKurse(rohdaten.kurse, skalen, fehler);

    if (fehler.length > 0) {
        throw new PlanFehler(fehler);
    }

    const stundenGesamt = kurse.reduce((summe, kurs) => summe + kurs.stundenGeplant, 0);

    if (stundenGesamt <= 0) {
        throw new PlanFehler(['Die Summe der geplanten Stunden ist 0 — es gäbe nichts zu messen.']);
    }

    return {
        schemaVersion: rohdaten.schemaVersion,
        schuljahr: rohdaten.schuljahr ?? null,
        stand: rohdaten.stand ?? null,
        notenschluessel,
        skalen,
        schienen,
        klassenZuSchiene,
        kurse,
        stundenGesamt,
        aufgaben: kurse.flatMap(kurs => kurs.aufgaben)
    };
}

/**
 * Wählt die anzuzeigenden Kurse aus und rechnet die Summen neu.
 *
 * Gefiltert wird erst hier und nicht schon beim Einlesen: Der volle
 * Plan bleibt erhalten, damit der Probelauf ohne Neuladen zwischen
 * beiden Sichten wechseln kann.
 *
 * @param {Object} plan - validierter Plan
 * @param {boolean} [alleZeigen] - true blendet auch verborgene Kurse ein
 * @returns {Object} Plan mit reduzierter Kurs- und Aufgabenliste
 * @throws {PlanFehler} wenn nichts übrig bleibt, womit zu rechnen wäre
 */
export function waehleKurse(plan, alleZeigen = false) {
    if (alleZeigen) return plan;

    const kurse = plan.kurse.filter(kurs => kurs.anzeigen);

    if (kurse.length === 0) {
        throw new PlanFehler([
            'Kein Kurs ist zur Anzeige freigegeben — es gäbe nichts darzustellen. ' +
            'Mindestens ein Kurs in plan.json braucht "anzeigen": true.'
        ]);
    }

    const stundenGesamt = kurse.reduce((summe, kurs) => summe + kurs.stundenGeplant, 0);

    if (stundenGesamt <= 0) {
        throw new PlanFehler([
            'Die angezeigten Kurse haben zusammen 0 geplante Stunden — es gäbe nichts zu messen.'
        ]);
    }

    return {
        ...plan,
        kurse,
        stundenGesamt,
        aufgaben: kurse.flatMap(kurs => kurs.aufgaben)
    };
}

/**
 * Prüft den Notenschlüssel.
 *
 * Absteigend sortiert, damit die erste passende Schwelle gilt.
 * Ohne Schlüssel bleibt die Notenanzeige einfach aus — das
 * Dashboard rechnet weiter, es zeigt nur keine Noten.
 */
function pruefeNotenschluessel(notenschluessel, fehler) {
    if (notenschluessel === undefined) return null;

    if (!Array.isArray(notenschluessel) || notenschluessel.length === 0) {
        fehler.push('notenschluessel ist keine Liste oder leer. Weglassen, wenn keine Noten gezeigt werden sollen.');
        return null;
    }

    const stufen = notenschluessel.map((stufe, index) => {
        const so = `notenschluessel[${index}]`;

        if (typeof stufe?.note !== 'number' && typeof stufe?.note !== 'string') {
            fehler.push(`${so}.note fehlt.`);
        }
        if (typeof stufe?.name !== 'string' || stufe.name.trim() === '') {
            fehler.push(`${so}.name fehlt.`);
        }
        if (typeof stufe?.abProzent !== 'number' || !Number.isFinite(stufe.abProzent)) {
            fehler.push(`${so}.abProzent muss eine Zahl sein.`);
        }

        return {
            note: stufe?.note,
            name: stufe?.name,
            abProzent: stufe?.abProzent,
            farbe: stufe?.farbe ?? null
        };
    });

    const sortiert = [...stufen].sort((a, b) => b.abProzent - a.abProzent);

    // Die unterste Stufe muss bei 0 greifen, sonst bleiben schwache
    // Ergebnisse ohne Note — was schlimmer wäre als gar keine Anzeige.
    if (sortiert.length > 0 && sortiert[sortiert.length - 1].abProzent > 0) {
        fehler.push('notenschluessel: Die unterste Stufe muss abProzent 0 haben, sonst bleiben niedrige Werte ohne Note.');
    }

    return sortiert;
}

/**
 * Prüft die Bewertungsskalen.
 *
 * Manche Aufgaben werden nicht in Prozent bewertet, sondern über
 * eine Moodle-Skala: Der Rohwert ist dann eine Stufennummer
 * ("1.00000" bis "4.00000"), kein Prozentwert. Ohne Umrechnung
 * erschiene Stufe 1 von 4 als "1 %" — also als Note 6 statt als
 * das, was sie ist.
 */
function pruefeSkalen(skalen, fehler) {
    if (skalen === undefined) return {};

    if (!skalen || typeof skalen !== 'object' || Array.isArray(skalen)) {
        fehler.push('skalen ist kein Objekt. Weglassen, wenn keine Skalen genutzt werden.');
        return {};
    }

    const geprueft = {};

    Object.entries(skalen).forEach(([name, skala]) => {
        const so = `skalen.${name}`;

        if (!Array.isArray(skala?.stufen) || skala.stufen.length === 0) {
            fehler.push(`${so}.stufen fehlt oder ist leer.`);
            return;
        }

        const stufen = skala.stufen.map((stufe, index) => {
            const to = `${so}.stufen[${index}]`;

            if (typeof stufe?.wert !== 'number' || !Number.isFinite(stufe.wert)) {
                fehler.push(`${to}.wert muss die Stufennummer aus Moodle sein (Zahl).`);
            }
            if (typeof stufe?.name !== 'string' || stufe.name.trim() === '') {
                fehler.push(`${to}.name fehlt.`);
            }
            if (typeof stufe?.prozent !== 'number' || !Number.isFinite(stufe.prozent)) {
                fehler.push(`${to}.prozent muss eine Zahl sein — darüber wird die Note ermittelt.`);
            }

            return { wert: stufe?.wert, name: stufe?.name, prozent: stufe?.prozent };
        });

        geprueft[name] = {
            name,
            titel: typeof skala.titel === 'string' ? skala.titel : name,
            stufen
        };
    });

    return geprueft;
}

/**
 * Prüft die Schienen mit ihren Schulwochenkalendern.
 *
 * Jede Schiene hat einen eigenen Kalender: Anzahl der Blockwochen und
 * Stunden je Woche unterscheiden sich zwischen den Schienen.
 */
function pruefeSchienen(schienen, fehler) {
    if (!schienen || typeof schienen !== 'object' || Array.isArray(schienen)) {
        fehler.push('schienen fehlt oder ist kein Objekt.');
        return {};
    }

    const namen = Object.keys(schienen);
    if (namen.length === 0) {
        fehler.push('schienen enthält keine Einträge.');
        return {};
    }

    const geprueft = {};

    namen.forEach(name => {
        const schiene = schienen[name];
        const so = `schienen.${name}`;

        if (!schiene || typeof schiene !== 'object') {
            fehler.push(`${so} ist kein Objekt.`);
            return;
        }

        const schulwochen = pruefeSchulwochen(schiene.schulwochen, so, fehler);
        const wochenstundenGesamt = schulwochen.reduce((summe, w) => summe + (w.stunden || 0), 0);

        if (schulwochen.length > 0 && wochenstundenGesamt <= 0) {
            fehler.push(`${so}: Die Summe der Wochenstunden ist 0 — Soll wäre nicht berechenbar.`);
        }

        geprueft[name] = {
            name,
            titel: typeof schiene.titel === 'string' && schiene.titel.trim() !== ''
                ? schiene.titel
                : name,
            schulwochen,
            wochenGesamt: schulwochen.length,
            wochenstundenGesamt
        };
    });

    return geprueft;
}

/**
 * Prüft einen Schulwochenkalender.
 */
function pruefeSchulwochen(schulwochen, pfad, fehler) {
    if (!Array.isArray(schulwochen) || schulwochen.length === 0) {
        fehler.push(`${pfad}.schulwochen fehlt oder ist leer.`);
        return [];
    }

    const gesehen = new Set();

    const geprueft = schulwochen.map((woche, index) => {
        const wo = `${pfad}.schulwochen[${index}]`;

        if (!Number.isInteger(woche?.woche) || woche.woche < 1) {
            fehler.push(`${wo}.woche muss eine ganze Zahl ab 1 sein.`);
        } else if (gesehen.has(woche.woche)) {
            fehler.push(`${wo}.woche ${woche.woche} kommt mehrfach vor.`);
        } else {
            gesehen.add(woche.woche);
        }

        if (!istDatum(woche?.start)) {
            fehler.push(`${wo}.start fehlt oder ist kein Datum im Format JJJJ-MM-TT.`);
        }
        if (woche?.ende !== undefined && !istDatum(woche.ende)) {
            fehler.push(`${wo}.ende ist kein Datum im Format JJJJ-MM-TT.`);
        }

        if (typeof woche?.stunden !== 'number' || !Number.isFinite(woche.stunden) || woche.stunden < 0) {
            fehler.push(`${wo}.stunden muss eine Zahl ab 0 sein.`);
        }

        return {
            woche: woche?.woche,
            start: woche?.start,
            ende: woche?.ende ?? null,
            stunden: woche?.stunden
        };
    });

    return geprueft.sort((a, b) => a.woche - b.woche);
}

/**
 * Prüft die Zuordnung Klasse → Schiene.
 * Jede genannte Schiene muss auch definiert sein.
 */
function pruefeKlassenzuordnung(zuordnung, schienen, fehler) {
    if (!zuordnung || typeof zuordnung !== 'object' || Array.isArray(zuordnung)) {
        fehler.push('klassenZuSchiene fehlt oder ist kein Objekt.');
        return {};
    }

    Object.entries(zuordnung).forEach(([klasse, schiene]) => {
        if (typeof schiene !== 'string' || !(schiene in schienen)) {
            fehler.push(
                `klassenZuSchiene.${klasse} verweist auf "${schiene}", ` +
                `was unter schienen nicht definiert ist.`
            );
        }
    });

    return { ...zuordnung };
}

/**
 * Prüft die Kurse samt Aufgaben. cmid muss über alle Kurse hinweg
 * eindeutig sein, da sie der Schlüssel zur Moodle-Zeile ist.
 */
function pruefeKurse(kurse, skalen, fehler) {
    if (!Array.isArray(kurse) || kurse.length === 0) {
        fehler.push('kurse fehlt oder ist leer.');
        return [];
    }

    const cmidGesehen = new Map();

    return kurse.map((kurs, kursIndex) => {
        const ko = `kurse[${kursIndex}]`;

        if (typeof kurs?.id !== 'string' || kurs.id.trim() === '') {
            fehler.push(`${ko}.id fehlt.`);
        }
        if (typeof kurs?.moodleCourseId !== 'string' || !/^\d+$/.test(kurs.moodleCourseId)) {
            fehler.push(`${ko}.moodleCourseId fehlt oder ist keine Zahlenkette.`);
        }
        if (typeof kurs?.titel !== 'string' || kurs.titel.trim() === '') {
            fehler.push(`${ko}.titel fehlt.`);
        }
        if (typeof kurs?.gesperrt !== 'boolean') {
            fehler.push(`${ko}.gesperrt muss true oder false sein.`);
        }
        // anzeigen darf fehlen — Pläne ohne das Feld zeigen wie bisher
        // alle Kurse. Nur ein falscher Typ ist ein Fehler.
        if (kurs?.anzeigen !== undefined && typeof kurs.anzeigen !== 'boolean') {
            fehler.push(`${ko}.anzeigen muss true oder false sein, wenn angegeben.`);
        }

        const aufgaben = Array.isArray(kurs?.aufgaben) ? kurs.aufgaben : [];
        if (!Array.isArray(kurs?.aufgaben)) {
            fehler.push(`${ko}.aufgaben fehlt oder ist keine Liste.`);
        }

        const geprüfteAufgaben = aufgaben.map((aufgabe, aufgabenIndex) => {
            const ao = `${ko}.aufgaben[${aufgabenIndex}]`;

            if (typeof aufgabe?.cmid !== 'string' || !/^\d+$/.test(aufgabe.cmid)) {
                fehler.push(`${ao}.cmid fehlt oder ist keine Zahlenkette.`);
            } else if (cmidGesehen.has(aufgabe.cmid)) {
                fehler.push(
                    `${ao}.cmid ${aufgabe.cmid} kommt mehrfach vor ` +
                    `(bereits in ${cmidGesehen.get(aufgabe.cmid)}).`
                );
            } else {
                cmidGesehen.set(aufgabe.cmid, ao);
            }

            if (!AUFGABEN_TYPEN.includes(aufgabe?.typ)) {
                fehler.push(`${ao}.typ muss "assign" oder "quiz" sein.`);
            }
            if (typeof aufgabe?.titel !== 'string' || aufgabe.titel.trim() === '') {
                fehler.push(`${ao}.titel fehlt.`);
            }
            if (typeof aufgabe?.stunden !== 'number' || !Number.isFinite(aufgabe.stunden) || aufgabe.stunden <= 0) {
                fehler.push(`${ao}.stunden muss eine Dezimalzahl größer 0 sein.`);
            }

            if (aufgabe?.skala !== undefined && !(aufgabe.skala in skalen)) {
                fehler.push(
                    `${ao}.skala verweist auf "${aufgabe.skala}", ` +
                    `was unter skalen nicht definiert ist.`
                );
            }

            const lektion = teileLektion(aufgabe?.lektion);

            return {
                cmid: aufgabe?.cmid,
                typ: aufgabe?.typ,
                titel: aufgabe?.titel,
                skala: aufgabe?.skala ? skalen[aufgabe.skala] ?? null : null,
                lektion: aufgabe?.lektion ?? null,
                abschnitt: lektion.abschnitt,
                lerneinheit: lektion.lerneinheit,
                stunden: aufgabe?.stunden,
                kursId: kurs?.id,
                kursTitel: kurs?.titel,
                kursGesperrt: kurs?.gesperrt === true
            };
        });

        return {
            id: kurs?.id,
            moodleCourseId: kurs?.moodleCourseId,
            titel: kurs?.titel,
            gesperrt: kurs?.gesperrt === true,
            anzeigen: kurs?.anzeigen !== false,
            freischaltung: kurs?.freischaltung ?? null,
            aufgaben: geprüfteAufgaben,
            stundenGeplant: geprüfteAufgaben.reduce(
                (summe, aufgabe) => summe + (aufgabe.stunden || 0), 0
            )
        };
    });
}

function istDatum(wert) {
    return typeof wert === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(wert);
}

/**
 * Teilt eine Lektionsangabe in Abschnitt und Lerneinheit.
 *
 * Moodle schreibt sie als "Abschnitt- Lerneinheit", etwa
 * "OOP- Sprint 1 Klassen & Objekte". Getrennt wird am ersten
 * Bindestrich, dem ein Leerzeichen folgt — sonst zerfiele
 * "HTML/CSS- Frontend Grundlagen" falsch, und Bindestriche
 * innerhalb der Lerneinheit ("Sprint 4 SOLID - Refactoring")
 * blieben erhalten.
 *
 * Ohne erkennbare Trennung gilt alles als Lerneinheit; der
 * Abschnitt bleibt leer, statt geraten zu werden.
 *
 * @param {string|null|undefined} lektion
 * @returns {{abschnitt: string|null, lerneinheit: string|null}}
 */
export function teileLektion(lektion) {
    if (typeof lektion !== 'string' || lektion.trim() === '') {
        return { abschnitt: null, lerneinheit: null };
    }

    const text = lektion.trim();
    const treffer = text.match(/^(.+?)-\s+(.+)$/);

    return treffer
        ? { abschnitt: treffer[1].trim(), lerneinheit: treffer[2].trim() }
        : { abschnitt: null, lerneinheit: text };
}
