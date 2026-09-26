// 288 Rechenfälle durch die ganze App (Eingabefelder → Berechnung → Ergebnisanzeige)
// gegen eingefrorene Referenzwerte (rechenfaelle_referenz.json).
//
// Variiert werden: System (N-FL, R-FL, Einzelleiter), Höhen (gleich / ungleich),
// T2 (−20, −5, 40, 80 °C), Abnutzung (0 / max.), Eislast (0 / 15 N/m),
// T3-Vergleichskurve (aus, −20, 35 °C).
// Verglichen werden Durchhang, Zugkraft, Seillänge und Tiefpunkt jedes
// Zustands (Toleranz 1e-9 relativ) sowie der Text des Ergebnisbereichs.
//
// Ändert sich ein Ergebnis gewollt (z. B. neue SBB-Vorgabe), Referenz neu
// erzeugen und die Änderung im Commit begründen:
//   REFERENZ_NEU=1 npm run test:browser
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { serverStarten, browserStarten, appOeffnen } = require('./hilfe.js');

const REFERENZ = path.join(__dirname, 'rechenfaelle_referenz.json');

const FAELLE = [];
for (const sys of ['nfl', 'rfl', 'el'])
  for (const [h1, h2] of [[7, 7], [6.5, 7.8]])
    for (const T2 of [-20, -5, 40, 80])
      for (const abnutzung of [0, 30])
        for (const zl of [0, 15])
          for (const t3 of [null, -20, 35]) FAELLE.push({ sys, h1, h2, T2, abnutzung, zl, t3 });

let server, url, browser;
before(async () => { ({ server, url } = await serverStarten()); browser = await browserStarten(); });
after(async () => { await browser?.close(); server?.close(); });

async function allesRechnen() {
  const { seite, fehler, kontext } = await appOeffnen(browser, url, { viewport: { width: 1440, height: 900 } });
  const ergebnisse = await seite.evaluate(faelle => {
    const aus = [];
    for (const f of faelle) {
      setSysMode(f.sys);
      if (f.sys !== 'rfl') setWear(f.abnutzung ? currentWearMax : 0);
      document.getElementById('h1').value = f.h1;
      document.getElementById('h2').value = f.h2;
      document.getElementById('temp2').value = f.T2;
      updateEislastVisibility();
      document.getElementById('zl-eis').value = f.zl;
      if ((f.t3 !== null) !== showT3 && f.sys !== 'rfl') toggleT3();
      if (f.t3 !== null) document.getElementById('temp3').value = f.t3;
      berechnen();
      const c = calcState;
      if (!c) { aus.push(null); continue; }
      const werte = o => o ? [o.sag, o.H, o.s, o.x_low, o.y_low] : null;
      aus.push({
        c1: werte(c.c1), c2: werte(c.c2), c3: werte(c.c3), vem: werte(c.c2_vem), H_Ts: c.H_Ts,
        // «Max. Seilkraft» hängt von der Anzeige-Rundung einer Zwischengrösse ab — nicht vergleichen
        text: document.getElementById('results').innerText.replace(/Max\. Seilkraft[^\n]*\n?[^\n]*/g, ''),
      });
    }
    return aus;
  }, FAELLE);
  await kontext.close();
  return { ergebnisse, fehler };
}

const gleich = (a, b) => a === b || (Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)));

function vergleiche(ist, soll, pfad = '') {
  if (Array.isArray(soll)) {
    assert.ok(Array.isArray(ist), `${pfad}: Liste erwartet`);
    assert.equal(ist.length, soll.length, `${pfad}: Länge`);
    soll.forEach((s, i) => vergleiche(ist[i], s, `${pfad}[${i}]`));
  } else if (soll && typeof soll === 'object') {
    assert.ok(ist && typeof ist === 'object', `${pfad}: Objekt erwartet, ist ${ist}`);
    for (const k of Object.keys(soll)) vergleiche(ist[k], soll[k], `${pfad}.${k}`);
  } else if (typeof soll === 'number') {
    assert.ok(gleich(ist, soll), `${pfad}: ist ${ist}, Referenz ${soll}`);
  } else {
    assert.equal(ist, soll, pfad);
  }
}

test('288 Rechenfälle entsprechen den Referenzwerten', async () => {
  const { ergebnisse, fehler } = await allesRechnen();
  assert.deepEqual(fehler, []);
  if (process.env.REFERENZ_NEU === '1' || !fs.existsSync(REFERENZ)) {
    fs.writeFileSync(REFERENZ, JSON.stringify({ faelle: FAELLE, ergebnisse }, null, 1) + '\n');
    console.log(`Referenz geschrieben: ${path.basename(REFERENZ)} (${FAELLE.length} Fälle)`);
    return;
  }
  const ref = JSON.parse(fs.readFileSync(REFERENZ, 'utf8'));
  assert.deepEqual(ref.faelle, FAELLE, 'Fallliste geändert — Referenz neu erzeugen');
  const abweichend = [];
  FAELLE.forEach((f, i) => {
    try { vergleiche(ergebnisse[i], ref.ergebnisse[i], `Fall ${i}`); }
    catch (e) { abweichend.push(`${JSON.stringify(f)} → ${e.message.split('\n')[0]}`); }
  });
  assert.equal(abweichend.length, 0,
    `${abweichend.length} von ${FAELLE.length} Fällen weichen ab:\n` + abweichend.slice(0, 10).join('\n'));
});
