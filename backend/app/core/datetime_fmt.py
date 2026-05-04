"""Serialización de fechas al JSON del API (instantes en UTC, sufijo Z)."""

from datetime import UTC, datetime


def utc_iso_z(dt: datetime | None) -> str | None:
    """ISO-8601 en UTC terminado en Z, para que el cliente interprete bien el instante."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    else:
        dt = dt.astimezone(UTC)
    return dt.replace(microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ")
