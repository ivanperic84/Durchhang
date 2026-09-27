/* Abschnitt — Abspannabschnitt (mehrere Felder) und Abstandsprüfung
 *
 * Enthält nur Logik ohne Seite (DOM): Masttabelle lesen/schreiben (CSV),
 * Feldlängen und Mittelspannweite, Lastfälle, Abstand Leiter ↔ Hindernis.
 * Die Seite (index.html) rechnet die Seillinien mit rechenkern.js und
 * übergibt sie hier als Funktionen. Prüfung ohne Browser: npm test.
 *
 * Mast:       { name, e, n, z, delta, h, km, L }   (Zahlen oder null)
 *             e/n = Aufhängepunkt (LV95), z = SOK m ü. M.,
 *             delta = Δ Mastfuss − SOK (freiwillig; Mastfuss = z + Δ, für
 *             Foto-Messung und spätere Mastmodelle), h = Aufhängehöhe über SOK,
 *             km = Kilometrierung (Text, z. B. «12.345»),
 *             L  = Feldlänge bis zum nächsten Mast (nur wenn nicht berechenbar)
 * Hindernis:  { name, feld, verbinden, punkte: [{ x, h }] } — oberhalb der Leiter
 *             (Einzelleiter auch unterhalb, siehe hindernisSeite);
 *             feld = Feldnummer (0 = erstes Feld), x im Feld [m], h in m ü. M.
 *             (Feld mit SOK) bzw. über SOK. Die Punkte haben keine feste
 *             Reihenfolge: verbunden wird immer nach x sortiert.
 *
 * Nach Änderungen an dieser Datei: CACHE_VERSION in sw.js erhöhen.
 */
'use strict';

// ── Lastfälle für die Abstandsprüfung (je Leitersystem frei einstellbar) ──
// Eislast nach Höhenlage der Strecke (von Hand gewählt): unter 1000 m ü. M.
// 7 N/m (SBB 0161.1013.0004), ab 1000 m ü. M. 15 N/m.
const EISLAST_HOEHENLAGE = { unter: 7, ueber: 15 };
const LASTFALL_VORGABE = {
  nfl: { temperaturen: [-20, 80], eis: true, hoehenlage: 'ueber', zl: 15, abnutzung: true },
  rfl: { temperaturen: [-20, 80], eis: true, hoehenlage: 'ueber', zl: 15, abnutzung: true },
  el:  { temperaturen: [-20, 80], eis: true, hoehenlage: 'ueber', zl: 15, abnutzung: false },
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
    hoehenlage: e.hoehenlage in EISLAST_HOEHENLAGE ? e.hoehenlage : v.hoehenlage,
    // Z_L: ausdrücklich eingetragener Wert, sonst der Wert der Höhenlage
    zl: e.zl !== undefined && e.zl !== null && Number.isFinite(+e.zl) && +e.zl >= 0 ? +e.zl
      : EISLAST_HOEHENLAGE[e.hoehenlage in EISLAST_HOEHENLAGE ? e.hoehenlage : v.hoehenlage],
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
// Gültige Punkte, nach x sortiert (die Eingabereihenfolge spielt keine Rolle)
function hindernisPunkte(punkte) {
  return (Array.isArray(punkte) ? punkte : [])
    .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.h))
    .map(p => ({ x: p.x, h: p.h }))
    .sort((a, b) => a.x - b.x || a.h - b.h);
}

// Kante an der Stelle x (verbundene Punkte, stückweise gerade); null ausserhalb.
// Hindernis oberhalb: Unterkante — bei gleichem x (senkrechter Sprung) der tiefere Punkt.
// Hindernis unterhalb: Oberkante — der höhere Punkt (jeweils die ungünstige Seite).
function kanteBei(P, x, oberkante = false) {
  if (!P.length || x < P[0].x || x > P[P.length - 1].x) return null;
  const wahl = oberkante ? Math.max : Math.min;
  let k = oberkante ? -Infinity : Infinity;
  for (let i = 0; i < P.length; i++) {
    if (P[i].x === x) k = wahl(k, P[i].h);
    if (i + 1 < P.length && P[i].x < x && x < P[i + 1].x)
      k = wahl(k, P[i].h + (P[i + 1].h - P[i].h) * (x - P[i].x) / (P[i + 1].x - P[i].x));
  }
  return Number.isFinite(k) ? k : null;
}
function unterkanteBei(P, x) { return kanteBei(P, x, false); }

