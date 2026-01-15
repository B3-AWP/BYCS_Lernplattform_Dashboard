// ================================
// EXTERNE KONFIGURATION
// ================================
// Die Konfiguration wird aus config.js geladen (EXTERNAL_CONFIG)

// Hilfsfunktionen für Konfiguration
function getGradeByPercentage(percentage) {
    const grades = Object.values(EXTERNAL_CONFIG.grades).sort((a, b) => b.threshold - a.threshold);
    return grades.find(grade => percentage >= grade.threshold) || EXTERNAL_CONFIG.grades[6];
}

function getGradeNumber(percentage) {
    for (let [gradeNum, gradeInfo] of Object.entries(EXTERNAL_CONFIG.grades)) {
        if (percentage >= gradeInfo.threshold) {
            return parseInt(gradeNum);
        }
    }
    return 6; // Fallback: ungenügend
}

// Initialisiere UI-Texte aus Konfiguration
function initializeLoadingTexts() {
    // Setze Loading-Overlay Texte
    const mainText = document.getElementById('loadingMainText');
    const subText = document.getElementById('loadingSubText');
    if (mainText) mainText.textContent = EXTERNAL_CONFIG.loading.main;
    if (subText) subText.textContent = EXTERNAL_CONFIG.loading.sub;

    // Setze Progress Steps Texte
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');

    if (step1) step1.textContent = EXTERNAL_CONFIG.loading.steps[1].initial;
    if (step2) step2.textContent = EXTERNAL_CONFIG.loading.steps[2].initial;
    if (step3) step3.textContent = EXTERNAL_CONFIG.loading.steps[3].initial;
    if (step4) step4.textContent = EXTERNAL_CONFIG.loading.steps[4].initial;
}

// ================================
// GLOBALE VARIABLEN
// ================================

// Globale Variablen
let overviewGesamtChart, detailPflichtChart, detailGesamtChart, trendChart, rankingChart;
let checklistData = [];
let historicalData = [];

// Referenzwochen-System - wird dynamisch berechnet
let TOTAL_WEEKS = 9; // Default, wird später aktualisiert
let currentReferenceWeek = 9; // Standard: Letzte Woche (100% der Zeit)

// ================================
// VERBINDUNGSFEHLER-TRACKING
// ================================
let connectionErrors = {
    count: 0,
    threshold: 5, // Ab dieser Anzahl gilt die Verbindung als instabil
    hasShownWarning: false,
    criticalDataAffected: false
};

/**
 * Registriert einen Verbindungsfehler und zeigt ggf. eine Warnung an
 * @param {string} context - Beschreibung, wo der Fehler aufgetreten ist
 * @param {boolean} isCritical - Ob der Fehler kritische Daten betrifft (z.B. Pflichtabgaben)
 */
function trackConnectionError(context, isCritical = false) {
    connectionErrors.count++;
    if (isCritical) {
        connectionErrors.criticalDataAffected = true;
    }

    console.warn(`⚠️ Verbindungsfehler #${connectionErrors.count}: ${context}`);

    // Zeige Warnung wenn Schwellenwert überschritten und noch nicht gezeigt
    if (connectionErrors.count >= connectionErrors.threshold && !connectionErrors.hasShownWarning) {
        showConnectionWarning();
    }
}

/**
 * Zeigt eine Warnung bei Verbindungsproblemen an
 */
function showConnectionWarning() {
    connectionErrors.hasShownWarning = true;

    // Erstelle Warn-Banner
    const warningBanner = document.createElement('div');
    warningBanner.id = 'connectionWarningBanner';
    warningBanner.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
        border-bottom: 3px solid #ffc107;
        padding: 16px 20px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    warningBanner.innerHTML = `
        <svg width="28" height="28" viewBox="0 0 24 24" fill="#856404" style="flex-shrink: 0;">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
        </svg>
        <div style="flex: 1;">
            <div style="font-weight: 600; color: #856404; font-size: 1rem; margin-bottom: 4px;">
                Verbindungsprobleme erkannt
            </div>
            <div style="color: #856404; font-size: 0.9rem; line-height: 1.4;">
                Aufgrund von Netzwerkproblemen können einige Daten nicht geladen werden.
                Die angezeigten Informationen sind möglicherweise unvollständig.
                Bitte entschuldigen Sie die Unannehmlichkeiten.
            </div>
        </div>
        <button onclick="dismissConnectionWarning()" style="
            background: #856404;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
            font-weight: 500;
            white-space: nowrap;
        ">Verstanden</button>
    `;

    document.body.prepend(warningBanner);

    // Verschiebe den Body-Inhalt nach unten
    document.body.style.paddingTop = warningBanner.offsetHeight + 'px';
}

/**
 * Schließt die Verbindungswarnung
 */
function dismissConnectionWarning() {
    const banner = document.getElementById('connectionWarningBanner');
    if (banner) {
        banner.remove();
        document.body.style.paddingTop = '0';
    }
}

/**
 * Prüft ob die Daten aufgrund von Verbindungsfehlern unzuverlässig sind
 * @returns {boolean}
 */
function isDataUnreliable() {
    return connectionErrors.criticalDataAffected && connectionErrors.count >= connectionErrors.threshold;
}

// ================================
// SMART CACHING SYSTEM (PERSISTENT)
// ================================

function isCacheValid(cacheEntry) {
    if (!cacheEntry || !cacheEntry.data || !cacheEntry.timestamp) return false;
    const age = Date.now() - cacheEntry.timestamp;
    return age < EXTERNAL_CONFIG.system.cacheExpiryMs;
}

function getCachedData(type) {
    try {
        const cacheKey = `mebis_cache_${type}`;
        const cacheString = localStorage.getItem(cacheKey);
        if (!cacheString) return null;

        const cacheEntry = JSON.parse(cacheString);
        if (!isCacheValid(cacheEntry)) return null;

        // Konvertiere optimierte Struktur zurück zu erwarteter Struktur
        if (type === 'checklists' && cacheEntry.version === '1.1') {
            return cacheEntry.data.map(item => ({
                name: item.name,
                url: item.url,
                pflichtProgress: item.pflicht,
                gesamtProgress: item.gesamt
            }));
        } else if (type === 'pflicht' && cacheEntry.version === '1.1') {
            return cacheEntry.data; // Bereits in korrekter Struktur
        }

        // Fallback für alte Cache-Versionen
        return cacheEntry.data;
    } catch (error) {
        console.warn(`Cache-Lesefehler für ${type}:`, error);
        return null;
    }
}

function setCachedData(type, data) {
    try {
        // Optimierte Datenstruktur - nur relevante Daten speichern
        let optimizedData;

        if (type === 'checklists') {
            // Nur die essentiellen Daten für Checklisten speichern
            optimizedData = data
                .filter(item => !item.error) // Keine Fehler-Einträge
                .map(item => ({
                    name: item.name.length > 40 ? item.name.substring(0, 37) + '...' : item.name,
                    pflicht: Math.round(item.pflichtProgress * 10) / 10, // 1 Dezimalstelle
                    gesamt: Math.round(item.gesamtProgress * 10) / 10,   // 1 Dezimalstelle
                    url: item.url // Für Links nötig
                }));
        } else if (type === 'pflicht') {
            // Pflichtabgaben - nur relevante Felder
            optimizedData = data.map(item => ({
                name: item.name?.length > 30 ? item.name.substring(0, 27) + '...' : item.name,
                grade: item.grade,
                points: item.points,
                maxPoints: item.maxPoints,
                status: item.status,
                isPflicht: item.isPflicht // Neu: isPflicht-Attribut cachen
            }));
        } else if (type === 'mitarbeitsnote') {
            // Mitarbeitsnote optimieren
            optimizedData = {
                overall: Math.round(data.overall * 100) / 100,  // 2 Dezimalstellen
                components: data.components.map(c => ({
                    name: c.name.length > 50 ? c.name.substring(0, 47) + '...' : c.name,
                    grade: Math.round(c.grade * 100) / 100
                }))
            };
        } else {
            // Fallback: Original Daten
            optimizedData = data;
        }

        const cacheEntry = {
            data: optimizedData,
            timestamp: Date.now(),
            version: '1.1', // Neue optimierte Version
            originalCount: data.length
        };

        const cacheKey = `mebis_cache_${type}`;
        const cacheString = JSON.stringify(cacheEntry);

        localStorage.setItem(cacheKey, cacheString);

        const sizeKB = Math.round(cacheString.length / 1024 * 100) / 100;
        console.log(`💾 ${type} Cache gespeichert: ${optimizedData.length}/${data.length} Einträge (${sizeKB}KB)`);

    } catch (error) {
        console.warn(`Cache-Speicherfehler für ${type}:`, error);
        // Fallback: Versuche mit weniger Daten
        if (error.name === 'QuotaExceededError') {
            console.warn('localStorage voll - Cache übersprungen');
        }
    }
}

function clearCache(type = null) {
    try {
        if (type) {
            localStorage.removeItem(`mebis_cache_${type}`);
            console.log(`🗑️ Cache für ${type} gelöscht`);
        } else {
            // Alle mebis caches löschen
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('mebis_cache_')) {
                    localStorage.removeItem(key);
                }
            });
            console.log('🗑️ Alle Caches gelöscht');
        }
    } catch (error) {
        console.warn('Cache-Löschfehler:', error);
    }
}

function showCacheNotification(type, isBackground = false) {
    const message = isBackground
        ? `📡 ${type === 'checklists' ? 'Checklisten' : 'Pflichtabgaben'} werden im Hintergrund aktualisiert...`
        : `💾 ${type === 'checklists' ? 'Checklisten' : 'Pflichtabgaben'} aus Cache geladen`;

    console.log(message);

    // Optional: Toast-Benachrichtigung (dezent)
    if (isBackground) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; top: 20px; right: 20px;
            background: rgba(0,102,204,0.9); color: white;
            padding: 10px 15px; border-radius: 8px;
            font-size: 14px; z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: opacity 0.3s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }
}

// Verwende Konfiguration aus config.js
const TRACK_SCHEDULES = EXTERNAL_CONFIG.trackSchedules;
const CLASS_TO_TRACK = EXTERNAL_CONFIG.classToTrack;

// Berechne maximale Wochenanzahl aus allen Schienen
function calculateTotalWeeks() {
  let maxWeeks = 0;
  Object.values(TRACK_SCHEDULES).forEach(schedule => {
    const trackMaxWeek = Math.max(...schedule.map(week => week.week));
    maxWeeks = Math.max(maxWeeks, trackMaxWeek);
  });
  return maxWeeks;
}

// Berechne maximale Wochenanzahl für spezifische Klasse/Schiene
function getTotalWeeksForClass(className) {
  const track = CLASS_TO_TRACK[className];
  if (!track || !TRACK_SCHEDULES[track]) {
    return calculateTotalWeeks(); // Fallback: Maximum aller Schienen
  }
  
  const schedule = TRACK_SCHEDULES[track];
  return Math.max(...schedule.map(week => week.week));
}

// Berechne maximale Wochenanzahl für spezifische Schiene
function getTotalWeeksForTrack(trackName) {
  if (!TRACK_SCHEDULES[trackName]) {
    return calculateTotalWeeks(); // Fallback: Maximum aller Schienen
  }
  
  const schedule = TRACK_SCHEDULES[trackName];
  return Math.max(...schedule.map(week => week.week));
}

// Berechne aktuelle Schulwoche für spezifische Schiene
function getCurrentSchulwocheForTrack(trackName) {
  const today = new Date();
  const totalWeeks = getTotalWeeksForTrack(trackName);
  
  if (!TRACK_SCHEDULES[trackName]) {
    console.log(`Kein Zeitplan für ${trackName} gefunden`);
    return totalWeeks; // Fallback: Vollansicht
  }
  
  const schedule = TRACK_SCHEDULES[trackName];
  let lastCompletedWeek = null;
  
  console.log(`Berechne Schulwoche für ${trackName}. Heute: ${today.toDateString()}`);
  
  for (let i = 0; i < schedule.length; i++) {
    const week = schedule[i];
    const startDate = new Date(week.start);
    const endDate = new Date(week.end);
    
    console.log(`  Prüfe Woche ${week.week}: ${startDate.toDateString()} - ${endDate.toDateString()}`);
    
    // Prüfe ob wir in dieser Woche sind
    if (today >= startDate && today <= endDate) {
      console.log(`→ In aktueller Schulwoche ${week.week} (${week.start} - ${week.end})`);
      return week.week; // Aktuelle Woche
    }
    
    // Prüfe ob diese Woche noch in der Zukunft liegt
    if (today < startDate) {
      // Vor der ersten Woche: Zeige Woche 1
      if (lastCompletedWeek === null) {
        console.log(`→ Vor erster Schulwoche, zeige Woche 1`);
        return 1;
      }
      // Zwischen Wochen: Zeige letzte abgeschlossene Woche
      console.log(`→ Zwischen Schulwochen, zeige letzte abgeschlossene Woche ${lastCompletedWeek}`);
      return lastCompletedWeek;
    }
    
    // Diese Woche ist vorbei, merke sie als letzte abgeschlossene
    if (today > endDate) {
      lastCompletedWeek = week.week;
      console.log(`  Woche ${week.week} ist bereits vorbei`);
    }
  }
  
  // Alle Wochen sind vorbei: Zeige letzte Woche oder Vollansicht
  const result = lastCompletedWeek || totalWeeks;
  console.log(`→ Alle Schulwochen vorbei, zeige Woche ${result}`);
  return result;
}

// Automatische Referenzwochen-Berechnung
function getCurrentSchulwoche(className = null) {
  const track = className ? CLASS_TO_TRACK[className] : null;
  
  if (!track) {
    return calculateTotalWeeks(); // Fallback: Vollansicht
  }
  
  // Verwende die Schienen-basierte Logik
  return getCurrentSchulwocheForTrack(track);
}

async function detectUserClass() {
  // Versuche verschiedene URL-Varianten um die Klassen-Tabs zu finden
  const urlsToTry = [
    `https://lernplattform.mebis.bycs.de/course/view.php?id=${COURSE_ID}`,
    `https://lernplattform.mebis.bycs.de/course/view.php?id=${COURSE_ID}&section=0`
  ];
  
  for (const courseUrl of urlsToTry) {
    try {
      const response = await fetch(courseUrl, {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' }
      });
      
      if (!response.ok) continue;
      
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Suche nach ALLEN nav-tabs Containern (horizontale und vertikale)
      const navTabsContainers = doc.querySelectorAll('ul.nav.nav-tabs.format_onetopic-tabs');
      
      if (navTabsContainers.length > 0) {
        // Durchsuche alle Container
        for (let i = 0; i < navTabsContainers.length; i++) {
          const container = navTabsContainers[i];
          const navLinks = container.querySelectorAll('a.nav-link[title]');
          
          // Suche nach relevanten Klassen in diesem Container
          for (const link of navLinks) {
            const className = link.getAttribute('title');
            if (className && CLASS_TO_TRACK[className]) {
              console.log(`Klasse aus Mebis-Kurs-Tab erkannt: ${className}`);
              return className;
            }
          }
        }
      } else {
        // Alternative: Suche nach beliebigen nav-links mit relevanten Titeln
        const allNavLinks = doc.querySelectorAll('a.nav-link[title]');
        for (const link of allNavLinks) {
          const className = link.getAttribute('title');
          if (className && CLASS_TO_TRACK[className]) {
            console.log(`Klasse über alternativen Selektor erkannt: ${className}`);
            return className;
          }
        }
      }
      
    } catch (error) {
      console.warn('Mebis-Kurserkennung fehlgeschlagen:', error);
    }
  }
  
  console.log(EXTERNAL_CONFIG.ui.trackDetection.noRelevantClass);
  return null;
}

function initializeReferenceWeek() {
  // Immer Schienen-Auswahl einrichten
  setupTrackSelector();
  
  // Prüfe LocalStorage für gespeicherte Schiene oder Klasse
  let savedTrack = localStorage.getItem('userTrack');
  let savedClass = localStorage.getItem('userClass');
  
  // Schiene hat Priorität
  if (savedTrack && TRACK_SCHEDULES[savedTrack]) {
    const totalWeeks = getTotalWeeksForTrack(savedTrack);
    const currentWeek = getCurrentSchulwocheForTrack(savedTrack);
    updateSystemForTrack(savedTrack, totalWeeks, currentWeek);
    hideTrackSelection(); // Verstecke Schienen-Auswahl bei erfolgreicher Erkennung
    preselectTrack(savedTrack);
    updateDashboardLoadingProgress(1, 'Schiene erkannt', `${savedTrack} (${totalWeeks} Wochen) - Woche ${currentWeek}`);
    // Sofortige UI-Updates für bessere Performance
    const step2 = document.getElementById('step2');
    if (step2) {
      step2.className = 'progress-step completed';
      step2.innerHTML = `✓ ${savedTrack} identifiziert (${totalWeeks} Wochen)`;
    }
    console.log(`Gespeicherte Schulwoche ${currentWeek} für ${savedTrack}`);
    return;
  }
  
  // Fallback: Gespeicherte Klasse
  if (savedClass && CLASS_TO_TRACK[savedClass]) {
    const track = CLASS_TO_TRACK[savedClass];
    const totalWeeks = getTotalWeeksForClass(savedClass);
    const currentWeek = getCurrentSchulwoche(savedClass);
    updateSystemForClass(savedClass, totalWeeks, currentWeek);
    hideTrackSelection(); // Verstecke Schienen-Auswahl bei erfolgreicher Erkennung
    preselectTrack(track);
    updateDashboardLoadingProgress(1, 'Klasse erkannt', `${savedClass} → ${track} (${totalWeeks} Wochen)`);
    // Sofortige UI-Updates für bessere Performance
    const step2 = document.getElementById('step2');
    if (step2) {
      step2.className = 'progress-step completed';
      step2.innerHTML = `✓ ${savedClass} → ${track} identifiziert`;
    }
    console.log(`Automatische Schulwoche ${currentWeek} für Klasse ${savedClass} (${track})`);
    return;
  }
  
  // Versuche automatische Erkennung
  updateDashboardLoadingProgress(1, EXTERNAL_CONFIG.loading.progress.detectTrack, EXTERNAL_CONFIG.loading.progress.detectTrackSub);
  detectUserClass().then(detectedClass => {
    if (detectedClass) {
      localStorage.setItem('userClass', detectedClass);
      const track = CLASS_TO_TRACK[detectedClass];
      const totalWeeks = getTotalWeeksForClass(detectedClass);
      const currentWeek = getCurrentSchulwoche(detectedClass);
      updateSystemForClass(detectedClass, totalWeeks, currentWeek);
      hideTrackSelection(); // Verstecke Schienen-Auswahl bei erfolgreicher automatischer Erkennung
      preselectTrack(track);
      updateDashboardLoadingProgress(1, 'Schiene erkannt!', `${detectedClass} → ${track} (${totalWeeks} Wochen)`);
      // Sofortige UI-Updates für bessere Performance
      const step2 = document.getElementById('step2');
      if (step2) {
        step2.className = 'progress-step completed';
        step2.innerHTML = `✓ ${detectedClass} → ${track} identifiziert`;
      }
      console.log(`Automatische Schulwoche ${currentWeek} für erkannte Klasse ${detectedClass} (${track})`);
    } else {
      // Fallback: Standard verwenden, aber Buttons aktiviert lassen für manuelle Auswahl
      const totalWeeks = calculateTotalWeeks();
      updateSystemForTrack(null, totalWeeks, totalWeeks);
      showTrackSelection(); // Zeige Schienen-Auswahl wenn keine automatische Erkennung möglich
      enableTrackButtons();
      updateDashboardLoadingProgress(1, 'Standard-Modus', 'Manuelle Schienen-Auswahl verfügbar');
      // Sofortige UI-Updates für bessere Performance
      const step2 = document.getElementById('step2');
      if (step2) {
        step2.className = 'progress-step completed';
        step2.innerHTML = EXTERNAL_CONFIG.ui.standardMode;
      }
      console.log(`Keine Klasse erkannt - verwende Standard (${totalWeeks} Wochen). Schienen-Auswahl verfügbar.`);
    }
  });
}

function setupTrackSelector() {
  // Event Listener für Track-Buttons einmalig einrichten
  const trackBtns = document.querySelectorAll('.track-btn');
  trackBtns.forEach(btn => {
    btn.onclick = function() {
      if (this.disabled) return; // Ignore clicks on disabled buttons
      
      const selectedTrack = this.getAttribute('data-track');
      if (selectedTrack && TRACK_SCHEDULES[selectedTrack]) {
        // Visuelles Update der Buttons
        trackBtns.forEach(b => {
          b.classList.remove('active');
          b.classList.add('inactive');
        });
        this.classList.remove('inactive');
        this.classList.add('active');
        
        // System aktualisieren
        localStorage.setItem('userTrack', selectedTrack);
        const totalWeeks = getTotalWeeksForTrack(selectedTrack);
        const currentWeek = getCurrentSchulwocheForTrack(selectedTrack);
        updateSystemForTrack(selectedTrack, totalWeeks, currentWeek);
        
        console.log(`Schienen-Wechsel: Schulwoche ${currentWeek} für ${selectedTrack}`);
        
        // Daten neu laden mit korrekter Referenzwoche
        if (checklistData && checklistData.length > 0) {
          updateStatistics();
          updateCharts();
          updateChecklistTable(checklistData);
        }
        
        if (window.pflichtData && window.pflichtData.length > 0) {
          updatePflichtStats();
          updatePflichtTable(window.pflichtData);
        }
      }
    };
  });
}

