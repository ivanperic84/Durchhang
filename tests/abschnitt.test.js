// Tests für abschnitt.js — Masttabelle (CSV), Feldlängen, Lastfälle, Abstandsprüfung
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../abschnitt.js');

const nahe = (ist, soll, tol, text) =>
  assert.ok(Math.abs(ist - soll) <= tol, `${text}: ist ${ist}, soll ${soll} (±${tol})`);

test('Lastfälle: Vorgabe −20 / +80 °C, Eis bei −5 °C, neu und abgenutzt', () => {
  const lf = A.lastfaelle(null, 'nfl');
  assert.deepEqual(lf, [
    { T: -20, zl: 0, abgenutzt: false }, { T: 80, zl: 0, abgenutzt: false }, { T: -5, zl: 15, abgenutzt: false },
    { T: -20, zl: 0, abgenutzt: true },  { T: 80, zl: 0, abgenutzt: true },  { T: -5, zl: 15, abgenutzt: true },
  ]);
  // Einzelleiter: keine Abnutzung
  assert.equal(A.lastfaelle(null, 'el').filter(f => f.abgenutzt).length, 0);
});

test('Lastfälle frei je System: Temperaturen, Eis aus, sortiert und ohne Doppel', () => {
  const einst = { nfl: { temperaturen: [40, -20, 40, 0], eis: false, abnutzung: false } };
  assert.deepEqual(A.lastfaelle(einst, 'nfl').map(f => f.T), [-20, 0, 40]);
  // andere Systeme behalten ihre Vorgabe
  assert.equal(A.lastfaelle(einst, 'rfl').length, 6);
  // Eis ohne Last (Z_L = 0) ergibt keinen Eisfall
  assert.equal(A.lastfaelle({ el: { zl: 0 } }, 'el').some(f => f.zl > 0), false);
});

test('Eislast nach Höhenlage: unter 1000 m ü. M. 7 N/m, darüber 15 N/m', () => {
  assert.equal(A.lastfallEinstellung(null, 'nfl').zl, 15);
  assert.equal(A.lastfallEinstellung(null, 'nfl').hoehenlage, 'ueber');
  assert.equal(A.lastfallEinstellung({ nfl: { hoehenlage: 'unter' } }, 'nfl').zl, 7);
  assert.equal(A.lastfallEinstellung({ rfl: { hoehenlage: 'ueber' } }, 'rfl').zl, 15);
  // ausdrücklich eingetragener Wert geht vor
  assert.equal(A.lastfallEinstellung({ el: { hoehenlage: 'unter', zl: 10 } }, 'el').zl, 10);
  assert.ok(A.lastfaelle({ nfl: { hoehenlage: 'unter' } }, 'nfl').some(f => f.T === -5 && f.zl === 7));
});

test('Temperaturliste aus Text', () => {
  assert.deepEqual(A.temperaturenLesen('−20; 80'), [-20, 80]);
  assert.deepEqual(A.temperaturenLesen('-20, 0 40,80'), [-20, 0, 40, 80]);
  assert.deepEqual(A.temperaturenLesen('abc; 10'), [10]);
});

test('Abstand zu waagrechter Unterkante von–bis: kleinster Abstand im Bereich', () => {
  const waagrecht = (hoehe, von, bis, uk, L) => A.abstandHindernis(hoehe, [{ x: von, h: uk }, { x: bis, h: uk }], true, L);
  // Parabel mit Tiefpunkt in der Mitte: höchste Leiterlage an den Rändern
  const hoehe = x => 7 - 0.002 * x * (40 - x);
  const r = waagrecht(hoehe, 0, 10, 8, 40);
  nahe(r.abstand, 1, 1e-9, 'am Mast');
  assert.equal(r.x, 0);
  const m = waagrecht(hoehe, 15, 25, 8, 40);
  nahe(m.abstand, 8 - hoehe(15), 1e-9, 'Bereichsrand massgebend');
  // Bereich ausserhalb des Felds wird abgeschnitten
  nahe(waagrecht(hoehe, -5, 2, 8, 40).x, 0, 1e-9, 'links begrenzt');
  assert.equal(waagrecht(hoehe, 50, 60, 8, 40), null);
  // von/bis vertauscht
  nahe(waagrecht(hoehe, 10, 0, 8, 40).abstand, 1, 1e-9, 'vertauscht');
});