// Lage eines Hindernisses zum Leiter (Einzelleiter): 'unten', wenn alle Punkte im Feld
// unter dem Leiter liegen (Leiter führt darüber hinweg), sonst 'oben'. Ein Hindernis, das
// den Leiter kreuzt, gilt als oberhalb — der Nachweis fällt dann ohnehin negativ aus.
function hindernisSeite(hoehe, punkte, L) {
  const P = hindernisPunkte(punkte).filter(p => p.x >= 0 && p.x <= L);
  if (!P.length) return 'oben';
  return P.every(p => p.h < hoehe(p.x)) ? 'unten' : 'oben';
}

// hoehe(x): Leiterhöhe (gleicher Bezug wie h). Liefert { abstand, x, uk } mit dem
// kleinsten Abstand innerhalb des Felds [0, L], oder null. uk = Kante des Hindernisses.
//   oberhalb (unten = false): Abstand = Unterkante − Leiter
//   unterhalb (unten = true): Abstand = Leiter − Oberkante (Einzelleiter über dem Hindernis)
//   verbinden = true:  Kante als Linie durch die nach x sortierten Punkte
//   verbinden = false: jeder Punkt einzeln (wie frühere H-Punkte)
function abstandHindernis(hoehe, punkte, verbinden, L, unten = false) {
  const P = hindernisPunkte(punkte);
  if (!P.length) return null;
  let best = null;
  const pruefe = (x, uk) => {
    const d = unten ? hoehe(x) - uk : uk - hoehe(x);
    if (!best || d < best.abstand) best = { abstand: d, x, uk };
  };
  if (!verbinden || P.length === 1) {
    for (const p of P) if (p.x >= 0 && p.x <= L) pruefe(p.x, p.h);
    return best;
  }
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1];
    const x0 = Math.max(0, a.x), x1 = Math.min(L, b.x);
    if (x1 < x0) continue;
    const n = Math.max(1, Math.ceil((x1 - x0) / 0.05));
    for (let k = 0; k <= n; k++) {
      const x = x0 + (x1 - x0) * k / n;
      pruefe(x, kanteBei(P, x, unten));
    }
  }
  return best;
}