function preselectTrack(trackName) {
  const trackBtns = document.querySelectorAll('.track-btn');
  trackBtns.forEach(btn => {
    btn.classList.remove('active');
    btn.classList.add('inactive');
  });
  
  const activeBtn = document.querySelector(`.track-btn[data-track="${trackName}"]`);
  if (activeBtn) {
    activeBtn.classList.remove('inactive');
    activeBtn.classList.add('active');
  }
}

function enableTrackButtons() {
  const trackBtns = document.querySelectorAll('.track-btn');
  trackBtns.forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('inactive');
    btn.classList.add('inactive'); // Default to inactive until selected
  });
  console.log(EXTERNAL_CONFIG.ui.trackDetection.buttonsEnabled);
}

function disableTrackButtons() {
  const trackBtns = document.querySelectorAll('.track-btn');
  trackBtns.forEach(btn => {
    btn.disabled = true;
    btn.classList.remove('active', 'inactive');
  });
  console.log(EXTERNAL_CONFIG.ui.trackDetection.buttonsDisabled);
}

function hideTrackSelection() {
  const trackContainer = document.getElementById('trackSelectionContainer');
  if (trackContainer) {
    trackContainer.style.display = 'none';
    console.log(EXTERNAL_CONFIG.ui.trackDetection.selectionHidden);
  }
}

function showTrackSelection() {
  const trackContainer = document.getElementById('trackSelectionContainer');
  if (trackContainer) {
    trackContainer.style.display = 'flex';
    console.log(EXTERNAL_CONFIG.ui.trackDetection.selectionShown);
  }
}

function setToCurrentWeek() {
  // Bestimme aktuelle Woche basierend auf gespeicherter oder erkannter Klasse/Schiene
  let currentWeek = TOTAL_WEEKS; // Default fallback
  
  const savedTrack = localStorage.getItem('userTrack');
  const savedClass = localStorage.getItem('userClass');
  
  if (savedTrack && TRACK_SCHEDULES[savedTrack]) {
    currentWeek = getCurrentSchulwocheForTrack(savedTrack);
  } else if (savedClass && CLASS_TO_TRACK[savedClass]) {
    currentWeek = getCurrentSchulwoche(savedClass);
  }
  
  // Setze Referenzwoche auf aktuelle Woche
  updateReferenceWeek(currentWeek);
  console.log(`Aktuelle Woche gesetzt: ${currentWeek}`);
}

function updateSystemForClass(className, totalWeeks, currentWeek) {
  // Globale Variablen aktualisieren
  TOTAL_WEEKS = totalWeeks;
  
  // UI-Elemente aktualisieren
  updateSliderForTotalWeeks(totalWeeks);
  
  // Check if user has manually set reference week - if so, respect it
  const manualWeek = localStorage.getItem('manualReferenceWeek');
  if (manualWeek && parseInt(manualWeek) <= totalWeeks) {
    currentReferenceWeek = parseInt(manualWeek);
    setReferenceWeek(currentReferenceWeek);
  } else {
    // Use automatic week calculation
    currentReferenceWeek = currentWeek;
    setReferenceWeek(currentWeek);
    localStorage.removeItem('manualReferenceWeek'); // Clear any invalid manual setting
  }
}

function updateSystemForTrack(trackName, totalWeeks, currentWeek) {
  // Globale Variablen aktualisieren
  TOTAL_WEEKS = totalWeeks;
  
  // UI-Elemente aktualisieren
  updateSliderForTotalWeeks(totalWeeks);
  
  // Check if user has manually set reference week - if so, respect it
  const manualWeek = localStorage.getItem('manualReferenceWeek');
  if (manualWeek && parseInt(manualWeek) <= totalWeeks) {
    currentReferenceWeek = parseInt(manualWeek);
    setReferenceWeek(currentReferenceWeek);
  } else {
    // Use automatic week calculation
    currentReferenceWeek = currentWeek;
    setReferenceWeek(currentWeek);
    localStorage.removeItem('manualReferenceWeek'); // Clear any invalid manual setting
  }
}

function updateSliderForTotalWeeks(totalWeeks) {
  const slider = document.getElementById('referenceWeekSlider');
  const maxLabel = slider.nextElementSibling;
  const vonLabel = document.querySelector('[data-week-total]') || 
                   document.querySelector('span[style*="von"]');
  
  if (slider) {
    slider.max = totalWeeks;
    slider.value = totalWeeks;
  }
  
  if (maxLabel) {
    maxLabel.textContent = totalWeeks;
  }
  
  if (vonLabel) {
    vonLabel.textContent = `von ${totalWeeks}`;
  }
  
}

function setReferenceWeek(weekNumber) {
  currentReferenceWeek = weekNumber;
  document.getElementById('referenceWeekSlider').value = weekNumber;
  updateReferenceWeekLabels();
}



// zentrale Course ID (aus Konfiguration)
const COURSE_ID = EXTERNAL_CONFIG.system.courseId;





// Referenzwochen-Funktionen
function updateReferenceWeek(weekValue) {
    currentReferenceWeek = parseInt(weekValue);
    document.getElementById('referenceWeekSlider').value = currentReferenceWeek;

    // Mark this as a manual override to prevent track system from overriding
    localStorage.setItem('manualReferenceWeek', currentReferenceWeek);

    // Labels mit Referenzwoche aktualisieren
    updateReferenceWeekLabels();

    // Alle Berechnungen neu durchführen
    if (checklistData && checklistData.length > 0) {
        updateStatistics();
        updateCharts();
        updateChecklistTable(checklistData);
    }

    if (window.pflichtData && window.pflichtData.length > 0) {
        updatePflichtStats();
        updatePflichtTable(window.pflichtData);
    }

    // NEU: Mitarbeitsnote-Fortschritt neu berechnen
    const gradeData = getCachedData('mitarbeitsnote');
    if (gradeData) {
        // Async Aufruf ohne await (UI blockiert nicht)
        updateMitarbeitsnoteCard(gradeData).catch(err => {
            console.error('Fehler beim Update der Mitarbeitsnote-Card:', err);
        });
    }
}

function updateReferenceWeekLabels() {
    const isNormalView = currentReferenceWeek === TOTAL_WEEKS;
    
    // Labels bleiben unverändert - nur Overlays werden erstellt/entfernt
    updateReferenceWeekOverlays(isNormalView);
}

function updateReferenceWeekOverlays(isNormalView) {
    // Entferne alle existierenden Overlays
    document.querySelectorAll('.reference-week-overlay').forEach(overlay => overlay.remove());
    
    if (isNormalView) return; // Keine Overlays bei letzter Woche
    
    // Stat-Cards mit Referenzwochen-Overlays versehen
    const statCards = document.querySelectorAll('#referenceWeekContainer');
    statCards.forEach(row => {
        const overlay = document.createElement('div');
        overlay.className = 'reference-week-overlay';
        overlay.textContent = `Schulwoche ${currentReferenceWeek} (Fortschritt basierend auf Schulwoche)`;
        row.appendChild(overlay);
    });
}

function calculateReferenceProgress(actualProgress, totalItems) {
    // Bei letzter Woche: Normale Berechnung (keine Referenzwoche)
    if (currentReferenceWeek === TOTAL_WEEKS) {
        return totalItems > 0 ? (actualProgress / totalItems) * 100 : 0;
    }
    
    // Berechnet den erwarteten Fortschritt basierend auf der Referenzwoche
    // actualProgress: Tatsächlich erledigte Items
    // totalItems: Gesamtanzahl Items über 9 Wochen
    
    const expectedItemsByWeek = (totalItems / TOTAL_WEEKS) * currentReferenceWeek;
    
    if (expectedItemsByWeek === 0) return 0;
    
    // Allow values over 100% for reference weeks - no Math.min cap
    return (actualProgress / expectedItemsByWeek) * 100;
}

function calculateReferenceProgressFromPercentage(currentPercentage, totalItems) {
    // Bei letzter Woche: Originaler Prozentsatz zurückgeben
    if (currentReferenceWeek === TOTAL_WEEKS) {
        return currentPercentage;
    }
    
    // Konvertiert bestehende Prozentangaben in Referenzwochen-Prozente
    // currentPercentage: Aktueller Prozentsatz (0-100)
    // totalItems: Gesamtanzahl Items
    
    const actualItems = (currentPercentage / 100) * totalItems;
    return calculateReferenceProgress(actualItems, totalItems);
}

function calculateReferenceProgressFromSinglePercentage(currentPercentage) {
    // Bei letzter Woche: Originaler Prozentsatz zurückgeben
    if (currentReferenceWeek === TOTAL_WEEKS) {
        return currentPercentage;
    }
    
    // Für einzelne Checklist-Items: berechnet Referenz-Fortschritt
    // currentPercentage: Aktueller Prozentsatz einer einzelnen Checkliste (0-100)
    
    const expectedProgressByWeek = (100 / TOTAL_WEEKS) * currentReferenceWeek;
    
    if (expectedProgressByWeek === 0) return 0;
    
    // Allow values over 100% for reference weeks - no Math.min cap
    return (currentPercentage / expectedProgressByWeek) * 100;
}

// Utility-Funktionen
function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

function showChecklistStatsLoading(show) {
    const loadingOverlay = document.getElementById('checklistStatsLoading');
    const statsContent = document.getElementById('checklistStatsContent');
    if (loadingOverlay && statsContent) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
        statsContent.style.opacity = show ? '0.3' : '1';
    }
}

