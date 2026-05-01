"""add users, tags, repair_card_tags and missing repair_cards columns

Revision ID: f7e8d9c0b1a2
Revises: e22afad59dd6
Create Date: 2026-05-01

The initial revision predates Kanban/auth fields; the following migration expects
(columns + repair_card_tags) to exist — this revision bridges that gap for SQLite/PG.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = "f7e8d9c0b1a2"
down_revision: Union[str, None] = "e22afad59dd6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(bind, name: str) -> bool:
    return inspect(bind).has_table(name)


def _cols(bind, table: str) -> set[str]:
    return {c["name"] for c in inspect(bind).get_columns(table)}


def _fk_exists(bind, table: str, constrained: tuple[str, ...]) -> bool:
    for fk in inspect(bind).get_foreign_keys(table):
        if tuple(fk.get("constrained_columns") or ()) == constrained:
            return True
    return False


def upgrade() -> None:
    bind = op.get_bind()

    if not _table_exists(bind, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("username", sa.Text(), nullable=False),
            sa.Column("email", sa.Text(), nullable=True),
            sa.Column("hashed_password", sa.Text(), nullable=False),
            sa.Column("full_name", sa.Text(), nullable=False, server_default="Usuario"),
            sa.Column("role", sa.Text(), nullable=False, server_default="tecnico"),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("avatar_color", sa.Text(), nullable=True, server_default="#00ACC1"),
            sa.Column(
                "created_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.Column("last_login", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_users_username", "users", ["username"], unique=True)
        op.create_index("ix_users_email", "users", ["email"], unique=True)
        op.create_index("ix_users_role", "users", ["role"], unique=False)

    cols = _cols(bind, "repair_cards")
    specs: list[tuple[str, sa.Column]] = [
        ("priority", sa.Column("priority", sa.Text(), nullable=False, server_default="media")),
        ("position", sa.Column("position", sa.Integer(), nullable=False, server_default="0")),
        ("assigned_to", sa.Column("assigned_to", sa.Integer(), nullable=True)),
        ("assigned_name", sa.Column("assigned_name", sa.Text(), nullable=True)),
        ("estimated_cost", sa.Column("estimated_cost", sa.Float(), nullable=True)),
        ("final_cost", sa.Column("final_cost", sa.Float(), nullable=True)),
        ("cost_notes", sa.Column("cost_notes", sa.Text(), nullable=True)),
        ("deleted_at", sa.Column("deleted_at", sa.DateTime(), nullable=True)),
        ("blocked_at", sa.Column("blocked_at", sa.DateTime(), nullable=True)),
        ("blocked_reason", sa.Column("blocked_reason", sa.Text(), nullable=True)),
        ("blocked_by", sa.Column("blocked_by", sa.Integer(), nullable=True)),
    ]
    for name, col in specs:
        if name not in cols:
            op.add_column("repair_cards", col)
            cols.add(name)

    if bind.dialect.name == "postgresql":
        if not _fk_exists(bind, "repair_cards", ("assigned_to",)):
            op.create_foreign_key(
                "repair_cards_assigned_to_fkey",
                "repair_cards",
                "users",
                ["assigned_to"],
                ["id"],
                ondelete="SET NULL",
            )
        if not _fk_exists(bind, "repair_cards", ("blocked_by",)):
            op.create_foreign_key(
                "repair_cards_blocked_by_fkey",
                "repair_cards",
                "users",
                ["blocked_by"],
                ["id"],
                ondelete="SET NULL",
            )

    if not _table_exists(bind, "tags"):
        op.create_table(
            "tags",
            sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
            sa.Column("name", sa.Text(), nullable=False),
            sa.Column("color", sa.Text(), nullable=False, server_default="#6366f1"),
            sa.Column("icon", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_tags_name", "tags", ["name"], unique=True)

    if not _table_exists(bind, "repair_card_tags"):
        op.create_table(
            "repair_card_tags",
            sa.Column("repair_card_id", sa.Integer(), nullable=False),
            sa.Column("tag_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["repair_card_id"], ["repair_cards.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("repair_card_id", "tag_id"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "repair_card_tags"):
        op.drop_table("repair_card_tags")
    if _table_exists(bind, "tags"):
        op.drop_index("ix_tags_name", table_name="tags")
        op.drop_table("tags")

    if bind.dialect.name == "postgresql":
        insp = inspect(bind)
        for fk in insp.get_foreign_keys("repair_cards"):
            cols = fk.get("constrained_columns") or []
            name = fk.get("name")
            if name and set(cols) <= {"assigned_to", "blocked_by"} and fk.get("referred_table") == "users":
                op.drop_constraint(name, "repair_cards", type_="foreignkey")

    cols = _cols(bind, "repair_cards")
    for name in (
        "blocked_by",
        "blocked_reason",
        "blocked_at",
        "deleted_at",
        "cost_notes",
        "final_cost",
        "estimated_cost",
        "assigned_name",
        "assigned_to",
        "position",
        "priority",
    ):
        if name in cols:
            op.drop_column("repair_cards", name)

    if _table_exists(bind, "users"):
        op.drop_index("ix_users_role", table_name="users")
        op.drop_index("ix_users_email", table_name="users")
        op.drop_index("ix_users_username", table_name="users")
        op.drop_table("users")
