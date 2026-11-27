// Tests für fahrdrahthoehe.js — Rechengang hf_min / hf_max mit den neutralen
// Beispiel-Parametern (betreiberdaten.js). Die Vergleichsfälle mit echten
// Betreiberdaten laufen lokal (npm run test:sbb).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const HF = require('../fahrdrahthoehe.js');
const kern = require('../rechenkern.js');
const { BEISPIEL_DATEN } = require('../betreiberdaten.js');

const P = BEISPIEL_DATEN.hf;
HF.hfParameterSetzen(P);

const nahe = (ist, soll, tol, text) =>
  assert.ok(Math.abs(ist - soll) <= tol, `${text}: ist ${ist}, soll ${soll} (±${tol})`);

const STCU50_CU107 = { MFL: 13.87640975, MTS: 4.0109198, E: 1.59e11, AL: 11.5e-6, AK: 4.9450e-5, qFdAbnutzung: 9.1594111 };

const FALL = {
  typ: 'nfl', c: 30, v: 141, bue: false,
  un: 15, schotter: false, ebv: 2, f: 0, H: 0, Tmin: -5, zlMin: 7, cUebr: 0, p11: false, p12: false,
  lrp: false, Tmax: -5, zlMax: 7,
  nfl: { gk: 13.87640975, H_Fd: 9000, H_t0: 3600, H_Tmin: 5200, H_Tmax: 5200 },
};

test('Ohne Parameter keine Rechnung (Fehler hf.err.param)', () => {
  HF.hfParameterSetzen(null);
  try {
    assert.deepEqual(HF.hfBerechnen(FALL).fehler, ['hf.err.param']);
  } finally { HF.hfParameterSetzen(P); }
});

test('Zuschläge folgen den Parametern', () => {
  assert.deepEqual([1, 2, 3, 4].map(HF.hfGrenzlinie), [P.grenzlinie.ebv1, P.grenzlinie.ebv2, P.grenzlinie.ebv3, P.grenzlinie.ebv4]);
  assert.deepEqual([1, 2, 3, 4].map(HF.hfSicherheitszuschlag), [P.sicherheit.ebv1, P.sicherheit.ebv2, P.sicherheit.ebv3, P.sicherheit.ebv4]);
  assert.deepEqual([HF.hfElektrAbstand(15), HF.hfElektrAbstand(25)], [P.elektr_abstand.andere, P.elektr_abstand.un25]);
  assert.deepEqual([HF.hfGleishebung(true, false), HF.hfGleishebung(false, false), HF.hfGleishebung(true, true)],
    [P.gleishebung.schotter, P.gleishebung.ohne_schotter, P.gleishebung.bue]);
  const vg = P.montagetoleranz.v_grenze;
  assert.deepEqual([HF.hfMontagetoleranz(vg), HF.hfMontagetoleranz(vg + 1)], [P.montagetoleranz.langsam, P.montagetoleranz.schnell]);
  const vd = P.vordurchhang;
  assert.equal(HF.hfVordurchhang('rfl', vd.c_grenze, vd.v_max), vd.gross);
  assert.equal(HF.hfVordurchhang('rfl', vd.c_grenze - 1, vd.v_max), vd.klein);
  assert.equal(HF.hfVordurchhang('rfl', 60, vd.v_max + 1), 0);
  assert.equal(HF.hfVordurchhang('nfl', 60, 80), 0);
});

test('Andere Parameter ändern das Ergebnis entsprechend', () => {
  const a = HF.hfBerechnen(FALL);
  HF.hfParameterSetzen({ ...P, grenzlinie: { ...P.grenzlinie, ebv2: P.grenzlinie.ebv2 + 100 }, anhub: P.anhub + 5 });
  try {
    const b = HF.hfBerechnen(FALL);
    nahe(b.min.wert - a.min.wert, 100, 1e-9, 'hf_min folgt der Grenzlinie');
    nahe(a.max.wert - b.max.wert, 5, 1e-9, 'hf_max folgt dem Anhub');
  } finally { HF.hfParameterSetzen(P); }
});

test('N-FL: Aufbau hf_min / hf_max aus Grundwerten und Zuschlägen', () => {
  const r = HF.hfBerechnen(FALL);
  assert.deepEqual(r.fehler, []);
  const z = Object.fromEntries(r.min.zeilen.map(x => [x.sym, x.wert]));
  assert.equal(z.fg, P.gleishebung.ohne_schotter);
  assert.equal(z.thu, P.montagetoleranz.langsam);
  assert.equal(z.fud, HF.hfSchwingung(30));
  assert.deepEqual([z.fuv, z.fFDmaxZL], [0, 0]);
  nahe(z.fFDmax40, HF.hfNflDurchhang(30, 7, { ...FALL.nfl, H_Tx: FALL.nfl.H_Tmin }), 1e-12, 'fFDmax40');
  assert.equal(r.min.absolut, P.grenzlinie.ebv2 + P.sicherheit.ebv2 + P.elektr_abstand.andere);
  nahe(r.min.wert, r.min.absolut + r.min.summe, 1e-9, 'hf_min = Grundwert + Z');
  const zo = Object.fromEntries(r.max.zeilen.map(x => [x.sym, x.wert]));
  nahe(zo.fudo, HF.hfSchwingung(30) * P.schwingung_oben_faktor, 1e-12, 'fudo');
  assert.equal(zo.fh, P.anhub);
  assert.equal(r.max.absolut, P.hf_max_absolut.lrp_nein);
  nahe(r.max.wert, r.max.absolut - r.max.summe, 1e-9, 'hf_max = absolut − Z');
});

