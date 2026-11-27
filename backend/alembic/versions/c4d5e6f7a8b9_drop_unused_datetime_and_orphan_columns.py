"""drop_unused_datetime_and_orphan_columns

Removes native ``*_dt`` datetime columns that were added but never populated,
plus orphan/dead columns left over from earlier schema iterations:

* users: middle_name, updated_at, updated_at_dt
* subjects/quizzes/ai_generated_content/reports: extra *_dt not mapped by the ORM
* quizzes.instructions (never written or read)
* every remaining ``*_dt`` column on the ORM models (all permanently NULL)

The upgrade inspects the live schema and only drops columns that exist, so it is
safe on fresh databases created directly from the current models.

Revision ID: c4d5e6f7a8b9
Revises: b7e3d9a1c4f2
Create Date: 2026-11-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b7e3d9a1c4f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_COLUMNS = {
    "users": [
        "middle_name", "updated_at", "updated_at_dt",
        "created_at_dt", "last_login_dt", "two_factor_expires_at_dt",
        "locked_until_dt", "reset_otp_expires_at_dt", "email_verify_expires_at_dt",
    ],
    "subjects": ["updated_at_dt", "created_at_dt"],
    "learning_materials": ["uploaded_at_dt"],
    "material_flags": ["created_at_dt", "resolved_at_dt"],
    "ai_generated_content": ["updated_at_dt", "created_at_dt"],
    "quizzes": ["instructions", "updated_at_dt", "deadline_dt", "created_at_dt"],
    "quiz_attempts": ["submitted_at_dt"],
    "student_progress": ["updated_at_dt", "last_activity_dt"],
    "notifications": ["read_at_dt", "created_at_dt"],
    "announcements": ["created_at_dt", "updated_at_dt", "posted_at_dt"],
    "activity_logs": ["created_at_dt"],
    "audit_archive": ["created_at_dt"],
    "reports": ["created_at_dt", "updated_at_dt", "generated_at_dt"],
    "auth_sessions": ["created_at_dt", "last_seen_at_dt", "revoked_at_dt"],
    "refresh_tokens": ["created_at_dt", "expires_at_dt", "revoked_at_dt"],
}


def _existing_columns(table):
    inspector = sa.inspect(op.get_bind())
    try:
        return {column["name"] for column in inspector.get_columns(table)}
    except Exception:
        return set()


def _column_type(name):
    if name.endswith("_dt"):
        return sa.DateTime(timezone=True)
    if name == "middle_name":
        return sa.String(length=100)
    if name == "instructions":
        return sa.Text()
    return sa.String(length=64)


def upgrade() -> None:
    for table, columns in _COLUMNS.items():
        existing = _existing_columns(table)
        to_drop = [name for name in columns if name in existing]
        if not to_drop:
            continue
        with op.batch_alter_table(table) as batch_op:
            for name in to_drop:
                batch_op.drop_column(name)


def downgrade() -> None:
    for table, columns in _COLUMNS.items():
        existing = _existing_columns(table)
        to_add = [name for name in columns if name not in existing]
        if not to_add:
            continue
        with op.batch_alter_table(table) as batch_op:
            for name in to_add:
                batch_op.add_column(sa.Column(name, _column_type(name), nullable=True))
