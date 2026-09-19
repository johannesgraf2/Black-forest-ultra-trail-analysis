# BFUTR 2026 Race Analytics

Statische GitHub-Pages-Seite für die Analyse der BFUTR-2026-Zwischenzeiten. Kein Server und keine Datenbank nötig.

## Neue Analysefunktionen

- Platzgewinn und Platzverlust zwischen Checkpoints
- Top-% und Perzentil an jedem Messpunkt
- Abschnittsvergleich gegen Feldmedian, Top-10-%-Niveau oder schnellste Abschnittszeit
- automatisch erkannter stärkster und schwächster Abschnitt
- Pacing-Konstanz-Score auf Basis der Streuung relativ zum Feldmedian
- Perzentilkurve über den Rennverlauf
- Einzelanalyse und direkter Zwei-Personen-Vergleich

## Aktualisieren

```bash
python3 scripts/prepare_data.py /PFAD/bfutr_2026_zwischenzeiten_long.csv
```

Danach `data.js` committen und pushen.

## GitHub Pages

Repository → `Settings` → `Pages` → `Deploy from a branch` → `main` → `/(root)`.

## Datenlogik

- Eine Zielzeit zählt nur bei einer echten numerischen `Ziel`-Passage.
- Prognosen werden verworfen.
- Sonderwertungszeiten wie Bergpreis werden nicht als Zielzeit verwendet.
- Checkpoint-Ränge werden aus allen Personen mit echter Messzeit am jeweiligen Punkt neu berechnet.
- Personen ohne Zielresultat bleiben bis zu ihrem letzten gültigen Messpunkt in Checkpoint-Vergleichen enthalten.
- Top-10-%-Niveau entspricht der 10.-Perzentil-Zeit des jeweiligen Abschnitts.
- Pacing-Konstanz: 100 minus zweimal die Standardabweichung der Abschnittsabweichungen vom Feldmedian, begrenzt auf 0–100.

## Version 3 – zusätzliche Visualisierungen

Die v3 ergänzt vier visuelle Analysebausteine:

- kumulativer Zeitabstand zum Feldmedian, Top-10-%-Niveau oder zur schnellsten Referenz
- Perzentil-Verlauf, im Vergleichsmodus auch als Zwei-Personen-Kurve
- Abschnitts-Heatmap relativ zur gewählten Benchmark
- Zielzeit-Histogramm mit Median, Top-10-%-Grenze und persönlicher Markierung

Die Visualisierungen sind weiterhin vollständig statisch und benötigen keine externe Chart-Bibliothek.
