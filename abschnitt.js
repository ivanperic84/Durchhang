/* Abschnitt — Abspannabschnitt (mehrere Felder) und Abstandsprüfung
 *
 * Enthält nur Logik ohne Seite (DOM): Masttabelle lesen/schreiben (CSV),
 * Feldlängen und Mittelspannweite, Lastfälle, Abstand Leiter ↔ Hindernis.
 * Die Seite (index.html) rechnet die Seillinien mit rechenkern.js und
 * übergibt sie hier als Funktionen. Prüfung ohne Browser: npm test.
 *
 * Mast:       { name, e, n, z, delta, h, km, L }   (Zahlen oder null)
 *             e/n = Aufhängepunkt (LV95), z = Mastfuss m ü. M.,
 *             delta = Δ Mastfuss-SOK, h = Aufhängehöhe über SOK,
 *             km = Kilometrierung (Text, z. B. «12.345»),
 *             L  = Feldlänge bis zum nächsten Mast (nur wenn nicht berechenbar)
 * Hindernis:  { name, feld, von, bis, uk }  — Unterkante oberhalb der Leiter;
 *             feld = Feldnummer (0 = erstes Feld), von/bis = x im Feld [m],
 *             uk in m ü. M. (Feld mit SOK) bzw. über SOK.
 *
 * Nach Änderungen an dieser Datei: CACHE_VERSION in sw.js erhöhen.
 */
'use strict';

// ── Lastfälle für die Abstandsprüfung (je Leitersystem frei einstellbar) ──
const LASTFALL_VORGABE = {
  nfl: { temperaturen: [-20, 80], eis: true, zl: 15, abnutzung: true },
  rfl: { temperaturen: [-20, 80], eis: true, zl: 15, abnutzung: true },
  el:  { temperaturen: [-20, 80], eis: true, zl: 15, abnutzung: false },
};
const EIS_TEMPERATUR = -5;

// Einstellungen prüfen und mit Vorgaben ergänzen
function lastfallEinstellung(einst, sys) {
  const v = LASTFALL_VORGABE[sys] || LASTFALL_VORGABE.nfl;
  const e = (einst && einst[sys]) || {};
  const temps = Array.isArray(e.temperaturen)
    ? e.temperaturen.map(Number).filter(t => Number.isFinite(t) && t >= -50 && t <= 120) : v.temperaturen;
  return {
    temperaturen: [...new Set(temps)].sort((a, b) => a - b),
    eis: typeof e.eis === 'boolean' ? e.eis : v.eis,
    zl: Number.isFinite(+e.zl) && +e.zl >= 0 ? +e.zl : v.zl,
    abnutzung: sys === 'el' ? false : (typeof e.abnutzung === 'boolean' ? e.abnutzung : v.abnutzung),
  };
}

// Liste der Lastfälle: [{ T, zl, abgenutzt }]
function lastfaelle(einst, sys) {
  const e = lastfallEinstellung(einst, sys);
  const zustaende = e.abnutzung ? [false, true] : [false];
  const aus = [];
  for (const abgenutzt of zustaende) {
    for (const T of e.temperaturen) aus.push({ T, zl: 0, abgenutzt });
    if (e.eis && e.zl > 0) aus.push({ T: EIS_TEMPERATUR, zl: e.zl, abgenutzt });
  }
  return aus;
}

