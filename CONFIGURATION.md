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