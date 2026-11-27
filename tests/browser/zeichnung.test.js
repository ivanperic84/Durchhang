// Zeichnung (massstäblich): Lesbarkeit, Legende, Lotlinien, T₃ = T₂, Mastangaben,
// Hänger, Massstab, Messpunkt-Tabelle, Zeichnungs-PDF mit Datenstreifen; Start-Hinweis.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { serverStarten, browserStarten, appOeffnen } = require('./hilfe.js');

let server, url, browser;
before(async () => { ({ server, url } = await serverStarten()); browser = await browserStarten(); });
after(async () => { await browser?.close(); server?.close(); });

// Fall mit SOK, drei Feldern, Messpunkt, Hindernis und T₃ = T₂
async function fall(seite, { extent = 'catenary', vex = 10 } = {}) {
  await seite.evaluate(async ({ extent, vex }) => {
    const w = ms => new Promise(r => setTimeout(r, ms));
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    setSpanMode('ruling'); changeSpanCount(+1);
    setze('span-0', '50'); setze('span-1', '45'); setze('span-2', '40');
    setze('h1', '7.00'); setze('h2', '6.80');
    setze('sok-mum-left', '1.00'); onSokMumLeftInput();
    setze('mast-num-left', '101'); setze('mast-km-left', '012.300');
    setze('temp2', '80'); setze('temp3', '80');
    if (!showT3) toggleT3();
    _mpSetzen({ x: [15.5, null, null, null], h: [7.8, null, null, null], verbinden: false });
    berechnen(); await w(50);
    setCanvasView('zeichnung'); await w(200);
    setDrawingVEx(vex); setDrawingExtent(extent); await w(200);
    document.getAnimations().forEach(a => a.finish());
  }, { extent, vex });
}

// Messungen in der angezeigten Zeichnung
const messen = seite => seite.evaluate(() => {
  const svg = document.querySelector('#scale-svg-container svg');
  const sr = svg.getBoundingClientRect();
  const texte = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim() && t.getClientRects().length)
    .map(t => ({ t: t.textContent.trim(), r: t.getBoundingClientRect() }));
  const ueber = [];
  for (let i = 0; i < texte.length; i++) for (let j = i + 1; j < texte.length; j++) {
    const a = texte[i].r, b = texte[j].r;
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) ueber.push(`${texte[i].t} ↔ ${texte[j].t}`);
  }
  const leg = document.getElementById('drawing-legend-overlay').getBoundingClientRect();
  return {
    kleinste: Math.min(...texte.map(x => x.r.height)),
    ueber,
    legendeUnter: leg.top >= sr.bottom - 1,
    legende: document.getElementById('drawing-legend-overlay').innerText,
    abgeschnitten: texte.filter(x => x.r.left < sr.left - 1 || x.r.right > sr.right + 1).map(x => x.t),
    tabelle: [...document.querySelectorAll('#scale-data-strip .strip-label')].map(e => e.textContent),
    werteSichtbar: [...document.querySelectorAll('#scale-data-strip .strip-row')].every(z => {
      const l = z.querySelector('.strip-label').getBoundingClientRect();
      return [...z.querySelectorAll('.strip-val')].every(v => v.getBoundingClientRect().left >= l.right - 1);
    }),
    texteAlle: texte.map(x => x.t),
  };
});

