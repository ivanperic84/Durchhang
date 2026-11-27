/* Fahrdrahthöhe — minimale und maximale Auslegungsfahrdrahthöhe hf_min / hf_max
 *
 * Rechengang wie die SBB-Excel «Durchhang 2026» (Blätter hfmin_v11_D und
 * hfmax_v11_D, AB-EBV 2024, Art. 5.2.1 und 5.2.2). Alle Längen in mm.
 * Die Zahlenwerte (Grenzlinie, Zuschläge, Toleranzen, Absolutwerte …) stammen
 * aus den Betreiberdaten (betreiberdaten.js, Gruppe «hf») und werden mit
 * hfParameterSetzen() übergeben — ohne Parameter ist keine Rechnung möglich.
 *
 *   hf_min = GfA + k + be + f + H + Z_hfmin
 *            Z_hfmin = fg + thu + fud + fuv + fFDmaxZL + fFDmax40
 *   hf_max = hf_max,absolut − Z_hfmax
 *            Z_hfmax = tho + fudo − fuv + fh − fFDmin
 *   Bahnübergang: 5510 + Z (fg und Schwingung = 0), wie Excel.
 *
 * Wie in der Excel:
 *   - Spannweite c nur aus der Liste 60 … 26, 24, 20, 16, 12, 8 m.
 *   - Temperaturen in 5-K-Schritten von −20 bis +80 °C; Zusatzlast (Schnee)
 *     0, 7 oder 15 N/m nur bei −5 °C.
 *   - N-FL: Zugkraft Ts bei 10 °C (H_t0) und bei der Temperatur (H_Tx) aus der
 *     Zustandsgleichung (rechenkern.js, gleiche Werte wie Excel «NFL-Tab»),
 *     neuer Fahrdraht (ohne Abnutzung).
 *   - R-FL: Durchhang bei Eislast mit festem Zug (Parameter rfl_zug).
 *
 * Ohne Seite (DOM); Prüfung ohne Browser: npm test.
 * Nach Änderungen an dieser Datei: CACHE_VERSION in sw.js erhöhen.
 */
'use strict';

const HF_SPANNWEITEN = [...Array(35)].map((_, i) => 60 - i).concat([24, 20, 16, 12, 8]);
const HF_TEMPERATUREN = [...Array(21)].map((_, i) => -20 + 5 * i);
const HF_ZUSATZLASTEN = [0, 7, 15];
const HF_EIS_TEMPERATUR = -5;

// Parameter aus den Betreiberdaten (Gruppe «hf»), siehe HF_SCHLUESSEL in betreiberdaten.js
let HF_P = null;
function hfParameterSetzen(p) { HF_P = p || null; }
const _hfP = () => { if (!HF_P) throw new Error('hf-Parameter fehlen'); return HF_P; };

// ── Einzelne Zuschläge ──
const _hfEbv = ebv => 'ebv' + ([1, 2, 3, 4].includes(ebv) ? ebv : 2);
const hfGrenzlinie = ebv => _hfP().grenzlinie[_hfEbv(ebv)];
const hfSicherheitszuschlag = ebv => _hfP().sicherheit[_hfEbv(ebv)];
const hfElektrAbstand = un => (un === 25 ? _hfP().elektr_abstand.un25 : _hfP().elektr_abstand.andere);
const hfGleishebung = (schotter, bue) => (bue ? _hfP().gleishebung.bue : schotter ? _hfP().gleishebung.schotter : _hfP().gleishebung.ohne_schotter);
const hfMontagetoleranz = v => (v > _hfP().montagetoleranz.v_grenze ? _hfP().montagetoleranz.schnell : _hfP().montagetoleranz.langsam);

// Dynamische Schwingung des Fahrdrahts nach unten (Siemens, Bild 6.60; DB Ebs 02.05.17)
function hfSchwingung(c) {
  return (c < 25 ? 4 * c / 5 : 0)
       + (c > 24 && c < 46 ? 3 * c / 2 - 18 : 0)
       + (c > 45 ? 4 * c / 7 + 24 : 0);
}

// Vordurchhang Fahrdraht: nur R-FL bis zur Geschwindigkeitsgrenze
function hfVordurchhang(typ, c, v) {
  const p = _hfP().vordurchhang;
  if (typ !== 'rfl' || v > p.v_max) return 0;
  return c >= p.c_grenze ? p.gross : p.klein;
}

