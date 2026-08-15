from pathlib import Path

from app.core.static_headers import file_cache_headers, html_cache_headers


def test_index_html_and_sw_are_not_cached():
    assert html_cache_headers()["Cache-Control"].startswith("no-cache")
    assert file_cache_headers(Path("index.html"))["Cache-Control"].startswith("no-cache")
    assert file_cache_headers(Path("sw.js"))["Cache-Control"].startswith("no-cache")


def test_other_public_files_have_no_special_header():
    assert file_cache_headers(Path("manifest.json")) == {}
    assert file_cache_headers(Path("apple-touch-icon.png")) == {}
