// Zugänglichkeit für Gelegenheitsnutzer (v6.5):
// A «Gerechnet mit» (Bildschirm + PDF), B Vorgabewerte «ungeprüft», C Beispielwerte vor dem PDF.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { serverStarten, browserStarten, appOeffnen } = require('./hilfe.js');
const BD = require('../../betreiberdaten.js');

let server, url, browser;
before(async () => { ({ server, url } = await serverStarten()); browser = await browserStarten(); });
after(async () => { await browser?.close(); server?.close(); });

const testdaten = () => { const d = JSON.parse(JSON.stringify(BD.BEISPIEL_DATEN)); return Object.assign(d, { titel: 'Testdaten', stand: '2025-01-15', beispiel: false }); };
async function fensterAbfangen(seite) {
  await seite.evaluate(() => {
    window.__fenster = [];
    window.open = () => { const f = { html: '', document: { write(h) { f.html += h; }, open() {}, close() {} }, focus() {}, print() {}, addEventListener() {} }; window.__fenster.push(f); return f; };
  });
}
const annahmen = seite => seite.evaluate(() => [...document.querySelectorAll('#annahmen .ann')].map(e => ({ txt: e.textContent, art: e.classList.contains('ann-abw') ? 'abw' : e.classList.contains('ann-krit') ? 'krit' : '' })));

test('A: «Gerechnet mit» zeigt die Annahmen; Abweichungen und Beispielwerte markiert; auch im PDF', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  let a = await annahmen(seite);
  assert.ok(a.some(x => /^N-FL · /.test(x.txt)), 'System und Kettenwerk');
  assert.ok(a.some(x => x.txt === 'Ausgleichend' && !x.art));
  assert.ok(a.some(x => /^L = 45/.test(x.txt)));
  assert.ok(a.some(x => /Montage T₁ = \+10 °C/.test(x.txt)));
  assert.ok(a.some(x => /Fahrdraht neu/.test(x.txt)));
  assert.ok(a.some(x => /Beispielwerte – keine Vorgabe/.test(x.txt) && x.art === 'krit'), 'Beispielwerte rot');
  // Abweichungen: Starr und abgenutzter Fahrdraht
  await seite.evaluate(() => { setBerechnungsart('starr'); setWear(currentWearMax); berechnen(); });
  a = await annahmen(seite);
  assert.ok(a.some(x => x.txt === 'Starr' && x.art === 'abw'));
  assert.ok(a.some(x => /Fahrdraht abgenutzt \d+ %/.test(x.txt) && x.art === 'abw'));
  const pdf = await seite.evaluate(() => { pdfExport(); return window.__fenster.pop().html; });
  assert.match(pdf, /Gerechnet mit:/);
  assert.match(pdf, /color:#9a6b00">Starr</);
  const zpdf = await seite.evaluate(() => { setCanvasView('zeichnung'); pdfExportDrawing(); setCanvasView('diagramm'); return window.__fenster.pop().html; });
  assert.match(zpdf, /Gerechnet mit:<\/tspan>/);
  assert.deepEqual(fehler, []);
  await kontext.close();
  // Mit Betreiberdaten: Datenzeile normal
  const b = await appOeffnen(browser, url, { daten: testdaten() });
  a = await annahmen(b.seite);
  assert.ok(a.some(x => /Testdaten, Stand 15\.01\.2025/.test(x.txt) && !x.art));
  await b.kontext.close();
});

