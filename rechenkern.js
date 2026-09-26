/* Rechenkern — Durchhang Kettenwerk N-FL / R-FL / Einzelleiter
 *
 * Enthält ausschliesslich die Berechnung: Zustandsgleichungen, Kettenlinie und
 * den Ablauf Ausgangszustand → Zielzustand (T2) → Vergleichszustand (T3).
 * Kein Zugriff auf die Seite (DOM), keine Anzeige. Dadurch
 *   - gibt es jede Rechnung nur EINMAL (Hauptrechnung und Schnellzeichnen
 *     beim Ziehen nutzen dieselbe Funktion berechneZustaende()),
 *   - lässt sich alles ohne Browser prüfen: npm test (siehe tests/).
 *
 * Wird im Browser als gewöhnliches Skript vor dem Hauptskript geladen; die
 * Funktionen stehen dann global zur Verfügung. In Node (Tests) über require().
 *
 * Nach Änderungen an dieser Datei: CACHE_VERSION in sw.js erhöhen.
 */
'use strict';

// Fehlertexte: im Browser übersetzt über t() aus index.html, in Tests der Schlüssel
function _kernText(schluessel) {
  return (typeof t === 'function') ? t(schluessel) : schluessel;
}

// Hänger-Eigengewicht, wenn keine hinterlegte FL-Kombination gewählt ist:
// 0.020 kg/m × 9.81 m/s² = 0.196 N/m
const Q_HAENGER = 0.02 * 9.81;

// Eislast wirkt nur bei dieser Temperatur (SBB-Lastfall −5 °C + Eis)
const EISLAST_TEMPERATUR = -5;
function eislastWirksamBei(T) { return T === EISLAST_TEMPERATUR; }

// ── N-FL mit hinterlegter Kombination: Rechengang wie SBB «Durchhang 2026.xlsm» ──
// Bezugszustand ist immer 10 °C: dort hängt der Fahrdraht waagrecht, sein Zug
// wirkt erst bei Abweichung davon. Rundung wie in der Excel (Modul
// M04_1_NFL_Tab_new): Ts belastet bei 10 °C auf 10 N, Tabellenwerte auf 5 N,
// Werte mit Eislast auf 10 N.
const NFL_BEZUGSTEMPERATUR = 10;
const runde5  = x => Math.round(x / 5) * 5;
const runde10 = x => Math.round(x / 10) * 10;

// Gesamtgewicht der Fahrleitung bei Fahrdraht-Abnutzung (N-FL). Die Excel führt
// je Kombination eine eigene Zeile «abgenutzt» (Blatt Daten, Spalte gkx); daraus
// ergibt sich das für die Abnutzung massgebende Fahrdrahtgewicht qFdAbnutzung.
// Fehlt der Wert, wird das allgemeine Fahrdrahtgewicht qFdErsatz verwendet.
function mflAbgenutzt(flCombo, wearPct, qFdErsatz) {
  const qFd = flCombo.qFdAbnutzung ?? qFdErsatz;
  return flCombo.MFL - qFd * (wearPct / 100);
}

// Schritt 2 der Excel: Ts unbelastet bei Montagetemperatur → Ts belastet bei
// 10 °C (volles Gewicht, neuer Fahrdraht, noch ohne Fahrdrahtzug).
// ungerundet: für Rückrechnungen (3-Punkte-Messung)
function nflBezugUngerundet(H_ub, T_montage, flCombo, Lm) {
  return solveNFLStateEq(flCombo.MFL, 0, H_ub, Lm, flCombo.AL, flCombo.E, flCombo.AK,
                         NFL_BEZUGSTEMPERATUR - T_montage, 0, flCombo.MTS);
}
function nflBezugszustand(H_ub, T_montage, flCombo, Lm) {
  return runde10(nflBezugUngerundet(H_ub, T_montage, flCombo, Lm));
}

