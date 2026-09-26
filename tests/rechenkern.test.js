// Automatische Testrechnungen für rechenkern.js
// Ausführen:  npm test     (oder: node --test tests/*.test.js)
//
// Zwei Arten von Prüfungen:
//  1. Physikalische Plausibilität — gilt unabhängig von Referenzwerten
//     (z. B. Kurve geht durch beide Aufhängepunkte, ΔT = 0 ändert nichts).
//  2. Referenzfälle (referenzfaelle.json) — Ergebnisse der App, Stand v3.1.
//     Sie schützen davor, dass eine Änderung unbemerkt andere Zahlen liefert.
//     Werden Werte aus der Excel-Vorlage (Durchhang 2026.xlsm) verfügbar,
//     sollten sie dort als zusätzliche Fälle eingetragen werden.
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const K      = require('../rechenkern.js');
const FAELLE = require('./referenzfaelle.json');

const nahe = (ist, soll, tol, text) =>
  assert.ok(Math.abs(ist - soll) <= tol, `${text}: ist ${ist}, soll ${soll} (±${tol})`);

// Höhe der Kettenlinie an der Stelle x
const hoehe = (c, x) => c.a * Math.cosh((x - c.x_low) / c.a) + c.C;

test('Kettenlinie: geht durch beide Aufhängepunkte', () => {
  for (const [h1, h2] of [[7, 7], [6.5, 7.8], [8, 6]]) {
    const c = K.computeBase(45, 13.9, 5000, h1, h2);
    nahe(hoehe(c, 0),  h1, 1e-9, `Höhe links (${h1}/${h2})`);
    nahe(hoehe(c, 45), h2, 1e-9, `Höhe rechts (${h1}/${h2})`);
  }
});

test('Kettenlinie: gleich hohe Masten — Tiefpunkt in der Mitte, Durchhang ≈ q·L²/8H', () => {
  const c = K.computeBase(45, 13.9, 5000, 7, 7);
  nahe(c.x_low, 22.5, 1e-9, 'Tiefpunkt');
  nahe(c.sag, 13.9 * 45 * 45 / (8 * 5000), 0.002, 'Durchhang');
});

test('Max. Seilkraft: gleich hohe Masten = √(H² + (W/2)²)', () => {
  const c = K.computeBase(45, 13.9, 5000, 7, 7);
  nahe(c.T_max, Math.sqrt(c.H ** 2 + (c.W / 2) ** 2), 1e-6, 'T_max');
});

test('Max. Seilkraft: ungleich hohe Masten — am höheren Mast, grösser als H', () => {
  const c = K.computeBase(60, 10, 10000, 6, 12);
  const amHoeherenMast = c.H * Math.cosh((60 - c.x_low) / c.a);
  nahe(c.T_max, amHoeherenMast, 1e-6, 'T_max');
  nahe(c.T_max - c.H, 10 * (12 - c.y_low), 1e-6, 'T_max − H = q · Höhe über Tiefpunkt');
});

test('Zustandsgleichung: ΔT = 0 ändert die Zugkraft nicht', () => {
  nahe(K.solveStateEq(10, 45, 6000, 5.6e6, 17e-6, 0), 6000, 1e-6, 'H2');
});

test('Zustandsgleichung: kälter → höhere Zugkraft, wärmer → tiefere', () => {
  const H_kalt = K.solveStateEq(10, 45, 6000, 5.6e6, 17e-6, -30);
  const H_warm = K.solveStateEq(10, 45, 6000, 5.6e6, 17e-6, 60);
  assert.ok(H_kalt > 6000 && H_warm < 6000, `kalt ${H_kalt}, warm ${H_warm}`);
});

test('Zustandsgleichung: Ergebnis erfüllt die Gleichung', () => {
  const q = 10, L = 45, H1 = 6000, EA = 5.6e6, a = 17e-6, dT = -25;
  const H2 = K.solveStateEq(q, L, H1, EA, a, dT);
  const links  = (q * L) ** 2 / (24 * H2 ** 2) - H2 / EA;
  const rechts = (q * L) ** 2 / (24 * H1 ** 2) - H1 / EA + a * dT;
  nahe(links, rechts, 1e-12, 'Gleichgewicht');
});

test('N-FL Zustandsgleichung: ΔT = 0 ohne Eis → Zugkraft unverändert', () => {
  nahe(K.solveNFLStateEq(13.88, 8500, 4452, 45, 11.5e-6, 159e9, 49.45e-6, 0), 4452, 1e-3, 'H');
});

test('Belastungsgleichung: gleiche Last → gleiche Zugkraft; Hin- und Rückrechnung', () => {
  nahe(K.solveLoadingEq(1700, 4.0, 4.0, 45, 7.86e6), 1700, 1e-6, 'gleiche Last');
  const H_b = K.solveLoadingEq(1700, 4.0, 13.9, 45, 7.86e6);
  assert.ok(H_b > 1700, 'belastet muss höher sein');
  nahe(K.solveLoadingInverse(H_b, 4.0, 13.9, 45, 7.86e6), 1700, 0.01, 'Rückrechnung');
});

test('3-Punkte-Messung: aus gemessenem Durchhang die Zugkraft zurückrechnen', () => {
  for (const [dh, xC] of [[0, 22.5], [1.3, 15], [-0.8, 30]]) {
    const f = K.catSagAt(5000, 13.9, 45, dh, xC);
    nahe(K.solve3point(45, dh, 13.9, xC, f), 5000, 0.5, `dh=${dh}, x=${xC}`);
  }
});