// Temperaturliste aus Text: «−20; 80» / «-20, 0, 40, 80»
function temperaturenLesen(text) {
  return String(text ?? '').replace(/[−–]/g, '-').split(/[;,\s]+/)
    .map(s => s.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
}

// ── Abstand Leiter ↔ Hindernis oberhalb ──
// hoehe(x): Leiterhöhe (gleicher Bezug wie uk). Liefert den kleinsten
// Abstand uk − hoehe(x) im Bereich [von, bis] ∩ [0, L] und die Stelle.
function abstandOberhalb(hoehe, von, bis, uk, L) {
  let a = Math.max(0, Math.min(von, bis)), b = Math.min(L, Math.max(von, bis));
  if (!(b >= a) || !Number.isFinite(uk)) return null;
  const n = Math.max(20, Math.ceil((b - a) / 0.05));
  let min = Infinity, xMin = a;
  for (let i = 0; i <= n; i++) {
    const x = a + (b - a) * i / n;
    const d = uk - hoehe(x);
    if (d < min) { min = d; xMin = x; }
  }
  return { abstand: min, x: xMin };
}

// ── Masttabelle ──

// KM-Text → Meter («12.345» km → 12345 m; «12+345» ebenso)
function kmInMeter(km) {
  if (km === null || km === undefined) return null;
  const s = String(km).trim().replace(/\s/g, '').replace('+', '.').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return parseFloat(s) * 1000;
}

// Feldlängen: aus Koordinaten, sonst aus KM-Differenz, sonst Eingabe L
function feldLaengen(masten) {
  const aus = [];
  for (let i = 0; i + 1 < masten.length; i++) {
    const a = masten[i], b = masten[i + 1];
    if ([a.e, a.n, b.e, b.n].every(Number.isFinite)) {
      aus.push({ L: Math.hypot(b.e - a.e, b.n - a.n), quelle: 'koord' });
      continue;
    }
    const ka = kmInMeter(a.km), kb = kmInMeter(b.km);
    if (ka !== null && kb !== null && Math.abs(kb - ka) > 0.01) {
      aus.push({ L: Math.abs(kb - ka), quelle: 'km' });
      continue;
    }
    aus.push(Number.isFinite(a.L) && a.L > 0 ? { L: a.L, quelle: 'eingabe' } : { L: null, quelle: null });
  }
  return aus;
}

// Mittelspannweite wie in der App: arithmetisch ΣL/n oder ideell √(ΣL³/ΣL)
function mittelspannweite(laengen, formel = 'arith') {
  const L = laengen.filter(l => Number.isFinite(l) && l > 0);
  if (!L.length) return null;
  if (formel === 'arith') return L.reduce((s, l) => s + l, 0) / L.length;
  return Math.sqrt(L.reduce((s, l) => s + l ** 3, 0) / L.reduce((s, l) => s + l, 0));
}

// SOK am Mast (m ü. M.) aus Z Mastfuss − Δ, sonst null
function mastSok(m) {
  return Number.isFinite(m.z) ? m.z - (Number.isFinite(m.delta) ? m.delta : 0) : null;
}

// ── CSV ──
const CSV_SPALTEN = ['name', 'e', 'n', 'z', 'delta', 'h', 'km', 'L'];
const CSV_KOPF = ['Mast', 'E', 'N', 'Z_Mastfuss', 'Delta_Mastfuss_SOK', 'h_ueber_SOK', 'KM', 'L_bis_naechster'];
// Erkannte Kopfzeilen (klein, ohne Leer-/Sonderzeichen)
const CSV_ALIAS = {
  name:  ['mast', 'name', 'nr', 'mastnr', 'mastname', 'bezeichnung', 'pt', 'punkt', 'punktnr', 'point', 'mat', 'palo', 'pylone'],
  e:     ['e', 'ost', 'east', 'easting', 'rechtswert', 'y', 'elv95', 'coorde'],
  n:     ['n', 'nord', 'north', 'northing', 'hochwert', 'x', 'nlv95', 'coordn'],
  z:     ['z', 'zmastfuss', 'hmastfuss', 'hoehe', 'hohe', 'h_mastfuss', 'mastfuss', 'hoehemastfuss', 'hmum', 'altitude', 'quota'],
  delta: ['delta', 'deltamastfusssok', 'dmastfusssok', 'dsok', 'deltasok', 'δ', 'δmastfusssok'],
  h:     ['h', 'hueber', 'hubersok', 'huebersok', 'hsok', 'aufhaengehoehe', 'aufhangehohe', 'hleiter', 'hauteur', 'altezza'],
  km:    ['km', 'kilometer', 'kilometrierung', 'pk', 'station'],
  L:     ['l', 'lbisnaechster', 'spannweite', 'feld', 'portee', 'campata', 'lbisnachster'],
};
const normKopf = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/ü/g, 'ue').replace(/[^a-z0-9δ]/g, '');