// Zugkraft Ts belastet bei Temperatur T, ausgehend vom Bezugszustand (10 °C).
// q_ges = Gewicht mit Abnutzung; die Abnutzung wirkt erst ab 10 °C (Excel-Notiz 6).
function nflZugkraftBei(H_bezug, T, zl, e, gerundet = true) {
  const { Lm, H_Fd, q_ges, flCombo, wearPct } = e;
  const MFL_init = wearPct > 0 ? flCombo.MFL : null;
  const H = solveNFLStateEq(q_ges, H_Fd, H_bezug, Lm, flCombo.AL, flCombo.E, flCombo.AK,
                            T - NFL_BEZUGSTEMPERATUR, zl, MFL_init);
  if (!gerundet) return H;
  return zl > 0 ? runde10(H) : runde5(H);
}

// Umkehrung für die 3-Punkte-Messung: aus der gemessenen Zugkraft (belastet, bei
// Temperatur T) die unbelastete Montagezugkraft bei T_montage bestimmen.
// Die Hinrechnung steigt monoton mit H_ub → Bisektion.
function nflUnbelastetAusGemessen(FH, T, T_montage, e) {
  const hin = H_ub => nflZugkraftBei(nflBezugUngerundet(H_ub, T_montage, e.flCombo, e.Lm),
                                     T, 0, e, false);
  let lo = 1, hi = Math.max(FH, 1000);
  while (hin(hi) < FH && hi < 1e7) hi *= 2;
  if (hin(lo) > FH || hin(hi) < FH) return null;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (hin(mid) < FH) lo = mid; else hi = mid;
    if (hi - lo < 1e-6) break;
  }
  return (lo + hi) / 2;
}

// ═══════════════════════════════════════════════════════════════
// ZUSTANDSGLEICHUNG (SBB, parabolische Näherung)
// Löst den Übergang unbelastet→belastet für N-FL (Stufe 1)
// Zustandsgleichung mit q_Ts (Zustand 1) und q_ges (Zustand 2), selbe Temperatur
// Nur EA_Ts relevant: beim Anhängen des Fd ist nur das Tragseil das elastische Glied
// Kubisches Polynom: C·H_b³ + K·H_b² − G = 0
//   G = (q_ges·Lm)²/24,  C = 1/EA_Ts,  K = (q_Ts·Lm)²/(24·H_ub²) − H_ub/EA_Ts
function solveLoadingEq(H_ub, q_Ts, q_ges, Lm, EA_Ts) {
  if (!EA_Ts || isNaN(EA_Ts) || isNaN(H_ub) || H_ub <= 0) return null;
  const G = (q_ges * Lm) ** 2 / 24;
  const C = 1 / EA_Ts;
  const K = (q_Ts * Lm) ** 2 / (24 * H_ub * H_ub) - H_ub / EA_Ts;
  let H = H_ub;
  for (let i = 0; i < 200; i++) {
    const f  = C * H ** 3 + K * H ** 2 - G;
    const df = 3 * C * H ** 2 + 2 * K * H;
    if (Math.abs(df) < 1e-20) break;
    const dH = f / df;
    H -= dH;
    if (H < 1) H = 1;
    if (Math.abs(dH) < 1e-9) break;
  }
  return H;
}

// Löst: q²·Lm²/(24·H2²) − H2/(EA) = q²·Lm²/(24·H1²) − H1/(EA) + α·ΔT
// Umgeformt zu kubischem Polynom: C·H2³ + K·H2² − G = 0
//   G = (q·Lm)²/24,  C = 1/EA,  K = G/H1² − C·H1 + α·ΔT
// Gelöst mit Newton-Raphson (Startwert H2 = H1)
// ═══════════════════════════════════════════════════════════════
function solveStateEq(q, Lm, H1, EA, alpha, deltaT) {
  const G = (q * Lm) ** 2 / 24;
  const C = 1 / EA;
  const K = G / (H1 * H1) - C * H1 + alpha * deltaT;
  let H = H1;
  // When K < 0 the cubic has a local minimum at H_crit = -2K/(3C).
  // If H1 lies left of that minimum, Newton-Raphson diverges.
  // Fix: start right of the minimum so the derivative is always positive.
  if (K < 0) {
    const H_crit = -2 * K / (3 * C);
    if (H < H_crit) H = H_crit * 2;
  }
  for (let i = 0; i < 300; i++) {
    const f  = C * H ** 3 + K * H ** 2 - G;
    const df = 3 * C * H ** 2 + 2 * K * H;
    if (Math.abs(df) < 1e-20) break;
    const dH = f / df;
    if (H - dH <= 0) { H = H / 2; continue; } // bisection fallback, never go negative
    H -= dH;
    if (Math.abs(dH) < 1e-9) break;
  }
  return H;
}

