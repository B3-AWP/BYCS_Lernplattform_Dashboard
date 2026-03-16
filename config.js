// ================================
// EXTERNE KONFIGURATIONSDATEI
// ================================
//
// Diese Datei kann als Alternative zur integrierten CONFIG-Konstante verwendet werden.
// Um diese zu verwenden:
// 1. Füge <script src="config.js"></script> vor script.js in index.html hinzu
// 2. Ersetze CONFIG durch EXTERNAL_CONFIG im script.js
//
// Vorteile der externen Konfiguration:
// - Noch einfachere Wartung ohne Code-Durchsuchung
// - Schnelle Anpassungen ohne script.js zu öffnen
// - Bessere Versionskontrolle für reine Konfigurationsänderungen
//

const EXTERNAL_CONFIG = {
    // IHK-Notensystem - Schwellenwerte und Farben
    grades: {
        1: { name: 'sehr gut', threshold: 91, color: '#1e7e34', description: 'Dunkelgrün - Note 1 (sehr gut)' },
        2: { name: 'gut', threshold: 80, color: '#28a745', description: 'Grün - Note 2 (gut)' },
        3: { name: 'befriedigend', threshold: 66, color: '#7cb342', description: 'Hellgrün - Note 3 (befriedigend)' },
        4: { name: 'ausreichend', threshold: 49, color: '#ffc107', description: 'Gelb - Note 4 (ausreichend)' },
        5: { name: 'mangelhaft', threshold: 29, color: '#fd7e14', description: 'Orange - Note 5 (mangelhaft)' },
        6: { name: 'ungenügend', threshold: 0, color: '#dc3545', description: 'Rot - Note 6 (ungenügend)' }
    },

    // Loading-Texte und Fortschrittsmeldungen
    loading: {
        main: 'Lade Dashboard...',
        sub: 'Initialisiere System...',
        steps: {
            1: { initial: '○ System initialisiert', completed: '✓ System initialisiert' },
            2: { initial: '○ Schiene wird erkannt...', completed: '✓ Schiene erkannt' },
            3: { initial: '○ Pflichtabgaben werden geladen...', completed: '✓ Pflichtabgaben geladen' }
        },
        progress: {
            detectTrack: 'Erkenne Schiene...',
            detectTrackSub: 'Analysiere Mebis-Kurs...',
            loadChecklists: 'Lade Checklisten...',
            loadChecklistsSub: 'Verbinde mit Mebis-Server...',
            loadPflicht: 'Lade Pflichtabgaben...',
            loadPflichtSub: 'Analysiere Aufgaben und Quizzes...',
            serverSlow: '⚠️ Mebis-Server langsam - lade mit verfügbaren Daten fort',
            serverTimeout: '🔄 Einige Checklisten übersprungen (Server-Timeouts)'
        }
    },

    // UI-Texte für Benutzeroberfläche
    ui: {
        toggleChart: {
            show: 'Diagramm anzeigen',
            hide: 'Diagramm ausblenden'
        },
        trackDetection: {
            noRelevantClass: 'Keine relevante Klasse in Mebis-Kurs-Tabs gefunden',
            buttonsEnabled: 'Track buttons enabled - user can select Schiene manually',
            buttonsDisabled: 'Track buttons disabled - no Schiene could be determined',
            selectionHidden: 'Track selection hidden - automatic detection successful',
            selectionShown: 'Track selection shown - manual selection required'
        },
        standardMode: '✓ Standard-Modus aktiviert'
    },

    // Debug- und Konsolen-Ausgaben
    debug: {
        startingExtraction: 'Starting checklist extraction...',
        allLinksFound: 'All view.php links found:',
        firstFewLinks: 'First few links:',
        allPromisesResolved: 'All checklist promises resolved:',
        creatingCharts: 'Creating charts with valid data:'
    },

    // Konfetti-System
    confetti: {
        colors: {
            gold: '#FFD700',
            silver: '#C0C0C0'
        },
        messages: {
            grade1: 'Goldenes Konfetti für Note 1',
            grade2: 'Silbernes Konfetti für Note 2'
        }
    },

    // System-Konfiguration - Server-freundliche Einstellungen
    system: {
        courseId: '2036416',
        concurrentLimit: 8,      // Moderate Parallelität (Server-schonend)
        timeoutMs: 6000,         // 6 seconds timeout (mehr Zeit für Server)
        retryTimeoutMs: 10000,   // 10 seconds on retry (noch mehr Zeit)
        cacheExpiryMs: 300000,   // 5 minutes cache (300000ms)
        batchDelay: 500          // 500ms Pause zwischen Batches
    },

    // Mebis URLs
    urls: {
        courseIndex: 'https://lernplattform.bycs.de/course/view.php?id=2036416',
        ajaxService: 'https://lernplattform.bycs.de/lib/ajax/service.php'
    },

    // Schienen-basierte Schulwochen-Konfiguration
    trackSchedules: {
        "Schiene1": [
            { week: 1, start: "2025-09-15", end: "2025-09-19" },
            { week: 2, start: "2025-09-22", end: "2025-09-26" },
            { week: 3, start: "2025-10-20", end: "2025-10-24" },
            { week: 4, start: "2025-10-27", end: "2025-10-31" },
            { week: 5, start: "2025-12-08", end: "2025-12-12" },
            { week: 6, start: "2026-02-23", end: "2026-02-27" },
            { week: 7, start: "2026-03-02", end: "2026-03-06" },
            { week: 8, start: "2026-04-13", end: "2026-04-17" },
            { week: 9, start: "2026-04-20", end: "2026-04-24" }
        ],
        "Schiene3": [
            { week: 1, start: "2025-10-06", end: "2025-10-10" },
            { week: 2, start: "2025-10-13", end: "2025-10-17" },
            { week: 3, start: "2025-11-24", end: "2025-11-28" },
            { week: 4, start: "2025-12-01", end: "2025-12-05" },
            { week: 5, start: "2026-01-07", end: "2026-01-09" },
            { week: 6, start: "2026-01-12", end: "2026-01-16" },
            { week: 7, start: "2026-03-09", end: "2026-03-13" },
            { week: 8, start: "2026-03-16", end: "2026-03-20" },
            { week: 9, start: "2026-03-23", end: "2026-03-27" }
        ]
    },

    // Klassen-zu-Schiene Zuordnung
    classToTrack: {
        "IFA12A": "Schiene1",
        "IFA12C": "Schiene1",
        "IFA12E": "Schiene1",
        "IFA12B": "Schiene3",
        "IFA12D": "Schiene3"
    },

    // Filter für "Alle Aufgaben-Übersicht"
    // Aufgaben, die einen dieser Strings im Namen enthalten, werden NICHT angezeigt
    excludeFromOverview: [
        "(Leistungsnachweis)"
        // "Review-Talk"
        // "Code-Review"
    ],

    // Assignment Categories für Notenfilterung
    assignmentCategories: {
        Mitarbeitsnote_1: 'cat_2490454'  // CSS-Klasse für Mitarbeitsnote im Grade Report
    },

    // Referenzwoche für 1. Mitarbeitsnote
    mitarbeitsnote1ReferenceWeek: 4,  // Woche, in der die 1. Mitarbeitsnote vergeben wurde

    // Referenztermin für 2. Mitarbeitsnote (Bewertungen müssen NACH diesem Datum sein)
    ReferenzterminMitarbeitsnote1: {
        "Schiene1": "2025-12-10",  // Referenztermin für Schiene 1
        "Schiene3": "2026-01-08"   // Referenztermin für Schiene 3
    },

    // Assign-IDs für Prognose-Komponenten
    prognosisAssignments: {
        reviewTalk2: 83500375,   // Review-Talk 2 Assignment ID
        codeReview: 80560819     // Code Review Assignment ID
    },

    // Hilfetexte für alle Bereiche
    helpTexts: {
        // Checklisten Übersicht
        checklisten: {
            'abgeschlossen': 'Zeigt, wie viele deiner Pflicht-Checklisten zu 100% abgehakt sind. Die Zahl rechts (von X) zeigt die Gesamtanzahl der Pflicht-Checklisten, die bis zur aktuellen Referenzwoche erwartet werden.',
            'durchschnitt': 'Der prozentuale Durchschnitt aller Checklistenpunkte.<br>Jede Checkliste zählt als 100 Punkte - hast du alle Pflicht-Checkboxen einer Liste abgehakt, erhältst du 100%. Der angezeigte Wert ist der Durchschnitt über alle Checklisten. "Pflicht" zeigt nur die Pflicht-Checkboxen, "Gesamt" alle Checkboxen inklusive optionaler. <br>Um möglichst viele Punkte zu erreichen, erledigte alle Pflicht-Checkboxen in jeder Checkliste zeitnah. Die Punkte in Klammern zeigen erreichte/mögliche Punkte bezogen auf die aktuelle Referenzwoche.',
            'ihkNote': 'Deine Note nach IHK-Notenschlüssel basierend auf dem Pflicht-Checklisten-Durchschnitt. Die Prozentangabe zeigt den genauen Wert, die Tendenz (+/-) zeigt, ob du näher an der besseren oder schlechteren Note bist.'
        },
        // Pflichtabgaben Übersicht
        pflichtabgaben: {
            'abgeschlossen': 'Zeigt, wie viele Pflichtabgaben du bereits abgegeben oder bewertet bekommen hast. Die Zahl rechts (von X) zeigt die erwartete Anzahl bis zur aktuellen Referenzwoche.',
            'durchschnittsnote': 'Deine Durchschnittsnote aller bewerteten Pflichtabgaben nach IHK-Notenschlüssel. Die Prozentangabe zeigt den genauen Durchschnittswert.'
        },
        // 1. Mitarbeitsnote
        mitarbeitsnote1: {
            'Quantität': 'Prozentuale Erfüllung der Pflicht-Checklisten bis zur Referenzwoche der 1. Mitarbeitsnote. Die Punkte in Klammern zeigen erreichte/mögliche Punkte.',
            'Qualität': 'Durchschnitt aller bis zur 1. Mitarbeitsnote bewerteten Pflichtabgaben.',
            'Review-Talk': 'Bewertung deines ersten Review-Talks.',
            'gesamt': 'Durchschnitt aller Komponenten (Quantität, Qualität, Review-Talk, ggf. Code Reviews), die eine Bewertung haben. Komponenten ohne Bewertung werden nicht eingerechnet.'
        },
        // Prognose 2. Mitarbeitsnote
        prognose: {
            'Quantität': 'Die erreichten Punkte zeigen deine Leistung zwischen der 1. und 2. Bewertung. Berechnung: Von deinen aktuell erreichten Punkten werden die Punkte der 1. Mitarbeitsnote abgezogen. Falls du dort über 100% erreicht hast, werden diese Bonuspunkte wieder hinzugefügt. Das Ergebnis wird durch die maximal möglichen Punkte im aktuellen Zeitraum geteilt.',
            'Qualität': 'Durchschnitt aller bewerteten Pflichtabgaben seit der 1. Mitarbeitsnote.',
            'Review-Talk 2': 'Bewertung deines zweiten Review-Talks (falls bereits bewertet und nach der 1. Mitarbeitsnote).',
            'Code Review': 'Bewertung deines Code Reviews (falls bereits bewertet und nach der 1. Mitarbeitsnote).',
            'gesamt': 'Durchschnitt aller Komponenten (Quantität, Qualität, Review-Talk 2, Code Review), die eine Bewertung haben. Komponenten ohne Bewertung werden nicht eingerechnet.'
        }
    }
};

// Globale Verfügbarkeit sicherstellen
if (typeof window !== 'undefined') {
    window.EXTERNAL_CONFIG = EXTERNAL_CONFIG;
}