// R-FL: Fahrdraht-Durchhang bei Eislast am Tragseil, Fallprüfung P1.1–P1.3.
// Zug fest (Parameter rfl_zug).
function hfRflEislast(c, zl, cUebr, p11, p12) {
  const H = _hfP().rfl_zug.H_Ts + _hfP().rfl_zug.H_Fd;
  if (!p11 && !p12 && cUebr === 0) return zl * c * c / (8 * H) * 1000;
  if (!p11 && p12) return ((c - cUebr) / c) * zl * c * c / (8 * H) * 1000;
  return 0;
}

// N-FL: Fahrdraht-Durchhang gegenüber der Lage bei 10 °C (VEM Gl. 7.67):
//   f = c²/8 · (g'kx + ZL − g'k · H_Tx / H_t0) / (H_Fd + H_Tx)
function hfNflDurchhang(c, zl, n) {
  return (c * c / 8) * (n.gk + zl - n.gk * (n.H_Tx / n.H_t0)) / (n.H_Fd + n.H_Tx) * 1000;
}

// ── Eingaben prüfen ──
// Liefert Schlüssel für Fehler (Rechnung nicht möglich) und Hinweise.
function hfPruefen(e) {
  const fehler = [], hinweise = [];
  if (!HF_P) return { fehler: ['hf.err.param'], hinweise };
  if (e.typ !== 'nfl' && e.typ !== 'rfl') fehler.push('hf.err.typ');
  if (!HF_SPANNWEITEN.includes(e.c)) fehler.push('hf.err.c');
  if (!Number.isFinite(e.v) || e.v <= 0) fehler.push('hf.err.v');
  for (const [T, zl, art] of [[e.Tmin, e.zlMin, 'min'], [e.Tmax, e.zlMax, 'max']]) {
    if (!HF_TEMPERATUREN.includes(T)) fehler.push('hf.err.t.' + art);
    if (!HF_ZUSATZLASTEN.includes(zl)) fehler.push('hf.err.zl.' + art);
    else if (zl !== 0 && T !== HF_EIS_TEMPERATUR) fehler.push('hf.err.zlt.' + art);
  }
  if (e.typ === 'nfl') {
    const n = e.nfl || {};
    if (!(n.gk > 0 && n.H_Fd > 0 && n.H_t0 > 0 && n.H_Tmin > 0 && n.H_Tmax > 0)) fehler.push('hf.err.nfl');
  }
  if (e.typ === 'rfl') {
    const cu = e.cUebr ?? 0;
    if (!Number.isInteger(cu) || cu < 0 || cu > e.c) fehler.push('hf.err.cuebr');
    else if (e.p11 && (cu !== 0 || e.p12)) hinweise.push('hf.w.p11');
    else if (!e.p11 && e.p12 && cu === 0) hinweise.push('hf.w.p12j');
    else if (!e.p11 && !e.p12 && cu !== 0) hinweise.push('hf.w.p12n');
  }
  if (e.typ === 'nfl' && e.Tmin > HF_P.t_hinweis) hinweise.push('hf.w.t56');
  return { fehler, hinweise };
}