for (const [name, opt] of [
  ['PC', { viewport: { width: 1440, height: 900 } }],
  ['Handy', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  test(`Zeichnung ${name}: Schrift lesbar, keine Überlappung, Legende darunter, Werte sichtbar`, async () => {
    const { seite, fehler, kontext } = await appOeffnen(browser, url, opt);
    await fall(seite);
    const m = await messen(seite);
    assert.ok(m.kleinste >= 10, `kleinste Schrift ${m.kleinste.toFixed(1)} px`);
    assert.deepEqual(m.ueber, [], 'Beschriftungen überlappen sich');
    assert.deepEqual(m.abgeschnitten, [], 'Beschriftung abgeschnitten');
    assert.equal(m.legendeUnter, true, 'Legende unter der Zeichnung');
    assert.equal(m.werteSichtbar, true, 'Tabellenwerte nicht hinter der Bezeichnungsspalte');
    assert.deepEqual(fehler, []);
    await kontext.close();
  });
}

test('Zeichnung: T₃ = T₂ nicht doppelt; Mastangaben, Hänger, Massstab, klare Tabellenzeilen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 1440, height: 900 } });
  await fall(seite);
  const m = await messen(seite);
  const r = await seite.evaluate(() => {
    const svg = document.querySelector('#scale-svg-container svg');
    const haenger = [...svg.querySelectorAll('line')].filter(l => l.getAttribute('opacity') === '0.55').length;
    return { haenger, L: calcState.L };
  });
  assert.ok(m.texteAlle.includes('101 · km 012.300'), 'Mastname und KM über dem Mast');
  assert.match(m.legende, /deckungsgleich mit T₂/);
  assert.match(m.legende, /Massstab H 1:\d+ · V 1:\d+ \(Überhöhung 10×\)/);
  assert.ok(!m.tabelle.some(l => /T₃/.test(l)), 'keine doppelten T₃-Zeilen');
  assert.ok(m.tabelle.includes('T₂ über SOK [m]'));
  assert.equal(r.haenger, Math.ceil(r.L / 5) - 1, 'Hänger höchstens alle 5 m');
  // T₃ verschieden von T₂: Zeilen und Kurve erscheinen wieder
  await seite.evaluate(() => { const e = document.getElementById('temp3'); e.value = '-20'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); berechnen(); });
  const m2 = await messen(seite);
  assert.ok(m2.tabelle.some(l => /T₃/.test(l)));
  assert.doesNotMatch(m2.legende, /deckungsgleich/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Zeichnung: Lotlinie endet an der SOK bzw. am Ausschnitt; Mindestabstand als Band', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 1440, height: 900 } });
  await fall(seite, { extent: 'sok', vex: 5 });
  const r = await seite.evaluate(() => {
    setMindestabstand('0.5');
    const svg = document.querySelector('#scale-svg-container svg');
    // Lotlinie des Messpunkts: gestrichelt, senkrecht bei M1
    const lote = [...svg.querySelectorAll('line[stroke-dasharray]')].filter(l => l.getAttribute('x1') === l.getAttribute('x2') && +l.getAttribute('opacity') === 0.45);
    // Masten: senkrechte, durchgezogene Linien bis zur SOK
    const masten = [...svg.querySelectorAll('line')].filter(l => !l.getAttribute('stroke-dasharray') && !l.getAttribute('opacity')
      && l.getAttribute('x1') === l.getAttribute('x2') && Math.abs(+l.getAttribute('y2') - +l.getAttribute('y1')) > 20);
    const unten = Math.max(...masten.map(l => Math.max(+l.getAttribute('y1'), +l.getAttribute('y2'))));
    // Schraffur: Pfade mit Muster — Höhe (Ausdehnung) deutlich kleiner als bis zur SOK
    const band = [...svg.querySelectorAll('path[fill^="url(#mcp"]')].map(p => p.getBBox().height);
    return { lotEnde: lote.map(l => Math.max(+l.getAttribute('y1'), +l.getAttribute('y2'))), unten, band, feldHoehe: unten - svg.querySelector('path').getBBox().y };
  });
  assert.ok(r.lotEnde.length >= 1);
  for (const y of r.lotEnde) assert.ok(y <= r.unten + 0.5, `Lotlinie ragt unter die SOK (${y} > ${r.unten})`);
  assert.ok(r.band.length >= 1 && r.band.every(h => h < r.feldHoehe * 0.6), 'Mindestabstand als schmales Band');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Zeichnungs-PDF «Kettenwerk»: Fahrdraht über dem Datenstreifen, Massstäbe überlappen nicht', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 1440, height: 900 } });
  await fall(seite);
  const html = await seite.evaluate(() => {
    let h = '';
    window.open = () => ({ document: { write: x => { h += x; }, open() {}, close() {} }, focus() {}, print() {}, addEventListener() {} });
    pdfExportDrawing();
    return h;
  });
  const p2 = await kontext.newPage();
  await p2.setContent(html.replace(/window\.print\(\)/g, ''), { waitUntil: 'load' });
  const r = await p2.evaluate(() => {
    const svg = document.querySelector('svg');
    const rects = [...svg.querySelectorAll('rect')].filter(r => r.getAttribute('fill') === '#f7f7f7');
    const streifenOben = Math.min(...rects.map(r => +r.getAttribute('y')));
    // Fahrdraht: dünner grauer Pfad — unterste Stelle
    const pfade = [...svg.querySelectorAll('path')].filter(p => !p.getAttribute('stroke-dasharray') && p.getAttribute('fill') === 'none');
    const unterste = Math.max(...pfade.map(p => { const b = p.getBBox(); return b.y + b.height; }));
    const masstab = [...svg.querySelectorAll('text')].filter(t => /^(Massstab|Massstab) [HV]/.test(t.textContent.trim())).map(t => t.getBBox());
    const ueber = masstab.length === 2 && masstab[0].x + masstab[0].width > masstab[1].x && masstab[1].x + masstab[1].width > masstab[0].x;
    return { streifenOben, unterste, anzahl: masstab.length, ueber };
  });
  assert.ok(r.unterste < r.streifenOben, `Zeichnung (${r.unterste.toFixed(1)}) reicht in den Datenstreifen (${r.streifenOben.toFixed(1)})`);
  assert.equal(r.anzahl, 2);
  assert.equal(r.ueber, false, 'Massstab H und V überlappen');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Start ohne Betreiberdaten: Hinweis auf das Datenpaket einmal je Gerät, Hinweiszeile bleibt', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { bdHinweis: true });
  await seite.waitForFunction(() => document.getElementById('rueckfrage').classList.contains('open'), null, { timeout: 5000 });
  const text = await seite.evaluate(() => document.getElementById('rf-text').textContent);
  assert.match(text, /SharePoint in der Anlagedokumentation/);
  await seite.click('#rf-ok');
  assert.equal(await seite.evaluate(() => document.getElementById('bd-modal').classList.contains('open')), true, '«Betreiberdaten öffnen» öffnet das Fenster');
  assert.match(await seite.evaluate(() => document.getElementById('bd-hinweis').innerText), /SharePoint – Anlagedokumentation/);
  // Neu laden: kein zweites Mal
  await seite.reload({ waitUntil: 'load' });
  await seite.waitForTimeout(900);
  assert.equal(await seite.evaluate(() => document.getElementById('rueckfrage').classList.contains('open')), false);
  assert.deepEqual(fehler, []);
  await kontext.close();
  // Mit geladenen Daten: kein Hinweis
  const BD = require('../../betreiberdaten.js');
  const d = JSON.parse(JSON.stringify(BD.BEISPIEL_DATEN)); d.beispiel = false; d.titel = 'Testdaten';
  const b = await appOeffnen(browser, url, { bdHinweis: true, daten: d });
  await b.seite.waitForTimeout(900);
  assert.equal(await b.seite.evaluate(() => document.getElementById('rueckfrage').classList.contains('open')), false);
  await b.kontext.close();
});