function showDashboardLoading(show) {
    // Show/hide fullscreen loading overlay
    const overlay = document.getElementById('dashboardLoadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
    
    // Show/hide loading state on stat cards
    const statCards = document.querySelectorAll('.stat-card');
    const statsGroups = document.querySelectorAll('.stats-group');
    
    if (show) {
        statCards.forEach(card => card.classList.add('loading'));
        statsGroups.forEach(group => group.classList.add('loading'));
        // Reset progress steps when starting
        resetLoadingProgress();
    } else {
        statCards.forEach(card => card.classList.remove('loading'));
        statsGroups.forEach(group => group.classList.remove('loading'));
    }
}

function updateDashboardLoadingProgress(step, message, subtext = '') {
    const mainText = document.getElementById('loadingMainText');
    const subText = document.getElementById('loadingSubText');
    
    if (mainText) mainText.textContent = message;
    if (subText) subText.textContent = subtext;
    
    // Update step states
    const steps = ['step1', 'step2', 'step3', 'step4'];
    steps.forEach((stepId, index) => {
        const stepElement = document.getElementById(stepId);
        if (stepElement) {
            stepElement.className = 'progress-step';
            if (index < step) {
                stepElement.className += ' completed';
            } else if (index === step) {
                stepElement.className += ' active';
            } else {
                stepElement.className += ' pending';
            }
        }
    });
}

function resetLoadingProgress() {
    // Reset all steps to initial state
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step4 = document.getElementById('step4');
    
    if (step1) {
        step1.className = 'progress-step completed';
        step1.innerHTML = EXTERNAL_CONFIG.loading.steps[1].completed;
    }
    if (step2) {
        step2.className = 'progress-step pending';
        step2.innerHTML = EXTERNAL_CONFIG.loading.steps[2].initial;
    }
    if (step3) {
        step3.className = 'progress-step pending';
        step3.innerHTML = EXTERNAL_CONFIG.loading.steps[3].initial;
    }
    if (step4) {
        step4.className = 'progress-step pending';
        step4.innerHTML = EXTERNAL_CONFIG.loading.steps[4].initial;
    }
}

function checkAndHideDashboardLoading() {
    // Hide dashboard loading state when both checklists and pflicht data are available
    if (checklistData && checklistData.length > 0 && window.pflichtData && window.pflichtData.length > 0) {
        // Show completion message
        const totalItems = checklistData.length + window.pflichtData.length;
        updateDashboardLoadingProgress(4, 'Dashboard bereit!', `${totalItems} Elemente erfolgreich geladen`);

        // Update overview statistics now that both datasets are loaded
        updateStatistics();
        updatePflichtStats();

        // Ensure loading is visible for at least 1.5 seconds for better UX
        const loadingStartTime = window.dashboardLoadingStartTime || 0;
        const elapsed = Date.now() - loadingStartTime;
        const minLoadingTime = 1500; // 1.5 seconds

        setTimeout(() => {
            showDashboardLoading(false);
        }, Math.max(500, minLoadingTime - elapsed)); // At least 500ms to show completion
    }
}

function updateLoadingProgress(completed, total) {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        const percentage = Math.round((completed / total) * 100);
        loadingIndicator.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-weight: bold; margin-bottom: 10px;">Lade Checklisten...</div>
                <div style="background: #f0f0f0; border-radius: 10px; height: 20px; overflow: hidden;">
                    <div style="background: #4f46e5; height: 100%; width: ${percentage}%; transition: width 0.3s ease;"></div>
                </div>
                <div style="margin-top: 8px; font-size: 0.9em; color: #666;">
                    ${completed} von ${total} geladen (${percentage}%)
                </div>
            </div>
        `;
    }
}


function extractPflichtOverview(useCache = true) {
    // Prüfe Cache zuerst
    const cachedData = useCache ? getCachedData('pflicht') : null;
    if (cachedData) {
        showCacheNotification('pflicht');
        window.pflichtData = cachedData;
        updatePflichtStats();
        showBothStatsRows(); // Stelle sicher, dass die Stats-Reihen angezeigt werden

        // Background update starten
        setTimeout(() => {
            showCacheNotification('pflicht', true);
            extractPflichtOverview(false); // ohne Cache
        }, 100);

        return Promise.resolve();
    }

    showLoading(true);
    updateDashboardLoadingProgress(3, EXTERNAL_CONFIG.loading.progress.loadPflicht, EXTERNAL_CONFIG.loading.progress.loadPflichtSub);

    const assignmentOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${COURSE_ID}&expand[]=assign#assign_overview_collapsible`;
    const quizOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${COURSE_ID}&expand[]=quiz#quiz_overview_collapsible`;

    return fetchData(assignmentOverviewUrl, quizOverviewUrl)
        .then(async data => {
            // Erweitere die Daten mit Assignment-Details
            const enrichedData = await enrichPflichtDataWithDetails(data);

            // Cache die erfolgreichen Daten
            setCachedData('pflicht', enrichedData);

            window.pflichtData = enrichedData;
            updatePflichtStats();
            const pfSection = document.getElementById('pflichtFilterSection');
            if (pfSection) pfSection.style.display = 'block';

            // Wende Filter/Sortierung an
            applyPflichtFilters();

            // Zähle Pflicht- und optionale Aufgaben separat
            const pflichtCount = enrichedData.filter(item => item.isPflicht).length;
            const optionalCount = enrichedData.length - pflichtCount;

            updateDashboardLoadingProgress(3, `${enrichedData.length} Aufgaben geladen (${pflichtCount} Pflicht, ${optionalCount} Optional)`, 'Aufgaben und Quizzes analysiert');
            // Sofortige UI-Updates für bessere Performance
            const step4 = document.getElementById('step4');
            if (step4) {
                step4.className = 'progress-step completed';
                step4.innerHTML = `✓ ${enrichedData.length} Aufgaben (${pflichtCount} Pflicht, ${optionalCount} Optional)`;
            }
        })
        .catch(err => {
            console.error('extractPflichtOverview error:', err);
            window.pflichtData = [];

            // Verstecke Loading-Indikator auch im Fehlerfall
            const loadingIndicator = document.getElementById('pflichtLoadingIndicator');
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        })
        .finally(() => showLoading(false));
}

/**
 * Fetch und parse Mitarbeitsnote vom Grade Report
 * @param {boolean} useCache - Cache verwenden?
 * @returns {Promise<Object|null>} Grade-Daten oder null bei Fehler
 */
async function fetchMitarbeitsnote(useCache = true) {
    // 1. Cache prüfen
    const cachedData = useCache ? getCachedData('mitarbeitsnote') : null;
    if (cachedData) {
        console.log('💾 Mitarbeitsnote aus Cache geladen');
        return cachedData;
    }

    try {
        // 2. Fetch Grade Report
        const courseId = EXTERNAL_CONFIG.system.courseId;
        const gradeReportUrl = `https://lernplattform.mebis.bycs.de/grade/report/user/index.php?id=${courseId}`;

        const response = await fetch(gradeReportUrl, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 3. Parse HTML
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 4. Category-Klasse aus Config holen
        const categoryClass = EXTERNAL_CONFIG.assignmentCategories.Mitarbeitsnote_1;
        const categoryRows = doc.querySelectorAll(`tr.${categoryClass}`);

        if (categoryRows.length === 0) {
            console.warn(`Keine Zeilen mit Klasse "${categoryClass}" gefunden`);
            return null;
        }

        console.log(`✓ ${categoryRows.length} Zeilen mit Klasse "${categoryClass}" gefunden`);

        // 5. Parse Notendaten
        let overallGrade = null;
        const components = [];

        categoryRows.forEach((row, index) => {
            const nameCell = row.querySelector('th.column-itemname');
            const gradeCell = row.querySelector('td.column-grade');

            if (!nameCell || !gradeCell) {
                console.log(`⚠️ Zeile ${index}: Keine Name- oder Grade-Zelle gefunden`);
                return;
            }

            // Text extrahieren
            const nameFull = nameCell.textContent.trim();
            const gradeText = gradeCell.textContent.trim();

            // Name aus gradeitemheader span extrahieren (sauberer)
            const nameSpan = nameCell.querySelector('.gradeitemheader');
            const name = nameSpan ? nameSpan.textContent.trim() : nameFull;

            console.log(`📋 Zeile ${index}: Name="${name}", Grade="${gradeText}"`);

            // Note parsen (Format: "82,64" oder "-")
            let gradeValue = null;
            if (gradeText && gradeText !== '-' && gradeText !== 'Nicht bewertet') {
                const numericGrade = parseFloat(gradeText.replace(',', '.'));
                if (!isNaN(numericGrade)) {
                    gradeValue = numericGrade;
                }
            }

            // Gesamtnote erkennen (flexible Bedingung - prüfe nur auf "Mitarbeitsnote gesamt" im Namen)
            if (name.includes('Mitarbeitsnote gesamt')) {
                overallGrade = gradeValue;
                console.log(`✓ Gesamtnote gefunden: ${gradeValue}`);
            } else if (gradeValue !== null) {
                components.push({ name, grade: gradeValue });
                console.log(`✓ Bestandteil hinzugefügt: ${name} = ${gradeValue}`);
            }
        });

        // 6. Validierung
        if (overallGrade === null) {
            console.warn('Keine Gesamtnote gefunden');
            return null;
        }

        const gradeData = { overall: overallGrade, components };

        // 7. Cache speichern
        setCachedData('mitarbeitsnote', gradeData);
        console.log('✓ Mitarbeitsnote erfolgreich geladen:', gradeData);

        return gradeData;

    } catch (error) {
        console.error('Fehler beim Laden der Mitarbeitsnote:', error);
        return null;
    }
}

/**
 * Update Mitarbeitsnote Stat-Card mit Daten
 * @param {Object|null} gradeData - Grade-Daten oder null
 */
async function updateMitarbeitsnoteCard(gradeData) {
    const statsGroup = document.getElementById('mitarbeitStatsGroup');
    const overallGradeEl = document.getElementById('mitarbeitOverallGrade');
    const componentsContainer = document.getElementById('mitarbeitComponents');
    const ihkGradeEl = document.getElementById('mitarbeitIHKGrade');
    const ihkGradeNameEl = document.getElementById('mitarbeitIHKGradeName');

    // Card ausblenden bei fehlenden Daten
    if (!gradeData || gradeData.overall === null) {
        if (statsGroup) statsGroup.style.display = 'none';
        console.log('Mitarbeitsnote-Karte ausgeblendet (keine Daten)');
        return;
    }

    // Card anzeigen
    if (statsGroup) statsGroup.style.display = 'block';

    // Gesamtnote anzeigen (deutsches Format: 82,64)
    const percentage = gradeData.overall;
    if (overallGradeEl) {
        overallGradeEl.textContent = `${percentage.toFixed(2).replace('.', ',')}%`;
    }

    // IHK-Note berechnen und anzeigen
    const ihkGradeInfo = calculateIHKGrade(percentage);
    if (ihkGradeEl && ihkGradeNameEl) {
        // Note mit Tendenz (z.B. "2+" oder "3-")
        let gradeDisplay = ihkGradeInfo.grade.toString();
        if (ihkGradeInfo.tendency) {
            gradeDisplay += ihkGradeInfo.tendency;
        }
        ihkGradeEl.textContent = gradeDisplay;

        // Notennamen aus Config holen
        const gradeConfig = EXTERNAL_CONFIG.grades[ihkGradeInfo.grade];
        if (gradeConfig) {
            ihkGradeNameEl.textContent = gradeConfig.name;
            // Farbe setzen
            ihkGradeEl.style.color = gradeConfig.color;
        }
    }

    // Bestandteile rendern
    if (componentsContainer) {
        componentsContainer.innerHTML = ''; // Clear

        // Punkte für Quantität berechnen (falls Checklisten-Daten vorhanden)
        let quantitaetPoints = null;
        const B7 = EXTERNAL_CONFIG.mitarbeitsnote1ReferenceWeek;
        if (checklistData && checklistData.length > 0 && B7) {
            const checklistsWithPflicht = checklistData.filter(item =>
                !item.error && item.pflichtProgress !== null
            );
            if (checklistsWithPflicht.length > 0) {
                const B3 = checklistsWithPflicht.length * 100; // Total Punkte
                const B4 = TOTAL_WEEKS;
                const maxPoints = (B3 / B4) * B7; // Max Punkte für 1. MA Zeitraum

                // Finde Quantität-Komponente
                const quantitaetComp = gradeData.components.find(c =>
                    c.name.toLowerCase().includes('quantität') ||
                    c.name.toLowerCase().includes('quantitat')
                );
                if (quantitaetComp) {
                    const reachedPoints = (quantitaetComp.grade / 100) * maxPoints;
                    // Exakte Werte ohne Rundung speichern für konsistente Anzeige
                    window.ma1ReachedPoints = reachedPoints;
                    window.ma1MaxPoints = maxPoints;
                    quantitaetPoints = `${Math.round(reachedPoints)}/${Math.round(maxPoints)}`;
                }
            }
        }

        gradeData.components.forEach(component => {
            const componentEl = document.createElement('div');
            componentEl.className = 'mitarbeit-component';

            const nameEl = document.createElement('span');
            nameEl.className = 'mitarbeit-component-name';
            nameEl.textContent = component.name;

            const gradeEl = document.createElement('span');
            gradeEl.className = 'mitarbeit-component-grade';

            // Bei Quantität auch Punkte anzeigen (ohne Nachkommastellen, mit %)
            const isQuantitaet = component.name.toLowerCase().includes('quantität') ||
                                 component.name.toLowerCase().includes('quantitat');
            if (isQuantitaet && quantitaetPoints) {
                gradeEl.innerHTML = `${Math.round(component.grade)}% <span style="color: #666; font-size: 0.85em; margin-left: 4px;">(${quantitaetPoints})</span>`;
            } else if (isQuantitaet) {
                gradeEl.textContent = `${Math.round(component.grade)}%`;
            } else {
                gradeEl.textContent = component.grade.toFixed(2).replace('.', ',');
            }

            componentEl.appendChild(nameEl);
            componentEl.appendChild(gradeEl);
            componentsContainer.appendChild(componentEl);
        });
    }

    // NEU: Fortschritt 2. Mitarbeitsnote berechnen und anzeigen
    const progressCard = document.getElementById('mitarbeitProgressCard');

    if (shouldShowMitarbeitProgressCards()) {
        const progressData = calculateFortschritt2Mitarbeitsnote(gradeData);

        if (progressData && progressCard) {
            // Progress Card anzeigen
            progressCard.style.display = 'block';

            // Referenzwoche anzeigen
            const refWeekDisplay = document.getElementById('mitarbeitReferenceWeekDisplay');
            if (refWeekDisplay) {
                const B7 = EXTERNAL_CONFIG.mitarbeitsnote1ReferenceWeek;
                refWeekDisplay.textContent = B7;
            }

            // Komponenten für Prognose anzeigen (inkl. Gesamtnote)
            await updatePrognosisComponents(progressData);

            console.log('✓ Fortschritt 2. Mitarbeitsnote angezeigt');
        }
    } else {
        // Progress Card ausblenden
        if (progressCard) {
            progressCard.style.display = 'none';
        }
    }

    console.log('✓ Mitarbeitsnote-Karte aktualisiert');
}

/**
 * Parst deutsches Datum aus Mebis (z.B. "Dienstag, 13. Januar 2026, 15:06")
 * @param {string} dateStr - Datum-String im deutschen Format
 * @returns {Date|null} - Geparster Date-Objekt oder null
 */
function parseGermanDate(dateStr) {
    try {
        // Monats-Mapping Deutsch -> Englisch
        const monthMap = {
            'Januar': '01', 'Februar': '02', 'März': '03', 'April': '04',
            'Mai': '05', 'Juni': '06', 'Juli': '07', 'August': '08',
            'September': '09', 'Oktober': '10', 'November': '11', 'Dezember': '12'
        };

        // Regex: "Mittwoch, 17. Dezember 2025, 10:43" (mit optionalem Wochentag)
        const regex = /(?:\w+,\s+)?(\d+)\.\s+(\w+)\s+(\d{4}),\s+(\d{2}):(\d{2})/;
        const match = dateStr.match(regex);

        if (!match) {
            console.warn('⚠️ Konnte Datum nicht parsen:', dateStr);
            return null;
        }

        const [, day, monthName, year, hours, minutes] = match;
        const month = monthMap[monthName];

        if (!month) {
            console.warn('⚠️ Unbekannter Monat:', monthName);
            return null;
        }

        // ISO-Format: YYYY-MM-DDTHH:MM
        const isoStr = `${year}-${month}-${day.padStart(2, '0')}T${hours}:${minutes}:00`;
        return new Date(isoStr);
    } catch (error) {
        console.error('❌ Fehler beim Parsen des Datums:', error);
        return null;
    }
}

/**
 * Holt das Bewertungsdatum für ein Assignment oder Quiz
 * @param {number} cmid - Course Module ID
 * @returns {Promise<Date|null>} - Bewertungsdatum oder null
 */
async function fetchGradedDate(cmid) {
    // Versuche zuerst Assignment, dann Quiz
    const assignmentDate = await fetchGradedDateFromAssignment(cmid);
    if (assignmentDate) return assignmentDate;

    const quizDate = await fetchGradedDateFromQuiz(cmid);
    if (quizDate) return quizDate;

    console.warn(`⚠️ CMID ${cmid}: Kein Bewertungsdatum gefunden (weder Assignment noch Quiz)`);
    return null;
}

/**
 * Holt das Bewertungsdatum für ein Assignment
 * @param {number} assignId - Assignment ID (cmid)
 * @returns {Promise<Date|null>} - Bewertungsdatum oder null
 */
async function fetchGradedDateFromAssignment(assignId) {
    try {
        const url = `https://lernplattform.mebis.bycs.de/mod/assign/view.php?id=${assignId}`;
        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) {
            console.log(`  ℹ️ Assignment ${assignId}: HTTP ${response.status} (kein Assignment)`);
            return null;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Suche "Bewertet am" in der Feedback-Tabelle
        const rows = doc.querySelectorAll('table.generaltable tr');

        for (const row of rows) {
            const headerCell = row.querySelector('th');
            if (headerCell) {
                const headerText = headerCell.textContent.trim();

                if (headerText.includes('Bewertet am')) {
                    const dataCell = row.querySelector('td');
                    if (dataCell) {
                        const dateStr = dataCell.textContent.trim();
                        const parsedDate = parseGermanDate(dateStr);
                        console.log(`📅 Assignment ${assignId}: Bewertet am ${dateStr} → ${parsedDate}`);
                        return parsedDate;
                    }
                }
            }
        }

        return null;

    } catch (error) {
        console.log(`  ℹ️ Assignment ${assignId}: Fehler (kein Assignment)`);
        return null;
    }
}

/**
 * Holt das Bewertungsdatum für ein Quiz
 * @param {number} quizId - Quiz ID (cmid)
 * @returns {Promise<Date|null>} - Bewertungsdatum oder null
 */
async function fetchGradedDateFromQuiz(quizId) {
    try {
        const url = `https://lernplattform.mebis.bycs.de/mod/quiz/view.php?id=${quizId}`;
        const response = await fetch(url, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) {
            console.log(`  ℹ️ Quiz ${quizId}: HTTP ${response.status} (kein Quiz)`);
            return null;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Suche "Begonnen" oder "Abgeschlossen" in der Quiz-Review-Summary-Tabelle
        const rows = doc.querySelectorAll('table.quizreviewsummary tr');

        let begunnenDate = null;
        let abgeschlossenDate = null;

        for (const row of rows) {
            const headerCell = row.querySelector('th');
            if (headerCell) {
                const headerText = headerCell.textContent.trim();
                const dataCell = row.querySelector('td');

                if (dataCell) {
                    const dateStr = dataCell.textContent.trim();
                    const parsedDate = parseGermanDate(dateStr);

                    if (headerText.includes('Abgeschlossen')) {
                        abgeschlossenDate = parsedDate;
                        console.log(`📅 Quiz ${quizId}: Abgeschlossen ${dateStr} → ${parsedDate}`);
                    } else if (headerText.includes('Begonnen')) {
                        begunnenDate = parsedDate;
                        console.log(`📅 Quiz ${quizId}: Begonnen ${dateStr} → ${parsedDate}`);
                    }
                }
            }
        }

        // Bevorzuge "Abgeschlossen", falls vorhanden
        return abgeschlossenDate || begunnenDate;

    } catch (error) {
        console.log(`  ℹ️ Quiz ${quizId}: Fehler (kein Quiz)`);
        return null;
    }
}

/**
 * Hilfsfunktion zum Parsen von Overview-Zeilen
 * @param {NodeList} rows - Zeilen aus der Overview-Tabelle
 * @param {Map} gradesMap - Map zum Speichern der Bewertungen
 * @param {string} type - Typ der Bewertung ('Assignment' oder 'Quiz')
 */
function parseOverviewRows(rows, gradesMap, type) {
    rows.forEach(row => {
        const cmid = row.getAttribute('data-mdl-overview-cmid');
        if (!cmid) return;

        const id = parseInt(cmid);

        // Suche Bewertungszelle
        const gradeCell = row.querySelector('td[data-mdl-overview-item="Bewertung"]');
        if (!gradeCell) return;

        const gradeValue = gradeCell.getAttribute('data-mdl-overview-value');
        const gradeText = gradeCell.textContent.trim();

        if (!gradeValue || gradeValue === '0' || gradeText === '-' || gradeText === 'Keine Bewertung') {
            return;
        }

        console.log(`✓ ${type} ${id}: Bewertung = "${gradeText}" (value: ${gradeValue})`);

        // Parse Bewertung
        const numValue = parseFloat(gradeValue);

        // Prüfe ob Stern-Bewertung (1-4) oder Punkt/Prozent-Bewertung (> 4)
        if (numValue >= 1 && numValue <= 4) {
            // Stern-Bewertung
            const starCount = Math.round(numValue);
            const percentage = convertStarsToPercentage(starCount);
            gradesMap.set(id, {
                value: percentage,
                display: `${'*'.repeat(starCount)} (${percentage}%)`,
                type: type
            });
            console.log(`→ Stern-Bewertung: ${starCount} Sterne = ${percentage}%`);
        } else if (numValue > 4) {
            // Punkt/Prozent-Bewertung (keine Obergrenze, da Punkte > 100 möglich)
            gradesMap.set(id, {
                value: numValue,
                display: `${Math.round(numValue)}%`,
                type: type
            });
            console.log(`→ Punkt-Bewertung: ${numValue}`);
        }
    });
}

/**
 * Lädt alle Assignment- und Quiz-Bewertungen aus der Course Overview
 * @returns {Promise<Map<number, Object>>} - Map von CMID zu { value, display }
 */
async function fetchAllAssignmentGrades() {
    try {
        const gradesMap = new Map();
        const parser = new DOMParser();

        // Lade BEIDE Overview-Seiten: Assignments und Quizzes
        const assignOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${COURSE_ID}&expand[]=assign#assign_overview_collapsible`;
        const quizOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${COURSE_ID}&expand[]=quiz#quiz_overview_collapsible`;

        // Paralleles Laden beider Overview-Seiten
        const [assignResponse, quizResponse] = await Promise.all([
            fetch(assignOverviewUrl, {
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            }),
            fetch(quizOverviewUrl, {
                credentials: 'same-origin',
                headers: { 'X-Requested-With': 'XMLHttpRequest' }
            })
        ]);

        // Verarbeite Assignment Overview
        if (assignResponse.ok) {
            const assignHtml = await assignResponse.text();
            const assignDoc = parser.parseFromString(assignHtml, 'text/html');
            const assignRows = assignDoc.querySelectorAll('tr[data-mdl-overview-cmid]');
            console.log(`📋 Assignment Overview: ${assignRows.length} Assignments gefunden`);
            parseOverviewRows(assignRows, gradesMap, 'Assignment');
        }

        // Verarbeite Quiz Overview
        if (quizResponse.ok) {
            const quizHtml = await quizResponse.text();
            const quizDoc = parser.parseFromString(quizHtml, 'text/html');
            const quizRows = quizDoc.querySelectorAll('tr[data-mdl-overview-cmid]');
            console.log(`📋 Quiz Overview: ${quizRows.length} Quizzes gefunden`);
            parseOverviewRows(quizRows, gradesMap, 'Quiz');
        }

        console.log(`📋 Gesamt: ${gradesMap.size} Bewertungen aus Course Overview`);

        // Jetzt Bewertungsdaten für alle Assignments mit Bewertungen laden
        if (gradesMap.size > 0) {
            console.log('📅 Lade Bewertungsdaten für alle Assignments...');
            const assignIds = Array.from(gradesMap.keys());

            // Paralleles Laden der Bewertungsdaten
            const datePromises = assignIds.map(async (assignId) => {
                const gradedDate = await fetchGradedDate(assignId);
                return { assignId, gradedDate };
            });

            const dateResults = await Promise.all(datePromises);

            // Füge Bewertungsdaten zu gradesMap hinzu
            dateResults.forEach(({ assignId, gradedDate }) => {
                const existingData = gradesMap.get(assignId);
                if (existingData) {
                    gradesMap.set(assignId, {
                        ...existingData,
                        gradedDate: gradedDate
                    });
                }
            });

            console.log('✅ Bewertungsdaten hinzugefügt');
        }

        return gradesMap;

    } catch (error) {
        console.error('❌ Fehler beim Laden der Course Overview:', error);
        trackConnectionError('Course Overview (Bewertungen)', true);
        return new Map();
    }
}

/**
 * Holt die Bewertung für ein Assignment (aus Cache oder lädt neu)
 * @param {number} assignId - Assignment ID
 * @returns {Promise<Object|null>} - { value: number, display: string } oder null
 */
async function getAssignmentGrade(assignId) {
    // Prüfe ob alle Bewertungen bereits im globalen Cache sind
    if (!window.allAssignmentGrades) {
        // Lade alle Bewertungen auf einmal
        const cacheKey = 'all_assignment_grades';
        const cachedArray = getCachedData(cacheKey);

        let gradesMap;

        if (cachedArray && Array.isArray(cachedArray)) {
            // Array aus Cache zurück in Map konvertieren
            console.log('💾 Alle Assignment-Bewertungen aus Cache');
            gradesMap = new Map(cachedArray);
        } else {
            // Neu laden
            console.log('📥 Lade alle Assignment-Bewertungen aus Course Overview...');
            gradesMap = await fetchAllAssignmentGrades();

            // Map in Array konvertieren für Cache-Speicherung
            const arrayForCache = Array.from(gradesMap.entries());
            setCachedData(cacheKey, arrayForCache);
        }

        // Global speichern für schnellen Zugriff
        window.allAssignmentGrades = gradesMap;
    }

    // Bewertung für spezifisches Assignment holen
    const grade = window.allAssignmentGrades.get(assignId);

    if (grade) {
        console.log(`✓ Assignment ${assignId} gefunden:`, grade);
    } else {
        console.warn(`⚠️ Assignment ${assignId} hat keine Bewertung`);
    }

    return grade || null;
}

/**
 * Aktualisiert die Komponenten für die Fortschritt 2. Mitarbeitsnote (Prognose)
 * @param {Object} progressData - Fortschritts-Daten
 */
async function updatePrognosisComponents(progressData) {
    const componentsContainer = document.getElementById('mitarbeitProgressComponents');
    if (!componentsContainer) return;

    console.group('🔍 Prognose-Komponenten Debug');
    console.log('📌 Config Assignment-IDs:', EXTERNAL_CONFIG.prognosisAssignments);

    // Hole aktuellen Track und Referenztermin
    let currentTrack = localStorage.getItem('userTrack');
    // Fallback: Leite Track aus Klasse ab
    if (!currentTrack) {
        const userClass = localStorage.getItem('userClass');
        if (userClass && CLASS_TO_TRACK[userClass]) {
            currentTrack = CLASS_TO_TRACK[userClass];
        }
    }

    const referenztermin = currentTrack ? EXTERNAL_CONFIG.ReferenzterminMitarbeitsnote1[currentTrack] : null;
    const referenzDate = referenztermin ? new Date(referenztermin) : null;

    console.log('📅 Aktueller Track:', currentTrack);
    console.log('📅 Referenztermin:', referenztermin);

    // Bewertungen abrufen (await da async)
    console.log('🔎 Lade Review-Talk 2 (ID:', EXTERNAL_CONFIG.prognosisAssignments.reviewTalk2, ')');
    const reviewTalk2Data = await getAssignmentGrade(EXTERNAL_CONFIG.prognosisAssignments.reviewTalk2);
    console.log('✅ Review-Talk 2 Ergebnis:', reviewTalk2Data);

    console.log('🔎 Lade Code Review (ID:', EXTERNAL_CONFIG.prognosisAssignments.codeReview, ')');
    const codeReviewData = await getAssignmentGrade(EXTERNAL_CONFIG.prognosisAssignments.codeReview);
    console.log('✅ Code Review Ergebnis:', codeReviewData);

    // Prüfe ob Bewertungen nach Referenztermin sind
    let reviewTalk2Value = 0;
    let reviewTalk2Display = '-';
    if (reviewTalk2Data) {
        // Konvertiere gradedDate zu Date-Objekt, falls es ein String ist (Cache)
        const reviewTalk2GradedDate = reviewTalk2Data.gradedDate
            ? (typeof reviewTalk2Data.gradedDate === 'string'
                ? new Date(reviewTalk2Data.gradedDate)
                : reviewTalk2Data.gradedDate)
            : null;

        if (!referenzDate || !reviewTalk2GradedDate) {
            // Kein Referenztermin oder kein Bewertungsdatum -> verwende Bewertung
            reviewTalk2Value = reviewTalk2Data.value;
            reviewTalk2Display = reviewTalk2Data.display;
        } else if (reviewTalk2GradedDate > referenzDate) {
            // Bewertungsdatum ist nach Referenztermin -> verwende Bewertung
            reviewTalk2Value = reviewTalk2Data.value;
            reviewTalk2Display = reviewTalk2Data.display;
            console.log('✓ Review-Talk 2 ist nach Referenztermin');
        } else {
            // Bewertungsdatum ist vor/am Referenztermin -> ignoriere Bewertung
            console.log('⚠️ Review-Talk 2 ist vor Referenztermin, wird ignoriert');
        }
    }

    let codeReviewValue = 0;
    let codeReviewDisplay = '-';
    if (codeReviewData) {
        // Konvertiere gradedDate zu Date-Objekt, falls es ein String ist (Cache)
        const codeReviewGradedDate = codeReviewData.gradedDate
            ? (typeof codeReviewData.gradedDate === 'string'
                ? new Date(codeReviewData.gradedDate)
                : codeReviewData.gradedDate)
            : null;

        if (!referenzDate || !codeReviewGradedDate) {
            // Kein Referenztermin oder kein Bewertungsdatum -> verwende Bewertung
            codeReviewValue = codeReviewData.value;
            codeReviewDisplay = codeReviewData.display;
        } else if (codeReviewGradedDate > referenzDate) {
            // Bewertungsdatum ist nach Referenztermin -> verwende Bewertung
            codeReviewValue = codeReviewData.value;
            codeReviewDisplay = codeReviewData.display;
            console.log('✓ Code Review ist nach Referenztermin');
        } else {
            // Bewertungsdatum ist vor/am Referenztermin -> ignoriere Bewertung
            console.log('⚠️ Code Review ist vor Referenztermin, wird ignoriert');
        }
    }

    const quantitaet = progressData.fortschrittPercent || 0;
    const qualitaet = window.pflichtAveragePercentage || 0;
    console.log('📈 Quantität:', quantitaet, '| Qualität:', qualitaet);

    // Punkte für Quantität berechnen
    // C8 = Gesamte erreichte Punkte bis aktuelle Woche
    // MA1 = Punkte die in 1. MA erreicht wurden (kann über 100% sein)
    // MA1_max = Maximale Punkte für den MA1-Zeitraum
    // Bei Übertrag (MA1 > MA1_max): Nur MA1_max wird abgezogen, Rest ist Übertrag
    // Prognose = C8 - min(MA1, MA1_max) für konsistente Summen
    const debugInfo = progressData.debugInfo || {};
    const c8Total = debugInfo.C8 || 0; // Gesamte Punkte bis aktuelle Woche
    const ma1Reached = window.ma1ReachedPoints || (debugInfo.B10 * ((debugInfo.B3 / debugInfo.B4) * debugInfo.B7)) || 0;
    const ma1Max = window.ma1MaxPoints || ((debugInfo.B3 / debugInfo.B4) * debugInfo.B7) || 0;

    // Bei Übertrag: MA1 kann größer als MA1_max sein (z.B. 130%)
    // Für die Summe zählt nur min(MA1, MA1_max), der Rest ist Übertrag
    const ma1Capped = Math.min(ma1Reached, ma1Max); // Für Summenberechnung gedeckelt
    const uebertrag = Math.max(0, ma1Reached - ma1Max); // Übertrag bei >100%

    // Runde einmal, dann berechne Prognose als Differenz für Konsistenz
    const c8Rounded = Math.round(c8Total);
    const ma1CappedRounded = Math.round(ma1Capped);
    const prognoseReached = c8Rounded - ma1CappedRounded; // Garantiert: min(MA1,max) + Prognose = C8

    if (uebertrag > 0) {
        console.log(`✓ Übertrag aus 1. MA: ${Math.round(uebertrag)} Punkte (${((ma1Reached/ma1Max)*100).toFixed(1)}% erreicht)`);
    }

    const quantitaetMax = progressData.denominator || 0;
    const quantitaetPoints = `${prognoseReached}/${Math.round(quantitaetMax)}`;

    // Komponenten-Daten sammeln (value für Berechnung, display für Anzeige, points für Zusatzinfo)
    const components = [
        { name: 'Quantität', value: quantitaet, display: `${Math.round(quantitaet)}%`, points: quantitaetPoints },
        { name: 'Qualität', value: qualitaet, display: `${Math.round(qualitaet)}%` },
        { name: 'Review-Talk 2', value: reviewTalk2Value, display: reviewTalk2Display },
        { name: 'Code Review', value: codeReviewValue, display: codeReviewDisplay }
    ];

    // Gesamtnote nach Formel berechnen
    let numerator = 0;
    let denominator = 0;

    components.forEach(comp => {
        if (comp.value > 0) {
            numerator += comp.value;
            denominator += 1;
        }
    });

    const gesamtnote = denominator > 0 ? numerator / denominator : 0;

    // Gesamtnote oben anzeigen
    const fortschrittEl = document.getElementById('mitarbeitFortschrittPercent');
    if (fortschrittEl) {
        fortschrittEl.textContent = gesamtnote > 0 ? `${gesamtnote.toFixed(2).replace('.', ',')}%` : '-';
    }

    // Container leeren
    componentsContainer.innerHTML = '';

    // Komponenten-Elemente erstellen
    components.forEach(component => {
        const componentEl = document.createElement('div');
        componentEl.className = 'mitarbeit-component';

        const nameEl = document.createElement('div');
        nameEl.className = 'component-name';
        nameEl.textContent = component.name;

        const gradeEl = document.createElement('div');
        gradeEl.className = 'component-grade';
        // Bei Quantität auch Punkte anzeigen
        if (component.points) {
            gradeEl.innerHTML = `${component.display} <span style="color: #666; font-size: 0.85em; margin-left: 4px;">(${component.points})</span>`;
        } else {
            gradeEl.textContent = component.display;
        }

        componentEl.appendChild(nameEl);
        componentEl.appendChild(gradeEl);
        componentsContainer.appendChild(componentEl);
    });

    // Erwartete Note basierend auf Gesamtnote anzeigen
    const expectedGradeEl = document.getElementById('mitarbeitExpectedGrade');
    const expectedGradeNameEl = document.getElementById('mitarbeitExpectedGradeName');

    if (expectedGradeEl && expectedGradeNameEl && gesamtnote > 0) {
        const erwarteteNote = calculateIHKGrade(gesamtnote);

        // Note mit Tendenz
        let gradeDisplay = erwarteteNote.grade.toString();
        if (erwarteteNote.tendency) {
            gradeDisplay += erwarteteNote.tendency;
        }
        expectedGradeEl.textContent = gradeDisplay;

        // Notenname und Farbe
        const gradeConfig = EXTERNAL_CONFIG.grades[erwarteteNote.grade];
        if (gradeConfig) {
            expectedGradeNameEl.textContent = gradeConfig.name;
            expectedGradeEl.style.color = gradeConfig.color;
        }
    }

    console.log('📊 Finale Komponenten:', components.map(c => ({
        name: c.name,
        value: c.value,
        display: c.display
    })));
    console.log('🎯 Gesamtnote:', gesamtnote.toFixed(2));
    console.groupEnd();
}

/**
 * Load und display Mitarbeitsnote Daten
 * @param {boolean} useCache - Cache verwenden?
 */
async function loadMitarbeitsnote(useCache = true) {
    try {
        const gradeData = await fetchMitarbeitsnote(useCache);
        await updateMitarbeitsnoteCard(gradeData);

        // Background-Refresh bei Cache-Verwendung
        if (useCache && gradeData) {
            setTimeout(() => {
                console.log('📡 Mitarbeitsnote wird im Hintergrund aktualisiert...');
                loadMitarbeitsnote(false);
            }, 100);
        }
    } catch (error) {
        console.error('Fehler beim Laden der Mitarbeitsnote:', error);
        await updateMitarbeitsnoteCard(null); // Card ausblenden
    }
}

/**
 * Extrahiert Quantität-Wert aus Mitarbeitsnote-Daten
 * @param {Object} gradeData - Mitarbeitsnote-Daten mit components Array
 * @returns {number|null} - Quantität-Wert oder null wenn nicht gefunden
 */
function getQuantitaetFromGradeData(gradeData) {
    if (!gradeData || !gradeData.components || gradeData.components.length === 0) {
        console.warn('⚠️ Keine Komponenten in Mitarbeitsnote gefunden');
        return null;
    }

    const quantitaet = gradeData.components.find(c =>
        c.name.toLowerCase().includes('quantität') ||
        c.name.toLowerCase().includes('quantitat')
    );

    if (!quantitaet) {
        console.warn('⚠️ Quantität-Komponente nicht in Mitarbeitsnote gefunden. Verfügbare Komponenten:',
                     gradeData.components.map(c => c.name));
        return null;
    }

    console.log(`✓ Quantität gefunden: ${quantitaet.grade}%`);
    return quantitaet.grade;
}

/**
 * Berechnet Fortschritt zur 2. Mitarbeitsnote basierend auf Excel-Formel
 * @param {Object} currentGradeData - Aktuelle Mitarbeitsnote-Daten
 * @returns {Object|null} - { fortschrittPercent, erwarteteNote, debugInfo } oder null
 */
function calculateFortschritt2Mitarbeitsnote(currentGradeData) {
    // 1. Prerequisite checks
    const B7 = EXTERNAL_CONFIG.mitarbeitsnote1ReferenceWeek;
    if (!B7) {
        console.log('ℹ️ Keine Referenzwoche für 1. Mitarbeitsnote in config.js definiert');
        return null;
    }

    const C7 = currentReferenceWeek;

    // Nur berechnen wenn aktuelle Woche > Referenzwoche der 1. Mitarbeitsnote
    if (C7 <= B7) {
        console.log(`ℹ️ Fortschritt 2. Mitarbeitsnote nicht angezeigt: Aktuelle Woche (${C7}) <= Referenzwoche 1. MA (${B7})`);
        return null;
    }

    // 2. B10: Quantität aus 1. Mitarbeitsnote-Komponenten holen (historischer Wert)
    const quantitaet1MA = getQuantitaetFromGradeData(currentGradeData);
    if (quantitaet1MA === null) {
        console.warn('⚠️ Fortschritt kann nicht berechnet werden: Keine Quantität in 1. Mitarbeitsnote');
        return null;
    }

    // 3. avgPflicht aus window holen (referenzwochen-adjustiert!)
    if (typeof window.avgPflichtProgress === 'undefined') {
        console.warn('⚠️ Fortschritt kann nicht berechnet werden: avgPflichtProgress nicht verfügbar');
        return null;
    }
    const avgPflicht = window.avgPflichtProgress; // Ändert sich mit Referenzwoche!

    // 4. Checklisten-Daten prüfen
    if (!checklistData || checklistData.length === 0) {
        console.warn('⚠️ Fortschritt kann nicht berechnet werden: Keine Checklisten-Daten vorhanden');
        return null;
    }

    const checklistsWithPflicht = checklistData.filter(item =>
        !item.error && item.pflichtProgress !== null
    );

    if (checklistsWithPflicht.length === 0) {
        console.warn('⚠️ Fortschritt kann nicht berechnet werden: Keine Checklisten mit Pflichtabgaben');
        return null;
    }

    // 5. Variablen für Formel berechnen
    const B10 = quantitaet1MA / 100; // z.B. 20.00 / 100 = 0.20
    const B3 = checklistsWithPflicht.length * 100; // z.B. 24 * 100 = 2400
    const B4 = TOTAL_WEEKS; // z.B. 9

    // C8: Erreichte Punkte bis zur Referenzwoche C7 (aus Checklisten-Fortschritt)
    const C8 = (avgPflicht / 100) * ((B3 / B4) * C7); // z.B. (23 / 100) * ((2400/9) * 5) = 306

    // 6. Übertrag berechnen: D8 = MAX(0, (B10 - 1) * (B3/B4 * B7))
    const D8 = Math.max(0, (B10 - 1) * ((B3 / B4) * B7));

    if (D8 > 0) {
        console.log(`✓ Übertrag erkannt: ${D8.toFixed(2)} Punkte (1. Mitarbeitsnote Quantität hatte ${(B10*100).toFixed(2)}%)`);
    }

    // 7. Fortschritt berechnen: (C8 - (B10 * (B3/B4 * B7)) + D8) / ((B3/B4) * (C7-B7)) * 100
    const numerator = C8 - (B10 * ((B3 / B4) * B7)) + D8;
    const denominator = (B3 / B4) * (C7 - B7);

    // Division by zero check
    if (denominator === 0) {
        console.error('❌ Fortschritt kann nicht berechnet werden: Zeitraum ist 0 (Denominator = 0)');
        return null;
    }

    if (B3 === 0) {
        console.error('❌ Fortschritt kann nicht berechnet werden: B3 = 0 (keine Checklisten)');
        return null;
    }

    const fortschrittPercent = (numerator / denominator) * 100;

    // Warnung bei negativem Fortschritt
    if (fortschrittPercent < 0) {
        console.warn(`⚠️ Fortschritt ist negativ: ${fortschrittPercent.toFixed(2)}% - Dies kann auf Rückschritte hinweisen`);
    }

    // 8. Erwartete Note berechnen
    const erwarteteNote = calculateIHKGrade(fortschrittPercent);

    // 9. Debug-Info zusammenstellen
    const debugInfo = {
        B3, B4, B7, B10, C7, C8, D8,
        numerator, denominator,
        avgPflicht,
        quantitaet1MA,
        checklistCount: checklistsWithPflicht.length
    };

    // 10. Debug-Ausgabe
    console.group('🎯 Fortschritt 2. Mitarbeitsnote Berechnung');
    console.log('📊 Parameter:');
    console.table({
        'B3 (Total Punkte)': B3,
        'B4 (Total Wochen)': B4,
        'B7 (Ref.-Woche 1. MA)': B7,
        'B10 (Quantität 1. MA)': (B10 * 100).toFixed(2) + '%',
        'C7 (Aktuelle Ref.-Woche)': C7,
        'avgPflicht (ref-adj.)': avgPflicht.toFixed(2) + '%',
        'C8 (Punkte bis C7)': C8.toFixed(2),
        'D8 (Übertrag)': D8.toFixed(2),
        'MaxPunkte für C7': ((B3/B4) * C7).toFixed(2)
    });
    console.log('📈 Ergebnis:');
    console.log(`  Fortschritt: ${fortschrittPercent.toFixed(2)}%`);
    console.log(`  Erwartete Note: ${erwarteteNote.grade}${erwarteteNote.tendency || ''}`);
    console.log(`  Formel: (${numerator.toFixed(2)} / ${denominator.toFixed(2)}) * 100`);
    console.groupEnd();

    return {
        fortschrittPercent: fortschrittPercent,
        erwarteteNote: erwarteteNote,
        numerator: numerator,
        denominator: denominator,
        debugInfo: debugInfo
    };
}

/**
 * Prüft ob die Fortschritt 2. Mitarbeitsnote Cards angezeigt werden sollen
 * @returns {boolean}
 */
function shouldShowMitarbeitProgressCards() {
    // 1. Referenzwoche für 1. Mitarbeitsnote muss in config.js definiert sein
    const B7 = EXTERNAL_CONFIG.mitarbeitsnote1ReferenceWeek;
    if (!B7) return false;

    // 2. Aktuelle Referenzwoche muss größer sein als Referenzwoche der 1. Mitarbeitsnote
    if (currentReferenceWeek <= B7) return false;

    // 3. Aktuelle Mitarbeitsnote muss existieren
    const currentGradeData = getCachedData('mitarbeitsnote');
    if (!currentGradeData) return false;

    // 4. Quantität muss in aktueller Mitarbeitsnote vorhanden sein
    const currentQuantitaet = getQuantitaetFromGradeData(currentGradeData);
    if (currentQuantitaet === null) return false;

    return true;
}

async function extractFromChecklistIndex(useCache = true) {
    // Zeige Loading-Overlay für Checklisten-Stats
    showChecklistStatsLoading(true);

    // Prüfe Cache zuerst
    const cachedData = useCache ? getCachedData('checklists') : null;
    if (cachedData) {
        showCacheNotification('checklists');
        createCharts(cachedData);
        updateChecklistTable(cachedData);
        showChecklistStatsLoading(false); // Verstecke Loading nach Cache-Load

        // Background update starten
        setTimeout(() => {
            showCacheNotification('checklists', true);
            extractFromChecklistIndex(false); // ohne Cache
        }, 100);

        return;
    }

    showLoading(true);
    updateDashboardLoadingProgress(2, EXTERNAL_CONFIG.loading.progress.loadChecklists, EXTERNAL_CONFIG.loading.progress.loadChecklistsSub);
    console.log(EXTERNAL_CONFIG.debug.startingExtraction);

    try {
        const checklistIndexUrl = `https://lernplattform.mebis.bycs.de/mod/checklist/index.php?id=${COURSE_ID}`;

        const response = await fetch(checklistIndexUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const checklistLinks = Array.from(doc.querySelectorAll('a[href*="view.php?id="]'))
            .filter(link => link.getAttribute('href').startsWith('view.php?id='));

        console.log(`Found ${checklistLinks.length} checklist links`);
        // NICHT vorzeitig totalCount setzen - wird in updateStatistics() korrekt gesetzt

        updateDashboardLoadingProgress(2, `${checklistLinks.length} Checklisten gefunden`, 'Lade Details...');
        // Sofortige UI-Updates für bessere Performance
        const step3 = document.getElementById('step3');
        if (step3) {
            step3.className = 'progress-step completed';
            step3.innerHTML = `✓ ${checklistLinks.length} Checklisten gefunden`;
        }

        if (checklistLinks.length === 0) {
            console.warn('No checklist links found in HTML. Checking for alternative selectors...');
            const allLinks = Array.from(doc.querySelectorAll('a[href*="view.php"]'));
            console.log(EXTERNAL_CONFIG.debug.allLinksFound, allLinks.length);
            if (allLinks.length > 0) {
                console.log(EXTERNAL_CONFIG.debug.firstFewLinks, allLinks.slice(0, 3).map(l => l.textContent.trim()));
            }
            throw new Error('No checklist links found');
        }

        // Optimized parallel loading with concurrency limit
        const CONCURRENT_LIMIT = EXTERNAL_CONFIG.system.concurrentLimit; // Load max checklists at once
        const totalChecklists = checklistLinks.length;
        let completedCount = 0;

        console.log(`Starting to load ${totalChecklists} checklists with concurrency limit of ${CONCURRENT_LIMIT}`);

        let timeoutCount = 0;
        const maxTimeouts = 12; // Weniger restriktiv - mehr Versuche

        const loadWithProgress = async (link, index) => {
            const name = link.textContent.trim();
            const url = `https://lernplattform.mebis.bycs.de/mod/checklist/${link.getAttribute('href')}`;

            // Fail-Fast: Skip bei zu vielen Timeouts
            if (timeoutCount >= maxTimeouts) {
                completedCount++;
                updateLoadingProgress(completedCount, totalChecklists);
                return { name: `${name} (Übersprungen)`, url, pflichtProgress: 0, gesamtProgress: 0, error: "Server überlastet - übersprungen" };
            }

            try {
                const data = await loadSingleChecklist(url);
                completedCount++;

                // Update loading indicator with progress
                updateLoadingProgress(completedCount, totalChecklists);

                return { name, url, ...data };
            } catch (error) {
                completedCount++;
                if (error.message.includes('Timeout')) {
                    timeoutCount++;
                }
                console.warn(`Failed to load checklist ${name}:`, error.message);
                trackConnectionError(`Checkliste: ${name}`, false);
                updateLoadingProgress(completedCount, totalChecklists);
                return { name: `${name} (Fehler)`, url, pflichtProgress: 0, gesamtProgress: 0, error: error.message };
            }
        };

        // Process checklists in batches with concurrency limit + server-friendly delays
        const results = [];
        for (let i = 0; i < checklistLinks.length; i += CONCURRENT_LIMIT) {
            const batch = checklistLinks.slice(i, i + CONCURRENT_LIMIT);
            const batchPromises = batch.map((link, batchIndex) => loadWithProgress(link, i + batchIndex));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Kurze Pause zwischen Batches um Server zu schonen (außer letzter Batch)
            if (i + CONCURRENT_LIMIT < checklistLinks.length) {
                const delay = EXTERNAL_CONFIG.system.batchDelay || 500;
                console.log(`Batch ${Math.ceil((i + CONCURRENT_LIMIT) / CONCURRENT_LIMIT)} von ${Math.ceil(checklistLinks.length / CONCURRENT_LIMIT)} geladen, Pause: ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        console.log(EXTERNAL_CONFIG.debug.allPromisesResolved, results.length);
        const valid = results.filter(item => !item.error);
        const errors = results.filter(item => item.error);

        console.log(`Valid checklists: ${valid.length}, Errors: ${errors.length}`);
        if (errors.length > 0) {
            console.warn('Checklist loading errors:', errors.map(e => `${e.name}: ${e.error}`));
        }

        // Minimum Data Check: Sogar bei wenigen Daten fortfahren
        if (valid.length === 0) {
            console.error('No valid checklists loaded!');
            throw new Error('All checklist detail loads failed');
        }

        // Performance-Info für User
        if (errors.length > valid.length) {
            console.warn(`⚠️ Server-Performance schlecht: ${errors.length} Fehler von ${results.length} Checklisten`);
            updateDashboardLoadingProgress(2, EXTERNAL_CONFIG.loading.progress.serverSlow, `${valid.length}/${results.length} Checklisten verfügbar`);
        } else if (errors.length > 0) {
            updateDashboardLoadingProgress(2, EXTERNAL_CONFIG.loading.progress.serverTimeout, `${errors.length} Checklisten übersprungen`);
        }
        
        console.log(EXTERNAL_CONFIG.debug.creatingCharts, valid);

        // Cache die erfolgreichen Daten
        setCachedData('checklists', valid);

        createCharts(valid);
        updateChecklistTable(valid);

    } catch (err) {
        console.error('extractFromChecklistIndex error:', err);
        checklistData = [];
        
        // Show user-friendly error message
        const sessionInfo = document.getElementById('sessionInfo');
        if (sessionInfo) {
            sessionInfo.innerHTML = `<div style="color: #dc3545; padding: 20px; text-align: center;">
                <strong>Fehler beim Laden der Checklisten:</strong><br>
                ${err.message}<br>
                <small>Überprüfen Sie die Netzwerkverbindung und versuchen Sie es erneut.</small>
            </div>`;
        }
    } finally {
        showLoading(false);
    }
}

async function loadSingleChecklist(url, retryCount = 0) {
    const isRetry = retryCount > 0;
    const TIMEOUT_MS = isRetry ? EXTERNAL_CONFIG.system.retryTimeoutMs : EXTERNAL_CONFIG.system.timeoutMs;

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS);
    });

    const fetchPromise = fetch(url, {
        credentials: 'same-origin',
        signal: AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined
    }).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.text();
    });

    try {
        const html = await Promise.race([fetchPromise, timeoutPromise]);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const progressBars = doc.querySelectorAll('.checklist_progress_inner');

        if (progressBars.length >= 2) {
            // Checkliste hat Pflichtelemente UND Alle Elemente
            const pflichtStyle = progressBars[0].getAttribute('style') || '';
            const gesamtStyle = progressBars[1].getAttribute('style') || '';

            const pflichtMatch = pflichtStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
            const gesamtMatch = gesamtStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);

            const pflichtProgress = pflichtMatch ? parseFloat(pflichtMatch[1]) : 0;
            const gesamtProgress = gesamtMatch ? parseFloat(gesamtMatch[1]) : 0;

            return { pflichtProgress, gesamtProgress };
        } else if (progressBars.length === 1) {
            // Checkliste hat NUR "Alle Elemente" (keine Pflichtelemente)
            const gesamtStyle = progressBars[0].getAttribute('style') || '';
            const gesamtMatch = gesamtStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
            const gesamtProgress = gesamtMatch ? parseFloat(gesamtMatch[1]) : 0;

            return { pflichtProgress: null, gesamtProgress }; // null = keine Pflichtelemente vorhanden
        }

        return { pflichtProgress: 0, gesamtProgress: 0 };
    } catch (error) {
        // Retry logic: Bei erstem Timeout retry mit längerem Timeout
        if (error.message === 'Request timeout' && retryCount === 0) {
            console.warn(`Timeout für ${url}, versuche erneut mit ${EXTERNAL_CONFIG.system.retryTimeoutMs}ms...`);
            return await loadSingleChecklist(url, 1);
        }

        if (error.message === 'Request timeout') {
            throw new Error(`Timeout beim Laden der Checkliste (${TIMEOUT_MS}ms)`);
        }
        throw error;
    }
}

function createCharts(data) {
    checklistData = data;
    document.getElementById('filterSection').style.display = 'block';
    updateReferenceWeekLabels(); // Labels beim ersten Laden aktualisieren
    initCharts();
    updateCharts();
    updateStatistics();
    updateChecklistTable(data);
    generateInsights();
    // dashboardContainer element not found - removing this line
    showBothStatsRows();
    
    // Check if both datasets are loaded and hide dashboard loading
    checkAndHideDashboardLoading();
}

function updateStatistics() {
    const validChecklists = checklistData.filter(item => !item.error);
    const totalChecklists = validChecklists.length;

    if (totalChecklists > 0) {
        // Nur Checklisten MIT Pflichtelementen für Pflicht-Durchschnitt berücksichtigen
        const checklistsWithPflicht = validChecklists.filter(item => item.pflichtProgress !== null);
        const pflichtCount = checklistsWithPflicht.length;

        // Summen berechnen für Zähler/Nenner-Anzeige
        const sumPflicht = pflichtCount > 0
            ? checklistsWithPflicht.reduce((sum, item) => sum + (item.pflichtProgress || 0), 0)
            : 0;
        const sumGesamt = validChecklists.reduce((sum, item) => sum + (item.gesamtProgress || 0), 0);

        // Ursprüngliche Werte berechnen
        const avgPflicht = pflichtCount > 0 ? sumPflicht / pflichtCount : 0;
        const avgGesamt = sumGesamt / totalChecklists;
        const completed = checklistsWithPflicht.filter(item => item.pflichtProgress >= 100).length;

        // Referenzwochen-adjustierte Werte berechnen
        const referenceAvgPflicht = calculateReferenceProgressFromPercentage(avgPflicht, pflichtCount);
        const referenceAvgGesamt = calculateReferenceProgressFromPercentage(avgGesamt, totalChecklists);
        const referenceCompleted = calculateReferenceProgress(completed, pflichtCount);

        // Zähler und Nenner für Anzeige berechnen
        const maxPunktePflicht = pflichtCount * 100;
        const maxPunkteGesamt = totalChecklists * 100;
        const expectedPunktePflicht = (maxPunktePflicht / TOTAL_WEEKS) * currentReferenceWeek;
        const expectedPunkteGesamt = (maxPunkteGesamt / TOTAL_WEEKS) * currentReferenceWeek;

        // Referenzwochen-adjustierten avgPflicht für Mitarbeitsnote-Berechnung verfügbar machen
        window.avgPflichtProgress = referenceAvgPflicht;

        console.log('Statistics Update:', {
            totalChecklists,
            checklistsWithPflicht: pflichtCount,
            originalAvg: { pflicht: avgPflicht, gesamt: avgGesamt },
            referenceAvg: { pflicht: referenceAvgPflicht, gesamt: referenceAvgGesamt },
            completed: completed,
            referenceWeek: currentReferenceWeek
        });

        updateCombinedStats(completed, pflichtCount, referenceCompleted);
        updateProgressDisplay(
            currentReferenceWeek === TOTAL_WEEKS ? Math.round(referenceAvgPflicht) : Math.ceil(referenceAvgPflicht),
            currentReferenceWeek === TOTAL_WEEKS ? Math.round(referenceAvgGesamt) : Math.ceil(referenceAvgGesamt),
            sumPflicht,
            expectedPunktePflicht,
            sumGesamt,
            expectedPunkteGesamt
        );

        // Verstecke Loading-Overlay wenn alle Daten geladen sind
        showChecklistStatsLoading(false);
    }
}

function animateNumber(elementId, targetValue, suffix = '') {
    const element = document.getElementById(elementId);
    const currentValue = parseInt(element.textContent) || 0;
    const increment = (targetValue - currentValue) / 30;

    let current = currentValue;
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= targetValue) || (increment < 0 && current <= targetValue)) {
            current = targetValue;
            clearInterval(timer);
        }
        element.textContent = Math.round(current) + suffix;
    }, 50);
}

function updateProgressBar(color, value) {
    const progressBar = document.getElementById('progressBar');
    progressBar.style.backgroundColor = color;
    progressBar.style.width = `${value}%`;
}

// Global object to store active animation timers
const activeProgressBarTimers = {};

function animateProgressBar(textElementId, barElementId, targetValue) {
    const textElement = document.getElementById(textElementId);
    const barElement = document.getElementById(barElementId);

    if (!textElement || !barElement) {
        console.error('Progress bar elements not found:', { textElement, barElement });
        return;
    }

    // Clear any existing timer for this progress bar
    const timerId = `${textElementId}_${barElementId}`;
    if (activeProgressBarTimers[timerId]) {
        clearInterval(activeProgressBarTimers[timerId]);
        delete activeProgressBarTimers[timerId];
    }

    const successColor = getCssVariable('--success-color');
    const warningColor = getCssVariable('--warning-color');
    const dangerColor = getCssVariable('--danger-color');

    // Allow text to show values over 100%, but cap bar width at 100%
    const textTargetValue = Math.max(0, Math.round(targetValue || 0));
    const barTargetValue = Math.min(100, textTargetValue); // Visual bar capped at 100%

    const initialText = textElement.textContent.replace('%', '') || '0';
    const initialValue = parseInt(initialText) || 0;
    const textIncrement = (textTargetValue - initialValue) / 40;
    const barIncrement = (barTargetValue - Math.min(100, initialValue)) / 40;

    let currentTextValue = initialValue;
    let currentBarValue = Math.min(100, initialValue);

    const timer = setInterval(() => {
        currentTextValue += textIncrement;
        currentBarValue += barIncrement;
        
        if ((textIncrement > 0 && currentTextValue >= textTargetValue) || (textIncrement < 0 && currentTextValue <= textTargetValue)) {
            currentTextValue = textTargetValue;
            currentBarValue = barTargetValue;
            clearInterval(timer);
            delete activeProgressBarTimers[timerId];
        }

        const roundedTextValue = Math.round(currentTextValue);
        const roundedBarValue = Math.round(currentBarValue);
        
        // Text can show over 100%
        textElement.textContent = roundedTextValue + '%';
        // Bar width capped at 100%
        barElement.style.width = roundedBarValue + '%';

        // Dynamische Farben basierend auf Fortschritt (use text value for color logic)
        let textColor, barColor;
        if (roundedTextValue >= 100) {
            textColor = barColor = '#10b981'; // Special green for >100%
        } else if (roundedTextValue >= 80) {
            textColor = barColor = successColor;
        } else if (roundedTextValue >= 60) {
            textColor = barColor = '#6cc04a';
        } else if (roundedTextValue >= 40) {
            textColor = barColor = warningColor;
        } else if (roundedTextValue >= 20) {
            textColor = barColor = '#fd7e14';
        } else {
            textColor = barColor = dangerColor;
        }
        
        // Apply colors to both text and bar
        // Override CSS gradient for dynamic color on text
        textElement.style.background = 'none';
        textElement.style.webkitTextFillColor = textColor;
        textElement.style.color = textColor;
        barElement.style.background = barColor;
    }, 40);

    // Store the timer reference
    activeProgressBarTimers[timerId] = timer;
}


function getCssVariable(variableName) {
    return getComputedStyle(document.documentElement)
        .getPropertyValue(variableName).trim();
}

// Beispiel: Verwendung der Farben in einer Funktion
function getProgressColor(progress) {
    const successColor = getCssVariable('--success-color');
    const warningColor = getCssVariable('--warning-color');
    const dangerColor = getCssVariable('--danger-color');

    if (progress >= 80) return successColor;
    if (progress >= 60) return '#6cc04a'; // Hellgrün (kann auch als CSS-Variable definiert werden)
    if (progress >= 40) return warningColor;
    if (progress >= 20) return '#fd7e14'; // Orange (kann auch als CSS-Variable definiert werden)
    return dangerColor;
}

// Beispiel: Dynamische Änderung einer CSS-Variable
function setThemeColor(variableName, colorValue) {
    document.documentElement.style.setProperty(variableName, colorValue);
}


function updateCombinedStats(completed, total, referencePercentage = null) {
    const completedElement = document.getElementById('completedCount');
    const totalElement = document.getElementById('totalCount');
    const percentageElement = document.getElementById('completionPercentage');
    const ringElement = document.getElementById('completionRing');

    if (!completedElement || !totalElement || !percentageElement || !ringElement) {
        // Retry after a short delay if elements are not ready yet
        setTimeout(() => updateCombinedStats(completed, total, referencePercentage), 100);
        return;
    }

    // Bei letzter Woche: Original-Total anzeigen, sonst erwartete Anzahl
    const expectedTotal = currentReferenceWeek === TOTAL_WEEKS ?
        total :
        Math.ceil((total / TOTAL_WEEKS) * currentReferenceWeek);

    // Funktion für Ring-Update
    const updateRing = (percentage) => {
        const circumference = 2 * Math.PI * 25;
        const visualPercentage = Math.min(100, percentage);
        const offset = circumference - (visualPercentage / 100) * circumference;

        ringElement.style.strokeDashoffset = offset;
        percentageElement.textContent = percentage + '%';

        const color = percentage >= 100 ? '#10b981' : getProgressColor(percentage);
        ringElement.style.stroke = color;
        percentageElement.style.color = color;
    };

    // Berechne sofort den korrekten Prozentsatz für initiale Anzeige
    const immediatePercentage = expectedTotal > 0 ? Math.round((completed / expectedTotal) * 100) : 0;

    // Ring und Text sofort mit korrektem Wert setzen
    updateRing(immediatePercentage);

    // Prüfe ob Animation nötig ist
    const currentDisplayed = parseInt(completedElement.textContent) || 0;
    const needsAnimation = currentDisplayed !== completed;

    if (needsAnimation) {
        animateNumber('completedCount', completed);

        // Warte bis Animation abgeschlossen ist (30 * 50ms + Buffer), dann berechne Prozentsatz basierend auf tatsächlich angezeigten Werten
        setTimeout(() => {
            const displayedCompleted = parseInt(completedElement.textContent) || 0;
            const displayedTotal = parseInt(totalElement.textContent) || 0;
            const percentage = displayedTotal > 0 ? Math.round((displayedCompleted / displayedTotal) * 100) : 0;

            // Nur updaten wenn sich der Prozentsatz geändert hat
            if (percentage !== immediatePercentage) {
                updateRing(percentage);
            }
        }, 1600);
    } else {
        completedElement.textContent = completed;
    }

    totalElement.textContent = expectedTotal;
}

function updatePflichtStats() {
    if (!window.pflichtData || window.pflichtData.length === 0) {
        console.log('No pflichtData available');
        return;
    }

    // Nur Pflichtabgaben für Statistiken berücksichtigen
    const pflichtOnly = window.pflichtData.filter(item => item.isPflicht === true);

    const totalPflicht = pflichtOnly.length;
    // Bewertet und Abgegeben zählen als "erledigt"
    const completedPflicht = pflichtOnly.filter(item =>
        item.completionStatus === 'Bewertet' ||
        item.completionStatus === 'Abgegeben' ||
        item.completionStatus === 'Erledigt'
    ).length;

    // Referenzwochen-adjustierte Werte berechnen
    const referencePflichtProgress = calculateReferenceProgress(completedPflicht, totalPflicht);

    const gradedItems = pflichtOnly.filter(item => {
        return getGradeValueForCalculation(item) !== null;
    });

    // Für Prognose 2. MA: Nur Pflichtabgaben nach dem Referenztermin berücksichtigen
    // Hole Track und Referenztermin
    let currentTrack = localStorage.getItem('userTrack');
    if (!currentTrack) {
        const userClass = localStorage.getItem('userClass');
        if (userClass && CLASS_TO_TRACK[userClass]) {
            currentTrack = CLASS_TO_TRACK[userClass];
        }
    }
    const referenztermin = currentTrack ? EXTERNAL_CONFIG.ReferenzterminMitarbeitsnote1[currentTrack] : null;
    const referenzDate = referenztermin ? new Date(referenztermin) : null;

    // Filtere bewertete Items nach Referenztermin für Prognose-Qualität
    const gradedItemsForPrognose = gradedItems.filter(item => {
        if (!referenzDate || !window.allAssignmentGrades) return true; // Fallback: alle verwenden

        // Extrahiere cmid aus URL
        const cmidMatch = item.url?.match(/[?&]id=(\d+)/);
        if (!cmidMatch) return true; // Kein cmid -> verwenden

        const cmid = parseInt(cmidMatch[1]);
        const gradeData = window.allAssignmentGrades.get(cmid);
        if (!gradeData?.gradedDate) return true; // Kein Datum -> verwenden

        // Konvertiere String zu Date, falls nötig (Cache-Serialisierung)
        const gradedDate = typeof gradeData.gradedDate === 'string'
            ? new Date(gradeData.gradedDate)
            : gradeData.gradedDate;

        // Nur Items nach Referenztermin für Prognose
        return gradedDate > referenzDate;
    });

    console.log(`📊 Qualität: ${gradedItems.length} bewertete Pflichtabgaben gesamt, ${gradedItemsForPrognose.length} nach Referenztermin (${referenztermin || 'nicht gesetzt'})`);

    let averageGradeDisplay = '-';
    if (gradedItems.length > 0) {
        // Calculate average percentage using mixed grading system (für Anzeige im Pflichtabgaben-Tab)
        const totalPercentage = gradedItems.reduce((sum, item) => {
            return sum + getGradeValueForCalculation(item);
        }, 0);
        const averagePercentage = totalPercentage / gradedItems.length;

        // Für Prognose: Nur Pflichtabgaben nach Referenztermin
        let averagePercentagePrognose = 0;
        if (gradedItemsForPrognose.length > 0) {
            const totalPercentagePrognose = gradedItemsForPrognose.reduce((sum, item) => {
                return sum + getGradeValueForCalculation(item);
            }, 0);
            averagePercentagePrognose = totalPercentagePrognose / gradedItemsForPrognose.length;
        }

        // Global speichern für Prognose-Komponenten (nur Pflichtabgaben nach Referenztermin)
        window.pflichtAveragePercentage = averagePercentagePrognose;

        // Calculate IHK grade from average percentage
        const ihkGradeInfo = calculateIHKGrade(averagePercentage);
        let tendencyText = '';
        if (ihkGradeInfo.tendency === '+') tendencyText = '+';
        else if (ihkGradeInfo.tendency === '-') tendencyText = '-';

        averageGradeDisplay = `${ihkGradeInfo.grade}${tendencyText} (${Math.round(averagePercentage)}%)`;
    } else {
        window.pflichtAveragePercentage = 0;
    }

    const averageGradeElement = document.getElementById('pflichtAverageGrade');
    if (averageGradeElement) {
        averageGradeElement.textContent = averageGradeDisplay;
        if (averageGradeDisplay !== '-') {
            // Extract grade number for color calculation
            const gradeMatch = averageGradeDisplay.match(/^(\d)/);
            if (gradeMatch) {
                const gradeColor = getGradeColorFromNumber(parseInt(gradeMatch[1]));
                averageGradeElement.style.color = gradeColor;
            }
        }
    }

    updatePflichtCombinedStats(completedPflicht, totalPflicht, referencePflichtProgress);
    updateReferenceWeekLabels(); // Labels auch bei Pflichtabgaben aktualisieren
    showBothStatsRows();
}

function updatePflichtCombinedStats(completed, total, referencePercentage = null) {
    const completedElement = document.getElementById('pflichtCompletedCount');
    const totalElement = document.getElementById('pflichtTotalCount');
    const percentageElement = document.getElementById('pflichtCompletionPercentage');
    const ringElement = document.getElementById('pflichtCompletionRing');

    if (!completedElement || !totalElement || !percentageElement || !ringElement) {
        // Retry after a short delay if elements are not ready yet
        setTimeout(() => updatePflichtCombinedStats(completed, total, referencePercentage), 100);
        return;
    }

    // Bei letzter Woche: Original-Total anzeigen, sonst erwartete Anzahl
    const expectedTotal = currentReferenceWeek === TOTAL_WEEKS ?
        total :
        Math.ceil((total / TOTAL_WEEKS) * currentReferenceWeek);

    // Funktion für Ring-Update
    const updateRing = (percentage) => {
        const circumference = 2 * Math.PI * 25;
        const visualPercentage = Math.min(100, percentage);
        const offset = circumference - (visualPercentage / 100) * circumference;

        ringElement.style.strokeDashoffset = offset;
        percentageElement.textContent = percentage + '%';

        const color = percentage >= 100 ? '#10b981' : getProgressColor(percentage);
        ringElement.style.stroke = color;
        percentageElement.style.color = color;
    };

    // Berechne sofort den korrekten Prozentsatz für initiale Anzeige
    const immediatePercentage = expectedTotal > 0 ? Math.round((completed / expectedTotal) * 100) : 0;

    // Ring und Text sofort mit korrektem Wert setzen
    updateRing(immediatePercentage);

    // Completed-Wert nur animieren, wenn er sich tatsächlich geändert hat (nicht bei Reference Week Changes)
    const currentCompleted = parseInt(completedElement.textContent) || 0;
    if (currentCompleted !== completed) {
        animateNumber('pflichtCompletedCount', completed);
    } else {
        completedElement.textContent = completed; // Stelle sicher, dass der korrekte Wert angezeigt wird
    }
    totalElement.textContent = expectedTotal;

    // Warte bis Animation abgeschlossen ist (30 * 50ms + Buffer), dann berechne Prozentsatz basierend auf tatsächlich angezeigten Werten
    setTimeout(() => {
        const displayedCompleted = parseInt(completedElement.textContent) || 0;
        const displayedTotal = parseInt(totalElement.textContent) || 0;
        const percentage = displayedTotal > 0 ? Math.round((displayedCompleted / displayedTotal) * 100) : 0;

        updateRing(percentage);
    }, 1600);
}

let currentPflichtAvg = 0;
let currentGesamtAvg = 0;

function updateProgressDisplay(pflichtAvg, gesamtAvg, sumPflicht, expectedPunktePflicht, sumGesamt, expectedPunkteGesamt) {
    currentPflichtAvg = pflichtAvg;
    currentGesamtAvg = gesamtAvg;

    // Zähler/Nenner für spätere Verwendung speichern
    window.currentProgressDetails = {
        pflicht: { sum: sumPflicht, expected: expectedPunktePflicht },
        gesamt: { sum: sumGesamt, expected: expectedPunkteGesamt }
    };

    const selectedRadio = document.querySelector('input[name="progressType"]:checked');
    const selectedType = selectedRadio ? selectedRadio.value : 'pflicht';
    const targetValue = selectedType === 'pflicht' ? pflichtAvg : gesamtAvg;

    animateProgressBar('avgCompletionText', 'avgCompletionBar', targetValue);

    // Zähler/Nenner anzeigen
    updateProgressDetails(selectedType);

    // Grade always based on Pflicht, never Gesamt
    updateIHKGrade(pflichtAvg);
}

function updateProgressDetails(type) {
    const detailsEl = document.getElementById('avgCompletionDetails');
    if (!detailsEl || !window.currentProgressDetails) return;

    const details = window.currentProgressDetails[type];
    if (!details) return;

    detailsEl.textContent = `${Math.round(details.sum)} / ${Math.round(details.expected)} Punkte`;
}

function calculateIHKGrade(percentage) {
    let grade, tendency = '';

    // Verwende Schwellenwerte dynamisch aus Config (EXTERNAL_CONFIG.grades)
    const grades = EXTERNAL_CONFIG.grades;

    if (percentage > grades[1].threshold) {  // Note 1
        grade = 1;
        if (percentage >= 98) tendency = '+';
        else if (percentage <= grades[1].threshold + 2) tendency = '-';
    } else if (percentage > grades[2].threshold) {  // Note 2
        grade = 2;
        if (percentage >= 90) tendency = '+';
        else if (percentage <= grades[2].threshold + 2) tendency = '-';
    } else if (percentage > grades[3].threshold) {  // Note 3
        grade = 3;
        if (percentage >= 79) tendency = '+';
        else if (percentage <= grades[3].threshold + 2) tendency = '-';
    } else if (percentage > grades[4].threshold) {  // Note 4
        grade = 4;
        if (percentage >= 65) tendency = '+';
        else if (percentage <= grades[4].threshold + 2) tendency = '-';
    } else if (percentage > grades[5].threshold) {  // Note 5
        grade = 5;
        if (percentage >= 48) tendency = '+';
        else if (percentage <= grades[5].threshold + 2) tendency = '-';
    } else {  // Note 6
        grade = 6;
        if (percentage >= 28) tendency = '+';
        else if (percentage <= 10) tendency = '-';
    }

    return { grade, tendency };
}

function updateIHKGrade(percentage) {
    const gradeInfo = calculateIHKGrade(percentage);
    const gradeText = document.getElementById('ihkGradeText');
    const gradePercentage = document.getElementById('ihkGradePercentage');
    const gradeTendency = document.getElementById('ihkGradeTendency');
    const ihkGradeCard = document.getElementById('ihkGradeCard');

    // IHK Card ausblenden, wenn 1. Mitarbeitsnote existiert
    const currentGradeData = getCachedData('mitarbeitsnote');
    if (currentGradeData && ihkGradeCard) {
        ihkGradeCard.style.display = 'none';
        return;
    } else if (ihkGradeCard) {
        ihkGradeCard.style.display = 'block';
    }

    gradeText.textContent = gradeInfo.grade;
    gradePercentage.textContent = Math.round(percentage) + '%';

    if (gradeInfo.grade <= 2) {
        gradeText.style.color = '#28a745'; // Grün
    } else if (gradeInfo.grade <= 4) {
        gradeText.style.color = '#ffc107'; // Gelb
    } else {
        gradeText.style.color = '#dc3545'; // Rot
    }

    if (gradeInfo.tendency === '+') {
        gradeTendency.textContent = 'Tendenz: +';
        gradeTendency.className = 'ihk-grade-tendency positive';
    } else if (gradeInfo.tendency === '-') {
        gradeTendency.textContent = 'Tendenz: -';
        gradeTendency.className = 'ihk-grade-tendency negative';
    } else {
        gradeTendency.textContent = '';
        gradeTendency.className = 'ihk-grade-tendency';
    }
}

function toggleProgressType() {
    const selectedType = document.querySelector('input[name="progressType"]:checked').value;
    const pflichtLabel = document.getElementById('pflichtLabel');
    const gesamtLabel = document.getElementById('gesamtLabel');
    const progressLabel = document.getElementById('progressLabel');

    if (selectedType === 'pflicht') {
        pflichtLabel.classList.add('active');
        gesamtLabel.classList.remove('active');
        progressLabel.textContent = 'Checkliste Durchschnitt';
        animateProgressBar('avgCompletionText', 'avgCompletionBar', currentPflichtAvg);
        updateProgressDetails('pflicht');
        // Grade always based on Pflicht, never Gesamt
        updateIHKGrade(currentPflichtAvg);
    } else {
        pflichtLabel.classList.remove('active');
        gesamtLabel.classList.add('active');
        progressLabel.textContent = 'Checkliste Durchschnitt';
        animateProgressBar('avgCompletionText', 'avgCompletionBar', currentGesamtAvg);
        updateProgressDetails('gesamt');
        // Grade always based on Pflicht, never Gesamt
        updateIHKGrade(currentPflichtAvg);
    }
}

function generateInsights() {
    const validChecklists = checklistData.filter(item => !item.error);

    if (validChecklists.length === 0) return;

    const avgPflicht = validChecklists.reduce((sum, item) => sum + (item.pflichtProgress || 0), 0) / validChecklists.length;
    const avgGesamt = validChecklists.reduce((sum, item) => sum + (item.gesamtProgress || 0), 0) / validChecklists.length;

    let pflichtInsight = '';
    if (avgPflicht >= 80) {
        pflichtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-success"></use></svg>Ausgezeichneter Fortschritt! Die meisten Pflichtabgaben sind erfüllt.';
    } else if (avgPflicht >= 50) {
        pflichtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-warning"></use></svg>Guter Fortschritt, aber es gibt noch Verbesserungspotential.';
    } else {
        pflichtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-alert"></use></svg>Mehr Fokus auf Pflichtabgaben empfohlen.';
    }

    let gesamtInsight = '';
    if (avgGesamt >= 80) {
        gesamtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-celebrate"></use></svg>Hervorragender Gesamtfortschritt!';
    } else if (avgGesamt >= 50) {
        gesamtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-trending"></use></svg>Solider Fortschritt in allen Bereichen.';
    } else {
        gesamtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-target"></use></svg>Konzentration auf mehr Aufgaben erforderlich.';
    }

    document.getElementById('filterSection').style.display = 'block';
}

function validateSliders(changedSlider) {
    const minSlider = document.getElementById('progressFilterMin');
    const maxSlider = document.getElementById('progressFilterMax');
    const minValueDisplay = document.getElementById('minProgressValue');
    const maxValueDisplay = document.getElementById('maxProgressValue');

    if (!minSlider || !maxSlider) return;

    let minValue = parseInt(minSlider.value);
    let maxValue = parseInt(maxSlider.value);

    if (changedSlider === 'min' && minValue > maxValue) {
        maxValue = minValue;
        maxSlider.value = maxValue;
    } else if (changedSlider === 'max' && maxValue < minValue) {
        minValue = maxValue;
        minSlider.value = minValue;
    }

    minValueDisplay.textContent = minValue + '%';
    maxValueDisplay.textContent = maxValue + '%';

    // Nur applyFilters aufrufen wenn es kein init-Aufruf ist
    if (changedSlider !== 'init') {
        applyFilters();
    }
}

function initSliders() {
    const minSlider = document.getElementById('progressFilterMin');
    const maxSlider = document.getElementById('progressFilterMax');

    if (!minSlider || !maxSlider) return;

    validateSliders('init');
}

function applyFilters() {
    // Prüfen ob Daten vorhanden sind
    if (!checklistData || checklistData.length === 0) {
        return;
    }
    
    const viewFilter = document.getElementById('viewFilter').value;
    const sortFilter = document.getElementById('sortFilter').value;
    const progressFilterMinEl = document.getElementById('progressFilterMin');
    const progressFilterMaxEl = document.getElementById('progressFilterMax');

    const progressFilterMin = progressFilterMinEl ? progressFilterMinEl.value : 0;
    const progressFilterMax = progressFilterMaxEl ? progressFilterMaxEl.value : 100;

    let filteredData = checklistData.filter(item => !item.error);

    switch(viewFilter) {
        case 'completed':
            filteredData = filteredData.filter(item => item.pflichtProgress >= 100);
            break;
        case 'pending':
            filteredData = filteredData.filter(item => item.pflichtProgress < 100);
            break;
        case 'high':
            filteredData = filteredData.filter(item => item.pflichtProgress > 75);
            break;
    }

    filteredData = filteredData.filter(item => item.pflichtProgress >= progressFilterMin && item.pflichtProgress <= progressFilterMax);

    switch(sortFilter) {
        case 'pflicht-desc':
            filteredData.sort((a, b) => (b.pflichtProgress || 0) - (a.pflichtProgress || 0));
            break;
        case 'pflicht-asc':
            filteredData.sort((a, b) => (a.pflichtProgress || 0) - (b.pflichtProgress || 0));
            break;
        case 'gesamt-desc':
            filteredData.sort((a, b) => (b.gesamtProgress || 0) - (a.gesamtProgress || 0));
            break;
        case 'gesamt-asc':
            filteredData.sort((a, b) => (a.gesamtProgress || 0) - (b.gesamtProgress || 0));
            break;
        default:
            filteredData.sort((a, b) => a.name.localeCompare(b.name));
    }

    updateChartsWithFilteredData(filteredData);
    updateChecklistTable(filteredData);
}

function getProgressColor(progress) {
    if (progress >= 80) return '#28a745'; // Grün
    if (progress >= 60) return '#6cc04a'; // Hellgrün
    if (progress >= 40) return '#ffc107'; // Gelb
    if (progress >= 20) return '#fd7e14'; // Orange
    return '#dc3545'; // Rot
}

// IHK-Grade-basierte Farben für Charts (nutzt zentrale Konfiguration)
function getIHKGradeColor(percentage) {
    const grade = getGradeByPercentage(percentage);
    return grade.color;
}

function getGradientColor(color) {
    const successDark = getCssVariable('--success-dark');
    const warningColor = getCssVariable('--warning-color');
    const dangerColor = getCssVariable('--danger-color');

    const gradients = {
        [getCssVariable('--success-color')]: `linear-gradient(90deg, ${getCssVariable('--success-color')}, ${successDark})`,
        '#6cc04a': 'linear-gradient(90deg, #6cc04a, #28a745)',
        [warningColor]: `linear-gradient(90deg, ${warningColor}, ${dangerColor})`,
        '#fd7e14': 'linear-gradient(90deg, #fd7e14, #dc3545)',
        [dangerColor]: `linear-gradient(90deg, ${dangerColor}, #e83e8c)`
    };
    return gradients[color] || 'linear-gradient(90deg, #e9ecef, #e9ecef)';
}

function updateChartsWithFilteredData(filteredData) {
    // Prüfen ob Charts initialisiert sind
    if (!detailPflichtChart || !detailGesamtChart) {
        return;
    }
    
    const shortNames = filteredData.map(item => item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name);
    
    // Immer ursprüngliche Werte verwenden (keine Referenzwochen-Berechnung für Charts)
    const originalPflichtData = filteredData.map(item => item.pflichtProgress || 0);
    const originalGesamtData = filteredData.map(item => item.gesamtProgress || 0);
    
    const pflichtColors = originalPflichtData.map(item => getIHKGradeColor(item));
    const gesamtColors = originalGesamtData.map(item => getIHKGradeColor(item));

    detailPflichtChart.data.labels = shortNames;
    detailPflichtChart.data.datasets[0].data = originalPflichtData;
    detailPflichtChart.data.datasets[0].backgroundColor = pflichtColors;
    detailPflichtChart.update();

    detailGesamtChart.data.labels = shortNames;
    detailGesamtChart.data.datasets[0].data = originalGesamtData;
    detailGesamtChart.data.datasets[0].backgroundColor = gesamtColors;
    detailGesamtChart.update();
}

function updateChecklistTable(filteredData) {
    
    let html = '<table class="info-table" id="checklistTable">';
    html += '<thead>';
    html += '<tr>';
    html += '<th onclick="sortChecklistTableByColumn(0)" class="sortable-header" style="cursor: pointer;">Name <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortChecklistTableByColumn(1)" class="sortable-header" style="cursor: pointer;">Pflicht % <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortChecklistTableByColumn(2)" class="sortable-header" style="cursor: pointer;">Gesamt % <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody id="checklistTableBody">';

    filteredData.forEach((item, index) => {
        // Unterscheide zwischen null (nicht vorhanden) und undefined/0 (vorhanden aber 0%)
        const hasPflicht = item.pflichtProgress !== null;
        const originalPflichtPercent = hasPflicht ? (item.pflichtProgress || 0) : null;
        const originalGesamtPercent = item.gesamtProgress !== undefined ? item.gesamtProgress : 0;

        // Immer die tatsächlichen Prozentwerte anzeigen (keine Referenzwochen-Berechnung)
        const pflichtDisplay = hasPflicht ?
            `${Math.round(originalPflichtPercent)}%` : '-';
        const gesamtDisplay = item.gesamtProgress !== undefined ?
            `${Math.round(originalGesamtPercent)}%` : 'n/a';

        const pflichtColor = hasPflicht ? getProgressColor(originalPflichtPercent) : '#e9ecef';
        const gesamtColor = getProgressColor(originalGesamtPercent);

        const pflichtWidth = hasPflicht ? originalPflichtPercent : 0;
        const pflichtValue = hasPflicht ? originalPflichtPercent : -1; // -1 für Sortierung

        html += `<tr data-name="${item.name.toLowerCase()}" data-pflicht="${pflichtValue}" data-gesamt="${originalGesamtPercent}">
            <td data-label="Name"><a href="${item.url}" target="_blank">${item.name}</a></td>
            <td data-label="Pflicht %"><strong class="progress-cell${hasPflicht ? '' : ' no-progress'}" data-value="${pflichtValue}" style="--progress-width: ${pflichtWidth}%; --progress-color: ${pflichtColor};">${pflichtDisplay}</strong></td>
            <td data-label="Gesamt %"><strong class="progress-cell" data-value="${originalGesamtPercent}" style="--progress-width: ${originalGesamtPercent}%; --progress-color: ${gesamtColor};">${gesamtDisplay}</strong></td>
        </tr>`;
    });

    html += '</tbody>';
    html += '</table>';
    document.getElementById('sessionInfo').innerHTML = html;

    window.currentChecklistTableData = filteredData;
}


function destroyCharts() {
    // Destroy existing charts to prevent canvas reuse errors
    if (detailPflichtChart) {
        detailPflichtChart.destroy();
        detailPflichtChart = null;
    }
    if (detailGesamtChart) {
        detailGesamtChart.destroy();
        detailGesamtChart = null;
    }
    if (overviewGesamtChart) {
        overviewGesamtChart.destroy();
        overviewGesamtChart = null;
    }
    if (trendChart) {
        trendChart.destroy();
        trendChart = null;
    }
    if (rankingChart) {
        rankingChart.destroy();
        rankingChart = null;
    }
}

function initCharts() {
    // Always destroy existing charts first
    destroyCharts();
    
    const successColor = getCssVariable('--success-color');
    const infoColor = getCssVariable('--info-color');

    const detailPflichtCtx = document.getElementById('detailPflichtChart').getContext('2d');
    detailPflichtChart = new Chart(detailPflichtCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Pflicht %',
                data: [],
                backgroundColor: successColor
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 }},
            plugins: { 
                legend: { display: false }
            }
        }
    });

    const detailGesamtCtx = document.getElementById('detailGesamtChart').getContext('2d');
    detailGesamtChart = new Chart(detailGesamtCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Gesamt %',
                data: [],
                backgroundColor: infoColor
            }]
        },
        options: {
            responsive: true,
            scales: { y: { beginAtZero: true, max: 100 }},
            plugins: { 
                legend: { display: false }
            }
        }
    });
}


