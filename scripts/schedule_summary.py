"""Create a public-safe publication receipt without serializing answer records."""
import datetime
import json
from pathlib import Path
import re
import sys


def summarize(plan):
    if not isinstance(plan, dict):
        raise ValueError("Schedule plan must be an object")
    dates = set()
    for key in plan:
        match = re.fullmatch(r"(\d{4}-\d{2}-\d{2})(?:_LEVEL_[1-5])?", key)
        if not match:
            raise ValueError("Invalid schedule slot identifier")
        dates.add(datetime.date.fromisoformat(match.group(1)).isoformat())
    return {"plannedSlots": len(plan), "dates": sorted(dates)}


if __name__ == "__main__":
    source, destination = map(Path, sys.argv[1:])
    destination.write_text(json.dumps(summarize(json.loads(source.read_text(encoding="utf-8"))), indent=2) + "\n", encoding="utf-8")
