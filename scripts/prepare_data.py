"""Build data/site-data.json from the AI Misalignment Watch CSVs.

Usage (from the repo root):
    python scripts/prepare_data.py

Inputs:  data/reports.csv, data/incidents.csv  (https://misalignmentwatch.com/data)
Output:  data/site-data.json  (one record per unique incident)
"""
import csv
import json
import re
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


def norm(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


def reported_by_developer(developer, report):
    """True if the model's developer is one of the organisations behind the report.
    None when the incident names no single developer."""
    dev = norm(developer)
    if dev in ("", "notstated", "severaldevelopers"):
        return None
    orgs = {norm(o) for o in re.split(r"[;,/]", report["all_organizations"] or report["organization"])}
    return any(o and (dev in o or o in dev) for o in orgs)


def first_fields(inc, r):
    """Fields describing the first report on an incident (used by the "Who told us?" chart)."""
    if r is None:
        return {"by": None, "byType": None, "doc": None, "reported": None, "self": None}
    return {
        "by": r["organization"],
        "byType": r["organization_type"],
        "doc": " ".join((r["original_title"] or r["title"]).split()),
        "reported": r["date_reported"][:10],
        "self": reported_by_developer(inc["model_developer"], r),
    }


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

    # Earliest report on each incident: who told us first, when, and in which document.
    first_report = {}
    for r in sorted(reports, key=lambda r: (r["role"] != "report", r["date_reported"], r["id"])):
        if r["incident_id"]:
            first_report.setdefault(r["incident_id"], r)

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
            **first_fields(inc, first_report.get(iid)),
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
    pub = [d for d in out if d["kind"] == "public"]
    print(f"  first reported by the model's own developer: {sum(d['self'] is True for d in out)} "
          f"({sum(d['self'] is True for d in pub)} of {len(pub)} public)")
    for label in BEHAVIORS.values():
        sub = [d for d in out if label in d["behaviors"]]
        t = sum(d["kind"] == "testing" for d in sub)
        print(f"  {label:28} {len(sub):3}  (testing {t}, public {len(sub) - t})")


if __name__ == "__main__":
    main()