function updateCharts() {
    if (!checklistData.length) return;

    // Ensure charts are initialized
    if (!detailPflichtChart || !detailGesamtChart) {
        console.log('Charts not initialized, initializing now...');
        initCharts();
        return;
    }

    const validChecklists = checklistData.filter(item => !item.error);

    // Für Pflicht-Chart: Nur Checklisten MIT Pflichtelementen
    const checklistsWithPflicht = validChecklists.filter(item => item.pflichtProgress !== null);
    const pflichtNames = checklistsWithPflicht.map(item => item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name);
    const pflichtData = checklistsWithPflicht.map(item => item.pflichtProgress || 0);
    const pflichtColors = pflichtData.map(item => getIHKGradeColor(item));

    // Für Gesamt-Chart: Alle Checklisten
    const gesamtNames = validChecklists.map(item => item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name);
    const gesamtData = validChecklists.map(item => item.gesamtProgress || 0);
    const gesamtColors = gesamtData.map(item => getIHKGradeColor(item));

    detailPflichtChart.data.labels = pflichtNames;
    detailPflichtChart.data.datasets[0].data = pflichtData;
    detailPflichtChart.data.datasets[0].backgroundColor = pflichtColors;
    detailPflichtChart.update();

    detailGesamtChart.data.labels = gesamtNames;
    detailGesamtChart.data.datasets[0].data = gesamtData;
    detailGesamtChart.data.datasets[0].backgroundColor = gesamtColors;
    detailGesamtChart.update();
}

