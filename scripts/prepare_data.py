#!/usr/bin/env python3
"""Prepare static BFUTR 2026 analytics data for GitHub Pages.

Usage:
    python3 scripts/prepare_data.py /path/to/bfutr_2026_zwischenzeiten_long.csv

Only the Python standard library is required.
"""

import csv
import json
import math
import os
import re
import statistics
import sys
import unicodedata
from collections import defaultdict

RACE_META = {
    "BFUTR 19": {"distanceKm": 19, "label": "BFUTR 19"},
    "BFUTR 33": {"distanceKm": 33, "label": "BFUTR 33"},
    "BFUTR 52": {"distanceKm": 52, "label": "BFUTR 52"},
    "BFUTR 79": {"distanceKm": 79, "label": "BFUTR 79"},
    "BFUTR EXTREME": {"distanceKm": 105, "label": "BFUTR EXTREME"},
}

KNOWN_ORDERS = {
    "BFUTR 19": ["Start", "Höfener Hütte", "Schützen", "Ziel"],
    "BFUTR 33": ["Start", "Höfener Hütte", "Zastler", "Oberried", "Rappeneck", "Dietenbach", "Ziel"],
    "BFUTR 52": ["Start", "Höfener Hütte", "Raimartihof", "Todtnauer Hütte", "St. Wilhelm", "Oberried", "Rappeneck", "Dietenbach", "Ziel"],
    "BFUTR 79": ["Start", "Höfener Hütte", "Raimartihof", "Todtnauer Hütte", "Zentrum Todtnau", "St. Wilhelm", "Oberried", "Rappeneck", "Schauinsland", "Dietenbach", "Ziel"],
    "BFUTR EXTREME": ["Start", "Höfener Hütte", "Raimartihof", "Todtnauer Hütte", "Zentrum Todtnau", "St. Wilhelm", "Oberried", "Rappeneck", "Schauinsland", "Dietenbach", "Schützen", "Zastler", "Oberried 2", "Rappeneck 2", "Dietenbach 2", "Ziel"],
}


def parse_time(value):
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    if text.startswith("{") or "Prognose" in text:
        return None
    text = text.replace(",", ".")
    parts = text.split(":")
    try:
        if len(parts) == 1:
            return round(float(parts[0]), 1)
        if len(parts) == 2:
            return round(int(parts[0]) * 60 + float(parts[1]), 1)
        if len(parts) == 3:
            return round(int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2]), 1)
    except (TypeError, ValueError):
        return None
    return None


def canonical_checkpoint(name):
    if not name:
        return None
    value = str(name).strip()
    if value == "Schutzen":
        return "Schützen"
    return value


def infer_gender(list_name):
    value = str(list_name or "").lower()
    if "frauen" in value:
        return "Frauen"
    if "männer" in value or "maenner" in value:
        return "Männer"
    if "nichtbin" in value:
        return "Nichtbinär"
    return "Offen"


def display_name(source_name):
    value = str(source_name or "").strip()
    tokens = value.split()
    if len(tokens) == 2:
        return tokens[1] + " " + tokens[0]
    return value


