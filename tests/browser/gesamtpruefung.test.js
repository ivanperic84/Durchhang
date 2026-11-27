// Befunde der Gesamtprüfung (v6.4): Serienbericht, Abstandsnachweis im PDF,
// Übersetzung der PDFs, Abschnitt am Handy, harte Eingabegrenzen, Bezeichnungen.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { serverStarten, browserStarten, appOeffnen } = require('./hilfe.js');

let server, url, browser;
before(async () => { ({ server, url } = await serverStarten()); browser = await browserStarten(); });
after(async () => { await browser?.close(); server?.close(); });

async function fensterAbfangen(seite) {
  await seite.evaluate(() => {
    window.__fenster = [];
    window.open = () => { const f = { html: '', document: { write(h) { f.html += h; }, open() {}, close() {} }, focus() {}, print() {}, addEventListener() {} }; window.__fenster.push(f); return f; };
  });
}
async function fallMitHPunkt(seite) {
  await seite.evaluate(() => {
    const setze = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
    setze('span', '48'); setze('sok-mum-left', '500'); onSokMumLeftInput();
    _mpSetzen({ x: [15, null, null, null], h: [508.6, null, null, null], verbinden: false }); berechnen();
  });
}

test('Serienbericht: Knopf erzeugt ein PDF je Berechnung; aktuelle Eingabe bleibt erhalten', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  await seite.evaluate(l => setLang(l), 'fr');
  await seite.evaluate(() => {
    const st = getProjectState(), jetzt = new Date().toISOString();
    const meta = [{ id: 'g1', name: 'Gruppe', isGroup: true, parentId: null, createdAt: jetzt, updatedAt: jetzt }];
    for (const [id, L] of [['b1', 40], ['b2', 55]]) {
      const s = JSON.parse(JSON.stringify(st)); s.fields.span = String(L);
      meta.unshift({ id, name: 'Feld ' + id, isGroup: false, parentId: 'g1', createdAt: jetzt, updatedAt: jetzt });
      localStorage.setItem('dh_project_' + id, JSON.stringify(s));
    }
    localStorage.setItem('dh_projects_meta', JSON.stringify(meta));
    const e = document.getElementById('span'); e.value = '47.5'; berechnen();   // ungespeicherte Eingabe
    openProjectsModal(); toggleSelectCalc('b1'); toggleSelectCalc('b2');
  });
  await seite.click('#projects-modal button.proj-btn.bulk[onclick="pdfMitPruefung(\'serie\')"]');
  await seite.click('#rf-ok');   // Beispielwerte: «Trotzdem erstellen»
  await seite.waitForFunction(() => window.__fenster.length > 0, null, { timeout: 8000 });
  const r = await seite.evaluate(() => ({ html: window.__fenster[0].html, span: document.getElementById('span').value, L: calcState.L }));
  assert.equal((r.html.match(/class="pdf-section"/g) || []).length, 2, 'zwei Berechnungen');
  assert.match(r.html, /<title>Rapport de série — caténaire<\/title>/);
  assert.equal(r.span, '47.5', 'ungespeicherte Eingabe nach dem Export wieder da');
  assert.equal(r.L, 47.5);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Berechnungs-PDF: Abstandsnachweis der H-Punkte; Rechengang in FR ohne deutsche Sätze', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  await fallMitHPunkt(seite);
  const de = await seite.evaluate(() => { pdfExport(); return { html: window.__fenster.pop().html, n: _nachweis[0] }; });
  assert.match(de.html, /Abstandsnachweis H-Punkte/);
  assert.ok(de.html.includes(`a = <strong>${de.n.best.abstand.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m</strong>`) || de.html.includes(`${de.n.best.abstand.toFixed(2)} m</strong>`), 'massgebender Abstand');
  assert.match(de.html, /Geprüft in allen Lastfällen/);
  await seite.evaluate(() => setLang('fr'));
  const fr = await seite.evaluate(() => { pdfExport(); return window.__fenster.pop().html.replace(/<[^>]+>/g, ' '); });
  for (const satz of ['Die Hängerlast', 'Keine E·A-Angabe', 'grösster Abstand', 'Lösung mit Newton', 'Ts belastet bei 10', 'Tiefpunkt:', 'Umgeformt'])
    assert.ok(!fr.includes(satz), `deutsch im FR-PDF: ${satz}`);
  assert.match(fr, /Vérification des distances aux points H/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Abschnitt am Handy: Seite bleibt so breit wie der Bildschirm', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await seite.evaluate(async () => { abschnittAnsicht(); await abschnittBeispiel(); });
  await seite.waitForTimeout(500);
  assert.equal(await seite.evaluate(() => innerWidth), 390);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Unrealistische Eingaben: Spannweite über 1000 m wird als Fehler gesperrt, keine «NaN»', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    const e = document.getElementById('span'); e.value = '1e9'; berechnen();
    const box = [...document.querySelectorAll('.alert, #error-box, [id*=error]')].find(x => x.getClientRects().length && /1.000|1’000|1'000/.test(x.innerText));
    return { box: box?.innerText || '', nan: /NaN/.test(document.body.innerText), markiert: e.classList.contains('feld-fehler') };
  });
  assert.match(r.box, /unrealistisch/);
  assert.equal(r.nan, false);
  assert.equal(r.markiert, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Bezeichnungen für Bildschirmleser und Fenster als Dialog', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => ({
    felder: ['zl-eis', 'cm-wear', 'cm-sh', 'el-material-select'].map(id => {
      const e = document.getElementById(id), ids = (e.getAttribute('aria-labelledby') || '').split(' ').filter(Boolean);
      return ids.length && ids.every(i => document.getElementById(i)?.textContent.trim());
    }),
    fenster: ['projects-modal', 'custom-modal', 'el-material-modal', 'reglage-modal', 'bd-modal', 'lastfall-modal', 'rueckfrage']
      .map(id => { const m = document.getElementById(id); return m.getAttribute('role') === 'dialog' && !!document.getElementById(m.getAttribute('aria-labelledby')); }),
  }));
  assert.deepEqual(r.felder, [true, true, true, true]);
  assert.ok(r.fenster.every(Boolean), JSON.stringify(r.fenster));
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Entwicklermodus: Wasserzeichen im Diagramm (nicht im PDF); ohne Entwicklermodus keines', async () => {
  for (const dev of [true, false]) {
    const { seite, fehler, kontext } = await appOeffnen(browser, url, { dev });
    const r = await seite.evaluate(() => {
      const ctx = document.getElementById('main-canvas').getContext('2d');
      const texte = [], f = ctx.fillText.bind(ctx);
      ctx.fillText = (txt, ...a) => { texte.push((_diagrammDruck ? 'pdf:' : '') + txt); return f(txt, ...a); };
      berechnen();
      const bildschirm = texte.includes(t('dev.wasserzeichen'));
      texte.length = 0; diagrammBildHell();
      return { bildschirm, pdf: texte.includes('pdf:' + t('dev.wasserzeichen')) };
    });
    assert.deepEqual(r, { bildschirm: dev, pdf: false }, `dev=${dev}`);
    assert.deepEqual(fehler, []);
    await kontext.close();
  }
});

test('Stränge: System und Leiter sofort sichtbar (auch mit einem Mast), Hinweis zur Seitenleiste', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(async () => {
    abschnittAnsicht();
    abschnitt.masten = [{ name: '1', e: null, n: null, z: null, delta: null, h: null, km: '', L: null }];
    renderAbschnitt();
    const vorher = document.getElementById(`abs-str-sys-${abschnitt.aktiv}`).textContent;
    setSysMode('el'); await new Promise(r => setTimeout(r, 100));
    renderAbschnitt();
    return { vorher, nachher: document.getElementById(`abs-str-sys-${abschnitt.aktiv}`).textContent,
      hinweis: document.querySelector('.abs-str-hw')?.textContent || '' };
  });
  assert.match(r.vorher, /^N-FL · /);
  assert.match(r.nachher, /^Einzelleiter · /);
  assert.match(r.hinweis, /links in der Seitenleiste/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});