// ── NFL-Zustandsgleichung nach VBA Upro1 (Excel Durchhang 2026.xlsm) ───────────
// Löst die VBA-konforme NFL-Zustandsgleichung (Upro1-Äquivalent) für die Temperaturänderung.
// Gibt die TS-Zugkraft H_Ts bei der Zieltemperatur zurück.
// Formel: ((MFL+ZL+MFL·HF/F0)/(HF+x))² - (MFL/F0)² - G·(α·ΔT + (x-F0)/(E·A)) = 0
// Parameter: MFL [N/m], HF = H_Fd [N], F0 = H_Ts_ref [N], L = Lm [m],
//            AL = α, E, AK, deltaT, ZL = Eislast [N/m] (Standard = 0)
function solveNFLStateEq(MFL, HF, F0, L, AL, E, AK, deltaT, ZL = 0, MFL_init = null) {
  // gk0 = Ausgangskrümmung im Einbauzustand (neuer Draht = MFL_init falls angegeben)
  // VEM S.445: gk0 = gk_neu/Ht0; A = gkx + gk_neu·H_Fd/Ht0
  const q0  = MFL_init !== null ? MFL_init : MFL;
  const gk0 = q0 / F0;
  const C   = 1 / (E * AK);
  const G   = 24 / (L * L) + gk0 * gk0;
  // A: Zielzustand-Last (MFL=gkx abgenutzt), aber Fahrdraht-Verhältnis mit q0 (neu)
  const A   = (MFL + ZL) + q0 * HF / F0;
  let x = F0;
  for (let i = 0; i < 300; i++) {
    const gkx = A / (HF + x);
    const f   = gkx * gkx - gk0 * gk0 - G * (AL * deltaT + (x - F0) * C);
    const df  = -2 * A * A / Math.pow(HF + x, 3) - G * C;
    if (Math.abs(df) < 1e-30) break;
    const dx = f / df;
    x -= dx;
    if (x < 1) x = 1;
    if (Math.abs(dx) < 1e-6) break;
  }
  return x;
}

// ── 3-Punkte-Solver ─────────────────────────────────────────────────────────
// Berechnet Durchhang der Kettenlinie unter der Sehne bei Position xC.
// c = Spannweite, h = Höhendiff. A−B (A links, h>0 wenn A höher), M = Linienlast,
// xC = Abstand von Mast A, FH = Horizontalzugkraft.
function catSagAt(FH, M, c, h, xC) {
  const a = FH / M;
  // Verschiebung des tiefsten Punktes bei asymmetrischer Spannweite
  const sinhArg = -h / (2 * a * Math.sinh(c / (2 * a)));
  if (Math.abs(sinhArg) >= 1e9) return NaN;
  const x0 = c / 2 - a * Math.asinh(sinhArg);
  // Absenkung der Kettenlinie gegenüber Mast A an der Stelle xC
  const yCat   = a * (Math.cosh((xC - x0) / a) - Math.cosh(x0 / a));
  // Sehnenhöhe an xC (Sehne von A nach B, A = Referenz 0)
  const yChord = -h * xC / c;
  return yChord - yCat;   // positiv = Leiter unter Sehne
}

