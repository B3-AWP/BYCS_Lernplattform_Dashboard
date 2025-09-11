// Globale Variablen
let overviewGesamtChart, detailPflichtChart, detailGesamtChart, trendChart, rankingChart;
let checklistData = [];
let historicalData = [];

// Referenzwochen-System (10 Wochen Gesamtzeitraum)
const TOTAL_WEEKS = 10;
let currentReferenceWeek = 10; // Standard: Woche 10 (100% der Zeit)



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
    document.getElementById('referenceWeekValue').textContent = currentReferenceWeek;
    
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
    const isNormalView = currentReferenceWeek === 10;
    
    // Labels bleiben unverändert - nur Overlays werden erstellt/entfernt
    updateReferenceWeekOverlays(isNormalView);
}

function updateReferenceWeekOverlays(isNormalView) {
    // Entferne alle existierenden Overlays
    document.querySelectorAll('.reference-week-overlay').forEach(overlay => overlay.remove());
    
    if (isNormalView) return; // Keine Overlays bei Woche 10
    
    // Stat-Cards mit Referenzwochen-Overlays versehen
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        const overlay = document.createElement('div');
        overlay.className = 'reference-week-overlay';
        overlay.textContent = `Schulwoche ${currentReferenceWeek}`;
        card.appendChild(overlay);
    });
}

function calculateReferenceProgress(actualProgress, totalItems) {
    // Bei Woche 10: Normale Berechnung (keine Referenzwoche)
    if (currentReferenceWeek === 10) {
        return totalItems > 0 ? (actualProgress / totalItems) * 100 : 0;
    }
    
    // Berechnet den erwarteten Fortschritt basierend auf der Referenzwoche
    // actualProgress: Tatsächlich erledigte Items
    // totalItems: Gesamtanzahl Items über 10 Wochen
    
    const expectedItemsByWeek = (totalItems / TOTAL_WEEKS) * currentReferenceWeek;
    
    if (expectedItemsByWeek === 0) return 0;
    
    return Math.min(100, (actualProgress / expectedItemsByWeek) * 100);
}

function calculateReferenceProgressFromPercentage(currentPercentage, totalItems) {
    // Bei Woche 10: Originaler Prozentsatz zurückgeben
    if (currentReferenceWeek === 10) {
        return currentPercentage;
    }
    
    // Konvertiert bestehende Prozentangaben in Referenzwochen-Prozente
    // currentPercentage: Aktueller Prozentsatz (0-100)
    // totalItems: Gesamtanzahl Items
    
    const actualItems = (currentPercentage / 100) * totalItems;
    return calculateReferenceProgress(actualItems, totalItems);
}

function calculateReferenceProgressFromSinglePercentage(currentPercentage) {
    // Bei Woche 10: Originaler Prozentsatz zurückgeben
    if (currentReferenceWeek === 10) {
        return currentPercentage;
    }
    
    // Für einzelne Checklist-Items: berechnet Referenz-Fortschritt
    // currentPercentage: Aktueller Prozentsatz einer einzelnen Checkliste (0-100)
    
    const expectedProgressByWeek = (100 / TOTAL_WEEKS) * currentReferenceWeek;
    
    if (expectedProgressByWeek === 0) return 0;
    
    return Math.min(100, (currentPercentage / expectedProgressByWeek) * 100);
}

// Utility-Funktionen
function showLoading(show) {
    document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
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

function extractFromChecklistIndex() {
    showLoading(true);

    const checklistIndexUrl = `https://lernplattform.mebis.bycs.de/mod/checklist/index.php?id=${COURSE_ID}`;

    fetch(checklistIndexUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.text();
        })
        .then(html => {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const checklistLinks = Array.from(doc.querySelectorAll('a[href*="view.php?id="]'))
                .filter(link => link.getAttribute('href').startsWith('view.php?id='));

            if (checklistLinks.length === 0) {
                throw new Error('No checklist links found');
            }

            const extractedPromises = checklistLinks.map(link => {
                const name = link.textContent.trim();
                const url = `https://lernplattform.mebis.bycs.de/mod/checklist/${link.getAttribute('href')}`;
                return loadSingleChecklist(url)
                    .then(data => ({ name, url, ...data }))
                    .catch(error => ({ name: `${name} (Fehler)`, url, pflichtProgress: 0, gesamtProgress: 0, error: error.message }));
            });

            return Promise.all(extractedPromises);
        })
        .then(results => {
            const valid = results.filter(item => !item.error);
            if (valid.length === 0) throw new Error('All checklist detail loads failed');
            createCharts(valid);
            updateChecklistTable(valid);
        })
        .catch(err => {
            console.error('extractFromChecklistIndex error:', err);
            checklistData = [];
        })
        .finally(() => showLoading(false));
}

