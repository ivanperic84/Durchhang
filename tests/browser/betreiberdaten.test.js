// Betreiberdaten im Browser: Start mit Beispielwerten, Laden (JSON und Excel),
// fehlerhafte Datei, Speichern, zurück zu Beispielwerten, Projekt mit
// unbekanntem Kettenwerk, Vermerk im PDF. Nur neutrale Testdaten.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { serverStarten, browserStarten, appOeffnen } = require('./hilfe.js');
const BD = require('../../betreiberdaten.js');
const { xlsxSchreiben, xlsxLesen } = require('../../xlsx.js');

let server, url, browser;
before(async () => { ({ server, url } = await serverStarten()); browser = await browserStarten(); });
after(async () => { await browser?.close(); server?.close(); });

// Testdaten: Beispielwerte, aber als «echte» Betreiberdaten mit eigenem Titel und Stand
function testdaten() {
  const d = JSON.parse(JSON.stringify(BD.BEISPIEL_DATEN));
  Object.assign(d, { titel: 'Testdaten', betreiber: 'Test', stand: '2025-01-15', beispiel: false });
  d.quellen.reglage = 'Test-Reglage 1';
  d.kettenwerke[0].schluessel = 'test_nfl_a';
  d.kettenwerke[0].bezeichnung = 'Test N-FL A';
  d.kettenwerke[0].normal.werte_ub = d.kettenwerke[0].normal.werte_ub.map(v => v + 100);
  d.kettenwerke[0].normal.H_Ts = 4300;
  return d;
}

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

const sichtbar = (seite, id) => seite.evaluate(i => { const e = document.getElementById(i); return !!e && e.getClientRects().length > 0; }, id);

