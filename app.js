/* Programm der App «Durchhang» — ausgelagert aus index.html (v5.0).
   Läuft wie bisher als gewöhnliches Skript an derselben Stelle der Seite (nach den
   Rechenmodulen und i18n.js, vor den Dialogen). Funktionen bleiben global, weil die
   Bedienelemente sie über onclick="…" aufrufen. */
// Programmversion — erscheint in PDF und Exporten (auch in sw.js / package.json nachführen)
const APP_VERSION = 'v6.0.0';
// Versionsnummer in Fusszeile und Handbuch immer aus APP_VERSION (stand vorher fest auf v3.9.3)
document.addEventListener('DOMContentLoaded', () =>
  document.querySelectorAll('.app-version').forEach(el => { el.textContent = APP_VERSION; }));

// Kurzname des Systems in der aktuellen Sprache (N-FL / LC N …)
function sysName(mode) {
  return mode === 'nfl' ? t('sys.nfl.kurz') : mode === 'rfl' ? t('sys.rfl.kurz') : t('sys.el');
}

// ═══════════════════════════════════════════════════════════════
// GLOBALER ZUSTAND
// ═══════════════════════════════════════════════════════════════
// Schrift für Beschriftungen im Diagramm (Canvas). Früher nur «Segoe UI» —
// die gibt es nur unter Windows, auf iPad/Mac erschien dann eine Serifenschrift.
const DIAGRAMM_SCHRIFT = "Inter, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Farben des Diagramms (Canvas) je Thema. Canvas kennt keine CSS-Variablen,
// deshalb hier als Werte. Für PDF-Bild immer hell (_diagrammDruck).
const DIAGRAMM_FARBEN = {
  hell: {
    hg1: '#f7f8fa', hg2: '#eef0f4', raster: '#d5d9e0', achse: '#5f616c',
    t1: '#9497a1', akzent: '#4a5cb8', akzentFlaeche: 'rgba(74,92,184,.15)',
    fehler: '#a02020', sehne: '#5f616c', anker: '#3a3c48', ankerLeise: '#5f616c',
    box: 'rgba(255,255,255,.93)', boxLeicht: 'rgba(255,255,255,.88)', boxRand: 'rgba(148,163,184,.45)',
    text: '#111218', text2: '#3a3c48', dim: '#5f616c', rahmen: '#d5d9e0',
    marke: '#1e2a4a', markeText: '#e8ecfb', hpunkt: '#3a3c48',
    gut: '#2f7a3d', hindernisFlaeche: 'rgba(95,97,108,.14)',
    hfMin: '#4a5cb8', hfMax: '#8a6d10', hfBand: 'rgba(47,158,84,.10)', fd: '#3a3c48',
    lastfallBand: 'rgba(95,97,108,.13)', hindernis: '#3a3c48',
  },
  dunkel: {
    hg1: '#121317', hg2: '#0b0c0f', raster: '#2a2c32', achse: '#8b8d97',
    t1: '#5e616b', akzent: '#7c8de0', akzentFlaeche: 'rgba(124,141,224,.18)',
    fehler: '#cf7070', sehne: '#8b8d97', anker: '#b8bac4', ankerLeise: '#8b8d97',
    box: 'rgba(28,29,34,.93)', boxLeicht: 'rgba(28,29,34,.88)', boxRand: 'rgba(68,70,79,.8)',
    text: '#e1e2e8', text2: '#b8bac4', dim: '#8b8d97', rahmen: '#44464f',
    marke: '#7c8de0', markeText: '#0e0f11', hpunkt: '#b8bac4',
    gut: '#6fcf8e', hindernisFlaeche: 'rgba(139,141,151,.18)',
    hfMin: '#7c8de0', hfMax: '#d4b04a', hfBand: 'rgba(111,207,142,.12)', fd: '#b8bac4',
    lastfallBand: 'rgba(184,186,196,.14)', hindernis: '#b8bac4',
  },
};
let _diagrammDruck = false;

// Farben der massstäblichen Zeichnung (SVG) je Thema — PDF immer hell
const ZEICHNUNG_FARBEN = {
  hell: {
    hg: '#ffffff', raster: '#ebebeb', rasterText: '#bbb', achse: '#aaa', bruch: '#999',
    sok: '#aaa', sokText: '#bbb', mast: '#666', anker: '#555', ankerLeise: '#888',
    mass: '#bbb', massStrich: '#aaa', massText: '#888', massL: '#666',
    t1: '#c0c0c0', t1Text: '#999', t3: '#6b7280', fd: '#888888', rfl: '#eb0000',
    hindernis: '#3a3a3a', gut: '#2f7a3d', schlecht: '#dc2626',
    hfMin: '#4a5cb8', hfMax: '#9a7b1a', hfBand: 'rgba(47,158,84,.09)',
  },
  dunkel: {
    hg: '#15161a', raster: '#2a2c32', rasterText: '#6b6e76', achse: '#8b8d97', bruch: '#6b6e76',
    sok: '#6b6e76', sokText: '#8b8d97', mast: '#8b8d97', anker: '#b8bac4', ankerLeise: '#8b8d97',
    mass: '#4e5058', massStrich: '#6b6e76', massText: '#9a9ca6', massL: '#b8bac4',
    t1: '#5e616b', t1Text: '#8b8d97', t3: '#9aa3b5', fd: '#9a9ca6', rfl: '#ff6b6b',
    hindernis: '#b8bac4', gut: '#6fcf8e', schlecht: '#ef6b6b',
    hfMin: '#7c8de0', hfMax: '#d4b04a', hfBand: 'rgba(111,207,142,.12)',
  },
};
function zeichnungFarben(druck = false) {
  const dunkel = !druck && document.documentElement.dataset.thema === 'dunkel';
  return ZEICHNUNG_FARBEN[dunkel ? 'dunkel' : 'hell'];
}
function diagrammFarben() {
  const dunkel = !_diagrammDruck && document.documentElement.dataset.thema === 'dunkel';
  return DIAGRAMM_FARBEN[dunkel ? 'dunkel' : 'hell'];
}
// Diagramm einmal hell zeichnen, als PNG holen, danach wieder im Thema zeichnen
// Für das PDF in fester Grösse (unabhängig von Bildschirm/Handy) und doppelter Auflösung
const DIAGRAMM_DRUCK = { breite: 760, hoehe: 350, faktor: 3 };
function diagrammBildHell() {
  const cv = document.getElementById('main-canvas');
  if (!cv) return '';
  const stil = cv.style.cssText;
  cv.style.width = DIAGRAMM_DRUCK.breite + 'px'; cv.style.height = DIAGRAMM_DRUCK.hoehe + 'px';
  _diagrammDruck = true;
  try { quickDraw(); return cv.toDataURL('image/png'); }
  finally { _diagrammDruck = false; cv.style.cssText = stil; quickDraw(); }
}
// Legende zum Diagramm im PDF: nur was gezeichnet ist, mit Farbmustern wie im Diagramm (hell)
function _pdfDiagrammLegende() {
  const F = DIAGRAMM_FARBEN.hell, c = calcState;
  if (!c) return '';
  const isEl = sysMode === 'el', isRfl = sysMode === 'rfl';
  const temp = T => `${T > 0 ? '+' : T < 0 ? '−' : ''}${Math.abs(T)} °C`;
  const linie = (farbe, art = 'solid', b = 2) => `border-top:${b}px ${art} ${farbe}`;
  const flaeche = (farbe, rand = 'transparent') => `height:9px;background:${farbe};border:1px solid ${rand};border-radius:2px`;
  const e = (stil, txt) => `<span><i style="${stil}"></i>${txt}</span>`;
  const teile = [];
  if (isRfl) teile.push(e(linie(F.akzent, 'solid', 2.5), t('leg.ts1.rfl')));
  else {
    teile.push(e(linie(F.t1, 'dashed', 1.5), `${isEl ? t('leg.leiter1') : t('leg.ts1')} = ${temp(c.T1)}`));
    teile.push(e(linie(F.akzent, 'solid', 2.5), `${isEl ? t('leg.leiter2') : t('leg.ts2')} = ${temp(c.T2)}`));
  }
  if (showT3 && c.c3) teile.push(e(linie(F.akzent, 'dashed', 1.5), `T<sub>3</sub>`));
  teile.push(e(linie(F.sehne, 'dashed', 1), t('leg.sehne')));
  if (diagrammHf && entwicklerModus && !isEl && hfGrenzenM() && !hfGrenzenM().fehler) {
    teile.push(e(linie(F.fd, 'dotted', 2), t('pdf.leg.fd.soll')), e(linie(F.fd, 'solid', 1), t('pdf.leg.fd.ist')));
    teile.push(e(flaeche(F.hfBand, 'rgba(47,158,84,.45)'), 'hf<sub>min</sub> … hf<sub>max</sub>'));
  }
  if (_nachweis.some(n => n.best && n.huelle)) teile.push(e(flaeche(F.lastfallBand), t('leg.lastfaelle')));
  if (_nachweis.some(n => n.best)) teile.push(e(linie(F.hindernis, 'solid', 2), t('pdf.leg.hindernis')));
  const hasSok = getSokMumLeft() !== null || getSokMumRight() !== null;
  teile.push(`<span style="color:#62656f">Y: m ${hasSok ? t('pdf.mum.short') : t('pdf.sok.short')}</span>`);
  return teile.join('');
}
let calcState = null; // Letztes Berechnungsergebnis (für PDF-Export und Messpunkte)

// ── Entwicklermodus ─────────────────────────────────────────────────────────
// Unfertige Funktionen (zurzeit hf_min / hf_max) sind nur im Entwicklermodus sichtbar
// und wirksam. Umschalten: 3× schnell auf das App-Symbol; bleibt auf dem Gerät
// gespeichert (localStorage «dh_dev»). Sichtbarkeit über Klasse .nur-dev (app.css),
// Rechnung/Zeichnung über entwicklerModus (z. B. hfGrenzenM liefert sonst null).
let entwicklerModus = document.documentElement.classList.contains('dev');
function entwicklerModusSetzen(an, { melden = false } = {}) {
  entwicklerModus = !!an;
  try { if (entwicklerModus) localStorage.setItem('dh_dev', '1'); else localStorage.removeItem('dh_dev'); } catch (e) {}
  document.documentElement.classList.toggle('dev', entwicklerModus);
  if (!entwicklerModus && document.getElementById('hf-modal')?.classList.contains('open')) closeHf();
  if (melden) meldung(t(entwicklerModus ? 'dev.an' : 'dev.aus'), 'info');
  if (calcState) berechnen();
}
function _appSymbolEinrichten() {
  const sym = document.querySelector('.header-icon');
  if (!sym || sym.dataset.dev) return;
  sym.dataset.dev = '1';
  let klicks = 0, zeit = null;
  const anim = k => { sym.classList.remove('tipp', 'umgeschaltet'); void sym.offsetWidth; sym.classList.add(k); };
  sym.addEventListener('animationend', () => sym.classList.remove('tipp', 'umgeschaltet'));
  sym.addEventListener('click', () => {
    klicks++; clearTimeout(zeit); zeit = setTimeout(() => { klicks = 0; }, 650);
    if (klicks >= 3) { klicks = 0; anim('umgeschaltet'); entwicklerModusSetzen(!entwicklerModus, { melden: true }); }
    else anim('tipp');
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _appSymbolEinrichten);
else _appSymbolEinrichten();

// Canvas-Koordinatensystem — wird bei jedem Zeichnen aktualisiert
const view = {
  padL: 52, padR: 20, padT: 32, padB: 38, // Randabstände in CSS-px
  cw: 700, ch: 380,                         // CSS-Abmessungen des Canvas
  yHi: 0, scaleX: 1, scaleY: 1,            // Skalierung Realwelt → Canvas-px
  h1x: 0, h1y: 0, h2x: 0, h2y: 0,         // Ankerposition für Treffertest
  probe1CX: null, probe2CX: null, probe3CX: null, probe4CX: null  // Messpunkt-x für Treffertest
};

let drag    = null; // Aktiver Drag: { which, startCY/startCX, startVal }
let probeX1 = null; // M1: Realwelt-x-Position, null = nicht gesetzt
let probeX2 = null; // M2: Realwelt-x-Position, null = nicht gesetzt
let probeX3 = null; // M3
let probeX4 = null; // M4
// H-Punkte je Messpunkt (Hindernis oberhalb, m ü. M.) und Schloss je Messpunkt.
// Im Abschnitt je Feld gespeichert (abschnitt.mp); geprüft wird wie ein
// Hindernis aus Punkten (abschnitt.js) über alle Lastfälle.
let probeHWerte = [null, null, null, null];
let probeSperre = [false, false, false, false];
let hVerbinden  = false;   // H-Punkte als Unterkante verbinden (sonst Einzelpunkte)
let _nachweis    = [];     // Abstandsprüfung des angezeigten Felds: [{ h, best, ok }]
let minClearance = null;      // Mindestabstand H-Punkt → Leiter [m]
let _showMinClearance = true; // Mindestabstand-Zone ein-/ausblenden
let showT3 = false;
let t2BeforeRfl = 80; // T2-Wert vor R-FL-Modus sichern

// ═══════════════════════════════════════════════════════════════
// SICHTBARKEIT
// Einziger Weg, Sichtbarkeit zu setzen und abzufragen. Vorher war beides über
// den Code verstreut und fragte den Inline-Stil direkt ab — eine Abfrage, die
// still «sichtbar» liefert, sobald ein Element per CSS-Klasse verborgen wird.
// ═══════════════════════════════════════════════════════════════

// Setzt die Sichtbarkeit. Ein leerer Wert stellt die Vorgabe aus dem
// Stylesheet wieder her (flex, grid, block …) statt sie zu überschreiben.
// Text sicher in HTML einbauen: Zeichen mit Sonderbedeutung werden maskiert.
// Pflicht für alles, was von Nutzern oder aus importierten Dateien stammt
// (Projekt-, Mast-, Material-, Messungsnamen) und per innerHTML landet —
// sonst könnte eine präparierte Projektdatei Programmcode ausführen.
function escHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Schmaler Bildschirm (Handy) — gleiche Grenze wie die CSS-Regeln @media (max-width: 600px)
const _handyBreite = () => !!window.matchMedia?.('(max-width: 600px)').matches;
function zeigeElement(el, sichtbar) {
  // Bewusst direkter Zugriff auf style.display — dies ist die einzige Stelle
  // im Programm, an der er stehen darf.
  if (el) el.style.display = sichtbar ? '' : 'none';
}

// Fragt die tatsächlich wirksame Sichtbarkeit ab — unabhängig davon, ob per
// Inline-Stil, CSS-Klasse oder Stylesheet verborgen wurde.
function istSichtbar(el) {
  return !!el && getComputedStyle(el).display !== 'none';
}

// ═══════════════════════════════════════════════════════════════
// MELDUNGEN UND RÜCKFRAGEN
// Ersetzen alert() / confirm() / prompt(). Die nativen Dialoge blockieren die
// Seite, lassen sich nicht gestalten und nicht übersetzen.
// ═══════════════════════════════════════════════════════════════

// Hinterlässt eine Spur für abgefangene Fehler. Vorher endeten neun
// catch-Blöcke stumm — ging im Feld etwas schief, blieb kein Hinweis übrig.
// schwere: 'warn' für Unerwartetes, 'debug' für einkalkulierte Fehlschläge
// (z. B. eine Kettenlinie, die für die gewählten Werte keine Lösung hat).
function _spur(bereich, fehler, schwere = 'warn') {
  const txt = (fehler && fehler.message) ? fehler.message : String(fehler);
  (schwere === 'debug' ? console.debug : console.warn)(`[${bereich}] ${txt}`);
}

const _MELDUNG_SYMBOL = {
  info:    '<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.2v4M8 4.8v.9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  erfolg:  '<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5.2 8.2l2 2 3.6-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  warnung: '<path d="M8 2L14.5 13.5H1.5L8 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  fehler:  '<circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
};

// Zeigt eine nicht blockierende Meldung. art: info | erfolg | warnung | fehler
// Fehler bleiben stehen, bis sie weggeklickt werden.
function meldung(text, art = 'info', dauerMs = null) {
  const behaelter = document.getElementById('meldungen');
  if (!behaelter) { console.warn('[Meldung]', art, text); return null; }

  const el = document.createElement('div');
  el.className = 'meldung ' + art;
  el.innerHTML =
    `<svg class="meldung-symbol" width="15" height="15" viewBox="0 0 16 16" fill="none">` +
    `${_MELDUNG_SYMBOL[art] || _MELDUNG_SYMBOL.info}</svg>` +
    `<span class="meldung-text"></span>` +
    `<button class="meldung-zu" title="Schliessen">&#x2715;</button>`;
  el.querySelector('.meldung-text').textContent = String(text);

  const weg = () => {
    if (!el.isConnected) return;
    el.classList.add('geht');
    setTimeout(() => el.remove(), 200);
  };
  el.querySelector('.meldung-zu').onclick = weg;
  behaelter.appendChild(el);

  const stehzeit = dauerMs ?? (art === 'fehler' ? 0 : 5000);
  if (stehzeit > 0) setTimeout(weg, stehzeit);
  return el;
}

// Rückfrage mit Ja/Nein. Liefert ein Promise<boolean>.
// Ersetzt confirm() — Aufrufer müssen das Ergebnis abwarten.
function frageBestaetigung(text, { titel = null, ok = null, abbrechen = null } = {}) {
  return _rueckfrage({ text, titel, ok, abbrechen, eingabe: null });
}

// Rückfrage mit Texteingabe. Liefert Promise<string|null> (null = abgebrochen).
// Ersetzt prompt().
function frageText(text, vorgabe = '', { titel = null, ok = null, abbrechen = null } = {}) {
  return _rueckfrage({ text, titel, ok, abbrechen, eingabe: vorgabe ?? '' });
}

// Rückfrage mit zwei Wahlmöglichkeiten und «Abbrechen». Liefert Promise<'ok'|'alt'|false>.
async function frageWahl(text, { titel = null, ok = null, alt = null, abbrechen = null } = {}) {
  const r = await _rueckfrage({ text, titel, ok, abbrechen, eingabe: null, alt });
  return r === true ? 'ok' : r;
}

// Reiner Hinweis mit einer Schaltfläche. Liefert Promise, sobald geschlossen.
function zeigeHinweis(text, { titel = null, ok = null } = {}) {
  return _rueckfrage({ text, titel, ok, eingabe: null, nurOk: true });
}

function _rueckfrage({ text, titel, ok, abbrechen, eingabe, nurOk = false, alt = null }) {
  return new Promise(aufloesen => {
    const overlay = document.getElementById('rueckfrage');
    if (!overlay) { aufloesen(eingabe === null ? false : null); return; }

    const elTitel = document.getElementById('rf-titel');
    const elText  = document.getElementById('rf-text');
    const elInp   = document.getElementById('rf-eingabe');
    const btnOk   = document.getElementById('rf-ok');
    const btnAbbr = document.getElementById('rf-abbrechen');
    const btnAlt  = document.getElementById('rf-alt');

    elTitel.textContent = titel ?? t('rf.titel');
    elText.textContent  = String(text);
    btnOk.textContent   = ok ?? t('rf.ok');
    btnAbbr.textContent = abbrechen ?? t('rf.abbrechen');
    zeigeElement(btnAbbr, !nurOk);
    if (btnAlt) { btnAlt.textContent = alt ?? ''; zeigeElement(btnAlt, !!alt); }

    const mitEingabe = eingabe !== null;
    zeigeElement(elInp, mitEingabe);
    if (mitEingabe) elInp.value = eingabe;

    const schliessen = (ergebnis) => {
      overlay.classList.remove('open');
      document.removeEventListener('keydown', beiTaste);
      btnOk.onclick = btnAbbr.onclick = overlay.onclick = null;
      if (btnAlt) btnAlt.onclick = null;
      aufloesen(ergebnis);
    };
    const bestaetigen = () => schliessen(mitEingabe ? elInp.value : true);
    const verwerfen   = () => schliessen(mitEingabe ? null : false);

    const beiTaste = e => {
      if (e.key === 'Escape') { e.preventDefault(); verwerfen(); }
      else if (e.key === 'Enter' && (mitEingabe || document.activeElement !== btnAbbr)) {
        e.preventDefault(); bestaetigen();
      }
    };
    btnOk.onclick   = bestaetigen;
    btnAbbr.onclick = verwerfen;
    if (btnAlt && alt) btnAlt.onclick = () => schliessen('alt');
    overlay.onclick = e => { if (e.target === overlay) verwerfen(); };
    document.addEventListener('keydown', beiTaste);

    overlay.classList.add('open');
    setTimeout(() => (mitEingabe ? elInp : btnOk).focus(), 40);
    if (mitEingabe) setTimeout(() => elInp.select(), 50);
  });
}

// ═══════════════════════════════════════════════════════════════
// MATERIALDATEN
// Quelle: SBB «Durchhang 2026.xlsm»
// H_reglage: Reglagezugkraft bei +10 °C, Lm=45 m, Berechnungsart «Ausgleichend»
// Quelle: SBB 0161.1013.0001 (31.10.2024)
// ═══════════════════════════════════════════════════════════════
const MATERIALS = {
  cu95:      { name: 'Cu 95 mm²',        q: 8.4239123,  alpha: 17e-6,   E: 108e9,        AK: 94.77e-6,  L_ref: 45, H_reglage: 3700, basis_kN: 6,  reglage_note: '6 kN Basiskraft (Rückleiter/Speiseleitung)', reglage_note_key: 'mat.rn.6kn.rl',
    H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                       vals:  [6000,5500,5000,4600,4200,3900,3700,3400,3200,3100,2900,2800,2600] },
    // Varianten gemäss Reglagetabelle SBB 0161.1013.0001
    H_reglage_variants: [
      { label: '6 kN', H_reglage: 3700, reglage_note: '6 kN Basiskraft (Rückleiter/Speiseleitung)', reglage_note_key: 'mat.rn.6kn.rl',
        H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                           vals:  [6000,5500,5000,4600,4200,3900,3700,3400,3200,3100,2900,2800,2600] } },
      { label: '8 kN', H_reglage: 4700, reglage_note: '8 kN Basiskraft (Westschweiz, bestehende Leitungen)', reglage_note_key: null,
        H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                           vals:  [8000,7300,6700,6100,5600,5100,4700,4300,4000,3700,3500,3300,3100] } },
    ] },
  cu107:     { name: 'Cu 107 mm²',       q: 9.517,      alpha: 17e-6,   E: 108e9,        AK: 107e-6,    H_reglage: null, basis_kN: null, reglage_note: null, reglage_note_key: null },
  cu150:     { name: 'Cu 150 mm²',       q: 13.4351100, alpha: 17e-6,   E: 108e9,        AK: 149.7e-6,  L_ref: 45, H_reglage: 5600, basis_kN: 9,  reglage_note: '9 kN Basiskraft (normale Zugkraft)',           reglage_note_key: 'mat.rn.9kn',
    H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                       vals:  [9000,8200,7500,6900,6400,6000,5600,5300,5000,4700,4500,4300,4100] },
    H_reglage_variants: [
      { label: '9 kN', H_reglage: 5600, reglage_note: '9 kN Basiskraft (normale Zugkraft)', reglage_note_key: 'mat.rn.9kn',
        H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                           vals:  [9000,8200,7500,6900,6400,6000,5600,5300,5000,4700,4500,4300,4100] } },
      { label: '6 kN', H_reglage: 4300, reglage_note: '6 kN Basiskraft (reduzierte Zugkraft)', reglage_note_key: null,
        H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                           vals:  [6000,5600,5300,5000,4700,4500,4300,4100,4000,3800,3700,3600,3400] } },
    ] },
  cu240:     { name: 'Cu 240 mm²',       q: 21.5746300, alpha: 17e-6,   E: 108e9,        AK: 239.4e-6,  H_reglage: null, basis_kN: null, reglage_note: null },
  cu300:     { name: 'Cu 300 mm²',       q: 26.2818220, alpha: 17e-6,   E: 108e9,        AK: 301.3e-6,  H_reglage: null, basis_kN: null, reglage_note: null },
  stcu50:    { name: 'StCu 50 mm²',      q: 4.0109198,  alpha: 11.5e-6, E: 159e9,        AK: 49.48e-6,  H_reglage: null, basis_kN: null, reglage_note: null },
  stcu92:    { name: 'StCu 92 mm²',      q: 8.2179727,  alpha: 16.2e-6, E: 124e9,        AK: 92.41e-6,  H_reglage: null, basis_kN: null, reglage_note: null },
  aldrey240: { name: 'Aldrey 240 mm²',   q: 6.5606488,  alpha: 23e-6,   E: 5.5897905e10, AK: 239.4e-6,  H_reglage: null, basis_kN: 6, reglage_note: null,
    auto_variant_by_span: true,
    H_reglage_variants: [
      { label: 'c ≤ 35 m', c_max: 35,      L_ref: 30, H_reglage: null, reglage_note: '6 kN Basiszugkraft (c ≤ 35 m)', reglage_note_key: null },
      { label: 'c > 35 m', c_max: Infinity, L_ref: 45, H_reglage: null, reglage_note: '6 kN Basiszugkraft (c > 35 m)', reglage_note_key: null },
    ] },
  aldrey300: { name: 'Aldrey 300 mm²',   q: 8.2670059,  alpha: 23e-6,   E: 5.5897905e10, AK: 301.3e-6,  H_reglage: 2200, basis_kN: 6,  reglage_note: '6 kN Basiskraft (c ≤ 35 m)', reglage_note_key: null,
    auto_variant_by_span: true,
    H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                       vals:  [6000,4800,3800,3200,2800,2400,2200,2000,1900,1700,1600,1500,1500] },
    H_reglage_variants: [
      { label: 'c ≤ 35 m', c_max: 35,       L_ref: 30, H_reglage: 2200, reglage_note: '6 kN Basiskraft (c ≤ 35 m)', reglage_note_key: null,
        H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                           vals:  [6000,4800,3800,3200,2800,2400,2200,2000,1900,1700,1600,1500,1500] } },
      { label: 'c > 35 m', c_max: Infinity,  L_ref: 45, H_reglage: 2900, reglage_note: '6 kN Basiskraft (c > 35 m)', reglage_note_key: null,
        H_reglage_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                           vals:  [6000,5100,4400,3900,3500,3200,2900,2700,2600,2400,2300,2200,2100] } },
    ] },
  aldrey400: { name: 'Aldrey 400 mm²',   q: 11.0422870, alpha: 23e-6,   E: 5.5897905e10, AK: 402.9e-6,  H_reglage: null, basis_kN: 6, reglage_note: null,
    auto_variant_by_span: true,
    H_reglage_variants: [
      { label: 'c ≤ 35 m', c_max: 35,      L_ref: 30, H_reglage: null, reglage_note: '6 kN Basiszugkraft (c ≤ 35 m)', reglage_note_key: null },
      { label: 'c > 35 m', c_max: Infinity, L_ref: 45, H_reglage: null, reglage_note: '6 kN Basiszugkraft (c > 35 m)', reglage_note_key: null },
    ] },
  aldrey550: { name: 'Aldrey 550 mm²',   q: 15.0924340, alpha: 23e-6,   E: 5.5897905e10, AK: 550.6e-6,  H_reglage: null, basis_kN: 6, reglage_note: null,
    auto_variant_by_span: true,
    H_reglage_variants: [
      { label: 'c ≤ 35 m', c_max: 35,      L_ref: 30, H_reglage: null, reglage_note: '6 kN Basiszugkraft (c ≤ 35 m)', reglage_note_key: null },
      { label: 'c > 35 m', c_max: Infinity, L_ref: 45, H_reglage: null, reglage_note: '6 kN Basiszugkraft (c > 35 m)', reglage_note_key: null },
    ] },
  alum191:   { name: 'Alumin. 191 mm²',  q: 5.2465577,  alpha: 23e-6,   E: 5.88399e10,   AK: 191e-6,    H_reglage: null, basis_kN: null, reglage_note: null },
  cusn95:    { name: 'CuSn 0.1 95 mm²',  q: 8.4268000,  alpha: 17e-6,   E: 105e9,        AK: 94.72e-6,  H_reglage: null, basis_kN: null, reglage_note: null },
  bziii50:   { name: 'BzIII 50 mm²',     q: 4.3752600,  alpha: 17e-6,   E: 113e9,        AK: 49.45e-6,  H_reglage: null, basis_kN: null, reglage_note: null },
};

// ── FL-Kombinationen (Quelldaten aus VBA Excel Durchhang 2026.xlsm) ──────────────
// MFL: Gewichtskraft Ts belastet mit Fd + Klemmen [N/m]
// MTS: Gewichtskraft Ts unbelastet [N/m]
// E, AL, AK: Elastizitätsmodul, Ausdehnungskoeff., Querschnitt des Tragseils
const FL_COMBINATIONS = {
  // qFdAbnutzung: für die Abnutzung massgebendes Fahrdrahtgewicht [N/m], aus
  // Excel Blatt «Daten» (MFL − MFL abgenutzt) / Abnutzungsgrad
  'stcu50_cu107': { MFL: 13.87640975, MTS: 4.0109198, E: 1.59e11, AL: 11.5e-6,  AK: 4.9450e-5, qFdAbnutzung: 9.1594111 },
  'stcu92_cu107': { MFL: 18.0834626,  MTS: 8.2179727, E: 1.24e11, AL: 16.2e-6,  AK: 9.241e-5,  qFdAbnutzung: 9.1594111 },
  'stcu92_cu150': { MFL: 22.4572285,  MTS: 8.2179727, E: 1.24e11, AL: 16.2e-6,  AK: 9.240e-5,  qFdAbnutzung: 13.533177 },
};

// ── Kettenwerk-Kombinationen (Quelle: SBB 0161.1013.0001 / Durchhang 2026.xlsm) ──
// N-FL (fixabgefangen): Ts belastet/unbelastet bei +10 °C, Lm=45 m, «Ausgleichend»
//   sh=2.40 m → gestützte N-Fahrleitung, 6 kN Basiskraft
//   sh=1.90 m → gehängte N-Fahrleitung,  8 kN Basiskraft
//   Gotthard: StCu 92 + Cu 150, 10 kN, sh=2.40 m (SBB 0161.1013.0001, Abschn. 7.2)
// R-FL (beweglich, Nachspannvorrichtung): H_Ts=12'000 N, H_Fd=10'000 N, temperaturunabhängig

const KETTENWERK_PRESETS = {

  // ── N-FL ────────────────────────────────────────────────────────────────────
  nfl_stcu50_cu107_240_6: {
    label: 'StCu 50 + Cu 107 · 6 kN',
    title: 'Ts: StCu 50 mm²  ·  Fd: Cu 107 mm²',
    note:  'Reglage Ts: belastet 4\'500 N / unbelastet 1\'700 N bei +10 °C  ·  H Fd: 8\'500 N  (SBB 0161.1013.0001)',
    note_ref: 'SBB 0161.1013.0001',
    sysMode: 'nfl', matTs: 'stcu50', matFd: 'cu107',
    sh: 2.40, H_Ts: 4500, H_Ts_ub: 1700, H_Fd: 8500, T1: 10, wear_max: 30,
    // H_Ts_ub [N] gemäss Reglagetabelle SBB 0161.1013.0001 für T = -20…+40 °C (5 °C-Schritte)
    H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                     vals:  [2500,2300,2100,2000,1900,1800,1700,1600,1600,1500,1400,1400,1300] },
    // Berechnungsart «Starr»: SBB 0161.1013.0003_g (c = 25 m, Basiskraft bei −20 °C)
    starr: { H_Ts: 3900, H_Ts_ub: 2100, note_ref: 'SBB 0161.1013.0003',
             H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                              vals:  [4300,3800,3400,3100,2700,2400,2100,1900,1700,1500,1400,1200,1100] } },
  },
  nfl_stcu50_cu107_190_8: {
    label: 'StCu 50 + Cu 107 · 8 kN',
    title: 'Ts: StCu 50 mm²  ·  Fd: Cu 107 mm²',
    note:  'Reglage Ts: belastet 6\'100 N / unbelastet 3\'500 N bei +10 °C  ·  H Fd: 8\'500 N  (SBB 0161.1013.0001)',
    note_ref: 'SBB 0161.1013.0001',
    sysMode: 'nfl', matTs: 'stcu50', matFd: 'cu107',
    sh: 1.90, H_Ts: 6100, H_Ts_ub: 3500, H_Fd: 8500, T1: 10, wear_max: 30,
    H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                     vals:  [5700,5300,4900,4500,4200,3800,3500,3200,3000,2700,2500,2300,2200] },
    // Berechnungsart «Starr»: SBB 0161.1013.0003_g (c = 25 m, Basiskraft bei −20 °C)
    starr: { H_Ts: 5600, H_Ts_ub: 4500, note_ref: 'SBB 0161.1013.0003',
             H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                              vals:  [7100,6700,6200,5800,5400,4900,4500,4100,3700,3300,2900,2600,2300] } },
  },
  nfl_stcu92_cu107_240_6: {
    label: 'StCu 92 + Cu 107 · 6 kN',
    title: 'Ts: StCu 92 mm²  ·  Fd: Cu 107 mm²',
    note:  'Reglage Ts: belastet 4\'300 N / unbelastet 2\'100 N bei +10 °C  ·  H Fd: 8\'500 N  (SBB 0161.1013.0001)',
    note_ref: 'SBB 0161.1013.0001',
    sysMode: 'nfl', matTs: 'stcu92', matFd: 'cu107',
    sh: 2.40, H_Ts: 4300, H_Ts_ub: 2100, H_Fd: 8500, T1: 10, wear_max: 30,
    H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                     vals:  [2600,2500,2400,2300,2200,2200,2100,2000,2000,1900,1900,1800,1800] },
    // Berechnungsart «Starr»: SBB 0161.1013.0003_g (c = 25 m, Basiskraft bei −20 °C)
    starr: { H_Ts: 3400, H_Ts_ub: 1700, note_ref: 'SBB 0161.1013.0003',
             H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                              vals:  [2800,2500,2300,2100,1900,1800,1700,1600,1500,1500,1400,1300,1300] } },
  },
  nfl_stcu92_cu107_190_8: {
    label: 'StCu 92 + Cu 107 · 8 kN',
    title: 'Ts: StCu 92 mm²  ·  Fd: Cu 107 mm²',
    note:  'Reglage Ts: belastet 5\'500 N / unbelastet 2\'900 N bei +10 °C  ·  H Fd: 8\'500 N  (SBB 0161.1013.0001)',
    note_ref: 'SBB 0161.1013.0001',
    sysMode: 'nfl', matTs: 'stcu92', matFd: 'cu107',
    sh: 1.90, H_Ts: 5500, H_Ts_ub: 2900, H_Fd: 8500, T1: 10, wear_max: 30,
    H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                     vals:  [4300,4000,3700,3400,3200,3100,2900,2800,2600,2500,2400,2300,2300] },
    // Berechnungsart «Starr»: SBB 0161.1013.0003_g (c = 25 m, Basiskraft bei −20 °C)
    starr: { H_Ts: 4400, H_Ts_ub: 2500, note_ref: 'SBB 0161.1013.0003',
             H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                              vals:  [5500,4800,4200,3600,3200,2800,2500,2300,2100,1900,1800,1700,1600] } },
  },
  nfl_stcu92_cu150_gotthard: {
    label: 'StCu 92 + Cu 150 · 10 kN (Gotthard)',
    title: 'Ts: StCu 92 mm²  ·  Fd: Cu 150 mm²',
    note:  'Reglage Ts: belastet 7\'100 N / unbelastet 3\'300 N bei +10 °C  ·  H Fd: 10\'000 N  (SBB 0161.1013.0001, 7.2)',
    note_ref: 'SBB 0161.1013.0001, 7.2',
    sysMode: 'nfl', matTs: 'stcu92', matFd: 'cu150',
    sh: 2.40, H_Ts: 7100, H_Ts_ub: 3300, H_Fd: 10000, T1: 10, wear_max: 25,
    H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                     vals:  [5200,4800,4400,4100,3800,3500,3300,3100,3000,2800,2700,2600,2500] },
    // Berechnungsart «Starr»: SBB 0161.1013.0003_g (c = 25 m, Basiskraft bei −20 °C)
    starr: { H_Ts: 5900, H_Ts_ub: 3400, note_ref: 'SBB 0161.1013.0003',
             H_Ts_ub_table: { temps: [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40],
                              vals:  [7600,6700,5900,5200,4500,3900,3400,3000,2700,2400,2200,2000,1900] } },
  },

  // ── R-FL ────────────────────────────────────────────────────────────────────
  rfl_stcu92_cu107: {
    label: 'StCu 92 + Cu 107',
    title: 'Ts: StCu 92 mm²  ·  Fd: Cu 107 mm²',
    note:  'H Ts: 12\'000 N konstant (Nachspannvorrichtung)  ·  H Fd: 10\'000 N  ·  Abnutzung max. 18 %',
    sysMode: 'rfl', matTs: 'stcu92', matFd: 'cu107',
    sh: 1.60, H_Ts: 12000, H_Fd: 10000, T1: 10, wear_max: 18,
  },
  rfl_stcu92_cu150: {
    label: 'StCu 92 + Cu 150',
    title: 'Ts: StCu 92 mm²  ·  Fd: Cu 150 mm²',
    note:  'H Ts: 12\'000 N konstant (Nachspannvorrichtung)  ·  H Fd: 10\'000 N  ·  Abnutzung max. 25 %',
    sysMode: 'rfl', matTs: 'stcu92', matFd: 'cu150',
    sh: 1.60, H_Ts: 12000, H_Fd: 10000, T1: 10, wear_max: 25,
  },
};

// ── Reglagewerte eines Kettenwerks je Berechnungsart ──────────────────────────
// Ausgleichend: Normal-Reglagetabelle SBB 0161.1013.0001 (c = 45 m)
// Starr:        Starr-Reglagetabelle SBB 0161.1013.0003 (c = 25 m) — nur N-FL
function _presetReglage(p) {
  const starr = p.sysMode === 'nfl' && p.starr && typeof elBerechnungsart !== 'undefined'
                && elBerechnungsart === 'starr';
  return starr
    ? { H_Ts: p.starr.H_Ts, H_Ts_ub: p.starr.H_Ts_ub, H_Ts_ub_table: p.starr.H_Ts_ub_table, note_ref: p.starr.note_ref }
    : { H_Ts: p.H_Ts, H_Ts_ub: p.H_Ts_ub, H_Ts_ub_table: p.H_Ts_ub_table, note_ref: p.note_ref };
}

// ── Preset-Infobox: übersetzte Titel/Notiz-Texte ──────────────────────────────
function buildPresetTitle(p) {
  const ts = t('preset.ts.abbr'), fd = t('preset.fd.abbr');
  const mTs = MATERIALS[p.matTs], mFd = MATERIALS[p.matFd];
  return `${ts}: ${mTs ? mTs.name : p.matTs}  ·  ${fd}: ${mFd ? mFd.name : p.matFd}`;
}

// currentH_Ts_ub / currentT1: optional – überschreiben den Preset-Referenzwert (für T1-Änderung)
function buildPresetNote(p, currentH_Ts_ub, currentT1) {
  const fmt = n => n.toLocaleString('de-CH');
  const ts = t('preset.ts.abbr'), fd = t('preset.fd.abbr');
  if (p.sysMode === 'nfl') {
    const bel = t('preset.nfl.bel'), ub = t('preset.nfl.ub'), bei = t('preset.bei.t1');
    const rg  = _presetReglage(p);
    const ref = rg.note_ref ? `  (${rg.note_ref})` : '';
    // Bezugswerte der Reglagetabelle bei +10 °C (belastet und unbelastet am selben
    // Bezugspunkt). Der Wert bei T₁ steht im H-Feld. currentH_Ts_ub/currentT1 bleiben
    // als Parameter für ältere Aufrufe, werden aber nicht mehr angezeigt.
    const H_ub = _tabelleBeiT(rg.H_Ts_ub_table, 10) ?? rg.H_Ts_ub;
    return `Reglage ${ts} ${bei} +10 °C: ${bel} ${fmt(rg.H_Ts)} N / ${ub} ${fmt(H_ub)} N  ·  H ${fd}: ${fmt(p.H_Fd)} N${ref}`;
  } else if (p.sysMode === 'rfl') {
    const konst = t('preset.hts.konst');
    const abnutzung = t('preset.abnutzung');
    return `H ${ts}: ${fmt(p.H_Ts)} ${konst}  ·  H ${fd}: ${fmt(p.H_Fd)} N  ·  ${abnutzung} ${p.wear_max} % (${100 - p.wear_max} %)`;
  }
  return p.note || '';
}

// Note der Combo-Infobox mit aktuellem T1 / H_Ts_ub aktualisieren
function refreshPresetNote() {
  if (!activePresetP || activePresetP.sysMode !== 'nfl') return;
  const noteEl = document.getElementById('combo-note');
  if (!noteEl) return;
  const T1   = parseFloat(document.getElementById('temp1').value);
  const H_ub = parseInt(document.getElementById('tension').value);
  if (!isNaN(T1) && !isNaN(H_ub)) {
    noteEl.textContent = buildPresetNote(activePresetP, H_ub, T1);
  }
}

// ── Handbuch-Modal ──
function translateHandbuch() {
  // Modal title
  const mt = document.getElementById('handbuch-modal-title');
  if (mt) mt.textContent = t('hb.modal.title');

  // TOC links
  const tocMap = {
    'hb-uebersicht':    'hb.toc.1',
    'hb-eingabe':       'hb.toc.2',
    'hb-verfahren':     'hb.toc.3',
    'hb-leiter':        'hb.toc.4',
    'hb-kombinationen': 'hb.toc.5',
    'hb-werkzeuge':     'hb.toc.6',
    'hb-beispiel':      'hb.toc.7',
    'hb-quellen':       'hb.toc.8',
    'hb-glossar':       'hb.toc.9',
  };
  Object.entries(tocMap).forEach(([anchor, key]) => {
    const a = document.querySelector(`[href="#${anchor}"]`);
    if (a) a.textContent = t(key);
  });

  // Section h3 heading spans (only the title text, not the number prefix)
  const secMap = {
    'hb-s1': 'hb.s1',
    'hb-s2': 'hb.s2',
    'hb-s3': 'hb.s3',
    'hb-s4': 'hb.s4',
    'hb-s5': 'hb.s5',
    'hb-s6': 'hb.s6',
    'hb-s7': 'hb.s7',
    'hb-s8': 'hb.s8',
    'hb-s9': 'hb.s9',
  };
  Object.entries(secMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  });

  // Subsection labels
  const s21 = document.getElementById('hb-s2-1-label');
  if (s21) s21.textContent = t('hb.s2.1');
  const s22 = document.getElementById('hb-s2-2-label');
  if (s22) s22.textContent = t('hb.s2.2');

  // Table column headers (Parameter / Beschreibung)
  document.querySelectorAll('#handbuch-modal .hb-tab-param').forEach(el => {
    el.textContent = t('hb.tab.param');
  });
  document.querySelectorAll('#handbuch-modal .hb-tab-desc').forEach(el => {
    el.textContent = t('hb.tab.desc');
  });

  // Language-specific body sections
  _hbMarkenEntfernen();
  document.querySelectorAll('#handbuch-modal .hb-lang').forEach(el => {
    const show = el.classList.contains('hb-' + currentLang);
    zeigeElement(el, show);
  });
  // Seitenleiste aus den Überschriften der Sprache, Suche neu (nur wenn offen)
  _hbNavBauen();
  if (document.getElementById('handbuch-modal')?.classList.contains('open')) hbSuchen();
}

// Handbuch-Inhalt (handbuch.html) wird erst beim ersten Öffnen geladen — der Start der
// App bleibt schlank; offline liefert ihn der Service Worker aus dem Zwischenspeicher.
let _hbLaden = null;
function _handbuchLaden() {
  if (!_hbLaden) _hbLaden = fetch('handbuch.html').then(r => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }).then(html => { document.getElementById('hb-text').innerHTML = html; })
    .catch(e => { _hbLaden = null; throw e; });
  return _hbLaden;
}
async function openHandbuch()  {
  document.getElementById('handbuch-modal').classList.add('open');
  try { await _handbuchLaden(); }
  catch (e) {
    _spur('Handbuch laden', e);
    const el = document.getElementById('hb-laden');
    if (el) el.textContent = t('hb.laden.fehler');
  }
  translateHandbuch();
}
function closeHandbuch() {
  document.getElementById('handbuch-modal').classList.remove('open');
  document.getElementById('hb-seite')?.classList.remove('offen');
}

// ── Handbuch: Kapitel links (aktuelle Stelle hervorgehoben) und Suche ──
// Die Kapitel werden aus den sichtbaren Überschriften der gewählten Sprache
// gelesen: h3 = Kapitel, fette Absätze «6.3 …» = Unterkapitel.
let _hbKapitel = [];      // [{ el, nr, titel, haupt, link, li }]
let _hbTreffer = [], _hbTrefferI = -1, _hbSuchTimer = null, _hbSpyRaf = 0;
const _hbWeich = () => !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

function _hbNavBauen() {
  const text = document.getElementById('hb-text'), nav = document.getElementById('hb-nav');
  if (!text || !nav || !document.getElementById('handbuch-modal').classList.contains('open')) return;
  text.querySelectorAll('[data-hb-kap]').forEach(el => { el.removeAttribute('data-hb-kap'); if (el.id.startsWith('hb-k-')) el.removeAttribute('id'); });
  _hbKapitel = [];
  text.querySelectorAll('h3[id^="hb-"], p, h4').forEach(el => {
    if (!el.getClientRects().length) return;
    const txt = el.textContent.replace(/\s+/g, ' ').trim();
    const haupt = el.tagName === 'H3';
    const m = haupt ? txt.match(/^(\d+)\s+(.+)$/) : txt.match(/^(\d+\.\d+)\s+(.+)$/);
    if (!m || (!haupt && (txt.length > 160 || parseInt(getComputedStyle(el).fontWeight, 10) < 600))) return;
    if (!haupt && !el.id) el.id = 'hb-k-' + m[1].replace('.', '-');
    el.setAttribute('data-hb-kap', '');
    _hbKapitel.push({ el, nr: m[1], titel: m[2], haupt });
  });
  let html = '<ul>', offen = false;
  _hbKapitel.forEach((k, i) => {
    const a = `<a href="#${k.el.id}" data-i="${i}"><span class="hb-nav-nr">${k.nr}</span><span class="hb-nav-txt">${escHtml(k.titel)}</span><span class="hb-nav-zahl" hidden></span></a>`;
    if (k.haupt) {
      if (offen) html += '</ul></li>';
      html += `<li class="hb-nav-k">${a}<ul class="hb-nav-u">`;
      offen = true;
    } else html += `<li>${a}</li>`;
  });
  if (offen) html += '</ul></li>';
  nav.innerHTML = html + '</ul>';
  nav.querySelectorAll('a[data-i]').forEach(a => {
    const k = _hbKapitel[+a.dataset.i];
    k.link = a; k.li = a.closest('.hb-nav-k');
    a.addEventListener('click', e => { e.preventDefault(); hbKapitelZeigen(+a.dataset.i); });
  });
  if (!text._hbSpy) {
    text._hbSpy = true;
    text.addEventListener('scroll', () => {
      if (_hbSpyRaf) return;
      _hbSpyRaf = requestAnimationFrame(() => { _hbSpyRaf = 0; _hbAktivSetzen(); });
    }, { passive: true });
  }
  _hbAktivSetzen();
}

// Kapitel, in dem man sich gerade befindet: letzte Überschrift oberhalb der
// Lesezeile (40 % der Höhe — ein angesprungener Treffer steht in der Mitte)
function _hbAktivSetzen() {
  const text = document.getElementById('hb-text');
  if (!text || !_hbKapitel.length) return;
  const oben = text.getBoundingClientRect().top + text.clientHeight * 0.4;
  let ai = 0;
  _hbKapitel.forEach((k, i) => { if (k.el.getBoundingClientRect().top <= oben) ai = i; });
  if (text.scrollTop + text.clientHeight >= text.scrollHeight - 4) {
    // Ganz unten: letzte Überschrift, die im Blick ist
    const unten = text.getBoundingClientRect().bottom;
    _hbKapitel.forEach((k, i) => { if (k.el.getBoundingClientRect().top < unten) ai = Math.max(ai, i); });
  }
  let hauptI = ai;
  while (hauptI > 0 && !_hbKapitel[hauptI].haupt) hauptI--;
  _hbKapitel.forEach((k, i) => {
    k.link.classList.toggle('aktiv', i === ai);
    if (k.link.classList.contains('aktiv')) k.link.setAttribute('aria-current', 'location'); else k.link.removeAttribute('aria-current');
    if (k.haupt) k.li.classList.toggle('offen', i === hauptI);
  });
  const k = _hbKapitel[ai];
  const akt = document.getElementById('hb-kapitel-aktuell');
  if (akt) akt.textContent = `${k.nr} ${k.titel}`;
  // Aktiven Eintrag in der Seitenleiste sichtbar halten (nur die Leiste scrollen)
  const seite = document.getElementById('hb-seite');
  if (seite && seite.scrollHeight > seite.clientHeight) {
    const r = k.link.getBoundingClientRect(), sr = seite.getBoundingClientRect();
    if (r.top < sr.top + 90) seite.scrollTop -= sr.top + 90 - r.top;
    else if (r.bottom > sr.bottom - 10) seite.scrollTop += r.bottom - sr.bottom + 10;
  }
}

function hbKapitelZeigen(i) {
  const k = _hbKapitel[i], text = document.getElementById('hb-text');
  if (!k || !text) return;
  const ziel = text.scrollTop + k.el.getBoundingClientRect().top - text.getBoundingClientRect().top - 8;
  text.scrollTo({ top: ziel, behavior: _hbWeich() ? 'smooth' : 'auto' });
  document.getElementById('hb-seite')?.classList.remove('offen');
  document.getElementById('hb-kapitel-knopf')?.setAttribute('aria-expanded', 'false');
}

function hbKapitelMenue() {
  const seite = document.getElementById('hb-seite');
  const auf = seite.classList.toggle('offen');
  document.getElementById('hb-kapitel-knopf').setAttribute('aria-expanded', String(auf));
  // Aktuelles Kapitel in der aufgeklappten Liste zeigen
  const nav = document.getElementById('hb-nav'), a = nav?.querySelector('a.aktiv');
  if (auf && a) nav.scrollTop = a.offsetTop - nav.clientHeight / 2;
}

// ── Suche: Treffer markieren, Anzahl je Kapitel, ↑/↓ bzw. Enter springen ──
function _hbMarkenEntfernen() {
  document.querySelectorAll('#hb-text mark.hb-treffer').forEach(m => {
    const p = m.parentNode;
    p.replaceChild(document.createTextNode(m.textContent), m);
    p.normalize();
  });
}
function hbSucheEingabe() {
  clearTimeout(_hbSuchTimer);
  _hbSuchTimer = setTimeout(hbSuchen, 180);
}
function hbSuchen() {
  const text = document.getElementById('hb-text'), feld = document.getElementById('hb-suche');
  if (!text || !feld) return;
  _hbMarkenEntfernen();
  _hbTreffer = []; _hbTrefferI = -1;
  const q = feld.value.trim();
  if (q.length >= 2) {
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const knoten = [];
    const w = document.createTreeWalker(text, NodeFilter.SHOW_TEXT, {
      acceptNode: n => {
        const el = n.parentElement;
        if (!el || !n.nodeValue.trim() || el.closest('style, script') || !el.getClientRects().length) return NodeFilter.FILTER_REJECT;
        re.lastIndex = 0;
        return re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    while (w.nextNode()) knoten.push(w.currentNode);
    knoten.forEach(n => {
      const frag = document.createDocumentFragment(), v = n.nodeValue;
      let pos = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(v))) {
        if (m.index > pos) frag.appendChild(document.createTextNode(v.slice(pos, m.index)));
        const mk = document.createElement('mark');
        mk.className = 'hb-treffer'; mk.textContent = m[0];
        frag.appendChild(mk); _hbTreffer.push(mk);
        pos = m.index + m[0].length;
      }
      if (pos < v.length) frag.appendChild(document.createTextNode(v.slice(pos)));
      n.parentNode.replaceChild(frag, n);
    });
  }
  // Anzahl je Hauptkapitel in der Seitenleiste
  const haupt = _hbKapitel.filter(k => k.haupt);
  const zahl = new Map(haupt.map(k => [k, 0]));
  let hi = -1;
  _hbTreffer.forEach(mk => {
    while (hi + 1 < haupt.length && (haupt[hi + 1].el.compareDocumentPosition(mk) & Node.DOCUMENT_POSITION_FOLLOWING)) hi++;
    if (hi >= 0) zahl.set(haupt[hi], zahl.get(haupt[hi]) + 1);
  });
  haupt.forEach(k => {
    const b = k.link?.querySelector('.hb-nav-zahl');
    if (!b) return;
    const n = zahl.get(k);
    b.textContent = n; b.hidden = !n;
  });
  _hbTrefferAnzeigen();
  if (_hbTreffer.length) hbTrefferGehe(1);
}
function _hbTrefferAnzeigen() {
  const z = document.getElementById('hb-such-zahl'), q = document.getElementById('hb-suche')?.value.trim() || '';
  if (z) z.textContent = q.length < 2 ? '' : _hbTreffer.length
    ? `${_hbTrefferI + 1} / ${_hbTreffer.length}` : t('hb.keine.treffer');
  document.querySelectorAll('.hb-such-knopf').forEach(b => { b.disabled = _hbTreffer.length < 2; });
}
function hbTrefferGehe(d) {
  if (!_hbTreffer.length) return;
  _hbTreffer[_hbTrefferI]?.classList.remove('aktuell');
  _hbTrefferI = (_hbTrefferI + d + _hbTreffer.length) % _hbTreffer.length;
  const mk = _hbTreffer[_hbTrefferI];
  mk.classList.add('aktuell');
  mk.scrollIntoView({ block: 'center', behavior: _hbWeich() ? 'smooth' : 'auto' });
  _hbTrefferAnzeigen();
}
function hbSucheTaste(e) {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(_hbSuchTimer); if (!_hbTreffer.length) hbSuchen(); else hbTrefferGehe(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape' && e.target.value) { e.preventDefault(); e.stopPropagation(); e.target.value = ''; hbSuchen(); }
}
// Strg/Cmd+F im offenen Handbuch: eigenes Suchfeld statt Browsersuche
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && document.getElementById('handbuch-modal')?.classList.contains('open')) {
    e.preventDefault();
    const f = document.getElementById('hb-suche'); f.focus(); f.select();
  }
});

// ── EXIF GPS-Parser (kompakt, nur JPEG/EXIF, kein externer Dependency) ─────
function _extractExifGps(buf) {
  try {
    const d = new DataView(buf);
    if (d.byteLength < 12 || d.getUint16(0, false) !== 0xFFD8) return null;
    let pos = 2;
    while (pos + 4 <= d.byteLength) {
      if (d.getUint8(pos) !== 0xFF) break;
      const m = d.getUint8(pos + 1);
      if (m === 0xDA || m === 0xD9) break;
      const len = d.getUint16(pos + 2, false);
      if (m === 0xE1 && len > 8) {
        // "Exif\0\0" Header prüfen
        if (d.getUint8(pos+4)===0x45 && d.getUint8(pos+5)===0x78 &&
            d.getUint8(pos+6)===0x69 && d.getUint8(pos+7)===0x66 &&
            d.getUint8(pos+8)===0x00 && d.getUint8(pos+9)===0x00) {
          const T = pos + 10;   // Offset zur TIFF-Basis
          const le = d.getUint16(T, false) === 0x4949;
          const u16 = o => d.getUint16(T + o, le);
          const u32 = o => d.getUint32(T + o, le);
          if (u16(2) !== 42) break;
          // IFD0 → GPS-IFD suchen (Tag 0x8825)
          const ifd0 = u32(4), nc = u16(ifd0);
          let gOff = -1;
          for (let i = 0; i < nc && i < 64; i++) {
            const e = ifd0 + 2 + i * 12;
            if (T + e + 12 > d.byteLength) break;
            if (u16(e) === 0x8825) { gOff = u32(e + 8); break; }
          }
          if (gOff < 0) return null;
          const gn = u16(gOff);
          let latD = null, lonD = null, latR = 'N', lonR = 'E';
          for (let i = 0; i < gn && i < 32; i++) {
            const e = gOff + 2 + i * 12;
            if (T + e + 12 > d.byteLength) break;
            const tag = u16(e), type = u16(e+2), cnt = u32(e+4), vo = u32(e+8);
            const rat = o => { const n=u32(vo+o), dn=u32(vo+o+4); return dn ? n/dn : 0; };
            if (tag === 1) latR = String.fromCharCode(d.getUint8(T + e + 8));
            else if (tag === 3) lonR = String.fromCharCode(d.getUint8(T + e + 8));
            else if (tag === 2 && type === 5 && cnt === 3)
              latD = rat(0) + rat(8)/60 + rat(16)/3600;
            else if (tag === 4 && type === 5 && cnt === 3)
              lonD = rat(0) + rat(8)/60 + rat(16)/3600;
          }
          if (latD !== null && lonD !== null)
            return { lat: latR==='S' ? -latD : latD, lon: lonR==='W' ? -lonD : lonD };
          return null;
        }
      }
      pos += 2 + len;
    }
  } catch(e) { _spur('EXIF', e, 'debug'); }
  return null;
}

// ── Foto-Auswertung ────────────────────────────────────────────────────────
(function() {
  // ── State ──
  let _img        = null;
  let _pts        = [];         // { px, py, role }
  let _activeRole    = null;       // Rolle die der nächste Klick setzt
  let _gps           = null;       // { lat, lon } aus EXIF, oder null
  let _showCatenary      = false;      // Seillinie-Overlay ein/aus
  let _showGrid          = false;      // Fluchtpunkt-Raster ein/aus
  let _fotoTempOverride  = null;       // { H, f, T } vom Temperatur-Slider; null = Messzustand
  let _dragIdx           = null;       // Index in _pts des gerade gezogenen Punktes
  let _dragMoved         = false;      // Wurde während mousedown tatsächlich gezogen?
  let _fotoZoom          = 1.0;        // Zoom-Faktor (1 = kein Zoom)
  let _fotoPanX          = 0;          // Pan-Offset X in Bildpixeln
  let _fotoPanY          = 0;          // Pan-Offset Y in Bildpixeln
  let _fotoPanLocked     = false;      // Bildausschnitt eingefroren
  let _panDrag           = null;       // { startX, startY, startPanX, startPanY } für Pan-Drag
  let _fotoOpacity       = 1.0;        // Foto-Transparenz (1.0 / 0.66 / 0.33)
  let _dimDrag           = null;       // { side, startPx, startOffset } für Bemaßungsarm-Drag
  let _dimOffsets        = { L: 0, R: 0 }; // Arm-Offset in Bildpixeln
  let _lastDimArms       = { L: null, R: null }; // { armX, yTop, yBot } aus letztem _draw()

  // Beide Masten kalibrieren → perspektiv-korrekte Skala k(x)
  // single: 7 Klicks  — linker Mast (2) + rechter Mast (2) + Ankerpunkte (2) + Leiter bei L/2 (1)
  // multi:  6+ Klicks — linker Mast (2) + rechter Mast (2) + Ankerpunkte (2) + Kurvenpunkte (n)
  const _roles = {
    single: ['top_L', 'base_L', 'top_R', 'base_R', 'p1', 'p2', 'cmid'],
    multi:  ['top_L', 'base_L', 'top_R', 'base_R', 'p1', 'p2'],
  };
  const _labels = () => ({
    top_L:  t('foto.lbl.top_L'),
    base_L: t('foto.lbl.base_L'),
    top_R:  t('foto.lbl.top_R'),
    base_R: t('foto.lbl.base_R'),
    p1:     t('foto.lbl.p1'),
    p2:     t('foto.lbl.p2'),
    cmid:   t('foto.lbl.cmid'),
    curve:  t('foto.lbl.curve'),
  });
  const _colors = {
    top_L:'#16a34a', base_L:'#16a34a',
    top_R:'#2563eb', base_R:'#2563eb',
    p1:'#eb0000', p2:'#eb0000',
    cmid:'#2563eb', curve:'#7c3aed',
  };

  function _mode()    { return document.getElementById('foto-mode')?.value || 'single'; }
  function _status(t) {
    const el = document.getElementById('foto-status');
    if (el) el.textContent = t;
    const ov = document.getElementById('foto-status-overlay');
    if (ov) { ov.textContent = t; ov.style.display = t ? 'block' : 'none'; }
  }

  // ── Populate material select ──
  function _populateMat() {
    const sel = document.getElementById('foto-mat');
    if (!sel || sel.options.length > 1) return;
    if (typeof MATERIALS !== 'undefined') {
      Object.entries(MATERIALS).forEach(([k, m]) => {
        if (!m.q) return;
        const o = document.createElement('option'); o.value = k; o.textContent = m.name || k; sel.appendChild(o);
      });
      // Voreingabe: Cu 95
      if (typeof MATERIALS['cu95'] !== 'undefined') sel.value = 'cu95';
    }
  }

  // Expose _populateMat so setCanvasView can call it
  window._fotoPopulateMat = _populateMat;

  // ── Open / Close ──
  window.openFotoModal = function() {
    // Primär: Foto-Tab öffnen
    if (typeof setCanvasView === 'function') setCanvasView('foto');
  };
  window.closeFotoModal = function() {
    document.getElementById('foto-modal').classList.remove('open');
  };
  window.openFotoHelp = function() {
    document.getElementById('foto-modal').classList.add('open');
  };

  window.fotoModeChanged = function() {
    const mode = _mode();
    zeigeElement(document.getElementById('foto-multi-btns'), mode === 'multi');
    // Modusspezifische Klick-Ziel-Buttons ein-/ausblenden
    const btnCmid  = document.getElementById('foto-btn-cmid');
    const btnCurve = document.getElementById('foto-btn-curve');
    zeigeElement(btnCmid, mode === 'single');
    zeigeElement(btnCurve, mode === 'multi' );
    // Aktive Rolle anpassen wenn sie im neuen Modus nicht vorkommt
    const required = _roles[mode];
    if (_activeRole !== 'curve' && !required.includes(_activeRole)) {
      const firstUnset = required.find(r => !_pts.some(p => p.role === r));
      _activeRole = firstUnset || (mode === 'multi' ? 'curve' : null);
    }
    _updateRoleButtons();
    _updateStatus();
  };

  // ── Image load ──
  // ── GPS-Anzeige aktualisieren ──
  function _updateGpsDisplay() {
    const btn = document.getElementById('foto-geoadmin-btn');
    if (!btn) return;
    if (!_gps) {
      btn.href = '#'; btn.style.pointerEvents = 'none'; btn.style.opacity = '.35';
      btn.title = 'Kein GPS in Bildmetadaten';
      return;
    }
    const lat6 = _gps.lat.toFixed(6), lon6 = _gps.lon.toFixed(6);
    btn.href = `https://map.geo.admin.ch/?lang=de&topic=ech&bgLayer=ch.swisstopo.pixelkarte-farbe&lat=${lat6}&lon=${lon6}&zoom=17&crosshair=marker`;
    btn.style.pointerEvents = '';
    btn.style.opacity = '1';
    btn.style.color = 'var(--text)';
    btn.title = `${t('ui.foto.geo.titel')} (${lat6}, ${lon6})`;
  }

  const _FOTO_MAX_PX = 3_000_000;  // maximale Auflösung beim Bildladen (Pixel total ~3 MP)

  function _initFotoImg(src, origW, origH) {
    _img = new Image();
    _img.onload = () => {
      _pts = [];
      _activeRole = _roles[_mode()][0];
      // Zoom + Bemaßungsoffsets zurücksetzen
      _fotoZoom = 1.0; _fotoPanX = 0; _fotoPanY = 0;
      _dimOffsets = { L: 0, R: 0 }; _lastDimArms = { L: null, R: null };
      _updateFotoZoomUI();
      const ph = document.getElementById('foto-canvas-placeholder');
      zeigeElement(ph, false);
      _setupFotoCanvasEvents();
      _draw();
      _updateRoleButtons();
      _updateStatus();
    };
    _img.src = src;
  }

  let _fotoEventsSetup = false;
  function _setupFotoCanvasEvents() {
    if (_fotoEventsSetup) return;
    _fotoEventsSetup = true;
    const canvas = document.getElementById('foto-canvas');
    if (!canvas) return;
    // Mausrad-Zoom (nur mit Ctrl, nur wenn nicht eingefroren)
    canvas.addEventListener('wheel', (e) => {
      if (_fotoPanLocked || (!e.ctrlKey && !e.metaKey)) return;
      e.preventDefault();
      const { cx, cy } = _canvasXYRaw(e);
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      _applyFotoZoom(_fotoZoom * factor, cx, cy);
    }, { passive: false });
    // Touch-Pinch-Zoom
    let _lastPinchDist = null;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        _lastPinchDist = Math.hypot(dx, dy);
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2 && _lastPinchDist && !_fotoPanLocked) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / _lastPinchDist;
        _lastPinchDist = dist;
        const canvas2 = document.getElementById('foto-canvas');
        if (!canvas2) return;
        const rect = canvas2.getBoundingClientRect();
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const sx = canvas2.width / rect.width;
        const sy = canvas2.height / rect.height;
        _applyFotoZoom(_fotoZoom * factor, (mx - rect.left) * sx, (my - rect.top) * sy);
        e.preventDefault();
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { _lastPinchDist = null; }, { passive: true });
  }

  window.fotoLoadImage = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const imgReader = new FileReader();
    imgReader.onload = e => {
      const rawImg = new Image();
      rawImg.onload = () => {
        const ow = rawImg.naturalWidth, oh = rawImg.naturalHeight;
        if (ow * oh > _FOTO_MAX_PX) {
          // Bild skalieren auf max. ~3 MP
          const scale = Math.sqrt(_FOTO_MAX_PX / (ow * oh));
          const nw = Math.round(ow * scale), nh = Math.round(oh * scale);
          const tmp = document.createElement('canvas');
          tmp.width = nw; tmp.height = nh;
          tmp.getContext('2d').drawImage(rawImg, 0, 0, nw, nh);
          _initFotoImg(tmp.toDataURL('image/jpeg', 0.88), nw, nh);
          _status(t('foto.skaliert').replace('{nw}', nw).replace('{nh}', nh)
                            .replace('{ow}', ow).replace('{oh}', oh));
        } else {
          _initFotoImg(e.target.result, ow, oh);
        }
      };
      rawImg.src = e.target.result;
    };
    imgReader.readAsDataURL(file);
    // EXIF GPS aus ersten 64 KB lesen
    _gps = null;
    _updateGpsDisplay();
    const exifReader = new FileReader();
    exifReader.onload = e => {
      _gps = _extractExifGps(e.target.result);
      _updateGpsDisplay();
    };
    exifReader.readAsArrayBuffer(file.slice(0, 65536));
  };

  // ── Canvas-Koordinaten (Bildpixel) aus Mouse- oder Touch-Event ──
  function _canvasXY(event) {
    const canvas = document.getElementById('foto-canvas');
    if (!canvas || !_img) return { px: 0, py: 0 };
    const rect = canvas.getBoundingClientRect();
    const S  = canvas.width;
    const cs = Math.max(S / _img.naturalWidth, S / _img.naturalHeight);
    const src = event.touches ? event.touches[0] : event;
    const cx = (src.clientX - rect.left) * (S / rect.width);
    const cy = (src.clientY - rect.top)  * (S / rect.height);
    return {
      px: (cx - S / 2) / (cs * _fotoZoom) + _img.naturalWidth  / 2 + _fotoPanX,
      py: (cy - S / 2) / (cs * _fotoZoom) + _img.naturalHeight / 2 + _fotoPanY
    };
  }

  // Bildschirmkoordinaten → Bildkoordinaten für Zoom-Zentrierung
  function _canvasXYRaw(event) {
    const canvas = document.getElementById('foto-canvas');
    const rect   = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const src = event.touches ? event.touches[0] : event;
    return {
      cx: (src.clientX - rect.left) * sx,
      cy: (src.clientY - rect.top)  * sy
    };
  }

  // Gibt Index des nächsten Punktes zurück, der innerhalb HIT_R px liegt; sonst -1
  function _hitPoint(px, py) {
    const canvas = document.getElementById('foto-canvas');
    const S   = canvas ? canvas.width : 0;
    const cs  = (canvas && _img) ? Math.max(S / _img.naturalWidth, S / _img.naturalHeight) : 1;
    const dpr = window.devicePixelRatio || 1;
    // Hit-Radius in Bildpixeln: ~24 CSS-Pixel auf dem Bildschirm
    const HIT = Math.max(8, 24 * dpr / (cs * _fotoZoom));
    for (let i = _pts.length - 1; i >= 0; i--) {
      if (Math.hypot(_pts[i].px - px, _pts[i].py - py) < HIT) return i;
    }
    return -1;
  }

  function _placePoint(px, py) {
    if (!_activeRole) { _status(t('foto.ziel.waehlen')); return; }
    if (_activeRole === 'curve') {
      _pts.push({ px, py, role: 'curve' });
    } else {
      const idx = _pts.findIndex(p => p.role === _activeRole);
      if (idx >= 0) _pts[idx] = { px, py, role: _activeRole };
      else _pts.push({ px, py, role: _activeRole });
    }
    _draw();
    // Mastlänge-Prompt nach Setzen von Mastfuss (falls Feld noch leer)
    if (_activeRole === 'base_L' || _activeRole === 'base_R') {
      _showMastLaengePrompt(_activeRole === 'base_L' ? 'L' : 'R');
    }
    const mode = _mode();
    const required = _roles[mode];
    const nextUnset = required.find(r => !_pts.some(p => p.role === r));
    if (nextUnset) {
      _activeRole = nextUnset;
    } else if (mode === 'single') {
      _activeRole = null;
      _calculate();
    } else {
      _activeRole = 'curve';
      const cnt = _pts.filter(p => p.role === 'curve').length;
      const cc = document.getElementById('foto-curve-count');
      if (cc) cc.textContent = `${cnt} Kurvenpunkt${cnt !== 1 ? 'e' : ''} gesetzt`;
    }
    _updateRoleButtons();
    _updateStatus();
  }

  // ── Canvas click (legacy, still used as fallback) ──
  window.fotoCanvasClick = function(event) {
    // Handled by mousedown/up below; only fires when no drag occurred
  };

  // ── Zoom-Hilfsfunktion ──
  function _applyFotoZoom(newZoom, centerCx, centerCy) {
    const canvas = document.getElementById('foto-canvas');
    if (!canvas || !_img) return;
    newZoom = Math.max(1.0, Math.min(8.0, newZoom));
    const S  = canvas.width;
    const cs = Math.max(S / _img.naturalWidth, S / _img.naturalHeight);
    // Zoompunkt in Bildkoordinaten festhalten
    const imgX = (centerCx - S / 2) / (cs * _fotoZoom) + _img.naturalWidth  / 2 + _fotoPanX;
    const imgY = (centerCy - S / 2) / (cs * _fotoZoom) + _img.naturalHeight / 2 + _fotoPanY;
    _fotoZoom = newZoom;
    _fotoPanX = imgX - _img.naturalWidth  / 2 - (centerCx - S / 2) / (cs * _fotoZoom);
    _fotoPanY = imgY - _img.naturalHeight / 2 - (centerCy - S / 2) / (cs * _fotoZoom);
    _draw();
    _updateFotoZoomUI();
  }

  function _updateFotoZoomUI() {
    const lbl = document.getElementById('foto-zoom-lbl');
    if (lbl) lbl.textContent = Math.round(_fotoZoom * 100) + '%';
  }

  window.fotoZoomIn  = () => { const c = document.getElementById('foto-canvas'); _applyFotoZoom(_fotoZoom * 1.25, c ? c.width/2 : 0, c ? c.height/2 : 0); };
  window.fotoZoomOut = () => { const c = document.getElementById('foto-canvas'); _applyFotoZoom(_fotoZoom / 1.25, c ? c.width/2 : 0, c ? c.height/2 : 0); };
  window.fotoZoomReset = () => { _fotoZoom = 1.0; _fotoPanX = 0; _fotoPanY = 0; _draw(); _updateFotoZoomUI(); };
  window.fotoOpacityCycle = () => {
    const steps = [1.0, 0.66, 0.33];
    const next = steps[(steps.indexOf(_fotoOpacity) + 1) % steps.length];
    _fotoOpacity = next;
    const btn = document.getElementById('foto-opacity-btn');
    if (btn) btn.textContent = Math.round(next * 100) + '%';
    if (_img) _draw();
  };
  window.fotoPanLockToggle = () => {
    _fotoPanLocked = !_fotoPanLocked;
    const btn = document.getElementById('foto-pan-lock-btn');
    if (btn) {
      btn.style.background = _fotoPanLocked ? 'var(--text)' : '';
      btn.style.color      = _fotoPanLocked ? '#fff' : '';
      btn.title = t(_fotoPanLocked ? 'ui.foto.pan.frei' : 'ui.foto.pan.titel');
    }
  };

  // ── Drag & Drop für bestehende Punkte + Pan ──
  window.fotoCanvasDown = function(event) {
    if (!_img) return;
    const isMiddle = event.button === 1;
    const isRight  = event.button === 2;
    if (isRight) return;
    const { px, py } = _canvasXY(event);
    const { cx, cy } = _canvasXYRaw(event);

    // Bemaßungsarm-Drag prüfen (vor Punkt-Treffererkennung)
    if (!isMiddle && !_fotoPanLocked) {
      const canvas = document.getElementById('foto-canvas');
      const _S3 = canvas.width;
      const _cs3 = Math.max(_S3 / _img.naturalWidth, _S3 / _img.naturalHeight);
      const _dpr3 = window.devicePixelRatio || 1;
      const hitR = 18 * _dpr3 / (_cs3 * _fotoZoom);
      for (const side of ['L', 'R']) {
        const arm = _lastDimArms[side];
        if (!arm) continue;
        if (Math.abs(px - arm.armX) < hitR && py > arm.yTop - hitR && py < arm.yBot + hitR) {
          _dimDrag = { side, startPx: px, startOffset: _dimOffsets[side] };
          document.getElementById('foto-canvas').style.cursor = 'ew-resize';
          event.preventDefault();
          return;
        }
      }
    }

    const idx = _hitPoint(px, py);
    if (idx >= 0 && !isMiddle) {
      _dragIdx   = idx;
      _dragMoved = false;
      event.preventDefault();
      document.getElementById('foto-canvas').style.cursor = 'grabbing';
    } else if (!_fotoPanLocked && (isMiddle || (!_activeRole && idx < 0))) {
      // Pan-Modus: Mittlere Maustaste oder kein Klick-Ziel aktiv
      _panDrag = { startCx: cx, startCy: cy, startPanX: _fotoPanX, startPanY: _fotoPanY };
      _dragIdx = null;
      _dragMoved = false;
      document.getElementById('foto-canvas').style.cursor = 'move';
      event.preventDefault();
    } else {
      _dragIdx   = null;
      _dragMoved = false;
    }
  };

  window.fotoCanvasMove = function(event) {
    if (!_img) return;
    const canvas = document.getElementById('foto-canvas');
    const { px, py } = _canvasXY(event);
    const { cx, cy } = _canvasXYRaw(event);
    if (_dimDrag) {
      _dimOffsets[_dimDrag.side] = _dimDrag.startOffset + (px - _dimDrag.startPx);
      _draw();
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (_panDrag) {
      const _S  = canvas.width;
      const _cs = _img ? Math.max(_S / _img.naturalWidth, _S / _img.naturalHeight) : 1;
      const dx = (cx - _panDrag.startCx) / (_cs * _fotoZoom);
      const dy = (cy - _panDrag.startCy) / (_cs * _fotoZoom);
      _fotoPanX = _panDrag.startPanX - dx;
      _fotoPanY = _panDrag.startPanY - dy;
      _draw();
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (_dragIdx !== null) {
      _dragMoved    = true;
      _pts[_dragIdx].px = px;
      _pts[_dragIdx].py = py;
      _draw();
      fotoLoupeMove(event);
      if (event.cancelable) event.preventDefault();
      return;
    }
    // Hover-Cursor
    const idx = _hitPoint(px, py);
    if (idx >= 0) {
      canvas.style.cursor = 'grab';
    } else {
      // Bemaßungsarm in der Nähe?
      const _Sh = canvas.width;
      const _csh = Math.max(_Sh / _img.naturalWidth, _Sh / _img.naturalHeight);
      const _dprh = window.devicePixelRatio || 1;
      const hitR = 18 * _dprh / (_csh * _fotoZoom);
      const nearArm = ['L','R'].some(s => {
        const a = _lastDimArms[s];
        return a && Math.abs(px - a.armX) < hitR && py > a.yTop - hitR && py < a.yBot + hitR;
      });
      canvas.style.cursor = nearArm ? 'ew-resize' : (!_activeRole ? 'move' : 'crosshair');
    }
    fotoLoupeMove(event);
  };

  window.fotoCanvasUp = function(event) {
    if (!_img) return;
    const canvas = document.getElementById('foto-canvas');
    const { px, py } = _canvasXY(event);
    if (_dimDrag) {
      _dimDrag = null;
      canvas.style.cursor = _activeRole ? 'crosshair' : 'move';
      return;
    }
    if (_panDrag) {
      _panDrag = null;
      const idx = _hitPoint(px, py);
      canvas.style.cursor = idx >= 0 ? 'grab' : (!_activeRole ? 'move' : 'crosshair');
      return;
    }
    if (_dragIdx !== null) {
      const wasDrag = _dragMoved;
      _dragIdx   = null;
      _dragMoved = false;
      canvas.style.cursor = _hitPoint(px, py) >= 0 ? 'grab' : (_activeRole ? 'crosshair' : 'move');
      if (wasDrag) {
        const mode = _mode();
        const allSet = _roles[mode].every(r => _pts.some(p => p.role === r));
        if (allSet) _calculate();
      } else {
        _placePoint(px, py);
      }
      return;
    }
    // Normaler Klick (kein Drag-Start)
    if (_activeRole) _placePoint(px, py);
  };

  // ── Rolle per Button wählen ──
  window.fotoSetRole = function(role) {
    _activeRole = role;
    _updateRoleButtons();
    _status(`${t('foto.klick')}: ${_labels()[role]}`);
  };

  // ── Rollen-Buttons aktualisieren ──
  function _updateRoleButtons() {
    const mode = _mode();
    const clr = { top_L:'#16a34a', base_L:'#16a34a', top_R:'#2563eb', base_R:'#2563eb',
                  p1:'#eb0000', p2:'#eb0000', cmid:'#2563eb', curve:'#7c3aed' };
    Object.keys(clr).forEach(role => {
      const btn = document.getElementById(`foto-btn-${role}`);
      if (!btn) return;
      const isSet    = _pts.some(p => p.role === role);
      const isActive = _activeRole === role;
      const c = clr[role];
      if (isActive) {
        btn.style.cssText = `background:${c};border-color:${c};color:var(--on-acc);font-weight:600`;
      } else if (isSet) {
        btn.style.cssText = `background:${c}18;border-color:${c};color:${c};font-weight:500`;
      } else {
        btn.style.cssText = 'background:var(--s3);border-color:var(--border2);color:var(--text2);font-weight:400';
      }
    });
    // Kurven-Button: Anzahl anzeigen
    const cvBtn = document.getElementById('foto-btn-curve');
    if (cvBtn) {
      const cnt = _pts.filter(p => p.role === 'curve').length;
      cvBtn.textContent = cnt > 0 ? `${t('foto.kurve.btn')} (${cnt})` : t('foto.kurve.btn');
      zeigeElement(cvBtn, mode === 'multi');
    }
    const cmidBtn = document.getElementById('foto-btn-cmid');
    zeigeElement(cmidBtn, mode === 'single');
  }

  // Beschriftungen der Rollenknöpfe nach einem Sprachwechsel auffrischen.
  // Der Kurven-Knopf trägt eine Anzahl und lässt sich deshalb nicht rein
  // über data-i18n setzen.
  window._fotoBeschriftungenAuffrischen = _updateRoleButtons;

  // ── Status-Zeile ──
  function _updateStatus() {
    if (!_img) { _status(t('foto.load.hint')); return; }
    if (!_activeRole) { _status(t('foto.done.hint')); return; }
    _status(`${t('foto.lbl.' + _activeRole)}`);
  }

  // ── Draw canvas ──
  function _draw() {
    const canvas = document.getElementById('foto-canvas');
    if (!canvas || !_img) return;

    const imgW = _img.naturalWidth;
    const imgH = _img.naturalHeight;

    // Quadratisches Canvas passend zum Container (DPR-bewusst)
    const dpr  = window.devicePixelRatio || 1;
    const wrap = document.getElementById('foto-canvas-wrap');
    const cssS = Math.max(1, wrap ? wrap.offsetWidth : imgW);
    const S    = Math.round(cssS * dpr);
    canvas.width  = S;
    canvas.height = S;
    canvas.style.aspectRatio = '';

    const ctx = canvas.getContext('2d');
    const cs  = Math.max(S / imgW, S / imgH);   // Cover-Skalierung

    // ── Zoom / Pan ──
    const _iz    = 1 / (cs * _fotoZoom);   // Inverse für konstante Bildschirmgrösse
    const halfVis = S / (2 * cs * _fotoZoom);
    _fotoPanX = Math.max(halfVis - imgW / 2, Math.min(imgW / 2 - halfVis, _fotoPanX));
    _fotoPanY = Math.max(halfVis - imgH / 2, Math.min(imgH / 2 - halfVis, _fotoPanY));

    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.scale(cs * _fotoZoom, cs * _fotoZoom);
    ctx.translate(-imgW / 2 - _fotoPanX, -imgH / 2 - _fotoPanY);
    ctx.globalAlpha = _fotoOpacity;
    ctx.drawImage(_img, 0, 0);
    ctx.globalAlpha = 1.0;

    // ── Referenzraster basierend auf Mastpunkten ──
    if (_showGrid) {
      const W = imgW, H_c = imgH;
      ctx.save();
      const lw_g = Math.max(0.8, W / 700) * _iz * dpr;

      // Hilfsfunktion: Linie durch zwei Punkte auf volle Bildbreite verlängern
      const drawExtLine = (p1, p2, style, dash) => {
        if (!p1 || !p2) return;
        const dx = p2.px - p1.px;
        if (Math.abs(dx) < 2) return;
        const slope  = (p2.py - p1.py) / dx;
        const yLeft  = p1.py - p1.px * slope;
        const yRight = p1.py + (W - p1.px) * slope;
        ctx.strokeStyle = style;
        ctx.lineWidth   = lw_g;
        if (dash) ctx.setLineDash([W / 50 * _iz, W / 70 * _iz]);
        else ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(0, yLeft);
        ctx.lineTo(W, yRight);
        ctx.stroke();
        ctx.setLineDash([]);
      };

      const _gTL = _pts.find(p => p.role === 'top_L');
      const _gBL = _pts.find(p => p.role === 'base_L');
      const _gTR = _pts.find(p => p.role === 'top_R');
      const _gBR = _pts.find(p => p.role === 'base_R');

      const hasAnyPt = _gTL || _gBL || _gTR || _gBR;

      if (!hasAnyPt) {
        // Fallback: 3 horizontale Hilfslinien
        ctx.lineWidth = lw_g;
        [0.3, 0.5, 0.7].forEach(f => {
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.setLineDash([W / 55, W / 75]);
          ctx.beginPath(); ctx.moveTo(0, H_c * f); ctx.lineTo(W, H_c * f); ctx.stroke();
        });
        ctx.setLineDash([]);
      } else {
        // Perspektivische Referenzlinien durch die gesetzten Mastpunkte
        drawExtLine(_gTL, _gTR, 'rgba(255,255,255,0.50)', false); // Mastspitze
        drawExtLine(_gBL, _gBR, 'rgba(255,255,255,0.60)', false); // Mastfuss / SOK

        // Linien auch wenn nur eine Seite gesetzt (horizontale Hilfslinie am Punkt)
        if (_gTL && !_gTR) { ctx.strokeStyle='rgba(255,255,255,0.30)'; ctx.lineWidth=lw_g; ctx.setLineDash([W/55*_iz,W/75*_iz]); ctx.beginPath(); ctx.moveTo(0,_gTL.py); ctx.lineTo(W,_gTL.py); ctx.stroke(); ctx.setLineDash([]); }
        if (_gBL && !_gBR) { ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=lw_g; ctx.setLineDash([W/55*_iz,W/75*_iz]); ctx.beginPath(); ctx.moveTo(0,_gBL.py); ctx.lineTo(W,_gBL.py); ctx.stroke(); ctx.setLineDash([]); }
        if (_gTR && !_gTL) { ctx.strokeStyle='rgba(255,255,255,0.30)'; ctx.lineWidth=lw_g; ctx.setLineDash([W/55*_iz,W/75*_iz]); ctx.beginPath(); ctx.moveTo(0,_gTR.py); ctx.lineTo(W,_gTR.py); ctx.stroke(); ctx.setLineDash([]); }
        if (_gBR && !_gBL) { ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=lw_g; ctx.setLineDash([W/55*_iz,W/75*_iz]); ctx.beginPath(); ctx.moveTo(0,_gBR.py); ctx.lineTo(W,_gBR.py); ctx.stroke(); ctx.setLineDash([]); }

        // Sekundäre Zwischenlinien entlang der Mastlänge (3 gleichmässig verteilt)
        // Pro Seite: Interpolation zwischen top und base → 3 Zwischenpunkte bei 25%, 50%, 75%
        const _nSecondary = 9; // Anzahl Zwischenlinien
        const _drawSecondaryLines = (pTop, pBot, otherTop, otherBot) => {
          if (!pTop || !pBot) return;
          for (let i = 1; i < _nSecondary; i++) {
            const t = i / _nSecondary;
            const ix1 = { px: pTop.px + t * (pBot.px - pTop.px), py: pTop.py + t * (pBot.py - pTop.py) };
            if (otherTop && otherBot) {
              const ix2 = { px: otherTop.px + t * (otherBot.px - otherTop.px), py: otherTop.py + t * (otherBot.py - otherTop.py) };
              drawExtLine(ix1, ix2, 'rgba(255,255,255,0.32)', true);
            } else {
              ctx.strokeStyle = 'rgba(255,255,255,0.32)';
              ctx.lineWidth = lw_g * 0.85;
              ctx.setLineDash([W/55*_iz, W/75*_iz]);
              ctx.beginPath(); ctx.moveTo(0, ix1.py); ctx.lineTo(W, ix1.py); ctx.stroke();
              ctx.setLineDash([]);
            }
          }
        };
        _drawSecondaryLines(_gTL, _gBL, _gTR, _gBR);

        // Vertikale gestrichelte Linien an den Mastfuss-x-Positionen (Senkrechte prüfen)
        [_gBL, _gBR].filter(Boolean).forEach(pt => {
          ctx.strokeStyle = 'rgba(255,255,255,0.22)';
          ctx.lineWidth   = Math.max(0.6, W / 900) * _iz;
          ctx.setLineDash([W/60*_iz, W/80*_iz]);
          ctx.beginPath(); ctx.moveTo(pt.px, 0); ctx.lineTo(pt.px, H_c); ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      ctx.restore();
    }

    const ptTopL   = _pts.find(p => p.role === 'top_L');
    const ptBaseL  = _pts.find(p => p.role === 'base_L');
    const ptTopR   = _pts.find(p => p.role === 'top_R');
    const ptBaseR  = _pts.find(p => p.role === 'base_R');
    const ptP1     = _pts.find(p => p.role === 'p1');
    const ptP2     = _pts.find(p => p.role === 'p2');
    const ptCmid   = _pts.find(p => p.role === 'cmid');
    const curvePts = _pts.filter(p => p.role === 'curve');

    const lw = Math.max(1.2, imgW / 850) * _iz * dpr;
    const r  = Math.max(6,   imgW / 175) * _iz * dpr;
    const fs = Math.max(11,  imgW / 110) * _iz * dpr;

    // Mastbezeichnungen aus Eingabefeldern
    const nameL = document.getElementById('foto-name-L')?.value.trim() || '';
    const nameR = document.getElementById('foto-name-R')?.value.trim() || '';

    // Linke Mastlinie (grün)
    if (ptTopL && ptBaseL) {
      ctx.strokeStyle = '#16a34a'; ctx.lineWidth = lw; ctx.setLineDash([lw*4, lw*2]);
      ctx.beginPath(); ctx.moveTo(ptTopL.px, ptTopL.py); ctx.lineTo(ptBaseL.px, ptBaseL.py); ctx.stroke();
      ctx.setLineDash([]);
      if (nameL) {
        ctx.font = `bold ${fs}px Arial`;
        const tw = ctx.measureText(nameL).width;
        const _p = Math.max(2, 3 * _iz * dpr);
        const lx = ptBaseL.px - tw / 2, ly = ptBaseL.py + r * 2 + fs;
        ctx.fillStyle = 'rgba(22,163,74,.15)';
        ctx.beginPath(); ctx.roundRect(lx - _p, ly - fs, tw + 2*_p, fs + _p, _p); ctx.fill();
        ctx.fillStyle = '#16a34a';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(nameL, lx, ly);
      }
    }
    // Rechte Mastlinie (teal)
    if (ptTopR && ptBaseR) {
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = lw; ctx.setLineDash([lw*4, lw*2]);
      ctx.beginPath(); ctx.moveTo(ptTopR.px, ptTopR.py); ctx.lineTo(ptBaseR.px, ptBaseR.py); ctx.stroke();
      ctx.setLineDash([]);
      if (nameR) {
        ctx.font = `bold ${fs}px Arial`;
        const tw = ctx.measureText(nameR).width;
        const _p = Math.max(2, 3 * _iz * dpr);
        const lx = ptBaseR.px - tw / 2, ly = ptBaseR.py + r * 2 + fs;
        ctx.fillStyle = 'rgba(37,99,235,.15)';
        ctx.beginPath(); ctx.roundRect(lx - _p, ly - fs, tw + 2*_p, fs + _p, _p); ctx.fill();
        ctx.fillStyle = '#2563eb';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(nameR, lx, ly);
      }
    }
    // Ankersehne P1 → P2 (rot)
    if (ptP1 && ptP2) {
      ctx.strokeStyle = '#eb0000'; ctx.lineWidth = lw; ctx.setLineDash([lw*5, lw*3]);
      ctx.beginPath(); ctx.moveTo(ptP1.px, ptP1.py); ctx.lineTo(ptP2.px, ptP2.py); ctx.stroke();
      ctx.setLineDash([]);

      // Vertikale Führungslinie bei perspektiv-korrektem L/2
      let t_img_L2 = 0.5;
      if (ptTopL && ptBaseL && ptTopR && ptBaseR) {
        const hmL   = parseFloat(document.getElementById('foto-hmast-L')?.value) || 0;
        const hmR_v = parseFloat(document.getElementById('foto-hmast-R')?.value);
        const hmR   = hmR_v > 0 ? hmR_v : hmL;
        const mpxL  = Math.abs(ptBaseL.py - ptTopL.py);
        const mpxR  = Math.abs(ptBaseR.py - ptTopR.py);
        const kL_d  = mpxL > 0 ? hmL / mpxL : 0;
        const kR_d  = mpxR > 0 ? hmR / mpxR : 0;
        if (kL_d > 0 && kR_d > 0) { const rp = kR_d / kL_d; t_img_L2 = rp / (1 + rp); }
      }
      const px_L2     = ptP1.px + t_img_L2 * (ptP2.px - ptP1.px);
      const chordY_L2 = ptP1.py + t_img_L2 * (ptP2.py - ptP1.py);
      const isActiveCmid = _activeRole === 'cmid';
      ctx.strokeStyle = isActiveCmid ? 'rgba(37,99,235,0.65)' : 'rgba(37,99,235,0.30)';
      ctx.lineWidth = lw; ctx.setLineDash([lw*3, lw*2]);
      ctx.beginPath(); ctx.moveTo(px_L2, 0); ctx.lineTo(px_L2, imgH); ctx.stroke();
      ctx.setLineDash([]);
      // Querstrich an Sehnenhöhe
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = lw * 1.5;
      ctx.beginPath(); ctx.moveTo(px_L2 - r*2.5, chordY_L2); ctx.lineTo(px_L2 + r*2.5, chordY_L2); ctx.stroke();
      // Label oben
      const Lv = parseFloat(document.getElementById('foto-L')?.value);
      const lblL2 = Lv > 0 ? `L/2 = ${(Lv/2).toFixed(0)} m` : 'L/2';
      ctx.font = `${fs * 0.72}px Arial`; ctx.fillStyle = 'rgba(37,99,235,0.75)';
      ctx.textAlign = 'center'; ctx.fillText(lblL2, px_L2, r * 2.2); ctx.textAlign = 'left';
    }
    // Sag-Linie (cmid ↑ zur Sehne, blau) — Sehne am Klick-x des Punkts
    if (ptP1 && ptP2 && ptCmid) {
      const t_img_c    = (ptCmid.px - ptP1.px) / (ptP2.px - ptP1.px);
      const chordY_mid = ptP1.py + t_img_c * (ptP2.py - ptP1.py);
      ctx.strokeStyle = '#2563eb'; ctx.lineWidth = lw * 1.5; ctx.setLineDash([lw*3, lw*2]);
      ctx.beginPath(); ctx.moveTo(ptCmid.px, ptCmid.py); ctx.lineTo(ptCmid.px, chordY_mid); ctx.stroke();
      ctx.setLineDash([]);

      // f-Bemaßung (Dimension-Linie rechts oder links je nach Platz)
      const fVal = window._fotoResult?.f;
      if (fVal != null && fVal > 0) {
        const yTop = chordY_mid;
        const yBot = ptCmid.py;
        const spaceR = imgW - ptCmid.px;
        const goRight = spaceR > r * 14;
        const armX  = goRight ? ptCmid.px + r * 4 : ptCmid.px - r * 4;
        const tick   = r * 1.2;
        // Maßlinie
        ctx.strokeStyle = '#2563eb'; ctx.lineWidth = lw * 0.9; ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(armX, yTop); ctx.lineTo(armX, yBot); ctx.stroke();
        // Querabschlüsse
        ctx.beginPath();
        ctx.moveTo(armX - tick, yTop); ctx.lineTo(armX + tick, yTop);
        ctx.moveTo(armX - tick, yBot); ctx.lineTo(armX + tick, yBot);
        ctx.stroke();
        // Zuleitungen
        ctx.setLineDash([lw * 2, lw * 1.5]);
        ctx.beginPath();
        ctx.moveTo(ptCmid.px, yTop); ctx.lineTo(armX, yTop);
        ctx.moveTo(ptCmid.px, yBot); ctx.lineTo(armX, yBot);
        ctx.stroke();
        ctx.setLineDash([]);
        // Label
        const fsDim = fs * 0.82;
        ctx.font = `bold ${fsDim}px Arial`;
        const lbl_f = `f = ${fVal.toFixed(2)} m`;
        const tw_f  = ctx.measureText(lbl_f).width;
        const lx_f  = goRight ? armX + r * 1.2 : armX - r * 1.2 - tw_f;
        const ly_f  = (yTop + yBot) / 2 + fsDim * 0.38;
        const _fp = Math.max(2, 3 * _iz * dpr);
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.beginPath();
        ctx.roundRect(lx_f - _fp, ly_f - fsDim - _fp * 0.3, tw_f + 2 * _fp, fsDim + _fp * 1.5, _fp);
        ctx.fill();
        ctx.fillStyle = '#2563eb';
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(lbl_f, lx_f, ly_f);
      }
    }
    // ── Fadenkreuz-Marker ──────────────────────────────────────────────────────
    // hex-Farbe → rgba-String
    const _hexRgba = (hex, a) => {
      const h = hex.replace('#','');
      const r_ = parseInt(h.slice(0,2),16), g_ = parseInt(h.slice(2,4),16), b_ = parseInt(h.slice(4,6),16);
      return `rgba(${r_},${g_},${b_},${a})`;
    };

    const _drawCrosshair = (px, py, color, label, rr, labelLeft = false) => {
      ctx.save();
      // 1. Fadenkreuz-Arme (ausserhalb des Rings)
      const inner = rr * 1.25, outer = rr * 2.1;
      ctx.strokeStyle = _hexRgba(color, 0.80);
      ctx.lineWidth = lw * 1.2;
      ctx.setLineDash([]);
      [[0,-1],[0,1],[1,0],[-1,0]].forEach(([dx,dy]) => {
        ctx.beginPath();
        ctx.moveTo(px + dx * inner, py + dy * inner);
        ctx.lineTo(px + dx * outer, py + dy * outer);
        ctx.stroke();
      });
      // 2. Ring (Outline, kein Fill)
      ctx.strokeStyle = _hexRgba(color, 0.88);
      ctx.lineWidth = lw * 1.5;
      ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.stroke();
      // 3. Mittelpunkt (kleiner gefüllter Punkt)
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(px, py, lw * 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color; ctx.lineWidth = lw * 0.9;
      ctx.beginPath(); ctx.arc(px, py, lw * 1.8, 0, Math.PI * 2); ctx.stroke();
      // 4. Label-Pill (links oder rechts oben vom Ring)
      if (label) {
        const fsl = Math.round(fs * 0.58);
        ctx.font = `600 ${fsl}px Arial`;
        const tw = ctx.measureText(label).width;
        const ly = py - rr * 0.85;
        const lx = labelLeft ? px - rr * 0.75 : px + rr * 0.75;
        const pp = 3 * _iz;
        const pillX = labelLeft ? lx - tw - pp : lx - pp;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        ctx.beginPath();
        ctx.roundRect(pillX, ly - fsl, tw + 2 * pp, fsl + 4 * _iz, 2 * _iz);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.textAlign = labelLeft ? 'right' : 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, lx, ly);
      }
      ctx.restore();
    };

    // Kurvenpunkte (violett, etwas kleiner)
    curvePts.forEach((p, i) => {
      _drawCrosshair(p.px, p.py, '#7c3aed', `C${i+1}`, r * 0.75);
    });

    // Fixer Punkte Labels
    const _fixedLabels = { top_L:'▲ L', base_L:'▼ L', top_R:'▲ R', base_R:'▼ R', p1:'P1', p2:'P2', cmid:'f' };
    const _labelLeft = new Set(['top_L', 'base_L', 'p1']);
    _pts.filter(p => p.role !== 'curve').forEach(p => {
      _drawCrosshair(p.px, p.py, _colors[p.role] || '#333', _fixedLabels[p.role] || '', r, _labelLeft.has(p.role));
    });

    // ── Höhenbemaßung P1 / P2 über Mastfuss ──
    const _drawHeightDim = (ptAnchor, ptBase, kVal, color, side) => {
      if (!ptAnchor || !ptBase || !kVal || kVal <= 0) return;
      const hm = (ptBase.py - ptAnchor.py) * kVal;
      if (hm <= 0 || !isFinite(hm)) return;

      const x0   = ptAnchor.px;
      const yTop = ptAnchor.py;
      const yBot = ptBase.py;
      const armX = (side === 'L' ? x0 - r * 3.5 : x0 + r * 3.5) + _dimOffsets[side];
      const tick = r * 1.4;

      // Arm-Position für Hit-Detection merken
      _lastDimArms[side] = { armX, yTop, yBot };

      // Vertikale Maßlinie (bei aktivem Drag etwas heller)
      const isDragging = _dimDrag?.side === side;
      ctx.strokeStyle = isDragging ? color + 'cc' : color;
      ctx.lineWidth = lw * (isDragging ? 1.4 : 0.9);
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(armX, yTop); ctx.lineTo(armX, yBot); ctx.stroke();
      // Querabschlüsse
      ctx.lineWidth = lw * 0.9;
      ctx.beginPath();
      ctx.moveTo(armX - tick, yTop); ctx.lineTo(armX + tick, yTop);
      ctx.moveTo(armX - tick, yBot); ctx.lineTo(armX + tick, yBot);
      ctx.stroke();
      // Horizontale Zuleitung
      ctx.setLineDash([lw * 2, lw * 1.5]);
      ctx.beginPath(); ctx.moveTo(x0, yTop); ctx.lineTo(armX, yTop); ctx.stroke();
      ctx.setLineDash([]);
      // Grab-Punkt in Mitte der Linie
      const midY = (yTop + yBot) / 2;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(armX, midY, r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(armX, midY, r * 0.28, 0, Math.PI * 2); ctx.fill();

      // Textlabel
      const label  = hm.toFixed(2) + ' m';
      const fsDim  = fs * 0.82;
      ctx.font = `bold ${fsDim}px Arial`;
      const tw = ctx.measureText(label).width;
      const lx = side === 'L' ? armX - tw - r * 1.2 : armX + r * 1.2;
      const ly = midY + fsDim * 0.38;
      const _dp = Math.max(2, 3 * _iz * dpr);
      ctx.fillStyle = 'rgba(255,255,255,0.82)';
      ctx.beginPath();
      ctx.roundRect(lx - _dp, ly - fsDim - _dp * 0.3, tw + 2 * _dp, fsDim + _dp * 1.5, _dp);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, lx, ly);
    };
    // k_L / k_R aus Eingabefeldern ableiten (nur für Anzeige, falls gesetzt)
    const _hmL  = parseFloat(document.getElementById('foto-hmast-L')?.value);
    const _hmR  = parseFloat(document.getElementById('foto-hmast-R')?.value) || _hmL;
    const _kL_d = (ptTopL && ptBaseL && _hmL > 0)
                  ? _hmL / (ptBaseL.py - ptTopL.py) : 0;
    const _kR_d = (ptTopR && ptBaseR && _hmR > 0)
                  ? _hmR / (ptBaseR.py - ptTopR.py) : 0;
    _drawHeightDim(ptP1, ptBaseL, _kL_d, '#16a34a', 'L');
    _drawHeightDim(ptP2, ptBaseR, _kR_d, '#2563eb', 'R');

    // Live-Update der Sidebar während Drag (h1/h2 sofort nachführen)
    if (_dragIdx !== null && window._fotoTabActive && _kL_d > 0 && _kR_d > 0 && ptP1 && ptP2 && ptBaseL && ptBaseR) {
      const _liveH1 = (ptBaseL.py - ptP1.py) * _kL_d;
      const _liveH2 = (ptBaseR.py - ptP2.py) * _kR_d;
      const h1El = document.getElementById('h1');
      const h2El = document.getElementById('h2');
      if (h1El && _liveH1 > 0) h1El.value = _liveH1.toFixed(2);
      if (h2El && _liveH2 > 0) h2El.value = _liveH2.toFixed(2);
    }

    // ── Berechnete Seillinie (Katenoide) als Overlay ──
    if (_showCatenary && window._fotoResult && typeof catSagAt === 'function') {
      const res = window._fotoResult;
      const { q, L: rL, dh: rDh, k_L: rKL, k_R: rKR, ptP1: rP1, ptP2: rP2 } = res;
      // Temperatur-Override: Slider-H überschreibt Mess-H für das Overlay
      const H = (_fotoTempOverride ? _fotoTempOverride.H : res.H);
      if (H && q && rL && rP1 && rP2 && rKL && rKR) {
        // Perspektivisch korrekte Abbildung t_img → t_real
        // r = k_R/k_L: >1 wenn rechter Mast weiter weg (k_R gross, wenig px/m)
        const rPerspect = rKR / rKL;
        const toReal = t => (Math.abs(rPerspect - 1) < 1e-4) ? t
                           : t / (rPerspect * (1 - t) + t);
        const steps = 120;
        ctx.save();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'rgba(235,0,0,0.70)';
        ctx.lineWidth   = lw * 2.5;
        ctx.setLineDash([]);
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t_img  = i / steps;
          const t_real = toReal(t_img);
          const cx     = rP1.px + t_img  * (rP2.px - rP1.px);
          const k_t    = rKL + t_real * (rKR - rKL);      // k am physischen Ort
          const sagM   = catSagAt(H, q, rL, rDh, t_real * rL);
          const cy     = (rP1.py + t_img * (rP2.py - rP1.py)) + sagM / k_t;
          if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
        }
        ctx.stroke();
        ctx.restore();
        // Beschriftung «H = x kN» — Tiefpunkt in Bildkoordinaten suchen
        const t_real_mid = toReal(0.5);
        const midCx   = (rP1.px + rP2.px) / 2;
        const midSagM = catSagAt(H, q, rL, rDh, t_real_mid * rL);
        const k_mid   = rKL + t_real_mid * (rKR - rKL);
        const midCy   = (rP1.py + rP2.py) / 2 + midSagM / k_mid;
        // Label «H = x kN» knapp unterhalb des Tiefpunkts
        const lblFs = fs * 0.85;
        ctx.font = `bold ${lblFs}px Arial`;
        const label = `H = ${(H/1000).toFixed(2)} kN`;
        const tw = ctx.measureText(label).width;
        const lblY = midCy + r * 1.6 + lblFs;
        const _hp = Math.max(2, 4 * _iz * dpr);
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        ctx.beginPath(); ctx.roundRect(midCx - tw/2 - _hp, lblY - lblFs - _hp * 0.3, tw + 2 * _hp, lblFs + _hp * 1.5, _hp); ctx.fill();
        ctx.fillStyle = '#eb0000';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(label, midCx, lblY);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

      }
    }
    ctx.restore();  // Zoom/Pan-Transform zurücksetzen
  }

  // ── Calculate ──
  function _calculate() {
    const L      = parseFloat(document.getElementById('foto-L')?.value);
    const hmastL = parseFloat(document.getElementById('foto-hmast-L')?.value);
    const hmastR_raw = parseFloat(document.getElementById('foto-hmast-R')?.value);
    const hmastR = isNaN(hmastR_raw) ? hmastL : hmastR_raw;  // R fällt auf L zurück
    const T1     = parseFloat(document.getElementById('foto-T1')?.value);
    const mode   = _mode();

    if (!L || L <= 0)          { _status(t('foto.span.fehlt')); return; }
    if (!hmastL || hmastL <= 0){ _status(t('foto.masthoehe.fehlt')); return; }
    if (isNaN(T1))              { _status(t('foto.temp.fehlt')); return; }

    const ptTopL  = _pts.find(p => p.role === 'top_L');
    const ptBaseL = _pts.find(p => p.role === 'base_L');
    const ptTopR  = _pts.find(p => p.role === 'top_R');
    const ptBaseR = _pts.find(p => p.role === 'base_R');
    const ptP1    = _pts.find(p => p.role === 'p1');
    const ptP2    = _pts.find(p => p.role === 'p2');

    if (!ptTopL || !ptBaseL || !ptTopR || !ptBaseR || !ptP1 || !ptP2) { _status(t('foto.punkte.fehlen')); return; }

    // Vertikale Kalibrierung: je ein k pro Mast (perspektiv-korrekt)
    const mastPxL = ptBaseL.py - ptTopL.py;
    const mastPxR = ptBaseR.py - ptTopR.py;
    if (mastPxL <= 0) { _status(t('foto.mastfuss.li')); return; }
    if (mastPxR <= 0) { _status(t('foto.mastfuss.re')); return; }
    const k_L = hmastL / mastPxL;   // [m/px] bei linkem Mast
    const k_R = hmastR / mastPxR;   // [m/px] bei rechtem Mast

    // Mastangaben: SOK m ü. M. und Δ Mastfuss − SOK (freiwillig, sonst 0).
    // Die Fusspunkte im Foto liegen am Mastfuss → Höhe über SOK = gemessen + Δ;
    // Mastfuss m ü. M. = SOK + Δ (für den Bericht in foto-elev-L/R).
    const _dWert = id => { const v = parseFloat(document.getElementById(id)?.value); return Number.isFinite(v) ? v : 0; };
    const dL = _dWert('mast-delta-sok-left'), dR = _dWert('mast-delta-sok-right');
    const sokL = getSokMumLeft(), sokR = getSokMumRight();
    const mitSok = sokL !== null && sokR !== null;
    document.getElementById('foto-elev-L').value = mitSok ? (sokL + dL).toFixed(3) : '';
    document.getElementById('foto-elev-R').value = mitSok ? (sokR + dR).toFixed(3) : '';
    // dh: Höhenunterschied Ankerpunkte, gemessen mit lokalem k
    // h_P1/h_P2 = Höhe über SOK des jeweiligen Masts (Canvas y wächst nach unten)
    const h_P1 = (ptBaseL.py - ptP1.py) * k_L + dL;
    const h_P2 = (ptBaseR.py - ptP2.py) * k_R + dR;
    const dhElev = mitSok ? sokL - sokR : 0;
    const dh   = h_P1 - h_P2 + dhElev;   // catSagAt: h > 0 wenn linker Anker höher

    // Material / q
    const matKey = document.getElementById('foto-mat')?.value;
    const mat = (matKey && typeof MATERIALS !== 'undefined') ? MATERIALS[matKey] : null;
    // q: aus Material, Fallback auf weight-ts (NFL/RFL Preset-Gewicht) oder foto-q Override
    const qWeightTs = parseFloat(document.getElementById('weight-ts')?.value);
    const q = mat?.q || (!isNaN(qWeightTs) && qWeightTs > 0 ? qWeightTs : null) || null;
    if (!q) { _status(t('foto.material.fehlt')); return; }

    let H = null, f = null, xC = null;

    // Perspektivisch korrekte Abbildung t_img → t_real (dieselbe Formel wie im Overlay)
    const _rPersp = (k_L > 0 && k_R > 0) ? k_R / k_L : 1;
    const _toReal = t => (Math.abs(_rPersp - 1) < 1e-4) ? t
                        : t / (_rPersp * (1 - t) + t);

    if (mode === 'single') {
      // Messpunkt irgendwo auf dem Leiter — Klick-x bestimmt t_img → t_real
      const ptC = _pts.find(p => p.role === 'cmid');
      if (!ptC) { _status('Leiterpunkt klicken!'); return; }
      const t_img  = (ptC.px - ptP1.px) / (ptP2.px - ptP1.px);
      const t_real = _toReal(Math.max(0.01, Math.min(0.99, t_img)));
      xC = t_real * L;
      const k_xc   = k_L + t_real * (k_R - k_L);
      const chordY = ptP1.py + t_img * (ptP2.py - ptP1.py);  // Sehne im Bildraum
      f = (ptC.py - chordY) * k_xc;
      if (f <= 0) { _status('Leiterpunkt muss unterhalb der Ankersehne liegen.'); return; }
      H = typeof solve3point === 'function' ? solve3point(L, dh, q, xC, f) : null;

    } else {
      // Modus B: Golden-Section auf H; perspektiv-korrekte Span-Positionen
      const curvePts = _pts.filter(p => p.role === 'curve');
      if (curvePts.length < 3) { _status('Mind. 3 Kurvenpunkte setzen!'); return; }

      const measPts = curvePts.map(p => {
        const t_img   = (p.px - ptP1.px) / (ptP2.px - ptP1.px);
        const t_real  = _toReal(Math.max(0.01, Math.min(0.99, t_img)));
        const k_i     = k_L + t_real * (k_R - k_L);
        const chordPy = ptP1.py + t_img * (ptP2.py - ptP1.py);
        return { xC: t_real * L, sag: (p.py - chordPy) * k_i };
      }).filter(mp => mp.sag > 0);

      if (measPts.length < 2) { _status(t('foto.kurve.unter')); return; }

      const cost = Htest => {
        if (Htest <= 0) return 1e18;
        return measPts.reduce((s, mp) => {
          const sc = typeof catSagAt === 'function' ? catSagAt(Htest, q, L, dh, mp.xC) : 0;
          return s + (sc - mp.sag) ** 2;
        }, 0);
      };
      const phi = (Math.sqrt(5) - 1) / 2;
      let lo = 50, hi = 60000;
      for (let i = 0; i < 80; i++) {
        const m1 = hi - phi * (hi - lo), m2 = lo + phi * (hi - lo);
        if (cost(m1) < cost(m2)) hi = m2; else lo = m1;
      }
      H  = (lo + hi) / 2;
      xC = L / 2;
      f  = typeof catSagAt === 'function' ? catSagAt(H, q, L, dh, xC) : null;
    }

    if (!H || H <= 0 || !isFinite(H)) { _status(t('foto.berechnung.fehl')); return; }

    // Ergebnis anzeigen
    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setEl('foto-f',  f  != null ? f.toFixed(2)  + ' m'    : '—');
    setEl('foto-H',  H  != null ? (H/1000).toFixed(2) + ' kN (' + Math.round(H) + ' N)' : '—');
    setEl('foto-xC', xC != null ? xC.toFixed(2) + ' m'    : '—');
    setEl('foto-dh', dh != null ? dh.toFixed(2) + ' m'    : '—');
    const hintEl = document.getElementById('foto-xc-hint');
    if (hintEl && xC != null) {
      const lHalf = (L / 2).toFixed(1);
      const atMid = Math.abs(xC - L / 2) < 0.5;
      hintEl.innerHTML = atMid
        ? `f gemessen nahe Feldmitte (x<sub>C</sub> ≈ L/2 = ${lHalf} m) — Slider-f vergleichbar.`
        : t('foto.xc.hinweis').replace('{xc}', xC.toFixed(1)).replace('{lh}', lHalf);
    }
    setEl('foto-k',  `L: ${(k_L*1000).toFixed(2)} / R: ${(k_R*1000).toFixed(2)} mm/px`);
    setEl('foto-T1-result', `${T1} °C`);
    const nameL = document.getElementById('foto-name-L')?.value.trim() || '';
    const nameR = document.getElementById('foto-name-R')?.value.trim() || '';
    const mastLabel = [nameL, nameR].filter(Boolean).join(' — ');
    const mastEl = document.getElementById('foto-mast-names');
    if (mastEl) {
      const _mastRow = document.getElementById('foto-mast-names-row');
      zeigeElement(_mastRow, mastLabel);
      mastEl.textContent = mastLabel || '';
    }
    zeigeElement(document.getElementById('foto-result'), true);
    // Messtemperatur-Label aktualisieren
    const _tempLbl = document.getElementById('foto-result-temp');
    if (_tempLbl) _tempLbl.textContent = `bei T₂ = ${T1}°C`;
    _status(t('foto.messung.fertig'));
    _showCatenary = true;
    _updateCatenaryBtn();
    window._fotoResult = { H, xC, f, L, q, dh, k_L, k_R, T1, nameL, nameR,
      h_P1, h_P2,
      ptP1: { px: ptP1.px, py: ptP1.py }, ptP2: { px: ptP2.px, py: ptP2.py } };
    // Bei aktivem Foto-Tab: Sidebar-Felder aus Messung befüllen
    if (window._fotoTabActive) {
      const h1El = document.getElementById('h1');
      const h2El = document.getElementById('h2');
      const tEl  = document.getElementById('tension');
      if (h1El) h1El.value = h_P1.toFixed(2);
      if (h2El) h2El.value = h_P2.toFixed(2);
      if (tEl)  tEl.value  = Math.round(H);
      // Hauptberechnung mit neuen Werten aktualisieren (Diagramm-Tab bleibt synchron)
      if (typeof berechnen === 'function') berechnen();
    }
    // T₂-Regler aus Sidebar auslesen und Foto-Auswertung damit aktualisieren
    _fotoTempOverride = null;
    const T2cur = parseFloat(document.getElementById('temp2')?.value);
    const tSldrVal = document.getElementById('foto-T-slider-val');
    if (tSldrVal) tSldrVal.textContent = (!isNaN(T2cur) ? T2cur : T1) + ' °C';
    // Montage-Referenz: T₁ aus Sidebar (Montagetemperatur), Fallback 10°C
    const T1_mont = parseFloat(document.getElementById('temp1')?.value);
    const T_mont  = !isNaN(T1_mont) ? T1_mont : 10;
    const mont = _solveAtTemp(T_mont);
    if (window._fotoResult && mont) window._fotoResult.H_T1 = mont.H;
    const montEl = document.getElementById('foto-H-mont');
    if (montEl) montEl.textContent = mont ? (mont.H / 1000).toFixed(2) + ' kN' : '—';
    // Montage-Label aktualisieren
    const montLabel = document.querySelector('#foto-montage-ref .metric-label');
    if (montLabel) montLabel.textContent = `Montage (${T_mont} °C)`;
    // Anzeige bei aktueller T₂ befüllen (oder bei T1 wenn T2 nicht gesetzt)
    const T2eff = !isNaN(T2cur) ? T2cur : T1;
    const resT2 = _solveAtTemp(T2eff);
    const hTempEl = document.getElementById('foto-H-temp');
    const fTempEl = document.getElementById('foto-f-temp');
    if (resT2) {
      if (hTempEl) hTempEl.textContent = (resT2.H / 1000).toFixed(2) + ' kN  (' + Math.round(resT2.H) + ' N)';
      if (fTempEl) fTempEl.textContent = resT2.f != null ? resT2.f.toFixed(2) + ' m' : '—';
      _fotoTempOverride = resT2;
    } else {
      if (hTempEl) hTempEl.textContent = (H / 1000).toFixed(2) + ' kN  (' + Math.round(H) + ' N)';
      if (fTempEl) fTempEl.textContent = f != null ? f.toFixed(2) + ' m' : '—';
    }
    // Soll/Ist-Block mit Messzustand initialisieren
    const fAtHalf = (typeof catSagAt === 'function') ? catSagAt(H, q, L, dh, L / 2) : null;
    _updateSollIst(T2eff, resT2 || { H, f: fAtHalf });
    _draw();  // Seillinie als Overlay zeichnen
    if (typeof window._fotoUpdateProbeOut === 'function') window._fotoUpdateProbeOut();
  }
  window.fotoCalculate = _calculate;
  window.fotoRedraw    = _draw;
  window.fotoRecalcIfReady = function() { if (window._fotoResult) _calculate(); };

  // ── Seillinienhöhe an x-Position (für Probe-Readout im Foto-Tab) ──
  function _fotoWireHeightAt(xM) {
    const r = window._fotoResult;
    if (!r || !xM || isNaN(xM) || typeof catSagAt !== 'function') return null;
    if (xM < 0 || xM > r.L) return null;
    const hAnker = r.h_P1 + (xM / r.L) * (r.h_P2 - r.h_P1);  // Ankerhöhe interpoliert
    const H = _fotoTempOverride ? _fotoTempOverride.H : r.H;
    const sag = catSagAt(H, r.q, r.L, r.dh, xM);
    return hAnker - sag;
  }

  function _fotoUpdateProbeOut() {
    return; // Box entfernt
    const shVal = parseFloat(document.getElementById('sh')?.value) || 0;
    const badges = ['<span class="probe-mp-badge m1">M1</span>','<span class="probe-mp-badge m2">M2</span>','<span class="probe-mp-badge m3">M3</span>','<span class="probe-mp-badge m4">M4</span>'];
    const ids    = ['probe-x1','probe-x2','probe-x3','probe-x4'];
    let rows = '';
    let any = false;
    ids.forEach((id, i) => {
      const x = parseFloat(document.getElementById(id)?.value);
      if (isNaN(x) || x <= 0) return;
      any = true;
      const h = _fotoWireHeightAt(x);
      if (h == null) { rows += `${badges[i]}<span>${x.toFixed(1)} m</span><span style="color:var(--muted)">—</span><span></span>`; return; }
      const delta = shVal > 0 ? h - shVal : null;
      const dColor = delta !== null ? (delta < 0 ? '#eb0000' : '#16a34a') : '';
      const dStr   = delta !== null ? `<span style="color:${dColor};font-weight:600">Δ ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} m</span>` : '<span></span>';
      rows += `${badges[i]}<span style="color:var(--muted)">${x.toFixed(1)} m</span><span style="font-weight:600">${h.toFixed(2)} m ${t('dyn.ueber.sok')}</span>${dStr}`;
    });
    if (!any) { zeigeElement(outEl, false); return; }
    rowsEl.innerHTML = rows;
    zeigeElement(outEl, true);
  }
  window._fotoUpdateProbeOut = _fotoUpdateProbeOut;

  // ── Temperatur-Solver (Zustandsgleichung) ──
  function _solveAtTemp(T_target) {
    const r = window._fotoResult;
    if (!r) return null;
    const matKey = document.getElementById('foto-mat')?.value;
    const mat = (typeof MATERIALS !== 'undefined') ? MATERIALS[matKey] : null;
    if (!mat?.E || !mat?.AK || !mat?.alpha) return null;
    const EA    = mat.E * mat.AK;
    const alpha = mat.alpha;
    const Lm    = Math.sqrt(r.L * r.L + r.dh * r.dh);
    const dT    = T_target - r.T1;
    const H2    = (typeof solveStateEq === 'function')
                  ? solveStateEq(r.q, Lm, r.H, EA, alpha, dT)
                  : null;
    if (!H2 || !isFinite(H2) || H2 <= 0) return null;
    const f2 = (typeof catSagAt === 'function') ? catSagAt(H2, r.q, r.L, r.dh, r.L / 2) : null;
    return { H: H2, f: f2, T: T_target };
  }
  window.fotoSolveAtTemp = _solveAtTemp;

  // ── Reglagewert-Interpolation ──
  function _interpReglage(table, T) {
    if (!table) return null;
    const { temps, vals } = table;
    const n = temps.length;
    if (T <= temps[0]) return vals[0];
    if (T >= temps[n - 1]) {
      // Lineare Extrapolation ab letzten zwei Stützpunkten (physikalisch korrekt bis 80°C)
      const slope = (vals[n - 1] - vals[n - 2]) / (temps[n - 1] - temps[n - 2]);
      return Math.max(100, Math.round(vals[n - 1] + slope * (T - temps[n - 1])));
    }
    for (let i = 0; i < n - 1; i++) {
      if (T >= temps[i] && T <= temps[i + 1]) {
        const t = (T - temps[i]) / (temps[i + 1] - temps[i]);
        return vals[i] + t * (vals[i + 1] - vals[i]);
      }
    }
    return null;
  }

  function _updateSollIst(T, res) {
    const r = window._fotoResult;
    const matKey = document.getElementById('foto-mat')?.value;
    const mat    = (typeof MATERIALS !== 'undefined') ? MATERIALS[matKey] : null;
    // Tabelle suchen: direkt oder in erster Variante
    const tbl    = mat?.H_reglage_table
                || mat?.H_reglage_variants?.[0]?.H_reglage_table
                || null;
    const lref   = mat?.L_ref || null;

    // L_ref-Hinweis
    const lrefEl = document.getElementById('foto-lref-note');
    if (lrefEl) lrefEl.textContent = lref ? `L₀ = ${lref} m` : 'kein Reglagewert';

    // «H bei T₂ = X°C» Label mit aktueller Temperatur
    const hTLabel = document.getElementById('foto-H-bei-T-label');
    if (hTLabel) hTLabel.textContent = `H bei T₂ = ${T}°C`;

    // Spannweiten-Hinweis wenn L ≠ L₀
    const spanHint = document.getElementById('foto-span-hint');
    if (spanHint && r && lref) {
      const Leff = r.L;
      if (Math.abs(Leff - lref) > 0.5) {
        spanHint.textContent = `ⓘ Soll: L₀ = ${lref} m · Ist gemessen: L = ${Leff} m`;
        zeigeElement(spanHint, true);
      } else {
        zeigeElement(spanHint, false);
      }
    } else if (spanHint) {
      zeigeElement(spanHint, false);
    }

    const H_reg = _interpReglage(tbl, T);
    const f_reg = (H_reg != null && r && typeof catSagAt === 'function')
                  ? catSagAt(H_reg, r.q, r.L, r.dh, r.L / 2) : null;

    const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    // Ist-Werte
    setEl('foto-H-ist', res ? (res.H / 1000).toFixed(2) + ' kN' : '—');
    setEl('foto-f-ist', res?.f != null ? res.f.toFixed(2) + ' m' : '—');
    // Soll-Werte
    setEl('foto-H-reglage', H_reg != null ? (H_reg / 1000).toFixed(2) + ' kN' : '—');
    setEl('foto-f-reglage', f_reg != null ? f_reg.toFixed(2) + ' m' : '—');
    // Abweichungen
    const dHEl = document.getElementById('foto-delta-H');
    const dFEl = document.getElementById('foto-delta-f');
    if (dHEl) {
      if (H_reg && res) {
        const d = (res.H - H_reg) / H_reg * 100;
        dHEl.textContent = (d >= 0 ? '+' : '') + d.toFixed(1) + ' %';
        dHEl.style.color = Math.abs(d) > 10 ? '#eb0000' : '#16a34a';
      } else { dHEl.textContent = '—'; dHEl.style.color = ''; }
    }
    if (dFEl) {
      if (f_reg != null && res?.f != null) {
        const d = (res.f - f_reg) / f_reg * 100;
        dFEl.textContent = (d >= 0 ? '+' : '') + d.toFixed(1) + ' %';
        dFEl.style.color = Math.abs(d) > 10 ? '#eb0000' : '#16a34a';
      } else { dFEl.textContent = '—'; dFEl.style.color = ''; }
    }
    // Block sichtbar/versteckt je nach Datenlage
    const wrap = document.getElementById('foto-soll-ist-wrap');
    zeigeElement(wrap, tbl);
  }

  // ── Slider-Handler ──
  window.fotoSliderChange = function(val) {
    const T = parseFloat(val);
    document.getElementById('foto-T-slider-val').textContent = T + ' °C';
    const res = _solveAtTemp(T);
    if (!res) return;
    _fotoTempOverride = res;
    const hEl = document.getElementById('foto-H-temp');
    const fEl = document.getElementById('foto-f-temp');
    if (hEl) hEl.textContent = (res.H / 1000).toFixed(2) + ' kN  (' + Math.round(res.H) + ' N)';
    if (fEl) fEl.textContent = res.f != null ? res.f.toFixed(2) + ' m' : '—';
    _updateSollIst(T, res);
    if (_showCatenary && _img) _draw();
    if (typeof window._fotoUpdateProbeOut === 'function') window._fotoUpdateProbeOut();
  };

  // ── Lupe ──
  window.fotoLoupeMove = function(event) {
    if (!_img) return;
    const canvas = document.getElementById('foto-canvas');
    const loupe  = document.getElementById('foto-loupe');
    if (!canvas || !loupe) return;

    // Nur anzeigen wenn Freeze aktiv UND Punkt gesetzt/gezogen wird
    const isPlacing = _activeRole !== null;
    const isDragging = _dragIdx !== null;
    if (!_fotoPanLocked || (!isPlacing && !isDragging)) {
      zeigeElement(loupe, false);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width  / rect.width;
    const sy = canvas.height / rect.height;
    const src = event.touches ? event.touches[0] : event;
    const mx = (src.clientX - rect.left) * sx;
    const my = (src.clientY - rect.top)  * sy;

    // Im Vollbild grössere Lupe (240 px statt 180 px)
    const inFS     = !!document.fullscreenElement;
    const loupeCss = inFS ? 240 : 180;
    const zoom     = 4;
    const srcR     = (loupeCss / 2 / zoom) * sx;
    const lSz      = loupe.width;

    loupe.style.width  = loupeCss + 'px';
    loupe.style.height = loupeCss + 'px';

    const ctx = loupe.getContext('2d');
    ctx.clearRect(0, 0, lSz, lSz);

    // Kreisausschnitt — Canvas-Inhalt (inkl. gerenderte Marker)
    ctx.save();
    ctx.beginPath(); ctx.arc(lSz/2, lSz/2, lSz/2 - 1, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(canvas, mx - srcR, my - srcR, srcR * 2, srcR * 2, 0, 0, lSz, lSz);
    ctx.restore();

    // Absetzmarker: Farbe je nach Rolle oder gezogenem Punkt
    const role = isPlacing ? _activeRole : (_pts[_dragIdx] ? _pts[_dragIdx].role : null);
    const markerColor = (_colors[role] || '#eb0000');
    const c  = lSz / 2;
    const rr = lSz * 0.13;
    const armIn  = rr * 1.3;
    const armOut = rr * 2.2;

    ctx.strokeStyle = markerColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    // Arme
    [[0,-1],[0,1],[1,0],[-1,0]].forEach(([dx,dy]) => {
      ctx.beginPath();
      ctx.moveTo(c + dx*armIn,  c + dy*armIn);
      ctx.lineTo(c + dx*armOut, c + dy*armOut);
      ctx.stroke();
    });
    // Ring
    ctx.beginPath(); ctx.arc(c, c, rr, 0, Math.PI*2); ctx.stroke();
    // Mittelpunkt
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(c, c, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = markerColor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(c, c, 2.5, 0, Math.PI*2); ctx.stroke();

    // Randring
    ctx.strokeStyle = 'rgba(30,30,30,.45)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(lSz/2, lSz/2, lSz/2 - 1, 0, Math.PI * 2); ctx.stroke();

    loupe.style.left = '50%';
    loupe.style.right = 'auto';
    loupe.style.bottom = '.6rem';
    loupe.style.top = 'auto';
    loupe.style.transform = 'translateX(-50%)';
    loupe.style.display = 'block';
  };

  window.fotoLoupeHide = function() {
    const loupe = document.getElementById('foto-loupe');
    zeigeElement(loupe, false);
  };

  // ── IndexedDB — Feldaufnahmen ──
  let _feldDB = null;
  function _openFeldDB(cb) {
    if (_feldDB) { cb(_feldDB); return; }
    const req = indexedDB.open('foto_feldaufnahmen', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('messungen', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = e => { _feldDB = e.target.result; cb(_feldDB); };
    req.onerror   = () => _status(t('foto.db.fehler'));
  }

  function _renderMessungenList() {
    _openFeldDB(db => {
      const all = [];
      db.transaction('messungen').objectStore('messungen').openCursor().onsuccess = e => {
        const cur = e.target.result;
        if (cur) { all.push(cur.value); cur.continue(); }
        else {
          const ul = document.getElementById('foto-messungen-list');
          if (!ul) return;
          ul.innerHTML = all.length === 0
            ? `<li style="color:var(--muted);font-size:.72rem;padding:.3rem 0">${t('foto.keine.messungen')}</li>`
            : all.reverse().map(rec => `
                <li style="display:flex;align-items:center;gap:.4rem;padding:.25rem 0;border-bottom:1px solid var(--border)">
                  <span style="flex:1;font-size:.75rem;cursor:pointer;color:var(--text)"
                        onclick="fotoLoadMessung(${rec.id})">
                    ${escHtml(rec.label)}
                    <span style="color:var(--muted);font-size:.68rem;margin-left:.3rem">${new Date(rec.ts).toLocaleDateString('de-CH')}</span>
                  </span>
                  <button onclick="fotoDeleteMessung(${rec.id})"
                    style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:.8rem;padding:0 .2rem"
                    title="${t('foto.loeschen')}">✕</button>
                </li>`).join('');
        }
      };
    });
  }

  window.fotoToggleMessungenList = function() {
    const panel = document.getElementById('foto-messungen-panel');
    if (!panel) return;
    const isOpen = istSichtbar(panel);
    zeigeElement(panel, !(isOpen));
    if (!isOpen) _renderMessungenList();
  };

  window.fotoSaveMessung = function() {
    if (!_img || !window._fotoResult) { _status(t('foto.keine.fertige')); return; }
    // Rohbild ohne Overlays speichern (Original-Auflösung, kein Canvas-Screenshot)
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width  = _img.naturalWidth;
    rawCanvas.height = _img.naturalHeight;
    rawCanvas.getContext('2d').drawImage(_img, 0, 0);
    const imageDataURL = rawCanvas.toDataURL('image/jpeg', 0.90);
    const g = id => document.getElementById(id)?.value ?? '';
    const inputs = {
      L: g('foto-L'), mat: g('foto-mat'), q: g('foto-q'), T1: g('foto-T1'),
      mode: g('foto-mode'),
      nameL: g('foto-name-L'), hmastL: g('foto-hmast-L'), elevL: g('foto-elev-L'),
      nameR: g('foto-name-R'), hmastR: g('foto-hmast-R'), elevR: g('foto-elev-R'),
    };
    const fr = window._fotoResult;
    const label = [inputs.nameL, inputs.nameR].filter(Boolean).join(' — ')
                || `${t('foto.messung.name')} ${new Date().toLocaleDateString(_sprachTag())}`;
    const record = {
      ts: Date.now(), label, imageDataURL, inputs,
      gps: _gps || null,
      viewState: {
        opacity:      _fotoOpacity,
        showCatenary: _showCatenary,
        showGrid:     _showGrid,
        dimOffsets:   { L: _dimOffsets.L, R: _dimOffsets.R },
        zoom:         _fotoZoom,
        panX:         _fotoPanX,
        panY:         _fotoPanY,
      },
      pts:    _pts.map(p => ({ ...p })),
      result: { H: fr.H, f: fr.f, xC: fr.xC, L: fr.L, q: fr.q, dh: fr.dh, T1: fr.T1,
                k_L: fr.k_L, k_R: fr.k_R, nameL: fr.nameL, nameR: fr.nameR },
    };
    _openFeldDB(db => {
      db.transaction('messungen', 'readwrite').objectStore('messungen').add(record)
        .onsuccess = () => {
          _status(t('foto.messung.gesp'));
          const panel = document.getElementById('foto-messungen-panel');
          if (istSichtbar(panel)) _renderMessungenList();
        };
    });
  };

  window.fotoLoadMessung = function(id) {
    _openFeldDB(db => {
      db.transaction('messungen').objectStore('messungen').get(id).onsuccess = e => {
        const rec = e.target.result;
        if (!rec) return;
        const iv = (elId, val) => { const el = document.getElementById(elId); if (el && val != null) el.value = val; };
        iv('foto-L', rec.inputs.L); iv('foto-mat', rec.inputs.mat);
        iv('foto-q', rec.inputs.q); iv('foto-T1', rec.inputs.T1);
        iv('foto-mode', rec.inputs.mode);
        iv('foto-name-L', rec.inputs.nameL); iv('foto-hmast-L', rec.inputs.hmastL); iv('foto-elev-L', rec.inputs.elevL);
        iv('foto-name-R', rec.inputs.nameR); iv('foto-hmast-R', rec.inputs.hmastR); iv('foto-elev-R', rec.inputs.elevR);
        _pts = rec.pts.map(p => ({ ...p }));
        _gps = rec.gps || null;
        _updateGpsDisplay();
        // View-State wiederherstellen
        const vs = rec.viewState || {};
        _fotoOpacity  = vs.opacity      ?? 1.0;
        _showCatenary = !!vs.showCatenary;
        _showGrid     = !!vs.showGrid;
        _dimOffsets   = { L: vs.dimOffsets?.L ?? 0, R: vs.dimOffsets?.R ?? 0 };
        _fotoZoom     = vs.zoom ?? 1.0;
        _fotoPanX     = vs.panX ?? 0;
        _fotoPanY     = vs.panY ?? 0;
        // UI-Buttons synchronisieren
        const _opBtn = document.getElementById('foto-opacity-btn');
        if (_opBtn) _opBtn.textContent = Math.round(_fotoOpacity * 100) + '%';
        _updateCatenaryBtn();
        const _grdBtn = document.getElementById('foto-grid-toggle');
        if (_grdBtn) {
          _grdBtn.textContent       = _showGrid ? t('foto.grid.on') : t('foto.grid.off');
          _grdBtn.style.color       = _showGrid ? 'var(--text)' : 'var(--muted)';
          _grdBtn.style.borderColor = _showGrid ? 'var(--text)' : 'var(--border)';
          _grdBtn.style.fontWeight  = _showGrid ? '600' : '400';
        }
        _updateFotoZoomUI();
        _img = new Image();
        _img.onload = () => {
          const ph = document.getElementById('foto-canvas-placeholder');
          zeigeElement(ph, false);
          _draw();
          _calculate();
        };
        _img.src = rec.imageDataURL;
        _status(t('foto.messung.geladen'));
      };
    });
  };

  window.fotoDeleteMessung = function(id) {
    _openFeldDB(db => {
      db.transaction('messungen', 'readwrite').objectStore('messungen').delete(id)
        .onsuccess = () => _renderMessungenList();
    });
  };

  // ── In App übernehmen ──
  window.fotoApplyToCalc = async function() {
    const fr = window._fotoResult;
    if (!fr) return;
    if (typeof spanMode !== 'undefined' && spanMode === 'ruling') {
      if (!await frageBestaetigung(t('foto.uebernahme.ruling'))) return;
      if (typeof setSpanMode === 'function') setSpanMode('single');
    }
    const spanEl = document.getElementById('span');
    if (spanEl) spanEl.value = fr.L;
    const h1El = document.getElementById('h1');
    const h2El = document.getElementById('h2');
    if (h1El && fr.h_P1 != null) h1El.value = fr.h_P1.toFixed(2);
    if (h2El && fr.h_P2 != null) h2El.value = fr.h_P2.toFixed(2);
    // Material nur im EL-Modus übernehmen; NFL/RFL nutzen Preset (bleibt erhalten)
    const matKey = document.getElementById('foto-mat')?.value;
    if (typeof sysMode === 'undefined' || sysMode === 'el') {
      const elSel = document.getElementById('el-material-select');
      if (matKey && elSel && Array.from(elSel.options).some(o => o.value === matKey)) {
        elSel.value = matKey;
        if (typeof elMaterialChanged === 'function') elMaterialChanged();
      }
    }
    // H bei Montagetemperatur T₁ — gespeicherter Wert aus _calculate() bevorzugen
    const _T1mont = parseFloat(document.getElementById('temp1')?.value);
    const _Tmont  = !isNaN(_T1mont) ? _T1mont : 10;
    const H10 = fr.H_T1
      ? { H: fr.H_T1 }
      : ((typeof fotoSolveAtTemp === 'function') ? fotoSolveAtTemp(_Tmont) : null);
    const tensionEl = document.getElementById('tension');
    if (H10 && tensionEl) {
      tensionEl.value = Math.round(H10.H);
      if (typeof _updateTensionFotoState === 'function') _updateTensionFotoState(true);
    }
    // T₁ bleibt unverändert (Benutzer-Einstellung)
    // T₂ bleibt unverändert (Benutzer-Einstellung beibehalten)
    // berechnen() aufrufen, danach Foto-H nochmals sichern (updateH_Ts_ubFromT1 würde es sonst überschreiben)
    const _savedFotoH = H10 ? Math.round(H10.H) : null;
    if (typeof berechnen === 'function') berechnen();
    if (_savedFotoH && tensionEl) {
      tensionEl.value = _savedFotoH;
      if (typeof _updateTensionFotoState === 'function') _updateTensionFotoState(true);
    }
    const wb = document.getElementById('warn-box');
    if (wb && H10) {
      const h1Str = fr.h_P1 != null ? `, h₁ = ${fr.h_P1.toFixed(2)} m` : '';
      const h2Str = fr.h_P2 != null ? `, h₂ = ${fr.h_P2.toFixed(2)} m` : '';
      wb.innerHTML = `${t('foto.uebernommen')} &mdash; H = ${(H10.H/1000).toFixed(2)} kN ${t('foto.bei.temp')} 10 °C, ` +
                     `L = ${fr.L} m, T₂ = ${fr.T1} °C${h1Str}${h2Str}.`;
      wb.classList.remove('hidden');
      setTimeout(() => wb.classList.add('hidden'), 6000);
    }
    if (typeof closeFotoModal === 'function') closeFotoModal();
  };

  // ── Bild speichern ──
  window.fotoSaveImage = function() {
    const canvas = document.getElementById('foto-canvas');
    if (!canvas || !_img) return;
    const link = document.createElement('a');
    link.download = 'foto-auswertung.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // ── Reset ──
  window.fotoReset = function() {
    _pts = [];
    _gps = null;
    _updateGpsDisplay();
    zeigeElement(document.getElementById('foto-result'), false);
    zeigeElement(document.getElementById('foto-multi-btns'), _mode() === 'multi');
    const cc = document.getElementById('foto-curve-count');
    if (cc) cc.textContent = '';
    window._fotoResult = null;
    _fotoTempOverride  = null;
    _dragIdx   = null;
    _dragMoved = false;
    _dimDrag   = null;
    _dimOffsets = { L: 0, R: 0 };
    _lastDimArms = { L: null, R: null };
    _showCatenary = false;
    _updateCatenaryBtn();
    if (_img) { _draw(); _updateStatus(); }
    else _status(t('foto.load.hint'));
  };

  // ── Projekt-Save / Load (Bild + Punkte + Ergebnis) ──────────────────────────
  window._fotoGetProjectState = function() {
    const state = {
      pts:    _pts.map(p => ({ ...p })),
      result: window._fotoResult ? { ...window._fotoResult } : null,
      showCatenary: _showCatenary,
    };
    // Bild komprimiert, max 2 MB (base64 ≈ 2.8 MB string) → try/catch
    if (_img) {
      try {
        const MAX_BYTES = 2 * 1024 * 1024;                   // 2 MB Binärgrösse
        const MAX_B64   = Math.ceil(MAX_BYTES * 4 / 3);      // ≈ 2.74 MB base64-Länge
        const MAX_W = 1280, MAX_H = 960;
        const scale = Math.min(1, MAX_W / _img.naturalWidth, MAX_H / _img.naturalHeight);
        let tw = Math.round(_img.naturalWidth  * scale);
        let th = Math.round(_img.naturalHeight * scale);
        const tmp = document.createElement('canvas');
        tmp.width = tw; tmp.height = th;
        tmp.getContext('2d').drawImage(_img, 0, 0, tw, th);
        // Qualitätsstufen: von hoch nach niedrig bis unter 2 MB
        let dataURL = '';
        for (const q of [0.88, 0.78, 0.68, 0.58]) {
          dataURL = tmp.toDataURL('image/jpeg', q);
          if (dataURL.length <= MAX_B64) break;
        }
        // Notfall: nochmals auf 960px skalieren
        if (dataURL.length > MAX_B64) {
          const tmp2 = document.createElement('canvas');
          const s2 = Math.min(1, 960 / tw);
          tmp2.width = Math.round(tw * s2); tmp2.height = Math.round(th * s2);
          tmp2.getContext('2d').drawImage(tmp, 0, 0, tmp2.width, tmp2.height);
          dataURL = tmp2.toDataURL('image/jpeg', 0.72);
          tw = tmp2.width; th = tmp2.height;
        }
        state.imgDataURL = dataURL;

        // ── Koordinaten auf komprimierte Bildgrösse skalieren ──
        // _pts und _fotoResult wurden im Koordinatensystem des Originalbilds gesetzt.
        // Das gespeicherte Bild kann kleiner sein (scale < 1); alle Pixelwerte
        // müssen entsprechend umgerechnet werden, damit Marker nach dem Laden
        // exakt auf den Bildmerkmalen liegen — unabhängig von der Auflösung.
        const scX = tw / _img.naturalWidth;
        const scY = th / _img.naturalHeight;
        if (scX !== 1 || scY !== 1) {
          state.pts = _pts.map(p => ({ ...p, px: p.px * scX, py: p.py * scY }));
          if (state.result) {
            state.result = { ...state.result };
            if (state.result.ptP1) state.result.ptP1 = { px: state.result.ptP1.px * scX, py: state.result.ptP1.py * scY };
            if (state.result.ptP2) state.result.ptP2 = { px: state.result.ptP2.px * scX, py: state.result.ptP2.py * scY };
            // k_L / k_R (m/px): grössere Pixel → mehr Meter pro Pixel
            if (state.result.k_L != null) state.result.k_L = state.result.k_L / scX;
            if (state.result.k_R != null) state.result.k_R = state.result.k_R / scX;
          }
        }
      } catch (e) { _spur('Foto/Speichern: Bild weggelassen', e); }
    }
    return state;
  };

  window._fotoSetProjectState = function(state) {
    if (!state) return;
    // Sync sidebar → foto-L / foto-T1 first so L/2 and Soll/Ist use correct values
    if (typeof _fotoSidebarSync === 'function') _fotoSidebarSync();
    _pts = (state.pts || []).map(p => ({ ...p }));
    window._fotoResult = state.result || null;
    _showCatenary = !!state.showCatenary;
    _updateCatenaryBtn();
    _updateRoleButtons();

    function _restoreResultUI() {
      const fr = window._fotoResult;
      if (!fr) return;
      zeigeElement(document.getElementById('foto-result'), true);
      const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
      setEl('foto-f',  fr.f  != null ? fr.f.toFixed(2)  + ' m' : '—');
      setEl('foto-H',  fr.H  != null ? (fr.H/1000).toFixed(2) + ' kN (' + Math.round(fr.H) + ' N)' : '—');
      setEl('foto-xC', fr.xC != null ? fr.xC.toFixed(2) + ' m' : '—');
      setEl('foto-dh', fr.dh != null ? fr.dh.toFixed(2) + ' m' : '—');
      setEl('foto-k',  fr.k_L != null ? `L: ${(fr.k_L*1000).toFixed(2)} / R: ${(fr.k_R*1000).toFixed(2)} mm/px` : '—');
      const _tl = document.getElementById('foto-result-temp');
      if (_tl && fr.T1 != null) _tl.textContent = `bei T₂ = ${fr.T1}°C`;
      // Mast names
      const mastLabel = [fr.nameL, fr.nameR].filter(Boolean).join(' — ');
      const mastEl = document.getElementById('foto-mast-names');
      if (mastEl) {
        mastEl.textContent = mastLabel || '';
        const _mastRow = document.getElementById('foto-mast-names-row');
        zeigeElement(_mastRow, mastLabel);
      }
      // Montage reference at T₁
      const T1_mont = parseFloat(document.getElementById('temp1')?.value);
      const T_mont  = !isNaN(T1_mont) ? T1_mont : 10;
      const mont = _solveAtTemp(T_mont);
      const montEl = document.getElementById('foto-H-mont');
      if (montEl) montEl.textContent = mont ? (mont.H / 1000).toFixed(2) + ' kN' : '—';
      const montLabel = document.querySelector('#foto-montage-ref .metric-label');
      if (montLabel) montLabel.textContent = `Montage (${T_mont} °C)`;
      // H/f at current T₂
      const T2cur = parseFloat(document.getElementById('temp2')?.value);
      const T2eff = !isNaN(T2cur) ? T2cur : fr.T1;
      const tSldrVal = document.getElementById('foto-T-slider-val');
      if (tSldrVal) tSldrVal.textContent = T2eff + ' °C';
      const resT2 = _solveAtTemp(T2eff);
      const hTempEl = document.getElementById('foto-H-temp');
      const fTempEl = document.getElementById('foto-f-temp');
      if (resT2) {
        if (hTempEl) hTempEl.textContent = (resT2.H / 1000).toFixed(2) + ' kN  (' + Math.round(resT2.H) + ' N)';
        if (fTempEl) fTempEl.textContent = resT2.f != null ? resT2.f.toFixed(2) + ' m' : '—';
        _fotoTempOverride = resT2;
      } else {
        if (hTempEl) hTempEl.textContent = fr.H != null ? (fr.H / 1000).toFixed(2) + ' kN  (' + Math.round(fr.H) + ' N)' : '—';
        if (fTempEl) fTempEl.textContent = fr.f != null ? fr.f.toFixed(2) + ' m' : '—';
      }
      // Soll/Ist block
      const fAtHalf = (typeof catSagAt === 'function' && fr.q != null)
        ? catSagAt(fr.H, fr.q, fr.L, fr.dh, fr.L / 2) : null;
      _updateSollIst(T2eff, resT2 || { H: fr.H, f: fAtHalf });
    }

    if (state.imgDataURL) {
      _fotoZoom = 1.0; _fotoPanX = 0; _fotoPanY = 0;
      _updateFotoZoomUI();
      _img = new Image();
      _img.onload = () => {
        const ph = document.getElementById('foto-canvas-placeholder');
        zeigeElement(ph, false);
        _setupFotoCanvasEvents();
        _draw();
        _restoreResultUI();
        _status(t('foto.projekt.geladen'));
      };
      _img.src = state.imgDataURL;
    } else if (_pts.length > 0) {
      _restoreResultUI();
      _status(t('foto.punkte.geladen'));
    }
  };

  function _updateCatenaryBtn() {
    const btn = document.getElementById('foto-catenary-toggle');
    if (!btn) return;
    btn.textContent = _showCatenary ? t('foto.catenary.off') : t('foto.catenary.on');
    btn.style.background = 'none';
    btn.style.color         = _showCatenary ? 'var(--text)' : 'var(--muted)';
    btn.style.borderColor   = _showCatenary ? 'var(--text)' : 'var(--border)';
    // Foto-Download nur wenn Foto geladen + Seillinie berechnet + eingeblendet
    const dlBtn = document.getElementById('share-foto-dl');
    zeigeElement(dlBtn, (_img && _showCatenary && window._fotoResult));
  }
  window.fotoToggleCatenary = function() {
    _showCatenary = !_showCatenary;
    _updateCatenaryBtn();
    if (_img) _draw();
  };

  // ── Fluchtpunkt-Raster Toggle ──
  window.fotoToggleGrid = function() {
    _showGrid = !_showGrid;
    const btn = document.getElementById('foto-grid-toggle');
    if (btn) {
      btn.textContent  = _showGrid ? t('foto.grid.on') : t('foto.grid.off');
      btn.style.background = 'none';
      btn.style.color       = _showGrid ? 'var(--text)' : 'var(--muted)';
      btn.style.borderColor = _showGrid ? 'var(--text)' : 'var(--border)';
      btn.style.fontWeight  = _showGrid ? '600' : '400';
    }
    if (_img) _draw();
  };

  // ── Refresh: Darstellung neu aufbauen ──
  window.fotoRefresh = function() {
    if (!_img) { _status(t('foto.kein.bild')); return; }
    const mode = _mode();
    const allSet = _roles[mode].every(r => _pts.some(p => p.role === r));
    if (allSet && window._fotoResult) {
      _calculate(); // Vollständige Neuberechnung mit aktuellen Punkten
    } else {
      _draw();      // Nur Darstellung neu zeichnen
    }
    _status('Darstellung aktualisiert.');
  };

  // ── Mastlänge-Prompt: erscheint nach Setzen von Mastfuss ──────────────────
  function _showMastLaengePrompt(side) {
    const targetId = side === 'L' ? 'foto-hmast-L' : 'foto-hmast-R';
    const existing = document.getElementById(targetId)?.value;
    if (existing && parseFloat(existing) > 0) return; // bereits gesetzt → kein Prompt

    const popup = document.getElementById('foto-mast-prompt');
    if (!popup) return;
    const sideEl = document.getElementById('foto-mast-prompt-side');
    if (sideEl) sideEl.textContent = side === 'L' ? t('foto.side.li') : t('foto.side.re');
    popup._mastSide = side;

    // Position: Canvas-Koordinaten des Mastfuss-Punktes → CSS-Pixel im canvas-wrap
    const role = side === 'L' ? 'base_L' : 'base_R';
    const pt = _pts.find(p => p.role === role);
    const canvas = document.getElementById('foto-canvas');
    const wrap   = document.getElementById('foto-canvas-wrap');
    if (pt && canvas && wrap && _img) {
      const _S2  = canvas.width;
      const _cs2 = Math.max(_S2 / _img.naturalWidth, _S2 / _img.naturalHeight);
      const canPx = (pt.px - _img.naturalWidth/2  - _fotoPanX) * _cs2 * _fotoZoom + _S2/2;
      const canPy = (pt.py - _img.naturalHeight/2 - _fotoPanY) * _cs2 * _fotoZoom + _S2/2;
      const scaleX = canvas.clientWidth  / _S2;
      const scaleY = canvas.clientHeight / _S2;
      let left = canPx * scaleX + 14;   // leicht rechts vom Punkt
      let top  = canPy * scaleY - 10;   // leicht über dem Punkt
      // Rand-Clipping: Popup bleibt innerhalb des wrap
      const popupW = 180, popupH = 70;
      left = Math.min(left, wrap.clientWidth  - popupW - 8);
      top  = Math.max(top,  8);
      top  = Math.min(top,  wrap.clientHeight - popupH - 8);
      popup.style.left = left + 'px';
      popup.style.top  = top  + 'px';
    }

    zeigeElement(popup, true);
    setTimeout(() => document.getElementById('foto-mast-prompt-val')?.focus(), 60);
  }

  window._fotoMastPromptConfirm = function() {
    const prompt = document.getElementById('foto-mast-prompt');
    if (!prompt) return;
    const val = parseFloat(document.getElementById('foto-mast-prompt-val')?.value);
    const side = prompt._mastSide || 'L';
    if (!isNaN(val) && val > 0.1) {
      const targetId = side === 'L' ? 'foto-hmast-L' : 'foto-hmast-R';
      const el = document.getElementById(targetId);
      if (el && (!el.value || parseFloat(el.value) <= 0)) {
        el.value = val;
        fotoRecalcIfReady();
      }
    }
    _fotoMastPromptDismiss();
  };

  window._fotoMastPromptDismiss = function() {
    const prompt = document.getElementById('foto-mast-prompt');
    zeigeElement(prompt, false);
    const inp = document.getElementById('foto-mast-prompt-val');
    if (inp) inp.value = '';
  };
})();
// ── Foto Vollbild ─────────────────────────────────────────────────────────
window.fotoToggleFullscreen = function() {
  const area = document.getElementById('foto-canvas-area');
  if (!area) return;
  if (!document.fullscreenElement) {
    area.requestFullscreen && area.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen && document.exitFullscreen().catch(() => {});
  }
};
document.addEventListener('fullscreenchange', function() {
  const inFS   = !!document.fullscreenElement;
  const statusMain = document.getElementById('foto-status');
  const statusFS   = document.getElementById('foto-status-fs');
  // Status-Kopie in der Rollen-Leiste zeigen (sichtbar im Vollbild)
  zeigeElement(statusFS, inFS);
  if (statusMain && statusFS) statusFS.textContent = statusMain.textContent;
});
// Status-Sync: Änderungen an foto-status auch in foto-status-fs spiegeln
const _fotoStatusObs = new MutationObserver(() => {
  const s = document.getElementById('foto-status');
  const fs = document.getElementById('foto-status-fs');
  if (s && fs && document.fullscreenElement) fs.textContent = s.textContent;
});
document.addEventListener('DOMContentLoaded', () => {
  const s = document.getElementById('foto-status');
  if (s) _fotoStatusObs.observe(s, { childList: true, characterData: true, subtree: true });
});
// ── Ende Foto-Auswertung ───────────────────────────────────────────────────

function openReglageModal()  { document.getElementById('reglage-modal').classList.add('open'); renderReglageElTable(); }
function closeReglageModal() { document.getElementById('reglage-modal').classList.remove('open'); }

// Dropdown mit den zum aktiven Systemmodus passenden Kombinationen befüllen
function rebuildPresetDropdown(mode) {
  const sel = document.getElementById('preset-select');
  sel.innerHTML = `<option value="">${t('msg.kettenwerk.waehlen')}</option>`;
  Object.entries(KETTENWERK_PRESETS)
    .filter(([, p]) => p.sysMode === mode)
    .forEach(([key, p]) => {
      const opt = document.createElement('option');
      opt.value = key; opt.textContent = p.label;
      sel.appendChild(opt);
    });
  // Benutzerdefinierte Kettenwerke anfügen
  loadCustomPresets()
    .filter(p => p.sysMode === mode)
    .forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.key; opt.textContent = '★ ' + p.label;
      opt.dataset.custom = '1';
      sel.appendChild(opt);
    });
  // Ersten echten Eintrag vorauswählen und anwenden
  if (sel.options.length > 1) {
    sel.selectedIndex = 1;
    applyPreset();
  } else {
    zeigeElement(document.getElementById('combo-info'), false);
  }
}

function applyPreset() {
  const key = document.getElementById('preset-select').value;
  const infoEl  = document.getElementById('combo-info');
  if (!key) { zeigeElement(infoEl, false); return; }
  // Benutzerdefiniertes Kettenwerk?
  if (key.startsWith('custom_')) {
    const custom = loadCustomPresets().find(p => p.key === key);
    if (custom) applyCustomPreset(custom);
    return;
  }
  const titleEl = document.getElementById('combo-title');
  const noteEl  = document.getElementById('combo-note');
  const preset = KETTENWERK_PRESETS[key];
  if (!preset) return;

  // Materialeigenschaften in versteckte Felder übernehmen
  const matTs = MATERIALS[preset.matTs];
  const matFd = MATERIALS[preset.matFd];
  document.getElementById('material-ts').value  = preset.matTs;
  document.getElementById('weight-ts').value    = matTs.q;
  document.getElementById('alpha-ts').value     = (matTs.alpha * 1e6).toFixed(1);
  document.getElementById('material-fd').value  = preset.matFd;
  document.getElementById('weight-fd').value    = matFd.q;
  document.getElementById('tension-fd').value   = preset.H_Fd;

  // Sichtbare Eingabefelder setzen
  document.getElementById('sh').value      = preset.sh;
  // N-FL: Unbelastet-Zugkraft als Eingabe; H_belastet wird in readInputs() berechnet
  const _rg = _presetReglage(preset);
  document.getElementById('tension').value = (preset.sysMode === 'nfl' && _rg.H_Ts_ub != null) ? _rg.H_Ts_ub : preset.H_Ts;
  document.getElementById('temp1').value   = preset.T1;

  // Infobox unter dem Dropdown anzeigen (Standard-Stil zurücksetzen)
  infoEl.style.background = ''; infoEl.style.borderColor = '';
  titleEl.style.color = ''; titleEl.textContent = buildPresetTitle(preset);
  noteEl.textContent  = buildPresetNote(preset);
  zeigeElement(infoEl, true);

  // Abnutzungs-Selector zurücksetzen
  currentWearMax = preset.wear_max || 30;
  wearPct = 0;
  const wearRow = document.getElementById('wear-row');
  const wearLbl = document.getElementById('wear-max-label');
  zeigeElement(wearRow, true);
  if (wearLbl) wearLbl.textContent = currentWearMax;
  document.getElementById('wear-btn-0').classList.add('active');
  document.getElementById('wear-btn-max').classList.remove('active');

  // Systemwechsel durch Preset (N-FL ↔ R-FL) abfangen
  if (preset.sysMode !== sysMode) {
    sysMode = preset.sysMode;
    updateSysModeUI(sysMode);
  }
  // Referenzwerte für T1-abhängige H_Ts_ub-Berechnung speichern
  if (preset.sysMode === 'nfl' && _rg.H_Ts_ub_table != null) {
    activePresetRef = { H_Ts_ub_table: _rg.H_Ts_ub_table };
    activePresetP   = preset;
  } else {
    activePresetRef = null;
    activePresetP   = null;
  }
  berechnen();
}

// ── Systemwechsel-UI ──
let sysMode  = 'nfl';
let wearPct  = 0;
let currentWearMax = 30;
let mode3pt    = false;   // 3-Punkte-Modus aktiv
let threePtMark = null;   // { xC, yC } — letzter gültiger 3-Pt-Messpunkt für Canvas
let yCInputMode = 'sag';  // 'sag' = Durchhang unter Sehne | 'sok' = Höhe ab SOK
// Preset-Referenz für T1-abhängige H_Ts_ub-Berechnung
let activePresetRef = null; // { H_Ts_ub_table } or null
let _tensionAutoFilling = false; // Verhindert Zirkel beim Auto-Befüllen
let _hFromFoto = false; // H wurde durch Foto-Feldaufnahme überschrieben
// Einzelleiter: H von Hand eingegeben (statt aus der Reglage). Bleibt bis «↺ Reglage»,
// Wechsel von Leiter/Basiskraft/Berechnungsart/Reglagewerten oder System.
let _hVonHand = false;

// Wert einer Reglagetabelle bei Temperatur T (linear, oberhalb extrapoliert)
function _tabelleBeiT(tbl, T) {
  if (!tbl || isNaN(T)) return null;
  const { temps, vals } = tbl, n = temps.length;
  if (T <= temps[0]) return vals[0];
  if (T >= temps[n - 1]) {
    const k = (vals[n - 1] - vals[n - 2]) / (temps[n - 1] - temps[n - 2]);
    return Math.max(100, Math.round(vals[n - 1] + k * (T - temps[n - 1])));
  }
  for (let i = 0; i < n - 1; i++)
    if (T >= temps[i] && T <= temps[i + 1])
      return Math.round(vals[i] + (T - temps[i]) / (temps[i + 1] - temps[i]) * (vals[i + 1] - vals[i]));
  return null;
}

// Eingabe im H-Feld. Einzelleiter: Handwert neben der Reglage (zurücksetzbar);
// sonst (eigene Kombination) wie bisher ohne Reglagebezug.
function _hEingabe() {
  if (_tensionAutoFilling) return;
  if (sysMode === 'el' && activePresetRef) _hVonHand = true;
  else activePresetRef = null;
  _updateTensionFotoState(false);
  _zugkraftSperre();
}

// Δ H zum theoretischen Reglagewert anzeigen
function _updateTensionDelta() {
  const deltaEl = document.getElementById('tension-delta');
  if (!deltaEl) return;
  // Delta nur bei Foto-Feldaufnahme (äussere Box steuert Sichtbarkeit)
  if (!_hFromFoto) { zeigeElement(deltaEl, false); return; }

  const H_ist = parseFloat(document.getElementById('tension')?.value);
  if (isNaN(H_ist)) { zeigeElement(deltaEl, false); return; }

  // Theoretischen H-Wert ermitteln: aus Reglage-Tabelle bei aktuellem T1
  let H_soll = null;
  const tbl = activePresetRef?.H_Ts_ub_table
           || activePresetP?.H_reglage_table
           || activePresetP?.H_reglage_variants?.[0]?.H_reglage_table;
  if (tbl) {
    const T1 = parseFloat(document.getElementById('temp1')?.value);
    if (!isNaN(T1)) {
      const { temps, vals } = tbl;
      const n = temps.length;
      if (T1 <= temps[0]) H_soll = vals[0];
      else if (T1 >= temps[n-1]) {
        const slope = (vals[n-1] - vals[n-2]) / (temps[n-1] - temps[n-2]);
        H_soll = Math.max(100, vals[n-1] + slope * (T1 - temps[n-1]));
      } else {
        for (let i = 0; i < n-1; i++) {
          if (T1 >= temps[i] && T1 <= temps[i+1]) {
            const fr = (T1 - temps[i]) / (temps[i+1] - temps[i]);
            H_soll = vals[i] + fr * (vals[i+1] - vals[i]);
            break;
          }
        }
      }
    }
  }

  if (H_soll === null) { zeigeElement(deltaEl, false); return; }
  const delta = H_ist - H_soll;
  const pct   = Math.round((delta / H_soll) * 100);
  const sign  = delta >= 0 ? '+' : '';
  deltaEl.textContent  = `${sign}${pct} %`;
  deltaEl.style.color = '';
  zeigeElement(deltaEl, true);
}

// Visueller Zustand des H-Felds: normal / foto-override
function _updateTensionFotoState(fromFoto) {
  _hFromFoto = fromFoto;
  if (fromFoto) _hVonHand = false;   // Foto-Aufnahme ersetzt den Handwert
  const wrap = document.getElementById('tension-wrap');
  const note = document.getElementById('tension-foto-note');
  if (wrap) {
    wrap.style.outline        = fromFoto ? '2px solid #f59e0b' : '';
    wrap.style.outlineOffset  = fromFoto ? '-1px' : '';
    wrap.style.borderRadius   = fromFoto ? '8px' : '';
  }
  zeigeElement(note, fromFoto);
  _updateTensionResetBtn();
  _updateTensionDelta();
}

// Reset-Button sichtbar wenn: H manuell geändert (activePresetRef === null) oder aus Foto,
// UND ein Reglage-Datensatz verfügbar ist.
function _updateTensionResetBtn() {
  const btn = document.getElementById('tension-reset-btn');
  if (!btn) return;
  const hasTbl = !!(activePresetRef?.H_Ts_ub_table
                 || activePresetP?.H_reglage_table
                 || activePresetP?.H_reglage_variants?.[0]?.H_reglage_table);
  const isOverridden = _hFromFoto || (_hVonHand && sysMode === 'el');  // Foto oder Handwert (EL)
  zeigeElement(btn, (hasTbl && isOverridden));
}

// H auf Reglagetabellenwert zurücksetzen
// «H Ts» folgt der Reglage der gewählten Kombination bzw. des Leiters und ist dann gesperrt
// (wie in der Berechnung hinterlegt). Spezialfall: eigene Kombination über «+» bzw. Reglage
// des Leiters anpassen. Ebenfalls gesperrt: 3-Punkte-Messung und Foto-Ansicht.
function _zugkraftSperre(fotoAktiv = window._fotoTabActive) {
  const el = document.getElementById('tension');
  if (!el) return;
  // Kettenwerk: Wert kommt aus der gewählten Kombination (N-FL Reglagetabelle, R-FL konstant);
  // Einzelleiter: aus der Reglage des Leiters
  const reglage = sysMode === 'el' ? !!activePresetRef : !!document.getElementById('preset-select')?.value;
  // Einzelleiter: H bleibt von Hand überschreibbar (Rückweg «↺ Reglage»)
  const gesperrt = (reglage && sysMode !== 'el') || mode3pt || !!fotoAktiv;
  el.readOnly = gesperrt;
  el.tabIndex = gesperrt ? -1 : 0;
  el.classList.toggle('feld-gesperrt', gesperrt);
  const hw = document.getElementById('tension-reglage-hw');
  if (hw) {
    const hand = sysMode === 'el' && _hVonHand;
    if (hand) {
      hw.innerHTML = t('par.H.hand.el');   // freie Eingabe — bewusst ohne Bezug zur Reglage
    } else {
      hw.innerHTML = t(sysMode === 'el' ? 'par.H.reglage.el' : 'par.H.reglage');
    }
    hw.classList.toggle('hand', hand);
    document.getElementById('tension-wrap')?.classList.toggle('feld-hand', hand);
    // Reglage-Infobox oben (System): ausgegraut + Zusatzzeile, solange sie nicht wirkt
    document.getElementById('el-reglage-info')?.classList.toggle('inaktiv', hand);
    zeigeElement(document.getElementById('el-reglage-inaktiv'), hand && istSichtbar(document.getElementById('el-reglage-info')));
    zeigeElement(hw, reglage && !mode3pt && !fotoAktiv && !_hFromFoto);
  }
  _updateTensionResetBtn();
  _elReglageBoxAktualisieren();
}

function resetHToReglage() {
  // Tabelle aus activePresetRef (EL via applyElVariant) ODER activePresetP (NFL/RFL Presets)
  const tbl = activePresetRef?.H_Ts_ub_table
           || activePresetP?.H_reglage_table
           || activePresetP?.H_reglage_variants?.[elBasiskraftIdx ?? 0]?.H_reglage_table
           || null;
  if (!tbl) return;
  if (!activePresetRef) activePresetRef = { H_Ts_ub_table: tbl };
  _hFromFoto = false; // Guard zuerst löschen damit updateH_Ts_ubFromT1 durchläuft
  _hVonHand = false;
  updateH_Ts_ubFromT1();
  _updateTensionFotoState(false);
  _updateTensionDelta();
  berechnen();
}
let elBasiskraftIdx = 0;   // Aktive Basiskraft-Variante im Einzelleiter-Modus
let activePresetP   = null; // Aktives Preset-Objekt für dynamische Note-Aktualisierung

function getSokMumLeft() {
  const v = parseFloat(document.getElementById('sok-mum-left').value);
  return isNaN(v) ? null : v;
}
function getSokMumRight() {
  const v = parseFloat(document.getElementById('sok-mum-right').value);
  return isNaN(v) ? null : v;
}
// Linkes SOK-Feld geändert → rechtes synchronisieren (falls nicht manuell bearbeitet)
function onSokMumLeftInput() {
  const leftEl  = document.getElementById('sok-mum-left');
  const rightEl = document.getElementById('sok-mum-right');
  if (!rightEl.dataset.userEdited) {
    rightEl.value = leftEl.value;
  }
  updateSokMumUI();
  berechnen();
}

// Rechtes SOK-Feld manuell geändert
function onSokMumRightInput() {
  updateSokMumUI();
  berechnen();
}

// Labels und Info-Box aktualisieren
// h<sub>1</sub>/h<sub>2</sub> zeigen immer "über SOK" — SOK-Felder sind nur die absolute Referenz
function updateSokMumUI() {
  const sokL   = getSokMumLeft();
  const sokR   = getSokMumRight();
  const anySet = sokL !== null || sokR !== null;
  const info   = document.getElementById('sok-mum-info');
  const mumBtn = document.getElementById('yc-btn-mum');
  const h1_raw = parseFloat(document.getElementById('h1').value);
  const h2_raw = parseFloat(document.getElementById('h2').value);

  if (anySet) {
    // Karte: Subtitle bleibt "(über SOK)", Info-Box zeigt absoluten Wert
    zeigeElement(info, true);
    let parts = [];
    if (sokL !== null && !isNaN(h1_raw))
      parts.push(`<span style="white-space:nowrap">${t('bp.befestigung.li')} = <span style="color:var(--text)">${(sokL + h1_raw).toFixed(2)} ${t('bp.mum.abbrev')}</span></span><span style="white-space:nowrap;opacity:.65">(${t('ui.sok.kurz')} ${sokL.toFixed(2)} + ${h1_raw.toFixed(2)} m)</span>`);
    if (sokR !== null && !isNaN(h2_raw))
      parts.push(`<span style="white-space:nowrap">${t('bp.befestigung.re')} = <span style="color:var(--text)">${(sokR + h2_raw).toFixed(2)} ${t('bp.mum.abbrev')}</span></span><span style="white-space:nowrap;opacity:.65">(${t('ui.sok.kurz')} ${sokR.toFixed(2)} + ${h2_raw.toFixed(2)} m)</span>`);
    info.innerHTML = parts.map(p => `<div style="display:flex;align-items:baseline;gap:.4rem;flex-wrap:wrap;color:var(--muted);font-size:.75rem;line-height:1.6;margin-bottom:.1rem">${p}</div>`).join('');
    zeigeElement(mumBtn, true);
  } else {
    zeigeElement(info, false);
    zeigeElement(mumBtn, false);
    if (yCInputMode === 'mum') setYCMode('sag');
    // Mindestabstand und Hindernisse bleiben (gelten auch mit Höhen über SOK)
    _triggerDrawingRebuild();
  }
}

// Alias (wird von h1/h2 oninput aufgerufen)
function onSokMumInput() { updateSokMumUI(); }

// Optionale Mastangaben (SOK m ü. M., Name, KM) sind eingeklappt. Sobald eines
// der Felder einen Wert hat — etwa nach dem Laden eines Projekts — aufklappen,
// damit keine Eingabe unbemerkt versteckt bleibt.
function _mastangabenOeffnenFallsBelegt() {
  const det = document.getElementById('mastangaben');
  if (!det) return;
  const belegt = ['sok-mum-left', 'sok-mum-right', 'mast-delta-sok-left', 'mast-delta-sok-right', 'mast-num-left', 'mast-num-right',
                  'mast-km-left', 'mast-km-right', 'koord-e-left', 'koord-e-right']
    .some(id => (document.getElementById(id)?.value ?? '').trim() !== '');
  if (belegt) det.open = true;
}

function _buildMastParts(side) {
  const num = document.getElementById(side === 'left' ? 'mast-num-left' : 'mast-num-right')?.value?.trim() || '';
  const km  = document.getElementById(side === 'left' ? 'mast-km-left'  : 'mast-km-right')?.value?.trim()  || '';
  return { num, km };
}


// ── Foto-Name-Brücke: mast-num-left/right als Quelle für Foto-Auswertung ─────
function _syncMastNames() {
  // foto-name-L/R → werden intern im Foto-IIFE gelesen; wir halten sie synchron
  const nL = document.getElementById('mast-num-left')?.value  || '';
  const nR = document.getElementById('mast-num-right')?.value || '';
  const fL = document.getElementById('foto-name-L');
  const fR = document.getElementById('foto-name-R');
  if (fL) fL.value = nL;
  if (fR) fR.value = nR;
  if (typeof fotoRedraw === 'function') fotoRedraw();
}

function toggleSpanInfo(e) {
  e.stopPropagation();
  const pop = document.getElementById('span-info-popup');
  if (istSichtbar(pop)) { zeigeElement(pop, false); return; }
  const btn  = document.getElementById('span-info-btn');
  const rect = btn.getBoundingClientRect();
  const popW = 270;
  let left = rect.left;
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  pop.style.top  = (rect.bottom + 6) + 'px';
  pop.style.left = left + 'px';
  zeigeElement(pop, true);
}
function toggleEislastInfo(e) {
  e.stopPropagation();
  const pop = document.getElementById('eis-info-popup');
  if (istSichtbar(pop)) { zeigeElement(pop, false); return; }
  // Position relativ zum Button berechnen (fixed = relativ zum Viewport)
  const btn  = document.getElementById('eis-info-btn');
  const rect = btn.getBoundingClientRect();
  const popW = 270;
  let left = rect.left;
  // Nicht über den rechten Rand hinaus
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  pop.style.top  = (rect.bottom + 6) + 'px';
  pop.style.left = left + 'px';
  zeigeElement(pop, true);
}
document.addEventListener('click', () => {
  ['span-info-popup', 'eis-info-popup'].forEach(id => {
    const pop = document.getElementById(id);
    zeigeElement(pop, false);
  });
});

function clearSokMum() {
  document.getElementById('sok-mum-left').value  = '';
  document.getElementById('sok-mum-right').value = '';
  delete document.getElementById('sok-mum-right').dataset.userEdited;
  updateSokMumUI();
  berechnen();
}

function setYCMode(mode) {
  yCInputMode = mode;
  if (mode === 'mum') { const d = document.getElementById('mastangaben'); if (d) d.open = true; }
  const btns  = { sag: 'yc-btn-sag', sok: 'yc-btn-sok', mum: 'yc-btn-mum' };
  const active = 'border:1px solid color-mix(in srgb, var(--primary) 30%, transparent);background:var(--acc-s);color:var(--primary);font-weight:600';
  Object.entries(btns).forEach(([k, id]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.cssText = el.style.cssText.replace(/border:[^;]+;|background:[^;]+;|color:[^;]+;|font-weight:[^;]+;/g, '');
    if (k === mode) { el.style.border = '1px solid var(--border)'; el.style.background = 'var(--s4)'; el.style.color = 'var(--text)'; el.style.fontWeight = '600'; }
    else            { el.style.border = '1px solid var(--border)'; el.style.background = 'none'; el.style.color = 'var(--muted)'; el.style.fontWeight = '400'; }
  });
  const labelEl = document.getElementById('yC-label');
  const inputEl = document.getElementById('yC');
  if (mode === 'sag') {
    labelEl.innerHTML = `${t('ui.durchhang.yc')} <span style="font-weight:400;color:var(--tertiary)">${t('par.3pt.yC.sag')}</span>`;
    inputEl.placeholder = '—'; inputEl.step = '0.01'; inputEl.min = '0';
  } else if (mode === 'sok') {
    labelEl.innerHTML = `${t('ui.hoehe.yc')} <span style="font-weight:400;color:var(--tertiary)">${t('par.3pt.yC.sok')}</span>`;
    inputEl.placeholder = '—'; inputEl.step = '0.01'; inputEl.min = '0';
  } else {
    const sokL = getSokMumLeft();
    const sokR = getSokMumRight();
    let ref = '';
    if (sokL !== null && sokR !== null && Math.abs(sokL - sokR) > 0.0005) ref = ` (SOK li=${sokL.toFixed(2)} / re=${sokR.toFixed(2)} m)`;
    else if (sokL !== null) ref = ` (SOK = ${sokL.toFixed(2)} m)`;
    else if (sokR !== null) ref = ` (SOK = ${sokR.toFixed(2)} m)`;
    labelEl.innerHTML = `${t('ui.hoehe.yc')} <span style="font-weight:400;color:var(--tertiary)">${t('par.3pt.yC.mum')}${ref}</span>`;
    inputEl.placeholder = '—'; inputEl.step = '0.001';
  }
  on3ptInput();
}

function toggle3pt() {
  mode3pt = !mode3pt;
  const btn   = document.getElementById('three-pt-btn');
  const panel = document.getElementById('three-pt-panel');
  if (mode3pt) {
    zeigeElement(panel, true);
    btn.style.background = 'var(--s4)';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--text)';
    _zugkraftSperre();
  } else {
    zeigeElement(panel, false);
    btn.style.background = 'none';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--muted)';
    _zugkraftSperre();
    document.getElementById('three-pt-result').textContent = '';
    threePtMark  = null;
    yCInputMode  = 'sag';
    setYCMode('sag');   // Buttons zurücksetzen
  }
  berechnen();
}

function on3ptInput() {
  berechnen();
}

// Berechnet FH aus 3-Punkte-Eingabe und gibt es zurück (oder null).
// Setzt auch das tension-Feld und den Result-Text.
function compute3pt(L, h1, h2) {
  const xC    = parseFloat(document.getElementById('xC').value);
  const yC    = parseFloat(document.getElementById('yC').value);
  const res   = document.getElementById('three-pt-result');
  if (isNaN(xC) || isNaN(yC)) { res.textContent = ''; threePtMark = null; return null; }

  const c = L;
  const h = h1 - h2;   // Höhendiff. (positiv wenn linker Mast höher)

  // Gewicht je nach Modus
  let M;
  if (sysMode === 'el') {
    const matKey = document.getElementById('el-material-select').value;
    M = (MATERIALS?.[matKey]?.q) ?? parseFloat(document.getElementById('weight-ts').value);
  } else {
    // N-FL / R-FL: MFL aus flCombo oder manuelle Gewichte
    const matTsKey = document.getElementById('material-ts').value;
    const matFdKey = document.getElementById('material-fd').value;
    const combo    = FL_COMBINATIONS?.[matTsKey + '_' + matFdKey];
    const qFdBase  = parseFloat(document.getElementById('weight-fd').value);
    const qFd      = qFdBase * (1 - wearPct / 100);
    const qTs      = parseFloat(document.getElementById('weight-ts').value);
    if (combo && sysMode === 'rfl') {
      // R-FL: Abnutzung als negative Zusatzlast, Anteil H_Ts/(H_Ts+H_Fd) —
      // H_Ts ist hier gesucht, deshalb mit dem aktuellen Feldwert als Startwert
      const q_abn = (combo.qFdAbnutzung ?? qFdBase) * (wearPct / 100);
      const H_Fd  = parseFloat(document.getElementById('tension-fd').value);
      const H0    = parseFloat(document.getElementById('tension').value) || 12000;
      M = _rflLast({ q_ges: combo.MFL - q_abn, q_abnutzung: q_abn, H_Ts: H0, H_Fd }, 0);
    } else {
      M = combo ? mflAbgenutzt(combo, wearPct, qFdBase) : (qTs + qFd + Q_HAENGER);
    }
  }

  if (xC <= 0 || xC >= c) {
    res.innerHTML = '<span style="color:var(--fail)">⚠ x<sub>C</sub> muss zwischen 0 und ' + c.toFixed(1) + ' m liegen</span>';
    threePtMark = null; return null;
  }

  // yC-Mode-Konvertierung: 'sok' = Höhe ab SOK → in Durchhang unter Sehne umrechnen
  // 'mum' = m ü. M. → zuerst ab SOK, dann unter Sehne
  let yC_sag = yC;
  if (yCInputMode === 'sok' || yCInputMode === 'mum') {
    let yC_abSOK = yC;
    if (yCInputMode === 'mum') {
      const sokL = getSokMumLeft();
      const sokR = getSokMumRight();
      if (sokL === null && sokR === null) {
        res.innerHTML = `<span style="color:var(--fail)">⚠ ${t('err.3pt.sok.fehlt')}</span>`;
        threePtMark = null; return null;
      }
      // SOK an Position xC linear interpolieren (falls nur eine Seite definiert → konstant)
      const _sl = sokL !== null ? sokL : sokR;
      const _sr = sokR !== null ? sokR : sokL;
      const sokAtXC = _sl + (_sr - _sl) * xC / c;
      yC_abSOK = yC - sokAtXC;   // Absolute Höhe → Höhe ab SOK (linkes Referenzsystem)
    }
    // Sehnenhöhe ab SOK an Position xC
    const chordAbSOK = h1 + (h2 - h1) * xC / c;
    yC_sag = chordAbSOK - yC_abSOK;   // Durchhang unter Sehne
    if (yC_sag <= 0) {
      const what = yCInputMode === 'mum' ? t('bp.mum.abbrev') : t('bp.ueber.sok');
      res.innerHTML = `<span style="color:var(--fail)">⚠ ${t('err.3pt.ueber.sehne').replace('{h}', chordAbSOK.toFixed(2)).replace('{was}', what)}</span>`;
      threePtMark = null; return null;
    }
  } else if (yC_sag <= 0) {
    res.innerHTML = '<span style="color:var(--fail)">⚠ y<sub>C</sub> muss > 0 m sein</span>';
    threePtMark = null; return null;
  }

  const FH = solve3point(c, h, M, xC, yC_sag);
  if (!FH) {
    res.innerHTML = `<span style="color:var(--fail)">⚠ ${t('err.3pt.keine.loesung')}</span>`;
    threePtMark = null; return null;
  }

  // Tension-Feld aktualisieren (zeigt FH oder H_ub je nach Modus)
  const tensionEl = document.getElementById('tension');
  if (sysMode === 'nfl') {
    // Für N-FL: FH = belastet → H_ub rückrechnen
    const matTsKey = document.getElementById('material-ts').value;
    const matFdKey = document.getElementById('material-fd').value;
    const combo    = FL_COMBINATIONS?.[matTsKey + '_' + matFdKey];
    const Lm       = parseFloat(document.getElementById('span').value) || c;
    let H_ub;
    if (combo) {
      // Gemessen wird bei T1 (belastet, mit Fahrdrahtzug). Rückrechnung über den
      // Bezugszustand 10 °C wie in der Hinrechnung (rechenkern.js).
      const T1  = parseFloat(document.getElementById('temp1').value);
      const qFdBase = parseFloat(document.getElementById('weight-fd').value);
      const H_Fd = parseFloat(document.getElementById('tension-fd').value);
      H_ub = nflUnbelastetAusGemessen(FH, T1, T1,
        { Lm, H_Fd, q_ges: mflAbgenutzt(combo, wearPct, qFdBase), flCombo: combo, wearPct });
    } else {
      const qTs = parseFloat(document.getElementById('weight-ts').value);
      const qFd = parseFloat(document.getElementById('weight-fd').value) * (1 - wearPct / 100);
      const qGes= qTs + qFd + 0.02 * 9.81;
      const EA  = getEATs();
      H_ub = solveLoadingInverse(FH, qTs, qGes, Lm, EA);
    }
    if (H_ub) {
      tensionEl.value = Math.round(H_ub);
      res.innerHTML = `FH (belastet) = <strong>${Math.round(FH).toLocaleString('de-CH')} N</strong> &nbsp;·&nbsp; H<sub>ub</sub> = <strong>${Math.round(H_ub).toLocaleString('de-CH')} N</strong>`;
    } else {
      res.innerHTML = `<span style="color:var(--fail)">⚠ ${t('err.3pt.rueckrechnung')}</span>`;
      threePtMark = null; return null;
    }
  } else {
    tensionEl.value = Math.round(FH);
    res.innerHTML = `FH = <strong>${Math.round(FH).toLocaleString('de-CH')} N</strong>`;
  }
  threePtMark = { xC, yC };
  return { FH, xC, yC };
}

// Alle systemmodus-abhängigen UI-Elemente aktualisieren (ohne Neuberechnung)
function updateSysModeUI(mode) {
  const isNfl = mode === 'nfl';
  const isRfl = mode === 'rfl';
  const isEl  = mode === 'el';
  // hf nur bei Kettenwerk (Fahrdraht) — beim Einzelleiter ausgegraut
  hfElSperre();

  // 3-Punkte-Modus beim Moduswechsel zurücksetzen
  if (mode3pt) {
    mode3pt = false;
    const panel = document.getElementById('three-pt-panel');
    const btn   = document.getElementById('three-pt-btn');
    const t     = document.getElementById('tension');
    zeigeElement(panel, false);
    if (btn)   { btn.style.background = 'none'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted)'; }
    if (t)     { t.readOnly = false; t.style.background = ''; t.style.color = ''; t.style.cursor = ''; }
    const res = document.getElementById('three-pt-result');
    if (res) res.textContent = '';
  }

  // Segment-Buttons
  document.getElementById('seg-nfl').classList.toggle('active', isNfl);
  document.getElementById('seg-rfl').classList.toggle('active', isRfl);
  document.getElementById('seg-el' ).classList.toggle('active', isEl);

  // App-Titel
  document.getElementById('app-title').textContent =
    isNfl ? t('app.title.nfl') : isRfl ? t('app.title.rfl') : t('app.title.el');
  document.getElementById('app-subtitle').textContent =
    isEl ? t('app.subtitle.el') : t('app.subtitle');

  // Systeminfo-Text
  document.getElementById('sys-info').textContent = isNfl
    ? t('sys.info.nfl')
    : isRfl
      ? t('sys.info.rfl')
      : t('sys.info.el');

  // Zugkraft-Label
  // Nur den Text — im Label sitzt auch der Knopf «↺ Reglage»
  document.getElementById('tension-label-txt').textContent =
    isNfl ? t('par.H.ts.ub') : isRfl ? t('par.H.ts.const') : t('par.H.el');

  // Belastet-Anzeige: nur N-FL
  zeigeElement(document.getElementById('h-belastet-display'), isNfl);

  // Systemhöhe sh: nur N-FL und R-FL
  zeigeElement(document.getElementById('sh-field'), !(isEl));

  // Temperaturfelder: T1 bei R-FL ausblenden, T2 auch bei R-FL zeigen (für Eislast-Bedingung)
  zeigeElement(document.getElementById('t1-field'), !(isRfl));
  zeigeElement(document.getElementById('t2-field'), true);
  // T2 bei R-FL: auf -5 °C fixieren (nur Eislast relevant), sonst freigeben
  const t2Input  = document.getElementById('temp2');
  const t2Slider = document.getElementById('temp2-slider');
  if (isRfl) {
    // T2 vor R-FL sichern (nur wenn aktuell kein R-FL-Fixwert)
    const curT2 = parseFloat(t2Input.value);
    if (!isNaN(curT2) && curT2 !== -5) t2BeforeRfl = curT2;
    t2Input.value = -5;
    t2Input.disabled = true;
    t2Input.style.opacity = '0.5';
    if (t2Slider) { t2Slider.value = -5; t2Slider.disabled = true; t2Slider.style.pointerEvents = 'none'; t2Slider.style.opacity = '0.35'; }
    onT2Input(-5);
  } else {
    t2Input.disabled = false;
    t2Input.style.opacity = '';
    if (t2Slider) { t2Slider.disabled = false; t2Slider.style.pointerEvents = ''; t2Slider.style.opacity = ''; }
    // Wert vor R-FL wiederherstellen (nur wenn gerade von R-FL weggewechselt)
    if (parseFloat(t2Input.value) === -5) {
      t2Input.value = t2BeforeRfl;
      if (t2Slider) t2Slider.value = t2BeforeRfl;
      onT2Input(t2BeforeRfl);
    }
  }
  // T2-Label: bei R-FL Hinweis
  const t2Lbl = document.getElementById('t2-label');
  if (t2Lbl) t2Lbl.innerHTML = isRfl
    ? `${t('par.T2')} <span style="font-weight:400;color:var(--muted);font-size:.78em">${t('ui.t2.fix.eis')}</span>`
    : t('par.T2');

  // T3-Vergleichskurve: bei R-FL ausblenden (keine Temperaturabhängigkeit)
  const t3wrap = document.getElementById('t3-wrapper');
  const t3card = document.getElementById('t3-card');
  zeigeElement(t3wrap, !(isRfl));
  zeigeElement(t3card, !(isRfl));
  if (isRfl && showT3) {
    showT3 = false;
    const s = document.getElementById('t3-section');
    const txt = document.getElementById('t3-toggle-txt');
    const leg = document.getElementById('leg-ts3-item');
    zeigeElement(s, false);
    if (txt) txt.innerHTML = t('t3.show');
    zeigeElement(leg, false);
  }

  // Eislast: nur N-FL, temperaturabhängig
  updateEislastVisibility();

  // Kombination (N-FL/R-FL) vs. Material (Einzelleiter)
  zeigeElement(document.getElementById('combo-row'), !(isEl));
  zeigeElement(document.getElementById('el-material-row'), isEl);
  // Basiskraft-Zeile nur, wenn der Leiter Varianten hat (sonst leere Leiste, z. B. Cu 107)
  zeigeElement(document.getElementById('el-basis-row'), isEl && !!document.getElementById('el-basis-btns')?.children.length);
  if (!isEl) zeigeElement(document.getElementById('el-reglage-info'), false);
  // Abnutzungszeile nur im Einzelleiter-Modus ausblenden — sonst bleibt der
  // bisherige Zustand unverändert (vorher als Selbstzuweisung geschrieben).
  if (isEl) zeigeElement(document.getElementById('wear-row'), false);

  // Legende anpassen
  const ts1Lbl  = document.getElementById('leg-ts1');
  const ts2Item = document.getElementById('leg-ts2-item');
  const ts2Lbl  = document.getElementById('leg-ts2-label');
  const fdSoll  = document.getElementById('leg-fd-solllage-item');
  if (ts1Lbl)  ts1Lbl.innerHTML  = isEl ? t('leg.leiter1') : isNfl ? t('leg.ts1') : t('leg.ts1.rfl');
  zeigeElement(ts2Item, (isNfl || isEl));
  if (ts2Lbl)  ts2Lbl.innerHTML  = isEl ? t('leg.leiter2') : t('leg.ts2');
  const ts3Lbl = document.getElementById('leg-ts3-label');
  if (ts3Lbl)  ts3Lbl.innerHTML  = isEl ? t('leg.leiter3') : t('leg.ts3');
  zeigeElement(fdSoll, false);   // Fd Solllage nicht mehr im Diagramm

  // Mittelspannweite: bei R-FL und bei Berechnungsart=Starr deaktivieren
  const _rulingHidden = isRfl || elBerechnungsart === 'starr';
  zeigeElement(document.getElementById('seg-ruling'), !(_rulingHidden));
  if (_rulingHidden && spanMode === 'ruling') setSpanMode('single');

  // Berechnungsart: Einzelleiter und N-FL (R-FL: konstante Zugkraft, keine Wahl)
  const baRow = document.getElementById('berechnungsart-row');
  zeigeElement(baRow, isEl || isNfl);
  if (isRfl && elBerechnungsart !== 'ausgleichend') elBerechnungsart = 'ausgleichend';
  _berechnungsartUI();
}

function t2TempColor(temp) {
  const t = Math.max(0, Math.min(1, (temp + 20) / 100));
  const hue = Math.round(220 * (1 - t));
  // Etwas weniger Sättigung als früher (leuchtet nicht); im Dunkelmodus heller,
  // damit Kurve und Zahlen auf dunklem Grund lesbar bleiben (PDF immer hell).
  const dunkel = !_diagrammDruck && document.documentElement.dataset.thema === 'dunkel';
  const lit = dunkel ? Math.round(70 - 6 * t) : Math.round(42 - 5 * t);
  return `hsl(${hue},${dunkel ? 70 : 72}%,${lit}%)`;
}

// Skala-Labels beim Schieben dynamisch skalieren
function updateT2Float(v, active) {
  const clr = (typeof sysMode !== 'undefined' && sysMode === 'rfl') ? '#6b7280' : t2TempColor(v);
  const sldr = document.getElementById('temp2-slider');
  if (sldr) sldr.style.setProperty('--t2-clr', clr);
  const inp = document.getElementById('temp2');
  if (inp) inp.style.color = '';
  const legDot = document.querySelector('#leg-ts2-item .legend-dot');
  if (legDot) legDot.style.background = clr;
  const labels   = document.querySelectorAll('.t2-lbl');
  const allVals  = Array.from(labels).map(el => parseInt(el.dataset.val));
  const exactHit = allVals.includes(v);

  // Angrenzende Label-Werte bestimmen
  const lower = allVals.filter(lv => lv <= v);
  const upper = allVals.filter(lv => lv >= v);
  const lowerVal = lower.length ? Math.max(...lower) : null;
  const upperVal = upper.length ? Math.min(...upper) : null;

  labels.forEach(el => {
    const lv = parseInt(el.dataset.val);
    if (active) {
      if (exactHit && lv === v) {
        // Exakter Treffer: gross, in der Temperaturfarbe (wie Knopf und Kurve)
        el.style.fontSize = '.95rem';
        el.style.fontWeight = '700';
        el.style.color = clr;
      } else if (!exactHit && (lv === lowerVal || lv === upperVal)) {
        // Zwischen zwei Labels: beide angrenzend etwas kleiner, gleiche Farbe
        el.style.fontSize = '.75rem';
        el.style.fontWeight = '600';
        el.style.color = clr;
      } else {
        el.style.fontSize = '.6rem';
        el.style.fontWeight = '400';
        el.style.color = 'var(--tertiary)';
      }
    } else {
      el.style.fontSize = '.6rem';
      el.style.fontWeight = '400';
      el.style.color = 'var(--tertiary)';
    }
  });
  const root = document.documentElement;
}

function onT2SliderEnd() { updateT2Float(parseFloat(document.getElementById('temp2').value), false); }

// Eislast-Feld dynamisch ein-/ausblenden (nur bei T₂ = −5 °C)
function onT2Slider(val, active = false) {
  const v = Math.round(parseFloat(val));
  document.getElementById('temp2').value = v;
  document.getElementById('temp2-slider').value = v;
  updateT2Float(v, active);
  updateEislastVisibility();
  // active = Regler wird gezogen → auf einen Frame bündeln.
  // Beim Loslassen (onchange, active = false) sofort und vollständig rechnen.
  if (active) berechnenEntprellt(); else berechnen();
  // Foto-Tab: foto-T1 neu synchronisieren und vollständig neu berechnen
  if (window._fotoTabActive && typeof _fotoSidebarSync === 'function') _fotoSidebarSync();
}

function onT2Input(val) {
  let v = parseFloat(val);
  if (isNaN(v)) return;
  v = Math.max(-20, Math.min(80, Math.round(v)));
  document.getElementById('temp2-slider').value = v;
  updateT2Float(v, false);
  updateEislastVisibility();
  berechnen();
  if (window._fotoTabActive && typeof _fotoSidebarSync === 'function') _fotoSidebarSync();
}

// Eislast-Wirksamkeit — einzige Wahrheitsquelle für Sichtbarkeit UND Berechnung.
// Bewusst unabhängig vom DOM-Zustand des Eingabefelds: Ein Lastfall darf nicht
// davon abhängen, wie ein Element gerade dargestellt wird.
// T2 optional übergeben, damit Aufrufer ihren bereits gelesenen Wert weiterreichen.
function isEislastAktiv(T2) {
  const t2 = T2 ?? parseFloat(document.getElementById('temp2').value);
  return (sysMode === 'nfl' || sysMode === 'rfl' || sysMode === 'el') && eislastWirksamBei(t2);
}

function updateEislastVisibility() {
  const row  = document.getElementById('eislast-row');
  const show = isEislastAktiv();
  zeigeElement(row, show);
  if (!show) document.getElementById('zl-eis').value = 0;
  // Sub-label immer sichtbar (bei T<sub>2</sub> = −5 °C gilt für NFL und RFL)
  const subLbl = document.getElementById('eis-label-sub');
  zeigeElement(subLbl, true);
}

function toggleT3() {
  showT3 = !showT3;
  const section = document.getElementById('t3-section');
  const icon    = document.getElementById('t3-toggle-icon');
  const txt     = document.getElementById('t3-toggle-txt');
  const legItem = document.getElementById('leg-ts3-item');
  zeigeElement(section, showT3);
  if (txt)  txt.innerHTML  = showT3 ? t('t3.hide') : t('t3.show');
  zeigeElement(legItem, showT3);
  if (showT3) {
    const v = (v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp3').value));
    updateT3Float(v, false);
    // Neu eingeblendeten Bereich vollständig in Sicht scrollen
    setTimeout(() => {
      const card = document.getElementById('t3-card');
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 80);
  }
  berechnen();
}

function updateT3Float(v, active) {
  const clr = t2TempColor(v);
  const sldr = document.getElementById('temp3-slider');
  if (sldr) sldr.style.setProperty('--t3-clr', clr);
  const legDot = document.getElementById('leg-ts3-dot');
  if (legDot) { legDot.style.borderColor = clr; legDot.style.background = 'transparent'; }
  const labels  = document.querySelectorAll('.t3-lbl');
  const allVals = Array.from(labels).map(el => parseInt(el.dataset.val));
  const exactHit = allVals.includes(v);
  const lower = allVals.filter(lv => lv <= v);
  const upper = allVals.filter(lv => lv >= v);
  const lowerVal = lower.length ? Math.max(...lower) : null;
  const upperVal = upper.length ? Math.min(...upper) : null;
  labels.forEach(el => {
    const lv = parseInt(el.dataset.val);
    if (active) {
      if (exactHit && lv === v) {
        el.style.fontSize = '.95rem'; el.style.fontWeight = '700'; el.style.color = clr;
      } else if (!exactHit && (lv === lowerVal || lv === upperVal)) {
        el.style.fontSize = '.75rem'; el.style.fontWeight = '600'; el.style.color = clr;
      } else {
        el.style.fontSize = '.6rem'; el.style.fontWeight = '400'; el.style.color = 'var(--tertiary)';
      }
    } else {
      el.style.fontSize = '.6rem'; el.style.fontWeight = '400'; el.style.color = 'var(--tertiary)';
    }
  });
}

function onT3SliderEnd() { updateT3Float(parseFloat(document.getElementById('temp3').value), false); }

function onT3Slider(val, active = false) {
  const v = Math.round(parseFloat(val));
  document.getElementById('temp3').value = v;
  document.getElementById('temp3-slider').value = v;
  updateT3Float(v, active);
  if (active) berechnenEntprellt(); else berechnen();
}

function onT3Input(val) {
  let v = parseFloat(val);
  if (isNaN(v)) return;
  v = Math.max(-20, Math.min(80, Math.round(v)));
  document.getElementById('temp3-slider').value = v;
  updateT3Float(v, false);
  berechnen();
}

// System N-FL / R-FL / Einzelleiter umschalten
// ── Sanfter Umbau beim Systemwechsel (FLIP) ─────────────────────────────
// Blöcke, die ihre Lage ändern, gleiten an die neue Stelle; neu erscheinende
// Blöcke blenden ein. Nur transform/opacity, ohne Einfluss auf die Rechnung.
// Zuordnung vorher/nachher über das Element selbst oder — wenn der Inhalt neu
// aufgebaut wird (hf-Ansicht) — über id, aria-labelledby, erste innere id oder Text.
// Bei «Bewegung reduzieren» wird sofort umgeschaltet.
const _UMBAU = { dauer: 220, kurve: 'cubic-bezier(.22,1,.3,1)', einblenden: 180 };
function _umbauSchluessel(el) {
  if (el.id) return '#' + el.id;
  const lb = el.getAttribute('aria-labelledby');
  if (lb) return '@' + lb;
  const innen = el.querySelector('[id]');
  if (innen) return '>' + innen.id;
  return el.tagName + '.' + el.className + ':' + el.textContent.trim().slice(0, 60);
}
function sanftUmbauen(wurzel, selektor, aenderung) {
  const aus = !wurzel || typeof wurzel.animate !== 'function'
    || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (aus) { aenderung(); return; }
  const sichtbar = el => el.getClientRects().length > 0;
  const vorher = new Map(), vorherSchl = new Map();
  for (const el of wurzel.querySelectorAll(selektor)) {
    if (!sichtbar(el)) continue;
    const y = el.getBoundingClientRect().top;
    vorher.set(el, y);
    const k = _umbauSchluessel(el);
    if (!vorherSchl.has(k)) vorherSchl.set(k, y);
  }
  aenderung();
  const hoehe = window.innerHeight, versatz = new Map(), neu = new Set();
  for (const el of wurzel.querySelectorAll(selektor)) {
    if (!sichtbar(el)) continue;
    const r = el.getBoundingClientRect();
    // Nächster Vorfahr im Satz: Bewegung relativ zu ihm, damit nichts doppelt gleitet
    let v = el.parentElement, basis = 0, imNeuen = false;
    for (; v && v !== wurzel; v = v.parentElement) {
      if (versatz.has(v)) { basis = versatz.get(v); break; }
      if (neu.has(v)) { imNeuen = true; break; }
    }
    const alt = vorher.has(el) ? vorher.get(el) : vorherSchl.get(_umbauSchluessel(el));
    const imBild = r.bottom > 0 && r.top < hoehe;
    if (alt === undefined) {
      neu.add(el);
      if (!imNeuen && imBild) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: _UMBAU.einblenden, easing: 'ease-out' });
      continue;
    }
    const d = alt - r.top;
    versatz.set(el, d);
    if (imNeuen || !imBild || Math.abs(d - basis) < 1) continue;
    el.animate([{ transform: `translateY(${(d - basis).toFixed(1)}px)` }, { transform: 'none' }],
               { duration: _UMBAU.dauer, easing: _UMBAU.kurve });
  }
}

// Wechsel Diagramm / Zeichnung / Abschnitt / Foto: neue Ansicht blendet ein, die Karte
// ändert ihre Höhe fliessend statt zu springen (Inhalt darunter gleitet mit).
function ansichtWechseln(aenderung) {
  const karte = document.querySelector('.canvas-card');
  const aus = !karte || typeof karte.animate !== 'function' || karte.classList.contains('canvas-fullscreen')
    || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (aus) { aenderung(); return; }
  const unten = document.getElementById('result-card');
  const vorher = new Set([...karte.children, unten].filter(el => el && el.getClientRects().length));
  const h0 = karte.getBoundingClientRect().height;
  aenderung();
  const h1 = karte.getBoundingClientRect().height;
  if (Math.abs(h1 - h0) > 2) {
    karte.style.overflow = 'hidden';
    karte.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 240, easing: _UMBAU.kurve })
      .finished.finally(() => { karte.style.overflow = ''; });
  }
  // Inhalt der Karte (ohne Kopf mit den Reitern) und neu erscheinende Karten darunter blenden ein
  [...karte.children].filter(el => !el.classList.contains('canvas-header') && el.getClientRects().length)
    .concat(unten && unten.getClientRects().length && !vorher.has(unten) ? [unten] : [])
    .forEach(el => el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' }));
}

// Systemwahl per Knopf: wie setSysMode, aber mit sanftem Umbau der Seitenleiste
function sysWaehlen(mode) {
  sanftUmbauen(document.querySelector('.sidebar-scroll'),
    '.card, .card > *, .field-group > *, .field-row > *', () => setSysMode(mode));
}

function setSysMode(mode) {
  sysMode = mode;
  _hVonHand = false;
  updateSysModeUI(mode);
  // Foto-H-Override beim Moduswechsel immer löschen — nur „In App übernehmen" soll H setzen
  if (_hFromFoto && typeof _updateTensionFotoState === 'function') _updateTensionFotoState(false);
  if (mode !== 'el') {
    activePresetRef = null;
    activePresetP   = null;
    rebuildPresetDropdown(mode);
    document.getElementById('sh').value = mode === 'rfl' ? 1.60 : 2.40;
  } else {
    elMaterialChanged();
    const selMat = MATERIALS[document.getElementById('el-material-select').value];
    if (!selMat || selMat.H_reglage === null || selMat.H_reglage === undefined) {
      document.getElementById('tension').value = 5000;
    }
  }
  berechnen();
}

// Einzelleiter: auto-Variante nach Spannweite wählen (nur bei auto_variant_by_span-Materialien)
function autoSelectElVariantBySpan(L) {
  if (sysMode !== 'el') return;
  const sel = document.getElementById('el-material-select')?.value;
  const mat = sel ? MATERIALS[sel] : null;
  if (!mat || !mat.auto_variant_by_span || !mat.H_reglage_variants) return;
  const idx = mat.H_reglage_variants.findIndex(v => L <= (v.c_max ?? Infinity));
  const newIdx = idx < 0 ? mat.H_reglage_variants.length - 1 : idx;
  if (newIdx !== elBasiskraftIdx) applyElVariant(newIdx);
}

// Einzelleiter: Materialwechsel → material-ts hidden field + Eigengewicht aktualisieren
// Einzelleiter: Variante (Basiskraft) anwenden
function applyElVariant(idx) {
  _hVonHand = false;   // neue Reglage gewählt → Handwert verwerfen
  const sel = document.getElementById('el-material-select').value;
  const mat = MATERIALS[sel];
  if (!mat) return;
  elBasiskraftIdx = idx;

  // Buttons aktualisieren
  const btns = document.querySelectorAll('#el-basis-btns .seg-btn');
  btns.forEach((b, i) => b.classList.toggle('active', i === idx));

  // Variante auswählen (fällt auf mat selbst zurück wenn kein Variants-Array)
  const variant = mat.H_reglage_variants ? mat.H_reglage_variants[idx] : mat;
  if (!variant) return;

  const infoBox = document.getElementById('el-reglage-info');
  if (variant.H_reglage !== null && variant.H_reglage !== undefined) {
    if (elReglageHmaxOvr === null && elReglageLrefOvr === null) {
      activePresetRef = variant.H_reglage_table
        ? { H_Ts_ub_table: variant.H_reglage_table }
        : null;
      if (activePresetRef) {
        updateH_Ts_ubFromT1();
      } else {
        _tensionAutoFilling = true;
        document.getElementById('tension').value = variant.H_reglage;
        _tensionAutoFilling = false;
      }
    }
    _renderReglageTitle();
    document.getElementById('el-reglage-note').innerHTML =
      variant.reglage_note_key ? t(variant.reglage_note_key) : (variant.reglage_note || '');
  } else {
    // Kein Preset: synthetische Tabelle aus 6 kN Voreinstellung aufbauen
    const dftH = 6000, dftL = mat.L_ref ?? 45;
    if (mat.E && mat.AK && elReglageHmaxOvr === null && elReglageLrefOvr === null) {
      const _t = [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40];
      const _v = _t.map(T => _rundeReglage(_reglageH(mat, dftH, dftL, T)));
      activePresetRef = { H_Ts_ub_table: { temps: _t, vals: _v } };
      updateH_Ts_ubFromT1();
    } else {
      activePresetRef = null;
    }
  }
  zeigeElement(infoBox, true);
  // «Starr» (L_ref = 25 m) bzw. angepasste Bezugswerte: Tabelle wie bei setBerechnungsart
  // herleiten. Früher blieb hier die normale Tabelle stehen — nach dem Laden eines
  // Starr-Projekts oder einem Systemwechsel rechnete T₁ dann mit falschen Werten.
  if (elBerechnungsart === 'starr' || elReglageHmaxOvr !== null || elReglageLrefOvr !== null) {
    if (mat.E && mat.AK) { _applyReglageOvr(); return; }
  }
  _elReglageBoxAktualisieren();
  if (elReglageOpen) renderReglageEditPanel();
  berechnen();
}

function elMaterialChanged() {
  const sel = document.getElementById('el-material-select').value;
  document.getElementById('material-ts').value = sel;
  const mat = MATERIALS[sel];
  if (mat) {
    document.getElementById('weight-ts').value = mat.q.toFixed(5);
    document.getElementById('alpha-ts').value  = (mat.alpha * 1e6).toFixed(1);

    // Basiskraft-Varianten-Buttons aufbauen (nur wenn Varianten vorhanden und nicht auto)
    const basisRow  = document.getElementById('el-basis-row');
    const basisBtns = document.getElementById('el-basis-btns');
    if (mat.H_reglage_variants && mat.H_reglage_variants.length > 1 && !mat.auto_variant_by_span) {
      basisBtns.innerHTML = mat.H_reglage_variants
        .map((v, i) => `<button class="seg-btn${i === 0 ? ' active' : ''}" onclick="applyElVariant(${i})">${v.label}</button>`)
        .join('');
      zeigeElement(basisRow, true);
    } else {
      basisBtns.innerHTML = '';
      zeigeElement(basisRow, false);
    }

    elBasiskraftIdx = 0;
    // Overrides + Edit-Panel zurücksetzen bei Materialwechsel
    elReglageHmaxOvr = null; elReglageLrefOvr = null;
    if (elReglageOpen) { elReglageOpen = false; const p=document.getElementById('el-reglage-edit-panel'); if(p){zeigeElement(p, false);p.innerHTML='';} }
    applyElVariant(0);
  }
  berechnen();
}

// Abnutzungsgrad des Fahrdrahts setzen
function setWear(pct) {
  wearPct = pct;
  document.getElementById('wear-btn-0').classList.toggle('active', pct === 0);
  document.getElementById('wear-btn-max').classList.toggle('active', pct !== 0);
  berechnen();
}

// ── Materialparameter aus versteckten Eingabefeldern auslesen ──
function getAlphaTs()        { return parseFloat(document.getElementById('alpha-ts').value) * 1e-6; }
function getEATs()           { const sel = document.getElementById('material-ts').value; if (sel === 'custom-ts') { const v = parseFloat(document.getElementById('ea-ts').value); return isNaN(v) ? null : v; } const m = MATERIALS[sel]; if (!m || m.E == null || m.AK == null) return null; return m.E * m.AK; }
function _getMaterialName(type) {
  const sel = document.getElementById(`material-${type}`).value;
  return sel === `custom-${type}` ? 'Benutzerdefiniert' : MATERIALS[sel]?.name ?? '—';
}
function getMaterialNameTs() { return _getMaterialName('ts'); }
function getMaterialNameFd() { return _getMaterialName('fd'); }

// ═══════════════════════════════════════════════════════════════
// SPANNWEITEN-MODUS
// Einzelspannweite: direkte Eingabe von L
// Mittelspannweite (Ruling Span): Lm = √(ΣLi³/ΣLi), Zustandsgleichung mit Lm
// ═══════════════════════════════════════════════════════════════
let spanMode = 'single';
let spanCount = 3;

function setSpanMode(mode) {
  spanMode = mode;
  document.getElementById('seg-single').classList.toggle('active', mode === 'single');
  document.getElementById('seg-ruling').classList.toggle('active', mode === 'ruling');
  zeigeElement(document.getElementById('panel-single'), mode === 'single');
  zeigeElement(document.getElementById('panel-ruling'), mode === 'ruling');
  if (mode === 'ruling') rebuildSpanList();
  berechnen();
}

function changeSpanCount(delta) {
  spanCount = Math.max(2, Math.min(10, spanCount + delta));
  document.getElementById('span-count-val').textContent = spanCount;
  rebuildSpanList();
  berechnen();
}

function highlightActiveSpan() {
  const sel = document.getElementById('display-span');
  const idx = sel ? parseInt(sel.value) : -1;
  document.querySelectorAll('.span-row').forEach((row, i) => {
    row.classList.toggle('active-span', i === idx);
  });
}

function rebuildSpanList() {
  const list = document.getElementById('spans-list');
  const sel  = document.getElementById('display-span');
  const prev = getSpanLengths();
  list.innerHTML = '';
  sel.innerHTML  = '';
  for (let i = 0; i < spanCount; i++) {
    const val = prev[i] ?? 50;
    const row = document.createElement('div');
    row.className = 'span-row';
    row.setAttribute('data-span-idx', i);
    row.innerHTML = `<label>L<sub>${i+1}</sub></label>
      <div class="input-wrap">
        <input type="number" id="span-${i}" value="${val}" min="0.1" step="0.1" oninput="updateLm();if(!drag)berechnenEntprellt();" onchange="updateLm();berechnen();">
        <span class="input-unit">m</span>
      </div>`;
    list.appendChild(row);
    const opt = document.createElement('option');
    opt.value = i;
    opt.id = `display-span-opt-${i}`;
    opt.textContent = `${t('span.feld')} ${i+1}  –  ${val.toFixed(1)} m`;
    sel.appendChild(opt);
  }
  updateLm();
  highlightActiveSpan();
}

function getSpanLengths() {
  const out = [];
  for (let i = 0; i < spanCount; i++) {
    const el = document.getElementById(`span-${i}`);
    if (el) out.push(parseFloat(el.value) || 50);
  }
  return out;
}

let lmFormula = 'arith'; // 'ruling' | 'arith'

const _LM_HINTS = {
  ruling: 'Lm = √(ΣL³ / ΣL)',
  arith:  'Lm = ΣL / n',
};

function setLmFormula(f) {
  lmFormula = f;
  const bR = document.getElementById('seg-lm-ruling');
  const bA = document.getElementById('seg-lm-arith');
  if (bR) bR.classList.toggle('active', f === 'ruling');
  if (bA) bA.classList.toggle('active', f === 'arith');
  const hint = document.getElementById('lm-formula-hint');
  if (hint) hint.textContent = _LM_HINTS[f] || '';
  // Klick auf Button löscht manuellen Override
  lmOvr = null;
  const inp = document.getElementById('lm-display');
  if (inp) { inp.value = ''; inp.style.color = ''; }
  const btns = document.getElementById('lm-formula-btns');
  if (btns) btns.style.opacity = '';
  updateLm();
  berechnen();
}

// Berechnet Lm je nach gewählter Formel:
//   Arithmetisch:     Lm = ΣL / n
//   Ideelle Spannweite: Lm = √(ΣL³ / ΣL)  (EN 50119 / SBB-Standard)
function computeRulingSpan(spans) {
  if (lmFormula === 'arith')
    return spans.reduce((s, l) => s + l, 0) / spans.length;
  const sumL3 = spans.reduce((s, l) => s + l ** 3, 0);
  const sumL  = spans.reduce((s, l) => s + l,      0);
  return Math.sqrt(sumL3 / sumL);
}

let lmOvr = null; // manueller Lm-Override (null = auto-berechnet)

function onLmInput(val) {
  const v = parseFloat(val);
  lmOvr = (val.trim() === '' || isNaN(v)) ? null : v;
  const inp  = document.getElementById('lm-display');
  const btns = document.getElementById('lm-formula-btns');
  if (lmOvr !== null) {
    // Manueller Wert → Buttons ausgrauen, Feld primärfarbe
    if (inp)  inp.style.color = 'var(--primary)';
    if (btns) btns.style.opacity = '0.35';
  } else {
    // Feld geleert → Buttons zurück, berechneten Wert anzeigen
    if (inp)  inp.style.color = '';
    if (btns) btns.style.opacity = '';
    updateLm();
  }
  berechnen();
}

function updateLm() {
  const spans = getSpanLengths();
  if (spans.length < 1) return;
  const calc = computeRulingSpan(spans);
  const inp  = document.getElementById('lm-display');
  if (inp) {
    // Feld nur aktualisieren wenn kein manueller Override und nicht gerade fokussiert
    if (lmOvr === null && document.activeElement !== inp) {
      inp.value = calc.toFixed(2);
      inp.style.color = '';
    }
    // Placeholder immer aktuell halten (sichtbar wenn Feld leer)
    inp.placeholder = calc.toFixed(2);
  }
  // Dropdown-Optionen live mit aktuellem Wert aktualisieren
  spans.forEach((v, i) => {
    const opt = document.getElementById(`display-span-opt-${i}`);
    if (opt) opt.textContent = `${t('span.feld')} ${i+1}  –  ${v.toFixed(1)} m`;
  });
}

function getActiveSpan() {
  if (spanMode === 'single') {
    return parseFloat(document.getElementById('span').value) || 50;
  }
  const spans = getSpanLengths();
  const idx   = parseInt(document.getElementById('display-span').value) || 0;
  return spans[idx] ?? spans[0];
}

function getEffectiveSpan() {
  if (spanMode === 'single') return getActiveSpan();
  if (lmOvr !== null) return lmOvr;
  return computeRulingSpan(getSpanLengths());
}

// ═══════════════════════════════════════════════════════════════
// PROJEKTVERWALTUNG — localStorage
// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// PROJEKTVERWALTUNG — localStorage
// Gekapselt nach dem Vorbild des Foto-Moduls: Der Zustand dieses Bereichs
// liegt privat im Modul; nach aussen geht nur, was HTML-Handler oder anderer
// Code tatsächlich braucht (siehe Rückgabe am Ende).
// ═══════════════════════════════════════════════════════════════
const Projekte = (() => {

// ── Privater Zustand ──
let selectedIds     = new Set();   // IDs der selektierten Berechnungen
let collapsedGroups = new Set();   // IDs der eingeklappten Gruppen
let projSortMode    = 'date_desc'; // Sortierung: date_desc | date_asc | name_asc | name_desc

const PROJ_META_KEY    = 'dh_projects_meta';
const PROJ_KEY_PREFIX  = 'dh_project_';
let currentProjectId   = null; // aktuell geladenes Projekt

// ── State erfassen ──
function getProjectState() {
  const FIELD_IDS = [
    'span','h1','h2','temp1','temp2','temp3','tension','tension-fd','sh',
    'material-ts','material-fd','weight-ts','weight-fd','alpha-ts','alpha-fd',
    'preset-select','el-material-select',
    'sok-mum-left','sok-mum-right','zl-eis',
    'xC','yC',
    'probe-x1','probe-x2','probe-x3','probe-x4','display-span',
    'hind-min',
    // Höheneingabe / Mastangaben
    'foto-hmast-L','foto-hmast-R',
    'mast-num-left','mast-num-right',
    'mast-km-left','mast-km-right',
    'mast-delta-sok-left','mast-delta-sok-right',
    'koord-e-left','koord-n-left','koord-e-right','koord-n-right'
  ];
  const fields = {};
  FIELD_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) fields[id] = el.value;
  });
  const spans = [];
  for (let i = 0; i < spanCount; i++) {
    const el = document.getElementById(`span-${i}`);
    if (el) spans.push(parseFloat(el.value) || 50);
  }
  const fotoState = typeof window._fotoGetProjectState === 'function'
                    ? window._fotoGetProjectState() : null;
  return { schemaVersion: PROJEKT_SCHEMA_VERSION,
           sysMode, spanMode, spanCount, wearPct, yCInputMode, elBasiskraftIdx, mode3pt, fields, spans, drawingVEx: Ansicht.zeichnungVEx, drawingExtent: Ansicht.zeichnungExtent, drawingHf: Ansicht.zeichnungHf, diagrammHf, lastfaelleAktiv, fotoState, elBerechnungsart, koordAktiv, abschnitt: { ...abschnitt, zBezug: 'sok' }, messpunkte: _mpLive(), lastfaelle: lastfallEinst, lmOvr, lmFormula, showMinClearance: _showMinClearance, showT3, hFromFoto: _hFromFoto, hVonHand: _hVonHand, mpBezug, reglageAngepasst: JSON.parse(JSON.stringify(_reglageAngepasst)), elReglageHmaxOvr, elReglageLrefOvr, elMatEdits: JSON.parse(JSON.stringify(_elMatEdits)), hf: hfEingabe };
}

// ── Projektzustand: Version, Pruefung, transaktionales Laden ──────────────
// Stand 1 = erste versionierte Fassung. Dateien ohne Feld gelten als Stand 1.
const PROJEKT_SCHEMA_VERSION = 1;

// Prueft einen geladenen Zustand, bevor er angewendet wird.
//   Strukturschaden      -> ok:false, nichts wird geladen.
//   Abweichende Einzelwerte -> auf Vorgabe gesetzt und in warnungen protokolliert.
function _pruefeProjektState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s))
    return { ok: false, fehler: t('msg.projekt.kein.objekt') };
  if (!s.fields || typeof s.fields !== 'object' || Array.isArray(s.fields))
    return { ok: false, fehler: t('msg.projekt.ohne.felder') };

  const version = s.schemaVersion ?? 1;   // vor Einfuehrung der Version: Stand 1
  if (!Number.isFinite(version) || version > PROJEKT_SCHEMA_VERSION)
    return { ok: false, fehler: t('msg.projekt.zu.neu')
      .replace('{v}', String(version)).replace('{max}', String(PROJEKT_SCHEMA_VERSION)) };

  const st = { ...s, schemaVersion: version };
  const warnungen = [];

  const AUSWAHL = {
    sysMode:          [['nfl','rfl','el'],            'nfl'],
    spanMode:         [['single','ruling'],           'single'],
    lmFormula:        [['arith','ruling'],            'arith'],
    elBerechnungsart: [['ausgleichend','starr'],      'ausgleichend'],
    yCInputMode:      [['sag','sok','mum'],           'sag'],
    drawingExtent:    [['sok','catenary'],            'sok'],
  };
  for (const [k, [erlaubt, vorgabe]] of Object.entries(AUSWAHL)) {
    if (st[k] != null && !erlaubt.includes(st[k])) {
      warnungen.push(`${k}: \u00ab${st[k]}\u00bb \u2192 \u00ab${vorgabe}\u00bb`);
      st[k] = vorgabe;
    }
  }

  const BEREICHE = {   // [min, max, Vorgabe]
    spanCount:       [1,  20,  3],
    wearPct:         [0, 100,  0],
    elBasiskraftIdx: [0,  10,  0],
    drawingVEx:      [1,  20,  1],
  };
  for (const [k, [min, max, vorgabe]] of Object.entries(BEREICHE)) {
    if (st[k] == null) continue;
    const v = Number(st[k]);
    if (!Number.isFinite(v) || v < min || v > max) {
      warnungen.push(`${k}: \u00ab${st[k]}\u00bb \u2192 ${vorgabe}`);
      st[k] = vorgabe;
    }
  }

  if (st.spans != null && !Array.isArray(st.spans)) {
    warnungen.push('spans'); st.spans = [];
  }
  if (st.reglageAngepasst != null && (typeof st.reglageAngepasst !== 'object' || Array.isArray(st.reglageAngepasst))) {
    warnungen.push('reglageAngepasst'); st.reglageAngepasst = {};
  }
  if (st.elMatEdits != null && (typeof st.elMatEdits !== 'object' || Array.isArray(st.elMatEdits))) {
    warnungen.push('elMatEdits'); st.elMatEdits = {};
  }
  return { ok: true, state: st, warnungen };
}

let _projektRuecknahmeLaeuft = false;

// Aeusserer Rahmen: prueft, wendet an und nimmt bei einem Abbruch mittendrin
// den vorherigen Zustand wieder zurueck — sonst bliebe eine Mischung aus
// altem und neuem Projekt stehen. Liefert true bei Erfolg.
function setProjectState(s) {
  const pruefung = _pruefeProjektState(s);
  if (!pruefung.ok) {
    meldung(t('msg.projekt.ungueltig') + ':\n' + pruefung.fehler, 'fehler');
    return false;
  }
  const rueckfall = _projektRuecknahmeLaeuft ? null : getProjectState();
  try {
    _setProjectStateIntern(pruefung.state);
  } catch (e) {
    if (rueckfall) {
      _projektRuecknahmeLaeuft = true;
      try { _setProjectStateIntern(rueckfall); }
      catch (e2) { _spur('Projekt/Ruecknahme selbst gescheitert', e2); }
      _projektRuecknahmeLaeuft = false;
      meldung(t('msg.ladefehler') + ': ' + e.message + '\n' + t('msg.projekt.abbruch'), 'fehler');
    } else {
      meldung(t('msg.ladefehler') + ': ' + e.message, 'fehler');
    }
    return false;
  }
  if (pruefung.warnungen.length)
    meldung(t('msg.projekt.repariert') + '\n\u2022 ' + pruefung.warnungen.join('\n\u2022 '), 'warnung');
  _mastangabenOeffnenFallsBelegt();
  return true;
}

// ── State wiederherstellen (innerer Teil) ──
function _setProjectStateIntern(s) {
  const flds = s.fields || {};
  // Angepasste Reglagewerte des Projekts zuerst anwenden (ältere Projekte: SBB-Werte)
  _reglageAngepasst = JSON.parse(JSON.stringify(s.reglageAngepasst || {}));
  // Messpunkt-Bezug (ab v5.3; ältere Projekte: Vorgabe «höchster Punkt»)
  mpBezug = MP_BEZUEGE.includes(s.mpBezug) ? s.mpBezug : 'hoch';
  { const sel = document.getElementById('mp-bezug'); if (sel) sel.value = mpBezug; }
  _reglageAnpassungenAnwenden();
  // Globals (mode3pt + yCInputMode werden nach updateSysModeUI gesetzt)
  spanMode       = s.spanMode       ?? 'single';
  spanCount      = s.spanCount      ?? 3;
  elBasiskraftIdx = s.elBasiskraftIdx ?? 0;

  // Span-Modus UI (ohne berechnen)
  document.getElementById('seg-single').classList.toggle('active', spanMode === 'single');
  document.getElementById('seg-ruling').classList.toggle('active', spanMode === 'ruling');
  zeigeElement(document.getElementById('panel-single'), spanMode === 'single');
  zeigeElement(document.getElementById('panel-ruling'), spanMode === 'ruling');
  if (spanMode === 'ruling') {
    document.getElementById('span-count-val').textContent = spanCount;
    rebuildSpanList();
    (s.spans || []).forEach((v, i) => {
      const el = document.getElementById(`span-${i}`);
      if (el) el.value = v;
    });
    updateLm();
  }

  // System-Modus VOR mode3pt setzen (updateSysModeUI wuerde mode3pt=true zuruecksetzen)
  sysMode = s.sysMode ?? 'nfl';
  // Berechnungsart vor updateSysModeUI setzen (damit Ruling-Span-Visibility korrekt)
  elBerechnungsart = s.elBerechnungsart ?? 'ausgleichend';
  _berechnungsartUI();
  mode3pt = false;  // kurz false, damit updateSysModeUI nichts zuruecksetzt
  updateSysModeUI(sysMode);

  // 3-Punkte-Modus NACH updateSysModeUI wiederherstellen
  mode3pt = s.mode3pt ?? false;
  { const btn = document.getElementById('three-pt-btn');
    const panel = document.getElementById('three-pt-panel');
    const ti = document.getElementById('tension');
    if (mode3pt) {
      zeigeElement(panel, true);
      if (btn) { btn.style.background = 'var(--s4)'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--text)'; }
      if (ti) { ti.readOnly=true; ti.style.background = 'var(--bg)'; ti.style.color = 'var(--muted)'; ti.style.cursor = 'default'; }
    } else {
      zeigeElement(panel, false);
      if (btn) { btn.style.background = 'none'; btn.style.borderColor = 'var(--border)'; btn.style.color = 'var(--muted)'; }
      if (ti) { ti.readOnly=false; ti.style.background = ''; ti.style.color = ''; ti.style.cursor = ''; }
    }
  }
  // yCInputMode NACH 3pt wiederherstellen + Button-UI aktualisieren
  yCInputMode = s.yCInputMode ?? 'sag';
  setYCMode(yCInputMode);

  // Einfache Felder setzen
  const FIELDS = ['span','h1','h2','temp1','temp2','tension','tension-fd','sh',
    'material-ts','material-fd','weight-ts','weight-fd','alpha-ts','alpha-fd',
    'sok-mum-left','sok-mum-right','zl-eis',
    'probe-x1','probe-x2','probe-x3','probe-x4','display-span',
    // Höheneingabe / Mastangaben
    'foto-hmast-L','foto-hmast-R',
    'mast-num-left','mast-num-right',
    'mast-km-left','mast-km-right',
    'mast-delta-sok-left','mast-delta-sok-right',
    'koord-e-left','koord-n-left','koord-e-right','koord-n-right'];
  FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el && flds[id] != null) el.value = flds[id];
  });
  koordSchalten(s.koordAktiv === true, { rechnen: false });
  _abschnittLaden(s);
  hfEingabe = s.hf && typeof s.hf === 'object' ? { ...HF_VORGABE, ...s.hf } : null;
  if (document.getElementById('hf-modal')?.classList.contains('open')) { _hfStart(); renderHf(); }
  // KM-rechts: userEdited-Flag wiederherstellen falls Wert gesetzt
  const kmR = document.getElementById('mast-km-right');
  if (kmR && flds['mast-km-right']) kmR.dataset.userEdited = '1';

  // Messpunkte: globale JS-Variablen aus gespeicherten Feldwerten wiederherstellen
  const _pf = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  [probeX1, probeX2, probeX3, probeX4] = [1,2,3,4].map(i => _pf(flds[`probe-x${i}`]));
  _messpunkteLaden(s);
  minClearance = _pf(flds['hind-min'] ?? flds['min-clearance-input']);   // früherer Feldname
  { const mcInp = document.getElementById('hind-min');
    if (mcInp) mcInp.value = minClearance !== null ? minClearance : ''; }
  // Mindestabstand-Toggle wiederherstellen
  _showMinClearance = s.showMinClearance ?? true;
  // Mastnamen-Brücke synchronisieren (foto-name-L/R hidden inputs)
  if (typeof _syncMastNames === 'function') _syncMastNames();

  // Foto-Zustand wiederherstellen (Bild, Punkte, Ergebnis)
  if (s.fotoState && typeof window._fotoSetProjectState === 'function') {
    // Verzögert damit der Tab ggf. gerendert ist
    setTimeout(() => window._fotoSetProjectState(s.fotoState), 100);
  }
  // Foto-H-Override-Indikator wiederherstellen (Zugkraft bereits aus Feldern gesetzt)
  if (s.hFromFoto && typeof _updateTensionFotoState === 'function') {
    _updateTensionFotoState(true);
  } else {
    _hFromFoto = false;
  }

  // Zeichnungs-Einstellungen — über die Modulschnittstelle, damit die
  // Bedienelemente in einer Hand bleiben.
  Ansicht.zeichnungsEinstellungenSetzen(s.drawingVEx || 1, s.drawingExtent || 'sok');
  Ansicht.setDrawingHf(s.drawingHf === true);
  setDiagrammHf(s.diagrammHf === true);
  lastfaelleAktiv = s.lastfaelleAktiv !== false;

  // T3-Vergleichskurve — NACH updateSysModeUI (das showT3 bei R-FL zurücksetzt)
  showT3 = (s.showT3 ?? false) && sysMode !== 'rfl';
  { const sec     = document.getElementById('t3-section');
    const txt     = document.getElementById('t3-toggle-txt');
    const legItem = document.getElementById('leg-ts3-item');
    zeigeElement(sec, showT3);
    if (txt)     txt.innerHTML         = showT3 ? t('t3.hide') : t('t3.show');
    zeigeElement(legItem, showT3); }

  // Lm-Formel + Override wiederherstellen
  // Reihenfolge wichtig: setLmFormula setzt lmOvr=null → Override danach setzen
  setLmFormula(s.lmFormula ?? 'arith');
  lmOvr = s.lmOvr ?? null;
  if (lmOvr !== null) {
    const inp  = document.getElementById('lm-display');
    const btns = document.getElementById('lm-formula-btns');
    if (inp)  { inp.value = lmOvr.toFixed(2); inp.style.color = 'var(--primary)'; }
    if (btns) btns.style.opacity = '0.35';
  }

  // Preset / Material
  if (sysMode !== 'el') {
    _hVonHand = false;
    rebuildPresetDropdown(sysMode);  // befuellt Dropdown + wendet erstes Preset an
    const presetKey = flds['preset-select'] ?? '';
    document.getElementById('preset-select').value = presetKey;
    // Korrektes gespeichertes Preset anwenden
    // (rebuildPresetDropdown hatte erstes Preset angewendet -> material-ts/fd, tension-fd, sh, tension falsch)
    if (presetKey) {
      applyPreset();  // setzt material-ts/fd, weight-ts/fd, alpha-ts, tension-fd, sh, tension, temp1
    } else {
      const infoEl = document.getElementById('combo-info');
      zeigeElement(infoEl, false);
    }
    // Abnutzung NACH applyPreset() setzen (applyPreset setzt wearPct=0)
    wearPct = s.wearPct ?? 0;
    document.getElementById('wear-btn-0')?.classList.toggle('active', wearPct === 0);
    document.getElementById('wear-btn-max')?.classList.toggle('active', wearPct !== 0);
    // Benutzerwerte nach applyPreset() wiederherstellen
    // (applyPreset setzt Preset-Defaults; gespeicherte Nutzerwerte haben Vorrang)
    if (flds['tension']    != null) document.getElementById('tension').value    = flds['tension'];
    if (flds['tension-fd'] != null) document.getElementById('tension-fd').value = flds['tension-fd'];
    if (flds['temp1']      != null) document.getElementById('temp1').value      = flds['temp1'];
    if (flds['sh']         != null) document.getElementById('sh').value         = flds['sh'];
    if (flds['h1']         != null) document.getElementById('h1').value         = parseFloat(flds['h1']).toFixed(2);
    if (flds['h2']         != null) document.getElementById('h2').value         = parseFloat(flds['h2']).toFixed(2);
    if (flds['span']       != null) document.getElementById('span').value       = flds['span'];
  } else {
    activePresetRef = null; activePresetP = null;
    const matKey = flds['el-material-select'] ?? 'cu95';
    const elSel = document.getElementById('el-material-select');
    if (elSel) elSel.value = matKey;
    document.getElementById('material-ts').value = matKey;
    const mat = MATERIALS[matKey];
    if (mat) {
      document.getElementById('weight-ts').value = mat.q.toFixed(5);
      document.getElementById('alpha-ts').value  = (mat.alpha * 1e6).toFixed(1);
      const basisRow  = document.getElementById('el-basis-row');
      const basisBtns = document.getElementById('el-basis-btns');
      if (mat.H_reglage_variants && mat.H_reglage_variants.length > 1 && !mat.auto_variant_by_span) {
        basisBtns.innerHTML = mat.H_reglage_variants
          .map((v,i) => `<button class="seg-btn${i===elBasiskraftIdx?' active':''}" onclick="applyElVariant(${i})">${v.label}</button>`)
          .join('');
        zeigeElement(basisRow, true);
      } else {
        basisBtns.innerHTML = '';
        zeigeElement(basisRow, false);
      }
      // Reglage wie bei der Auswahl im Menü aufbauen (auch Leiter ohne eigene Tabelle:
      // dort entsteht die Tabelle aus der 6-kN-Voreinstellung). Früher eigene Kopie —
      // dabei ging bei solchen Leitern die Bindung an die Reglage verloren.
      elReglageHmaxOvr = null; elReglageLrefOvr = null;   // Overrides folgen unten
      applyElVariant(elBasiskraftIdx);
    }
    if (flds['tension'] != null) document.getElementById('tension').value = flds['tension'];
    // EL Reglage-Overrides wiederherstellen (NACH Material-Setup)
    elReglageHmaxOvr = s.elReglageHmaxOvr ?? null;
    elReglageLrefOvr = s.elReglageLrefOvr ?? null;
    _elMatEdits      = s.elMatEdits       ?? {};
    if (elReglageHmaxOvr !== null || elReglageLrefOvr !== null) _applyReglageOvr();
    // Handwert H (ab v5.1) zuletzt — die Reglage-Schritte oben würden ihn überschreiben
    _hVonHand = !!s.hVonHand && !s.hFromFoto;
    if (_hVonHand && flds['tension'] != null) document.getElementById('tension').value = flds['tension'];
  }
  // T2-Slider synchronisieren und Eislast-Sichtbarkeit aktualisieren
  if (flds['temp2'] != null) {
    const t2v = parseFloat(flds['temp2']);
    if (!isNaN(t2v)) {
      const sl = document.getElementById('temp2-slider');
      if (sl) sl.value = t2v;
      updateT2Float(t2v, false);
    }
  }
  // T3-Slider synchronisieren
  if (flds['temp3'] != null) {
    const t3v = parseFloat(flds['temp3']);
    if (!isNaN(t3v)) {
      const sl3 = document.getElementById('temp3-slider');
      if (sl3) sl3.value = t3v;
    }
  }
  updateEislastVisibility();
  berechnen();
}

// ── localStorage-Hilfsfunktionen ──
function getProjMeta()        { try { return JSON.parse(localStorage.getItem(PROJ_META_KEY) || '[]'); } catch { return []; } }

// ── Auto-Benennung ──
function nextProjectName() {
  const names = new Set(getProjMeta().filter(m => m.isGroup).map(g => g.name));
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const ch of letters) { const n = `Projekt ${ch}`; if (!names.has(n)) return n; }
  for (const a of letters) for (const b of letters) { const n = `Projekt ${a}${b}`; if (!names.has(n)) return n; }
  return `Projekt ${Date.now()}`;
}
function nextCalcName(parentId) {
  const count = getProjMeta().filter(m => !m.isGroup && m.parentId === parentId).length;
  return `${sysName(sysMode)} ${count + 1}`;
}

// ── Letzter Speicher-/Ladeort ──
const _LAST_GRP_KEY = 'dh_last_save_group';
function _getLastGrpId()    { return localStorage.getItem(_LAST_GRP_KEY) || null; }
function _setLastGrpId(id)  { if (id) localStorage.setItem(_LAST_GRP_KEY, id); }

// ── Speicherort-Dropdown befüllen ──
function populateSaveGroupSel() {
  const sel  = document.getElementById('proj-group-sel');
  if (!sel) return;
  const meta   = getProjMeta();
  const groups = meta.filter(m => m.isGroup);
  const lastId = _getLastGrpId();
  sel.innerHTML = '';
  // Bestehendes Projekt — zuletzt genutztes zuerst
  const sorted = [
    ...groups.filter(g => g.id === lastId),
    ...groups.filter(g => g.id !== lastId),
  ];
  sorted.forEach(g => {
    const o = document.createElement('option');
    o.value = g.id;
    o.textContent = g.name;
    sel.appendChild(o);
  });
  // Trennlinie + Option "Neues Projekt"
  if (sorted.length > 0) {
    const sep = document.createElement('option');
    sep.disabled = true; sep.textContent = '──────────────';
    sel.appendChild(sep);
  }
  const newOpt = document.createElement('option');
  newOpt.value = '__new__'; newOpt.textContent = t('ui.proj.neu');
  sel.appendChild(newOpt);
  // Vorauswahl: letzter Ort oder "__new__" wenn noch kein Projekt
  sel.value = (lastId && sorted.some(g => g.id === lastId)) ? lastId : (sorted.length ? sorted[0].id : '__new__');
  onProjGroupSelChange();
}

// ── Speicherort-Toggle: Neues-Projekt-Feld ein-/ausblenden ──
function onProjGroupSelChange() {
  const val = document.getElementById('proj-group-sel')?.value;
  const row = document.getElementById('proj-new-grp-row');
  zeigeElement(row, val === '__new__');
}

// ── Hauptspeicher-Funktion ──
function saveCurrentCalc() {
  const meta = getProjMeta();
  const selVal = document.getElementById('proj-group-sel')?.value;

  let groupId;
  if (selVal === '__new__' || !selVal) {
    // Neues Projekt anlegen
    const nameInp = document.getElementById('proj-new-grp-name');
    const gName   = nameInp?.value.trim() || nextProjectName();
    groupId = 'g' + Date.now() + Math.random().toString(36).slice(2,5);
    meta.unshift({ id: groupId, name: gName, isGroup: true, parentId: null,
                   createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    if (nameInp) nameInp.value = '';
  } else {
    // In bestehendes Projekt speichern
    groupId = selVal;
  }

  // Berechnung anlegen
  const calcInp  = document.getElementById('proj-calc-name');
  const calcName = calcInp?.value.trim() || nextCalcName(groupId);
  const id = genProjId();
  const now = new Date().toISOString();
  if (!_schreibeBerechnung(id, getProjectState(), calcName)) return;
  meta.unshift({ id, name: calcName, isGroup: false, parentId: groupId, createdAt: now, updatedAt: now });
  if (!_speichereMetaOderRollback(meta, [id])) return;
  _setLastGrpId(groupId);   // Letzten Speicherort merken
  currentProjectId = id;
  if (calcInp) calcInp.value = '';
  collapsedGroups.delete(groupId);
  renderProjectList();
  updateProjectBadge();
  // Dropdown neu befüllen (neues Projekt ggf. sichtbar)
  populateSaveGroupSel();
}
function saveProjMeta(arr)    { localStorage.setItem(PROJ_META_KEY, JSON.stringify(arr)); }

// ── Berechnung sicher ablegen ──
// Schreibt ZUERST die Daten, erst danach darf der Aufrufer den Listeneintrag
// (Meta) anlegen. So entsteht bei vollem Speicher kein Eintrag ohne Inhalt.
// Ist der Speicher voll, wird ein zweiter Versuch ohne Foto-Bild gemacht.
// Rückgabe: 'ok' | 'ohne-foto' | false (nichts gespeichert, Meldung gezeigt)
function _schreibeBerechnung(id, state, name) {
  const schreibe = s => { localStorage.setItem(PROJ_KEY_PREFIX + id, JSON.stringify({ ...s, name })); _merkeAenderung(); };
  try { schreibe(state); return 'ok'; }
  catch (e) {
    if (state.fotoState?.imgDataURL) {
      try {
        schreibe({ ...state, fotoState: { ...state.fotoState, imgDataURL: null } });
        meldung(t('msg.gespeichert.ohne.foto'), 'warnung');
        return 'ohne-foto';
      } catch (e2) {
        meldung(t('msg.speicher.voll.loeschen'), 'fehler');
        return false;
      }
    }
    meldung(t('msg.speicher.voll.loeschen'), 'fehler');
    return false;
  }
}

// Listeneintrag speichern; bei vollem Speicher die zuvor geschriebenen
// Berechnungsdaten wieder entfernen, damit nichts verwaist.
function _speichereMetaOderRollback(meta, neueIds) {
  try { saveProjMeta(meta); return true; }
  catch (e) {
    neueIds.forEach(id => localStorage.removeItem(PROJ_KEY_PREFIX + id));
    meldung(t('msg.speicher.voll.loeschen'), 'fehler');
    return false;
  }
}
function genProjId()          { return 'p' + Date.now() + Math.random().toString(36).slice(2,5); }
function setProjSort(mode)    { projSortMode = mode; renderProjectList(); }

async function renameEntry(id) {
  const meta  = getProjMeta();
  const entry = meta.find(m => m.id === id);
  if (!entry) return;
  const newName = await frageText(t('rf.name.frage'), entry.name,
    { titel: t('rf.umbenennen'), ok: t('rf.umbenennen') });
  if (!newName || !newName.trim() || newName.trim() === entry.name) return;
  entry.name = newName.trim();
  entry.updatedAt = new Date().toISOString();
  saveProjMeta(meta);
  if (!entry.isGroup) {
    const raw = localStorage.getItem(PROJ_KEY_PREFIX + id);
    if (raw) { try { const s = JSON.parse(raw); s.name = entry.name; localStorage.setItem(PROJ_KEY_PREFIX + id, JSON.stringify(s)); }
               catch(e) { _spur('Projekt/Umbenennen', e); } }
  }
  updateProjectBadge();
  renderProjectList();
}

function updateProjectBadge() {
  const badge   = document.getElementById('proj-name-badge');
  const grpSpan = document.getElementById('proj-name-group');
  const sepSpan = document.getElementById('proj-name-sep');
  const txtSpan = document.getElementById('proj-name-text');
  if (!badge || !txtSpan) return;
  if (currentProjectId) {
    const allMeta = getProjMeta();
    const meta = allMeta.find(m => m.id === currentProjectId);
    if (meta) {
      const group = meta.parentId ? allMeta.find(m => m.id === meta.parentId) : null;
      if (group && grpSpan && sepSpan) {
        grpSpan.textContent = group.name;
        zeigeElement(sepSpan, true);
        zeigeElement(grpSpan, true);
      } else if (grpSpan && sepSpan) {
        grpSpan.textContent = '';
        zeigeElement(sepSpan, false);
        zeigeElement(grpSpan, false);
      }
      txtSpan.textContent = meta.name;
      zeigeElement(badge, true);
      return;
    }
  }
  zeigeElement(badge, false);
  if (txtSpan) txtSpan.textContent = '';
  if (grpSpan) grpSpan.textContent = '';
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(_sprachTag()) + ' ' + d.toLocaleTimeString(_sprachTag(), {hour:'2-digit',minute:'2-digit'});
}



function saveToProject(id) {
  const meta = getProjMeta();
  const entry = meta.find(m => m.id === id);
  if (!entry) return;
  const ergebnis = _schreibeBerechnung(id, getProjectState(), entry.name);
  if (!ergebnis) return false;
  entry.updatedAt = new Date().toISOString();
  try { saveProjMeta(meta); } catch (e) { /* nur Zeitstempel — Daten sind gespeichert */ }
  currentProjectId = id;
  renderProjectList();
  updateProjectBadge();
  return ergebnis;
}

async function totalReset() {
  if (!await frageBestaetigung(t('msg.reset.frage'), { ok: t('rf.zuruecksetzen') })) return;
  currentProjectId = null;
  window.location.href = window.location.pathname;
}

function quickSave() {
  if (currentProjectId) {
    // Grüne Rückmeldung nur, wenn wirklich gespeichert wurde
    if (!saveToProject(currentProjectId)) return;
    const btn = document.getElementById('quick-save-btn');
    if (btn) {
      btn.style.color = 'var(--ok)';
      btn.title = t('msg.gespeichert');
      setTimeout(() => {
        btn.style.color = '';
        btn.title = t('ui.speichern');
      }, 1800);
    }
  } else {
    openProjectsModal();
  }
}

function loadProjectById(id) {
  try {
    const raw = localStorage.getItem(PROJ_KEY_PREFIX + id);
    if (!raw) return;
    const state = JSON.parse(raw);
    // Bei abgelehntem oder zurückgenommenem Zustand nicht als aktives Projekt
    // markieren und das Fenster offen lassen — setProjectState() hat gemeldet.
    if (!setProjectState(state)) return;
    currentProjectId = id;
    updateProjectBadge();
    // Letzten Ladeort merken (Elterngruppe der Berechnung)
    const meta = getProjMeta();
    const entry = meta.find(m => m.id === id);
    if (entry?.parentId) _setLastGrpId(entry.parentId);
    closeProjectsModal();
  } catch(e) { meldung(t('msg.ladefehler') + ': ' + e.message, 'fehler'); }
}

async function deleteProjectById(id) {
  const meta = getProjMeta();
  const entry = meta.find(m => m.id === id);
  if (!entry) return;
  if (entry.isGroup) {
    const children = meta.filter(m => m.parentId === id);
    const msg = children.length > 0
      ? t('msg.gruppe.loeschen.n').replace('{name}', entry.name).replace('{n}', children.length)
      : t('msg.gruppe.loeschen').replace('{name}', entry.name);
    if (!await frageBestaetigung(msg, { ok: t('rf.loeschen') })) return;
    children.forEach(c => {
      localStorage.removeItem(PROJ_KEY_PREFIX + c.id);
      selectedIds.delete(c.id);
      if (currentProjectId === c.id) currentProjectId = null;
    });
    saveProjMeta(meta.filter(m => m.id !== id && m.parentId !== id));
  } else {
    if (!await frageBestaetigung(t('msg.berechnung.loeschen').replace('{name}', entry.name),
                                 { ok: t('rf.loeschen') })) return;
    saveProjMeta(meta.filter(m => m.id !== id));
    localStorage.removeItem(PROJ_KEY_PREFIX + id);
    selectedIds.delete(id);
    if (currentProjectId === id) currentProjectId = null;
  }
  renderProjectList();
  updateProjectBadge();
}

function moveToGroup(calcId, groupId) {
  const meta = getProjMeta();
  const entry = meta.find(m => m.id === calcId);
  if (!entry) return;
  entry.parentId = groupId || null;
  entry.updatedAt = new Date().toISOString();
  saveProjMeta(meta);
  renderProjectList();
}

function toggleGroupCollapse(id) {
  if (collapsedGroups.has(id)) collapsedGroups.delete(id);
  else collapsedGroups.add(id);
  renderProjectList();
}

function toggleSelectCalc(id) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  renderProjectList();
}

// Alle Berechnungen einer Gruppe gemeinsam an-/abwählen.
// Ersetzt eine früher als Zeichenkette zusammengebaute Inline-Funktion, die
// direkt auf selectedIds zugriff — das ginge mit dem gekapselten Zustand nicht
// mehr, da erzeugte Handler im globalen Geltungsbereich ausgewertet werden.
function toggleGroupSelect(childIds, alleGewaehlt) {
  childIds.forEach(id => alleGewaehlt ? selectedIds.delete(id) : selectedIds.add(id));
  renderProjectList();
}

async function batchDelete() {
  if (selectedIds.size === 0) return;
  const meta = getProjMeta();
  const names = [...selectedIds].map(id => meta.find(m => m.id === id)?.name).filter(Boolean);
  if (!await frageBestaetigung(
        t('msg.auswahl.loeschen').replace('{n}', selectedIds.size) + '\n' +
        names.slice(0,5).join('\n') + (names.length > 5 ? '\n…' : ''),
        { ok: t('rf.loeschen') })) return;
  [...selectedIds].forEach(id => {
    localStorage.removeItem(PROJ_KEY_PREFIX + id);
    if (currentProjectId === id) currentProjectId = null;
  });
  saveProjMeta(meta.filter(m => !selectedIds.has(m.id)));
  selectedIds.clear();
  renderProjectList();
  updateProjectBadge();
}

function batchJsonExport() {
  if (selectedIds.size === 0) return;
  const meta = getProjMeta();
  [...selectedIds].forEach(id => {
    const raw = localStorage.getItem(PROJ_KEY_PREFIX + id);
    if (!raw) return;
    const entry = meta.find(m => m.id === id);
    const name = entry?.name || id;
    const blob = new Blob([raw], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name.replace(/[^a-zA-Z0-9_\-]/g,'_') + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

async function batchPdfExport() {
  if (selectedIds.size === 0) return;
  const meta = getProjMeta();
  const ids = [...selectedIds];

  // Save original project ID to restore later
  const origId = currentProjectId;

  // Show progress indicator in modal
  const listEl = document.getElementById('proj-list-container');
  const origHtml = listEl ? listEl.innerHTML : '';
  if (listEl) listEl.innerHTML = `<div class="proj-empty" style="padding:2rem 0">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style="display:block;margin:0 auto .6rem;opacity:.4"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    PDF wird generiert… (${ids.length} Berechnung${ids.length>1?'en':''})</div>`;

  const sections = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const raw = localStorage.getItem(PROJ_KEY_PREFIX + id);
    if (!raw) continue;
    try {
      const state = JSON.parse(raw);
      const projName = meta.find(m => m.id === id)?.name || '';
      // Update progress
      if (listEl) { const pe = listEl.querySelector('.proj-empty'); if(pe) pe.textContent = `PDF wird generiert… ${i+1}/${ids.length}: ${projName}`; }
      // Load state (runs berechnen() internally)
      setProjectState(state);
      // Wait for canvas render
      await new Promise(r => setTimeout(r, 80));
      // Capture canvas
      const canvasImg = diagrammBildHell();
      // Build this section's HTML body content
      const sectionHtml = buildPdfSectionHtml(projName, canvasImg);
      sections.push(sectionHtml);
    } catch(e) { console.error('PDF gen error for', id, e); }
  }

  // Restore list
  if (listEl) listEl.innerHTML = origHtml;

  // Restore original project
  if (origId) {
    const origRaw = localStorage.getItem(PROJ_KEY_PREFIX + origId);
    if (origRaw) { try { setProjectState(JSON.parse(origRaw)); currentProjectId = origId;
                         updateProjectBadge(); }
                   catch(e) { _spur('Projekt/Wiederherstellen nach Export', e); } }
  }

  if (sections.length === 0) return;

  const combinedHtml = `<!DOCTYPE html><html lang="${currentLang}"><head><meta charset="utf-8">
<title>Serienbericht — Kettenwerk</title>
<style>${_pdfStil()}
  .pdf-section { page-break-after: always; }
  .pdf-section:last-child { page-break-after: avoid; }
</style></head><body>
${sections.map(s => `<div class="pdf-section">${s}</div>`).join('\n')}
</body></html>`;
  _druckfenster(combinedHtml);
}


// ── Datensicherheit ──────────────────────────────────────────────────────
// Die Berechnungen liegen nur im Speicher dieses Browsers. Darum:
//   · «Alles sichern»: alle Projekte, eigene Kettenwerke und Materialien in EINE Datei
//     (Einlesen über «JSON importieren» — vorhandene Einträge bleiben unverändert),
//   · der Browser wird gebeten, die Daten dauerhaft zu behalten (storage.persist),
//   · Erinnerung, wenn seit der ersten ungesicherten Änderung SICHERUNG_TAGE vergangen sind.
const SICHERUNG_TAGE = 14;
const SICHERUNG_KEY  = 'dh_letzte_sicherung';     // Zeitpunkt der letzten Komplettsicherung
const UNGESICHERT_KEY = 'dh_erste_ungesichert';   // erste Änderung seit dieser Sicherung
function _lsLies(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function _lsSchreib(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* privat */ } }
function _merkeAenderung() {
  if (!_lsLies(UNGESICHERT_KEY)) _lsSchreib(UNGESICHERT_KEY, String(Date.now()));
  _speicherDauerhaft();
}
// Browser bitten, die Daten nicht bei Platzmangel zu löschen (einmal genügt)
async function _speicherDauerhaft() {
  try {
    if (!navigator.storage?.persist || await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch (e) { _spur('Speicher/persist', e, 'debug'); return false; }
}
// Belegter Speicher dieser App (UTF-16, 2 Byte je Zeichen)
function _speicherBelegtMB() {
  let n = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } }
  catch (e) { return null; }
  return n * 2 / 1048576;
}
async function _speicherStatus() {
  const el = document.getElementById('speicher-status');
  if (!el) return;
  const mb = _speicherBelegtMB();
  let dauerhaft = false;
  try { dauerhaft = !!(await navigator.storage?.persisted?.()); } catch (e) { /* unbekannt */ }
  const letzte = +(_lsLies(SICHERUNG_KEY) || 0);
  const teile = [];
  if (mb !== null) teile.push(t('speicher.belegt').replace('{mb}', fN(mb, 1)));
  teile.push(t(dauerhaft ? 'speicher.dauerhaft' : 'speicher.fluechtig'));
  teile.push(letzte ? t('sich.zuletzt').replace('{d}', new Date(letzte).toLocaleDateString(currentLang === 'de' ? 'de-CH' : currentLang + '-CH'))
                    : t('sich.nie'));
  el.textContent = teile.join(' · ');
  el.classList.toggle('warn', mb !== null && mb > 4);
}
function sicherungExportieren() {
  const meta = getProjMeta();
  const projekte = {};
  meta.filter(m => !m.isGroup).forEach(m => {
    const raw = _lsLies(PROJ_KEY_PREFIX + m.id);
    if (raw) { try { projekte[m.id] = JSON.parse(raw); } catch (e) { _spur('Sicherung/Projekt lesen', e); } }
  });
  const lies = k => { try { return JSON.parse(_lsLies(k) || 'null'); } catch (e) { return null; } };
  const jetzt = new Date();
  const inhalt = JSON.stringify({ type: 'durchhang_sicherung', version: 1, erstellt: jetzt.toISOString(), app: APP_VERSION,
    meta, projekte, eigeneKettenwerke: lies(CUSTOM_KEY), eigeneMaterialien: lies(EL_MAT_KEY) }, null, 1);
  _dateiHerunterladen(inhalt, `durchhang_sicherung_${jetzt.toISOString().slice(0, 10)}.json`, 'application/json');
  _lsSchreib(SICHERUNG_KEY, String(Date.now()));
  _lsSchreib(UNGESICHERT_KEY, null);
  meldung(t('sich.ok').replace('{n}', Object.keys(projekte).length), 'info');
  _speicherStatus();
}
// Komplettsicherung einlesen: nur fehlende Einträge ergänzen (gleiche ID = schon vorhanden)
function _sicherungEinlesen(d) {
  const warUngesichert = _lsLies(UNGESICHERT_KEY);   // Einlesen selbst ist keine neue Änderung
  const meta = getProjMeta(), vorhanden = new Set(meta.map(m => m.id));
  const text = v => (typeof v === 'string' ? v : '');
  const neu = [], geschrieben = [], abgelehnt = [];
  let schon = 0;
  const liste = Array.isArray(d.meta) ? d.meta.filter(m => m && typeof m.id === 'string') : [];
  // Gruppen zuerst, damit Berechnungen ihre Gruppe finden
  for (const m of [...liste.filter(m => m.isGroup), ...liste.filter(m => !m.isGroup)]) {
    if (vorhanden.has(m.id)) { schon++; continue; }
    const eintrag = { id: m.id, name: text(m.name) || '?', isGroup: !!m.isGroup, parentId: typeof m.parentId === 'string' ? m.parentId : null,
                      createdAt: text(m.createdAt), updatedAt: text(m.updatedAt) };
    if (!m.isGroup) {
      const p = _pruefeProjektState(d.projekte?.[m.id]);
      if (!p.ok) { abgelehnt.push(eintrag.name); continue; }
      if (!_schreibeBerechnung(m.id, p.state, eintrag.name)) {
        geschrieben.forEach(id => localStorage.removeItem(PROJ_KEY_PREFIX + id));
        return;
      }
      geschrieben.push(m.id);
    }
    neu.push(eintrag); vorhanden.add(m.id);
  }
  if (!_speichereMetaOderRollback([...neu, ...meta], geschrieben)) return;
  // Eigene Kettenwerke / Materialien: fehlende ergänzen
  for (const [k, w] of [[CUSTOM_KEY, d.eigeneKettenwerke], [EL_MAT_KEY, d.eigeneMaterialien]]) {
    if (!Array.isArray(w) || !w.length) continue;
    let alt = []; try { alt = JSON.parse(_lsLies(k) || '[]'); } catch (e) { alt = []; }
    if (!Array.isArray(alt)) continue;
    const da = new Set(alt.map(x => JSON.stringify(x)));
    _lsSchreib(k, JSON.stringify([...alt, ...w.filter(x => !da.has(JSON.stringify(x)))]));
  }
  if (!warUngesichert) _lsSchreib(UNGESICHERT_KEY, null);
  renderProjectList();
  meldung(t('sich.eingelesen').replace('{n}', geschrieben.length).replace('{v}', schon), abgelehnt.length ? 'warnung' : 'info');
  if (abgelehnt.length) meldung(t('msg.projekt.ungueltig') + ':\n\u2022 ' + abgelehnt.join('\n\u2022 '), 'warnung');
}
// Erinnerung: höchstens einmal je App-Start
function _sicherungsErinnerung() {
  const erste = +(_lsLies(UNGESICHERT_KEY) || 0);
  if (!erste || !getProjMeta().some(m => !m.isGroup)) return;
  const tage = Math.floor((Date.now() - erste) / 864e5);
  if (tage < SICHERUNG_TAGE) return;
  const el = meldung(t('sich.erinnerung').replace('{d}', tage), 'info', 0);
  if (!el) return;
  const btn = document.createElement('button');
  btn.className = 'meldung-zu'; btn.type = 'button';
  btn.style.cssText = 'font-size:.75rem;text-decoration:underline;color:var(--primary)';
  btn.textContent = t('sich.jetzt');
  btn.onclick = () => { sicherungExportieren(); el.querySelector('.meldung-zu:last-child')?.click(); };
  el.insertBefore(btn, el.querySelector('.meldung-zu'));
}
setTimeout(_sicherungsErinnerung, 1500);

function exportProjectById(id) {
  const raw  = localStorage.getItem(PROJ_KEY_PREFIX + id);
  if (!raw) return;
  const meta = getProjMeta().find(m => m.id === id);
  const name = meta?.name || id;
  const blob = new Blob([raw], { type: 'application/json' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = name.replace(/[^a-zA-Z0-9_\-]/g,'_') + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportWholeProject(groupId) {
  const meta = getProjMeta();
  const group = meta.find(m => m.id === groupId);
  if (!group) return;
  const children = meta.filter(m => !m.isGroup && m.parentId === groupId);
  const calculations = children.map(m => {
    const raw = localStorage.getItem(PROJ_KEY_PREFIX + m.id);
    return { meta: m, state: raw ? JSON.parse(raw) : null };
  }).filter(c => c.state !== null);
  const payload = JSON.stringify({
    type: 'durchhang_project',
    version: 1,
    group,
    calculations
  }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = group.name.replace(/[^a-zA-Z0-9_\-]/g,'_') + '_projekt.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importProjectFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      const now  = new Date().toISOString();
      const meta = getProjMeta();

      // Komplettsicherung (Datei-Dialog «Alles sichern»)
      if (parsed.type === 'durchhang_sicherung') { _sicherungEinlesen(parsed); return; }

      // Whole-project format
      if (parsed.type === 'durchhang_project' && parsed.group && Array.isArray(parsed.calculations)) {
        const groupId = genProjId();
        // Nur bekannte Felder übernehmen — keine fremden Schlüssel aus der Datei
        meta.unshift({ id: groupId, name: String(parsed.group.name || nextProjectName()),
                       isGroup: true, parentId: null, createdAt: now, updatedAt: now });
        const abgelehnt = [];
        const geschrieben = [];
        for (const c of [...parsed.calculations].reverse()) {
          const cname = String((c && c.meta && c.meta.name) || '?');
          const p = _pruefeProjektState(c && c.state);
          if (!p.ok) { abgelehnt.push(cname); continue; }
          const calcId = genProjId();
          if (!_schreibeBerechnung(calcId, p.state, cname)) {
            // Speicher voll — bereits Geschriebenes zurücknehmen, nichts halb importieren
            geschrieben.forEach(id => localStorage.removeItem(PROJ_KEY_PREFIX + id));
            return;
          }
          geschrieben.push(calcId);
          meta.unshift({ id: calcId, name: cname, parentId: groupId, createdAt: now, updatedAt: now, isGroup: false });
        }
        if (!_speichereMetaOderRollback(meta, geschrieben)) return;
        renderProjectList();
        if (abgelehnt.length)
          meldung(t('msg.projekt.ungueltig') + ':\n\u2022 ' + abgelehnt.join('\n\u2022 '), 'warnung');
        return;
      }

      // Single calculation format (legacy)
      const einzel = _pruefeProjektState(parsed);
      if (!einzel.ok) { meldung(t('msg.projekt.ungueltig') + ':\n' + einzel.fehler, 'fehler'); return; }
      const name = String(parsed.name || file.name.replace(/\.json$/i, ''));
      const id   = genProjId();
      if (!_schreibeBerechnung(id, einzel.state, name)) return;
      meta.unshift({ id, name, createdAt: now, updatedAt: now });
      if (!_speichereMetaOderRollback(meta, [id])) return;
      renderProjectList();
    } catch(err) { meldung(t('msg.json.ungueltig') + ': ' + err.message, 'fehler'); }
  };
  reader.readAsText(file);
  input.value = '';
}

// ── Modal ──
const _penSvg = `<svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="vertical-align:-.08em"><path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

function renderProjectList() {
  const container = document.getElementById('proj-list-container');
  if (!container) return;
  const meta = getProjMeta();

  const groups = meta.filter(m => m.isGroup);

  if (!meta.length) {
    container.innerHTML = `<div class="proj-empty">${t('msg.keine.eintraege')}</div>`;
    return;
  }

  // Sort helper
  const sortFn = (a, b) => {
    if (projSortMode === 'name_asc')  return a.name.localeCompare(b.name, 'de');
    if (projSortMode === 'name_desc') return b.name.localeCompare(a.name, 'de');
    if (projSortMode === 'date_asc')  return new Date(a.updatedAt) - new Date(b.updatedAt);
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  };

  // Sort bar
  const sortBar = `<div class="proj-sort-bar">
    <span class="proj-sort-lbl">${t('ui.sortierung')}</span>
    <button class="proj-sort-btn${projSortMode==='date_desc'?' active':''}" onclick="setProjSort('date_desc')">${t('ui.datum.ab')}</button>
    <button class="proj-sort-btn${projSortMode==='date_asc'?' active':''}" onclick="setProjSort('date_asc')">${t('ui.datum.auf')}</button>
    <button class="proj-sort-btn${projSortMode==='name_asc'?' active':''}" onclick="setProjSort('name_asc')">${t('ui.name.az')}</button>
    <button class="proj-sort-btn${projSortMode==='name_desc'?' active':''}" onclick="setProjSort('name_desc')">${t('ui.name.za')}</button>
  </div>`;

  // Helper: render a calc item row (child or ungrouped)
  const calcRow = (m, isChild) => {
    const isActive = m.id === currentProjectId;
    const checked = selectedIds.has(m.id);
    const childCls = isChild ? 'proj-child-item' : '';
    const moveOptions = groups.length > 0
      ? `<select class="proj-move-sel" title="${t('ui.zu.projekt.titel')}" aria-label="${escHtml(t('ui.zu.projekt.titel'))}"
           onchange="moveToGroup('${m.id}',this.value);this.value=''"
           onclick="event.stopPropagation()">
           <option value="">${t('ui.zu.projekt')}</option>
           ${groups.filter(g => g.id !== m.parentId).map(g => `<option value="${escHtml(g.id)}">${escHtml(g.name)}</option>`).join('')}
         </select>` : '';
    return `<div class="proj-item ${childCls}${isActive ? ' active-proj' : ''}">
      <div class="proj-item-top">
        <input type="checkbox" class="proj-check auswahl" aria-label="${escHtml(m.name)}" ${checked ? 'checked' : ''}
          onclick="event.stopPropagation();toggleSelectCalc('${m.id}')">
        <div class="proj-item-info">
          <div class="proj-item-name" title="${escHtml(m.name)}">${escHtml(m.name)}${isActive ? ' ✓' : ''}</div>
          <button class="proj-rename-btn" onclick="renameEntry('${m.id}')" title="${t('ui.umbenennen')}">${_penSvg}</button>
        </div>
      </div>
      <div class="proj-item-bottom">
        <div class="proj-item-date">${t('ui.gespeichert.am')} ${fmtDate(m.updatedAt)}</div>
        <div class="proj-item-actions">
          <button class="proj-btn pri" onclick="loadProjectById('${m.id}')">${t('ui.laden')}</button>
          <button class="proj-btn" onclick="exportProjectById('${m.id}')">${t('ui.export')}</button>
          ${moveOptions}
          <button class="proj-btn danger icon-only" onclick="deleteProjectById('${m.id}')" title="${t('ui.loeschen')}"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>
    </div>`;
  };

  // Render groups (sorted)
  const sortedGroups = [...groups].sort(sortFn);
  const groupHtml = sortedGroups.map(g => {
    const children = [...meta.filter(m => m.parentId === g.id && !m.isGroup)].sort(sortFn);
    const collapsed = collapsedGroups.has(g.id);
    const hasActive = children.some(c => c.id === currentProjectId);
    const childrenHtml = children.map(c => calcRow(c, true)).join('');

    const toggleFn = `toggleGroupCollapse('${g.id}')`;
    const childIds = children.map(c => c.id);

    return `<div class="proj-group-wrap${hasActive ? ' has-active' : ''}" data-grp-id="${g.id}">
      <div class="proj-group-header" onclick="${toggleFn}">
        <span class="proj-collapse-icon" style="transform:rotate(${collapsed ? '0' : '90'}deg)">▶</span>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;color:var(--muted)"><path d="M1.5 4.5A1.5 1.5 0 013 3h3.586a1 1 0 01.707.293l.914.914H13A1.5 1.5 0 0114.5 5.5v6A1.5 1.5 0 0113 13H3a1.5 1.5 0 01-1.5-1.5v-7z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
        <span class="proj-group-name">${escHtml(g.name)}</span>
        <span class="proj-group-date">${fmtDate(g.updatedAt)}</span>
        <span class="proj-group-count">${children.length} ${t(children.length === 1 ? 'ui.berechnung.1' : 'ui.berechnung.n')}</span>
        <div class="proj-item-actions" style="flex-wrap:nowrap" onclick="event.stopPropagation()">
          <button class="proj-rename-btn" onclick="renameEntry('${g.id}')" title="${t('ui.projekt.umbenennen')}">${_penSvg}</button>
          <button class="proj-btn" onclick="exportWholeProject('${g.id}')" title="${t('ui.projekt.export.titel')}">${t('ui.export')}</button>
          <button class="proj-btn danger icon-only" onclick="deleteProjectById('${g.id}')" title="${t('ui.loeschen')}"><svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V2.5h4V4M5 4l.5 9h5L11 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>
      </div>
      ${!collapsed && children.length > 0 ? `<div class="proj-group-children">${childrenHtml}</div>` : ''}
      ${!collapsed && children.length === 0 ? `<div style="padding:.4rem 1.5rem .5rem;font-size:.72rem;color:var(--muted);font-style:italic">${t('msg.keine.berechnungen')}</div>` : ''}
    </div>`;
  }).join('');

  // Ungrouped calcs (sorted)
  const ungrouped = [...meta.filter(m => !m.isGroup && !m.parentId)].sort(sortFn);
  const ungroupedHtml = ungrouped.map(m => calcRow(m, false)).join('');

  // Bulk bar
  const bulkBar = selectedIds.size > 0 ? `
    <div class="proj-bulk-bar">
      <span class="proj-bulk-label">${selectedIds.size} ${t('ui.ausgewaehlt')}</span>
      <button class="proj-btn bulk" onclick="batchPdfExport()">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style="vertical-align:-.1em;margin-right:.2rem"><path d="M3 12h10M8 3v7m0 0L5 7m3 3 3-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
        ${t('ui.pdf.serie')}
      </button>
      <button class="proj-btn bulk" onclick="batchJsonExport()">${t('ui.json.export')}</button>
      <button class="proj-btn bulk danger" onclick="batchDelete()">${t('ui.loeschen')}</button>
    </div>` : '';

  container.innerHTML = sortBar + bulkBar +
    (groupHtml ? `<div style="display:flex;flex-direction:column;gap:.4rem">${groupHtml}</div>` : '') +
    (groupHtml && ungroupedHtml ? '<div style="font-size:.68rem;color:var(--muted);margin:.5rem 0 .2rem;padding-left:.1rem">Ohne Projekt</div>' : '') +
    (ungroupedHtml ? `<div style="display:flex;flex-direction:column;gap:.35rem">${ungroupedHtml}</div>` : '');
}

function openProjectsModal() {
  selectedIds.clear();
  _speicherStatus();
  // Letzten Ladeort expandieren (nicht zuklappen)
  let lastGrp = null;
  try { lastGrp = _getLastGrpId(); } catch(e) { _spur('Projekt/Letzte Gruppe', e, 'debug'); }
  if (lastGrp) collapsedGroups.delete(lastGrp);
  renderProjectList();
  // Speicherort-Dropdown befüllen + Calc-Name leeren
  try { populateSaveGroupSel(); } catch(e) { console.warn('populateSaveGroupSel:', e); }
  const calcInp = document.getElementById('proj-calc-name');
  if (calcInp) calcInp.value = '';
  document.getElementById('projects-modal').classList.add('open');
  // Letztes Projekt sichtbar scrollen
  if (lastGrp) {
    setTimeout(() => {
      const el = document.querySelector(`[data-grp-id="${lastGrp}"]`);
      if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
  }
}
function closeProjectsModal() { document.getElementById('projects-modal').classList.remove('open'); }

// ── Öffentliche Schnittstelle ──
// Alles Übrige bleibt modulintern.
return {
    saveCurrentCalc,
    quickSave,
    totalReset,
    openProjectsModal,
    closeProjectsModal,
    onProjGroupSelChange,
    importProjectFile,
    batchDelete,
    batchJsonExport,
    deleteProjectById,
    exportProjectById,
    exportWholeProject,
    loadProjectById,
    moveToGroup,
    renameEntry,
    setProjSort,
    toggleSelectCalc,
    toggleGroupCollapse,
    toggleGroupSelect,
    renderProjectList,
    getProjMeta,
    getProjectState,
    setProjectState,
    sicherungExportieren,
    _sicherungsErinnerung,
    _speicherStatus,
    // Lesender Zugriff auf die laufende Projekt-ID (extern nur gelesen)
    get aktuelleProjektId() { return currentProjectId; }
};
})();

// HTML-Handler (statisch wie erzeugt) werden im globalen Geltungsbereich
// ausgewertet — die davon aufgerufenen Namen müssen dort erreichbar sein.
window.saveCurrentCalc = Projekte.saveCurrentCalc;
window.quickSave = Projekte.quickSave;
window.totalReset = Projekte.totalReset;
window.openProjectsModal = Projekte.openProjectsModal;
window.closeProjectsModal = Projekte.closeProjectsModal;
window.onProjGroupSelChange = Projekte.onProjGroupSelChange;
window.importProjectFile = Projekte.importProjectFile;
window.batchDelete = Projekte.batchDelete;
window.batchJsonExport = Projekte.batchJsonExport;
window.sicherungExportieren = Projekte.sicherungExportieren;
window._sicherungsErinnerung = Projekte._sicherungsErinnerung;
window._speicherStatus = Projekte._speicherStatus;
window.deleteProjectById = Projekte.deleteProjectById;
window.toggleGroupCollapse = Projekte.toggleGroupCollapse;
window.toggleGroupSelect = Projekte.toggleGroupSelect;
window.renderProjectList = Projekte.renderProjectList;
window.exportProjectById = Projekte.exportProjectById;
window.exportWholeProject = Projekte.exportWholeProject;
window.loadProjectById = Projekte.loadProjectById;
window.moveToGroup = Projekte.moveToGroup;
window.renameEntry = Projekte.renameEntry;
window.setProjSort = Projekte.setProjSort;
window.toggleSelectCalc = Projekte.toggleSelectCalc;
// Von anderem Programmteil benutzt:
const getProjMeta = Projekte.getProjMeta;
const getProjectState = Projekte.getProjectState;
const setProjectState = Projekte.setProjectState;


// ── T1-abhängige H_Ts_ub-Berechnung aus Reglagetabelle ──────────────────────
// Lineares Interpolieren zwischen Tabellenstützpunkten; ausserhalb klemmen.
function updateH_Ts_ubFromT1() {
  if (!activePresetRef || !activePresetRef.H_Ts_ub_table) return;
  if (_hFromFoto) return; // Foto-H schützen — T₁-Änderung darf es nicht überschreiben
  if (_hVonHand && sysMode === 'el') return; // Handwert schützen (Einzelleiter)
  const T1 = parseFloat(document.getElementById('temp1').value);
  if (isNaN(T1)) return;
  const { temps, vals } = activePresetRef.H_Ts_ub_table;

  const n = temps.length;
  let H_new = null;
  if (T1 <= temps[0]) {
    H_new = vals[0];
  } else if (T1 >= temps[n - 1]) {
    // Lineare Extrapolation für T > Tabellenende (bis 80°C)
    const slope = (vals[n - 1] - vals[n - 2]) / (temps[n - 1] - temps[n - 2]);
    H_new = Math.max(100, Math.round(vals[n - 1] + slope * (T1 - temps[n - 1])));
  } else {
    for (let i = 0; i < n - 1; i++) {
      if (T1 >= temps[i] && T1 <= temps[i + 1]) {
        const frac = (T1 - temps[i]) / (temps[i + 1] - temps[i]);
        H_new = Math.round(vals[i] + frac * (vals[i + 1] - vals[i]));
        break;
      }
    }
  }

  if (H_new !== null) {
    _tensionAutoFilling = true;
    document.getElementById('tension').value = H_new;
    _tensionAutoFilling = false;
    refreshPresetNote(); // Infobox-Note mit aktuellem T1 / H_Ts_ub aktualisieren
    if (elReglageOpen) renderReglageEditPanel(); // T1-Markierung in Tabelle aktualisieren
    // H kommt jetzt aus Reglage → Foto-Override-Indikator zurücksetzen
    if (_hFromFoto) _updateTensionFotoState(false);
    _updateTensionResetBtn();
    _updateTensionDelta();
  }
}

// ═══════════════════════════════════════════════════════════════
// REGLAGETABELLE — editierbare Referenzparameter (Einzelleiter)
// ═══════════════════════════════════════════════════════════════
let elReglageHmaxOvr = null;   // H bei −20 °C, Benutzer-Override
let elReglageLrefOvr = null;   // L Referenzspannweite, Benutzer-Override
let elReglageOpen    = false;  // Edit-Panel geöffnet
// Berechnungsart nach SBB-Dok. 0161.1013.0005.1 — gilt für Einzelleiter und N-FL
// (Name historisch «el…»). R-FL hat konstante Zugkraft, dort entfällt die Wahl.
//   Ausgleichend: Zugkraft mit Mittelspannweite c_m (Excel: Eingabe «c_m»)
//   Starr:        Zugkraft mit Projektspannweite c_proj des Feldes (Excel: «c_proj»),
//                 Mittelspannweite gesperrt; beim Einzelleiter zusätzlich L_ref = 25 m
let elBerechnungsart = 'ausgleichend'; // 'ausgleichend' | 'starr'

function _berechnungsartUI() {
  const art = elBerechnungsart;
  document.getElementById('seg-ba-ausg')?.classList.toggle('active', art === 'ausgleichend');
  document.getElementById('seg-ba-starr')?.classList.toggle('active', art === 'starr');
  const hint = document.getElementById('ba-hint');
  if (hint) hint.textContent = t(art === 'starr' ? 'par.ba.hint.starr' : 'par.ba.hint.ausg');
}

function setBerechnungsart(art) {
  elBerechnungsart = art;
  _berechnungsartUI();
  // Starr = nur Einzelspannweite (keine Mittelspannweite)
  const segRuling = document.getElementById('seg-ruling');
  zeigeElement(segRuling, !(art === 'starr'));
  if (art === 'starr' && spanMode === 'ruling') setSpanMode('single');
  if (sysMode === 'el') {
    // Manuelle L_ref-Overrides verwerfen (Reglage Einzelleiter)
    elReglageLrefOvr = null;
    _applyReglageOvr();
  } else if (sysMode === 'nfl' && activePresetP) {
    // N-FL: Montagezugkraft aus Normal- bzw. Starr-Reglagetabelle — nur wenn der
    // Wert noch aus der Tabelle stammt (kein manueller Wert, keine Foto-Aufnahme)
    const rg = _presetReglage(activePresetP);
    if (activePresetRef && rg.H_Ts_ub_table) {
      activePresetRef = { H_Ts_ub_table: rg.H_Ts_ub_table };
      updateH_Ts_ubFromT1();
    }
    const noteEl = document.getElementById('combo-note');
    if (noteEl) noteEl.textContent = buildPresetNote(activePresetP,
      parseInt(document.getElementById('tension').value), parseFloat(document.getElementById('temp1').value));
  }
  berechnen();
}
let _elMatEdits  = {};     // { 'cu95': { H_max: 6000, L_ref: 45 }, ... } — modal overrides
let _rglElEditMode = false; // Bearbeiten-Modus im Modal

// Gibt { mat, variant, tbl, H_max, L_ref } für die aktive Selektion zurück.
// tbl ist nur gesetzt wenn kein Override aktiv (dann werden Tabellenwerte direkt verwendet).
function _reglageBase() {
  const sel = document.getElementById('el-material-select')?.value;
  const mat = sel ? MATERIALS[sel] : null;
  if (!mat) return { mat: null, variant: null, tbl: null, H_max: null, L_ref: 45 };
  const variant = mat.H_reglage_variants ? mat.H_reglage_variants[elBasiskraftIdx] : mat;
  const rawTbl  = variant?.H_reglage_table ?? mat.H_reglage_table ?? null;
  // Starr-Berechnungsart erzwingt L_ref=25 → Raw-Tabelle (bei Materiall-Lref) nicht verwenden
  const useRaw  = rawTbl && elReglageHmaxOvr === null && elReglageLrefOvr === null && elBerechnungsart !== 'starr';
  const matKey  = sel + (mat.H_reglage_variants && mat.H_reglage_variants.length > 1 ? '_' + elBasiskraftIdx : '');
  const matEdit = _elMatEdits[matKey];
  const H_max   = elReglageHmaxOvr ?? matEdit?.H_max ?? (rawTbl ? rawTbl.vals[0] : 6000);
  const lrefStarr = elBerechnungsart === 'starr' ? 25 : null;
  const L_ref   = elReglageLrefOvr ?? lrefStarr ?? matEdit?.L_ref ?? (variant?.L_ref ?? mat.L_ref ?? 45);
  return { mat, variant, tbl: useRaw ? rawTbl : null, H_max, L_ref };
}

// Titel der Einzelleiter-Reglagebox. Muss nach jeder Änderung an der
// Referenzspannweite neu gerendert werden (Material, Basiskraft, Berechnungsart).
// Bei abweichendem L_ref — Berechnungsart «Starr» erzwingt 25 m statt 45 m — ist der
// tabellierte H_reglage nicht mehr massgebend und wird passend zu L_ref hergeleitet.
function _renderReglageTitle() { _elReglageBoxAktualisieren(); }

// Einzelleiter-Infobox: Bezugswert bei +10 °C aus derselben Tabelle, mit der gerechnet
// wird (SBB-Tabelle oder hergeleitet und auf 100 N gerundet) — dadurch passen Box,
// Reglagetabelle und H-Feld bei T₁ = +10 °C immer zusammen. Läuft bei jeder Rechnung.
function _elReglageBoxAktualisieren() {
  if (sysMode !== 'el') return;
  const titel = document.getElementById('el-reglage-title');
  const notiz = document.getElementById('el-reglage-note');
  if (!titel || !notiz) return;
  const { mat, variant, L_ref } = _reglageBase();
  const H10 = _tabelleBeiT(activePresetRef?.H_Ts_ub_table, 10);
  titel.innerHTML = `${t('ui.reglage.bei')} +10 °C: H = ${H10 ? Math.round(H10).toLocaleString('de-CH') : '—'} N  (Lm = ${L_ref} m)`;
  const schl = document.getElementById('el-material-select')?.value + (mat?.H_reglage_variants?.length > 1 ? '_' + elBasiskraftIdx : '');
  if (mat && _rglIstAngepasst(schl)) { notiz.textContent = t('ui.reglage.angepasst.box'); return; }
  notiz.textContent = !mat ? '' : (variant?.H_reglage != null)
    ? (variant.reglage_note_key ? t(variant.reglage_note_key) : (variant.reglage_note || ''))
    : t('mat.rn.6kn.vorgabe');
}

// Hergeleitete Reglagewerte werden wie die SBB-Reglagetabellen auf 100 N gerundet —
// überall gleich (Feld, Infobox, Tabelle, Export). 0 = kein Wert.
function _rundeReglage(H) { return (H != null && isFinite(H) && H > 0) ? Math.round(H / 100) * 100 : 0; }

// Berechnet H bei Temperatur T, ausgehend von H_max bei −20 °C
function _reglageH(mat, H_max, L_ref, T) {
  if (!H_max || !mat.E || !mat.AK) return null;
  const dT = T - (-20);
  if (dT === 0) return H_max;
  try { return solveStateEq(mat.q, L_ref, H_max, mat.E * mat.AK, mat.alpha, dT); }
  catch (e) { return null; }
}

// Rendert den Inhalt des Edit-Panels
function renderReglageEditPanel() {
  const panel = document.getElementById('el-reglage-edit-panel');
  if (!panel) return;
  const { mat, tbl, H_max, L_ref } = _reglageBase();
  if (!mat) { panel.innerHTML = ''; return; }

  const temps    = [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40,45,50,55,60,65,70,75,80];
  const canCalc  = H_max && mat.E && mat.AK;
  const T1cur    = parseFloat(document.getElementById('temp1')?.value) ?? 10;

  // Tabelle aufbauen
  let rows = '';
  if (canCalc) {
    for (const T of temps) {
      let H = null;
      if (tbl) {
        const i = tbl.temps.indexOf(T);
        if (i >= 0) {
          H = tbl.vals[i];
        } else if (T > tbl.temps[tbl.temps.length - 1]) {
          // Lineare Extrapolation für T > Tabellenende
          const nn = tbl.temps.length;
          const slope = (tbl.vals[nn-1] - tbl.vals[nn-2]) / (tbl.temps[nn-1] - tbl.temps[nn-2]);
          H = Math.max(100, tbl.vals[nn-1] + slope * (T - tbl.temps[nn-1]));
        } else {
          for (let j = 0; j < tbl.temps.length - 1; j++) {
            if (T > tbl.temps[j] && T < tbl.temps[j+1]) {
              const fr = (T - tbl.temps[j]) / (tbl.temps[j+1] - tbl.temps[j]);
              H = tbl.vals[j] + fr * (tbl.vals[j+1] - tbl.vals[j]);
              break;
            }
          }
        }
      } else if (activePresetRef?.H_Ts_ub_table) {
        H = _tabelleBeiT(activePresetRef.H_Ts_ub_table, T);   // genau die Werte der Rechnung
      } else {
        H = _rundeReglage(_reglageH(mat, H_max, L_ref, T)) || null;
      }
      const Hr = H !== null ? Math.round(H) : null;
      const f  = H !== null ? mat.q * L_ref * L_ref / (8 * H) : null;
      const isT1 = Math.abs(T - T1cur) < 0.01;
      rows += `<tr class="${isT1 ? 'rtbl-t1' : ''}">
        <td>${T > 0 ? '+' : ''}${T} °C</td>
        <td>${Hr !== null ? Hr.toLocaleString('de-CH') : '—'}</td>
        <td>${f !== null ? f.toFixed(2) : '—'}</td>
      </tr>`;
    }
  }

  panel.innerHTML = canCalc
    ? `<table class="rtbl">
        <thead><tr>
          <th>T</th><th>H [N]</th>
          <th>f [m] <span style="font-weight:400;opacity:.6">(L = ${L_ref} m)</span></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
    : `<p style="font-size:.67rem;color:var(--muted);margin:.35rem 0 0">Kein Reglagewert verfügbar.</p>`;
}

// Übernimmt Override in activePresetRef → aktualisiert Zugkraft + Diagramm
function _applyReglageOvr() {
  _hVonHand = false;   // Reglage geändert (Werte/Berechnungsart) → Handwert verwerfen
  const { mat, tbl, H_max, L_ref } = _reglageBase();
  if (tbl) {
    // Ohne Override und ausserhalb der Berechnungsart «Starr» ist die
    // Reglagetabelle nach SBB 0161.1013.0001 massgebend — nicht neu herleiten.
    activePresetRef = { H_Ts_ub_table: tbl };
    updateH_Ts_ubFromT1();
  } else if (mat && H_max && mat.E && mat.AK) {
    // Override aktiv oder «Starr» (L_ref = 25 m): Werte aus H_max herleiten und wie
    // die Reglagetabellen auf 100 N runden (bei Starr ergeben sich so exakt die Werte
    // der Tabelle SBB 0161.1013.0003).
    const temps = [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40];
    const vals  = temps.map(T => _rundeReglage(_reglageH(mat, H_max, L_ref, T)));
    activePresetRef = { H_Ts_ub_table: { temps, vals } };
    updateH_Ts_ubFromT1();
  }
  _elReglageBoxAktualisieren();   // L_ref kann sich geändert haben (z.B. Berechnungsart)
  renderReglageEditPanel();
  berechnen();
}

function toggleReglageEdit() {
  // Ist die Box zugeklappt, öffnet «i» sie samt Tabelle (statt unsichtbar umzuschalten)
  const box = document.getElementById('el-reglage-info');
  if (box && !box.open) { box.open = true; elReglageOpen = false; }
  elReglageOpen = !elReglageOpen;
  const panel = document.getElementById('el-reglage-edit-panel');
  zeigeElement(panel, elReglageOpen);
  if (elReglageOpen) renderReglageEditPanel();
}

// ── Hilfsfunktion: effektiver H_max und L_ref für ein Material/Variante ──────
function _effHmax(mat, variant) {
  const key = mat._key + (variant && variant !== mat ? ('_' + mat.H_reglage_variants.indexOf(variant)) : '');
  if (_elMatEdits[key]?.H_max != null) return _elMatEdits[key].H_max;
  const tbl = variant?.H_reglage_table ?? mat.H_reglage_table;
  return tbl ? tbl.vals[0] : (variant?.H_reglage ?? mat.H_reglage ?? 6000);
}
function _effLref(mat, variant) {
  const key = mat._key + (variant && variant !== mat ? ('_' + mat.H_reglage_variants.indexOf(variant)) : '');
  if (_elMatEdits[key]?.L_ref != null) return _elMatEdits[key].L_ref;
  return variant?.L_ref ?? mat.L_ref ?? 45;
}

// ── Rendert die dynamische Einzelleiter-Tabelle im Modal ──────────────────────
function renderReglageElTable() {
  const wrap = document.getElementById('rgl-el-wrap');
  if (!wrap) return;
  const irgendwas = Object.keys(_reglageAngepasst).length > 0;
  zeigeElement(document.getElementById('rgl-el-sbb-btn'), irgendwas);
  const note = document.getElementById('rgl-el-note');
  if (note) note.innerHTML = t('ui.rgl.el.note') + (irgendwas ? `<br><span class="rgl-angepasst-hw">${t('ui.rgl.angepasst.hw')}</span>` : '');
  const em = _rglElEditMode;

  // Alle Materialien mit ihren Varianten als Zeilen sammeln
  const rows = [];
  for (const [key, mat] of Object.entries(MATERIALS)) {
    mat._key = key; // für Key-Zugriff in _effHmax/_effLref
    const variants = mat.H_reglage_variants;
    if (variants && variants.length > 1) {
      variants.forEach((v, vi) => {
        const editKey = key + '_' + vi;
        const Hmax = _effHmax(mat, v);
        const Lref = _effLref(mat, v);
        const H10  = _reglageHAt10(mat, v, Hmax, Lref);
        rows.push({ key: editKey, name: mat.name, label: v.label, Hmax, Lref, H10,
          note: v.reglage_note ?? '', hasPreset: v.H_reglage != null });
      });
    } else {
      const editKey = key;
      const Hmax = _effHmax(mat, mat);
      const Lref = _effLref(mat, mat);
      const H10  = _reglageHAt10(mat, mat, Hmax, Lref);
      rows.push({ key: editKey, name: mat.name, label: null, Hmax, Lref, H10,
        note: mat.reglage_note ?? '', hasPreset: mat.H_reglage != null });
    }
  }

  const colNote = em ? '' : '<col style="width:28%">';
  const thNote  = em ? '' : `<th class="c-left">${t('ui.anmerkung')}</th>`;

  let tBody = '';
  for (const r of rows) {
    const hVal  = r.Hmax != null ? r.Hmax.toLocaleString('de-CH') + ' N' : '—';
    const h10Val= r.H10  != null ? Math.round(r.H10).toLocaleString('de-CH') + ' N' : '—';
    const lVal  = r.Lref;
    const nameCell = r.label
      ? `${escHtml(r.name)} <span style="color:var(--tertiary);font-size:.7rem">· ${escHtml(r.label)}</span>`
      : escHtml(r.name);
    const preset = r.hasPreset ? '' : ` <span style="color:var(--tertiary);font-size:.65rem">${t('ui.voreinst')}</span>`;
    const angepasst = _rglIstAngepasst(r.key) ? ` <span class="rgl-angepasst">${t('ui.rgl.angepasst')}</span>` : '';

    if (em) {
      tBody += `<tr>
        <td class="c-left">${nameCell}${angepasst}</td>
        <td class="c-right"><input type="number" step="100" min="100" value="${r.Hmax ?? 6000}"
          style="width:5rem;border:1px solid var(--border2);border-radius:5px;padding:.1rem .25rem;font-size:.71rem;text-align:right;font-family:inherit"
          oninput="_rglEditEingabe('${r.key}', 'H_max', this.value)"> N</td>
        <td class="c-right"><input type="number" step="1" min="1" max="300" value="${r.Lref}"
          style="width:3.5rem;border:1px solid var(--border2);border-radius:5px;padding:.1rem .25rem;font-size:.71rem;text-align:right;font-family:inherit"
          oninput="_rglEditEingabe('${r.key}', 'L_ref', this.value)"> m</td>
        <td class="c-right" style="color:var(--muted)" data-h10="${r.key}">${h10Val}</td>
      </tr>`;
    } else {
      const tdNote = `<td class="c-left" style="color:var(--muted);font-size:.71rem">${r.note}</td>`;
      tBody += `<tr>
        <td class="c-left">${nameCell}${angepasst}</td>
        <td class="c-right">${hVal}${preset}</td>
        <td class="c-right" style="color:var(--muted)">${h10Val}</td>
        <td class="c-ctr" style="color:var(--muted)">${lVal} m</td>
        ${tdNote}
      </tr>`;
    }
  }

  if (em) {
    wrap.innerHTML = `<table class="rgl-tbl" style="min-width:460px">
      <colgroup><col style="width:30%"><col style="width:22%"><col style="width:16%"><col style="width:20%"></colgroup>
      <thead><tr>
        <th class="c-left">${t('ui.material')}</th>
        <th class="c-right">H (−20 °C)</th>
        <th class="c-right">L ref</th>
        <th class="c-right">H (+10 °C) <span style="font-weight:400;font-size:.65rem">${t('ui.berechnet')}</span></th>
      </tr></thead>
      <tbody>${tBody}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;gap:.5rem;margin-top:.6rem">
      <button type="button" class="rgl-knopf" onclick="_resetElMatEdits()">${t('ui.reset')}</button>
      <button type="button" class="rgl-knopf rgl-knopf-pri" onclick="_applyElMatEdits()">${t('lf.uebernehmen')}</button>
    </div>`;
  } else {
    wrap.innerHTML = `<table class="rgl-tbl" style="min-width:460px">
      <colgroup><col style="width:28%"><col style="width:16%"><col style="width:16%"><col style="width:12%">${colNote}</colgroup>
      <thead><tr>
        <th class="c-left">${t('ui.material')}</th>
        <th class="c-right">H (−20 °C)</th>
        <th class="c-right">H (+10 °C)</th>
        <th class="c-ctr">L ref</th>
        ${thNote}
      </tr></thead>
      <tbody>${tBody}</tbody>
    </table>`;
  }
}

// Berechnet H bei +10°C aus H_max und L_ref
function _reglageHAt10(mat, variant, H_max, L_ref) {
  if (!H_max || !mat.E || !mat.AK) return null;
  const tbl = variant?.H_reglage_table ?? mat.H_reglage_table;
  const edits = _elMatEdits[mat._key + (variant && variant !== mat ? ('_' + (mat.H_reglage_variants?.indexOf(variant) ?? 0)) : '')];
  if (!edits?.H_max && !edits?.L_ref && tbl) {
    const i = tbl.temps.indexOf(10);
    if (i >= 0) return tbl.vals[i];
  }
  return _rundeReglage(_reglageH(mat, H_max, L_ref, 10)) || null;
}

function toggleReglageElEdit() {
  _rglElEditMode = !_rglElEditMode;
  const btn = document.getElementById('rgl-el-edit-btn');
  if (btn) btn.textContent = t(_rglElEditMode ? 'ui.schliessen' : 'ui.bearbeiten');
  renderReglageElTable();
}

// ── Angepasste Reglagewerte (Einzelleiter) — gehören zum Projekt ────────────
// Bearbeiten/Import im Reglage-Fenster ändern nicht mehr dauerhaft MATERIALS, sondern
// werden hier je Schlüssel (Material bzw. Material_Variante) festgehalten, mit dem
// Projekt gespeichert und beim Laden wieder angewendet. Ein Projekt ohne Anpassungen
// rechnet mit den SBB-Werten. { schluessel: { vals: [13 Werte −20…+40 °C], L_ref } }
let _reglageAngepasst = {};
const _RGL_TEMPS = [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40];
const _RGL_ORIGINAL = {};   // Originalwerte je Material, beim ersten Anpassen gesichert
function _rglFelder(o) { return { t: o.H_reglage_table, h: o.H_reglage, l: o.L_ref }; }
function _rglSichern(matKey) {
  const m = MATERIALS[matKey];
  if (m && !_RGL_ORIGINAL[matKey]) _RGL_ORIGINAL[matKey] = { m: _rglFelder(m), v: (m.H_reglage_variants || []).map(_rglFelder) };
}
function _rglSetzen(o, f) {
  for (const [k, w] of [['H_reglage_table', f.t], ['H_reglage', f.h], ['L_ref', f.l]]) { if (w === undefined) delete o[k]; else o[k] = w; }
}
// Schlüssel → { matKey, vi } (vi = −1: ohne Variante)
function _rglSchluessel(k) {
  if (MATERIALS[k]) return { matKey: k, vi: -1 };
  const i = k.lastIndexOf('_'), vi = parseInt(k.slice(i + 1), 10);
  return (i > 0 && !isNaN(vi) && MATERIALS[k.slice(0, i)]) ? { matKey: k.slice(0, i), vi } : null;
}
function _reglageAnpassungenAnwenden() {
  // zuerst alle Originale zurück, dann die Anpassungen dieses Projekts
  for (const [matKey, o] of Object.entries(_RGL_ORIGINAL)) {
    const m = MATERIALS[matKey]; if (!m) continue;
    _rglSetzen(m, o.m); (m.H_reglage_variants || []).forEach((v, i) => o.v[i] && _rglSetzen(v, o.v[i]));
  }
  for (const [k, a] of Object.entries(_reglageAngepasst)) {
    const z = _rglSchluessel(k); if (!z || !Array.isArray(a?.vals) || a.vals.length !== _RGL_TEMPS.length) continue;
    _rglSichern(z.matKey);
    const m = MATERIALS[z.matKey];
    const setze = o => { o.H_reglage_table = { temps: [..._RGL_TEMPS], vals: a.vals.map(Number) }; o.H_reglage = Number(a.vals[_RGL_TEMPS.indexOf(10)]); if (a.L_ref > 0) o.L_ref = a.L_ref; };
    if (z.vi >= 0 && m.H_reglage_variants?.[z.vi]) { setze(m.H_reglage_variants[z.vi]); if (z.vi === 0) setze(m); }
    else setze(m);
  }
}
function _rglIstAngepasst(k) { return !!_reglageAngepasst[k]; }
// SBB-/Originalwerte zu einem Schlüssel (unabhängig von angewendeten Anpassungen)
function _rglOriginal(k) {
  const z = _rglSchluessel(k); if (!z) return null;
  const m = MATERIALS[z.matKey], o = _RGL_ORIGINAL[z.matKey];
  const fm = o ? o.m : _rglFelder(m);
  const f = o ? (z.vi >= 0 && o.v[z.vi] ? o.v[z.vi] : o.m)
              : _rglFelder(z.vi >= 0 && m.H_reglage_variants?.[z.vi] ? m.H_reglage_variants[z.vi] : m);
  const L_ref = f.l ?? fm.l ?? 45;   // Varianten erben die Bezugsspannweite des Leiters
  // Leiter ohne SBB-Tabelle: wirksam ist die Herleitung aus 6 kN bei −20 °C (wie applyElVariant)
  const vals = f.t?.vals ?? fm.t?.vals ?? _RGL_TEMPS.map(T => _rundeReglage(_reglageH(m, 6000, L_ref, T)));
  return { vals, L_ref };
}
// Anpassung nur festhalten, wenn sie von den Originalwerten abweicht
function _rglFesthalten(k, vals, L_ref) {
  const o = _rglOriginal(k);
  const gleich = o?.vals && o.vals.length === vals.length && o.vals.every((v, i) => Math.round(v) === Math.round(vals[i]))
                 && (L_ref == null || Number(L_ref) === Number(o.L_ref));
  if (gleich) delete _reglageAngepasst[k]; else _reglageAngepasst[k] = { vals, L_ref };
}
// Einzelleiter neu aufbauen, nachdem sich Tabellen geändert haben
function _rglElNeu() {
  if (sysMode === 'el') { elReglageHmaxOvr = null; elReglageLrefOvr = null; applyElVariant(elBasiskraftIdx); }
}
function reglageSbbWiederherstellen() {
  _reglageAngepasst = {}; _elMatEdits = {};
  _reglageAnpassungenAnwenden(); _rglElNeu(); renderReglageElTable();
  meldung(t('msg.rgl.sbb'), 'erfolg');
}

// Eingabe im Bearbeiten-Modus: nur die berechnete Spalte nachführen — die Tabelle
// nicht neu aufbauen, sonst verliert das Feld nach jeder Ziffer den Fokus.
function _rglEditEingabe(key, feld, wert) {
  const ed = (_elMatEdits[key] = _elMatEdits[key] || {});
  ed[feld] = parseFloat(wert) || null;
  const z = _rglSchluessel(key); if (!z) return;
  const mat = MATERIALS[z.matKey]; mat._key = z.matKey;
  const variant = z.vi >= 0 ? mat.H_reglage_variants?.[z.vi] : mat;
  const H10 = _reglageHAt10(mat, variant, _effHmax(mat, variant), _effLref(mat, variant));
  const zelle = document.querySelector(`#rgl-el-wrap [data-h10="${key}"]`);
  if (zelle) zelle.textContent = H10 != null ? Math.round(H10).toLocaleString('de-CH') + ' N' : '—';
}

function _resetElMatEdits() {
  _elMatEdits = {};
  renderReglageElTable();
}

function _applyElMatEdits() {
  // Übernommene Werte als Anpassung des Projekts festhalten (nicht dauerhaft in MATERIALS)
  for (const [key, mat] of Object.entries(MATERIALS)) {
    mat._key = key;
    const applyToVariant = (editKey, variant) => {
      const ed = _elMatEdits[editKey];
      if (!ed) return;
      if (ed.H_max != null || ed.L_ref != null) {
        const H_max = ed.H_max ?? _effHmax(mat, variant);
        const L_ref = ed.L_ref ?? _effLref(mat, variant);
        const vals  = _RGL_TEMPS.map(T => _rundeReglage(_reglageH(mat, H_max, L_ref, T)));
        _rglFesthalten(editKey, vals, L_ref);
      }
    };
    if (mat.H_reglage_variants && mat.H_reglage_variants.length > 1) {
      mat.H_reglage_variants.forEach((v, vi) => applyToVariant(key + '_' + vi, v));
    } else {
      applyToVariant(key, mat);
    }
  }
  _elMatEdits = {};
  _reglageAnpassungenAnwenden();
  _rglElNeu();   // Sidebar-Preset aktualisieren falls Einzelleiter aktiv
  _rglElEditMode = false;
  const btn = document.getElementById('rgl-el-edit-btn');
  if (btn) btn.textContent = t('ui.bearbeiten');
  renderReglageElTable();
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportMaterialsCSV() {
  const temps = [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40];
  const sep = ';';
  const header = ['Material','Code','q [N/m]','alpha [1e-6/K]','E [GPa]','AK [mm²]','L_ref [m]',
    ...temps.map(T => 'H ' + (T>0?'+':'') + T + ' °C [N]'), 'Anmerkung'].join(sep);

  const lines = ['﻿' + header]; // BOM für Excel-Kompatibilität

  for (const [key, mat] of Object.entries(MATERIALS)) {
    mat._key = key;
    const variants = mat.H_reglage_variants;
    const addRow = (editKey, name, variant) => {
      const H_max = _effHmax(mat, variant);
      const L_ref = _effLref(mat, variant);
      const tbl   = (variant !== mat ? variant?.H_reglage_table : null) ?? mat.H_reglage_table;
      const Hvals = temps.map(T => {
        if (tbl) { const i = tbl.temps.indexOf(T); if (i >= 0) return Math.round(tbl.vals[i]); }
        return _rundeReglage(_reglageH(mat, H_max ?? 6000, L_ref, T));
      });
      const note  = (variant !== mat ? variant?.reglage_note : null) ?? mat.reglage_note ?? '';
      lines.push([
        name, editKey,
        mat.q.toFixed(5),
        (mat.alpha * 1e6).toFixed(2),
        (mat.E / 1e9).toFixed(1),
        (mat.AK * 1e6).toFixed(2),
        L_ref,
        ...Hvals,
        '"' + note.replace(/"/g,'""') + '"'
      ].join(sep));
    };

    if (variants && variants.length > 1) {
      variants.forEach((v, vi) => addRow(key + '_' + vi, mat.name + ' · ' + v.label, v));
    } else {
      addRow(key, mat.name, mat);
    }
  }

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Einzelleiter_Materialien.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── CSV Import ────────────────────────────────────────────────────────────────
function importMaterialsCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      let text = e.target.result;
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // BOM entfernen
      const lines = text.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));
      if (lines.length < 2) { meldung(t('msg.csv.leer'), 'fehler'); return; }
      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g,''));
      const codeIdx  = headers.indexOf('Code');
      const lrefIdx  = headers.indexOf('L_ref [m]');
      const temps    = [-20,-15,-10,-5,0,5,10,15,20,25,30,35,40];
      const hIdx     = temps.map(T => headers.indexOf('H ' + (T>0?'+':'') + T + ' °C [N]'));
      if (codeIdx < 0) { meldung(t('msg.csv.spalte'), 'fehler'); return; }

      let updated = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g,''));
        const editKey = cols[codeIdx];
        if (!editKey) continue;
        const L_ref = lrefIdx >= 0 ? parseFloat(cols[lrefIdx]) : null;
        const Hvals = hIdx.map(idx => idx >= 0 ? parseFloat(cols[idx]) : NaN);
        if (Hvals.some(isNaN)) continue;
        const H_max = Hvals[0]; // H bei -20°C

        // Finde das zugehörige Material
        let matKey = editKey, variantIdx = -1;
        if (editKey.includes('_')) {
          const parts = editKey.split('_');
          const lastPart = parts[parts.length - 1];
          if (!isNaN(parseInt(lastPart))) {
            variantIdx = parseInt(lastPart);
            matKey = parts.slice(0, -1).join('_');
          }
        }
        const mat = MATERIALS[matKey];
        if (!mat) continue;

        // Als Anpassung des Projekts festhalten (Variante 0 gleicht den Haupteintrag mit ab)
        const schluessel = (variantIdx >= 0 && mat.H_reglage_variants?.[variantIdx]) ? matKey + '_' + variantIdx : matKey;
        _rglFesthalten(schluessel, Hvals.map(Math.round), (L_ref != null && !isNaN(L_ref)) ? L_ref : null);
        updated++;
      }
      if (updated > 0) {
        _reglageAnpassungenAnwenden();
        _rglElNeu();
        renderReglageElTable();
        meldung(t('msg.mat.aktualisiert').replace('{n}', updated), 'erfolg');
      } else {
        meldung(t('msg.csv.keine.codes'), 'warnung');
      }
    } catch(err) { meldung(t('msg.importfehler') + ': ' + err.message, 'fehler'); }
    event.target.value = ''; // Reset file input
  };
  reader.readAsText(file, 'UTF-8');
}

// ── Formatierungshilfsfunktionen ──
function sign(v) { return v >= 0 ? '+' : ''; }         // Vorzeichen als String
const f3 = v => v.toFixed(2);
const f4 = v => v.toFixed(4);
// Schweizer Tausendertrennzeichen (Apostroph), z.B. 12'345.6
function fN(v, dp = 1) {
  const parts = v.toFixed(dp).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return dp > 0 ? parts.join('.') : parts[0];
}

// Zustandsgleichungen, Kettenlinie und berechneZustaende() → rechenkern.js

// ═══════════════════════════════════════════════════════════════
// HAUPTBERECHNUNG
// ═══════════════════════════════════════════════════════════════

// Alle Eingabefelder auslesen und kombinierte Materialwerte berechnen.
// Wird von berechnen() und quickDraw() gemeinsam verwendet.
// ov (optional): Werte übersteuern, ohne die Eingabefelder zu ändern —
//   { L, Lm, h1, h2, T2, wearPct, zl }. Wird für Abschnitt und Abstandsprüfung
//   genutzt; ohne ov liest die Funktion wie bisher nur die Eingabefelder.
function readInputs(ov = {}) {
  const L          = ov.L  ?? getActiveSpan();
  const Lm         = ov.Lm ?? getEffectiveSpan();
  const H_Ts_ub    = parseFloat(document.getElementById('tension').value); // unbelastet (N-FL) oder konstant (R-FL)
  const H_Fd       = parseFloat(document.getElementById('tension-fd').value);
  // h1/h2 sind immer in Meter über SOK — SOK-Felder sind nur die absolute Referenz
  const h1         = ov.h1 ?? parseFloat(document.getElementById('h1').value);
  const h2         = ov.h2 ?? parseFloat(document.getElementById('h2').value);
  const T1         = parseFloat(document.getElementById('temp1').value);
  const T2         = ov.T2 ?? parseFloat(document.getElementById('temp2').value);
  const wp         = ov.wearPct ?? wearPct;
  const q_Ts       = parseFloat(document.getElementById('weight-ts').value);
  const q_Fd_base  = parseFloat(document.getElementById('weight-fd').value);
  const q_Fd       = q_Fd_base * (1 - wp / 100);
  const sh         = parseFloat(document.getElementById('sh').value);
  const q_ges      = q_Ts + q_Fd + Q_HAENGER;   // Hänger: siehe rechenkern.js

  // Materialsteifigkeiten
  const alpha_Ts = getAlphaTs();
  const EA_Ts    = getEATs();

  // FL-Kombination erkennen (matTs-Key + '+' + matFd-Key, z.B. 'stcu50+cu107')
  const matTsKey  = document.getElementById('material-ts').value;
  const matFdKey  = document.getElementById('material-fd').value;
  const flCombo   = FL_COMBINATIONS[matTsKey + '_' + matFdKey] ?? null;

  // N-FL Stufe 1: unbelastet → belastet
  // Bei bekannter FL-Kombination: MFL/MTS aus VBA-Tabelle verwenden (exaktere Gewichte inkl. Klemmen)
  // H_Ts_abgeleitet: H_Ts stammt aus der Zustandsgleichung und wird im Feld
  // «H Ts belastet» angezeigt. Das Schreiben übernimmt berechnen() — readInputs()
  // liest nur und darf das DOM nicht verändern (quickDraw() nutzt es beim Ziehen).
  let H_Ts, q_ges_eff, H_Ts_abgeleitet = false, q_abnutzung = 0;
  if (sysMode === 'nfl' && flCombo) {
    // Wie SBB-Excel: Abnutzungsgewicht aus der Kombination; H_Ts ist der
    // Bezugszustand «Ts belastet bei 10 °C» (neuer Draht), aus der unbelasteten
    // Montagezugkraft bei T1 — siehe nflBezugszustand() in rechenkern.js
    q_ges_eff = mflAbgenutzt(flCombo, wp, q_Fd_base);
    H_Ts = nflBezugszustand(H_Ts_ub, T1, flCombo, Lm);
    H_Ts_abgeleitet = true;
  } else if (sysMode === 'rfl' && flCombo) {
    // R-FL mit bekannter Kombination: MFL aus Tabelle (exakte Gewichte inkl. Klemmen/Hänger)
    // q_Haenger im manuellen q_ges wäre 0.196 N/m (falsch), FL-Tabelle hat 0.706 N/m
    // Abnutzung wie SBB-Excel: Gewichtsverlust aus der Kombination (Blatt Daten),
    // im Rechenkern als negative Zusatzlast auf Ts+Fd verteilt (_rflLast)
    q_abnutzung = (flCombo.qFdAbnutzung ?? q_Fd_base) * (wp / 100);
    q_ges_eff = flCombo.MFL - q_abnutzung;
    H_Ts = H_Ts_ub;  // R-FL: Zugkraft konstant (Nachspannvorrichtung)
  } else if (sysMode === 'nfl' && EA_Ts !== null && !isNaN(H_Ts_ub)) {
    q_ges_eff = q_ges;
    H_Ts = solveLoadingEq(H_Ts_ub, q_Ts, q_ges, Lm, EA_Ts) ?? H_Ts_ub;
    H_Ts_abgeleitet = true;
  } else {
    q_ges_eff = q_ges;
    H_Ts = H_Ts_ub;
  }

  // N-FL Stufe 2 / Einzelleiter: Temperatur — EA_Ts/alpha_Ts
  const EA    = flCombo ? flCombo.E * flCombo.AK : EA_Ts;
  const alpha = flCombo ? flCombo.AL             : alpha_Ts;

  // deltaT: bei N-FL und Einzelleiter aus T1/T2; R-FL = 0 (konstante Zugkraft)
  const deltaT = (sysMode === 'nfl' || sysMode === 'el') ? (T2 - T1) : 0;
  // Eislast: wirksam bei T₂ = −5 °C — Bedingung aus isEislastAktiv(),
  // nicht aus der Sichtbarkeit des Eingabefelds.
  const ZL = ov.zl !== undefined ? ov.zl
    : isEislastAktiv(T2) ? (parseFloat(document.getElementById('zl-eis').value) || 0)
    : 0;

  // Einzelleiter: nur ein Leiter, kein Fahrdraht, keine Hänger, H direkt
  if (sysMode === 'el') {
    const q_el = q_Ts;    // nur Leitereigengewicht
    const H_el = H_Ts_ub; // direkte Zugkraft (kein unbelastet → belastet)
    return { L, Lm, H_Ts: H_el, H_Ts_ub: H_el, H_Fd: 0, h1, h2, T1, T2,
             q_Ts: q_el, q_Fd: 0, q_Fd_base: 0, sh: 0,
             q_ges: q_el, EA, EA_Ts, alpha, deltaT, flCombo: null, ZL,
             H_Ts_abgeleitet: false };
  }

  return { L, Lm, H_Ts, H_Ts_ub, H_Fd, h1, h2, T1, T2, q_Ts, q_Fd, q_Fd_base, sh,
           q_ges: q_ges_eff, EA, EA_Ts, alpha, deltaT, flCombo, ZL, H_Ts_abgeleitet, q_abnutzung };
}

// ── Entprellung ──────────────────────────────────────────────────────────
// berechnen() kostet rund 7 ms, davon ~75 % Canvas-Zeichnen. Bei Ereignissen,
// die schneller als ein Bildschirmframe feuern (Schieberegler ziehen), werden
// die Aufrufe hier auf einen Frame gebündelt.
// Wichtig: berechnen() selbst bleibt synchron. Ein direkter Aufruf verwirft
// einen vorgemerkten Frame, damit die Reihenfolge eindeutig bleibt.
let _berechnenFrame = null;

// Rechnet einen Zustand mit übersteuerten Eingaben (siehe readInputs), ohne
// Anzeige oder calcState zu verändern. oben = oberster Leiter bei T2
// (N-FL: kombiniertes System wie im Diagramm, sonst Tragseil bzw. Leiter).
function rechneFall(ov = {}) {
  const e = readInputs(ov);
  const z = berechneZustaende({ sysMode, L: e.L, Lm: e.Lm, H_Ts: e.H_Ts, H_Fd: e.H_Fd, h1: e.h1, h2: e.h2,
    T1: e.T1, q_ges: e.q_ges, EA: e.EA, alpha: e.alpha, deltaT: e.deltaT, flCombo: e.flCombo, ZL: e.ZL,
    wearPct: ov.wearPct ?? wearPct, q_abnutzung: e.q_abnutzung, T3: null });
  return { e, z, oben: (sysMode === 'nfl' && z.c2_vem) ? z.c2_vem : z.c2 };
}

function berechnenEntprellt() {
  if (_berechnenFrame !== null) return;          // für diesen Frame bereits vorgemerkt
  _berechnenFrame = requestAnimationFrame(() => {
    _berechnenFrame = null;
    berechnen();
  });
}

// Bei ungültiger Eingabe: Ergebnisse ausblenden, Diagramm abdunkeln und das
// beanstandete Feld markieren — sonst stehen alte Werte da, als wären sie aktuell.
const _FEHLER_FELD = { L: 'span', 'H.ts': 'tension', 'H.el': 'tension', 'H.fd': 'tension-fd',
                       h1: 'h1', h2: 'h2', T1: 'temp1', T2: 'temp2', sh: 'sh' };
// Übliche Bereiche: ausserhalb rechnet die App weiter, zeigt aber einen Hinweis
const PLAUSIBEL = { L: 80, h: 15, T: [-30, 90] };
function _ergebnisVeraltet(ja, feldId = null) {
  document.body.classList.toggle('ergebnis-veraltet', ja);
  document.querySelectorAll('.feld-fehler').forEach(el => {
    el.classList.remove('feld-fehler'); el.removeAttribute('aria-invalid');
  });
  let el = feldId ? document.getElementById(feldId) : null;
  if (feldId === 'span' && spanMode === 'ruling') el = document.getElementById('lm-display');
  if (ja && el) { el.classList.add('feld-fehler'); el.setAttribute('aria-invalid', 'true'); }
  if (ja && typeof updateErgebnisleiste === 'function') updateErgebnisleiste();
}

function berechnen() {
  // Vorgemerkten Frame verwerfen — dieser Aufruf ersetzt ihn.
  if (_berechnenFrame !== null) {
    cancelAnimationFrame(_berechnenFrame);
    _berechnenFrame = null;
  }
  // Koordinaten LV95: Spannweite und SOK vor dem Einlesen setzen
  _koordAnwenden();
  // 3-Punkte-Modus: zuerst FH berechnen und ins tension-Feld schreiben,
  // damit readInputs() den korrekten Wert liest.
  if (mode3pt) {
    const _L  = getActiveSpan();
    const _h1 = parseFloat(document.getElementById('h1').value);
    const _h2 = parseFloat(document.getElementById('h2').value);
    compute3pt(_L, _h1, _h2);
  }
  // spanMode NICHT destrukturieren — readInputs() liefert das Feld nicht;
  // ein lokaler Bezeichner würde die globale Variable mit undefined verdecken.
  const { L, Lm, H_Ts, H_Ts_ub, H_Fd, h1, h2, T1, T2, q_Ts, q_Fd, q_Fd_base,
          sh, q_ges, EA, EA_Ts, alpha, deltaT, flCombo, ZL,
          H_Ts_abgeleitet, q_abnutzung } = readInputs();

  // Anzeigefeld «H Ts belastet» aktualisieren (nur hier, nicht in readInputs()).
  if (H_Ts_abgeleitet) {
    const elHTsBel = document.getElementById('tension-belastet');
    if (elHTsBel) elHTsBel.value = Math.round(H_Ts);
  }

  // Auto-Variante nach Spannweite wählen (z.B. Aldrey 300: c ≤/> 35 m)
  // Massgebend ist Lm (Mittelspannweite), im Einzelfeld-Modus gilt Lm = L
  autoSelectElVariantBySpan(Lm);

  const errorBox = document.getElementById('error-box');
  const warnBox  = document.getElementById('warn-box');
  errorBox.classList.add('hidden');
  warnBox.classList.add('hidden');
  calcState = null;

  // Eingabevalidierung — nennt das erste beanstandete Feld statt einer Sammelmeldung.
  document.querySelectorAll('.feld-warnung').forEach(el => el.classList.remove('feld-warnung'));
  // Spannweite: leeres Feld oder 0 nicht stillschweigend durch 50 m ersetzen
  const _spanFelder = spanMode === 'single' ? [document.getElementById('span')]
    : Array.from({ length: spanCount }, (_, i) => document.getElementById(`span-${i}`)).filter(Boolean);
  const _spanFalsch = _spanFelder.find(el => { const v = parseFloat(el.value); return !(v > 0); });
  if (_spanFalsch) {
    errorBox.innerHTML = `${t('val.feld.L')}: ${t(isNaN(parseFloat(_spanFalsch.value)) ? 'val.fehlt' : 'val.positiv')}`;
    errorBox.classList.remove('hidden');
    _ergebnisVeraltet(true, _spanFalsch.id);
    return;
  }
  // [Schlüssel, Wert, muss > 0 sein]
  const isEl = sysMode === 'el';
  const pflichtfelder = isEl
    ? [['L', L, true], ['q.el', q_Ts, true], ['H.el', H_Ts, true],
       ['h1', h1, true], ['h2', h2, true], ['T1', T1, false], ['T2', T2, false]]
    : [['L', L, true], ['q.ts', q_Ts, true], ['q.fd', q_Fd_base, true],
       ['H.ts', H_Ts, true], ['H.fd', H_Fd, true], ['h1', h1, true],
       ['h2', h2, true], ['T1', T1, false], ['T2', T2, false], ['sh', sh, true]];
  for (const [feld, wert, positiv] of pflichtfelder) {
    const grund = isNaN(wert) ? 'val.fehlt' : (positiv && wert <= 0 ? 'val.positiv' : null);
    if (grund) {
      errorBox.innerHTML = `${t('val.feld.' + feld)}: ${t(grund)}`;
      errorBox.classList.remove('hidden');
      _ergebnisVeraltet(true, _FEHLER_FELD[feld]);
      return;
    }
  }

  // T3 einmal lesen und für Rechnung UND Anzeige verwenden. Nicht «|| 80»:
  // das würde 0 °C als «leer» werten und als 80 °C anzeigen.
  const _t3Raw = parseFloat(document.getElementById('temp3')?.value);
  const _T3 = showT3 ? (isNaN(_t3Raw) ? 80 : _t3Raw) : null;

  let z;
  try {
    z = berechneZustaende({ sysMode, L, Lm, H_Ts, H_Fd, h1, h2, T1, q_ges, EA,
                            alpha, deltaT, flCombo, ZL, wearPct, q_abnutzung, T3: _T3 });
  } catch (e) {
    const titel = e.phase === 'c1' ? 'err.ausgangszustand'
                : sysMode === 'nfl' ? 'err.zielzustand.ts' : 'err.zielzustand';
    errorBox.textContent = t(titel) + ': ' + e.message;
    errorBox.classList.remove('hidden');
    _ergebnisVeraltet(true);
    return;
  }
  _ergebnisVeraltet(false);
  if (z.t3Fehler) _spur('T3-Vergleichskurve', z.t3Fehler, 'debug');
  const { c1, c2 } = z;

  const warns = [];
  if (spanMode === 'ruling') warns.push(t('warn.lm.feld').replace('{lm}', Lm.toFixed(2)).replace('{l}', L.toFixed(1)));
  // Plausibilität: ungewöhnliche Werte gelb markieren, Rechnung läuft weiter
  const _plausibel = (id, ok, text) => { if (ok) return; warns.push('⚠ ' + text); document.getElementById(id)?.classList.add('feld-warnung'); };
  _spanFelder.forEach(el => _plausibel(el.id, parseFloat(el.value) <= PLAUSIBEL.L,
    t('warn.plaus.L').replace('{v}', fN(parseFloat(el.value), 1)).replace('{max}', PLAUSIBEL.L)));
  [['h1', h1], ['h2', h2]].forEach(([id, v]) => _plausibel(id, v <= PLAUSIBEL.h,
    t('warn.plaus.h').replace('{v}', fN(v, 2)).replace('{max}', PLAUSIBEL.h)));
  [['temp1', T1], ['temp2', T2], ...(_T3 !== null ? [['temp3', _T3]] : [])].forEach(([id, v]) =>
    _plausibel(id, v >= PLAUSIBEL.T[0] && v <= PLAUSIBEL.T[1],
      t('warn.plaus.T').replace('{v}', fN(v, 0)).replace('{min}', PLAUSIBEL.T[0]).replace('{max}', PLAUSIBEL.T[1])));
  if (c1.x_low < 0 || c1.x_low > L) warns.push(t('warn.tiefpunkt.t1'));
  if ((sysMode === 'nfl' || isEl) && c2 && (c2.x_low < 0 || c2.x_low > L))
    warns.push(t('warn.tiefpunkt.t2'));
  if (warns.length) { warnBox.innerHTML = warns.join('<br>'); warnBox.classList.remove('hidden'); }

  // T3-Spalte wie T2: Durchhang aus dem kombinierten System (N-FL mit Kombination)
  const c3Anzeige = (z.c3 && flCombo && z.c3_zeichnung && z.c3_zeichnung !== z.c3) ? { ...z.c3, sag: z.c3_zeichnung.sag } : z.c3;
  // Ergebnis ZUERST ablegen: Ergebnisse, Prüfzeile und Diagramm lesen Teile davon
  // (z. B. hf_min/hf_max über hfGrenzenM). Früher stand dies erst danach — dann zeigte
  // das Diagramm nach manchen Eingaben die hf-Linien des vorherigen Rechenschritts.
  calcState = { L, Lm, spanMode, q_Ts, q_Fd, q_ges, H_Ts, H_Ts_ub, H_Fd, sh, h1, h2, T1, T2,
                alpha, EA, EA_Ts, deltaT, c1, c2, flCombo, ZL,
                LT1_vem: z.LT1_vem, q_vem_vem: z.q_vem_vem, c2_vem: z.c2_vem, c3: z.c3, c3_vem: z.c3_zeichnung, c_fd_ref: z.c_fd_ref,
                matTs: getMaterialNameTs(), matFd: getMaterialNameFd() };
  renderResults(c1, c2, T1, T2, alpha, deltaT, q_Ts, q_Fd, sh, h1, h2, L, flCombo, z.c2_vem, ZL, c3Anzeige, _T3, z.c_fd_ref);
  _nachweisAktualisieren();
  drawCanvas(c1, c2, L, h1, h2, sh, false, z.c2_vem, z.c3_zeichnung, z.c_fd_ref);
  _hindernisErgebnisse();
  hfPruefzeile();
  hHfHinweis();
  _zugkraftSperre();
  if (_abschnittSichtbar) abschnittAktualisieren();
  if (typeof feldWahlAktualisieren === 'function') feldWahlAktualisieren();
  updateAllMesspunkte();
  refreshScaleViewIfActive();
}

// Schnellzeichnung während Drag — keine DOM-Updates, nur Canvas neu zeichnen.
// Rechnet über dieselbe Funktion wie berechnen(); dadurch stimmt die Kurve
// beim Ziehen und im Vollbild immer mit der Ergebnistabelle überein.
function quickDraw() {
  const e = readInputs();
  const { L, H_Ts, H_Fd, h1, h2, q_Ts, q_Fd_base, sh } = e;
  if (sysMode === 'el') {
    if ([L, q_Ts, H_Ts, h1, h2].some(v => isNaN(v)) || L <= 0) return;
  } else {
    if ([L, q_Ts, q_Fd_base, H_Ts, H_Fd, h1, h2, sh].some(v => isNaN(v)) || L <= 0) return;
  }
  const _t3Raw = parseFloat(document.getElementById('temp3')?.value);
  const T3 = showT3 ? (isNaN(_t3Raw) ? 80 : _t3Raw) : null;
  try {
    const z = berechneZustaende({ ...e, sysMode, wearPct, T3 });
    drawCanvas(z.c1, z.c2, L, h1, h2, sh, true, z.c2_vem, z.c3_zeichnung, z.c_fd_ref);
  } catch (err) { _spur('quickDraw', err, 'debug'); }
}

// Fenstergrösse / Handy gedreht: Diagramm neu zeichnen, sonst bleibt es bis zur
// nächsten Eingabe verzerrt. Auf einen Frame gebündelt wie berechnenEntprellt().
(() => {
  const cv = document.getElementById('main-canvas');
  if (!cv || typeof ResizeObserver === 'undefined') return;
  let frame = null;
  new ResizeObserver(() => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const dpr = window.devicePixelRatio || 1;
      if (!cv.offsetWidth || (cv.width === cv.offsetWidth * dpr && cv.height === cv.offsetHeight * dpr)) return;
      quickDraw();
    });
  }).observe(cv);
})();

// ═══════════════════════════════════════════════════════════════
// ERGEBNISDARSTELLUNG (DOM)
// ═══════════════════════════════════════════════════════════════
function renderResults(c1, c2, T1, T2, alpha, deltaT, q_Ts, q_Fd, sh, h1, h2, L, flCombo, c2vem = null, ZL = 0, c3 = null, T3 = null, cFdRef = null) {
  const isEl = sysMode === 'el';
  // Für N-FL+flCombo: geometrischen Sehnenwert aus c2vem verwenden (konsistent mit Diagramm)
  const c2Display = (flCombo && c2vem) ? { ...c2, sag: c2vem.sag } : c2;
  // Beschriftungen je nach Modus
  const sagLabel  = isEl ? t('res.sag.el.label') : flCombo ? t('res.sag.belastet') : t('res.sag.ts.label');
  const sLabel    = isEl ? t('res.seillange.el') : t('res.seillange.ts');
  const hLabel    = isEl ? t('res.zugkraft.el')  : t('res.zugkraft.ts');
  const tsMetrics = [
    { label: sagLabel,               k: 'sag',   unit: 'm',   dp: 3 },
    { label: t('res.x_low'),         k: 'x_low', unit: 'm',   dp: 3 },
    { label: sLabel,                 k: 's',     unit: 'm',   dp: 3 },
    { label: hLabel,                 k: 'H',     unit: 'N',   dp: 1 },
    { label: t('res.max.seilkraft'), k: 'T_max', unit: 'N',   dp: 1 },
  ];

  function col(c, cls) {
    return tsMetrics.map(m => {
      const v = m.unit === 'N' ? fN(c[m.k], m.dp) : c[m.k].toFixed(m.dp);
      return `<div class="metric-row">
        <span class="metric-label">${m.label}</span>
        <span class="metric-value ${cls}">${v}<span class="metric-unit">${m.unit}</span></span>
      </div>`;
    }).join('');
  }

  function chip(label, val, unit, ref) {
    const pct = ref !== 0 ? ` (${sign(val)}${(val/Math.abs(ref)*100).toFixed(1)}%)` : '';
    const cls = val >= 0 ? '' : 'neg';
    const fv = unit === 'N' ? fN(val, 1) : f3(val);
    return `<div class="delta-chip ${cls}">${label}: ${sign(val)}${fv} ${unit}${pct}</div>`;
  }

  // Fd ist horizontal (Solllage); Hängerlänge(x) = sh − sag_Ts(x)
  const haenger_min = sh - c1.sag;     // kürzester Hänger (am Tiefpunkt)
  const haenger_max = sh;              // längster Hänger (am Mast)
  // Fd-Anhebung bei T<sub>2</sub> (N-FL): Δy_Fd = Δy_Ts am Tiefpunkt = c1.sag − c2.sag
  // Absolute Fd-Höhe über SOK am Tiefpunkt des Istzustands
  const yFdSoll = x => (h1 - sh) + (h2 - h1) * x / L;
  // R-FL: Fd folgt dem Tragseil nur bei Eislast/Abnutzung (VEM 7.53a)
  const x_ist   = sysMode === 'el' ? c1.x_low : c2.x_low;

  const fdBlock = `
    <div style="margin-top:.75rem;padding:.6rem .75rem;background:var(--bg);border:1px solid var(--border);border-radius:10px">
      <div style="font-size:.72rem;font-weight:600;color:var(--muted);margin-bottom:.35rem">
        ${t('res.fd.title')}
      </div>
      <div class="metric-row"><span class="metric-label">${t('res.haenger.mast')}</span>
        <span class="metric-value">${f3(haenger_max)}<span class="metric-unit">m</span></span></div>
      <div class="metric-row"><span class="metric-label">${t('res.haenger.tiefpunkt')}</span>
        <span class="metric-value">${f3(haenger_min)}<span class="metric-unit">m</span></span></div>
      ${wearPct > 0 ? `<div class="metric-row"><span class="metric-label" style="color:var(--primary)">${t('res.abnutzung.fd')} (${wearPct}%)</span>
        <span class="metric-value" style="color:var(--primary)">−${(q_Fd * wearPct / (100 - wearPct)).toFixed(3)}<span class="metric-unit">N/m</span></span></div>` : ''}
      <div class="metric-row"><span class="metric-label">${t('res.q.sum')}</span>
        <span class="metric-value">${q_Ts.toFixed(3)} + ${q_Fd.toFixed(3)} + ${(0.02*9.81).toFixed(3)}<span class="metric-unit">N/m</span></span></div>
      <div class="metric-row"><span class="metric-label">${t('res.gesamtlast')}</span>
        <span class="metric-value">${(q_Ts + q_Fd + 0.02*9.81).toFixed(3)}<span class="metric-unit">N/m</span></span></div>
    </div>`;

  if (sysMode === 'rfl') {
    const hasZL = ZL > 0;
    document.getElementById('results').innerHTML = hasZL ? `
      <div class="results-grid">
        <div>
          <div class="results-col-title">Ohne Eislast</div>
          <div class="metric-list">${col(c1, 'ref')}</div>
        </div>
        <div>
          <div class="results-col-title warm">Mit Eislast (ZL = ${ZL.toFixed(2)} N/m)</div>
          <div class="metric-list">${col(c2, '')}</div>
        </div>
      </div>
      ${fdBlock}` : `
      <div class="results-grid" style="grid-template-columns:1fr">
        <div>
          <div class="results-col-title">${t('res.rfl.title')}</div>
          <div class="metric-list">${col(c1, 'ref')}</div>
        </div>
      </div>
      ${fdBlock}`;
  } else if (isEl) {
    // Einzelleiter: zweispaltig mit T1/T2, kein fdBlock
    const df = c2Display.sag - c1.sag, dH = c2.H - c1.H;
    const infoBlock = `
      <div style="margin-top:.75rem;padding:.6rem .75rem;background:var(--bg);border:1px solid var(--border);border-radius:10px">
        <div style="font-size:.72rem;font-weight:600;color:var(--muted);margin-bottom:.35rem">${t('res.leiter.label')}</div>
        <div class="metric-row"><span class="metric-label">${t('res.eigengewicht')}</span>
          <span class="metric-value">${q_Ts.toFixed(4)}<span class="metric-unit">N/m</span></span></div>
        <div class="metric-row"><span class="metric-label">${t('res.material')}</span>
          <span class="metric-value" style="font-size:.8rem">${getMaterialNameTs()}</span></div>
      </div>`;
    const t3Clr3 = (c3 && T3 !== null) ? t2TempColor(T3) : null;
    const t3Col  = (c3 && T3 !== null) ? `
        <div>
          <div class="results-col-title" style="color:${t3Clr3}">T<sub>3</sub> = ${T3} °C — ΔT = ${sign(T3-T1)}${T3-T1} K</div>
          <div class="metric-list">${col(c3, 't3val')}</div>
        </div>` : '';
    document.getElementById('results').innerHTML = `
      <div class="results-grid" style="${c3 ? 'grid-template-columns:1fr 1fr 1fr' : ''}">
        <div>
          <div class="results-col-title">T<sub>1</sub> = ${T1} °C — ${t('res.ausgangszustand')}</div>
          <div class="metric-list">${col(c1, 'ref')}</div>
        </div>
        <div>
          <div class="results-col-title" style="color:${t2TempColor(T2)}">T<sub>2</sub> = ${T2} °C — ΔT = ${sign(deltaT)}${deltaT} K</div>
          <div class="metric-list">${col(c2Display, '')}</div>
        </div>
        ${t3Col}
      </div>
      ${infoBlock}
      <div class="delta-bar">
        ${chip(t('res.delta.durchhang'), df, 'm', c1.sag)}
        ${chip(t('res.delta.zugkraft'), dH, 'N', c1.H)}
        <div class="delta-chip">α·ΔT = ${(alpha * deltaT * 1e6).toFixed(2)} × 10⁻⁶</div>
      </div>`;
  } else {
    const df = c2Display.sag - c1.sag, dH = c2.H - c1.H;
    const t3Clr2 = (c3 && T3 !== null) ? t2TempColor(T3) : null;
    const t3Col2 = (c3 && T3 !== null) ? `
        <div>
          <div class="results-col-title" style="color:${t3Clr2}">T<sub>3</sub> = ${T3} °C — ΔT = ${sign(T3-T1)}${T3-T1} K</div>
          <div class="metric-list">${col(c3, 't3val')}</div>
        </div>` : '';
    document.getElementById('results').innerHTML = `
      <div class="results-grid" style="${c3 ? 'grid-template-columns:1fr 1fr 1fr' : ''}">
        <div>
          <div class="results-col-title">T<sub>1</sub> = ${T1} °C — ${t('res.ausgangszustand')}</div>
          <div class="metric-list">${col(c1, 'ref')}</div>
        </div>
        <div>
          <div class="results-col-title" style="color:${t2TempColor(T2)}">T<sub>2</sub> = ${T2} °C — ΔT = ${sign(deltaT)}${deltaT} K</div>
          <div class="metric-list">${col(c2Display, '')}</div>
        </div>
        ${t3Col2}
      </div>
      ${fdBlock}
      <div class="delta-bar">
        ${chip(t('res.delta.durchhang') + ' ' + t('dyn.ts'), df, 'm', c1.sag)}
        ${chip(t('res.delta.zugkraft') + ' ' + t('dyn.ts'), dH, 'N', c1.H)}
        <div class="delta-chip">α·ΔT = ${(alpha * deltaT * 1e6).toFixed(2)} × 10⁻⁶</div>
      </div>`;
  }
  updateHighlightCard();

  // Legende: orangene Kurve je nach Modus beschriften
  const ts2Lbl = document.getElementById('leg-ts2-label');
  if (ts2Lbl) ts2Lbl.innerHTML = t(sysMode === 'el' ? 'leg.leiter2' : 'leg.ts2');
  const ts3Lbl = document.getElementById('leg-ts3-label');
  if (ts3Lbl) ts3Lbl.innerHTML = t(sysMode === 'el' ? 'leg.leiter3' : 'leg.ts3');
}

// ═══════════════════════════════════════════════════════════════
// CANVAS-ZEICHNUNG
// ═══════════════════════════════════════════════════════════════
// ── Fahrdraht bei T₂ und hf_min / hf_max (Diagramm, Prüfzeile) ──────────
// ── Angezeigte Seillage: EINE Stelle für Karte, Diagramm, Zeichnung, PDF und Export ──
// Wählt je Zustand die Kurve, die das Diagramm zeichnet: N-FL mit Kombination =
// kombiniertes System (Ts + Fd), sonst die Zustandskurve. (Die reinen Ts-Kurven c2/c3
// dienen der Rechnung, nicht der Anzeige — Abweichungen hatten zu Anzeige-Fehlern geführt.)
// ── Bezug der Messpunkt-Angabe: Durchhang unter der Sehne oder Δh zum linken /
// rechten / höchsten Aufhängepunkt. EINE Stelle für Diagramm, Karten, Leiste und PDF.
// Höhen in derselben Koordinate wie die Kurve (über SOK bzw. m ü. M. mit SOK links/rechts).
let mpBezug = 'hoch';
const MP_BEZUEGE = ['sehne', 'links', 'rechts', 'hoch'];
function mpBezugHoehe(x, A1, A2, L) {
  if (mpBezug === 'links')  return A1;
  if (mpBezug === 'rechts') return A2;
  if (mpBezug === 'sehne')  return A1 + (A2 - A1) * x / L;
  return Math.max(A1, A2);
}
function mpBezugKurz() { return mpBezug === 'sehne' ? 'f' : 'Δh'; }
function mpBezugText() { return t('mp.bezug.' + mpBezug); }
function setMpBezug(wert) {
  mpBezug = MP_BEZUEGE.includes(wert) ? wert : 'hoch';
  const sel = document.getElementById('mp-bezug'); if (sel && sel.value !== mpBezug) sel.value = mpBezug;
  berechnen();
}

function anzeigeKurve(zustand = 'T2', cs = calcState) {
  if (!cs) return null;
  if (zustand === 'T1') return cs.c1;
  if (zustand === 'T3') return cs.c3 ? (cs.c3_vem ?? cs.c3) : null;
  return (sysMode === 'nfl' && cs.c2_vem) ? cs.c2_vem : cs.c2;
}
// Fahrdraht über SOK an der Stelle x: Solllage + Tragseil-Verschiebung
// (N-FL gegenüber T₁, R-FL nach VEM 7.53a) — wie Zeichnung, PDF und 3D-Export.
function fdUeberSok(x, z, e) {
  const soll = (e.h1 - e.sh) + (e.h2 - e.h1) * x / e.L;
  if (sysMode === 'nfl') return soll + kettenY(z.c2_vem || z.c2, x) - kettenY(z.c1, x);
  if (sysMode === 'rfl') return soll + rflFahrdrahtVerschiebung(z.c2, z.c_fd_ref, x);
  return soll;
}
// Tiefste und höchste Stelle des Fahrdrahts im Feld
function fdSpanne(z, e, n = 120) {
  let tief = { x: 0, h: Infinity }, hoch = { x: 0, h: -Infinity };
  for (let i = 0; i <= n; i++) {
    const x = e.L * i / n, h = fdUeberSok(x, z, e);
    if (h < tief.h) tief = { x, h };
    if (h > hoch.h) hoch = { x, h };
  }
  return { tief, hoch };
}
// hf-Grenzen in m über SOK aus der hf-Ansicht (null = Einzelleiter, { fehler } = Eingaben unvollständig)
function hfGrenzenM() {
  if (!entwicklerModus) return null;   // hf noch nicht freigegeben (Entwicklermodus)
  if (sysMode === 'el' || typeof hfRechnen !== 'function') return null;
  _hfStart();
  const r = hfRechnen();
  return r.fehler.length ? { fehler: true } : { min: r.min.wert / 1000, max: r.max.wert / 1000 };
}
// hf_min / hf_max sind Auslegungshöhen: Soll-Fahrdrahthöhe am Stützpunkt (h − sh). Durchhang,
// Anheben, Schwingung und Vordurchhang stecken schon als Zuschläge darin — die Ist-Lage bei T₂
// wird deshalb nicht bewertet (sonst doppelt gerechnet), nur als Information gezeigt.
function hfSollPruefung(g, e) {
  const soll = [e.h1 - e.sh, e.h2 - e.sh];
  const unter = soll.some(h => h < g.min - 1e-9), ueber = soll.some(h => h > g.max + 1e-9);
  return { soll, unter, ueber, ok: !unter && !ueber };
}
// Zulässige Systemhöhe aus hf: Soll-Fahrdrahthöhe h − sh muss an beiden Stützpunkten
// zwischen hf_min und hf_max liegen → sh ≤ min(h) − hf_min und sh ≥ max(h) − hf_max.
// Auf cm nach innen gerundet (sichere Seite). null = hf nicht aktiv / nicht berechenbar.
function shGrenzen() {
  if (sysMode === 'el' || !calcState) return null;
  let aktiv = false;
  try { aktiv = hfEingabe !== null || diagrammHf || Ansicht.zeichnungHf; } catch { aktiv = false; }
  const g = aktiv ? hfGrenzenM() : null;
  if (!g || g.fehler) return null;
  const { h1, h2, sh } = calcState;
  const min = Math.ceil((Math.max(h1, h2) - g.max) * 100 - 1e-6) / 100;
  const max = Math.floor((Math.min(h1, h2) - g.min) * 100 + 1e-6) / 100;
  const moeglich = min <= max;
  const vorschlag = !moeglich ? null : sh > max ? max : sh < min ? min : null;   // nächster Grenzwert
  return { min, max, moeglich, sh, ok: moeglich && sh >= min - 1e-9 && sh <= max + 1e-9, vorschlag };
}
// Zulässige Anschlusshöhe (Aufhängepunkt über SOK) je Seite: hf_min + sh ≤ h ≤ hf_max + sh,
// auf cm nach innen gerundet. Vorschlag = jede Seite auf den nächsten zulässigen Wert.
function hGrenzen() {
  const b = shGrenzen();
  if (!b) return null;
  const g = hfGrenzenM(), { h1, h2, sh } = calcState;
  const min = Math.ceil((g.min + sh) * 100 - 1e-6) / 100, max = Math.floor((g.max + sh) * 100 + 1e-6) / 100;
  const klemme = h => Math.min(max, Math.max(min, h));
  const v1 = klemme(h1), v2 = klemme(h2);
  const ok = Math.abs(v1 - h1) < 1e-9 && Math.abs(v2 - h2) < 1e-9;
  return { min, max, h1, h2, v1, v2, ok };
}
function hUebernehmen(v1, v2) {
  const a = document.getElementById('h1'), b = document.getElementById('h2');
  if (!a || !b) return;
  a.value = v1.toFixed(2); b.value = v2.toFixed(2);
  if (typeof onSokMumInput === 'function') onSokMumInput();
  berechnen();
}
// Info unter der Höheneingabe
function hHfHinweis() {
  const hw = document.getElementById('h-hf-hw');
  if (!hw) return;
  const b = hGrenzen();
  if (!b) { zeigeElement(hw, false); return; }
  hw.classList.toggle('nok', !b.ok);
  hw.innerHTML = `<span title="${escHtml(t('par.h.hf.titel'))}">${t('par.h.hf').replace('{min}', b.min.toFixed(2)).replace('{max}', b.max.toFixed(2))}</span>`
    + (b.ok ? '' : `<button type="button" class="hf-pz-link sh-knopf" onclick="hUebernehmen(${b.v1},${b.v2})">${t('par.h.hf.knopf').replace('{v1}', b.v1.toFixed(2)).replace('{v2}', b.v2.toFixed(2))}</button>`);
  zeigeElement(hw, true);
}
// Beim Einschalten eines hf-Schalters: liegt die Fahrdraht-Solllage ausserhalb, nachfragen, ob
// die Anschlusshöhe angepasst werden soll. Die Systemhöhe bleibt (Wert der Fahrleitungsbauart).
async function hfNachfrage() {
  const hb = hGrenzen();
  if (!hb || hb.ok) return;
  const text = t('par.hf.frage')
    .replace('{min}', (hb.min - calcState.sh).toFixed(2)).replace('{max}', (hb.max - calcState.sh).toFixed(2))
    .replace('{h1}', hb.h1.toFixed(2)).replace('{h2}', hb.h2.toFixed(2)).replace('{v1}', hb.v1.toFixed(2)).replace('{v2}', hb.v2.toFixed(2));
  if (await frageBestaetigung(text, { titel: t('par.hf.frage.titel'), ok: t('par.hf.frage.h'), abbrechen: t('par.sh.frage.nein') }))
    hUebernehmen(hb.v1, hb.v2);
}
let diagrammHf = false;   // Schalter in der Legende: Fahrdraht + hf-Band im Diagramm
function setDiagrammHf(an) {
  diagrammHf = !!an;
  hfElSperre();
  quickDraw();
  hfPruefzeile();
  hHfHinweis();
}
// Einzelleiter hat keinen Fahrdraht: Knopf «hf» in der Kopfleiste und die
// Schalter in Diagramm und Zeichnung ausgrauen (statt ausblenden). Die
// gespeicherte Wahl bleibt; der Schalter zeigt beim Einzelleiter nur «aus».
function hfElSperre() {
  const isEl = sysMode === 'el';
  const titel = isEl ? t('hf.el.gesperrt') : null;
  const btn = document.getElementById('hf-btn');
  if (btn) { btn.disabled = isEl; btn.title = titel ?? t('hf.titel'); }
  // Beim Laden kann die Funktion vor den Deklarationen laufen (let/const)
  let dia = false, zei = false;
  try { dia = diagrammHf; zei = Ansicht.zeichnungHf; } catch { /* noch nicht geladen */ }
  for (const [id, an] of [['diagramm-hf', dia], ['draw-hf', zei]]) {
    const cb = document.getElementById(id);
    if (!cb) continue;
    cb.disabled = isEl;
    cb.checked = !isEl && an;
    const lbl = cb.closest('label');
    if (lbl) {
      lbl.classList.toggle('hf-gesperrt', isEl);
      if (isEl) lbl.title = titel;
      else lbl.title = id === 'draw-hf' ? t('draw.hf.titel') : '';
    }
  }
}
// Prüfzeile unter den Ergebnissen: Fahrdraht T₂ gegen hf_min / hf_max
function hfPruefzeile() {
  const el = document.getElementById('hf-pruefzeile');
  if (!el) return;
  let aktiv = false;
  // Nur solange im Diagramm «Fahrdraht Soll/Ist + hf» eingeschaltet ist (dann zuoberst im Ergebnis)
  aktiv = sysMode !== 'el' && !!calcState && diagrammHf && entwicklerModus;
  const g = aktiv ? hfGrenzenM() : null;
  if (!g || g.fehler) { zeigeElement(el, false); return; }
  const { c1, c2, c2_vem, c_fd_ref, h1, h2, sh, L } = calcState;
  const { tief, hoch } = fdSpanne({ c1, c2, c2_vem, c_fd_ref }, { h1, h2, sh, L });
  const { soll, unter, ueber, ok } = hfSollPruefung(g, { h1, h2, sh });
  const grund = unter ? t('hf.pz.unter') : ueber ? t('hf.pz.ueber') : t('hf.pz.ok');
  el.className = 'hf-pruefzeile ' + (ok ? 'ok' : 'nok');
  el.innerHTML = `<span class="hf-pz-zeichen" aria-hidden="true">${ok ? '✓' : '✗'}</span>
    <span>${t('hf.pz.fd')} ${soll.map(h => h.toFixed(2)).join(' / ')} m ${t('hf.pz.sok')} — <b>${grund}</b>
    (hf<sub>min</sub> ${g.min.toFixed(3)} / hf<sub>max</sub> ${g.max.toFixed(3)} m).
    <span class="hf-pz-ist">${t('hf.pz.ist').replace('{a}', tief.h.toFixed(2)).replace('{b}', hoch.h.toFixed(2))}</span></span>
    <button type="button" class="hf-pz-link" onclick="openHf()">${t('hf.pz.link')}</button>`;
  zeigeElement(el, true);
}

function drawCanvas(c1, c2, L, h1, h2, sh, keepScale = false, c2_vem_draw = null, c3 = null, cFdRef = null) {
  // Textflächen der Hindernis-Beschriftung (a = …): Δh-Texte der Messpunkte weichen ihnen aus
  const textBoxen = [];
  const DF = diagrammFarben();   // Farben je Thema (hell/dunkel)
  // ── SOK-Koordinatensystem ──────────────────────────────────────
  // h1/h2 sind immer "über SOK". Wenn SOK gesetzt, werden alle
  // Zeichenkoordinaten in absolute Höhen (m ü. M.) umgerechnet.
  const sokL     = getSokMumLeft();
  const sokR     = getSokMumRight();
  const hasSok   = sokL !== null || sokR !== null;
  const sokLeft  = sokL ?? sokR ?? 0;
  const sokRight = sokR ?? sokL ?? 0;
  // SOK-Höhe an beliebiger x-Position (lineare Interpolation)
  const sokAtX   = x => sokLeft + (sokRight - sokLeft) * x / L;
  // Zeichenkoordinate: über SOK → absolut (m ü. M.) wenn SOK gesetzt
  const aY = (x, y) => hasSok ? y + sokAtX(x) : y;

  // Zeichenkoordinaten für Ankerpunkte und Fd-Solllage
  const h1d  = aY(0, h1);
  const h2d  = aY(L, h2);
  // Fd-Solllage in Zeichenkoordinaten

  // DPI-bewusstes Rendering: canvas.width/height in Gerätepixeln,
  // ctx.setTransform skaliert auf CSS-Pixel-Koordinaten (0..cssW, 0..cssH)
  const dpr  = _diagrammDruck ? DIAGRAMM_DRUCK.faktor : (window.devicePixelRatio || 1);
  const cssW = canvas.offsetWidth  || 700;
  const cssH = canvas.offsetHeight || 380;
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Zeichenraum = CSS-Pixel
  const CW = cssW, CH = cssH;
  // CSS-Abmessungen im view-Objekt speichern (für Interaktion)
  view.cw = CW;
  view.ch = CH;
  ctx.clearRect(0, 0, CW, CH);

  const catY  = (x, c) => kettenY(c, x);
  // Zeichenkoordinate (m ü. M. wenn SOK gesetzt)
  const catYD = (x, c) => aY(x, catY(x, c));
  const isEl  = sysMode === 'el';
  const isRfl = sysMode === 'rfl';

  // Y-range: nur aus Ts-Kurven (+ Anker), damit Fd die Skala nicht dominiert.
  // Die Fd-Kurve darf unten aus dem sichtbaren Bereich ragen — sie bleibt gezeichnet.
  const ys = [];
  const cT2forRange = (sysMode === 'nfl' && c2_vem_draw) ? c2_vem_draw : c2;
  for (let i = 0; i <= 120; i++) {
    const x = (i / 120) * L;
    ys.push(catYD(x, c1));
    if (sysMode === 'nfl' || isEl) ys.push(catYD(x, cT2forRange));
    if (showT3 && c3) ys.push(catYD(x, c3));
  }
  ys.push(h1d, h2d);
  // Schalter «Fahrdraht + hf»: Fahrdraht bei T₂ und das hf-Band gehören in den Ausschnitt
  const dHf = diagrammHf && entwicklerModus;   // Schalter wirkt nur im Entwicklermodus
  const hfD = dHf && !isEl ? hfGrenzenM() : null;
  const hfDok = !!hfD && !hfD.fehler;
  const zFd = { c1, c2, c2_vem: c2_vem_draw, c_fd_ref: cFdRef ?? calcState?.c_fd_ref };
  const fdD = x => aY(x, fdUeberSok(x, zFd, { h1, h2, sh, L }));
  if (dHf && !isEl) {
    for (let i = 0; i <= 60; i++) ys.push(fdD(L * i / 60));
    ys.push(aY(0, h1 - sh), aY(L, h2 - sh));
    if (hfDok) ys.push(aY(0, hfD.min), aY(L, hfD.min), aY(0, hfD.max), aY(L, hfD.max));
  }
  // Hindernisse oberhalb sichtbar halten (nur in der Nähe der Leiter)
  { const yTop = Math.max(...ys);
    _nachweis.forEach(n => { if (n.best) hindernisPunkte(n.h.punkte).forEach(pt => { if (pt.h - yTop < 5) ys.push(pt.h); }); });
    // Band der Lastfälle ganz sichtbar
    _nachweis.find(n => n.best && n.huelle)?.huelle.forEach(p => ys.push(p.min, p.max)); }
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const yRange = Math.max(yMax - yMin, 0.5);

  const { padL, padR, padT, padB } = view;
  const plotW = CW - padL - padR, plotH = CH - padT - padB;
  // Unten mehr Platz lassen wenn Fd sichtbar ist (sh-Kontext), aber nicht die volle sh-Tiefe
  const bottomPad = (!isEl && sh > 0) ? Math.min(sh * 0.35, yRange * 0.5) : yRange * 0.18;
  const yLo = yMin - bottomPad, yHi = yMax + yRange * 0.18;

  if (!keepScale || !drag) {
    view.yHi    = yHi;
    view.scaleX = plotW / L;
    view.scaleY = plotH / (yHi - yLo);
  }

  const cx = x => padL + x * view.scaleX;
  const cy = y => padT + (view.yHi - y) * view.scaleY;

  // ── Background gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CH);
  bgGrad.addColorStop(0, DF.hg1);
  bgGrad.addColorStop(1, DF.hg2);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CW, CH);

  // ── Grid ──
  ctx.strokeStyle = DF.raster; ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const gx = padL + (i / 6) * plotW;
    ctx.beginPath(); ctx.moveTo(gx, padT); ctx.lineTo(gx, padT + plotH); ctx.stroke();
  }

  // Y-grid + labels
  const ySteps = 5;
  ctx.font = `10px ${DIAGRAMM_SCHRIFT}`; ctx.fillStyle = DF.achse; ctx.textAlign = 'right';
  for (let i = 0; i <= ySteps; i++) {
    const yVal = yLo + (i / ySteps) * (yHi - yLo);
    const gy = cy(yVal);
    ctx.strokeStyle = DF.raster;
    ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + plotW, gy); ctx.stroke();
    ctx.fillStyle = DF.achse;
    ctx.fillText(yVal.toFixed(1), padL - 5, gy + 3.5);
  }
  // Y-axis label
  ctx.save();
  ctx.translate(11, padT + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.font = `10px ${DIAGRAMM_SCHRIFT}`;
  ctx.fillText(hasSok ? t('canvas.y.mum') : t('canvas.y.sok'), 0, 0);
  ctx.restore();

  // X-axis labels
  ctx.textAlign = 'center'; ctx.fillStyle = DF.achse; ctx.font = `10px ${DIAGRAMM_SCHRIFT}`;
  [0, .25, .5, .75, 1].forEach(t => {
    const xv = t * L;
    ctx.fillText(xv.toFixed(1), cx(xv), padT + plotH + 18);
  });
  ctx.fillStyle = DF.achse; ctx.font = `10px ${DIAGRAMM_SCHRIFT}`;
  ctx.fillText(t('canvas.x.label'), padL + plotW / 2, CH - 4);

  // ── hf-Band und Fahrdraht bei T₂ (Schalter in der Legende) ──
  if (dHf && !isEl) {
    ctx.save();
    ctx.beginPath(); ctx.rect(padL, padT, plotW, plotH); ctx.clip();
    if (hfDok) {
      ctx.fillStyle = DF.hfBand;
      ctx.beginPath();
      ctx.moveTo(cx(0), cy(aY(0, hfD.max))); ctx.lineTo(cx(L), cy(aY(L, hfD.max)));
      ctx.lineTo(cx(L), cy(aY(L, hfD.min))); ctx.lineTo(cx(0), cy(aY(0, hfD.min)));
      ctx.closePath(); ctx.fill();
      ctx.setLineDash([6, 4]); ctx.lineWidth = 1.3;
      [[hfD.min, DF.hfMin, 'min'], [hfD.max, DF.hfMax, 'max']].forEach(([v, farbe, k]) => {
        ctx.strokeStyle = farbe;
        ctx.beginPath(); ctx.moveTo(cx(0), cy(aY(0, v))); ctx.lineTo(cx(L), cy(aY(L, v))); ctx.stroke();
        // Beschriftung rechts: hf_max über, hf_min unter der Linie (überlagern sich nie)
        // «hf» + tiefgestelltes «min/max» + Wert, rechtsbündig, mit hellem Rand
        const yT = cy(aY(L, v)) + (k === 'max' ? -5 : 12);
        const gross = `600 10px ${DIAGRAMM_SCHRIFT}`, klein = `600 7.5px ${DIAGRAMM_SCHRIFT}`;
        // Bei m ü. M. bleibt hf eine Höhe über SOK — so beschriftet, damit nichts verwechselt wird
        const teile = [['hf', gross, 0], [k, klein, 2.5], [` = ${v.toFixed(3)} m${hasSok ? ' ' + t('pdf.sok.short') : ''}`, gross, 0]];
        const breite = teile.reduce((b, [txt, f]) => { ctx.font = f; return b + ctx.measureText(txt).width; }, 0);
        let xT = cx(L) - 6 - breite;
        ctx.setLineDash([]); ctx.textAlign = 'left'; ctx.lineJoin = 'round';
        teile.forEach(([txt, f, dy]) => {
          ctx.font = f; ctx.lineWidth = 3; ctx.strokeStyle = DF.hg1; ctx.strokeText(txt, xT, yT + dy);
          ctx.fillStyle = farbe; ctx.fillText(txt, xT, yT + dy); xT += ctx.measureText(txt).width;
        });
        ctx.setLineDash([6, 4]); ctx.lineWidth = 1.3;
      });
    }
    // Ist-Lage bei T₂: dünn, nur Information
    ctx.setLineDash([]); ctx.strokeStyle = DF.fd; ctx.lineWidth = 0.9; ctx.globalAlpha = 0.7;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) { const x = L * i / 120; i ? ctx.lineTo(cx(x), cy(fdD(x))) : ctx.moveTo(cx(x), cy(fdD(x))); }
    ctx.stroke(); ctx.globalAlpha = 1;
    // Soll-Fahrdrahthöhe (h − sh): Gerade zwischen den Stützpunkten, an den Stützpunkten geprüft
    const sollL = aY(0, h1 - sh), sollR = aY(L, h2 - sh);
    ctx.strokeStyle = DF.fd; ctx.lineWidth = 1.6; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(cx(0), cy(sollL)); ctx.lineTo(cx(L), cy(sollR)); ctx.stroke(); ctx.setLineDash([]);
    if (hfDok) {
      const pr = hfSollPruefung(hfD, { h1, h2, sh });
      [[0, sollL, pr.soll[0]], [L, sollR, pr.soll[1]]].forEach(([x, y, h]) => {
        const gut = h >= hfD.min - 1e-9 && h <= hfD.max + 1e-9;
        ctx.fillStyle = gut ? DF.gut : DF.fehler; ctx.strokeStyle = DF.hg1; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx(x), cy(y), 4.5, 0, 2 * Math.PI); ctx.stroke(); ctx.fill();
      });
    }
    ctx.restore();
  }

  // ── Support poles ──
  ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
  [[0, h1d], [L, h2d]].forEach(([xv, yv]) => {
    ctx.strokeStyle = DF.t1;
    ctx.beginPath(); ctx.moveTo(cx(xv), cy(yv)); ctx.lineTo(cx(xv), padT + plotH); ctx.stroke();
  });
  ctx.setLineDash([]);

  // ── Hindernisse (oberhalb bzw. beim Einzelleiter auch unterhalb) ──
  // Bereich aller Lastfälle als leichtes Band (höchste bis tiefste Leiterlage)
  const _huelle = _nachweis.find(n => n.best && n.huelle)?.huelle;
  zeigeElement(document.getElementById('leg-lf-item'), !!_huelle);
  if (_huelle) {
    ctx.save(); ctx.beginPath(); ctx.rect(padL, padT, plotW, plotH); ctx.clip();
    ctx.fillStyle = DF.lastfallBand;
    ctx.beginPath();
    _huelle.forEach((p, i) => i ? ctx.lineTo(cx(p.x), cy(p.max)) : ctx.moveTo(cx(p.x), cy(p.max)));
    [..._huelle].reverse().forEach(p => ctx.lineTo(cx(p.x), cy(p.min)));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  _nachweis.forEach(({ h, best, ok, unten }) => {
    if (!best) return;
    const farbe = ok ? DF.gut : DF.fehler;
    const P = hindernisPunkte(h.punkte);
    const seite = unten ? 1 : -1;   // Schraffur auf der Seite des Hindernisses
    ctx.strokeStyle = DF.hindernis; ctx.fillStyle = DF.hindernis;
    if (h.verbinden && P.length > 1) {
      // Unterkante als Linie (nach x sortiert, am Feldrand abgeschnitten) mit Schraffur nach oben
      const xa = Math.max(0, P[0].x), xb = Math.min(L, P[P.length - 1].x);
      const pts = [xa, ...P.map(p => p.x).filter(x => x > xa && x < xb), xb].map(x => [x, kanteBei(P, x, unten)]);
      ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(cx(x), cy(y)) : ctx.moveTo(cx(x), cy(y)));
      ctx.lineWidth = 2; ctx.stroke();
      ctx.lineWidth = 1;
      for (let px = cx(xa); px < cx(xb); px += 6) {
        const y = kanteBei(P, xa + (px - cx(xa)) / view.scaleX, unten);
        if (y === null) continue;
        ctx.beginPath(); ctx.moveTo(px, cy(y)); ctx.lineTo(px + 5, cy(y) + seite * 7); ctx.stroke();
      }
    } else {
      // Einzelpunkte: kurze Unterkante mit Dreieck zum Leiter
      P.filter(p => p.x >= 0 && p.x <= L).forEach(p => {
        const x0 = cx(p.x), y0 = cy(p.h);
        ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 - 7, y0); ctx.lineTo(x0 + 7, y0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0, y0 - seite * 6); ctx.lineTo(x0 - 4, y0 - seite * 1); ctx.lineTo(x0 + 4, y0 - seite * 1); ctx.closePath(); ctx.fill();
      });
    }
    // Masslinie an der massgebenden Stelle: Leiter (massgebender Lastfall) ↔ Hindernis, Wert daneben
    const bxp = cx(best.x), yl = cy(aY(best.x, catY(best.x, best.c))), yk = cy(best.uk);
    ctx.strokeStyle = farbe; ctx.fillStyle = farbe; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bxp, yk); ctx.lineTo(bxp, yl);
    ctx.moveTo(bxp - 5, yk); ctx.lineTo(bxp + 5, yk); ctx.moveTo(bxp - 5, yl); ctx.lineTo(bxp + 5, yl); ctx.stroke();
    ctx.beginPath(); ctx.arc(bxp, yl, 3, 0, 2 * Math.PI); ctx.fill();
    ctx.font = `600 10px ${DIAGRAMM_SCHRIFT}`;
    const txt = `${h.name ? h.name + ': ' : ''}a = ${best.abstand.toFixed(2)} m ${ok ? '✓' : '✗'}`;
    const tw = ctx.measureText(txt).width, links = bxp + 8 + tw > padL + plotW;
    const tx = links ? bxp - 8 - tw : bxp + 8, ty = (yk + yl) / 2 + 3.5;
    ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = DF.hg1; ctx.lineJoin = 'round';
    ctx.strokeText(txt, tx, ty); ctx.fillText(txt, tx, ty);
    textBoxen.push({ x: tx - 2, y: ty - 11, w: tw + 4, h: 15 });
  });

  // ── Chord ──
  ctx.setLineDash([6, 5]); ctx.strokeStyle = DF.t1; ctx.lineWidth = 1; ctx.globalAlpha = .5;
  ctx.beginPath(); ctx.moveTo(cx(0), cy(h1d)); ctx.lineTo(cx(L), cy(h2d)); ctx.stroke();
  ctx.globalAlpha = 1; ctx.setLineDash([]);

  // ── Curves ──
  function drawCurve(c, color, lw, alpha_, dash = []) {
    ctx.globalAlpha = alpha_;
    ctx.setLineDash(dash);
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw;
    for (let i = 0; i <= 500; i++) {
      const x = (i / 500) * L, y = catYD(x, c);
      i === 0 ? ctx.moveTo(cx(x), cy(y)) : ctx.lineTo(cx(x), cy(y));
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // ── Seil-/Ts-Kurven ──
  // Im NFL/Einzelleiter-Modus: T1 fein gestrichelt (Referenz), T2 durchgehend (Ist-Zustand)
  const cCurveT2 = (sysMode === 'nfl' && c2_vem_draw) ? c2_vem_draw : c2;
  const t1Dashed = sysMode === 'nfl' || isEl;  // T1 strichliert bei NFL + Einzelleiter
  const rflHasZL = isRfl && c2 !== c1;         // R-FL mit Eislast: c2 ist der belastete Zustand
  const _t2Raw = parseFloat(document.getElementById('temp2')?.value);
  const _t2Val = isNaN(_t2Raw) ? 40 : _t2Raw;
  const t2Clr = (sysMode === 'nfl' || isEl) ? t2TempColor(_t2Val) : DF.akzent;
  if (sysMode === 'nfl' || isEl) drawCurve(cCurveT2, t2Clr, 2.5, .85);
  if (rflHasZL) drawCurve(c2, DF.akzent, 2.5, .85);
  const c1Color = (isRfl && !rflHasZL) ? DF.akzent : DF.t1;
  drawCurve(c1, c1Color, (t1Dashed || rflHasZL) ? 1.2 : 3, (t1Dashed || rflHasZL) ? 0.55 : 1, (t1Dashed || rflHasZL) ? [6, 4] : []);

  // ── T3 Vergleichskurve (gestrichelt) ──
  if (showT3 && c3) {
    const _t3Raw = parseFloat(document.getElementById('temp3')?.value);
    const _t3Val = isNaN(_t3Raw) ? 80 : _t3Raw;
    const t3Clr = t2TempColor(_t3Val);
    drawCurve(c3, t3Clr, 1.8, .7, [8, 5]);
  }

  // ── Sag annotation ──
  function sagAnnotation(c, color, side) {
    const x0     = Math.max(0, Math.min(L, c.x_low));
    const yBot   = catYD(x0, c);
    const yChord = h1d + (h2d - h1d) * x0 / L;
    if (Math.abs(yChord - yBot) < 0.001) return;
    const [bx, by, ty] = [cx(x0), cy(yBot), cy(yChord)];
    // Arrow line
    ctx.setLineDash([3, 3]); ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx, ty); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]);
    // Arrowheads
    function arrowHead(px, py, dir) {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(px, py);
      ctx.lineTo(px - 3.5, py - dir * 7); ctx.lineTo(px + 3.5, py - dir * 7);
      ctx.closePath(); ctx.fill();
    }
    arrowHead(bx, by - 1, -1);
    arrowHead(bx, ty + 1,  1);
    // Label
    const mid = (by + ty) / 2;
    ctx.fillStyle = color; ctx.font = `bold 10px ${DIAGRAMM_SCHRIFT}`;
    ctx.textAlign = side === 'left' ? 'right' : 'left';
    ctx.fillText(`f = ${c.sag.toFixed(2)} m`, bx + (side === 'left' ? -6 : 6), mid + 4);
  }

  // Gestrichelte Linie (Sehne → Tiefpunkt) ohne Dreiecke und Label — immer sichtbar bei Messpunkt
  function sagLine(c, color) {
    const x0     = Math.max(0, Math.min(L, c.x_low));
    const yBot   = catYD(x0, c);
    const yChord = h1d + (h2d - h1d) * x0 / L;
    if (Math.abs(yChord - yBot) < 0.001) return;
    const [bx, by, ty] = [cx(x0), cy(yBot), cy(yChord)];
    ctx.setLineDash([3, 3]); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(bx, ty); ctx.lineTo(bx, by); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }

  const anyProbe = probeX1 !== null || probeX2 !== null || probeX3 !== null || probeX4 !== null;
  if (!anyProbe) {
    // Keine Messpunkte: f-Annotation wie gewohnt (Linie + Dreiecke + Label)
    const c1SagColor = (isRfl && rflHasZL) ? DF.t1 : (isRfl ? DF.akzent : DF.t1);
    sagAnnotation(c1, c1SagColor, 'right');
    if ((sysMode === 'nfl' || isEl) && Math.abs(c2.sag - c1.sag) > 0.005) {
      const cSagT2 = (sysMode === 'nfl' && c2_vem_draw) ? c2_vem_draw : c2;
      sagAnnotation(cSagT2, t2Clr, 'left');
    }
    if (rflHasZL && Math.abs(c2.sag - c1.sag) > 0.005) {
      sagAnnotation(c2, DF.akzent, 'left');
    }
  } else {
    // Messpunkt aktiv: nur gestrichelte Linien ohne Dreiecke/Label
    const c1SagColor = (isRfl && rflHasZL) ? DF.t1 : (isRfl ? DF.akzent : DF.t1);
    sagLine(c1, c1SagColor);
    if ((sysMode === 'nfl' || isEl) && Math.abs(c2.sag - c1.sag) > 0.005) {
      const cSagT2 = (sysMode === 'nfl' && c2_vem_draw) ? c2_vem_draw : c2;
      sagLine(cSagT2, t2Clr);
    }
    if (rflHasZL && Math.abs(c2.sag - c1.sag) > 0.005) {
      sagLine(c2, DF.akzent);
    }
    // Messpunkt aktiv: horizontale Referenzlinie auf Höhe des gewählten Bezugspunkts
    // (bei «Durchhang» dient die bereits gezeichnete Sehne als Bezug → keine Linie)
    const refY = cy(mpBezugHoehe(0, h1d, h2d, L));
    if (mpBezug !== 'sehne') {
      ctx.save();
      ctx.setLineDash([8, 5]); ctx.strokeStyle = DF.sehne; ctx.lineWidth = 1;
      ctx.globalAlpha = 0.45;
      ctx.beginPath(); ctx.moveTo(padL, refY); ctx.lineTo(padL + plotW, refY); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.restore();
    }
  }

  // ── Anchor points ──
  function drawAnchor(xv, yv, hovered) {
    const px = cx(xv), py = cy(yv);
    const r = hovered ? 10 : 8;
    // Glow
    if (hovered) {
      ctx.beginPath(); ctx.arc(px, py, r + 5, 0, Math.PI * 2);
      ctx.fillStyle = DF.akzentFlaeche; ctx.fill();
    }
    // Outer ring
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = hovered ? DF.akzent : DF.anker;
    ctx.fill();
    // White inner
    ctx.beginPath(); ctx.arc(px, py, r - 3, 0, Math.PI * 2);
    ctx.fillStyle = 'white'; ctx.fill();
    // Drag indicator
    ctx.fillStyle = hovered ? DF.akzent : DF.ankerLeise;
    ctx.font = `bold 9px ${DIAGRAMM_SCHRIFT}`; ctx.textAlign = 'center';
    ctx.fillText('↕', px, py + 3.5);

    return { px, py };
  }

  const hovH1 = drag?.which === 'h1';
  const hovH2 = drag?.which === 'h2';
  const { px: h1px, py: h1py } = drawAnchor(0, h1d, hovH1);
  const { px: h2px, py: h2py } = drawAnchor(L, h2d, hovH2);

  // Height labels on anchors
  function heightLabel(px, py, hDraw, hRaw, align) {
    const txt  = hasSok
      ? `${hDraw.toFixed(2)} ${t('bp.mum.abbrev')}`
      : `h = ${hRaw.toFixed(2)} m`;
    ctx.font = `bold 9px ${DIAGRAMM_SCHRIFT}`;
    const boxW = ctx.measureText(txt).width + 16, boxH = 24, gap = 8;
    const onRight = align === 'left';
    const bx = onRight ? px + gap : px - boxW - gap;
    const by = py - boxH / 2;
    ctx.fillStyle = DF.box;
    ctx.strokeStyle = DF.boxRand; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 5); ctx.fill(); ctx.stroke();
    const mid = by + boxH / 2;
    ctx.beginPath();
    if (onRight) { ctx.moveTo(px+8,mid-4); ctx.lineTo(px+1,mid); ctx.lineTo(px+8,mid+4); }
    else         { ctx.moveTo(px-8,mid-4); ctx.lineTo(px-1,mid); ctx.lineTo(px-8,mid+4); }
    ctx.fillStyle = DF.box; ctx.closePath(); ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = DF.text;
    ctx.fillText(txt, bx + 7, by + 15);
  }
  heightLabel(h1px, h1py, h1d, h1, 'left');
  heightLabel(h2px, h2py, h2d, h2, 'right');

  // ── Mastbezeichnungen (optional) ──
  const _mkL = _buildMastParts('left');
  const _mkR = _buildMastParts('right');
  if ((_mkL.num || _mkL.km) || (_mkR.num || _mkR.km)) {
    ctx.save();
    const lineH = 13;
    [[_mkL, cx(0)], [_mkR, cx(L)]].forEach(([parts, npx]) => {
      if (!parts.num && !parts.km) return;
      const rows = [];
      if (parts.num) rows.push({ text: parts.num,          bold: true,  size: 9 });
      if (parts.km)  rows.push({ text: 'KM ' + parts.km,  bold: false, size: 8 });
      let maxW = 0;
      rows.forEach(r => {
        ctx.font = `${r.bold ? 'bold ' : ''}${r.size}px ${DIAGRAMM_SCHRIFT}`;
        maxW = Math.max(maxW, ctx.measureText(r.text).width);
      });
      const boxH = rows.length * lineH + 4;
      const boxW = maxW + 10;
      const nmY  = padT + plotH + 5;
      const boxX = Math.max(padL, Math.min(npx - boxW/2, CW - padR - boxW));
      const txtX = boxX + boxW/2;
      ctx.fillStyle = DF.boxLeicht;
      ctx.beginPath();
      ctx.roundRect(boxX, nmY, boxW, boxH, 3);
      ctx.fill();
      ctx.strokeStyle = DF.rahmen; ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      rows.forEach((r, i) => {
        ctx.font = `${r.bold ? 'bold ' : ''}${r.size}px ${DIAGRAMM_SCHRIFT}`;
        ctx.fillStyle = r.bold ? DF.text2 : DF.dim;
        ctx.fillText(r.text, txtX, nmY + 2 + i * lineH);
      });
    });
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // Store anchor canvas positions for hit testing
  view.h1x = h1px; view.h1y = h1py;
  view.h2x = h2px; view.h2y = h2py;

  // ── Probe lines ──
  const CLUSTER_PX = 55; // Pixel-Schwelle für "nahe beieinander"

  // T2-Farbe für M-Marker (dynamisch nach Temperatur; R-FL: Kurvenfarbe = primary)
  const _t2RawP = parseFloat(document.getElementById('temp2')?.value);
  const _t2ValP = isNaN(_t2RawP) ? 40 : _t2RawP;
  const mpClr   = (sysMode === 'rfl') ? DF.akzent : t2TempColor(_t2ValP);

  // Alle aktiven Proben vorberechnen
  const allProbes = [
    { xv: probeX1, which: 'probe1', color: mpClr, dotColor: mpClr },
    { xv: probeX2, which: 'probe2', color: mpClr, dotColor: mpClr },
    { xv: probeX3, which: 'probe3', color: mpClr, dotColor: mpClr },
    { xv: probeX4, which: 'probe4', color: mpClr, dotColor: mpClr },
  ].filter(p => p.xv !== null).map(p => ({ ...p, px: cx(p.xv) }));

  // Cluster-Index: wie viele vorherige Proben sind "nah"?
  allProbes.forEach((p, i) => {
    p.clusterPrev = allProbes.slice(0, i).filter(q => Math.abs(q.px - p.px) < CLUSTER_PX);
    p.clusterIdx  = p.clusterPrev.length;
  });

  const drawnBoxes = [];

  function drawProbe(probeData) {
    const { xv, which, color, dotColor, px, clusterPrev, clusterIdx } = probeData;
    if (xv === null) return { cx: null, box: null };
    const isDragging = drag?.which === which;
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = color;
    ctx.lineWidth   = isDragging ? 2 : 1.5;
    ctx.globalAlpha = isDragging ? 1 : 0.75;
    ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, padT + plotH); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.restore();

    const cProbe = (sysMode === 'nfl' && c2_vem_draw) ? c2_vem_draw : c2;
    const y2     = catYD(xv, cProbe);
    const refD   = mpBezugHoehe(xv, h1d, h2d, L);   // Bezugshöhe an der Stelle x
    const distH1 = refD - y2;

    // Dot on T<sub>2</sub> curve
    ctx.beginPath(); ctx.arc(px, cy(y2), 5, 0, Math.PI * 2);
    ctx.fillStyle = dotColor; ctx.fill();
    ctx.beginPath(); ctx.arc(px, cy(y2), 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();

    // Callout-Box: Richtung alternieren bei geclusterten Proben
    const label = { probe1:'M1', probe2:'M2', probe3:'M3', probe4:'M4' }[which] ?? which;
    ctx.font = `bold 14px ${DIAGRAMM_SCHRIFT}`;
    const labelW = ctx.measureText(label).width;
    const boxW = labelW + 18;
    const boxH = 26, gap = 8;

    let onRight;
    if (clusterIdx > 0) {
      // Alternieren: letzter naher Probe entgegengesetzt
      onRight = !clusterPrev[clusterPrev.length - 1].onRight;
    } else {
      onRight = (px + boxW + 16 + gap) <= (padL + plotW);
    }
    probeData.onRight = onRight; // merken für nachfolgende Proben

    const bx = onRight ? px + gap : px - boxW - gap;
    let by = Math.min(Math.max(padT + 4, cy(y2) - boxH / 2), padT + plotH - boxH - 4);

    // Überlappung mit ALLEN vorherigen Boxes vermeiden
    for (const avoidBox of drawnBoxes) {
      if (bx < avoidBox.x + avoidBox.w + 2 && bx + boxW > avoidBox.x - 2) {
        const overlapBottom = avoidBox.y + avoidBox.h + 6;
        const overlapTop    = avoidBox.y - boxH - 6;
        if (overlapBottom + boxH <= padT + plotH - 4) by = overlapBottom;
        else if (overlapTop >= padT + 4)              by = overlapTop;
      }
    }

    ctx.fillStyle = DF.box;
    ctx.strokeStyle = DF.boxRand; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 5); ctx.fill(); ctx.stroke();
    const mid = by + boxH / 2;
    ctx.beginPath();
    if (onRight) { ctx.moveTo(px+8,mid-4); ctx.lineTo(px+1,mid); ctx.lineTo(px+8,mid+4); }
    else         { ctx.moveTo(px-8,mid-4); ctx.lineTo(px-1,mid); ctx.lineTo(px-8,mid+4); }
    ctx.fillStyle = DF.box; ctx.closePath(); ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = `bold 14px ${DIAGRAMM_SCHRIFT}`; ctx.fillStyle = dotColor;
    ctx.fillText(label, bx + 8, by + boxH / 2 + 5);

    // Δh-Annotation: Seite gegenüber Callout, vertikal versetzt bei Cluster
    const refY  = cy(refD);
    const wireY = cy(y2);
    if (Math.abs(refY - wireY) > 4) {
      const labelSide = onRight ? 'left' : 'right';
      // Vertikaler Versatz für geclusterte Labels (je 14px)
      const vmid = (refY + wireY) / 2 + clusterIdx * 14;
      ctx.setLineDash([3, 3]); ctx.strokeStyle = dotColor; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(px, refY); ctx.lineTo(px, wireY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = dotColor;
      ctx.beginPath(); ctx.moveTo(px, wireY - 1);
      ctx.lineTo(px - 3.5, wireY + 6); ctx.lineTo(px + 3.5, wireY + 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(px, refY + 1);
      ctx.lineTo(px - 3.5, refY - 6); ctx.lineTo(px + 3.5, refY - 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dotColor; ctx.font = `bold 10px ${DIAGRAMM_SCHRIFT}`;
      ctx.textAlign = labelSide === 'left' ? 'right' : 'left';
      const dhTxt = `${mpBezugKurz()} = ${distH1.toFixed(2)} m`, dhW = ctx.measureText(dhTxt).width;
      const dhX = px + (labelSide === 'left' ? -6 - dhW : 6);
      // Überdeckt der Text eine Hindernis-Beschriftung, einen Δh-Text oder ein Messpunkt-Schild: Seite
      // wechseln, sonst nach unten versetzen (innerhalb der Masslinie, max. 6 Schritte)
      const trifft = (x, y) => [...textBoxen, ...drawnBoxes].some(b => x < b.x + b.w && x + dhW > b.x && y - 10 < b.y + b.h && y + 3 > b.y);
      let tyDh = vmid + 4, txDh = dhX;
      if (trifft(txDh, tyDh)) {
        const xAnders = px + (labelSide === 'left' ? 6 : -6 - dhW);
        if (!trifft(xAnders, tyDh)) txDh = xAnders;
        else for (let k = 1; k <= 6 && trifft(txDh, tyDh); k++) tyDh = vmid + 4 + k * 13;
      }
      ctx.textAlign = 'left';
      ctx.lineWidth = 3; ctx.strokeStyle = DF.hg1; ctx.lineJoin = 'round';
      ctx.strokeText(dhTxt, txDh, tyDh); ctx.fillText(dhTxt, txDh, tyDh);
      textBoxen.push({ x: txDh - 2, y: tyDh - 11, w: dhW + 4, h: 15 });
    }

    drawnBoxes.push({ x: bx, y: by, w: boxW, h: boxH });
    return { cx: px, box: { x: bx, y: by, w: boxW, h: boxH } };
  }

  const r1 = drawProbe(allProbes.find(p => p.which === 'probe1') ?? { xv: null });
  const r2 = drawProbe(allProbes.find(p => p.which === 'probe2') ?? { xv: null });
  const r3 = drawProbe(allProbes.find(p => p.which === 'probe3') ?? { xv: null });
  const r4 = drawProbe(allProbes.find(p => p.which === 'probe4') ?? { xv: null });
  view.probe1CX = r1.cx;
  view.probe2CX = r2.cx;
  view.probe3CX = r3.cx;
  view.probe4CX = r4.cx;

  // ── T3 Vergleichspunkte M' (Diamant) ──
  if (showT3 && c3) {
    const _t3Raw = parseFloat(document.getElementById('temp3')?.value);
    const _t3Val = isNaN(_t3Raw) ? 80 : _t3Raw;
    const t3Clr  = t2TempColor(_t3Val);
    [[probeX1,"M1'"],[probeX2,"M2'"],[probeX3,"M3'"],[probeX4,"M4'"]].forEach(([xv, lbl]) => {
      if (xv === null) return;
      const y3  = catYD(xv, c3);
      const dpx = cx(xv), dpy = cy(y3);
      const s   = 5;
      ctx.beginPath();
      ctx.moveTo(dpx, dpy - s); ctx.lineTo(dpx + s, dpy);
      ctx.lineTo(dpx, dpy + s); ctx.lineTo(dpx - s, dpy);
      ctx.closePath();
      ctx.fillStyle   = t3Clr; ctx.fill();
      ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.font = `bold 10px ${DIAGRAMM_SCHRIFT}`; ctx.fillStyle = t3Clr;
      const onRight = dpx + 36 < padL + plotW;
      ctx.textAlign = onRight ? 'left' : 'right';
      ctx.fillText(lbl, onRight ? dpx + 9 : dpx - 9, dpy + 4);
    });
  }

  // ── 3-Punkte-Marker C ──
  if (mode3pt && threePtMark && c1) {
    const { xC } = threePtMark;
    const useCat = (sysMode === 'nfl' && c2) ? c2 : c1;
    const yCat   = catYD(xC, useCat);   // Zeichenkoordinate
    const px     = cx(xC);
    const py     = cy(yCat);
    const CR     = 6;
    // Kreuz
    ctx.save();
    ctx.strokeStyle = DF.akzent; ctx.lineWidth = 2; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(px - CR, py); ctx.lineTo(px + CR, py); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, py - CR); ctx.lineTo(px, py + CR); ctx.stroke();
    // Kreis
    ctx.beginPath(); ctx.arc(px, py, CR, 0, Math.PI * 2);
    ctx.strokeStyle = DF.akzent; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 0.15; ctx.fillStyle = DF.akzent; ctx.fill();
    ctx.globalAlpha = 1;
    // Label «C»
    const label = 'C';
    ctx.font = `bold 10px ${DIAGRAMM_SCHRIFT}`;
    const boxW = ctx.measureText(label).width + 14, boxH = 20, gap = 7;
    const onRight = (px + boxW + gap + 4) <= (padL + plotW);
    const bx = onRight ? px + gap : px - boxW - gap;
    const by = py - boxH / 2;
    ctx.fillStyle = DF.marke; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 4); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = DF.markeText; ctx.textAlign = 'left';
    ctx.fillText(label, bx + 7, by + 13.5);
    ctx.restore();
  }

  // ── Mindestabstand-Zone (Schraffur + gestrichelte Randlinie) ──
  if (hasSok && minClearance !== null && _showMinClearance) {
    const cT2mc  = (sysMode === 'nfl' && c2_vem_draw) ? c2_vem_draw : c2;
    const offsets = isEl ? [+minClearance, -minClearance] : [+minClearance];
    ctx.save();
    // Clip auf Plot-Bereich
    ctx.beginPath();
    ctx.rect(padL, padT, plotW, plotH);
    ctx.clip();
    // Schraffur-Pattern
    const patSz = 7;
    const patC  = document.createElement('canvas');
    patC.width  = patC.height = patSz;
    const pctx  = patC.getContext('2d');
    pctx.strokeStyle = t2Clr;
    pctx.lineWidth   = 0.7;
    pctx.beginPath();
    pctx.moveTo(0, patSz); pctx.lineTo(patSz, 0);
    pctx.moveTo(-patSz/2, patSz/2); pctx.lineTo(patSz/2, -patSz/2);
    pctx.moveTo(patSz/2, patSz * 1.5); pctx.lineTo(patSz * 1.5, patSz/2);
    pctx.stroke();
    const pat = ctx.createPattern(patC, 'repeat');
    // Schraffierte Fläche T2
    offsets.forEach(off => {
      ctx.beginPath();
      for (let i = 0; i <= 300; i++) {
        const x = (i / 300) * L;
        const y = catYD(x, cT2mc) + off;
        i === 0 ? ctx.moveTo(cx(x), cy(y)) : ctx.lineTo(cx(x), cy(y));
      }
      if (!isEl && off > 0) {
        // NFL/RFL: Gefahrenraum bis Diagrammunterrand
        ctx.lineTo(cx(L), padT + plotH);
        ctx.lineTo(cx(0), padT + plotH);
      } else {
        for (let i = 300; i >= 0; i--) {
          const x = (i / 300) * L;
          ctx.lineTo(cx(x), cy(catYD(x, cT2mc)));
        }
      }
      ctx.closePath();
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = pat;
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    // Gestrichelte Randlinie T2
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.35;
    offsets.forEach(off => {
      ctx.strokeStyle = t2Clr;
      ctx.beginPath();
      for (let i = 0; i <= 300; i++) {
        const x = (i / 300) * L;
        const y = catYD(x, cT2mc) + off;
        i === 0 ? ctx.moveTo(cx(x), cy(y)) : ctx.lineTo(cx(x), cy(y));
      }
      ctx.stroke();
    });
    // T3 (falls vorhanden) — Schraffur + gestrichelte Randlinie
    if (showT3 && c3) {
      const _t3Rmc = parseFloat(document.getElementById('temp3')?.value);
      const _t3Vmc = isNaN(_t3Rmc) ? 80 : _t3Rmc;
      const t3Clr  = t2TempColor(_t3Vmc);
      // Schraffur-Pattern T3
      const patT3C = document.createElement('canvas');
      patT3C.width = patT3C.height = patSz;
      const pt3ctx = patT3C.getContext('2d');
      pt3ctx.strokeStyle = t3Clr;
      pt3ctx.lineWidth   = 0.7;
      pt3ctx.beginPath();
      pt3ctx.moveTo(0, patSz); pt3ctx.lineTo(patSz, 0);
      pt3ctx.moveTo(-patSz/2, patSz/2); pt3ctx.lineTo(patSz/2, -patSz/2);
      pt3ctx.moveTo(patSz/2, patSz * 1.5); pt3ctx.lineTo(patSz * 1.5, patSz/2);
      pt3ctx.stroke();
      const patT3 = ctx.createPattern(patT3C, 'repeat');
      // Schraffierte Fläche T3
      ctx.setLineDash([]);
      offsets.forEach(off => {
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) {
          const x = (i / 300) * L;
          const y = catYD(x, c3) + off;
          i === 0 ? ctx.moveTo(cx(x), cy(y)) : ctx.lineTo(cx(x), cy(y));
        }
        if (!isEl && off > 0) {
          ctx.lineTo(cx(L), padT + plotH);
          ctx.lineTo(cx(0), padT + plotH);
        } else {
          for (let i = 300; i >= 0; i--) {
            const x = (i / 300) * L;
            ctx.lineTo(cx(x), cy(catYD(x, c3)));
          }
        }
        ctx.closePath();
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = patT3;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
      // Gestrichelte Randlinie T3
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = t3Clr;
      offsets.forEach(off => {
        ctx.beginPath();
        for (let i = 0; i <= 300; i++) {
          const x = (i / 300) * L;
          const y = catYD(x, c3) + off;
          i === 0 ? ctx.moveTo(cx(x), cy(y)) : ctx.lineTo(cx(x), cy(y));
        }
        ctx.stroke();
      });
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════
// CANVAS-INTERAKTION (Maus & Touch)
// ═══════════════════════════════════════════════════════════════
const canvas  = document.getElementById('main-canvas');
const tooltip = document.getElementById('drag-tooltip');

// Bildschirmkoordinaten → CSS-Pixel im Canvas-Zeichenraum umrechnen.
// ctx.setTransform(dpr,...) macht den Zeichenraum identisch mit CSS-Pixeln,
// daher ist keine dpr-Skalierung nötig.
function canvasPt(e) {
  const rect = canvas.getBoundingClientRect();
  const src  = e.touches ? e.touches[0] : (e.changedTouches ? e.changedTouches[0] : e);
  return {
    x: src.clientX - rect.left,
    y: src.clientY - rect.top,
    clientX: src.clientX,
    clientY: src.clientY
  };
}

// ── Highlight-Karte: Schlüsselwerte für einen Messpunkt ──
function mpBlock(xv, badge, cls, compact = false, c3Curve = null, t3Clr = 'var(--muted)', t2Clr = 'var(--muted)') {
  if (!calcState) return '';
  const { h1, L } = calcState;
  const catY    = (x, c) => kettenY(c, x);
  const isRfl   = sysMode === 'rfl';
  const isEl    = sysMode === 'el';
  const y2      = catY(xv, anzeigeKurve('T2'));             // wie im Diagramm gezeichnet
  // SOK-Interpolation an Position xv
  const sokL = getSokMumLeft();
  const sokR = getSokMumRight();
  const hasSok = sokL !== null || sokR !== null;
  const _sl = sokL ?? sokR ?? 0;
  const _sr = sokR ?? sokL ?? 0;
  const sokAtX  = hasSok ? _sl + (_sr - _sl) * xv / L : 0;
  // Δh = Abstand Horizontale durch den linken Aufhängepunkt → Kurve, identisch mit der
  // Diagramm-Annotation: bei unterschiedlicher SOK links/rechts in m ü. M. gemessen
  // (die Höhen «über SOK» enthalten den SOK-Anstieg bis x nicht)
  // Bezug wählbar (mpBezug): Werte absolut gerechnet, damit SOK links ≠ rechts stimmt
  const { h2 } = calcState;
  const refAbs  = mpBezugHoehe(xv, h1 + (hasSok ? _sl : 0), h2 + (hasSok ? _sr : 0), L);
  const deltaH  = refAbs - (y2 + sokAtX);
  const dhLabel = isRfl ? mpBezugText() : mpBezugText() + ' ' + t('dyn.bei.t2');
  const dhValue = deltaH;
  const valSize  = compact ? '1.35rem' : '2rem';
  const sagSize  = compact ? '1.1rem'  : '1.35rem';
  const topGap   = compact ? '.5rem'   : '1.2rem';
  const y2_mum  = y2 + sokAtX;

  // Hauptwert: m ü. M. wenn SOK gesetzt, sonst über SOK
  const mainVal   = hasSok ? f3(y2_mum) : f3(y2);
  const mainUnit  = hasSok ? t('dyn.ueber.mum') : 'm';
  const tsHoeheKey = isEl ? 'res.seil.hoehe' : 'res.ts.hoehe';
  const subLabel  = hasSok
    ? `${t(tsHoeheKey)} &nbsp;<span>(${f3(y2)} m ${t('dyn.ueber.sok')})</span>`
    : `${t(tsHoeheKey)} ${t('dyn.ueber.sok')}`;

  // Für die Ergebnisleiste: Werte des ersten Messpunkts übernehmen
  if (badge === 'M1') _leiste = { art: 'M1', x: xv, f: dhValue, hoehe: hasSok ? y2_mum : y2,
                                   mum: hasSok, f3: null, farbe: t2Clr, farbe3: t3Clr };
  // T3-Vergleichswerte — gleiche Struktur wie T2 (Δh groß, Ts-Höhe klein)
  let t3Row = '';
  if (c3Curve) {
    const y3      = catY(xv, c3Curve);
    const y3_disp = hasSok ? f3(y3 + sokAtX) : f3(y3);
    const sag3    = refAbs - (y3 + sokAtX);
    if (badge === 'M1' && _leiste) _leiste.f3 = sag3;
    const t3hKey  = isEl ? 'res.seil.hoehe' : 'res.ts.hoehe';
    const y3SubLbl = hasSok
      ? `${t(t3hKey)} &nbsp;<span>(${f3(y3)} m ${t('dyn.ueber.sok')})</span>`
      : `${t(t3hKey)} ${t('dyn.ueber.sok')}`;
    t3Row = `
      <div style="margin-top:.5rem;padding-top:.4rem;border-top:1px dashed var(--border2)">
        <div style="font-size:.72rem;font-weight:600;color:${t3Clr};letter-spacing:.02em">${badge}' &nbsp;T<sub style="font-size:.8em">3</sub></div>
        <div style="font-size:${compact?'1.05rem':'1.35rem'};font-weight:700;color:${t3Clr}">${f3(sag3)}<span style="font-size:.72rem;margin-left:.2rem">m</span></div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:.1rem">${mpBezugKurz()} T<sub style="font-size:.8em">3</sub></div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:${compact?'.5rem':'1rem'}">${y3SubLbl}</div>
        <div style="font-size:${compact?'.9rem':'1.1rem'};font-weight:600;color:${t3Clr}">${y3_disp}<span style="font-size:.72rem;margin-left:.2rem">${mainUnit}</span></div>
      </div>`;
  }

  return `
    <div class="istzustand-main">
      <div class="istzustand-label" style="color:${t2Clr}">${badge} · x = ${xv.toFixed(2)} m</div>
      <div class="istzustand-value" style="font-size:${valSize};color:${t2Clr}">${f3(dhValue)}<span class="istzustand-unit">m</span></div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:.15rem">${dhLabel}</div>
      <div style="font-size:.7rem;color:var(--muted);margin-top:${topGap}">${subLabel}</div>
      <div class="istzustand-value" style="font-size:${sagSize};color:${t2Clr}">${mainVal}<span class="istzustand-unit">${mainUnit}</span></div>
      ${t3Row}
    </div>`;
}

// ── Mitlaufende Ergebnisleiste (schmale Bildschirme, v. a. Tablet hochkant) ──
// Zeigt die Kernwerte, solange weder Diagramm noch Ergebniskarte sichtbar sind.
// Die Werte stammen aus updateHighlightCard()/mpBlock() — dieselben Zahlen wie
// in der Karte, keine zweite Rechnung.
let _leiste = null;
function updateErgebnisleiste() {
  const bar = document.getElementById('ergebnisleiste');
  if (!bar) return;
  const inhalt = bar.querySelector('.el-inhalt');
  if (document.body.classList.contains('ergebnis-veraltet') || !calcState || !_leiste) {
    inhalt.innerHTML = `<span class="el-warn">⚠ ${t('ui.leiste.pruefen')}</span>`;
    return;
  }
  const L = _leiste, T2 = calcState.T2, fmtT = v => `${v > 0 ? '+' : ''}${v} °C`;
  const einheit = L.mum ? t('dyn.ueber.mum') : `m ${t('dyn.ueber.sok')}`;
  const kopf = L.art === 'M1'
    ? `M1 · x ${L.x.toFixed(2)} m`
    : `${sysMode === 'rfl' ? 'T' : 'T<sub>2</sub>'} ${fmtT(T2)}`;
  const fLbl = L.art === 'M1' ? mpBezugKurz() : 'f';
  const teile = [
    `<span class="el-kopf">${kopf}</span>`,
    `<span>${fLbl} <b style="color:${L.farbe}">${f3(L.f)}</b> m</span>`,
    `<span>H <b>${fN(calcState.c2.H, 0)}</b> N</span>`,
    `<span><b>${f3(L.hoehe)}</b> ${einheit}</span>`,
  ];
  if (L.f3 !== null && L.f3 !== undefined && showT3) {
    const T3 = parseFloat(document.getElementById('temp3')?.value);
    teile.push(`<span class="el-t3">T<sub>3</sub> ${isNaN(T3) ? '' : fmtT(T3)}: ${fLbl} <b style="color:${L.farbe3}">${f3(L.f3)}</b> m</span>`);
  }
  inhalt.innerHTML = teile.join('');
}
function zumDiagramm() {
  document.querySelector('.canvas-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Sichtbarkeit: nur wenn Diagramm UND Ergebniskarte aus dem Bild sind
(function () {
  const bar = document.getElementById('ergebnisleiste');
  const ziele = [document.querySelector('.canvas-card'), document.getElementById('highlight-card')].filter(Boolean);
  if (!bar || !ziele.length || !('IntersectionObserver' in window)) return;
  const sichtbar = new Map();
  const obs = new IntersectionObserver(eintraege => {
    eintraege.forEach(e => sichtbar.set(e.target, e.isIntersecting));
    const zeigen = ![...sichtbar.values()].some(Boolean);
    bar.classList.toggle('an', zeigen);
    document.body.classList.toggle('leiste-an', zeigen);
  }, { threshold: 0.08 });
  ziele.forEach(z => obs.observe(z));
})();

function updateHighlightCard() {
  const el = document.getElementById('highlight-card');
  _leiste = null;
  if (!calcState) { if (el) el.innerHTML = ''; updateErgebnisleiste(); return; }
  const { c1, c2, h1, h2, L, sh, flCombo, c2_vem, c3: _c3state } = calcState;
  // T3 wie T2: bei N-FL mit Kombination die Lage des kombinierten Systems (wie im Diagramm)
  const _c3curve = (showT3 && _c3state) ? (calcState.c3_vem ?? _c3state) : null;
  const _t3clr   = _c3curve ? t2TempColor((v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp3')?.value))) : null;
  // Kurvenfarbe: R-FL = primary rot, sonst T2-Temperaturfarbe
  const _t2v = (v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp2')?.value));
  const curveClr = sysMode === 'rfl' ? 'var(--primary)' : t2TempColor(_t2v);
  const catY    = (x, c) => kettenY(c, x);
  const yFdSoll = x => (h1 - sh) + (h2 - h1) * x / L;
  const isNfl   = sysMode === 'nfl';
  const isEl    = sysMode === 'el';
  const isRfl_h = sysMode === 'rfl';
  const cIst    = (isNfl || isEl) ? c2 : (isRfl_h && c2 !== c1 ? c2 : c1);
  const useVem  = isNfl && flCombo && c2_vem;             // kombiniertes System verfügbar?
  const cDisp   = useVem ? c2_vem : cIst;                 // für Höhenanzeige: kombiniert oder Ts
  const tempLabel = (isNfl || isEl) ? ` ${t('dyn.bei.t2')}` : '';
  // SOK für m ü. M. Anzeige
  const sokLH = getSokMumLeft();
  const sokRH = getSokMumRight();
  const hasSokH = sokLH !== null || sokRH !== null;
  const sokLHv  = sokLH ?? sokRH ?? 0;
  const sokRHv  = sokRH ?? sokLH ?? 0;
  const sokAtXH = x => sokLHv + (sokRHv - sokLHv) * x / L;
  // Höhe in Anzeigeeinheit
  const dispH = (x, y) => hasSokH ? y + sokAtXH(x) : y;
  const _hKey = isEl ? 'res.seil.hoehe' : 'res.ts.hoehe';
  const seilLabel = hasSokH ? t(_hKey) : `${t(_hKey)} ${t('dyn.ueber.sok')}`;
  const dhLabel = isEl ? t('res.sag') : t('res.sag.ts');

  const hasM1 = probeX1 !== null;
  const hasM2 = probeX2 !== null;
  const hasM3 = probeX3 !== null;
  const hasM4 = probeX4 !== null;

  const rflCls = sysMode === 'rfl' ? ' rfl' : '';

  if (!hasM1 && !hasM2 && !hasM3 && !hasM4) {
    // Tiefpunkt-Werte — Höhe aus kombiniertem System (wenn verfügbar), Durchhang aus Ts
    const x_ist   = cDisp.x_low;
    const y2_raw  = cDisp.y_low;                  // Tiefpunkt des angezeigten Systems
    const y2_disp = dispH(x_ist, y2_raw);
    const sag     = cDisp.sag;                     // geometrischer Sehnen-Durchhang (identisch mit Diagramm-f)
    _leiste = { art: 'tiefpunkt', x: x_ist, f: sag, hoehe: y2_disp, mum: hasSokH,
                f3: _c3curve ? _c3curve.sag : null, farbe: curveClr, farbe3: _t3clr };
    el.innerHTML = `
      <div class="istzustand-card${rflCls}" style="margin-bottom:.75rem">
        <div class="istzustand-main">
          <div class="istzustand-label" style="color:${curveClr}">${t('res.tiefpunkt.label')} — x₀ = ${f3(x_ist)} m</div>
          <div class="istzustand-value" style="color:${curveClr}">${f3(sag)}<span class="istzustand-unit">m</span></div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:.15rem">${dhLabel}${tempLabel}</div>
          <div style="font-size:.7rem;color:var(--muted);margin-top:.6rem">${seilLabel}${tempLabel}${hasSokH ? ` &nbsp;<span>(${f3(y2_raw)} m ${t('dyn.ueber.sok')})</span>` : ''}</div>
          <div class="istzustand-value" style="font-size:1.35rem;color:${curveClr}">${f3(y2_disp)}<span class="istzustand-unit">${hasSokH ? t('dyn.ueber.mum') : 'm'}</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem;margin:.35rem 0;width:100%">
          <div style="flex:1;height:1px;background:var(--border)"></div>
          <span class="sok-hinweis" style="font-size:.65rem;color:var(--tertiary);font-style:italic;white-space:nowrap">${t('ui.sok.hinweis')}</span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>
      </div>`;
  } else {
    const points = [
      hasM1 ? { xv: probeX1, badge: 'M1', cls: 'm1' } : null,
      hasM2 ? { xv: probeX2, badge: 'M2', cls: 'm2' } : null,
      hasM3 ? { xv: probeX3, badge: 'M3', cls: 'm3' } : null,
      hasM4 ? { xv: probeX4, badge: 'M4', cls: 'm4' } : null,
    ].filter(Boolean);
    const total = points.length;
    const compact = total > 2;
    const blocks = points.map((p, i) => {
      const divider = (!compact && i < total - 1)
        ? '<div class="istzustand-divider" style="margin:0 .4rem"></div>' : '';
      return mpBlock(p.xv, p.badge, p.cls, compact, _c3curve, _t3clr, curveClr) + divider;
    }).join('');
    const cols = total === 4 ? '1fr 1fr 1fr 1fr' : total === 3 ? '1fr 1fr 1fr' : '';
    const cardStyle = compact
      ? `display:grid;grid-template-columns:${cols};gap:.75rem 1rem;`
      : '';
    el.innerHTML = `
      <div class="istzustand-card${rflCls}" style="margin-bottom:.75rem;${cardStyle}">
        ${blocks}
        <div style="${compact ? 'grid-column:1/-1;' : ''}display:flex;align-items:center;gap:.5rem;margin:.35rem 0;width:100%">
          <div style="flex:1;height:1px;background:var(--border)"></div>
          <span class="sok-hinweis" style="font-size:.65rem;color:var(--tertiary);font-style:italic;white-space:nowrap">${t('ui.sok.hinweis')}</span>
          <div style="flex:1;height:1px;background:var(--border)"></div>
        </div>
      </div>`;
  }
  updateErgebnisleiste();
}

// Reset: löscht nur ungesperrte Messpunkte (x und H)
function clearMesspunkte() {
  const xs = _probeXs();
  for (let i = 0; i < 4; i++) {
    if (probeSperre[i]) continue;
    xs[i] = null; probeHWerte[i] = null;
  }
  _probeXsSetzen(xs);
  if (!probeSperre.some(Boolean)) {
    minClearance = null;
    const mcInp = document.getElementById('hind-min');
    if (mcInp) mcInp.value = '';
  }
  _mpAnzeigen();
  quickDraw();
  updateAllMesspunkte();
  berechnen();
  _triggerDrawingRebuild();
}

// ── Messpunkte: x, H-Punkt und Schloss ──
function _probeXs() { return [probeX1, probeX2, probeX3, probeX4]; }
function _probeXsSetzen(xs) {
  [probeX1, probeX2, probeX3, probeX4] = xs.map(v => (Number.isFinite(v) ? v : null));
  _probeXs().forEach((v, i) => { const el = document.getElementById(`probe-x${i + 1}`); if (el) el.value = v === null ? '' : v.toFixed(2); });
}
function _mpLive() { return { x: _probeXs(), h: [...probeHWerte], lock: [...probeSperre], verbinden: hVerbinden }; }
function _mpNormieren(mp) {
  const z = a => [0, 1, 2, 3].map(i => (Number.isFinite(a?.[i]) ? a[i] : null));
  return { x: z(mp?.x), h: z(mp?.h), lock: [0, 1, 2, 3].map(i => !!mp?.lock?.[i]), verbinden: !!mp?.verbinden };
}
function _mpSetzen(mp) {
  const n = _mpNormieren(mp);
  _probeXsSetzen(n.x);
  probeHWerte = n.h; probeSperre = n.lock; hVerbinden = n.verbinden;
  _mpAnzeigen();
}
// Eingabefelder und Schlösser an den Zustand angleichen
function _mpAnzeigen() {
  for (let i = 1; i <= 4; i++) {
    const zu = probeSperre[i - 1];
    const hx = document.getElementById(`probe-h${i}`);
    if (hx && document.activeElement !== hx) hx.value = probeHWerte[i - 1] ?? '';
    [hx, document.getElementById(`probe-x${i}`)].forEach(el => { if (el) el.readOnly = zu; });
    const s = document.getElementById(`probe-lock-${i}`);
    if (s) { s.setAttribute('aria-pressed', zu ? 'true' : 'false'); s.title = t(zu ? 'probe.entsperren' : 'probe.sperren'); }
  }
  _hZeileStatus();
}
function setProbeH(i, wert) {
  if (probeSperre[i - 1]) return;
  const v = parseFloat(String(wert).replace(',', '.'));
  probeHWerte[i - 1] = Number.isFinite(v) ? v : null;
  berechnenEntprellt();
  _triggerDrawingRebuild();
}
function messpunktSperren(i) {
  probeSperre[i - 1] = !probeSperre[i - 1];
  _mpAnzeigen();
}
function setHVerbinden(an) {
  hVerbinden = !!an;
  berechnen();
  _triggerDrawingRebuild();
}
// H-Punkte eines Messpunkt-Stands als Hindernis (Form wie abschnitt.js)
function _hPunkteHindernis(mp) {
  const n = _mpNormieren(mp);
  const punkte = [0, 1, 2, 3].filter(i => n.x[i] !== null && n.h[i] !== null).map(i => ({ x: n.x[i], h: n.h[i], m: i + 1 }));
  return punkte.length ? [{ id: 'H', name: t('probe.h.name'), verbinden: n.verbinden, punkte }] : [];
}
// Messpunkte eines Abschnittsfelds (geöffnetes Feld: aktuelle Eingaben)
function _mpFeld(i) {
  return i === abschnittOffenesFeld() ? _mpLive() : (abschnitt.mp?.[i] ?? null);
}

function updateAllMesspunkte() {
  updateHighlightCard();
}


// ── Hindernisse oberhalb + Abstandsprüfung ──────────────────────────────────
// Geprüft wird der oberste Leiter (Tragseil bzw. Einzelleiter) über alle
// Lastfälle des Leitersystems (Optionen «Lastfälle», abschnitt.js); massgebend
// ist der kleinste Abstand zur Unterkante im Bereich von–bis.
let lastfallEinst = (() => { try { return JSON.parse(localStorage.getItem('dh_lastfaelle')) || null; } catch { return null; } })();

function _lastfallText(f) {
  const teile = [`${f.aktuell ? t('lf.aktuell') + ' ' : ''}${f.T < 0 ? '−' : f.T > 0 ? '+' : ''}${Math.abs(f.T)} °C`];
  if (f.zl > 0) teile.push(t('lf.eis.kurz').replace('{zl}', fN(f.zl, 0)));
  if (sysMode !== 'el') teile.push(f.abgenutzt ? t('lf.abgenutzt') : t('lf.neu'));
  return teile.join(', ');
}

// Hindernis des angezeigten Felds = H-Punkte der Messpunkte
function _hindernisseAngezeigt() { return _hPunkteHindernis(_mpLive()); }

// Nachweis für eine Liste Hindernisse. ov: Feldwerte (L, Lm, h1, h2) für
// rechneFall; sokFn: x → SOK m ü. M. (oder null, dann Höhen über SOK).
// Hindernishöhen gelten immer in m ü. M. — ohne SOK m ü. M. (direkt oder aus
// Koordinaten) ist kein Vergleich möglich: keine Prüfung, nur Hinweis.
// Schalter unter dem Diagramm: aus → nur der aktuelle Zustand (T₂) wird geprüft
let lastfaelleAktiv = true;
function setLastfaelleAktiv(an) {
  lastfaelleAktiv = !!an;
  const cb = document.getElementById('lastfaelle-aktiv');
  if (cb) cb.checked = lastfaelleAktiv;
  renderObstacleList();
  berechnen();
  _triggerDrawingRebuild();
}

function abstandsNachweis(liste, ov = {}, sokFn = null) {
  if (!liste.length) return [];
  if (!sokFn) return liste.map(h => ({ h, best: null, ok: null, ohneSok: true }));
  const L = ov.L ?? getActiveSpan();
  const kurven = [];
  // Aktueller Zustand: Bezug für die Lage des Hindernisses (Einzelleiter) und Prüfung ohne Lastfälle
  let aktuell = null;
  try {
    const r = rechneFall({ ...ov });
    if (r.oben) aktuell = { f: { T: r.e.T2, zl: r.e.ZL || 0, abgenutzt: (ov.wearPct ?? wearPct) > 0, aktuell: true }, c: r.oben };
  } catch (e) { _spur('Abstandsprüfung', e, 'debug'); }
  if (lastfaelleAktiv) {
    for (const f of lastfaelle(lastfallEinst, sysMode)) {
      try {
        const r = rechneFall({ ...ov, T2: f.T, wearPct: f.abgenutzt ? currentWearMax : 0, zl: f.zl });
        if (r.oben) kurven.push({ f, c: r.oben });
      } catch (e) { _spur('Abstandsprüfung', e, 'debug'); }
    }
  } else if (aktuell) kurven.push(aktuell);
  // Bereich aller Lastfälle (höchste bis tiefste Leiterlage) für das Diagramm
  const huelle = kurven.length > 1 ? Array.from({ length: 81 }, (_, i) => {
    const x = L * i / 80, y = kurven.map(k => kettenY(k.c, x) + sokFn(x));
    return { x, min: Math.min(...y), max: Math.max(...y) };
  }) : null;
  return liste.map(h => {
    // Einzelleiter: Hindernis unter dem Leiter (Leiter führt darüber hinweg) automatisch erkannt
    const unten = sysMode === 'el' && !!aktuell
      && hindernisSeite(x => kettenY(aktuell.c, x) + sokFn(x), h.punkte, L) === 'unten';
    let best = null;
    const jePunkt = h.punkte.filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.h))
      .map(p => ({ ...p, abstand: null })).sort((a, b) => a.x - b.x);
    for (const k of kurven) {
      const hoehe = x => kettenY(k.c, x) + sokFn(x);
      const r = abstandHindernis(hoehe, h.punkte, h.verbinden, L, unten);
      if (r && (!best || r.abstand < best.abstand)) best = { ...r, fall: k.f, c: k.c };
      jePunkt.forEach(p => {
        if (p.x < 0 || p.x > L) return;
        const a = unten ? hoehe(p.x) - p.h : p.h - hoehe(p.x);
        if (p.abstand === null || a < p.abstand) p.abstand = a;
      });
    }
    const grenze = minClearance ?? 0;
    return { h, best, ok: best ? best.abstand >= grenze : null, jePunkt, unten, huelle };
  });
}

// Nachweis für das angezeigte Feld (wird in berechnen() aufgerufen)
function _nachweisAktualisieren() {
  const sL = getSokMumLeft(), sR = getSokMumRight();
  const hasSok = sL !== null || sR !== null;
  const L = getActiveSpan();
  const l = sL ?? sR, r = sR ?? sL;
  _nachweis = abstandsNachweis(_hindernisseAngezeigt(), {}, hasSok ? (x => l + (r - l) * x / L) : null);
}

function setMindestabstand(wert) {
  minClearance = wert === '' || wert === null ? null : parseFloat(wert);
  if (!Number.isFinite(minClearance)) minClearance = null;
  const b = document.getElementById('hind-min');
  const txt = minClearance === null ? '' : String(minClearance);
  if (b && b.value !== txt && document.activeElement !== b) b.value = txt;
  berechnenEntprellt();
  _triggerDrawingRebuild();
}

// Bereich «H-Punkte» (Mindestabstand, Zone, Punkte verbinden, Ergebnis): nur in
// der Ansicht «Diagramm» und nur mit SOK m ü. M. — ohne SOK ist keine Prüfung
// möglich (H1–H4 sind dann gesperrt, Link zu den Mastangaben).
var _ansichtDiagramm = true;
function _obsSichtbarkeit() {
  const sec = document.getElementById('obs-section');
  if (!sec) return;
  const hasSok = getSokMumLeft() !== null || getSokMumRight() !== null;
  zeigeElement(sec, _ansichtDiagramm && hasSok);
}

// H-Zeile an den SOK-Bezug anpassen: ohne SOK m ü. M. gesperrt (Link zu den
// Mastangaben), mit SOK unter jedem Wert die Höhe über SOK.
function _hZeileStatus() {
  const sL = getSokMumLeft(), sR = getSokMumRight();
  const hasSok = sL !== null || sR !== null;
  const l = sL ?? sR, r = sR ?? sL, L = getActiveSpan();
  const xs = _probeXs();
  for (let i = 1; i <= 4; i++) {
    const inp = document.getElementById(`probe-h${i}`);
    if (inp) {
      inp.disabled = !hasSok;
      inp.placeholder = t(hasSok ? 'probe.h.placeholder' : 'probe.h.sokfehlt');
    }
    const rel = document.getElementById(`probe-h-rel-${i}`);
    const x = xs[i - 1], h = probeHWerte[i - 1];
    if (rel) rel.textContent = hasSok && x !== null && h !== null && L > 0
      ? `≙ ${fN(h - (l + (r - l) * x / L), 2)} m ${t('dyn.ueber.sok')}` : '';
  }
  zeigeElement(document.getElementById('probe-sok-link'), !hasSok);
  zeigeElement(document.getElementById('probe-sok-hinweis'), !hasSok);
  // Ohne SOK keine vier gesperrten Felder, nur der Hinweis mit Link (eine Zeile)
  zeigeElement(document.getElementById('probe-h-section'), hasSok);
  _obsSichtbarkeit();
}
// Mastangaben öffnen und ins Feld SOK m ü. M. springen
function sokEintragen() {
  const det = document.getElementById('mastangaben');
  if (det) det.open = true;
  const el = document.getElementById('sok-mum-left');
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => el.focus({ preventScroll: true }), 300);
}

// Ergebnis der H-Punkte (ohne die Eingabefelder neu aufzubauen)
function _hindernisErgebnisse() {
  _hZeileStatus();
  const hasSok = getSokMumLeft() !== null || getSokMumRight() !== null;
  const liste = _hindernisseAngezeigt();
  const sokHw = document.getElementById('hind-sok-fehlt');
  if (sokHw) zeigeElement(sokHw, !hasSok && liste.length > 0);
  const el = document.getElementById('hind-erg-H');
  if (!el) return;
  el.className = 'hind-erg';
  const n = _nachweis[0];
  if (!liste.length) { el.textContent = t('hind.leer'); return; }
  if (n?.ohneSok) { el.textContent = t('hind.sok.fehlt'); el.classList.add('abs-fehlt'); return; }
  if (!n || !n.best) { el.textContent = t('hind.ausserhalb'); return; }
  const je = (n.jePunkt || []).filter(p => p.abstand !== null)
    .map(p => `H${p.m} ${fN(p.abstand, 2)} m`).join(' · ');
  el.classList.add(n.ok ? 'ok' : 'nok');
  el.textContent = `${n.ok ? '✓' : '✗'} ${t('hind.massgebend')}: a = ${fN(n.best.abstand, 2)} m${minClearance !== null ? ` (≥ ${fN(minClearance, 2)})` : ''} · ${_lastfallText(n.best.fall)} · x = ${fN(n.best.x, 1)} m${je ? `  |  ${je}` : ''}`;
}

// Kopfzeile der H-Punkte: Mindestabstand, Zone, Punkte verbinden, Lastfälle, Ergebnis
function renderObstacleList() {
  const sec = document.getElementById('obs-section');
  if (!sec) return;
  const knopf = 'font-size:.7rem;padding:.14rem .45rem;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--muted);cursor:pointer';
  sec.innerHTML = `<div class="hind-kopf">
    <span class="hind-titel">${t('hind.titel')}</span>
    <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
      <label class="hind-min-lbl" for="hind-min">${t('hind.mindest')}
        <input type="number" id="hind-min" class="hind-inp hind-num" step="0.01" min="0" placeholder="—"
          value="${minClearance ?? ''}" oninput="setMindestabstand(this.value)"> m</label>
      <label class="schalter-zeile hind-verb" title="${escHtml(t('ui.minabstand.titel'))}"><input type="checkbox" role="switch" ${_showMinClearance ? 'checked' : ''}
        onchange="_showMinClearance=this.checked;quickDraw();_triggerDrawingRebuild()"><span class="schalter" aria-hidden="true"></span><span>${t('hind.zone')}</span></label>
      <label class="schalter-zeile hind-verb" title="${escHtml(t('hind.verbinden.titel'))}"><input type="checkbox" role="switch" id="h-verbinden" ${hVerbinden ? 'checked' : ''}
        onchange="setHVerbinden(this.checked)"><span class="schalter" aria-hidden="true"></span><span>${t('hind.verbinden')}</span></label>
      <label class="schalter-zeile hind-verb" title="${escHtml(t('lf.aktiv.titel'))}"><input type="checkbox" role="switch" id="lastfaelle-aktiv" ${lastfaelleAktiv ? 'checked' : ''}
        onchange="setLastfaelleAktiv(this.checked)"><span class="schalter" aria-hidden="true"></span><span>${t('lf.aktiv')}</span></label>
      <button onclick="openLastfaelle()" style="${knopf}"${lastfaelleAktiv ? '' : ' disabled'}>${t('lf.knopf')}</button>
    </div>
  </div>
  <p id="hind-sok-fehlt" class="hind-legende abs-fehlt" style="display:none">${t('hind.sok.hinweis')}</p>
  <span class="hind-erg" id="hind-erg-H" aria-live="polite"></span>
  <p class="hind-legende">${t('hind.legende')}</p>`;
  _mpAnzeigen();
  _hindernisErgebnisse();
}

// ── Optionen: Lastfälle je Leitersystem ──
let _lfSys = 'nfl';
function openLastfaelle() {
  _lfSys = sysMode;
  _lastfallFormular();
  document.getElementById('lastfall-modal').classList.add('open');
}
function closeLastfaelle() { document.getElementById('lastfall-modal').classList.remove('open'); }
// tippen = true: Temperaturfeld nicht neu schreiben — sonst verschwindet ein
// eben getipptes «-» (noch keine Zahl) sofort wieder.
function _lastfallFormular(tippen = false) {
  const e = lastfallEinstellung(lastfallEinst, _lfSys);
  ['nfl', 'rfl', 'el'].forEach(s => document.getElementById(`lf-seg-${s}`)?.classList.toggle('active', s === _lfSys));
  if (!tippen) document.getElementById('lf-temps').value = e.temperaturen.join('; ');
  document.getElementById('lf-eis').checked = e.eis;
  document.getElementById('lf-zl').value = e.zl;
  document.getElementById('lf-abn').checked = e.abnutzung;
  zeigeElement(document.getElementById('lf-abn-zeile'), _lfSys !== 'el');
  document.getElementById('lf-anzahl').textContent = t('lf.anzahl').replace('{n}', lastfaelle(lastfallEinst, _lfSys).length);
}
// zlVonHand: Z_L wurde im Feld geändert → Wert übernehmen; sonst gilt der
// früher gesetzte Wert bzw. die Vorgabe 15 N/m.
function _lastfallAusFormular(zlVonHand = false) {
  const einst = { ...(lastfallEinst || {}) };
  const alt = lastfallEinstellung(lastfallEinst, _lfSys);
  const vorher = (lastfallEinst && lastfallEinst[_lfSys]) || {};
  einst[_lfSys] = {
    temperaturen: temperaturenLesen(document.getElementById('lf-temps').value),
    eis: document.getElementById('lf-eis').checked,
    hoehenlage: alt.hoehenlage,
    zl: zlVonHand ? (parseFloat(document.getElementById('lf-zl').value) || 0) : (vorher.zl ?? null),
    abnutzung: document.getElementById('lf-abn').checked,
  };
  lastfallEinst = einst;
  try { localStorage.setItem('dh_lastfaelle', JSON.stringify(lastfallEinst)); } catch (e) { /* privat */ }
}
function lastfallSystem(sys) { _lastfallAusFormular(); _lfSys = sys; _lastfallFormular(); }
function lastfallVorgabe() {
  if (lastfallEinst) delete lastfallEinst[_lfSys];
  _lastfallFormular();
}
function lastfallUebernehmen() {
  _lastfallAusFormular();
  closeLastfaelle();
  berechnen();
  if (typeof abschnittAktualisieren === 'function') abschnittAktualisieren();
}

function hitTarget(px, py) {
  const R = 18;
  if ((px - view.h1x) ** 2 + (py - view.h1y) ** 2 < R * R) return 'h1';
  if ((px - view.h2x) ** 2 + (py - view.h2y) ** 2 < R * R) return 'h2';
  if (view.probe1CX !== null && Math.abs(px - view.probe1CX) < 8) return 'probe1';
  if (view.probe2CX !== null && Math.abs(px - view.probe2CX) < 8) return 'probe2';
  if (view.probe3CX !== null && Math.abs(px - view.probe3CX) < 8) return 'probe3';
  if (view.probe4CX !== null && Math.abs(px - view.probe4CX) < 8) return 'probe4';
  return null;
}

// Liegt (px,py) im Plotbereich? Koordinaten in CSS-Pixeln.
function inPlotArea(px, py) {
  return px >= view.padL && px <= view.cw - view.padR
      && py >= view.padT && py <= view.ch - view.padB;
}

// Canvas-CSS-x → reale Weltkoordinate x (geclippt auf [0, L])
function realX(canvasX) {
  return Math.max(0, Math.min(
    (view.cw - view.padL - view.padR) / view.scaleX,
    (canvasX - view.padL) / view.scaleX
  ));
}

function startDrag(e) {
  e.preventDefault();
  const { x, y } = canvasPt(e);
  const which = hitTarget(x, y);

  if (which === 'h1' || which === 'h2') {
    const startVal = parseFloat(document.getElementById(which).value) || 0;
    drag = { which, startCY: y, startVal };
    canvas.style.cursor = 'ns-resize';
  } else if (['probe1','probe2','probe3','probe4'].includes(which)) {
    if (probeSperre[+which.slice(5) - 1]) { meldung(t('probe.gesperrt'), 'info', 2500); return; }
    drag = { which, startCX: x };
    canvas.style.cursor = 'ew-resize';
  } else if (inPlotArea(x, y)) {
    const rx = realX(x);
    // Freien Messpunkt belegen; sind alle belegt, beginnt es beim ersten
    // ungesperrten neu (übrige ungesperrte werden geleert). Gesperrte bleiben.
    const xs = _probeXs();
    let k = xs.findIndex((v, i) => v === null && !probeSperre[i]);
    if (k < 0) {
      k = probeSperre.findIndex(z => !z);
      if (k < 0) { meldung(t('probe.gesperrt.alle'), 'info', 2500); return; }
      xs.forEach((_, i) => { if (!probeSperre[i]) { xs[i] = null; probeHWerte[i] = null; } });
      _mpAnzeigen();
    }
    xs[k] = rx;
    _probeXsSetzen(xs);
    const whichProbe = 'probe' + (k + 1);
    drag = { which: whichProbe, startCX: x };
    canvas.style.cursor = 'ew-resize';
    quickDraw();
    updateAllMesspunkte();
  }
}

function moveDrag(e) {
  e.preventDefault();
  const { x, y, clientX, clientY } = canvasPt(e);

  if (!drag) {
    const hit = hitTarget(x, y);
    if (hit === 'h1' || hit === 'h2')   canvas.style.cursor = 'ns-resize';
    else if (['probe1','probe2','probe3','probe4'].includes(hit)) canvas.style.cursor = 'ew-resize';
    else if (inPlotArea(x, y))          canvas.style.cursor = 'crosshair';
    else                                canvas.style.cursor = 'default';
    return;
  }

  const snap = v => Math.round(v / 0.1) * 0.1;
  if (['probe1','probe2','probe3','probe4'].includes(drag.which)) {
    const rx = snap(realX(x));
    const elMap = { probe1:'probe-x1', probe2:'probe-x2', probe3:'probe-x3', probe4:'probe-x4' };
    if (drag.which === 'probe1') probeX1 = rx;
    else if (drag.which === 'probe2') probeX2 = rx;
    else if (drag.which === 'probe3') probeX3 = rx;
    else probeX4 = rx;
    document.getElementById(elMap[drag.which]).value = rx.toFixed(2);
    quickDraw();
    updateAllMesspunkte();
    tooltip.style.display = 'block';
    tooltip.style.left = (clientX - tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top  = (clientY - 44) + 'px';
    tooltip.textContent = `x = ${rx.toFixed(2)} m`;
  } else {
    const deltaReal = -(y - drag.startCY) / view.scaleY;
    const newVal    = snap(drag.startVal + deltaReal);
    document.getElementById(drag.which).value = newVal.toFixed(2);
    tooltip.style.display = 'block';
    tooltip.style.left = (clientX - tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top  = (clientY - 44) + 'px';
    const _isH1    = drag.which === 'h1';
    const _lbl     = _isH1 ? 'h<sub>1</sub>' : 'h<sub>2</sub>';
    const _sokSide = _isH1 ? getSokMumLeft() : getSokMumRight();
    // h<sub>1</sub>/h<sub>2</sub> immer in Meter über SOK; SOK-Referenz als Zusatzinfo
    tooltip.textContent = _sokSide !== null
      ? `${_lbl} = ${newVal.toFixed(2)} m ${t('dyn.ueber.sok')}  (= ${(_sokSide + newVal).toFixed(2)} ${t('bp.mum.abbrev')})`
      : `${_lbl} = ${newVal.toFixed(2)} m ${t('dyn.ueber.sok')}`;
    quickDraw();
  }
}

function endDrag() {
  if (!drag) return;
  const wasProbe = ['probe1','probe2','probe3','probe4'].includes(drag.which);
  drag = null;
  zeigeElement(tooltip, false);
  canvas.style.cursor = 'default';
  if (wasProbe) {
    quickDraw();
    updateAllMesspunkte();
  } else {
    berechnen();
  }
}

canvas.addEventListener('mousedown',  startDrag);
canvas.addEventListener('mousemove',  moveDrag);
canvas.addEventListener('mouseup',    endDrag);
canvas.addEventListener('mouseleave', endDrag);
canvas.addEventListener('touchstart', startDrag, { passive: false });
canvas.addEventListener('touchmove',  moveDrag,  { passive: false });
canvas.addEventListener('touchend',   endDrag);
canvas.addEventListener('contextmenu', e => {
  e.preventDefault();
  const { x, y } = canvasPt(e);
  const which = hitTarget(x, y);
  const deleteMap = { probe1: ['probeX1','probe-x1'], probe2: ['probeX2','probe-x2'], probe3: ['probeX3','probe-x3'], probe4: ['probeX4','probe-x4'] };
  if (deleteMap[which] && probeSperre[+which.slice(5) - 1]) { meldung(t('probe.gesperrt'), 'info', 2500); return; }
  if (deleteMap[which]) {
    const [varName, elId] = deleteMap[which];
    if (which === 'probe1') probeX1 = null;
    else if (which === 'probe2') probeX2 = null;
    else if (which === 'probe3') probeX3 = null;
    else probeX4 = null;
    document.getElementById(elId).value = '';
    quickDraw(); updateAllMesspunkte();
  }
});

// ═══════════════════════════════════════════════════════════════
// AUTO-CALC ON INPUT CHANGE
// ═══════════════════════════════════════════════════════════════
document.querySelectorAll('input, select').forEach(el => {
  if (el.readOnly) return;   // skip passive/computed display fields
  el.addEventListener('change', berechnen);
  if (el.tagName === 'INPUT') el.addEventListener('input', () => {
    if (!drag) berechnen();
  });
});

// ═══════════════════════════════════════════════════════════════
// PDF-EXPORT — Berechnungsprotokoll (druckfertig, A4)
// ═══════════════════════════════════════════════════════════════
function buildPdfSectionHtml(projName, canvasImg) {
  if (!calcState) return '';
  const { L, Lm, spanMode, q_Ts, q_Fd, q_ges, H_Ts, H_Ts_ub, H_Fd, sh,
          h1, h2, T1, T2, alpha, EA, EA_Ts, deltaT, c1, c2, matTs, matFd, flCombo, ZL = 0 } = calcState;
  const q_H   = Q_HAENGER;
  const dh    = h2 - h1;
  const isNFL = sysMode === 'nfl';
  const isEl  = sysMode === 'el';

  // ── SOK m ü. M. ──
  const sokL   = getSokMumLeft();
  const sokR   = getSokMumRight();
  const hasSok = sokL !== null || sokR !== null;
  const sokLv  = sokL ?? sokR ?? 0;
  const sokRv  = sokR ?? sokL ?? 0;
  const sokAtX = x => sokLv + (sokRv - sokLv) * x / L;

  // ── Hilfsfunktionen für Messpunkte ──
  const catY_fn = (x, c) => kettenY(c, x);
  const cAnzeigePdf = anzeigeKurve('T2');   // gleiche Seillage wie Karte und Diagramm
  const yChordFn = x => h1 + (h2 - h1) * x / L;
  const yFdSollFn = x => (h1 - sh) + (h2 - h1) * x / L;
  const cIstPdf = (isNFL || isEl) ? c2 : c1;  // Auslegungs-Zustand

  function probeRows(xv, badge) {
    if (xv === null || xv === undefined) return '';
    const y_ts   = catY_fn(xv, cAnzeigePdf);
    // gleicher Bezug wie am Bildschirm (mpBezug), absolut gerechnet
    const _sk    = x => hasSok ? sokAtX(x) : 0;
    const sag_x  = mpBezugHoehe(xv, h1 + _sk(0), h2 + _sk(L), L) - (y_ts + _sk(xv));
    const y_ts_d = hasSok ? (y_ts + sokAtX(xv)).toFixed(2) + ` m ${t('pdf.mum.short')}` : y_ts.toFixed(2) + ` m ${t('pdf.sok.short')}`;
    let fdCell = '';
    if (!isEl) {
      const y_fd = fdUeberSok(xv, calcState, { h1, h2, sh, L });
      const y_fd_d = hasSok ? (y_fd + sokAtX(xv)).toFixed(2) + ` m ${t('pdf.mum.short')}` : y_fd.toFixed(2) + ` m ${t('pdf.sok.short')}`;
      fdCell = `<td style="padding:3px 7px">${y_fd_d}</td>`;
    }
    return `<tr>
      <td style="padding:3px 7px;color:var(--muted)">${badge} &nbsp; x = ${xv.toFixed(2)} m</td>
      <td style="padding:3px 7px">${y_ts_d}</td>
      ${fdCell}
      <td style="padding:3px 7px">${sag_x.toFixed(2)} m</td>
    </tr>`;
  }
  const hasAnyProbe = probeX1 !== null || probeX2 !== null || probeX3 !== null || probeX4 !== null;

  // Zustandsgleichung Zwischenwerte
  const G  = (q_ges * Lm) ** 2 / 24;
  const C  = EA !== null ? 1 / EA : null;
  const K  = C !== null ? G / (H_Ts ** 2) - C * H_Ts + alpha * deltaT : null;
  // Stufe 1: unbelastet → belastet (nur N-FL)
  const isNFL_ub = isNFL && !flCombo && H_Ts_ub != null && EA_Ts != null;
  const isNFL_xl = isNFL && !!flCombo;   // Rechengang wie SBB-Excel (Bezug 10 °C)
  const G_ub = isNFL_ub ? (q_ges * Lm) ** 2 / 24 : null;
  const K_ub = isNFL_ub ? (q_Ts * Lm) ** 2 / (24 * H_Ts_ub ** 2) - H_Ts_ub / EA_Ts : null;

  // dp = 2 als Vorgabe für Meterwerte; Newton-Aufrufer übergeben ihre Stellenzahl explizit.
  function tr(label, v1, v2, unit, dp = 2) {
    const fmt = v => unit === 'N' ? fN(v, dp) : v.toFixed(dp);
    const d = v2 - v1;
    const pct = v1 !== 0 ? ` (${sign(d)}${(d/Math.abs(v1)*100).toFixed(1)}%)` : '';
    const cls = d >= 0 ? 'pos' : 'neg';
    return `<tr><td>${label}</td><td>${fmt(v1)} ${unit}</td><td>${fmt(v2)} ${unit}</td>
      <td class="${cls}">${sign(d)}${fmt(Math.abs(d))} ${unit}${pct}</td></tr>`;
  }

  // Fahrdraht über SOK am Tiefpunkt — gleiche Funktion wie Diagramm und Zeichnung
  const x_ist_pdf  = anzeigeKurve('T2').x_low;
  const fd_abs_pdf = fdUeberSok(x_ist_pdf, calcState, { h1, h2, sh, L });

  const bodyHtml = `<div class="hdr">${_pdfLogo()}<div>
  <h1>${t('pdf.title')} &nbsp;(${sysName(isEl ? 'el' : isNFL ? 'nfl' : 'rfl')})</h1>
  <p>${t('pdf.erstellt')}: ${new Date().toLocaleString(currentLang === 'fr' ? 'fr-FR' : currentLang === 'it' ? 'it-IT' : 'de-DE')} &nbsp;|&nbsp;
     ${isEl ? matTs : matTs + ' + ' + matFd} &nbsp;|&nbsp;
     ${spanMode === 'ruling' ? `Lm = ${Lm.toFixed(2)} m` : `L = ${f3(L)} m`}
     ${!isEl ? `&nbsp;|&nbsp; sh = ${sh} m` : ''}</p>
</div></div>

<!-- ── Eingabewerte ── -->
<h2>${t('pdf.eingabewerte')}</h2>
<div class="step"><table class="inp">
  <tr><td>${t('pdf.systemtyp')}</td><td><strong>${isEl ? t('pdf.sys.el') : isNFL ? t('pdf.sys.nfl') : t('pdf.sys.rfl')}</strong></td></tr>
  <tr><td>${t('pdf.berechnungsmodell')}</td><td>${spanMode === 'ruling' ? `${t('pdf.span.ruling')} &nbsp; Lm = ${Lm.toFixed(2)} m &nbsp;|&nbsp; L = ${f3(L)} m` : `${t('pdf.span.single')} &nbsp; L = ${f3(L)} m`}</td></tr>
  <tr><td>${t('pdf.hoehendiff')}</td><td>Δh = h<sub>2</sub> − h<sub>1</sub> = ${f3(h2)} − ${f3(h1)} = ${f3(dh)} m</td></tr>
  ${isEl
    ? `<tr><td>${t('res.leiter.label')}</td><td><strong>${matTs}</strong> &nbsp; q = ${q_Ts.toFixed(4)} N/m${EA !== null ? ` &nbsp;|&nbsp; E·A = ${(EA/1e6).toFixed(2)} MN &nbsp;|&nbsp; α = ${(alpha*1e6).toFixed(1)}×10⁻⁶ /K` : ''}</td></tr>
       <tr><td>${t('pdf.befhoehen')}</td><td>h<sub>1</sub> = ${f3(h1)} m &nbsp;|&nbsp; h<sub>2</sub> = ${f3(h2)} m</td></tr>
       ${hasSok ? `<tr><td>${t('pdf.sok.links')}</td><td>${sokLv.toFixed(2)} m ${t('pdf.mum.short')} &nbsp;→ li = <strong>${(sokLv+h1).toFixed(2)} m ${t('pdf.mum.short')}</strong></td></tr>
       <tr><td>${t('pdf.sok.rechts')}</td><td>${sokRv.toFixed(2)} m ${t('pdf.mum.short')} &nbsp;→ re = <strong>${(sokRv+h2).toFixed(2)} m ${t('pdf.mum.short')}</strong></td></tr>` : ''}
       <tr><td>${t('pdf.zugkraft.direkt')}</td><td><strong>H = ${fN(H_Ts,0)} N &nbsp;(bei T<sub>1</sub> = ${T1} °C)</strong></td></tr>
       <tr><td>${t('pdf.temperaturen')}</td><td><strong>T<sub>1</sub> = ${T1} °C &nbsp;→&nbsp; T<sub>2</sub> = ${T2} °C &nbsp;(ΔT = ${sign(deltaT)}${deltaT} K)</strong></td></tr>`
    : `<tr><td>${t('pdf.ts.label')} (Ts)</td><td><strong>${matTs}</strong> &nbsp; q<sub>Ts</sub> = ${q_Ts.toFixed(4)} N/m${EA !== null ? ` &nbsp;|&nbsp; (E·A)${isNFL ? '<sub>kombi</sub>' : ''} = ${(EA/1e6).toFixed(1)} MN &nbsp;|&nbsp; α${isNFL ? '<sub>kombi</sub>' : ''} = ${(alpha*1e6).toFixed(1)}×10⁻⁶ /K` : ''}</td></tr>
       <tr><td>${t('res.fd.title')}</td><td><strong>${matFd}</strong> &nbsp; q<sub>Fd</sub> = ${q_Fd.toFixed(4)} N/m &nbsp;${wearPct > 0 ? `<em style="color:var(--akz)">(${t('pdf.abnutzung')} ${wearPct} %: ${(q_Fd/(1-wearPct/100)).toFixed(4)} N/m)</em>` : `(0 % ${t('pdf.abnutzung')})`} &nbsp;|&nbsp; H<sub>Fd</sub> = ${fN(H_Fd,0)} N</td></tr>
       <tr><td>${t('pdf.haenger')}</td><td>q<sub>H</sub> = 0.020 kg/m × 9.81 m/s² = ${q_H.toFixed(4)} N/m</td></tr>
       <tr><td>${t('pdf.systemhoehe')}</td><td>sh = ${sh} m</td></tr>
       <tr><td>${t('pdf.befhoehen')}</td><td>h<sub>1</sub> = ${f3(h1)} m &nbsp;|&nbsp; h<sub>2</sub> = ${f3(h2)} m</td></tr>
       ${hasSok ? `<tr><td>${t('pdf.sok.links')}</td><td>${sokLv.toFixed(2)} m ${t('pdf.mum.short')} &nbsp;→ li = <strong>${(sokLv+h1).toFixed(2)} m ${t('pdf.mum.short')}</strong></td></tr>
       <tr><td>${t('pdf.sok.rechts')}</td><td>${sokRv.toFixed(2)} m ${t('pdf.mum.short')} &nbsp;→ re = <strong>${(sokRv+h2).toFixed(2)} m ${t('pdf.mum.short')}</strong></td></tr>` : ''}
       ${isNFL
         ? `<tr><td>${t('pdf.h.ub')}</td><td><strong>H<sub>ub</sub> = ${fN(H_Ts_ub,0)} N &nbsp;(bei T<sub>1</sub> = ${T1} °C)</strong></td></tr>
            <tr><td>${t('pdf.h.b')}</td><td><strong>H<sub>Ts,1</sub> = ${fN(H_Ts,0)} N &nbsp;</strong><em style="color:var(--muted)">(via Zustandsgl. unbelastet→belastet, EA<sub>Ts</sub>)</em></td></tr>
            <tr><td>${t('pdf.temperaturen')}</td><td><strong>T<sub>1</sub> = ${T1} °C &nbsp;→&nbsp; T<sub>2</sub> = ${T2} °C &nbsp;(ΔT = ${sign(deltaT)}${deltaT} K)</strong></td></tr>
            ${ZL > 0 ? `<tr><td>${t('pdf.eislast')}</td><td><strong style="color:var(--akz)">Z<sub>L</sub> = ${ZL.toFixed(2)} N/m &nbsp;(T<sub>2</sub> = ${T2} °C)</strong></td></tr>` : ''}`
         : `<tr><td>${t('pdf.zugkraft.const')}</td><td><strong>H<sub>Ts</sub> = ${fN(H_Ts,0)} N</strong></td></tr>
            <tr><td>${t('pdf.betrieb.temp')}</td><td>T = ${T1} °C</td></tr>`}`}
</table></div>

<!-- ── Diagramm (gross, direkt nach den Eingabewerten) ── -->
<h2>${t('pdf.diagramm.legende')}</h2>
<div class="diagram">
  <img src="${canvasImg}" alt="${t('pdf.diagramm.legende')}">
  <div class="legende">${_pdfDiagrammLegende()}</div>
</div>

<!-- ── Schritt 1: Gesamtlast ── -->
<h2>${t('pdf.step1')} &nbsp;—&nbsp; ${isEl ? t('pdf.step1.el') : t('pdf.step1.title')}</h2>
<div class="step">
  ${isEl
    ? `<p class="sub"><em>q = q<sub>Leiter</sub></em> &nbsp;(nur Eigengewicht, kein Fd/Hänger)</p>
       <p class="sub">q = <strong class="r">${q_ges.toFixed(4)} N/m</strong></p>`
    : `<p class="sub"><em>q<sub>ges</sub> = q<sub>Ts</sub> + q<sub>Fd</sub> + q<sub>Hänger</sub></em></p>
       <p class="sub">q<sub>ges</sub> = ${q_Ts.toFixed(4)} + ${q_Fd.toFixed(4)} + ${q_H.toFixed(4)}
         = <strong class="r">${q_ges.toFixed(4)} N/m</strong></p>
       <p class="sub2">Die Hängerlast wird als gleichmässig verteilte Last über die Spannweite angesetzt.</p>
       ${ZL > 0 ? `<p class="sub" style="margin-top:5px"><em style="color:var(--akz)">Zielzustand T<sub>2</sub> mit Eislast:</em>
         q<sub>ges,ZL</sub> = q<sub>ges</sub> + Z<sub>L</sub> = ${q_ges.toFixed(4)} + ${ZL.toFixed(4)}
         = <strong style="color:var(--warn)">${(q_ges + ZL).toFixed(4)} N/m</strong></p>` : ''}`}
</div>

${isNFL_ub ? `
<!-- ── Schritt 1b: unbelastet → belastet ── -->
<h2>${t('pdf.step1b')} &nbsp;—&nbsp; ${t('pdf.step1b.title')}</h2>
<div class="step">
  <p><strong>${t('pdf.phys.hint')}</strong></p>
  <p class="sub2">${t('pdf.phys.body')}</p>
</div>
<div class="step">
  <p><strong>${t('pdf.zustgl.ub')}</strong></p>
  <p class="sub"><em class="r">q<sub>ges</sub>²·Lm²/(24·H<sub>b</sub>²) − H<sub>b</sub>/(E·A)<sub>Ts</sub>
    = q<sub>Ts</sub>²·Lm²/(24·H<sub>ub</sub>²) − H<sub>ub</sub>/(E·A)<sub>Ts</sub></em></p>
  <p class="sub2">Umgeformt: C·H<sub>b</sub>³ + K·H<sub>b</sub>² − G = 0 &nbsp;mit:</p>
  <p class="sub">G = (q<sub>ges</sub>·Lm)² / 24
    = (${q_ges.toFixed(4)} × ${f3(Lm)})² / 24
    = <strong class="r">${G_ub.toFixed(3)} N²·m</strong></p>
  <p class="sub">C<sub>Ts</sub> = 1 / (E·A)<sub>Ts</sub>
    = 1 / ${(EA_Ts/1e6).toFixed(3)} MN
    = <strong class="r">${(1/EA_Ts).toExponential(4)} N⁻¹</strong></p>
  <p class="sub">K = (q<sub>Ts</sub>·Lm)²/(24·H<sub>ub</sub>²) − H<sub>ub</sub>/(E·A)<sub>Ts</sub>
    = (${q_Ts.toFixed(4)}×${f3(Lm)})²/(24×${fN(H_Ts_ub,0)}²) − ${fN(H_Ts_ub,0)}/${(EA_Ts/1e6).toFixed(3)} MN
    = <strong class="r">${K_ub.toExponential(4)}</strong></p>
  <p class="sub2">Lösung mit Newton-Raphson (Startwert H<sub>ub</sub> = ${fN(H_Ts_ub,0)} N):</p>
  <p class="sub">H<sub>Ts,belastet</sub> = <strong class="r">${fN(H_Ts,0)} N</strong></p>
</div>` : ''}

${isNFL_xl ? `
<!-- ── Schritt 1b: Bezugszustand 10 °C ── -->
<h2>${t('pdf.step1b')} &nbsp;—&nbsp; ${t('pdf.bezug.titel')}</h2>
<div class="step">
  <p class="sub2">${t('pdf.bezug.text')}</p>
  <p class="sub"><em class="r">(gk<sub>x</sub> / x)² − (gk<sub>0</sub> / H<sub>ub</sub>)² − G · (α·(10 °C − T<sub>1</sub>) + (x − H<sub>ub</sub>) / (E·A)) = 0</em></p>
  <p class="sub2">G = 24/Lm² + (gk<sub>0</sub>/H<sub>ub</sub>)² &nbsp;|&nbsp; gk<sub>x</sub> = MFL = ${flCombo.MFL.toFixed(4)} N/m &nbsp;|&nbsp; gk<sub>0</sub> = MTS = ${flCombo.MTS.toFixed(4)} N/m &nbsp;|&nbsp; Lm = ${f3(Lm)} m</p>
  <p class="sub">H<sub>ub</sub> = ${fN(H_Ts_ub,0)} N bei T<sub>1</sub> = ${T1} °C &nbsp;→&nbsp; H<sub>Ts,10 °C</sub> = <strong class="r">${fN(H_Ts,0)} N</strong> &nbsp;<em style="color:var(--muted);font-size:.82em">(${t('pdf.gerundet.10')})</em></p>
</div>
<div class="step">
  <p><strong>${t('pdf.nfl.zustgl')}</strong></p>
  <p class="sub"><em class="w">((gk<sub>x</sub> + gk<sub>0</sub>·H<sub>Fd</sub>/H<sub>0</sub>) / (H<sub>Fd</sub> + x))² − (gk<sub>0</sub>/H<sub>0</sub>)² − G · (α·(T − 10 °C) + (x − H<sub>0</sub>)/(E·A)) = 0</em></p>
  <p class="sub2">H<sub>0</sub> = H<sub>Ts,10 °C</sub> &nbsp;|&nbsp; gk<sub>x</sub> = q<sub>ges</sub>${ZL > 0 ? ' + Z<sub>L</sub>' : ''} &nbsp;|&nbsp; gk<sub>0</sub> = MFL (neuer Fahrdraht) &nbsp;|&nbsp; ${t('pdf.gerundet.5')}</p>
  <p class="sub">T<sub>1</sub> = ${T1} °C &nbsp;→&nbsp; H<sub>Ts,1</sub> = <strong class="r">${fN(c1.H,0)} N</strong></p>
  <p class="sub">T<sub>2</sub> = ${T2} °C &nbsp;→&nbsp; H<sub>Ts,2</sub> = <strong class="w">${fN(c2.H,0)} N</strong></p>
</div>` : ''}

<!-- ── Schritt 2: Kettenlinie ── -->
<h2>${t('pdf.step2')} &nbsp;—&nbsp; ${isNFL || isEl ? `${t('pdf.ausgangszustand')} (T<sub>1</sub> = ${T1} °C)` : `(T = ${T1} °C)`}</h2>
<div class="step">
  <p><strong>${t('pdf.katenlin.param')}</strong></p>
  <p class="sub"><em>a = H<sub>Ts</sub> / q<sub>ges</sub></em></p>
  <p class="sub">a = ${fN(c1.H,1)} / ${q_ges.toFixed(4)} = <strong class="r">${f3(c1.a)} m</strong></p>
</div>
<div class="step">
  <p><strong>${t('pdf.katenlin.geo')}</strong></p>
  <p class="sub"><em>y(x) = a · cosh((x − x<sub>0</sub>) / a) + C<sub>0</sub></em></p>
  <p class="sub2">mit &nbsp; u = L/(2a) &nbsp;|&nbsp; n = arcsinh(Δh / (2a·sinh(u)))</p>
  <p class="sub">u = ${f3(L)} / (2 × ${f3(c1.a)}) = ${f4(c1.u)}</p>
  <p class="sub">n = arcsinh(${f3(dh)} / (2 × ${f3(c1.a)} × sinh(${f4(c1.u)}))) = ${f4(c1.n)}</p>
  <p class="sub">Tiefpunkt: x<sub>0</sub> = a · (u − n) = ${f3(c1.a)} × (${f4(c1.u)} − ${f4(c1.n)}) = <strong class="r">${f3(c1.x_low)} m</strong></p>
  <p class="sub">Durchhang: f<sub>1</sub> = y<sub>Sehne</sub>(x<sub>0</sub>) − y<sub>Ts</sub>(x<sub>0</sub>) = <strong class="r">${f3(c1.sag)} m</strong></p>
</div>
<div class="step">
  <p><strong>${t('pdf.seillange.kraft')}</strong></p>
  <p class="sub"><em>s = 2a · sinh(u) · cosh(n) &nbsp;|&nbsp; T<sub>max</sub> = H · cosh(x<sub>max</sub> / a), x<sub>max</sub> = grösster Abstand Tiefpunkt–Mast</em></p>
  <p class="sub">s = 2 × ${f3(c1.a)} × sinh(${f4(c1.u)}) × cosh(${f4(c1.n)}) = <strong class="r">${f3(c1.s)} m</strong></p>
  <p class="sub">T<sub>max,1</sub> = ${fN(c1.H,1)} × cosh(${f3(Math.max(Math.abs(c1.x_low), Math.abs(L - c1.x_low)))} / ${f3(c1.a)})
    = <strong class="r">${fN(c1.T_max,1)} N</strong></p>
</div>

${(isEl || (isNFL && !flCombo)) && C !== null && K !== null ? `
<!-- ── Schritt 3: Zustandsgleichung ── -->
<h2 class="warm">${t('pdf.step3')} &nbsp;—&nbsp; (${sysName(isEl ? 'el' : 'nfl')}, ΔT = ${sign(deltaT)}${deltaT} K)</h2>
<div class="step">
  <p><strong>${t('pdf.allg.zustgl')}</strong></p>
  <p class="sub"><em class="w">(q·Lm)² / (24·H<sub>2</sub>²) − H<sub>2</sub>/(E·A) = (q·Lm)² / (24·H<sub>1</sub>²) − H<sub>1</sub>/(E·A) + α·ΔT</em></p>
  <p class="sub2">Umgeformt in kubisches Polynom (Multiplikation mit H<sub>2</sub>²):</p>
  <p class="sub"><em class="w">C·H<sub>2</sub>³ + K·H<sub>2</sub>² − G = 0</em></p>
  <p class="sub2">mit &nbsp; G = (q<sub>ges</sub>·Lm)²/24 &nbsp;|&nbsp; C = 1/(E·A) &nbsp;|&nbsp; K = G/H<sub>1</sub>² − C·H<sub>1</sub> + α·ΔT</p>
</div>
<div class="step">
  <p><strong>${t('pdf.koeff')}</strong></p>
  <p class="sub">G = (${q_ges.toFixed(4)} × ${f3(Lm)})² / 24
    = <strong class="r">${G.toFixed(6)} N²·m</strong></p>
  <p class="sub">C = 1 / (E·A) = 1 / ${(EA/1e6).toFixed(1)} MN
    = <strong class="r">${C.toExponential(4)} m/N</strong></p>
  <p class="sub">K = G/H<sub>1</sub>² − C·H<sub>1</sub> + α·ΔT</p>
  <p class="sub2">= ${G.toFixed(4)} / ${fN(H_Ts,1)}² − ${C.toExponential(4)} × ${fN(H_Ts,1)} + ${(alpha*1e6).toFixed(1)}×10⁻⁶ × (${sign(deltaT)}${deltaT})</p>
  <p class="sub">= <strong class="r">${K.toExponential(4)} m/N</strong></p>
</div>
<div class="step">
  <p><strong>${t('pdf.kub.poly')}</strong></p>
  <p class="sub"><em class="w">${C.toExponential(4)} · H<sub>2</sub>³ + ${K.toExponential(4)} · H<sub>2</sub>² − ${G.toFixed(2)} = 0</em></p>
  <p class="sub2">Lösung mit Newton-Raphson-Iteration (Startwert H<sub>2</sub> = H<sub>1</sub>):</p>
  <p class="sub">H<sub>Ts,2</sub> = <strong class="w">${fN(c2.H,1)} N</strong></p>
</div>

${isNFL && flCombo ? `
<!-- ── Schritt 3b: Ts belastet Durchhang VEM 7.66 ── -->
<h2 class="warm">${t('pdf.step3b')} &nbsp;—&nbsp; ${t('pdf.step3b.title')}</h2>
<div class="step">
  <p><strong>${t('pdf.fd.kombi')}</strong></p>
  <p class="sub2">${t('pdf.fd.kombibody')}</p>
  <p class="sub"><em class="w">q<sub>vem</sub> = gk<sub>x</sub> + gk<sub>0</sub>·H<sub>Fd</sub>/F<sub>0</sub>${ZL > 0 ? ' + Z<sub>L</sub>' : ''}</em> &nbsp;&nbsp;F<sub>0</sub> = H<sub>Ts</sub> belastet bei 10 °C</p>
  <p class="sub"><em class="w">L<sub>T1</sub> = L + 2·|Δh|·(H<sub>Ts,2</sub>+H<sub>Fd</sub>) / (L·q<sub>vem</sub>)</em> &nbsp;&nbsp;[VEM 7.82] &nbsp;|Δh| = |h<sub>2</sub>−h<sub>1</sub>| &nbsp;→ L<sub>T1</sub> ≥ L immer</p>
  <p class="sub"><em class="w">f<sub>Fd</sub> = L<sub>T1</sub>² / 8 · q<sub>vem</sub> / (H<sub>Ts,2</sub> + H<sub>Fd</sub>)</em> &nbsp;&nbsp;[VEM 7.66]</p>
  <p class="sub2" style="color:var(--akz)">Die im Diagramm angezeigte Ts-Kurve bei T<sub>2</sub> entspricht der kombinierten Kettenlinie des Ts+Fd-Systems mit den Parametern q<sub>vem</sub> und H<sub>Ts,2</sub>+H<sub>Fd</sub>. Dieser Ansatz stimmt mit der VEM-Parabel überein (Abweichung &lt; 5 mm für übliche Spannweiten).</p>
</div>
<div class="step">
  <p><strong>${t('pdf.berechn.werte')}</strong></p>
  <p class="sub">MFL = ${flCombo.MFL.toFixed(5)} N/m</p>
  <p class="sub">F<sub>0</sub> = ${fN(H_Ts,0)} N &nbsp;(Ts belastet bei 10 °C, Bezugszustand)</p>
  <p class="sub">H<sub>Ts,2</sub> = ${fN(c2.H,0)} N &nbsp;(Ts-Zug bei T<sub>2</sub> = ${T2} °C)</p>
  <p class="sub">H<sub>Fd</sub> = ${fN(H_Fd,0)} N &nbsp;(konstant)</p>
  <p class="sub">q<sub>vem</sub> = gk<sub>x</sub> + gk<sub>0</sub>·H<sub>Fd</sub>/F<sub>0</sub>${ZL > 0 ? ' + Z<sub>L</sub>' : ''}
    = ${q_ges.toFixed(4)} + ${flCombo.MFL.toFixed(4)} × ${fN(H_Fd,0)}/${fN(H_Ts,0)}${ZL > 0 ? ` + ${ZL.toFixed(4)}` : ''}
    = <strong class="r">${(calcState.q_vem_vem ?? (flCombo.MFL*(1+H_Fd/H_Ts)+ZL)).toFixed(4)} N/m</strong></p>
  ${(()=>{ const _qv=calcState.q_vem_vem ?? (flCombo.MFL*(1+H_Fd/H_Ts)+ZL), _absDH=Math.abs(h2-h1),
            _LT1=_absDH>1e-9 ? L+2*_absDH*(c2.H+H_Fd)/(L*_qv) : L;
    return _absDH>1e-9
      ? `<p class="sub">|Δh| = |h<sub>2</sub> − h<sub>1</sub>| = |${fN(h2,2)} − ${fN(h1,2)}| = <strong class="r">${fN(_absDH,2)} m</strong></p>
         <p class="sub">L<sub>T1</sub> = ${fN(L,2)} + 2×${fN(_absDH,2)}×(${fN(c2.H,0)}+${fN(H_Fd,0)}) / (${fN(L,2)}×${_qv.toFixed(4)})
           = <strong class="r">${f3(_LT1)} m</strong> &nbsp;<em style="color:var(--muted);font-size:.82em">(VEM 7.82, L<sub>T1</sub> ≥ L)</em></p>`
      : `<p class="sub">|Δh| = 0 → L<sub>T1</sub> = L = ${fN(L,2)} m</p>`; })()}
  <p class="sub">f<sub>Fd,1</sub> = L² / 8 × q<sub>vem</sub> / (H<sub>Ts,1</sub> + H<sub>Fd</sub>) = <strong class="r">${f3(c1.sag)} m</strong></p>
  <p class="sub">f<sub>Fd,2</sub> = L<sub>T1</sub>² / 8 × q<sub>vem</sub> / (H<sub>Ts,2</sub> + H<sub>Fd</sub>) = <strong class="w">${f3(c2.sag)} m</strong>${ZL > 0 ? ' &nbsp;<em style="color:var(--akz)">(inkl. Eislast)</em>' : ''}</p>
</div>` : ''}

<!-- ── Schritt 4: Kettenlinie T<sub>2</sub> ── -->
<h2 class="warm">${t('pdf.step4')} &nbsp;—&nbsp; ${t('pdf.zielzustand')} (T<sub>2</sub> = ${T2} °C)</h2>
<div class="step">
  <p class="sub"><em class="w">a<sub>2</sub> = H<sub>2</sub> / q</em></p>
  <p class="sub">a<sub>2</sub> = ${fN(c2.H,1)} / ${q_ges.toFixed(4)} = <strong class="w">${f3(c2.a)} m</strong></p>
  <p class="sub">Tiefpunkt: x<sub>0,2</sub> = <strong class="w">${f3(c2.x_low)} m</strong></p>
  <p class="sub">Durchhang: f<sub>2</sub> = <strong class="w">${f3(c2.sag)} m</strong>
    &nbsp;(Δf = ${sign(c2.sag-c1.sag)}${f3(Math.abs(c2.sag-c1.sag))} m &nbsp;|&nbsp;
    ${sign(c2.sag-c1.sag)}${((c2.sag-c1.sag)/c1.sag*100).toFixed(1)}%)</p>
  <p class="sub">T<sub>max,2</sub> = <strong class="w">${fN(c2.T_max,1)} N</strong></p>
</div>
` : (isNFL || isEl) ? `
<h2 class="warm">${t('pdf.step3')} &nbsp;—&nbsp; (${sysName(isEl ? 'el' : 'nfl')})</h2>
<div class="step">
  <p>Keine E·A-Angabe — Berechnung über Seillängenzunahme.</p>
  <p class="sub"><em class="w">s<sub>2</sub> = s<sub>1</sub> · (1 + α·ΔT)</em></p>
  <p class="sub">s<sub>2</sub> = ${f3(c1.s)} × (1 + ${(alpha*1e6).toFixed(1)}×10⁻⁶ × ${sign(deltaT)}${deltaT})
    = <strong class="w">${f3(c2.s)} m</strong></p>
  <p class="sub">H<sub>2</sub> = <strong class="w">${fN(c2.H,1)} N</strong> &nbsp;|&nbsp;
    f<sub>2</sub> = <strong class="w">${f3(c2.sag)} m</strong></p>
</div>
` : ''}

<!-- ── Fahrdraht (nur N-FL / R-FL) ── -->
${!isEl ? `
<h2 style="color:var(--text2);border-left-color:var(--tert)">${isNFL ? t('pdf.step5') : t('pdf.step3')} &nbsp;—&nbsp; ${t('res.fd.title')}</h2>
<div class="step">
  <p class="sub"><em style="color:var(--text2)">${t('pdf.fd.hoehe.tp')}${isNFL ? ` (${t('pdf.fd.ist.t2')})` : ''}</em></p>
  <p class="sub">${t('pdf.fd.hoehe.sok')} = <strong style="color:var(--text2)">${f3(fd_abs_pdf)} m</strong>
    &nbsp;<span style="color:var(--muted)">(${t('res.tiefpunkt')} x = ${f3(x_ist_pdf)} m)</span></p>
  <p class="sub">H<sub>Fd</sub> = <strong style="color:var(--text2)">${fN(H_Fd,0)} N</strong> (${t('pdf.konstant')}${sysMode === 'rfl' ? `, ${t('pdf.nachspann')}` : ''})</p>
  <p class="sub">${t('pdf.haenger.mast')} = sh = <strong style="color:var(--text2)">${sh} m</strong> (${t('pdf.maximum')})</p>
  <p class="sub">${t('pdf.haenger.tp')} = sh − f<sub>${flCombo ? 'Fd,1' : 'Ts,1'}</sub> = ${sh} − ${f3(c1.sag)} = <strong style="color:var(--text2)">${f3(sh - c1.sag)} m</strong> (${t('pdf.minimum')})</p>
</div>` : ''}

<!-- ── Vergleich T<sub>1</sub> → T<sub>2</sub> ── -->
${(isNFL || isEl) ? `
<h2>${t('pdf.vergleich')} ${isEl ? t('res.leiter.label') : t('pdf.ts.label')} T<sub>1</sub> → T<sub>2</sub></h2>
<table class="cmp">
  <tr><th>${t('pdf.cmp.groesse')}</th><th>T<sub>1</sub> = ${T1} °C</th><th class="warm">T<sub>2</sub> = ${T2} °C</th><th>${t('pdf.cmp.aenderung')}</th></tr>
  ${tr(t('pdf.katenlin.param') + ' a', c1.a, c2.a, 'm')}
  ${tr('x₀', c1.x_low, c2.x_low, 'm')}
  ${tr(flCombo ? t('res.sag.belastet') : t('res.sag.ts.label'), c1.sag, (flCombo && calcState.c2_vem) ? calcState.c2_vem.sag : c2.sag, 'm')}
  ${tr(isEl ? t('res.zugkraft.el') : t('res.zugkraft.ts'), c1.H, c2.H, 'N', 1)}
  ${tr('T_max', c1.T_max, c2.T_max, 'N', 1)}
</table>` : ''}

${(() => {   // Fahrdrahthöhe: gleiche Prüfung wie die Prüfzeile unter den Ergebnissen
  const el = document.getElementById('hf-pruefzeile');
  if (!el || !el.getClientRects().length) return '';
  const g = hfGrenzenM(), b = hGrenzen();
  const ok = el.classList.contains('ok');
  return `
<h2 class="green">${t('hf.titel')}</h2>
<div class="step"><p><strong style="color:${ok ? 'var(--ok)' : 'var(--fail)'}">${ok ? '✓' : '✗'}</strong> ${el.querySelector('span:nth-child(2)').innerHTML}</p>
${b ? `<p class="sub">${t('par.h.hf').replace('{min}', b.min.toFixed(2)).replace('{max}', b.max.toFixed(2))} (${t('par.h.hf.titel')})</p>` : ''}
<p class="sub">hf<sub>min</sub> = ${g.min.toFixed(3)} m · hf<sub>max</sub> = ${g.max.toFixed(3)} m — ${t('hf.pdf.quelle.kurz')}</p></div>`;
})()}

${hasAnyProbe ? `
<!-- ── Messpunkte ── -->
<h2 class="green">${t('pdf.messpunkte')}</h2>
<div class="step">
  <table class="cmp">
    <tr>
      <th>${t('pdf.mp.punkt')}</th>
      <th>${isEl ? t('res.seil.hoehe') : t('res.ts.hoehe')} ${hasSok ? `[m ${t('pdf.mum.short')}]` : `[m ${t('pdf.sok.short')}]`}</th>
      ${!isEl ? `<th>${t('pdf.fd.hoehe')} ${hasSok ? `[m ${t('pdf.mum.short')}]` : `[m ${t('pdf.sok.short')}]`}</th>` : ''}
      <th>${mpBezugText()} [m]</th>
    </tr>
    ${probeRows(probeX1, 'M1')}
    ${probeRows(probeX2, 'M2')}
    ${probeRows(probeX3, 'M3')}
    ${probeRows(probeX4, 'M4')}
  </table>
  <p class="sub2" style="margin-top:4px">${t('pdf.ausgangszustand')}: ${isNFL || isEl ? `T<sub>2</sub> = ${T2} °C` : `T = ${T1} °C`} &nbsp;|&nbsp; ${isEl ? `H` : `H<sub>Ts</sub>`}${isNFL || isEl ? `<sub>2</sub>` : ``} = ${fN(cIstPdf.H,0)} N</p>
</div>` : ''}

${mode3pt && threePtMark ? `
<!-- ── 3-Punkte-Messung ── -->
<h2 class="green">${t('pdf.3pt.title')}</h2>
<div class="step">
  <p>${t('pdf.3pt.body')}</p>
  <p class="sub">${t('pdf.3pt.pos')}: x<sub>C</sub> = <strong class="r">${threePtMark.xC.toFixed(2)} m</strong></p>
  <p class="sub">${t('pdf.3pt.wert')}: y<sub>C</sub> = <strong class="r">${threePtMark.yC.toFixed(2)}</strong> (${yCInputMode === 'mum' ? `m ${t('pdf.mum.short')}` : yCInputMode === 'sok' ? `m ${t('pdf.sok.short')}` : 'm Durchhang unter Sehne'})</p>
  <p class="sub">${t('pdf.3pt.result')}: H<sub>Ts</sub> = <strong class="r">${fN(cIstPdf.H,0)} N</strong></p>
</div>` : ''}



${(() => {
  const fr = window._fotoResult;
  const fc = document.getElementById('foto-canvas');
  if (!fr || !fc || !fc.width) return '';
  // Eingabe-Felder auslesen
  const fL      = document.getElementById('foto-L')?.value;
  const fHmL    = document.getElementById('foto-hmast-L')?.value;
  const fHmR    = document.getElementById('foto-hmast-R')?.value;
  const fElL    = document.getElementById('foto-elev-L')?.value;
  const fElR    = document.getElementById('foto-elev-R')?.value;
  const fMatKey = document.getElementById('foto-mat')?.value;
  const fMatNm  = (fMatKey && typeof MATERIALS !== 'undefined' && MATERIALS[fMatKey])
                  ? MATERIALS[fMatKey].name : (fMatKey || '—');
  const fImg    = fc.toDataURL('image/jpeg', 0.88);
  const H_mont = (typeof fotoSolveAtTemp === 'function') ? fotoSolveAtTemp(10) : null;
  const rows = [
    fr.nameL || fr.nameR ? `<tr><td>Mast links</td><td><strong>${escHtml(fr.nameL || '—')}</strong></td><td>Mast rechts</td><td><strong>${escHtml(fr.nameR || '—')}</strong></td></tr>` : '',
    `<tr><td>Spannweite L</td><td><strong>${fL ? fL + ' m' : '—'}</strong></td><td>Leitermaterial</td><td>${fMatNm}</td></tr>`,
    `<tr><td>Masthöhe L</td><td>${fHmL ? fHmL + ' m' : '—'}</td><td>Masthöhe R</td><td>${fHmR ? fHmR + ' m' : ('= L')}</td></tr>`,
    (fElL || fElR) ? `<tr><td>Mastfuss L</td><td>${fElL ? fElL + ' m ü.M.' : '—'}</td><td>Mastfuss R</td><td>${fElR ? fElR + ' m ü.M.' : '—'}</td></tr>` : '',
    `<tr><td>Messtemperatur</td><td>${fr.T1 != null ? fr.T1 + ' °C' : '—'}</td><td>Höhenunterschied dh</td><td>${fr.dh != null ? fr.dh.toFixed(2) + ' m' : '—'}</td></tr>`,
    `<tr><td>Gemessener Durchhang f</td><td><strong style="color:var(--akz)">${fr.f != null ? fr.f.toFixed(2) + ' m' : '—'}</strong></td><td>Berechnete Zugkraft H</td><td><strong style="color:var(--akz)">${fr.H != null ? (fr.H/1000).toFixed(2) + ' kN' : '—'}</strong></td></tr>`,
    H_mont ? `<tr><td>Montagekontrolle H (10 °C)</td><td><strong>${(H_mont.H/1000).toFixed(2)} kN</strong></td><td>Istzustand T</td><td>${fr.T1 != null ? fr.T1 + ' °C' : '—'}</td></tr>` : '',
  ].filter(Boolean).join('');
  return `
<!-- ── Foto-Auswertung ── -->
<h2 class="green" style="page-break-before:always">Foto-Auswertung — Feldmessung</h2>
<div class="step">
  <table class="inp" style="table-layout:fixed">
    <colgroup><col style="width:22%"><col style="width:28%"><col style="width:22%"><col style="width:28%"></colgroup>
    ${rows}
  </table>
</div>
<div class="diagram" style="margin-top:10px">
  <img src="${fImg}" alt="Foto-Auswertung" style="width:100%;max-height:180mm;object-fit:contain;border:1px solid var(--rand);border-radius:6px">
  <p style="font-size:7.5pt;color:var(--tert);margin-top:4px">Feldaufnahme mit Messpunkten und berechneter Seillinie (H = ${fr.H != null ? (fr.H/1000).toFixed(2) + ' kN' : '—'} bei ${fr.T1 != null ? fr.T1 + ' °C' : '?'})</p>
</div>`;
})()}

<footer>${t('pdf.footer')} &nbsp;·&nbsp; ${APP_VERSION} &nbsp;|&nbsp; ${new Date().toLocaleDateString(currentLang === 'fr' ? 'fr-FR' : currentLang === 'it' ? 'it-IT' : 'de-DE')} &nbsp;|&nbsp; Fachentwicklung FS &nbsp;|&nbsp; ${t('pdf.quelle')}</footer>`;
  return bodyHtml;
}

// ── Massstäbliche Zeichnung (A4 Querformat, SVG) ──────────────────────────
// ═══════════════════════════════════════════════════════════════
// ANSICHT — Canvas-Bereich: Reiterwechsel und Zeichnungsnavigation
// Gekapselt wie das Foto- und das Projektmodul. Privat bleiben vor allem
// Ausschnitt und Zoom der Zeichnung (_panX/_panY/drawingZoom) sowie deren
// Kennwerte — diese wurden vorher quer durch die Datei beschrieben.
// Nach aussen geht nur, was HTML-Handler oder anderer Code wirklich braucht.
// ═══════════════════════════════════════════════════════════════
const Ansicht = (() => {

// Zeichnung am Bildschirm im Thema (hell/dunkel); PDF (stripInSvg) immer hell.
// _diagrammDruck steuert auch t2TempColor() — fürs PDF deshalb kurz auf «Druck».
function buildScaleDrawingPage(stripInSvg = false) {
  const vorher = _diagrammDruck;
  if (stripInSvg) _diagrammDruck = true;
  try { return _zeichnungBauen(stripInSvg); } finally { _diagrammDruck = vorher; }
}
function _zeichnungBauen(stripInSvg) {
  const Z = zeichnungFarben(stripInSvg);
  // <sub>n</sub> aus den Übersetzungen → Unicode-Tiefstellung für SVG-Text
  const subUni = txt => txt.replace(/<sub>(\d)<\/sub>/g, (_, d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  const SOK = t('ui.sok.kurz'), MUM = t('bp.mum.abbrev');
  if (!calcState) return '';
  const { c1, c2, L, h1, h2, T1, T2, sh, H_Fd, q_Fd, Lm } = calcState;
  const isNFL  = sysMode === 'nfl';
  const isRFL  = sysMode === 'rfl';
  const isEl   = sysMode === 'el';
  const showFd = !isEl; // Fahrdraht für NFL und RFL
  const c3data = (showT3 && calcState.c3) ? (calcState.c3_vem ?? calcState.c3) : null;
  const cDisp  = (isNFL && calcState.c2_vem) ? calcState.c2_vem : c2;
  const catY   = (x, c) => kettenY(c, x);

  // SOK
  const sokL  = getSokMumLeft();
  const sokR  = getSokMumRight();
  const hasSok= sokL !== null || sokR !== null;
  const sokLv = sokL ?? sokR ?? 0;
  const sokRv = sokR ?? sokL ?? 0;
  const sokAt = x => sokLv + (sokRv - sokLv) * x / L;
  const absY  = (x, y) => hasSok ? y + sokAt(x) : y;

  // Key absolute heights
  const h1abs = absY(0, h1);
  const h2abs = absY(L, h2);
  const sokYL = hasSok ? sokLv : 0;
  const sokYR = hasSok ? sokRv : 0;

  // Fahrdraht-Höhe bei x (absolut): Solllage + Tragseil-Verschiebung.
  // N-FL gegenüber T1; R-FL gegenüber «neu, ohne Eis» (nachgespannt, keine
  // Temperaturwirkung — VEM 7.53a wie SBB-Excel).
  const fdY = x => absY(x, fdUeberSok(x, calcState, { h1, h2, sh, L }));

  // Sample curves for Y-range (including Fd) + find sag-max position
  const N = 120;
  let yCrvMin = Infinity, xSagMax = L / 2, ySagMin = Infinity;
  for (let i = 0; i <= N; i++) {
    const x = L * i / N;
    const yTs = catY(x, cDisp);
    yCrvMin = Math.min(yCrvMin, absY(x, yTs), absY(x, catY(x, c1)));
    if (showFd) yCrvMin = Math.min(yCrvMin, fdY(x));
    if (c3data) yCrvMin = Math.min(yCrvMin, absY(x, catY(x, c3data)));
    if (yTs < ySagMin) { ySagMin = yTs; xSagMax = x; }
  }

  // Y display range (add headroom above anchors)
  // 'catenary': nur Kettenwerk/Leiter, SOK aus der Ausdehnung ausschliessen
  // hf_min / hf_max (Werte aus der hf-Ansicht) als Band über SOK — nur Kettenwerk
  const hfZ = (drawingHf && entwicklerModus && showFd) ? _hfFuerZeichnung() : null;
  const hfOk = !!(hfZ && !hfZ.fehler);
  if (hfOk) yCrvMin = Math.min(yCrvMin, absY(0, hfZ.min), absY(L, hfZ.min));
  const yMin   = drawingExtent === 'catenary'
    ? yCrvMin - 0.3
    : Math.min(sokYL, sokYR, yCrvMin) - 0.3;
  const yMax   = Math.max(h1abs, h2abs, hfOk ? Math.max(absY(0, hfZ.max), absY(L, hfZ.max)) : -Infinity) + 0.6;
  const yRange = yMax - yMin;

  // Layout in SVG mm — viewBox = 267 × 180 mm (A4 landscape usable at 15mm margin)
  const VW = 267, VH = 180;
  const titleH = stripInSvg ? 20 : 2, footH = 14;
  const axisL  = 22, axisR = 4;
  const drawX0 = axisL, drawX1 = VW - axisR;
  const drawY0 = titleH, drawY1 = VH - footH;
  const drawW  = drawX1 - drawX0;  // 241 mm
  const drawH  = drawY1 - drawY0;  // 153 mm

  // Auto-scale (horizontal: fit L in drawW)
  const scaleOpts = [100, 150, 200, 250, 300, 400, 500];
  let scale = 500;
  for (const s of scaleOpts) {
    if (L * 1000 / s <= drawW) { scale = s; break; }
  }
  _lastDrawingScale = scale;
  const ppm   = 1000 / scale;          // horizontal: mm per metre
  const vEx   = drawingVEx || 1;
  // Vertical: ppm * vEx, capped so yRange fits in drawH
  const ppm_v = Math.min(ppm * vEx, drawH / (yRange * 1.08));

  // Symbol scale: in interactive view divide by zoom so symbols stay constant size
  const symSc = stripInSvg ? 1 : (1 / (drawingZoom || 1));
  const isFs = !stripInSvg && !!document.querySelector('.canvas-card.canvas-fullscreen');
  // Beschriftung am Bildschirm grösser als im PDF (dort 1.0, massstäblicher Plan)
  const lblSc = stripInSvg ? 1.0 : isFs ? 1.6 : 1.35;
  const fs = n => (n * lblSc).toFixed(2);

  // Drawing proper centred in available area
  const dW   = L * ppm;
  const dH   = yRange * ppm_v;
  const xOff = drawX0 + (drawW - dW) / 2;
  const yOff = drawY0 + (drawH - dH) / 2;

  // Store content bounds for auto-fit (interactive only)
  if (!stripInSvg) {
    _drawingContentBounds = {
      x: 1,                           // include y-axis label area
      y: yOff - 5,
      w: xOff + L * ppm + 7,          // y-axis area to right mast + margin
      h: dH + 18,
    };
  }

  // Coordinate transforms
  const sx = x => xOff + x * ppm;
  const sy = y => yOff + (yMax - y) * ppm_v;

  // Colors
  const t2v   = (v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp2')?.value));
  const t2clr = isRFL ? Z.rfl : t2TempColor(t2v);
  const t3clr = c3data
    ? t2TempColor((v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp3')?.value)))
    : Z.t3;
  const fdClr = Z.fd;

  // Path helpers
  const makePath = (fn, dash='', sw='0.55') => {
    let d = '';
    for (let i = 0; i <= N; i++) {
      const x = L * i / N;
      const y = fn(x);
      d += (i === 0 ? 'M' : 'L') + sx(x).toFixed(2) + ',' + sy(y).toFixed(2) + ' ';
    }
    return `<path d="${d.trim()}" fill="none" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}`;
  };
  const catPath = (c, dash='', sw='0.55') => makePath(x => absY(x, catY(x, c)), dash, sw);

  // Strip dimensions — declared early so grid and spanDim can reference them
  const _probesEarlyCount = [probeX1, probeX2, probeX3, probeX4].filter(x => x !== null).length;
  const _stripRowH_early  = 5.5;
  // H-Punkte (Hindernis) im Band: Kote H und Abstand a je Messpunkt (nur mit SOK)
  const _hBand = hasSok && [probeX1, probeX2, probeX3, probeX4].some((x, i) => x !== null && probeHWerte[i] !== null);
  const _stripNRows_early = 2 + 1 + (c3data ? 1 : 0) + (hasSok ? 2 : 0) + (hasSok && c3data ? 1 : 0) + (_hBand ? 2 : 0);
  const _stripH_early     = _stripNRows_early * _stripRowH_early + 0.5;

  // Grid lines
  const rawStep = yRange / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceSteps = [0.1,0.2,0.25,0.5,1,2,2.5,5,10,20,50].map(v => v * mag);
  const gridStep = niceSteps.find(s => yRange / s >= 3 && yRange / s <= 8) || mag;
  const gridStart = Math.ceil(yMin / gridStep) * gridStep;
  let gridSvg = '';
  for (let y = gridStart; y <= yMax + 1e-9; y = Math.round((y + gridStep) * 1e6) / 1e6) {
    const gy = sy(y);
    const _gridBottom = (stripInSvg && _probesEarlyCount > 0) ? drawY1 - _stripH_early : drawY1;
    if (gy < drawY0 - 0.1 || gy > _gridBottom + 0.1) continue;
    gridSvg += `<line x1="${drawX0}" y1="${gy.toFixed(2)}" x2="${drawX1}" y2="${gy.toFixed(2)}" stroke="${Z.raster}" stroke-width="0.2"/>`;
    const lbl = hasSok ? y.toFixed(y < 10 ? 2 : 1) : y.toFixed(2);
    gridSvg += `<text x="${(drawX0-1).toFixed(2)}" y="${(gy+0.9).toFixed(2)}" font-size="${fs(2.4)}" text-anchor="end" fill="${Z.rasterText}">${lbl}</text>`;
  }

  const yAxisLbl = hasSok ? t('canvas.y.mum') : t('canvas.y.sok');

  // Ausschnitt «Kettenwerk»: SOK liegt ausserhalb — Masten enden am unteren
  // Rand des Ausschnitts (Bruchzeichen), die SOK-Linie entfällt.
  const nurKw   = drawingExtent === 'catenary';
  const mastUL  = nurKw ? Math.max(sokYL, yMin) : sokYL;
  const mastUR  = nurKw ? Math.max(sokYR, yMin) : sokYR;
  const bruch   = (x, y) => { const b = 1.2 * symSc; return `<path d="M${(x - b).toFixed(2)},${(y + b * .5).toFixed(2)} L${x.toFixed(2)},${(y - b * .3).toFixed(2)} L${x.toFixed(2)},${(y + b * .3).toFixed(2)} L${(x + b).toFixed(2)},${(y - b * .5).toFixed(2)}" fill="none" stroke="${Z.bruch}" stroke-width="${(0.28*symSc).toFixed(3)}"/>`; };

  // SOK line
  const sokSvg = nurKw ? `
  ${bruch(sx(0), sy(mastUL))}${bruch(sx(L), sy(mastUR))}
  <text x="${(sx(0)-1).toFixed(2)}" y="${(sy(mastUL)+0.9).toFixed(2)}" font-size="${fs(2.0)}" text-anchor="end" fill="${Z.sokText}">${SOK} ↓</text>
  <text x="${(sx(L)+1).toFixed(2)}" y="${(sy(mastUR)+0.9).toFixed(2)}" font-size="${fs(2.0)}" text-anchor="start" fill="${Z.sokText}">${SOK} ↓</text>` : `
  <line x1="${sx(0).toFixed(2)}" y1="${sy(sokYL).toFixed(2)}" x2="${sx(L).toFixed(2)}" y2="${sy(sokYR).toFixed(2)}"
    stroke="${Z.sok}" stroke-width="${(0.65*symSc).toFixed(3)}"/>
  <text x="${(sx(0)-1).toFixed(2)}" y="${(sy(sokYL)+0.9).toFixed(2)}" font-size="${fs(2.2)}" text-anchor="end" fill="${Z.sokText}">${SOK}</text>
  <text x="${(sx(L)+1).toFixed(2)}" y="${(sy(sokYR)+0.9).toFixed(2)}" font-size="${fs(2.2)}" text-anchor="start" fill="${Z.sokText}">${SOK}</text>`;

  // Masts — solid thin lines, no circles
  const mastSvg = `
  <line x1="${sx(0).toFixed(2)}" y1="${sy(mastUL).toFixed(2)}" x2="${sx(0).toFixed(2)}" y2="${sy(h1abs).toFixed(2)}"
    stroke="${Z.mast}" stroke-width="${(0.28*symSc).toFixed(3)}"/>
  <line x1="${sx(L).toFixed(2)}" y1="${sy(mastUR).toFixed(2)}" x2="${sx(L).toFixed(2)}" y2="${sy(h2abs).toFixed(2)}"
    stroke="${Z.mast}" stroke-width="${(0.28*symSc).toFixed(3)}"/>`;

  // Anchor labels
  let anchLbl = '';
  if (hasSok) {
    // Absolute kote at anchor point (above curve)
    anchLbl += `
  <text x="${(sx(0)+2).toFixed(2)}" y="${(sy(h1abs)-2).toFixed(2)}" font-size="${fs(2.3)}" fill="${Z.anker}">${h1abs.toFixed(2)} ${MUM}</text>
  <text x="${(sx(L)-2).toFixed(2)}" y="${(sy(h2abs)-2).toFixed(2)}" font-size="${fs(2.3)}" text-anchor="end" fill="${Z.anker}">${h2abs.toFixed(2)} ${MUM}</text>`;
    // Relative height h= at midpoint of each mast line
    const mastMidYL = (sy(mastUL) + sy(h1abs)) / 2;
    const mastMidYR = (sy(mastUR) + sy(h2abs)) / 2;
    anchLbl += `
  <text x="${(sx(0)+1.5).toFixed(2)}" y="${(mastMidYL+0.8).toFixed(2)}" font-size="${fs(2.0)}" fill="${Z.ankerLeise}">h&#x2081; = ${h1.toFixed(2)} m</text>
  <text x="${(sx(L)-1.5).toFixed(2)}" y="${(mastMidYR+0.8).toFixed(2)}" font-size="${fs(2.0)}" text-anchor="end" fill="${Z.ankerLeise}">h&#x2082; = ${h2.toFixed(2)} m</text>`;
  } else {
    anchLbl = `
  <text x="${(sx(0)+2).toFixed(2)}" y="${(sy(h1abs)-2).toFixed(2)}" font-size="${fs(2.3)}" fill="${Z.anker}">h&#x2081; = ${h1.toFixed(2)} m</text>
  <text x="${(sx(L)-2).toFixed(2)}" y="${(sy(h2abs)-2).toFixed(2)}" font-size="${fs(2.3)}" text-anchor="end" fill="${Z.anker}">h&#x2082; = ${h2.toFixed(2)} m</text>`;
  }

  // Probe list and strip dimensions — reuse early-computed values
  const _probesEarly = [
    { xv: probeX1 }, { xv: probeX2 }, { xv: probeX3 }, { xv: probeX4 },
  ].filter(p => p.xv !== null);
  const _stripRowH   = _stripRowH_early;
  const _stripNRows  = _stripNRows_early;
  // Zeilen: Punkt + x [m] + T2-SOK [m] [+ T3-SOK [m]] [+ T2 [m ü.M.] [+ T3 [m ü.M.]] + SOK [m ü.M.]]
  const _stripH      = _stripH_early;

  // Span dimension line — segmented between probes, or full L if no probes
  const _stripY0ref = drawY1 - _stripH;
  const spanDimYraw = sy(yMin) + 5;
  const spanDimYmax = (_probesEarly.length > 0 ? _stripY0ref : drawY1) - 6;
  const spanDimY = Math.min(spanDimYraw, spanDimYmax);
  let spanDim = '';
  if (_probesEarly.length > 0) {
    // Segments: mast A → M1 → M2 → … → mast B
    const dimPts = [0, ..._probesEarly.map(p => p.xv), L];
    // Draw the full baseline once
    spanDim += `<line x1="${sx(0).toFixed(2)}" y1="${spanDimY.toFixed(2)}" x2="${sx(L).toFixed(2)}" y2="${spanDimY.toFixed(2)}" stroke="${Z.mass}" stroke-width="${(0.25*symSc).toFixed(3)}"/>`;
    dimPts.forEach((xv, i) => {
      const px = sx(xv).toFixed(2);
      // Tick at each point
      spanDim += `<line x1="${px}" y1="${(spanDimY-1.5*symSc).toFixed(2)}" x2="${px}" y2="${(spanDimY+1.5*symSc).toFixed(2)}" stroke="${Z.massStrich}" stroke-width="${(0.35*symSc).toFixed(3)}"/>`;
      // Distance label between this and next point
      if (i < dimPts.length - 1) {
        const xNext  = dimPts[i + 1];
        const midPx  = ((sx(xv) + sx(xNext)) / 2).toFixed(2);
        const distM  = (xNext - xv).toFixed(2);
        spanDim += `<text x="${midPx}" y="${(spanDimY - 2).toFixed(2)}" font-size="${fs(2.2)}" text-anchor="middle" fill="${Z.massText}">${distM} m</text>`;
      }
    });
  } else {
    // No probes: show total span L
    spanDim = `
  <line x1="${sx(0).toFixed(2)}" y1="${(spanDimY-1.5*symSc).toFixed(2)}" x2="${sx(0).toFixed(2)}" y2="${(spanDimY+1.5*symSc).toFixed(2)}" stroke="${Z.massStrich}" stroke-width="${(0.28*symSc).toFixed(3)}"/>
  <line x1="${sx(0).toFixed(2)}" y1="${spanDimY.toFixed(2)}" x2="${sx(L).toFixed(2)}" y2="${spanDimY.toFixed(2)}" stroke="${Z.massStrich}" stroke-width="${(0.28*symSc).toFixed(3)}"/>
  <line x1="${sx(L).toFixed(2)}" y1="${(spanDimY-1.5*symSc).toFixed(2)}" x2="${sx(L).toFixed(2)}" y2="${(spanDimY+1.5*symSc).toFixed(2)}" stroke="${Z.massStrich}" stroke-width="${(0.28*symSc).toFixed(3)}"/>
  <text x="${((sx(0)+sx(L))/2).toFixed(2)}" y="${(spanDimY-1.5).toFixed(2)}" font-size="${fs(2.4)}" text-anchor="middle" fill="${Z.massL}">L = ${L.toFixed(2)} m</text>`;
  }

  // Sag annotation at T2 lowest point
  const x0T2     = cDisp.x_low;
  const y0T2     = absY(x0T2, catY(x0T2, cDisp));
  const yChordT2 = h1abs + (h2abs - h1abs) * x0T2 / L;
  const sagVal   = cDisp.sag;
  const sagSvg   = sagVal > 0.01 ? `
  <line x1="${sx(x0T2).toFixed(2)}" y1="${sy(yChordT2).toFixed(2)}" x2="${sx(x0T2).toFixed(2)}" y2="${sy(y0T2).toFixed(2)}"
    stroke="${t2clr}" stroke-width="${(0.25*symSc).toFixed(3)}" stroke-dasharray="${(1.2*symSc).toFixed(2)},${(0.8*symSc).toFixed(2)}" opacity="0.7"/>
  <text x="${(sx(x0T2)+1.5).toFixed(2)}" y="${((sy(yChordT2)+sy(y0T2))/2+0.9).toFixed(2)}"
    font-size="${fs(2.2)}" fill="${t2clr}" opacity="0.85">f = ${sagVal.toFixed(2)} m</text>` : '';

  // Mindestabstand-Kurven (parallel zur T2-Kurve, versetzt) — mit Schraffur-Füllung
  let minClearSvg = '';
  let minClearDefsSvg = '';
  const _minC = minClearance;
  if (_minC !== null && _minC > 0) {
    const _isEl   = sysMode === 'el';
    const _mcOffsets = _isEl ? [+_minC, -_minC] : [+_minC];
    const _mcSw   = (0.38 * symSc).toFixed(3);
    const _mcDash = `${(2.8*symSc).toFixed(2)},${(2.2*symSc).toFixed(2)}`;

    // SVG-Schraffurmuster — exakte Replikation des Canvas-Musters (kein patternTransform)
    // Canvas: moveTo(0,patSz)→lineTo(patSz,0) = Diagonale von unten-links nach oben-rechts (/)
    // SVG: gleiche 3 Linien pro Kachel direkt ohne Rotation, damit der Winkel identisch ist
    const _pid2  = 'mcp-t2', _pid3 = 'mcp-t3';
    const _psz   = 3.2;        // Kachelgrösse [mm] — entspricht patSz=7px bei typischer DPI
    const _psw   = 0.28;       // Strichstärke [mm] — entspricht lineWidth=0.7px
    const _ph    = _psz;
    const _hh    = _psz / 2;
    // Die drei Linien erzeugen eine nahtlose Diagonalkachelung (wie Canvas):
    //   Hauptlinie: (0,_psz)→(_psz,0)  +  Randergänzungen für lückenloses Kacheln
    const _hatchLines = (clr) =>
      `<line x1="0" y1="${_ph}" x2="${_ph}" y2="0" stroke="${clr}" stroke-width="${_psw}"/>` +
      `<line x1="${-_hh}" y1="${_hh}" x2="${_hh}" y2="${-_hh}" stroke="${clr}" stroke-width="${_psw}"/>` +
      `<line x1="${_hh}" y1="${_ph + _hh}" x2="${_ph + _hh}" y2="${_hh}" stroke="${clr}" stroke-width="${_psw}"/>`;
    minClearDefsSvg = `<defs>
      <pattern id="${_pid2}" x="0" y="0" width="${_psz}" height="${_psz}" patternUnits="userSpaceOnUse">
        ${_hatchLines(t2clr)}
      </pattern>
      ${c3data ? `<pattern id="${_pid3}" x="0" y="0" width="${_psz}" height="${_psz}" patternUnits="userSpaceOnUse">
        ${_hatchLines(t3clr)}
      </pattern>` : ''}
    </defs>`;

    // Gefülltes Schraffur-Polygon für eine Kurve
    const _mcFillPoly = (c, pid) => {
      let s = '';
      const offs = _isEl ? [+_minC, -_minC] : [+_minC];
      offs.forEach(off => {
        let d = '';
        // Vorwärts entlang der Offset-Kurve
        for (let i = 0; i <= N; i++) {
          const x = L * i / N;
          const y = absY(x, catY(x, c)) + off;
          d += (i === 0 ? 'M' : 'L') + sx(x).toFixed(2) + ',' + sy(y).toFixed(2) + ' ';
        }
        if (!_isEl && off > 0) {
          // NFL/RFL: Polygon bis SOK-Linie (oder Zeichnungsunterrand wenn nur Kettenwerk)
          if (hasSok && drawingExtent !== 'catenary') {
            // Entlang SOK von rechts nach links
            for (let i = N; i >= 0; i--) {
              const x = L * i / N;
              d += `L${sx(x).toFixed(2)},${sy(sokAt(x)).toFixed(2)} `;
            }
          } else {
            // Zeichnungsunterrand (flach)
            const flatY = (sy(yMin) + 1).toFixed(2);
            d += `L${sx(L).toFixed(2)},${flatY} L${sx(0).toFixed(2)},${flatY} `;
          }
        } else {
          // Einzelleiter: Rückweg entlang der Kettenlinie
          for (let i = N; i >= 0; i--) {
            const x = L * i / N;
            d += `L${sx(x).toFixed(2)},${sy(absY(x, catY(x, c))).toFixed(2)} `;
          }
        }
        d += 'Z';
        s += `<path d="${d.trim()}" fill="url(#${pid})" opacity="0.15" stroke="none"/>`;
      });
      return s;
    };

    // Schraffur-Füllung (vor den Randlinien, damit Linien obenauf liegen)
    minClearSvg += _mcFillPoly(cDisp, _pid2);
    if (c3data) minClearSvg += _mcFillPoly(c3data, _pid3);

    // Gestrichelte Randlinien (wie bisher)
    _mcOffsets.forEach(off => {
      minClearSvg += makePath(x => absY(x, catY(x, cDisp)) + off, _mcDash, _mcSw) +
        ` stroke="${t2clr}" opacity="0.3"/>`;
      if (c3data) {
        minClearSvg += makePath(x => absY(x, catY(x, c3data)) + off, _mcDash, _mcSw) +
          ` stroke="${t3clr}" opacity="0.25"/>`;
      }
    });

    // Label am rechten Rand der oberen Kurve
    const _xLbl   = L * 0.97;
    const _yLblAbs = absY(_xLbl, catY(_xLbl, cDisp)) + _minC;
    const _fsLbl  = (2.0 * symSc).toFixed(2);
    minClearSvg += `<text x="${(sx(_xLbl)-1).toFixed(2)}" y="${(sy(_yLblAbs)-1.2).toFixed(2)}"
      font-size="${_fsLbl}" text-anchor="end" fill="${t2clr}" opacity="0.55">⌀ ${_minC.toFixed(2)} m</text>`;
  }

  // Measurement points — Längsprofil style
  const probes = [
    { xv: probeX1, badge: 'M1' }, { xv: probeX2, badge: 'M2' },
    { xv: probeX3, badge: 'M3' }, { xv: probeX4, badge: 'M4' },
  ].filter(p => p.xv !== null);

  // Data strip — reuse dimensions declared before spanDim
  const stripRowH      = _stripRowH;
  const stripRowLabels = [
    t('draw.punkt'), 'x [m]', `T2-${SOK} [m]`,
    ...(c3data ? [`T3-${SOK} [m]`] : []),
    ...(hasSok ? [`T2 [${MUM}]`] : []),
    ...(hasSok && c3data ? [`T3 [${MUM}]`] : []),
    ...(hasSok ? [`${SOK} [${MUM}]`] : []),
    ...(_hBand ? [`H [${MUM}]`, 'a [m]'] : []),
  ];
  const stripNRows   = _stripNRows;
  const stripH       = _stripH;
  const stripY0      = drawY1 - stripH;
  const lblColW      = 32;

  // Reset interactive strip data (filled in probes.forEach below)
  _drawingProbeData   = [];
  _drawingStripLabels = [...stripRowLabels];
  _drawingT2Clr       = t2clr;
  _drawingT3Clr       = t3clr || '#1d4ed8';

  let probesSvg = '';

  if (probes.length > 0) {
    // SVG-interner Datenstreifen (nur für PDF-Export)
    if (stripInSvg) {
      const divX = drawX0 + lblColW;
      // Per-row backgrounds (alternating) + dividers
      for (let r = 0; r < stripNRows; r++) {
        const ry0 = stripY0 + r * stripRowH;
        const bg  = r % 2 === 0 ? '#f7f7f7' : '#ffffff';
        probesSvg += `<rect x="${drawX0}" y="${ry0.toFixed(2)}" width="${drawW}" height="${stripRowH.toFixed(2)}" fill="${bg}"/>`;
        if (r > 0)
          probesSvg += `<line x1="${drawX0}" y1="${ry0.toFixed(2)}" x2="${drawX1}" y2="${ry0.toFixed(2)}" stroke="#e4e4e4" stroke-width="0.2"/>`;
      }
      // Outer border
      probesSvg += `<rect x="${drawX0}" y="${stripY0.toFixed(2)}" width="${drawW}" height="${stripH.toFixed(2)}" fill="none" stroke="#cecece" stroke-width="0.3"/>`;
      // Label/value divider
      probesSvg += `<line x1="${divX.toFixed(2)}" y1="${stripY0.toFixed(2)}" x2="${divX.toFixed(2)}" y2="${(stripY0+stripH).toFixed(2)}" stroke="#d0d0d0" stroke-width="0.3"/>`;
      // Row labels — styled like HTML strip
      stripRowLabels.forEach((lbl, r) => {
        const ty  = (stripY0 + r * stripRowH + stripRowH * 0.65).toFixed(2);
        const clr = lbl.includes('T2') ? t2clr : lbl.includes('T3') ? t3clr : '#999';
        const fw  = r === 0 ? '600' : '600';
        probesSvg += `<text x="${(drawX0 + 2).toFixed(2)}" y="${ty}" font-size="2.3" font-weight="${fw}" fill="${clr}">${lbl}</text>`;
      });
    }

    // Lotlinie reicht im interaktiven Modus bis zum unteren Zeichnungsrand
    const plumbEndY = stripInSvg ? stripY0 : drawY1;

    // Each probe: plumb line + SOK tick + circle + data cells
    probes.forEach(({ xv, badge }) => {
      const tsHeight = catY(xv, cDisp);
      const y2abs    = absY(xv, tsHeight);
      const sokKote  = sokAt(xv);
      const px       = sx(xv);
      const py       = sy(y2abs);

      // Dashed plumb line
      probesSvg += `
    <line x1="${px.toFixed(2)}" y1="${(py + 1.3*symSc).toFixed(2)}" x2="${px.toFixed(2)}" y2="${plumbEndY.toFixed(2)}"
      stroke="${t2clr}" stroke-width="${(0.5*symSc).toFixed(3)}" stroke-dasharray="${(2.0*symSc).toFixed(2)},${(1.5*symSc).toFixed(2)}" opacity="0.45"/>`;


      // Circle on curve
      probesSvg += `
    <circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="${(1.2*symSc).toFixed(2)}" fill="${t2clr}" stroke="${Z.hg}" stroke-width="${(0.35*symSc).toFixed(3)}"/>`;

      // Zellwerte (für SVG-Strip und HTML-Tabelle) [val, fontSize, fontWeight, color]
      const cellVals = [
        [badge,               '2.4', '700', t2clr],
        [xv.toFixed(2),       '2.0', '400', '#666'],
        [tsHeight.toFixed(2), '2.0', '400', t2clr],
      ];
      if (c3data) cellVals.push([catY(xv, c3data).toFixed(2), '2.0', '400', t3clr]);
      if (hasSok) {
        cellVals.push([y2abs.toFixed(2), '2.0', '400', t2clr]);
      }
      if (hasSok && c3data) {
        const y3abs = absY(xv, catY(xv, c3data));
        cellVals.push([y3abs.toFixed(2), '2.0', '400', t3clr]);
      }
      if (hasSok) {
        cellVals.push([sokKote.toFixed(2), '2.0', '400', '#888']);
      }
      if (_hBand) {
        const i = +badge.slice(1), hW = probeHWerte[i - 1];
        const a = (_nachweis[0]?.jePunkt || []).find(p => p.m === i)?.abstand;
        const aOk = Number.isFinite(a) && a >= (minClearance ?? 0);
        cellVals.push([hW !== null ? hW.toFixed(2) : '—', '2.0', '400', Z.hindernis]);
        cellVals.push([Number.isFinite(a) ? a.toFixed(2) : '—', '2.0', '600', Number.isFinite(a) ? (aOk ? Z.gut : Z.schlecht) : '#888']);
      }

      // SVG-Texte nur im PDF-Modus
      if (stripInSvg) {
        cellVals.forEach(([val, , fw, clr], r) => {
          const ty  = (stripY0 + r * stripRowH + stripRowH * 0.65).toFixed(2);
          const fsz = r === 0 ? '2.8' : '2.3';
          probesSvg += `<text x="${px.toFixed(2)}" y="${ty}" font-size="${fsz}" font-weight="${fw}" text-anchor="middle" fill="${clr}">${val}</text>`;
        });
      }

      // Immer für HTML-Tabelle speichern
      _drawingProbeData.push({ xFrac: px / VW, cells: cellVals.map(([v]) => v), colors: cellVals.map(([,,, c]) => c || null) });

      // T3 diamond if applicable
      if (c3data) {
        const y3abs = absY(xv, catY(xv, c3data));
        const s = 1.3 * symSc, dx = sx(xv), dy = sy(y3abs);
        probesSvg += `
    <polygon points="${dx},${(dy-s).toFixed(2)} ${(dx+s).toFixed(2)},${dy} ${dx},${(dy+s).toFixed(2)} ${(dx-s).toFixed(2)},${dy}"
      fill="${t3clr}" stroke="${Z.hg}" stroke-width="${(0.25*symSc).toFixed(3)}"/>`;
      }
    });
  }

  // If no measurement probes: add synthetic sag-max point for the strip
  if (probes.length === 0) {
    const xv       = xSagMax;
    const tsHeight = catY(xv, cDisp);
    const y2abs    = absY(xv, tsHeight);
    const sokKote  = sokAt(xv);
    const px       = sx(xv);
    const py       = sy(y2abs);

    // Dashed plumb line + circle in SVG
    const plumbEndY = drawY1;
    probesSvg += `
    <line x1="${px.toFixed(2)}" y1="${(py + 1.3).toFixed(2)}" x2="${px.toFixed(2)}" y2="${plumbEndY.toFixed(2)}"
      stroke="${t2clr}" stroke-width="0.5" stroke-dasharray="2.0,1.5" opacity="0.45"/>`;
    probesSvg += `
    <circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="1.2" fill="${t2clr}" stroke="${Z.hg}" stroke-width="0.35"/>`;
    if (c3data) {
      const y3abs = absY(xv, catY(xv, c3data));
      const dx = px, dy = sy(y3abs), s = 1.3;
      probesSvg += `
    <polygon points="${dx},${(dy-s).toFixed(2)} ${(dx+s).toFixed(2)},${dy} ${dx},${(dy+s).toFixed(2)} ${(dx-s).toFixed(2)},${dy}"
      fill="${t3clr}" stroke="${Z.hg}" stroke-width="0.25"/>`;
    }

    // Strip cell values
    const cellVals = [
      ['f',               '2.4', '700'],
      [xv.toFixed(2),     '2.0', '400'],
      [tsHeight.toFixed(2),'2.0','400'],
    ];
    if (c3data) cellVals.push([catY(xv, c3data).toFixed(2), '2.0', '400']);
    if (hasSok) {
      cellVals.push([y2abs.toFixed(2),   '2.0', '400']);
      cellVals.push([sokKote.toFixed(2), '2.0', '400']);
    }
    _drawingProbeData.push({ xFrac: px / VW, cells: cellVals.map(([v]) => v) });
  }

  // Compute zoom centre (average probe position, or midspan if no probes)
  if (_drawingProbeData.length > 0) {
    _drawingCenterXFrac = _drawingProbeData.reduce((s, p) => s + p.xFrac, 0) / _drawingProbeData.length;
  } else {
    _drawingCenterXFrac = sx(L / 2) / VW;
  }

  // Hindernisse oberhalb (Abstandsprüfung des Felds): Unterkante bzw. Punkte und
  // Abstand im massgebenden Lastfall. Farben je Thema (PDF immer hell).
  const obsClr = Z.hindernis;
  let obstSvg = '';
  _nachweis.forEach(({ h, best, ok, unten }) => {
    if (!best) return;
    const P = hindernisPunkte(h.punkte);
    const farbe = ok ? Z.gut : Z.schlecht;
    const sw = (0.55 * symSc).toFixed(3);
    const seite = unten ? 1 : -1;   // Schraffur auf der Seite des Hindernisses (oberhalb: nach oben, unterhalb: nach unten)
    if (h.verbinden && P.length > 1) {
      const xa = Math.max(0, P[0].x), xb = Math.min(L, P[P.length - 1].x);
      const xs = [xa, ...P.map(p => p.x).filter(x => x > xa && x < xb), xb];
      obstSvg += `<polyline points="${xs.map(x => `${sx(x).toFixed(2)},${sy(kanteBei(P, x, unten)).toFixed(2)}`).join(' ')}" fill="none" stroke="${obsClr}" stroke-width="${sw}"/>`;
      const schritt = Math.max((xb - xa) / 40, 0.25);
      for (let x = xa; x <= xb + 1e-9; x += schritt) {
        const yk = sy(kanteBei(P, Math.min(x, xb), unten));
        obstSvg += `<line x1="${sx(x).toFixed(2)}" y1="${yk.toFixed(2)}" x2="${(sx(x) + 1.2 * symSc).toFixed(2)}" y2="${(yk + seite * 1.6 * symSc).toFixed(2)}" stroke="${obsClr}" stroke-width="${(0.25 * symSc).toFixed(3)}"/>`;
      }
    } else {
      P.filter(p => p.x >= 0 && p.x <= L).forEach(p => {
        const ox = sx(p.x), oy = sy(p.h), hk = 4 * symSc, ta = 2.6 * symSc, tb = 1.6 * symSc;
        obstSvg += `<line x1="${(ox - hk).toFixed(2)}" y1="${oy.toFixed(2)}" x2="${(ox + hk).toFixed(2)}" y2="${oy.toFixed(2)}" stroke="${obsClr}" stroke-width="${sw}"/>`;
        // Dreieck zeigt zum Leiter (oberhalb: nach unten, unterhalb: nach oben)
        obstSvg += `<polygon points="${ox.toFixed(2)},${(oy - seite * ta).toFixed(2)} ${(ox - tb).toFixed(2)},${(oy - seite * 0.2 * symSc).toFixed(2)} ${(ox + tb).toFixed(2)},${(oy - seite * 0.2 * symSc).toFixed(2)}" fill="${obsClr}" opacity="0.85"/>`;
      });
    }
    const bx = sx(best.x), by = sy(best.uk), ly = sy(absY(best.x, catY(best.x, best.c)));
    // Masslinie an der massgebenden Stelle: Leiter ↔ Hindernis mit Endstrichen, Wert daneben
    const tk = 1.2 * symSc, msw = (0.45 * symSc).toFixed(3);
    obstSvg += `<line x1="${bx.toFixed(2)}" y1="${by.toFixed(2)}" x2="${bx.toFixed(2)}" y2="${ly.toFixed(2)}" stroke="${farbe}" stroke-width="${msw}"/>`
      + `<line x1="${(bx - tk).toFixed(2)}" y1="${by.toFixed(2)}" x2="${(bx + tk).toFixed(2)}" y2="${by.toFixed(2)}" stroke="${farbe}" stroke-width="${msw}"/>`
      + `<line x1="${(bx - tk).toFixed(2)}" y1="${ly.toFixed(2)}" x2="${(bx + tk).toFixed(2)}" y2="${ly.toFixed(2)}" stroke="${farbe}" stroke-width="${msw}"/>`;
    const links = best.x > L * 0.7;
    obstSvg += `<text x="${(bx + (links ? -1.6 : 1.6) * symSc).toFixed(2)}" y="${((by + ly) / 2 + 0.8 * symSc).toFixed(2)}" text-anchor="${links ? 'end' : 'start'}" font-size="${(2.3 * symSc).toFixed(2)}" font-weight="700" fill="${farbe}" stroke="${Z.hg}" stroke-width="${(0.5 * symSc).toFixed(3)}" paint-order="stroke">${escHtml(h.name ? h.name + ': ' : '')}a = ${best.abstand.toFixed(2)} m ${ok ? '✓' : '✗'}</text>`;
  });

  // Footer: scale bars + legend (PDF only)
  const _t3v_foot = c3data
    ? (v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp3')?.value))
    : null;
  const scalebar = (() => {
    if (!stripInSvg) return '';
    const fy = drawY1;          // 166 mm
    const fH = footH;           // 14 mm
    let s = `<line x1="0" y1="${fy}" x2="${VW}" y2="${fy}" stroke="#c8c8c8" stroke-width="0.3"/>`;

    // ── Horizontal scale bar ──
    const barLengths = [1,2,5,10,20,25,50,100];
    const barM = barLengths.find(m => m * ppm >= 8 && m * ppm <= 45) ?? 10;
    const barW = barM * ppm;
    const bx0  = drawX0 + 1;
    const bY   = fy + fH * 0.53;
    const hw   = barW / 2;
    s += `<text x="${bx0}" y="${(fy+3.8).toFixed(1)}" font-size="2.1" font-weight="600" fill="#444">${t('draw.masstab')} H  1:${scale}</text>`;
    s += `<rect x="${bx0}" y="${(bY-1.1).toFixed(1)}" width="${hw.toFixed(1)}" height="2.2" fill="#333"/>`;
    s += `<rect x="${(bx0+hw).toFixed(1)}" y="${(bY-1.1).toFixed(1)}" width="${hw.toFixed(1)}" height="2.2" fill="#999"/>`;
    s += `<rect x="${bx0}" y="${(bY-1.1).toFixed(1)}" width="${barW.toFixed(1)}" height="2.2" fill="none" stroke="#333" stroke-width="0.3"/>`;
    s += `<text x="${bx0}" y="${(bY+4).toFixed(1)}" font-size="1.9" text-anchor="middle" fill="#666">0</text>`;
    s += `<text x="${(bx0+hw).toFixed(1)}" y="${(bY+4).toFixed(1)}" font-size="1.9" text-anchor="middle" fill="#666">${barM/2}</text>`;
    s += `<text x="${(bx0+barW).toFixed(1)}" y="${(bY+4).toFixed(1)}" font-size="1.9" text-anchor="middle" fill="#666">${barM} m</text>`;

    // ── Vertical scale ──
    const vScale = Math.round(scale / (vEx || 1));
    const vbX = bx0 + barW + 9;
    s += `<text x="${vbX.toFixed(1)}" y="${(fy+3.8).toFixed(1)}" font-size="2.1" font-weight="600" fill="#444">${t('draw.masstab')} V  1:${vScale}${vEx > 1 ? `   (${t('draw.ueberhoeung')} ${vEx}×)` : ''}</text>`;

    // ── SOK info ──
    if (hasSok) {
      const sokInfoX = vbX;
      s += `<text x="${sokInfoX.toFixed(1)}" y="${(bY+4).toFixed(1)}" font-size="1.9" fill="#aaa">${SOK} ${t('draw.li')}: ${sokLv.toFixed(2)} ${MUM}${(sokR !== null && Math.abs(sokR - sokLv) > 0.001) ? `   ${SOK} ${t('draw.re')}: ${sokR.toFixed(2)} ${MUM}` : ''}</text>`;
    }

    // ── Legend ──
    let lx = VW * 0.50;
    const lY  = fy + fH * 0.38;
    const ltY = (lY + 1.2).toFixed(1);
    const lw  = 10;

    s += `<line x1="${lx.toFixed(1)}" y1="${lY.toFixed(1)}" x2="${(lx+lw).toFixed(1)}" y2="${lY.toFixed(1)}" stroke="#bbb" stroke-width="0.6" stroke-dasharray="3,2"/>`;
    s += `<text x="${(lx+lw+2).toFixed(1)}" y="${ltY}" font-size="2.2" fill="#999">${subUni(t(sysMode === 'el' ? 'leg.leiter1' : 'leg.ts1'))} = ${T1}°C</text>`;
    lx += 34;

    s += `<line x1="${lx.toFixed(1)}" y1="${lY.toFixed(1)}" x2="${(lx+lw).toFixed(1)}" y2="${lY.toFixed(1)}" stroke="${t2clr}" stroke-width="1.0"/>`;
    s += `<text x="${(lx+lw+2).toFixed(1)}" y="${ltY}" font-size="2.2" font-weight="600" fill="${t2clr}">${subUni(t(sysMode === 'el' ? 'leg.leiter2' : 'leg.ts2'))} = ${T2}°C</text>`;
    lx += 34;

    if (showFd) {
      s += `<line x1="${lx.toFixed(1)}" y1="${lY.toFixed(1)}" x2="${(lx+lw).toFixed(1)}" y2="${lY.toFixed(1)}" stroke="${fdClr}" stroke-width="0.5"/>`;
      s += `<text x="${(lx+lw+2).toFixed(1)}" y="${ltY}" font-size="2.2" fill="#888">${subUni(t('leg.fd2'))}</text>`;
      lx += 26;
    }

    if (c3data && _t3v_foot !== null) {
      s += `<line x1="${lx.toFixed(1)}" y1="${lY.toFixed(1)}" x2="${(lx+lw).toFixed(1)}" y2="${lY.toFixed(1)}" stroke="${t3clr}" stroke-width="0.6" stroke-dasharray="3,2"/>`;
      s += `<text x="${(lx+lw+2).toFixed(1)}" y="${ltY}" font-size="2.2" fill="${t3clr}">${subUni(t(sysMode === 'el' ? 'leg.leiter3' : 'leg.ts3'))} = ${_t3v_foot}°C</text>`;
      lx += 34;
    }
    if (hfOk) {
      s += `<line x1="${lx.toFixed(1)}" y1="${lY.toFixed(1)}" x2="${(lx+lw).toFixed(1)}" y2="${lY.toFixed(1)}" stroke="#4a5cb8" stroke-width="0.5" stroke-dasharray="3,1.6"/>`;
      s += `<text x="${(lx+lw+2).toFixed(1)}" y="${ltY}" font-size="2.2" fill="#555">hf<tspan font-size="1.6" dy="0.5">min</tspan><tspan dy="-0.5"> ${hfZ.min.toFixed(3)} / hf</tspan><tspan font-size="1.6" dy="0.5">max</tspan><tspan dy="-0.5"> ${hfZ.max.toFixed(3)} m</tspan></text>`;
    }

    return s;
  })();

  // hf_min / hf_max: Band parallel zur SOK, Fahrdraht bei T₂ dagegen geprüft
  let hfSvg = '';
  if (hfOk) {
    const cMin = Z.hfMin, cMax = Z.hfMax, cBand = Z.hfBand;
    const yl = v => sy(absY(0, v)), yr = v => sy(absY(L, v));
    hfSvg += `<polygon points="${sx(0).toFixed(2)},${yl(hfZ.max).toFixed(2)} ${sx(L).toFixed(2)},${yr(hfZ.max).toFixed(2)} ${sx(L).toFixed(2)},${yr(hfZ.min).toFixed(2)} ${sx(0).toFixed(2)},${yl(hfZ.min).toFixed(2)}" fill="${cBand}" stroke="none"/>`;
    const dash = `${(3*symSc).toFixed(2)},${(1.6*symSc).toFixed(2)}`;
    // Rand in Hintergrundfarbe um die Schrift: bleibt über Linien lesbar
    const halo = ` stroke="${Z.hg}" stroke-width="${(0.55*symSc).toFixed(3)}" stroke-linejoin="round" paint-order="stroke"`;
    const hfSub = txt => escHtml(txt).replace(/hf_(min|max)/g, `hf<tspan font-size="${fs(1.4)}" baseline-shift="sub">$1</tspan>`);
    [[hfZ.min, cMin, 'min'], [hfZ.max, cMax, 'max']].forEach(([v, c, k]) => {
      hfSvg += `<line x1="${sx(0).toFixed(2)}" y1="${yl(v).toFixed(2)}" x2="${sx(L).toFixed(2)}" y2="${yr(v).toFixed(2)}" stroke="${c}" stroke-width="${(0.4*symSc).toFixed(3)}" stroke-dasharray="${dash}"/>`;
      // hf_max über, hf_min unter dem Band: überlagern sich auch bei schmalem Band nicht
      hfSvg += `<text x="${(sx(L) - 1.5).toFixed(2)}" y="${(yr(v) + (k === 'max' ? -1.2 : 3.2) * symSc).toFixed(2)}" font-size="${fs(2.1)}" text-anchor="end" fill="${c}" font-weight="600"${halo}>hf<tspan font-size="${fs(1.5)}" dy="0.6">${k}</tspan><tspan dy="-0.6"> = ${v.toFixed(3)} m${hasSok ? ' ' + t('pdf.sok.short') : ''}</tspan></text>`;
    });
    // Geprüft wird die Soll-Fahrdrahthöhe am Stützpunkt (h − sh); die Ist-Lage bei T₂ nur als Info
    let tief = { h: Infinity }, hoch = { h: -Infinity };
    for (let i = 0; i <= N; i++) {
      const x = L * i / N, h = fdY(x) - absY(x, 0);
      if (h < tief.h) tief = { x, h };
      if (h > hoch.h) hoch = { x, h };
    }
    const pr = hfSollPruefung(hfZ, { h1, h2, sh });
    const marke = (x, h, gut, txt) => `<circle cx="${sx(x).toFixed(2)}" cy="${sy(absY(x, h)).toFixed(2)}" r="${(1.1*symSc).toFixed(2)}" fill="${gut ? Z.gut : Z.schlecht}" stroke="${Z.hg}" stroke-width="${(0.3*symSc).toFixed(3)}"/>`
      + (txt ? `<text x="${(sx(x) + (x > L / 2 ? -1.8 : 1.8) * symSc).toFixed(2)}" y="${(sy(absY(x, h)) + 3.4*symSc).toFixed(2)}" font-size="${fs(2.0)}" fill="${Z.schlecht}" font-weight="600" text-anchor="${x > L / 2 ? 'end' : 'start'}"${halo}>${txt}</text>` : '');
    [[0, pr.soll[0]], [L, pr.soll[1]]].forEach(([x, h]) => {
      const zuTief = h < hfZ.min - 1e-9, zuHoch = h > hfZ.max + 1e-9;
      hfSvg += marke(x, h, !zuTief && !zuHoch,
        zuTief ? `${t('draw.fd')} ${h.toFixed(2)} m &lt; ${hfSub('hf_min')}` : zuHoch ? `${t('draw.fd')} ${h.toFixed(2)} m &gt; ${hfSub('hf_max')}` : '');
    });
    const ok = pr.ok;
    // Prüfergebnis links unter der Spannweiten-Bemassung (frei von Seil, Band und Messpunkt-Massen)
    hfSvg += `<text x="${(sx(0) + 1.5).toFixed(2)}" y="${(spanDimY + 3.6 * symSc).toFixed(2)}" font-size="${fs(2.0)}" fill="${ok ? Z.gut : Z.schlecht}" font-weight="600"${halo}>${ok ? '✓' : '✗'} ${hfSub(t(ok ? 'draw.hf.ok' : 'draw.hf.nok'))} (${t('draw.hf.soll')} ${pr.soll.map(h => h.toFixed(2)).join(' / ')} m · ${t('draw.hf.ist')} T<tspan font-size="${fs(1.4)}" baseline-shift="sub">2</tspan> ${tief.h.toFixed(2)} … ${hoch.h.toFixed(2)} m)</text>`;
  }

  // Legend — HTML overlay (nur bei interaktiver Ansicht; PDF bekommt eigene Legende im Titel)
  if (!stripInSvg) {
    const _legLine = (clr, dash = '', thick = false, thin = false) => {
      const sw = thick ? 2.2 : thin ? 0.9 : 1.3;
      const da = dash ? ` stroke-dasharray="${dash}"` : '';
      return `<svg width="24" height="9" style="flex-shrink:0;display:block"><line x1="1" y1="4.5" x2="23" y2="4.5" stroke="${clr}" stroke-width="${sw}"${da} stroke-linecap="round"/></svg>`;
    };
    const t3v = c3data ? (v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp3')?.value)) : null;
    const _el = sysMode === 'el';
    let legHtml = `<div class="dl-item">${_legLine(Z.t1, '5 3')} <span style="color:${Z.t1Text}">${t(_el ? 'leg.leiter1' : 'leg.ts1')} = ${T1}°C</span></div>`;
    legHtml += `<div class="dl-item">${_legLine(t2clr, '', true)} <span style="color:${t2clr};font-weight:600">${t(_el ? 'leg.leiter2' : 'leg.ts2')} = ${T2}°C</span></div>`;
    if (showFd) legHtml += `<div class="dl-item">${_legLine(fdClr, '', false, true)} <span>${t('leg.fd2')}</span></div>`;
    if (c3data) legHtml += `<div class="dl-item">${_legLine(t3clr, '4 2.5')} <span style="color:${t3clr}">${t(_el ? 'leg.leiter3' : 'leg.ts3')} = ${t3v}°C</span></div>`;
    if (hfOk) legHtml += `<div class="dl-item">${_legLine(Z.hfMin, '4 2')} <span style="color:${Z.hfMin}">hf<sub>min</sub></span> / <span style="color:${Z.hfMax}">hf<sub>max</sub></span> <span style="color:${Z.t1Text}">(${escHtml(sysName(hfEingabe.typ))}, c = ${hfEingabe.c} m)</span></div>`;
    else if (hfZ?.fehler) legHtml += `<div class="dl-item"><span style="color:${Z.schlecht}">${escHtml(t('draw.hf.fehler'))}</span></div>`;
    const legEl = document.getElementById('drawing-legend-overlay');
    if (legEl) { legEl.style.display = 'flex'; legEl.innerHTML = legHtml; }
  }

  const sokNoteSvg = ''; // Note moved to HTML strip footer

  // Title block — System + Spannweite als Haupttitel
  const _allMeta  = getProjMeta();
  const _pid = Projekte.aktuelleProjektId;
  const _docEntry = _pid ? _allMeta.find(m => m.id === _pid) : null;
  const _docName  = _docEntry?.name  || '';
  const _grpEntry = _docEntry?.parentId ? _allMeta.find(m => m.id === _docEntry.parentId) : null;
  const _grpName  = _grpEntry?.name  || '';
  const dateS  = new Date().toLocaleDateString(currentLang === 'fr' ? 'fr-CH' : currentLang === 'it' ? 'it-CH' : 'de-CH');
  const sysLbl = sysName(isNFL ? 'nfl' : isRFL ? 'rfl' : 'el');
  const mainTitle = `${sysLbl}  ·  L = ${L} m`;
  const t3v_pdf = c3data ? (v => isNaN(v) ? 80 : v)(parseFloat(document.getElementById('temp3')?.value)) : null;
  // Projekt- / Dateiname-Zeile (Zeile 2)
  const _nameParts = [_grpName, _docName].filter(Boolean);
  const _nameLine  = escHtml(_nameParts.join('  /  '));
  // Parameter-Zeile (Zeile 3)
  const _vScalePdf = Math.round(scale / (vEx || 1));
  const _sagPdf    = cDisp.sag;
  let _paramLine = `h&#x2081; = ${h1.toFixed(2)} m    h&#x2082; = ${h2.toFixed(2)} m    f = ${_sagPdf.toFixed(2)} m    L = ${L.toFixed(2)} m    ${t('draw.masstab')} H 1:${scale}    ${t('draw.masstab')} V 1:${_vScalePdf}${vEx > 1 ? `  (${vEx}×)` : ''}    T&#x2081; = ${T1}°C    T&#x2082; = ${T2}°C`;
  if (c3data && t3v_pdf !== null) _paramLine += `    T&#x2083; = ${t3v_pdf}°C`;
  const titleSvg = stripInSvg ? `
  <rect x="0" y="0" width="${VW}" height="${titleH}" fill="#ffffff"/>
  <rect x="0" y="0" width="${VW}" height="0.8" fill="#4a5cb8"/>
  <line x1="0" y1="${titleH}" x2="${VW}" y2="${titleH}" stroke="#dde0e6" stroke-width="0.3"/>
  <text x="3" y="7.8" font-size="4.2" font-weight="700" fill="#111218">${mainTitle}</text>
  <text x="${VW-3}" y="7.8" font-size="2.2" text-anchor="end" fill="#62656f">Durchhang ${APP_VERSION}  ·  ${dateS}</text>
  ${_nameLine ? `<text x="3" y="12.5" font-size="2.7" fill="#3a3c48">${_nameLine}</text>` : ''}
  <text x="3" y="${_nameLine ? '17.5' : '13'}" font-size="2.45" fill="#5f616c">${_paramLine}</text>` : '';

  // Frame and Y-axis
  const frameSvg   = stripInSvg ? `<rect x="${drawX0}" y="${drawY0}" width="${drawW}" height="${drawH}" fill="none" stroke="#d8d8d8" stroke-width="0.3"/>` : '';
  const yAxisSvg   = `<text transform="rotate(-90,8,${((drawY0+drawY1)/2).toFixed(1)})" x="8" y="${((drawY0+drawY1)/2).toFixed(1)}" font-size="${fs(2.4)}" text-anchor="middle" fill="${Z.achse}">${yAxisLbl}</text>`;

  const svgSize = stripInSvg ? `width="267mm" height="180mm"` : `width="100%" height="100%"`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg"
    ${svgSize} viewBox="0 0 ${VW} ${VH}"
    preserveAspectRatio="xMidYMid meet"
    font-family="Inter,'Segoe UI',Arial,sans-serif">
  ${minClearDefsSvg}
  ${titleSvg}
  ${frameSvg}
  ${gridSvg}
  ${yAxisSvg}
  ${sokSvg}
  ${mastSvg}
  ${catPath(c1, `${(5.5*symSc).toFixed(2)},${(3.5*symSc).toFixed(2)}`, (0.5*symSc).toFixed(3))} stroke="${Z.t1}" opacity="0.7"/>
  ${catPath(cDisp, '', (1.0*symSc).toFixed(3))} stroke="${t2clr}"/>
  ${showFd ? makePath(fdY, '', (0.32*symSc).toFixed(3)) + ` stroke="${fdClr}"/>` : ''}
  ${c3data ? catPath(c3data, `${(2.5*symSc).toFixed(2)},${(1.5*symSc).toFixed(2)}`, (0.65*symSc).toFixed(3)) + ` stroke="${t3clr}"/>` : ''}
  ${hfSvg}
  ${minClearSvg}
  ${anchLbl}
  ${sagSvg}
  ${probesSvg}
  ${obstSvg}
  ${spanDim}
  ${scalebar}
  ${sokNoteSvg}
</svg>`;

  return svg;
}

// ── Massstäbliche Ansicht Toggle ──────────────────────────────────────────────
let scaleViewActive   = false;
let _lastDrawingScale = null;
let drawingZoom       = 1.0;
let drawingVEx        = 5;   // Überhöhungsfaktor (1 = keine Überhöhung); Startwert 5×
let drawingExtent     = 'sok'; // 'sok' = bis SOK | 'catenary' = nur Kettenwerk/Leiter
var drawingHf         = false; // hf_min / hf_max als Band in der Zeichnung (Werte aus der hf-Ansicht)

function setDrawingHf(an) {
  drawingHf = !!an;
  if (typeof hfElSperre === 'function') hfElSperre();
  refreshScaleViewIfActive();
  if (typeof hHfHinweis === 'function') hHfHinweis();
}
// hf-Werte für die Zeichnung in m über SOK (null = kein Kettenwerk)
function _hfFuerZeichnung() { return hfGrenzenM(); }

function setDrawingExtent(val) {
  drawingExtent = val;
  const bSok = document.getElementById('seg-ext-sok');
  const bCat = document.getElementById('seg-ext-cat');
  if (bSok) bSok.classList.toggle('active', val === 'sok');
  if (bCat) bCat.classList.toggle('active', val === 'catenary');
  refreshScaleViewIfActive();
}
let _panX             = 0;   // viewBox origin X (SVG units, 0–267)
let _panY             = 0;   // viewBox origin Y (SVG units, 0–180)
let _drawingContentBounds = null; // {x,y,w,h} content bounds in SVG units

// Strip / probe data
let _drawingCenterXFrac = 0.5;
let _drawingProbeData   = null;   // [{xFrac, cells:[…]}]
let _drawingStripLabels = [];
let _drawingT2Clr       = '#eb0000';
let _drawingT3Clr       = '#1d4ed8';
let _dragListeners      = null;   // {onMouseDown, onMouseMove, onMouseUp}

// ── ViewBox helpers ───────────────────────────────────────────────────────────
// ── Zeichnungsansicht: Kennwerte und gemeinsame Hilfsfunktionen ─────────────
// Zoomgrenzen, viewBox-Höhe und das Rückfall-Seitenverhältnis standen bisher
// als Zahlenliterale an je vier bis fünf Stellen.
const ZEICH_VB_HOEHE   = 180;        // viewBox-Höhe in SVG-Einheiten
const ZEICH_AR_STD     = 267 / 180;  // Seitenverhältnis, falls nicht messbar
const ZEICH_ZOOM_MIN   = 0.5;
const ZEICH_ZOOM_MAX   = 4.0;
const ZEICH_ZOOM_STUFE = 0.25;

// Seitenverhältnis des Zeichnungsfensters, mit Rückfall wenn nicht messbar.
function _zeichAR() {
  const c = document.getElementById('scale-svg-container');
  return (c && c.offsetWidth > 0 && c.offsetHeight > 0)
    ? c.offsetWidth / c.offsetHeight
    : ZEICH_AR_STD;
}

// Zoom auf den zulässigen Bereich klemmen und auf die Stufe runden.
// abrunden = true beim Einpassen, damit der Inhalt sicher ganz hineinpasst.
function _zoomKlemmen(z, abrunden = false) {
  const g = Math.max(ZEICH_ZOOM_MIN, Math.min(ZEICH_ZOOM_MAX, z));
  const s = 1 / ZEICH_ZOOM_STUFE;
  return Math.max(ZEICH_ZOOM_MIN, (abrunden ? Math.floor(g * s) : Math.round(g * s)) / s);
}

// Zoom und Ausschnitt so setzen, dass der Zeichnungsinhalt das Fenster füllt.
// Stand bisher zweimal nahezu wortgleich im Code — beim Wechsel in die
// Zeichnungsansicht und beim Zurücksetzen des Zooms.
function _zeichnungEinpassen() {
  if (!_drawingContentBounds) return false;
  const { x: cx, y: cy, w: cw, h: ch } = _drawingContentBounds;
  const ar = _zeichAR();
  const fz = Math.min((ZEICH_VB_HOEHE * ar) / cw, ZEICH_VB_HOEHE / ch) * 0.97;
  drawingZoom = _zoomKlemmen(fz, true);
  _panX = cx - (ZEICH_VB_HOEHE * ar / drawingZoom - cw) / 2;
  _panY = cy - (ZEICH_VB_HOEHE / drawingZoom - ch) / 2;
  return true;
}

function applyViewBox() {
  const svgEl = document.querySelector('#scale-svg-container svg');
  const cont  = document.getElementById('scale-svg-container');
  if (!svgEl || !cont) return;
  const ar  = _zeichAR();
  const vbH = ZEICH_VB_HOEHE / drawingZoom;
  const vbW = vbH * ar;
  if (_drawingContentBounds) {
    const { x: bx, y: by, w: bw, h: bh } = _drawingContentBounds;
    // Horizontal: if viewport wider than content → center; else clamp within content
    if (vbW >= bw) {
      _panX = bx - (vbW - bw) / 2;
    } else {
      _panX = Math.max(bx, Math.min(bx + bw - vbW, _panX));
    }
    // Vertical: same
    if (vbH >= bh) {
      _panY = by - (vbH - bh) / 2;
    } else {
      _panY = Math.max(by, Math.min(by + bh - vbH, _panY));
    }
  } else {
    const vbBreiteStd = ZEICH_VB_HOEHE * ZEICH_AR_STD;   // 267
    _panX = Math.max(-(vbW - vbBreiteStd) / 2, Math.min(Math.max(0, vbBreiteStd - vbW), _panX));
    _panY = Math.max(0, Math.min(Math.max(0, ZEICH_VB_HOEHE - vbH), _panY));
  }
  svgEl.setAttribute('viewBox', `${_panX.toFixed(3)} ${_panY.toFixed(3)} ${vbW.toFixed(3)} ${vbH.toFixed(3)}`);
}

function adjustDrawingZoom(newZoom) {
  const prevZoom = drawingZoom;
  drawingZoom = _zoomKlemmen(newZoom);

  // Zurücksetzen (Zoom 1.0) passt wieder auf den Inhalt ein; sonst wird um die
  // Mitte des aktuellen Ausschnitts gezoomt.
  if (!(newZoom === 1.0 && _zeichnungEinpassen())) {
    const ar = _zeichAR();
    const cx = _panX + (ZEICH_VB_HOEHE * ar / prevZoom) / 2;
    const cy = _panY + (ZEICH_VB_HOEHE / prevZoom) / 2;
    _panX = cx - (ZEICH_VB_HOEHE * ar / drawingZoom) / 2;
    _panY = cy - (ZEICH_VB_HOEHE / drawingZoom) / 2;
  }

  refreshScaleViewIfActive(); // rebuild SVG so symbol sizes scale with zoom
  updateStripVisibility();
  updateEdgeIndicators();

  const lbl = document.getElementById('drawing-zoom-label');
  if (lbl) lbl.textContent = Math.round(drawingZoom * 100) + '%';
}

function setDrawingVEx(val) {
  drawingVEx = parseInt(val) || 1;
  refreshScaleViewIfActive();
}

// ── Data strip (static table, dynamic probe columns) ─────────────────────────
function buildInteractiveStrip() {
  updateStripVisibility();  // builds/shows/hides the strip
}

function updateStripVisibility() {
  const strip = document.getElementById('scale-data-strip');
  if (!strip) return;

  // AR-aware vbW — must match applyViewBox()
  const _cont = document.getElementById('scale-svg-container');
  const _cW = _cont ? _cont.offsetWidth : 0, _cH = _cont ? _cont.offsetHeight : 0;
  const _ar  = (_cW > 0 && _cH > 0) ? _cW / _cH : ZEICH_AR_STD;
  const vbW  = 180 * _ar / drawingZoom;
  const vbX0 = _panX;
  const screenFrac = xFrac => (xFrac * 267 - vbX0) / vbW;

  // Visible M-probes
  const hasProbes = _drawingProbeData && _drawingProbeData.length > 0;
  const visibleProbes = hasProbes
    ? _drawingProbeData.map(p => ({ probe: p, frac: screenFrac(p.xFrac) }))
        .filter(({ frac }) => frac >= -0.005 && frac <= 1.005)
    : [];

  if (visibleProbes.length === 0) {
    zeigeElement(strip, false);
    return;
  }
  zeigeElement(strip, true);

  // ── M-probe rows ──
  let html = '';
  _drawingStripLabels.forEach((lbl, r) => {
    const isT2    = lbl.includes('T2');
    const isT3    = lbl.includes('T3');
    const isAbst  = lbl.startsWith('Abst.');
    const color   = isT2 ? _drawingT2Clr : isT3 ? _drawingT3Clr : 'var(--text2)';
    const lblClr  = isT2 ? _drawingT2Clr : isT3 ? _drawingT3Clr : isAbst ? '#2563eb' : 'var(--muted)';
    const isBold  = r === 0 || isAbst;
    html += `<div class="strip-row">`;
    html += `<div class="strip-label" style="color:${lblClr}">${lbl}</div>`;
    visibleProbes.forEach(({ probe, frac }) => {
      // Grautöne der Papier-Zeichnung im (hell/dunkel) Datenstreifen durch Themenfarben ersetzen
      const grau = { '#555': 'var(--text2)', '#666': 'var(--text2)', '#888': 'var(--muted)' };
      const cellClr = (probe.colors && probe.colors[r]) ? (grau[probe.colors[r]] || probe.colors[r]) : color;
      html += `<div class="strip-val${isBold ? ' bold' : ''}" style="left:${(frac*100).toFixed(2)}%;color:${cellClr}">${probe.cells[r] ?? ''}</div>`;
    });
    html += '</div>';
  });

  strip.innerHTML = html;

  // Mindestabstand-Hinweis in der SOK-Fusszeile aktualisieren
  const mcNote = document.getElementById('scale-min-clearance-note');
  if (mcNote) {
    if (minClearance !== null && minClearance > 0) {
      const anyVio = _nachweis.some(n => n.best && !n.ok);
      mcNote.textContent = t('draw.minabstand').replace('{v}', minClearance.toFixed(2));
      mcNote.style.color  = anyVio ? 'var(--fail)' : 'var(--muted)';
      zeigeElement(mcNote, true);
    } else {
      zeigeElement(mcNote, false);
    }
  }
}

// ── Edge indicators: badges at SVG border when a probe is off-screen ─────────
function updateEdgeIndicators() {
  if (!_drawingProbeData) return;
  const _ec = document.getElementById('scale-svg-container');
  const _ew = _ec ? _ec.offsetWidth : 0, _eh = _ec ? _ec.offsetHeight : 0;
  const _ear = (_ew > 0 && _eh > 0) ? _ew / _eh : ZEICH_AR_STD;
  const vbX0 = _panX;
  const vbX1 = _panX + 180 * _ear / drawingZoom;

  const leftProbes  = _drawingProbeData.filter(p => p.xFrac * 267 < vbX0);
  const rightProbes = _drawingProbeData.filter(p => p.xFrac * 267 > vbX1);

  const leftEl  = document.getElementById('edge-indicators-left');
  const rightEl = document.getElementById('edge-indicators-right');

  if (leftEl) {
    leftEl.style.display = leftProbes.length ? 'flex' : 'none';
    leftEl.innerHTML = leftProbes.map(p =>
      `<div class="edge-badge">◀ ${p.cells[0]}</div>`).join('');
  }
  if (rightEl) {
    rightEl.style.display = rightProbes.length ? 'flex' : 'none';
    rightEl.innerHTML = rightProbes.map(p =>
      `<div class="edge-badge">${p.cells[0]} ▶</div>`).join('');
  }
}

function pdfExportDrawing() {
  const svg = buildScaleDrawingPage(true);   // mit SVG-Datenstreifen für Druck
  if (!svg) return;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Massstäbliche Zeichnung</title>
<style>
${_pdfSchriften()}
@page { size: A4 landscape; margin: 15mm; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: #fff; }
svg { display: block; width: 267mm; height: 180mm; }
</style></head><body>${svg}</body></html>`;
  _druckfenster(html);
}

function toggleShareMenu(e) {
  const menu = document.getElementById('share-menu');
  if (!menu) return;
  if (e) e.stopPropagation();
  const open = istSichtbar(menu);
  menu.style.display = open ? 'none' : 'block';
  // Menü liegt fest über allem (auch über dem Vollbild) und öffnet unter dem Knopf, rechtsbündig
  const knopf = e?.currentTarget;
  if (!open && knopf?.getBoundingClientRect) {
    const r = knopf.getBoundingClientRect(), vw = document.documentElement.clientWidth, mw = menu.offsetWidth;
    menu.style.top = Math.round(r.bottom + 5) + 'px';
    menu.style.left = Math.round(Math.max(8, Math.min(r.right - mw, vw - mw - 8))) + 'px';
    menu.style.right = 'auto';
  }
  if (!open) {
    setTimeout(() => document.addEventListener('click', function _close(ev) {
      if (!menu.contains(ev.target)) {
        zeigeElement(menu, false);
        document.removeEventListener('click', _close);
      }
    }), 0);
  }
}
function closeShareMenu() {
  const menu = document.getElementById('share-menu');
  zeigeElement(menu, false);
}

function toggleCanvasFullscreen() {
  const card = document.querySelector('.canvas-card');
  const isFs = card.classList.toggle('canvas-fullscreen');
  zeigeElement(document.getElementById('fullscreen-icon-enter'), !(isFs));
  zeigeElement(document.getElementById('fullscreen-icon-exit'), isFs);
  document.body.style.overflow = isFs ? 'hidden' : '';
  _syncHighlightFsVisibility();
  setTimeout(() => { quickDraw(); _triggerDrawingRebuild(); }, 50);
}

// Foto-Tab: globaler Flag
window._fotoTabActive = false;
let _fotoSyncListeners = null;

function _fotoGreyOut(active) {
  const grey = (el, on) => {
    if (!el) return;
    if (on) { el.dataset.fotoOff = '1'; el.style.opacity = '0.42'; el.style.pointerEvents = 'none'; }
    else if (el.dataset.fotoOff) { el.style.opacity = ''; el.style.pointerEvents = ''; delete el.dataset.fotoOff; }
  };
  // Mastlänge-Felder nur im Foto-Tab einblenden
  const mastRow = document.getElementById('mastlaenge-row');
  zeigeElement(mastRow, active);
  ['h1','h2'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (active) { el.readOnly = true; el.style.color = 'var(--muted)'; el.style.cursor = 'default'; }
    else        { el.readOnly = false; el.style.color = ''; el.style.cursor = ''; }
  });
  _zugkraftSperre(active);
  grey(document.getElementById('three-pt-btn'), active);
  grey(document.getElementById('three-pt-panel'), active);
  const xcField = document.getElementById('xC')?.closest('.field');
  const ycField = document.getElementById('yC')?.closest('.field');
  grey(xcField, active); grey(ycField, active);
  const t3card = document.querySelector('#temp3')?.closest('.card');
  grey(t3card, active);
  const shLabel = document.getElementById('sh-label');
  if (shLabel) shLabel.textContent = active ? t('msg.mindestabstand') : t('par.sh');
  const bpHint = document.getElementById('bp-drag-hint');
  if (bpHint) bpHint.textContent = active ? 'h₁/h₂ werden aus Foto-Auswertung befüllt' : 'Ankerpunkte im Diagramm verschiebbar';
  const probeHint = document.getElementById('probe-hint');
  if (probeHint) probeHint.textContent = active
    ? t('msg.hint.xwert')
    : t('canvas.probe.hint');
}

function _fotoSidebarSync() {
  const get = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('foto-L',     get('span'));
  set('foto-T1',    get('temp2'));  // Messtemperatur = aktuelle Feldtemperatur T₂
  set('foto-elev-L', get('sok-mum-left'));
  set('foto-elev-R', get('sok-mum-right'));
  const matSel = document.getElementById('foto-mat');
  // Material-Quelle je nach Systemmodus: NFL/RFL → Ts-Leiter, EL → el-material-select
  const _matSrcId = (typeof sysMode !== 'undefined' && sysMode !== 'el')
                    ? 'material-ts' : 'el-material-select';
  const sbMat  = get(_matSrcId);
  if (matSel && sbMat) {
    if (!Array.from(matSel.options).some(o => o.value === sbMat)) {
      if (typeof window._fotoPopulateMat === 'function') window._fotoPopulateMat();
    }
    matSel.value = sbMat;
  }
  if (typeof fotoRecalcIfReady === 'function') fotoRecalcIfReady();
}

// Ergebnis-Kurzfassung im Vollbild ausblenden — dort gehört der Platz der
// Darstellung. Ausserhalb des Vollbilds richtet sich die Sichtbarkeit nach der
// Ansicht: nur im Diagramm sichtbar (Zeichnung und Foto blenden result-card aus).
function _syncHighlightFsVisibility() {
  const hl = document.getElementById('highlight-card');
  if (!hl) return;
  const card = document.querySelector('.canvas-card');
  const isFs = !!(card && card.classList.contains('canvas-fullscreen'));
  zeigeElement(hl, !(isFs));
}

function setCanvasView(view) {
  _abschnittAusblenden();
  setTimeout(() => { if (typeof feldWahlAktualisieren === 'function') feldWahlAktualisieren(); }, 0);
  _ansichtDiagramm = view !== 'zeichnung' && view !== 'foto';
  _obsSichtbarkeit();
  const isScale   = view === 'zeichnung';
  const isFoto    = view === 'foto';
  const scaleDiv  = document.getElementById('scale-view');
  const fotoDiv   = document.getElementById('foto-view');
  const svgCont   = document.getElementById('scale-svg-container');
  const canvas    = document.getElementById('main-canvas');
  const legend    = document.getElementById('legend');
  const probeRo   = document.querySelector('.probe-readout');
  const dragHint  = document.getElementById('canvas-drag-hint');
  const segDiag   = document.getElementById('view-seg-diagramm');
  const segZeich  = document.getElementById('view-seg-zeichnung');
  const segFoto   = document.getElementById('view-seg-foto');
  const resultCard = document.getElementById('result-card');

  // Foto-Tab verlassen (falls vorher aktiv)
  if (window._fotoTabActive && !isFoto) {
    window._fotoTabActive = false;
    zeigeElement(fotoDiv, false);
    const _fhs = document.getElementById('foto-status');
    zeigeElement(_fhs, false);
    _fotoGreyOut(false);
    if (_fotoSyncListeners) {
      _fotoSyncListeners.forEach(({ el, fn }) => {
        el.removeEventListener('change', fn);
        el.removeEventListener('input',  fn);
      });
      _fotoSyncListeners = null;
    }
    if (segFoto) segFoto.classList.remove('active');
  }

  // Foto-Tab aktivieren
  if (isFoto) {
    window._fotoTabActive = true;
    if (!window._fotoHinweisGezeigt) {
      window._fotoHinweisGezeigt = true;
      zeigeHinweis(t('ui.foto.genau.text'), { titel: t('ui.foto.genau.titel'), ok: t('ui.foto.genau.ok') });
    }
    scaleViewActive = false;
    if (svgCont) { svgCont.innerHTML = ''; svgCont.removeEventListener('wheel', _onDrawingWheel); if (_dragListeners) { svgCont.removeEventListener('mousedown', _dragListeners.onMouseDown); document.removeEventListener('mousemove', _dragListeners.onMouseMove); document.removeEventListener('mouseup', _dragListeners.onMouseUp); _dragListeners = null; } }
    zeigeElement(scaleDiv, false);
    zeigeElement(canvas, false);
    if (fotoDiv) fotoDiv.style.display = 'flex';
    zeigeElement(legend, false);
    zeigeElement(probeRo, false);  // Messpunkte im Foto-Modus ausblenden
    if (dragHint) dragHint.style.visibility = 'hidden';
    zeigeElement(resultCard, false);
    const sokNote = document.getElementById('scale-sok-note');
    zeigeElement(sokNote, false);
    // Status wird jetzt als Overlay auf dem Canvas angezeigt (nicht im Banner)
    _fotoGreyOut(true);
    if (typeof window._fotoPopulateMat === 'function') window._fotoPopulateMat();
    _fotoSidebarSync();
    const syncIds = ['span','el-material-select','material-ts','temp2','sok-mum-left','sok-mum-right'];
    _fotoSyncListeners = syncIds.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const fn = () => _fotoSidebarSync();
      el.addEventListener('change', fn);
      el.addEventListener('input',  fn);
      return { el, fn };
    }).filter(Boolean);
    if (segDiag)  segDiag.classList.remove('active');
    if (segZeich) segZeich.classList.remove('active');
    if (segFoto)  segFoto.classList.add('active');
    const scrollArea = document.getElementById('canvas-scroll-area');
    if (scrollArea) scrollArea.style.flex = '1';
    // Probe-Inputs auch für Foto-Höhen-Anzeige registrieren
    ['probe-x1','probe-x2','probe-x3','probe-x4','sh'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const fn = () => { if (typeof window._fotoUpdateProbeOut === 'function') window._fotoUpdateProbeOut(); };
      el.addEventListener('input',  fn);
      el.addEventListener('change', fn);
      _fotoSyncListeners.push({ el, fn });
    });
    return;
  }

  if (isScale) {
    zeigeElement(resultCard, false);
    const svg = buildScaleDrawingPage();
    if (!svg) return;
    if (svgCont) svgCont.innerHTML = svg;
    scaleViewActive = true;
    scaleDiv.style.display = 'flex';
    zeigeElement(canvas, false);
    zeigeElement(legend, false);
    zeigeElement(probeRo, false);
    if (dragHint) dragHint.style.visibility = 'hidden';
    const sokNote = document.getElementById('scale-sok-note');
    if (sokNote) sokNote.style.display = 'flex';

    // Ausschnitt auf den Zeichnungsinhalt einpassen
    drawingZoom = 1.0; _panX = 0; _panY = 0;
    if (_zeichnungEinpassen()) {
      // SVG mit der zum neuen Zoom passenden Symbolgrösse neu aufbauen
      const svgFit = buildScaleDrawingPage();
      if (svgFit && svgCont) svgCont.innerHTML = svgFit;
    }
    // Sync UI
    { const lbl = document.getElementById('drawing-zoom-label');
      if (lbl) lbl.textContent = Math.round(drawingZoom * 100) + '%'; }
    applyViewBox();
    buildInteractiveStrip();
    updateEdgeIndicators();

    // Drag-to-pan
    let _isDragging = false, _dragStart = null;
    const onMouseDown = e => {
      if (e.button !== 0) return;
      _isDragging = true;
      _dragStart = { sx: e.clientX, sy: e.clientY, px: _panX, py: _panY };
      svgCont.classList.add('dragging');
      e.preventDefault();
    };
    const onMouseMove = e => {
      if (!_isDragging || !_dragStart) return;
      const rect = svgCont.getBoundingClientRect();
      const _ar  = rect.height > 0 ? rect.width / rect.height : ZEICH_AR_STD;
      const dx = (e.clientX - _dragStart.sx) * (180 * _ar / drawingZoom) / rect.width;
      const dy = (e.clientY - _dragStart.sy) * (180 / drawingZoom) / rect.height;
      _panX = _dragStart.px - dx;
      _panY = _dragStart.py - dy;
      applyViewBox();
      updateStripVisibility();
      updateEdgeIndicators();
    };
    const onMouseUp = () => {
      _isDragging = false;
      svgCont?.classList.remove('dragging');
    };
    svgCont.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    _dragListeners = { onMouseDown, onMouseMove, onMouseUp };

    // Ctrl+Scrollrad-Zoom
    svgCont.addEventListener('wheel', _onDrawingWheel, { passive: false });
  } else {
    scaleViewActive = false;
    if (svgCont) {
      svgCont.innerHTML = '';
      svgCont.removeEventListener('wheel', _onDrawingWheel);
      if (_dragListeners) {
        svgCont.removeEventListener('mousedown', _dragListeners.onMouseDown);
        document.removeEventListener('mousemove', _dragListeners.onMouseMove);
        document.removeEventListener('mouseup',   _dragListeners.onMouseUp);
        _dragListeners = null;
      }
    }
    zeigeElement(scaleDiv, false);
    canvas.style.display = 'block';
    zeigeElement(legend, true);
    zeigeElement(probeRo, true);
    if (dragHint)  dragHint.style.visibility = '';
    zeigeElement(resultCard, true);
    const sokNote2 = document.getElementById('scale-sok-note');
    zeigeElement(sokNote2, false);
  }
  if (segDiag)  segDiag.classList.toggle('active', !isScale);
  if (segZeich) segZeich.classList.toggle('active',  isScale);
  if (segFoto)  segFoto.classList.remove('active');
  // In fullscreen: Zeichnung → scroll area yields all space to drawing; Diagramm → scroll area fills remainder
  const scrollArea = document.getElementById('canvas-scroll-area');
  if (scrollArea) scrollArea.style.flex = isScale ? '0 0 auto' : '1';
  _syncHighlightFsVisibility();
}

function _onDrawingWheel(e) {
  if (!e.ctrlKey && !e.metaKey) return;
  e.preventDefault();
  const cont = document.getElementById('scale-svg-container');
  if (!cont) return;
  const rect = cont.getBoundingClientRect();
  const _ar  = rect.height > 0 ? rect.width / rect.height : ZEICH_AR_STD;
  const mxF = (e.clientX - rect.left)  / rect.width;
  const myF = (e.clientY - rect.top)   / rect.height;
  const svgMx = _panX + mxF * (180 * _ar / drawingZoom);
  const svgMy = _panY + myF * (180 / drawingZoom);

  drawingZoom = _zoomKlemmen(drawingZoom + (e.deltaY < 0 ? ZEICH_ZOOM_STUFE : -ZEICH_ZOOM_STUFE));

  _panX = svgMx - mxF * (180 * _ar / drawingZoom);
  _panY = svgMy - myF * (180 / drawingZoom);

  applyViewBox();
  updateStripVisibility();
  updateEdgeIndicators();

  const lbl = document.getElementById('drawing-zoom-label');
  if (lbl) lbl.textContent = Math.round(drawingZoom * 100) + '%';
}


// Wenn neu berechnet wird, Scale-View aktualisieren falls aktiv
function refreshScaleViewIfActive() {
  if (!scaleViewActive) return;
  const svgCont = document.getElementById('scale-svg-container');
  const svg = buildScaleDrawingPage();
  if (svg && svgCont) {
    svgCont.innerHTML = svg;
    applyViewBox();   // reapply current pan/zoom to new SVG
  }
  buildInteractiveStrip();
  updateEdgeIndicators();
}

// Neuaufbau der Zeichnung nach Datenänderung. Liegt hier, weil er ausschliesslich
// modulinterne Bausteine verwendet (Zustand, applyViewBox, Streifen, Randanzeige).
function _triggerDrawingRebuild() {
  if (scaleViewActive) {
    const svgCont = document.getElementById('scale-svg-container');
    const newSvg = buildScaleDrawingPage();
    if (newSvg && svgCont) {
      svgCont.innerHTML = newSvg;
      applyViewBox();
      buildInteractiveStrip();
      updateEdgeIndicators();
    }
  }
}

// ── Öffentliche Schnittstelle ──
return {
    adjustDrawingZoom,
    setDrawingVEx,
    setDrawingExtent,
    setDrawingHf,
    _hfFuerZeichnung,
    pdfExportDrawing,
    toggleCanvasFullscreen,
    toggleShareMenu,
    closeShareMenu,
    setCanvasView,
    _triggerDrawingRebuild,
    refreshScaleViewIfActive,
    _fotoSidebarSync,
    // Zeichnungs-Einstellungen für Speichern/Laden
    get zeichnungVEx()    { return drawingVEx; },
    get zeichnungExtent() { return drawingExtent; },
    get zeichnungHf()     { return drawingHf; },
    // Setzt beide Einstellungen samt Bedienelementen, ohne Neuaufbau
    // (der Aufrufer baut nach dem Laden ohnehin komplett neu auf).
    zeichnungsEinstellungenSetzen(vEx, extent) {
      drawingVEx = parseInt(vEx) || 5;
      const vexSel = document.getElementById('vex-select');
      if (vexSel) vexSel.value = drawingVEx;
      drawingExtent = extent;
      const bSok = document.getElementById('seg-ext-sok');
      const bCat = document.getElementById('seg-ext-cat');
      if (bSok) bSok.classList.toggle('active', extent === 'sok');
      if (bCat) bCat.classList.toggle('active', extent === 'catenary');
    }
};
})();

// HTML-Handler werden im globalen Geltungsbereich ausgewertet.
window.adjustDrawingZoom = Ansicht.adjustDrawingZoom;
window.setDrawingVEx = Ansicht.setDrawingVEx;
window.setDrawingExtent = Ansicht.setDrawingExtent;
window.setDrawingHf = Ansicht.setDrawingHf;
window.pdfExportDrawing = Ansicht.pdfExportDrawing;
window.toggleCanvasFullscreen = Ansicht.toggleCanvasFullscreen;
window.toggleShareMenu = Ansicht.toggleShareMenu;
window.closeShareMenu = Ansicht.closeShareMenu;
window.setCanvasView = Ansicht.setCanvasView;
window._triggerDrawingRebuild = Ansicht._triggerDrawingRebuild;
// Von anderem Programmteil benutzt:
const refreshScaleViewIfActive = Ansicht.refreshScaleViewIfActive;
const _fotoSidebarSync = Ansicht._fotoSidebarSync;


// ═══════════════════════════════════════════════════════════════
// KOORDINATEN LV95
// E/N = Aufhängepunkt des Leiters (Ausleger/Joch).
// Eingeschaltet gilt: L = waagrechter Abstand der Aufhängepunkte.
// Höhe: SOK m ü. M. (Mastangaben); Aufhängehöhe = SOK + h₁ bzw. h₂.
// ═══════════════════════════════════════════════════════════════
var koordAktiv = false;   // var: vor der ersten Rechnung sicher lesbar

function koordSchalten(an, { rechnen = true } = {}) {
  koordAktiv = !!an;
  const cb = document.getElementById('koord-aktiv');
  if (cb) cb.checked = koordAktiv;
  zeigeElement(document.getElementById('koord-felder'), koordAktiv);
  if (!koordAktiv) _koordSperren([]);
  if (rechnen) berechnen();
}

function _koordWerte() {
  const v = id => { const n = parseFloat(document.getElementById(id)?.value); return Number.isFinite(n) ? n : null; };
  return {
    eL: v('koord-e-left'),  nL: v('koord-n-left'),
    eR: v('koord-e-right'), nR: v('koord-n-right'),
  };
}

// Feldachse in LV95 oder null (Schalter aus / Werte unvollständig)
function koordAchse() {
  if (!koordAktiv) return null;
  const k = _koordWerte();
  return lv95Achse(k.eL, k.nL, k.eR, k.nR);
}

function _aktivesSpannweitenFeld() {
  if (spanMode === 'single') return document.getElementById('span');
  const idx = parseInt(document.getElementById('display-span')?.value) || 0;
  return document.getElementById(`span-${idx}`);
}

// Felder, die aus den Koordinaten stammen, sperren; alle anderen freigeben
function _koordSperren(felder) {
  document.querySelectorAll('input.aus-koord').forEach(el => {
    if (felder.includes(el)) return;
    el.readOnly = false; el.classList.remove('aus-koord'); el.removeAttribute('title');
  });
  felder.forEach(el => {
    el.readOnly = true; el.classList.add('aus-koord'); el.title = t('koord.gesperrt.titel');
  });
}

function _koordAnwenden() {
  const info = document.getElementById('koord-info');
  if (!koordAktiv) { _koordSperren([]); return; }
  const k = _koordWerte();
  const achse = lv95Achse(k.eL, k.nL, k.eR, k.nR);
  const gesperrt = [];
  const teile = [];

  if (achse) {
    const spanEl = _aktivesSpannweitenFeld();
    if (spanEl) {
      const neuL = achse.L.toFixed(3);
      if (spanEl.value !== neuL) {
        spanEl.value = neuL;
        if (spanMode !== 'single' && typeof updateLm === 'function') updateLm();
      }
      gesperrt.push(spanEl);
    }
    teile.push(t('koord.info.L').replace('{L}', fN(achse.L, 3)));
    if (!lv95Plausibel(k.eL, k.nL) || !lv95Plausibel(k.eR, k.nR))
      teile.push(`<span class="warn">⚠ ${t('koord.unplausibel')}</span>`);
  } else {
    teile.push(`<span class="warn">${t('koord.fehlt')}</span>`);
  }


  _koordSperren(gesperrt);
  if (info) info.innerHTML = teile.join('<br>');
}

// ═══════════════════════════════════════════════════════════════
// ABSPANNABSCHNITT (Reiter «Abschnitt»)
// Masttabelle → Feldlängen (Koordinaten, KM oder Eingabe) → alle Felder mit
// derselben Rechnung wie das Einzelfeld (rechneFall). Ausgleichend: Zugkraft
// aus der Mittelspannweite Lm aller Felder; starr: jedes Feld mit eigener
// Länge; R-FL: konstante Zugkraft. «Öffnen» überträgt ein Feld in die
// Eingaben (Mittelspannweite mit allen Feldern), sodass Diagramm, Zeichnung,
// PDF und Export genau dieses Feld zeigen.
// ═══════════════════════════════════════════════════════════════
let abschnitt = { masten: [], offen: null, mp: {} };
let _abschnittSichtbar = false;
let _absHinweisOffen = null;   // Erklärung zur Masttabelle: vom Nutzer auf-/zugeklappt (null = Vorgabe)

function abschnittFelderAnzahl() { return Math.max(0, abschnitt.masten.length - 1); }
function abschnittOffenesFeld() {
  return abschnitt.masten.length >= 2 && Number.isInteger(abschnitt.offen)
    && abschnitt.offen < abschnittFelderAnzahl() ? abschnitt.offen : null;
}
const _abschnittStarr = () => sysMode !== 'rfl' && elBerechnungsart === 'starr';

// Alle Felder rechnen (ohne die Anzeige zu verändern)
function abschnittRechnen() {
  const m = abschnitt.masten;
  if (m.length < 2) return null;
  // Feldlängen auf mm wie in den Eingabefeldern — Übersicht und geöffnetes Feld rechnen gleich
  const fl = feldLaengen(m).map(f => ({ ...f, L: f.L > 0 ? +f.L.toFixed(3) : f.L }));
  const Ls = fl.map(f => f.L);
  const starr = _abschnittStarr();
  const Lm = mittelspannweite(Ls, lmFormula);
  const sh = parseFloat(document.getElementById('sh').value);
  const felder = fl.map((f, i) => {
    const a = m[i], b = m[i + 1];
    const res = { i, a, b, L: f.L, quelle: f.quelle, fehler: null };
    if (!(f.L > 0) || !Number.isFinite(a.h) || !Number.isFinite(b.h)) { res.fehler = 'unvollstaendig'; return res; }
    const sA = mastSok(a), sB = mastSok(b);
    res.hatSok = sA !== null || sB !== null;
    const sL = sA ?? sB, sR = sB ?? sA;
    res.sokFn = res.hatSok ? (x => sL + (sR - sL) * x / f.L) : null;
    res.ov = { L: f.L, Lm: (starr || !(Lm > 0)) ? f.L : Lm, h1: a.h, h2: b.h };
    try {
      const r = rechneFall(res.ov);
      res.z = r.z; res.oben = r.oben;
    } catch (e) { res.fehler = e.message; return res; }
    const z = res.z;
    // Fahrdraht wie im Einzelfeld (N-FL: Tragseil-Verschiebung gegenüber T1; R-FL: VEM 7.53a)
    res.fdY = sysMode === 'el' ? null : (x => (a.h - sh) + (b.h - a.h) * x / f.L
      + (sysMode === 'nfl' ? kettenY(res.oben, x) - kettenY(z.c1, x) : rflFahrdrahtVerschiebung(z.c2, z.c_fd_ref, x)));
    const abs = (x, y) => y + (res.sokFn ? res.sokFn(x) : 0);
    // Tiefste Punkte: absolut (m ü. M., wenn das Feld SOK hat) und über SOK
    let tief = Infinity, fdTief = Infinity, tiefRel = Infinity, fdTiefRel = Infinity;
    for (let k = 0; k <= 100; k++) {
      const x = f.L * k / 100, yl = kettenY(res.oben, x);
      tief = Math.min(tief, abs(x, yl)); tiefRel = Math.min(tiefRel, yl);
      if (res.fdY) { const yf = res.fdY(x); fdTief = Math.min(fdTief, abs(x, yf)); fdTiefRel = Math.min(fdTiefRel, yf); }
    }
    res.tief = tief; res.tiefRel = tiefRel;
    res.fdTief = res.fdY ? fdTief : null; res.fdTiefRel = res.fdY ? fdTiefRel : null;
    res.nachweis = abstandsNachweis(_hPunkteHindernis(_mpFeld(i)), res.ov, res.sokFn);
    return res;
  });
  return { felder, Lm, starr };
}

// Messpunkte (x aus den Feldern bereits gesetzt), H-Punkte und Schlösser laden.
// Übernimmt frühere Formen: H1–H4 als Felder (bis v3.9.2) und die
// Hindernisliste (v3.9.3–v3.11) — höchstens 4 Punkte je Feld.
function _messpunkteLaden(s) {
  if (s.messpunkte && typeof s.messpunkte === 'object') {
    _mpSetzen({ ...s.messpunkte, x: _probeXs() });
    return;
  }
  const f = s.fields || {};
  const xs = _probeXs();
  _mpSetzen({ x: xs, h: [1, 2, 3, 4].map(i => { const v = parseFloat(f[`probe-h${i}`]); return xs[i - 1] !== null && Number.isFinite(v) ? v : null; }) });
  const alt = (Array.isArray(s.hindernisse) ? s.hindernisse : []).map(hindernisNormieren).filter(Boolean);
  if (!alt.length) return;
  const offen = abschnittOffenesFeld();
  const jeFeld = new Map();
  alt.forEach(h => {
    const k = offen === null ? 'live' : ((h.feld ?? 0) === offen ? 'live' : (h.feld ?? 0));
    const e = jeFeld.get(k) || { punkte: [], verbinden: false };
    e.punkte.push(...hindernisPunkte(h.punkte)); e.verbinden = e.verbinden || !!h.verbinden;
    jeFeld.set(k, e);
  });
  let gekuerzt = false;
  jeFeld.forEach((e, k) => {
    let pk = e.punkte;
    if (pk.length > 4) { gekuerzt = true; pk = [...pk].sort((a, b) => a.h - b.h).slice(0, 4); }
    pk = [...pk].sort((a, b) => a.x - b.x);
    const mp = { x: [0, 1, 2, 3].map(i => pk[i]?.x ?? null), h: [0, 1, 2, 3].map(i => pk[i]?.h ?? null), verbinden: e.verbinden };
    if (k === 'live') _mpSetzen(mp); else abschnitt.mp[k] = _mpNormieren(mp);
  });
  setTimeout(() => meldung(t(gekuerzt ? 'hind.uebernommen.gekuerzt' : 'hind.uebernommen'), gekuerzt ? 'warnung' : 'info'), 0);
}

// Abschnitt und Lastfälle aus einem Projektzustand übernehmen (tolerant)
function _abschnittLaden(s) {
  const zahl = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
  const text = v => (typeof v === 'string' || typeof v === 'number') ? String(v) : '';
  const mastenLesen = arr => Array.isArray(arr) ? arr.filter(x => x && typeof x === 'object')
    .map(x => ({ name: text(x.name), e: zahl(x.e), n: zahl(x.n), z: zahl(x.z), delta: zahl(x.delta), h: zahl(x.h), km: kmFormat(text(x.km)), L: zahl(x.L) })) : [];
  const mpLesen = obj => {
    const mp = {};
    if (obj && typeof obj === 'object')
      Object.entries(obj).forEach(([k, v]) => { if (/^\d+$/.test(k) && v && typeof v === 'object') mp[k] = _mpNormieren(v); });
    return mp;
  };
  // Stränge (ab v4.4); ältere Projekte: ein Strang aus abschnitt.masten
  let straenge = null, aktiv = 0;
  if (Array.isArray(s.abschnitt?.straenge) && s.abschnitt.straenge.length) {
    straenge = s.abschnitt.straenge.filter(x => x && typeof x === 'object').slice(0, STRANG_MAX).map((x, i) => {
      let zustand = null;
      if (x.zustand && typeof x.zustand === 'object') {
        zustand = { fields: {}, leiter: text(x.zustand.leiter) };
        _STRANG_FELDER.forEach(k => { if (x.zustand.fields?.[k] != null) zustand.fields[k] = text(x.zustand.fields[k]); });
        _STRANG_OBEN.forEach(k => { if (k in x.zustand) zustand[k] = x.zustand[k]; });
      }
      return { kennung: text(x.kennung).slice(0, 24), rolle: STRANG_ROLLEN.includes(x.rolle) ? x.rolle : rolleVorschlag(text(x.kennung)),
        farbe: /^#[0-9a-f]{6}$/i.test(x.farbe) ? x.farbe : STRANG_FARBEN[i % STRANG_FARBEN.length], sichtbar: x.sichtbar !== false,
        masten: mastenLesen(x.masten), offen: Number.isInteger(x.offen) ? x.offen : null, mp: mpLesen(x.mp), zustand };
    });
    if (!straenge.length) straenge = null;
    else aktiv = Number.isInteger(s.abschnitt.aktiv) && straenge[s.abschnitt.aktiv] ? s.abschnitt.aktiv : 0;
  }
  // Bis v4.4 war Z der Mastfuss: SOK = Z − Δ (einmalig beim Laden)
  if (s.abschnitt && s.abschnitt.zBezug !== 'sok') {
    if (straenge) straenge.forEach(x => { x.masten = mastenAusMastfuss(x.masten); });
    else s = { ...s, abschnitt: { ...s.abschnitt, masten: mastenAusMastfuss(mastenLesen(s.abschnitt.masten)) } };
  }
  const masten = straenge ? straenge[aktiv].masten : mastenLesen(s.abschnitt?.masten);
  const mp = mpLesen(s.abschnitt?.mp);
  const teil = s.abschnitt?.teil && typeof s.abschnitt.teil === 'object'
    ? { von: text(s.abschnitt.teil.von) || null, bis: text(s.abschnitt.teil.bis) || null } : { von: null, bis: null };
  abschnitt = { masten, offen: Number.isInteger(s.abschnitt?.offen) ? s.abschnitt.offen : null, mp, aktiv, teil };
  if (straenge) abschnitt.straenge = straenge;
  _straengeSichern();
  if (s.lastfaelle && typeof s.lastfaelle === 'object') lastfallEinst = s.lastfaelle;
  renderObstacleList();
  if (_abschnittSichtbar) renderAbschnitt();
}

// ── Mehrere Stränge an denselben Masten ──────────────────────────────────
// abschnitt.masten / .offen / .mp gehören immer zum aktiven Strang (die übrige
// Abschnitt-Logik bleibt unverändert). abschnitt.straenge hält alle Stränge mit
// Kennung, Rolle, Farbe, Sichtbarkeit, eigenen Masten (E/N/h je Strang; Z, Δ, KM
// sind Masteigenschaften) und den Leiter-Einstellungen (zustand). T₂/T₃ gelten
// für alle Stränge gemeinsam. abschnitt.teil grenzt nur Anzeige und Export ein.
const STRANG_FARBEN = ['#4a5cb8', '#d9822b', '#2f9e6e', '#b8457a', '#8a6d10', '#3aa6c2'];
// Dunkelmodus: dieselben Farben als weiche Neon-Töne (leuchtend, nicht grell)
const STRANG_FARBEN_DUNKEL = ['#8c9bff', '#ffab5c', '#4fe3a5', '#ff7ac6', '#f2d25c', '#55d8f2'];
const _themaDunkel = () => document.documentElement.dataset.thema === 'dunkel';
// Anzeigefarbe eines Strangs: Standardfarben im Dunkelmodus als Neon-Variante,
// eigene Farben unverändert (gespeichert wird immer die helle Standardfarbe)
function _strangFarbeAnzeige(f) {
  const i = STRANG_FARBEN.indexOf(String(f).toLowerCase());
  return _themaDunkel() && i >= 0 ? STRANG_FARBEN_DUNKEL[i] : f;
}
const STRANG_ROLLEN = ['fahrleitung', 'speiseleiter', 'rueckleiter', 'erdseil', 'andere'];
const STRANG_MAX = 8;
const _STRANG_FELDER = ['preset-select', 'el-material-select', 'tension', 'tension-fd', 'sh',
  'material-ts', 'material-fd', 'weight-ts', 'weight-fd', 'alpha-ts', 'alpha-fd', 'temp1'];
const _STRANG_OBEN = ['sysMode', 'elBerechnungsart', 'wearPct', 'elBasiskraftIdx', 'lmFormula', 'lmOvr',
  'elReglageHmaxOvr', 'elReglageLrefOvr', 'elMatEdits'];
const _strangErg = new Map();          // Rechenergebnis je Strang (nicht gespeichert)
let _strangVersion = 0, _straengeRechnenLaeuft = false, _strangTimer = null;

function _neuerStrang(kennung, masten, i, rolle) {
  return { kennung, rolle: rolle || rolleVorschlag(kennung), farbe: STRANG_FARBEN[i % STRANG_FARBEN.length],
    sichtbar: true, masten, offen: null, mp: {}, zustand: null };
}
// Stellt sicher, dass abschnitt.straenge existiert und der aktive Strang auf abschnitt.masten zeigt
function _straengeSichern() {
  const A = abschnitt;
  if (!Array.isArray(A.straenge) || !A.straenge.length) {
    A.straenge = [_neuerStrang('', A.masten, 0, sysMode === 'el' ? 'speiseleiter' : 'fahrleitung')];
    A.aktiv = 0;
  }
  if (!Number.isInteger(A.aktiv) || !A.straenge[A.aktiv]) A.aktiv = 0;
  A.straenge[A.aktiv].masten = A.masten;
  A.straenge[A.aktiv].mp = A.mp;
  if (!A.teil || typeof A.teil !== 'object') A.teil = { von: null, bis: null };
  return A.straenge;
}
const _mehrereStraenge = () => Array.isArray(abschnitt.straenge) && abschnitt.straenge.length > 1;
const _strangName = (s, k) => s.kennung || `${t('abs.strang')} ${k + 1}`;
const _strangSchl = k => `${k}|${abschnitt.straenge[k]?.kennung ?? ''}`;

// Leiter-Einstellungen des aktiven Strangs (für den Wechsel und die Übersicht)
function _strangZustandLesen() {
  const st = getProjectState();
  const fields = {};
  _STRANG_FELDER.forEach(k => { if (st.fields[k] != null) fields[k] = st.fields[k]; });
  const z = { fields };
  _STRANG_OBEN.forEach(k => { z[k] = st[k] ?? null; });
  const sel = document.getElementById(sysMode === 'el' ? 'el-material-select' : 'preset-select');
  z.leiter = sel?.selectedOptions?.[0]?.textContent?.trim() || '';
  return z;
}
// System für einen neuen Strang: Fahrleitung wie eingestellt, sonst Einzelleiter
function _strangSystemVorgabe(s) {
  if (s.rolle === 'fahrleitung') return sysMode === 'el' ? 'nfl' : sysMode;
  return 'el';
}

// Strang k aktiv machen. feld: 'paar' = Feld mit demselben Mastpaar öffnen
// (Bedienung); false = kein Feld öffnen, abschnitt.offen = offen (Hintergrund).
function _strangAktivieren(k, { feld = 'paar', offen = null } = {}) {
  const A = abschnitt;
  _straengeSichern();
  if (k === A.aktiv || !A.straenge[k]) return false;
  const alt = A.straenge[A.aktiv];
  const offenAlt = abschnittOffenesFeld();
  const paar = offenAlt !== null ? [A.masten[offenAlt].name, A.masten[offenAlt + 1].name] : null;
  if (offenAlt !== null) A.mp[offenAlt] = _mpLive();
  alt.offen = A.offen; alt.mp = A.mp; alt.zustand = _strangZustandLesen();
  const neu = A.straenge[k];
  const voll = JSON.parse(JSON.stringify(getProjectState()));
  voll.fotoState = null;
  if (neu.zustand) {
    _STRANG_OBEN.forEach(key => { if (key in neu.zustand) voll[key] = neu.zustand[key]; });
    Object.assign(voll.fields, neu.zustand.fields || {});
  }
  voll.abschnitt.aktiv = k;
  voll.abschnitt.masten = neu.masten;
  voll.abschnitt.mp = neu.mp || {};
  voll.abschnitt.offen = feld === 'paar' ? null : offen;
  if (!setProjectState(voll)) return false;
  if (!neu.zustand) { const v = _strangSystemVorgabe(neu); if (v !== sysMode) setSysMode(v); }
  if (feld === 'paar') {
    const m = abschnitt.masten;
    let j = paar ? m.findIndex((x, i) => x.name === paar[0] && m[i + 1]?.name === paar[1]) : -1;
    if (j < 0 && m.length >= 2) j = 0;   // sonst erstes Feld: Eingaben links gehören zum gewählten Strang
    if (j >= 0) abschnittFeldOeffnen(j, { ansicht: false });
  }
  return true;
}
// Nach Import/Beispiel: System des ersten (aktiven) Strangs passend zur Rolle
function _strangStartSystem() {
  const s0 = abschnitt.straenge?.[abschnitt.aktiv];
  if (!s0) return;
  const v = _strangSystemVorgabe(s0);
  if (v !== sysMode) setSysMode(v);
}
// Bedienung: Strang wählen (Übersicht, Feld-Auswahl)
function strangWaehlen(k) {
  if (!_strangAktivieren(k)) return;
  if (_abschnittSichtbar) renderAbschnitt();
  else if (typeof refreshScaleViewIfActive === 'function') refreshScaleViewIfActive();
  feldWahlAktualisieren();
}

// Rechenstand eines Strangs: gleiche Einstellungen, Masten, Messpunkte und gemeinsame Eingaben
// JSON mit sortierten Schlüsseln: gleicher Inhalt → gleicher Text (Reihenfolge nach Laden egal)
function _stabil(v) {
  if (Array.isArray(v)) return '[' + v.map(_stabil).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + _stabil(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}
function _strangSchluessel(s) {
  return _stabil([_strangVersion, s.zustand, s.mp, s.masten, document.getElementById('temp2')?.value,
    lastfaelleAktiv, lastfallEinst, minClearance]);
}
function _strangGueltig(k) {
  const s = abschnitt.straenge[k], c = _strangErg.get(_strangSchl(k));
  return !!c && c.schluessel === _strangSchluessel(s);
}
// Ergebnisse aller Stränge: aktiver frisch, die übrigen aus dem Zwischenspeicher (oder null)
function _straengeErgebnisse(ergAktiv) {
  _straengeSichern();
  return abschnitt.straenge.map((s, k) => ({ s, k,
    erg: k === abschnitt.aktiv ? ergAktiv : (_strangGueltig(k) ? _strangErg.get(_strangSchl(k)).erg : null) }));
}
// Übrige Stränge im Hintergrund rechnen (kurz aktivieren, rechnen, zurück)
function _straengeNachrechnenPlanen() {
  clearTimeout(_strangTimer);
  _strangTimer = setTimeout(_straengeNachrechnen, 300);
}
function _straengeNachrechnen() {
  if (_straengeRechnenLaeuft || !_abschnittSichtbar) return;
  const A = abschnitt;
  _straengeSichern();
  const offenK = A.straenge.map((_, k) => k).filter(k => k !== A.aktiv && !_strangGueltig(k));
  if (!offenK.length) return;
  const zurueck = A.aktiv, offenZurueck = A.offen, y = window.scrollY;
  const fokus = document.activeElement;
  _straengeRechnenLaeuft = true;
  _abschnittSichtbar = false;          // während des Durchlaufs nicht neu zeichnen
  try {
    for (const k of offenK) {
      if (!_strangAktivieren(k, { feld: false, offen: null })) continue;
      const s = abschnitt.straenge[k];
      const erg = abschnittRechnen();
      s.zustand = _strangZustandLesen();
      _strangErg.set(_strangSchl(k), { schluessel: _strangSchluessel(s), erg });
    }
  } finally {
    _strangAktivieren(zurueck, { feld: false, offen: offenZurueck });
    _abschnittSichtbar = true;
    _straengeRechnenLaeuft = false;
  }
  abschnittAktualisieren();
  window.scrollTo(0, y);
  if (fokus && fokus !== document.body && document.contains(fokus)) fokus.focus({ preventScroll: true });
}

// ── Stränge bearbeiten ──
function strangSichtbar(k, an) {
  _straengeSichern();
  if (k === abschnitt.aktiv) an = true;      // der aktive Strang bleibt sichtbar
  abschnitt.straenge[k].sichtbar = !!an;
  abschnittAktualisieren();
}
function strangFarbe(k, farbe) {
  _straengeSichern();
  if (/^#[0-9a-f]{6}$/i.test(farbe)) {
    const i = STRANG_FARBEN_DUNKEL.indexOf(farbe.toLowerCase());
    abschnitt.straenge[k].farbe = i >= 0 ? STRANG_FARBEN[i] : farbe.toLowerCase();
  }
  abschnittAktualisieren();
}
function strangKennung(k, wert) {
  _straengeSichern();
  const alt = _strangSchl(k);
  abschnitt.straenge[k].kennung = String(wert).trim().slice(0, 24);
  _strangErg.delete(alt);
  renderAbschnitt();
}
function strangRolle(k, rolle) {
  _straengeSichern();
  if (STRANG_ROLLEN.includes(rolle)) abschnitt.straenge[k].rolle = rolle;
  abschnittAktualisieren();
}
function strangHinzu() {
  const S = _straengeSichern();
  if (S.length >= STRANG_MAX) return;
  const namen = new Set(S.map(s => s.kennung));
  let n = S.length + 1; while (namen.has(`S${n}`)) n++;
  if (S.length === 1 && !S[0].kennung) S[0].kennung = 'S1';
  S.push(_neuerStrang(`S${n}`, abschnitt.masten.map(m => ({ ...m })), S.length, 'speiseleiter'));
  strangWaehlen(S.length - 1);
  meldung(t('abs.str.neu').replace('{k}', `S${n}`), 'info');
}
async function strangWeg(k) {
  const S = _straengeSichern();
  if (S.length < 2) return;
  if (!await frageBestaetigung(t('abs.str.weg.frage').replace('{k}', _strangName(S[k], k)).replace('{n}', S[k].masten.length), { ok: t('rf.loeschen') })) return;
  if (k === abschnitt.aktiv) _strangAktivieren(k === 0 ? 1 : 0);
  const A = abschnitt;
  const aktivS = A.straenge[A.aktiv];
  A.straenge.splice(k, 1);
  A.aktiv = A.straenge.indexOf(aktivS);
  _strangErg.clear();
  renderAbschnitt();
}
// Masten des Strangs mit den meisten Masten (Stationierung, Auswahl Teilabschnitt)
function _basisMasten() {
  const S = _straengeSichern();
  return S.reduce((a, s) => (s.masten.length > a.length ? s.masten : a), abschnitt.masten);
}
// Teilabschnitt nur für Anzeige und Export (Mastnamen; null = ganzer Abschnitt)
function teilSetzen(von, bis) {
  _straengeSichern();
  const b = _basisMasten(), ix = n => b.findIndex(m => m.name === n);
  let iv = von ? ix(von) : 0, ib = bis ? ix(bis) : b.length - 1;
  if (iv < 0) iv = 0; if (ib < 0) ib = b.length - 1;
  if (iv > ib) [iv, ib] = [ib, iv];
  if (ib - iv < 1) { ib = Math.min(b.length - 1, iv + 1); iv = Math.max(0, ib - 1); }
  abschnitt.teil = { von: iv > 0 ? b[iv].name : null, bis: ib < b.length - 1 ? b[ib].name : null };
  renderAbschnitt();
}
// Felder i des Strangs im Teilabschnitt
function _teilFeld(masten, i) {
  const T = abschnitt.teil || {};
  const iv = T.von ? masten.findIndex(m => m.name === T.von) : 0;
  const ib = T.bis ? masten.findIndex(m => m.name === T.bis) : masten.length - 1;
  return i >= (iv < 0 ? 0 : iv) && i + 1 <= (ib < 0 ? masten.length - 1 : ib);
}

// ── Ansicht ein-/ausblenden ──
function abschnittAnsicht() {
  setCanvasView('diagramm');
  _abschnittSichtbar = true;
  ['main-canvas', 'canvas-scroll-area', 'result-card', 'legend'].forEach(id => zeigeElement(document.getElementById(id), false));
  zeigeElement(document.getElementById('abschnitt-view'), true);
  ['view-seg-diagramm', 'view-seg-zeichnung', 'view-seg-foto'].forEach(id => document.getElementById(id)?.classList.remove('active'));
  document.getElementById('view-seg-abschnitt')?.classList.add('active');
  renderAbschnitt();
}
function _abschnittAusblenden() {
  if (!_abschnittSichtbar) return;
  _abschnittSichtbar = false;
  zeigeElement(document.getElementById('abschnitt-view'), false);
  ['canvas-scroll-area', 'result-card', 'legend'].forEach(id => zeigeElement(document.getElementById(id), true));
  document.getElementById('view-seg-abschnitt')?.classList.remove('active');
}

// ── Masttabelle bearbeiten ──
const _ABS_SPALTEN = [
  ['name', 'abs.sp.mast', 'text'], ['e', 'abs.sp.e', 'zahl'], ['n', 'abs.sp.n', 'zahl'], ['z', 'abs.sp.z', 'zahl'],
  ['delta', 'abs.sp.delta', 'zahl'], ['h', 'abs.sp.h', 'zahl'], ['km', 'abs.sp.km', 'text'],
];
function abschnittMastWert(i, k, wert) {
  const m = abschnitt.masten[i];
  if (!m) return;
  const alterName = m.name;
  if (k === 'name') m.name = String(wert).trim();
  else if (k === 'km') m.km = kmFormat(wert);
  else { const v = parseFloat(String(wert).replace(',', '.').replace(/[−–]/g, '-')); m[k] = Number.isFinite(v) ? v : null; }
  // Masteigenschaften gelten für alle Stränge an diesem Mast
  if (['name', 'z', 'delta', 'km'].includes(k)) {
    _straengeSichern().forEach(s => { if (s.masten !== abschnitt.masten) s.masten.forEach(x => { if (x.name === alterName) x[k] = m[k]; }); });
    if (k === 'name') { const T = abschnitt.teil; if (T.von === alterName) T.von = m.name; if (T.bis === alterName) T.bis = m.name; }
  }
  _strangVersion++;
  if (k === 'name') renderAbschnitt(); else abschnittAktualisieren();
}
function abschnittMastHinzu() {
  const m = abschnitt.masten, letzter = m[m.length - 1];
  const nr = letzter && /^\d+$/.test(letzter.name) ? String(+letzter.name + 1) : String(m.length + 1);
  m.push({ name: nr, e: null, n: null, z: null, delta: letzter?.delta ?? null, h: letzter?.h ?? null, km: '', L: null });
  renderAbschnitt();
}
function abschnittMastWeg(i) {
  abschnitt.masten.splice(i, 1);
  // Messpunkte je Feld nachführen: Felder neben dem Mast entfallen, spätere rücken nach
  const mp = {};
  Object.entries(abschnitt.mp || {}).forEach(([k, v]) => { k = +k; if (k < i - 1) mp[k] = v; else if (k > i) mp[k - 1] = v; });
  abschnitt.mp = mp;
  if (abschnitt.offen !== null && abschnitt.offen >= abschnittFelderAnzahl()) abschnitt.offen = null;
  renderAbschnitt(); renderObstacleList();
}
async function abschnittAlleLoeschen() {
  if (!abschnitt.masten.length) return;
  if (!await frageBestaetigung(t('abs.loeschen.frage').replace('{n}', abschnitt.masten.length), { ok: t('rf.loeschen') })) return;
  abschnitt = { masten: [], offen: null, mp: {} };
  _strangErg.clear(); _strangVersion++;
  renderAbschnitt(); renderObstacleList(); berechnen();
}

// ── CSV ──
function abschnittCsvWaehlen() { document.getElementById('abs-csv-datei')?.click(); }
function _dateiText(datei) {
  return new Promise((ok, fehler) => {
    const lesen = kodierung => new Promise((r, f) => {
      const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => f(fr.error);
      fr.readAsText(datei, kodierung);
    });
    lesen('utf-8').then(txt => txt.includes('�') ? lesen('windows-1252') : txt).then(ok, fehler);
  });
}
async function abschnittCsvGewaehlt(input) {
  const datei = input.files?.[0];
  input.value = '';
  if (!datei) return;
  let erg;
  try { erg = csvLesen(await _dateiText(datei)); }
  catch (e) { meldung(t('msg.importfehler') + ': ' + e.message, 'fehler'); return; }
  if (!erg.masten.length) { meldung(t('abs.csv.fehler'), 'fehler'); return; }
  if (abschnitt.masten.length && !await frageBestaetigung(
      t('abs.csv.ersetzen').replace('{n}', abschnitt.masten.length).replace('{m}', erg.masten.length), { ok: t('abs.csv.import') })) return;
  // Mit Spalte «Strang»: ein Strang je Kennung (gemeinsame Masten)
  const { straenge: gruppen, abweichungen } = straengeAusMasten(erg.masten);
  const liste = gruppen.slice(0, STRANG_MAX);
  abschnitt = { masten: liste[0].masten, offen: null, mp: {}, aktiv: 0, teil: { von: null, bis: null },
    straenge: liste.map((g, i) => _neuerStrang(g.kennung, g.masten, i, i === 0 && !g.kennung ? (sysMode === 'el' ? 'speiseleiter' : 'fahrleitung') : null)) };
  _strangErg.clear(); _strangVersion++;
  const hinweise = [liste.length > 1
    ? t('abs.csv.straenge').replace('{n}', liste.length).replace('{k}', liste.map(g => g.kennung).join(', '))
    : t('abs.csv.gelesen').replace('{n}', erg.masten.length)];
  if (gruppen.length > STRANG_MAX) hinweise.push(t('abs.csv.zuviele').replace('{n}', STRANG_MAX));
  if (abweichungen.length) hinweise.push(t('abs.csv.abweichung').replace('{m}', abweichungen.slice(0, 5).join(', ')));
  if (liste.length > 1) _strangStartSystem();
  const ohneH = erg.warnungen.filter(w => w.startsWith('h:')).length;
  if (ohneH) hinweise.push(t('abs.csv.warn.h').replace('{n}', ohneH));
  if (erg.warnungen.includes('zmastfuss')) hinweise.push(t('abs.csv.zmastfuss'));
  erg.warnungen.filter(w => w.startsWith('spalte:')).forEach(w => hinweise.push(t('abs.csv.warn.spalte').replace('{s}', w.slice(7).toUpperCase())));
  meldung(hinweise.join(' '), ohneH || abweichungen.length ? 'warnung' : 'info');
  renderAbschnitt(); renderObstacleList();
}
function abschnittCsvExport() {
  const S = _straengeSichern();
  const inhalt = S.length > 1 || S[0].kennung
    ? csvSchreibenStraenge(S.map((s, k) => ({ kennung: s.kennung || `S${k + 1}`, masten: s.masten })))
    : csvSchreiben(abschnitt.masten);
  _dateiHerunterladen(inhalt, 'abschnitt_masten.csv', 'text/csv;charset=utf-8');
}
function abschnittCsvVorlage() {
  _dateiHerunterladen(csvVorlage(), 'vorlage_masten.csv', 'text/csv;charset=utf-8');
}
// Beispiel zum Ausprobieren: 5 Masten mit Koordinaten (Leiter und Lastfall wie links eingestellt)
async function abschnittBeispiel() {
  const bsp = beispielStraenge();
  const masten = bsp[0].masten;
  if (abschnitt.masten.length && !await frageBestaetigung(
      t('abs.beispiel.ersetzen').replace('{n}', abschnitt.masten.length), { ok: t('abs.beispiel') })) return;
  abschnitt = { masten, offen: null, mp: {}, aktiv: 0, teil: { von: null, bis: null },
    straenge: bsp.map((b, i) => _neuerStrang(b.kennung, b.masten, i, b.rolle)) };
  _strangErg.clear(); _strangVersion++;
  _strangStartSystem();
  meldung(t('abs.beispiel.geladen').replace('{n}', masten.length), 'info');
  renderAbschnitt(); renderObstacleList();
}

// ── Feld in die Eingaben übertragen ──
function abschnittFeldOeffnen(i, { ansicht = true, koord = null } = {}) {
  const m = abschnitt.masten, a = m[i], b = m[i + 1];
  const fl = feldLaengen(m);
  if (!a || !b || !(fl[i]?.L > 0)) return false;
  // Messpunkte je Feld: bisheriges Feld sichern, neues laden. Beim ersten
  // Öffnen ohne gespeicherte Punkte gehen die aktuellen Messpunkte mit.
  abschnitt.mp = abschnitt.mp || {};
  const vorher = abschnittOffenesFeld();
  if (vorher !== null) abschnitt.mp[vorher] = _mpLive();
  if (vorher !== i) {
    if (abschnitt.mp[i]) _mpSetzen(abschnitt.mp[i]);
    else if (vorher !== null) _mpSetzen(null);
  }
  abschnitt.offen = i;
  const setze = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const zahl = (v, s) => Number.isFinite(v) ? v.toFixed(s) : '';
  koordSchalten(false, { rechnen: false });           // gesperrte Felder freigeben
  const alleL = fl.every(f => f.L > 0);
  if (!_abschnittStarr() && fl.length > 1 && alleL) {
    spanMode = 'ruling';
    spanCount = fl.length;
    document.getElementById('span-count-val').textContent = spanCount;
    rebuildSpanList();
    fl.forEach((f, k) => setze(`span-${k}`, f.L.toFixed(3)));
    lmOvr = null;
    setze('lm-display', '');
    setze('display-span', String(i));
  } else {
    spanMode = 'single';
    setze('span', fl[i].L.toFixed(3));
  }
  document.getElementById('seg-single').classList.toggle('active', spanMode === 'single');
  document.getElementById('seg-ruling').classList.toggle('active', spanMode === 'ruling');
  zeigeElement(document.getElementById('panel-single'), spanMode === 'single');
  zeigeElement(document.getElementById('panel-ruling'), spanMode === 'ruling');
  if (spanMode === 'ruling') { updateLm(); highlightActiveSpan(); }

  setze('h1', zahl(a.h, 2)); setze('h2', zahl(b.h, 2));
  setze('mast-delta-sok-left', zahl(a.delta, 2)); setze('mast-delta-sok-right', zahl(b.delta, 2));
  setze('mast-num-left', a.name); setze('mast-num-right', b.name);
  setze('mast-km-left', a.km); setze('mast-km-right', b.km);
  const sA = mastSok(a), sB = mastSok(b);
  setze('sok-mum-left', zahl(sA, 3)); setze('sok-mum-right', zahl(sB, 3));
  document.getElementById('sok-mum-right').dataset.userEdited = sB !== null ? '1' : '';
  const kmR = document.getElementById('mast-km-right'); if (kmR) kmR.dataset.userEdited = b.km ? '1' : '';
  [['e', a.e, b.e], ['n', a.n, b.n]].forEach(([k, va, vb]) => {
    setze(`koord-${k}-left`, zahl(va, 3)); setze(`koord-${k}-right`, zahl(vb, 3));
  });
  const mitKoord = koord ?? [a.e, a.n, b.e, b.n].every(Number.isFinite);
  if (mitKoord) koordSchalten(true, { rechnen: false });
  if (typeof _syncMastNames === 'function') _syncMastNames();
  updateSokMumUI();
  _mastangabenOeffnenFallsBelegt();
  berechnen();
  renderObstacleList();
  if (ansicht) setCanvasView('diagramm');
  return true;
}

// ── Schnellauswahl Feld (oben neben der Ansicht) ──
// Sichtbar, sobald ein Abspannabschnitt mit mindestens 2 Masten erfasst ist.
// Wechselt das Feld und bleibt in der aktuellen Ansicht (Diagramm, Zeichnung, Abschnitt).
let _feldWahlSchluessel = '';
function feldWahlAktualisieren() {
  const box = document.getElementById('feld-wahl'), sel = document.getElementById('feld-select');
  if (!box || !sel) return;
  let m = [];
  try { m = abschnitt?.masten || []; } catch { return; }   // beim Laden evtl. noch nicht deklariert
  const n = m.length >= 2 ? abschnittFelderAnzahl() : 0;
  zeigeElement(box, n > 0 && !window._fotoTabActive);
  if (!n) return;
  const S = _straengeSichern(), mehrere = S.length > 1;
  const texte = ms => Array.from({ length: Math.max(0, ms.length - 1) }, (_, i) =>
    `${i + 1} · ${ms[i].name || '?'}–${ms[i + 1].name || '?'}${ms[i].km ? ` · KM ${ms[i].km}` : ''}`);
  // Werte «Strang:Feld»; mit mehreren Strängen je Strang eine Gruppe (Wahl wechselt den Strang)
  const gruppen = S.map((st, k) => ({ k, name: _strangName(st, k), texte: texte(st.masten) }));
  const schluessel = currentLang + '|' + JSON.stringify(gruppen);
  if (schluessel !== _feldWahlSchluessel) {
    _feldWahlSchluessel = schluessel;
    const opts = g => g.texte.map((tx, i) => `<option value="${g.k}:${i}">${mehrere ? escHtml(g.name) + ' · ' : ''}${escHtml(t('abs.feldwahl'))} ${escHtml(tx)}</option>`).join('');
    sel.innerHTML = `<option value="-1" disabled>${escHtml(t('abs.feldwahl.leer'))}</option>`
      + (mehrere ? gruppen.map(g => `<optgroup label="${escHtml(g.name)}">${opts(g)}</optgroup>`).join('') : opts(gruppen[0]));
  }
  const offen = abschnittOffenesFeld();
  sel.value = offen === null ? '-1' : `${abschnitt.aktiv}:${offen}`;
  sel.title = offen !== null ? sel.options[sel.selectedIndex]?.textContent || '' : t('abs.feldwahl.leer');
  document.getElementById('feld-vor').disabled = offen === null || offen <= 0;
  document.getElementById('feld-nach').disabled = offen !== null && offen >= n - 1;
}
function feldWaehlen(wert) {
  let k = abschnitt.aktiv, i = wert;
  if (typeof wert === 'string') { const t2 = wert.split(':'); if (t2.length === 2) { k = +t2[0]; i = +t2[1]; } else i = +wert; }
  if (!Number.isInteger(i) || i < 0) return;
  if (Number.isInteger(k) && k !== abschnitt.aktiv) _strangAktivieren(k, { feld: false, offen: null });
  abschnittFeldOeffnen(i, { ansicht: false });
  if (_abschnittSichtbar) renderAbschnitt();
  else if (typeof refreshScaleViewIfActive === 'function') refreshScaleViewIfActive();
  feldWahlAktualisieren();
}
function feldSchritt(d) {
  const offen = abschnittOffenesFeld();
  const n = abschnittFelderAnzahl();
  const ziel = offen === null ? (d > 0 ? 0 : n - 1) : offen + d;
  if (ziel >= 0 && ziel < n) feldWaehlen(ziel);
}

// Übersicht der Stränge (Sichtbarkeit, Farbe, Kennung, Rolle, System, Wählen) und Teilabschnitt
function _straengeHtml() {
  const S = _straengeSichern(), A = abschnitt, knopf = 'abs-knopf';
  const basis = _basisMasten();
  const opt = sel => basis.map(x => `<option value="${escHtml(x.name)}"${x.name === sel ? ' selected' : ''}>${escHtml(x.name)}</option>`).join('');
  let h = `<div class="abs-str"><p class="abs-h4">${t('abs.straenge')}</p>
    <datalist id="abs-farbvorschlag">${(_themaDunkel() ? STRANG_FARBEN_DUNKEL : STRANG_FARBEN).map(f => `<option value="${f}"></option>`).join('')}</datalist>
    <div class="abs-scroll"><table class="abs-tab abs-str-tab"><thead><tr>
      <th>${t('abs.str.sichtbar')}</th><th>${t('abs.str.farbe')}</th><th>${t('abs.strang')}</th><th>${t('abs.str.rolle')}</th>
      <th>${t('abs.str.leiter')}</th><th>${t('abs.str.masten')}</th><th>${t('abs.str.laenge')}</th><th>${t('abs.sp.hind')}</th>
      <th><span class="nur-vorlesen">${t('abs.str.waehlen')}</span></th><th><span class="nur-vorlesen">${t('ui.loeschen')}</span></th></tr></thead><tbody>`;
  S.forEach((s, k) => {
    const aktiv = k === A.aktiv, name = escHtml(_strangName(s, k));
    const L = feldLaengen(s.masten).reduce((a, f) => a + (f.L > 0 ? f.L : 0), 0);
    h += `<tr${aktiv ? ' class="offen"' : ''}>
      <td><input type="checkbox" class="auswahl" ${s.sichtbar || aktiv ? 'checked' : ''} ${aktiv ? 'disabled' : ''} onchange="strangSichtbar(${k},this.checked)" aria-label="${escHtml(t('abs.str.sichtbar'))} ${name}"></td>
      <td><input type="color" class="abs-farbe" list="abs-farbvorschlag" value="${_strangFarbeAnzeige(s.farbe)}" onchange="strangFarbe(${k},this.value)" aria-label="${escHtml(t('abs.str.farbe'))} ${name}"></td>
      <td><input class="abs-inp" style="width:5.5rem" value="${escHtml(s.kennung)}" placeholder="${name}" onchange="strangKennung(${k},this.value)" aria-label="${escHtml(t('abs.strang'))} ${k + 1}"></td>
      <td><select class="abs-inp" onchange="strangRolle(${k},this.value)" aria-label="${escHtml(t('abs.str.rolle'))} ${name}">${
        STRANG_ROLLEN.map(r => `<option value="${r}"${r === s.rolle ? ' selected' : ''}>${escHtml(t('rolle.' + r))}</option>`).join('')}</select></td>
      <td id="abs-str-sys-${k}" class="abs-str-sys">…</td>
      <td>${s.masten.length ? `${escHtml(s.masten[0].name)}–${escHtml(s.masten[s.masten.length - 1].name)}` : '—'}</td>
      <td>${L > 0 ? fN(L, 0) + ' m' : '—'}</td>
      <td id="abs-str-nw-${k}">…</td>
      <td>${aktiv ? `<span class="abs-str-aktiv">${t('abs.str.aktiv')}</span>` : `<button class="${knopf} klein" onclick="strangWaehlen(${k})">${t('abs.str.waehlen')}</button>`}</td>
      <td>${S.length > 1 ? `<button class="obs-rm-btn" onclick="strangWeg(${k})" aria-label="${escHtml(t('ui.loeschen'))} ${name}">✕</button>` : ''}</td></tr>`;
  });
  const T = A.teil || {};
  h += `</tbody></table></div>
    <div class="abs-leiste">
      <button class="${knopf}" onclick="strangHinzu()" ${S.length >= STRANG_MAX ? 'disabled' : ''}>${t('abs.str.hinzu')}</button>
      <span class="abs-trenner"></span>
      ${basis.length > 2 ? `<span class="abs-teil">${t('abs.teil')}:
        <label>${t('abs.teil.von')} <select class="abs-inp" id="abs-teil-von" onchange="teilSetzen(this.value, document.getElementById('abs-teil-bis').value)">${opt(T.von ?? basis[0].name)}</select></label>
        <label>${t('abs.teil.bis')} <select class="abs-inp" id="abs-teil-bis" onchange="teilSetzen(document.getElementById('abs-teil-von').value, this.value)">${opt(T.bis ?? basis[basis.length - 1].name)}</select></label>
        ${T.von || T.bis ? `<button class="${knopf} klein leise" onclick="teilSetzen(null, null)">${t('abs.teil.alle')}</button>` : ''}</span>` : ''}
    </div></div>`;
  return h;
}

// ── Darstellung ──
function renderAbschnitt() {
  const box = document.getElementById('abschnitt-view');
  if (!box) return;
  const knopf = 'abs-knopf';
  const m = abschnitt.masten;
  feldWahlAktualisieren();
  // Zeile 1: Masten erfassen (Eingabe), Zeile 2: Export
  let html = `<div class="abs-leiste">
      <strong class="abs-titel">${t('abs.titel')}</strong>
      <button class="${knopf}" onclick="abschnittMastHinzu()">${t('abs.mast.hinzu')}</button>
      <button class="${knopf}" onclick="abschnittCsvWaehlen()">${t('abs.csv.import')}</button>
      <input type="file" id="abs-csv-datei" accept=".csv,.txt,text/csv" style="display:none" onchange="abschnittCsvGewaehlt(this)">
      <button class="${knopf}" onclick="abschnittCsvVorlage()">${t('abs.csv.vorlage')}</button>
      <button class="${knopf}" id="abs-beispiel" onclick="abschnittBeispiel()">${t('abs.beispiel')}</button>
      <span class="abs-trenner"></span>
      ${m.length ? `<button class="${knopf} leise" onclick="abschnittAlleLoeschen()">${t('abs.alle.loeschen')}</button>` : ''}
    </div>
    <div class="abs-leiste abs-leiste-export" role="group" aria-labelledby="abs-export-lbl">
      <span class="abs-leiste-lbl" id="abs-export-lbl">${t('ui.export')}</span>
      <button class="${knopf}" onclick="abschnittCsvExport()" ${m.length ? '' : 'disabled'}>${t('abs.csv.export')}</button>
      <button class="${knopf}" onclick="abschnittExport('ifc')" ${m.length > 1 ? '' : 'disabled'}>${t('abs.ifc')}</button>
      <button class="${knopf}" onclick="abschnittExport('dxf')" ${m.length > 1 ? '' : 'disabled'}>${t('abs.dxf')}</button>
    </div>
    <details class="abs-hinweis-box"${(_absHinweisOffen ?? !_handyBreite()) ? ' open' : ''} ontoggle="_absHinweisOffen = this.open"><summary>${t('abs.hinweis.titel')}</summary><p class="abs-hinweis">${t('abs.hinweis')}</p></details>`;
  if (m.length) html += _straengeHtml();
  if (!m.length) {
    html += `<p class="abs-leer">${t('abs.leer')}</p>`;
  } else {
    if (_mehrereStraenge()) html += `<p class="abs-h4">${t('abs.str.masten')} — ${escHtml(_strangName(abschnitt.straenge[abschnitt.aktiv], abschnitt.aktiv))}</p>`;
    html += `<div class="abs-scroll"><table class="abs-tab abs-masten"><thead><tr><th>#</th>${
      _ABS_SPALTEN.map(([, k]) => `<th>${t(k)}</th>`).join('')}<th>${t('abs.sp.L')}</th><th><span class="nur-vorlesen">${t('ui.loeschen')}</span></th></tr></thead><tbody>`;
    m.forEach((mast, i) => {
      html += `<tr><td class="abs-nr">${i + 1}</td>${_ABS_SPALTEN.map(([k, lbl, typ]) =>
        `<td><input class="abs-inp${typ === 'zahl' ? ' zahl' : ''}" ${typ === 'zahl' && k !== 'delta' ? 'inputmode="decimal"' : ''}
          aria-label="${escHtml(t(lbl))} ${escHtml(mast.name || String(i + 1))}"${k === 'km' ? ' placeholder="000.000"' : ''}
          value="${escHtml(mast[k] ?? '')}" onchange="abschnittMastWert(${i},'${k}',this.value)${k === 'km' ? ';this.value=abschnitt.masten[' + i + '].km' : ''}"></td>`).join('')}
        <td class="abs-L" id="abs-L-${i}"></td>
        <td><button class="obs-rm-btn" onclick="abschnittMastWeg(${i})" aria-label="${escHtml(t('ui.loeschen'))} ${escHtml(mast.name)}">✕</button></td></tr>`;
    });
    html += `</tbody></table></div>
      <div id="abs-felder"></div>
      <div id="abs-profil" class="abs-profil"></div>`;
  }
  box.innerHTML = html;
  abschnittAktualisieren();
}

// Ergebnisse, Feldlängen und Längsprofil neu rechnen (Masttabelle bleibt stehen)
function abschnittAktualisieren() {
  if (!_abschnittSichtbar) return;
  const m = abschnitt.masten;
  const fl = feldLaengen(m);
  const quelleTxt = q => q ? t('abs.quelle.' + q) : '';
  m.forEach((mast, i) => {
    const td = document.getElementById(`abs-L-${i}`);
    if (!td) return;
    if (i >= fl.length) { td.textContent = ''; return; }
    const f = fl[i];
    if (f.quelle === 'koord' || f.quelle === 'km') td.innerHTML = `${fN(f.L, 3)} <span class="abs-quelle">${quelleTxt(f.quelle)}</span>`;
    else td.innerHTML = `<input class="abs-inp zahl" inputmode="decimal" style="width:5.5rem" aria-label="${escHtml(t('abs.sp.L'))} ${escHtml(mast.name)}"
      value="${mast.L ?? ''}" onchange="abschnittMastWert(${i},'L',this.value)">`;
  });
  const felderBox = document.getElementById('abs-felder');
  const profilBox = document.getElementById('abs-profil');
  if (!felderBox) return;
  const erg = abschnittRechnen();
  if (!erg) { felderBox.innerHTML = ''; if (profilBox) profilBox.innerHTML = ''; return; }
  // Aktiver Strang: Einstellungen und Ergebnis merken; übrige aus dem Zwischenspeicher
  const S = _straengeSichern(), sA = S[abschnitt.aktiv];
  sA.zustand = _strangZustandLesen();
  _strangErg.set(_strangSchl(abschnitt.aktiv), { schluessel: _strangSchluessel(sA), erg });
  const alle = _straengeErgebnisse(erg);
  alle.forEach(({ s, k, erg: e }) => {
    const sys = document.getElementById(`abs-str-sys-${k}`), nw = document.getElementById(`abs-str-nw-${k}`);
    if (sys) sys.textContent = s.zustand ? `${sysName(s.zustand.sysMode)} · ${s.zustand.leiter || '—'}` : '…';
    if (!nw) return;
    if (!e) { nw.textContent = '…'; return; }
    const best = e.felder.filter(f => !f.fehler && _teilFeld(s.masten, f.i)).flatMap(f => f.nachweis.filter(x => x.best));
    const min = best.reduce((a, x) => (!a || x.best.abstand < a.best.abstand ? x : a), null);
    nw.innerHTML = !min ? '—' : `<span class="${min.ok ? 'abs-ok' : 'abs-nok'}">${min.ok ? '✓' : '✗'} ${fN(min.best.abstand, 2)} m</span>`;
  });
  if (alle.some(x => !x.erg)) _straengeNachrechnenPlanen();
  const absolut = m.every(x => mastSok(x) !== null);
  const einh = absolut ? t('bp.mum.abbrev') : `m ${t('dyn.ueber.sok')}`;
  const lmTxt = erg.starr ? t('abs.starr') : sysMode === 'rfl' ? t('abs.rfl')
    : erg.Lm ? t('abs.lm').replace('{lm}', fN(erg.Lm, 2)).replace('{formel}', lmFormula === 'arith' ? t('lm.arith') : t('lm.ruling')) : '';
  let html = `<p class="abs-h4">${t('abs.felder')}${_mehrereStraenge() ? ` — ${escHtml(_strangName(sA, abschnitt.aktiv))}` : ''} <span class="abs-lm">${lmTxt}</span></p>
    <div class="abs-scroll"><table class="abs-tab abs-erg"><thead><tr>
      <th>${t('abs.sp.feld')}</th><th>L [m]</th><th>${t('abs.sp.f')}</th><th>${t('abs.sp.H')}</th>
      <th>${t('abs.sp.tief')} [${einh}]</th>${sysMode !== 'el' ? `<th>${t('abs.sp.fd')} [${einh}]</th>` : ''}
      <th>${t('abs.sp.hind')}</th><th><span class="nur-vorlesen">${t('abs.oeffnen')}</span></th></tr></thead><tbody>`;
  erg.felder.forEach(f => {
    if (!_teilFeld(m, f.i)) return;          // Teilabschnitt: nur Anzeige
    const offen = abschnittOffenesFeld() === f.i;
    const name = `${f.i + 1} · ${escHtml(f.a.name)}–${escHtml(f.b.name)}`;
    if (f.fehler) {
      html += `<tr${offen ? ' class="offen"' : ''}><td>${name}</td><td colspan="${sysMode !== 'el' ? 6 : 5}" class="abs-fehlt">${
        f.fehler === 'unvollstaendig' ? t('abs.unvollstaendig') : escHtml(f.fehler)}</td><td></td></tr>`;
      return;
    }
    const hoehe = (yAbs, yRel) => fN(absolut ? yAbs : yRel, 2);
    const n = f.nachweis.filter(x => x.best);
    const schlecht = n.reduce((a, x) => (!a || x.best.abstand < a.best.abstand) ? x : a, null);
    const hind = !f.nachweis.length ? '—'
      : f.nachweis.some(x => x.ohneSok) ? `<span class="abs-fehlt">${t('hind.sok.fehlt.kurz')}</span>`
      : !schlecht ? `<span class="abs-fehlt">${t('hind.unvollstaendig')}</span>`
      : `<span class="${schlecht.ok ? 'abs-ok' : 'abs-nok'}">${schlecht.ok ? '✓' : '✗'} ${fN(schlecht.best.abstand, 2)} m</span>`;
    html += `<tr${offen ? ' class="offen"' : ''}><td>${name}</td>
      <td>${fN(f.L, 2)}</td><td>${fN(f.oben.sag, 3)} m</td><td>${fN(f.z.c2.H, 0)} N</td>
      <td>${hoehe(f.tief, f.tiefRel)}</td>${sysMode !== 'el' ? `<td>${hoehe(f.fdTief, f.fdTiefRel)}</td>` : ''}
      <td>${hind}</td>
      <td><button class="abs-knopf klein" onclick="abschnittFeldOeffnen(${f.i})">${offen ? t('abs.offen') : t('abs.oeffnen')}</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  if (!absolut && m.some(x => mastSok(x) !== null)) html += `<p class="abs-hinweis">${t('abs.ohne.sok')}</p>`;
  felderBox.innerHTML = html;
  if (profilBox) {
    profilBox.innerHTML = _abschnittProfil(alle, absolut);
    // Breites Profil: offenes Feld in den sichtbaren Bereich schieben
    const box = profilBox.querySelector('.abs-profil-scroll'), feld = box?.querySelector('.abs-feld.offen');
    if (box && feld && box.scrollWidth > box.clientWidth) {
      const r = feld.getBoundingClientRect(), br = box.getBoundingClientRect();
      box.scrollLeft += r.left - br.left - (br.width - r.width) / 2;
    }
  }
}

// Hindernispunkte im Bezug des Längsprofils (absolut, wenn das Feld SOK hat), nach x sortiert
function _ukProfilPunkte(f, h, absolut) {
  return hindernisPunkte(h.punkte).map(p => ({ x: p.x, h: (absolut || !f.hatSok) ? p.h : p.h - f.sokFn(Math.max(0, Math.min(f.L, p.x))) }));
}

// Längsprofil als SVG: alle sichtbaren Stränge übereinander (aktiver obenauf), Fahrdraht,
// SOK, Masten, Hindernisse des aktiven Strangs; Teilabschnitt: nur dieser Bereich
function _abschnittProfil(alle, absolut) {
  const A = abschnitt;
  const aktivE = alle.find(x => x.k === A.aktiv);
  if (!aktivE?.erg || aktivE.erg.felder.some(f => f.fehler)) return `<p class="abs-hinweis">${t('abs.profil.fehlt')}</p>`;
  const mehrere = A.straenge.length > 1;
  // Stationierung je Mastname aus dem Strang mit den meisten Masten
  const basis = _basisMasten(), fl = feldLaengen(basis);
  const st = new Map(); let acc = 0;
  basis.forEach((m, i) => { st.set(m.name, acc); if (i < fl.length) acc += fl[i].L > 0 ? fl[i].L : 0; });
  const T = A.teil || {};
  const x0 = T.von && st.has(T.von) ? st.get(T.von) : 0;
  const x1 = T.bis && st.has(T.bis) ? st.get(T.bis) : acc;
  const S = Math.max(x1 - x0, 1);
  // Felder je sichtbarem Strang im Bereich (beide Masten in der Stationierung)
  const lagen = alle.filter(e => e.erg && (e.k === A.aktiv || e.s.sichtbar)).map(e => ({ ...e,
    F: e.erg.felder.filter(f => !f.fehler && st.has(f.a.name) && st.has(f.b.name)
      && st.get(f.a.name) >= x0 - 1e-6 && st.get(f.b.name) <= x1 + 1e-6 && st.get(f.b.name) > st.get(f.a.name))
      .map(f => ({ f, s0: st.get(f.a.name), s1: st.get(f.b.name) })) }));
  const aktivL = lagen.find(e => e.k === A.aktiv), FA = aktivL?.F || [];
  if (!FA.length) return `<p class="abs-hinweis">${t('abs.profil.fehlt')}</p>`;
  const hoehe = (f, x, y) => y + (absolut && f.sokFn ? f.sokFn(x) : 0);
  const sok = (f, x) => absolut && f.sokFn ? f.sokFn(x) : 0;
  let yMin = Infinity, yMax = -Infinity;
  lagen.forEach(({ F, k }) => F.forEach(({ f }) => {
    for (let j = 0; j <= 40; j++) {
      const x = f.L * j / 40;
      yMin = Math.min(yMin, sok(f, x), hoehe(f, x, f.fdY ? f.fdY(x) : kettenY(f.oben, x)));
      yMax = Math.max(yMax, hoehe(f, x, kettenY(f.oben, x)));
    }
    yMax = Math.max(yMax, hoehe(f, 0, f.a.h), hoehe(f, f.L, f.b.h));
    if (k === A.aktiv) f.nachweis.forEach(n => { if (n.best) _ukProfilPunkte(f, n.h, absolut).forEach(p => { yMax = Math.max(yMax, p.h); }); });
  }));
  // Viele Felder (Nachspannlänge bis ~650 m, 50+ Felder): das Profil wird breiter
  // statt enger (kürzestes Feld mind. 60 Einheiten), die Box lässt sich seitlich
  // schieben. Nie schmaler als 1000 (sonst würden Schrift und Linien vergrössert).
  const H = 300, pl = 48, pr = 30, pt = 30, pb = 30;
  const Lmin = Math.min(...FA.map(x => x.s1 - x.s0));
  const W = Math.max(1000, Math.round(Math.min(pl + pr + S * 60 / Math.max(Lmin, 1), pl + pr + 90 * FA.length)));
  const breit = W > 1000;
  const sx = x => pl + (W - pl - pr) * (x - x0) / S;
  const sy = y => pt + (H - pt - pb) * (1 - (y - yMin) / Math.max(0.5, yMax - yMin));
  // Ein Strang: Leiter in der Temperaturfarbe wie im Diagramm; mehrere: Farbe je Strang
  const T2 = parseFloat(document.getElementById('temp2')?.value);
  const tempClr = sysMode === 'rfl' || !Number.isFinite(T2) ? 'var(--primary)' : t2TempColor(T2);
  const farbe = e => mehrere ? _strangFarbeAnzeige(e.s.farbe) : tempClr;
  let svg = `<svg viewBox="0 0 ${W} ${H}" class="abs-svg" role="img" aria-label="${escHtml(t('abs.profil'))}"${breit ? ` style="width:${W}px;max-width:none"` : ''}>`;
  for (let k = 0; k <= 4; k++) {
    const y = yMin + (yMax - yMin) * k / 4;
    svg += `<line x1="${pl}" x2="${W - pr}" y1="${sy(y)}" y2="${sy(y)}" class="abs-raster"/>
      <text x="${pl - 5}" y="${sy(y) + 3.5}" class="abs-achse" text-anchor="end">${y.toFixed(1)}</text>`;
  }
  svg += `<text x="${pl}" y="14" class="abs-achse">${absolut ? t('canvas.y.mum') : t('canvas.y.sok')}</text>`;
  const pfad = (f, s0, s1, fn) => Array.from({ length: 61 }, (_, j) => { const x = f.L * j / 60;
    return `${j ? 'L' : 'M'}${sx(s0 + (s1 - s0) * x / f.L).toFixed(1)},${sy(hoehe(f, x, fn(x))).toFixed(1)}`; }).join('');
  // Felder des aktiven Strangs: Klickfläche, SOK, Feldlänge
  FA.forEach(({ f, s0, s1 }) => {
    svg += `<rect x="${sx(s0)}" y="${pt}" width="${sx(s1) - sx(s0)}" height="${H - pt - pb}" class="abs-feld${abschnittOffenesFeld() === f.i ? ' offen' : ''}"
      onclick="abschnittFeldOeffnen(${f.i})"><title>${t('abs.sp.feld')} ${f.i + 1}: ${escHtml(f.a.name)}–${escHtml(f.b.name)} · L = ${fN(f.L, 2)} m</title></rect>`;
    if (absolut) svg += `<line x1="${sx(s0)}" y1="${sy(sok(f, 0))}" x2="${sx(s1)}" y2="${sy(sok(f, f.L))}" class="abs-sok"/>`;
    svg += `<text x="${sx((s0 + s1) / 2)}" y="${H - 8}" class="abs-achse" text-anchor="middle">${fN(f.L, 1)} m</text>`;
  });
  // Leiter: übrige Stränge zuerst, der aktive obenauf
  [...lagen.filter(e => e.k !== A.aktiv), aktivL].forEach(e => {
    const clr = farbe(e), ak = e.k === A.aktiv;
    e.F.forEach(({ f, s0, s1 }) => {
      if (f.fdY) svg += ak ? `<path d="${pfad(f, s0, s1, f.fdY)}" class="abs-fd"/>`
        : `<path d="${pfad(f, s0, s1, f.fdY)}" class="abs-fd" style="stroke:${clr};opacity:.3;stroke-dasharray:4 3"/>`;
      svg += `<path d="${pfad(f, s0, s1, x => kettenY(f.oben, x))}" class="abs-leiter" style="stroke:${clr}${ak ? '' : ';stroke-width:1.6;opacity:.45'}"><title>${escHtml(_strangName(e.s, e.k))}</title></path>`;
    });
  });
  // Hindernisse des aktiven Strangs
  FA.forEach(({ f, s0, s1 }) => f.nachweis.forEach(n => {
    if (!n.best) return;
    const P = _ukProfilPunkte(f, n.h, absolut).filter(p => p.x >= 0 && p.x <= f.L);
    const px = x => sx(s0 + (s1 - s0) * x / f.L).toFixed(1);
    const titel = `<title>${escHtml(n.h.name || t('hind.titel'))}: a = ${fN(n.best.abstand, 2)} m</title>`;
    if (n.h.verbinden && P.length > 1)
      svg += `<polyline points="${P.map(p => `${px(p.x)},${sy(p.h).toFixed(1)}`).join(' ')}" fill="none" class="abs-hind ${n.ok ? 'ok' : 'nok'}">${titel}</polyline>`;
    else P.forEach(p => { svg += `<circle cx="${px(p.x)}" cy="${sy(p.h).toFixed(1)}" r="4" class="abs-hind-pkt ${n.ok ? 'ok' : 'nok'}">${titel}</circle>`; });
  }));
  // Masten (Basis) im Bereich: bis zum höchsten Aufhängepunkt aller Stränge
  basis.forEach(mast => {
    const x = st.get(mast.name);
    if (x < x0 - 1e-6 || x > x1 + 1e-6) return;
    let unten = null, oben = -Infinity;
    lagen.forEach(({ F }) => F.forEach(({ f }) => {
      if (f.a.name === mast.name) { oben = Math.max(oben, hoehe(f, 0, f.a.h)); unten ??= sok(f, 0); }
      if (f.b.name === mast.name) { oben = Math.max(oben, hoehe(f, f.L, f.b.h)); unten ??= sok(f, f.L); }
    }));
    if (unten === null || !Number.isFinite(oben)) return;
    svg += `<line x1="${sx(x)}" x2="${sx(x)}" y1="${sy(unten)}" y2="${sy(oben)}" class="abs-mast"/>
      <text x="${sx(x)}" y="${sy(oben) - 6}" class="abs-mastname" text-anchor="middle">${escHtml(mast.name)}</text>`;
  });
  svg += '</svg>';
  const t2Txt = Number.isFinite(T2) ? ` = ${fN(T2, 0)} °C` : '';
  let legende;
  if (mehrere) {
    legende = lagen.map(e => `<span class="abs-leg${e.k === A.aktiv ? ' aktiv' : ''}"><span class="abs-leg-linie" style="background:${_strangFarbeAnzeige(e.s.farbe)}${e.k === A.aktiv ? '' : ';opacity:.45'}"></span><span>${escHtml(_strangName(e.s, e.k))}</span></span>`).join('')
      + alle.filter(e => !e.erg && e.s.sichtbar && e.k !== A.aktiv).map(e => `<span class="abs-leg leise"><span class="abs-leg-linie" style="background:${_strangFarbeAnzeige(e.s.farbe)}"></span><span>${escHtml(_strangName(e.s, e.k))} …</span></span>`).join('')
      + `<span class="abs-leg leise"><span>T<sub>2</sub>${t2Txt}</span></span>`;
  } else {
    const leiterTxt = sysMode === 'el' ? t('leg.leiter2') : t('leg.ts2');
    legende = `<span class="abs-leg"><span class="abs-leg-linie" style="background:${tempClr}"></span><span>${leiterTxt}${sysMode !== 'rfl' ? t2Txt : ''}</span></span>`
      + (FA.some(({ f }) => f.fdY) ? `<span class="abs-leg"><span class="abs-leg-linie fd"></span><span>${t('leg.fd2')}</span></span>` : '');
  }
  return `<div class="abs-profil-kopf"><p class="abs-h4">${t('abs.profil')}</p>${legende}${breit ? `<span class="abs-leg leise">${t('abs.profil.schieben')}</span>` : ''}</div>`
    + `<div class="abs-profil-scroll" tabindex="0" role="region" aria-label="${escHtml(t('abs.profil'))}">${svg}</div>`;
}

// ── Export des ganzen Abschnitts (IFC / 3D-DXF) ──
// Jedes Feld wird kurz geöffnet und wie das Einzelfeld modelliert; danach
// wird der vorherige Zustand vollständig wiederhergestellt.
function abschnittExport(art) {
  const erg = abschnittRechnen();
  if (!erg || erg.felder.some(f => f.fehler)) { meldung(t('abs.exp.unvollstaendig'), 'fehler'); return; }
  const S = _straengeSichern(), A = abschnitt, mehrere = S.length > 1;
  // Exportiert werden der aktive und alle sichtbaren Stränge (Teilabschnitt beachtet)
  const liste = [A.aktiv, ...S.map((_, k) => k).filter(k => k !== A.aktiv && S[k].sichtbar)];
  const mitKoord = liste.every(k => S[k].masten.every(x => Number.isFinite(x.e) && Number.isFinite(x.n)));
  if (mitKoord && !liste.every(k => S[k].masten.every(x => mastSok(x) !== null))) { meldung(t('exp.geo.sok.fehlt'), 'fehler'); return; }
  // Stationierung ohne Koordinaten: nach Mastname aus dem Strang mit den meisten Masten
  const basis = _basisMasten(), fl = feldLaengen(basis), stat = new Map();
  { let acc = 0; basis.forEach((m, i) => { stat.set(m.name, acc); if (i < fl.length) acc += fl[i].L > 0 ? fl[i].L : 0; }); }
  const GEMEINSAM = [t('exp.p.t2'), t('exp.p.hoehen'), t('exp.p.crs'), t('exp.p.quelle')];
  const FELDBEZOGEN = [t('exp.p.spannweite'), t('exp.p.mast.li'), t('exp.p.mast.re'), t('exp.p.km.li'), t('exp.p.km.re')];
  const sicherung = JSON.parse(JSON.stringify(getProjectState()));
  const warSichtbar = _abschnittSichtbar;
  _abschnittAusblenden();   // während des Durchlaufs nicht bei jeder Rechnung neu zeichnen
  const leiter = [], systeme = [];
  let gemeinsam = null, fehler = null, lmEig = null;
  let mVon = null, mBis = null;
  try {
    for (const k of liste) {
      if (k !== abschnitt.aktiv && !_strangAktivieren(k, { feld: false, offen: null })) continue;
      const s = abschnitt.straenge[k], name = _strangName(s, k);
      const e = abschnittRechnen();
      if (!e || e.felder.some(f => f.fehler)) { fehler = `${t('abs.exp.unvollstaendig')} (${name})`; break; }
      systeme.push(sysName(sysMode));
      let strangEig = null;
      for (const f of e.felder) {
        if (!_teilFeld(abschnitt.masten, f.i)) continue;
        mVon ??= f.a.name; mBis = f.b.name;
        abschnittFeldOeffnen(f.i, { ansicht: false, koord: mitKoord });
        const r = modell3d(art === 'ifc' ? 80 : 200);
        if (r.fehler) { fehler = r.fehler; break; }
        if (!strangEig) {
          const eig = r.modell.eigenschaften.filter(x => !FELDBEZOGEN.includes(x.name));
          if (!gemeinsam) gemeinsam = mehrere ? eig.filter(x => GEMEINSAM.includes(x.name)) : eig;
          strangEig = mehrere ? [{ name: t('exp.p.strang'), typ: 'text', wert: name }, { name: t('exp.p.rolle'), typ: 'text', wert: t('rolle.' + s.rolle) },
            ...eig.filter(x => !GEMEINSAM.includes(x.name))] : [];
          if (!e.starr && sysMode !== 'rfl' && e.Lm) (mehrere ? strangEig : (lmEig = lmEig || [])).push({ name: 'Lm', typ: 'laenge', wert: +e.Lm.toFixed(3) });
        }
        const feldTxt = `${f.i + 1} (${f.a.name}–${f.b.name})`;
        const praefix = `${mehrere ? name + ' · ' : ''}${t('abs.sp.feld')} ${feldTxt} · `;
        const station = stat.get(f.a.name) ?? 0;
        r.modell.leiter.forEach(l => {
          l.name = praefix + l.name;
          if (!mitKoord) l.punkte = l.punkte.map(p => [p[0] + station, p[1], p[2]]);
          l.eigenschaften = [...strangEig, { name: t('abs.sp.feld'), typ: 'text', wert: feldTxt },
                             { name: t('exp.p.spannweite'), typ: 'laenge', wert: +f.L.toFixed(3) }, ...(l.eigenschaften || [])];
          if (mehrere) { l.layerPraefix = s.kennung || `S${k + 1}`; l.gruppe = `${t('exp.p.strang')} ${name}`; }
          leiter.push(l);
        });
      }
      if (fehler) break;
    }
  } finally {
    setProjectState(sicherung);
    if (warSichtbar) abschnittAnsicht();
  }
  if (fehler) { meldung(fehler, 'fehler'); return; }
  if (!leiter.length) { meldung(t('abs.exp.unvollstaendig'), 'fehler'); return; }
  if (lmEig) gemeinsam.push(...lmEig);
  const titel = `${t('abs.titel')} ${mVon}–${mBis}`;
  const sysTxt = [...new Set(systeme)].join(' + ');
  const modell = { name: `${sysTxt} · ${titel}`, geo: mitKoord ? { epsg: 2056 } : null, leiter, eigenschaften: gemeinsam || [],
    dateiname: `durchhang_abschnitt_${mehrere ? 'straenge' : sysTxt}_${mVon}-${mBis}`.replace(/[^\w.\-]+/g, '_') };
  if (art === 'ifc') {
    let inhalt;
    try { inhalt = ifcErzeugen(modell, { programm: `Durchhang ${APP_VERSION}` }); }
    catch (e) { meldung(t('exp.fehler') + ': ' + e.message, 'fehler'); return; }
    _dateiHerunterladen(inhalt, modell.dateiname + '.ifc', 'application/x-step');
  } else {
    _dateiHerunterladen(dxfErzeugen(modellAlsDxfLinien(modell)), modell.dateiname + '.dxf', 'application/dxf');
  }
}

// ═══════════════════════════════════════════════════════════════
// 3D-MODELL für DXF und IFC
// Gleiche Geometrie wie die massstäbliche Zeichnung: Tragseil bei T₂
// (N-FL: kombiniertes System), Fahrdraht = Solllage + Tragseil-Verschiebung
// (N-FL) bzw. eigene Kettenlinie (R-FL), Hänger mit fester Länge.
// ═══════════════════════════════════════════════════════════════
const HAENGER_ABSTAND_MAX = 5;      // m — Hänger gleichmässig, höchstens alle 5 m
const HAENGER_RADIUS      = 0.0025; // m — Bronzeseil ca. Ø 5 mm

function _leiterRadius(matKey) {
  const m = matKey && typeof MATERIALS !== 'undefined' ? MATERIALS[matKey] : null;
  return m && m.AK ? Math.sqrt(m.AK / Math.PI) : 0.005;  // aus Querschnitt
}
function _materialName(matKey) {
  const m = matKey && typeof MATERIALS !== 'undefined' ? MATERIALS[matKey] : null;
  return m ? m.name : null;
}

// Liefert { modell, fehler } — modell im Format von export3d.js
function modell3d(stuetzpunkte = 100) {
  if (!calcState) return { fehler: t('exp.keine.rechnung') };
  const { c1, c2, L, h1, h2, T1, T2, sh, H_Fd, q_Fd, Lm, H_Ts } = calcState;
  const isNFL = sysMode === 'nfl', isEl = sysMode === 'el';
  const cDisp = (isNFL && calcState.c2_vem) ? calcState.c2_vem : c2;
  const catY  = (x, c) => kettenY(c, x);

  const achse = koordAchse();
  const sokL = getSokMumLeft(), sokR = getSokMumRight();
  const hasSok = sokL !== null || sokR !== null;
  if (koordAktiv && !achse) return { fehler: t('koord.fehlt') };
  if (achse && !hasSok) return { fehler: t('exp.geo.sok.fehlt') };
  const sL = sokL ?? sokR ?? 0, sR = sokR ?? sokL ?? 0;
  const absY = (x, y) => hasSok ? y + sL + (sR - sL) * x / L : y;
  const P = (x, y) => feldPunkt(achse, achse ? x * achse.L / L : x, absY(x, y));   // L auf mm gerundet → exakt auf die Aufhängepunkte

  // Fahrdraht (wie Zeichnung): Solllage + Tragseil-Verschiebung
  const matFdKey = document.getElementById('material-fd')?.value;
  const fdY = x => {
    const soll = (h1 - sh) + (h2 - h1) * x / L;
    const tsShift = isNFL ? catY(x, cDisp) - catY(x, c1)
                  : rflFahrdrahtVerschiebung(c2, calcState.c_fd_ref, x);
    return soll + tsShift;
  };
  const tsY = x => catY(x, cDisp);
  const kurve = fn => Array.from({ length: stuetzpunkte + 1 }, (_, i) => { const x = L * i / stuetzpunkte; return P(x, fn(x)); });

  const matTsKey = isEl ? document.getElementById('el-material-select')?.value
                        : document.getElementById('material-ts')?.value;
  const leiter = [];
  leiter.push({
    art: isEl ? 'leiter' : 'tragseil',
    name: `${isEl ? t('sys.el') : t('cm.ts')} (T₂ ${T2} °C)`,
    material: _materialName(matTsKey), radius: _leiterRadius(matTsKey),
    punkte: kurve(tsY),
    eigenschaften: [
      { name: t('exp.p.material'), typ: 'text', wert: _materialName(matTsKey) || '—' },
      { name: t('exp.p.zugkraft'), typ: 'kraft', wert: Math.round(c2.H) },
      { name: t('exp.p.durchhang'), typ: 'laenge', wert: +cDisp.sag.toFixed(3) },
    ],
  });
  if (!isEl) {
    leiter.push({
      art: 'fahrdraht', name: `${t('cm.fd')} (T₂ ${T2} °C)`,
      material: _materialName(matFdKey), radius: _leiterRadius(matFdKey),
      punkte: kurve(fdY),
      eigenschaften: [
        { name: t('exp.p.material'), typ: 'text', wert: _materialName(matFdKey) || '—' },
        { name: t('exp.p.zugkraft'), typ: 'kraft', wert: Math.round(H_Fd) },   // nachgespannt / konstant
      ],
    });
    const n = Math.max(2, Math.ceil(L / HAENGER_ABSTAND_MAX));
    for (let i = 1; i < n; i++) {
      const x = L * i / n, yu = fdY(x), yo = tsY(x);
      if (!(yo - yu > 0.01)) continue;   // Tragseil liegt auf dem Fahrdraht: kein Hänger
      leiter.push({
        art: 'haenger', name: `${t('exp.haenger')} ${i}`, radius: HAENGER_RADIUS,
        punkte: [P(x, yu), P(x, yo)],
        eigenschaften: [
          { name: t('exp.p.position'), typ: 'laenge', wert: +x.toFixed(3) },
          { name: t('exp.p.laenge'), typ: 'laenge', wert: +(yo - yu).toFixed(3) },
        ],
      });
    }
  }

  const txt = id => (document.getElementById(id)?.value || '').trim();
  const eig = [
    { name: t('exp.p.system'), typ: 'text', wert: sysName(sysMode) },
    { name: t('exp.p.spannweite'), typ: 'laenge', wert: +L.toFixed(3) },
    { name: t('exp.p.t1'), typ: 'temperatur', wert: T1 },
    { name: t('exp.p.t2'), typ: 'temperatur', wert: T2 },
    { name: t('exp.p.hoehen'), typ: 'text', wert: hasSok ? t('exp.p.hoehen.mum') : t('exp.p.hoehen.sok') },
  ];
  if (isNFL || isEl) eig.push({ name: t('par.berechnungsart'), typ: 'text',
    wert: elBerechnungsart === 'starr' ? t('par.ba.starr') : t('par.ba.ausg') });
  if (!isEl) eig.push({ name: t('par.sh'), typ: 'laenge', wert: sh });
  [['mast-num-left', 'exp.p.mast.li'], ['mast-num-right', 'exp.p.mast.re'],
   ['mast-km-left', 'exp.p.km.li'], ['mast-km-right', 'exp.p.km.re']]
    .forEach(([id, k]) => { if (txt(id)) eig.push({ name: t(k), typ: 'text', wert: txt(id) }); });
  if (achse) eig.push({ name: t('exp.p.crs'), typ: 'text', wert: 'LV95 (EPSG:2056) / LN02' });
  eig.push({ name: t('exp.p.quelle'), typ: 'text', wert: `Durchhang ${APP_VERSION}` });

  const mastL = txt('mast-num-left'), mastR = txt('mast-num-right');
  const feld = mastL || mastR ? `${mastL || '?'} – ${mastR || '?'}` : `L = ${fN(L, 2)} m`;
  const dateiname = `durchhang_${sysName(sysMode)}_${(mastL || mastR) ? `${mastL}-${mastR}` : fN(L, 1) + 'm'}`
    .replace(/[^\w.\-]+/g, '_');
  return { achse, hasSok, L, absY, catY, c1, cDisp,
           modell: { name: `${sysName(sysMode)} · ${feld}`, dateiname, geo: achse ? { epsg: 2056 } : null, leiter, eigenschaften: eig } };
}

function _dateiHerunterladen(inhalt, name, typ) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── 3D-DXF (AC1009/R12, Einheit m) ──
// Ohne Koordinaten: x längs Feld, y = 0, z = Höhe. Mit Koordinaten: E, N, H (LV95/LN02).
function exportDxf() {
  const r = modell3d(200);
  if (r.fehler) { meldung(r.fehler, 'fehler'); return; }
  const { achse, hasSok, L, absY, catY, c1, cDisp } = r;
  const P = (x, y) => feldPunkt(achse, achse ? x * achse.L / L : x, absY(x, y));   // L auf mm gerundet → exakt auf die Aufhängepunkte
  const linien = modellAlsDxfLinien(r.modell);

  // Zusätzlich wie bisher: Tragseil bei T₁, SOK-Linie, Messpunkte
  const N = 200;
  linien.push({ layer: 'TRAGSEIL_T1',
    punkte: Array.from({ length: N + 1 }, (_, i) => { const x = L * i / N; return P(x, catY(x, c1)); }) });
  const { h1, h2 } = calcState;
  if (!achse) {   // Masten nur ohne Koordinaten: mit Koordinaten ist der Mast nicht am Aufhängepunkt
    linien.push({ layer: 'MAST', punkte: [P(0, 0), P(0, h1)] });
    linien.push({ layer: 'MAST', punkte: [P(L, 0), P(L, h2)] });
  }
  if (hasSok) linien.push({ layer: 'SOK', punkte: [P(0, 0), P(L, 0)] });
  // hf_min / hf_max als Linien über SOK, wenn in Zeichnung oder Diagramm eingeblendet
  const hfZ = (Ansicht.zeichnungHf || diagrammHf) ? hfGrenzenM() : null;
  if (hfZ && !hfZ.fehler) {
    linien.push({ layer: 'HF_MIN', punkte: [P(0, hfZ.min), P(L, hfZ.min)] });
    linien.push({ layer: 'HF_MAX', punkte: [P(0, hfZ.max), P(L, hfZ.max)] });
  }

  const hw = Math.min(1.0, L * 0.03);
  _probeXs().filter(xv => xv !== null)
    .forEach(xv => {
      const y = catY(xv, cDisp);
      linien.push({ layer: 'MESSPUNKT', punkte: [P(xv - hw, y), P(xv + hw, y)] });
      linien.push({ layer: 'MESSPUNKT', punkte: [P(xv, y - hw), P(xv, y + hw)] });
    });
  // Hindernisse oberhalb: Unterkante (verbunden) bzw. Einzelpunkte, Mindestabstand darunter
  _nachweis.forEach(({ h, ohneSok, unten }) => {
    if (ohneSok) return;                                        // Höhen m ü. M. ohne SOK nicht einzuordnen
    const mind = minClearance === null ? null : (unten ? -minClearance : minClearance);   // Richtung zum Leiter
    const rel = (x, hv) => hv - absY(x, 0);                     // Hindernis absolut → über SOK
    const Pk = hindernisPunkte(h.punkte).filter(p => h.verbinden || (p.x >= 0 && p.x <= L));
    const linie = (pts, versatz = 0) => pts.map(p => P(p.x, rel(p.x, p.h) - versatz));
    if (h.verbinden && Pk.length > 1) {
      linien.push({ layer: 'HINDERNIS', punkte: linie(Pk) });
      if (mind !== null) linien.push({ layer: 'MINDESTABSTAND', punkte: linie(Pk, mind) });
    } else Pk.forEach(p => {
      linien.push({ layer: 'HINDERNIS', punkte: [P(p.x - hw, rel(p.x, p.h)), P(p.x + hw, rel(p.x, p.h))] });
      if (mind !== null) linien.push({ layer: 'MINDESTABSTAND', punkte: [P(p.x - hw, rel(p.x, p.h) - mind), P(p.x + hw, rel(p.x, p.h) - mind)] });
    });
  });

  _dateiHerunterladen(dxfErzeugen(linien), r.modell.dateiname + '.dxf', 'application/dxf');
}

// ── IFC4 (BIM) ──
function exportIfc() {
  const r = modell3d(80);
  if (r.fehler) { meldung(r.fehler, 'fehler'); return; }
  let inhalt;
  try { inhalt = ifcErzeugen(r.modell, { programm: `Durchhang ${APP_VERSION}` }); }
  catch (e) { meldung(t('exp.fehler') + ': ' + e.message, 'fehler'); return; }
  _dateiHerunterladen(inhalt, r.modell.dateiname + '.ifc', 'application/x-step');
}

function pdfExport() {
  if (!calcState) return;
  const canvasImg = diagrammBildHell();
  const _pid2 = Projekte.aktuelleProjektId;
  const projName = _pid2 ? (getProjMeta().find(m => m.id === _pid2)?.name || '') : '';
  const bodyContent = buildPdfSectionHtml(projName, canvasImg);
  if (!bodyContent) return;

  _pdfDrucken(t('pdf.title'), bodyContent);
}


// Stylesheet der Druckfenster im hellen App-Design (Schrift Inter, Akzentblau, Karten).
// Die Schrift wird mit absoluter Adresse geladen — das Druckfenster hat keine eigene Adresse.
function _pdfSchriften() {
  const schrift = n => new URL('fonts/' + n, location.href).href;
  return `@font-face { font-family: 'Inter'; font-style: normal; font-weight: 100 900; font-display: block;
  src: url(${schrift('inter-latin-wght-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Inter'; font-style: normal; font-weight: 100 900; font-display: block;
  src: url(${schrift('inter-latin-ext-wght-normal.woff2')}) format('woff2');
  unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF; }`;
}
function _pdfStil() {
  return `${_pdfSchriften()}
@page { size: A4 portrait; margin: 14mm 14mm 16mm; }
:root { --akz: #4a5cb8; --akz-dk: #3d4ea3; --akz-s: rgba(74,92,184,.08); --text: #111218; --text2: #3a3c48;
  --muted: #5f616c; --tert: #62656f; --rand: #dde0e6; --s2: #f7f8fa; --s3: #eef0f4;
  --ok: #1f7a3c; --fail: #a02020; --warn: #8a6d10; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Inter, 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: var(--text); line-height: 1.55;
  font-feature-settings: 'tnum' 1; }
.hdr { display: flex; align-items: center; gap: 11px; background: #fff; border: 1px solid var(--rand);
  border-top: 3px solid var(--akz); border-radius: 10px; padding: 10px 14px; margin-bottom: 12px; }
.hdr .logo { flex: 0 0 auto; }
.hdr h1 { font-size: 13pt; font-weight: 700; color: var(--text); letter-spacing: -.01em; line-height: 1.25; }
.hdr p { font-size: 7.8pt; color: var(--muted); margin-top: 2px; }
h2 { font-size: 9.5pt; font-weight: 700; color: var(--text); border-left: 3px solid var(--akz);
  padding-left: 8px; margin: 14px 0 6px; page-break-after: avoid; }
h2.warm { border-left-color: var(--akz); }
h2.green { border-left-color: var(--ok); }
.step { background: #fff; border: 1px solid var(--rand); border-radius: 10px;
  padding: 8px 12px; margin-bottom: 7px; page-break-inside: avoid; }
em   { font-style: italic; color: var(--akz-dk); }
em.w { color: var(--warn); }
em.g { color: var(--ok); }
.sub { margin-left: 12px; color: var(--text2); font-size: 8.6pt; margin-top: 3px; }
.sub2 { margin-left: 12px; color: var(--muted); font-size: 8pt; margin-top: 1px; }
strong.r { color: var(--akz); font-weight: 700; }
strong.w { color: var(--warn); font-weight: 700; }
strong.g { color: var(--ok); font-weight: 700; }
table.inp { border-collapse: collapse; width: 100%; }
table.inp td { padding: 3px 7px; border-bottom: 1px solid var(--s3); font-size: 8.8pt; }
table.inp tr:last-child td { border-bottom: none; }
table.inp td:first-child { color: var(--muted); width: 42%; }
table.cmp { border-collapse: collapse; width: 100%; margin-top: 5px; font-size: 8.8pt; }
table.cmp th { background: var(--s3); color: var(--text2); padding: 5px 8px; text-align: left; font-size: 8.2pt;
  font-weight: 600; border-bottom: 1px solid var(--rand); }
table.cmp th.warm { background: var(--akz-s); color: var(--akz-dk); }
table.cmp td { padding: 4px 8px; border-bottom: 1px solid var(--s3); }
table.cmp tr:nth-child(even) td { background: var(--s2); }
.pos { color: var(--ok); font-weight: 700; }
.neg { color: var(--fail); font-weight: 700; }
.diagram { text-align: center; margin-top: 4px; page-break-inside: avoid; }
.diagram img { width: 100%; border: 1px solid var(--rand); border-radius: 10px; display: block; }
.legende { display: flex; flex-wrap: wrap; justify-content: center; gap: 3px 14px; margin-top: 6px;
  font-size: 7.8pt; color: var(--text2); }
.legende span { display: inline-flex; align-items: center; white-space: nowrap; }
.legende i { display: inline-block; width: 20px; margin-right: 5px; }
footer { margin-top: 16px; font-size: 7.2pt; color: var(--tert);
  border-top: 1px solid var(--rand); padding-top: 5px; text-align: right; }`;
}
// App-Logo für den Kopf der Druckfenster (Farben fest, hell)
function _pdfLogo(gr = 26) {
  return `<svg class="logo" width="${gr}" height="${gr}" viewBox="14 20 72 64" fill="none" stroke-linecap="round" aria-hidden="true">
    <line x1="20" y1="26" x2="20" y2="78" stroke="#9497a1" stroke-width="4.2"/><line x1="80" y1="26" x2="80" y2="78" stroke="#9497a1" stroke-width="4.2"/>
    <g stroke="#9497a1" stroke-width="1.6"><line x1="35" y1="40.6" x2="35" y2="56"/><line x1="50" y1="44.5" x2="50" y2="56"/><line x1="65" y1="40.6" x2="65" y2="56"/></g>
    <line x1="20" y1="56" x2="80" y2="56" stroke="#5f616c" stroke-width="3"/><path d="M20 30 Q50 59 80 30" stroke="#4a5cb8" stroke-width="6"/></svg>`;
}
// Druckfenster öffnen und drucken, sobald die Schrift geladen ist
function _druckfenster(html) {
  const win = window.open('', '_blank');
  if (!win) { meldung(t('msg.popup.blockiert'), 'warnung'); return; }
  win.document.write(html);
  win.document.close();
  const drucken = () => { win.focus(); win.print(); };
  win.onload = () => { const f = win.document.fonts; f && f.ready ? f.ready.then(drucken, drucken) : drucken(); };
}

// Druckfenster für PDF-Protokolle (Berechnung, Fahrdrahthöhe)
function _pdfDrucken(titel, bodyContent) {
  _druckfenster(`<!DOCTYPE html><html lang="${currentLang}"><head><meta charset="UTF-8">
<title>${titel}</title>
<style>${_pdfStil()}</style></head><body>
${bodyContent}
</body></html>`);
}


// ═══════════════════════════════════════════════════════════════
// FAHRDRAHTHÖHE hf_min / hf_max — eigene Ansicht (Rechnung: fahrdrahthoehe.js)
// ═══════════════════════════════════════════════════════════════
// Eingaben wie SBB-Excel (Blätter hfmin_v11_D / hfmax_v11_D). Vorgaben = in
// der Excel gespeicherter Fall; Temperaturen: hf_min −5 °C mit Eis, hf_max −20 °C.
const HF_KOMBINATIONEN = { stcu50_cu107: 'StCu 50 + Cu 107', stcu92_cu107: 'StCu 92 + Cu 107', stcu92_cu150: 'StCu 92 + Cu 150' };
const HF_VORGABE = {
  typ: 'nfl', c: 30, v: 141, bue: false,
  kombi: 'stcu50_cu107', Lm: 30, H_ub: 1700, T_montage: 10, H_Fd: 8500,
  un: 15, schotter: false, ebv: 2, f: 0, H: 0, Tmin: -5, zlMin: 7, cUebr: 0, p11: false, p12: false,
  lrp: false, Tmax: -20, zlMax: 0,
};
let hfEingabe = null;          // null: beim ersten Öffnen aus der Durchhang-Berechnung übernehmen

function openHf() {
  if (!entwicklerModus) return;
  _hfStart();
  document.getElementById('hf-modal').classList.add('open');
  renderHf();
}
function closeHf() { document.getElementById('hf-modal').classList.remove('open'); }

// Spannweite c aus L: nächster Tabellenwert nach oben (sichere Seite); > 60 m nicht in der Tabelle
function _hfCausL(L) {
  const Lr = Math.round(L * 1000) / 1000;
  const c = [...HF_SPANNWEITEN].sort((a, b) => a - b).find(x => x >= Lr - 1e-6);
  return c === undefined ? Math.round(Lr) : c;
}
// FL-Typ, Kombination, L_m, Ts unbelastet bei T₁ (Reglagetabelle), T₁ und H_Fd kommen
// immer aus der Durchhang-Berechnung — wie dort, nicht separat eingebbar.
// Spannweite c folgt L, solange sie nicht bewusst anders gewählt wurde.
function _hfSync() {
  const e = hfEingabe, c = calcState;
  if (!e || !c || sysMode === 'el') return;
  e.typ = sysMode;
  if (!e.cManuell) e.c = _hfCausL(c.L);
  if (sysMode === 'nfl') {
    const key = document.getElementById('material-ts').value + '_' + document.getElementById('material-fd').value;
    e.kombi = HF_KOMBINATIONEN[key] ? key : null;
    e.kombiName = `${getMaterialNameTs()} + ${getMaterialNameFd()}`;
    if (Number.isFinite(c.Lm)) e.Lm = Math.round(c.Lm * 100) / 100;
    if (Number.isFinite(c.H_Ts_ub)) e.H_ub = c.H_Ts_ub;
    if (Number.isFinite(c.T1)) e.T_montage = c.T1;
    if (Number.isFinite(c.H_Fd)) e.H_Fd = c.H_Fd;
  }
}
function _hfStart() { if (!hfEingabe) hfEingabe = { ...HF_VORGABE }; _hfSync(); }

// ── Rechnen ──
function hfRechnen() {
  _hfSync();
  const e = hfEingabe;
  let nfl = null;
  const combo = FL_COMBINATIONS[e.kombi];
  if (e.typ === 'nfl' && combo && e.Lm > 0 && e.H_ub > 0 && Number.isFinite(e.T_montage) && e.H_Fd > 0) {
    nfl = hfNflZugkraefte({ nflBezugszustand, nflZugkraftBei }, { flCombo: combo, Lm: e.Lm, H_ub: e.H_ub,
      T_montage: e.T_montage, H_Fd: e.H_Fd, Tmin: e.Tmin, zlMin: e.zlMin, Tmax: e.Tmax, zlMax: e.zlMax });
    if (![nfl.H_t0, nfl.H_Tmin, nfl.H_Tmax].every(Number.isFinite)) nfl = null;
  }
  const r = { ...hfBerechnen({ ...e, nfl }), nfl };
  if (e.typ === 'nfl' && !HF_KOMBINATIONEN[e.kombi]) r.fehler = ['hf.err.kombi', ...r.fehler.filter(k => k !== 'hf.err.nfl')];
  return r;
}

// ── Eingaben ──
const _hfZahl = v => { const n = parseFloat(String(v).replace(',', '.').replace('−', '-')); return Number.isFinite(n) ? n : null; };
function hfWert(k, roh) {
  const e = hfEingabe;
  if (['bue', 'schotter', 'p11', 'p12'].includes(k)) e[k] = !!roh;
  else if (k === 'lrp') e[k] = roh === 'J';
  else e[k] = _hfZahl(roh);
  // Abhängigkeiten wie Excel: Zusatzlast nur bei −5 °C; Fallprüfung P1.1–P1.3
  if (k === 'Tmin' && e.Tmin !== HF_EIS_TEMPERATUR) e.zlMin = 0;
  if (k === 'Tmax' && e.Tmax !== HF_EIS_TEMPERATUR) e.zlMax = 0;
  if (k === 'p11' && e.p11) { e.p12 = false; e.cUebr = 0; }
  if (k === 'p12' && !e.p12) e.cUebr = 0;
  if (k === 'c') { e.cManuell = !!calcState && e.c !== _hfCausL(calcState.L); renderHf(); return; }
  hfAktualisieren();
}

const _HF_SYM = {
  GfA: 'GfA', k: 'k', be: 'b<sub>e</sub>', f: 'f', H: 'H',
  fg: 'f<sub>g</sub>', thu: 't<sub>hu</sub>', fud: 'f<sub>ud</sub>', fuv: 'f<sub>uv</sub>',
  fFDmaxZL: 'f<sub>FD,max,ZL</sub>', fFDmax40: 'f<sub>FD,max</sub>',
  tho: 't<sub>ho</sub>', fudo: 'f<sub>udo</sub>', fh: 'f<sub>h</sub>', fFDmin: 'f<sub>FD,min</sub>',
};

function _hfFeld(label, inhalt, hinweis = '') {
  return `<label class="hf-feld"><span class="hf-lbl">${label}</span>${inhalt}${hinweis ? `<span class="hf-hw">${hinweis}</span>` : ''}</label>`;
}
function _hfSelect(k, optionen, wert) {
  return `<select id="hf-${k}" class="abs-inp" onchange="hfWert('${k}',this.value)">${optionen.map(([v, txt]) =>
    `<option value="${escHtml(v)}"${String(v) === String(wert) ? ' selected' : ''}>${escHtml(txt)}</option>`).join('')}</select>`;
}
function _hfZahlFeld(k, wert, einheit, breite = '6rem') {
  return `<span class="hf-zahl"><input id="hf-${k}" class="abs-inp zahl" inputmode="decimal" style="width:${breite}" value="${escHtml(wert ?? '')}"
    onchange="hfWert('${k}',this.value)">${einheit ? `<span class="hf-einh">${einheit}</span>` : ''}</span>`;
}
function _hfHaken(k, wert, text) {
  return `<label class="hf-haken"><input type="checkbox" id="hf-${k}"${wert ? ' checked' : ''} onchange="hfWert('${k}',this.checked)"> <span>${text}</span></label>`;
}
const _hfTemp = T => (T > 0 ? '+' : T < 0 ? '−' : '') + Math.abs(T) + ' °C';

// Zusammenfassung der festen Werte aus der Durchhang-Berechnung
function _hfFestText() {
  const e = hfEingabe, c = calcState;
  if (sysMode === 'el' || !c) return escHtml(t('hf.msg.el'));
  const teile = [sysName(sysMode), `L = ${fN(c.L, 2)} m`];
  if (sysMode === 'nfl') {
    teile.push(escHtml(e.kombi ? HF_KOMBINATIONEN[e.kombi] : (e.kombiName || '—')));
    teile.push(`L<sub>m</sub> = ${fN(e.Lm, 2)} m`,
      `${t('hf.hub')} ${fN(e.H_ub, 0)} N ${t('hf.bei')} T<sub>1</sub> = ${_hfTemp(e.T_montage)}`,
      `H<sub>Fd</sub> ${fN(e.H_Fd, 0)} N`);
  }
  const warn = sysMode === 'nfl' && !e.kombi ? ` <span class="hf-fest-warn">${t('hf.err.kombi')}</span>` : '';
  return `<span class="hf-fest-lbl">${t('hf.fest')}</span> ${teile.join(' · ')}${warn}
    <button type="button" class="hf-pz-link" onclick="closeHf()">${t('hf.fest.link')}</button>`;
}
// Hinweis unter der Spannweite c: aus L oder bewusst anders gewählt
function _hfCHinweis() {
  const e = hfEingabe, c = calcState;
  if (!c) return t('hf.c.hw');
  const L = fN(c.L, 2);
  if (c.L > 60) return t('hf.msg.c.gross');
  return e.cManuell
    ? `${t('hf.c.frei').replace('{L}', L)} · <button type="button" class="hf-pz-link" onclick="hfEingabe.cManuell=false;renderHf()">${t('hf.c.zurueck')}</button>`
    : `${t('hf.c.ausL').replace('{L}', L)}. ${t('hf.c.hw')}`;
}

function renderHf() {
  const box = document.getElementById('hf-inhalt');
  if (!box || !hfEingabe) return;
  _hfSync();
  const e = hfEingabe;
  const temps = HF_TEMPERATUREN.map(T => [T, _hfTemp(T)]);
  const zls = HF_ZUSATZLASTEN.map(z => [z, z + ' N/m']);
  box.innerHTML = `
  <p class="abs-hinweis" style="margin-top:0">${t('hf.einleitung')}</p>
  <div class="abs-leiste">
    <button class="abs-knopf" onclick="hfZuruecksetzen()">${t('hf.vorgabe')}</button>
    <span class="abs-trenner"></span>
    <button class="abs-knopf" onclick="hfPdf()">${t('hf.pdf')}</button>
  </div>

  <section class="hf-gruppe" aria-labelledby="hf-h-fl">
    <h3 class="abs-h4" id="hf-h-fl">${t('hf.g.fl')}</h3>
    <p class="hf-fest" id="hf-fest">${_hfFestText()}</p>
    <div class="hf-raster">
      ${_hfFeld(t('hf.c'), _hfSelect('c', HF_SPANNWEITEN.map(c => [c, c + ' m']), e.c), _hfCHinweis())}
      ${_hfFeld(t('hf.v'), _hfZahlFeld('v', e.v, 'km/h'))}
      <div class="hf-feld">${_hfHaken('bue', e.bue, t('hf.bue'))}</div>
    </div>
    ${e.typ === 'nfl' ? `
    <p class="abs-hinweis" id="hf-nfl-zug"></p>` : `
    <p class="abs-hinweis">${t('hf.rfl.zug')}</p>`}
  </section>

  <div class="hf-zwei">
    <section class="hf-gruppe" aria-labelledby="hf-h-min">
      <h3 class="abs-h4" id="hf-h-min">${t('hf.g.min')}</h3>
      <div class="hf-raster">
        ${_hfFeld(t('hf.un'), _hfSelect('un', [[15, '15 kV'], [25, '25 kV']], e.un))}
        ${_hfFeld(t('hf.ebv'), _hfSelect('ebv', [1, 2, 3, 4].map(n => [n, 'EBV ' + n]), e.ebv))}
        ${_hfFeld(t('hf.f'), _hfZahlFeld('f', e.f, 'mm', '4.5rem'))}
        ${_hfFeld(t('hf.h'), _hfZahlFeld('H', e.H, 'mm', '4.5rem'))}
        ${_hfFeld(t('hf.tmin'), _hfSelect('Tmin', temps, e.Tmin))}
        ${_hfFeld(t('hf.zl'), _hfSelect('zlMin', zls, e.zlMin), t('hf.zl.hw'))}
      </div>
      <div class="hf-raster"><div class="hf-feld">${_hfHaken('schotter', e.schotter, t('hf.schotter'))}</div></div>
      ${e.typ === 'rfl' ? `
      <p class="abs-hinweis" style="margin-bottom:.3rem">${t('hf.p.titel')}</p>
      <div class="hf-raster">
        <div class="hf-feld">${_hfHaken('p11', e.p11, 'P1.1 / P1.3')}</div>
        <div class="hf-feld">${_hfHaken('p12', e.p12, 'P1.2')}</div>
        ${_hfFeld(t('hf.cuebr'), _hfZahlFeld('cUebr', e.cUebr, 'm', '4.5rem'))}
      </div>` : ''}
    </section>
    <section class="hf-gruppe" aria-labelledby="hf-h-max">
      <h3 class="abs-h4" id="hf-h-max">${t('hf.g.max')}</h3>
      <div class="hf-raster">
        ${_hfFeld('LRP', _hfSelect('lrp', [['J', t('hf.lrp.j')], ['N', t('hf.lrp.n')]], e.lrp ? 'J' : 'N'))}
        ${_hfFeld(t('hf.tmax'), _hfSelect('Tmax', temps, e.Tmax))}
        ${_hfFeld(t('hf.zl'), _hfSelect('zlMax', zls, e.zlMax), t('hf.zl.hw'))}
      </div>
    </section>
  </div>
  <p class="abs-hinweis">${t('hf.t.regel')}</p>
  <div id="hf-erg" aria-live="polite"></div>`;
  hfAktualisieren();
}

function hfZuruecksetzen() {
  // Nur die hf-eigenen Eingaben; die festen Werte kommen wieder aus der Durchhang-Berechnung
  hfEingabe = { ...HF_VORGABE };
  renderHf();
}

function _hfTabelle(teil, art, e) {
  const zeile = (sym, txt, wert, klasse = '') =>
    `<tr class="${klasse}"><td class="hf-sym">${sym}</td><td>${txt}</td><td class="hf-w">${wert === null ? '' : fN(wert, 1)}</td></tr>`;
  const Z = art === 'min' ? 'Z<sub>hf,min</sub>' : 'Z<sub>hf,max</sub>';
  const hf = art === 'min' ? 'hf<sub>min</sub>' : 'hf<sub>max</sub>';
  let rows = '';
  if (teil.bue) rows += zeile('', t('hf.bue.basis'), teil.absolut, 'hf-zw');
  else if (art === 'min') {
    rows += teil.basis.map(z => zeile(_HF_SYM[z.sym], t(z.schluessel), z.wert)).join('');
    rows += zeile(hf + '<sub>,abs</sub>', t('hf.abs'), teil.absolut, 'hf-zw');
  } else rows += zeile(hf + '<sub>,abs</sub>', t(e.lrp ? 'hf.lrp.j' : 'hf.lrp.n'), teil.absolut, 'hf-zw');
  rows += teil.zeilen.map(z => zeile(_HF_SYM[z.sym], t(z.schluessel), z.wert)).join('');
  rows += zeile(Z, t(art === 'min' ? 'hf.z.summe.min' : 'hf.z.summe.max'), teil.summe, 'hf-zw');
  const formel = teil.bue ? `${hf} = 5510 + ${Z}` : art === 'min' ? `${hf} = GfA + k + b<sub>e</sub> + f + H + ${Z}` : `${hf} = ${hf}<sub>,abs</sub> − ${Z}`;
  return `<div class="hf-karte">
    <div class="hf-titel">${t(art === 'min' ? 'hf.erg.min' : 'hf.erg.max')}</div>
    <div class="hf-wert" id="hf-wert-${art}">${fN(teil.wert, 0)} mm <span>(${(teil.wert / 1000).toFixed(3)} m)</span></div>
    <div class="hf-formel">${formel}</div>
    <div class="abs-scroll"><table class="abs-tab hf-tab">
      <thead><tr><th scope="col">${t('hf.sp.sym')}</th><th scope="col">${t('hf.sp.txt')}</th><th scope="col" class="hf-w">[mm]</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
  </div>`;
}

function hfAktualisieren() {
  const e = hfEingabe, erg = document.getElementById('hf-erg');
  if (!e || !erg) return;
  // Zusatzlast nur bei −5 °C; Fallprüfung nur in sinnvoller Kombination
  const sperre = (id, aus) => { const el = document.getElementById(id); if (el) el.disabled = aus; };
  sperre('hf-zlMin', e.Tmin !== HF_EIS_TEMPERATUR);
  sperre('hf-zlMax', e.Tmax !== HF_EIS_TEMPERATUR);
  sperre('hf-p12', e.p11);
  sperre('hf-cUebr', e.p11 || !e.p12);
  for (const k of ['zlMin', 'zlMax', 'cUebr', 'p12']) {
    const el = document.getElementById('hf-' + k);
    if (!el) continue;
    if (el.type === 'checkbox') el.checked = !!e[k]; else el.value = e[k] ?? '';
  }
  if (sysMode === 'el') { erg.innerHTML = `<div class="hf-fehler" role="alert">${escHtml(t('hf.msg.el'))}</div>`; return; }
  const r = hfRechnen();
  const zug = document.getElementById('hf-nfl-zug');
  if (zug) zug.innerHTML = r.nfl ? t('hf.nfl.zug')
      .replace('{h0}', fN(r.nfl.H_t0, 0))
      .replace('{hmin}', fN(r.nfl.H_Tmin, 0)).replace('{tmin}', _hfTemp(e.Tmin) + (e.zlMin ? `, ${e.zlMin} N/m` : ''))
      .replace('{hmax}', fN(r.nfl.H_Tmax, 0)).replace('{tmax}', _hfTemp(e.Tmax) + (e.zlMax ? `, ${e.zlMax} N/m` : ''))
    : '';
  const liste = (keys, klasse) => keys.length ? `<ul class="hf-liste ${klasse}">${keys.map(k => `<li>${t(k)}</li>`).join('')}</ul>` : '';
  if (r.fehler.length) {
    erg.innerHTML = `<div class="hf-fehler" role="alert">${liste(r.fehler, '')}</div>${liste(r.hinweise, 'hf-hinweise')}`;
    return;
  }
  erg.innerHTML = `<div class="hf-zwei">${_hfTabelle(r.min, 'min', e)}${_hfTabelle(r.max, 'max', e)}</div>
    ${liste(r.hinweise, 'hf-hinweise')}
    ${_hfGrafiken(r, e, HF_FARBEN_BILDSCHIRM)}
    <p class="abs-hinweis">${t('hf.quelle')}</p>`;
}

// ── Grafiken: Höhenleiter und hf über die Spannweite (Bildschirm: Themenfarben, PDF: fest hell) ──
const HF_FARBEN_BILDSCHIRM = {
  text: 'var(--text2)', leise: 'var(--muted)', raster: 'var(--border)', basis: 'var(--s3)', basisRand: 'var(--border2)',
  unten: 'var(--primary)', oben: 'var(--warn)', ok: 'var(--ok)', okFlaeche: 'var(--ok-s)', nok: 'var(--fail)', hinter: 'transparent',
};
const HF_FARBEN_PDF = {
  text: '#3a3c48', leise: '#5f616c', raster: '#dde0e6', basis: '#eef0f4', basisRand: '#c2c7d1',
  unten: '#4a5cb8', oben: '#8a6d10', ok: '#2f9e54', okFlaeche: 'rgba(47,158,84,.10)', nok: '#a02020', hinter: '#ffffff',
};
const _hfM = mm => (mm / 1000).toFixed(3);
const _hfMm = v => fN(v, Math.abs(v - Math.round(v)) < 0.05 ? 0 : 1);
// Symbol als SVG-Text (Index als tspan) bzw. als Klartext für <title>
const _hfSvgSym = sym => (_HF_SYM[sym] || sym).replace(/<sub>(.*?)<\/sub>/g, '<tspan font-size="7" dy="2">$1</tspan>');
const _hfTitel = z => `<title>${escHtml((_HF_SYM[z.sym] || z.sym).replace(/<\/?sub>/g, ''))} = ${_hfMm(z.wert)} mm – ${escHtml(t(z.schluessel).replace(/<[^>]+>/g, ''))}</title>`;

// Höhenleiter: links von unten die Anteile bis hf_min, rechts von oben die
// Zuschläge bis hf_max, dazwischen der zulässige Bereich der Fahrdrahthöhe.
function _hfSvgLeiter(r, e, F) {
  const W = 460, H = 394, oben = 22, unten = 44, xa = 58;
  const min = r.min, max = r.max;
  const basisMin = min.bue ? [{ sym: 'BÜ', wert: min.absolut }] : min.basis.filter(z => z.wert !== 0);
  const y0 = Math.min(basisMin[0].wert, min.wert, max.wert) - 180;
  const y1 = Math.max(max.absolut, min.wert, max.wert) + 80;
  const sy = mm => oben + (H - oben - unten) * (1 - (mm - y0) / (y1 - y0));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="hf-svg" role="img" aria-label="${escHtml(t('hf.gr.leiter'))}" style="background:${F.hinter};width:100%;height:auto;display:block" font-family="Inter, Arial, sans-serif">`;
  // Raster alle 100 mm, Beschriftung alle 200 mm
  for (let v = Math.ceil(y0 / 100) * 100; v <= y1; v += 100) {
    s += `<line x1="${xa}" x2="${W - 10}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" stroke="${F.raster}" stroke-width="${v % 200 ? .5 : 1}"/>`;
    if (v % 200 === 0) s += `<text x="${xa - 6}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${F.leise}">${_hfM(v)}</text>`;
  }
  s += `<text x="12" y="${H / 2}" transform="rotate(-90 12 ${H / 2})" text-anchor="middle" font-size="10" fill="${F.leise}">${escHtml(t('hf.gr.achse'))}</text>`;
  // Spalte hf_min (links)
  const xl = xa + 14, bl = 96;
  // Streifen mit Kürzel (wo Platz ist) und Tooltip; alle Werte zusätzlich in der Zeile unter der Grafik
  const segment = (x, b, von, bis, farbe, deckkraft, z, gestrichelt = false) => {
    const ya = sy(Math.max(von, bis)), yb = sy(Math.min(von, bis)), h = yb - ya;
    let t_ = `<g><rect x="${x}" y="${ya.toFixed(1)}" width="${b}" height="${Math.max(h, .6).toFixed(1)}" fill="${farbe}" fill-opacity="${deckkraft}" stroke="${farbe}" stroke-width=".8"${gestrichelt ? ' stroke-dasharray="3 2"' : ''}/>`;
    if (h >= 11) t_ += `<text x="${x + b / 2}" y="${(ya + h / 2 + 3).toFixed(1)}" text-anchor="middle" font-size="9" fill="${F.text}">${_hfSvgSym(z.sym)}</text>`;
    return t_ + _hfTitel(z) + '</g>';
  };
  let c = y0;
  basisMin.forEach((z, i) => {
    const von = i === 0 ? y0 : c, bis = i === 0 ? z.wert : c + z.wert;
    s += `<g><rect x="${xl}" y="${sy(bis).toFixed(1)}" width="${bl}" height="${(sy(von) - sy(bis)).toFixed(1)}" fill="${F.basis}" stroke="${F.basisRand}" stroke-width=".8"/>`;
    if (sy(von) - sy(bis) >= 11) s += `<text x="${xl + bl / 2}" y="${((sy(von) + sy(bis)) / 2 + 3.5).toFixed(1)}" text-anchor="middle" font-size="10" fill="${F.text}">${z.sym === 'BÜ' ? 'BÜ 5.51' : _hfSvgSym(z.sym)}</text>`;
    s += (z.sym === 'BÜ' ? '' : _hfTitel(z)) + '</g>';
    c = bis;
  });
  // Bruchstelle unten (Achse beginnt nicht bei SOK)
  const yb = sy(y0) - 6;
  s += `<path d="M${xl - 4} ${yb + 4} l8 -6 M${xl + bl - 4} ${yb + 4} l8 -6" stroke="${F.leise}" stroke-width="1"/>`;
  const zMin = min.zeilen.filter(z => z.wert !== 0);
  zMin.forEach(z => { s += segment(xl, bl, c, c + z.wert, F.unten, .28, z); c += z.wert; });
  // Klammer Z_hf,min
  const zA = sy(min.wert), zB = sy(min.absolut);
  if (zB - zA > 3) s += `<path d="M${xl - 4} ${zA.toFixed(1)} h-4 V${zB.toFixed(1)} h4" fill="none" stroke="${F.unten}" stroke-width="1"/>`;
  // Spalte hf_max (rechts), von oben nach unten
  const br = 96, xr = W - 10 - br;
  s += `<line x1="${xr - 6}" x2="${xr + br + 6}" y1="${sy(max.absolut).toFixed(1)}" y2="${sy(max.absolut).toFixed(1)}" stroke="${F.oben}" stroke-width="1.6"/>`;
  // Beschriftung der Grundlinie: hf_max,abs über der Linie; BÜ darunter (Zuschläge gehen nach oben)
  s += max.bue
    ? `<text x="${xr + br}" y="${(sy(max.absolut) + 12).toFixed(1)}" text-anchor="end" font-size="10" fill="${F.oben}">BÜ ${_hfM(max.absolut)}</text>`
    : `<text x="${xr + br}" y="${(sy(max.absolut) - 5).toFixed(1)}" text-anchor="end" font-size="10" fill="${F.oben}">hf<tspan font-size="7" dy="2">max,abs</tspan><tspan dy="-2"> ${_hfM(max.absolut)}</tspan></text>`;
  let kUnten = max.absolut, kOben = max.absolut;   // Ausdehnung der Spalte (für die Beschriftung von hf_max)
  if (!max.bue) {
    let k = max.absolut;
    const pos = max.zeilen.filter(z => z.wert > 0), neg = max.zeilen.filter(z => z.wert < 0);
    pos.forEach(z => { s += segment(xr, br, k, k - z.wert, F.oben, .25, z); k -= z.wert; kUnten = Math.min(kUnten, k); });
    neg.forEach(z => { s += segment(xr, br, k, k - z.wert, F.oben, .08, z, true); k -= z.wert; });
  } else {
    // Bahnübergang: 5510 + Z nach oben (wie Excel)
    let k = max.absolut;
    max.zeilen.filter(z => z.wert !== 0).forEach(z => { s += segment(xr, br, k, k + z.wert, F.oben, .25, z, z.wert < 0); k += z.wert; kOben = Math.max(kOben, k); });
  }
  // Zulässiger Bereich zwischen hf_min und hf_max
  const ok = max.wert >= min.wert;
  const ya = sy(Math.max(min.wert, max.wert)), yz = sy(Math.min(min.wert, max.wert));
  s += `<rect x="${xl + bl + 8}" y="${ya.toFixed(1)}" width="${xr - xl - bl - 16}" height="${Math.max(yz - ya, 1).toFixed(1)}" fill="${ok ? F.okFlaeche : F.nok}" fill-opacity="${ok ? 1 : .15}" stroke="${ok ? F.ok : F.nok}" stroke-width="1"/>`;
  const mitte = (xl + bl + xr) / 2;
  s += `<text x="${mitte}" y="${((ya + yz) / 2 - 2).toFixed(1)}" text-anchor="middle" font-size="11" font-weight="600" fill="${ok ? F.ok : F.nok}">${escHtml(t(ok ? 'hf.gr.bereich' : 'hf.gr.keinbereich'))}</text>`;
  s += `<text x="${mitte}" y="${((ya + yz) / 2 + 12).toFixed(1)}" text-anchor="middle" font-size="10" fill="${F.text}">${fN(max.wert - min.wert, 0)} mm</text>`;
  // hf_min / hf_max Linien mit Werten
  s += `<line x1="${xl - 8}" x2="${xr + br + 6}" y1="${sy(min.wert).toFixed(1)}" y2="${sy(min.wert).toFixed(1)}" stroke="${F.unten}" stroke-width="1.6"/>`;
  s += `<line x1="${xl - 8}" x2="${xr + br + 6}" y1="${sy(max.wert).toFixed(1)}" y2="${sy(max.wert).toFixed(1)}" stroke="${F.oben}" stroke-width="1.6"/>`;
  s += `<text x="${xl}" y="${(sy(min.wert) - 5).toFixed(1)}" font-size="11" font-weight="700" fill="${F.unten}">hf<tspan font-size="8" dy="2">min</tspan><tspan dy="-2"> ${_hfM(min.wert)}</tspan></text>`;
  // hf_max unter der Spalte (nicht auf den Streifen); beim Bahnübergang darüber
  const yMax = max.bue ? sy(Math.max(max.wert, kOben)) - 5 : sy(Math.min(max.wert, kUnten)) + 14;
  s += `<text x="${xr + br}" y="${yMax.toFixed(1)}" text-anchor="end" font-size="11" font-weight="700" fill="${F.oben}">hf<tspan font-size="8" dy="2">max</tspan><tspan dy="-2"> ${_hfM(max.wert)}</tspan></text>`;
  // Leserichtung der Säulen: links von unten aufgebaut, rechts von oben abgezogen (BÜ: ab 5.51 m addiert)
  const weg = (x, anker, k, farbe, text) =>
    `<text x="${x}" y="${H - 22}" text-anchor="${anker}" font-size="10.5" font-weight="700" fill="${farbe}">hf<tspan font-size="7.5" dy="2">${k}</tspan></text>`
    + `<text x="${x}" y="${H - 8}" text-anchor="${anker}" font-size="9.5" fill="${F.leise}">${escHtml(text)}</text>`;
  s += weg(xl + bl / 2, 'middle', 'min', F.unten, t('hf.gr.anteile.min').replace('{b}', min.bue ? `BÜ ${_hfM(min.absolut)} m` : 'GfA'));
  s += weg(xr + br, 'end', 'max', F.oben, t(max.bue ? 'hf.gr.anteile.max.bue' : 'hf.gr.anteile.max').replace('{b}', `${_hfM(max.absolut)} m`));
  return s + '</svg>';
}

// hf_min und hf_max für alle zulässigen Spannweiten (übrige Eingaben wie gewählt)
function _hfSvgSpannweite(r, e, F) {
  const W = 460, H = 310, l = 58, rr = 14, o = 18, u = 54;
  const punkte = [...HF_SPANNWEITEN].sort((a, b) => a - b).map(c => {
    const x = hfBerechnen({ ...e, c, nfl: r.nfl });
    return x.min ? { c, min: x.min.wert, max: x.max.wert } : null;
  }).filter(Boolean);
  if (!punkte.length) return '';
  const alle = punkte.flatMap(p => [p.min, p.max]);
  const y0 = Math.floor((Math.min(...alle) - 40) / 100) * 100, y1 = Math.ceil((Math.max(...alle) + 40) / 100) * 100;
  const sx = c => l + (W - l - rr) * (c - 8) / (60 - 8);
  const sy = mm => o + (H - o - u) * (1 - (mm - y0) / (y1 - y0));
  let s = `<svg viewBox="0 0 ${W} ${H}" class="hf-svg" role="img" aria-label="${escHtml(t('hf.gr.spannweite'))}" style="background:${F.hinter};width:100%;height:auto;display:block" font-family="Inter, Arial, sans-serif">`;
  const schritt = (y1 - y0) > 1200 ? 200 : 100;
  for (let v = y0; v <= y1; v += schritt) {
    s += `<line x1="${l}" x2="${W - rr}" y1="${sy(v).toFixed(1)}" y2="${sy(v).toFixed(1)}" stroke="${F.raster}"/>`;
    s += `<text x="${l - 6}" y="${(sy(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="10" fill="${F.leise}">${_hfM(v)}</text>`;
  }
  for (const c of [8, 12, 16, 20, 24, 30, 36, 42, 48, 54, 60]) {
    s += `<line x1="${sx(c).toFixed(1)}" x2="${sx(c).toFixed(1)}" y1="${o}" y2="${H - u}" stroke="${F.raster}" stroke-width=".5"/>`;
    s += `<text x="${sx(c).toFixed(1)}" y="${H - u + 14}" text-anchor="middle" font-size="10" fill="${F.leise}">${c}</text>`;
  }
  s += `<text x="${(l + W - rr) / 2}" y="${H - u + 28}" text-anchor="middle" font-size="10" fill="${F.leise}">${escHtml(t('hf.gr.c'))}</text>`;
  s += `<text x="12" y="${(o + H - u) / 2}" transform="rotate(-90 12 ${(o + H - u) / 2})" text-anchor="middle" font-size="10" fill="${F.leise}">${escHtml(t('hf.gr.achse'))}</text>`;
  const linie = k => punkte.map((p, i) => `${i ? 'L' : 'M'}${sx(p.c).toFixed(1)} ${sy(p[k]).toFixed(1)}`).join(' ');
  // Bereich zwischen den Kurven
  const flaeche = linie('max') + ' ' + [...punkte].reverse().map(p => `L${sx(p.c).toFixed(1)} ${sy(p.min).toFixed(1)}`).join(' ') + ' Z';
  s += `<path d="${flaeche}" fill="${F.okFlaeche}" stroke="none"/>`;
  s += `<path d="${linie('min')}" fill="none" stroke="${F.unten}" stroke-width="2"/>`;
  s += `<path d="${linie('max')}" fill="none" stroke="${F.oben}" stroke-width="2"/>`;
  punkte.forEach(p => { if (p.max < p.min) s += `<circle cx="${sx(p.c).toFixed(1)}" cy="${sy(p.min).toFixed(1)}" r="2.5" fill="${F.nok}"/>`; });
  // Gewählte Spannweite
  const g = punkte.find(p => p.c === e.c);
  if (g) {
    s += `<line x1="${sx(g.c).toFixed(1)}" x2="${sx(g.c).toFixed(1)}" y1="${o}" y2="${H - u}" stroke="${F.text}" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += `<circle cx="${sx(g.c).toFixed(1)}" cy="${sy(g.min).toFixed(1)}" r="4" fill="${F.unten}"/><circle cx="${sx(g.c).toFixed(1)}" cy="${sy(g.max).toFixed(1)}" r="4" fill="${F.oben}"/>`;
    // Werte zwischen die Kurven (dort ist frei), auf der Seite, von der sich die
    // Kurve wegbewegt; nur wenn es zu eng ist, ausserhalb wie bisher
    const i = punkte.indexOf(g), li = punkte[Math.max(0, i - 1)], re = punkte[Math.min(punkte.length - 1, i + 1)];
    const innen = sy(g.min) - sy(g.max) >= 40;
    const rand = wunsch => (g.c > 52 ? false : g.c < 14 ? true : wunsch);
    const minRechts = rand(innen ? re.min - g.min <= li.min - g.min : g.c < 44);
    const maxRechts = rand(innen ? re.max - g.max >= li.max - g.max : g.c < 44);
    const wert = (rechts, y, farbe, mm) => `<text x="${(sx(g.c) + (rechts ? 7 : -7)).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${rechts ? 'start' : 'end'}" font-size="10.5" font-weight="700" fill="${farbe}">${_hfM(mm)}</text>`;
    s += wert(minRechts, innen ? sy(g.min) - 7 : sy(g.min) + 14, F.unten, g.min);
    s += wert(maxRechts, innen ? sy(g.max) + 14 : sy(g.max) - 7, F.oben, g.max);
    s += `<text x="${sx(g.c).toFixed(1)}" y="${o - 5}" text-anchor="middle" font-size="10" fill="${F.text}">c = ${g.c} m</text>`;
  }
  // Legende
  const ly = H - 9;
  s += `<line x1="${l}" x2="${l + 18}" y1="${ly}" y2="${ly}" stroke="${F.unten}" stroke-width="2"/><text x="${l + 22}" y="${ly + 3.5}" font-size="10" fill="${F.text}">hf<tspan font-size="7" dy="2">min</tspan></text>`;
  s += `<line x1="${l + 70}" x2="${l + 88}" y1="${ly}" y2="${ly}" stroke="${F.oben}" stroke-width="2"/><text x="${l + 92}" y="${ly + 3.5}" font-size="10" fill="${F.text}">hf<tspan font-size="7" dy="2">max</tspan></text>`;
  s += `<rect x="${l + 140}" y="${ly - 5}" width="18" height="10" fill="${F.okFlaeche}" stroke="${F.ok}" stroke-width=".6"/><text x="${l + 162}" y="${ly + 3.5}" font-size="10" fill="${F.text}">${escHtml(t('hf.gr.bereich'))}</text>`;
  return s + '</svg>';
}

// Zusammensetzung hf_min / hf_max: je Grösse die Formel mit allen Anteilen
// (auch Nullwerte) und darunter dieselbe Zeile mit Zahlen. Vorzeichen wie in
// der Tabelle: Z = Summe der Zeilen, negative Werte in Klammern.
function _hfZusammensetzung(r) {
  const zahl = v => (v < 0 ? `(−${_hfMm(-v)})` : _hfMm(v));
  const sym = x => _HF_SYM[x.sym] || x.sym;
  const zeile = (teil, art) => {
    const hf = `hf<sub>${art}</sub>`;
    const z = teil.zeilen;
    let formel, werte;
    if (teil.bue) {
      formel = `BÜ + (${z.map(sym).join(' + ')})`;
      werte = `${_hfMm(teil.absolut)} + (${z.map(x => zahl(x.wert)).join(' + ')})`;
    } else if (art === 'min') {
      formel = `${teil.basis.map(sym).join(' + ')} + (${z.map(sym).join(' + ')})`;
      werte = `${teil.basis.map(x => zahl(x.wert)).join(' + ')} + (${z.map(x => zahl(x.wert)).join(' + ')})`;
    } else {
      formel = `hf<sub>max,abs</sub> − (${z.map(sym).join(' + ')})`;
      werte = `${_hfMm(teil.absolut)} − (${z.map(x => zahl(x.wert)).join(' + ')})`;
    }
    // Inline-Stile gelten auch im PDF (dort ohne die Stile der App)
    return `<tr><th scope="row" rowspan="2" style="text-align:left;vertical-align:top;padding:4px 12px 2px 0;white-space:nowrap">${hf}</th><td class="hf-zus-f" style="padding-top:4px">= ${formel}</td></tr>`
         + `<tr><td class="hf-zus-w" style="padding-bottom:6px">= ${werte} = <b>${_hfMm(teil.wert)} mm</b></td></tr>`;
  };
  return `<table class="hf-zus-tab"><tbody>${zeile(r.min, 'min')}${zeile(r.max, 'max')}</tbody></table>`
       + `<p class="hf-zus-hw">${t('hf.zus.hw')}</p>`;
}

function _hfGrafiken(r, e, F) {
  return `<div class="hf-zwei hf-grafiken">
    <figure class="hf-karte"><figcaption class="hf-titel">${t('hf.gr.leiter')}</figcaption>${_hfSvgLeiter(r, e, F)}</figure>
    <figure class="hf-karte"><figcaption class="hf-titel">${t('hf.gr.spannweite')}</figcaption>${_hfSvgSpannweite(r, e, F)}
      ${e.typ === 'nfl' ? `<p class="abs-hinweis" style="margin:.2rem 0 0">${t('hf.gr.lm').replace('{lm}', fN(e.Lm, 2))}</p>` : ''}</figure>
  </div>
  <section class="hf-karte hf-zus" aria-labelledby="hf-zus-titel"><h3 class="hf-titel" id="hf-zus-titel">${t('hf.zus.titel')}</h3>${_hfZusammensetzung(r)}</section>`;
}

// ── PDF-Protokoll ──
function hfPdf() {
  const e = hfEingabe;
  if (!e) return;
  const r = hfRechnen();
  if (r.fehler.length) { meldung(r.fehler.map(k => t(k)).join('\n'), 'warnung'); return; }
  const _pid = Projekte.aktuelleProjektId;
  const projName = _pid ? (getProjMeta().find(m => m.id === _pid)?.name || '') : '';
  const jn = b => (b ? t('hf.ja') : t('hf.nein'));
  const ein = [
    [t('hf.typ'), sysName(e.typ)], [t('hf.c'), e.c + ' m'], [t('hf.v'), e.v + ' km/h'], [t('hf.bue'), jn(e.bue)],
    ...(e.typ === 'nfl' ? [[t('sys.kombination'), HF_KOMBINATIONEN[e.kombi]], ['L<sub>m</sub>', fN(e.Lm, 2) + ' m'],
      [t('hf.hub'), fN(e.H_ub, 0) + ' N'], [t('hf.tm'), _hfTemp(e.T_montage)], ['H<sub>Fd</sub>', fN(e.H_Fd, 0) + ' N']]
      : [[t('hf.rfl.zug.kurz'), '12 kN / 10 kN']]),
    [t('hf.un'), e.un + ' kV'], [t('hf.ebv'), 'EBV ' + e.ebv], [t('hf.schotter'), jn(e.schotter)],
    [t('hf.f'), e.f + ' mm'], [t('hf.h'), e.H + ' mm'], [t('hf.tmin'), _hfTemp(e.Tmin)], [t('hf.zl') + ' (hf<sub>min</sub>)', e.zlMin + ' N/m'],
    ...(e.typ === 'rfl' ? [['P1.1 / P1.3', jn(e.p11)], ['P1.2', jn(e.p12)], [t('hf.cuebr'), e.cUebr + ' m']] : []),
    ['LRP', t(e.lrp ? 'hf.lrp.j' : 'hf.lrp.n')], [t('hf.tmax'), _hfTemp(e.Tmax)], [t('hf.zl') + ' (hf<sub>max</sub>)', e.zlMax + ' N/m'],
  ];
  const tab = (teil, art) => {
    const zeilen = [];
    if (teil.bue) zeilen.push([t('hf.bue.basis'), '', teil.absolut]);
    else if (art === 'min') { teil.basis.forEach(z => zeilen.push([_HF_SYM[z.sym], t(z.schluessel), z.wert])); zeilen.push(['hf<sub>min,abs</sub>', t('hf.abs'), teil.absolut]); }
    else zeilen.push(['hf<sub>max,abs</sub>', t(e.lrp ? 'hf.lrp.j' : 'hf.lrp.n'), teil.absolut]);
    teil.zeilen.forEach(z => zeilen.push([_HF_SYM[z.sym], t(z.schluessel), z.wert]));
    zeilen.push([art === 'min' ? 'Z<sub>hf,min</sub>' : 'Z<sub>hf,max</sub>', t(art === 'min' ? 'hf.z.summe.min' : 'hf.z.summe.max'), teil.summe]);
    return `<table class="cmp"><tr><th>${t('hf.sp.sym')}</th><th>${t('hf.sp.txt')}</th><th style="text-align:right">[mm]</th></tr>
      ${zeilen.map(([s, x, w]) => `<tr><td>${s}</td><td>${x}</td><td style="text-align:right">${fN(w, 1)}</td></tr>`).join('')}</table>`;
  };
  const datum = new Date().toLocaleString(currentLang === 'fr' ? 'fr-FR' : currentLang === 'it' ? 'it-IT' : 'de-DE');
  const body = `<div class="hdr">${_pdfLogo()}<div><h1>${t('hf.titel')} &nbsp;(${sysName(e.typ)})</h1>
  <p>${t('pdf.erstellt')}: ${datum}${projName ? ` &nbsp;|&nbsp; ${escHtml(projName)}` : ''} &nbsp;|&nbsp; c = ${e.c} m</p></div></div>
<h2>${t('pdf.eingabewerte')}</h2>
<div class="step"><table class="inp">${ein.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table></div>
${r.nfl ? `<p class="sub">${document.getElementById('hf-nfl-zug')?.innerHTML || ''}</p>` : ''}
<h2>${t('hf.erg.min')}: <strong class="r">${fN(r.min.wert, 0)} mm</strong></h2>
<div class="step">${tab(r.min, 'min')}</div>
<h2>${t('hf.erg.max')}: <strong class="r">${fN(r.max.wert, 0)} mm</strong></h2>
<div class="step">${tab(r.max, 'max')}</div>
<h2>${t('hf.gr.titel')}</h2>
<div class="step" style="page-break-inside:avoid"><p class="sub2" style="margin:0 0 4px">${t('hf.gr.leiter')}</p>
  <div style="max-width:104mm;margin:0 auto">${_hfSvgLeiter(r, e, HF_FARBEN_PDF)}</div></div>
<div class="step" style="page-break-inside:avoid"><p class="sub2" style="margin:0 0 4px">${t('hf.gr.spannweite')}</p>
  <div style="max-width:104mm;margin:0 auto">${_hfSvgSpannweite(r, e, HF_FARBEN_PDF)}</div></div>
<h2>${t('hf.zus.titel')}</h2>
<div class="step hf-zus" style="page-break-inside:avoid">${_hfZusammensetzung(r)}</div>
${r.hinweise.length ? `<h2 class="warm">${t('hf.hinweise')}</h2><div class="step">${r.hinweise.map(k => `<p>${t(k)}</p>`).join('')}</div>` : ''}
<p class="sub2" style="margin-top:8px">${t('hf.quelle')}</p>
<footer>${t('pdf.footer')} &nbsp;·&nbsp; ${APP_VERSION} &nbsp;|&nbsp; ${t('hf.titel')}</footer>`;
  _pdfDrucken(t('hf.titel'), body);
}


// ═══════════════════════════════════════════════════════════════
// INITIALISIERUNG & POLYFILLS
// ═══════════════════════════════════════════════════════════════

// ctx.roundRect fehlt in Safari < 15.4 — Fallback mit quadraticCurveTo
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
    this.beginPath();
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y); this.quadraticCurveTo(x + w, y, x + w, y + r);
    this.lineTo(x + w, y + h - r); this.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    this.lineTo(x + r, y + h); this.quadraticCurveTo(x, y + h, x, y + h - r);
    this.lineTo(x, y + r); this.quadraticCurveTo(x, y, x + r, y);
    this.closePath();
  };
}

// ═══════════════════════════════════════════════════════════════
// INTERNATIONALIZATION (DE / FR / IT)
// Terminologie nach SBB-Norm (Tragseil=CP/FP, Fahrdraht=FC, SOK=DRS/PRF)
// ═══════════════════════════════════════════════════════════════
let currentLang = localStorage.getItem('kettenlinie_lang') || 'de';


// Sprachkennung für Datums- und Zahlenformate, passend zur Oberflächensprache.
function _sprachTag() {
  return currentLang === 'fr' ? 'fr-CH' : currentLang === 'it' ? 'it-CH' : 'de-CH';
}

function t(key) {
  return (LANG[currentLang] && LANG[currentLang][key]) || LANG['de'][key] || key;
}

function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('kettenlinie_lang', lang);

  // Update button active states
  ['de', 'fr', 'it'].forEach(l => {
    const btn = document.getElementById('lang-' + l);
    if (btn) btn.classList.toggle('active', l === lang);
  });


  // ── Beschriftungen aus data-i18n-Attributen ─────────────────────────────
  // Ein neu beschriftetes Element braucht hier keinen Eintrag mehr — es genügt
  // data-i18n / data-i18n-html / data-i18n-ph im HTML.
  // Sonderfälle (zusammengesetzte oder bedingte Texte) folgen weiter unten
  // und dürfen die Schleife bewusst überschreiben.
  document.querySelectorAll('[data-i18n]').forEach(el      => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML   = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el   => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el  => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });

  // Dynamisch erzeugte Inhalte neu aufbauen, damit sie die neue Sprache zeigen
  const _presetErste = document.querySelector('#preset-select option[value=""]');
  if (_presetErste) _presetErste.textContent = t('msg.kettenwerk.waehlen');
  const _neuOpt = document.querySelector('#proj-group-sel option[value="__new__"]');
  if (_neuOpt) _neuOpt.textContent = t('ui.proj.neu');
  if (document.getElementById('projects-modal')?.classList.contains('open')) Projekte.renderProjectList();
  if (document.getElementById('reglage-modal')?.classList.contains('open')) renderReglageElTable();
  const _rglBtn = document.getElementById('rgl-el-edit-btn');
  if (_rglBtn) _rglBtn.textContent = t(_rglElEditMode ? 'ui.schliessen' : 'ui.bearbeiten');
  if (typeof setYCMode === 'function') setYCMode(yCInputMode);
  if (typeof _berechnungsartUI === 'function') _berechnungsartUI();
  const _thBtn = document.getElementById('thema-btn');
  if (_thBtn) _thBtn.title = t('ui.thema.' + (document.documentElement.dataset.themaWahl || 'auto'));
  const _thName = document.getElementById('thema-name');
  if (_thName) _thName.textContent = t('ui.darstellung') + ': ' + t('ui.thema.name.' + (document.documentElement.dataset.themaWahl || 'auto'));
  if (typeof renderObstacleList === 'function') renderObstacleList();
  if (typeof hfElSperre === 'function') hfElSperre();
  if (document.getElementById('hf-modal')?.classList.contains('open')) renderHf();

  // Hinweis: Der Handbuch-Knopf im Header ist reines Symbol ohne Textlabel.
  // Die frühere Zuweisung an 'header-manual-text' lief ins Leere (die ID gibt
  // es nicht — 'header-manual-text' ist eine Klasse) und wurde entfernt.

  // ── Card 1: Befestigungspunkte ────────────────────────────────
  const h1lbl = document.getElementById('h1-label');
  if (h1lbl) h1lbl.innerHTML = `${t('bp.h1')} <span style="font-weight:400;color:var(--tertiary);font-size:.7em">${t('bp.ueber.sok')}</span>`;
  const h2lbl = document.getElementById('h2-label');
  if (h2lbl) h2lbl.innerHTML = `${t('bp.h2')} <span style="font-weight:400;color:var(--tertiary);font-size:.7em">${t('bp.ueber.sok')}</span>`;

  // Bezeichnung / Name / KM
  const bpBezLbl = document.getElementById('bp-bez-label');
  const bpBezOpt = document.getElementById('bp-bez-optional');
  if (bpBezLbl) bpBezLbl.childNodes[0].textContent = t('bp.bez.label') + ' ';
  if (bpBezOpt) bpBezOpt.textContent = t('bp.bez.optional');

  // H-Punkt Placeholders
  [1,2,3,4].forEach(i => {
    const el = document.getElementById('probe-h' + i);
    if (el) el.placeholder = t('probe.h.placeholder');
  });
  if (typeof _hZeileStatus === 'function') _hZeileStatus();
  const sokPlaceholder = `— ${t('dyn.ueber.mum')}`;
  const sokL = document.getElementById('sok-mum-left');
  if (sokL) sokL.placeholder = sokPlaceholder;
  const sokR = document.getElementById('sok-mum-right');
  if (sokR) sokR.placeholder = sokPlaceholder;

  // ── Card 2: Spannweite ────────────────────────────────────────

  // ── Card 3: System ────────────────────────────────────────────
  const wearBtnMax = document.getElementById('wear-btn-max');
  const wearMaxLbl = document.getElementById('wear-max-label');
  if (wearBtnMax && wearMaxLbl) {
    const pct = wearMaxLbl.textContent;
    wearBtnMax.innerHTML = `${t('sys.wear.worn')} (<span id="wear-max-label">${pct}</span>%)`;
  }

  // ── Card 4: Parameter ─────────────────────────────────────────
  const hBelLbl = document.getElementById('h-belastet-lbl');
  if (hBelLbl) hBelLbl.innerHTML = `${t('par.H.ts.b')} <span style="font-weight:400;color:var(--tertiary)">${t('par.H.ts.b.sub')}</span>`;
  const t1Lbl = document.getElementById('t1-label');
  if (t1Lbl) t1Lbl.innerHTML = `${t('par.T1')} <span style="font-weight:400;color:var(--tertiary);font-size:.75em">${t('par.T1.sub')}</span>`;

  // ── 3-Punkte panel ───────────────────────────────────────────
  // Re-render the yC label for the current mode
  setYCMode(yCInputMode);

  // ── Span display options ──────────────────────────────────────
  rebuildSpanList();

  // ── Custom modal ─────────────────────────────────────────────
  const cmAFd = document.getElementById('cm-alpha-fd-label');
  if (cmAFd) cmAFd.innerHTML = `${t('cm.waerme')} <span style="font-size:.7em;color:var(--tertiary)">(${t('sys.nfl.kurz')})</span>`;
  const cmEAFd = document.getElementById('cm-ea-fd-label');
  if (cmEAFd) cmEAFd.innerHTML = `${t('cm.steif')} <span style="font-size:.7em;color:var(--tertiary)">(${t('sys.nfl.kurz')})</span>`;

  // ── Buttons ───────────────────────────────────────────────────

  // ── Berechnungsart (Einzelleiter) ─────────────────────────────────────

  // ── Lm-Formel-Toggle ─────────────────────────────────────────────────

  // ── T3 Vergleichskurve ────────────────────────────────────────────────
  const t3txt = document.getElementById('t3-toggle-txt');
  if (t3txt) t3txt.innerHTML = showT3 ? t('t3.hide') : t('t3.show');

  // ── Canvas ────────────────────────────────────────────────────

  // ── Legend (static items) ─────────────────────────────────────


  // ── Zeichnung-Toolbar ────────────────────────────────────────────────────

  // ── Share/Export ─────────────────────────────────────────────────────────
  const shareCalcPdf = document.getElementById('share-item-calc-pdf');
  if (shareCalcPdf) { const svg = shareCalcPdf.querySelector('svg'); shareCalcPdf.innerHTML = ''; if(svg) shareCalcPdf.appendChild(svg); shareCalcPdf.append(' ' + t('share.calc.pdf')); }
  const shareDrawPdf = document.getElementById('share-item-draw-pdf');
  if (shareDrawPdf) { const svg = shareDrawPdf.querySelector('svg'); shareDrawPdf.innerHTML = ''; if(svg) shareDrawPdf.appendChild(svg); shareDrawPdf.append(' ' + t('share.draw.pdf')); }
  const shareFotoPng = document.getElementById('share-foto-dl');
  if (shareFotoPng) { const svg = shareFotoPng.querySelector('svg'); shareFotoPng.innerHTML = ''; if(svg) shareFotoPng.appendChild(svg); shareFotoPng.append(' ' + t('share.foto.png')); }

  // ── Sidebar Mastlänge ────────────────────────────────────────────────────
  const mastReLbl = document.getElementById('foto-mastlaenge-re-lbl');
  if (mastReLbl) { mastReLbl.childNodes[0].textContent = t('foto.mast.re') + ' '; const subEl = document.getElementById('foto-mastlaenge-re-sub'); if(subEl) subEl.textContent = t('foto.mast.re.sub'); }

  // ── Foto-Toolbar ─────────────────────────────────────────────────────────
  const fotoMode = document.getElementById('foto-mode');
  if (fotoMode && fotoMode.options.length >= 2) {
    fotoMode.options[0].text = t('foto.mode.7click');
    fotoMode.options[1].text = t('foto.mode.multi');
  }
  // Rollenknöpfe der Fotoansicht auffrischen — der Kurven-Knopf trägt eine
  // Anzahl und lässt sich deshalb nicht rein über data-i18n setzen.
  if (typeof window._fotoBeschriftungenAuffrischen === 'function')
    window._fotoBeschriftungenAuffrischen();
  // Catenary-Toggle: Zustand via inline-style ermitteln (color='var(--text)' = eingeblendet)
  { const catBtn = document.getElementById('foto-catenary-toggle');
    if (catBtn) catBtn.textContent = catBtn.style.color === 'var(--text)' ? t('foto.catenary.off') : t('foto.catenary.on'); }
  // Grid-Toggle: aktuellen Zustand beibehalten
  const gridBtn = document.getElementById('foto-grid-toggle');
  if (gridBtn) { const isOn = gridBtn.style.fontWeight === '600'; gridBtn.textContent = isOn ? t('foto.grid.on') : t('foto.grid.off'); }

  // ── Foto-Canvas ──────────────────────────────────────────────────────────

  // ── Foto-Ergebnis ────────────────────────────────────────────────────────

  // ── Reglage-Modal ────────────────────────────────────────────────────────

  // ── Datei/Projekte-Modal ─────────────────────────────────────────────────
  const projWarnTxt = document.getElementById('proj-warning-txt');
  if (projWarnTxt) projWarnTxt.innerHTML = `<strong id="proj-warning-title">${t('proj.warning.title')}</strong> ${t('proj.warning.body')}`;

  // ── Handbuch modal (if open or preload) ───────────────────────
  translateHandbuch();

  // ── Preset-Infobox in neuer Sprache neu aufbauen ──────────────
  const _presetSel = document.getElementById('preset-select');
  if (_presetSel && _presetSel.value) {
    const _pKey = _presetSel.value;
    if (!_pKey.startsWith('custom_')) {
      const _p = KETTENWERK_PRESETS[_pKey];
      if (_p) {
        const _tEl = document.getElementById('combo-title');
        const _nEl = document.getElementById('combo-note');
        if (_tEl) _tEl.textContent = buildPresetTitle(_p);
        if (_nEl) _nEl.textContent = buildPresetNote(_p);
        refreshPresetNote();   // N-FL: mit aktuellem T1 / H statt Vorgabewerten
      }
    } else {
      const _cp = loadCustomPresets().find(p => p.key === _pKey);
      if (_cp) {
        document.getElementById('combo-note').innerHTML =
          `${t('preset.custom.lbl')} · ${_cp.sysMode.toUpperCase()} &nbsp;` +
          `<button onclick="openCustomModal('${_cp.key}')" style="background:none;border:none;cursor:pointer;` +
          `color:#7c3aed;font-size:.72rem;font-family:inherit;padding:0;text-decoration:underline">${t('preset.bearbeiten')}</button>`;
      }
    }
  }
  // ── Einzelleiter-Reglageinfo neu rendern ──────────────────────
  // (früher elMaterialChanged() — das verwarf angepasste Reglagewerte und den Handwert)
  _elReglageBoxAktualisieren();
  if (elReglageOpen) renderReglageEditPanel();

  // ── Abschnitt-Ansicht in neuer Sprache neu aufbauen (sonst bleibt sie in der alten) ──
  if (_abschnittSichtbar) renderAbschnitt();

  // ── Mode-dependent labels + re-render ─────────────────────────
  updateSysModeUI(sysMode);
  if (calcState) {
    berechnen();   // Ergebnisbereich in neuer Sprache neu rendern
  }
}

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
rebuildPresetDropdown('nfl');
rebuildSpanList();
// Berechnungsart (Starr/Ausgleichend) gilt auch für N-FL — beim Start einblenden
zeigeElement(document.getElementById('berechnungsart-row'), sysMode === 'nfl' || sysMode === 'el');
_berechnungsartUI();
injectCustomElMaterials();
berechnen();
// T2-Slider initialisieren + Farbe setzen
{ const v = (v => isNaN(v) ? 40 : v)(parseFloat(document.getElementById('temp2').value));
  document.getElementById('temp2-slider').value = v;
  updateT2Float(v, false); }
// Apply saved language (after first berechnen so all elements exist)
if (currentLang !== 'de') setLang(currentLang);
// Diagramm neu zeichnen, sobald die mitgelieferte Schrift geladen ist
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => berechnen());
_mastangabenOeffnenFallsBelegt();

// ── Escape: oberstes Fenster schliessen, sonst Vollbild verlassen ────────────
// Die Rückfrage (Ja/Nein) hat eine eigene Tastenbehandlung und bleibt aussen vor.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (document.getElementById('rueckfrage')?.classList.contains('open')) return;
  const mehr = document.getElementById('mehr-menu');
  if (mehr && mehr.style.display !== 'none') { closeMehrMenu(); document.getElementById('mehr-btn')?.focus(); e.preventDefault(); return; }
  const fenster = _oberstesFenster();
  if (fenster) {
    const zu = fenster.querySelector('.modal-close');
    if (zu) zu.click(); else fenster.classList.remove('open');
    e.preventDefault();
    return;
  }
  if (document.querySelector('.canvas-card.canvas-fullscreen')) { toggleCanvasFullscreen(); e.preventDefault(); }
});

// ── Fensterstapel: zuletzt geöffnetes Fenster liegt oben ────────────────────
// Alle Fenster (.modal-overlay) haben dieselbe Grundebene; ohne Stapel
// entschiede die Reihenfolge im HTML, und z. B. die Rückfrage «Löschen?»
// läge hinter dem Datei-Dialog. Beim Öffnen bekommt das Fenster deshalb
// die nächsthöhere Ebene.
const FENSTER_EBENE = 1200;
let _fensterZaehler = 0;
function _fensterOeffnetSich(el, vorher = null) {
  // vorher: Klassen vor der Änderung — so wird auch «zu und gleich wieder auf»
  // (beides im selben Ablauf) als neues Öffnen erkannt.
  const warOffen = vorher !== null && /(^|\s)open(\s|$)/.test(vorher);
  if (el.classList.contains('open')) {
    if (!el.dataset.ebene || (vorher !== null && !warOffen)) { el.dataset.ebene = String(++_fensterZaehler); el.style.zIndex = String(FENSTER_EBENE + _fensterZaehler); }
  } else if (el.dataset.ebene) {
    delete el.dataset.ebene; el.style.zIndex = '';
    if (!document.querySelector('.modal-overlay.open')) _fensterZaehler = 0;
  }
}
function _oberstesFenster() {
  const offen = [...document.querySelectorAll('.modal-overlay.open')];
  if (!offen.length) return null;
  return offen.reduce((a, b) => (+(b.dataset.ebene || 0) >= +(a.dataset.ebene || 0) ? b : a));
}
function _fensterStapelEinrichten() {
  const beob = new MutationObserver(liste => liste.forEach(m => _fensterOeffnetSich(m.target, m.oldValue ?? '')));
  document.querySelectorAll('.modal-overlay').forEach(el => {
    beob.observe(el, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    _fensterOeffnetSich(el);
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _fensterStapelEinrichten);
else _fensterStapelEinrichten();

// ── Darstellung: Auto (wie Gerät) / Hell / Dunkel ──────────────────────────
// Das Thema wird schon im <head> gesetzt (kein Aufblitzen); hier nur Knopf,
// Wechsel und das Nachführen bei «Auto», wenn das Gerät umschaltet.
const THEMA_WAHLEN = ['auto', 'hell', 'dunkel'];
const THEMA_ICONS = {
  auto:   '<circle cx="10" cy="10" r="6.5"/><path d="M10 3.5a6.5 6.5 0 010 13z" fill="currentColor" stroke="none"/>',
  hell:   '<circle cx="10" cy="10" r="3.2"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
  dunkel: '<path d="M15.5 12A6.5 6.5 0 018 4.5a6.5 6.5 0 107.5 7.5z"/>',
};
const _dunkelAbfrage = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
function _themaWahl() {
  try { const w = localStorage.getItem('dh_thema'); if (THEMA_WAHLEN.includes(w)) return w; } catch (e) {}
  return 'auto';
}
function themaAnwenden(wahl = _themaWahl()) {
  const dunkel = wahl === 'dunkel' || (wahl === 'auto' && !!_dunkelAbfrage?.matches);
  const root = document.documentElement;
  root.dataset.thema = dunkel ? 'dunkel' : 'hell';
  root.dataset.themaWahl = wahl;
  // Fensterfarbe (installierte App / Handy-Statusleiste) mitziehen
  const karte = getComputedStyle(root).getPropertyValue('--card').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', karte || '#ffffff');
  const icon = document.getElementById('thema-icon');
  if (icon) icon.innerHTML = THEMA_ICONS[wahl];
  const btn = document.getElementById('thema-btn');
  if (btn) btn.title = t('ui.thema.' + wahl);
  const name = document.getElementById('thema-name');
  if (name) name.textContent = t('ui.darstellung') + ': ' + t('ui.thema.name.' + wahl);
  // Diagramm neu zeichnen (Canvas-Farben kommen nicht aus CSS)
  if (typeof berechnen === 'function' && typeof calcState !== 'undefined') berechnen();
  // Abschnitt: Strangfarben je Thema (Neon-Töne im Dunkelmodus)
  if (typeof renderAbschnitt === 'function' && _abschnittSichtbar) renderAbschnitt();
}
// Menü «Mehr ⋯»: öffnet unter dem Knopf, rechtsbündig, schliesst bei Klick daneben oder Escape
function toggleMehrMenu(e) {
  const menu = document.getElementById('mehr-menu'), knopf = document.getElementById('mehr-btn');
  if (!menu) return;
  if (e) e.stopPropagation();
  const offen = getComputedStyle(menu).display !== 'none';
  if (offen) { closeMehrMenu(); return; }
  menu.style.display = 'block';
  knopf?.setAttribute('aria-expanded', 'true');
  const r = knopf.getBoundingClientRect(), vw = document.documentElement.clientWidth, mw = menu.offsetWidth;
  menu.style.top = Math.round(r.bottom + 5) + 'px';
  menu.style.left = Math.round(Math.max(8, Math.min(r.right - mw, vw - mw - 8))) + 'px';
  setTimeout(() => document.addEventListener('click', function _zu(ev) {
    if (!menu.contains(ev.target)) { closeMehrMenu(); document.removeEventListener('click', _zu); }
  }), 0);
}
function closeMehrMenu() {
  const menu = document.getElementById('mehr-menu');
  if (menu) menu.style.display = 'none';
  document.getElementById('mehr-btn')?.setAttribute('aria-expanded', 'false');
}
function wechsleThema() {
  const naechste = THEMA_WAHLEN[(THEMA_WAHLEN.indexOf(_themaWahl()) + 1) % THEMA_WAHLEN.length];
  try { localStorage.setItem('dh_thema', naechste); } catch (e) {}
  themaAnwenden(naechste);
}
_dunkelAbfrage?.addEventListener?.('change', () => { if (_themaWahl() === 'auto') themaAnwenden('auto'); });
themaAnwenden();

// Höhe der klebenden Kopfleiste als CSS-Variable (für die Eingabespalte)
(() => {
  const kopf = document.querySelector('.header');
  if (!kopf) return;
  const setzen = () => document.documentElement.style.setProperty('--kopf-h', kopf.offsetHeight + 'px');
  setzen();
  if (window.ResizeObserver) new ResizeObserver(setzen).observe(kopf);
})();

// ── Service Worker: macht die Anwendung offline verfügbar ──────────────────
// Nur über http/https — bei einer lokal geöffneten Datei (file://) gibt es
// keinen Service Worker, und der Aufruf würde eine Ausnahme werfen.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {

  // Nach dem Wechsel auf die neue Fassung genau einmal neu laden — aber nur,
  // wenn vorher schon eine Fassung aktiv war. Beim allerersten Besuch übernimmt
  // der Service Worker die Seite ebenfalls (clients.claim), dort wäre ein
  // Neuladen überflüssig und würde bereits getippte Eingaben verwerfen.
  const _hatteFassung = !!navigator.serviceWorker.controller;
  let _neuLaden = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!_hatteFassung || _neuLaden) return;
    _neuLaden = true;
    location.reload();
  });

  // Hinweis mit «Jetzt laden» einblenden. Wird nur aufgerufen, wenn bereits
  // eine ältere Fassung aktiv ist — beim ersten Besuch gibt es nichts zu melden.
  function _updateHinweis(wartend) {
    const el = meldung(t('pwa.update'), 'info', 0);
    if (!el) return;
    const btn = document.createElement('button');
    btn.className = 'meldung-zu';
    btn.style.cssText = 'font-size:.75rem;text-decoration:underline;color:var(--primary)';
    btn.textContent = t('pwa.update.btn');
    // Kein location.reload() hier: das übernimmt controllerchange, sobald die
    // neue Fassung tatsächlich aktiv ist.
    btn.onclick = () => wartend.postMessage('jetzt-aktualisieren');
    el.insertBefore(btn, el.querySelector('.meldung-zu'));
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      // Eine Fassung kann schon warten, wenn die Seite zwischenzeitlich ohne
      // Klick auf «Jetzt laden» neu geladen wurde.
      if (reg.waiting && navigator.serviceWorker.controller) _updateHinweis(reg.waiting);

      reg.addEventListener('updatefound', () => {
        const neu = reg.installing;
        if (!neu) return;
        neu.addEventListener('statechange', () => {
          if (neu.state === 'installed' && navigator.serviceWorker.controller) _updateHinweis(neu);
        });
      });
    }).catch(e => _spur('ServiceWorker', e));
  });
}

// ── Sidebar-Fade: oben + unten ──
{ const scroll = document.querySelector('.sidebar-scroll');
  const sidebar = document.querySelector('.sidebar');
  if (scroll && sidebar) {
    const check = () => {
      const atBottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 6;
      const scrolledDown = scroll.scrollTop > 6;
      sidebar.classList.toggle('at-bottom',    atBottom);
      sidebar.classList.toggle('scrolled-down', scrolledDown);
    };
    scroll.addEventListener('scroll', check, { passive: true });
    check();
  }
}

// ── Messpunkt-Inputs ──
document.getElementById('probe-x1').addEventListener('input', function() {
  const v = parseFloat(this.value);
  probeX1 = isNaN(v) ? null : v;
  quickDraw(); updateAllMesspunkte();
});
document.getElementById('probe-x2').addEventListener('input', function() {
  const v = parseFloat(this.value);
  probeX2 = isNaN(v) ? null : v;
  quickDraw(); updateAllMesspunkte();
});
document.getElementById('probe-x3').addEventListener('input', function() {
  const v = parseFloat(this.value);
  probeX3 = isNaN(v) ? null : v;
  quickDraw(); updateAllMesspunkte();
});
document.getElementById('probe-x4').addEventListener('input', function() {
  const v = parseFloat(this.value);
  probeX4 = isNaN(v) ? null : v;
  quickDraw(); updateAllMesspunkte();
});

// ═══════════════════════════════════════════════════════════════
// BENUTZERDEFINIERTE KETTENWERKE (localStorage)
// ═══════════════════════════════════════════════════════════════
const CUSTOM_KEY = 'kettenwerk_custom';
let cmMode = 'nfl';
let cmEditKey = null;  // Key des aktuell bearbeiteten Eintrags (null = neuer Eintrag)

function loadCustomPresets() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); }
  catch { return []; }
}
function saveCustomPresetsToStorage(list) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

function openCustomModal(editKey) {
  cmEditKey = editKey || null;
  const existing = cmEditKey ? loadCustomPresets().find(p => p.key === cmEditKey) : null;

  // Modus setzen
  cmMode = existing ? existing.sysMode : sysMode;
  cmSetMode(cmMode);

  // Felder füllen (bestehend oder leer)
  document.getElementById('cm-label').value    = existing ? existing.label    : '';
  document.getElementById('cm-q-ts').value     = existing ? existing.q_ts     : '';
  document.getElementById('cm-ea-ts').value    = existing ? (existing.ea_ts / 1e6).toFixed(3) : '';
  document.getElementById('cm-alpha-ts').value = existing ? existing.alpha_ts  : '';
  document.getElementById('cm-q-fd').value     = existing ? existing.q_fd     : '';
  document.getElementById('cm-wear').value     = existing ? existing.wear_max  : '30';
  document.getElementById('cm-sh').value       = existing ? existing.sh        : (sysMode === 'rfl' ? '1.60' : '2.40');
  document.getElementById('cm-h-ts').value     = existing ? (existing.H_Ts_ub ?? existing.H_Ts) : '';
  document.getElementById('cm-h-fd').value     = existing ? existing.H_Fd     : '';
  document.getElementById('cm-ea-fd').value    = existing?.ea_fd   ? (existing.ea_fd / 1e6).toFixed(3) : '';
  document.getElementById('cm-alpha-fd').value = existing?.alpha_fd ?? '';

  // Titel und Reset-Button
  document.querySelector('#custom-modal .modal-title').textContent = cmEditKey ? t('cm.title.edit') : t('cm.title');
  document.getElementById('cm-label').placeholder = t('cm.label.placeholder');
  const customs = loadCustomPresets();
  zeigeElement(document.getElementById('cm-reset-btn'), customs.length);
  document.getElementById('custom-modal').classList.add('open');
}

function closeCustomModal() {
  document.getElementById('custom-modal').classList.remove('open');
}

function cmSetMode(mode) {
  cmMode = mode;
  document.getElementById('cm-seg-nfl').classList.toggle('active', mode === 'nfl');
  document.getElementById('cm-seg-rfl').classList.toggle('active', mode === 'rfl');
  zeigeElement(document.getElementById('cm-fd-nfl-fields'), mode === 'nfl');
  document.getElementById('cm-h-ts-label').textContent = mode === 'nfl' ? 'H Ts unbelastet' : 'H Ts (konstant)';
}

function cmClearError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('cm-error');
}

function cmMarkError(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('cm-error');
  el.addEventListener('input', () => el.classList.remove('cm-error'), { once: true });
  el.addEventListener('change', () => el.classList.remove('cm-error'), { once: true });
}

function saveCustomPreset() {
  // Alle Felder zuerst zurücksetzen
  ['cm-label','cm-q-ts','cm-ea-ts','cm-alpha-ts','cm-q-fd','cm-sh','cm-h-ts','cm-h-fd','cm-ea-fd','cm-alpha-fd']
    .forEach(cmClearError);

  const label    = document.getElementById('cm-label').value.trim();
  const q_ts     = parseFloat(document.getElementById('cm-q-ts').value);
  const ea_ts_MN = parseFloat(document.getElementById('cm-ea-ts').value);
  const alpha_ts = parseFloat(document.getElementById('cm-alpha-ts').value);
  const q_fd     = parseFloat(document.getElementById('cm-q-fd').value);
  const wear_max = parseFloat(document.getElementById('cm-wear').value);
  const sh       = parseFloat(document.getElementById('cm-sh').value);
  const H_Ts     = parseFloat(document.getElementById('cm-h-ts').value);
  const H_Fd     = parseFloat(document.getElementById('cm-h-fd').value);

  // Felder einzeln prüfen und markieren
  const requiredNum = [
    ['cm-q-ts', q_ts], ['cm-ea-ts', ea_ts_MN], ['cm-alpha-ts', alpha_ts],
    ['cm-q-fd', q_fd], ['cm-sh', sh], ['cm-h-ts', H_Ts], ['cm-h-fd', H_Fd],
  ];
  let hasError = false;
  if (!label)  { cmMarkError('cm-label'); hasError = true; }
  requiredNum.forEach(([id, val]) => { if (isNaN(val)) { cmMarkError(id); hasError = true; } });
  if (hasError) return;

  const preset = {
    key: 'custom_' + Date.now(),
    label, sysMode: cmMode,
    q_ts, ea_ts: ea_ts_MN * 1e6, alpha_ts,
    q_fd, wear_max: isNaN(wear_max) ? 30 : wear_max,
    sh, H_Fd, T1: 10,
    // N-FL: H_Ts = unbelastet-Reglage; H_belastet wird in readInputs() berechnet
    // R-FL: H_Ts = konstante Zugkraft
    ...(cmMode === 'nfl' ? { H_Ts_ub: H_Ts, H_Ts: H_Ts } : { H_Ts }),
  };

  if (cmMode === 'nfl') {
    const ea_fd_MN = parseFloat(document.getElementById('cm-ea-fd').value);
    const alpha_fd = parseFloat(document.getElementById('cm-alpha-fd').value);
    let nflErr = false;
    if (isNaN(ea_fd_MN)) { cmMarkError('cm-ea-fd');   nflErr = true; }
    if (isNaN(alpha_fd))  { cmMarkError('cm-alpha-fd'); nflErr = true; }
    if (nflErr) return;
    preset.ea_fd   = ea_fd_MN * 1e6;
    preset.alpha_fd = alpha_fd;
  }

  let list = loadCustomPresets();
  if (cmEditKey) {
    // Bestehenden Eintrag ersetzen (Key beibehalten)
    preset.key = cmEditKey;
    list = list.map(p => p.key === cmEditKey ? preset : p);
  } else {
    list.push(preset);
  }
  saveCustomPresetsToStorage(list);

  if (cmMode !== sysMode) {
    setSysMode(cmMode);
  } else {
    rebuildPresetDropdown(sysMode);
  }
  document.getElementById('preset-select').value = preset.key;
  applyCustomPreset(preset);
  closeCustomModal();
}

async function resetCustomPresets() {
  if (!await frageBestaetigung(t('msg.alle.kettenwerke.weg'), { ok: t('rf.loeschen') })) return;
  localStorage.removeItem(CUSTOM_KEY);
  closeCustomModal();
  rebuildPresetDropdown(sysMode);
}

// ── Benutzerdefinierte Einzelleiter-Materialien ──────────────────────────────
const EL_MAT_KEY = 'customElMaterials';
let elmEditKey = null;

function loadCustomElMaterials() {
  try { return JSON.parse(localStorage.getItem(EL_MAT_KEY) || '[]'); } catch { return []; }
}
function saveCustomElMaterialsToStorage(list) {
  localStorage.setItem(EL_MAT_KEY, JSON.stringify(list));
}

function injectCustomElMaterials() {
  const sel = document.getElementById('el-material-select');
  if (!sel) return;
  const currentVal = sel.value;
  // Vorherige custom-Optionen entfernen
  sel.querySelectorAll('option[data-custom]').forEach(o => o.remove());
  const customs = loadCustomElMaterials();
  if (!customs.length) return;
  const sep = document.createElement('option');
  sep.disabled = true; sep.textContent = '──────────'; sep.dataset.custom = '1';
  sel.appendChild(sep);
  customs.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.key; opt.textContent = '★ ' + m.name; opt.dataset.custom = '1';
    sel.appendChild(opt);
    // In MATERIALS registrieren
    MATERIALS[m.key] = {
      name: m.name, q: m.q, alpha: m.alpha * 1e-6,
      E: (m.ea != null && !isNaN(m.ea)) ? m.ea * 1e6 : null,
      AK: (m.ea != null && !isNaN(m.ea)) ? 1.0 : null,
      H_reglage: null, basis_kN: null, reglage_note: null
    };
  });
  // Auswahl wiederherstellen falls möglich
  if (currentVal && sel.querySelector(`option[value="${CSS.escape(currentVal)}"]`)) sel.value = currentVal;
}

function openElMaterialModal() {
  const sel = document.getElementById('el-material-select');
  const currentKey = sel ? sel.value : null;
  const customs = loadCustomElMaterials();
  const existing = customs.find(m => m.key === currentKey);
  elmEditKey = existing ? currentKey : null;
  document.getElementById('elm-modal-title').textContent = existing ? 'Material bearbeiten' : 'Eigenes Leitermaterial';
  document.getElementById('elm-label').value  = existing ? existing.name  : '';
  document.getElementById('elm-q').value      = existing ? existing.q     : '';
  document.getElementById('elm-alpha').value  = existing ? existing.alpha : '';
  document.getElementById('elm-ea').value     = (existing && existing.ea != null) ? existing.ea : '';
  zeigeElement(document.getElementById('elm-reset-btn'), customs.length);
  document.getElementById('el-material-modal').classList.add('open');
}

function closeElMaterialModal() {
  document.getElementById('el-material-modal').classList.remove('open');
}

function saveCustomElMaterial() {
  const name  = document.getElementById('elm-label').value.trim();
  const q     = parseFloat(document.getElementById('elm-q').value);
  const alpha = parseFloat(document.getElementById('elm-alpha').value);
  const eaRaw = document.getElementById('elm-ea').value.trim();
  const ea    = eaRaw !== '' ? parseFloat(eaRaw) : null;
  if (!name)                    { meldung(t('msg.bez.eingeben'), 'warnung');       return; }
  if (isNaN(q)     || q <= 0)  { meldung(t('msg.q.eingeben'), 'warnung'); return; }
  if (isNaN(alpha) || alpha <= 0) { meldung(t('msg.alpha.eingeben'), 'warnung'); return; }
  const customs = loadCustomElMaterials();
  const key = elmEditKey || ('elm_' + Date.now());
  const mat = { key, name, q, alpha, ea: (ea !== null && !isNaN(ea)) ? ea : null };
  const idx = customs.findIndex(m => m.key === key);
  if (idx >= 0) customs[idx] = mat; else customs.push(mat);
  saveCustomElMaterialsToStorage(customs);
  injectCustomElMaterials();
  const sel = document.getElementById('el-material-select');
  if (sel) { sel.value = key; elMaterialChanged(); }
  closeElMaterialModal();
}

async function resetCustomElMaterials() {
  if (!await frageBestaetigung(t('msg.alle.materialien.weg'), { ok: t('rf.loeschen') })) return;
  localStorage.removeItem(EL_MAT_KEY);
  injectCustomElMaterials();
  const sel = document.getElementById('el-material-select');
  if (sel) { sel.value = 'cu95'; elMaterialChanged(); }
  closeElMaterialModal();
}

function applyCustomPreset(p) {
  // System sicherstellen
  if (p.sysMode !== sysMode) { sysMode = p.sysMode; updateSysModeUI(sysMode); }
  // Versteckte Materialfelder
  document.getElementById('material-ts').value = 'custom-ts';
  document.getElementById('weight-ts').value   = p.q_ts;
  document.getElementById('alpha-ts').value    = p.alpha_ts;
  document.getElementById('ea-ts').value       = p.ea_ts;
  document.getElementById('material-fd').value = 'custom-fd';
  document.getElementById('weight-fd').value   = p.q_fd;
  document.getElementById('ea-fd').value       = p.ea_fd   || '';
  document.getElementById('alpha-fd').value    = p.alpha_fd || '';
  // Sichtbare Eingaben
  document.getElementById('sh').value      = p.sh;
  // N-FL: unbelastet-Zugkraft als Eingabe; H_belastet wird in readInputs() berechnet
  document.getElementById('tension').value = (p.sysMode === 'nfl' && p.H_Ts_ub != null) ? p.H_Ts_ub : p.H_Ts;
  document.getElementById('tension-fd').value = p.H_Fd;
  if (p.sysMode === 'nfl') document.getElementById('temp1').value = p.T1 || 10;
  // Abnutzung
  currentWearMax = p.wear_max || 30;
  document.getElementById('wear-max-label').textContent = currentWearMax;
  setWear(0);
  zeigeElement(document.getElementById('wear-row'), true);
  // Combo-Info mit Bearbeiten-Button
  const infoEl = document.getElementById('combo-info');
  infoEl.style.background = 'var(--acc-s)';
  infoEl.style.borderColor = 'color-mix(in srgb, var(--primary) 30%, transparent)';
  document.getElementById('combo-title').style.color = '#7c3aed';
  document.getElementById('combo-title').textContent  = '★ ' + p.label;
  document.getElementById('combo-note').innerHTML =
    `${t('preset.custom.lbl')} · ${p.sysMode.toUpperCase()} &nbsp;` +
    `<button onclick="openCustomModal('${p.key}')" style="background:none;border:none;cursor:pointer;` +
    `color:#7c3aed;font-size:.72rem;font-family:inherit;padding:0;text-decoration:underline">${t('preset.bearbeiten')}</button>`;
  zeigeElement(infoEl, true);
  berechnen();
}

// Obstacle-Liste beim Start initialisieren
renderObstacleList();
