# BFUTR 2026 Race Analytics

Statische GitHub-Pages-Seite für die Analyse der BFUTR-2026-Zwischenzeiten. Sie benötigt keinen Server und keine Datenbank.

## Veröffentlichen auf GitHub Pages

1. Neues öffentliches GitHub-Repository anlegen, zum Beispiel `bfutr-2026-analysis`.
2. Den **Inhalt dieses Ordners** in den Root des Repositories hochladen.
3. In GitHub `Settings` → `Pages` öffnen.
4. Unter `Build and deployment` die Quelle `Deploy from a branch` wählen.
5. Branch `main`, Ordner `/ (root)` auswählen und speichern.
6. Nach kurzer Zeit zeigt GitHub dort die öffentliche Pages-URL an.

## Daten aktualisieren

Wenn du später einen neueren Datasport-Export hast, reicht die Long-CSV. Im Projektordner ausführen:

```bash
python3 scripts/prepare_data.py /PFAD/bfutr_2026_zwischenzeiten_long.csv
```

Dadurch wird `data.js` neu erzeugt. Danach `data.js` committen und pushen; GitHub Pages aktualisiert die Seite automatisch.

Das Skript verwendet nur die Python-Standardbibliothek.

## Datenlogik

- Eine Zielzeit zählt nur, wenn eine echte numerische Passage am Messpunkt `Ziel` vorliegt.
- Prognosen werden verworfen.
- Sonderwertungszeiten wie der Bergpreis werden nicht als Zielzeit verwendet.
- Checkpoint-Ränge werden aus allen Personen mit einer echten Messzeit am jeweiligen Punkt neu berechnet.
- Personen ohne Zielresultat bleiben bis zu ihrem letzten gültigen Messpunkt in Checkpoint-Vergleichen enthalten.
- Abschnittszeiten werden aus zwei aufeinanderfolgenden Passagezeiten berechnet.

## Dateien

- `index.html` – Seitenstruktur
- `style.css` – Layout und Responsive Design
- `app.js` – Suche, Einzelanalyse, Vergleich, Tabellen und Diagramme
- `data.js` – vorbereitete Renndaten
- `scripts/prepare_data.py` – erzeugt `data.js` aus der Long-CSV