test('Start ohne Datei: Beispielwerte mit Hinweis, Reglage-Fenster und PDF nennen sie', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  assert.equal(await sichtbar(seite, 'bd-hinweis'), true, 'Hinweis «Beispielwerte – keine Vorgabe»');
  const r = await seite.evaluate(() => {
    openReglageModal();
    const zeilen = document.querySelectorAll('#rgl-nfl-zeilen tr').length + document.querySelectorAll('#rgl-rfl-zeilen tr').length;
    const quelle = document.getElementById('rgl-quelle').textContent;
    closeReglageModal();
    window.__fenster.length = 0; pdfExport();
    return { zeilen, anzahl: Object.keys(KETTENWERK_PRESETS).length, quelle, pdf: window.__fenster[0]?.html || '',
             auswahl: [...document.querySelectorAll('#preset-select option')].map(o => o.value).filter(Boolean) };
  });
  assert.equal(r.zeilen, r.anzahl, 'Reglage-Fenster: eine Zeile je Kettenwerk der Daten');
  assert.match(r.quelle, /Beispielwerte – keine Vorgabe/);
  assert.match(r.pdf, /Betreiberdaten: Beispielwerte – keine Vorgabe/);
  assert.ok(r.auswahl.every(k => k.startsWith('bsp_')), 'nur Beispiel-Kettenwerke');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('JSON laden: geprüft, im Gerät gespeichert, angewendet; bleibt nach Neuladen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await fensterAbfangen(seite);
  await seite.evaluate(() => openBetreiberdaten());
  await seite.setInputFiles('#bd-datei', { name: 'testdaten.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(testdaten())) });
  await seite.waitForFunction(() => betreiberDaten.titel === 'Testdaten');
  const r = await seite.evaluate(() => {
    window.__fenster.length = 0; pdfExport();
    return { name: document.getElementById('bd-name').textContent, inhalt: document.getElementById('bd-inhalt').textContent,
      quellen: document.getElementById('bd-quellen').textContent,
      gespeichert: JSON.parse(localStorage.getItem('dh_betreiberdaten')).titel,
      auswahl: document.getElementById('preset-select').value, H: document.getElementById('tension').value,
      pdf: window.__fenster[0]?.html || '' };
  });
  assert.equal(r.name, 'Testdaten, Stand 15.01.2025');
  assert.match(r.inhalt, /2 Leiter mit Reglagetabelle · 4 Kettenwerke/);
  assert.equal(r.quellen, 'Test-Reglage 1');
  assert.equal(r.gespeichert, 'Testdaten');
  assert.equal(r.auswahl, 'test_nfl_a', 'erstes Kettenwerk der neuen Daten gewählt');
  assert.equal(r.H, '1600', 'Ts unbelastet bei T₁ = 10 °C aus den neuen Daten');
  assert.match(r.pdf, /Betreiberdaten: Testdaten, Stand 15\.01\.2025/);
  assert.equal(await sichtbar(seite, 'bd-hinweis'), false, 'kein Beispiel-Hinweis mehr');
  assert.equal(await sichtbar(seite, 'bd-entfernen'), true);
  // Neu laden: Daten bleiben im Gerät
  await seite.reload({ waitUntil: 'load' });
  await seite.waitForFunction(() => typeof calcState !== 'undefined' && calcState);
  assert.equal(await seite.evaluate(() => betreiberdatenText()), 'Testdaten, Stand 15.01.2025');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Excel laden; fehlerhafte Datei wird abgewiesen und ändert nichts', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.evaluate(() => openBetreiberdaten());
  // Fehlerhaft: Werte-Reihe zu kurz, unbekannter Leiter
  const falsch = testdaten();
  falsch.kettenwerke[0].normal.werte_ub = [1, 2, 3];
  falsch.einzelleiter.leiter.gibtsnicht = { varianten: [{ werte: null }] };
  await seite.setInputFiles('#bd-datei', { name: 'falsch.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(falsch)) });
  await seite.waitForFunction(() => document.getElementById('bd-fehler').getClientRects().length > 0);
  const abgewiesen = await seite.evaluate(() => ({ text: document.getElementById('bd-fehler').innerText,
    gespeichert: localStorage.getItem('dh_betreiberdaten'), beispiel: betreiberDaten.beispiel }));
  assert.match(abgewiesen.text, /Datei nicht übernommen/);
  assert.match(abgewiesen.text, /13 Werte/);
  assert.match(abgewiesen.text, /«gibtsnicht» ist unbekannt/);
  assert.equal(abgewiesen.gespeichert, null);
  assert.equal(abgewiesen.beispiel, true);
  // Keine gültige Datei
  await seite.setInputFiles('#bd-datei', { name: 'kaputt.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('PK kaputt') });
  await seite.waitForFunction(() => /nicht gelesen/.test(document.getElementById('bd-fehler').innerText));
  // Excel-Mappe
  const daten = BD.bdPruefen(testdaten()).daten;
  const xlsx = Buffer.from(xlsxSchreiben(BD.bdZuBlaettern(daten)));
  await seite.setInputFiles('#bd-datei', { name: 'testdaten.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx });
  await seite.waitForFunction(() => betreiberDaten.titel === 'Testdaten');
  const r = await seite.evaluate(() => ({ fehlerSichtbar: document.getElementById('bd-fehler').getClientRects().length > 0,
    preset: KETTENWERK_PRESETS.test_nfl_a?.H_Ts }));
  assert.deepEqual(r, { fehlerSichtbar: false, preset: 4300 });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Speichern als Excel und JSON; zurück zu Beispielwerten', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { daten: testdaten() });
  await seite.evaluate(() => openBetreiberdaten());
  const [dlX] = await Promise.all([seite.waitForEvent('download'), seite.click('button[onclick="betreiberdatenSpeichern(\'xlsx\')"]')]);
  const [dlJ] = await Promise.all([seite.waitForEvent('download'), seite.click('button[onclick="betreiberdatenSpeichern(\'json\')"]')]);
  assert.equal(dlX.suggestedFilename(), 'Testdaten-2025-01-15.xlsx');
  assert.equal(dlJ.suggestedFilename(), 'Testdaten-2025-01-15.json');
  const ausExcel = BD.bdPruefen(BD.bdAusBlaettern(await xlsxLesen(fs.readFileSync(await dlX.path())))).daten;
  const ausJson = BD.bdPruefen(JSON.parse(fs.readFileSync(await dlJ.path(), 'utf8'))).daten;
  const soll = BD.bdPruefen(testdaten()).daten;
  assert.deepEqual(ausExcel, soll);
  assert.deepEqual(ausJson, soll);
  // Zurück zu Beispielwerten (mit Rückfrage)
  await seite.click('#bd-entfernen');
  await seite.click('#rf-ok');
  await seite.waitForFunction(() => betreiberDaten.beispiel === true);
  const r = await seite.evaluate(() => ({ gespeichert: localStorage.getItem('dh_betreiberdaten'),
    name: document.getElementById('bd-name').textContent, auswahl: document.getElementById('preset-select').value }));
  assert.deepEqual(r, { gespeichert: null, name: 'Beispielwerte – keine Vorgabe', auswahl: 'bsp_nfl_stcu50_cu107' });
  assert.equal(await sichtbar(seite, 'bd-hinweis'), true);
  // Vorlage: mit Beispielwerten heisst die Datei «betreiberdaten-vorlage»
  const [dlV] = await Promise.all([seite.waitForEvent('download'), seite.click('button[onclick="betreiberdatenSpeichern(\'xlsx\')"]')]);
  assert.equal(dlV.suggestedFilename(), 'betreiberdaten-vorlage.xlsx');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Projekt mit Kettenwerk, das in den aktiven Daten fehlt: Werte bleiben, Hinweis, freie Eingabe', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { daten: testdaten() });
  const r = await seite.evaluate(() => {
    const st = JSON.parse(JSON.stringify(getProjectState()));
    // wie ein Projekt, das mit anderen Betreiberdaten gespeichert wurde
    st.fields['preset-select'] = 'anderes_kettenwerk';
    st.fields['material-ts'] = 'stcu92'; st.fields['material-fd'] = 'cu150';
    st.fields['tension'] = '2345'; st.fields['tension-fd'] = '10500'; st.fields['sh'] = '1.8';
    setProjectState(st);
    const sel = document.getElementById('preset-select');
    return { wahl: sel.value, text: sel.options[sel.selectedIndex].textContent,
      ts: document.getElementById('material-ts').value, fd: document.getElementById('material-fd').value,
      H: document.getElementById('tension').value, Hfd: document.getElementById('tension-fd').value,
      sh: document.getElementById('sh').value, frei: !document.getElementById('tension').readOnly,
      meldung: document.getElementById('meldungen').innerText, rechnet: !!calcState?.c2 };
  });
  assert.equal(r.wahl, 'anderes_kettenwerk');
  assert.equal(r.text, 'anderes_kettenwerk (aus Projekt)');
  assert.deepEqual([r.ts, r.fd, r.H, r.Hfd, r.sh], ['stcu92', 'cu150', '2345', '10500', '1.8']);
  assert.equal(r.frei, true, 'ohne Reglagebindung: Zugkraft frei');
  assert.match(r.meldung, /«anderes_kettenwerk» ist in den aktiven Betreiberdaten nicht vorhanden/);
  assert.equal(r.rechnet, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Fenster Betreiberdaten: Menü, drei Sprachen ohne rohe Schlüssel, Esc schliesst', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const texte = await seite.evaluate(() => {
    document.getElementById('mehr-btn')?.click();
    document.getElementById('bd-menu-btn').click();
    const aus = {};
    for (const l of ['fr', 'it', 'de']) { setLang(l); _bdDialogFuellen(); aus[l] = document.getElementById('bd-modal').innerText; }
    return aus;
  });
  for (const [l, text] of Object.entries(texte)) {
    assert.doesNotMatch(text, /\bbd\.[a-z.]+/, `${l}: roher Schlüssel`);
    assert.ok(text.length > 200, `${l}: Inhalt vorhanden`);
  }
  assert.match(texte.fr, /Données de l’exploitant/);
  assert.match(texte.it, /Dati del gestore/);
  await seite.keyboard.press('Escape');
  assert.equal(await seite.evaluate(() => document.getElementById('bd-modal').classList.contains('open')), false);
  assert.deepEqual(fehler, []);
  await kontext.close();
});