function showBothStatsRows() {
    const statsRow = document.getElementById('statsRow');
    const pflichtStatsRow = document.getElementById('pflichtStatsRow');

    if (statsRow && window.data && window.data.length > 0) {
        statsRow.style.display = 'grid';
    }

    if (pflichtStatsRow && window.pflichtData && window.pflichtData.length > 0) {
        pflichtStatsRow.style.display = 'grid';
    }
}

function showTab(tab) {
    const tabs = ['homeTab', 'checklistsTab', 'pflichtTab'];
    tabs.forEach(tabId => {
        const tabElement = document.getElementById(tabId);
        if (tabElement) {
            tabElement.style.display = tabId === `${tab}Tab` ? 'block' : 'none';
        }
    });

    const buttons = ['tabHome', 'tabChecklists', 'tabPflicht'];
    buttons.forEach(buttonId => {
        const buttonElement = document.getElementById(buttonId);
        if (buttonElement) {
            buttonElement.classList.toggle('active', buttonId === `tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
            buttonElement.classList.toggle('inactive', buttonId !== `tab${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
        }
    });

    // Update active tab heading
    const headingElement = document.getElementById('activeTabHeading');
    if (headingElement) {
        const headingTexts = {
            'home': 'Übersicht',
            'checklists': 'Checklisten',
            'pflicht': 'Pflichtabgaben'
        };
        headingElement.textContent = headingTexts[tab] || 'Übersicht';
    }

    // Zeige/verstecke Loading-Indikator für Pflichtabgaben-Tab
    if (tab === 'pflicht') {
        const loadingIndicator = document.getElementById('pflichtLoadingIndicator');
        const pflichtFilterSection = document.getElementById('pflichtFilterSection');
        const pflichtSessionInfo = document.getElementById('pflichtSessionInfo');

        // Prüfe ob Daten bereits geladen sind
        if (!window.pflichtData || window.pflichtData.length === 0) {
            // Zeige Loading-Indikator
            if (loadingIndicator) loadingIndicator.style.display = 'flex';
            if (pflichtFilterSection) pflichtFilterSection.style.display = 'none';
            if (pflichtSessionInfo) pflichtSessionInfo.style.display = 'none';
        } else {
            // Verstecke Loading-Indikator, zeige Inhalte
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            if (pflichtFilterSection) pflichtFilterSection.style.display = 'block';
            if (pflichtSessionInfo) pflichtSessionInfo.style.display = 'block';

            // Wende aktuelle Filter erneut an beim Tab-Wechsel
            applyPflichtFilters();
        }
    }
}

function createPflichtCharts(data) {
    const statusCounts = { 'Bewertet': 0, 'Abgegeben': 0, 'Zu erledigen': 0 };
    const grades = [];
    data.forEach(item => {
        statusCounts[item.completionStatus] = (statusCounts[item.completionStatus] || 0) + 1;
        if (item.grade && item.grade !== '-' && !isNaN(parseFloat(item.grade.replace(',', '.')))) {
            grades.push(parseFloat(item.grade.replace(',', '.')));
        }
    });

    showBothStatsRows();
    
    // Check if both datasets are loaded and hide dashboard loading
    checkAndHideDashboardLoading();
}

async function fetchData(assignmentOverviewUrl, quizOverviewUrl) {
    const [assignRes, quizRes] = await Promise.all([
        fetch(assignmentOverviewUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } }),
        fetch(quizOverviewUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
    ]);

    if (!assignRes.ok || !quizRes.ok) {
        throw new Error('Fehler beim Laden der Daten');
    }

    const [assignHtml, quizHtml] = await Promise.all([assignRes.text(), quizRes.text()]);
    const parser = new DOMParser();

    const assignDoc = parser.parseFromString(assignHtml, 'text/html');
    const assignmentTable = assignDoc.querySelector('#assign_overview .course-overview-table tbody');
    // ALLE Aufgaben laden (nicht nur Pflicht)
    const assignmentRows = assignmentTable ? Array.from(assignmentTable.querySelectorAll('tr')) : [];

    const assignmentData = assignmentRows.map(row => {
        const nameCell = row.querySelector('[data-mdl-overview-item="name"]');
        const completionCell = row.querySelector('[data-mdl-overview-item="completion"]');
        const submissionCell = row.querySelector('[data-mdl-overview-item="submissionstatus"]');
        const gradeCell = row.querySelector('[data-mdl-overview-item="Bewertung"]');
        const link = nameCell ? nameCell.querySelector('a.activityname') : null;
        const name = link ? link.textContent.trim() : (nameCell ? nameCell.textContent.trim() : 'Unbekannt');
        const url = link ? link.href : '';

        // Extrahiere cmid aus URL (z.B. "...view.php?id=12345")
        const cmidMatch = url.match(/[?&]id=(\d+)/);
        const cmid = cmidMatch ? cmidMatch[1] : null;

        // Prüfe ob Aufgabe als Pflicht markiert ist
        const isPflicht = name.includes('Pflicht');

        let completionStatus = 'Zu erledigen';
        if (completionCell) {
            const completionValue = completionCell.getAttribute('data-mdl-overview-value');
            if (completionValue === '1' || completionCell.textContent.includes('Erledigt')) {
                completionStatus = 'Erledigt';
            }
        }
        const submissionStatus = submissionCell ?
            submissionCell.getAttribute('data-mdl-overview-value') || submissionCell.textContent.trim() :
            'Unbekannt';
        const grade = gradeCell ?
            gradeCell.getAttribute('data-mdl-overview-value') || gradeCell.textContent.trim() :
            '-';
        return {
            name,
            url,
            cmid,
            type: 'Aufgabe',
            isPflicht,
            completionStatus,
            submissionStatus,
            grade
        };
    });

    const quizDoc = parser.parseFromString(quizHtml, 'text/html');
    const quizTable = quizDoc.querySelector('#quiz_overview .course-overview-table tbody');
    // ALLE Quizzes laden (nicht nur Pflicht)
    const quizRows = quizTable ? Array.from(quizTable.querySelectorAll('tr')) : [];

    const quizData = quizRows.map(row => {
        const nameCell = row.querySelector('[data-mdl-overview-item="name"]');
        const completionCell = row.querySelector('[data-mdl-overview-item="completion"]');
        const gradeCell = row.querySelector('[data-mdl-overview-item="Bewertung"]');
        const link = nameCell ? nameCell.querySelector('a.activityname') : null;
        const name = link ? link.textContent.trim() : (nameCell ? nameCell.textContent.trim() : 'Unbekannt');
        const url = link ? link.href : '';

        // Extrahiere cmid aus URL (z.B. "...view.php?id=12345")
        const cmidMatch = url.match(/[?&]id=(\d+)/);
        const cmid = cmidMatch ? cmidMatch[1] : null;

        // Prüfe ob Quiz als Pflicht markiert ist
        const isPflicht = name.includes('Pflicht');

        let completionStatus = 'Zu erledigen';
        if (completionCell) {
            const completionValue = completionCell.getAttribute('data-mdl-overview-value');
            if (completionValue === '1' || completionCell.textContent.includes('Erledigt')) {
                completionStatus = 'Erledigt';
            }
        }
        const submissionStatus = '-';
        const grade = gradeCell ?
            gradeCell.getAttribute('data-mdl-overview-value') || gradeCell.textContent.trim() :
            '-';
        return {
            name,
            url,
            cmid,
            type: 'Quiz',
            isPflicht,
            completionStatus,
            submissionStatus,
            grade
        };
    });

    // Keine Sortierung hier - die Reihenfolge bleibt wie von Mebis geliefert
    // Die Sortierung erfolgt später in applyPflichtFilters()
    return [...assignmentData, ...quizData];
}

// Funktion zum Abrufen von Assignment-Details und Ermittlung des echten Status
async function fetchAssignmentDetails(url) {
    try {
        const response = await fetch(url, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } });
        if (!response.ok) {
            return null;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Finde die submissionsummarytable
        const summaryTable = doc.querySelector('.submissionsummarytable table');
        if (!summaryTable) {
            return null;
        }

        const details = {
            isGroupAssignment: false,
            groupName: null,
            submissionStatus: null,
            gradingStatus: null,
            actualStatus: 'Zu erledigen'
        };

        // Parse die Tabelle
        const rows = summaryTable.querySelectorAll('tr');
        rows.forEach(row => {
            const headerCell = row.querySelector('th');
            const dataCell = row.querySelector('td');

            if (headerCell && dataCell) {
                const header = headerCell.textContent.trim();
                const value = dataCell.textContent.trim();

                if (header === 'Gruppe') {
                    details.isGroupAssignment = true;
                    details.groupName = value;
                } else if (header === 'Abgabestatus') {
                    details.submissionStatus = value;
                } else if (header === 'Bewertungsstatus') {
                    details.gradingStatus = value;
                }
            }
        });

        // Ermittle den tatsächlichen Status basierend auf Bewertungsstatus
        // Priorität: Bewertet > Abgegeben > Zu erledigen
        if (details.gradingStatus && details.gradingStatus.includes('Bewertet')) {
            details.actualStatus = 'Bewertet';
        } else if (details.submissionStatus && details.submissionStatus.includes('Zur Bewertung abgegeben')) {
            details.actualStatus = 'Abgegeben';
        } else {
            details.actualStatus = 'Zu erledigen';
        }

        return details;
    } catch (error) {
        console.error('Fehler beim Abrufen der Assignment-Details:', error);
        trackConnectionError('Assignment-Details', true);
        return null;
    }
}

