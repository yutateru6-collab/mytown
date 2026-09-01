#!/usr/bin/env python3
"""Offline regression tests for the MYTOWN civic-data pipeline."""
from __future__ import annotations

import json
import unittest
from io import BytesIO
from pathlib import Path

from pypdf import PdfWriter

import pdf_tools
import sync_meetings
import sync_nogata_v2
import verify_high_risk
import verify_sources

ROOT = Path(__file__).resolve().parents[1]


class FeedParserTests(unittest.TestCase):
    def test_rss_keeps_only_official_entries(self) -> None:
        xml = """<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0"><channel><title>Test</title>
          <item><title>公式のお知らせ</title><link>https://www.city.nogata.fukuoka.jp/test.html</link><pubDate>Tue, 01 Sep 2026 00:00:00 +0900</pubDate></item>
          <item><title>外部</title><link>https://example.com/not-official</link><pubDate>Tue, 01 Sep 2026 00:00:00 +0900</pubDate></item>
        </channel></rss>"""
        items = sync_nogata_v2.parse_rss(xml)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["title"], "公式のお知らせ")
        self.assertEqual(items[0]["date"], "2026-09-01")


class MeetingParserTests(unittest.TestCase):
    def test_official_schedule_table_is_normalized(self) -> None:
        html = """
        <html><body><aside>別ページ 更新日 2026年09月01日</aside>
        <h1>令和8年9月定例会日程</h1><p>更新日 2026年07月02日</p>
        <table><tr><th>日付</th><th>曜日</th><th>日程</th></tr>
        <tr><td>9月 3日</td><td>木曜日</td><td>本会議（議案の提案説明）</td></tr>
        <tr><td>4日</td><td>金曜日</td><td>本会議（一般質問）</td></tr>
        <tr><td>5日</td><td>土曜日</td><td>休会（休日）</td></tr></table>
        <p>本会議、各委員会の開会時間は、いずれも、午前10時からです。</p></body></html>
        """
        data = sync_meetings.parse_schedule_html(html, sync_meetings.FALLBACK_URL)
        self.assertEqual(data["seriesTitle"], "令和8年9月定例会")
        self.assertEqual(data["source"]["sourceUpdated"], "2026-07-02")
        self.assertEqual(len(data["meetings"]), 2)
        self.assertEqual(data["meetings"][0]["start"], "2026-09-03T10:00:00+09:00")

    def test_high_risk_update_date_uses_page_badge(self) -> None:
        html = """
        <div>別ページ 更新日 2026年07月02日</div>
        <div class="pbBlock pbTitleBlock ngt-update">更新日 2026年09月01日</div>
        <div>更新日 2026年10月01日</div>
        """
        self.assertEqual(verify_high_risk.schedule_updated_date(html), "2026-09-01")


class SourceRegistryTests(unittest.TestCase):
    def test_registry_is_valid(self) -> None:
        data = json.loads((ROOT / "data" / "sources.json").read_text(encoding="utf-8"))
        self.assertEqual(verify_sources.validate_registry(data), [])
        self.assertEqual(data["defaultRefreshHours"], 6)


class PdfToolTests(unittest.TestCase):
    def test_blank_pdf_requires_review_not_fabrication(self) -> None:
        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        output = BytesIO()
        writer.write(output)
        result = pdf_tools.inspect_pdf_bytes(output.getvalue())
        self.assertEqual(result["extractionStatus"], "ocr_or_review_needed")
        self.assertEqual(result["publishStatus"], "needs_review")


if __name__ == "__main__":
    unittest.main()