test('Hindernis aus Punkten: Reihenfolge egal, verbunden nach x sortiert', () => {
  const hoehe = () => 7;                        // Leiter waagrecht auf 7 m
  const punkte = [{ x: 20, h: 9 }, { x: 10, h: 8 }, { x: 15, h: 7.5 }];   // ungeordnet
  const v = A.abstandHindernis(hoehe, punkte, true, 40);
  nahe(v.abstand, 0.5, 1e-9, 'tiefster Knick');
  assert.equal(v.x, 15);
  assert.deepEqual(A.hindernisPunkte(punkte).map(p => p.x), [10, 15, 20]);
  // Zwischenwert auf der Geraden 10→15: bei x = 12.5 → 7.75
  nahe(A.unterkanteBei(A.hindernisPunkte(punkte), 12.5), 7.75, 1e-12, 'Interpolation');
  // Nicht verbunden: nur die Punkte selbst
  const e = A.abstandHindernis(x => 6 + 0.1 * x, punkte, false, 40);
  nahe(e.abstand, 7.5 - 7.5, 1e-9, 'Punkt bei x = 15');
  // Punkte ausserhalb des Felds zählen nicht; Linie wird am Feldrand abgeschnitten
  assert.equal(A.abstandHindernis(hoehe, [{ x: 50, h: 8 }], false, 40), null);
  const r = A.abstandHindernis(hoehe, [{ x: -10, h: 8 }, { x: 10, h: 10 }], true, 40);
  assert.equal(r.x, 0); nahe(r.uk, 9, 1e-9, 'Unterkante am Feldanfang');
  // Senkrechter Sprung: am gleichen x gilt der tiefere Punkt
  nahe(A.unterkanteBei(A.hindernisPunkte([{ x: 5, h: 9 }, { x: 5, h: 8 }, { x: 10, h: 9 }]), 5), 8, 1e-12, 'Sprung');
  // unvollständige Punkte werden übergangen
  assert.equal(A.abstandHindernis(hoehe, [{ x: 5, h: null }], true, 40), null);
});

test('Hindernis: frühere Form von–bis–Unterkante wird in Punkte übernommen', () => {
  assert.deepEqual(A.hindernisNormieren({ name: 'B', feld: 1, von: 10, bis: 20, uk: 508.3 }),
    { name: 'B', feld: 1, verbinden: true, punkte: [{ x: 10, h: 508.3 }, { x: 20, h: 508.3 }] });
  assert.equal(A.hindernisNormieren({ punkte: [{ x: 1, h: 2 }], verbinden: false }).verbinden, false);
});

test('Feldlängen aus Koordinaten, KM oder Eingabe', () => {
  const m = [
    { name: '1', e: 2600000, n: 1200000, km: '12.300' },
    { name: '2', e: 2600030, n: 1200040, km: '12.350' },
    { name: '3', e: null, n: null, km: '12.395', L: 38 },
    { name: '4', e: null, n: null, km: '' },
    { name: '5', e: null, n: null, km: '' },
  ];
  const f = A.feldLaengen(m);
  assert.deepEqual(f.map(x => x.quelle), ['koord', 'km', 'eingabe', null]);
  nahe(f[0].L, 50, 1e-9, 'Koordinaten');
  nahe(f[1].L, 45, 1e-6, 'KM');
  assert.equal(f[2].L, 38);
  assert.equal(f[3].L, null);
  assert.equal(A.kmInMeter('12+345'), 12345);
  assert.equal(A.kmInMeter('abc'), null);
});

test('Mittelspannweite arithmetisch und ideell', () => {
  nahe(A.mittelspannweite([40, 50, 60], 'arith'), 50, 1e-12, 'arith');
  nahe(A.mittelspannweite([40, 50, 60], 'ruling'), Math.sqrt((40 ** 3 + 50 ** 3 + 60 ** 3) / 150), 1e-12, 'ideell');
  assert.equal(A.mittelspannweite([null]), null);
});

test('Z = SOK am Mast; Mastfuss = SOK + Δ (freiwillig); Umrechnung bisheriger Daten', () => {
  assert.equal(A.mastSok({ z: 500, delta: 0.3 }), 500);
  assert.equal(A.mastSok({ z: 500, delta: null }), 500);
  assert.equal(A.mastSok({ z: null }), null);
  nahe(A.mastFuss({ z: 499.7, delta: 0.3 }), 500, 1e-12, 'Mastfuss');
  assert.equal(A.mastFuss({ z: 499.7, delta: null }), null);
  // Bis v4.4: Z = Mastfuss → SOK = Z − Δ; ohne Δ bleibt Z
  assert.deepEqual(A.mastenAusMastfuss([{ name: '1', z: 500, delta: 0.3 }, { name: '2', z: 501, delta: null }]).map(m => m.z), [499.7, 501]);
});

