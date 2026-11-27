// Tests für betreiberdaten.js und xlsx.js — Dateiformat, Prüfung, Excel ↔ JSON,
// Übernahme in die Programmtabellen. Nur mit neutralen Beispielwerten.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const BD = require('../betreiberdaten.js');
const { xlsxLesen, xlsxSchreiben } = require('../xlsx.js');

const kopie = o => JSON.parse(JSON.stringify(o));
const MATS = ['cu95', 'cu107', 'cu150', 'stcu50', 'stcu92', 'aldrey300'];
const KOMBIS = ['stcu50_cu107', 'stcu92_cu107', 'stcu92_cu150'];
const PRUEF = { leiter: k => MATS.includes(k), kombination: (ts, fd) => KOMBIS.includes(ts + '_' + fd) };

test('Beispielwerte sind gültig und als Beispiel markiert', () => {
  const { daten, fehler } = BD.bdPruefen(BD.BEISPIEL_DATEN, PRUEF);
  assert.deepEqual(fehler, []);
  assert.equal(daten.beispiel, true);
  assert.ok(daten.kettenwerke.some(k => k.system === 'nfl' && k.starr));
  assert.ok(daten.kettenwerke.some(k => k.system === 'rfl'));
  assert.ok(Object.values(daten.einzelleiter.leiter).some(l => l.nach_spannweite));
});

test('Prüfung meldet verständliche Fehler', () => {
  const roh = kopie(BD.BEISPIEL_DATEN);
  roh.format = 'etwas';
  roh.stand = '31.10.2024';
  roh.einzelleiter.leiter.unbekannt = { varianten: [{ werte: null }] };
  roh.einzelleiter.leiter.cu95.varianten[0].werte[3] = -1;
  roh.kettenwerke[0].normal.werte_ub = roh.kettenwerke[0].normal.werte_ub.slice(0, 5);
  roh.kettenwerke[1].tragseil = 'cu300';
  roh.kettenwerke.push({ ...kopie(roh.kettenwerke[2]) });          // doppelter Schlüssel
  delete roh.hf.anhub;
  const { daten, fehler } = BD.bdPruefen(roh, PRUEF);
  assert.equal(daten, null);
  const alle = fehler.join('\n');
  for (const s of ['Unbekanntes Format', 'JJJJ-MM-TT', '«unbekannt» ist unbekannt', 'bei -5 °C', '13 Werte',
    'nicht hinterlegt', 'doppelt', 'anhub']) assert.ok(alle.includes(s), `fehlt: ${s}\n${alle}`);
});

test('Excel-Mappe: Schreiben und Lesen ergibt dieselben Daten', async () => {
  const a = BD.bdPruefen(BD.BEISPIEL_DATEN, PRUEF).daten;
  const bytes = xlsxSchreiben(BD.bdZuBlaettern(a));
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4B);      // ZIP
  const blaetter = await xlsxLesen(bytes);
  assert.deepEqual(Object.keys(blaetter), ['Info', 'Einzelleiter', 'Kettenwerke', 'hf']);
  const b = BD.bdPruefen(BD.bdAusBlaettern(blaetter), PRUEF);
  assert.deepEqual(b.fehler, []);
  assert.deepEqual(b.daten, a);
});

// Wie ein Tabellenprogramm speichert: komprimiert, geteilte Texte, Datum als Zahl
function zipKomprimiert(dateien) {
  const teile = [], verz = [];
  let pos = 0;
  const u16 = n => Buffer.from([n & 255, (n >> 8) & 255]);
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
  for (const [name, text] of dateien) {
    const roh = Buffer.from(text, 'utf8'), d = zlib.deflateRawSync(roh), nb = Buffer.from(name);
    const crc = zlib.crc32 ? zlib.crc32(roh) : 0;
    const kopf = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(d.length), u32(roh.length), u16(nb.length), u16(0)]);
    teile.push(kopf, nb, d);
    verz.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(8), u16(0), u16(0), u32(crc), u32(d.length), u32(roh.length),
      u16(nb.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(pos)]), nb);
    pos += kopf.length + nb.length + d.length;
  }
  const v = Buffer.concat(verz);
  return Buffer.concat([...teile, v, u32(0x06054b50), u16(0), u16(0), u16(dateien.length), u16(dateien.length), u32(v.length), u32(pos), u16(0)]);
}

