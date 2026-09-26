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

test('Temperaturliste aus Text', () => {
  assert.deepEqual(A.temperaturenLesen('−20; 80'), [-20, 80]);
  assert.deepEqual(A.temperaturenLesen('-20, 0 40,80'), [-20, 0, 40, 80]);
  assert.deepEqual(A.temperaturenLesen('abc; 10'), [10]);
});

test('Abstand zu Hindernis oberhalb: kleinster Abstand im Bereich', () => {
  // Parabel mit Tiefpunkt in der Mitte: höchste Leiterlage an den Rändern
  const hoehe = x => 7 - 0.002 * x * (40 - x);
  const r = A.abstandOberhalb(hoehe, 0, 10, 8, 40);
  nahe(r.abstand, 1, 1e-9, 'am Mast');
  assert.equal(r.x, 0);
  const m = A.abstandOberhalb(hoehe, 15, 25, 8, 40);
  nahe(m.abstand, 8 - hoehe(15), 1e-9, 'Bereichsrand massgebend');
  // Bereich ausserhalb des Felds wird abgeschnitten
  nahe(A.abstandOberhalb(hoehe, -5, 2, 8, 40).x, 0, 1e-9, 'links begrenzt');
  assert.equal(A.abstandOberhalb(hoehe, 50, 60, 8, 40), null);
  // von/bis vertauscht
  nahe(A.abstandOberhalb(hoehe, 10, 0, 8, 40).abstand, 1, 1e-9, 'vertauscht');
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

test('SOK am Mast = Z − Δ', () => {
  nahe(A.mastSok({ z: 500, delta: 0.3 }), 499.7, 1e-12, 'mit Δ');
  assert.equal(A.mastSok({ z: 500, delta: null }), 500);
  assert.equal(A.mastSok({ z: null }), null);
});

test('CSV: Vorlage lesen und wieder schreiben ergibt dieselben Masten', () => {
  const { masten, warnungen } = A.csvLesen(A.csvVorlage());
  assert.equal(masten.length, 3);
  assert.deepEqual(warnungen, []);
  assert.deepEqual(masten[0], { name: '101', e: 2600000, n: 1200000, z: 500, delta: 0.3, h: 7, km: '12.300', L: null });
  const zurueck = A.csvLesen(A.csvSchreiben(masten)).masten;
  assert.deepEqual(zurueck, masten);
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
