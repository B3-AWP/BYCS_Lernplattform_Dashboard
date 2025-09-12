// Globale Variablen
let overviewGesamtChart, detailPflichtChart, detailGesamtChart, trendChart, rankingChart;
let checklistData = [];
let historicalData = [];

// Referenzwochen-System - wird dynamisch berechnet
let TOTAL_WEEKS = 9; // Default, wird später aktualisiert
let currentReferenceWeek = 9; // Standard: Letzte Woche (100% der Zeit)

// Schienen-basierte Schulwochen-Konfiguration
const TRACK_SCHEDULES = {
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
};

const CLASS_TO_TRACK = {
  "IFA12A": "Schiene1",
  "IFA12C": "Schiene1", 
  "IFA12E": "Schiene1",
  "IFA12B": "Schiene3",
  "IFA12D": "Schiene3"
};

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
  
  console.log('Keine relevante Klasse in Mebis-Kurs-Tabs gefunden');
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
    console.log(`Automatische Schulwoche ${currentWeek} für Klasse ${savedClass} (${track})`);
    return;
  }
  
  // Versuche automatische Erkennung
  detectUserClass().then(detectedClass => {
    if (detectedClass) {
      localStorage.setItem('userClass', detectedClass);
      const track = CLASS_TO_TRACK[detectedClass];
      const totalWeeks = getTotalWeeksForClass(detectedClass);
      const currentWeek = getCurrentSchulwoche(detectedClass);
      updateSystemForClass(detectedClass, totalWeeks, currentWeek);
      hideTrackSelection(); // Verstecke Schienen-Auswahl bei erfolgreicher automatischer Erkennung
      preselectTrack(track);
      console.log(`Automatische Schulwoche ${currentWeek} für erkannte Klasse ${detectedClass} (${track})`);
    } else {
      // Fallback: Standard verwenden, aber Buttons aktiviert lassen für manuelle Auswahl
      const totalWeeks = calculateTotalWeeks();
      updateSystemForTrack(null, totalWeeks, totalWeeks);
      showTrackSelection(); // Zeige Schienen-Auswahl wenn keine automatische Erkennung möglich
      enableTrackButtons();
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
  console.log('Track buttons enabled - user can select Schiene manually');
}

function disableTrackButtons() {
  const trackBtns = document.querySelectorAll('.track-btn');
  trackBtns.forEach(btn => {
    btn.disabled = true;
    btn.classList.remove('active', 'inactive');
  });
  console.log('Track buttons disabled - no Schiene could be determined');
}

function hideTrackSelection() {
  const trackContainer = document.getElementById('trackSelectionContainer');
  if (trackContainer) {
    trackContainer.style.display = 'none';
    console.log('Track selection hidden - automatic detection successful');
  }
}

function showTrackSelection() {
  const trackContainer = document.getElementById('trackSelectionContainer');
  if (trackContainer) {
    trackContainer.style.display = 'flex';
    console.log('Track selection shown - manual selection required');
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



// zentrale Course ID (ein Ort für die ID)
const COURSE_ID = '2036416';


// Farbpalette für bessere Visualisierung
const colorPalette = {
    primary: ['#667eea', '#764ba2'],
    success: ['#28a745', '#20c997'],
    warning: ['#ffc107', '#fd7e14'],
    danger: ['#dc3545', '#e83e8c'],
    info: ['#17a2b8', '#6f42c1'],
    gradients: [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
        'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
        'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)',
        'linear-gradient(135deg, #17a2b8 0%, #6f42c1 100%)'
    ]
};



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


function extractPflichtOverview() {
    showLoading(true);

    const assignmentOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${COURSE_ID}&expand[]=assign#assign_overview_collapsible`;
    const quizOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${COURSE_ID}&expand[]=quiz#quiz_overview_collapsible`;

    fetchData(assignmentOverviewUrl, quizOverviewUrl)
        .then(data => {
            window.pflichtData = data;
            updatePflichtTable(data);
            createPflichtCharts(data);
            updatePflichtStats();
            const pfSection = document.getElementById('pflichtFilterSection');
            if (pfSection) pfSection.style.display = 'block';
        })
        .catch(err => {
            console.error('extractPflichtOverview error:', err);
            window.pflichtData = [];
        })
        .finally(() => showLoading(false));
}

async function extractFromChecklistIndex() {
    showLoading(true);
    console.log('Starting checklist extraction...');

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
        document.getElementById('totalCount').textContent = checklistLinks.length;

        if (checklistLinks.length === 0) {
            console.warn('No checklist links found in HTML. Checking for alternative selectors...');
            const allLinks = Array.from(doc.querySelectorAll('a[href*="view.php"]'));
            console.log('All view.php links found:', allLinks.length);
            if (allLinks.length > 0) {
                console.log('First few links:', allLinks.slice(0, 3).map(l => l.textContent.trim()));
            }
            throw new Error('No checklist links found');
        }

        // Optimized parallel loading with concurrency limit
        const CONCURRENT_LIMIT = 5; // Load max 5 checklists at once
        const totalChecklists = checklistLinks.length;
        let completedCount = 0;

        console.log(`Starting to load ${totalChecklists} checklists with concurrency limit of ${CONCURRENT_LIMIT}`);

        const loadWithProgress = async (link, index) => {
            const name = link.textContent.trim();
            const url = `https://lernplattform.mebis.bycs.de/mod/checklist/${link.getAttribute('href')}`;
            
            try {
                const data = await loadSingleChecklist(url);
                completedCount++;
                
                // Update loading indicator with progress
                updateLoadingProgress(completedCount, totalChecklists);
                
                return { name, url, ...data };
            } catch (error) {
                completedCount++;
                console.warn(`Failed to load checklist ${name}:`, error.message);
                updateLoadingProgress(completedCount, totalChecklists);
                return { name: `${name} (Fehler)`, url, pflichtProgress: 0, gesamtProgress: 0, error: error.message };
            }
        };

        // Process checklists in batches with concurrency limit
        const results = [];
        for (let i = 0; i < checklistLinks.length; i += CONCURRENT_LIMIT) {
            const batch = checklistLinks.slice(i, i + CONCURRENT_LIMIT);
            const batchPromises = batch.map((link, batchIndex) => loadWithProgress(link, i + batchIndex));
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }

        console.log('All checklist promises resolved:', results.length);
        const valid = results.filter(item => !item.error);
        const errors = results.filter(item => item.error);
        
        console.log(`Valid checklists: ${valid.length}, Errors: ${errors.length}`);
        if (errors.length > 0) {
            console.warn('Checklist loading errors:', errors.map(e => `${e.name}: ${e.error}`));
        }
        
        if (valid.length === 0) {
            console.error('No valid checklists loaded!');
            throw new Error('All checklist detail loads failed');
        }
        
        console.log('Creating charts with valid data:', valid);
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

async function loadSingleChecklist(url) {
    const TIMEOUT_MS = 10000; // 10 seconds timeout
    
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
            const pflichtStyle = progressBars[0].getAttribute('style') || '';
            const gesamtStyle = progressBars[1].getAttribute('style') || '';
            
            const pflichtMatch = pflichtStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
            const gesamtMatch = gesamtStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
            
            const pflichtProgress = pflichtMatch ? parseFloat(pflichtMatch[1]) : 0;
            const gesamtProgress = gesamtMatch ? parseFloat(gesamtMatch[1]) : 0;
            
            return { pflichtProgress, gesamtProgress };
        }

        return { pflichtProgress: 0, gesamtProgress: 0 };
    } catch (error) {
        if (error.message === 'Request timeout') {
            throw new Error('Timeout beim Laden der Checkliste');
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
}

function updateStatistics() {
    const validChecklists = checklistData.filter(item => !item.error);
    const totalChecklists = validChecklists.length;

    if (totalChecklists > 0) {
        // Ursprüngliche Werte berechnen
        const avgPflicht = validChecklists.reduce((sum, item) => sum + (item.pflichtProgress || 0), 0) / totalChecklists;
        const avgGesamt = validChecklists.reduce((sum, item) => sum + (item.gesamtProgress || 0), 0) / totalChecklists;
        const completed = validChecklists.filter(item => item.pflichtProgress >= 100).length;
        
        // Referenzwochen-adjustierte Werte berechnen
        const referenceAvgPflicht = calculateReferenceProgressFromPercentage(avgPflicht, totalChecklists);
        const referenceAvgGesamt = calculateReferenceProgressFromPercentage(avgGesamt, totalChecklists);
        const referenceCompleted = calculateReferenceProgress(completed, totalChecklists);
        
        console.log('Statistics Update:', { 
            totalChecklists, 
            originalAvg: { pflicht: avgPflicht, gesamt: avgGesamt },
            referenceAvg: { pflicht: referenceAvgPflicht, gesamt: referenceAvgGesamt },
            completed: completed,
            referenceWeek: currentReferenceWeek
        });
        
        updateCombinedStats(completed, totalChecklists, referenceCompleted);
        updateProgressDisplay(
            currentReferenceWeek === TOTAL_WEEKS ? Math.round(referenceAvgPflicht) : Math.ceil(referenceAvgPflicht), 
            currentReferenceWeek === TOTAL_WEEKS ? Math.round(referenceAvgGesamt) : Math.ceil(referenceAvgGesamt)
        );
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

function animateProgressBar(textElementId, barElementId, targetValue) {
    const textElement = document.getElementById(textElementId);
    const barElement = document.getElementById(barElementId);

    if (!textElement || !barElement) {
        console.error('Progress bar elements not found:', { textElement, barElement });
        return;
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

    if (!completedElement || !totalElement || !percentageElement || !ringElement) return;

    // Bei letzter Woche: Original-Total anzeigen, sonst erwartete Anzahl
    const expectedTotal = currentReferenceWeek === TOTAL_WEEKS ? 
        total : 
        Math.ceil((total / TOTAL_WEEKS) * currentReferenceWeek);

    animateNumber('completedCount', completed);
    totalElement.textContent = expectedTotal;

    // Warte bis Animation abgeschlossen ist, dann berechne Prozentsatz basierend auf tatsächlich angezeigten Werten
    setTimeout(() => {
        const displayedCompleted = parseInt(completedElement.textContent) || 0;
        const displayedTotal = parseInt(totalElement.textContent) || 0;
        const percentage = displayedTotal > 0 ? Math.round((displayedCompleted / displayedTotal) * 100) : 0;
        
        const circumference = 2 * Math.PI * 25;
        // For ring visual: cap at 100% (full circle), but text can show over 100%
        const visualPercentage = Math.min(100, percentage);
        const offset = circumference - (visualPercentage / 100) * circumference;

        ringElement.style.strokeDashoffset = offset;
        // Text can show over 100%
        percentageElement.textContent = percentage + '%';

        // Use actual percentage for color (even >100%)
        const color = percentage >= 100 ? '#10b981' : getProgressColor(percentage);
        ringElement.style.stroke = color;
        percentageElement.style.color = color;
    }, 400);
}

function updatePflichtStats() {
    if (!window.pflichtData || window.pflichtData.length === 0) {
        console.log('No pflichtData available');
        return;
    }

    const totalPflicht = window.pflichtData.length;
    const completedPflicht = window.pflichtData.filter(item => item.completionStatus === 'Erledigt').length;
    
    // Referenzwochen-adjustierte Werte berechnen
    const referencePflichtProgress = calculateReferenceProgress(completedPflicht, totalPflicht);

    const gradedItems = window.pflichtData.filter(item => {
        const grade = item.grade;
        return grade && grade !== '-' && grade !== 'Unbekannt' && !isNaN(parseFloat(grade.replace(',', '.')));
    });

    let averageGrade = '-';
    if (gradedItems.length > 0) {
        const totalGrade = gradedItems.reduce((sum, item) => sum + parseFloat(item.grade.replace(',', '.')), 0);
        averageGrade = (totalGrade / gradedItems.length).toFixed(1).replace('.', ',');
    }

    const averageGradeElement = document.getElementById('pflichtAverageGrade');
    if (averageGradeElement) {
        averageGradeElement.textContent = averageGrade;
        if (averageGrade !== '-') {
            const numGrade = parseFloat(averageGrade.replace(',', '.'));
            const color = getGradeColor(averageGrade);
            averageGradeElement.style.color = color.replace('color: ', '').replace(';', '');
        }
    }

    updatePflichtCombinedStats(completedPflicht, totalPflicht, referencePflichtProgress);
    updateReferenceWeekLabels(); // Labels auch bei Pflichtaufgaben aktualisieren
    showBothStatsRows();
}

function updatePflichtCombinedStats(completed, total, referencePercentage = null) {
    const completedElement = document.getElementById('pflichtCompletedCount');
    const totalElement = document.getElementById('pflichtTotalCount');
    const percentageElement = document.getElementById('pflichtCompletionPercentage');
    const ringElement = document.getElementById('pflichtCompletionRing');

    if (!completedElement || !totalElement || !percentageElement || !ringElement) return;

    // Bei letzter Woche: Original-Total anzeigen, sonst erwartete Anzahl
    const expectedTotal = currentReferenceWeek === TOTAL_WEEKS ? 
        total : 
        Math.ceil((total / TOTAL_WEEKS) * currentReferenceWeek);

    animateNumber('pflichtCompletedCount', completed);
    totalElement.textContent = expectedTotal;

    // Warte bis Animation abgeschlossen ist, dann berechne Prozentsatz basierend auf tatsächlich angezeigten Werten
    setTimeout(() => {
        const displayedCompleted = parseInt(completedElement.textContent) || 0;
        const displayedTotal = parseInt(totalElement.textContent) || 0;
        const percentage = displayedTotal > 0 ? Math.round((displayedCompleted / displayedTotal) * 100) : 0;
        
        const circumference = 2 * Math.PI * 25;
        // For ring visual: cap at 100% (full circle), but text can show over 100%
        const visualPercentage = Math.min(100, percentage);
        const offset = circumference - (visualPercentage / 100) * circumference;

        ringElement.style.strokeDashoffset = offset;
        // Text can show over 100%
        percentageElement.textContent = percentage + '%';

        // Use actual percentage for color (even >100%)
        const color = percentage >= 100 ? '#10b981' : getProgressColor(percentage);
        ringElement.style.stroke = color;
        percentageElement.style.color = color;
    }, 400);
}

let currentPflichtAvg = 0;
let currentGesamtAvg = 0;

function updateProgressDisplay(pflichtAvg, gesamtAvg) {
    currentPflichtAvg = pflichtAvg;
    currentGesamtAvg = gesamtAvg;

    const selectedRadio = document.querySelector('input[name="progressType"]:checked');
    const selectedType = selectedRadio ? selectedRadio.value : 'pflicht';
    const targetValue = selectedType === 'pflicht' ? pflichtAvg : gesamtAvg;

    animateProgressBar('avgCompletionText', 'avgCompletionBar', targetValue);
    // Grade always based on Pflicht, never Gesamt
    updateIHKGrade(pflichtAvg);
}

function calculateIHKGrade(percentage) {
    let grade, tendency = '';

    if (percentage > 91) {
        grade = 1;
        if (percentage >= 98) tendency = '+';  // High end gets +
        else if (percentage <= 93) tendency = '-';  // Low end gets -
    } else if (percentage > 80) {
        grade = 2;
        if (percentage >= 90) tendency = '+';  // High end gets +
        else if (percentage <= 81) tendency = '-';  // Low end gets -
    } else if (percentage > 66) {
        grade = 3;
        if (percentage >= 79) tendency = '+';  // High end gets +
        else if (percentage <= 67) tendency = '-';  // Low end gets -
    } else if (percentage > 49) {
        grade = 4;
        if (percentage >= 65) tendency = '+';  // High end gets +
        else if (percentage <= 51) tendency = '-';  // Low end gets -
    } else if (percentage > 29) {
        grade = 5;
        if (percentage >= 48) tendency = '+';  // High end gets +
        else if (percentage <= 31) tendency = '-';  // Low end gets -
    } else {
        grade = 6;
        if (percentage >= 28) tendency = '+';  // Any points in grade 6 is relatively good
        else if (percentage <= 10) tendency = '-'; 
    }

    return { grade, tendency };
}

function updateIHKGrade(percentage) {
    const gradeInfo = calculateIHKGrade(percentage);
    const gradeText = document.getElementById('ihkGradeText');
    const gradePercentage = document.getElementById('ihkGradePercentage');
    const gradeTendency = document.getElementById('ihkGradeTendency');

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
        // Grade always based on Pflicht, never Gesamt
        updateIHKGrade(currentPflichtAvg);
    } else {
        pflichtLabel.classList.remove('active');
        gesamtLabel.classList.add('active');
        progressLabel.textContent = 'Checkliste Durchschnitt';
        animateProgressBar('avgCompletionText', 'avgCompletionBar', currentGesamtAvg);
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
        pflichtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-success"></use></svg>Ausgezeichneter Fortschritt! Die meisten Pflichtaufgaben sind erfüllt.';
    } else if (avgPflicht >= 50) {
        pflichtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-warning"></use></svg>Guter Fortschritt, aber es gibt noch Verbesserungspotential.';
    } else {
        pflichtInsight = '<svg width="16" height="16" style="vertical-align: text-bottom; margin-right: 4px;"><use href="#icon-alert"></use></svg>Mehr Fokus auf Pflichtaufgaben empfohlen.';
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
    
    const pflichtColors = originalPflichtData.map(item => getProgressColor(item));
    const gesamtColors = originalGesamtData.map(item => getProgressColor(item));

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
        const originalPflichtPercent = item.pflichtProgress !== undefined ? item.pflichtProgress : 0;
        const originalGesamtPercent = item.gesamtProgress !== undefined ? item.gesamtProgress : 0;
        
        // Immer die tatsächlichen Prozentwerte anzeigen (keine Referenzwochen-Berechnung)
        const pflichtDisplay = item.pflichtProgress !== undefined ? 
            `${Math.round(originalPflichtPercent)}%` : 'n/a';
        const gesamtDisplay = item.gesamtProgress !== undefined ? 
            `${Math.round(originalGesamtPercent)}%` : 'n/a';

        html += `<tr data-name="${item.name.toLowerCase()}" data-pflicht="${originalPflichtPercent}" data-gesamt="${originalGesamtPercent}">
            <td><a href="${item.url}" target="_blank">${item.name}</a></td>
            <td><strong class="progress-cell" data-value="${originalPflichtPercent}">${pflichtDisplay}</strong></td>
            <td><strong class="progress-cell" data-value="${originalGesamtPercent}">${gesamtDisplay}</strong></td>
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
    const shortNames = validChecklists.map(item => item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name);
    const successColor = getCssVariable('--success-color');
    const infoColor = getCssVariable('--info-color');

    // Immer ursprüngliche Werte verwenden (keine Referenzwochen-Berechnung für Charts)
    const originalPflichtData = validChecklists.map(item => item.pflichtProgress || 0);
    const originalGesamtData = validChecklists.map(item => item.gesamtProgress || 0);

    detailPflichtChart.data.labels = shortNames;
    detailPflichtChart.data.datasets[0].data = originalPflichtData;
    detailPflichtChart.data.datasets[0].backgroundColor = successColor;
    detailPflichtChart.update();

    detailGesamtChart.data.labels = shortNames;
    detailGesamtChart.data.datasets[0].data = originalGesamtData;
    detailGesamtChart.data.datasets[0].backgroundColor = infoColor;
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
}

function createPflichtCharts(data) {
    const statusCounts = { 'Erledigt': 0, 'Zu erledigen': 0 };
    const grades = [];
    data.forEach(item => {
        statusCounts[item.completionStatus] = (statusCounts[item.completionStatus] || 0) + 1;
        if (item.grade && item.grade !== '-' && !isNaN(parseFloat(item.grade.replace(',', '.')))) {
            grades.push(parseFloat(item.grade.replace(',', '.')));
        }
    });

    showBothStatsRows();
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
    const assignmentRows = assignmentTable ? Array.from(assignmentTable.querySelectorAll('tr')).filter(row => {
        const nameCell = row.querySelector('[data-mdl-overview-item="name"]');
        if (nameCell) {
            const link = nameCell.querySelector('a.activityname');
            const visibleText = link ? link.textContent : nameCell.textContent;
            return visibleText && visibleText.includes('Pflicht');
        }
        return false;
    }) : [];

    const assignmentData = assignmentRows.map(row => {
        const nameCell = row.querySelector('[data-mdl-overview-item="name"]');
        const completionCell = row.querySelector('[data-mdl-overview-item="completion"]');
        const submissionCell = row.querySelector('[data-mdl-overview-item="submissionstatus"]');
        const gradeCell = row.querySelector('[data-mdl-overview-item="Bewertung"]');
        const link = nameCell ? nameCell.querySelector('a.activityname') : null;
        const name = link ? link.textContent.trim() : (nameCell ? nameCell.textContent.trim() : 'Unbekannt');
        const url = link ? link.href : '';
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
            type: 'Aufgabe',
            completionStatus,
            submissionStatus,
            grade
        };
    });

    const quizDoc = parser.parseFromString(quizHtml, 'text/html');
    const quizTable = quizDoc.querySelector('#quiz_overview .course-overview-table tbody');
    const quizRows = quizTable ? Array.from(quizTable.querySelectorAll('tr')).filter(row => {
        const nameCell = row.querySelector('[data-mdl-overview-item="name"]');
        if (nameCell) {
            const link = nameCell.querySelector('a.activityname');
            const visibleText = link ? link.textContent : nameCell.textContent;
            return visibleText && visibleText.includes('Pflicht');
        }
        return false;
    }) : [];

    const quizData = quizRows.map(row => {
        const nameCell = row.querySelector('[data-mdl-overview-item="name"]');
        const completionCell = row.querySelector('[data-mdl-overview-item="completion"]');
        const gradeCell = row.querySelector('[data-mdl-overview-item="Bewertung"]');
        const link = nameCell ? nameCell.querySelector('a.activityname') : null;
        const name = link ? link.textContent.trim() : (nameCell ? nameCell.textContent.trim() : 'Unbekannt');
        const url = link ? link.href : '';
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
            type: 'Quiz',
            completionStatus,
            submissionStatus,
            grade
        };
    });

    return [...assignmentData, ...quizData].sort((a, b) => a.name.localeCompare(b.name, 'de'));
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

function applyPflichtFilters() {
    if (!window.pflichtData) return;

    const statusFilter = document.getElementById('pflichtStatusFilter').value;
    const typeFilter = document.getElementById('pflichtTypeFilter').value;
    const gradeFilter = document.getElementById('pflichtGradeFilter').value;
    const sortFilter = document.getElementById('pflichtSortFilter').value;

    let filteredData = [...window.pflichtData];

    if (statusFilter !== 'all') {
        if (statusFilter === 'completed') {
            filteredData = filteredData.filter(item => item.completionStatus === 'Erledigt');
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
            } else if (gradeFilter === 'excellent') {
                const numGrade = parseFloat(grade.replace(',', '.'));
                return !isNaN(numGrade) && numGrade <= 1.5;
            } else if (gradeFilter === 'good') {
                const numGrade = parseFloat(grade.replace(',', '.'));
                return !isNaN(numGrade) && numGrade <= 2.5;
            } else if (gradeFilter === 'satisfactory') {
                const numGrade = parseFloat(grade.replace(',', '.'));
                return !isNaN(numGrade) && numGrade <= 3.5;
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
        case 'status-pending':
            filteredData.sort((a, b) => {
                if (a.completionStatus === 'Zu erledigen' && b.completionStatus !== 'Zu erledigen') return -1;
                if (a.completionStatus !== 'Zu erledigen' && b.completionStatus === 'Zu erledigen') return 1;
                return a.name.localeCompare(b.name, 'de');
            });
            break;
        case 'grade-best':
            filteredData.sort((a, b) => {
                const gradeA = parseFloat(a.grade.replace(',', '.'));
                const gradeB = parseFloat(b.grade.replace(',', '.'));
                if (isNaN(gradeA) && isNaN(gradeB)) return 0;
                if (isNaN(gradeA)) return 1;
                if (isNaN(gradeB)) return -1;
                return gradeA - gradeB;
            });
            break;
        case 'grade-worst':
            filteredData.sort((a, b) => {
                const gradeA = parseFloat(a.grade.replace(',', '.'));
                const gradeB = parseFloat(b.grade.replace(',', '.'));
                if (isNaN(gradeA) && isNaN(gradeB)) return 0;
                if (isNaN(gradeA)) return -1;
                if (isNaN(gradeB)) return 1;
                return gradeB - gradeA;
            });
            break;
        default:
            filteredData.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }

    updatePflichtTable(filteredData);
    createPflichtCharts(filteredData);
}

function updatePflichtTable(data) {
    let html = '<h4 style="display: flex; align-items: center; gap: 8px;"><svg width="18" height="18"><use href="#icon-books"></use></svg>Pflichtaufgaben-Übersicht</h4>';
    html += '<table class="info-table" id="pflichtTable">';
    html += '<thead><tr>';
    html += '<th onclick="sortPflichtTableByColumn(0)" class="sortable-header" style="cursor: pointer;">Name <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(1)" class="sortable-header" style="cursor: pointer;">Typ <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(2)" class="sortable-header" style="cursor: pointer;">Status <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(3)" class="sortable-header" style="cursor: pointer;">Abgabe <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '<th onclick="sortPflichtTableByColumn(4)" class="sortable-header" style="cursor: pointer;">Note <span class="sort-icon"><svg width="12" height="12"><use href="#icon-sort-both"></use></svg></span></th>';
    html += '</tr></thead><tbody id="pflichtTableBody">';

    data.forEach((item, index) => {
        const statusColor = item.completionStatus === 'Erledigt' ? getCssVariable('--success-color') : getCssVariable('--warning-color');
        const gradeColor = getGradeColor(item.grade);

        html += `<tr data-name="${item.name.toLowerCase()}" data-type="${item.type.toLowerCase()}" data-status="${item.completionStatus.toLowerCase()}" data-grade="${item.grade}">
            <td><a href="${item.url}" target="_blank" title="${item.name}">${item.name}</a></td>
            <td><span class="type-badge" style="padding: 2px 8px; border-radius: ${getCssVariable('--radius-sm')}; font-size: 0.8em; background: ${item.type === 'Quiz' ? '#e3f2fd' : '#f3e5f5'}; color: ${item.type === 'Quiz' ? getCssVariable('--primary-color') : getCssVariable('--secondary-color')};">${item.type}</span></td>
            <td><span style="color: ${statusColor}; font-weight: 600;">${item.completionStatus}</span></td>
            <td>${item.submissionStatus}</td>
            <td><strong style="${gradeColor}">${item.grade}</strong></td>
        </tr>`;
    });

    html += '</tbody></table>';
    document.getElementById('pflichtSessionInfo').innerHTML = html;

    window.currentPflichtTableData = data;
}


function getGradeColor(grade) {
    const successColor = getCssVariable('--success-color');
    const infoColor = getCssVariable('--info-color');
    const warningColor = getCssVariable('--warning-color');
    const dangerColor = getCssVariable('--danger-color');

    if (grade === '-' || grade === 'Unbekannt') return 'color: #666;';
    const numGrade = parseFloat(grade.replace(',', '.'));
    if (isNaN(numGrade)) return 'color: #666;';
    if (numGrade <= 1.5) return `color: ${successColor};`;
    if (numGrade <= 2.5) return `color: ${infoColor};`;
    if (numGrade <= 3.5) return `color: ${warningColor};`;
    return `color: ${dangerColor};`;
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
            case 4: // Grade
                valueA = parseFloat(a.grade.replace(',', '.'));
                valueB = parseFloat(b.grade.replace(',', '.'));
                if (isNaN(gradeA) && isNaN(gradeB)) return 0;
                if (isNaN(gradeA)) return 1;
                if (isNaN(gradeB)) return -1;
                return gradeA - gradeB;
            default:
                return 0;
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

// Event Listeners
window.addEventListener('DOMContentLoaded', () => {
    showTab('home');

    const sliderDelay = 5000;
    setTimeout(() => {
        initSliders();
    }, sliderDelay);

    // Automatische Referenzwochen-Initialisierung
    initializeReferenceWeek();

    extractFromChecklistIndex();
    extractPflichtOverview();

    // RefreshBtn Event Handler
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            
            // const activeTab = document.getElementById('checklistsTab').style.display !== 'none' ? 'checklists' : 'pflicht';
            
            try {
                setRefreshButtonLoading(true);
                // if (activeTab === 'checklists') {
                    await extractFromChecklistIndex();
                // } else {
                    await extractPflichtOverview();
                // }
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