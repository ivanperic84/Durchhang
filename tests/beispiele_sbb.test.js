// 27 verifizierte Beispielrechnungen der SBB
// Quelle: «Durchhang Kontrolle FACDA mit Leiter-Tool an konkreten Beispielen»
//         (Stand 26.11.2024, geprüft mit SBB «Durchhang 2026.xlsm»)
//
// Jedes Beispiel wird genau so gerechnet wie in der App (rechenkern.js).
// Verglichen wird die Tiefe des Leiters unter der Waagrechten durch den
// höheren Mast, an der Stelle x ab diesem Mast — wie Excel «y bei x».
// Bei Δh = 0 ist das der normale Durchhang unter der Sehne.
//
// Toleranz 7.5 mm: Die Sollwerte sind auf cm gerundet (±5 mm), und die Excel
// rechnet mit einer Parabel-Näherung, die App mit der exakten Kettenlinie
// (Unterschied bis 2.5 mm).
'use strict';
const test   = require('node:test');
const assert = require('node:assert/strict');
const K      = require('../rechenkern.js');

const TOLERANZ = 0.0075;   // [m]

// Kettenwerke (wie FL_COMBINATIONS in index.html, Excel Blatt «Daten»)
const KETTE = {
  '50+107': { MFL: 13.87640975, MTS: 4.0109198, E: 1.59e11, AL: 11.5e-6, AK: 4.9450e-5, qFdAbnutzung: 9.1594111 },
  '92+107': { MFL: 18.0834626,  MTS: 8.2179727, E: 1.24e11, AL: 16.2e-6, AK: 9.241e-5,  qFdAbnutzung: 9.1594111 },
  '92+150': { MFL: 22.4572285,  MTS: 8.2179727, E: 1.24e11, AL: 16.2e-6, AK: 9.240e-5,  qFdAbnutzung: 13.533177 },
};
// Einzelleiter (wie MATERIALS in index.html)
const LEITER = {
  'Ald 300': { q: 8.2670059, alpha: 23e-6, E: 5.5897905e10, AK: 301.3e-6 },
  'Cu 95':   { q: 8.4239123, alpha: 17e-6, E: 108e9,        AK: 94.77e-6 },
};

// Spalten wie in der SBB-Tabelle:
// Bsp, Typ, Berechnungsart, Kettenwerk/Leiter, Fd [%], Fd [kN], Reglage-Temp [°C],
// Ts unbelastet bzw. Leiterzug bei Reglage-Temp [kN], c_m [m], c_proj [m], Δh [m],
// Temp [°C], Schnee [N/m], Durchhang bei x [m], Soll [m]
const BEISPIELE = [
  [ 1, 'N-FL', 'Ausgleichend', '50+107', 100,  8.5,  0, 4.2, 52, 54, 1.0,  55,  0, 20, 1.23],
  [ 2, 'N-FL', 'Ausgleichend', '50+107',  70,  8.5,  0, 4.2, 52, 54, 1.0,  55,  0, 20, 1.19],
  [ 3, 'N-FL', 'Ausgleichend', '92+107', 100,  8.5, 15, 2.0, 39, 35, 0.0,  -5,  7, 15, 0.63],
  [ 4, 'N-FL', 'Ausgleichend', '92+107', 100,  8.5, 15, 2.0, 39, 35, 0.0,  -5, 15, 15, 0.66],
  [ 5, 'N-FL', 'Ausgleichend', '92+150', 100, 10.0, 10, 3.3, 49, 58, 1.3,  -5, 15, 28, 1.99],
  [ 6, 'N-FL', 'Ausgleichend', '92+150',  75, 10.0, 10, 3.3, 49, 58, 1.3,  -5, 15, 28, 1.96],
  [ 7, 'N-FL', 'Starr',        '50+107', 100,  8.5,  5, 2.4, null, 60, 1.5, -20,  0, 20, 1.39],
  [ 8, 'N-FL', 'Starr',        '50+107',  70,  8.5,  5, 2.4, null, 60, 1.5, -20,  0, 20, 1.34],
  [ 9, 'N-FL', 'Starr',        '92+107',  70,  8.5, 25, 1.9, null, 55, 1.0,  -5,  7, 25, 2.02],
  [10, 'N-FL', 'Starr',        '92+107',  70,  8.5, 25, 1.9, null, 55, 1.0,  -5, 15, 25, 2.06],
  [11, 'N-FL', 'Starr',        '92+150', 100, 10.0, 10, 3.4, null, 44, 0.0,  40,  0, 22, 0.88],
  [12, 'N-FL', 'Starr',        '92+150',  75, 10.0, 10, 3.4, null, 44, 0.0,  40,  0, 22, 0.86],
  [13, 'R-FL', null,           '92+107', 100, 10.0, null, 12, null, 42, 0.6,  -5,  7, 20, 0.69],
  [14, 'R-FL', null,           '92+107',  82, 10.0, null, 12, null, 42, 0.6,  -5,  7, 20, 0.67],
  [15, 'R-FL', null,           '92+107',  82, 10.0, null, 12, null, 42, 0.6,  -5,  7, 20, 0.67],
  [16, 'R-FL', null,           '92+107',  82, 10.0, null, 12, null, 42, 0.6,  -5, 15, 20, 0.75],
  [17, 'R-FL', null,           '92+150', 100, 10.0, null, 12, null, 55, 1.0,  -5, 15, 31, 1.51],
  [18, 'R-FL', null,           '92+150',  75, 10.0, null, 12, null, 55, 1.0,  -5, 15, 31, 1.46],
  [19, 'EL',   'Ausgleichend', 'Ald 300', null, null, 15, 2.7, 49, 58, 1.3,  -5,  7, 28, 1.71],
  [20, 'EL',   'Ausgleichend', 'Ald 300', null, null, 15, 2.7, 49, 58, 1.3,  -5, 15, 28, 1.82],
  [21, 'EL',   'Ausgleichend', 'Ald 300', null, null, 10, 2.9, 49, 58, 0.0,  40,  0, 16, 1.28],
  [22, 'EL',   'Ausgleichend', 'Ald 300', null, null,  0, 3.5, 49, 58, 0.0,  40,  0, 16, 1.26],
  [23, 'EL',   'Starr',        'Cu 95',   null, null, 15, 2.5, null, 58, 1.3, -5,  7, 28, 1.99],
  [24, 'EL',   'Starr',        'Cu 95',   null, null, 15, 2.5, null, 58, 1.3, -5, 15, 28, 2.08],
  [25, 'EL',   'Starr',        'Cu 95',   null, null, 10, 2.8, null, 58, 0.0, 40,  0, 16, 1.18],
  [26, 'EL',   'Starr',        'Cu 95',   null, null,  0, 3.5, null, 58, 0.0, 40,  0, 16, 1.07],
  [27, 'EL',   'Ausgleichend', 'Ald 300', null, null,  0, 2.8, 30, 58, 0.0,  40,  0, 16, 1.88],
];

