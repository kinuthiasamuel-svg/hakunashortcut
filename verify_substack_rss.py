#!/usr/bin/env python3
"""
verify_substack_rss.py

Polls the public Substack RSS feed (no auth required — official,
ToS-safe) to confirm whether a given LOG has actually gone live, rather
than trusting a scheduled-publish assumption.

Usage:
    python scripts/verify_substack_rss.py --match "Leverage Points"
    python scripts/verify_substack_rss.py --match "LOG 010"

Exit codes:
    0 = found (post is live)
    1 = not found (not live yet, or search term didn't match)
"""

import argparse
import sys
import urllib.request
import xml.etree.ElementTree as ET

FEED_URL = "https://hakunashortcut.substack.com/feed"


def fetch_feed(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "hakunashortcut-sync/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def find_matching_item(xml_text: str, match_term: str):
    root = ET.fromstring(xml_text)
    channel = root.find("channel")
    if channel is None:
        return None

    match_lower = match_term.lower()
    for item in channel.findall("item"):
        title = (item.findtext("title") or "").strip()
        if match_lower in title.lower():
            return {
                "title": title,
                "link": (item.findtext("link") or "").strip(),
                "pubDate": (item.findtext("pubDate") or "").strip(),
            }
    return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--match", required=True, help="Text to search for in post titles (e.g. LOG number or title)")
    parser.add_argument("--feed-url", default=FEED_URL)
    args = parser.parse_args()

    try:
        xml_text = fetch_feed(args.feed_url)
    except Exception as e:
        print(f"⚠️  Could not fetch feed: {e}")
        sys.exit(1)

    result = find_matching_item(xml_text, args.match)

    if result:
        print("✅ Confirmed live on Substack:")
        print(f"   Title:   {result['title']}")
        print(f"   Link:    {result['link']}")
        print(f"   Pub date: {result['pubDate']}")
        sys.exit(0)
    else:
        print(f"❌ No post matching '{args.match}' found in the feed.")
        print("   This does not necessarily mean something is wrong — it may")
        print("   just not be published yet. Re-check after the scheduled time,")
        print("   and don't mark it Published in the trackers until this confirms it.")
        sys.exit(1)


if __name__ == "__main__":
    main()
