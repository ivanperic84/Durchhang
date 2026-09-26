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
               sok: getSokMumLeft(), soll: f.a.z - f.a.delta };
    }, i);
    assert.deepEqual(r.ein, r.ab, `Feld ${i + 1}`);
    assert.ok(Math.abs(r.sok - r.soll) < 1e-9, 'SOK = Z − Δ');
  }
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Hindernis oberhalb: ungünstigster Lastfall, Grenzwert, Lastfall-Optionen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await abschnittLaden(seite);
  const r = await seite.evaluate(() => {
    abschnittFeldOeffnen(1);
    hindernisse = [{ id: _hindernisId++, name: 'Brücke', feld: 1, verbinden: true, punkte: [{ x: 20, h: 508.3 }, { x: 10, h: 508.3 }] }];
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
             text: document.getElementById('hind-erg-' + hindernisse[0].id).textContent };
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.fall, { T: -20, zl: 0, abgenutzt: true }, 'kalt und abgenutzt = höchste Lage');
  assert.equal(r.streng, false, 'Mindestabstand 2 m nicht erfüllt');
  assert.ok(r.warm > r.a);
  assert.equal(r.warmT, 40);
  assert.match(r.text, /a = \d\.\d\d m/);
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
    hindernisse = [{ id: _hindernisId++, name: 'X', feld: 2, verbinden: false, punkte: [{ x: 1, h: 520 }] }];
    const st = JSON.parse(JSON.stringify(getProjectState()));
    abschnitt = { masten: [], offen: null }; hindernisse = [];
    setProjectState(st);
    return { masten: abschnitt.masten.length, h: hindernisse.map(h => [h.feld, h.verbinden, h.punkte]) };
  });
  assert.deepEqual(r, { masten: 4, h: [[2, false, [{ x: 1, h: 520 }]]] });
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Hindernisliste ist unter dem Diagramm sichtbar und bedienbar', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  await seite.click('text=' + await seite.evaluate(() => t('hind.hinzu')));
  const sichtbar = await seite.isVisible('#obs-section .hind-block .hind-px');
  assert.equal(sichtbar, true);
  assert.deepEqual(fehler, []);
  await kontext.close();
});

test('Hindernis mit Punkten: schräge Unterkante, Einzelpunkte, alte H-Punkte werden übernommen', async () => {
  const { seite, fehler, kontext } = await appOeffnen(browser, url);
  const r = await seite.evaluate(() => {
    document.getElementById('sok-mum-left').value = 500; onSokMumLeftInput();
    setMindestabstand('0.5');
    // schräg ansteigend, ungeordnet eingegeben
    hindernisse = [{ id: _hindernisId++, name: 'Rampe', feld: 0, verbinden: true, punkte: [{ x: 30, h: 510 }, { x: 5, h: 507.3 }] }];
    renderObstacleList(); berechnen();
    const schraeg = _nachweis[0].best;
    // gleiche Punkte einzeln → nur an x = 5 und 30 geprüft
    hindernisse[0].verbinden = false; berechnen();
    const einzeln = _nachweis[0].best;
    // Projekt mit alten H-Punkten (Stand vor v3.9.3) laden
    const st = JSON.parse(JSON.stringify(getProjectState()));
    delete st.hindernisse;
    st.fields['probe-x1'] = '22.5'; st.fields['probe-h1'] = '508.9';
    st.fields['min-clearance-input'] = '0.4'; delete st.fields['hind-min'];
    setProjectState(st);
    return { schraeg, einzeln, uebernommen: hindernisse.map(h => ({ name: h.name, verbinden: h.verbinden, punkte: h.punkte })), a: minClearance,
             zeichnung: (setCanvasView('zeichnung'), document.getElementById('scale-svg-container').innerHTML.includes('a = ')) };
  });
  // Das Seil hängt durch, die Unterkante ist zwischen den Punkten gerade: der kleinste
  // Abstand liegt daher immer an einem Punkt (oder am Feldrand) — verbunden = einzeln.
  assert.ok([5, 30].includes(r.schraeg.x));
  assert.ok(Math.abs(r.schraeg.abstand - r.einzeln.abstand) < 1e-9);
  assert.deepEqual(r.uebernommen, [{ name: 'H-Punkte', verbinden: false, punkte: [{ x: 22.5, h: 508.9 }] }]);
  assert.equal(r.a, 0.4);
  assert.equal(r.zeichnung, true, 'Hindernis in der Zeichnung beschriftet');
  assert.deepEqual(fehler, []);
  await kontext.close();
});
