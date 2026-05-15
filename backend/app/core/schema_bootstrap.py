"""Añade columnas nuevas en BD existente sin Alembic (SQLite / PostgreSQL)."""

from loguru import logger
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from app.core.database import engine
from app.models.repair_card import RepairCard


def _column_names(eng: Engine, table: str) -> set[str]:
    insp = inspect(eng)
    if table not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table)}


def ensure_repair_cards_tracking_token() -> None:
    cols = _column_names(engine, RepairCard.__tablename__)
    if "tracking_token" in cols:
        return
    dialect = engine.dialect.name
    logger.info("Añadiendo columna repair_cards.tracking_token ({})", dialect)
    with engine.begin() as conn:
        if dialect == "sqlite":
            conn.execute(text("ALTER TABLE repair_cards ADD COLUMN tracking_token TEXT"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_repair_cards_tracking_token "
                    "ON repair_cards (tracking_token)"
                )
            )
        else:
            conn.execute(text("ALTER TABLE repair_cards ADD COLUMN tracking_token TEXT"))
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS ix_repair_cards_tracking_token "
                    "ON repair_cards (tracking_token)"
                )
            )


def run_schema_bootstrap() -> None:
    try:
        ensure_repair_cards_tracking_token()
    except Exception as e:
        logger.warning("schema_bootstrap: {}", e)
