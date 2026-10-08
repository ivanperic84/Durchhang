# Übergabe Durchhang — Stand v4.5.2 (8. Oktober 2026)

Ziel dieser Datei: Eine neue Claude-Sitzung (auch unter einem anderen Account) kann
ohne Rückfragen zur Vorgeschichte weiterarbeiten. Die Kurzregeln stehen in `CLAUDE.md`
(wird automatisch gelesen); hier stehen Hintergrund, Fachlogik, Entscheidungen und Offenes.

---

## 1. Erste Schritte für eine neue Sitzung

1. Repo `ivanperic84/Durchhang` ist eingebunden? Sonst muss der Nutzer im neuen Account
   GitHub verbinden (claude.ai → Einstellungen → Connectors/GitHub) und der Claude-GitHub-App
   Zugriff auf das Repo geben.
2. `main` ist der aktuelle Stand (siehe Versionsverlauf unten). Arbeitszweig von `main` aus anlegen bzw.
   neu aufsetzen (`git fetch origin main && git checkout -B <zweig> origin/main`).
3. `npm ci` (lädt Playwright), dann `npm test` und die Browser-Tests laufen lassen
   (siehe Abschnitt 6). Alles muss grün sein, bevor etwas geändert wird.
4. Interne SBB-Unterlagen (Excel «Durchhang 2026.xlsm», Reglagetabellen 0161.1013.0001/0003,
   Prüfliste «Überprüfung Durchhang FACDA») lagen nur als Upload in der alten Sitzung vor
   und sind **nicht** im Repo. Werden sie wieder gebraucht, muss der Nutzer sie erneut
   hochladen. Daraus abgeleitete Zahlen stecken bereits in den Tests.

---

## 2. Der Nutzer und die Arbeitsweise

- Deutschsprachig (Schweiz), Fachmann Fahrleitung/Bahn, **keine Programmiererfahrung**.
- Präferenz (wörtlich): «klärende Fragen stellen bevor der Agent mit der Aufgabe anfängt.
  Habe keine Erfahrung im Programmieren.»
- Bewährter Ablauf jeder Runde:
  1. Bei Unklarheit 1–3 Auswahlfragen (empfohlene Option zuerst, «(Empfohlen)»).
  2. Umsetzen, Tests + Handbuch + Übersetzungen + Version.
  3. Bildschirmfoto der Änderung zeigen (aus dem Scratchpad, nicht aus dem Repo).
  4. Kurzer Bericht in einfachem Deutsch; fragen «Soll ich das auf main übernehmen?»
- «pushen / push / übernehmen / auf main übernehmen / auf main schreiben» ⇒ PR erstellen
  und **Squash-Merge auf main**. Danach Arbeitszweig für die nächste Runde von `main`
  neu aufsetzen (der Merge ist ein Squash, alte Zweig-Commits nicht weiterverwenden).
- Nach einem Merge erinnern: Auf dem Gerät 1–2× neu laden, dann erscheint die neue
  Version (Service Worker).
- Der Nutzer schickt oft Bildschirmfotos mit kurzen Notizen; mehrere Wünsche in einer
  Nachricht → alle abarbeiten und im Bericht einzeln bestätigen.
- Der Nutzer hat bei früheren Fragen Wert gelegt auf: professionelles Auftreten (kein
  Verweis auf das alte Excel-Tool), Lesbarkeit im Dunkelmodus, Tablet-Bedienung (Feld),
  korrekte FR/IT-Fachbegriffe (aus dem SBB-Excel-Glossar übernommen).

---

## 3. Was die App kann (Funktionsübersicht)

**Leitersysteme:** N-FL (Kettenwerk, Tragseilzugkraft ändert sich mit der Temperatur),
R-FL (Kettenwerk mit Nachspannung, konstante Zugkraft — Temperatur wirkt nicht),
Einzelleiter (EL, z. B. Speise-/Rückleiter).

**Einzelfeld (Hauptansicht)**
- Eingaben: Spannweite (einzeln oder Mittelspannweite Lm aus mehreren Feldern),
  Aufhängehöhen h₁/h₂ über SOK, Systemhöhe sh, Temperaturen T₁ (Montage/Messung),
  T₂ (Nachweis), T₃ (Vergleichskurve), Leiter/Kombination (Presets nach Reglage),
  Zugkraft H Ts (nach Reglage gesperrt, Spezialfall über «+»), Abnutzung, Eislast.
