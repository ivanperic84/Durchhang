// Abspannabschnitt und Abstandsprüfung im Browser:
// CSV-Import → Felder → Feld öffnen (gleiche Werte) → Hindernis oberhalb mit
// Lastfällen → Export des ganzen Abschnitts → Speichern/Laden.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { serverStarten, browserStarten, appOeffnen } = require('./hilfe.js');

let server, url, browser;
before(async () => { ({ server, url } = await serverStarten()); browser = await browserStarten(); });
after(async () => { await browser?.close(); server?.close(); });

async function abschnittLaden(seite) {
  await seite.click('#view-seg-abschnitt');
  const [wahl] = await Promise.all([seite.waitForEvent('filechooser'), seite.evaluate(() => abschnittCsvWaehlen())]);
  await wahl.setFiles(path.join(__dirname, 'masten_beispiel.csv'));
  await seite.waitForFunction(() => abschnitt.masten.length === 4);
}

test('CSV-Import: 4 Masten, 3 Felder mit Längen aus Koordinaten', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await abschnittLaden(seite);
  const r = await seite.evaluate(() => {
    const e = abschnittRechnen();
    return { L: e.felder.map(f => f.L), quelle: e.felder.map(f => f.quelle), H: e.felder.map(f => f.z.c2.H),
             zeilen: document.querySelectorAll('.abs-erg tbody tr').length, profil: !!document.querySelector('.abs-svg') };
  });
  assert.deepEqual(r.L, [44.181, 46.39, 38.471]);
  assert.deepEqual(r.quelle, ['koord', 'koord', 'koord']);
  assert.equal(new Set(r.H).size, 1, 'N-FL ausgleichend: gleiche Zugkraft aus Lm in allen Feldern');
  assert.equal(r.zeilen, 3);
  assert.equal(r.profil, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Feld öffnen: Einzelfeld rechnet exakt wie die Abschnittsübersicht', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await abschnittLaden(seite);
  for (const i of [0, 1, 2]) {
    const r = await seite.evaluate(i => {
      const f = abschnittRechnen().felder[i];
      abschnittFeldOeffnen(i);
      const c = calcState.c2_vem || calcState.c2;
      return { ab: [f.oben.sag, f.z.c2.H, f.L], ein: [c.sag, calcState.c2.H, calcState.L],
               sok: getSokMumLeft(), soll: f.a.z };
    }, i);
    assert.deepEqual(r.ein, r.ab, `Feld ${i + 1}`);
    assert.ok(Math.abs(r.sok - r.soll) < 1e-9, 'SOK = Z');
  }
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('H-Punkte: ungünstigster Lastfall, Grenzwert, Lastfall-Optionen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await abschnittLaden(seite);
  const r = await seite.evaluate(() => {
    abschnittFeldOeffnen(1);
    _mpSetzen({ x: [20, 10, null, null], h: [508.3, 508.3, null, null], verbinden: true });
    renderObstacleList();
    setMindestabstand('0.5'); berechnen();
    const vorgabe = _nachweis[0];
    setMindestabstand('2'); berechnen();
    const streng = _nachweis[0].ok;
    // Nur +40 °C, ohne Eis/Abnutzung → Leiter tiefer → grösserer Abstand
    lastfallEinst = { nfl: { temperaturen: [40], eis: false, abnutzung: false } };
    berechnen();
    const warm = _nachweis[0].best;
    return { a: vorgabe.best.abstand, ok: vorgabe.ok, fall: vorgabe.best.fall, streng, warm: warm.abstand, warmT: warm.fall.T,
             jePunkt: vorgabe.jePunkt.map(p => p.m), text: document.getElementById('hind-erg-H').textContent };
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.fall, { T: -20, zl: 0, abgenutzt: true }, 'kalt und abgenutzt = höchste Lage');
  assert.equal(r.streng, false, 'Mindestabstand 2 m nicht erfüllt');
  assert.ok(r.warm > r.a);
  assert.equal(r.warmT, 40);
  assert.deepEqual(r.jePunkt, [2, 1], 'Abstand je H-Punkt, nach x sortiert');
  assert.match(r.text, /a = \d\.\d\d m.*H1 \d\.\d\d m/);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Messpunkte und H-Punkte je Feld: Feldwechsel, Abschnittstabelle', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await abschnittLaden(seite);
  const r = await seite.evaluate(() => {
    abschnittFeldOeffnen(0);
    _mpSetzen({ x: [12, null, null, null], h: [509, null, null, null], lock: [true, false, false, false] });
    abschnittFeldOeffnen(1);
    const feld1 = _mpLive();
    abschnittFeldOeffnen(0);
    const zurueck = _mpLive();
    const tabelle = abschnittRechnen().felder.map(f => f.nachweis.length);
    return { feld1, zurueck, tabelle };
  });
  assert.deepEqual(r.feld1.x, [null, null, null, null], 'neues Feld ohne Messpunkte');
  assert.deepEqual(r.zurueck.x.slice(0, 1), [12]);
  assert.deepEqual(r.zurueck.h.slice(0, 1), [509]);
  assert.equal(r.zurueck.lock[0], true, 'Schloss bleibt je Feld erhalten');
  assert.deepEqual(r.tabelle, [1, 0, 0], 'Abstandsprüfung nur im Feld mit H-Punkten');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Export ganzer Abschnitt (IFC, DXF) und Speichern/Laden', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await abschnittLaden(seite);
  const laden = async fn => {
    const [dl] = await Promise.all([seite.waitForEvent('download'), seite.evaluate(fn)]);
    const teile = []; for await (const t of await dl.createReadStream()) teile.push(t);
    return Buffer.concat(teile).toString('utf8');
  };
  const ifc = await laden(() => abschnittExport('ifc'));
  assert.equal((ifc.match(/=IFCCABLESEGMENT\([^;]*,'Tragseil',/g) || []).length, 3);
  assert.match(ifc, /IFCMAPCONVERSION\(#\d+,#\d+,2600000\.,1200000\./);
  const dxf = await laden(() => abschnittExport('dxf'));
  assert.match(dxf, /\n11\n2600128\.0000\n21\n1200016\.0000\n/);   // letzter Mast erreicht (Linienende)
  const r = await seite.evaluate(() => {
    abschnitt.mp[2] = _mpNormieren({ x: [1], h: [520], verbinden: false });
    const st = JSON.parse(JSON.stringify(getProjectState()));
    abschnitt = { masten: [], offen: null, mp: {} };
    setProjectState(st);
    return { masten: abschnitt.masten.length, mp2: abschnitt.mp[2] };
  });
  assert.deepEqual(r, { masten: 4, mp2: { x: [1, null, null, null], h: [520, null, null, null], lock: [false, false, false, false], verbinden: false } });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('H-Punkte bei M1–M4 bedienbar, Schloss schützt vor Verschieben und Reset', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.evaluate(() => { document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput(); });
  await seite.fill('#probe-x1', '10');
  await seite.fill('#probe-h1', '509.5');
  await seite.fill('#probe-x2', '30');
  await seite.waitForTimeout(400);
  const vorher = await seite.evaluate(() => ({ h: probeHWerte[0], text: document.getElementById('hind-erg-H').textContent }));
  await seite.click('#probe-lock-1');
  const r = await seite.evaluate(() => {
    const gesperrt = document.getElementById('probe-x1').readOnly && document.getElementById('probe-h1').readOnly;
    setProbeH(1, '400');          // gesperrt → ohne Wirkung
    clearMesspunkte();            // Reset lässt gesperrte Punkte stehen
    return { gesperrt, x: _probeXs(), h: probeHWerte[0], druck: document.getElementById('probe-lock-1').getAttribute('aria-pressed') };
  });
  assert.equal(vorher.h, 509.5);
  assert.match(vorher.text, /a = /);
  assert.equal(r.gesperrt, true);
  assert.deepEqual(r.x, [10, null, null, null]);
  assert.equal(r.h, 509.5);
  assert.equal(r.druck, 'true');
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('H-Punkte verbunden / einzeln; ältere Projekte (H-Felder, Hindernisliste) werden übernommen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput();
    setMindestabstand('0.5');
    // schräg ansteigend, ungeordnet eingegeben
    _mpSetzen({ x: [30, 5, null, null], h: [510, 507.3, null, null], verbinden: true });
    berechnen();
    const schraeg = _nachweis[0].best;
    setHVerbinden(false);
    const einzeln = _nachweis[0].best;
    // Projekt mit alten H-Punkten (Stand vor v3.9.3) laden
    const st = JSON.parse(JSON.stringify(getProjectState()));
    delete st.messpunkte;
    st.fields['probe-x1'] = '22.5'; st.fields['probe-h1'] = '508.9';
    st.fields['min-clearance-input'] = '0.4'; delete st.fields['hind-min'];
    setProjectState(st);
    const alteH = { x: probeX1, h: probeHWerte[0], a: minClearance };
    // Projekt mit Hindernisliste (v3.9.3–v3.11): Punkte → M1…, mehr als 4 → die 4 tiefsten
    const st2 = JSON.parse(JSON.stringify(getProjectState()));
    delete st2.messpunkte;
    st2.hindernisse = [{ name: 'Brücke', feld: 0, verbinden: true,
      punkte: [{ x: 8, h: 509 }, { x: 3, h: 510 }, { x: 12, h: 508.5 }, { x: 16, h: 508.7 }, { x: 20, h: 511 }] }];
    setProjectState(st2);
    const liste = _mpLive();
    const zeichnung = (setCanvasView('zeichnung'), document.getElementById('scale-svg-container').innerHTML.includes('a = '));
    return { schraeg, einzeln, alteH, liste, zeichnung };
  });
  // Das Seil hängt durch, die Unterkante ist zwischen den Punkten gerade: der kleinste
  // Abstand liegt daher immer an einem Punkt (oder am Feldrand) — verbunden = einzeln.
  assert.ok([5, 30].includes(r.schraeg.x));
  assert.ok(Math.abs(r.schraeg.abstand - r.einzeln.abstand) < 1e-9);
  assert.deepEqual(r.alteH, { x: 22.5, h: 508.9, a: 0.4 });
  assert.deepEqual(r.liste.x, [3, 8, 12, 16]);
  assert.deepEqual(r.liste.h, [510, 509, 508.5, 508.7]);
  assert.equal(r.liste.verbinden, true);
  assert.equal(r.zeichnung, true, 'H-Punkte in der Zeichnung beschriftet');
  assert.deepEqual(fehler, []);
  await kontext.close();
});
