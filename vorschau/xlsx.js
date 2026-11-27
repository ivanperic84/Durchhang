/* Excel-Dateien (.xlsx) lesen und schreiben — klein, ohne fremde Bibliothek
 *
 * Eine .xlsx-Datei ist ein ZIP-Archiv mit XML-Dateien. Gelesen werden nur
 * Zellwerte (Zahlen, Texte, Wahrheitswerte) aller Blätter; Formeln liefern ihren
 * zuletzt gespeicherten Wert. Geschrieben wird eine einfache Mappe ohne
 * Komprimierung (Kopfzeile fett, Spaltenbreiten), die Excel, LibreOffice und
 * Numbers öffnen.
 *
 *   xlsxLesen(bytes)          → Promise<{ Blattname: [[Zellwert, …], …] }>
 *   xlsxSchreiben(blaetter)   → Uint8Array
 *
 * Entpacken: im Browser über DecompressionStream('deflate-raw'), in Node über zlib.
 * Nach Änderungen an dieser Datei: CACHE_VERSION in sw.js erhöhen.
 */
'use strict';

// ── CRC-32 (für ZIP) ──
const _XLSX_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function _xlsxCrc32(b) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < b.length; i++) c = _XLSX_CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const _xlsxUtf8 = s => new TextEncoder().encode(s);
const _xlsxText = b => new TextDecoder('utf-8').decode(b);

// ── ZIP lesen ──
async function _xlsxInflate(daten) {
  if (typeof DecompressionStream === 'function') {
    const strom = new Blob([daten]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(strom).arrayBuffer());
  }
  if (typeof require === 'function') return new Uint8Array(require('zlib').inflateRawSync(daten));
  throw new Error('Entpacken wird von diesem Browser nicht unterstützt.');
}

async function _xlsxZipLesen(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // Ende des zentralen Verzeichnisses suchen
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Keine gültige Excel-Datei (.xlsx).');
  const anzahl = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dateien = {};
  for (let n = 0; n < anzahl; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Excel-Datei beschädigt.');
    const methode = dv.getUint16(p + 10, true);
    const groesse = dv.getUint32(p + 20, true);
    const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), kl = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    const name = _xlsxText(b.subarray(p + 46, p + 46 + nl));
    const lnl = dv.getUint16(lokal + 26, true), lel = dv.getUint16(lokal + 28, true);
    const start = lokal + 30 + lnl + lel;
    const roh = b.subarray(start, start + groesse);
    dateien[name] = { methode, roh };
    p += 46 + nl + el + kl;
  }
  return {
    async text(name) {
      const d = dateien[name];
      if (!d) return null;
      if (d.methode === 0) return _xlsxText(d.roh);
      if (d.methode === 8) return _xlsxText(await _xlsxInflate(d.roh));
      throw new Error('Komprimierung wird nicht unterstützt.');
    },
  };
}

// ── XML-Hilfen ──
const _xlsxEnt = s => s.replace(/&(lt|gt|quot|apos|amp|#x[0-9a-f]+|#\d+);/gi, (m, e) => {
  const l = e.toLowerCase();
  if (l === 'lt') return '<'; if (l === 'gt') return '>'; if (l === 'quot') return '"'; if (l === 'apos') return "'";
  if (l === 'amp') return '&';
  return String.fromCodePoint(l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10));
});
const _xlsxEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const _xlsxAttr = (tag, name) => { const m = tag.match(new RegExp('\\s' + name + '="([^"]*)"')); return m ? _xlsxEnt(m[1]) : null; };
// Texte aller <t>-Elemente (auch formatierte Teile <r><t>) zusammensetzen
const _xlsxTexte = xml => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?t(?:\s[^>]*)?\/>/g)]
  .map(m => _xlsxEnt(m[1] || '')).join('');

