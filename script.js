 // Globale Variablen
        let overviewGesamtChart, detailPflichtChart, detailGesamtChart, trendChart, rankingChart;
        let checklistData = [];
        let historicalData = [];
        
        // Testmodus wird automatisch aktiviert, wenn keine echten Daten gefunden werden
        let TEST_MODE = false;
        
        // Testdaten
        const TEST_CHECKLIST_DATA = [
            { name: "Grundlagen der Programmierung", url: "#", pflichtProgress: 95, gesamtProgress: 87 },
            { name: "Datenstrukturen und Algorithmen", url: "#", pflichtProgress: 78, gesamtProgress: 82 },
            { name: "Objektorientierte Programmierung", url: "#", pflichtProgress: 100, gesamtProgress: 100 },
            { name: "Webentwicklung Basics", url: "#", pflichtProgress: 65, gesamtProgress: 73 },
            { name: "JavaScript Fundamentals", url: "#", pflichtProgress: 89, gesamtProgress: 91 },
            { name: "Database Management", url: "#", pflichtProgress: 45, gesamtProgress: 52 },
            { name: "Version Control mit Git", url: "#", pflichtProgress: 100, gesamtProgress: 98 },
            { name: "Softwaretests", url: "#", pflichtProgress: 33, gesamtProgress: 41 }
        ];
        
        const TEST_PFLICHT_DATA = [
            { name: "Pflicht: JavaScript Quiz 1", url: "#", type: "Quiz", completionStatus: "Erledigt", submissionStatus: "-", grade: "2,3" },
            { name: "Pflicht: HTML/CSS Projekt", url: "#", type: "Aufgabe", completionStatus: "Erledigt", submissionStatus: "Eingereicht", grade: "1,7" },
            { name: "Pflicht: Algorithmus-Aufgabe", url: "#", type: "Aufgabe", completionStatus: "Zu erledigen", submissionStatus: "Nicht eingereicht", grade: "-" },
            { name: "Pflicht: Datenbank Design", url: "#", type: "Aufgabe", completionStatus: "Erledigt", submissionStatus: "Eingereicht", grade: "2,0" },
            { name: "Pflicht: Git Workshop Quiz", url: "#", type: "Quiz", completionStatus: "Erledigt", submissionStatus: "-", grade: "1,3" },
            { name: "Pflicht: Testing Praktikum", url: "#", type: "Aufgabe", completionStatus: "Zu erledigen", submissionStatus: "Entwurf gespeichert", grade: "-" }
        ];
        
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
        
        // Utility-Funktionen
        function showLoading(show) {
            document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
        }
        
        // Hauptfunktion: Aufgaben-Übersicht laden
        async function extractPflichtOverview() {
            showLoading(true);

            const courseId = '2036416';
            const assignmentOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${courseId}&expand[]=assign#assign_overview_collapsible`;
            const quizOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${courseId}&expand[]=quiz#quiz_overview_collapsible`;

            try {
                // Beide Seiten parallel laden
                const [assignRes, quizRes] = await Promise.all([
                    fetch(assignmentOverviewUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } }),
                    fetch(quizOverviewUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                ]);

                if (!assignRes.ok || !quizRes.ok) {
                    throw new Error('Fehler beim Laden der Daten');
                }

                const [assignHtml, quizHtml] = await Promise.all([assignRes.text(), quizRes.text()]);
                const parser = new DOMParser();

                // Pflicht-Assignments extrahieren
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

                // Pflicht-Quizzes extrahieren
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
                    // Quizzes haben meist keinen Abgabestatus
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

                // Zusammenführen und sortieren
                const allData = [...assignmentData, ...quizData].sort((a, b) => a.name.localeCompare(b.name, 'de'));

                if (allData.length > 0) {
                    // Store data globally for filtering
                    window.pflichtData = allData;
                    
                    updatePflichtTable(allData);
                    createPflichtCharts(allData);
                    updatePflichtStats();
                    
                    // Show filter section
                    document.getElementById('pflichtFilterSection').style.display = 'block';
                } else {
                    // Keine Pflichtaufgaben gefunden - Testmodus aktivieren
                    activateTestMode();
                    // Store test data globally for filtering
                    window.pflichtData = TEST_PFLICHT_DATA;
                    
                    updatePflichtTable(TEST_PFLICHT_DATA);
                    createPflichtCharts(TEST_PFLICHT_DATA);
                    updatePflichtStats();
                    
                    // Show filter section
                    document.getElementById('pflichtFilterSection').style.display = 'block';
                }

            } catch (error) {
                // Fehler beim Laden der Pflichtaufgaben - Testmodus aktivieren
                console.error('Fehler beim Laden der Pflichtaufgaben-Daten:', error);
                activateTestMode();
                // Store test data globally for filtering
                window.pflichtData = TEST_PFLICHT_DATA;
                
                updatePflichtTable(TEST_PFLICHT_DATA);
                createPflichtCharts(TEST_PFLICHT_DATA);
                updatePflichtStats();
                
                // Show filter section
                document.getElementById('pflichtFilterSection').style.display = 'block';
            }

            showLoading(false);
        }
        
        // Testmodus aktivieren
        function activateTestMode() {
            TEST_MODE = true;
            document.getElementById('testModeIndicator').style.display = 'block';
            console.log('Testmodus aktiviert: Keine echten Daten verfügbar');
        }
        
        // Hauptfunktion: Checklisten-Index laden
        async function extractFromChecklistIndex() {
            showLoading(true);
            
            const courseId = '2036416';
            const checklistIndexUrl = `https://lernplattform.mebis.bycs.de/mod/checklist/index.php?id=${courseId}`;
            
            try {
                const response = await fetch(checklistIndexUrl, {
                    credentials: 'same-origin',
                    headers: { 'X-Requested-With': 'XMLHttpRequest' }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Nur echte Checklist-Links (relative "view.php?id=...")
                const allLinks = doc.querySelectorAll('a[href*="view.php?id="]');
                const checklistLinks = Array.from(allLinks).filter(link => {
                    const href = link.getAttribute('href');
                    return href && href.startsWith('view.php?id=');
                });
                
                if (checklistLinks.length === 0) {
                    // Keine echten Daten gefunden - Testmodus aktivieren
                    activateTestMode();
                    setTimeout(() => {
                        createCharts(TEST_CHECKLIST_DATA);
                        updateChecklistTable(TEST_CHECKLIST_DATA);
                        showLoading(false);
                    }, 3000);
                    return;
                }
                
                const extractedData = [];
                
                // Jede Checklist laden und analysieren
                for (let i = 0; i < checklistLinks.length; i++) {
                    const link = checklistLinks[i];
                    const name = link.textContent.trim();
                    
                    // Korrekte URL konstruieren
                    const href = link.getAttribute('href');
                    const url = href.startsWith('view.php?id=') 
                        ? `https://lernplattform.mebis.bycs.de/mod/checklist/${href}`
                        : link.href;
                    
                    try {
                        const checklistData = await loadSingleChecklist(url);
                        extractedData.push({
                            name: name,
                            url: url,
                            ...checklistData
                        });
                    } catch (error) {
                        extractedData.push({
                            name: name + ' (Fehler)',
                            url: url,
                            pflichtProgress: 0,
                            gesamtProgress: 0,
                            error: error.message
                        });
                    }
                }
                
                if (extractedData.length > 0) {
                    const validData = extractedData.filter(item => !item.error);
                    if (validData.length === 0) {
                        // Keine gültigen Daten gefunden - Testmodus aktivieren
                        activateTestMode();
                        createCharts(TEST_CHECKLIST_DATA);
                        updateChecklistTable(TEST_CHECKLIST_DATA);
                    } else {
                        createCharts(extractedData);
                        updateChecklistTable(extractedData);
                    }
                } else {
                    // Keine Daten gefunden - Testmodus aktivieren
                    activateTestMode();
                    createCharts(TEST_CHECKLIST_DATA);
                    updateChecklistTable(TEST_CHECKLIST_DATA);
                }
                
            } catch (error) {
                // Fehler beim Laden der echten Daten - Testmodus aktivieren
                console.error('Fehler beim Laden der Checklisten-Daten:', error);
                activateTestMode();
                createCharts(TEST_CHECKLIST_DATA);
                updateChecklistTable(TEST_CHECKLIST_DATA);
            }
            
            showLoading(false);
        }
        
        // Einzelne Checklist laden und Fortschritt extrahieren
        async function loadSingleChecklist(url) {
            const response = await fetch(url, { credentials: 'same-origin' });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Fortschrittsbalken extrahieren
            const progressBars = doc.querySelectorAll('.checklist_progress_inner');
            let pflichtProgress = 0;
            let gesamtProgress = 0;
            
            if (progressBars.length >= 2) {
                // Erste Progress-Bar = Pflichtelemente
                const pflichtBar = progressBars[0];
                const pflichtStyle = pflichtBar.getAttribute('style') || '';
                const pflichtMatch = pflichtStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
                pflichtProgress = pflichtMatch ? parseFloat(pflichtMatch[1]) : 0;
                
                // Zweite Progress-Bar = Alle Elemente  
                const gesamtBar = progressBars[1];
                const gesamtStyle = gesamtBar.getAttribute('style') || '';
                const gesamtMatch = gesamtStyle.match(/width:\s*(\d+(?:\.\d+)?)%/);
                gesamtProgress = gesamtMatch ? parseFloat(gesamtMatch[1]) : 0;
            }
            
            return {
                pflichtProgress: pflichtProgress,
                gesamtProgress: gesamtProgress
            };
        }
        
        // Charts erstellen
        function createCharts(data) {
            checklistData = data;
            
            // if (!overviewPflichtChart) {
                initCharts();
            // }
            
            updateCharts();
            updateStatistics();
            generateInsights();
            document.getElementById('dashboardContainer').style.display = 'none';
            showBothStatsRows();
        }
        
        // Statistiken aktualisieren
        function updateStatistics() {
            const validChecklists = checklistData.filter(item => !item.error);
            
            const totalChecklists = validChecklists.length;
            
            // Schutz vor Division durch 0
            let avgPflicht = 0;
            let avgGesamt = 0;
            
            if (totalChecklists > 0) {
                avgPflicht = validChecklists.reduce((sum, item) => sum + (item.pflichtProgress || 0), 0) / totalChecklists;
                avgGesamt = validChecklists.reduce((sum, item) => sum + (item.gesamtProgress || 0), 0) / totalChecklists;
            }
            
            const completed = validChecklists.filter(item => item.pflichtProgress >= 100).length;
            const pending = totalChecklists - completed;
            
            console.log('Statistics Update:', { totalChecklists, avgPflicht, avgGesamt, completed, pending });
            
            // Animierte Zahlenupdate
            updateCombinedStats(completed, totalChecklists);
            updateProgressDisplay(Math.round(avgPflicht), Math.round(avgGesamt));
        }
        
        // Zahlen animieren
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
        
        // Fortschrittsbalken animieren
        function animateProgressBar(textElementId, barElementId, targetValue) {
            const textElement = document.getElementById(textElementId);
            const barElement = document.getElementById(barElementId);
            
            console.log('Animate Progress Bar:', { textElementId, barElementId, targetValue });
            
            if (!textElement || !barElement) {
                console.error('Progress bar elements not found:', { textElement, barElement });
                return;
            }
            
            // Sicherstellen, dass targetValue eine gültige Zahl ist
            const safeTargetValue = Math.max(0, Math.min(100, Math.round(targetValue || 0)));
            
            const currentText = textElement.textContent.replace('%', '') || '0';
            const currentValue = parseInt(currentText) || 0;
            const increment = (safeTargetValue - currentValue) / 40;
            
            console.log('Animation values:', { currentValue, safeTargetValue, increment });
            
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
                const color = getProgressColor(roundedValue);
                if (color === '#28a745') { // Grün
                    barElement.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
                } else if (color === '#6cc04a') { // Hellgrün
                    barElement.style.background = 'linear-gradient(90deg, #6cc04a, #28a745)';
                } else if (color === '#ffc107') { // Gelb
                    barElement.style.background = 'linear-gradient(90deg, #ffc107, #fd7e14)';
                } else if (color === '#fd7e14') { // Orange
                    barElement.style.background = 'linear-gradient(90deg, #fd7e14, #dc3545)';
                } else { // Rot
                    barElement.style.background = 'linear-gradient(90deg, #dc3545, #e83e8c)';
                }
            }, 40);
        }
        
        // Kombinierte Stats Card aktualisieren
        function updateCombinedStats(completed, total) {
            const completedElement = document.getElementById('completedCount');
            const totalElement = document.getElementById('totalCount');
            const percentageElement = document.getElementById('completionPercentage');
            const ringElement = document.getElementById('completionRing');
            
            if (!completedElement || !totalElement || !percentageElement || !ringElement) return;
            
            // Zahlen animieren
            animateNumber('completedCount', completed);
            animateNumber('totalCount', total);
            
            // Prozentwert berechnen
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            // Ring-Animation
            const circumference = 2 * Math.PI * 25; // r = 25
            const offset = circumference - (percentage / 100) * circumference;
            
            // Animation für Ring und Prozent
            setTimeout(() => {
                ringElement.style.strokeDashoffset = offset;
                percentageElement.textContent = percentage + '%';
                
                // Dynamische Farbe für Ring und Prozent
                const color = getProgressColor(percentage);
                ringElement.style.stroke = color;
                percentageElement.style.color = color;
            }, 300); // Kleine Verzögerung für bessere Optik
        }


        
        // Pflichtaufgaben Stats aktualisieren
        function updatePflichtStats() {
            console.log('updatePflichtStats called with data:', window.pflichtData);
            
            if (!window.pflichtData || window.pflichtData.length === 0) {
                console.log('No pflichtData available');
                // Stats-Rows bleiben sichtbar auch bei leeren Daten
                return;
            }
            
            // Debug: Datenstruktur analysieren
            console.log('Sample pflichtData item:', window.pflichtData[0]);
            console.log('All completion statuses:', window.pflichtData.map(item => item.completionStatus));
            console.log('All grades:', window.pflichtData.map(item => item.grade));
            
            const totalPflicht = window.pflichtData.length;
            
            // Versuche verschiedene Filterbedingungen
            const completedPflicht1 = window.pflichtData.filter(item => 
                item.completionStatus === 'Erledigt'
            ).length;
            
            const completedPflicht2 = window.pflichtData.filter(item => 
                item.completionStatus && item.completionStatus.includes('Erledigt')
            ).length;
            
            const completedPflicht3 = window.pflichtData.filter(item => 
                item.completionStatus === 'Abgegeben' || item.completionStatus === 'Bewertet' || item.completionStatus === 'Erledigt'
            ).length;
            
            console.log('Completion attempts:', {
                'Exact Erledigt': completedPflicht1,
                'Contains Erledigt': completedPflicht2, 
                'Multiple statuses': completedPflicht3
            });
            
            // Verwende die beste Variante
            const completedPflicht = Math.max(completedPflicht1, completedPflicht2, completedPflicht3);
            
            console.log('Final pflicht stats:', { totalPflicht, completedPflicht });
            
            // Durchschnittsnote berechnen - Debug Version
            console.log('Grade calculation debug:');
            
            // Alle verschiedenen Ansätze probieren
            const gradedItems1 = window.pflichtData.filter(item => {
                const hasGrade = item.grade && item.grade !== '-' && item.grade !== 'Unbekannt';
                if (hasGrade) {
                    const numGrade = parseFloat(item.grade.replace(',', '.'));
                    console.log(`Item "${item.name}": grade="${item.grade}", parsed=${numGrade}, valid=${!isNaN(numGrade)}`);
                    return !isNaN(numGrade);
                }
                return false;
            });
            
            const gradedItems2 = window.pflichtData.filter(item => {
                if (!item.grade || item.grade.trim() === '') return false;
                const gradeStr = item.grade.toString().trim();
                if (gradeStr === '-' || gradeStr === 'Unbekannt' || gradeStr === 'null' || gradeStr === 'undefined') return false;
                const numGrade = parseFloat(gradeStr.replace(',', '.'));
                return !isNaN(numGrade) && numGrade > 0 && numGrade <= 6; // Deutsche Noten 1-6
            });
            
            console.log('Graded items attempts:', {
                'Original filter': gradedItems1.length,
                'Improved filter': gradedItems2.length,
                'gradedItems1 details': gradedItems1.map(item => ({ name: item.name, grade: item.grade })),
                'gradedItems2 details': gradedItems2.map(item => ({ name: item.name, grade: item.grade }))
            });
            
            const gradedItems = gradedItems2.length > 0 ? gradedItems2 : gradedItems1;
            
            let averageGrade = '-';
            if (gradedItems.length > 0) {
                const totalGrade = gradedItems.reduce((sum, item) => {
                    const numGrade = parseFloat(item.grade.replace(',', '.'));
                    console.log(`Adding grade: ${item.grade} -> ${numGrade}`);
                    return sum + numGrade;
                }, 0);
                averageGrade = (totalGrade / gradedItems.length).toFixed(1).replace('.', ',');
                console.log(`Average calculation: ${totalGrade} / ${gradedItems.length} = ${averageGrade}`);
            } else {
                console.log('No valid grades found for average calculation');
            }
            
            // Fallback: Falls alle Versuche 0 ergeben, versuche alternative Ansätze
            if (completedPflicht === 0 && totalPflicht > 0) {
                console.log('Trying fallback completion detection...');
                
                // Alternativer Ansatz: Schaue nach Noten > 0 als "erledigt"
                const gradedAsCompleted = window.pflichtData.filter(item => {
                    if (!item.grade) return false;
                    const gradeStr = item.grade.toString().trim();
                    if (gradeStr === '-' || gradeStr === 'Unbekannt') return false;
                    const numGrade = parseFloat(gradeStr.replace(',', '.'));
                    return !isNaN(numGrade) && numGrade > 0;
                }).length;
                
                console.log('Graded items as completion indicator:', gradedAsCompleted);
                
                // Verwende die bessere Schätzung
                const finalCompleted = Math.max(completedPflicht, gradedAsCompleted);
                updatePflichtCombinedStats(finalCompleted, totalPflicht);
            } else {
                // Stats Card aktualisieren
                updatePflichtCombinedStats(completedPflicht, totalPflicht);
            }
            
            // Durchschnittsnote aktualisieren
            const averageGradeElement = document.getElementById('pflichtAverageGrade');
            if (averageGradeElement) {
                averageGradeElement.textContent = averageGrade;
                
                // Farbe basierend auf Note
                if (averageGrade !== '-') {
                    const numGrade = parseFloat(averageGrade.replace(',', '.'));
                    const color = getGradeColor(averageGrade);
                    averageGradeElement.style.color = color.replace('color: ', '').replace(';', '');
                }
            }
            
            // Stats Row anzeigen
            const pflichtStatsRow = document.getElementById('pflichtStatsRow');
            console.log('pflichtStatsRow element:', pflichtStatsRow);
            
            if (pflichtStatsRow) {
                showBothStatsRows();
                console.log('Both stats rows updated');
            } else {
                console.error('pflichtStatsRow element not found!');
            }
            
            console.log('updatePflichtStats completed');
        }
        
        // Pflichtaufgaben Kombinierte Stats Card aktualisieren
        function updatePflichtCombinedStats(completed, total) {
            const completedElement = document.getElementById('pflichtCompletedCount');
            const totalElement = document.getElementById('pflichtTotalCount');
            const percentageElement = document.getElementById('pflichtCompletionPercentage');
            const ringElement = document.getElementById('pflichtCompletionRing');
            
            if (!completedElement || !totalElement || !percentageElement || !ringElement) return;
            
            // Zahlen animieren
            animateNumber('pflichtCompletedCount', completed);
            animateNumber('pflichtTotalCount', total);
            
            // Prozentwert berechnen
            const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
            
            // Ring-Animation
            const circumference = 2 * Math.PI * 25; // r = 25
            const offset = circumference - (percentage / 100) * circumference;
            
            // Animation für Ring und Prozent
            setTimeout(() => {
                ringElement.style.strokeDashoffset = offset;
                percentageElement.textContent = percentage + '%';
                
                // Dynamische Farbe für Ring und Prozent
                const color = getProgressColor(percentage);
                ringElement.style.stroke = color;
                percentageElement.style.color = color;
            }, 300); // Kleine Verzögerung für bessere Optik
        }
        
        // Globale Variablen für Fortschrittswerte
        let currentPflichtAvg = 0;
        let currentGesamtAvg = 0;
        
        // Progress Display aktualisieren
        function updateProgressDisplay(pflichtAvg, gesamtAvg) {
            currentPflichtAvg = pflichtAvg;
            currentGesamtAvg = gesamtAvg;
            
            console.log('Progress Display Update:', { pflichtAvg, gesamtAvg });
            
            // Aktuell ausgewählten Typ ermitteln
            const selectedRadio = document.querySelector('input[name="progressType"]:checked');
            if (!selectedRadio) {
                console.error('No radio button selected, defaulting to pflicht');
                // Fallback: Pflicht als Default setzen
                const pflichtRadio = document.querySelector('input[name="progressType"][value="pflicht"]');
                if (pflichtRadio) pflichtRadio.checked = true;
            }
            
            const selectedType = selectedRadio ? selectedRadio.value : 'pflicht';
            const targetValue = selectedType === 'pflicht' ? pflichtAvg : gesamtAvg;
            
            console.log('Selected type:', selectedType, 'Target value:', targetValue);
            
            animateProgressBar('avgCompletionText', 'avgCompletionBar', targetValue);
            updateIHKGrade(targetValue);
        }
        
        // Toggle zwischen Pflicht und Gesamt Fortschritt
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
            
            // Farbe der Note basierend auf Qualität
            if (gradeInfo.grade <= 2) {
                gradeText.style.color = '#28a745'; // Grün
            } else if (gradeInfo.grade <= 4) {
                gradeText.style.color = '#ffc107'; // Gelb
            } else {
                gradeText.style.color = '#dc3545'; // Rot
            }
            
            // Tendenz anzeigen
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
            
            // Label-Styling aktualisieren
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
        
        // Insights generieren
        function generateInsights() {
            const validChecklists = checklistData.filter(item => !item.error);
            
            if (validChecklists.length === 0) return;
            
            const avgPflicht = validChecklists.reduce((sum, item) => sum + (item.pflichtProgress || 0), 0) / validChecklists.length;
            const avgGesamt = validChecklists.reduce((sum, item) => sum + (item.gesamtProgress || 0), 0) / validChecklists.length;
            
            // Pflicht-Insights
            let pflichtInsight = '';
            if (avgPflicht >= 80) {
                pflichtInsight = '✅ Ausgezeichneter Fortschritt! Die meisten Pflichtaufgaben sind erfüllt.';
            } else if (avgPflicht >= 50) {
                pflichtInsight = '🟡 Guter Fortschritt, aber es gibt noch Verbesserungspotential.';
            } else {
                pflichtInsight = '🟠 Mehr Fokus auf Pflichtaufgaben empfohlen.';
            }
            
            // Gesamt-Insights
            let gesamtInsight = '';
            if (avgGesamt >= 80) {
                gesamtInsight = '🎆 Hervorragender Gesamtfortschritt!';
            } else if (avgGesamt >= 50) {
                gesamtInsight = '📈 Solider Fortschritt in allen Bereichen.';
            } else {
                gesamtInsight = '🎯 Konzentration auf mehr Aufgaben erforderlich.';
            }
            
            // document.getElementById('pflichtInsights').innerHTML = `<p class="insights-text">${pflichtInsight}</p>`;
            // document.getElementById('gesamtInsights').innerHTML = `<p class="insights-text">${gesamtInsight}</p>`;
            
            // Filter anzeigen
            document.getElementById('filterSection').style.display = 'block';
        }
        
        // Slider Validation Function - Mit Mitziehen
        function validateSliders(changedSlider) {
            const minSlider = document.getElementById('progressFilterMin');
            const maxSlider = document.getElementById('progressFilterMax');
            const minValueDisplay = document.getElementById('minProgressValue');
            const maxValueDisplay = document.getElementById('maxProgressValue');
            
            if (!minSlider || !maxSlider) return;
            
            let minValue = parseInt(minSlider.value);
            let maxValue = parseInt(maxSlider.value);
            
            // Slider mitziehen: Wenn Min größer als Max wird, Max mitziehen
            if (changedSlider === 'min' && minValue > maxValue) {
                maxValue = minValue;
                maxSlider.value = maxValue;
            } 
            // Slider mitziehen: Wenn Max kleiner als Min wird, Min mitziehen
            else if (changedSlider === 'max' && maxValue < minValue) {
                minValue = maxValue;
                minSlider.value = minValue;
            }
            
            // Werte-Anzeige aktualisieren
            minValueDisplay.textContent = minValue + '%';
            maxValueDisplay.textContent = maxValue + '%';
            
            // Filter anwenden
            applyFilters();
        }
        
        // Initial Slider Setup
        function initSliders() {
            const minSlider = document.getElementById('progressFilterMin');
            const maxSlider = document.getElementById('progressFilterMax');
            
            if (!minSlider || !maxSlider) return;
            
            // Initiale Werte setzen
            validateSliders('init');
        }
        
        // Filter anwenden
        function applyFilters() {
            const viewFilter = document.getElementById('viewFilter').value;
            const sortFilter = document.getElementById('sortFilter').value;
            const progressFilterMinEl = document.getElementById('progressFilterMin');
            const progressFilterMaxEl = document.getElementById('progressFilterMax');
            
            // Fallback auf alte IDs falls Range-Slider noch nicht geladen
            const progressFilterMin = progressFilterMinEl ? progressFilterMinEl.value : 0;
            const progressFilterMax = progressFilterMaxEl ? progressFilterMaxEl.value : 100;
            
            let filteredData = checklistData.filter(item => !item.error);
            
            // View-Filter anwenden
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
            
            // Progress-Filter anwenden (Mindest- und Maximalfortschritt)
            filteredData = filteredData.filter(item => 
                item.pflichtProgress >= progressFilterMin && item.pflichtProgress <= progressFilterMax);
            
            // Sortierung anwenden
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
            
            // Charts mit gefilterten Daten aktualisieren
            updateChartsWithFilteredData(filteredData);
            
            // Checklisten-Übersichtstabelle aktualisieren
            updateChecklistTable(filteredData);
        }
        
        // Funktion zur Farbbestimmung basierend auf Fortschritt
        function getProgressColor(progress) {
            if (progress >= 80) return '#28a745'; // Grün
            if (progress >= 60) return '#6cc04a'; // Hellgrün
            if (progress >= 40) return '#ffc107'; // Gelb
            if (progress >= 20) return '#fd7e14'; // Orange
            return '#dc3545'; // Rot
        }

        // Charts mit gefilterten Daten aktualisieren
        function updateChartsWithFilteredData(filteredData) {
            const shortNames = filteredData.map(item => {
                return item.name.length > 20 ? item.name.substring(0, 20) + '...' : item.name;
            });
            
            const pflichtColors = filteredData.map(item => getProgressColor(item.pflichtProgress || 0));
            const gesamtColors = filteredData.map(item => getProgressColor(item.gesamtProgress || 0));
            
            detailPflichtChart.data.labels = shortNames;
            detailPflichtChart.data.datasets[0].data = filteredData.map(item => item.pflichtProgress || 0);
            detailPflichtChart.data.datasets[0].backgroundColor = pflichtColors;
            detailPflichtChart.update();
            
            detailGesamtChart.data.labels = shortNames;
            detailGesamtChart.data.datasets[0].data = filteredData.map(item => item.gesamtProgress || 0);
            detailGesamtChart.data.datasets[0].backgroundColor = gesamtColors;
            detailGesamtChart.update();
        }
        
        // Checklisten-Übersichtstabelle mit gefilterten Daten aktualisieren
        function updateChecklistTable(filteredData) {
            let html = '<h4>📊 Checklist-Übersicht</h4>';
            html += '<table class="info-table" id="checklistTable">';
            html += '<thead>';
            html += '<tr>';
            html += '<th onclick="sortChecklistTableByColumn(0)" class="sortable-header" style="cursor: pointer;">Name <span class="sort-icon">↕️</span></th>';
            html += '<th onclick="sortChecklistTableByColumn(1)" class="sortable-header" style="cursor: pointer;">Pflicht % <span class="sort-icon">↕️</span></th>';
            html += '<th onclick="sortChecklistTableByColumn(2)" class="sortable-header" style="cursor: pointer;">Gesamt % <span class="sort-icon">↕️</span></th>';
            html += '</tr>';
            html += '</thead>';
            html += '<tbody id="checklistTableBody">';
            
            filteredData.forEach((item, index) => {
                const pflichtPercent = item.pflichtProgress !== undefined ? item.pflichtProgress : 0;
                const gesamtPercent = item.gesamtProgress !== undefined ? item.gesamtProgress : 0;
                const pflichtDisplay = item.pflichtProgress !== undefined ? `${Math.round(item.pflichtProgress)}%` : 'n/a';
                const gesamtDisplay = item.gesamtProgress !== undefined ? `${Math.round(item.gesamtProgress)}%` : 'n/a';
                
                html += `<tr data-name="${item.name.toLowerCase()}" data-pflicht="${pflichtPercent}" data-gesamt="${gesamtPercent}">
                    <td><a href="${item.url}" target="_blank">${item.name}</a></td>
                    <td><strong class="progress-cell" data-value="${pflichtPercent}">${pflichtDisplay}</strong></td>
                    <td><strong class="progress-cell" data-value="${gesamtPercent}">${gesamtDisplay}</strong></td>
                </tr>`;
            });
            
            html += '</tbody>';
            html += '</table>';
            document.getElementById('sessionInfo').innerHTML = html;
            
            // Store data for sorting
            window.currentChecklistTableData = filteredData;
        }
        
        
        // Charts initialisieren
        function initCharts() {
            // 1. Durchschnittlicher Pflicht-Fortschritt
            // const overviewPflichtCtx = document.getElementById('overviewPflichtChart').getContext('2d');
            
            // overviewPflichtChart = new Chart(overviewPflichtCtx, {
            //     type: 'bar'
            // });
            
            // 2. Durchschnittlicher Gesamt-Fortschritt
            // const overviewGesamtCtx = document.getElementById('overviewGesamtChart').getContext('2d');
            
            // overviewGesamtChart = new Chart(overviewGesamtCtx, {
              
            // });
            
            // 3. Pflicht-Fortschritt pro Checklist
            const detailPflichtCtx = document.getElementById('detailPflichtChart').getContext('2d');
            detailPflichtChart = new Chart(detailPflichtCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Pflicht %',
                        data: [],
                        backgroundColor: '#28a745'
                    }]
                },
                options: { 
                    responsive: true,
                    scales: { y: { beginAtZero: true, max: 100 }},
                    plugins: { legend: { display: false }}
                }
            });
            
            // 4. Gesamt-Fortschritt pro Checklist
            const detailGesamtCtx = document.getElementById('detailGesamtChart').getContext('2d');
            detailGesamtChart = new Chart(detailGesamtCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Gesamt %',
                        data: [],
                        backgroundColor: '#007bff'
                    }]
                },
                options: { 
                    responsive: true,
                    scales: { y: { beginAtZero: true, max: 100 }},
                    plugins: { legend: { display: false }}
                }
            });
        }
        
        // Charts aktualisieren
        function updateCharts() {
            if (!checklistData.length) return;
            
            const validChecklists = checklistData.filter(item => !item.error);
            
            // Durchschnittswerte berechnen
            let totalPflichtProgress = 0, totalGesamtProgress = 0;
            let validItems = 0;
            
            validChecklists.forEach(item => {
                if (item.pflichtProgress !== undefined && item.gesamtProgress !== undefined) {
                    totalPflichtProgress += item.pflichtProgress;
                    totalGesamtProgress += item.gesamtProgress;
                    validItems++;
                }
            });
            
            const avgPflichtProgress = validItems > 0 ? totalPflichtProgress / validItems : 0;
            const avgGesamtProgress = validItems > 0 ? totalGesamtProgress / validItems : 0;
            
            // Charts aktualisieren mit dynamischen Farben
            const pflichtColor = getProgressColor(avgPflichtProgress);
            const gesamtColor = getProgressColor(avgGesamtProgress);
            
            // overviewPflichtChart.data.datasets[0].data = [avgPflichtProgress, 100 - avgPflichtProgress];
            // overviewPflichtChart.data.datasets[0].backgroundColor = [pflichtColor, '#e9ecef'];
            // overviewPflichtChart.update();
            
            // overviewGesamtChart.data.datasets[0].data = [avgGesamtProgress, 100 - avgGesamtProgress];
            // overviewGesamtChart.data.datasets[0].backgroundColor = [gesamtColor, '#e9ecef'];
            // overviewGesamtChart.update();
            
            // Namen kürzen für Übersichtlichkeit
            const shortNames = validChecklists.map(item => {
                return item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name;
            });
            
            const pflichtColors = validChecklists.map(item => getProgressColor(item.pflichtProgress || 0));
            const gesamtColors = validChecklists.map(item => getProgressColor(item.gesamtProgress || 0));
            
            detailPflichtChart.data.labels = shortNames;
            detailPflichtChart.data.datasets[0].data = validChecklists.map(item => item.pflichtProgress || 0);
            detailPflichtChart.data.datasets[0].backgroundColor = pflichtColors;
            detailPflichtChart.update();
            
            detailGesamtChart.data.labels = shortNames;
            detailGesamtChart.data.datasets[0].data = validChecklists.map(item => item.gesamtProgress || 0);
            detailGesamtChart.data.datasets[0].backgroundColor = gesamtColors;
            detailGesamtChart.update();
        }

        // Funktion um beide Stats-Rows anzuzeigen wenn Daten verfügbar sind
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
        
        // Tabs Umschalten
        function showTab(tab) {
            document.getElementById('checklistsTab').style.display = tab === 'checklists' ? 'block' : 'none';
            document.getElementById('pflichtTab').style.display = tab === 'pflicht' ? 'block' : 'none';
            
            // Stats-Rows sind jetzt immer sichtbar, keine bedingte Anzeige mehr nötig
            showBothStatsRows();
            
            // Button-Highlight
            // Update active/inactive states
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

        // Pflichtaufgaben Charts
        // let pflichtStatusChart, pflichtGradeChart;
        function createPflichtCharts(data) {
            // Status Chart
            const statusCounts = { 'Erledigt': 0, 'Zu erledigen': 0 };
            const grades = [];
            data.forEach(item => {
                statusCounts[item.completionStatus] = (statusCounts[item.completionStatus] || 0) + 1;
                if (item.grade && item.grade !== '-' && !isNaN(parseFloat(item.grade.replace(',', '.')))) {
                    grades.push(parseFloat(item.grade.replace(',', '.')));
                }
            });

            // Status Pie
            // const ctxStatus = document.getElementById('pflichtStatusChart').getContext('2d');
            // if (pflichtStatusChart) pflichtStatusChart.destroy();
            // pflichtStatusChart = new Chart(ctxStatus, {
            //     type: 'doughnut',
            //     data: {
            //         labels: Object.keys(statusCounts),
            //         datasets: [{
            //             data: Object.values(statusCounts),
            //             backgroundColor: ['#28a745', '#ffc107']
            //         }]
            //     },
            //     options: { responsive: true }
            // });

            // Grade Bar
            // const ctxGrade = document.getElementById('pflichtGradeChart').getContext('2d');
            // if (pflichtGradeChart) pflichtGradeChart.destroy();
            // pflichtGradeChart = new Chart(ctxGrade, {
            //     type: 'bar',
            //     data: {
            //         labels: grades.map((_, i) => `Aufgabe ${i+1}`),
            //         datasets: [{
            //             label: 'Bewertung',
            //             data: grades,
            //             backgroundColor: '#007bff'
            //         }]
            //     },
            //     options: { responsive: true, scales: { y: { beginAtZero: true } } }
            // });

            // document.getElementById('pflichtDashboardContainer').style.display = 'none';
            
            // Auch Stats-Rows anzeigen falls vorhanden
            showBothStatsRows();
        }

        // Pflichtaufgaben laden überschreiben
        async function extractPflichtOverview() {
            showLoading(true);

            const courseId = '2036416';
            const assignmentOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${courseId}&expand[]=assign#assign_overview_collapsible`;
            const quizOverviewUrl = `https://lernplattform.mebis.bycs.de/course/overview.php?id=${courseId}&expand[]=quiz#quiz_overview_collapsible`;

            try {
                // Beide Seiten parallel laden
                const [assignRes, quizRes] = await Promise.all([
                    fetch(assignmentOverviewUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } }),
                    fetch(quizOverviewUrl, { credentials: 'same-origin', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
                ]);

                if (!assignRes.ok || !quizRes.ok) {
                    throw new Error('Fehler beim Laden der Daten');
                }

                const [assignHtml, quizHtml] = await Promise.all([assignRes.text(), quizRes.text()]);
                const parser = new DOMParser();
 // Pflicht-Assignments extrahieren
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

                // Pflicht-Quizzes extrahieren
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
                    // Quizzes haben meist keinen Abgabestatus
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

                // Zusammenführen und sortieren
                const allData = [...assignmentData, ...quizData].sort((a, b) => a.name.localeCompare(b.name, 'de'));

                if (allData.length > 0) {
                    // Store data globally for filtering
                    window.pflichtData = allData;
                    
                    updatePflichtTable(allData);
                    createPflichtCharts(allData);
                    updatePflichtStats();
                    
                    // Show filter section
                    document.getElementById('pflichtFilterSection').style.display = 'block';
                } else {
                    // Keine Pflichtaufgaben gefunden - Testmodus aktivieren
                    activateTestMode();
                    // Store test data globally for filtering
                    window.pflichtData = TEST_PFLICHT_DATA;
                    
                    updatePflichtTable(TEST_PFLICHT_DATA);
                    createPflichtCharts(TEST_PFLICHT_DATA);
                    updatePflichtStats();
                    
                    // Show filter section
                    document.getElementById('pflichtFilterSection').style.display = 'block';
                }

            } catch (error) {
                // Fehler beim Laden der Pflichtaufgaben - Testmodus aktivieren
                console.error('Fehler beim Laden der Pflichtaufgaben-Daten:', error);
                activateTestMode();
                // Store test data globally for filtering
                window.pflichtData = TEST_PFLICHT_DATA;
                
                updatePflichtTable(TEST_PFLICHT_DATA);
                createPflichtCharts(TEST_PFLICHT_DATA);
                updatePflichtStats();
                
                // Show filter section
                document.getElementById('pflichtFilterSection').style.display = 'block';
            }

            showLoading(false);
        }

        // Automatisches Laden beim Start
        window.addEventListener('DOMContentLoaded', () => {
            showTab('checklists');
            
            
            // Slider initialisieren nach kurzer Verzögerung
            setTimeout(() => {
                initSliders();
            }, 100);
            
            // Testmodus-Indikator wird dynamisch angezeigt wenn TEST_MODE aktiviert wird
            
            extractFromChecklistIndex();
            extractPflichtOverview();
        });


       // Refresh-Button Loading-Zustand steuern
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

        // Refresh-Button
        document.getElementById('refreshBtn').onclick = async () => {
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

        // Tab-Wechsel: Bei Wechsel zu Pflicht Tab automatisch laden
        document.getElementById('tabPflicht').onclick = () => {
            showTab('pflicht');
            extractPflichtOverview();
        };
        document.getElementById('tabChecklists').onclick = () => {
            showTab('checklists');
            extractFromChecklistIndex();
        };
        
        // Pflichtaufgaben Filter Functions
        function applyPflichtFilters() {
            if (!window.pflichtData) return;
            
            const statusFilter = document.getElementById('pflichtStatusFilter').value;
            const typeFilter = document.getElementById('pflichtTypeFilter').value;
            const gradeFilter = document.getElementById('pflichtGradeFilter').value;
            const sortFilter = document.getElementById('pflichtSortFilter').value;
            
            let filteredData = [...window.pflichtData];
            
            // Status Filter
            if (statusFilter !== 'all') {
                if (statusFilter === 'completed') {
                    filteredData = filteredData.filter(item => item.completionStatus === 'Erledigt');
                } else if (statusFilter === 'pending') {
                    filteredData = filteredData.filter(item => item.completionStatus === 'Zu erledigen');
                }
            }
            
            // Type Filter
            if (typeFilter !== 'all') {
                filteredData = filteredData.filter(item => item.type === typeFilter);
            }
            
            // Grade Filter
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
            
            // Sort Filter
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
                        return gradeA - gradeB; // Smaller grade = better
                    });
                    break;
                case 'grade-worst':
                    filteredData.sort((a, b) => {
                        const gradeA = parseFloat(a.grade.replace(',', '.'));
                        const gradeB = parseFloat(b.grade.replace(',', '.'));
                        if (isNaN(gradeA) && isNaN(gradeB)) return 0;
                        if (isNaN(gradeA)) return -1;
                        if (isNaN(gradeB)) return 1;
                        return gradeB - gradeA; // Larger grade = worse
                    });
                    break;
                default:
                    filteredData.sort((a, b) => a.name.localeCompare(b.name, 'de'));
            }
            
            updatePflichtTable(filteredData);
            createPflichtCharts(filteredData);
        }
        
        function updatePflichtTable(data) {
            let html = '<h4>📚 Pflichtaufgaben-Übersicht</h4>';
            html += '<table class="info-table" id="pflichtTable">';
            html += '<thead>';
            html += '<tr>';
            html += '<th onclick="sortPflichtTableByColumn(0)" class="sortable-header" style="cursor: pointer;">Name <span class="sort-icon">↕️</span></th>';
            html += '<th onclick="sortPflichtTableByColumn(1)" class="sortable-header" style="cursor: pointer;">Typ <span class="sort-icon">↕️</span></th>';
            html += '<th onclick="sortPflichtTableByColumn(2)" class="sortable-header" style="cursor: pointer;">Status <span class="sort-icon">↕️</span></th>';
            html += '<th onclick="sortPflichtTableByColumn(3)" class="sortable-header" style="cursor: pointer;">Abgabe <span class="sort-icon">↕️</span></th>';
            html += '<th onclick="sortPflichtTableByColumn(4)" class="sortable-header" style="cursor: pointer;">Note <span class="sort-icon">↕️</span></th>';
            html += '</tr>';
            html += '</thead>';
            html += '<tbody id="pflichtTableBody">';
            
            data.forEach((item, index) => {
                const statusColor = item.completionStatus === 'Erledigt' ? 'color: green;' : 'color: orange;';
                const gradeColor = getGradeColor(item.grade);
                
                html += `<tr data-name="${item.name.toLowerCase()}" data-type="${item.type.toLowerCase()}" data-status="${item.completionStatus.toLowerCase()}" data-grade="${item.grade}">
                    <td><a href="${item.url}" target="_blank" title="${item.name}">${item.name}</a></td>
                    <td><span class="type-badge" style="padding: 2px 8px; border-radius: 12px; font-size: 0.8em; background: ${item.type === 'Quiz' ? '#e3f2fd' : '#f3e5f5'}; color: ${item.type === 'Quiz' ? '#1976d2' : '#7b1fa2'};">${item.type}</span></td>
                    <td><span style="${statusColor}; font-weight: 600;">${item.completionStatus}</span></td>
                    <td>${item.submissionStatus}</td>
                    <td><strong style="${gradeColor}">${item.grade}</strong></td>
                </tr>`;
            });
            
            html += '</tbody>';
            html += '</table>';
            document.getElementById('pflichtSessionInfo').innerHTML = html;
            
            // Store current data for sorting
            window.currentPflichtTableData = data;
        }
        
        function getGradeColor(grade) {
            if (grade === '-' || grade === 'Unbekannt') return 'color: #666;';
            const numGrade = parseFloat(grade.replace(',', '.'));
            if (isNaN(numGrade)) return 'color: #666;';
            if (numGrade <= 1.5) return 'color: #2e7d32;'; // Green for excellent
            if (numGrade <= 2.5) return 'color: #1976d2;'; // Blue for good
            if (numGrade <= 3.5) return 'color: #f57c00;'; // Orange for satisfactory
            return 'color: #d32f2f;'; // Red for poor
        }
        
        
        function sortPflichtTableByColumn(columnIndex) {
            if (!window.currentPflichtTableData) return;
            
            const sortedData = [...window.currentPflichtTableData];
            
            // Toggle sort direction
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
                        if (isNaN(valueA)) valueA = 999; // Put ungraded at end
                        if (isNaN(valueB)) valueB = 999;
                        break;
                    default:
                        return 0;
                }
                
                if (valueA < valueB) return ascending ? -1 : 1;
                if (valueA > valueB) return ascending ? 1 : -1;
                return 0;
            });
            
            // Update sort icon
            updatePflichtSortIcons(columnIndex, ascending);
            
            updatePflichtTable(sortedData);
        }
        
        function updatePflichtSortIcons(activeColumn, ascending) {
            // Reset all icons
            const headers = document.querySelectorAll('#pflichtTable .sortable-header .sort-icon');
            headers.forEach(icon => icon.textContent = '↕️');
            
            // Set active icon
            const activeIcon = document.querySelector(`#pflichtTable .sortable-header:nth-child(${activeColumn + 1}) .sort-icon`);
            if (activeIcon) {
                activeIcon.textContent = ascending ? '↑' : '↓';
            }
        }
        
        
        // Checklist Table Sorting Functions
        function sortChecklistTableByColumn(columnIndex) {
            if (!window.currentChecklistTableData) return;
            
            const sortedData = [...window.currentChecklistTableData];
            
            // Toggle sort direction
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
            
            // Update sort icon
            updateChecklistSortIcons(columnIndex, ascending);
            
            // Update table with sorted data
            updateChecklistTable(sortedData);
        }
        
        function updateChecklistSortIcons(activeColumn, ascending) {
            // Reset all icons
            const headers = document.querySelectorAll('#checklistTable .sortable-header .sort-icon');
            headers.forEach(icon => icon.textContent = '↕️');
            
            // Set active icon
            const activeIcon = document.querySelector(`#checklistTable .sortable-header:nth-child(${activeColumn + 1}) .sort-icon`);
            if (activeIcon) {
                activeIcon.textContent = ascending ? '↑' : '↓';
            }
        }