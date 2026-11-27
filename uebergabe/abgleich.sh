#!/usr/bin/env bash
# Abgleich des lokalen Ordners mit GitHub (Zweig main).
# Aufruf im Projektordner:   bash uebergabe/abgleich.sh
# Optional zusätzlich Prüfwerkzeuge einrichten:   bash uebergabe/abgleich.sh --einrichten
#
# Sicher: Bricht ab, wenn lokal noch Änderungen offen sind, statt etwas zu überschreiben.

cd "$(dirname "$0")/.." || exit 1

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "FEHLER: Dieser Ordner ist kein Git-Projekt."; exit 1
fi

echo "--- Projektordner: $(pwd)"
echo "--- Verbindung zu GitHub:"; git remote -v | head -1

if [ -n "$(git status --porcelain)" ]; then
  echo
  echo "HALT: Es gibt lokale Änderungen, die noch nicht auf GitHub sind:"
  git status --short
  echo
  echo "Nichts wurde verändert. Bitte zuerst klären (z. B. Claude fragen:"
  echo "«Was sind diese lokalen Änderungen – sichern oder verwerfen?»)."
  exit 1
fi

git fetch origin || { echo "FEHLER: GitHub nicht erreichbar."; exit 1; }
git checkout main || exit 1
if ! git pull --ff-only origin main; then
  echo
  echo "HALT: Der lokale Zweig main weicht von GitHub ab (eigene lokale Commits)."
  echo "Nichts wurde überschrieben. Bitte Claude fragen, wie zusammengeführt werden soll."
  exit 1
fi

echo
echo "--- Abgleich OK. Stand auf GitHub (main):"
git log --oneline -1
grep -o "APP_VERSION = '[^']*'" app.js | head -1

if [ "$1" = "--einrichten" ]; then
  echo
  echo "--- Prüfwerkzeuge einrichten (einmalig) ..."
  npm install && npx playwright install --with-deps chromium && echo "--- Fertig."
fi
