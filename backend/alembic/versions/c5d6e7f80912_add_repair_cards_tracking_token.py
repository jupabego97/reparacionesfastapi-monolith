"""add tracking_token to repair_cards

Revision ID: c5d6e7f80912
Revises: b2c3d4e5f607
Create Date: 2026-08-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d6e7f80912"
down_revision: Union[str, None] = "b2c3d4e5f607"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


revision: str = "c5d6e7f80912"
down_revision: Union[str, None] = "b2c3d4e5f607"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("repair_cards")}
    if "tracking_token" not in cols:
        op.add_column("repair_cards", sa.Column("tracking_token", sa.Text(), nullable=True))
    indexes = {ix["name"] for ix in inspector.get_indexes("repair_cards")}
    if "ix_repair_cards_tracking_token" not in indexes:
        op.create_index(
            "ix_repair_cards_tracking_token",
            "repair_cards",
            ["tracking_token"],
            unique=True,
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {ix["name"] for ix in inspector.get_indexes("repair_cards")}
    if "ix_repair_cards_tracking_token" in indexes:
        op.drop_index("ix_repair_cards_tracking_token", table_name="repair_cards")
    cols = {c["name"] for c in inspector.get_columns("repair_cards")}
    if "tracking_token" in cols:
        op.drop_column("repair_cards", "tracking_token")