// Frühere Formen eines Hindernisses in die Punktform überführen
function hindernisNormieren(h) {
  if (!h || typeof h !== 'object') return null;
  const zahl = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  let punkte = Array.isArray(h.punkte)
    ? h.punkte.filter(p => p && typeof p === 'object').map(p => ({ x: zahl(p.x), h: zahl(p.h) }))
    : [{ x: zahl(h.von), h: zahl(h.uk) }, { x: zahl(h.bis), h: zahl(h.uk) }];
  return {
    name: typeof h.name === 'string' ? h.name : '',
    feld: Number.isInteger(h.feld) ? h.feld : 0,
    verbinden: typeof h.verbinden === 'boolean' ? h.verbinden : true,
    punkte,
  };
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

// SOK am Mast (m ü. M.) = Z, sonst null
function mastSok(m) {
  return Number.isFinite(m.z) ? m.z : null;
}
// Mastfuss (m ü. M.) = SOK + Δ; ohne Δ unbekannt (null)
function mastFuss(m) {
  return Number.isFinite(m.z) && Number.isFinite(m.delta) ? m.z + m.delta : null;
}
// Masten aus Daten bis v4.4 (Z = Mastfuss) auf Z = SOK umrechnen: SOK = Z − Δ
function mastenAusMastfuss(masten) {
  return masten.map(m => (Number.isFinite(m.z) && Number.isFinite(m.delta) ? { ...m, z: +(m.z - m.delta).toFixed(4) } : { ...m }));
}

// ── CSV ──
const CSV_SPALTEN = ['name', 'e', 'n', 'z', 'delta', 'h', 'km', 'L'];
const CSV_KOPF = ['Mast', 'E', 'N', 'Z_SOK', 'Delta_Mastfuss_SOK', 'h_ueber_SOK', 'KM', 'L_bis_naechster'];
// Erkannte Kopfzeilen (klein, ohne Leer-/Sonderzeichen)
const CSV_ALIAS = {
  strang: ['strang', 'kennung', 'leiterkennung', 'strand', 'ligne', 'linea', 'circuit'],
  name:  ['mast', 'name', 'nr', 'mastnr', 'mastname', 'bezeichnung', 'pt', 'punkt', 'punktnr', 'point', 'mat', 'palo', 'pylone'],
  e:     ['e', 'ost', 'east', 'easting', 'rechtswert', 'y', 'elv95', 'coorde'],
  n:     ['n', 'nord', 'north', 'northing', 'hochwert', 'x', 'nlv95', 'coordn'],
  z:     ['z', 'zsok', 'sok', 'soknum', 'sokmum', 'hoehesok', 'zdrs', 'drs', 'zprf', 'prf', 'hoehe', 'hohe', 'altitude', 'quota'],
  // bis v4.4: Z = Mastfuss → beim Lesen in SOK umgerechnet
  zmf:   ['zmastfuss', 'hmastfuss', 'mastfuss', 'hoehemastfuss', 'hmum', 'zpieddemat', 'zpiededelpalo'],
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
    if (spalten.includes('strang')) m.strang = '';
    spalten.forEach((sp, j) => {
      if (!sp) return;
      if (sp === 'name' || sp === 'km' || sp === 'strang') m[sp] = w[j] ?? '';
      else m[sp] = csvZahl(w[j], trenn);
    });
    if (!m.name && m.e === null && m.h === null) return;   // leere Zeile
    if (!m.name) m.name = String(masten.length + 1);
    if ('zmf' in m) {
      // Alte Spalte «Z_Mastfuss»: SOK = Mastfuss − Δ (mit Spalte SOK: Δ ergänzen)
      if (m.z === null && m.zmf !== null) m.z = +(m.zmf - (m.delta ?? 0)).toFixed(4);
      else if (m.z !== null && m.zmf !== null && m.delta === null) m.delta = +(m.zmf - m.z).toFixed(4);
      delete m.zmf;
    }
    masten.push(m);
    if (m.h === null) warnungen.push('h:' + (i + 1));
  });
  if (spalten.includes('zmf') && !spalten.includes('z') && masten.length) warnungen.push('zmastfuss');
  return { masten, warnungen };
}

// ── Mehrere Stränge (gemeinsame Masten) ──
// Masten aus einer CSV mit Spalte «Strang» nach Kennung gruppieren (Reihenfolge
// wie in der Datei). Ohne Kennung: ein Strang. Z, Δ und KM sind Masteigenschaften
// und müssen in allen Strängen gleich sein — Abweichungen werden gemeldet.
function straengeAusMasten(masten) {
  const gruppen = new Map();
  for (const m of masten) {
    const k = String(m.strang ?? '').trim();
    if (!gruppen.has(k)) gruppen.set(k, []);
    const { strang, ...rest } = m;
    gruppen.get(k).push(rest);
  }
  const straenge = [...gruppen].map(([kennung, ms], i) => ({ kennung: kennung || (gruppen.size > 1 ? `S${i + 1}` : ''), masten: ms }));
  return { straenge, abweichungen: mastAbweichungen(straenge) };
}
// Masten (nach Name), deren Z / Δ / KM zwischen Strängen abweichen
function mastAbweichungen(straenge) {
  const ref = new Map(), aus = new Set();
  const gleich = (a, b) => (a === null || a === '' || a === undefined || b === null || b === '' || b === undefined)
    || (typeof a === 'number' ? Math.abs(a - b) < 0.0005 : String(a) === String(b));
  for (const s of straenge) for (const m of s.masten) {
    if (!ref.has(m.name)) { ref.set(m.name, m); continue; }
    const r = ref.get(m.name);
    if (!gleich(r.z, m.z) || !gleich(r.delta, m.delta) || !gleich(r.km, m.km)) aus.add(m.name);
  }
  return [...aus];
}
// Rolle aus der Kennung raten (Fahrleitung als Vorgabe)
function rolleVorschlag(kennung) {
  const k = String(kennung).toUpperCase();
  if (/SPL|SPEIS|FEED|ALIM/.test(k)) return 'speiseleiter';
  if (/(^|[^A-Z])RL|RUECK|RÜCK|RETOUR|RITORNO/.test(k)) return 'rueckleiter';
  if (/ERD|(^|[^A-Z])SL([^A-Z]|$)|PE([^A-Z]|$)|TERRE|TERRA|SCHUTZ/.test(k)) return 'erdseil';
  return 'fahrleitung';
}
// CSV mit Spalte «Strang» (alle Stränge nacheinander)
function csvSchreibenStraenge(straenge) {
  const f = v => v === null || v === undefined || v === '' ? '' : String(v).replace(/;/g, ',');
  const zeilen = [['Strang', ...CSV_KOPF].join(';')];
  for (const s of straenge) for (const m of s.masten) zeilen.push([f(s.kennung), ...CSV_SPALTEN.map(sp => f(m[sp]))].join(';'));
  return '﻿' + zeilen.join('\r\n') + '\r\n';
}

