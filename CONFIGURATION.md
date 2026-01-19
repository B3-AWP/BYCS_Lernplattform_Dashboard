# Konfigurationsverwaltung - Dashboard

Dieses Dokument erklärt das zentrale Konfigurationssystem für Texte, Werte und Notenskalen im BYCS Lernplattform Dashboard.

## 🎯 Überblick

Das Dashboard verwendet ein zentralisiertes Konfigurationssystem, das alle Texte, Grenzwerte und UI-Elemente an einem Ort verwaltet. Dies ermöglicht schnelle Anpassungen ohne Durchsuchung des gesamten Codes.

## 📁 Konfigurationsoptionen

### Option 1: Integrierte Konfiguration (Standard)
Die Konfiguration ist direkt in `script.js` als `CONFIG`-Konstante integriert.

**Vorteile:**
- ✅ Keine zusätzlichen Dateien
- ✅ Bereits implementiert und aktiv

**Nachteile:**
- ❌ Erfordert Öffnen von script.js für Änderungen

### Option 2: Externe Konfiguration
Separate `config.js` Datei für reine Konfiguration.

**Vorteile:**
- ✅ Noch einfachere Wartung
- ✅ Reine Konfigurationsdatei
- ✅ Bessere Versionskontrolle

**Nachteile:**
- ❌ Zusätzliche Datei im Projekt

## 🔧 Konfigurationsbereiche

### IHK-Notensystem (`CONFIG.grades`)
```javascript
grades: {
    1: { name: 'sehr gut', threshold: 91, color: '#1e7e34' },
    2: { name: 'gut', threshold: 81, color: '#28a745' },
    3: { name: 'befriedigend', threshold: 67, color: '#7cb342' },
    4: { name: 'ausreichend', threshold: 50, color: '#ffc107' },
    5: { name: 'mangelhaft', threshold: 30, color: '#fd7e14' },
    6: { name: 'ungenügend', threshold: 0, color: '#dc3545' }
}
```

**Anpassung der Schwellenwerte:**
- `threshold`: Mindestprozentsatz für diese Note
- `color`: Hex-Farbe für Chart-Darstellung
- `name`: Bezeichnung der Note

### Loading-Texte (`CONFIG.loading`)
```javascript
loading: {
    main: 'Lade Dashboard...',
    sub: 'Initialisiere System...',
    steps: {
        1: { initial: '○ System initialisiert', completed: '✓ System initialisiert' },
        2: { initial: '○ Schiene wird erkannt...', completed: '✓ Schiene erkannt' },
        3: { initial: '○ Checklisten werden geladen...', completed: '✓ Checklisten geladen' },
        4: { initial: '○ Pflichtabgaben werden geladen...', completed: '✓ Pflichtabgaben geladen' }
    },
    progress: {
        detectTrack: 'Erkenne Schiene...',
        loadChecklists: 'Lade Checklisten...',
        loadPflicht: 'Lade Pflichtabgaben...',
        loadPflichtSub: 'Analysiere Aufgaben und Quizzes...'
    }
}
```

**Hinweis:** "Pflichtabgaben" bezeichnet sowohl Assignments als auch Quizzes, die als verpflichtend markiert sind.

### UI-Texte (`CONFIG.ui`)
```javascript
ui: {
    toggleChart: {
        show: 'Diagramm anzeigen',
        hide: 'Diagramm ausblenden'
    },
    // ...
}
```

### Debug-Meldungen (`CONFIG.debug`)
Konsolen-Ausgaben für Entwicklung und Fehlersuche.

### Konfetti-System (`CONFIG.confetti`)
Farben und Meldungen für das Erfolgs-Konfetti.

### Hilfetexte (`CONFIG.helpTexts`)
Konfigurierbare Hilfetexte für Tooltips, die bei Mouseover über das Info-Icon (?) angezeigt werden.

**Kategorien:**
- `checklisten`: Hilfetexte für die Checklisten-Übersicht
- `pflichtabgaben`: Hilfetexte für die Pflichtabgaben-Übersicht
- `mitarbeitsnote1`: Hilfetexte für die 1. Mitarbeitsnote Komponenten
- `prognose`: Hilfetexte für die Prognose der 2. Mitarbeitsnote

**Formatierung:**
- HTML-Tags wie `<br>` werden unterstützt für Zeilenumbrüche
- Texte sollten die Berechnung erklären und Handlungsempfehlungen geben

