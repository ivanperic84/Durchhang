/* Export3D — 3D-DXF und IFC4 für Durchhang Kettenwerk
 *
 * Erzeugt aus einem fertig berechneten «Modell» (Punktfolgen der Leiter) den
 * Dateiinhalt. Kein Zugriff auf die Seite (DOM) — die Seite (index.html)
 * stellt das Modell zusammen, diese Datei schreibt nur die Formate. Dadurch
 * lässt sich der Export ohne Browser prüfen: npm test (tests/export3d.test.js).
 *
 * Koordinaten
 *   Ohne Georeferenz: x längs Feld (0 … L), y = 0, z = Höhe (über SOK oder m ü. M.).
 *   Mit Georeferenz:  E / N nach LV95 (EPSG:2056), z = Höhe m ü. M. (LN02).
 *   Im IFC werden die Punkte relativ zu einem runden Ursprung abgelegt; die
 *   Lage in LV95 steht in IfcMapConversion (übliches Vorgehen, vermeidet
 *   Rundungsfehler in Programmen mit einfacher Genauigkeit).
 *
 * Modell:
 *   {
 *     name:      'Feld 12 – 13',
 *     geo:       { epsg: 2056 } | null,
 *     leiter:    [ { art: 'tragseil'|'fahrdraht'|'haenger'|'leiter',
 *                    name, material, radius [m], punkte: [[x,y,z], …],
 *                    eigenschaften: [{ name, typ, wert }] } ],
 *     eigenschaften: [{ name, typ, wert }]   // gelten für alle Leiter
 *   }
 *   typ: 'text' | 'laenge' | 'kraft' | 'temperatur' | 'zahl'
 *
 * Nach Änderungen an dieser Datei: CACHE_VERSION in sw.js erhöhen.
 */
'use strict';

// ── LV95: Feldachse aus den beiden Aufhängepunkten ─────────────────────────
// Liefert Spannweite (waagrechter Abstand) und Richtungsvektor links → rechts.
function lv95Achse(eL, nL, eR, nR) {
  if (![eL, nL, eR, nR].every(Number.isFinite)) return null;
  const dE = eR - eL, dN = nR - nL;
  const L = Math.hypot(dE, dN);
  if (!(L > 0.01)) return null;
  return { L, e0: eL, n0: nL, ux: dE / L, uy: dN / L };
}

// Punkt im Feld (x längs, z Höhe) → Modellpunkt
function feldPunkt(achse, x, z) {
  return achse ? [achse.e0 + achse.ux * x, achse.n0 + achse.uy * x, z] : [x, 0, z];
}

// Plausible LV95-Werte (Schweiz inkl. Rand): E 2'480'000–2'840'000, N 1'070'000–1'300'000
function lv95Plausibel(e, n) {
  return e > 2400000 && e < 2900000 && n > 1000000 && n < 1350000;
}

// ═════════════════════════════════════════════════════════════════════════
// DXF (AC1009 / R12, 3D-Linien) — wird von allen CAD-Programmen gelesen
// ═════════════════════════════════════════════════════════════════════════
const DXF_LAYER = {
  TRAGSEIL: 5, FAHRDRAHT: 1, HAENGER: 8, LEITER: 5,
  TRAGSEIL_T1: 9, MAST: 7, SOK: 30, H_PUNKT: 3, MESSPUNKT: 4, MINDESTABSTAND: 2,
};
const LAYER_FUER_ART = { tragseil: 'TRAGSEIL', fahrdraht: 'FAHRDRAHT', haenger: 'HAENGER', leiter: 'LEITER' };

