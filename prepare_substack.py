#!/usr/bin/env python3
"""
prepare_substack.py

Converts a raw LOG markdown file (e.g. logs/2026/log-011.md) into a
Substack-ready export:

  1. Strips the [ INTERNAL — DO NOT PUBLISH ] block (or equivalent)
  2. Converts any markdown pipe-tables into arrow/code-block format,
     since Substack's editor has no native table support
  3. Runs the Archive Bible pre-publish checklist and reports warnings

Usage:
    python scripts/prepare_substack.py logs/2026/log-011.md

Output:
    publish-ready/log-011.md
"""

import re
import sys
from pathlib import Path

INTERNAL_HEADING_RE = re.compile(
    r"^#{1,3}\s*\[?\s*INTERNAL\b", re.IGNORECASE | re.MULTILINE
)
TABLE_SEPARATOR_RE = re.compile(r"^\s*\|?[\s:\-]+\|[\s:\-|]+\|?\s*$")
RULE_RE = re.compile(r"Rule #(\d+)", re.IGNORECASE)


def strip_internal_block(text: str) -> tuple[str, str]:
    """Returns (published_text, internal_text). internal_text is '' if none found."""
    match = INTERNAL_HEADING_RE.search(text)
    if not match:
        return text.rstrip() + "\n", ""
    return text[: match.start()].rstrip() + "\n", text[match.start():]


def split_table_block(lines: list[str], start: int) -> tuple[list[str], int]:
    """Given lines and the index of a table header row, consume the full
    table (header + separator + data rows) and return (table_lines, next_index)."""
    table_lines = [lines[start]]
    i = start + 1
    table_lines.append(lines[i])  # separator row
    i += 1
    while i < len(lines) and "|" in lines[i] and lines[i].strip() != "":
        table_lines.append(lines[i])
        i += 1
    return table_lines, i


def convert_table_to_arrow_block(table_lines: list[str]) -> str:
    header = [c.strip() for c in table_lines[0].strip().strip("|").split("|")]
    data_rows = []
    for line in table_lines[2:]:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        data_rows.append(cells)

    out = ["```"]
    for row in data_rows:
        label = row[0] if row else ""
        out.append(label)
        for h, v in zip(header[1:], row[1:]):
            if len(header) == 2:
                out.append(f"→ {h}: {v}")
            else:
                out.append(f"  {h}: {v}")
        out.append("")
    if out and out[-1] == "":
        out.pop()
    out.append("```")
    return "\n".join(out)


def convert_all_tables(text: str) -> tuple[str, int]:
    lines = text.split("\n")
    result = []
    count = 0
    i = 0
    while i < len(lines):
        line = lines[i]
        is_header_row = "|" in line and line.strip() != ""
        next_is_separator = (
            i + 1 < len(lines) and TABLE_SEPARATOR_RE.match(lines[i + 1] or "")
        )
        if is_header_row and next_is_separator:
            table_lines, next_i = split_table_block(lines, i)
            result.append(convert_table_to_arrow_block(table_lines))
            count += 1
            i = next_i
        else:
            result.append(line)
            i += 1
    return "\n".join(result), count


def run_checklist(published_text: str, internal_text: str) -> list[str]:
    warnings = []

    for field in ["**LOG ENTRY:**", "**LOG DATE:**", "**COORDINATES:**"]:
        if field not in published_text:
            warnings.append(f"Missing header field: {field}")

    rule_matches = RULE_RE.findall(published_text)
    if not rule_matches:
        warnings.append("No numbered Rule found in body — confirm this LOG needs one")
    elif len(rule_matches) > 1:
        warnings.append(f"Multiple Rule numbers found in body: {rule_matches} — should be exactly one")

    if "— HakunaShortcut" not in published_text and "-- HakunaShortcut" not in published_text:
        warnings.append("Signature ending not found or not exact: '— HakunaShortcut'")

    hook_present = (
        "NEXT TRANSMISSION" in published_text.upper()
        or "next transmission" in internal_text.lower()
    )
    if not hook_present:
        warnings.append("No 'Next Transmission' hook found in body or internal block")

    if "|" in published_text and TABLE_SEPARATOR_RE.search(published_text):
        warnings.append("Unconverted table syntax may remain — review manually")

    return warnings


def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/prepare_substack.py <path/to/log-XXX.md>")
        sys.exit(1)

    src_path = Path(sys.argv[1])
    if not src_path.exists():
        print(f"File not found: {src_path}")
        sys.exit(1)

    raw_text = src_path.read_text(encoding="utf-8")

    published_text, internal_text = strip_internal_block(raw_text)
    published_text, table_count = convert_all_tables(published_text)

    warnings = run_checklist(published_text, internal_text)

    out_dir = Path("publish-ready")
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / src_path.name
    out_path.write_text(published_text, encoding="utf-8")

    print(f"✅ Wrote {out_path}")
    print(f"   Tables converted: {table_count}")
    print(f"   Internal block stripped: {'yes' if internal_text else 'no (none found)'}")

    if warnings:
        print("\n⚠️  Pre-publish checklist warnings:")
        for w in warnings:
            print(f"   - {w}")
        sys.exit(2)  # non-zero so CI can flag it, without deleting the output
    else:
        print("\n✅ Pre-publish checklist: all checks passed")


if __name__ == "__main__":
    main()
