"""Cabeceras de caché para el frontend estático (HTML fresco, assets con hash inmutables)."""

from pathlib import Path

from fastapi.staticfiles import StaticFiles

HTML_NO_CACHE = "no-cache, no-store, must-revalidate"
ASSETS_IMMUTABLE = "public, max-age=31536000, immutable"


def html_cache_headers() -> dict[str, str]:
    return {"Cache-Control": HTML_NO_CACHE}


def file_cache_headers(path: Path) -> dict[str, str]:
    if path.name in {"index.html", "sw.js"}:
        return html_cache_headers()
    return {}


class ImmutableAssets(StaticFiles):
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        response.headers["Cache-Control"] = ASSETS_IMMUTABLE
        return response