**Beispiel-Struktur:**
```javascript
helpTexts: {
    checklisten: {
        'abgeschlossen': 'Zeigt, wie viele deiner Pflicht-Checklisten zu 100% abgehakt sind.',
        'durchschnitt': 'Der prozentuale Durchschnitt aller Checklistenpunkte. Jede Checkliste zählt als 100 Punkte. <br> Handlungsempfehlung: Alle Pflicht-Checkboxen zeitnah abhaken.',
        'ihkNote': 'Deine Note nach IHK-Notenschlüssel basierend auf dem Pflicht-Durchschnitt.'
    },
    pflichtabgaben: {
        'abgeschlossen': 'Anzahl abgegebener/bewerteter Pflichtabgaben.',
        'durchschnittsnote': 'Durchschnittsnote aller bewerteten Pflichtabgaben.'
    },
    mitarbeitsnote1: {
        'Quantität': 'Prozentuale Erfüllung der Pflicht-Checklisten.',
        'Qualität': 'Durchschnitt aller bewerteten Pflichtabgaben.',
        'Review-Talk': 'Bewertung deines ersten Review-Talks.',
        'gesamt': 'Durchschnitt aller Komponenten mit Bewertung.'
    },
    prognose: {
        'Quantität': 'Punkte zwischen 1. und 2. Mitarbeitsnote.',
        'Qualität': 'Durchschnitt der Pflichtabgaben seit 1. MA.',
        'Review-Talk 2': 'Bewertung des zweiten Review-Talks.',
        'Code Review': 'Bewertung des Code Reviews.',
        'gesamt': 'Durchschnitt aller bewerteten Komponenten.'
    }
}
```

**Inhaltliche Empfehlungen für Hilfetexte:**
1. **Erklärung**: Was zeigt der Wert an?
2. **Berechnung**: Wie wird er berechnet?
3. **Handlungsempfehlung**: Wie kann der Schüler den Wert verbessern?
4. **Kontext**: Bezug zur Referenzwoche oder anderen Faktoren

### Referenztermin für Mitarbeitsnoten (`CONFIG.ReferenzterminMitarbeitsnote1`)
Datum, nach dem Bewertungen für die 2. Mitarbeitsnote gezählt werden.

```javascript
ReferenzterminMitarbeitsnote1: {
    "Schiene1": "2025-12-10",
    "Schiene3": "2026-01-08"
}
```

### Prognose-Assignments (`CONFIG.prognosisAssignments`)
Assignment-IDs für spezielle Komponenten der 2. Mitarbeitsnote.

```javascript
prognosisAssignments: {
    reviewTalk2: 83500375,   // Review-Talk 2 Assignment ID
    codeReview: 80560819     // Code Review Assignment ID
}
```

## 🚀 Schnelle Anpassungen

### IHK-Notenschwellen ändern
```javascript
// Beispiel: Note 2 ab 85% statt 81%
2: { name: 'gut', threshold: 85, color: '#28a745' }
```

### Loading-Texte anpassen
```javascript
loading: {
    main: 'Dashboard wird geladen...',
    sub: 'Bitte warten...'
}
```

### Chartfarben ändern
```javascript
// Beispiel: Helleres Grün für Note 3
3: { name: 'befriedigend', threshold: 67, color: '#90C695' }
```

### Hilfetexte anpassen
```javascript
// Beispiel: Hilfetext für Quantität in der Prognose ändern
helpTexts: {
    prognose: {
        'Quantität': 'Hier steht dein angepasster Hilfetext für die Quantität der 2. Mitarbeitsnote.'
    }
}
```

### Referenztermin für Mitarbeitsnote anpassen
```javascript
// Beispiel: Neues Referenzdatum für Schiene 1
ReferenzterminMitarbeitsnote1: {
    "Schiene1": "2026-01-15"  // Bewertungen nach diesem Datum zählen für 2. MA
}
```

## 🔄 Migration zur externen Konfiguration

Falls gewünscht, kann zur externen `config.js` gewechselt werden:

1. **HTML erweitern:**
   ```html
   <script src="config.js"></script>
   <script src="script.js"></script>
   ```

2. **Script.js anpassen:**
   ```javascript
   // Ersetze CONFIG durch EXTERNAL_CONFIG
   const configSource = typeof EXTERNAL_CONFIG !== 'undefined' ? EXTERNAL_CONFIG : CONFIG;
   ```

## 📝 Best Practices

1. **Konsistenz:** Verwende einheitliche Terminologie
2. **Zugänglichkeit:** Achte auf ausreichende Farbkontraste
3. **Klarheit:** Halte Texte kurz und verständlich
4. **Backup:** Sichere Konfiguration vor größeren Änderungen

## 🛠️ Hilfsfunktionen

Das System stellt folgende Hilfsfunktionen bereit:

- `getGradeByPercentage(percentage)`: Ermittelt Note basierend auf Prozentsatz
- `getGradeNumber(percentage)`: Gibt Notennummer zurück
- `getIHKGradeColor(percentage)`: Liefert entsprechende Farbe
- `initializeLoadingTexts()`: Initialisiert UI-Texte beim Laden

## 💡 Beispiele

### Neue Note hinzufügen
```javascript
// Note 0 für außergewöhnliche Leistung
0: { name: 'exzellent', threshold: 95, color: '#006400' }
```

### Schulspezifische Anpassung
```javascript
loading: {
    main: 'Lade BYCS Dashboard...',
    progress: {
        detectTrack: 'Erkenne Bildungsschiene...',
        loadPflicht: 'Lade verpflichtende Abgaben...'
    }
}
```

### Corporate Design anpassen
```javascript
grades: {
    1: { color: '#1a5490' }, // Firmenblau
    2: { color: '#2d7dd2' }  // Helleres Firmenblau
}
```

---

**💡 Tipp:** Für regelmäßige Anpassungen empfiehlt sich die externe Konfiguration. Für einmalige Setups reicht die integrierte Lösung.