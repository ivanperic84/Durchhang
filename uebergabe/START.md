# Durchhang – Weiterarbeiten lokal / mit anderem Account

Stand: 27. November 2026 · App-Version **v6.0.3** · alles auf `main`

> Dieser Ordner `uebergabe/` ist nur eine Starthilfe für den Wechsel von der Cloud auf den
> eigenen Computer bzw. einen anderen Account. Er gehört nicht zur App und kann jederzeit
> gelöscht werden (einfach Claude sagen: «Ordner uebergabe löschen und übernehmen»).

---

## 1. Wo alles liegt

| Was | Wo |
|---|---|
| Programm (Quelle) | GitHub: https://github.com/ivanperic84/Durchhang – Zweig **main** = aktueller Stand |
| Laufende App | https://ivanperic84.github.io/Durchhang/ (wird automatisch aus `main` veröffentlicht) |
| Arbeitsregeln für Claude | `CLAUDE.md` – Claude liest sie bei jedem Start automatisch |
| Ausführliche Übergabe | `docs/UEBERGABE.md` (Fachlogik, Entscheidungen, Verlauf, Offenes) |
| Lokaler Ordner | `~/projekte/Durchhang` (WSL Ubuntu) – im Windows-Explorer `\\wsl.localhost\Ubuntu\home\ivan_peric\projekte\claude-code-test` |
| Cloud-Arbeitszweig | `claude/upbeat-davinci-47k73d` – identisch mit `main`. Kann auf GitHub gelöscht werden («Branches» → Papierkorb), muss aber nicht. |

---

## 2. Lokalen Ordner mit GitHub abgleichen

Im **Ubuntu-Terminal**:

```bash
cd ~/projekte/Durchhang
bash uebergabe/abgleich.sh               # holt den aktuellen Stand von GitHub (main)
bash uebergabe/abgleich.sh --einrichten  # dasselbe + Prüfwerkzeuge einrichten (einmalig)
```

Das Skript arbeitet vorsichtig: Gibt es lokal noch Änderungen, die nicht auf GitHub sind,
hält es an und verändert nichts.

> Allererster Abgleich (solange `uebergabe/` lokal noch fehlt):
> `cd ~/projekte/Durchhang && git fetch origin && git checkout main && git pull --ff-only origin main`

### Einmalig nötig (falls noch nicht vorhanden)
- **Node.js** (LTS) und **Git** in Ubuntu
- **Claude Code** im Terminal (`claude`) oder die Claude Desktop-App
- **GitHub CLI** (`gh`), danach einmal `gh auth login` – damit Claude lokal Pull Requests
  erstellen und auf `main` übernehmen kann

### SBB-Grundlagen (nur lokal)
Excel, Reglagetabellen, PDFs usw. in den Ordner **`Grundlagen SBB`** im Projektordner legen.
Er wird nie zu GitHub hochgeladen (ist ausgeschlossen). So kann Claude z. B. die
Referenzblätter prüfen.

---

## 3. Claude starten und Start-Text einfügen

```bash
cd ~/projekte/Durchhang
claude
```
Account wechseln: in Claude `/logout`, danach `/login`.

**Erste Nachricht (einfach einfügen):**

> Hallo! Wir arbeiten weiter an der App «Durchhang» (dieses Repository, GitHub
> ivanperic84/Durchhang, App auf GitHub Pages). Lies zuerst `CLAUDE.md`,
> `docs/UEBERGABE.md` und `uebergabe/START.md` vollständig – dort stehen Regeln,
> Fachlogik, Entscheidungen und offene Punkte. Aktueller Stand: v6.0.3 auf `main`, alle
> Tests grün (Node 89, Browser 72). Bitte: immer auf Deutsch, einfach erklären (ich
> programmiere nicht), vor Aufgaben kurz klärende Fragen als Auswahl stellen, nach jeder
> Runde kurzer Bericht. «Übernehmen» heisst: Pull Request auf `main` und per Squash
> mergen. Keine SBB-Unterlagen und keine Bildschirmfotos ins Repository. Arbeite auf
> einem eigenen Arbeitszweig ab `main`. Bestätige kurz, dass du alles gelesen hast, und
> nenne die offenen Punkte.

Prüfen (macht Claude selbst, zur Info): `npm test` (89) und `npm run test:browser` (72,
inkl. 288 eingefrorene Rechenfälle).

---

## 4. Offene Punkte (Stand heute)

1. **hf_min / hf_max fertigstellen** – zurzeit nur im Entwicklermodus sichtbar
   (3× schnell aufs App-Symbol → Schild «DEV», Wäscheleine). Zum Freigeben die
   Ausblendung entfernen (steht in `CLAUDE.md`).
2. **Referenzblätter prüfen** (0161.1013.0001 «normal», 0161.1013.0003 «starr»,
   0161.1013.0005.1 c_proj/c_m, 0161.1010.0011/0012/0201, Zeichnung 0162.1020.0006,
   AB-EBV 2024) – braucht die Originale im Ordner `Grundlagen SBB`.
   Bereits bekannt: 0161.1013.0003 fehlt im Quellenverzeichnis des Handbuchs.
3. **Systemhöhe vs. Spannweite** – wartet auf die Seiten aus dem Siemens-Buch.
4. **NIS-Berechnung** – nur als GitHub-Issue #20 festgehalten, nicht umsetzen ohne Auftrag.
5. Kleinigkeiten: nicht aktive Stränge im Dunkelmodus kräftiger (Angebot offen);
   Strang-/Masttabelle am Handy breiter als der Bildschirm (bisher akzeptiert).

---

## 5. Was in den letzten Runden dazukam (Kurzüberblick)

- v5.0 Aufbau aufgeteilt (app.css, i18n.js, app.js, handbuch.html), «Alles sichern»
- v5.1 Einzelleiter: H frei eingebbar mit «↺», einheitliche Reglage-Infobox,
  Anzeige-Nachführung geprüft und Fehler behoben, Reglagewerte auf 100 N
- v5.2 Angepasste Reglagewerte werden im Projekt gespeichert («↺ SBB-Werte»)
- v5.3 Messpunkt-Bezug wählbar (Durchhang / Δh links / rechts / höchster Punkt)
- v6.0 Kein Wasserzeichen mehr, hf nur im Entwicklermodus
- v6.0.1–6.0.3 kompakte Strang-Felder, Wäscheleine im Entwicklermodus,
  Diagramm ohne Messpunkt folgt dem gewählten Bezug
