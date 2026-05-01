"""add kanban_columns, subtasks, comments, notifications, card_templates

Revision ID: a4c5e6f70891
Revises: c3a1b7f9e042
Create Date: 2026-05-01

These tables are used in production routes but had no Alembic revision.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "a4c5e6f70891"
down_revision: Union[str, None] = "c3a1b7f9e042"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(bind, name: str) -> bool:
    return inspect(bind).has_table(name)


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "kanban_columns"):
        op.create_table(
            "kanban_columns",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("key", sa.Text(), nullable=False),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("color", sa.Text(), nullable=False, server_default="#0369a1"),
            sa.Column("icon", sa.Text(), nullable=True, server_default="fas fa-inbox"),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("wip_limit", sa.Integer(), nullable=True),
            sa.Column("is_done_column", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("sla_hours", sa.Integer(), nullable=True),
            sa.Column("required_fields", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_kanban_columns_key", "kanban_columns", ["key"], unique=True)

    if not _table_exists(bind, "subtasks"):
        op.create_table(
            "subtasks",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("tarjeta_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("completed_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["tarjeta_id"], ["repair_cards.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_subtasks_tarjeta_id", "subtasks", ["tarjeta_id"], unique=False)

    if not _table_exists(bind, "comments"):
        op.create_table(
            "comments",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("tarjeta_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("author_name", sa.Text(), nullable=False, server_default="Sistema"),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["tarjeta_id"], ["repair_cards.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_comments_tarjeta_id", "comments", ["tarjeta_id"], unique=False)
        op.create_index("ix_comments_user_id", "comments", ["user_id"], unique=False)

    if not _table_exists(bind, "notifications"):
        op.create_table(
            "notifications",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("tarjeta_id", sa.Integer(), nullable=True),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("type", sa.Text(), nullable=False, server_default="info"),
            sa.Column("read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tarjeta_id"], ["repair_cards.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_notifications_user_id", "notifications", ["user_id"], unique=False)
        op.create_index("ix_notifications_read", "notifications", ["read"], unique=False)
        op.create_index("ix_notifications_created_at", "notifications", ["created_at"], unique=False)

    if not _table_exists(bind, "card_templates"):
        op.create_table(
            "card_templates",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("problem_template", sa.Text(), nullable=True),
            sa.Column("default_priority", sa.Text(), nullable=False, server_default="media"),
            sa.Column("default_notes", sa.Text(), nullable=True),
            sa.Column("estimated_hours", sa.Float(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("name"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    for table, ix in (
        ("card_templates", ()),
        (
            "notifications",
            ("ix_notifications_created_at", "ix_notifications_read", "ix_notifications_user_id"),
        ),
        ("comments", ("ix_comments_user_id", "ix_comments_tarjeta_id")),
        ("subtasks", ("ix_subtasks_tarjeta_id",)),
        ("kanban_columns", ("ix_kanban_columns_key",)),
    ):
        if not _table_exists(bind, table):
            continue
        for ix_name in ix:
            op.drop_index(ix_name, table_name=table)
        op.drop_table(table)