test('CSV im bisherigen Format (Z_Mastfuss): SOK = Z − Δ, mit Hinweis', () => {
  const alt = A.csvLesen('Mast;E;N;Z_Mastfuss;Delta_Mastfuss_SOK;h_ueber_SOK;KM\n101;2600000;1200000;540;0.35;7.6;12.300\n102;2600050;1200001;540.4;;7.6;12.350\n');
  assert.deepEqual(alt.masten.map(m => [m.z, m.delta]), [[539.65, 0.35], [540.4, null]]);
  assert.ok(alt.warnungen.includes('zmastfuss'));
  assert.ok(!('zmf' in alt.masten[0]));
  // Beide Spalten: Z_SOK gilt, Δ wird aus dem Mastfuss ergänzt
  const beide = A.csvLesen('Mast;E;N;Z_SOK;Z_Mastfuss;h\n1;2600000;1200000;499.7;500;7\n2;2600040;1200000;500;;7\n');
  assert.deepEqual(beide.masten.map(m => [m.z, m.delta]), [[499.7, 0.3], [500, null]]);
  assert.ok(!beide.warnungen.includes('zmastfuss'));
  // Neue Vorlage: Kopf Z_SOK
  assert.match(A.csvVorlage(), /Strang;Mast;E;N;Z_SOK;Delta_Mastfuss_SOK;/);
});

test('CSV: Vorlage lesen und wieder schreiben ergibt dieselben Masten', () => {
  // Vorlage mit Spalte «Strang»: FL1 und SPL an denselben 3 Masten
  const { masten, warnungen } = A.csvLesen(A.csvVorlage());
  assert.equal(masten.length, 6);
  assert.deepEqual(warnungen, []);
  assert.deepEqual(masten[0], { name: '101', e: 2600000, n: 1200000, z: 499.7, delta: 0.3, h: 7, km: '12.300', L: null, strang: 'FL1' });
  const g = A.straengeAusMasten(masten);
  assert.deepEqual(g.straenge.map(s => [s.kennung, s.masten.length]), [['FL1', 3], ['SPL', 3]]);
  assert.deepEqual(g.abweichungen, []);
  const zurueck = A.straengeAusMasten(A.csvLesen(A.csvSchreibenStraenge(g.straenge)).masten).straenge;
  assert.deepEqual(zurueck, g.straenge);
  const ohne = A.csvLesen(A.csvSchreiben(g.straenge[0].masten)).masten;
  assert.deepEqual(ohne, g.straenge[0].masten);
});

test('CSV aus Vermessung: Komma-Dezimal, Tausendertrenner, andere Kopfzeilen, Tab', () => {
  const text = 'Punkt;Y;X;Höhe;h über SOK\n'
             + "M12;2'600'000,50;1'200'000,25;500,00;7,00\n"
             + 'M13;2 600 030,00;1 200 033,90;501,20;7,10\n';
  const { masten } = A.csvLesen(text);
  assert.deepEqual(masten.map(m => [m.name, m.e, m.n, m.z, m.h]),
    [['M12', 2600000.5, 1200000.25, 500, 7], ['M13', 2600030, 1200033.9, 501.2, 7.1]]);
  const tab = A.csvLesen('Mast\tE\tN\n1\t2600000\t1200000\n2\t2600040\t1200000\n');
  assert.equal(tab.masten[1].e, 2600040);
  assert.ok(tab.warnungen.some(w => w.startsWith('h:')));   // Höhe fehlt → Hinweis
});

test('CSV ohne Kopfzeile: feste Reihenfolge wie Vorlage', () => {
  const { masten } = A.csvLesen('1,2600000,1200000,500,0.3,7,12.3\n2,2600040,1200000,501,0.3,7.2,12.34\n');
  assert.deepEqual(masten[1], { name: '2', e: 2600040, n: 1200000, z: 501, delta: 0.3, h: 7.2, km: '12.34', L: null });
});