test('N-FL-Zugkräfte aus dem Rechenkern: kälter → höher, mit Eis → höher', () => {
  const n = HF.hfNflZugkraefte(kern, { flCombo: STCU50_CU107, Lm: 30, H_ub: 1500, T_montage: 10, H_Fd: 9000,
    Tmin: -5, zlMin: 7, Tmax: -20, zlMax: 0 });
  assert.equal(n.gk, 13.87640975);
  assert.ok(n.H_t0 > 1500);
  assert.ok(n.H_Tmin > n.H_t0);
  assert.ok(n.H_Tmax > n.H_t0);
  const r = HF.hfBerechnen({ ...FALL, Tmax: -20, zlMax: 0, nfl: n });
  assert.deepEqual(r.fehler, []);
  // bei −20 °C hebt sich der Fahrdraht (negativer Durchhang) → hf_max kleiner
  assert.ok(r.max.zeilen.find(z => z.sym === 'fFDmin').wert > 0);
});

test('Schwingung nach unten je Spannweite', () => {
  assert.equal(HF.hfSchwingung(20), 16);
  assert.equal(HF.hfSchwingung(24), 19.2);
  assert.equal(HF.hfSchwingung(26), 21);
  assert.equal(HF.hfSchwingung(45), 49.5);
  nahe(HF.hfSchwingung(50), 4 * 50 / 7 + 24, 1e-12, 'c = 50');
});

test('R-FL: Eislast mit festem Zug, Fallprüfung P1.1–P1.3 und c_übr', () => {
  const H = P.rfl_zug.H_Ts + P.rfl_zug.H_Fd;
  nahe(HF.hfRflEislast(60, 7, 0, false, false), 7 * 3600 / (8 * H) * 1000, 1e-9, 'c = 60');
  nahe(HF.hfRflEislast(60, 7, 20, false, true), 7 * 3600 / (8 * H) * 1000 * 40 / 60, 1e-9, 'P1.2 mit c_übr');
  assert.equal(HF.hfRflEislast(60, 7, 0, true, false), 0);
  assert.equal(HF.hfRflEislast(60, 7, 10, false, false), 0);
});

test('Bahnübergang: Mindesthöhe + Zuschläge, ohne Gleishebung und Schwingung, mit Hinweisen', () => {
  const r = HF.hfBerechnen({ ...FALL, bue: true });
  assert.equal(r.min.absolut, P.bue_min);
  nahe(r.min.wert, P.bue_min + r.min.summe, 1e-9, 'hf_min BÜ');
  nahe(r.max.wert, P.bue_min + r.max.summe, 1e-9, 'hf_max BÜ');
  const z = Object.fromEntries(r.min.zeilen.map(x => [x.sym, x.wert]));
  assert.deepEqual([z.fg, z.fud], [P.gleishebung.bue, 0]);
  assert.ok(r.hinweise.includes('hf.w.bue'));
  assert.ok(r.hinweise.includes('hf.w.buenfl'));
});

test('Eingabeprüfung: Spannweite, Temperatur, Zusatzlast nur bei −5 °C, N-FL-Zugkräfte', () => {
  assert.equal(HF.HF_SPANNWEITEN.length, 40);
  assert.ok(HF.hfBerechnen({ ...FALL, c: 25 }).fehler.includes('hf.err.c'));
  assert.ok(HF.hfBerechnen({ ...FALL, Tmin: 12 }).fehler.includes('hf.err.t.min'));
  assert.ok(HF.hfBerechnen({ ...FALL, Tmax: 0 }).fehler.includes('hf.err.zlt.max'));
  assert.ok(HF.hfBerechnen({ ...FALL, zlMin: 10 }).fehler.includes('hf.err.zl.min'));
  assert.ok(HF.hfBerechnen({ ...FALL, nfl: null }).fehler.includes('hf.err.nfl'));
  assert.equal(HF.hfBerechnen({ ...FALL, c: 25 }).min, null);
  const rfl = { ...FALL, typ: 'rfl', nfl: null };
  assert.ok(HF.hfBerechnen({ ...rfl, p12: true, cUebr: 0 }).hinweise.includes('hf.w.p12j'));
  assert.ok(HF.hfBerechnen({ ...rfl, cUebr: 5 }).hinweise.includes('hf.w.p12n'));
  assert.ok(HF.hfBerechnen({ ...rfl, p11: true, cUebr: 5 }).hinweise.includes('hf.w.p11'));
  assert.ok(HF.hfBerechnen({ ...rfl, cUebr: 31 }).fehler.includes('hf.err.cuebr'));
  const ueber = Math.ceil((P.t_hinweis + 1) / 5) * 5;
  assert.ok(HF.hfBerechnen({ ...FALL, Tmin: ueber, zlMin: 0 }).hinweise.includes('hf.w.t56'));
  assert.ok(!HF.hfBerechnen({ ...FALL, Tmin: 40, zlMin: 0 }).hinweise.includes('hf.w.t56'));
});