// ── Berechnung ──
// e = { typ: 'nfl'|'rfl', c, v, bue,
//       un, schotter, ebv, f, H, Tmin, zlMin, cUebr, p11, p12,   (hf_min)
//       lrp, Tmax, zlMax,                                          (hf_max)
//       nfl: { gk, H_Fd, H_t0, H_Tmin, H_Tmax } }                  (nur N-FL)
// Rückgabe: { min, max, fehler, hinweise } — min/max = { wert, bue, basis,
//   zeilen: [{ sym, wert, schluessel }], summe } oder null bei Fehlern.
function hfBerechnen(e) {
  const { fehler, hinweise } = hfPruefen(e);
  if (fehler.length) return { min: null, max: null, fehler, hinweise };
  const { typ, c, v, bue } = e;
  const nfl = typ === 'nfl';

  // hf_min
  const fud = bue ? 0 : hfSchwingung(c);
  const zMin = [
    { sym: 'fg',       wert: hfGleishebung(e.schotter, bue),   schluessel: 'hf.z.fg' },
    { sym: 'thu',      wert: hfMontagetoleranz(v),             schluessel: 'hf.z.thu' },
    { sym: 'fud',      wert: fud,                              schluessel: 'hf.z.fud' },
    { sym: 'fuv',      wert: hfVordurchhang(typ, c, v),        schluessel: 'hf.z.fuv' },
    { sym: 'fFDmaxZL', wert: nfl ? 0 : hfRflEislast(c, e.zlMin, e.cUebr ?? 0, !!e.p11, !!e.p12), schluessel: 'hf.z.ffdzl' },
    { sym: 'fFDmax40', wert: nfl ? hfNflDurchhang(c, e.zlMin, { ...e.nfl, H_Tx: e.nfl.H_Tmin }) : 0, schluessel: 'hf.z.ffd40' },
  ];
  const summeMin = zMin.reduce((s, z) => s + z.wert, 0);
  const basisMin = [
    { sym: 'GfA', wert: hfGrenzlinie(e.ebv),           schluessel: 'hf.b.gfa' },
    { sym: 'k',   wert: hfSicherheitszuschlag(e.ebv),  schluessel: 'hf.b.k' },
    { sym: 'be',  wert: hfElektrAbstand(e.un),         schluessel: 'hf.b.be' },
    { sym: 'f',   wert: Number(e.f) || 0,              schluessel: 'hf.b.f' },
    { sym: 'H',   wert: Number(e.H) || 0,              schluessel: 'hf.b.h' },
  ];
  const absMin = basisMin.reduce((s, z) => s + z.wert, 0);
  const min = {
    wert: bue ? HF_P.bue_min + summeMin : absMin + summeMin,
    bue, absolut: bue ? HF_P.bue_min : absMin, basis: bue ? [] : basisMin, zeilen: zMin, summe: summeMin,
  };

  // hf_max
  const zMax = [
    { sym: 'tho',     wert: hfMontagetoleranz(v),              schluessel: 'hf.z.tho' },
    { sym: 'fudo',    wert: bue ? 0 : hfSchwingung(c) * HF_P.schwingung_oben_faktor, schluessel: 'hf.z.fudo' },
    { sym: 'fuv',     wert: -hfVordurchhang(typ, c, v),        schluessel: 'hf.z.fuvo' },
    { sym: 'fh',      wert: HF_P.anhub,                        schluessel: 'hf.z.fh' },
    { sym: 'fFDmin',  wert: nfl ? -hfNflDurchhang(c, e.zlMax, { ...e.nfl, H_Tx: e.nfl.H_Tmax }) : 0, schluessel: 'hf.z.ffdmin' },
  ];
  const summeMax = zMax.reduce((s, z) => s + z.wert, 0);
  const absMax = e.lrp ? HF_P.hf_max_absolut.lrp_ja : HF_P.hf_max_absolut.lrp_nein;
  const max = {
    wert: bue ? HF_P.bue_min + summeMax : absMax - summeMax,
    bue, absolut: bue ? HF_P.bue_min : absMax, basis: [], zeilen: zMax, summe: summeMax,
  };

  if (bue) hinweise.push('hf.w.bue');
  if (bue && nfl) hinweise.push('hf.w.buenfl');
  if (bue) hinweise.push('hf.w.buemax');
  return { min, max, fehler, hinweise };
}

// N-FL: Zugkräfte Ts wie Excel «NFL-Tab» aus der Montagezugkraft (unbelastet)
// kern = { nflBezugszustand, nflZugkraftBei } aus rechenkern.js
function hfNflZugkraefte(kern, { flCombo, Lm, H_ub, T_montage, H_Fd, Tmin, zlMin, Tmax, zlMax }) {
  const H_t0 = kern.nflBezugszustand(H_ub, T_montage, flCombo, Lm);
  const e = { Lm, H_Fd, q_ges: flCombo.MFL, flCombo, wearPct: 0 };
  return {
    gk: flCombo.MFL, H_Fd, H_t0,
    H_Tmin: kern.nflZugkraftBei(H_t0, Tmin, zlMin, e),
    H_Tmax: kern.nflZugkraftBei(H_t0, Tmax, zlMax, e),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HF_SPANNWEITEN, HF_TEMPERATUREN, HF_ZUSATZLASTEN, HF_EIS_TEMPERATUR, hfParameterSetzen,
    hfGrenzlinie, hfSicherheitszuschlag, hfElektrAbstand, hfGleishebung, hfMontagetoleranz,
    hfSchwingung, hfVordurchhang, hfRflEislast, hfNflDurchhang, hfPruefen, hfBerechnen, hfNflZugkraefte,
  };
}
