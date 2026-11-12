# CLAUDE.md — Arbeitsanleitung für Durchhang

Diese Datei liest Claude Code in jeder Sitzung in diesem Repository automatisch.
Ausführliche Übergabe (Stand, Fachlogik, Verlauf, Offenes): **docs/UEBERGABE.md** —
vor der ersten Änderung lesen.

## Projekt in einem Satz
«Durchhang N-FL / R-FL / Einzelleiter» ist eine Web-App (PWA, offline-fähig) zur
Berechnung von Durchhang und Zugkraft von Fahrleitungen (Kettenwerk) und Einzelleitern
mit Temperatureinfluss, Fahrdrahthöhe hf_min/hf_max, Abspannabschnitten mit mehreren
Strängen, Zeichnung, PDF, 3D-DXF und IFC4. Läuft auf GitHub Pages:
https://ivanperic84.github.io/Durchhang/ (wird aus `main` veröffentlicht).

## Zusammenarbeit mit dem Nutzer (wichtig)
- Der Nutzer ist Fachmann (Fahrleitungsbau, SBB-Umfeld), **hat keine Programmiererfahrung**.
  Immer **auf Deutsch**, einfach und ohne Fachjargon aus der Informatik antworten.
- Wunsch des Nutzers: **klärende Fragen stellen, bevor mit einer Aufgabe begonnen wird.**
  Bewährt: 1–3 Fragen als Auswahl (AskUserQuestion), empfohlene Option zuerst mit
  «(Empfohlen)». Bei eindeutigen Aufträgen direkt umsetzen.
- «pushen», «push», «auf main übernehmen», «auf main schreiben», «übernehmen» bedeutet:
  committen, Arbeitszweig pushen, **Pull Request auf `main` erstellen und per Squash
  mergen**. Ohne solche Aufforderung nur auf den Arbeitszweig pushen.
- Am Ende jeder Runde: kurzer Bericht (was ist neu, Tests grün, ggf. Bildschirmfoto als
  Datei senden) und fragen, ob auf main übernommen werden soll.
- Bildschirmfotos zur Kontrolle gerne zeigen — aber **nie ins Repository committen**.

## Unverrückbare Regeln
- **Keine internen SBB-Unterlagen ins Repository** (Excel, PDFs, Reglagetabellen,
  Siemens-Buch). `.gitignore` schliesst `*.xlsm`, `*.xlsx`, `*.pdf`, `Grundlagen SBB/` aus.
  Erlaubt sind nur daraus abgeleitete **Zahlen** (z. B. Testfälle) — so vom Nutzer freigegeben.
- **Keine Bilder/Screenshots committen.** Prüfskripte nie im Repo-Ordner laufen lassen,
  sondern im Scratchpad/temp; vor jedem Commit `git status` prüfen (ist 2× passiert).
- Tag `v1.0-stable` und die Tests nie löschen. Tests nie abschalten, um grün zu werden.
- In der App und im Handbuch **nicht auf das SBB-Excel verweisen** (Wunsch des Nutzers:
  das Excel-Tool wird abgelöst; ein Verweis wirkt unprofessionell). In Code-Kommentaren
  und Tests ist die Herkunft «wie Excel» in Ordnung.
- Keine Modellbezeichnungen in Commits/PRs. Attributionszeilen so verwenden, wie die
  Umgebung sie vorgibt.

## Aufbau
| Datei | Inhalt |
|---|---|
| `index.html` | Seitengerüst: Eingabefelder, Ansichten, Dialoge (HTML, ~2 000 Zeilen) |
| `app.css` | Gestaltung (Farben über Variablen, hell/dunkel) |
| `i18n.js` | Übersetzungen `LANG` (de/fr/it) — wird vor `app.js` geladen |
| `app.js` | Programm der Oberfläche (Eingaben, Diagramm, Zeichnung, Abschnitt, PDF, Projekte) |
| `handbuch.html` | Handbuch DE/FR/IT — wird beim ersten Öffnen des Handbuchs geladen |
| `rechenkern.js` | Reine Rechnung (Zustandsgleichungen N-FL/R-FL/EL, Kettenlinie), in Node testbar |
| `abschnitt.js` | Abspannabschnitt: CSV, Feldlängen, KM, Stränge, Lastfälle, Abstandsprüfung |
| `fahrdrahthoehe.js` | hf_min / hf_max (Logik wie SBB-Excel) |
| `export3d.js` | 3D-DXF (R12) und IFC4 (EPSG:2056) |
| `sw.js` | Service Worker (offline), `CACHE_VERSION`, Liste `APP_DATEIEN` |
| `tests/*.test.js` | Node-Tests (Rechenkern, 27 SBB-Beispiele, hf 480 Excel-Fälle, Export, Abschnitt) |
| `tests/browser/*.test.js` | Playwright-Tests (Rundgang, 288 eingefrorene Rechenfälle) |
| `.github/workflows/tests.yml` | CI: beide Testläufe bei jedem Push/PR |