// Findet FH sodass catSagAt(FH,...) = yC_sag (Durchhang unter Sehne).
// Rückgabe: FH in N, oder null bei ungültiger Eingabe.
function solve3point(c, h, M, xC, yC_sag) {
  if (yC_sag <= 0 || xC <= 0 || xC >= c || M <= 0 || c <= 0) return null;
  let FH = M * c * c / (8 * yC_sag);   // Parabel-Startwert
  if (!isFinite(FH) || FH < 1) FH = 1000;
  for (let i = 0; i < 300; i++) {
    const y  = catSagAt(FH, M, c, h, xC);
    const y2 = catSagAt(FH * (1 + 1e-5), M, c, h, xC);
    if (!isFinite(y) || !isFinite(y2)) break;
    const dy = (y2 - y) / (FH * 1e-5);
    if (Math.abs(dy) < 1e-30) break;
    let step = (y - yC_sag) / dy;
    if (Math.abs(step) > FH * 0.5) step = Math.sign(step) * FH * 0.5;
    FH -= step;
    if (FH < 1) FH = 1;
    if (Math.abs(step) < 1e-4) break;
  }
  return isFinite(FH) && FH > 0 ? FH : null;
}

// Rückrechnung H_ub aus FH_belastet (Inverse von solveLoadingEq).
// Nutzt dasselbe kubische Polynom mit G_ts statt G.
function solveLoadingInverse(FH, q_Ts, q_ges, Lm, EA) {
  if (!EA || FH <= 0) return null;
  const G    = (q_ges * Lm) ** 2 / 24;
  const C    = 1 / EA;
  const K    = G / (FH * FH) - C * FH;
  const G_ts = (q_Ts * Lm) ** 2 / 24;
  let H = FH * 0.85;
  for (let i = 0; i < 300; i++) {
    const f  = C * H ** 3 + K * H ** 2 - G_ts;
    const df = 3 * C * H ** 2 + 2 * K * H;
    if (Math.abs(df) < 1e-20) break;
    const dH = f / df;
    H -= dH;
    if (H < 1) H = 1;
    if (Math.abs(dH) < 1e-9) break;
  }
  return isFinite(H) && H > 0 ? H : null;
}


// ═══════════════════════════════════════════════════════════════
// KETTENLINIENMATHEMATIK
// y(x) = a·cosh((x−x₀)/a) + C₀  mit  a = H/q
// Tiefpunkt: x₀ = a·(u−n),  u = L/(2a),  n = arcsinh(Δh/(2a·sinh(u)))
// Seillänge: s = 2a·sinh(u)·cosh(n)
// ═══════════════════════════════════════════════════════════════

// Kettenlinienparameter m aus bekannter Seillänge s lösen (Newton-Raphson)
// Wird beim Thermik-Fallback verwendet (kein E·A angegeben)
function solveM_fromS(L, s, dh) {
  if (Math.abs(dh) >= s) throw new Error(_kernText('err.dh.groesser'));
  const n = Math.atanh(dh / s);
  const k = s / (L * Math.cosh(n));
  if (k <= 1) throw new Error(_kernText('err.seil.kurz'));
  let m = Math.max(Math.sqrt(6 * (k - 1)), 0.1);
  for (let i = 0; i < 300; i++) {
    const fm  = Math.sinh(m) - m * k;
    const dfm = Math.cosh(m) - k;
    if (Math.abs(dfm) < 1e-15) break;
    const dm = fm / dfm;
    m -= dm;
    if (m <= 0) m = 1e-9;
    if (Math.abs(dm) < 1e-13) break;
  }
  return { m, n, k };
}

// Geometrie der Kettenlinie aus bekanntem a, u, n berechnen
function buildCatenary(a, u, n, h1, L, dh) {
  const p       = u - n;
  const x_low   = a * p;                          // Tiefpunkt x₀
  const C       = h1 - a * Math.cosh(p);          // Integrationskonstante C₀
  const s       = 2 * a * Math.sinh(u) * Math.cosh(n); // Seillänge (exakt)
  const y_low   = a + C;                          // Tiefpunkthöhe
  const y_chord = h1 + dh * x_low / L;           // Sehnenhöhe bei x₀
  const sag     = y_chord - y_low;               // Durchhang
  return { a, p, x_low, C, s, sag, y_low, y_chord };
}

