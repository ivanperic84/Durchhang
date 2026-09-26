// Tests für fahrdrahthoehe.js — hf_min / hf_max wie SBB-Excel (Blätter hfmin_v11_D, hfmax_v11_D)
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HF = require('../fahrdrahthoehe.js');
const kern = require('../rechenkern.js');

const nahe = (ist, soll, tol, text) =>
  assert.ok(Math.abs(ist - soll) <= tol, `${text}: ist ${ist}, soll ${soll} (±${tol})`);

const STCU50_CU107 = { MFL: 13.87640975, MTS: 4.0109198, E: 1.59e11, AL: 11.5e-6, AK: 4.9450e-5, qFdAbnutzung: 9.1594111 };

// In der Excel gespeicherter Fall: N-FL 50+107, c = 30 m, −5 °C mit 7 N/m,
// EBV 2, schotterlos, 141 km/h, kein Bahnübergang, LRP «N»
const EXCEL_FALL = {
  typ: 'nfl', c: 30, v: 141, bue: false,
  un: 15, schotter: false, ebv: 2, f: 0, H: 0, Tmin: -5, zlMin: 7, cUebr: 0, p11: false, p12: false,
  lrp: false, Tmax: -5, zlMax: 7,
  nfl: { gk: 13.87640975, H_Fd: 8500, H_t0: 3860, H_Tmin: 5430, H_Tmax: 5430 },
};

test('Excel-Fall N-FL: hf_min 4927.95 mm, hf_max 6104.35 mm', () => {
  const r = HF.hfBerechnen(EXCEL_FALL);
  assert.deepEqual(r.fehler, []);
  nahe(r.min.wert, 4927.950926503469, 1e-9, 'hf_min');
  nahe(r.max.wert, 6104.350926503469, 1e-9, 'hf_max');
  const z = Object.fromEntries(r.min.zeilen.map(x => [x.sym, x.wert]));
  assert.deepEqual([z.fg, z.thu, z.fud, z.fuv, z.fFDmaxZL], [60, 10, 27, 0, 0]);
  nahe(z.fFDmax40, 10.950926503469427, 1e-12, 'fFDmax40');
  nahe(r.min.summe, 107.95092650346943, 1e-9, 'Z_hfmin');
  assert.equal(r.min.absolut, 4670 + 0 + 150);
  const zo = Object.fromEntries(r.max.zeilen.map(x => [x.sym, x.wert]));
  nahe(zo.fudo, 21.6, 1e-12, 'fudo');
  assert.equal(zo.fh, 75);
  nahe(zo.fFDmin, -10.950926503469427, 1e-12, 'fFDmin');
  nahe(r.max.summe, 95.64907349653056, 1e-9, 'Z_hfmax');
  assert.equal(r.max.absolut, 6200);
});

test('N-FL-Zugkräfte aus dem Rechenkern = Excel «NFL-Tab» (Lm 30 m, 1700 N bei 10 °C)', () => {
  const n = HF.hfNflZugkraefte(kern, { flCombo: STCU50_CU107, Lm: 30, H_ub: 1700, T_montage: 10, H_Fd: 8500,
    Tmin: -5, zlMin: 7, Tmax: -20, zlMax: 0 });
  assert.equal(n.H_t0, 3860);
  assert.equal(n.H_Tmin, 5430);
  assert.equal(n.H_Tmax, 5665);
  assert.equal(n.gk, 13.87640975);
  const r = HF.hfBerechnen({ ...EXCEL_FALL, Tmax: -20, zlMax: 0, nfl: n });
  nahe(r.min.wert, 4927.950926503469, 1e-9, 'hf_min wie Excel-Fall');
  // bei −20 °C hebt sich der Fahrdraht (negativer Durchhang) → hf_max kleiner
  assert.ok(r.max.zeilen.find(z => z.sym === 'fFDmin').wert > 0);
});

test('Schwingung nach unten / oben je Spannweite', () => {
  assert.equal(HF.hfSchwingung(20), 16);
  assert.equal(HF.hfSchwingung(24), 19.2);
  assert.equal(HF.hfSchwingung(26), 21);
  assert.equal(HF.hfSchwingung(45), 49.5);
  nahe(HF.hfSchwingung(50), 4 * 50 / 7 + 24, 1e-12, 'c = 50');
});

test('Zuschläge: Grenzlinie, k, be, Gleishebung, Montagetoleranz, Vordurchhang', () => {
  assert.deepEqual([1, 2, 3, 4].map(HF.hfGrenzlinie), [4570, 4670, 4670, 4840]);
  assert.deepEqual([1, 2, 3, 4].map(HF.hfSicherheitszuschlag), [70, 0, 0, 0]);
  assert.deepEqual([HF.hfElektrAbstand(15), HF.hfElektrAbstand(25)], [150, 270]);
  assert.deepEqual([HF.hfGleishebung(true, false), HF.hfGleishebung(false, false), HF.hfGleishebung(true, true)], [100, 60, 0]);
  assert.deepEqual([HF.hfMontagetoleranz(140), HF.hfMontagetoleranz(141)], [20, 10]);
  assert.equal(HF.hfVordurchhang('rfl', 42, 140), 50);
  assert.equal(HF.hfVordurchhang('rfl', 41, 140), 30);
  assert.equal(HF.hfVordurchhang('rfl', 60, 141), 0);
  assert.equal(HF.hfVordurchhang('nfl', 60, 80), 0);
});

