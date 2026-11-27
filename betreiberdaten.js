/* Betreiberdaten — Reglagetabellen, Kettenwerk-Vorgaben und hf-Parameter
 *
 * Betreiberspezifische Werte (z. B. die Reglagetabellen eines Bahnunternehmens)
 * sind nicht Teil des Programms. Sie werden als Datei (Excel .xlsx oder JSON)
 * einmal in der App geladen und im Gerät gespeichert. Ohne Datei rechnet die App
 * mit den neutralen BEISPIEL_DATEN unten (frei gewählte Grundzugkräfte, über die
 * Zustandsgleichung hergeleitet) — ausdrücklich keine Vorgabe.
 *
 * Format «durchhang-betreiberdaten», Version 1 (JSON):
 *   { format, version, titel, betreiber, stand: 'JJJJ-MM-TT', beispiel,
 *     quellen: { reglage, starr, spannweite, hf },            (freier Text)
 *     einzelleiter: { vorgabe_N,                               (Basiskraft bei −20 °C für
 *                                                               Leiter ohne eigene Tabelle)
 *       leiter: { <Leiter>: { L_ref, nach_spannweite,
 *                 varianten: [{ bezeichnung, c_max, L_ref, notiz: {de,fr,it}, werte[13] | null }] } } },
 *     kettenwerke: [{ schluessel, system: 'nfl'|'rfl', bezeichnung, tragseil, fahrdraht,
 *                     sh, H_Fd, T1, abnutzung_max,
 *                     normal: { H_Ts, quelle, werte_ub[13] | null },
 *                     starr?: { H_Ts, quelle, werte_ub[13] } }],
 *     hf: { … siehe HF_SCHLUESSEL } }
 * Werte-Reihen gelten für −20 … +40 °C in 5-K-Schritten (BD_TEMPS), in N.
 *
 * Ohne Seite (DOM) nutzbar; Prüfung ohne Browser: npm test.
 * Nach Änderungen an dieser Datei: CACHE_VERSION in sw.js erhöhen.
 */
'use strict';

const BD_FORMAT = 'durchhang-betreiberdaten';
const BD_VERSION = 1;
const BD_TEMPS = [-20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40];
const BD_SPEICHER = 'dh_betreiberdaten';

// hf-Parameter: [Gruppe, Feld, Beschreibung] — Reihenfolge = Excel-Blatt «hf»
const HF_SCHLUESSEL = [
  ['grenzlinie', 'ebv1', 'GfA Grenzlinie EBV 1 [mm]'], ['grenzlinie', 'ebv2', 'GfA Grenzlinie EBV 2 [mm]'],
  ['grenzlinie', 'ebv3', 'GfA Grenzlinie EBV 3 [mm]'], ['grenzlinie', 'ebv4', 'GfA Grenzlinie EBV 4 [mm]'],
  ['sicherheit', 'ebv1', 'k Sicherheitszuschlag EBV 1 [mm]'], ['sicherheit', 'ebv2', 'k Sicherheitszuschlag EBV 2 [mm]'],
  ['sicherheit', 'ebv3', 'k Sicherheitszuschlag EBV 3 [mm]'], ['sicherheit', 'ebv4', 'k Sicherheitszuschlag EBV 4 [mm]'],
  ['elektr_abstand', 'un25', 'be elektrischer Abstand bei 25 kV [mm]'], ['elektr_abstand', 'andere', 'be elektrischer Abstand übrige Spannungen [mm]'],
  ['gleishebung', 'schotter', 'fg Gleishebung Schotter [mm]'], ['gleishebung', 'ohne_schotter', 'fg Gleishebung ohne Schotter [mm]'],
  ['gleishebung', 'bue', 'fg Gleishebung Bahnübergang [mm]'],
  ['montagetoleranz', 'v_grenze', 'Montagetoleranz: Geschwindigkeitsgrenze [km/h]'],
  ['montagetoleranz', 'schnell', 'thu/tho Montagetoleranz über der Grenze [mm]'], ['montagetoleranz', 'langsam', 'thu/tho Montagetoleranz bis zur Grenze [mm]'],
  ['vordurchhang', 'v_max', 'fuv Vordurchhang R-FL bis Geschwindigkeit [km/h]'], ['vordurchhang', 'c_grenze', 'fuv Spannweitengrenze [m]'],
  ['vordurchhang', 'gross', 'fuv ab Spannweitengrenze [mm]'], ['vordurchhang', 'klein', 'fuv unter Spannweitengrenze [mm]'],
  ['rfl_zug', 'H_Ts', 'R-FL Tragseilzug für Eislast [N]'], ['rfl_zug', 'H_Fd', 'R-FL Fahrdrahtzug für Eislast [N]'],
  ['bue_min', null, 'Bahnübergang Mindesthöhe [mm]'],
  ['hf_max_absolut', 'lrp_ja', 'hf_max absolut mit LRP [mm]'], ['hf_max_absolut', 'lrp_nein', 'hf_max absolut ohne LRP [mm]'],
  ['anhub', null, 'fh Fahrdrahtanhub [mm]'],
  ['schwingung_oben_faktor', null, 'fudo = Faktor × fud [-]'],
  ['t_hinweis', null, 'Hinweis ab Leitertemperatur hf_min N-FL [°C]'],
];

