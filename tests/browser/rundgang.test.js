// Rundgang durch die App im Browser: alle Systeme, Ansichten, Sprachen,
// PDF-Exporte, 3D-Export, Koordinaten, Speichern/Laden, Ergebnisleiste.
// Geprüft wird vor allem: keine Skriptfehler, und jede Funktion liefert etwas.
// (Ein solcher Test hätte den PDF-Fehler aus v3.6 sofort gemeldet.)
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { serverStarten, browserStarten, appOeffnen } = require('./hilfe.js');

let server, url, browser;
before(async () => { ({ server, url } = await serverStarten()); browser = await browserStarten(); });
after(async () => { await browser?.close(); server?.close(); });

// window.open ersetzen: PDF-Exporte schreiben ihr HTML sonst in ein neues Fenster
async function fensterAbfangen(seite) {
  await seite.evaluate(() => {
    window.__fenster = [];
    window.open = () => {
      const f = { html: '', onload: null, focus() {}, print() {}, addEventListener() {},
                  document: { write(h) { f.html += h; }, open() {}, close() {} } };
      window.__fenster.push(f);
      return f;
    };
  });
}

// Rohe Übersetzungsschlüssel (z. B. «koord.fehlt») im sichtbaren Text = fehlende Übersetzung
const ROHSCHLUESSEL = /\b(?:abs|hind|lf|ui|par|res|pdf|foto|koord|exp|sys|span|bp|hb|msg|err|leg|canvas|dyn|val|cm|preset|rf|t3|lm|draw|share|proj|reglage|mat|card|app|btn|probe|warn|pwa)\.[a-z0-9]+(?:\.[a-z0-9_]+)*\b/i;