async function loadSingleChecklist(url) {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const progressBars = doc.querySelectorAll('.checklist_progress_inner');

    if (progressBars.length >= 2) {
        const pflichtProgress = parseFloat(progressBars[0].getAttribute('style').match(/width:\s*(\d+(?:\.\d+)?)%/)[1]) || 0;
        const gesamtProgress = parseFloat(progressBars[1].getAttribute('style').match(/width:\s*(\d+(?:\.\d+)?)%/)[1]) || 0;
        return { pflichtProgress, gesamtProgress };
    }

    return { pflichtProgress: 0, gesamtProgress: 0 };
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
            currentReferenceWeek === 10 ? Math.round(referenceAvgPflicht) : Math.ceil(referenceAvgPflicht), 
            currentReferenceWeek === 10 ? Math.round(referenceAvgGesamt) : Math.ceil(referenceAvgGesamt)
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

    const safeTargetValue = Math.max(0, Math.min(100, Math.round(targetValue || 0)));
    const currentText = textElement.textContent.replace('%', '') || '0';
    const currentValue = parseInt(currentText) || 0;
    const increment = (safeTargetValue - currentValue) / 40;

    let current = currentValue;
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= safeTargetValue) || (increment < 0 && current <= safeTargetValue)) {
            current = safeTargetValue;
            clearInterval(timer);
        }

        const roundedValue = Math.round(current);
        textElement.textContent = roundedValue + '%';
        barElement.style.width = roundedValue + '%';

        // Dynamische Farben basierend auf Fortschritt
        if (roundedValue >= 80) {
            barElement.style.background = successColor;
        } else if (roundedValue >= 60) {
            barElement.style.background = '#6cc04a';
        } else if (roundedValue >= 40) {
            barElement.style.background = warningColor;
        } else if (roundedValue >= 20) {
            barElement.style.background = '#fd7e14';
        } else {
            barElement.style.background = dangerColor;
        }
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

    // Bei Woche 10: Original-Total anzeigen, sonst erwartete Anzahl
    const expectedTotal = currentReferenceWeek === 10 ? 
        total : 
        Math.ceil((total / TOTAL_WEEKS) * currentReferenceWeek);

    animateNumber('completedCount', completed);
    animateNumber('totalCount', expectedTotal);

    // Verwende referencePercentage wenn verfügbar, sonst normale Berechnung
    const percentage = referencePercentage !== null ? 
        (currentReferenceWeek === 10 ? Math.round(referencePercentage) : Math.ceil(referencePercentage)) : 
        (total > 0 ? (currentReferenceWeek === 10 ? Math.round((completed / total) * 100) : Math.ceil((completed / total) * 100)) : 0);
        
    const circumference = 2 * Math.PI * 25;
    const offset = circumference - (percentage / 100) * circumference;

    setTimeout(() => {
        ringElement.style.strokeDashoffset = offset;
        percentageElement.textContent = percentage + '%';

        const color = getProgressColor(percentage);
        ringElement.style.stroke = color;
        percentageElement.style.color = color;
    }, 300);
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

    // Bei Woche 10: Original-Total anzeigen, sonst erwartete Anzahl
    const expectedTotal = currentReferenceWeek === 10 ? 
        total : 
        Math.ceil((total / TOTAL_WEEKS) * currentReferenceWeek);

    animateNumber('pflichtCompletedCount', completed);
    animateNumber('pflichtTotalCount', expectedTotal);

    // Verwende referencePercentage wenn verfügbar, sonst normale Berechnung
    const percentage = referencePercentage !== null ? 
        (currentReferenceWeek === 10 ? Math.round(referencePercentage) : Math.ceil(referencePercentage)) : 
        (total > 0 ? (currentReferenceWeek === 10 ? Math.round((completed / total) * 100) : Math.ceil((completed / total) * 100)) : 0);
        
    const circumference = 2 * Math.PI * 25;
    const offset = circumference - (percentage / 100) * circumference;

    setTimeout(() => {
        ringElement.style.strokeDashoffset = offset;
        percentageElement.textContent = percentage + '%';

        const color = getProgressColor(percentage);
        ringElement.style.stroke = color;
        percentageElement.style.color = color;
    }, 300);
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
    updateIHKGrade(targetValue);
}

