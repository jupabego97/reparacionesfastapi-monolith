"""add outbound_messages for WhatsApp traceability

Revision ID: b2c3d4e5f607
Revises: a4c5e6f70891
Create Date: 2026-05-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c3d4e5f607"
down_revision: Union[str, None] = "a4c5e6f70891"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "outbound_messages",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tarjeta_id", sa.Integer(), nullable=False),
        sa.Column("channel", sa.Text(), nullable=False, server_default="whatsapp"),
        sa.Column("event", sa.Text(), nullable=False),
        sa.Column("recipient", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("provider_message_id", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["tarjeta_id"], ["repair_cards.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_outbound_messages_tarjeta_id", "outbound_messages", ["tarjeta_id"], unique=False)
    op.create_index(
        "ix_outbound_messages_tarjeta_event_status",
        "outbound_messages",
        ["tarjeta_id", "event", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_outbound_messages_tarjeta_event_status", table_name="outbound_messages")
    op.drop_index("ix_outbound_messages_tarjeta_id", table_name="outbound_messages")
    op.drop_table("outbound_messages")
