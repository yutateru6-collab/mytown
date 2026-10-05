#!/usr/bin/env python3
"""Offline tests for issue-scoped bulletin PDFs; no optional dependencies."""
from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import patch

import sync_bulletin

ROOT = Path(__file__).resolve().parents[1]
ISSUE_URL = "https://www.city.nogata.fukuoka.jp/shisei/_1238/_2505/_16195/_17335.html"
PDF_BASE = "https://www.city.nogata.fukuoka.jp/library/data/siseijouhou/PDF/shihounoogata/"
ISSUE = {"issueKey": "R8-10", "eraYear": 8, "month": 10, "url": ISSUE_URL, "label": "令和8年10月市報"}
MIXED_HTML = (ROOT / "scripts/fixtures/bulletin-r8-10-mixed-links.html").read_text(encoding="utf-8")


class BulletinPdfScopeTests(unittest.TestCase):
    def test_actual_nested_old_anchors_are_not_current_pages(self) -> None:
        parsed = sync_bulletin.BulletinParser()
        parsed.feed(MIXED_HTML)
        self.assertTrue(any("R03/0305/030501" in link["href"] for link in parsed.links))
        pages = sync_bulletin.make_pages(ISSUE, MIXED_HTML, ISSUE_URL)
        self.assertEqual(len(pages), 11)
        self.assertEqual(pages[0]["pageLabel"], "1ページ表紙")
        self.assertEqual(pages[0]["sourceDescription"], "表紙")
        self.assertTrue(all("/R08/10/081001_" in page["pdfUrl"] for page in pages))
        self.assertEqual(len({page["pdfUrl"] for page in pages}), len(pages))

    def test_whole_pdf_is_scoped_even_when_archive_pdf_appears_first(self) -> None:
        archive = f'<h1>令和8年市報</h1><a href="{ISSUE_URL}">令和8年10月市報</a>'
        with patch.object(sync_bulletin, "fetch_text", side_effect=[archive, MIXED_HTML]):
            data = sync_bulletin.build_data({"currentIssue": {"issueKey": "R8-10"}})
        self.assertEqual(data["currentIssue"]["wholePdfUrl"], PDF_BASE + "R08/10/081001_shiho_web_all.pdf")
        self.assertEqual(data["currentIssue"]["pageCount"], 11)
        self.assertEqual(data["currentIssue"]["bullets"][0], "1ページ表紙")
        self.assertEqual(data["pages"], data["drafts"])

    def test_same_month_other_year_and_same_year_other_month_are_rejected(self) -> None:
        wrong_paths = [
            "R03/0310/031001_shiho_web_01.pdf",
            "R08/09/080901_shiho_web_01.pdf",
            "R03/10/081001_shiho_web_01.pdf",
            "R08/09/081001_shiho_web_01.pdf",
            "R08/10/081032_shiho_web_01.pdf",
            "R08/10/unknown_shiho_web_01.pdf",
        ]
        html = "".join(f'<a href="{PDF_BASE}{path}">1ページ表紙</a>' for path in wrong_paths)
        html += '<a href="https://example.com/library/data/siseijouhou/PDF/shihounoogata/R08/10/081001_shiho_web_01.pdf">1ページ表紙</a>'
        self.assertEqual(sync_bulletin.make_pages(ISSUE, html, ISSUE_URL), [])

    def test_duplicate_file_variants_and_empty_anchor_do_not_hide_page_label(self) -> None:
        url = PDF_BASE + "R08/10/081001_shiho_web_01.pdf"
        html = f'<a href="{url}"></a><p><a href="{url}#page=1">1ページ表紙</a></p><p><a href="{url}?download=1">1ページ表紙</a></p>'
        pages = sync_bulletin.make_pages(ISSUE, html, ISSUE_URL)
        self.assertEqual(len(pages), 1)
        self.assertEqual(pages[0]["pageLabel"], "1ページ表紙")
        self.assertEqual(pages[0]["pdfUrl"], url)

    def test_recognized_older_layout_is_checked_against_its_own_issue(self) -> None:
        issue = {"issueKey": "R4-01"}
        url = PDF_BASE + "R04/040101_shiho_web_01.pdf"
        self.assertEqual(len(sync_bulletin.make_pages(issue, f'<a href="{url}">1ページ表紙</a>', ISSUE_URL)), 1)

    def test_unknown_new_issue_links_fail_closed(self) -> None:
        archive = f'<h1>令和8年市報</h1><a href="{ISSUE_URL}">令和8年10月市報</a>'
        stale = '<a href="/library/data/siseijouhou/PDF/shihounoogata/R03/0305/030501_shiho_web_all.pdf">一括ダウンロード</a>'
        with patch.object(sync_bulletin, "fetch_text", side_effect=[archive, stale]):
            with self.assertRaisesRegex(RuntimeError, "no PDF matching"):
                sync_bulletin.build_data({})

    def test_saved_current_issue_has_only_unique_matching_files(self) -> None:
        data = json.loads((ROOT / "data/bulletin.json").read_text(encoding="utf-8"))
        issue = data["currentIssue"]
        for key in ("pages", "drafts"):
            pages = data[key]
            self.assertEqual(len(pages), len({page["pdfUrl"] for page in pages}))
            for page in pages:
                identity = sync_bulletin.bulletin_pdf_identity(page["pdfUrl"])
                self.assertIsNotNone(identity)
                self.assertEqual(f"R{identity[0]}-{identity[1]:02d}", issue["issueKey"])
                self.assertEqual(page["issueKey"], issue["issueKey"])
        self.assertEqual(issue["pageCount"], len(data["pages"]))
        self.assertEqual(issue["bullets"], [page["pageLabel"] for page in data["pages"][:8]])


if __name__ == "__main__":
    unittest.main()