function csvTrennzeichen(zeile) {
  const z = { ';': 0, '\t': 0, ',': 0 };
  for (const c of zeile) if (c in z) z[c]++;
  return z[';'] ? ';' : z['\t'] ? '\t' : ',';
}

function csvZeileTeilen(zeile, trenn) {
  const aus = []; let feld = '', inAnf = false;
  for (let i = 0; i < zeile.length; i++) {
    const c = zeile[i];
    if (inAnf) {
      if (c === '"' && zeile[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inAnf = false;
      else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === trenn) { aus.push(feld); feld = ''; }
    else feld += c;
  }
  aus.push(feld);
  return aus.map(s => s.trim());
}

// Zahl aus CSV: «2'600'000.5», «2 600 000,5» (bei ; oder Tab als Trenner)
function csvZahl(s, trenn) {
  if (s === undefined || s === null) return null;
  let t = String(s).trim().replace(/['’\s]/g, '').replace(/[−–]/g, '-');
  if (!t) return null;
  if (trenn !== ',') t = t.replace(',', '.');
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

// Liefert { masten, warnungen }
function csvLesen(text) {
  const zeilen = String(text ?? '').replace(/^﻿/, '').split(/\r?\n/).filter(z => z.trim() !== '');
  const warnungen = [];
  if (!zeilen.length) return { masten: [], warnungen: ['leer'] };
  const trenn = csvTrennzeichen(zeilen[0]);
  const erste = csvZeileTeilen(zeilen[0], trenn);
  // Kopfzeile? — wenn mindestens zwei Spalten einen bekannten Namen tragen
  const zuordnung = erste.map(k => {
    const n = normKopf(k);
    return Object.keys(CSV_ALIAS).find(sp => CSV_ALIAS[sp].includes(n)) ?? null;
  });
  const mitKopf = zuordnung.filter(Boolean).length >= 2 && erste.some(k => csvZahl(k, trenn) === null);
  const spalten = mitKopf ? zuordnung : CSV_SPALTEN.slice(0, erste.length);
  if (mitKopf) {
    for (const p of ['e', 'n']) if (!spalten.includes(p)) warnungen.push('spalte:' + p);
  }
  const masten = [];
  zeilen.slice(mitKopf ? 1 : 0).forEach((z, i) => {
    const w = csvZeileTeilen(z, trenn);
    const m = { name: '', e: null, n: null, z: null, delta: null, h: null, km: '', L: null };
    spalten.forEach((sp, j) => {
      if (!sp) return;
      if (sp === 'name' || sp === 'km') m[sp] = w[j] ?? '';
      else m[sp] = csvZahl(w[j], trenn);
    });
    if (!m.name && m.e === null && m.h === null) return;   // leere Zeile
    if (!m.name) m.name = String(masten.length + 1);
    masten.push(m);
    if (m.h === null) warnungen.push('h:' + (i + 1));
  });
  return { masten, warnungen };
}

function csvSchreiben(masten) {
  const f = v => v === null || v === undefined || v === '' ? '' : String(v).replace(/;/g, ',');
  const zeilen = [CSV_KOPF.join(';')];
  for (const m of masten) zeilen.push(CSV_SPALTEN.map(sp => f(m[sp])).join(';'));
  return '﻿' + zeilen.join('\r\n') + '\r\n';
}

function csvVorlage() {
  return csvSchreiben([
    { name: '101', e: 2600000.000, n: 1200000.000, z: 500.000, delta: 0.30, h: 7.00, km: '12.300', L: null },
    { name: '102', e: 2600045.000, n: 1200001.000, z: 500.400, delta: 0.25, h: 7.00, km: '12.345', L: null },
    { name: '103', e: 2600090.000, n: 1200003.000, z: 500.900, delta: 0.20, h: 7.10, km: '12.390', L: null },
  ]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LASTFALL_VORGABE, EIS_TEMPERATUR, lastfallEinstellung, lastfaelle, temperaturenLesen,
    abstandOberhalb, kmInMeter, feldLaengen, mittelspannweite, mastSok,
    csvLesen, csvSchreiben, csvVorlage, CSV_KOPF,
  };
}