test('B: Vorgabewerte markiert, bis sie angetippt oder geändert werden; Projekte gelten als geprüft', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const markiert = () => seite.evaluate(() => ({ n: document.querySelectorAll('.ungeprueft').length, hw: !!document.getElementById('ungeprueft-hw').getClientRects().length, namen: ungeprueftNamen() }));
  let m = await markiert();
  assert.equal(m.n, 6, 'Spannweite, h1, h2, T1, T2, Kettenwerk');
  assert.equal(m.hw, true);
  // Antippen und verlassen = bestätigt
  await seite.focus('#span'); await seite.focus('#h1');
  m = await markiert();
  assert.ok(!m.namen.includes('Spannweite L'), JSON.stringify(m.namen));
  // Ändern = bestätigt
  await seite.fill('#temp2', '30'); await seite.locator('#temp2').dispatchEvent('change');
  m = await markiert();
  assert.ok(!m.namen.some(n => /T₂/.test(n)));
  // Projekt laden: alles geprüft
  await seite.evaluate(() => setProjectState(getProjectState()));
  m = await markiert();
  assert.deepEqual([m.n, m.hw], [0, false]);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('C: PDF mit Beispielwerten — Rückfrage, Vermerk auf jeder Seite; mit Daten und geprüften Eingaben ohne Rückfrage', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  const offen = () => seite.evaluate(() => document.getElementById('rueckfrage').classList.contains('open') ? document.getElementById('rf-text').textContent : '');
  // 1) Beispielwerte: Rückfrage, «Betreiberdaten laden» öffnet das Fenster
  await seite.click('#share-btn'); await seite.click('#share-item-calc-pdf');
  assert.match(await offen(), /keine Betreiberdaten geladen/);
  await seite.click('#rf-alt');
  assert.equal(await seite.evaluate(() => document.getElementById('bd-modal').classList.contains('open')), true);
  await seite.evaluate(() => closeBetreiberdaten());
  // 2) Trotzdem → zweite Rückfrage (ungeprüfte Felder) → Trotzdem → PDF mit Vermerk
  await seite.click('#share-btn'); await seite.click('#share-item-calc-pdf');
  await seite.click('#rf-ok');
  assert.match(await offen(), /noch Vorgabewerte/);
  await seite.click('#rf-ok');
  await seite.waitForFunction(() => window.__fenster.length > 0);
  const pdf = await seite.evaluate(() => window.__fenster.pop().html);
  assert.match(pdf, /class="pdf-wz"[^>]*>BEISPIELWERTE – KEIN NACHWEIS</);
  assert.deepEqual(fehler, []);
  await kontext.close();
  // 3) Mit Betreiberdaten und geprüften Eingaben: direkt, ohne Vermerk
  const b = await appOeffnen(browser, url, { daten: testdaten() });
  await fensterAbfangen(b.seite);
  await b.seite.evaluate(() => ungeprueftAlleBestaetigen());
  await b.seite.click('#share-btn'); await b.seite.click('#share-item-calc-pdf');
  await b.seite.waitForFunction(() => window.__fenster.length > 0);
  const r = await b.seite.evaluate(() => ({ rf: document.getElementById('rueckfrage').classList.contains('open'), html: window.__fenster.pop().html }));
  assert.equal(r.rf, false);
  assert.doesNotMatch(r.html, /pdf-wz/);
  await b.kontext.close();
});

test('Mindestabstand Pflicht: ohne a kein ✓ (⚠ «kein Nachweis»), mit a erfüllt/nicht erfüllt; Rückfrage vor dem PDF', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { daten: testdaten() });
  await fensterAbfangen(seite);
  await seite.evaluate(() => {
    const s = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
    s('sok-mum-left', '500'); onSokMumLeftInput();
    _mpSetzen({ x: [15, null, null, null], h: [508.6, null, null, null], verbinden: false });
    setMindestabstand(''); ungeprueftAlleBestaetigen(); berechnen();
  });
  const stand = () => seite.evaluate(() => {
    window.__fenster.length = 0; pdfExport();
    setCanvasView('zeichnung');
    const zeichnung = [...document.querySelectorAll('#scale-svg-container text')].map(t => t.textContent).find(t => /a = /.test(t)) || '';
    setCanvasView('diagramm');
    return { zeile: document.getElementById('hind-erg-H').textContent, klasse: document.getElementById('hind-erg-H').className,
      pflicht: document.getElementById('hind-min').classList.contains('feld-pflicht'),
      ann: [...document.querySelectorAll('#annahmen .ann')].map(e => e.textContent + (e.classList.contains('ann-krit') ? ' [krit]' : '')).join(' | '),
      pdf: window.__fenster.pop().html.replace(/<[^>]+>/g, ' '), zeichnung };
  });
  // ohne Mindestabstand
  let r = await stand();
  assert.match(r.zeile, /^⚠ Mindestabstand a fehlt – kein Nachweis/);
  assert.match(r.klasse, /offen/);
  assert.equal(r.pflicht, true, 'Feld Mindestabstand markiert');
  assert.match(r.ann, /Mindestabstand a fehlt – kein Nachweis \[krit\]/);
  assert.match(r.pdf, /⚠ Mindestabstand a fehlt – kein Nachweis/);
  assert.doesNotMatch(r.pdf, /Nachweis erfüllt/);
  assert.match(r.zeichnung, /⚠/); assert.doesNotMatch(r.zeichnung, /✓/);
  // Rückfrage vor dem PDF → «Mindestabstand eingeben» setzt den Fokus ins Feld
  await seite.click('#share-btn'); await seite.click('#share-item-calc-pdf');
  assert.match(await seite.evaluate(() => document.getElementById('rf-text').textContent), /kein Mindestabstand a/);
  await seite.click('#rf-alt');
  assert.equal(await seite.evaluate(() => document.activeElement?.id), 'hind-min');
  // mit Mindestabstand: erfüllt bzw. nicht erfüllt
  await seite.evaluate(() => setMindestabstand('0.5')); await seite.waitForTimeout(150);
  r = await stand();
  assert.match(r.zeile, /^✓ massgebend/);
  assert.equal(r.pflicht, false);
  assert.match(r.ann, /Mindestabstand a = 0\.50 m/);
  assert.match(r.pdf, /Nachweis erfüllt/);
  await seite.evaluate(() => setMindestabstand('5')); await seite.waitForTimeout(150);
  r = await stand();
  assert.match(r.zeile, /^✗ massgebend/);
  assert.match(r.pdf, /Nachweis nicht erfüllt/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});