function calculateIHKGrade(percentage) {
    let grade, tendency = '';

    if (percentage > 91) {
        grade = 1;
        if (percentage <= 92) tendency = '+';
    } else if (percentage > 80) {
        grade = 2;
        if (percentage <= 81) tendency = '+';
        else if (percentage >= 90) tendency = '-';
    } else if (percentage > 66) {
        grade = 3;
        if (percentage <= 67) tendency = '+';
        else if (percentage >= 79) tendency = '-';
    } else if (percentage > 49) {
        grade = 4;
        if (percentage <= 50) tendency = '+';
        else if (percentage >= 65) tendency = '-';
    } else if (percentage > 29) {
        grade = 5;
        if (percentage <= 30) tendency = '+';
        else if (percentage >= 48) tendency = '-';
    } else {
        grade = 6;
        if (percentage >= 28) tendency = '-';
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
        updateIHKGrade(currentPflichtAvg);
    } else {
        pflichtLabel.classList.remove('active');
        gesamtLabel.classList.add('active');
        progressLabel.textContent = 'Checkliste Durchschnitt';
        animateProgressBar('avgCompletionText', 'avgCompletionBar', currentGesamtAvg);
        updateIHKGrade(currentGesamtAvg);
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
        
        // Referenzwochen-adjustierte Werte berechnen
        const referencePflichtPercent = calculateReferenceProgressFromSinglePercentage(originalPflichtPercent);
        const referenceGesamtPercent = calculateReferenceProgressFromSinglePercentage(originalGesamtPercent);
        
        const pflichtDisplay = item.pflichtProgress !== undefined ? 
            `${currentReferenceWeek === 10 ? Math.round(referencePflichtPercent) : Math.ceil(referencePflichtPercent)}%` : 'n/a';
        const gesamtDisplay = item.gesamtProgress !== undefined ? 
            `${currentReferenceWeek === 10 ? Math.round(referenceGesamtPercent) : Math.ceil(referenceGesamtPercent)}%` : 'n/a';

        html += `<tr data-name="${item.name.toLowerCase()}" data-pflicht="${referencePflichtPercent}" data-gesamt="${referenceGesamtPercent}">
            <td><a href="${item.url}" target="_blank">${item.name}</a></td>
            <td><strong class="progress-cell" data-value="${referencePflichtPercent}">${pflichtDisplay}</strong></td>
            <td><strong class="progress-cell" data-value="${referenceGesamtPercent}">${gesamtDisplay}</strong></td>
        </tr>`;
    });

    html += '</tbody>';
    html += '</table>';
    document.getElementById('sessionInfo').innerHTML = html;

    window.currentChecklistTableData = filteredData;
}


function initCharts() {
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
    document.getElementById('checklistsTab').style.display = tab === 'checklists' ? 'block' : 'none';
    document.getElementById('pflichtTab').style.display = tab === 'pflicht' ? 'block' : 'none';

    showBothStatsRows();

    const checklistBtn = document.getElementById('tabChecklists');
    const pflichtBtn = document.getElementById('tabPflicht');

    if (tab === 'checklists') {
        checklistBtn.classList.add('active');
        checklistBtn.classList.remove('inactive');
        pflichtBtn.classList.add('inactive');
        pflichtBtn.classList.remove('active');
    } else {
        pflichtBtn.classList.add('active');
        pflichtBtn.classList.remove('inactive');
        checklistBtn.classList.add('inactive');
        checklistBtn.classList.remove('active');
    }
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
                if (isNaN(valueA)) valueA = 999;
                if (isNaN(valueB)) valueB = 999;
                break;
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
    showTab('checklists');

    const sliderDelay = 5000;
    setTimeout(() => {
        initSliders();
    }, sliderDelay);

    extractFromChecklistIndex();
    extractPflichtOverview();

    // RefreshBtn Event Handler
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.onclick = async () => {
            const activeTab = document.getElementById('checklistsTab').style.display !== 'none' ? 'checklists' : 'pflicht';
            try {
                setRefreshButtonLoading(true);
                if (activeTab === 'checklists') {
                    await extractFromChecklistIndex();
                } else {
                    await extractPflichtOverview();
                }
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
            extractPflichtOverview();
        };
    }

    const tabChecklists = document.getElementById('tabChecklists');
    if (tabChecklists) {
        tabChecklists.onclick = () => {
            showTab('checklists');
            extractFromChecklistIndex();
        };
    }
});