// Tests für den 3D-Export (DXF / IFC4) — ohne Browser.
// Die Gültigkeit gegenüber dem IFC4-Schema wurde zusätzlich mit IfcOpenShell
// geprüft (0 Befunde); diese Tests sichern Aufbau und Georeferenz ab.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../export3d.js');

// Fester Zufall → reproduzierbare GlobalIds
function zufallFolge(start = 1) {
  let s = start;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

function beispielModell(geo = true) {
  const achse = geo ? X.lv95Achse(2600000.5, 1200000.25, 2600030, 1200033.9) : null;
  const L = achse ? achse.L : 45;
  const kurve = dz => Array.from({ length: 21 }, (_, i) => {
    const x = L * i / 20;
    return X.feldPunkt(achse, x, 506.7 + 1.4 * x / L - 0.0014 * x * (L - x) - dz);
  });
  return {
    name: 'N-FL · M12 – M13', dateiname: 'probe', geo: geo ? { epsg: 2056 } : null,
    leiter: [
      { art: 'tragseil', name: 'Tragseil (T₂ −20 °C)', material: 'StCu 50 mm²', radius: 0.004, punkte: kurve(0),
        eigenschaften: [{ name: 'Zugkraft H bei T2', typ: 'kraft', wert: 5910 }] },
      { art: 'fahrdraht', name: 'Fahrdraht', material: 'Cu 107 mm²', radius: 0.0058, punkte: kurve(2.4) },
      { art: 'haenger', name: 'Hänger 1', radius: 0.0025, punkte: [kurve(2.4)[10], kurve(0)[10]] },
    ],
    eigenschaften: [
      { name: 'System', typ: 'text', wert: 'N-FL' },
      { name: 'Spannweite L', typ: 'laenge', wert: L },
      { name: 'Temperatur T2', typ: 'temperatur', wert: -20 },
    ],
  };
}

test('LV95-Achse: Spannweite und Richtung aus zwei Aufhängepunkten', () => {
  const a = X.lv95Achse(2600000, 1200000, 2600030, 1200040);
  assert.equal(a.L, 50);
  assert.deepEqual([a.ux, a.uy], [0.6, 0.8]);
  assert.deepEqual(X.feldPunkt(a, 25, 510), [2600015, 1200020, 510]);
  assert.deepEqual(X.feldPunkt(null, 25, 7), [25, 0, 7]);        // ohne Koordinaten: lokal
  assert.equal(X.lv95Achse(2600000, 1200000, 2600000, 1200000), null);  // gleicher Punkt
  assert.equal(X.lv95Achse(2600000, null, 2600030, 1200040), null);     // unvollständig
});

test('LV95-Plausibilität', () => {
  assert.ok(X.lv95Plausibel(2600000, 1200000));
  assert.ok(!X.lv95Plausibel(600000, 200000));   // altes LV03 statt LV95
});

test('STEP-Text: Apostroph und Umlaute korrekt kodiert', () => {
  assert.equal(X.stepText("Mast d'appui"), "'Mast d''appui'");
  assert.equal(X.stepText('Hänger'), "'H\\X2\\00E4\\X0\\nger'");
  assert.equal(X.stepText('T₂'), "'T\\X2\\2082\\X0\\'");
  assert.equal(X.stepText(null), '$');
});

test('STEP-Realzahl: immer mit Dezimalpunkt', () => {
  assert.equal(X.stepReal(1), '1.');
  assert.equal(X.stepReal(-0.000000000001), '0.');
  assert.equal(X.stepReal(2600000.5), '2600000.5');
  assert.equal(X.stepReal(-20), '-20.');
  assert.throws(() => X.stepReal(NaN));
});

test('IFC-GlobalId: 22 Zeichen, gültiges Alphabet, erstes Zeichen 0–3', () => {
  const z = zufallFolge();
  const ids = new Set();
  for (let i = 0; i < 500; i++) {
    const g = X.ifcGuid(z);
    assert.match(g, /^[0-3][0-9A-Za-z_$]{21}$/);
    ids.add(g);
  }
  assert.equal(ids.size, 500);
});

test('IFC4 mit Georeferenz: Kopf, Elemente, MapConversion, Eigenschaften', () => {
  const ifc = X.ifcErzeugen(beispielModell(true), { zufall: zufallFolge(), zeitstempel: '2026-09-26T12:00:00', programm: 'Durchhang test' });
  assert.match(ifc, /^ISO-10303-21;/);
  assert.match(ifc, /FILE_SCHEMA\(\('IFC4'\)\);/);
  assert.match(ifc, /END-ISO-10303-21;\n$/);
  assert.equal((ifc.match(/=IFCCABLESEGMENT\(/g) || []).length, 3);
  assert.equal((ifc.match(/\.CONDUCTORSEGMENT\.\)/g) || []).length, 2);
  assert.equal((ifc.match(/=IFCSWEPTDISKSOLID\(/g) || []).length, 3);
  assert.match(ifc, /IFCPROJECTEDCRS\('EPSG:2056'/);
  // Ursprung = abgerundeter erster Punkt; Höhe = abgerundetes Minimum
  assert.match(ifc, /IFCMAPCONVERSION\(#\d+,#\d+,2600000\.,1200000\.,\d+\.,1\.,0\.,1\.\)/);
  assert.match(ifc, /IFCPROPERTYSET\('[^']+',\$,'CH_Durchhang'/);
  assert.match(ifc, /IFCFORCEMEASURE\(5910\.\)/);
  assert.match(ifc, /IFCTHERMODYNAMICTEMPERATUREMEASURE\(-20\.\)/);
  assert.match(ifc, /IFCMATERIAL\('StCu 50 mm\\X2\\00B2\\X0\\'/);
  // Jede Referenz zeigt auf eine vorhandene Zeile
  const def = new Set([...ifc.matchAll(/^#(\d+)=/gm)].map(m => m[1]));
  for (const m of ifc.matchAll(/#(\d+)(?!=)/g)) assert.ok(def.has(m[1]), `#${m[1]} fehlt`);
  // Lokale Koordinaten klein (Ursprung abgezogen)
  const koords = [...ifc.matchAll(/IFCCARTESIANPOINT\(\(([^)]*)\)\)/g)].flatMap(m => m[1].split(',').map(Number));
  assert.ok(Math.max(...koords.map(Math.abs)) < 100);
});

test('IFC4 ohne Georeferenz: keine MapConversion, lokale Koordinaten', () => {
  const ifc = X.ifcErzeugen(beispielModell(false), { zufall: zufallFolge(7) });
  assert.doesNotMatch(ifc, /IFCMAPCONVERSION/);
  assert.match(ifc, /IFCCARTESIANPOINT\(\(0\.,0\.,506\.7\)\)/);
});

test('3D-DXF: Layer und Linien, Koordinaten in LV95', () => {
  const m = beispielModell(true);
  const dxf = X.dxfErzeugen(X.modellAlsDxfLinien(m));
  assert.match(dxf, /\$ACADVER\n1\nAC1009/);
  assert.match(dxf, /0\nEOF\n$/);
  assert.equal((dxf.match(/\n0\nLINE\n/g) || []).length, 20 + 20 + 1);
  for (const l of ['TRAGSEIL', 'FAHRDRAHT', 'HAENGER']) assert.match(dxf, new RegExp(`\\nLAYER\\n2\\n${l}\\n`));
  assert.match(dxf, /\n10\n2600000\.5000\n20\n1200000\.2500\n30\n506\.7000\n/);
});

test('Stränge: eigene DXF-Layer je Strang, IfcGroup je Strang', () => {
  const m = beispielModell(true);
  m.leiter.forEach(l => { l.layerPraefix = 'Spl ä'; l.gruppe = 'Strang SPL'; });
  const dxf = X.dxfErzeugen(X.modellAlsDxfLinien(m));
  assert.match(dxf, /\nLAYER\n2\nSPL_A_TRAGSEIL\n70\n0\n62\n5\n/);   // Farbe wie TRAGSEIL
  const ifc = X.ifcErzeugen(m, { zufall: zufallFolge(3) });
  assert.equal((ifc.match(/IFCGROUP\(/g) || []).length, 1);
  assert.match(ifc, /IFCRELASSIGNSTOGROUP\('[^']+',\$,\$,\$,\(#\d+,#\d+,#\d+\),\$,#\d+\)/);
});