// Grösste Seilkraft: an der Aufhängung, die weiter vom Tiefpunkt entfernt ist
// (= höherer Mast). T(x) = H·cosh((x − x₀)/a). Bei gleich hohen Masten
// identisch mit √(H² + (W/2)²), bei ungleich hohen Masten grösser.
function maxSeilkraft(H, a, x_low, L) {
  return H * Math.cosh(Math.max(Math.abs(x_low), Math.abs(L - x_low)) / a);
}

// Ausgangszustand: a = H/q direkt (keine Iteration nötig)
function computeBase(L, q, H, h1, h2) {
  const dh     = h2 - h1;
  const a      = H / q;
  const u      = L / (2 * a);
  const sinh_u = Math.sinh(u);
  const n      = Math.asinh(dh / (2 * a * sinh_u));
  const cat    = buildCatenary(a, u, n, h1, L, dh);
  const W      = q * cat.s;                       // Gesamtgewichtskraft
  const T_max  = maxSeilkraft(H, a, cat.x_low, L);
  return { ...cat, q, W, H, T_max, u, n, sinh_u, dh };
}

// Thermischer Zielzustand: Seillänge s2 bekannt, W bleibt konstant, q ändert sich
function computeThermal(L, W, s2, h1, h2) {
  const dh          = h2 - h1;
  const { m, n, k } = solveM_fromS(L, s2, dh);
  const a           = L / (2 * m);
  const cat         = buildCatenary(a, m, n, h1, L, dh);
  const H2          = W * a / s2;
  const q2          = W / s2;
  return { ...cat, q: q2, W, H: H2, T_max: maxSeilkraft(H2, a, cat.x_low, L), m, n, k };
}


// ═══════════════════════════════════════════════════════════════
// ZUSTÄNDE BERECHNEN — einzige Stelle für den Rechenablauf
// ═══════════════════════════════════════════════════════════════

// Zielzustand bei Temperatur T (= T1 + dT) und Zusatzlast zl (N-FL, Einzelleiter).
// Rückgabe: { c, vem, LT1, q_vem } — vem/LT1/q_vem nur bei hinterlegter
// FL-Kombination (N-FL), sonst null.
function _zielzustand(e, c1, dT, zl) {
  const { L, Lm, H_Ts, H_Fd, h1, h2, q_ges, EA, alpha, flCombo, wearPct } = e;
  if (flCombo) {
    // Bekannte FL-Kombination: wie Excel vom Bezugszustand 10 °C aus (H_Ts = Ts
    // belastet bei 10 °C), Ergebnis gerundet wie in der Excel-Tabelle.
    const H2 = nflZugkraftBei(H_Ts, e.T1 + dT, zl, e);
    const c = computeBase(L, q_ges + zl, H2, h1, h2);
    // VEM Handbuch Formel 7.66 + 7.82: Fahrdraht-Durchhang mit effektiver Spannweite
    // LT1 = c_proj + 2·Δh·(H2+H_Fd) / (c_proj·q_vem)   [VEM 7.82, Δh-Korrektur]
    // f   = LT1² / 8 · q_vem / (H2+H_Fd)                [VEM 7.66 mit LT1]
    // q_vem = gkx + gk0_neu × H_Fd / Ht0   [VEM S.445: gk0 = neuer Draht, gkx = abgenutzt]
    const gk0   = wearPct > 0 ? flCombo.MFL : q_ges;
    const q_vem = q_ges + gk0 * H_Fd / H_Ts + zl;
    const absDH = Math.abs(h2 - h1);                    // |Δh| — symmetrisch (VEM 7.82)
    const LT1   = absDH > 1e-9
      ? L + 2 * absDH * (H2 + H_Fd) / (L * q_vem)       // VEM 7.82: immer LT1 ≥ L
      : L;
    c.sag = LT1 * LT1 / 8 * q_vem / (H2 + H_Fd);
    // Kombinierte Kettenlinie (Ts+Fd) mit q_vem und H2+H_Fd — für die Zeichnung
    const vem = computeBase(L, q_vem, H2 + H_Fd, h1, h2);
    return { c, vem, LT1, q_vem };
  }
  if (EA !== null && EA !== undefined) {
    const H2 = solveStateEq(q_ges + zl, Lm, H_Ts, EA, alpha, dT);
    return { c: computeBase(L, q_ges + zl, H2, h1, h2), vem: null, LT1: null, q_vem: null };
  }
  // Ohne E·A: nur thermische Längenänderung
  const s2 = c1.s * (1 + alpha * dT);
  return { c: computeThermal(L, c1.W, s2, h1, h2), vem: null, LT1: null, q_vem: null };
}

