#!/usr/bin/env python3
"""Inspect official Nogata City PDFs with pypdf without auto-publishing claims.

By default this emits only extraction metadata. Full extracted text is included
only when --include-text is explicitly requested. Image-only/scanned PDFs are
marked for OCR/review instead of being treated as empty official information.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.request
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse

from pypdf import PdfReader

ALLOWED_HOSTS = {"city.nogata.fukuoka.jp", "www.city.nogata.fukuoka.jp"}
HEADERS = {
    "User-Agent": "MYTOWN-Nogata/1.0 (+https://github.com/yutateru6-collab/mytown; public-data-sync)"
}


def fetch_pdf(url: str, timeout: int = 40) -> bytes:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"refusing non-official PDF URL: {url}")
    if not parsed.path.lower().endswith(".pdf"):
        raise ValueError("URL does not point to a .pdf resource")
    request = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def inspect_pdf_bytes(data: bytes, include_text: bool = False) -> dict:
    digest = hashlib.sha256(data).hexdigest()
    reader = PdfReader(BytesIO(data), strict=False)
    pages: list[dict] = []
    total_chars = 0
    extraction_errors = 0

    for index, page in enumerate(reader.pages, start=1):
        try:
            text = (page.extract_text() or "").strip()
        except Exception as exc:  # pypdf can fail page-by-page on malformed PDFs.
            text = ""
            extraction_errors += 1
            page_info = {
                "page": index,
                "textLength": 0,
                "status": "parse_failed",
                "errorType": type(exc).__name__,
            }
            pages.append(page_info)
            continue

        text_length = len(text)
        total_chars += text_length
        if text_length == 0:
            status = "image_or_unextractable"
        elif text_length < 80:
            status = "low_text"
        else:
            status = "text_extracted"
        page_info = {"page": index, "textLength": text_length, "status": status}
        if include_text:
            page_info["text"] = text
        pages.append(page_info)

    if extraction_errors == len(pages) and pages:
        overall = "parse_failed"
    elif total_chars == 0:
        overall = "ocr_or_review_needed"
    elif any(page["status"] in {"image_or_unextractable", "parse_failed"} for page in pages):
        overall = "partial_text_review_needed"
    else:
        overall = "text_extracted_review_needed"

    return {
        "sha256": digest,
        "pageCount": len(reader.pages),
        "totalExtractedCharacters": total_chars,
        "extractionStatus": overall,
        "publishStatus": "needs_review",
        "pages": pages,
    }


def load_input(value: str) -> tuple[bytes, str]:
    if value.startswith("https://"):
        return fetch_pdf(value), value
    path = Path(value)
    return path.read_bytes(), str(path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect an official civic PDF without auto-publishing its contents.")
    parser.add_argument("input", help="Nogata City PDF URL or local PDF path")
    parser.add_argument("--include-text", action="store_true", help="include extracted text in stdout JSON")
    args = parser.parse_args()
    try:
        data, source = load_input(args.input)
        result = inspect_pdf_bytes(data, include_text=args.include_text)
    except Exception as exc:
        print(f"ERROR PDF inspection: {exc}", file=sys.stderr)
        return 1
    result["source"] = source
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