// ── Neutrale Beispielwerte (keine Vorgabe eines Betreibers) ──
const BEISPIEL_DATEN = {
  format: BD_FORMAT, version: BD_VERSION,
  titel: 'Beispielwerte', betreiber: '', stand: '', beispiel: true,
  quellen: { reglage: '', starr: '', spannweite: '', hf: '' },
  einzelleiter: {
    vorgabe_N: 5000,
    leiter: {
      cu95: { L_ref: 45, nach_spannweite: false, varianten: [
        { bezeichnung: '5 kN', c_max: null, L_ref: null, notiz: { de: 'Beispiel 5 kN bei −20 °C', fr: 'Exemple 5 kN à −20 °C', it: 'Esempio 5 kN a −20 °C' },
          werte: [5000, 4600, 4200, 3900, 3700, 3400, 3200, 3000, 2900, 2800, 2600, 2500, 2400] },
        { bezeichnung: '7 kN', c_max: null, L_ref: null, notiz: { de: 'Beispiel 7 kN bei −20 °C', fr: 'Exemple 7 kN à −20 °C', it: 'Esempio 7 kN a −20 °C' },
          werte: [7000, 6400, 5800, 5300, 4900, 4500, 4100, 3800, 3600, 3400, 3200, 3000, 2900] },
      ] },
      aldrey300: { L_ref: null, nach_spannweite: true, varianten: [
        { bezeichnung: 'c ≤ 35 m', c_max: 35, L_ref: 30, notiz: { de: 'Beispiel 5 kN (c ≤ 35 m)', fr: 'Exemple 5 kN (c ≤ 35 m)', it: 'Esempio 5 kN (c ≤ 35 m)' },
          werte: [5000, 4000, 3300, 2800, 2500, 2200, 2000, 1900, 1800, 1700, 1600, 1500, 1400] },
        { bezeichnung: 'c > 35 m', c_max: null, L_ref: 45, notiz: { de: 'Beispiel 5 kN (c > 35 m)', fr: 'Exemple 5 kN (c > 35 m)', it: 'Esempio 5 kN (c > 35 m)' },
          werte: [5000, 4300, 3800, 3500, 3200, 2900, 2700, 2500, 2400, 2300, 2200, 2100, 2000] },
      ] },
    },
  },
  kettenwerke: [
    { schluessel: 'bsp_nfl_stcu50_cu107', system: 'nfl', bezeichnung: 'StCu 50 + Cu 107 · Beispiel', tragseil: 'stcu50', fahrdraht: 'cu107',
      sh: 2.0, H_Fd: 9000, T1: 10, abnutzung_max: 30,
      normal: { H_Ts: 4200, quelle: '', werte_ub: [2000, 1900, 1800, 1700, 1600, 1500, 1500, 1400, 1400, 1300, 1300, 1200, 1200] },
      starr:  { H_Ts: 3600, quelle: '', werte_ub: [3500, 3100, 2800, 2400, 2100, 1900, 1700, 1500, 1400, 1300, 1200, 1100, 1000] } },
    { schluessel: 'bsp_nfl_stcu92_cu150', system: 'nfl', bezeichnung: 'StCu 92 + Cu 150 · Beispiel', tragseil: 'stcu92', fahrdraht: 'cu150',
      sh: 2.2, H_Fd: 10000, T1: 10, abnutzung_max: 25,
      normal: { H_Ts: 5600, quelle: '', werte_ub: [3000, 2900, 2700, 2600, 2500, 2400, 2300, 2200, 2200, 2100, 2000, 2000, 1900] },
      starr:  { H_Ts: 4700, quelle: '', werte_ub: [4500, 3900, 3400, 3000, 2700, 2400, 2200, 2000, 1900, 1700, 1600, 1600, 1500] } },
    { schluessel: 'bsp_rfl_stcu92_cu107', system: 'rfl', bezeichnung: 'StCu 92 + Cu 107 · Beispiel', tragseil: 'stcu92', fahrdraht: 'cu107',
      sh: 1.4, H_Fd: 9000, T1: 10, abnutzung_max: 20,
      normal: { H_Ts: 10000, quelle: '', werte_ub: null } },
    { schluessel: 'bsp_rfl_stcu92_cu150', system: 'rfl', bezeichnung: 'StCu 92 + Cu 150 · Beispiel', tragseil: 'stcu92', fahrdraht: 'cu150',
      sh: 1.5, H_Fd: 11000, T1: 10, abnutzung_max: 25,
      normal: { H_Ts: 11000, quelle: '', werte_ub: null } },
  ],
  hf: {
    grenzlinie: { ebv1: 4500, ebv2: 4600, ebv3: 4600, ebv4: 4800 },
    sicherheit: { ebv1: 50, ebv2: 0, ebv3: 0, ebv4: 0 },
    elektr_abstand: { un25: 250, andere: 150 },
    gleishebung: { schotter: 80, ohne_schotter: 50, bue: 0 },
    montagetoleranz: { v_grenze: 160, schnell: 10, langsam: 20 },
    vordurchhang: { v_max: 160, c_grenze: 40, gross: 40, klein: 20 },
    rfl_zug: { H_Ts: 10000, H_Fd: 9000 },
    bue_min: 5500,
    hf_max_absolut: { lrp_ja: 6000, lrp_nein: 6200 },
    anhub: 80,
    schwingung_oben_faktor: 0.8,
    t_hinweis: 60,
  },
};