// Tiefe unter der Waagrechten durch den höheren Mast (links, Höhe Δh), bei x
const tiefe = (kurve, dh, x) => dh - (kurve.a * Math.cosh((x - kurve.x_low) / kurve.a) + kurve.C);

// Rechnet ein Beispiel wie die App (readInputs → berechneZustaende)
function rechne([, typ, art, name, fdProzent, fdkN, Treg, Tub, c_m, c_proj, dh, T, schnee, x]) {
  const L  = c_proj;
  const Lm = art === 'Ausgleichend' && c_m ? c_m : c_proj;   // Starr: Projektspannweite
  const gemeinsam = { L, Lm, h1: dh, h2: 0, ZL: schnee, T3: null };

  if (typ === 'N-FL') {
    const kette = KETTE[name], abnutzung = 100 - fdProzent;
    const e = { ...gemeinsam, sysMode: 'nfl', flCombo: kette, wearPct: abnutzung,
                q_ges: K.mflAbgenutzt(kette, abnutzung, kette.qFdAbnutzung),
                H_Ts: K.nflBezugszustand(Tub * 1000, Treg, kette, Lm), H_Fd: fdkN * 1000,
                T1: Treg, deltaT: T - Treg, EA: kette.E * kette.AK, alpha: kette.AL };
    return tiefe(K.berechneZustaende(e).c2_vem, dh, x);   // Ts+Fd wie im Diagramm
  }
  if (typ === 'R-FL') {
    const kette = KETTE[name], abnutzung = 100 - fdProzent;
    const q_abnutzung = kette.qFdAbnutzung * abnutzung / 100;
    const e = { ...gemeinsam, sysMode: 'rfl', flCombo: kette, wearPct: abnutzung, q_abnutzung,
                q_ges: kette.MFL - q_abnutzung, H_Ts: Tub * 1000, H_Fd: fdkN * 1000,
                T1: 10, deltaT: 0, EA: null, alpha: 0 };
    return tiefe(K.berechneZustaende(e).c2, dh, x);
  }
  const leiter = LEITER[name];
  const e = { ...gemeinsam, sysMode: 'el', flCombo: null, wearPct: 0, q_ges: leiter.q,
              H_Ts: Tub * 1000, H_Fd: 0, T1: Treg, deltaT: T - Treg,
              EA: leiter.E * leiter.AK, alpha: leiter.alpha };
  return tiefe(K.berechneZustaende(e).c2, dh, x);
}

for (const b of BEISPIELE) {
  const [nr, typ, art, name, , , , , , c_proj, dh, T, schnee, x, soll] = b;
  const titel = `SBB-Beispiel ${nr}: ${typ}${art ? ' ' + art : ''}, ${name}, c = ${c_proj} m, ` +
                `Δh = ${dh} m, ${T} °C${schnee ? `, Schnee ${schnee} N/m` : ''} → y(${x} m) = ${soll} m`;
  test(titel, () => {
    const ist = rechne(b);
    assert.ok(Math.abs(ist - soll) <= TOLERANZ,
      `Durchhang bei x = ${x} m: App ${ist.toFixed(3)} m, Soll ${soll} m (±${TOLERANZ * 1000} mm)`);
  });
}
