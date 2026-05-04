"""Utilidades de texto para normalización determinista."""

import unicodedata


def strip_accents(s: str) -> str:
    """Elimina tildes y diacríticos (NFKD), conservando caracteres base ASCII."""
    if not s:
        return s
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c))
