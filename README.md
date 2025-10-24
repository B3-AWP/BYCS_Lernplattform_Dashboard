# BYCS Lernplattform Dashboard

Ein interaktives Dashboard zur Visualisierung und Analyse von Lernfortschritten auf der Mebis-Lernplattform für BYCS (Bayerisches Zentrum für Cyber Security) Kurse.

## 🚀 Features

### 📊 **Fortschritts-Tracking**
- **Checklisten-Analyse**: Detaillierte Übersicht über alle Kurs-Checklisten
- **Pflichtabgaben-Tracking**: Vollständige Überwachung von Assignments und Quizzes
- **IHK-Notensystem**: Automatische Berechnung von IHK-Noten basierend auf Leistungen
- **Referenzwochen-System**: Fortschrittsbewertung bezogen auf Kurswochen

### 🎨 **Visuelle Darstellung**
- **Interaktive Charts**: Ein-/ausklappbare Diagramme mit IHK-Farben (rot bis grün)
- **Progress Bars**: Farbcodierte Fortschrittsbalken mit Hintergrund-Visualisierung
- **Konfetti Easter Egg**: Verstecktes Konfetti-Feature für exzellente Leistungen (Note 1-2)
- **Echtzeit-Statistiken**: Live-Updates der Completion-Rates
- **Responsive Design**: Optimiert für Desktop und mobile Geräte
- **Moderne UI**: Intuitive Benutzeroberfläche mit sanften Animationen

### ⚡ **Intelligente Funktionen**
- **Schienen-Erkennung**: Automatische Identifikation der Block-Schiene auf Basis der angezeigten Mebis-Tabs
- **Smart Loading**: Detaillierte Fortschrittsmeldungen beim Laden
- **Filteroptionen**: Flexible Datenfilterung nach verschiedenen Kriterien
- **Export-Funktionen**: Datenexport für weitere Analysen

### 🛡️ **Sicherheit & Performance**
- **Same-Origin-Policy**: Sichere Datenübertragung
- **Smart Caching**: Optimierte localStorage-basierte Zwischenspeicherung mit 60-70% reduziertem Speicherbedarf
- **Server-freundlich**: Batch-Loading mit konfigurierbaren Timeouts und Parallelitätslimits
- **Background Updates**: Intelligente Cache-Aktualisierung im Hintergrund
- **Fehlerbehandlung**: Robuste Fehlerbehandlung und Recovery mit Retry-Logik

## 📋 **Voraussetzungen**

- **Webbrowser**: Moderner Browser (Chrome, Firefox, Safari, Edge)
- **Mebis-Zugang**: Gültiger Zugang zur BYCS Lernplattform
- **JavaScript**: Aktiviert für volle Funktionalität
- **Cookies**: Für Session-Management erforderlich

## 🚀 **Installation & Setup**

### **Schnellstart:**

1. **Repository klonen:**
   ```bash
   git clone https://github.com/your-username/BYCS_Lernplattform_Dashboard.git
   cd BYCS_Lernplattform_Dashboard
   ```

2. **Kurs-ID konfigurieren:**
   - Öffnen Sie `config.js`
   - Setzen Sie die `courseId` im `system` Bereich auf Ihre Mebis-Kurs-ID

3. **Aktivität "Datei" in Mebiskurs erstellen**. 
   - Dateien in Kurs ziehen
   - Hauptdatei index.html setzen

## 🎛️ **Verwendung**

### **Hauptfunktionen:**

#### **📊 Fortschritts-Charts**
- Klicken Sie auf Chart-Header zum Ein-/Ausklappen
- Farbcodierung nach IHK-Notensystem:
  - 🔴 **Rot**: Note 6 (≤29%) - Ungenügend
  - 🟠 **Orange**: Note 5 (30-49%) - Mangelhaft
  - 🟡 **Gelb**: Note 4 (50-66%) - Ausreichend
  - 🟢 **Hellgrün**: Note 3 (67-80%) - Befriedigend
  - ✅ **Grün**: Note 2 (81-91%) - Gut
  - 🌟 **Dunkelgrün**: Note 1 (>91%) - Sehr gut

#### **🔄 Daten-Refresh**
- **Auto-Update**: Automatische Aktualisierung beim Laden mit Smart Caching
- **Manual Refresh**: Refresh-Button für manuelle Updates (bypassed Cache)
- **Background Updates**: Cache-Aktualisierung im Hintergrund für bessere UX
- **Smart Loading**: Detaillierte Fortschrittsmeldungen mit Server-Status

#### **📈 Referenzwochen-System**
- **Wochenbasiert**: Fortschritt basierend auf aktueller Kurswoche
- **Adaptive Berechnung**: Berücksichtigt verschiedene Bildungsschienen
- **Progress-Indikator**: Visuelle Darstellung des erwarteten vs. tatsächlichen Fortschritts

## 🛠️ **Technische Details**

### **Architektur:**
```
├── index.html         # Haupt-HTML-Struktur
├── script.js          # JavaScript-Logik und API-Calls
├── config.js          # Externe Konfigurationsdatei
├── style.css          # CSS-Styling und Animationen
├── debug-test.html    # Test-Seite für Progress Bars
└── README.md          # Dokumentation
```

### **Technologie-Stack:**
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Charts**: Chart.js für interaktive Diagramme
- **Icons**: Inline SVG-Symbole
- **Responsive**: CSS Grid und Flexbox
- **Animationen**: CSS Transitions und Keyframes

## 🤝 **Contributing**

Beiträge sind willkommen! Bitte beachten Sie:

1. **Fork** das Repository
2. **Feature Branch** erstellen: `git checkout -b feature/AmazingFeature`
3. **Commit** Ihre Änderungen: `git commit -m 'Add AmazingFeature'`
4. **Push** zum Branch: `git push origin feature/AmazingFeature`
5. **Pull Request** öffnen

## 📄 **Lizenz**

Dieses Projekt steht unter der MIT-Lizenz - siehe [LICENSE](LICENSE) für Details.


## 🆘 **Support**

Bei Fragen oder Problemen:

- **Issues**: [GitHub Issues]( https://github.com/B3-AWP/BYCS_Lernplattform_Dashboard/issues)

## 🔮 **Roadmap**

### **Kommende Features:**

### **Aktuelle Verbesserungen (v1.1):**
- [x] **Cache-Optimierung**: 60-70% reduzierter localStorage-Verbrauch
- [x] **Progress Bars**: Visuelle Fortschrittsbalken in Tabellen
- [x] **Konfetti Easter Egg**: Verstecktes Feature für exzellente Leistungen
- [x] **Server-Performance**: Batch-Loading und Timeout-Optimierungen
- [x] **Background Updates**: Smart Cache-Updates ohne UI-Blockierung

### **Geplante Verbesserungen:**
- [ ] **Performance**: Weitere Ladezeit-Optimierungen
- [ ] **Accessibility**: WCAG 2.1 Compliance
- [ ] **Mobile UX**: Verbesserte Touch-Bedienung


> **Hinweis**: Dies ist eine Beta-Version. Alle Angaben erfolgen ohne Gewähr. 
> Bei produktiver Nutzung sollten die Daten zusätzlich verifiziert werden.