// linien: [{ layer, punkte: [[x,y,z], …] }] — aufeinanderfolgende Punkte werden verbunden
function dxfErzeugen(linien) {
  const f = v => Number(v).toFixed(4);
  const benutzt = [];
  let ents = '';
  for (const { layer, punkte } of linien) {
    if (!benutzt.includes(layer)) benutzt.push(layer);
    for (let i = 0; i + 1 < punkte.length; i++) {
      const [x1, y1, z1] = punkte[i], [x2, y2, z2] = punkte[i + 1];
      ents += `0\nLINE\n8\n${layer}\n10\n${f(x1)}\n20\n${f(y1)}\n30\n${f(z1)}\n11\n${f(x2)}\n21\n${f(y2)}\n31\n${f(z2)}\n`;
    }
  }
  let dxf = '0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n';
  dxf += '0\nSECTION\n2\nTABLES\n';
  dxf += `0\nTABLE\n2\nLAYER\n70\n${benutzt.length + 1}\n`;
  dxf += '0\nLAYER\n2\n0\n70\n0\n62\n7\n6\nCONTINUOUS\n';
  for (const l of benutzt)
    dxf += `0\nLAYER\n2\n${l}\n70\n0\n62\n${DXF_LAYER[l] ?? 7}\n6\nCONTINUOUS\n`;
  dxf += '0\nENDTAB\n0\nENDSEC\n';
  dxf += '0\nSECTION\n2\nENTITIES\n' + ents + '0\nENDSEC\n0\nEOF\n';
  return dxf;
}

// Leiter des Modells als DXF-Linien
function modellAlsDxfLinien(modell) {
  return modell.leiter.map(l => ({ layer: LAYER_FUER_ART[l.art] ?? 'LEITER', punkte: l.punkte }));
}

// ═════════════════════════════════════════════════════════════════════════
// IFC4 (ISO 16739-1:2018), STEP-Klartext
// ═════════════════════════════════════════════════════════════════════════

// IFC-GlobalId: 128 Bit, 22 Zeichen im IFC-Base64-Alphabet
const IFC_B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
function ifcGuid(zufall) {
  const b = new Uint8Array(16);
  if (zufall) for (let i = 0; i < 16; i++) b[i] = zufall() * 256 & 255;
  else if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.random() * 256 & 255;
  // 128 Bit → 2 Bit + 21 × 6 Bit
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  let s = '';
  for (let i = 0; i < 22; i++) {
    const shift = BigInt((21 - i) * 6);
    s += IFC_B64[Number((n >> shift) & 63n)];
  }
  return s;
}

// STEP-Zeichenkette: Apostroph verdoppeln, Nicht-ASCII als \X2\…\X0\
function stepText(s) {
  if (s === null || s === undefined) return '$';
  let o = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if (c === 39) o += "''";
    else if (c === 92) o += '\\\\';
    else if (c >= 32 && c < 127) o += ch;
    else if (c <= 0xFFFF) o += '\\X2\\' + c.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\';
    else o += '\\X4\\' + c.toString(16).toUpperCase().padStart(8, '0') + '\\X0\\';
  }
  return `'${o}'`;
}

// STEP-Realzahl: immer mit Dezimalpunkt
function stepReal(v) {
  if (!Number.isFinite(v)) throw new Error('IFC: ungültige Zahl ' + v);
  if (Math.abs(v) < 1e-10) return '0.';
  let s = v.toFixed(6).replace(/0+$/, '');
  if (!s.includes('.')) s += '.';
  return s;
}

const IFC_FARBE = {           // Anzeigefarbe je Leiterart (RGB 0…1)
  tragseil:  [0.29, 0.36, 0.72],
  fahrdraht: [0.72, 0.45, 0.20],
  haenger:   [0.55, 0.55, 0.58],
  leiter:    [0.29, 0.36, 0.72],
};
const IFC_OBJEKTTYP = { tragseil: 'Tragseil', fahrdraht: 'Fahrdraht', haenger: 'Haenger', leiter: 'Leiter' };

function ifcWert(e) {
  switch (e.typ) {
    case 'laenge':     return `IFCLENGTHMEASURE(${stepReal(e.wert)})`;
    case 'kraft':      return `IFCFORCEMEASURE(${stepReal(e.wert)})`;
    case 'temperatur': return `IFCTHERMODYNAMICTEMPERATUREMEASURE(${stepReal(e.wert)})`;
    case 'zahl':       return `IFCREAL(${stepReal(e.wert)})`;
    default:           return `IFCLABEL(${stepText(e.wert)})`;
  }
}