- Berechnungsart **Starr / Ausgleichend** (N-FL und EL).
- Messpunkte M1–M4 (x, gemessene Höhe), 3-Punkte-Messung; **H-Punkte H1–H4** je
  Messpunkt = Hindernis-Unterkante in m ü. M. (nur mit SOK m ü. M.), Punkte verbinden,
  Schloss je Messpunkt; Abstandsprüfung über alle **Lastfälle** (Band im Diagramm,
  Masslinie an massgebender Stelle). EL: Hindernis darf auch unterhalb liegen
  (automatisch erkannt, Abstand Leiter − Oberkante).
- **Mastangaben** (eingeklappt): SOK m ü. M. links/rechts, **Δ Mastfuss − SOK (optional,
  auch negativ)**, Name/Nr., KM (Format 000.000), Schalter **Koordinaten LV95** (E/N des
  Aufhängepunkts → Spannweite L).
- Ansichten (Reiter): **Diagramm**, **Zeichnung** (massstäblich, Überhöhung Start 5×),
  **Abschnitt**, **Foto** (zuletzt, ausgegraut — nur Abschätzung, Info-Modal 1× pro Start).
- Mitlaufende Ergebnisleiste (Tablet hochkant), Feld-Schnellauswahl oben (mit Abschnitt).
- **hf_min / hf_max** (Fahrdrahthöhe): eigene Ansicht (Knopf in der Kopfleiste), Werte
  live aus der Durchhang-Berechnung (nur c wählbar), Höhenleiter + Kurven über Spannweite,
  Zusammensetzung (Formel- und Zahlenzeile), PDF. Im Diagramm/Zeichnung als Schalter:
  Band + Prüfzeile (Soll-Fahrdrahthöhe h − sh an den Stützpunkten prüfen, Ist bei T₂ nur
  Info), Rückfrage «Anschlusshöhe anpassen» (Systemhöhe wird nie automatisch angepasst).
  Beim Einzelleiter ausgegraut (kein Fahrdraht).
- Exporte (Menü «Teilen» in der Kopfleiste): Berechnungs-PDF, Zeichnungs-PDF (helles
  App-Design, Inter, Akzentblau), 3D-DXF, IFC4, Projekt-JSON.