// Erweitere die fetchData-Funktion, um Details für Assignments abzurufen
async function enrichPflichtDataWithDetails(pflichtData) {
    const enrichedData = [];

    for (const item of pflichtData) {
        const enrichedItem = { ...item };

        // Für Assignments Details abrufen
        if (item.type === 'Aufgabe' && item.url) {
            const details = await fetchAssignmentDetails(item.url);
            if (details) {
                enrichedItem.isGroupAssignment = details.isGroupAssignment;
                enrichedItem.groupName = details.groupName;
                enrichedItem.detailedSubmissionStatus = details.submissionStatus;
                enrichedItem.gradingStatus = details.gradingStatus;
                enrichedItem.actualStatus = details.actualStatus;

                // Überschreibe den completionStatus mit dem tatsächlichen Status
                enrichedItem.completionStatus = details.actualStatus;
            } else {
                enrichedItem.isGroupAssignment = false;
                enrichedItem.actualStatus = item.completionStatus;
            }
        } else if (item.type === 'Quiz') {
            // Für Quizzes: Wenn eine Bewertung existiert, Status auf "Bewertet" setzen
            enrichedItem.isGroupAssignment = false;

            if (item.grade && item.grade !== '-' && item.grade !== 'Unbekannt' && item.grade !== '') {
                enrichedItem.completionStatus = 'Bewertet';
                enrichedItem.actualStatus = 'Bewertet';
            } else {
                enrichedItem.actualStatus = item.completionStatus;
            }
        } else {
            enrichedItem.isGroupAssignment = false;
            enrichedItem.actualStatus = item.completionStatus;
        }

        enrichedData.push(enrichedItem);
    }

    return enrichedData;
}