test('Start ohne Fehler, erste Berechnung vorhanden', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => ({ L: calcState.L, sag: calcState.c2.sag, version: APP_VERSION }));
  assert.ok(r.L > 0 && r.sag > 0);
  assert.match(r.version, /^v\d+\.\d+/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Alle Systeme × Ansichten × PDF-Exporte', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  for (const sys of ['nfl', 'rfl', 'el']) {
    await seite.evaluate(s => { setSysMode(s); berechnen(); }, sys);
    for (const ansicht of ['zeichnung', 'diagramm']) await seite.evaluate(a => setCanvasView(a), ansicht);
    const pdf = await seite.evaluate(() => {
      window.__fenster.length = 0;
      pdfExport(); pdfExportDrawing();
      return window.__fenster.map(f => f.html);
    });
    assert.equal(pdf.length, 2, `${sys}: zwei PDF-Fenster erwartet`);
    assert.ok(pdf[0].length > 5000 && pdf[0].includes('<h1'), `${sys}: Berechnungs-PDF leer`);
    assert.ok(pdf[1].includes('<svg'), `${sys}: Zeichnungs-PDF ohne Zeichnung`);
  }
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Sprachen DE / FR / IT: vollständig, keine rohen Schlüssel sichtbar', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const fehlend = await seite.evaluate(() => {
    const de = Object.keys(LANG.de);
    return { fr: de.filter(k => !(k in LANG.fr)), it: de.filter(k => !(k in LANG.it)) };
  });
  assert.deepEqual(fehlend, { fr: [], it: [] });
  for (const sprache of ['fr', 'it', 'de']) {
    for (const sys of ['nfl', 'rfl', 'el']) {
      const text = await seite.evaluate(([l, s]) => { setLang(l); setSysMode(s); berechnen(); return document.body.innerText; }, [sprache, sys]);
      const treffer = text.match(ROHSCHLUESSEL);
      assert.equal(treffer, null, `${sprache}/${sys}: roher Schlüssel «${treffer?.[0]}»`);
    }
  }
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Foto-Ansicht: Hinweis einmal pro Start', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const offen = () => seite.evaluate(() => document.getElementById('rueckfrage').classList.contains('open'));
  await seite.evaluate(() => setCanvasView('foto'));
  assert.equal(await offen(), true);
  await seite.click('#rf-ok');
  await seite.evaluate(() => { setCanvasView('diagramm'); setCanvasView('foto'); });
  assert.equal(await offen(), false);
  await seite.evaluate(() => setCanvasView('diagramm'));
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Koordinaten LV95 → Spannweite; Höhe aus SOK m ü. M.; IFC und DXF georeferenziert', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.evaluate(() => {
    const setze = (id, v) => { document.getElementById(id).value = v; };
    setze('koord-e-left', 2600000.5); setze('koord-n-left', 1200000.25);
    setze('koord-e-right', 2600030); setze('koord-n-right', 1200033.9);
    setze('sok-mum-left', 499.7); onSokMumLeftInput();
    setze('sok-mum-right', 501.1); document.getElementById('sok-mum-right').dataset.userEdited = '1'; onSokMumRightInput();
    setze('mast-delta-sok-left', 0.3); setze('mast-delta-sok-right', 0.1);   // nur Mastfuss, ändert die SOK nicht
    koordSchalten(true);
  });
  const z = await seite.evaluate(() => ({ L: calcState.L, sokL: getSokMumLeft(), sokR: getSokMumRight(),
    gesperrt: document.getElementById('span').readOnly }));
  assert.equal(z.L, 44.75);
  assert.equal(z.sokL, 499.7);
  assert.equal(z.sokR, 501.1);
  assert.equal(z.gesperrt, true);

  const laden = async fn => {
    const [dl] = await Promise.all([seite.waitForEvent('download'), seite.evaluate(fn)]);
    const teile = []; for await (const t of await dl.createReadStream()) teile.push(t);
    return { name: dl.suggestedFilename(), inhalt: Buffer.concat(teile).toString('utf8') };
  };
  for (const sys of ['nfl', 'rfl', 'el']) {
    await seite.evaluate(s => setSysMode(s), sys);
    const ifc = await laden('exportIfc()');
    assert.match(ifc.name, /\.ifc$/);
    assert.match(ifc.inhalt, /FILE_SCHEMA\(\('IFC4'\)\)/);
    assert.match(ifc.inhalt, /IFCMAPCONVERSION\(#\d+,#\d+,2600000\.,1200000\./);
    assert.equal((ifc.inhalt.match(/=IFCCABLESEGMENT\(/g) || []).length > 0, true);
    const dxf = await laden('exportDxf()');
    assert.match(dxf.inhalt, /0\nEOF\n$/);
    // linker Aufhängepunkt: E/N wie eingegeben, H = SOK + h1
    assert.match(dxf.inhalt, /\n10\n2600000\.5000\n20\n1200000\.2500\n30\n506\.7000\n/);
  }
  // Ausschalten gibt die Felder frei
  await seite.evaluate(() => koordSchalten(false));
  assert.equal(await seite.evaluate(() => document.getElementById('span').readOnly), false);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('R-FL: Fahrdraht folgt dem Tragseil nur bei Eislast (wie Excel)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    setSysMode('rfl');
    const fdMitte = zl => {
      document.getElementById('zl-eis').value = zl; updateEislastVisibility(); berechnen();
      const L = calcState.L;
      return { dy: rflFahrdrahtVerschiebung(calcState.c2, calcState.c_fd_ref, L / 2), sag: calcState.c2.sag };
    };
    return { ohne: fdMitte(0), mit: fdMitte(15) };
  });
  assert.equal(r.ohne.dy, 0);
  assert.ok(Math.abs(-r.mit.dy - (r.mit.sag - r.ohne.sag)) < 0.002, 'Fahrdraht sinkt gleich wie Tragseil');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Projekt speichern und wieder laden', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    setSysMode('el'); document.getElementById('h2').value = '8.00'; berechnen();
    const zustand = JSON.parse(JSON.stringify(getProjectState()));
    const vorher = calcState.c2.sag;
    setSysMode('nfl'); document.getElementById('h2').value = '7.00'; berechnen();
    const ok = setProjectState(zustand); berechnen();
    return { ok, sys: sysMode, vorher, nachher: calcState.c2.sag };
  });
  assert.notEqual(r.ok, false);
  assert.equal(r.sys, 'el');
  assert.equal(r.nachher, r.vorher);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Tablet hochkant: Ergebnisleiste erscheint beim Scrollen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url,
    { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  await seite.evaluate(() => scrollTo(0, 0));
  await seite.waitForTimeout(300);
  const an = await seite.evaluate(() => document.getElementById('ergebnisleiste').classList.contains('an'));
  const text = await seite.evaluate(() => document.querySelector('#ergebnisleiste .el-inhalt').innerText);
  assert.equal(an, true);
  assert.match(text, /\d\.\d\d m/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Dunkelmodus: keine hellen Eingabefelder (H-Punkte, Mindestabstand, Mastangaben)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { colorScheme: 'dark' });
  const hell = await seite.evaluate(() => {
    document.getElementById('mastangaben').open = true;
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput(); berechnen();
    const lum = s => { const m = s.match(/[\d.]+/g); if (!m) return null; const [r, g, b, a = 1] = m.map(Number);
      return a < .05 ? null : (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
    const flaeche = el => { for (let e = el; e; e = e.parentElement) { const l = lum(getComputedStyle(e).backgroundColor); if (l !== null) return l; } return 0; };
    return [...document.querySelectorAll('input:not([type=checkbox]):not([type=range]):not([type=file]), select')]
      .filter(el => el.offsetParent !== null && flaeche(el) > 0.45).map(el => el.id || el.className);
  });
  assert.deepEqual(hell, []);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Fahrdrahthöhe hf_min / hf_max: Excel-Fall, Sprachen, PDF, Speichern', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const r = await seite.evaluate(() => {
    // In der Excel gespeicherter Fall (hfmin_v11_D / hfmax_v11_D): N-FL StCu 50 + Cu 107, c = L_m = 30 m,
    // Ts unbelastet 1700 N bei 10 °C, H_Fd 8500 N — diese Werte kommen fest aus der Durchhang-Berechnung
    document.getElementById('span').value = '30'; document.getElementById('temp1').value = '10';
    updateH_Ts_ubFromT1(); berechnen();
    document.getElementById('hf-btn').click();
    const offen = document.getElementById('hf-modal').classList.contains('open');
    const fest = { kombi: hfEingabe.kombi, Lm: hfEingabe.Lm, c: hfEingabe.c, H_ub: hfEingabe.H_ub, T_montage: hfEingabe.T_montage, H_Fd: hfEingabe.H_Fd };
    const keineFelder = ['hf-kombi', 'hf-Lm', 'hf-H_ub', 'hf-T_montage', 'hf-H_Fd', 'hf-typ-nfl', 'hf-uebernehmen'].every(id => !document.getElementById(id));
    const zusammenfassung = document.getElementById('hf-fest').textContent.replace(/\s+/g, ' ');
    Object.assign(hfEingabe, { v: 141, bue: false, un: 15, schotter: false, ebv: 2, f: 0, H: 0, Tmin: -5, zlMin: 7, lrp: false, Tmax: -5, zlMax: 7 });
    renderHf();
    const werte = () => [document.getElementById('hf-wert-min').innerText, document.getElementById('hf-wert-max').innerText];
    const excel = werte();
    // Zusatzlast nur bei −5 °C: Temperatur ändern setzt sie auf 0 und sperrt das Feld
    hfWert('Tmax', '-20');
    const zlGesperrt = document.getElementById('hf-zlMax').disabled && hfEingabe.zlMax === 0;
    // c anders wählen als L, dann zurück; L ändern → c folgt
    hfWert('c', '40'); const cFrei = hfEingabe.cManuell === true && hfEingabe.c === 40;
    hfEingabe.cManuell = false; closeHf(); document.getElementById('span').value = '33.4'; berechnen(); openHf();
    const cAusL = hfEingabe.c === 34;
    // R-FL (in der Durchhang-Berechnung gewählt): Fallprüfung sichtbar, Ergebnis vorhanden
    closeHf(); setSysMode('rfl'); openHf();
    const rfl = !!document.getElementById('hf-p11') && werte()[0].includes('mm');
    const grafiken = document.querySelectorAll('#hf-modal .hf-grafiken svg').length;
    const texte = {};
    for (const l of ['fr', 'it', 'de']) { setLang(l); texte[l] = document.getElementById('hf-modal').innerText; }
    window.__fenster.length = 0; hfPdf();
    const pdf = window.__fenster.map(f => f.html);
    const zustand = JSON.parse(JSON.stringify(getProjectState()));
    hfEingabe = null; setProjectState(zustand);
    const geladen = hfEingabe && hfEingabe.typ === 'rfl' && hfEingabe.Tmax === -20;
    closeHf();
    return { offen, fest, keineFelder, zusammenfassung, excel, zlGesperrt, cFrei, cAusL, rfl, grafiken, texte, pdf, geladen };
  });
  assert.equal(r.offen, true);
  assert.deepEqual(r.fest, { kombi: 'stcu50_cu107', Lm: 30, c: 30, H_ub: 1700, T_montage: 10, H_Fd: 8500 });
  assert.equal(r.keineFelder, true, 'feste Werte nicht separat eingebbar');
  assert.match(r.zusammenfassung, /Aus der Durchhang-Berechnung \(fest\): N-FL · L = 30.00 m · StCu 50 \+ Cu 107 · Lm = 30.00 m · Ts unbelastet \(Montage\) 1'700 N bei T1 = \+10 °C · HFd 8'500 N/);
  assert.equal(r.cFrei, true);
  assert.equal(r.cAusL, true, 'c folgt L (33.4 m → 34 m)');
  assert.deepEqual(r.excel.map(s => s.split(' mm')[0]), ["4'928", "6'104"]);
  assert.equal(r.zlGesperrt, true);
  assert.equal(r.rfl, true);
  for (const [l, text] of Object.entries(r.texte)) {
    const treffer = text.match(/\bhf\.[a-z0-9.]+\b/);
    assert.equal(treffer, null, `${l}: roher Schlüssel «${treffer?.[0]}»`);
  }
  assert.equal(r.grafiken, 2, 'Höhenleiter und Kurven über die Spannweite');
  assert.equal(r.pdf.length, 1);
  assert.match(r.pdf[0], /<h1/);
  assert.equal((r.pdf[0].match(/<svg[^>]*class="hf-svg"/g) || []).length, 2, 'Grafiken im PDF');
  assert.match(r.pdf[0], /BETA – nicht verifiziert/);
  assert.equal(r.geladen, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('H-Punkte nur in m ü. M.: ohne SOK Hinweis und keine Prüfung', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    document.getElementById('sok-mum-left').value = ''; document.getElementById('sok-mum-right').value = '';
    _mpSetzen({ x: [5, 15, null, null], h: [9, 9, null, null], verbinden: true });
    renderObstacleList(); berechnen();
    const ohne = { erg: document.getElementById('hind-erg-H').textContent, geprueft: _nachweis.some(n => n.best),
                   hinweis: document.getElementById('hind-sok-fehlt').style.display !== 'none' };
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput();
    _mpSetzen({ x: [5, 15, null, null], h: [509, 509, null, null], verbinden: true });
    renderObstacleList(); berechnen();
    const mit = { geprueft: _nachweis.some(n => n.best), hinweis: document.getElementById('hind-sok-fehlt').style.display !== 'none',
                  einheit: document.querySelector('.probe-h-unit').textContent };
    return { ohne, mit, deltaBeiSok: !!document.querySelector('#mastangaben #mast-delta-sok-left') && !document.querySelector('#koord-felder #mast-delta-sok-left'),
      ohneZ: !document.getElementById('koord-z-left') };
  });
  assert.equal(r.ohne.geprueft, false);
  assert.equal(r.ohne.hinweis, true);
  assert.match(r.ohne.erg, /SOK/);
  assert.equal(r.mit.geprueft, true);
  assert.equal(r.mit.hinweis, false);
  assert.match(r.mit.einheit, /ü\. M\./);
  assert.equal(r.deltaBeiSok, true);
  assert.equal(r.ohneZ, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Alle Checkboxen erscheinen als Schalter', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    openLastfaelle();
    // Ausnahme: Auswahlboxen in Listen (.auswahl) bleiben normale Kästchen
    const kaesten = [...document.querySelectorAll('input[type=checkbox]:not(.auswahl)')].filter(el => el.offsetParent !== null);
    const falsch = kaesten.filter(el => {
      const st = getComputedStyle(el);
      // Schalter: eigener Stil (appearance none, breiter als hoch) oder versteckt mit .schalter daneben
      return el.getAttribute('role') === 'switch' ? !el.nextElementSibling?.classList.contains('schalter')
        : !(st.appearance === 'none' && parseFloat(st.width) > parseFloat(st.height));
    }).map(el => el.id || el.className);
    closeLastfaelle();
    return { anzahl: kaesten.length, falsch };
  });
  assert.ok(r.anzahl >= 3);
  assert.deepEqual(r.falsch, []);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Lastfälle: Minuswert tippbar, keine Höhenlage-Auswahl, Hinweis Zusatzlast nur bei −5 °C', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.evaluate(() => { localStorage.removeItem('dh_lastfaelle'); lastfallEinst = null; openLastfaelle(); });
  const feld = seite.locator('#lf-temps');
  await feld.fill('');
  await feld.pressSequentially('-20; 0 -5');
  const beimTippen = await feld.inputValue();
  await feld.blur();
  const r = await seite.evaluate(() => ({
    gespeichert: lastfallEinst[_lfSys].temperaturen,
    danach: document.getElementById('lf-temps').value,
    hoehenlage: !!document.getElementById('lf-hl-unter'),
    text: document.getElementById('lastfall-modal').innerText,
    eisHinweis: t('par.eislast.hint'),
  }));
  assert.equal(beimTippen, '-20; 0 -5');
  assert.deepEqual(r.gespeichert, [-20, 0, -5]);
  assert.equal(r.danach, '-20; -5; 0');
  assert.equal(r.hoehenlage, false);
  assert.doesNotMatch(r.text, /1000 m/);
  assert.match(r.text, /nur bei −5 °C/);
  assert.match(r.eisHinweis, /nur bei T<sub>2<\/sub> = −5 °C/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Zeichnung folgt dem Dunkelmodus, PDF bleibt hell, Texte übersetzt', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const r = await seite.evaluate(() => {
    document.getElementById('sok-mum-left').value = '450'; onSokMumInput();
    setDrawingHf(true); setCanvasView('zeichnung');
    const svg = () => document.querySelector('#scale-svg-container svg').outerHTML;
    const pdfSvg = () => { window.__fenster.length = 0; pdfExportDrawing(); const h = window.__fenster[0].html; return h.slice(h.indexOf('<svg xmlns')); };
    themaAnwenden('hell');
    const hell = { raster: svg().includes('#ebebeb') };
    themaAnwenden('dunkel');
    const dunkel = { raster: svg().includes('#2a2c32'), hg: getComputedStyle(document.getElementById('drawing-viewport')).backgroundColor,
      pdfHell: pdfSvg().includes('#ebebeb') && !pdfSvg().includes('#2a2c32') };
    const deutsch = /Masstab|Massstab|Überhöhung|Ts bei|Fd bei|SOK|m ü\.M\.|Höhe \[|Punkt|Mindestabstand/;
    const sprachen = {};
    for (const l of ['fr', 'it']) {
      setLang(l);
      const strip = document.getElementById('scale-data-strip')?.innerText || '';
      sprachen[l] = { bild: (svg() + document.getElementById('drawing-legend-overlay').innerText + strip).match(deutsch)?.[0] ?? null,
        pdf: pdfSvg().match(deutsch)?.[0] ?? null };
    }
    setLang('de'); themaAnwenden('auto'); setCanvasView('diagramm');
    return { hell, dunkel, sprachen };
  });
  assert.equal(r.hell.raster, true);
  assert.equal(r.dunkel.raster, true, 'Zeichnung im Dunkelmodus dunkel');
  assert.notEqual(r.dunkel.hg, 'rgb(255, 255, 255)');
  assert.equal(r.dunkel.pdfHell, true, 'PDF bleibt hell');
  assert.deepEqual(r.sprachen, { fr: { bild: null, pdf: null }, it: { bild: null, pdf: null } });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Handbuch: Kapitel links mit aktueller Stelle, Suche markiert und springt, Handy-Menü', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  // Bewegung reduziert: Sprünge ohne Animation, damit der Test nicht auf das Scrollen wartet
  await seite.emulateMedia({ reducedMotion: 'reduce' });
  await seite.evaluate(() => openHandbuch());
  const r = await seite.evaluate(async () => {
    const warte = ms => new Promise(res => setTimeout(res, ms));
    const aktiv = () => document.querySelector('#hb-nav a.aktiv .hb-nav-nr')?.textContent;
    const nrn = _hbKapitel.map(k => k.nr);
    const start = aktiv();
    // Klick auf 6.12 scrollt den Text dorthin, Liste markiert 6.12, Kapitel 6 aufgeklappt
    const text = document.getElementById('hb-text');
    text.style.scrollBehavior = 'auto';
    _hbKapitel.find(k => k.nr === '6.12').link.click();
    await warte(700);
    const nachKlick = { aktiv: aktiv(), offen: document.querySelector('.hb-nav-k.offen > a .hb-nav-nr')?.textContent };
    // Suche
    const feld = document.getElementById('hb-suche');
    feld.value = 'Reglage'; hbSuchen();
    const n = _hbTreffer.length, zahl = document.getElementById('hb-such-zahl').textContent;
    const aktuell = document.querySelectorAll('mark.hb-treffer.aktuell').length;
    hbTrefferGehe(1);
    const zahl2 = document.getElementById('hb-such-zahl').textContent;
    const badges = [...document.querySelectorAll('.hb-nav-zahl:not([hidden])')].length;
    feld.value = 'xyzxyz'; hbSuchen();
    const keine = document.getElementById('hb-such-zahl').textContent;
    feld.value = ''; hbSuchen();
    const rest = document.querySelectorAll('mark.hb-treffer').length;
    // Sprache: Liste neu in FR
    setLang('fr');
    const fr = _hbKapitel.find(k => k.nr === '9')?.titel;
    const ph = feld.placeholder;
    setLang('de');
    return { nrn, start, nachKlick, n, zahl, aktuell, zahl2, badges, keine, rest, fr, ph };
  });
  assert.ok(r.nrn.includes('1') && r.nrn.includes('6.14') && r.nrn.includes('9'), r.nrn.join(' '));
  assert.equal(r.start, '1');
  assert.deepEqual(r.nachKlick, { aktiv: '6.12', offen: '6' });
  assert.ok(r.n > 3);
  assert.equal(r.zahl, `1 / ${r.n}`);
  assert.equal(r.aktuell, 1);
  assert.equal(r.zahl2, `2 / ${r.n}`);
  assert.ok(r.badges >= 2);
  assert.equal(r.keine, 'Keine Treffer');
  assert.equal(r.rest, 0, 'Markierungen entfernt');
  assert.match(r.fr, /Glossaire/);
  assert.match(r.ph, /Rechercher/);
  // Handy: Aufklappmenü
  await seite.setViewportSize({ width: 390, height: 800 });
  const h = await seite.evaluate(() => {
    const knopf = document.getElementById('hb-kapitel-knopf'), nav = document.getElementById('hb-nav');
    const vorher = { knopf: getComputedStyle(knopf).display !== 'none', nav: getComputedStyle(nav).display };
    knopf.click();
    const auf = getComputedStyle(nav).display;
    _hbKapitel[3].link.click();
    return { vorher, auf, zu: getComputedStyle(nav).display, text: document.getElementById('hb-kapitel-aktuell').textContent };
  });
  assert.deepEqual(h.vorher, { knopf: true, nav: 'none' });
  assert.equal(h.auf, 'block');
  assert.equal(h.zu, 'none');
  assert.ok(h.text.length > 0);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Kein Verweis auf das SBB-Excel in Handbuch, Hinweisen und PDFs; Schieber-Zahl in Temperaturfarbe', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const r = await seite.evaluate(async () => {
    const excel = /xlsm|SBB-Excel|Excel CFF|Excel FFS|\bVBA\b|Upro1|in der Excel|wie Excel|comme Excel|come Excel/i;
    const funde = [];
    await openHandbuch();   // Inhalt wird beim ersten Öffnen geladen
    for (const l of ['de', 'fr', 'it']) {
      setLang(l);
      const m = document.getElementById('hb-text').innerText.match(excel);
      if (m) funde.push(`Handbuch ${l}: ${m[0]}`);
      window.__fenster.length = 0; pdfExport();
      const pm = (window.__fenster[0]?.html || '').replace(/<[^>]+>/g, ' ').match(excel);
      if (pm) funde.push(`PDF ${l}: ${pm[0]}`);
      for (const [k, v] of Object.entries(LANG[l])) if (typeof v === 'string' && excel.test(v)) funde.push(`${l} ${k}`);
    }
    setLang('de'); closeHandbuch();
    // Schieber T2 beim Ziehen: hervorgehobene Zahl in derselben Farbe wie der Knopf
    onT2Slider(50, true);
    const lbl = [...document.querySelectorAll('.t2-lbl')].find(el => el.dataset.val === '50');
    const knopf = document.getElementById('temp2-slider').style.getPropertyValue('--t2-clr');
    // Gesetzter Farbwert (die Anzeige blendet mit einem kurzen Übergang über)
    const probe = document.createElement('span'); probe.style.color = knopf;
    const gleich = !!lbl.style.color && lbl.style.color === probe.style.color;
    onT2Slider(45, true);
    const nachbarn = [...document.querySelectorAll('.t2-lbl')].filter(el => ['40', '50'].includes(el.dataset.val)).map(el => el.style.color);
    probe.style.color = document.getElementById('temp2-slider').style.getPropertyValue('--t2-clr');
    const nachbarGleich = nachbarn.every(c => c === probe.style.color);
    onT2Slider(40, false);
    return { funde, gleich, nachbarGleich };
  });
  assert.deepEqual(r.funde, []);
  assert.equal(r.gleich, true);
  assert.equal(r.nachbarGleich, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Abschnitt: «Beispiel laden» setzt 5 Masten, IFC georeferenziert, Handbuch mit Ablauf', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    abschnittAnsicht();
    document.getElementById('abs-beispiel').click();
    await new Promise(res => setTimeout(res, 200));
    const n = abschnitt.masten.length;
    let datei = ''; const alt = window._dateiHerunterladen; window._dateiHerunterladen = x => { datei = x; };
    abschnittExport('ifc');
    window._dateiHerunterladen = alt;
    await openHandbuch();
    const hb = document.getElementById('hb-text').innerText;
    closeHandbuch(); setCanvasView('diagramm');
    return { n, ifc: /IFCCABLESEGMENT/.test(datei), epsg: /EPSG:2056/.test(datei), felder: (datei.match(/Feld|CH_Durchhang/g) || []).length,
      hb: /Beispiel: Ablauf vom Mastbild zum BIM-Modell/.test(hb) && /IfcCableSegment/.test(hb) };
  });
  assert.equal(r.n, 5);
  assert.equal(r.ifc, true);
  assert.equal(r.epsg, true);
  assert.ok(r.felder > 0);
  assert.equal(r.hb, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Längsprofil: Leiter in Temperaturfarbe, 55 Felder rechenbar und seitlich scrollbar', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    abschnittAnsicht();
    // Nachspannlänge ~970 m mit 55 Feldern 10–25 m
    const m = []; let e = 2600000, z = 500, km = 12000;
    for (let i = 0; i < 56; i++) {
      m.push({ name: String(101 + i), e, n: 1200000 + i * 0.2, z, delta: 0.3, h: 7.6, km: (km / 1000).toFixed(3), L: null });
      const L = 10 + ((i * 7) % 16); e += L; z += 0.05; km += L;
    }
    abschnitt = { masten: m, offen: null, mp: {} }; renderAbschnitt();
    const erg = abschnittRechnen();
    const box = document.querySelector('.abs-profil-scroll');
    const viele = { felder: erg.felder.length, fehler: erg.felder.filter(f => f.fehler).length,
      scroll: box.scrollWidth > box.clientWidth + 100, hinweis: !!document.querySelector('.abs-leg.leise') };
    document.getElementById('temp2').value = '50'; onT2Input('50');
    const warm = document.querySelector('.abs-leiter').style.stroke;
    document.getElementById('temp2').value = '-20'; onT2Input('-20');
    const kalt = document.querySelector('.abs-leiter').style.stroke;
    const probe = document.createElement('span'); probe.style.color = t2TempColor(-20);
    const legende = document.querySelector('.abs-leg').innerText;
    // Wenige Felder: kein Scrollen
    abschnitt = { masten: beispielMasten(), offen: null, mp: {} }; renderAbschnitt();
    const b2 = document.querySelector('.abs-profil-scroll');
    const wenige = { scroll: b2.scrollWidth > b2.clientWidth + 1, hinweis: !!document.querySelector('.abs-leg.leise'),
      viewBox: b2.querySelector('svg').getAttribute('viewBox') };
    setCanvasView('diagramm');
    return { viele, warm, kalt, kaltSoll: probe.style.color, legende, wenige };
  });
  assert.deepEqual(r.viele, { felder: 55, fehler: 0, scroll: true, hinweis: true });
  assert.notEqual(r.warm, r.kalt, 'Farbe folgt T2');
  assert.equal(r.kalt, r.kaltSoll);
  assert.match(r.legende, /T2 = -20 °C|T₂ = -20 °C|T2 = −20 °C/);
  // Wenige Felder: Standardgrösse 1000 × 300 (nicht vergrössert)
  assert.deepEqual(r.wenige, { scroll: false, hinweis: false, viewBox: '0 0 1000 300' });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Feld-Schnellauswahl, H/a im Zeichnungsband, Abschnitt-Scroll (normal und Vollbild)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.setViewportSize({ width: 1600, height: 1000 });
  const r = await seite.evaluate(async () => {
    const warte = ms => new Promise(res => setTimeout(res, ms));
    const box = document.getElementById('feld-wahl');
    const ohne = getComputedStyle(box).display;
    abschnittAnsicht(); await abschnittBeispiel(); await warte(200);
    // Seite nicht weit über den Inhalt scrollbar: höchstens Eingabespalte + Fuss
    const seitenH = document.documentElement.scrollHeight;
    // Inhalt unten: Eingabespalte oder Ansicht (Abschnitt), je nachdem was länger ist
    const spalteUnten = Math.max(document.querySelector('.sidebar').getBoundingClientRect().bottom,
      document.querySelector('.canvas-card').getBoundingClientRect().bottom) + scrollY;
    // Vollbild: Abschnitt scrollt in sich
    abschnitt = { masten: [...beispielMasten(), ...beispielMasten().map((m, i) => ({ ...m, name: String(200 + i), e: m.e + 300, km: (12.6 + i * 0.05).toFixed(3) }))], offen: null, mp: {} };
    renderAbschnitt(); toggleCanvasFullscreen(); await warte(100);
    const v = document.getElementById('abschnitt-view'); v.scrollTop = 99999;
    const vollbild = v.scrollTop > 0;
    toggleCanvasFullscreen();
    // Schnellauswahl: sichtbar, Wechsel bleibt in der Zeichnung
    abschnitt = { masten: beispielMasten(), offen: null, mp: {} }; renderAbschnitt();
    setCanvasView('zeichnung'); await warte(50);
    const mit = getComputedStyle(box).display !== 'none';
    feldSchritt(1); feldSchritt(1);
    const nachSchritt = { offen: abschnittOffenesFeld(), zeichnung: document.getElementById('view-seg-zeichnung').classList.contains('active'),
      wert: document.getElementById('feld-select').value, text: document.getElementById('feld-select').selectedOptions[0].textContent };
    // H-Punkte im Band der Zeichnung
    for (const [id, v2] of [['probe-x1', '11.7'], ['probe-x2', '18.9']]) { const e = document.getElementById(id); e.value = v2; e.dispatchEvent(new Event('input')); }
    setProbeH(1, '548.5'); setProbeH(2, '548.5'); await warte(300);
    refreshScaleViewIfActive(); await warte(300);
    const zeilen = [...document.querySelectorAll('#scale-data-strip .strip-label')].map(e => e.textContent);
    setCanvasView('diagramm');
    return { ohne, seitenH, spalteUnten, vollbild, mit, nachSchritt, zeilen };
  });
  assert.equal(r.ohne, 'none', 'ohne Abschnitt keine Schnellauswahl');
  assert.ok(r.seitenH <= r.spalteUnten + 200, `Seite ${r.seitenH} vs. Spalte ${r.spalteUnten}`);
  assert.equal(r.vollbild, true, 'Abschnitt im Vollbild scrollbar');
  assert.equal(r.mit, true);
  assert.deepEqual({ offen: r.nachSchritt.offen, zeichnung: r.nachSchritt.zeichnung, wert: r.nachSchritt.wert }, { offen: 1, zeichnung: true, wert: '0:1' });
  assert.match(r.nachSchritt.text, /Feld 2 · 102–103 · KM 012\.350/);
  assert.ok(r.zeilen.includes('H [m ü.M.]') && r.zeilen.includes('a [m]'), r.zeilen.join(' | '));
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Wasserzeichen «BETA – nicht verifiziert»: Bildschirm in allen Sprachen, alle PDFs', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const r = await seite.evaluate(() => {
    const wz = document.getElementById('beta-wz');
    const stil = getComputedStyle(wz);
    const texte = {};
    for (const l of ['fr', 'it', 'de']) { setLang(l); texte[l] = wz.innerText.trim(); }
    window.__fenster.length = 0;
    pdfExport(); pdfExportDrawing();
    return { texte, fest: stil.position === 'fixed', klickbar: stil.pointerEvents, pdf: window.__fenster.map(f => f.html) };
  });
  assert.deepEqual(r.texte, { fr: 'BÊTA – non vérifié', it: 'BETA – non verificato', de: 'BETA – nicht verifiziert' });
  assert.equal(r.fest, true);
  assert.equal(r.klickbar, 'none', 'Wasserzeichen darf keine Klicks abfangen');
  assert.equal(r.pdf.length, 2);
  r.pdf.forEach(h => assert.match(h, /BETA – nicht verifiziert/));
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Zeichnung: «Kettenwerk» ohne Masten bis SOK; hf-Band mit Prüfung, PDF, DXF, Speichern', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const r = await seite.evaluate(() => {
    document.getElementById('h2').value = '6.50'; berechnen();
    setCanvasView('zeichnung');
    const svgText = () => document.getElementById('scale-svg-container').innerHTML;
    setDrawingExtent('sok');
    const mitSok = svgText();
    setDrawingExtent('catenary');
    const nurKw = svgText();
    setDrawingHf(true);
    const band = svgText();
    window.__fenster.length = 0; pdfExportDrawing();
    const pdf = window.__fenster[0]?.html || '';
    let dxf = ''; const alt = window._dateiHerunterladen; window._dateiHerunterladen = x => { dxf = x; }; exportDxf(); window._dateiHerunterladen = alt;
    const st = JSON.parse(JSON.stringify(getProjectState()));
    setDrawingHf(false); setProjectState(st);
    const geladen = document.getElementById('draw-hf').checked;
    setSysMode('el');
    const cbEl = document.getElementById('draw-hf');
    const elVersteckt = cbEl.disabled && !cbEl.checked && cbEl.closest('label').classList.contains('hf-gesperrt')
      && document.querySelector('.draw-hf-teil').style.display !== 'none';
    setSysMode('nfl'); setCanvasView('diagramm');
    return { sokLinie: />SOK</.test(mitSok), kwSok: />SOK</.test(nurKw), kwBruch: nurKw.includes('SOK ↓'),
             band: band.includes('hf<tspan') && /[✓✗]/.test(band), pdf: pdf.includes('hf<tspan'),
             dxf: /\nHF_MIN\n/.test(dxf) && /\nHF_MAX\n/.test(dxf), geladen, elVersteckt };
  });
  assert.equal(r.sokLinie, true, 'bis SOK: SOK-Linie');
  assert.equal(r.kwSok, false, 'Kettenwerk: keine SOK-Linie');
  assert.equal(r.kwBruch, true, 'Kettenwerk: Masten mit Bruchzeichen');
  assert.equal(r.band, true, 'hf-Band mit Prüfung');
  assert.equal(r.pdf, true, 'hf-Band im PDF');
  assert.equal(r.dxf, true, 'DXF-Layer HF_MIN / HF_MAX');
  assert.equal(r.geladen, true, 'Schalter im Projekt gespeichert');
  assert.equal(r.elVersteckt, true, 'Einzelleiter: kein hf-Schalter');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('H-Punkte ohne SOK gesperrt mit Link zu den Mastangaben; mit SOK Höhe über SOK', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.evaluate(() => { clearSokMum?.(); document.getElementById('sok-mum-left').value = ''; document.getElementById('sok-mum-right').value = ''; berechnen(); });
  const ohne = await seite.evaluate(() => ({ gesperrt: document.getElementById('probe-h1').disabled,
    platz: document.getElementById('probe-h1').placeholder, link: document.getElementById('probe-sok-link').style.display !== 'none' }));
  await seite.click('#probe-sok-link');
  await seite.waitForTimeout(500);
  const sprung = await seite.evaluate(() => ({ offen: document.getElementById('mastangaben').open, fokus: document.activeElement?.id }));
  const mit = await seite.evaluate(() => {
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput();
    _mpSetzen({ x: [22.5, null, null, null], h: [506.83, null, null, null] }); berechnen();
    return { frei: !document.getElementById('probe-h1').disabled, rel: document.getElementById('probe-h-rel-1').textContent,
             link: document.getElementById('probe-sok-link').style.display !== 'none' };
  });
  assert.deepEqual(ohne, { gesperrt: true, platz: 'SOK fehlt', link: true });
  assert.deepEqual(sprung, { offen: true, fokus: 'sok-mum-left' });
  assert.equal(mit.frei, true);
  assert.match(mit.rel, /^≙ 6\.83 m /);
  assert.equal(mit.link, false);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Handy 390 px: keine seitliche Verschiebung, Kopfzeile vollständig sichtbar', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const r = await seite.evaluate(() => {
    const W = document.documentElement.clientWidth;
    const sichtbar = id => { const b = document.getElementById(id).getBoundingClientRect(); return b.width > 0 && b.left >= 0 && b.right <= W + 1; };
    const vorher = { breite: document.documentElement.scrollWidth, knoepfe: ['lang-it', 'mehr-btn', 'hf-btn', 'quick-save-btn'].every(sichtbar) };
    openHf();
    const hf = document.documentElement.scrollWidth;
    closeHf();
    return { W, ...vorher, hf };
  });
  assert.equal(r.breite, r.W, 'Seite breiter als der Bildschirm');
  assert.equal(r.knoepfe, true, 'Knöpfe der Kopfzeile ausserhalb');
  assert.equal(r.hf, r.W, 'hf-Ansicht breiter als der Bildschirm');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Bereich «H-Punkte» nur in der Ansicht Diagramm und nur mit SOK m ü. M.', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    const sichtbar = () => document.getElementById('obs-section').offsetParent !== null;
    document.getElementById('sok-mum-left').value = ''; document.getElementById('sok-mum-right').value = ''; berechnen();
    const ohneSok = sichtbar();
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput();
    const mitSok = sichtbar();
    setCanvasView('zeichnung'); const zeichnung = sichtbar();
    setCanvasView('foto'); document.getElementById('rf-ok')?.click(); const foto = sichtbar();
    setCanvasView('diagramm'); const zurueck = sichtbar();
    abschnittAnsicht(); const abschnittV = sichtbar();
    setCanvasView('diagramm');
    return { ohneSok, mitSok, zeichnung, foto, zurueck, abschnittV };
  });
  assert.deepEqual(r, { ohneSok: false, mitSok: true, zeichnung: false, foto: false, zurueck: true, abschnittV: false });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Fenstergrösse ändern / Handy drehen: Diagramm wird ohne Eingabe neu gezeichnet', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 1280, height: 800 } });
  const masse = () => seite.evaluate(() => {
    const cv = document.getElementById('main-canvas');
    return { css: cv.offsetWidth, puffer: cv.width / (window.devicePixelRatio || 1) };
  });
  const vorher = await masse();
  assert.equal(vorher.puffer, vorher.css);
  for (const [w, h] of [[820, 1000], [390, 844], [844, 390]]) {
    await seite.setViewportSize({ width: w, height: h });
    await seite.waitForFunction(() => {
      const cv = document.getElementById('main-canvas');
      return cv.width === cv.offsetWidth * (window.devicePixelRatio || 1);
    }, null, { timeout: 2000 });
    const m = await masse();
    assert.equal(m.puffer, m.css, `Diagramm bei ${w}×${h} verzerrt`);
  }
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Systemwechsel sanft (Hauptansicht), ohne Einfluss auf die Rechnung; hf-Grafik beschriftet', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    const erg = [];
    for (const m of ['rfl', 'el', 'nfl']) {
      sysWaehlen(m);
      const anim = document.getAnimations().filter(a => a.constructor === Animation).length;
      document.getAnimations().forEach(a => a.finish());
      const sagWahl = calcState.c2.sag;
      setSysMode(m);
      erg.push({ m, anim: anim > 0, gleich: calcState.c2.sag === sagWahl, aktiv: document.getElementById('seg-' + m).classList.contains('active') });
    }
    openHf(); hfZuruecksetzen();
    const svg = document.querySelector('#hf-erg .hf-svg').innerHTML;
    const zeile = [...document.querySelectorAll('.hf-zus-tab td')].map(td => td.textContent.replace(/\s+/g, ' '));
    const titel = document.querySelectorAll('#hf-erg .hf-svg title').length;
    closeHf();
    return { erg, be: svg.includes('b<tspan font-size="7" dy="2">e</tspan>'), zeile, titel };
  });
  for (const x of r.erg) assert.deepEqual(x, { m: x.m, anim: true, gleich: true, aktiv: true });
  assert.equal(r.be, true, 'b_e in der Höhenleiter');
  // Box «Zusammensetzung»: je Grösse Formel mit allen Anteilen, darunter Zahlen
  assert.deepEqual(r.zeile, [
    '= GfA + k + be + f + H + (fg + thu + fud + fuv + fFD,max,ZL + fFD,max)',
    "= 4'670 + 0 + 150 + 0 + 0 + (60 + 10 + 49.5 + 0 + 0 + 25.5) = 4'965 mm",
    '= hfmax,abs − (tho + fudo + fuv + fh + fFD,min)',
    "= 6'200 − (10 + 39.6 + 0 + 75 + 80.2) = 5'995.2 mm",
  ]);
  assert.ok(r.titel >= 8, 'Tooltips an den Streifen');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('«Bewegung reduzieren»: Systemwechsel ohne Animation', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { reducedMotion: 'reduce' });
  const n = await seite.evaluate(() => {
    const eigene = () => document.getAnimations().filter(a => a.constructor === Animation).length;   // ohne CSS-Farbübergänge
    sysWaehlen('rfl'); document.getElementById('view-seg-zeichnung').click(); return eigene();
  });
  assert.equal(n, 0);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Projektliste: Auswahl als normale Box; Kopfleiste kompakt mit «Teilen»', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    openProjectsModal(); saveCurrentCalc(); renderProjectList();
    const box = document.querySelector('.proj-check');
    const st = box && getComputedStyle(box);
    const auswahl = box ? { klasse: box.classList.contains('auswahl'), appearance: st.appearance, quadratisch: Math.abs(parseFloat(st.width) - parseFloat(st.height)) < 1 } : null;
    closeProjectsModal();
    const kopf = document.querySelector('.header');
    const teilen = kopf.querySelector('#share-btn');
    // Seltene Befehle im Menü «Mehr ⋯», beschriftet
    document.getElementById('mehr-btn').click();
    const mm = document.getElementById('mehr-menu');
    const symbole = [...mm.querySelectorAll('.share-item')].map(b => ({ text: !!b.textContent.trim(), sichtbar: b.getBoundingClientRect().right <= document.documentElement.clientWidth }));
    const mehrOffen = getComputedStyle(mm).display !== 'none' && document.getElementById('mehr-btn').getAttribute('aria-expanded') === 'true';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    const mehrZu = getComputedStyle(mm).display === 'none';
    teilen.click();
    const menu = document.getElementById('share-menu');
    const m = menu.getBoundingClientRect();
    const offen = getComputedStyle(menu).display !== 'none' && m.left >= 0 && m.right <= document.documentElement.clientWidth;
    closeShareMenu();
    return { auswahl, teilenImKopf: !!teilen, teilenImDiagramm: !!document.querySelector('.canvas-card #share-btn'), symbole, offen, mehrOffen, mehrZu };
  });
  assert.deepEqual(r.auswahl, { klasse: true, appearance: 'none', quadratisch: true });
  assert.equal(r.teilenImKopf, true);
  assert.equal(r.teilenImDiagramm, false);
  assert.equal(r.symbole.length, 4, 'Reglage, Handbuch, Darstellung, Zurücksetzen');
  for (const b of r.symbole) assert.deepEqual(b, { text: true, sichtbar: true });
  assert.equal(r.mehrOffen, true);
  assert.equal(r.mehrZu, true, 'Escape schliesst das Menü');
  assert.equal(r.offen, true, 'Menü «Teilen» offen und im Bild');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Handy: Menü «Teilen» bleibt im Bild; im Vollbild erreichbar', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const r = await seite.evaluate(() => {
    document.getElementById('share-btn').click();
    const m = document.getElementById('share-menu').getBoundingClientRect();
    const handy = m.left >= 0 && m.right <= document.documentElement.clientWidth;
    closeShareMenu();
    toggleCanvasFullscreen();
    const fs = document.getElementById('share-btn-fs');
    const sichtbar = fs.getClientRects().length > 0;
    fs.click();
    const menu = document.getElementById('share-menu');
    const oben = parseInt(getComputedStyle(menu).zIndex, 10) > 1000 && getComputedStyle(menu).display !== 'none';
    closeShareMenu(); toggleCanvasFullscreen();
    return { handy, sichtbar, oben, breite: document.documentElement.scrollWidth, W: document.documentElement.clientWidth };
  });
  assert.deepEqual(r, { handy: true, sichtbar: true, oben: true, breite: r.W, W: r.W });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Diagramm: Schalter «Fahrdraht + hf», Prüfzeile im Ergebnis, Speichern', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    const zeile = () => { const el = document.getElementById('hf-pruefzeile'); return el.getClientRects().length ? el.className : 'aus'; };
    const vorher = zeile();
    const yHi0 = view.yHi, sc0 = view.scaleY;
    setDiagrammHf(true);
    const erweitert = view.scaleY < sc0;                    // Ausschnitt reicht jetzt bis zum Fahrdraht
    // Aufhängung 7.40 m, sh 2.40 → Fahrdraht um 5.0 m: innerhalb 4.965 … 5.995
    document.getElementById('h1').value = '7.40'; document.getElementById('h2').value = '7.40'; berechnen();
    const ok = zeile();
    document.getElementById('h1').value = '7.00'; document.getElementById('h2').value = '7.00'; berechnen();
    const nok = zeile(), text = document.getElementById('hf-pruefzeile').textContent;
    const stand = getProjectState();
    setDiagrammHf(false);
    setDiagrammHf(true);
    sysWaehlen('el');
    const cbD = document.getElementById('diagramm-hf'), hfBtn = document.getElementById('hf-btn');
    const legEl = { sichtbar: document.getElementById('leg-hf-item').getClientRects().length > 0,
      gesperrt: cbD.disabled && !cbD.checked, knopf: hfBtn.disabled, titel: hfBtn.title };
    setSysMode('nfl');
    const zurueck = { an: cbD.checked, frei: !cbD.disabled && !hfBtn.disabled };
    setDiagrammHf(false); sysWaehlen('el');
    const zeileEl = zeile();
    setSysMode('nfl');
    return { vorher, erweitert, ok, nok, unter: /unter hf/.test(text), gespeichert: stand.diagrammHf, legEl, zurueck, zeileEl };
  });
  assert.equal(r.vorher, 'aus');
  assert.equal(r.erweitert, true);
  assert.equal(r.ok, 'hf-pruefzeile ok');
  assert.equal(r.nok, 'hf-pruefzeile nok');
  assert.equal(r.unter, true);
  assert.equal(r.gespeichert, true);
  assert.deepEqual(r.legEl, { sichtbar: true, gesperrt: true, knopf: true, titel: 'Einzelleiter: kein Fahrdraht — hf_min / hf_max nur bei N-FL oder R-FL.' }, 'Einzelleiter: Schalter und Knopf ausgegraut');
  assert.deepEqual(r.zurueck, { an: true, frei: true }, 'zurück zu N-FL: Wahl bleibt, wieder bedienbar');
  assert.equal(r.zeileEl, 'aus');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Zeichnung: hf-Beschriftungen überlagern sich nicht; Höhenleiter erklärt die Leserichtung', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    setCanvasView('zeichnung'); setDrawingHf(true);
    const texte = [...document.querySelectorAll('#scale-svg-container svg text')].filter(t => /^hf(min|max) = /.test(t.textContent));
    const [a, b] = texte.map(t => t.getBoundingClientRect());
    const getrennt = a && b && (a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5);
    const pruef = [...document.querySelectorAll('#scale-svg-container svg text')].find(t => /Solllage/.test(t.textContent) && /Soll 4\.60 \/ 4\.60 m · Ist T2/.test(t.textContent));
    setCanvasView('diagramm');
    openHf();
    const svg = document.querySelector('#hf-erg .hf-svg').textContent;
    closeHf();
    return { anzahl: texte.length, getrennt, pruef: !!pruef, auf: /↑ aufgebaut ab GfA/.test(svg), ab: /↓ abgezogen von 6.200 m/.test(svg) };
  });
  assert.deepEqual(r, { anzahl: 2, getrennt: true, pruef: true, auf: true, ab: true });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Fusszeile: ohne «Statikteam», Version aus APP_VERSION', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => ({
    fuss: document.querySelector('body > footer').textContent.replace(/\s+/g, ' ').trim(),
    version: APP_VERSION,
    irgendwo: document.documentElement.innerHTML.includes('Statikteam'),
  }));
  assert.equal(r.fuss, `Fachentwicklung FS · © 2026 · ${r.version}`);
  assert.equal(r.irgendwo, false);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Schalter: Knopf bleibt im Schalter (Maus und Touch, ein und aus)', async () => {
  for (const opt of [{}, { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true }]) {
    const { seite, fehler, kontext } = await appOeffnen(browser, url, opt);
    const r = await seite.evaluate(() => {
      // Übergänge aus, damit die Endlage gemessen wird
      document.head.insertAdjacentHTML('beforeend', '<style>*,*::after{transition:none!important}</style>');
      openHf();
      const el = document.getElementById('hf-bue');
      const lage = () => {
        const a = getComputedStyle(el, '::after'), m = new DOMMatrix(a.transform === 'none' ? undefined : a.transform);
        const links = parseFloat(a.left) + m.m41, rechts = links + parseFloat(a.width);
        return { links, rechts, breite: parseFloat(getComputedStyle(el).width) };
      };
      el.checked = false; const aus = lage();
      el.checked = true; const ein = lage();
      closeHf();
      return { aus, ein };
    });
    for (const z of [r.aus, r.ein]) assert.ok(z.links >= 0 && z.rechts <= z.breite, `Knopf ausserhalb: ${JSON.stringify(z)}`);
    assert.ok(r.ein.links > r.aus.links + 5, 'Knopf bewegt sich');
    assert.deepEqual(fehler, []);
    await kontext.close();
  }
});

