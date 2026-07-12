#!/usr/bin/env python3
"""
debug_substack_rss.py

Debug version to inspect the actual structure of the Substack RSS feed,
particularly to check for namespace issues.
"""

import urllib.request
import xml.etree.ElementTree as ET

FEED_URL = "https://hakunashortcut.substack.com/feed"


def fetch_feed(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "hakunashortcut-sync/1.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read().decode("utf-8", errors="replace")


def debug_feed():
    try:
        xml_text = fetch_feed(FEED_URL)
    except Exception as e:
        print(f"⚠️  Could not fetch feed: {e}")
        return

    root = ET.fromstring(xml_text)
    
    print("=" * 60)
    print("ROOT TAG:", root.tag)
    print("=" * 60)
    
    channel = root.find("channel")
    if channel is None:
        print("❌ No <channel> found!")
        return
    
    print(f"\n📰 Found channel. Listing all items:\n")
    
    items = channel.findall("item")
    print(f"Total items: {len(items)}\n")
    
    for i, item in enumerate(items[:10], 1):  # Show first 10
        title_elem = item.find("title")
        link_elem = item.find("link")
        pubdate_elem = item.find("pubDate")
        
        title = (title_elem.text if title_elem is not None else "").strip()
        link = (link_elem.text if link_elem is not None else "").strip()
        pubdate = (pubdate_elem.text if pubdate_elem is not None else "").strip()
        
        print(f"[{i}] Title: {title}")
        print(f"    Link: {link}")
        print(f"    PubDate: {pubdate}")
        print()


if __name__ == "__main__":
    debug_feed()