function setRefreshButtonLoading(isLoading) {
    const btn = document.getElementById('refreshBtn');
    if (!btn) return;
    if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
    }
}

// Globale Variable zum Tracken des letzten Requirement-Filters
let lastRequirementFilter = null;

// Funktion zum Aktualisieren der Sortierungs-Optionen basierend auf dem Filter
function updateSortOptions(requirementFilter) {
    const sortFilterDropdown = document.getElementById('pflichtSortFilter');

    if (!sortFilterDropdown) return false;

    const currentValue = sortFilterDropdown.value;
    const filterChanged = lastRequirementFilter !== null && lastRequirementFilter !== requirementFilter;

    // Wenn "Alle Aufgaben": Standard = Nach Typ (type-grouped display)
    if (requirementFilter === 'all') {
        // Keine speziellen Optionen mehr - alle Filter zeigen die gleichen Optionen
        sortFilterDropdown.innerHTML = `
            <option value="name">Nach Name</option>
            <option value="type">Nach Typ</option>
            <option value="status-completed">Erledigte zuerst</option>
        `;

        // Nur beim WECHSEL auf "Alle Aufgaben" automatisch auf Typ-Sortierung setzen
        if (filterChanged) {
            sortFilterDropdown.value = 'type';
            lastRequirementFilter = requirementFilter;
            return true; // Signal: Dropdown wurde geändert
        } else if (currentValue === 'name' || currentValue === 'type' || currentValue === 'status-completed') {
            sortFilterDropdown.value = currentValue;
        } else {
            sortFilterDropdown.value = 'type';
        }
    }
    // Wenn "Nur Pflichtabgaben" oder "Nur optionale": Standard = Name
    else {
        sortFilterDropdown.innerHTML = `
            <option value="name">Nach Name</option>
            <option value="type">Nach Typ</option>
            <option value="status-completed">Erledigte zuerst</option>
        `;

        if (currentValue === 'name' || currentValue === 'type' || currentValue === 'status-completed') {
            sortFilterDropdown.value = currentValue; // Behalte Auswahl
        } else {
            sortFilterDropdown.value = 'name'; // Default
        }
    }

    lastRequirementFilter = requirementFilter;
    return false; // Signal: Dropdown wurde nicht geändert (oder Auswahl beibehalten)
}

