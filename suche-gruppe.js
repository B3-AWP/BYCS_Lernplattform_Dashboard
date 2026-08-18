// ============================================================
// suche-gruppe.js — Hilfsmittel, kein Teil des Dashboards.
//
// Sucht die Klasse/Gruppe in Moodle — same-origin, also ohne CORS.
// Der Weg ueber selfservice.bycs.de scheidet aus: Der Server sendet
// keinen Access-Control-Allow-Origin-Header, der Browser verwirft
// die Antwort ungelesen.
//
// Anwendung: auf einer Seite von lernplattform.bycs.de in die
// Konsole einfuegen. Das Skript probiert mehrere Moodle-Seiten
// durch und meldet, auf welcher die Klasse auftaucht — samt
// Umfeld der Fundstelle, aus dem sich der Selektor ergibt.
// ============================================================
(async () => {
    // Klassen und Kurse kommen aus plan.json, damit dieses Skript
    // nicht veraltet, wenn dort etwas ergaenzt wird.
    let KLASSEN = ['IFA12A', 'IFA12B', 'IFA12C', 'IFA12D'];
    let KURSE = ['2491549'];

    try {
        const plan = await fetch('plan.json', { cache: 'no-store' }).then(r => r.json());
        KLASSEN = Object.keys(plan.klassenZuSchiene);
        KURSE = plan.kurse.map(kurs => kurs.moodleCourseId);
        console.log('plan.json gelesen — Klassen:', KLASSEN.join(', '));
    } catch {
        console.warn('plan.json nicht erreichbar, nutze fest hinterlegte Werte.');
    }

    const SEITEN = [
        ['Eigenes Profil', '/user/profile.php'],
        ['Dashboard',      '/my/'],
    ];

    // Die kursbezogenen Seiten fuer jeden Kurs aus dem Plan.
    for (const kurs of KURSE) {
        SEITEN.push(
            [`Profil (Kurs ${kurs})`,      `/user/view.php?course=${kurs}`],
            [`Teilnehmer (Kurs ${kurs})`,  `/user/index.php?id=${kurs}`],
            [`Gruppen (Kurs ${kurs})`,     `/group/index.php?id=${kurs}`],
            [`Kursstart (Kurs ${kurs})`,   `/course/view.php?id=${kurs}`]
        );
    }

    console.log('%c— Suche Gruppe in Moodle —', 'font-weight:bold;font-size:14px');

    const treffer = [];
    const kandidaten = new Set();

    for (const [name, pfad] of SEITEN) {
        try {
            const antwort = await fetch(pfad, {
                credentials: 'include',
                signal: AbortSignal.timeout(10000)
            });

            if (!antwort.ok) {
                console.log(`✗ ${name.padEnd(24)} HTTP ${antwort.status}  ${pfad}`);
                continue;
            }

            const html = await antwort.text();
            const gross = html.toUpperCase();

            const gefunden = KLASSEN.filter(k =>
                new RegExp(`(^|[^A-Z0-9])${k}([^A-Z0-9]|$)`).test(gross)
            );

            if (gefunden.length > 0) {
                console.log(`%c✓ ${name.padEnd(24)} ${gefunden.join(', ')}  ${pfad}`,
                            'color:green;font-weight:bold');
                treffer.push({ name, pfad, gefunden, html });

                // Umfeld zeigen: verraet, in welchem Element es steht
                const i = gross.indexOf(gefunden[0]);
                console.log('   Umfeld:', html.slice(Math.max(0, i - 250), i + 150));
            } else {
                console.log(`· ${name.padEnd(24)} keine Klasse  ${pfad}`);

                // Sammeln, was ueberhaupt wie ein Klassenname aussieht —
                // vielleicht heisst die Gruppe in Moodle schlicht anders
                // als in plan.json hinterlegt.
                (html.match(/\b[A-Z]{2,4}\d{1,2}[A-Z]?\b/g) || [])
                    .forEach(k => kandidaten.add(k));
            }

        } catch (fehler) {
            console.log(`✗ ${name.padEnd(24)} ${fehler.name}: ${fehler.message}`);
        }
    }

    console.log('\n%cErgebnis:', 'font-weight:bold');
    if (treffer.length === 0) {
        console.warn(
            'Keine der Seiten nennt eine bekannte Klasse.\n' +
            'Dann bleibt es beim Auswahlmenue — oder die Gruppe muesste in\n' +
            'Moodle erst als Gruppe/Kohorte gepflegt werden.'
        );
        console.log(
            'Zeichenketten, die wie ein Klassenname aussehen:',
            kandidaten.size ? [...kandidaten].slice(0, 40) : '(keine)'
        );
    } else {
        console.log('Nutzbar sind:', treffer.map(t => t.pfad).join(', '));
        console.log('Die Fundstellen oben zeigen, welcher Selektor passt.');
        window.dbgTreffer = treffer;
        console.log('%cDetails in window.dbgTreffer', 'color:#666');
    }
})();