function _xlsxSpalte(ref) {
  const m = /^([A-Z]+)/.exec(ref || '');
  if (!m) return -1;
  let n = 0;
  for (const c of m[1]) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// ── Mappe lesen ──
async function xlsxLesen(bytes) {
  const zip = await _xlsxZipLesen(bytes);
  const wb = await zip.text('xl/workbook.xml');
  if (!wb) throw new Error('Keine gültige Excel-Datei (.xlsx).');
  const rels = (await zip.text('xl/_rels/workbook.xml.rels')) || '';
  const ziele = {};
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) ziele[_xlsxAttr(m[0], 'Id')] = _xlsxAttr(m[0], 'Target');
  const sst = await zip.text('xl/sharedStrings.xml');
  const geteilt = sst ? [...sst.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map(m => _xlsxTexte(m[1])) : [];
  const blaetter = {};
  for (const m of wb.matchAll(/<(?:\w+:)?sheet\b[^>]*>/g)) {
    const name = _xlsxAttr(m[0], 'name');
    const rid = _xlsxAttr(m[0], 'r:id');
    let ziel = ziele[rid];
    if (!ziel) continue;
    ziel = ziel.startsWith('/') ? ziel.slice(1) : 'xl/' + ziel.replace(/^\.\//, '');
    const xml = await zip.text(ziel);
    if (!xml) continue;
    const zeilen = [];
    for (const r of xml.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
      const rn = Number(_xlsxAttr(r[0].slice(0, r[0].indexOf('>') + 1), 'r')) || zeilen.length + 1;
      const zeile = [];
      let naechste = 0;
      for (const c of (r[2] || '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const kopf = '<c' + c[1] + '>';
        const ref = _xlsxAttr(kopf, 'r');
        const sp = ref ? _xlsxSpalte(ref) : naechste;
        naechste = sp + 1;
        const typ = _xlsxAttr(kopf, 't');
        const innen = c[2] || '';
        const v = (innen.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/) || [])[1];
        let wert = null;
        if (typ === 's') wert = v != null ? (geteilt[Number(v)] ?? '') : '';
        else if (typ === 'inlineStr') wert = _xlsxTexte(innen);
        else if (typ === 'str') wert = v != null ? _xlsxEnt(v) : '';
        else if (typ === 'b') wert = v === '1';
        else if (typ === 'e') wert = null;
        else if (v != null) { const z = Number(v); wert = Number.isFinite(z) ? z : _xlsxEnt(v); }
        zeile[sp] = wert;
      }
      for (let i = 0; i < zeile.length; i++) if (zeile[i] === undefined) zeile[i] = null;
      zeilen[rn - 1] = zeile;
    }
    for (let i = 0; i < zeilen.length; i++) if (!zeilen[i]) zeilen[i] = [];
    blaetter[name] = zeilen;
  }
  return blaetter;
}

// ── Mappe schreiben ──
function _xlsxRef(sp, z) {
  let s = '', n = sp + 1;
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s + (z + 1);
}

function _xlsxBlattXml(zeilen) {
  const breite = [];
  zeilen.forEach(z => z.forEach((v, i) => {
    const l = v == null ? 0 : String(v).length;
    breite[i] = Math.max(breite[i] || 8, Math.min(60, l + 2));
  }));
  const cols = breite.length
    ? '<cols>' + breite.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>' : '';
  const rows = zeilen.map((z, ri) => {
    const zellen = z.map((v, ci) => {
      if (v == null || v === '') return '';
      const s = ri === 0 ? ' s="1"' : '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${_xlsxRef(ci, ri)}"${s}><v>${v}</v></c>`;
      if (typeof v === 'boolean') return `<c r="${_xlsxRef(ci, ri)}" t="b"${s}><v>${v ? 1 : 0}</v></c>`;
      return `<c r="${_xlsxRef(ci, ri)}" t="inlineStr"${s}><is><t xml:space="preserve">${_xlsxEsc(v)}</t></is></c>`;
    }).join('');
    return `<row r="${ri + 1}">${zellen}</row>`;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + cols + `<sheetData>${rows}</sheetData></worksheet>`;
}

function _xlsxZipSchreiben(dateien) {
  const teile = [], verzeichnis = [];
  let pos = 0;
  const u16 = n => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = n => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  for (const [name, inhalt] of dateien) {
    const nb = _xlsxUtf8(name), d = _xlsxUtf8(inhalt), crc = _xlsxCrc32(d);
    // Datum 1.1.2020, Version 2.0, Flag 0x0800 = UTF-8-Namen, ohne Komprimierung
    const kopf = [...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x5021),
      ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nb.length), ...u16(0)];
    teile.push(new Uint8Array(kopf), nb, d);
    verzeichnis.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0),
      ...u16(0x5021), ...u32(crc), ...u32(d.length), ...u32(d.length), ...u16(nb.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(pos)]), nb);
    pos += kopf.length + nb.length + d.length;
  }
  const vGroesse = verzeichnis.reduce((s, t) => s + t.length, 0);
  const ende = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(dateien.length), ...u16(dateien.length),
    ...u32(vGroesse), ...u32(pos), ...u16(0)]);
  const alle = [...teile, ...verzeichnis, ende];
  const aus = new Uint8Array(alle.reduce((s, t) => s + t.length, 0));
  let o = 0;
  for (const t of alle) { aus.set(t, o); o += t.length; }
  return aus;
}

function xlsxSchreiben(blaetter) {
  const namen = Object.keys(blaetter);
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + namen.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>';
  const wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
    + namen.map((n, i) => `<sheet name="${_xlsxEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
    + '</sheets></workbook>';
  const wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + namen.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${namen.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>';
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';
  return _xlsxZipSchreiben([
    ['[Content_Types].xml', ct], ['_rels/.rels', rels], ['xl/workbook.xml', wb],
    ['xl/_rels/workbook.xml.rels', wbRels], ['xl/styles.xml', styles],
    ...namen.map((n, i) => [`xl/worksheets/sheet${i + 1}.xml`, _xlsxBlattXml(blaetter[n])]),
  ]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { xlsxLesen, xlsxSchreiben };
}