// ── Hilfen ──
const _bdZahl = v => (typeof v === 'number' && Number.isFinite(v)) ? v
  : (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v.replace(/['’\s]/g, '').replace(',', '.'))))
    ? Number(v.replace(/['’\s]/g, '').replace(',', '.')) : null;
const _bdText = v => (v == null ? '' : String(v)).trim();
const _bdLeer = v => v == null || (typeof v === 'string' && v.trim() === '');

// Text in der Sprache (Notizen sind { de, fr, it } oder ein einfacher Text)
function bdNotiz(n, sprache = 'de') {
  if (!n) return '';
  if (typeof n === 'string') return n;
  return n[sprache] || n.de || n.fr || n.it || '';
}

// Werte-Reihe prüfen: 13 positive Zahlen oder null
function _bdReihe(werte, wo, fehler, pflicht) {
  if (werte == null || (Array.isArray(werte) && werte.every(_bdLeer))) {
    if (pflicht) fehler.push(`${wo}: Werte −20 … +40 °C fehlen`);
    return null;
  }
  if (!Array.isArray(werte) || werte.length !== BD_TEMPS.length) { fehler.push(`${wo}: ${BD_TEMPS.length} Werte (−20 … +40 °C) erwartet`); return null; }
  const z = werte.map(_bdZahl);
  const i = z.findIndex(v => v == null || v <= 0);
  if (i >= 0) { fehler.push(`${wo}: Wert bei ${BD_TEMPS[i]} °C fehlt oder ist nicht positiv`); return null; }
  return z;
}

// ── Prüfen und vereinheitlichen ──
// pruef = { leiter: k => bool, kombination: (ts, fd) => bool }  (optional)
// Rückgabe { daten, fehler: [Text] } — daten nur ohne Fehler.
function bdPruefen(roh, pruef = {}) {
  const fehler = [];
  if (!roh || typeof roh !== 'object') return { daten: null, fehler: ['Keine gültigen Daten.'] };
  if (roh.format !== BD_FORMAT) fehler.push(`Unbekanntes Format (erwartet «${BD_FORMAT}»).`);
  if (Number(roh.version) !== BD_VERSION) fehler.push(`Version ${roh.version} wird nicht unterstützt (erwartet ${BD_VERSION}).`);
  const d = {
    format: BD_FORMAT, version: BD_VERSION,
    titel: _bdText(roh.titel) || 'Betreiberdaten',
    betreiber: _bdText(roh.betreiber), stand: _bdText(roh.stand), beispiel: roh.beispiel === true,
    quellen: {}, einzelleiter: { vorgabe_N: null, leiter: {} }, kettenwerke: [], hf: {},
  };
  if (d.stand && !/^\d{4}-\d{2}-\d{2}$/.test(d.stand)) fehler.push('Stand: Datum als JJJJ-MM-TT angeben.');
  for (const k of ['reglage', 'starr', 'spannweite', 'hf']) d.quellen[k] = _bdText(roh.quellen?.[k]);

  // Einzelleiter
  const el = roh.einzelleiter || {};
  d.einzelleiter.vorgabe_N = _bdZahl(el.vorgabe_N);
  if (!(d.einzelleiter.vorgabe_N > 0)) fehler.push('Einzelleiter: Vorgabe-Basiskraft (N) fehlt.');
  for (const [k, l] of Object.entries(el.leiter || {})) {
    if (pruef.leiter && !pruef.leiter(k)) { fehler.push(`Einzelleiter: Leiter «${k}» ist unbekannt.`); continue; }
    const varianten = (l.varianten || []).map((v, i) => {
      const wo = `Einzelleiter ${k}${v.bezeichnung ? ' «' + v.bezeichnung + '»' : ' Variante ' + (i + 1)}`;
      const c_max = _bdLeer(v.c_max) ? null : _bdZahl(v.c_max);
      const L_ref = _bdLeer(v.L_ref) ? null : _bdZahl(v.L_ref);
      if (!_bdLeer(v.c_max) && !(c_max > 0)) fehler.push(`${wo}: c_max ungültig.`);
      if (!_bdLeer(v.L_ref) && !(L_ref > 0)) fehler.push(`${wo}: L_ref ungültig.`);
      const notiz = typeof v.notiz === 'string' ? { de: v.notiz } : {};
      if (v.notiz && typeof v.notiz === 'object') for (const s of ['de', 'fr', 'it']) if (_bdText(v.notiz[s])) notiz[s] = _bdText(v.notiz[s]);
      return { bezeichnung: _bdText(v.bezeichnung), c_max, L_ref, notiz: Object.keys(notiz).length ? notiz : null,
               werte: _bdReihe(v.werte, wo, fehler, false) };
    });
    if (!varianten.length) { fehler.push(`Einzelleiter ${k}: keine Variante.`); continue; }
    const L_ref = _bdLeer(l.L_ref) ? null : _bdZahl(l.L_ref);
    if (!_bdLeer(l.L_ref) && !(L_ref > 0)) fehler.push(`Einzelleiter ${k}: L_ref ungültig.`);
    d.einzelleiter.leiter[k] = { L_ref, nach_spannweite: l.nach_spannweite === true, varianten };
  }

  // Kettenwerke
  const schl = new Set();
  for (const [i, k] of (roh.kettenwerke || []).entries()) {
    const s = _bdText(k.schluessel);
    const wo = `Kettenwerk ${s || i + 1}`;
    if (!/^[a-z0-9_]+$/.test(s)) { fehler.push(`${wo}: Schlüssel nur aus a–z, 0–9 und _.`); continue; }
    if (schl.has(s)) { fehler.push(`${wo}: Schlüssel doppelt.`); continue; }
    schl.add(s);
    const sys = _bdText(k.system).toLowerCase();
    if (sys !== 'nfl' && sys !== 'rfl') { fehler.push(`${wo}: System muss nfl oder rfl sein.`); continue; }
    const ts = _bdText(k.tragseil), fd = _bdText(k.fahrdraht);
    if (pruef.kombination && !pruef.kombination(ts, fd)) fehler.push(`${wo}: Kombination ${ts} + ${fd} ist im Programm nicht hinterlegt.`);
    const e = { schluessel: s, system: sys, bezeichnung: _bdText(k.bezeichnung) || s, tragseil: ts, fahrdraht: fd,
      sh: _bdZahl(k.sh), H_Fd: _bdZahl(k.H_Fd), T1: _bdZahl(k.T1) ?? 10, abnutzung_max: _bdZahl(k.abnutzung_max) };
    if (!(e.sh > 0)) fehler.push(`${wo}: Systemhöhe sh fehlt.`);
    if (!(e.H_Fd > 0)) fehler.push(`${wo}: H Fd fehlt.`);
    if (!(e.abnutzung_max >= 0 && e.abnutzung_max < 100)) fehler.push(`${wo}: Abnutzung max. (%) fehlt.`);
    for (const art of ['normal', 'starr']) {
      const a = k[art];
      if (!a) { if (art === 'normal') fehler.push(`${wo}: Reglage «normal» fehlt.`); continue; }
      if (art === 'starr' && sys !== 'nfl') continue;
      const H_Ts = _bdZahl(a.H_Ts);
      if (!(H_Ts > 0)) fehler.push(`${wo} (${art}): H Ts fehlt.`);
      e[art] = { H_Ts, quelle: _bdText(a.quelle), werte_ub: _bdReihe(a.werte_ub, `${wo} (${art})`, fehler, sys === 'nfl') };
    }
    d.kettenwerke.push(e);
  }

  // hf
  for (const [g, f] of HF_SCHLUESSEL) {
    const w = _bdZahl(f ? roh.hf?.[g]?.[f] : roh.hf?.[g]);
    if (w == null) { fehler.push(`hf: Wert ${g}${f ? '.' + f : ''} fehlt.`); continue; }
    if (f) (d.hf[g] = d.hf[g] || {})[f] = w; else d.hf[g] = w;
  }
  return fehler.length ? { daten: null, fehler } : { daten: d, fehler };
}

// ── In die Programmtabellen übernehmen ──
// Entfernt alle Reglagefelder aus MATERIALS und ersetzt KETTENWERK_PRESETS.
const _BD_MAT_FELDER = ['H_reglage', 'H_reglage_table', 'H_reglage_variants', 'reglage_note', 'L_ref', 'auto_variant_by_span'];
function bdAnwenden(d, MATERIALS, PRESETS) {
  for (const m of Object.values(MATERIALS)) for (const f of _BD_MAT_FELDER) delete m[f];
  const tab = w => (w ? { temps: [...BD_TEMPS], vals: [...w] } : null);
  const bei10 = w => (w ? w[BD_TEMPS.indexOf(10)] : null);
  for (const [k, l] of Object.entries(d.einzelleiter.leiter)) {
    const m = MATERIALS[k];
    if (!m) continue;
    const varianten = l.varianten.map(v => ({
      label: v.bezeichnung, H_reglage: bei10(v.werte), H_reglage_table: tab(v.werte), reglage_note: v.notiz,
      ...(v.c_max != null || l.nach_spannweite ? { c_max: v.c_max ?? Infinity } : {}),
      ...(v.L_ref != null ? { L_ref: v.L_ref } : {}),
    }));
    const erste = varianten[0];
    m.H_reglage = erste.H_reglage;
    if (erste.H_reglage_table) m.H_reglage_table = erste.H_reglage_table;
    m.reglage_note = erste.reglage_note;
    if (l.L_ref != null) m.L_ref = l.L_ref;
    if (l.nach_spannweite) m.auto_variant_by_span = true;
    if (varianten.length > 1 || l.nach_spannweite) m.H_reglage_variants = varianten;
  }
  for (const k of Object.keys(PRESETS)) delete PRESETS[k];
  for (const k of d.kettenwerke) {
    const n = k.normal;
    const p = { label: k.bezeichnung, sysMode: k.system, matTs: k.tragseil, matFd: k.fahrdraht,
      sh: k.sh, H_Ts: n.H_Ts, H_Fd: k.H_Fd, T1: k.T1, wear_max: k.abnutzung_max, note_ref: n.quelle || null };
    if (k.system === 'nfl') { p.H_Ts_ub = bei10(n.werte_ub); p.H_Ts_ub_table = tab(n.werte_ub); }
    if (k.system === 'nfl' && k.starr) {
      p.starr = { H_Ts: k.starr.H_Ts, H_Ts_ub: bei10(k.starr.werte_ub), H_Ts_ub_table: tab(k.starr.werte_ub),
                  note_ref: k.starr.quelle || null };
    }
    PRESETS[k.schluessel] = p;
  }
}

// ── Excel-Blätter (Zeilen als Arrays) ↔ Daten ──
const _BD_JA = v => /^(ja|j|yes|y|oui|si|sì|true|1|x)$/i.test(_bdText(v));
const _BD_INFO = [
  ['Format', d => d.format], ['Version', d => d.version], ['Titel', d => d.titel], ['Betreiber', d => d.betreiber],
  ['Stand (JJJJ-MM-TT)', d => d.stand], ['Beispiel', d => (d.beispiel ? 'ja' : 'nein')],
  ['Quelle Reglage', d => d.quellen.reglage], ['Quelle Starr', d => d.quellen.starr],
  ['Quelle Spannweite', d => d.quellen.spannweite], ['Quelle hf', d => d.quellen.hf],
  ['Einzelleiter Vorgabe-Basiskraft bei −20 °C [N]', d => d.einzelleiter.vorgabe_N],
];
const _BD_EL_KOPF = ['Leiter', 'Variante', 'Nach Spannweite (ja/nein)', 'L_ref Leiter [m]', 'c_max [m]', 'L_ref Variante [m]',
  'Notiz DE', 'Notiz FR', 'Notiz IT', ...BD_TEMPS.map(t => `${t} °C`)];
const _BD_KW_KOPF = ['Schlüssel', 'System (nfl/rfl)', 'Bezeichnung', 'Tragseil', 'Fahrdraht', 'sh [m]', 'H Fd [N]', 'T1 [°C]',
  'Abnutzung max. [%]', 'Art (normal/starr)', 'H Ts belastet bzw. konstant [N]', 'Quelle', ...BD_TEMPS.map(t => `${t} °C`)];

function bdZuBlaettern(d) {
  const info = [['Feld', 'Wert'], ..._BD_INFO.map(([n, f]) => [n, f(d) ?? ''])];
  const el = [_BD_EL_KOPF];
  for (const [k, l] of Object.entries(d.einzelleiter.leiter)) {
    for (const v of l.varianten) {
      el.push([k, v.bezeichnung, l.nach_spannweite ? 'ja' : 'nein', l.L_ref ?? '', v.c_max ?? '', v.L_ref ?? '',
        v.notiz?.de ?? '', v.notiz?.fr ?? '', v.notiz?.it ?? '', ...(v.werte || BD_TEMPS.map(() => ''))]);
    }
  }
  const kw = [_BD_KW_KOPF];
  for (const k of d.kettenwerke) {
    for (const art of ['normal', 'starr']) {
      const a = k[art];
      if (!a) continue;
      kw.push([k.schluessel, k.system, k.bezeichnung, k.tragseil, k.fahrdraht, k.sh, k.H_Fd, k.T1, k.abnutzung_max,
        art, a.H_Ts, a.quelle, ...(a.werte_ub || BD_TEMPS.map(() => ''))]);
    }
  }
  const hf = [['Parameter', 'Wert', 'Beschreibung'],
    ...HF_SCHLUESSEL.map(([g, f, b]) => [f ? `${g}.${f}` : g, f ? d.hf[g][f] : d.hf[g], b])];
  return { Info: info, Einzelleiter: el, Kettenwerke: kw, hf };
}

// Blätter → Rohdaten (danach bdPruefen). Spalten werden über die Kopfzeile gefunden.
function bdAusBlaettern(b) {
  const fehlt = ['Info', 'Einzelleiter', 'Kettenwerke', 'hf'].filter(n => !b[n]);
  if (fehlt.length) throw new Error('Blatt fehlt: ' + fehlt.join(', '));
  const info = {};
  for (const z of b.Info.slice(1)) if (z && !_bdLeer(z[0])) info[_bdText(z[0])] = z[1];
  const iw = name => info[_BD_INFO.find(([n]) => n === name)[0]];
  const roh = {
    format: _bdText(iw('Format')), version: _bdZahl(iw('Version')), titel: iw('Titel'), betreiber: iw('Betreiber'),
    stand: _bdDatum(iw('Stand (JJJJ-MM-TT)')), beispiel: _BD_JA(iw('Beispiel')),
    quellen: { reglage: iw('Quelle Reglage'), starr: iw('Quelle Starr'), spannweite: iw('Quelle Spannweite'), hf: iw('Quelle hf') },
    einzelleiter: { vorgabe_N: iw('Einzelleiter Vorgabe-Basiskraft bei −20 °C [N]'), leiter: {} },
    kettenwerke: [], hf: {},
  };
  const spalten = (kopf, soll) => soll.map(s => kopf.findIndex(k => _bdText(k) === s));
  const zeilen = blatt => blatt.slice(1).filter(z => z && z.some(v => !_bdLeer(v)));
  // Einzelleiter
  const ie = spalten(b.Einzelleiter[0] || [], _BD_EL_KOPF);
  if (ie.slice(0, 9).some(i => i < 0)) throw new Error('Blatt Einzelleiter: Kopfzeile unvollständig.');
  for (const z of zeilen(b.Einzelleiter)) {
    const k = _bdText(z[ie[0]]);
    const l = roh.einzelleiter.leiter[k] = roh.einzelleiter.leiter[k]
      || { L_ref: z[ie[3]], nach_spannweite: _BD_JA(z[ie[2]]), varianten: [] };
    const werte = ie.slice(9).map(i => (i < 0 ? null : z[i]));
    l.varianten.push({ bezeichnung: z[ie[1]], c_max: z[ie[4]], L_ref: z[ie[5]],
      notiz: { de: z[ie[6]], fr: z[ie[7]], it: z[ie[8]] }, werte: werte.every(_bdLeer) ? null : werte });
  }
  // Kettenwerke (je Schlüssel eine Zeile «normal», bei N-FL optional «starr»)
  const ik = spalten(b.Kettenwerke[0] || [], _BD_KW_KOPF);
  if (ik.slice(0, 12).some(i => i < 0)) throw new Error('Blatt Kettenwerke: Kopfzeile unvollständig.');
  const nachSchl = {};
  for (const z of zeilen(b.Kettenwerke)) {
    const s = _bdText(z[ik[0]]);
    let k = nachSchl[s];
    if (!k) {
      k = nachSchl[s] = { schluessel: s, system: z[ik[1]], bezeichnung: z[ik[2]], tragseil: z[ik[3]], fahrdraht: z[ik[4]],
        sh: z[ik[5]], H_Fd: z[ik[6]], T1: z[ik[7]], abnutzung_max: z[ik[8]] };
      roh.kettenwerke.push(k);
    }
    const art = _bdText(z[ik[9]]).toLowerCase() || 'normal';
    const werte = ik.slice(12).map(i => (i < 0 ? null : z[i]));
    k[art] = { H_Ts: z[ik[10]], quelle: z[ik[11]], werte_ub: werte.every(_bdLeer) ? null : werte };
  }
  // hf
  for (const z of zeilen(b.hf)) {
    const [g, f] = _bdText(z[0]).split('.');
    if (f) (roh.hf[g] = roh.hf[g] || {})[f] = z[1]; else roh.hf[g] = z[1];
  }
  return roh;
}

// Excel speichert Datumswerte als Zahl (Tage seit 1899-12-30)
function _bdDatum(v) {
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const t = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return t.toISOString().slice(0, 10);
  }
  const s = _bdText(v);
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : s;
}

// Kurzbezeichnung für Anzeige und PDF: «SBB-Daten, Stand 31.10.2024»
function bdBezeichnung(d) {
  if (!d) return '';
  const st = /^\d{4}-\d{2}-\d{2}$/.test(d.stand || '') ? d.stand.split('-').reverse().join('.') : (d.stand || '');
  return st ? `${d.titel}, Stand ${st}` : d.titel;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BD_FORMAT, BD_VERSION, BD_TEMPS, BD_SPEICHER, HF_SCHLUESSEL, BEISPIEL_DATEN,
    bdNotiz, bdPruefen, bdAnwenden, bdZuBlaettern, bdAusBlaettern, bdBezeichnung,
  };
}