test('hf-Prüfung: Soll-Fahrdrahthöhe an den Stützpunkten (h − sh), Ist bei T2 nur Info', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    setDiagrammHf(true);
    const zeile = () => document.getElementById('hf-pruefzeile');
    // h1 = h2 = 7.40, sh 2.40 → Soll 5.00 m: innerhalb 4.965 … 5.995; Ist bei T2 (−20 °C) liegt höher
    document.getElementById('h1').value = '7.40'; document.getElementById('h2').value = '7.40'; berechnen();
    const a = { klasse: zeile().className, text: zeile().textContent.replace(/\s+/g, ' ') };
    // Ungleiche Höhen: rechts 8.50 → Soll 6.10 m > hf_max
    document.getElementById('h2').value = '8.50'; berechnen();
    const b = { klasse: zeile().className, text: zeile().textContent.replace(/\s+/g, ' ') };
    return { a, b };
  });
  assert.equal(r.a.klasse, 'hf-pruefzeile ok');
  assert.match(r.a.text, /Fahrdraht Soll an den Stützpunkten \(h − sh\) 5\.00 \/ 5\.00 m über SOK — innerhalb/);
  assert.match(r.a.text, /Ist-Lage bei T2: .* \(Info/);
  assert.equal(r.b.klasse, 'hf-pruefzeile nok');
  assert.match(r.b.text, /5\.00 \/ 6\.10 m über SOK — über hfmax/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('«H Ts» gesperrt, solange die Reglage der Kombination gilt; ohne Reglage frei', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    const el = document.getElementById('tension'), hw = document.getElementById('tension-reglage-hw');
    const zustand = () => ({ gesperrt: el.readOnly, hinweis: hw.getClientRects().length > 0 });
    const out = { nfl: zustand() };
    setSysMode('rfl'); out.rfl = zustand();
    setSysMode('nfl');
    document.getElementById('preset-select').value = ''; activePresetRef = null; activePresetP = null; berechnen(); out.frei = zustand();
    toggle3pt(); out.dreiPunkte = zustand(); toggle3pt();
    out.hwText = hw.textContent;
    return out;
  });
  assert.deepEqual(r.nfl, { gesperrt: true, hinweis: true });
  assert.deepEqual(r.rfl, { gesperrt: true, hinweis: true });
  assert.deepEqual(r.frei, { gesperrt: false, hinweis: false });
  assert.deepEqual(r.dreiPunkte, { gesperrt: true, hinweis: false });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Wechsel Diagramm / Zeichnung / Abschnitt / Foto: Höhe gleitet, Inhalt blendet ein', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    const eigene = () => document.getAnimations().filter(a => a.constructor === Animation);
    const karte = document.querySelector('.canvas-card');
    document.getElementById('view-seg-zeichnung').click();
    const z = { anim: eigene().length, hoehe: eigene().some(a => a.effect?.target === karte), aktiv: document.getElementById('view-seg-zeichnung').classList.contains('active') };
    eigene().forEach(a => a.finish());
    document.getElementById('view-seg-diagramm').click();
    const d = { anim: eigene().length > 0, aktiv: document.getElementById('view-seg-diagramm').classList.contains('active') };
    eigene().forEach(a => a.finish());
    return { z, d };
  });
  assert.ok(r.z.anim >= 2);
  assert.equal(r.z.hoehe, true);
  assert.equal(r.z.aktiv, true);
  assert.deepEqual(r.d, { anim: true, aktiv: true });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('hf: zulässige Anschlusshöhe, Rückfrage nur mit Anschlusshöhe; Systemhöhe bleibt; Prüfzeile zuoberst nur mit Schalter', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const hh = document.getElementById('h-hf-hw'), sh = document.getElementById('sh');
    const h1 = document.getElementById('h1'), h2 = document.getElementById('h2');
    const pz = document.getElementById('hf-pruefzeile');
    const warte = () => new Promise(r => setTimeout(r, 50));
    const vorher = hh.getClientRects().length > 0 || pz.getClientRects().length > 0;
    const zuoberst = pz.nextElementSibling?.id === 'results';
    // h1 = h2 = 7.00, sh 2.40, hf 4.965 … 5.995 → h zulässig 7.37 … 8.39 m
    const cb = document.getElementById('diagramm-hf');
    cb.checked = true; cb.dispatchEvent(new Event('change')); await warte();
    const dialog = document.getElementById('rf-text').textContent;
    const knoepfe = ['rf-ok', 'rf-alt', 'rf-abbrechen'].filter(id => document.getElementById(id).getClientRects().length).map(id => document.getElementById(id).textContent);
    document.getElementById('rf-abbrechen').click(); await warte();          // «So lassen»
    const gelassen = [h1.value, h2.value, sh.value];
    const infoH = { nok: hh.classList.contains('nok'), text: hh.textContent.replace(/\s+/g, ' ').trim() };
    const pzAn = pz.getClientRects().length > 0;
    hh.querySelector('button').click();                                     // h → 7.37 übernehmen
    const nachKnopf = [h1.value, h2.value, sh.value, hh.classList.contains('nok')];
    // Rückfrage bestätigen
    h1.value = '8.80'; h2.value = '7.00'; berechnen();
    cb.checked = false; cb.dispatchEvent(new Event('change'));
    const pzAus = pz.getClientRects().length > 0;
    cb.checked = true; cb.dispatchEvent(new Event('change')); await warte();
    document.getElementById('rf-ok').click(); await warte();
    return { vorher, zuoberst, dialog, knoepfe, gelassen, infoH, pzAn, nachKnopf, pzAus, bestaetigt: [h1.value, h2.value, sh.value],
      shHinweis: !!document.getElementById('sh-hf-hw') };
  });
  assert.equal(r.vorher, false);
  assert.equal(r.zuoberst, true, 'Prüfzeile vor den Ergebnissen');
  assert.match(r.dialog, /Anschlusshöhe h₁ 7\.00 → 7\.37 m, h₂ 7\.00 → 7\.37 m/);
  assert.doesNotMatch(r.dialog, /Systemhöhe sh 2/);
  assert.deepEqual(r.knoepfe, ['Anschlusshöhe anpassen', 'So lassen']);
  assert.deepEqual(r.gelassen, ['7.00', '7.00', '2.4']);
  assert.deepEqual(r.infoH, { nok: true, text: 'Anschlusshöhe h zulässig 7.37 … 8.39 m über SOK (aus hf)→ h₁ = 7.37 m, h₂ = 7.37 m übernehmen' });
  assert.equal(r.pzAn, true);
  assert.deepEqual(r.nachKnopf, ['7.37', '7.37', '2.4', false]);
  assert.equal(r.pzAus, false, 'Prüfzeile aus mit dem Schalter');
  assert.deepEqual(r.bestaetigt, ['8.39', '7.37', '2.4'], 'jede Seite auf den nächsten zulässigen Wert, sh bleibt');
  assert.equal(r.shHinweis, false);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Exporte mit hf: Berechnungs-PDF mit Prüfung, Zeichnungs-PDF mit Version, DXF-Layer auch bei Diagramm-Schalter', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  await seite.evaluate(() => { setDiagrammHf(true); });
  const [dl] = await Promise.all([seite.waitForEvent('download'), seite.evaluate(() => exportDxf())]);
  const dxf = require('fs').readFileSync(await dl.path(), 'utf8');
  const r = await seite.evaluate(() => {
    window.__fenster.length = 0; pdfExport(); setCanvasView('zeichnung'); pdfExportDrawing();
    return window.__fenster.map(f => f.html);
  });
  assert.match(dxf, /\nHF_MIN\n/); assert.match(dxf, /\nHF_MAX\n/);
  assert.match(r[0], /Fahrdraht Soll an den Stützpunkten/);
  assert.match(r[0], /Anschlusshöhe h zulässig 7\.37 … 8\.39 m/);
  assert.match(r[1], new RegExp('Durchhang ' + (await seite.evaluate(() => APP_VERSION)).replace(/\./g, '\\.')));
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Einzelleiter über Hindernis: Lage automatisch, Nachweis nach unten; Schalter «Alle Lastfälle»; Band und Masslinie', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    setSysMode('el');
    document.getElementById('sok-mum-left').value = 0; onSokMumLeftInput();
    document.getElementById('sok-mum-right').value = 0; onSokMumRightInput();
    setMindestabstand('0.2');
    // Leiter 7.00 m, Hindernis darunter bei 6.3 / 6.2 m
    _mpSetzen({ x: [10, 32.79, null, null], h: [6.3, 6.2, null, null], verbinden: true }); renderObstacleList(); berechnen();
    const alle = { unten: _nachweis[0].unten, a: _nachweis[0].best.abstand, fall: _nachweis[0].best.fall.T, band: !!_nachweis[0].huelle,
      legende: document.getElementById('leg-lf-item').getClientRects().length > 0 };
    setLastfaelleAktiv(false);
    const aktuell = { a: _nachweis[0].best.abstand, ok: _nachweis[0].ok, text: document.getElementById('hind-erg-H').textContent,
      band: !!_nachweis[0].huelle, knopfAus: document.querySelector('#obs-section button[onclick="openLastfaelle()"]').disabled };
    const gespeichert = getProjectState().lastfaelleAktiv;
    setLastfaelleAktiv(true);
    // Kettenwerk: gleiche Punkte darüber gelten als oberhalb
    setSysMode('nfl');
    _mpSetzen({ x: [15, 30, null, null], h: [7.5, 7.45, null, null], verbinden: true }); berechnen();
    const oben = { unten: _nachweis[0].unten, a: _nachweis[0].best.abstand };
    return { alle, aktuell, gespeichert, oben };
  });
  assert.equal(r.alle.unten, true);
  assert.equal(r.alle.fall, 80, 'unterhalb massgebend: Wärme (tiefste Lage)');
  assert.ok(r.alle.a < 0);
  assert.equal(r.alle.band, true); assert.equal(r.alle.legende, true);
  assert.ok(r.aktuell.a > 0.3 && r.aktuell.ok === true, 'aktueller Zustand −20 °C: Leiter deutlich darüber');
  assert.match(r.aktuell.text, /✓ massgebend: a = 0\.\d\d m .*aktuell −20 °C/);
  assert.equal(r.aktuell.band, false); assert.equal(r.aktuell.knopfAus, true);
  assert.equal(r.gespeichert, false);
  assert.equal(r.oben.unten, false); assert.ok(r.oben.a > 0.5);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('PDF im hellen App-Design: Inter, Logo, Diagramm nach den Eingabewerten mit farbiger Legende', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const r = await seite.evaluate(() => {
    setDiagrammHf(true);
    window.__fenster.length = 0; pdfExport(); hfPdf();
    return window.__fenster.map(f => f.html);
  });
  const [ber, hf] = r;
  for (const h of [ber, hf]) {
    assert.match(h, /font-family: Inter/); assert.match(h, /fonts\/inter-latin-wght-normal\.woff2/);
    assert.match(h, /<div class="hdr"><svg class="logo"/);
    assert.doesNotMatch(h, /#eb0000|#212121/, 'kein Rot/Schwarz des alten Designs');
  }
  const iEin = ber.indexOf('<!-- ── Diagramm'), iS1 = ber.indexOf('<!-- ── Schritt 1');
  assert.ok(iEin > 0 && iEin < iS1, 'Diagramm direkt nach den Eingabewerten');
  assert.match(ber, /<div class="legende">.*Fahrdraht Soll \(h − sh\).*hf<sub>min<\/sub> … hf<sub>max<\/sub>/s);
  assert.doesNotMatch(ber, /Ts bei T<sub>1<\/sub> T<sub>1<\/sub>/, 'keine doppelte Beschriftung');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Zeichnung startet mit Überhöhung 5×; Link «SOK m ü. M. eintragen» ohne Pfeil', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => ({
    vex: Ansicht.zeichnungVEx, auswahl: document.getElementById('vex-select').value,
    link: document.getElementById('probe-sok-link').textContent.trim(),
  }));
  assert.deepEqual(r, { vex: 5, auswahl: '5', link: 'SOK m ü. M. eintragen' });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Stränge: Beispiel mit 3 Strängen übereinander, Sichtbarkeit, Farbe, Wechsel, Teilabschnitt, Export je Strang, Speichern', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const warte = ms => new Promise(res => setTimeout(res, ms));
    const titel = () => [...document.querySelectorAll('#abs-profil .abs-leiter title')].map(e => e.textContent);
    abschnittAnsicht(); await abschnittBeispiel(); await warte(900);
    const start = { n: abschnitt.straenge.length, kennungen: abschnitt.straenge.map(s => s.kennung), sys: sysMode,
      pfade: [...new Set(titel())].sort(), zeilen: document.querySelectorAll('.abs-str-tab tbody tr').length };
    // Sichtbarkeit und Farbe
    const deckung = [...document.querySelectorAll('#abs-profil .abs-leiter')].map(p => [p.querySelector('title').textContent, p.style.opacity || '1']);
    strangSichtbar(1, false);
    const aus = [...new Set(titel())].sort();
    strangSichtbar(0, false);                        // aktiver Strang bleibt sichtbar
    const aktivBleibt = abschnitt.straenge[0].sichtbar;
    strangSichtbar(1, true); await warte(50);
    strangFarbe(1, '#123456');
    const farbe = [...document.querySelectorAll('#abs-profil .abs-leiter')].some(p => /18, 52, 86|#123456/i.test(p.style.stroke));
    // Feldwahl mit Gruppen je Strang, Wechsel auf SPL
    const gruppen = [...document.querySelectorAll('#feld-select optgroup')].map(g => g.label);
    feldWaehlen('2:2'); await warte(900);
    const spl = { aktiv: abschnitt.aktiv, sys: sysMode, offen: abschnittOffenesFeld(), h1: document.getElementById('h1').value };
    strangWaehlen(0); await warte(900);
    const zurueck = { aktiv: abschnitt.aktiv, sys: sysMode };
    // Teilabschnitt: nur Felder 102–104
    teilSetzen('104', '102'); await warte(50);
    const teil = { ...abschnitt.teil, felder: document.querySelectorAll('.abs-erg tbody tr').length };
    // Export: IfcGroup und DXF-Layer je Strang, danach wieder derselbe Zustand
    let ifc = '', dxf = ''; const alt = window._dateiHerunterladen;
    window._dateiHerunterladen = x => { ifc = x; }; abschnittExport('ifc');
    window._dateiHerunterladen = x => { dxf = x; }; abschnittExport('dxf');
    window._dateiHerunterladen = alt;
    const exp = { gruppen: (ifc.match(/IFCGROUP\(/g) || []).length, spl: /\nSPL_TRAGSEIL\n|\nSPL_[A-Z]+\n/.test(dxf), fl1: /\nFL1_TRAGSEIL\n/.test(dxf), rl: /\nRL_[A-Z]+\n/.test(dxf),
      aktiv: abschnitt.aktiv, sys: sysMode };
    teilSetzen(null, null);
    // Speichern / Laden
    const st = JSON.parse(JSON.stringify(getProjectState()));
    abschnitt = { masten: [], offen: null, mp: {} }; renderAbschnitt();
    setProjectState(st); await warte(100);
    const geladen = { n: abschnitt.straenge.length, aktiv: abschnitt.aktiv, farbe: abschnitt.straenge[1].farbe,
      gleich: abschnitt.masten === abschnitt.straenge[abschnitt.aktiv].masten };
    setCanvasView('diagramm');
    return { start, deckung, aus, aktivBleibt, farbe, gruppen, spl, zurueck, teil, exp, geladen };
  });
  assert.deepEqual(r.start, { n: 3, kennungen: ['FL1', 'RL', 'SPL'], sys: 'nfl', pfade: ['FL1', 'RL', 'SPL'], zeilen: 3 });
  // Nicht aktive Stränge halb durchsichtig, der aktive deckend
  r.deckung.forEach(([k, o]) => assert.equal(o, k === 'FL1' ? '1' : '0.45', k));
  assert.deepEqual(r.aus, ['FL1', 'SPL']);
  assert.equal(r.aktivBleibt, true);
  assert.equal(r.farbe, true, 'Strangfarbe im Profil');
  assert.equal(r.gruppen.length, 3);
  assert.deepEqual(r.spl, { aktiv: 2, sys: 'el', offen: 2, h1: '10.50' });
  assert.deepEqual(r.zurueck, { aktiv: 0, sys: 'nfl' });
  assert.deepEqual(r.teil, { von: '102', bis: '104', felder: 2 });
  assert.equal(r.exp.gruppen, 3);
  assert.equal(r.exp.rl, true);
  assert.equal(r.exp.fl1, true);
  assert.equal(r.exp.spl, true);
  assert.deepEqual({ aktiv: r.exp.aktiv, sys: r.exp.sys }, { aktiv: 0, sys: 'nfl' });
  assert.deepEqual(r.geladen, { n: 3, aktiv: 0, farbe: '#123456', gleich: true });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Z = SOK: Projekt bis v4.3 (Z = Mastfuss) wird umgerechnet; Foto nutzt Mastfuss = SOK + Δ', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    // Projekt im bisherigen Format: abschnitt ohne zBezug, Z = Mastfuss
    const st = JSON.parse(JSON.stringify(getProjectState()));
    st.abschnitt = { masten: [{ name: 'A', e: 2600000, n: 1200000, z: 500, delta: 0.3, h: 7, km: '', L: null },
                              { name: 'B', e: 2600045, n: 1200000, z: 501, delta: null, h: 7, km: '', L: null }], offen: null, mp: {} };
    delete st.abschnitt.zBezug;
    setProjectState(st);
    const alt = abschnitt.masten.map(m => m.z);
    // Gespeichert wird mit zBezug «sok» → erneutes Laden ändert nichts
    const neu = JSON.parse(JSON.stringify(getProjectState()));
    setProjectState(neu);
    const nochmals = abschnitt.masten.map(m => m.z);
    // Foto: Fusspunkte am Mastfuss → Höhe über SOK = gemessen + Δ, dh mit SOK-Differenz
    const setze = (id, v) => { document.getElementById(id).value = v; };
    setze('sok-mum-left', 500); onSokMumLeftInput();
    setze('sok-mum-right', 501); document.getElementById('sok-mum-right').dataset.userEdited = '1'; onSokMumRightInput();
    setze('foto-hmast-L', 10); setze('foto-hmast-R', 10); setze('foto-L', 50); setze('foto-T1', 10);
    setze('mast-delta-sok-left', 0.3); setze('mast-delta-sok-right', 0.5);
    const pts = [['top_L', 100, 100], ['base_L', 100, 600], ['top_R', 900, 120], ['base_R', 900, 620], ['p1', 100, 200], ['p2', 900, 220], ['cmid', 500, 350]]
      .map(([role, px, py]) => ({ role, px, py }));
    window._fotoSetProjectState({ pts, result: { neu: true } }); fotoRecalcIfReady();
    const f = window._fotoResult;
    return { alt, nochmals, foto: { h1: +f.h_P1.toFixed(3), h2: +f.h_P2.toFixed(3), dh: +f.dh.toFixed(3),
      elL: document.getElementById('foto-elev-L').value, elR: document.getElementById('foto-elev-R').value } };
  });
  assert.deepEqual(r.alt, [499.7, 501]);
  assert.deepEqual(r.nochmals, [499.7, 501]);
  assert.deepEqual(r.foto, { h1: 8.3, h2: 8.5, dh: -1.2, elL: '500.300', elR: '501.500' });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('KM im Format 000.000 (Tabelle, Einzelfeld); Δ Mastfuss negativ mit typografischem Minus', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    abschnittAnsicht();
    abschnitt = { masten: beispielMasten(), offen: null, mp: {} }; renderAbschnitt();
    const zelle = (i, k) => document.querySelector(`.abs-masten tbody tr:nth-child(${i + 1}) input[aria-label^="${t('abs.sp.' + k)}"]`);
    const km = zelle(1, 'km'); km.value = '12,35'; km.dispatchEvent(new Event('change'));
    const d = zelle(1, 'delta'); d.value = '−0.2'; d.dispatchEvent(new Event('change'));
    const ein = document.getElementById('mast-km-left'); ein.value = '7+5'; ein.dispatchEvent(new Event('change'));
    setCanvasView('diagramm');
    return { kmFeld: km.value, km: abschnitt.masten[1].km, delta: abschnitt.masten[1].delta,
      tastatur: d.getAttribute('inputmode'), einzel: ein.value };
  });
  assert.deepEqual(r, { kmFeld: '012.350', km: '012.350', delta: -0.2, tastatur: null, einzel: '007.005' });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Stränge im Dunkelmodus: Neon-Töne statt Standardfarben, Auswahlkästchen im App-Design', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    abschnittAnsicht(); await abschnittBeispiel(); await new Promise(res => setTimeout(res, 300));
    const hell = [...document.querySelectorAll('.abs-farbe')].map(e => e.value);
    themaAnwenden('dunkel');
    const dunkel = [...document.querySelectorAll('.abs-farbe')].map(e => e.value);
    const vorschlag = [...document.querySelectorAll('#abs-farbvorschlag option')].map(o => o.value);
    strangFarbe(1, STRANG_FARBEN_DUNKEL[3]);                 // Neon gewählt → helle Standardfarbe gespeichert
    const gespeichert = abschnitt.straenge[1].farbe;
    const kasten = getComputedStyle(document.querySelector('.abs-str-tab input.auswahl')).appearance;
    themaAnwenden('hell'); setCanvasView('diagramm');
    return { hell, dunkel, vorschlag: vorschlag.length, gespeichert, kasten };
  });
  assert.deepEqual(r.hell, ['#4a5cb8', '#d9822b', '#2f9e6e']);
  assert.deepEqual(r.dunkel, ['#8c9bff', '#ffab5c', '#4fe3a5']);
  assert.equal(r.vorschlag, 6);
  assert.equal(r.gespeichert, '#b8457a');
  assert.equal(r.kasten, 'none');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Messpunkte: Karte = Diagramm für alle Bezüge (Durchhang, Δh links/rechts/höchster Punkt), SOK links ≠ rechts', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const warte = ms => new Promise(res => setTimeout(res, ms));
    abschnittAnsicht(); await abschnittBeispiel(); await warte(300);
    abschnittFeldOeffnen(1); setCanvasView('diagramm');          // Feld 102–103: SOK 540.08 → 540.52
    for (const [id, v] of [['probe-x1', '16.79'], ['probe-x2', '23.04']]) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); }
    await warte(300); berechnen(); await warte(200);
    const vorgabe = mpBezug;
    const { h1, h2, L, c2, c2_vem } = calcState, c = c2_vem || c2;
    const sL = getSokMumLeft(), sR = getSokMumRight();
    const A1 = sL + h1, A2 = sR + h2;
    const seil = x => c.a * Math.cosh((x - c.x_low) / c.a) + c.C + sL + (sR - sL) * x / L;   // m ü. M.
    // Bezug je Variante (m ü. M.): Horizontale durch links / rechts / höchsten Punkt, bzw. Sehne
    const bezug = { links: () => A1, rechts: () => A2, hoch: () => Math.max(A1, A2), sehne: x => A1 + (A2 - A1) * x / L };
    const aus = {};
    for (const m of ['hoch', 'links', 'rechts', 'sehne']) {
      setMpBezug(m); await warte(100);
      const werte = [...document.querySelectorAll('.istzustand-main')].map(e => parseFloat(e.querySelector('.istzustand-value').textContent));
      aus[m] = { karte: werte.slice(0, 2), soll: [16.79, 23.04].map(x => bezug[m](x) - seil(x)) };
    }
    setMpBezug('hoch');
    return { sokVerschieden: sR - sL > 0.4, vorgabe, aus };
  });
  assert.equal(r.sokVerschieden, true);
  assert.equal(r.vorgabe, 'hoch', 'Vorgabe: Δh zum höchsten Punkt');
  for (const [m, v] of Object.entries(r.aus))
    v.soll.forEach((s, i) => assert.ok(Math.abs(v.karte[i] - s) < 0.006, `${m} M${i + 1}: Karte ${v.karte[i]} ≠ Diagramm ${s.toFixed(3)}`));
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('T₃ = T₂ bei gleicher Temperatur: gleiche Werte auf Karte, Tabelle und Zeichnung (N-FL kombiniert, Einzelleiter)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms));
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); };
    const aus = {};
    for (const sys of ['nfl', 'el']) {
      setSysMode(sys); await w(100);
      setze('temp2', '80'); setze('temp3', '80'); if (!showT3) toggleT3();
      setze('probe-x1', '19.13'); await w(250); berechnen(); await w(150);
      const mp = document.querySelector('#highlight-card .istzustand-main');
      const t3Block = mp?.querySelector('div[style*="dashed"]');   // T₃-Teil unter T₂
      const karte = [...mp.querySelectorAll(':scope > .istzustand-value'), ...(t3Block ? [t3Block.children[1], t3Block.children[4]] : [])]
        .map(e => parseFloat(e.textContent));
      const t2 = document.querySelector('#results .metric-value:not(.ref):not(.t3val)')?.textContent;
      const t3 = document.querySelector('#results .metric-value.t3val')?.textContent;
      const cs = calcState, c3z = cs.c3_vem ?? cs.c3, c2z = (sys === 'nfl' && cs.c2_vem) ? cs.c2_vem : cs.c2;
      aus[sys] = { karte, t2, t3, zeichnungGleich: Math.abs(c3z.C - c2z.C) < 1e-9 && Math.abs(c3z.a - c2z.a) < 1e-9 };
      setze('probe-x1', ''); toggleT3();
    }
    return aus;
  });
  for (const sys of ['nfl', 'el']) {
    const { karte, t2, t3, zeichnungGleich } = r[sys];
    assert.ok(karte.length >= 4, `${sys}: Karte mit T2 und T3`);
    assert.equal(karte[2], karte[0], `${sys}: Δh T3 = Δh T2`);
    assert.equal(karte[3], karte[1], `${sys}: Höhe T3 = Höhe T2`);
    assert.equal(t3, t2, `${sys}: Durchhang in der Tabelle`);
    assert.equal(zeichnungGleich, true, `${sys}: Zeichnung`);
  }
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Eingabeprüfung: Fehler sperrt (Spannweite 0/leer, Höhe ≤ 0), Warnung rechnet weiter (ungewöhnliche Werte)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input')); berechnen(); };
    const zustand = id => ({ rot: document.getElementById(id).classList.contains('feld-fehler'), gelb: document.getElementById(id).classList.contains('feld-warnung'),
      gerechnet: !!calcState, fehler: !document.getElementById('error-box').classList.contains('hidden'),
      warnung: !document.getElementById('warn-box').classList.contains('hidden') ? document.getElementById('warn-box').innerText : '' });
    const aus = {};
    for (const [n, id, v, zurueck] of [['span0', 'span', '0', '45'], ['spanLeer', 'span', '', '45'], ['h1null', 'h1', '0', '7'],
      ['span120', 'span', '120', '45'], ['h20', 'h2', '20', '7'], ['t2_120', 'temp2', '120', '-20'], ['normal', 'span', '45', '45']]) {
      setze(id, v); aus[n] = zustand(id); setze(id, zurueck);
    }
    return aus;
  });
  for (const n of ['span0', 'spanLeer', 'h1null']) assert.deepEqual({ rot: r[n].rot, gerechnet: r[n].gerechnet, fehler: r[n].fehler }, { rot: true, gerechnet: false, fehler: true }, n);
  for (const n of ['span120', 'h20', 't2_120']) {
    assert.deepEqual({ gelb: r[n].gelb, gerechnet: r[n].gerechnet, fehler: r[n].fehler }, { gelb: true, gerechnet: true, fehler: false }, n);
    assert.match(r[n].warnung, /bitte prüfen/, n);
  }
  assert.deepEqual({ rot: r.normal.rot, gelb: r.normal.gelb, warnung: r.normal.warnung }, { rot: false, gelb: false, warnung: '' });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Handy: Messpunkte M1–M4 und H1–H4 je 2 nebeneinander, eingetippter Wert sichtbar', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 390, height: 844 } });
  const r = await seite.evaluate(() => {
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput();   // H-Zeile erscheint erst mit SOK
    const e = document.getElementById('probe-x1'); e.value = '15.5'; e.dispatchEvent(new Event('input'));
    const spalten = s => getComputedStyle(document.querySelector(s)).gridTemplateColumns.split(' ').length;
    return { m: spalten('.probe-m-zeile'), h: spalten('.probe-h-zeile'), breite: e.getBoundingClientRect().width };
  });
  assert.deepEqual({ m: r.m, h: r.h }, { m: 2, h: 2 });
  assert.ok(r.breite >= 60, `Eingabefeld ${r.breite}px breit`);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Gemeinsame Seillage: PDF-Messpunkte und Fahrdraht am Tiefpunkt wie Bildschirm; H-Zeile erst mit SOK', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const r = await seite.evaluate(() => {
    document.getElementById('temp2').value = 40;
    const e = document.getElementById('probe-x1'); e.value = '15'; e.dispatchEvent(new Event('input')); berechnen();
    const ohneSok = { zeile: getComputedStyle(document.getElementById('probe-h-section')).display, hinweis: getComputedStyle(document.getElementById('probe-sok-hinweis')).display };
    const cs = calcState, k = anzeigeKurve('T2');
    const sollTs = kettenY(k, 15), sollFd = fdUeberSok(k.x_low, cs, cs);
    window.__fenster.length = 0; pdfExport();
    const txt = window.__fenster[0].html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const fdPdf = parseFloat((txt.match(/Fd-Höhe über SOK = ([\d.]+) m/) || [])[1]);
    const tsPdf = parseFloat((txt.match(/M1 (?:&nbsp; )?x = 15\.00 m ([\d.]+) m/) || [])[1]);
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput();
    const mitSok = getComputedStyle(document.getElementById('probe-h-section')).display;
    return { ohneSok, mitSok, fdPdf, sollFd: +sollFd.toFixed(2), tsPdf, sollTs: +sollTs.toFixed(2), karteTs: parseFloat(document.querySelectorAll('#highlight-card .istzustand-value')[1].textContent) };
  });
  assert.deepEqual(r.ohneSok, { zeile: 'none', hinweis: 'block' });
  assert.notEqual(r.mitSok, 'none');
  assert.equal(r.fdPdf, r.sollFd, 'Fahrdraht am Tiefpunkt: PDF = Diagramm/Zeichnung');
  assert.equal(r.tsPdf, r.sollTs, 'Ts-Höhe am Messpunkt: PDF = Karte');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Datensicherheit: «Alles sichern» und wieder einlesen, Erinnerung nach 14 Tagen, Speicherzustand', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms));
    localStorage.clear();
    openProjectsModal(); saveCurrentCalc(); document.getElementById('temp2').value = 30; berechnen(); saveCurrentCalc();
    const vorher = getProjMeta().filter(m => !m.isGroup).length;
    const ungesichert = !!localStorage.getItem('dh_erste_ungesichert');
    let datei = '', name = ''; const alt = window._dateiHerunterladen; window._dateiHerunterladen = (x, n) => { datei = x; name = n; };
    sicherungExportieren(); window._dateiHerunterladen = alt;
    const nachSicherung = { ungesichert: !!localStorage.getItem('dh_erste_ungesichert'), zeitpunkt: !!localStorage.getItem('dh_letzte_sicherung') };
    await _speicherStatus();
    const status = document.getElementById('speicher-status').textContent;
    const inhalt = JSON.parse(datei);
    // Browserdaten weg → Sicherung einlesen
    localStorage.clear();
    const input = document.getElementById('proj-import-input');
    const dt = new DataTransfer(); dt.items.add(new File([datei], name, { type: 'application/json' })); input.files = dt.files;
    importProjectFile(input); await w(300);
    const nachher = getProjMeta().filter(m => !m.isGroup).length;
    // Nochmals einlesen: nichts doppelt
    const dt2 = new DataTransfer(); dt2.items.add(new File([datei], name, { type: 'application/json' })); input.files = dt2.files;
    importProjectFile(input); await w(300);
    const doppelt = getProjMeta().filter(m => !m.isGroup).length;
    // Erinnerung: erste ungesicherte Änderung vor 15 Tagen
    document.querySelectorAll('#meldungen .meldung').forEach(m => m.remove());
    localStorage.setItem('dh_erste_ungesichert', String(Date.now() - 15 * 864e5));
    _sicherungsErinnerung();
    const erinnerung = [...document.querySelectorAll('#meldungen .meldung')].map(m => m.textContent).join(' ');
    closeProjectsModal();
    return { vorher, ungesichert, nachSicherung, typ: inhalt.type, anzahl: Object.keys(inhalt.projekte).length, name, nachher, doppelt,
      erinnerung, status };
  });
  assert.equal(r.vorher, 2);
  assert.equal(r.ungesichert, true, 'Änderung wird gemerkt');
  assert.deepEqual(r.nachSicherung, { ungesichert: false, zeitpunkt: true });
  assert.equal(r.typ, 'durchhang_sicherung');
  assert.equal(r.anzahl, 2);
  assert.match(r.name, /^durchhang_sicherung_\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(r.nachher, 2, 'nach dem Einlesen wieder da');
  assert.equal(r.doppelt, 2, 'erneutes Einlesen verdoppelt nichts');
  assert.match(r.erinnerung, /15 Tagen/);
  assert.match(r.erinnerung, /Jetzt sichern/);
  assert.match(r.status, /Belegt: ca\. [\d.]+ MB/);
  assert.match(r.status, /Letzte Sicherung/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Aufbau: Gestaltung, Übersetzungen, Programm und Handbuch als eigene Dateien; Handbuch lädt beim Öffnen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const quellen = [...document.querySelectorAll('script[src], link[rel=stylesheet]')].map(e => e.getAttribute('src') || e.getAttribute('href'));
    const leerVorher = document.querySelectorAll('#hb-text .hb-lang').length;
    await openHandbuch();
    const nachher = document.querySelectorAll('#hb-text .hb-lang').length;
    const kapitel = document.querySelectorAll('#hb-nav a').length;
    closeHandbuch();
    return { quellen, leerVorher, nachher, kapitel, sprachen: Object.keys(LANG) };
  });
  for (const f of ['app.css', 'i18n.js', 'app.js', 'rechenkern.js']) assert.ok(r.quellen.includes(f), f);
  assert.equal(r.leerVorher, 0);
  assert.ok(r.nachher > 30, `Handbuch-Blöcke: ${r.nachher}`);
  assert.ok(r.kapitel > 5, `Kapitelleiste: ${r.kapitel}`);
  assert.deepEqual(r.sprachen, ['de', 'fr', 'it']);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Fensterstapel: Rückfrage liegt über jedem Fenster, Esc schliesst das oberste', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const tick = () => new Promise(res => setTimeout(res, 0));
    const rf = document.getElementById('rueckfrage');
    const rfOben = () => { const k = rf.querySelector('.modal-card').getBoundingClientRect();
      return rf.contains(document.elementFromPoint(k.x + k.width / 2, k.y + 20)); };
    const verdeckt = [];
    for (const el of document.querySelectorAll('.modal-overlay')) {
      if (el === rf) continue;
      el.classList.add('open'); const antwort = frageBestaetigung('Test?'); await tick();
      if (!rfOben()) verdeckt.push(el.id);
      document.getElementById('rf-abbrechen').click(); await antwort.catch(() => {});
      el.classList.remove('open'); await tick();
    }
    // Echter Ablauf: im Datei-Dialog eine Berechnung löschen
    localStorage.clear(); openProjectsModal(); saveCurrentCalc(); await tick();
    const id = getProjMeta().find(m => !m.isGroup).id;
    const loeschen = deleteProjectById(id); await tick();
    const loeschenOben = rf.classList.contains('open') && rfOben();
    document.getElementById('rf-abbrechen').click(); await loeschen.catch(() => {});
    // Datei zu und gleich wieder auf, Handbuch dazwischen geöffnet: Datei liegt oben
    closeProjectsModal(); openHandbuch(); openProjectsModal(); await tick();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const nachEsc = { datei: document.getElementById('projects-modal').classList.contains('open'),
                      handbuch: document.getElementById('handbuch-modal').classList.contains('open') };
    closeHandbuch();
    return { verdeckt, loeschenOben, nachEsc };
  });
  assert.deepEqual(r.verdeckt, [], 'Rückfrage verdeckt hinter: ' + r.verdeckt.join(', '));
  assert.ok(r.loeschenOben, 'Rückfrage «Löschen?» liegt über dem Datei-Dialog');
  assert.deepEqual(r.nachEsc, { datei: false, handbuch: true }, 'Esc schliesst das zuletzt geöffnete Fenster');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Einzelleiter: H freie Eingabe, «↺» rechts daneben, Infobox ausgegraut, bleibt gespeichert', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms));
    const H = () => document.getElementById('tension');
    const zustand = () => ({ H: H().value, frei: !H().readOnly,
      reset: istSichtbar(document.getElementById('tension-reset-btn')),
      hw: document.getElementById('tension-reglage-hw').textContent.trim(),
      boxAus: document.getElementById('el-reglage-info').classList.contains('inaktiv'),
      zeile: istSichtbar(document.getElementById('el-reglage-inaktiv')),
      knopfRechts: (() => { const f = document.getElementById('tension-wrap').getBoundingClientRect(), k = document.getElementById('tension-reset-btn').getBoundingClientRect();
        return k.width > 0 && k.left >= f.right && Math.abs((k.top + k.bottom) / 2 - (f.top + f.bottom) / 2) < 3; })() });
    setSysMode('nfl'); setSysMode('el'); await w(100);   // Systemwechsel darf den Knopf im Label nicht löschen
    const start = zustand();
    H().value = '4500'; H().dispatchEvent(new Event('input', { bubbles: true })); berechnen(); await w(50);
    const hand = zustand(); const sagHand = calcState.c2.sag;
    const t1 = document.getElementById('temp1'); t1.value = '25'; t1.dispatchEvent(new Event('input', { bubbles: true })); t1.dispatchEvent(new Event('change', { bubbles: true })); await w(50);
    const nachT1 = zustand();
    setProjectState(getProjectState()); await w(100);
    const geladen = zustand();
    document.getElementById('tension-reset-btn').click(); await w(50);
    const zurueck = zustand();
    // N-FL bleibt an die Reglage gebunden
    setSysMode('nfl'); await w(50);
    const nfl = { frei: !H().readOnly };
    return { start, hand, nachT1, geladen, zurueck, nfl, sagHand };
  });
  assert.equal(r.start.H, '3700'); assert.ok(r.start.frei, 'Einzelleiter: H ist eintippbar');
  assert.ok(!r.start.reset, 'ohne Handwert kein «↺ Reglage»');
  assert.equal(r.hand.H, '4500'); assert.ok(r.hand.reset, '«↺ Reglage» erscheint beim Handwert');
  assert.match(r.hand.hw, /Freie Eingabe/); assert.doesNotMatch(r.hand.hw, /%|3'700/, 'kein Bezug zur Reglage');
  assert.ok(r.hand.boxAus && r.hand.zeile, 'Reglage-Infobox ausgegraut mit Zusatzzeile');
  assert.ok(r.hand.knopfRechts, '«↺» rechts neben dem Feld, gleiche Höhe');
  assert.ok(!r.start.boxAus && !r.start.zeile, 'ohne freie Eingabe keine Markierung');
  assert.equal(r.nachT1.H, '4500', 'T₁-Änderung überschreibt den Handwert nicht');
  assert.equal(r.geladen.H, '4500', 'Handwert bleibt beim Speichern/Laden erhalten'); assert.ok(r.geladen.reset);
  assert.equal(r.zurueck.H, '3100', '«↺» setzt auf den Reglagewert bei T₁ zurück'); assert.ok(!r.zurueck.reset);
  assert.ok(!r.zurueck.boxAus && !r.zurueck.zeile, 'nach «↺» Infobox wieder normal');
  assert.ok(!r.nfl.frei, 'N-FL: H bleibt an die Reglage gebunden');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Reglage-Infobox: bei N-FL, R-FL und Einzelleiter gleich gestaltet (aufklappbar, «i» rechts, unter der Auswahl)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const out = {};
    for (const [sys, id] of [['nfl', 'combo-info'], ['rfl', 'combo-info'], ['el', 'el-reglage-info']]) {
      setSysMode(sys); await new Promise(res => setTimeout(res, 100));
      const box = document.getElementById(id), sum = box.querySelector(':scope > summary'), i = box.parentElement.querySelector(':scope > .rgl-i');
      const ba = document.getElementById('berechnungsart-row');
      const ri = i?.getBoundingClientRect(), rs = sum.getBoundingClientRect();
      out[sys] = { details: box.tagName, sichtbar: istSichtbar(box), iRechts: !!i && istSichtbar(i) && ri.right > rs.right - 30 && ri.top < rs.bottom && ri.bottom > rs.top,
                   vorBerechnungsart: !istSichtbar(ba) || box.getBoundingClientRect().top < ba.getBoundingClientRect().top };
    }
    // Einzelleiter: «i» öffnet die Box samt Reglagetabelle
    const box = document.getElementById('el-reglage-info'); box.open = false;
    document.getElementById('el-reglage-info-btn').click();
    out.elTabelle = box.open && istSichtbar(document.getElementById('el-reglage-edit-panel'));
    toggleReglageEdit();
    // N-FL / R-FL: «i» öffnet die Reglagetabelle
    setSysMode('nfl'); document.querySelector('#combo-info + .rgl-i').click();
    out.nflTabelle = document.getElementById('reglage-modal').classList.contains('open');
    closeReglageModal();
    return out;
  });
  for (const sys of ['nfl', 'rfl', 'el']) assert.deepEqual(r[sys], { details: 'DETAILS', sichtbar: true, iRechts: true, vorBerechnungsart: true }, sys);
  assert.ok(r.elTabelle, 'Einzelleiter: «i» öffnet die Reglagetabelle');
  assert.ok(r.nflTabelle, 'N-FL: «i» öffnet die Reglagetabelle');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Anzeige folgt jeder Eingabe (kein Nachziehen erst durch Systemwechsel)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const w = ms => new Promise(res => setTimeout(res, ms));
    const bild = () => document.getElementById('main-canvas').toDataURL();
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    // 1) hf-Linien im Diagramm nach «Starr» (früher: Werte des vorherigen Schritts)
    setSysMode('nfl'); setCanvasView('diagramm'); setDiagrammHf(true);
    setze('preset-select', 'nfl_stcu50_cu107_190_8'); await w(50);
    setSpanMode('ruling'); await w(50); setBerechnungsart('starr'); await w(150);
    const vorher = bild(); setProjectState(getProjectState()); await w(150);
    const hfGleich = vorher === bild();
    setDiagrammHf(false); setBerechnungsart('ausgleichend');
    // 2) Einzelleiter ohne eigene Reglagetabelle (Cu 107): nach dem Laden folgt H weiter T₁
    setSysMode('el'); setze('el-material-select', 'cu107'); await w(50);
    setProjectState(getProjectState()); await w(100);
    const H0 = document.getElementById('tension').value;
    setze('temp1', '30'); await w(50);
    const elFolgt = document.getElementById('tension').value !== H0 && istSichtbar(document.getElementById('tension-reglage-hw'));
    setLang('fr'); await w(50);
    const basisLeer = !istSichtbar(document.getElementById('el-basis-row'));
    setLang('de');
    // EL-«i» liegt nur bei sichtbarer Box vor
    setSysMode('nfl'); const iVersteckt = !istSichtbar(document.getElementById('el-reglage-info-btn'));
    // 3) Abschnitt-Ansicht wechselt die Sprache sofort
    setSysMode('nfl'); abschnittAnsicht(); await w(100);
    setLang('fr'); await w(100);
    const absFr = document.getElementById('abschnitt-view').innerText;
    setLang('de'); setCanvasView('diagramm');
    return { hfGleich, elFolgt, basisLeer, iVersteckt, absFrOk: /Mât/.test(absFr) && !/Mast hinzu|\+ Mast/.test(absFr) };
  });
  assert.ok(r.hfGleich, 'hf-Linien im Diagramm stimmen nach Wechsel auf «Starr»');
  assert.ok(r.elFolgt, 'Einzelleiter Cu 107: nach dem Laden folgt H der Reglage bei T₁');
  assert.ok(r.absFrOk, 'Abschnitt-Ansicht sofort auf Französisch');
  assert.ok(r.basisLeer, 'Cu 107: keine leere Basiskraft-Leiste nach Sprachwechsel');
  assert.ok(r.iVersteckt, '«i» des Einzelleiters bei N-FL ausgeblendet');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Reglagewerte: hergeleitete auf 100 N gerundet, Infobox nennt den Bezugswert bei +10 °C wie das H-Feld', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    const zahl = s => parseInt(String(s).replace(/[^\d]/g, ''), 10);
    const abweichungen = [];
    setSysMode('el');
    for (const o of [...document.getElementById('el-material-select').options]) for (const art of ['ausgleichend', 'starr']) {
      setze('el-material-select', o.value); setBerechnungsart(art); setze('temp1', '10');
      const tbl = activePresetRef?.H_Ts_ub_table;
      const nicht100 = (tbl?.vals || []).filter(v => v % 100 !== 0);
      const titel = document.getElementById('el-reglage-title').textContent;
      const H = document.getElementById('tension').value;
      const boxH = zahl((titel.match(/H = ([\d'’]+)/) || [])[1]);
      if (!tbl || nicht100.length || !/\+10 °C/.test(titel) || boxH !== +H) abweichungen.push({ mat: o.value, art, titel, H, nicht100 });
    }
    setBerechnungsart('ausgleichend');
    // N-FL: Notiz nennt die Bezugswerte bei +10 °C, unabhängig von T₁
    setSysMode('nfl'); setze('temp1', '10'); const n10 = document.getElementById('combo-note').textContent;
    setze('temp1', '17'); const n17 = document.getElementById('combo-note').textContent;
    return { abweichungen, nflGleich: n10 === n17, nfl10: /bei \+10 °C/.test(n10) };
  });
  assert.deepEqual(r.abweichungen, []);
  assert.ok(r.nfl10 && r.nflGleich, 'N-FL-Infobox: Bezugswerte bei +10 °C, unabhängig von T₁');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Touchscreen: kleine runde Info-Knöpfe bleiben rund (keine 40-px-Streckung)', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { hasTouch: true });
  const r = await seite.evaluate(async () => {
    const out = { coarse: matchMedia('(any-pointer: coarse)').matches, verzerrt: [] };
    for (const sys of ['nfl', 'rfl', 'el']) {
      setSysMode(sys); await new Promise(res => setTimeout(res, 50));
      document.querySelectorAll('.rgl-i, [id$="-info-btn"]').forEach(b => {
        if (!b.getClientRects().length) return;
        const q = b.getBoundingClientRect();
        if (Math.abs(q.width - q.height) > 2) out.verzerrt.push(`${sys}: ${b.id || b.className} ${Math.round(q.width)}×${Math.round(q.height)}`);
      });
    }
    return out;
  });
  assert.ok(r.coarse, 'Touch-Nachbildung aktiv');
  assert.deepEqual(r.verzerrt, []);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Reglage-Fenster: angepasste Reglagewerte gehören zum Projekt, Knöpfe einheitlich, Eingabe behält den Fokus', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  // Tippen im Bearbeiten-Modus (echte Tastatur): Feld behält den Fokus
  await seite.evaluate(() => { setSysMode('el'); openReglageModal(); toggleReglageElEdit(); });
  const feld = seite.locator('#rgl-el-wrap input[type=number]').first();
  await feld.click(); await feld.press('Control+A'); await seite.keyboard.type('7000');
  const r = await seite.evaluate(async () => {
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    const H = () => document.getElementById('tension').value;
    const o = { getippt: _elMatEdits.cu95_0?.H_max };
    const hoehen = [...document.querySelectorAll('#rgl-el-edit-btn, .rgl-knopf')].filter(e => e.getClientRects().length).map(e => Math.round(e.getBoundingClientRect().height));
    o.knoepfeGleich = new Set(hoehen).size === 1;
    const ohne = getProjectState();                       // Projekt ohne Anpassung
    _applyElMatEdits(); closeReglageModal(); setze('temp1', '10');
    o.angepasst = H(); o.markiert = /Angepasste/.test(document.getElementById('el-reglage-note').textContent);
    const mit = getProjectState();
    setProjectState(ohne); setze('temp1', '10'); o.ohne = H();
    setProjectState(mit); setze('temp1', '11'); o.mitT11 = H();
    reglageSbbWiederherstellen(); setze('temp1', '10'); o.sbb = H();
    return o;
  });
  assert.equal(r.getippt, 7000, 'Bearbeiten: «7000» kommt vollständig an');
  assert.ok(r.knoepfeGleich, 'Bearbeiten / Export / Import gleich hoch');
  assert.equal(r.angepasst, '4100'); assert.ok(r.markiert, 'Infobox zeigt «angepasst»');
  assert.equal(r.ohne, '3700', 'anderes Projekt rechnet mit SBB-Werten');
  assert.equal(r.mitT11, '4040', 'geladenes Projekt rechnet bei neuem T₁ mit seinen angepassten Werten');
  assert.equal(r.sbb, '3700', '«↺ SBB-Werte» stellt die SBB-Tabelle wieder her');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Einzelleiter «Starr»: nach Laden und Systemwechsel gilt weiter die Starr-Reglage', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    const zust = () => ({ H: document.getElementById('tension').value, box: document.getElementById('el-reglage-title').textContent });
    setSysMode('el'); setBerechnungsart('starr'); setze('temp1', '10');
    const vorher = zust();
    setProjectState(getProjectState()); setze('temp1', '10');
    const geladen = zust();
    setSysMode('nfl'); setSysMode('el'); setze('temp1', '10');
    const wechsel = zust();
    setBerechnungsart('ausgleichend');
    return { vorher, geladen, wechsel };
  });
  assert.equal(r.vorher.H, '2800'); assert.match(r.vorher.box, /2'800 N.*25 m/);
  assert.deepEqual(r.geladen, r.vorher, 'nach dem Laden');
  assert.deepEqual(r.wechsel, r.vorher, 'nach Systemwechsel');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Messpunkt-Bezug: Auswahl wirkt auf Diagramm, Karte, Leiste und PDF gleich und bleibt im Projekt', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    setSysMode('el'); setze('span', '50'); setze('sok-mum-left', '540.68'); setze('sok-mum-right', '541.22');
    setze('h1', '7'); setze('h2', '7'); setze('temp2', '40'); setze('probe-x1', '19.5'); berechnen();
    const aus = {};
    for (const m of ['hoch', 'links', 'rechts', 'sehne']) {
      const sel = document.getElementById('mp-bezug'); sel.value = m; sel.dispatchEvent(new Event('change'));
      const karte = parseFloat(document.querySelector('.istzustand-main .istzustand-value').textContent);
      const html = buildPdfSectionHtml('t', '');
      const pdf = parseFloat((html.match(/M1 &nbsp; x = 19\.50 m<\/td>(?:\s*<td[^>]*>[^<]*<\/td>)*?\s*<td[^>]*>([\d.\-]+) m<\/td>\s*<\/tr>/) || [])[1]);
      const kopf = (html.match(/<th>([^<]*)\[m\]<\/th>/) || [])[1]?.trim();
      aus[m] = { karte, pdf, kopf, label: document.body.innerText.includes(t('mp.bezug.' + m)) };
    }
    document.getElementById('mp-bezug').value = 'links'; setMpBezug('links');
    const st = getProjectState(); setMpBezug('hoch'); setProjectState(st);
    const geladen = { mpBezug, auswahl: document.getElementById('mp-bezug').value };
    const alt = { ...st }; delete alt.mpBezug; setProjectState(alt);
    return { aus, geladen, altesProjekt: mpBezug };
  });
  assert.equal(r.aus.hoch.karte, 1.23); assert.equal(r.aus.links.karte, 0.69);
  assert.equal(r.aus.rechts.karte, 1.23); assert.equal(r.aus.sehne.karte, 0.90);
  for (const [m, v] of Object.entries(r.aus)) {
    assert.ok(Math.abs(v.pdf - v.karte) < 0.006, `${m}: PDF ${v.pdf} ≠ Karte ${v.karte}`);
    assert.ok(v.label, `${m}: Beschriftung sichtbar`);
  }
  assert.equal(r.aus.sehne.kopf, 'Durchhang (Sehne)');
  assert.deepEqual(r.geladen, { mpBezug: 'links', auswahl: 'links' }, 'Bezug wird mit dem Projekt gespeichert');
  assert.equal(r.altesProjekt, 'hoch', 'ältere Projekte: Vorgabe höchster Punkt');
  assert.deepEqual(fehler, []);
  await kontext.close();
});
