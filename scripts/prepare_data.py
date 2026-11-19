"""Build data/site-data.json from the AI Misalignment Watch CSVs.

Usage (from the repo root):
    python scripts/prepare_data.py

Inputs:  data/reports.csv, data/incidents.csv  (https://misalignmentwatch.com/data)
Output:  data/site-data.json  (one record per unique incident)
"""
import csv
import json
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# Behavior tags we chart, in display order: dataset topic -> short label
BEHAVIORS = {
    "Cheating and reward hacking": "Cheating / reward hacking",
    "Deception and scheming": "Deception / scheming",
    "Unauthorized access": "Unauthorized access",
    "Cybersecurity": "Cybersecurity",
    "Sabotage": "Sabotage",
    "Self-preservation": "Self-preservation",
}
KIND = {"Testing incident": "testing", "Research or test": "testing", "Public incident": "public"}


def read(name):
    with open(DATA / name, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def topics(text):
    return {t.strip() for t in text.replace(";", ",").split(",") if t.strip()}


def main():
    reports = read("reports.csv")
    incidents = read("incidents.csv")

    tags = defaultdict(set)
    sources = defaultdict(list)
    report_count = defaultdict(int)
    for r in reports:
        iid = r["incident_id"]
        tags[iid] |= topics(r["topics"])
        report_count[iid] += 1
        if r["source_url"] and r["source_url"] not in sources[iid]:
            sources[iid].append(r["source_url"])

    out = []
    for inc in incidents:
        iid = inc["id"]
        all_topics = tags[iid] | topics(inc["topics"])
        out.append({
            "id": iid,
            "title": inc["title"],
            "kind": KIND[inc["kind"]],
            "month": inc["date_started"][:7],
            "dates": inc["dates"],
            "model": inc["ai_model"] or None,
            "developer": None if inc["model_developer"] in ("", "Not stated") else inc["model_developer"],
            "summary": inc["plain_summary"],
            "what": inc["what_happened"],
            "affected": inc["who_was_affected"],
            "reached": inc["quadrant"].startswith("Reached the real world"),
            "behaviors": [label for topic, label in BEHAVIORS.items() if topic in all_topics],
            "reports": report_count[iid],
            "page": inc["page"],
            "source": sources[iid][0] if sources[iid] else inc["page"],
        })

    out.sort(key=lambda d: (d["month"], d["id"]))
    payload = {
        "source": "AI Misalignment Watch (https://misalignmentwatch.com/data)",
        "generated": date.today().isoformat(),
        "lastReported": max(r["date_reported"] for r in reports),
        "reportCount": len(reports),
        "behaviors": list(BEHAVIORS.values()),
        "incidents": out,
    }
    (DATA / "site-data.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"{len(reports)} reports -> {len(out)} unique incidents")
    for label in BEHAVIORS.values():
        sub = [d for d in out if label in d["behaviors"]]
        t = sum(d["kind"] == "testing" for d in sub)
        print(f"  {label:28} {len(sub):3}  (testing {t}, public {len(sub) - t})")


if __name__ == "__main__":
    main()