// Berechnet alle Zustände aus den (bereits ausgelesenen) Eingaben.
//   e: { sysMode 'nfl'|'rfl'|'el', L, Lm, H_Ts, H_Fd, h1, h2, T1, q_ges, EA,
//        alpha, deltaT, flCombo, ZL, wearPct, T3 (null = keine Vergleichskurve) }
//   H_Ts: bei N-FL mit Kombination = Ts belastet bei 10 °C (nflBezugszustand),
//         sonst Ts-Zugkraft bei T1.
// Rückgabe: { c1, c2, c2_vem, LT1_vem, q_vem_vem, c3, c3_zeichnung, t3Fehler }
// Fehler im Ausgangs- bzw. Zielzustand werden geworfen, mit err.phase = 'c1' | 'c2'.
// Ein Fehler der T3-Vergleichskurve bricht nicht ab (t3Fehler, c3 = null).
function berechneZustaende(e) {
  const { sysMode, L, H_Ts, H_Fd, h1, h2, T1, q_ges, deltaT, ZL, T3 } = e;
  const r = { c1: null, c2: null, c2_vem: null, LT1_vem: null, q_vem_vem: null,
              c3: null, c3_zeichnung: null, t3Fehler: null };

  try {
    // N-FL mit Kombination: H_Ts ist der Bezugszustand bei 10 °C — der Zustand
    // bei T1 folgt daraus (bei T1 = 10 °C ohne Abnutzung identisch).
    const H1 = (sysMode === 'nfl' && e.flCombo) ? nflZugkraftBei(H_Ts, T1, 0, e) : H_Ts;
    r.c1 = computeBase(L, q_ges, H1, h1, h2);
  }
  catch (err) { err.phase = 'c1'; throw err; }

  try {
    if (sysMode === 'rfl') {
      // R-FL: konstante Zugkraft; ZL (Eislast) teilt sich auf Ts+Fd auf:
      // f_ZL = ZL·c²/(8·(H_Ts+H_Fd))
      r.c2 = (ZL > 0 && !isNaN(H_Fd) && H_Fd > 0)
        ? computeBase(L, q_ges + ZL * H_Ts / (H_Ts + H_Fd), H_Ts, h1, h2)
        : r.c1;
    } else {
      const z = _zielzustand(e, r.c1, deltaT, ZL);
      r.c2 = z.c; r.c2_vem = z.vem; r.LT1_vem = z.LT1; r.q_vem_vem = z.q_vem;
    }
  } catch (err) { err.phase = 'c2'; throw err; }

  // T3 — Vergleichskurve (nicht bei R-FL: konstante Zugkraft)
  if (T3 !== null && T3 !== undefined && sysMode !== 'rfl') {
    try {
      // Eislast gilt nur, wenn T3 selbst die Eislast-Temperatur ist
      const zl3 = eislastWirksamBei(T3) ? ZL : 0;
      const z3 = _zielzustand(e, r.c1, T3 - T1, zl3);
      r.c3 = z3.c;
      r.c3_zeichnung = z3.vem ?? z3.c;
    } catch (err) { r.t3Fehler = err; }
  }
  return r;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Q_HAENGER, EISLAST_TEMPERATUR, eislastWirksamBei,
    NFL_BEZUGSTEMPERATUR, runde5, runde10, mflAbgenutzt, nflBezugUngerundet,
    nflBezugszustand, nflZugkraftBei, nflUnbelastetAusGemessen,
    solveLoadingEq, solveStateEq, solveNFLStateEq, catSagAt, solve3point,
    solveLoadingInverse, solveM_fromS, buildCatenary, maxSeilkraft,
    computeBase, computeThermal, berechneZustaende,
  };
}