## Prüfen vor jedem Commit
```bash
npm test                                   # Node-Tests (Stand: 89, alle grün)
CHROMIUM_PFAD=/opt/pw-browsers/chromium npm run test:browser   # Browser (Stand: 70)
```
- Browser-Tests mit `timeout` starten (z. B. `timeout 900 …`); in Prüfskripten Playwright-
  Kontexte mit `serviceWorkers: 'block'`, sonst wird eine alte Fassung aus dem Cache geladen.
- Barrierefreiheit: axe-core (0 Verstösse ist der Stand) — Vorgehen in docs/UEBERGABE.md.

## Konventionen beim Ändern
- **Version** bei jeder Auslieferung an 4 Stellen erhöhen: `APP_VERSION` in app.js,
  `CACHE_VERSION` in sw.js (`durchhang-vX.Y.Z`), `package.json` und `package-lock.json`
  (Zeilen 3 und 9). Neue Dateien zusätzlich in `APP_DATEIEN` (sw.js) eintragen.
- **Jede sichtbare Änderung dreisprachig** (de/fr/it in `LANG` in `i18n.js`, `data-i18n…`-Attribute)
  und das **Handbuch** (`handbuch.html`, je Sprache ein Block `hb-de/hb-fr/hb-it`) nachführen.
- Neue Dateien: in `sw.js` (`APP_DATEIEN`) und, falls neuer Dateityp, im Testserver
  `tests/browser/hilfe.js` (`TYPEN`) eintragen.
- Funktionen im Modul `Projekte` (IIFE in app.js) sind nur über `window.…` global erreichbar —
  neue, per `onclick` aufgerufene Funktionen dort exportieren.
- Hell-/Dunkelmodus: Farben nur über CSS-Variablen (`:root` / `:root[data-thema="dunkel"]`).
  Canvas/SVG-Farben aus den Hilfsfunktionen (z. B. `diagrammFarben()`).
- Alle Checkboxen sind app-weit Schalter (Toggle); Ausnahme Klasse `.auswahl` (Auswahlkästchen).
- Touch-Geräte: alle Knöpfe haben min. 40 px Höhe (`@media (any-pointer: coarse)`). Kleine runde Knöpfe
  brauchen `min-height: 0` und eine unsichtbar vergrösserte Tippfläche (`::after`), sonst werden sie gestreckt.
- Neue Fenster (Dialoge) als `.modal-overlay` mit Klasse `open` öffnen, keine eigene `z-index` setzen:
  der Fensterstapel in app.js legt das zuletzt geöffnete nach oben (Ebenen in app.css beschrieben).
- App ist **produktiv** (v6.0): kein Wasserzeichen mehr (Bildschirm und PDFs), so vom Nutzer entschieden.
- **Entwicklermodus** für Unfertiges (zurzeit hf_min / hf_max): 3× schnell aufs App-Symbol, bleibt im
  Gerät (`localStorage dh_dev`), Schild «DEV». Unfertige UI mit Klasse `nur-dev` (auch im Handbuch),
  Logik über `entwicklerModus` (z. B. `hfGrenzenM()` liefert sonst `null`). Tests dafür mit
  `appOeffnen(browser, url, { dev: true })`. Freigabe einer Funktion = `nur-dev`/Abfragen entfernen.
- Projekte werden im Browser gespeichert (`getProjectState` / `setProjectState`);
  ältere Projekte müssen weiter ladbar sein (Migration beim Laden ergänzen, nie brechen).
- Für Rechenänderungen zuerst Test schreiben; die eingefrorenen Referenzfälle dürfen sich
  nur bewusst und mit Begründung ändern.
