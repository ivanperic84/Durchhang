// Gemeinsame Hilfen für die Browsertests (tests/browser/*.test.js).
//
// Startet einen kleinen Webserver für den Projektordner und einen Chromium
// ohne Fenster (Playwright). Service Worker sind gesperrt, damit immer die
// aktuelle Fassung geladen wird.
//
// Lokal mit einem vorhandenen Chromium:  CHROMIUM_PFAD=/pfad/zu/chromium npm run test:browser
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const WURZEL = path.join(__dirname, '..', '..');
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
};

function serverStarten() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const datei = path.join(WURZEL, pfad === '/' ? 'index.html' : pfad);
      if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) {
        res.writeHead(404); res.end(); return;
      }
      res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
      fs.createReadStream(datei).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/index.html` }));
  });
}

async function browserStarten() {
  return chromium.launch({ executablePath: process.env.CHROMIUM_PFAD || undefined });
}

// Neue Seite laden und warten, bis die erste Berechnung steht.
// Liefert { seite, fehler } — fehler sammelt Skriptfehler und console.error.
async function appOeffnen(browser, url, optionen = {}) {
  const kontext = await browser.newContext({
    viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', acceptDownloads: true, ...optionen,
  });
  const seite = await kontext.newPage();
  const fehler = [];
  seite.on('pageerror', e => fehler.push('Skriptfehler: ' + e.message));
  seite.on('console', m => { if (m.type() === 'error') fehler.push('Konsole: ' + m.text()); });
  await seite.goto(url, { waitUntil: 'load' });
  await seite.waitForFunction(() => typeof berechnen === 'function' && typeof calcState !== 'undefined' && calcState,
    null, { timeout: 60000 });
  return { seite, fehler, kontext };
}

module.exports = { serverStarten, browserStarten, appOeffnen, WURZEL };
