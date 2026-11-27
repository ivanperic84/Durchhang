# Systemdesign — Durchhang und Vierendeel

Gemeinsame Gestaltungsregeln für die Fahrleitungs-Werkzeuge «Durchhang» und
«Vierendeel». Ziel: beide Apps sehen gleich aus und werden gleich bedient;
Änderungen am Erscheinungsbild passieren an **einer** Stelle.

- Durchhang: Grundwerte in `app.css` (Block «Systemdesign: Grundwerte» und
  Farben in `:root` / `:root[data-thema="dunkel"]`), Diagrammschrift in
  `DIAGRAMM_SCHRIFT` (app.js).
- Vierendeel: `js/design.js` (`FARBEN`, `MASS`, `SCHRIFT`) → CSS-Variablen.

## Entscheide (27.11.2026)

| Frage | Entscheid | Bemerkung |
|---|---|---|
| Leitdarstellung | **hell** | dunkel bleibt als Umschaltung |
| Dichte | **luftig** (Durchhang) | einfachere App; Vierendeel bleibt kompakter |
| Schrift | **wie Vierendeel** | Systemschrift, Zahlen in Mono |
| Hinweisfarbe | **Mintgrün pastell** | für Hinweise und Startwerte |

## 1 Farben

Gleiche Werte in beiden Apps (Vierendeel `FARBEN.hell` / `FARBEN.dunkel`).

| Rolle | Durchhang | Vierendeel | hell | dunkel |
|---|---|---|---|---|
| Hintergrund | `--bg` | `--bg` | #f2f3f6 | #0e0f11 |
| Flächen vorn → hinten | `--card --s2 --s3 --s4` | `--s1 --s2 --s3 --s4` | #fff … #e4e7ec | #15161a … #2a2c32 |
| Rahmen | `--border --border2` | `--ol --ol2` | #dde0e6 / #c2c7d1 | |
| Schrift | `--text --text2` | `--on --on2` | #111218 / #3a3c48 | |
| Erklärtext (≥ 4.5 : 1) | `--muted --tertiary` | `--dim` | | |
| Nur Grafik | `--xdim` | `--xdim` | | |
| Akzent (Blau) | `--primary --acc-s` | `--acc --acc-s` | #4a5cb8 | #7c8de0 |
| Zustand | `--ok --warn --fail` (+ `-s` Fläche) | gleich | | |
| **Hinweis (neu)** | `--hinweis --hinweis-s` | *(übernehmen)* | Rand #8fd3b4, Fläche #e6f6ee | 40 % / 13 % Mint |

Regeln:
- Farben nur über Variablen; feste Farben nur für «Papier» (PDF, A4-Zeichnung).
- Schrift in Zustandsfarben hält 4.5 : 1 Kontrast (axe-Prüfung: 0 Verstösse).
- Grün / Gelb / Rot bedeuten **nur** erfüllt / knapp bzw. offen / nicht erfüllt.
  Hinweise (z. B. Startwerte) sind Mintgrün, nicht Gelb.

## 2 Schrift

| Zweck | Variable | Wert |
|---|---|---|
| Oberfläche | `--f-ui` | ui-sans-serif, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial |
| Zahlen | `--f-mono` | ui-monospace, SF Mono, Menlo, Consolas, Cascadia Code |
| PDF und A4-Zeichnung | — | Inter (eingebettet, bleibt für Dokumente) |

- Zahlen in Eingabefeldern und Ergebnissen in Mono mit gleich breiten Ziffern
  (`font-variant-numeric: tabular-nums`); Einheiten und Beschriftungen in `--f-ui`.
- Klasse `.zahl` für weitere Zahlenwerte.

### Schriftstufen

| Stufe | Variable | Grösse | Einsatz |
|---|---|---|---|
| XS | `--fs-xs` | .68rem ≈ 10.9 px | Kleingedrucktes, Einheiten, Achsen |
| S | `--fs-s` | .74rem ≈ 11.8 px | Erklärtexte, Hinweise, Tabellen |
| M | `--fs-m` | .8rem ≈ 12.8 px | Normaltext, Felder, Knöpfe |
| L | `--fs-l` | .9rem ≈ 14.4 px | Abschnittstitel, wichtige Werte |
| XL | `--fs-xl` | 1.05rem ≈ 16.8 px | Fenstertitel |
| XXL | `--fs-xxl` | 1.45rem | Kennzahl gross |
| Zahl | `--fs-zahl` | 1.7rem | Hauptergebnis |

Nie unter 10 px (auch in der Zeichnung: `fs(n)`, Test in `zeichnung.test.js`).
Pixelwerte nur dort, wo sie an Zeichnung oder Gerät gebunden sind.

## 3 Abstände, Rundungen, Bewegung

| | Variablen |
|---|---|
| Abstände | `--sp-1` .25rem · `--sp-2` .5rem · `--sp-3` .75rem · `--sp-4` 1rem · `--sp-5` 1.5rem |
| Rundungen | `--r-1` 4 px (klein: Marken, Tabellenzellen) · `--r-2` 10 px (Felder, Knöpfe, Karten) · `--r-3` 16 px (Fenster) |
| Bewegung | `--t-schnell` .12 s (Farbe) · `--t-mittel` .2 s (Zustand) · `--t-ruhig` .3 s (Lage, Grösse); eine Kurve `--t-kurve` |

`prefers-reduced-motion` schaltet Bewegung ab.

## 4 Bausteine

| Baustein | Regel |
|---|---|
| Feld | Beschriftung oben, Einheit rechts im Feld, Zahl in Mono. Startwert: grau-kursiv auf `--hinweis-s`. Fehler: Rahmen `--fail`. |
| Knopf | Text + optional SVG-Symbol; Hauptaktion in `--primary`. Touch: mind. 40 px hoch. |
| Umschalter | Segmente (Einzelleiter / R-FL / N-FL); aktives Segment hell abgehoben. Checkboxen sind Schalter (ausser `.auswahl`). |
| Reiter | Diagramm / Zeichnung / Abschnitt; gleiche Form wie Umschalter. |
| Kennzahl | Wert gross in Mono, Einheit klein in `--f-ui`, Beschriftung in Versalien `--fs-xs`. |
| Hinweis | Fläche `--hinweis-s`, Rand `--hinweis`, Text `--text2`, `--fs-s`. |
| Warnung / Nachweis | Zeichen ✓ / ✗ / ⚠ mit `--ok` / `--fail` / `--warn`. |
| Fenster | `.modal-overlay.open`, Stapel über app.js, Titel `--fs-xl`, Schliessen oben rechts. |
| Symbole | nur SVG, Strich 1.4–1.8, 14–16 px, `currentColor`; keine Emojis in der Oberfläche. |

## 5 Aufbau (Ausblick)

Vorgesehen: drei Bereiche am PC wie Vierendeel — **Eingabe | Diagramm |
Ergebnisse und Nachweis** —, Seiten einklappbar mit schmaler Leiste
(Kernwerte f, H, Nachweis bleiben sichtbar). Tablet: rechte Seite
eingeklappt. Handy: einspaltig wie heute. Noch nicht umgesetzt.

## 6 Offene Schritte

1. Einzelangaben (`style="…"`) in `index.html` (≈ 430) und `handbuch.html`
   (≈ 700) durch Klassen und Stufen ersetzen.
2. Rundungen (heute 15 Werte) und Abstände auf die Variablen umstellen.
3. Hinweisfarbe und Schriftstufen in Vierendeel übernehmen.
4. Dreiteiliges Fenster.