function applyPflichtFilters() {
    if (!window.pflichtData) return;

    const requirementFilter = document.getElementById('pflichtRequirementFilter').value;
    const statusFilter = document.getElementById('pflichtStatusFilter').value;
    const typeFilter = document.getElementById('pflichtTypeFilter').value;
    const gradeFilter = document.getElementById('pflichtGradeFilter').value;

    // Aktualisiere Sortierungs-Optionen basierend auf dem Filter
    updateSortOptions(requirementFilter);

    // Lese sortFilter NACH updateSortOptions(), damit der neue Wert verwendet wird
    const sortFilter = document.getElementById('pflichtSortFilter').value;

    let filteredData = [...window.pflichtData];

    // Ausschluss-Filter - entferne Aufgaben mit bestimmten Strings im Namen
    // Wird IMMER angewendet (für alle Filter-Optionen)
    if (EXTERNAL_CONFIG.excludeFromOverview && EXTERNAL_CONFIG.excludeFromOverview.length > 0) {
        filteredData = filteredData.filter(item => {
            // Prüfe ob der Name einen der ausgeschlossenen Strings enthält
            return !EXTERNAL_CONFIG.excludeFromOverview.some(excludeString =>
                item.name.includes(excludeString)
            );
        });
    }

    // Filter nach Pflicht/Optional
    if (requirementFilter === 'pflicht') {
        filteredData = filteredData.filter(item => item.isPflicht === true);
    } else if (requirementFilter === 'optional') {
        filteredData = filteredData.filter(item => item.isPflicht === false);
    }
    // 'all' bedeutet keine Filterung nach isPflicht

    if (statusFilter !== 'all') {
        if (statusFilter === 'completed') {
            // Bewertet und Abgegeben zählen als "erledigt"
            filteredData = filteredData.filter(item =>
                item.completionStatus === 'Bewertet' ||
                item.completionStatus === 'Abgegeben' ||
                item.completionStatus === 'Erledigt'
            );
        } else if (statusFilter === 'pending') {
            filteredData = filteredData.filter(item => item.completionStatus === 'Zu erledigen');
        }
    }

    if (typeFilter !== 'all') {
        filteredData = filteredData.filter(item => item.type === typeFilter);
    }

    if (gradeFilter !== 'all') {
        filteredData = filteredData.filter(item => {
            const grade = item.grade;
            if (gradeFilter === 'graded') {
                return grade !== '-' && grade !== 'Unbekannt' && grade.trim() !== '';
            } else if (gradeFilter === 'ungraded') {
                return grade === '-' || grade === 'Unbekannt' || grade.trim() === '';
            }
            return true;
        });
    }

    switch(sortFilter) {
        case 'name':
            filteredData.sort((a, b) => a.name.localeCompare(b.name, 'de'));
            break;
        case 'type':
            filteredData.sort((a, b) => a.type.localeCompare(b.type, 'de'));
            break;
        case 'status-completed':
            filteredData.sort((a, b) => {
                if (a.completionStatus === 'Erledigt' && b.completionStatus !== 'Erledigt') return -1;
                if (a.completionStatus !== 'Erledigt' && b.completionStatus === 'Erledigt') return 1;
                return a.name.localeCompare(b.name, 'de');
            });
            break;
        default:
            // Default: Nach Name sortieren
            filteredData.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    updatePflichtTable(filteredData);
    createPflichtCharts(filteredData);
}

async function updatePflichtTable(data) {
    // Verstecke Loading-Indikator und zeige Inhalte
    const loadingIndicator = document.getElementById('pflichtLoadingIndicator');
    const pflichtFilterSection = document.getElementById('pflichtFilterSection');
    const pflichtSessionInfo = document.getElementById('pflichtSessionInfo');

    if (loadingIndicator) loadingIndicator.style.display = 'none';
    if (pflichtFilterSection) pflichtFilterSection.style.display = 'block';
    if (pflichtSessionInfo) pflichtSessionInfo.style.display = 'block';

    // Lade Assignment-Grades, falls noch nicht vorhanden (für Datumsspalte)
    if (!window.allAssignmentGrades) {
        try {
            console.log('📅 Lade Assignment-Grades für Datumsspalte...');
            const cacheKey = 'all_assignment_grades';
            const cachedArray = getCachedData(cacheKey);

            let gradesMap;
            if (cachedArray && Array.isArray(cachedArray)) {
                console.log('💾 Assignment-Grades aus Cache geladen');
                gradesMap = new Map(cachedArray);
            } else {
                console.log('📥 Lade Assignment-Grades von Server...');
                gradesMap = await fetchAllAssignmentGrades();
                const arrayForCache = Array.from(gradesMap.entries());
                setCachedData(cacheKey, arrayForCache);
            }

            window.allAssignmentGrades = gradesMap;
            console.log(`✅ ${gradesMap.size} Assignment-Grades verfügbar`);
        } catch (error) {
            console.error('❌ Fehler beim Laden der Assignment-Grades:', error);
        }
    } else {
        console.log(`✓ Assignment-Grades bereits geladen (${window.allAssignmentGrades.size} Einträge)`);
    }

    // Dynamische Überschrift basierend auf dem aktuellen Filter
    const requirementFilter = document.getElementById('pflichtRequirementFilter')?.value || 'pflicht';
    let tableTitle = 'Aufgaben-Übersicht';
    if (requirementFilter === 'pflicht') {
        tableTitle = 'Pflichtabgaben-Übersicht';
    } else if (requirementFilter === 'optional') {
        tableTitle = 'Optionale Aufgaben-Übersicht';
    } else {
        tableTitle = 'Alle Aufgaben-Übersicht';
    }

    // Zähle Pflicht- und optionale Aufgaben
    const pflichtCount = data.filter(item => item.isPflicht).length;
    const optionalCount = data.length - pflichtCount;

    // Warnung bei Verbindungsproblemen
    let connectionWarningHtml = '';
    if (isDataUnreliable()) {
        connectionWarningHtml = `
        <div class="connection-warning-inline" style="
            margin: 16px 0;
            padding: 16px;
            background: linear-gradient(135deg, #fff3cd 0%, #ffeeba 100%);
            border-left: 4px solid #ffc107;
            border-radius: 8px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        ">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#856404" style="flex-shrink: 0; margin-top: 2px;">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <div>
                <div style="font-weight: 600; color: #856404; margin-bottom: 4px;">
                    Eingeschränkte Datenqualität
                </div>
                <div style="color: #856404; font-size: 0.9rem; line-height: 1.5;">
                    Aufgrund von Verbindungsproblemen konnten nicht alle Daten vollständig geladen werden.
                    Die angezeigten Informationen sind möglicherweise unvollständig oder veraltet.
                    Bitte laden Sie die Seite später erneut, um aktuelle Daten zu erhalten.
                </div>
            </div>
        </div>`;
    }
    const countInfo = requirementFilter === 'all' ? ` (${pflichtCount} Pflicht, ${optionalCount} Optional)` : ` (${data.length})`;

    let html = `<h4 style="display: flex; align-items: center; gap: 8px;"><svg width="18" height="18"><use href="#icon-books"></use></svg>${tableTitle}${countInfo}</h4>`;

    // Verbindungswarnung einfügen (falls vorhanden)
    html += connectionWarningHtml;

    // Info-Banner für "Alle Aufgaben" Ansicht
    if (requirementFilter === 'all') {
        html += `
        <div class="info-banner type-grouped-banner" style="
            margin: 16px 0;
            padding: 12px 16px;
            background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
            border-left: 4px solid #2196f3;
            border-radius: 8px;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        ">
            <svg width="24" height="24" style="flex-shrink: 0; margin-top: 2px;" fill="#1976d2">
                <use href="#icon-info"></use>
            </svg>
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #0d47a1; margin-bottom: 4px; font-size: 0.95em;">
                    Hinweis zur Darstellung
                </div>
                <div style="color: #0d47a1; font-size: 0.9em; line-height: 1.5;">
                    Die Aufgaben werden nach <strong>Typ gruppiert</strong> dargestellt (erst alle Aufgaben, dann alle Quizzes).
                    Dies ist die Standard-Darstellung für die Übersicht aller Aufgaben.
                </div>
            </div>
        </div>`;
    }

    html += '<table class="info-table" id="pflichtTable">';
    html += '<thead><tr>';
    html += '<th onclick="sortPflichtTableByColumn(0)" class="sortable-header" style="cursor: pointer;">Name <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(1)" class="sortable-header" style="cursor: pointer;">Typ <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(2)" class="sortable-header" style="cursor: pointer;">Status <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(3)" class="sortable-header" style="cursor: pointer;">Abgabeform <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(4)" class="sortable-header" style="cursor: pointer;">Bewertung <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(5)" class="sortable-header" style="cursor: pointer;">Bewertet am <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '</tr></thead><tbody id="pflichtTableBody">';

    data.forEach((item, index) => {
        // Status-Badge: Bewertet (grün), Abgegeben (blau), Zu erledigen (orange)
        let statusText = item.completionStatus;
        let statusBadgeStyle;
        let statusIcon;

        if (item.completionStatus === 'Bewertet') {
            statusBadgeStyle = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.8em; font-weight: 500; background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7;';
            statusIcon = '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M9 16.2l-3.5-3.5-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" fill="currentColor"/></svg>';
        } else if (item.completionStatus === 'Abgegeben') {
            statusBadgeStyle = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.8em; font-weight: 500; background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9;';
            statusIcon = '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/></svg>';
        } else {
            statusBadgeStyle = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.8em; font-weight: 500; background: #fff3e0; color: #e65100; border: 1px solid #ffcc80;';
            statusIcon = '<svg width="12" height="12" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/></svg>';
        }

        const statusBadge = `<span style="${statusBadgeStyle}">${statusIcon}${statusText}</span>`;

        const gradeColor = getGradeColor(item.grade);

        // Display grade based on type (stars for assignments, percentage for quiz)
        const gradeDisplay = displayGradeForTable(item);

        // Einheitlicher Badge-Style für alle Spalten
        const baseBadgeStyle = 'display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 6px; font-size: 0.8em; font-weight: 500;';

        // Typ-Badge
        const typeBadgeStyle = item.type === 'Quiz'
            ? `${baseBadgeStyle} background: #e3f2fd; color: #1976d2; border: 1px solid #bbdefb;`
            : `${baseBadgeStyle} background: #f3e5f5; color: #7b1fa2; border: 1px solid #e1bee7;`;

        const typeIcon = item.type === 'Quiz'
            ? '<svg width="12" height="12"><use href="#icon-quiz"></use></svg>'
            : '<svg width="12" height="12"><use href="#icon-assignment"></use></svg>';

        // Gruppenabgabe-Badge (einheitliche Größe)
        const groupIcon = item.isGroupAssignment
            ? '<svg width="12" height="12"><use href="#icon-group"></use></svg>'
            : '<svg width="12" height="12"><use href="#icon-individual"></use></svg>';

        const groupBadgeStyle = item.isGroupAssignment
            ? `${baseBadgeStyle} background: #e8f5e9; color: #2e7d32; border: 1px solid #a5d6a7;`
            : `${baseBadgeStyle} background: #e3f2fd; color: #1565c0; border: 1px solid #90caf9;`;

        const groupText = item.isGroupAssignment ? 'Gruppe' : 'Einzeln';
        const groupAssignment = `<span style="${groupBadgeStyle}">${groupIcon}${groupText}</span>`;

        // Pflicht/Optional Badge für Name-Spalte
        const requirementBadge = item.isPflicht
            ? '<span style="display: inline-block; margin-left: 6px; padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background: #e74c3c; color: white;">PFLICHT</span>'
            : '<span style="display: inline-block; margin-left: 6px; padding: 2px 6px; border-radius: 4px; font-size: 0.7em; font-weight: 600; background: #95a5a6; color: white;">OPTIONAL</span>';

        // Hintergrundfarbe für Zeile (sehr dezent)
        const rowStyle = item.isPflicht ? '' : 'style="background-color: rgba(149, 165, 166, 0.05);"';

        // Extrahiere cmid aus URL und hole Bewertungsdatum
        let gradedDateDisplay = '-';
        if (item.url && window.allAssignmentGrades) {
            const cmidMatch = item.url.match(/[?&]id=(\d+)/);
            if (cmidMatch) {
                const cmid = parseInt(cmidMatch[1]);
                const gradeData = window.allAssignmentGrades.get(cmid);
                if (gradeData && gradeData.gradedDate) {
                    // Formatiere Datum: DD.MM.YYYY
                    // Konvertiere String zu Date, falls nötig (Cache-Serialisierung)
                    const date = typeof gradeData.gradedDate === 'string'
                        ? new Date(gradeData.gradedDate)
                        : gradeData.gradedDate;

                    if (date && !isNaN(date.getTime())) {
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const year = date.getFullYear();
                        gradedDateDisplay = `${day}.${month}.${year}`;
                    }
                }
            }
        }

        html += `<tr data-name="${item.name.toLowerCase()}" data-type="${item.type.toLowerCase()}" data-status="${statusText.toLowerCase()}" data-grade="${item.grade}" ${rowStyle}>
            <td data-label="Name"><a href="${item.url}" target="_blank" title="${item.name}">${item.name}</a>${requirementBadge}</td>
            <td data-label="Typ"><span class="type-badge" style="${typeBadgeStyle}">${typeIcon}${item.type}</span></td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Abgabeform">${groupAssignment}</td>
            <td data-label="Bewertung"><strong style="${gradeColor}">${gradeDisplay}</strong></td>
            <td data-label="Bewertet am">${gradedDateDisplay}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    
    // Add legend for star system
    html += `
    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e9ecef;">
        <h5 style="margin: 0 0 12px 0; color: #495057; font-size: 1rem;">Bewertungslegende</h5>
        <div style="margin-bottom: 15px; padding: 8px; background: #e9ecef; border-radius: 4px; font-size: 0.85rem;">
            <strong>Hinweis:</strong> Aufgaben werden mit Sternen bewertet, Quizzes zeigen die erreichte Prozentzahl.
        </div>
        <div style="display: grid; gap: 8px; font-size: 0.9rem; line-height: 1.4;">
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <strong style="color: ${getCssVariable('--danger-color')}; min-width: 15px;">*</strong>
                <div>
                    <strong>Nicht akzeptabel (0%)</strong><br>
                    <span style="color: #6c757d;">Die Abgabe entspricht nicht den Mindestanforderungen.</span>
                </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <strong style="color: ${getCssVariable('--warning-color')}; min-width: 15px;">**</strong>
                <div>
                    <strong>Verbesserungsbedarf (70%)</strong><br>
                    <span style="color: #6c757d;">Es gibt wesentliche Verbesserungsmöglichkeiten. Lassen Sie uns gemeinsam an den Grundlagen arbeiten, um Ihre Fähigkeiten zu stärken!</span>
                </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <strong style="color: ${getCssVariable('--info-color')}; min-width: 15px;">***</strong>
                <div>
                    <strong>Solide Umsetzung (100%)</strong><br>
                    <span style="color: #6c757d;">Gute Arbeit! An einigen Stellen könnte die Abgabe jedoch optimiert werden. Nutzen Sie die Gelegenheit, um zu lernen und zu wachsen!</span>
                </div>
            </div>
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <strong style="color: ${getCssVariable('--success-color')}; min-width: 15px;">****</strong>
                <div>
                    <strong>Exzellent (130%)</strong><br>
                    <span style="color: #6c757d;">Ihre Abgabe ist herausragend! Sie haben eine effiziente Lösung entwickelt. Weiter so!</span>
                </div>
            </div>
        </div>
    </div>`;
    
    document.getElementById('pflichtSessionInfo').innerHTML = html;

    window.currentPflichtTableData = data;
}


// Star-based grading system for Pflichtabgaben
function convertStarsToPercentage(stars) {
    const starMapping = {
        1: 0,
        2: 70, 
        3: 100,
        4: 130
    };
    return starMapping[stars] || 0;
}

function displayStarsFromGrade(grade) {
    if (grade === '-' || grade === 'Unbekannt' || grade === '') return '-';

    const numGrade = parseFloat(grade.replace(',', '.'));
    if (isNaN(numGrade) || numGrade < 1) return '-';

    // Unterscheide zwischen Sternebewertung (1-4) und Prozentbewertung (> 4)
    if (numGrade <= 4) {
        // Sternebewertung
        const roundedGrade = Math.round(numGrade);
        const stars = '*'.repeat(roundedGrade);
        const percentage = convertStarsToPercentage(roundedGrade);
        return `${stars} (${percentage}%)`;
    } else {
        // Prozentbewertung (z.B. 84/100)
        return `${Math.round(numGrade)}%`;
    }
}

function getGradeValueForCalculation(item) {
    // Quiz types use actual percentage, assignments use star conversion or percentage
    if (item.type === 'Quiz') {
        const grade = item.grade;
        if (!grade || grade === '-' || grade === 'Unbekannt') return null;

        const numGrade = parseFloat(grade.replace(',', '.'));
        if (isNaN(numGrade)) return null;

        // For Quiz, the grade is already a percentage (0-100)
        return Math.max(0, Math.min(100, numGrade));
    } else {
        // For Aufgabe: Sternebewertung (1-4) oder Prozentbewertung (> 4)
        const grade = item.grade;
        if (!grade || grade === '-' || grade === 'Unbekannt') return null;

        const numGrade = parseFloat(grade.replace(',', '.'));
        if (isNaN(numGrade) || numGrade < 1) return null;

        if (numGrade <= 4) {
            // Sternebewertung -> in Prozent umwandeln
            return convertStarsToPercentage(Math.round(numGrade));
        } else {
            // Prozentbewertung -> direkt verwenden
            return Math.max(0, Math.min(100, numGrade));
        }
    }
}

function displayGradeForTable(item) {
    if (item.type === 'Quiz') {
        // Quiz shows percentage
        const grade = item.grade;
        if (!grade || grade === '-' || grade === 'Unbekannt') return '-';
        
        const numGrade = parseFloat(grade.replace(',', '.'));
        if (isNaN(numGrade)) return '-';
        
        return `${Math.round(numGrade)}%`;
    } else {
        // Aufgabe shows stars
        return displayStarsFromGrade(item.grade);
    }
}

function getGradeColorFromNumber(gradeNum) {
    const successColor = getCssVariable('--success-color');
    const infoColor = getCssVariable('--info-color');
    const warningColor = getCssVariable('--warning-color');
    const dangerColor = getCssVariable('--danger-color');

    if (gradeNum <= 2) return successColor;     // Grade 1-2 = good
    if (gradeNum <= 4) return warningColor;     // Grade 3-4 = acceptable  
    return dangerColor;                         // Grade 5-6 = poor
}

function getGradeColor(grade) {
    if (grade === '-' || grade === 'Unbekannt') return 'color: #666;';
    const numGrade = parseFloat(grade.replace(',', '.'));
    if (isNaN(numGrade)) return 'color: #666;';
    
    // Star-based color mapping for star display
    if (numGrade <= 1.5) return `color: ${getCssVariable('--danger-color')};`;  // 1 star = worst
    if (numGrade <= 2.5) return `color: ${getCssVariable('--warning-color')};`; // 2 stars = poor
    if (numGrade <= 3.5) return `color: ${getCssVariable('--info-color')};`;    // 3 stars = good  
    return `color: ${getCssVariable('--success-color')};`;                      // 4 stars = excellent
}

function sortPflichtTableByColumn(columnIndex) {
    if (!window.currentPflichtTableData) return;

    const sortedData = [...window.currentPflichtTableData];
    const currentSort = window.pflichtTableSort || { column: -1, ascending: true };
    const ascending = currentSort.column === columnIndex ? !currentSort.ascending : true;
    window.pflichtTableSort = { column: columnIndex, ascending: ascending };

    sortedData.sort((a, b) => {
        let valueA, valueB;

        switch(columnIndex) {
            case 0: // Name
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 1: // Type
                valueA = a.type.toLowerCase();
                valueB = b.type.toLowerCase();
                break;
            case 2: // Status
                valueA = a.completionStatus.toLowerCase();
                valueB = b.completionStatus.toLowerCase();
                break;
            case 3: // Submission
                valueA = a.submissionStatus.toLowerCase();
                valueB = b.submissionStatus.toLowerCase();
                break;
            case 4: // Grade - use percentage values for proper sorting
                // Convert grades to percentage values for fair comparison
                const percentageA = getGradeValueForCalculation(a);
                const percentageB = getGradeValueForCalculation(b);

                // Handle null/undefined values (ungraded items go to end)
                if (percentageA === null && percentageB === null) return 0;
                if (percentageA === null) return ascending ? 1 : -1;
                if (percentageB === null) return ascending ? -1 : 1;

                // Sort by percentage value
                return ascending ? percentageA - percentageB : percentageB - percentageA;
            case 5: // Bewertet am (Grading Date)
                // Extrahiere Datum aus allAssignmentGrades
                let dateA = null;
                let dateB = null;

                if (a.url && window.allAssignmentGrades) {
                    const cmidMatchA = a.url.match(/[?&]id=(\d+)/);
                    if (cmidMatchA) {
                        const gradeDataA = window.allAssignmentGrades.get(parseInt(cmidMatchA[1]));
                        if (gradeDataA?.gradedDate) {
                            // Konvertiere String zu Date, falls nötig
                            dateA = typeof gradeDataA.gradedDate === 'string'
                                ? new Date(gradeDataA.gradedDate)
                                : gradeDataA.gradedDate;
                        }
                    }
                }

                if (b.url && window.allAssignmentGrades) {
                    const cmidMatchB = b.url.match(/[?&]id=(\d+)/);
                    if (cmidMatchB) {
                        const gradeDataB = window.allAssignmentGrades.get(parseInt(cmidMatchB[1]));
                        if (gradeDataB?.gradedDate) {
                            // Konvertiere String zu Date, falls nötig
                            dateB = typeof gradeDataB.gradedDate === 'string'
                                ? new Date(gradeDataB.gradedDate)
                                : gradeDataB.gradedDate;
                        }
                    }
                }

                // Handle null dates (ungraded items go to end)
                if (!dateA && !dateB) return 0;
                if (!dateA) return ascending ? 1 : -1;
                if (!dateB) return ascending ? -1 : 1;

                // Sort by date (convert to timestamp for comparison)
                const timeA = dateA.getTime();
                const timeB = dateB.getTime();
                return ascending ? timeA - timeB : timeB - timeA;
            default:
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
        }

        if (valueA < valueB) return ascending ? -1 : 1;
        if (valueA > valueB) return ascending ? 1 : -1;
        return 0;
    });

    updatePflichtSortIcons(columnIndex, ascending);
    updatePflichtTable(sortedData);
}

function updatePflichtSortIcons(activeColumn, ascending) {
    const headers = document.querySelectorAll('#pflichtTable .sortable-header .sort-icon');
    headers.forEach(icon => icon.innerHTML = '<svg width="12" height="12"><use href="#icon-sort-both"></use></svg>');

    const activeIcon = document.querySelector(`#pflichtTable .sortable-header:nth-child(${activeColumn + 1}) .sort-icon`);
    if (activeIcon) {
        activeIcon.innerHTML = ascending ? '<svg width="12" height="12"><use href="#icon-sort-asc"></use></svg>' : '<svg width="12" height="12"><use href="#icon-sort-desc"></use></svg>';
    }
}

function sortChecklistTableByColumn(columnIndex) {
    if (!window.currentChecklistTableData) return;

    const sortedData = [...window.currentChecklistTableData];
    const currentSort = window.checklistTableSort || { column: -1, ascending: true };
    const ascending = currentSort.column === columnIndex ? !currentSort.ascending : true;
    window.checklistTableSort = { column: columnIndex, ascending: ascending };

    sortedData.sort((a, b) => {
        let valueA, valueB;

        switch(columnIndex) {
            case 0: // Name
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 1: // Pflicht %
                valueA = a.pflichtProgress !== undefined ? a.pflichtProgress : 0;
                valueB = b.pflichtProgress !== undefined ? b.pflichtProgress : 0;
                break;
            case 2: // Gesamt %
                valueA = a.gesamtProgress !== undefined ? a.gesamtProgress : 0;
                valueB = b.gesamtProgress !== undefined ? b.gesamtProgress : 0;
                break;
            default:
                return 0;
        }

        if (valueA < valueB) return ascending ? -1 : 1;
        if (valueA > valueB) return ascending ? 1 : -1;
        return 0;
    });

    updateChecklistSortIcons(columnIndex, ascending);
    updateChecklistTable(sortedData);
}

function updateChecklistSortIcons(activeColumn, ascending) {
    const headers = document.querySelectorAll('#checklistTable .sortable-header .sort-icon');
    headers.forEach(icon => icon.innerHTML = '<svg width="12" height="12"><use href="#icon-sort-both"></use></svg>');

    const activeIcon = document.querySelector(`#checklistTable .sortable-header:nth-child(${activeColumn + 1}) .sort-icon`);
    if (activeIcon) {
        activeIcon.innerHTML = ascending ? '<svg width="12" height="12"><use href="#icon-sort-asc"></use></svg>' : '<svg width="12" height="12"><use href="#icon-sort-desc"></use></svg>';
    }
}

// Chart Toggle Functionality
function toggleChart(chartId) {
    const contentId = chartId + 'Content';
    const toggleId = chartId + 'Toggle';
    
    const content = document.getElementById(contentId);
    const toggle = document.getElementById(toggleId);
    
    if (!content || !toggle) return;
    
    const isCurrentlyCollapsed = content.classList.contains('collapsed');
    
    if (isCurrentlyCollapsed) {
        // Expand
        content.classList.remove('collapsed');
        content.classList.add('expanded');
        toggle.classList.add('expanded');
        toggle.querySelector('span').textContent = EXTERNAL_CONFIG.ui.toggleChart.hide;
        
        // Trigger chart resize after expansion animation
        setTimeout(() => {
            if (chartId === 'pflichtChart' && window.detailPflichtChart) {
                window.detailPflichtChart.resize();
            } else if (chartId === 'gesamtChart' && window.detailGesamtChart) {
                window.detailGesamtChart.resize();
            }
        }, 300);
        
    } else {
        // Collapse
        content.classList.remove('expanded');
        content.classList.add('collapsed');
        toggle.classList.remove('expanded');
        toggle.querySelector('span').textContent = EXTERNAL_CONFIG.ui.toggleChart.show;
    }
}

// ================================
// KONFETTI EASTER EGG SYSTEM
// ================================

// Session tracking für Konfetti (einmalig pro Session)
let confettiTriggered = false;

function createConfetti(type = 'gold') {
    if (confettiTriggered) {
        console.log('Konfetti bereits ausgelöst in dieser Session');
        return false;
    }

    confettiTriggered = true;
    console.log(`${EXTERNAL_CONFIG.confetti.messages[type === 'gold' ? 'grade1' : 'grade2']}`);

    const confettiContainer = document.createElement('div');
    confettiContainer.className = 'confetti';
    confettiContainer.style.position = 'fixed';
    confettiContainer.style.top = '0';
    confettiContainer.style.left = '0';
    confettiContainer.style.width = '100%';
    confettiContainer.style.height = '100vh';
    confettiContainer.style.pointerEvents = 'none';
    confettiContainer.style.zIndex = '9999';
    document.body.appendChild(confettiContainer);

    // Erstelle 80 Konfetti-Stücke für eindrucksvollen Effekt
    for (let i = 0; i < 80; i++) {
        setTimeout(() => {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';

            // Wähle zufällige Farbvariation
            const colorVariation = Math.floor(Math.random() * 5) + 1;
            piece.classList.add(`confetti-${type}-${colorVariation}`);

            // Zufällige horizontale Position
            piece.style.left = Math.random() * 100 + '%';

            // Zufällige Größe für Variation
            const size = Math.random() * 4 + 6; // 6-10px
            piece.style.width = size + 'px';
            piece.style.height = size + 'px';

            // Zufällige Animationsdauer
            const duration = Math.random() * 1 + 2.5; // 2.5-3.5s
            piece.style.animationDuration = duration + 's';

            // Zufällige Delay für natürlicheren Effekt
            const delay = Math.random() * 200;
            piece.style.animationDelay = delay + 'ms';

            confettiContainer.appendChild(piece);
        }, i * 20); // Kleine Verzögerung zwischen Konfetti-Stücken
    }

    // Cleanup nach Animation
    setTimeout(() => {
        if (document.body.contains(confettiContainer)) {
            document.body.removeChild(confettiContainer);
        }
    }, 5000);

    return true; // Erfolgreich ausgelöst
}

function getConfettiTypeFromGrade(percentage) {
    const grade = getGradeNumber(percentage);

    if (grade === 1) return 'gold';    // Note 1 (≥91%)
    if (grade === 2) return 'silver';  // Note 2 (≥81%)
    return null; // Keine anderen Noten lösen Konfetti aus
}

function setupConfettiEasterEgg() {
    // IHK Grade Card Click Handler
    const ihkGradeCard = document.getElementById('ihkGradeText');
    const pflichtGradeCard = document.getElementById('pflichtAverageGrade');

    if (ihkGradeCard) {
        // Füge Easter Egg Klasse für Hover-Effekt hinzu
        ihkGradeCard.parentElement.classList.add('easter-egg-card');

        ihkGradeCard.addEventListener('click', (e) => {
            e.preventDefault();

            // Hole aktuellen IHK Grade Wert
            const gradeText = ihkGradeCard.textContent;
            const percentageMatch = gradeText.match(/(\d+)%/);

            if (percentageMatch) {
                const percentage = parseInt(percentageMatch[1]);
                const confettiType = getConfettiTypeFromGrade(percentage);

                if (confettiType) {
                    createConfetti(confettiType);
                }
            }
        });
    }

    if (pflichtGradeCard) {
        // Füge Easter Egg Klasse für Hover-Effekt hinzu
        pflichtGradeCard.parentElement.classList.add('easter-egg-card');

        pflichtGradeCard.addEventListener('click', (e) => {
            e.preventDefault();

            // Hole aktuellen Pflicht Grade (Note als Zahl)
            const gradeText = pflichtGradeCard.textContent;

            // Parse Note (z.B. "1,2" oder "2,0")
            const gradeMatch = gradeText.match(/(\d),?(\d)?/);
            if (gradeMatch) {
                const grade = parseInt(gradeMatch[1]);

                // Konvertiere Note zu Prozent für Konfetti-Bestimmung
                let percentage = 0;
                if (grade === 1) percentage = 95; // Note 1 → Gold
                else if (grade === 2) percentage = 85; // Note 2 → Silber

                const confettiType = getConfettiTypeFromGrade(percentage);
                if (confettiType) {
                    createConfetti(confettiType);
                }
            }
        });
    }
}

// Event Listeners
window.addEventListener('DOMContentLoaded', () => {
    // Initialisiere UI-Texte aus Konfiguration
    initializeLoadingTexts();

    // Initialisiere Konfetti Easter Egg
    setupConfettiEasterEgg();

    // Cache-Management für Debug/Development
    window.clearMebisCache = clearCache; // Funktion global verfügbar machen

    showTab('home');

    // Sofortige Initialisierung der Slider für bessere Performance
    initSliders();

    // Automatische Referenzwochen-Initialisierung
    initializeReferenceWeek();

    // Show loading state for dashboard cards during data loading
    window.dashboardLoadingStartTime = Date.now();
    showDashboardLoading(true);

    // Parallel data loading für bessere Performance
    Promise.all([
        extractFromChecklistIndex(),
        extractPflichtOverview(),
        loadMitarbeitsnote()
    ]).catch(error => {
        console.error('Fehler beim parallelen Laden der Daten:', error);
    });

    // RefreshBtn Event Handler
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = async () => {

            // const activeTab = document.getElementById('checklistsTab').style.display !== 'none' ? 'checklists' : 'pflicht';

            try {
                setRefreshButtonLoading(true);
                window.dashboardLoadingStartTime = Date.now();
                showDashboardLoading(true);

                // Force refresh - keine Cache-Nutzung bei manueller Aktualisierung
                await Promise.all([
                    extractFromChecklistIndex(false), // false = kein Cache
                    extractPflichtOverview(false),    // false = kein Cache
                    loadMitarbeitsnote(false)         // false = kein Cache
                ]);
            } catch (e) {
                console.error('Refresh fehlgeschlagen:', e);
            } finally {
                setRefreshButtonLoading(false);
            }
        };
    }

    // Tab Event Handlers
    const tabPflicht = document.getElementById('tabPflicht');
    if (tabPflicht) {
        tabPflicht.onclick = () => {
            showTab('pflicht');
            // extractPflichtOverview();
        };
    }

    const tabChecklists = document.getElementById('tabChecklists');
    if (tabChecklists) {
        tabChecklists.onclick = () => {
            showTab('checklists');
            // extractFromChecklistIndex();
        };
    }
});