function csvSchreiben(masten) {
  const f = v => v === null || v === undefined || v === '' ? '' : String(v).replace(/;/g, ',');
  const zeilen = [CSV_KOPF.join(';')];
  for (const m of masten) zeilen.push(CSV_SPALTEN.map(sp => f(m[sp])).join(';'));
  return '﻿' + zeilen.join('\r\n') + '\r\n';
}

// Beispielabschnitt zum Ausprobieren (Reiter «Abschnitt» → «Beispiel laden»):
// 5 Masten, 4 Felder 45–50 m, leichte Kurve und Steigung, LV95 (fiktive Lage).
function beispielMasten() {
  return csvLesen(csvSchreiben([
    { name: '101', e: 2600000.000, n: 1200000.000, z: 539.650, delta: 0.35, h: 7.60, km: '12.300', L: null },
    { name: '102', e: 2600049.980, n: 1200001.400, z: 540.080, delta: 0.30, h: 7.60, km: '12.350', L: null },
    { name: '103', e: 2600099.920, n: 1200003.900, z: 540.520, delta: 0.30, h: 7.70, km: '12.400', L: null },
    { name: '104', e: 2600144.800, n: 1200007.200, z: 540.900, delta: 0.25, h: 7.60, km: '12.445', L: null },
    { name: '105', e: 2600189.600, n: 1200011.600, z: 541.200, delta: 0.30, h: 7.60, km: '12.490', L: null },
  ])).masten;
}

// Beispiel mit zwei Strängen an denselben Masten: Fahrleitung FL1 und Speiseleiter SPL
// (SPL 2 m seitlich versetzt, höher aufgehängt)
function beispielStraenge() {
  const fl = beispielMasten();
  const spl = fl.map(m => ({ ...m, e: +(m.e + 0.05).toFixed(3), n: +(m.n - 2.0).toFixed(3), h: 9.20 }));
  return [{ kennung: 'FL1', rolle: 'fahrleitung', masten: fl }, { kennung: 'SPL', rolle: 'speiseleiter', masten: spl }];
}

// Vorlage mit Spalte «Strang»: Fahrleitung FL1 und Speiseleiter SPL an denselben Masten
function csvVorlage() {
  const fl = [
    { name: '101', e: 2600000.000, n: 1200000.000, z: 499.700, delta: 0.30, h: 7.00, km: '12.300', L: null },
    { name: '102', e: 2600045.000, n: 1200001.000, z: 500.150, delta: 0.25, h: 7.00, km: '12.345', L: null },
    { name: '103', e: 2600090.000, n: 1200003.000, z: 500.700, delta: 0.20, h: 7.10, km: '12.390', L: null },
  ];
  const spl = fl.map(m => ({ ...m, n: +(m.n - 2).toFixed(3), h: 9.20 }));
  return csvSchreibenStraenge([{ kennung: 'FL1', masten: fl }, { kennung: 'SPL', masten: spl }]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LASTFALL_VORGABE, EISLAST_HOEHENLAGE, EIS_TEMPERATUR, lastfallEinstellung, lastfaelle, temperaturenLesen,
    hindernisPunkte, kanteBei, unterkanteBei, hindernisSeite, abstandHindernis, hindernisNormieren, kmInMeter, feldLaengen, mittelspannweite, mastSok, mastFuss, mastenAusMastfuss,
    csvLesen, csvSchreiben, csvVorlage, beispielMasten, CSV_KOPF,
    straengeAusMasten, mastAbweichungen, rolleVorschlag, csvSchreibenStraenge, beispielStraenge,
  };
}
