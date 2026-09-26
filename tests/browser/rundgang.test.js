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

test('Koordinaten LV95 → Spannweite, SOK, IFC und DXF georeferenziert', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.evaluate(() => {
    const setze = (id, v) => { document.getElementById(id).value = v; };
    setze('koord-e-left', 2600000.5); setze('koord-n-left', 1200000.25); setze('koord-z-left', 500);
    setze('koord-e-right', 2600030); setze('koord-n-right', 1200033.9); setze('koord-z-right', 501.2);
    setze('mast-delta-sok-left', 0.3); setze('mast-delta-sok-right', 0.1);
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
    document.getElementById('hf-btn').click();
    const offen = document.getElementById('hf-modal').classList.contains('open');
    // In der Excel gespeicherter Fall (hfmin_v11_D / hfmax_v11_D)
    Object.assign(hfEingabe, { typ: 'nfl', c: 30, v: 141, bue: false, kombi: 'stcu50_cu107', Lm: 30, H_ub: 1700,
      T_montage: 10, H_Fd: 8500, un: 15, schotter: false, ebv: 2, f: 0, H: 0, Tmin: -5, zlMin: 7, lrp: false, Tmax: -5, zlMax: 7 });
    renderHf();
    const werte = () => [document.getElementById('hf-wert-min').innerText, document.getElementById('hf-wert-max').innerText];
    const excel = werte();
    // Zusatzlast nur bei −5 °C: Temperatur ändern setzt sie auf 0 und sperrt das Feld
    hfWert('Tmax', '-20');
    const zlGesperrt = document.getElementById('hf-zlMax').disabled && hfEingabe.zlMax === 0;
    // R-FL: Fallprüfung sichtbar, Ergebnis vorhanden
    hfWert('typ', 'rfl');
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
    return { offen, excel, zlGesperrt, rfl, grafiken, texte, pdf, geladen };
  });
  assert.equal(r.offen, true);
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
  assert.equal((r.pdf[0].match(/<svg/g) || []).length, 2, 'Grafiken im PDF');
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
    return { ohne, mit, deltaImKoord: !!document.querySelector('#koord-felder #mast-delta-sok-left') };
  });
  assert.equal(r.ohne.geprueft, false);
  assert.equal(r.ohne.hinweis, true);
  assert.match(r.ohne.erg, /SOK/);
  assert.equal(r.mit.geprueft, true);
  assert.equal(r.mit.hinweis, false);
  assert.match(r.mit.einheit, /ü\. M\./);
  assert.equal(r.deltaImKoord, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Alle Checkboxen erscheinen als Schalter', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    openLastfaelle();
    const kaesten = [...document.querySelectorAll('input[type=checkbox]')].filter(el => el.offsetParent !== null);
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