test('Thermik ohne E·A: gleiche Seillänge → gleicher Zustand', () => {
  const c1 = K.computeBase(45, 13.9, 5000, 7, 7.5);
  const c2 = K.computeThermal(45, c1.W, c1.s, 7, 7.5);
  nahe(c2.H, c1.H, 0.01, 'H');
  nahe(c2.sag, c1.sag, 1e-6, 'Durchhang');
});

test('Eislast: wirkt nur bei −5 °C', () => {
  assert.equal(K.eislastWirksamBei(-5), true);
  for (const T of [-20, 0, 10, 80]) assert.equal(K.eislastWirksamBei(T), false);
});

test('T3-Vergleichskurve: Eis vom T2-Lastfall wirkt nicht bei T3 = 80 °C', () => {
  const e = { ...FAELLE[2].eingabe };             // N-FL, −5 °C mit Eis
  assert.ok(e.ZL > 0, 'Testfall muss Eis enthalten');
  const mitEis  = K.berechneZustaende({ ...e, T3: 80 });
  const ohneEis = K.berechneZustaende({ ...e, ZL: 0, T3: 80 });
  nahe(mitEis.c3.sag, ohneEis.c3.sag, 1e-12, 'Durchhang T3');
});

test('T3 = T2 ergibt dieselbe Kurve wie T2', () => {
  const e = FAELLE[0].eingabe;
  const r = K.berechneZustaende({ ...e, T3: e.T1 + e.deltaT });
  nahe(r.c3.sag, r.c2.sag, 1e-12, 'Durchhang');
  nahe(r.c3.H,   r.c2.H,   1e-9,  'Zugkraft');
});

test('R-FL: ohne Eis bleibt der Zustand gleich (konstante Zugkraft)', () => {
  const e = { ...FAELLE[3].eingabe, ZL: 0 };
  const r = K.berechneZustaende(e);
  assert.equal(r.c2, r.c1);
});

test('Fehler im Zielzustand werden mit Phase gemeldet', () => {
  const e = { ...FAELLE[4].eingabe, EA: null, alpha: 1, deltaT: -2 };  // Seil kürzer als Spannweite
  assert.throws(() => K.berechneZustaende(e), err => err.phase === 'c2');
});

for (const fall of FAELLE) {
  test(`Referenzfall: ${fall.name}`, () => {
    const r = K.berechneZustaende(fall.eingabe);
    const s = fall.erwartet;
    nahe(r.c1.sag,   s.f1,    5e-4, 'Durchhang T1 [m]');
    nahe(r.c2.sag,   s.f2,    5e-4, 'Durchhang T2 [m]');
    nahe(r.c2.H,     s.H2,    0.5,  'Zugkraft T2 [N]');
    nahe(r.c2.T_max, s.Tmax2, 0.5,  'Max. Seilkraft T2 [N]');
  });
}

// ── R-FL: Fahrdrahtlage wie SBB-Excel (Blatt RFL, VEM-Formel 7.53a) ──
test('R-FL Fahrdraht: ohne Eis und Abnutzung in der Solllage, Temperatur ohne Wirkung', () => {
  const basis = { sysMode: 'rfl', L: 45, Lm: 45, H_Ts: 12000, H_Fd: 10000, h1: 7, h2: 7,
                  T1: 10, q_ges: 13.8764, EA: 1e7, alpha: 1.7e-5, ZL: 0, T3: null };
  for (const deltaT of [-30, 0, 70]) {
    const r = K.berechneZustaende({ ...basis, deltaT });
    for (const x of [5, 22.5, 40])
      assert.equal(K.rflFahrdrahtVerschiebung(r.c2, r.c_fd_ref, x), 0);
  }
});

test('R-FL Fahrdraht: Eislast senkt Tragseil und Fahrdraht gemeinsam um L²/8·ZL/(H_Ts+H_Fd)', () => {
  const e = { sysMode: 'rfl', L: 45, Lm: 45, H_Ts: 12000, H_Fd: 10000, h1: 7, h2: 7,
              T1: 10, deltaT: -15, q_ges: 13.8764, EA: 1e7, alpha: 1.7e-5, ZL: 15, T3: null };
  const r = K.berechneZustaende(e);
  const dy = K.rflFahrdrahtVerschiebung(r.c2, r.c_fd_ref, 22.5);
  nahe(dy, -(45 ** 2) / 8 * 15 / (12000 + 10000), 0.002, 'Absenkung Feldmitte');
  assert.equal(K.rflFahrdrahtVerschiebung(r.c2, r.c_fd_ref, 0), 0);   // Aufhängepunkte fest
});

test('R-FL Fahrdraht: Abnutzung hebt das Kettenwerk leicht an', () => {
  const e = { sysMode: 'rfl', L: 45, Lm: 45, H_Ts: 12000, H_Fd: 10000, h1: 7, h2: 7,
              T1: 10, deltaT: -15, q_ges: 13.8764 - 2.7, q_abnutzung: 2.7, EA: 1e7, alpha: 1.7e-5, ZL: 0, T3: null };
  const r = K.berechneZustaende(e);
  const dy = K.rflFahrdrahtVerschiebung(r.c2, r.c_fd_ref, 22.5);
  nahe(dy, (45 ** 2) / 8 * 2.7 / (12000 + 10000), 0.002, 'Anhebung Feldmitte');
});