def normalize_search(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", text.lower()).strip()


def participant_id(race, bib, index_value):
    race_slug = re.sub(r"[^a-z0-9]+", "-", race.lower()).strip("-")
    bib_text = str(bib or "").strip()
    if bib_text:
        return race_slug + "-" + bib_text
    return race_slug + "-row-" + str(index_value)


def competition_rank(values, target):
    if target is None:
        return None
    return 1 + sum(1 for value in values if value < target)


def median_or_none(values):
    cleaned = [value for value in values if value is not None]
    if not cleaned:
        return None
    return round(statistics.median(cleaned), 1)


def quantile_or_none(values, q):
    cleaned = sorted(value for value in values if value is not None)
    if not cleaned:
        return None
    if len(cleaned) == 1:
        return round(cleaned[0], 1)
    position = (len(cleaned) - 1) * q
    lower = int(math.floor(position))
    upper = int(math.ceil(position))
    if lower == upper:
        return round(cleaned[lower], 1)
    fraction = position - lower
    value = cleaned[lower] + (cleaned[upper] - cleaned[lower]) * fraction
    return round(value, 1)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/prepare_data.py /path/to/bfutr_2026_zwischenzeiten_long.csv")
        return 2

    source_path = os.path.abspath(sys.argv[1])
    if not os.path.exists(source_path):
        print("Datei nicht gefunden: " + source_path)
        return 2

    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(project_root, "data.js")

    participants_by_key = {}
    row_order = []

    with open(source_path, "r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, delimiter=";")
        for row_index, row in enumerate(reader):
            race = str(row.get("Wettbewerb") or "").strip()
            name = str(row.get("Name") or "").strip()
            bib = str(row.get("Startnr") or "").strip()
            if not race or not name:
                continue

            key = (race, bib, name)
            if key not in participants_by_key:
                item = {
                    "id": participant_id(race, bib, row_index),
                    "race": race,
                    "bib": bib,
                    "name": name,
                    "displayName": display_name(name),
                    "club": str(row.get("Ort/Verein") or "").strip(),
                    "gender": infer_gender(row.get("Liste")),
                    "sourceStatus": str(row.get("Status") or "").strip(),
                    "sourceList": str(row.get("Liste") or "").strip(),
                    "splits": [],
                }
                participants_by_key[key] = item
                row_order.append(key)

            item = participants_by_key[key]
            checkpoint = canonical_checkpoint(row.get("Messpunkt"))
            seconds = parse_time(row.get("Zwischenzeit"))
            if checkpoint and seconds is not None:
                if not any(split["checkpoint"] == checkpoint for split in item["splits"]):
                    item["splits"].append({
                        "checkpoint": checkpoint,
                        "sec": seconds,
                        "raw": str(row.get("Zwischenzeit") or "").strip(),
                    })

    participants = [participants_by_key[key] for key in row_order]

    for item in participants:
        split_map = {split["checkpoint"]: split for split in item["splits"]}
        finish_split = split_map.get("Ziel")
        item["finalSec"] = finish_split["sec"] if finish_split else None
        item["officialFinisher"] = bool(item["finalSec"] is not None and item["sourceStatus"] == "Finish")
        if item["officialFinisher"]:
            item["status"] = "Finish"
        elif item["sourceStatus"] == "Keine Messzeit":
            item["status"] = "Keine Messzeit"
        else:
            item["status"] = "Kein Zielresultat"

        reverse_tokens = " ".join(reversed(item["name"].split()))
        aliases = [item["name"], item["displayName"], reverse_tokens, item["bib"], item["club"], item["race"]]
        item["search"] = normalize_search(" ".join(aliases))

    by_race = defaultdict(list)
    for item in participants:
        by_race[item["race"]].append(item)

    for race, group in by_race.items():
        finishers = [item for item in group if item["officialFinisher"]]
        overall_times = [item["finalSec"] for item in finishers]
        gender_times = defaultdict(list)
        for item in finishers:
            gender_times[item["gender"]].append(item["finalSec"])

        for item in group:
            if item["officialFinisher"]:
                item["finishRankOverall"] = competition_rank(overall_times, item["finalSec"])
                item["finishFieldOverall"] = len(overall_times)
                item["finishRankGender"] = competition_rank(gender_times[item["gender"]], item["finalSec"])
                item["finishFieldGender"] = len(gender_times[item["gender"]])
            else:
                item["finishRankOverall"] = None
                item["finishFieldOverall"] = len(overall_times)
                item["finishRankGender"] = None
                item["finishFieldGender"] = len(gender_times[item["gender"]])

    for race, group in by_race.items():
        checkpoint_values = defaultdict(list)
        checkpoint_gender_values = defaultdict(lambda: defaultdict(list))
        for item in group:
            for split in item["splits"]:
                if split["checkpoint"] == "Start":
                    continue
                checkpoint_values[split["checkpoint"]].append(split["sec"])
                checkpoint_gender_values[split["checkpoint"]][item["gender"]].append(split["sec"])

        for item in group:
            for split in item["splits"]:
                checkpoint = split["checkpoint"]
                if checkpoint == "Start":
                    split["rankOverall"] = None
                    split["fieldOverall"] = None
                    split["rankGender"] = None
                    split["fieldGender"] = None
                    continue
                values = checkpoint_values[checkpoint]
                gender_values = checkpoint_gender_values[checkpoint][item["gender"]]
                split["rankOverall"] = competition_rank(values, split["sec"])
                split["fieldOverall"] = len(values)
                split["rankGender"] = competition_rank(gender_values, split["sec"])
                split["fieldGender"] = len(gender_values)

    benchmarks = {}
    race_orders = {}
    for race, group in by_race.items():
        known = list(KNOWN_ORDERS.get(race, []))
        observed = []
        for item in group:
            for split in item["splits"]:
                if split["checkpoint"] not in observed:
                    observed.append(split["checkpoint"])
        order = [cp for cp in known if cp in observed]
        order.extend(cp for cp in observed if cp not in order)
        race_orders[race] = order

        passage = {}
        section = {}
        for checkpoint in order:
            values = []
            for item in group:
                mapping = {split["checkpoint"]: split["sec"] for split in item["splits"]}
                if checkpoint in mapping:
                    values.append(mapping[checkpoint])
            passage[checkpoint] = {
                "medianSec": median_or_none(values),
                "count": len(values),
            }

        for index_value in range(1, len(order)):
            previous = order[index_value - 1]
            current = order[index_value]
            values = []
            for item in group:
                mapping = {split["checkpoint"]: split["sec"] for split in item["splits"]}
                if previous in mapping and current in mapping:
                    delta = round(mapping[current] - mapping[previous], 1)
                    if delta >= 0:
                        values.append(delta)
            key = previous + " → " + current
            section[key] = {
                "medianSec": median_or_none(values),
                "top10Sec": quantile_or_none(values, 0.10),
                "winnerSec": round(min(values), 1) if values else None,
                "count": len(values),
            }

        finish_times = [item["finalSec"] for item in group if item["officialFinisher"]]
        benchmarks[race] = {
            "passage": passage,
            "section": section,
            "finishMedianSec": median_or_none(finish_times),
            "finishers": len(finish_times),
            "entrants": len(group),
        }

    favorite_bibs = {
        ("BFUTR 19", "4075"),
        ("BFUTR 19", "4028"),
        ("BFUTR 19", "4258"),
        ("BFUTR 19", "4038"),
        ("BFUTR 52", "2083"),
        ("BFUTR 19", "4267"),
    }
    favorites = [item["id"] for item in participants if (item["race"], item["bib"]) in favorite_bibs]

    payload = {
        "title": "Black Forest Ultra Trail 2026",
        "dataNote": "Aus dem bereitgestellten Datasport-Export. Zielzeiten werden aus der gemessenen Ziel-Passage abgeleitet; Prognosen und Sonderwertungszeiten werden nicht als Zielzeit verwendet.",
        "participantCount": len(participants),
        "raceMeta": RACE_META,
        "raceOrders": race_orders,
        "benchmarks": benchmarks,
        "favorites": favorites,
        "participants": participants,
    }

    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write("window.BFUTR_DATA = ")
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        handle.write(";\n")

    print("Erstellt: " + output_path)
    print("Teilnehmer: " + str(len(participants)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

