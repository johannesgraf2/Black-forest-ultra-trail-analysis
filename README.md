# BFUTR 2026 Race Analytics · v4

Statische GitHub-Pages-Seite für die Analyse der BFUTR-2026-Zwischenzeiten. Kein Server und keine Datenbank nötig.

## Version 4 · Vergleichsgruppen

- Die Karte „Einordnung · Ziel“ zeigt nur noch **Top x %**, ohne zusätzlichen Perzentilwert.
- **Vergleichsgruppe: Alle / Männer / Frauen** und **Referenz: Median / Top 10 % / Schnellste Zeit** stehen oben in beiden Analysemodi bereit.
- Die Gruppe steuert Abschnittsbalken, Heatmaps, Zeitabstand zur Referenz, Zielzeitverteilung, Medianwerte in der Tabelle sowie stärksten/schwächsten Abschnitt und Pacing-Konstanz.
- Die Auswahl wird im Link gespeichert (`group=men`, `group=women`; ohne Parameter: Alle).
- Die Zielzeitverteilung zeigt die Anzahl der gewerteten Finisher der Gruppe. Einzelne Vergleichspersonen können außerhalb dieser Gruppe liegen; ihre Markierungen verändern die Statistik nicht.

**Einordnung und Rang:** Gesamtrang, Top-% und Perzentilkurven beziehen sich weiterhin auf das Gesamtfeld der jeweiligen Distanz und sind entsprechend beschriftet. Der separat ausgewiesene Geschlechtsrang bezieht sich auf die Kategorie der Person. Die neue Auswahl bestimmt die Leistungsreferenzen, keine neue offizielle Rangliste.

**Datenbasis:** Verwendet wird die Geschlechtskategorie aus dem Export. „Alle“ enthält auch weitere oder offene Kategorien. Für jeden Abschnitt werden nur Personen mit beiden gültigen Messungen einbezogen; fehlende Daten werden nicht als null Sekunden behandelt. Ungewertete Personen wie Peter bleiben bis zum letzten gültigen Zwischenpunkt enthalten. Zielreferenzen und Zielzeitverteilungen verwenden nur gewertete Finisher. Die Referenzpopulation kann deshalb je Messpunkt unterschiedlich groß sein. Median, Top-10-%-Grenze und Bestzeit werden direkt aus den Einzelmessungen der gewählten Gruppe berechnet; die Top-10-%-Grenze ist ein linear interpoliertes 10. Perzentil.

### Diese Version hochladen

ZIP entpacken und den Inhalt des Projektordners in das bestehende Repository hochladen. Insbesondere müssen `index.html`, `app.js`, `v3.js`, `style.css` und die neue **`analytics.js`** zusammen aktualisiert werden. Danach wie bisher committen; die Pages-Adresse bleibt gleich. Die Datei `v3.js` enthält aus Kompatibilitätsgründen auch in v4 die zusätzlichen Diagramme.

Zum lokalen Öffnen genügt `index.html`; alle Berechnungen laufen im Browser. Alternativ im Projektordner `python3 -m http.server 8000` starten und `http://localhost:8000` öffnen.

### Prüfung

`node tests/analytics.test.cjs` prüft alle fünf Distanzen und drei Gruppen gegen unabhängig berechnete Referenzwerte sowie fehlende Daten und ungewertete Zielmessungen. Die JavaScript-Ansichten und Filterwechsel wurden zusätzlich mit einem DOM-Testmodell geprüft. Eine visuelle Browserprüfung war in der Erstellungsumgebung nicht verfügbar.

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