test('R-FL: Eislast mit 12 + 10 kN, Fallprüfung P1.1–P1.3 und c_übr', () => {
  nahe(HF.hfRflEislast(60, 7, 0, false, false), 143.1818181818182, 1e-9, 'Excel Tabelle c = 60');
  nahe(HF.hfRflEislast(44, 7, 0, false, false), 77, 1e-9, 'Excel Tabelle c = 44');
  nahe(HF.hfRflEislast(60, 7, 20, false, true), 143.1818181818182 * 40 / 60, 1e-9, 'P1.2 mit c_übr');
  assert.equal(HF.hfRflEislast(60, 7, 0, true, false), 0);      // P1.1/P1.3
  assert.equal(HF.hfRflEislast(60, 7, 10, false, false), 0);    // wie Excel: sonst 0
});

test('R-FL gesamt, 120 km/h, Schotter, EBV 1, 25 kV, c = 60 m, Eis 7 N/m', () => {
  const r = HF.hfBerechnen({ typ: 'rfl', c: 60, v: 120, bue: false, un: 25, schotter: true, ebv: 1, f: 0, H: 0,
    Tmin: -5, zlMin: 7, cUebr: 0, p11: false, p12: false, lrp: true, Tmax: -20, zlMax: 0 });
  nahe(r.min.wert, 4570 + 70 + 270 + 100 + 20 + (240 / 7 + 24) + 50 + 143.1818181818182, 1e-9, 'hf_min');
  nahe(r.max.wert, 6050 - (20 + (240 / 7 + 24) * 0.8 - 50 + 75), 1e-9, 'hf_max');
});

test('Bahnübergang: 5510 + Zuschläge, ohne Gleishebung und Schwingung, mit Hinweisen', () => {
  const r = HF.hfBerechnen({ ...EXCEL_FALL, bue: true });
  nahe(r.min.wert, 5510 + 0 + 10 + 0 + 0 + 0 + 10.950926503469427, 1e-9, 'hf_min BÜ');
  nahe(r.max.wert, 5510 + (10 + 0 + 0 + 75 - 10.950926503469427), 1e-9, 'hf_max BÜ');
  assert.ok(r.hinweise.includes('hf.w.bue'));
  assert.ok(r.hinweise.includes('hf.w.buenfl'));
});

test('Eingabeprüfung: Spannweite, Temperatur, Zusatzlast nur bei −5 °C, N-FL-Zugkräfte', () => {
  assert.equal(HF.HF_SPANNWEITEN.length, 40);
  assert.ok(HF.hfBerechnen({ ...EXCEL_FALL, c: 25 }).fehler.includes('hf.err.c'));
  assert.ok(HF.hfBerechnen({ ...EXCEL_FALL, Tmin: 12 }).fehler.includes('hf.err.t.min'));
  assert.ok(HF.hfBerechnen({ ...EXCEL_FALL, Tmax: 0 }).fehler.includes('hf.err.zlt.max'));
  assert.ok(HF.hfBerechnen({ ...EXCEL_FALL, zlMin: 10 }).fehler.includes('hf.err.zl.min'));
  assert.ok(HF.hfBerechnen({ ...EXCEL_FALL, nfl: null }).fehler.includes('hf.err.nfl'));
  const r = HF.hfBerechnen({ ...EXCEL_FALL, c: 25 });
  assert.equal(r.min, null);
  // Hinweise zur Fallprüfung R-FL
  const rfl = { ...EXCEL_FALL, typ: 'rfl', nfl: null };
  assert.ok(HF.hfBerechnen({ ...rfl, p12: true, cUebr: 0 }).hinweise.includes('hf.w.p12j'));
  assert.ok(HF.hfBerechnen({ ...rfl, cUebr: 5 }).hinweise.includes('hf.w.p12n'));
  assert.ok(HF.hfBerechnen({ ...rfl, p11: true, cUebr: 5 }).hinweise.includes('hf.w.p11'));
  assert.ok(HF.hfBerechnen({ ...rfl, cUebr: 31 }).fehler.includes('hf.err.cuebr'));
  assert.ok(HF.hfBerechnen({ ...EXCEL_FALL, Tmin: 60, zlMin: 0 }).hinweise.includes('hf.w.t56'));
});

// 480 Fälle, mit LibreOffice in der SBB-Excel nachgerechnet (Blätter hfmin/hfmax):
// N-FL / R-FL, alle Spannweiten, v, BÜ, EBV, Spannung, Schotter, LRP, Temperatur,
// Eis, f/H, Fallprüfung P1.1–P1.3 mit c_übr. Verglichen werden hf_min, hf_max
// und jeder einzelne Zuschlag.
test('480 Excel-Vergleichsfälle hf_min / hf_max: identisch mit der Excel', () => {
  const { faelle } = require('./hf_excel_referenz.json');
  assert.equal(faelle.length, 480);
  const abweichend = [];
  for (const [i, { e, xl }] of faelle.entries()) {
    const nfl = e.typ === 'nfl' ? HF.hfNflZugkraefte(kern, { flCombo: STCU50_CU107, Lm: 30, H_ub: 1700, T_montage: 10, H_Fd: 8500,
      Tmin: e.Tmin, zlMin: e.zlMin, Tmax: e.Tmax, zlMax: e.zlMax }) : null;
    const r = HF.hfBerechnen({ ...e, nfl });
    if (r.fehler.length) { abweichend.push(`Fall ${i}: App verweigert (${r.fehler})`); continue; }
    const pruefe = (name, app, excel) => { if (Math.abs(app - (excel ?? 0)) > 1e-6) abweichend.push(`Fall ${i} ${name}: App ${app}, Excel ${excel}`); };
    pruefe('hf_min', r.min.wert, xl.min);
    pruefe('hf_max', r.max.wert, xl.max);
    r.min.zeilen.forEach(z => pruefe(z.sym, z.wert, xl.zMin[z.sym]));
    r.max.zeilen.forEach(z => pruefe(z.sym, z.wert, xl.zMax[z.sym]));
  }
  assert.equal(abweichend.length, 0, abweichend.slice(0, 10).join('\n'));
});