// optionen: { zufall, zeitstempel, programm }
function ifcErzeugen(modell, optionen = {}) {
  const guid = () => ifcGuid(optionen.zufall);
  const zeit = optionen.zeitstempel || new Date().toISOString().slice(0, 19);
  const programm = optionen.programm || 'Durchhang';
  const zeilen = [];
  let nr = 0;
  const neu = text => { nr++; zeilen.push(`#${nr}=${text};`); return `#${nr}`; };

  // Ursprung: runde Werte nahe dem ersten Punkt → kleine lokale Koordinaten
  const alle = modell.leiter.flatMap(l => l.punkte);
  if (!alle.length) throw new Error('IFC: Modell ohne Punkte');
  const geo = modell.geo || null;
  const ox = geo ? Math.floor(alle[0][0]) : 0;
  const oy = geo ? Math.floor(alle[0][1]) : 0;
  const oz = geo ? Math.floor(Math.min(...alle.map(p => p[2]))) : 0;
  const lokal = p => [p[0] - ox, p[1] - oy, p[2] - oz];

  // Einheiten
  const uLaenge = neu('IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)');
  const uWinkel = neu('IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)');
  const uKraft  = neu('IFCSIUNIT(*,.FORCEUNIT.,$,.NEWTON.)');
  const uTemp   = neu('IFCSIUNIT(*,.THERMODYNAMICTEMPERATUREUNIT.,$,.DEGREE_CELSIUS.)');
  const einheiten = neu(`IFCUNITASSIGNMENT((${uLaenge},${uWinkel},${uKraft},${uTemp}))`);

  // Darstellungskontext
  const p0   = neu('IFCCARTESIANPOINT((0.,0.,0.))');
  const achse0 = neu(`IFCAXIS2PLACEMENT3D(${p0},$,$)`);
  const nord = neu('IFCDIRECTION((0.,1.))');
  const ctx  = neu(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${achse0},${nord})`);
  const ctxBody = neu(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const ctxAxis = neu(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Axis','Model',*,*,*,*,${ctx},$,.GRAPH_VIEW.,$)`);

  const projekt = neu(`IFCPROJECT(${stepText(guid())},$,${stepText(modell.name || 'Durchhang')},${stepText('Erzeugt mit ' + programm)},$,$,$,(${ctx}),${einheiten})`);

  // Georeferenz LV95 (EPSG:2056, Höhen LN02)
  if (geo) {
    const crs = neu(`IFCPROJECTEDCRS('EPSG:2056',${stepText('CH1903+ / LV95')},'CH1903+','LN02',${stepText('Swiss Oblique Mercator')},$,${uLaenge})`);
    neu(`IFCMAPCONVERSION(${ctx},${crs},${stepReal(ox)},${stepReal(oy)},${stepReal(oz)},1.,0.,1.)`);
  }

  // Standort
  const platzSite = neu(`IFCLOCALPLACEMENT($,${achse0})`);
  const site = neu(`IFCSITE(${stepText(guid())},$,${stepText(modell.name || 'Feld')},$,$,${platzSite},$,$,.ELEMENT.,$,$,$,$,$)`);
  neu(`IFCRELAGGREGATES(${stepText(guid())},$,$,$,${projekt},(${site}))`);

  // Materialien und Stile (je einmal)
  const materialien = new Map();
  const material = name => {
    if (!materialien.has(name)) materialien.set(name, { ref: neu(`IFCMATERIAL(${stepText(name)},$,$)`), elemente: [] });
    return materialien.get(name);
  };
  const stile = new Map();
  const stil = art => {
    if (!stile.has(art)) {
      const [r, g, b] = IFC_FARBE[art] || IFC_FARBE.leiter;
      const farbe = neu(`IFCCOLOURRGB($,${stepReal(r)},${stepReal(g)},${stepReal(b)})`);
      const schatt = neu(`IFCSURFACESTYLESHADING(${farbe},$)`);
      stile.set(art, neu(`IFCSURFACESTYLE(${stepText(IFC_OBJEKTTYP[art] || art)},.BOTH.,(${schatt}))`));
    }
    return stile.get(art);
  };

  // Leiter
  const elemente = [];
  const psetFuer = [];
  for (const l of modell.leiter) {
    const pts = l.punkte.map(p => neu(`IFCCARTESIANPOINT((${lokal(p).map(stepReal).join(',')}))`));
    const linie = neu(`IFCPOLYLINE((${pts.join(',')}))`);
    const koerper = neu(`IFCSWEPTDISKSOLID(${linie},${stepReal(l.radius)},$,$,$)`);
    neu(`IFCSTYLEDITEM(${koerper},(${stil(l.art)}),$)`);
    const repAchse = neu(`IFCSHAPEREPRESENTATION(${ctxAxis},'Axis','Curve3D',(${linie}))`);
    const repKoerper = neu(`IFCSHAPEREPRESENTATION(${ctxBody},'Body','AdvancedSweptSolid',(${koerper}))`);
    const form = neu(`IFCPRODUCTDEFINITIONSHAPE($,$,(${repAchse},${repKoerper}))`);
    const platz = neu(`IFCLOCALPLACEMENT(${platzSite},${achse0})`);
    const typ = l.art === 'haenger' ? '.USERDEFINED.' : '.CONDUCTORSEGMENT.';
    const el = neu(`IFCCABLESEGMENT(${stepText(guid())},$,${stepText(l.name)},$,${stepText(IFC_OBJEKTTYP[l.art] || l.art)},${platz},${form},$,${typ})`);
    elemente.push(el);
    if (l.material) material(l.material).elemente.push(el);
    if (l.eigenschaften && l.eigenschaften.length) psetFuer.push({ el, eig: l.eigenschaften });
  }
  neu(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${stepText(guid())},$,$,$,(${elemente.join(',')}),${site})`);

  for (const [, m] of materialien)
    neu(`IFCRELASSOCIATESMATERIAL(${stepText(guid())},$,$,$,(${m.elemente.join(',')}),${m.ref})`);

  // Eigenschaften: gemeinsamer Satz für alle Leiter + eigener Satz je Leiter
  const psetName = 'CH_Durchhang';
  const pset = (eig, fuer, name) => {
    const props = eig.map(e => neu(`IFCPROPERTYSINGLEVALUE(${stepText(e.name)},$,${ifcWert(e)},$)`));
    const ps = neu(`IFCPROPERTYSET(${stepText(guid())},$,${stepText(name)},$,(${props.join(',')}))`);
    neu(`IFCRELDEFINESBYPROPERTIES(${stepText(guid())},$,$,$,(${fuer.join(',')}),${ps})`);
  };
  if (modell.eigenschaften && modell.eigenschaften.length) pset(modell.eigenschaften, elemente, psetName);
  for (const { el, eig } of psetFuer) pset(eig, [el], psetName + '_Leiter');

  const kopf = [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [DesignTransferView]'),'2;1');",
    `FILE_NAME(${stepText((modell.dateiname || 'durchhang') + '.ifc')},${stepText(zeit)},(''),(''),${stepText(programm)},${stepText(programm)},'');`,
    "FILE_SCHEMA(('IFC4'));",
    'ENDSEC;',
    'DATA;',
  ];
  return kopf.concat(zeilen, ['ENDSEC;', 'END-ISO-10303-21;', '']).join('\n');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    lv95Achse, feldPunkt, lv95Plausibel,
    dxfErzeugen, modellAlsDxfLinien, DXF_LAYER,
    ifcGuid, stepText, stepReal, ifcErzeugen,
  };
}