test('Excel-Mappe eines Tabellenprogramms: komprimiert, geteilte Texte, Datum, Formelwert', async () => {
  const wb = '<workbook xmlns="x" xmlns:r="r"><sheets><sheet name="Info" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels = '<Relationships><Relationship Id="rId1" Type="ws" Target="/xl/worksheets/a.xml"/></Relationships>';
  const sst = '<sst><si><t>Stand</t></si><si><r><t>Bei</t></r><r><t xml:space="preserve">spiel &amp; Co</t></r></si></sst>';
  const blatt = '<worksheet><sheetData>'
    + '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>45596</v></c></row>'
    + '<row r="3"><c r="B3" t="s"><v>1</v></c><c r="D3"><f>1+1</f><v>2</v></c><c r="E3" t="b"><v>1</v></c>'
    + '<c r="F3" t="inlineStr"><is><t>&#x2264; 35</t></is></c></row>'
    + '</sheetData></worksheet>';
  const bytes = zipKomprimiert([['xl/workbook.xml', wb], ['xl/_rels/workbook.xml.rels', rels],
    ['xl/sharedStrings.xml', sst], ['xl/worksheets/a.xml', blatt]]);
  const b = await xlsxLesen(bytes);
  assert.deepEqual(b.Info[0], ['Stand', 45596]);
  assert.deepEqual(b.Info[1], []);
  assert.deepEqual(b.Info[2], [null, 'Beispiel & Co', null, 2, true, '≤ 35']);
});

test('Excel-Datum und Schweizer Datum werden als JJJJ-MM-TT übernommen', () => {
  const blaetter = BD.bdZuBlaettern(BD.bdPruefen(BD.BEISPIEL_DATEN, PRUEF).daten);
  const info = blaetter.Info;
  const zeile = info.findIndex(z => z[0] === 'Stand (JJJJ-MM-TT)');
  info[zeile][1] = 45596;                                              // Excel-Zahl für 31.10.2024
  assert.equal(BD.bdAusBlaettern(blaetter).stand, '2024-10-31');
  info[zeile][1] = '1.2.2025';
  assert.equal(BD.bdAusBlaettern(blaetter).stand, '2025-02-01');
});

test('Übernahme in die Programmtabellen: Reglage, Varianten, Kettenwerke', () => {
  const daten = BD.bdPruefen(BD.BEISPIEL_DATEN, PRUEF).daten;
  const MATERIALS = Object.fromEntries(MATS.map(k => [k, { name: k, q: 1, H_reglage: 999, reglage_note: 'alt' }]));
  const PRESETS = { alt: { label: 'alt' } };
  BD.bdAnwenden(daten, MATERIALS, PRESETS);
  // alte Werte entfernt, Leiter ohne Tabelle ohne Reglagefelder
  assert.equal(MATERIALS.cu107.H_reglage, undefined);
  assert.equal(PRESETS.alt, undefined);
  // Einzelleiter mit zwei Varianten: erste Variante oben, H_reglage = Wert bei +10 °C
  const cu95 = MATERIALS.cu95, v0 = daten.einzelleiter.leiter.cu95.varianten[0];
  assert.equal(cu95.H_reglage_variants.length, 2);
  assert.equal(cu95.H_reglage, v0.werte[BD.BD_TEMPS.indexOf(10)]);
  assert.deepEqual(cu95.H_reglage_table, { temps: BD.BD_TEMPS, vals: v0.werte });
  assert.equal(BD.bdNotiz(cu95.reglage_note, 'fr'), v0.notiz.fr);
  // nach Spannweite: c_max und L_ref je Variante
  const al = MATERIALS.aldrey300;
  assert.equal(al.auto_variant_by_span, true);
  assert.deepEqual(al.H_reglage_variants.map(v => [v.c_max, v.L_ref]), [[35, 30], [Infinity, 45]]);
  // Kettenwerke
  const n = daten.kettenwerke.find(k => k.system === 'nfl');
  const p = PRESETS[n.schluessel];
  assert.equal(p.sysMode, 'nfl');
  assert.equal(p.H_Ts_ub, n.normal.werte_ub[BD.BD_TEMPS.indexOf(10)]);
  assert.equal(p.starr.H_Ts, n.starr.H_Ts);
  const r = PRESETS[daten.kettenwerke.find(k => k.system === 'rfl').schluessel];
  assert.equal(r.H_Ts_ub_table, undefined);
});

test('Bezeichnung mit Stand', () => {
  assert.equal(BD.bdBezeichnung({ titel: 'Daten X', stand: '2024-10-31' }), 'Daten X, Stand 31.10.2024');
  assert.equal(BD.bdBezeichnung({ titel: 'Daten X', stand: '' }), 'Daten X');
  assert.equal(BD.bdNotiz({ de: 'a', fr: 'b' }, 'it'), 'a');
  assert.equal(BD.bdNotiz('nur Text', 'fr'), 'nur Text');
});