- Projekte/Gruppen im Browser speichern (Datei-Dialog), Serienbericht, JSON-Import/Export.
- Handbuch (Dialog, DE/FR/IT) mit Kapitelleiste links und Suche.
- Hell/Dunkel/Auto, Design nach Vorlage https://ivanperic84.github.io/vierendeel/
  (Akzentblau #4a5cb8 hell / #7c8de0 dunkel). Wasserzeichen «BETA – nicht verifiziert».
- Sprachen DE/FR/IT vollständig (Test prüft auf fehlende Schlüssel).

**Abschnitt (Reiter «Abschnitt»)**
- Masttabelle: Mast, E, N (Aufhängepunkt LV95), **Z = SOK m ü. M.**, Δ Mastfuss (opt.),
  h über SOK, KM (000.000), L bis nächster (sonst aus Koordinaten oder KM-Differenz).
- CSV-Import/Export/Vorlage: Kopf `Strang;Mast;E;N;Z_SOK;Delta_Mastfuss_SOK;h_ueber_SOK;KM;L_bis_naechster`
  (Spalte Strang optional; Kopfnamen werden tolerant erkannt, Dezimalkomma, Tausender-
  trenner). Alte Spalte `Z_Mastfuss` wird erkannt und umgerechnet (SOK = Z − Δ).
- **Mehrere Stränge** an denselben Masten (bis 5 üblich, max. 8): Übersicht mit Sichtbar,
  Farbe, Kennung, Rolle (Fahrleitung, Speiseleiter, Rückleiter, Erdseil/Schutzleiter,
  Andere), System, Masten von–bis, Länge, Hindernis-Nachweis; «Wählen», «+ Strang», ✕.
  Leitersystem je Strang gespeichert; T₂ und Lastfälle gemeinsam.
- Längsprofil: alle sichtbaren Stränge übereinander in eigener Farbe; aktiver Strang
  kräftig, übrige 45 % deckend; im Dunkelmodus Neon-Töne. Mit einem Strang: Leiter in
  Temperaturfarbe von T₂. 50+ Felder → seitlich scrollbar.
- Teilabschnitt Mast von–bis: nur Anzeige und Export (Rechnung immer ganzer Abschnitt).
- Export IFC (IfcGroup je Strang) / 3D-DXF (Layer je Strang, z. B. `SPL_LEITER`).
- «Beispiel laden»: 5 Masten, Stränge FL1 (Kettenwerk, h 7.60), RL (Rückleiter am Mast,
  h 6.80), SPL (Speiseleitung Mastspitze, h 10.50).

---

## 4. Fachlogik (verifiziert — nicht ohne Grund ändern)

**N-FL wie SBB-Excel «Durchhang 2026.xlsm»**
- Bezugszustand F0 = Tragseil belastet bei **10 °C** (`NFL_BEZUGSTEMPERATUR`), auf 10 N
  gerundet (`runde10`); Zugkraft bei T: `nflZugkraftBei` rundet auf 5 N (mit Eis 10 N).
- Abnutzung Fahrdraht über `mflAbgenutzt` (qFdAbnutzung Cu107 9.1594111, Cu150 13.533177).
- Starr: Reglagetabelle «starr» (SBB 0161.1013.0003), Mittelspannweite gesperrt.
  EL starr: Referenzspannweite 25 m, Zugkraft auf 100 N gerundet.
- Reglagetabelle «normal» 0161.1013.0001: Referenzspannweite 45 m gilt für die
  Reglage-**Zugkraft**, nicht für die Systemhöhe.
- R-FL: Abnutzung als negative Zusatzlast × H_Ts/(H_Ts+H_Fd); Fahrdraht-Verschiebung
  nach VEM 7.53a (`rflFahrdrahtVerschiebung`).
- Verifikation: **27 SBB-Beispielrechnungen** (Toleranz 7.5 mm) als Test
  `tests/beispiele_sbb.test.js` / `referenzfaelle.json`; 288 Rechenfälle im Browser
  eingefroren (`tests/browser/rechenfaelle_referenz.json`).

**Lastfälle (Abstandsprüfung)**, je System einstellbar: Temperaturen Vorgabe −20 °C und
+80 °C; Eislast Z_L **nur bei −5 °C** (Vorgabe 15 N/m, überschreibbar); Fahrdraht neu/
abgenutzt (nicht bei EL). Mindestabstand a wird berücksichtigt. Schalter «Alle Lastfälle»
aus ⇒ nur aktueller Zustand T₂.

**hf_min / hf_max** (`fahrdrahthoehe.js`, wie Excel; 480 Vergleichsfälle identisch)
- hf_min = GfA + k + be + f + H + Zhf_min; GfA: EBV1 4570, EBV2/3 4670, EBV4 4840;
  k: EBV1 70 sonst 0; be: 25 kV 270 sonst 150.
- Zhf_min = fg + thu + fud + fuv + fFDmaxZL + fFDmax40 (fg Schotter N 60 / J 100, BÜ 0;
  thu v>140 → 10 sonst 20; fud stückweise aus c; fuv nur R-FL und v ≤ 140 (Tabelle);
  fFDmaxZL nur R-FL mit festen 12 + 10 kN; fFDmax40 nur N-FL:
  c²/8 · (gk + ZL − gk·H_Tx/H_t0)/(H_Fd + H_Tx) · 1000 mit H_t0/H_Tx aus dem Rechenkern).
- hf_max = 6050 (LRP J) / 6200 (LRP N) − Zhf_max (tho, fudo = 0.8·fud, −fuv, fh 75, −fFDmin).
- BÜ: 5510 + Z (Hinweise wie Excel). Spannweiten c nur aus der Liste 60…26, 24, 20, 16,
  12, 8; Temperaturen −20…80 in 5-K-Schritten; ZL 0/7/15 nur bei −5 °C.
- Excel-Testfall: N-FL 50+107, c 30, tx −5, ZL 7 → hf_min 4927.95, hf_max 6104.35.
- Zulässige Anschlusshöhe: hf_min + sh ≤ h ≤ hf_max + sh (nach innen auf cm gerundet).

**Höhen**: Z der Masten = SOK m ü. M. (seit v4.4.0; vorher Mastfuss). Mastfuss = SOK + Δ.
Der Rechenkern kennt nur Höhen über SOK; SOK-Differenz der Masten macht die App.
**Bewusster Entscheid des Nutzers (v4.5.2):** Die Rechnung verwendet als Höhendifferenz der
Aufhängepunkte nur h₂ − h₁, **ohne** den SOK-Unterschied zwischen den Masten. Für die
Darstellung in m ü. M. wird der SOK-Anstieg linear addiert (Diagramm, Profil, Karte).
Folge bei schräger SOK: H unverändert, Durchhang einige cm und Tiefpunkt-Lage leicht
anders als mit echter Höhendifferenz (Beispiel Feld 102–103: 0.863 statt 0.843 m,
Tiefpunkt ~3 m versetzt). Nicht ohne neue Rückfrage beim Nutzer ändern.
Δh an Messpunkten = Abstand von der Horizontalen durch den linken Aufhängepunkt
(m ü. M.) bis zum Seil — auf Karte, Ergebnisleiste und im Diagramm identisch.
Foto-Messung: Fusspunkte am Mastfuss ⇒ Höhe über SOK = gemessen + Δ, Höhenunterschied
mit SOK-Differenz (seit v4.4.0; vorher wurde die SOK-Differenz ignoriert).

---

## 5. Technik im Detail

- **index.html** ist eine Datei mit allem. Wichtige Bereiche (Suchbegriffe):
  `const LANG = {` (Übersetzungen de/fr/it), `function getProjectState`,
  `_setProjectStateIntern`, `const Ansicht = (() =>` (Zeichnung/Ansichten als IIFE —
  neue Funktionen über das Rückgabeobjekt und `window.X = Ansicht.X` freigeben),
  `ABSPANNABSCHNITT`, `Mehrere Stränge an denselben Masten`, `function renderHf`,
  `function themaAnwenden`, Handbuch in Blöcken `hb-de / hb-fr / hb-it`.
- Übersetzung: `t('schluessel')`; HTML-Attribute `data-i18n`, `data-i18n-html`,
  `data-i18n-ph`, `data-i18n-title`, `data-i18n-aria`.
- Projektzustand (`getProjectState`): Felder, sysMode, spans, `abschnitt` (mit
  `zBezug: 'sok'`, `straenge[]`, `aktiv`, `teil`), `messpunkte`, `lastfaelle`, `hf`,
  `drawingHf`, `diagrammHf`, `fotoState` u. a. Migrationen beim Laden:
  alte Hindernislisten → H-Punkte; Abschnitt ohne `zBezug` → SOK = Z − Δ; KM → 000.000;
  Projekte ohne Stränge → ein Strang.
- **Stränge**: `abschnitt.masten/offen/mp` gehören immer zum aktiven Strang;
  `abschnitt.straenge[k] = {kennung, rolle, farbe, sichtbar, masten, offen, mp, zustand}`;
  Wechsel = `setProjectState` mit dem gespeicherten `zustand`; nicht aktive Stränge
  werden im Hintergrund nachgerechnet (Cache nach `_strangSchluessel`).
  Farben: gespeichert immer die helle Standardfarbe (`STRANG_FARBEN`), Anzeige im
  Dunkelmodus über `_strangFarbeAnzeige` (`STRANG_FARBEN_DUNKEL`).
- Service Worker: Netzwerk zuerst für HTML/JS, Cache als Rückfall; `CACHE_VERSION`
  bei jeder Auslieferung erhöhen.
- Schriften lokal (`fonts/`, Inter, SIL OFL) — keine externen Server.
- IFC4: IfcCableSegment + IfcSweptDiskSolid, IfcMapConversion EPSG:2056 (LV95/LN02),
  Pset `CH_Durchhang`; mit IfcOpenShell validiert (0 Befunde). DXF R12, Layer-Farben
  in `DXF_LAYER` (export3d.js).

---

## 6. Prüfen

```bash
npm ci
npm test                                                     # 89 Node-Tests
CHROMIUM_PFAD=/opt/pw-browsers/chromium timeout 900 npm run test:browser   # 54 Browser-Tests
```
- In der Claude-Cloud-Umgebung ist Chromium unter `/opt/pw-browsers/chromium`
  vorinstalliert (nicht `playwright install` ausführen). CI (GitHub Actions) installiert
  selbst.
- Einzelne Browser-Tests: `node --test --test-name-pattern="Stränge" tests/browser/rundgang.test.js`.
- Sichtprüfung/Bildschirmfotos: lokalen Server starten (`python3 -m http.server 8765`
  im Repo, im Hintergrund) und ein Playwright-Skript **im Scratchpad** ausführen, Kontext
  mit `serviceWorkers: 'block'`, `colorScheme: 'dark'` für den Dunkelmodus. PNGs nur im
  Scratchpad speichern.
- Barrierefreiheit: axe-core (npm-Paket `axe-core`, im Scratchpad installieren) per
  `page.addScriptTag` laden und `axe.run()` in den Zuständen Hauptansicht, Diagramm + hf,
  Zeichnung, Abschnitt (mit Strängen), hf-Ansicht, Lastfälle, Datei, Reglage, Handbuch —
  je hell und dunkel; das Wasserzeichen `#beta-wz` ausschliessen. Stand: 0 Verstösse.
- Exporte gelegentlich mit Python prüfen (`ezdxf`, `ifcopenshell`).

---

## 7. Offene Punkte / Ideen

1. **NIS-Berechnung** (Magnetfeld 16.7 Hz, IFC-Export) — nur festgehalten in
   GitHub-Issue #20, **nicht umsetzen**, bis der Nutzer es ausdrücklich verlangt
   (Voraussetzungen und Klärungspunkte stehen im Issue).
2. **Systemhöhe vs. Spannweite** (Frage des Nutzers): Hängt die Systemhöhe mit der
   45-m-Referenz zusammen, könnte man bei kürzeren Spannweiten sh reduzieren? Das
   Siemens-Fahrleitungsbuch lag nicht vor. Grundsatz: sh ≥ Tragseil-Durchhang bei
   grösster Spannweite + Mindesthängerlänge. Der Nutzer wollte die Systemhöhe bewusst
   **nicht** anpassen lassen. Weiter, sobald er die Buchseiten hochlädt.
3. Angebot offen: nicht aktive Stränge im Dunkelmodus etwas kräftiger (heute 45 %).
4. Handy: Strang- und Masttabelle sind breiter als der Bildschirm (seitlich scrollbar) —
   bisher akzeptiert.
5. Hinweis an den Nutzer bereits gegeben: Foto-Messung berücksichtigt seit v4.4.0 die
   SOK-Differenz (kann andere Werte als früher ergeben).
6. Releases: Tags `v1.0-stable`, `v4.0`, `vor-verbesserungen-2026-09-26` existieren.
   Tags kann Claude über den Proxy nicht pushen und Zweige nicht löschen — der Nutzer
   macht das auf GitHub (Releases bzw. «Delete branch»).

---

## 8. Versionsverlauf (Kurzfassung, alles auf main)

| Version | PR | Inhalt |
|---|---|---|
| bis v3.4 | – | Rechenfehler behoben, PWA/offline, Rechenkern ausgelagert, N-FL wie Excel (10 °C, Rundung, Starr/Ausgleichend), 27 SBB-Beispiele als Tests, Hell/Dunkel im Vierendeel-Design, blaue Icons, Audit Barrierefreiheit |
| v3.5–v3.9.1 | #1 | Ergebnisleiste Tablet, Foto-Hinweis, FR/IT-Begriffe wie Excel, Koordinaten LV95, 3D-DXF, IFC4, R-FL-Fahrdraht VEM 7.53a, Browser-Tests in CI, Abschnitt + Abstandsprüfung, Eislast, Foto-Reiter zuletzt |
| v3.10–v3.11 | #2 | hf_min/hf_max-Ansicht, Δ zu Koordinaten, Hindernisse nur m ü. M., hf-Grafiken, Wasserzeichen BETA |
| v3.12–v3.13.6 | #3–#7 | H-Punkte H1–H4 + Schloss, Schalter statt Kästchen, Zeichnung Kettenwerk, hf-Band, 480 Excel-hf-Fälle, Icon Akzentblau, toter Code entfernt |
| v3.13.7–v3.14 | #8–#9 | Animationen (transform/opacity, reduzierte Bewegung), sanfter Systemwechsel, Kopfleiste kompakt mit «Teilen», hf im Diagramm |
| v3.15–v3.16.2 | #10–#12 | hf-Ansicht gekoppelt, Soll-Prüfung, H Ts gesperrt, weicher Ansichtswechsel, Anschlusshöhe aus hf, PDFs im App-Design, Hindernis unterhalb (EL), Lastfall-Band |
| v3.16.3–v3.16.5 | #13–#14 | Minuswerte bei Lastfällen, Zusatzlast nur −5 °C, EL-hf ausgegraut, App-Symbol dunkel (`-v2`) |
| v4.0.0 | #15 | Zeichnung im Dunkelmodus, Zeichnungstexte übersetzt |
| v4.1–v4.2.2 | #16–#18 | Handbuch mit Kapitelleiste und Suche, Excel-Bezug entfernt, Beispiel laden, BIM-Ablauf, Längsprofil Temperaturfarbe, 50+ Felder |
| v4.3.0 | #19 | Feld-Schnellauswahl, H/a im Zeichnungsband, Scroll-Korrekturen |
| v4.4.0 | #21 | Mehrere Stränge pro Abschnitt; Z = SOK statt Mastfuss, Δ optional, Foto mit Δ |
| v4.5.0 | #22 | KM 000.000, Δ negativ tippbar, Beispiel mit 3 Strängen, Transparenz |
| v4.5.1 | #23 | Auswahlkästchen im App-Design, Neon-Strangfarben im Dunkelmodus |
| v4.5.2 | – | Δh der Messpunkte auf der Karte = Diagramm (SOK-Anstieg berücksichtigt) |

Issue #20: NIS (später).