test('Einzelleiter über einem Hindernis: Lage automatisch, Abstand Leiter − Oberkante', () => {
  // Leiter: Parabel, tiefster Punkt 6.65 m in Feldmitte (L = 45 m), Aufhängung 7.00 m
  const L = 45, hoehe = x => 6.65 + 0.35 * ((x - 22.5) / 22.5) ** 2;
  const unten = [{ x: 10, h: 6.3 }, { x: 32.8, h: 6.2 }];
  assert.equal(A.hindernisSeite(hoehe, unten, L), 'unten');
  assert.equal(A.hindernisSeite(hoehe, [{ x: 10, h: 7.5 }], L), 'oben');
  assert.equal(A.hindernisSeite(hoehe, [{ x: 10, h: 6.0 }, { x: 30, h: 7.5 }], L), 'oben', 'kreuzt → oben');
  // Unterhalb: kleinster Abstand dort, wo Leiter und Oberkante am nächsten sind
  const r = A.abstandHindernis(hoehe, unten, true, L, true);
  const erwartet = Math.min(...Array.from({ length: 2281 }, (_, i) => {
    const x = 10 + 22.8 * i / 2280, k = 6.3 + (6.2 - 6.3) * (x - 10) / 22.8; return hoehe(x) - k;
  }));
  assert.ok(Math.abs(r.abstand - erwartet) < 1e-3, `${r.abstand} ≈ ${erwartet}`);
  assert.ok(r.abstand > 0.3 && r.abstand < 0.4);
  // Oberhalb (bisher): gleiche Punkte ergeben einen negativen Abstand
  assert.ok(A.abstandHindernis(hoehe, unten, true, L).abstand < 0);
  // Senkrechter Sprung: oberhalb gilt der tiefere, unterhalb der höhere Punkt
  const P = A.hindernisPunkte([{ x: 5, h: 6 }, { x: 5, h: 6.4 }, { x: 8, h: 6.2 }]);
  assert.equal(A.kanteBei(P, 5, false), 6);
  assert.equal(A.kanteBei(P, 5, true), 6.4);
  // Einzelpunkte unterhalb
  const e = A.abstandHindernis(hoehe, unten, false, L, true);
  assert.ok(Math.abs(e.abstand - Math.min(hoehe(10) - 6.3, hoehe(32.8) - 6.2)) < 1e-9);
});

test('Beispielabschnitt: 5 Masten mit Koordinaten, Felder 45–50 m, SOK je Mast', () => {
  const m = A.beispielMasten();
  assert.equal(m.length, 5);
  const L = A.feldLaengen(m);
  assert.deepEqual(L.map(f => f.quelle), ['koord', 'koord', 'koord', 'koord']);
  L.forEach(f => assert.ok(f.L > 44.9 && f.L < 50.1, String(f.L)));
  m.forEach(x => assert.ok(A.mastSok(x) !== null));
});

test('Stränge: CSV mit Kennung wird je Strang gruppiert, Abweichungen bei Z/Δ/KM gemeldet', () => {
  const txt = 'Strang;Mast;E;N;Z_Mastfuss;Delta_Mastfuss_SOK;h_ueber_SOK;KM\n'
    + 'FL1;101;2600000;1200000;540;0.35;7.6;12.300\nSPL;101;2600002.1;1200000.4;540;0.35;9.2;12.300\n'
    + 'FL1;102;2600050;1200001;540.4;0.3;7.6;12.350\nSPL;102;2600052;1200001.4;540.5;0.3;9.2;12.350\n';
  const { straenge, abweichungen } = A.straengeAusMasten(A.csvLesen(txt).masten);
  assert.deepEqual(straenge.map(s => [s.kennung, s.masten.map(m => m.name)]), [['FL1', ['101', '102']], ['SPL', ['101', '102']]]);
  assert.equal(straenge[1].masten[0].h, 9.2);
  assert.ok(!('strang' in straenge[0].masten[0]));
  assert.deepEqual(abweichungen, ['102']);   // Z 540.4 ↔ 540.5
  // Ohne Spalte «Strang»: ein Strang ohne Kennung (bisheriges Format)
  const eins = A.straengeAusMasten(A.csvLesen(A.csvSchreiben(A.beispielMasten())).masten);
  assert.equal(eins.straenge.length, 1);
  assert.equal(eins.straenge[0].kennung, '');
});

test('Stränge: CSV schreiben und wieder lesen, Beispiel mit FL1 und SPL, Rolle aus Kennung', () => {
  const bsp = A.beispielStraenge();
  assert.deepEqual(bsp.map(s => s.kennung), ['FL1', 'SPL']);
  const zurueck = A.straengeAusMasten(A.csvLesen(A.csvSchreibenStraenge(bsp)).masten);
  assert.deepEqual(zurueck.straenge.map(s => s.masten), bsp.map(s => s.masten));
  assert.deepEqual(zurueck.abweichungen, []);
  assert.equal(A.rolleVorschlag('SPL'), 'speiseleiter');
  assert.equal(A.rolleVorschlag('RL 2'), 'rueckleiter');
  assert.equal(A.rolleVorschlag('Erdseil'), 'erdseil');
  assert.equal(A.rolleVorschlag('FL1'), 'fahrleitung');
});
