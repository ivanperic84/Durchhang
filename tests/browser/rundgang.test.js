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
const ROHSCHLUESSEL = /\b(?:ui|par|res|pdf|foto|koord|exp|sys|span|bp|hb|msg|err|leg|canvas|dyn|val|cm|preset|rf|t3|lm|draw|share|proj|reglage|mat|card|app|btn|probe|warn|pwa)\.[a-z0-9]+(?:\.[a-z0-9_]+)*\b/i;

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
