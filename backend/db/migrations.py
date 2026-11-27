"""Database migration and data repair management.

Schema changes are managed by Alembic (see backend/alembic/). Startup runs
``alembic upgrade head`` to ensure the schema is current, then applies
idempotent data repairs that are not schema-related.
"""

import os

from alembic import command
from alembic.config import Config
from werkzeug.security import generate_password_hash

from config import DEMO_ADMIN_PASSWORD, DEMO_TEACHER_PASSWORD
from extensions import db
from lib.constants import _SMOKE_ANNOUNCEMENT_TITLES
from models import (
    ActivityLogArchiveModel,
    ActivityLogModel,
    AIGeneratedContentModel,
    AnnouncementModel,
    AuthSessionModel,
    MaterialFlagModel,
    MaterialModel,
    NotificationModel,
    QuizAttemptModel,
    QuizModel,
    QuizQuestionModel,
    RefreshTokenModel,
    ReportModel,
    RoleModel,
    StudentProgressModel,
    StudentSubjectModel,
    SubjectModel,
    SystemSettingModel,
    UserModel,
)

# Every mapped model, used to detect and heal missing columns on existing
# databases provisioned before a column was added.
ALL_MODELS = [
    ActivityLogArchiveModel,
    ActivityLogModel,
    AIGeneratedContentModel,
    AnnouncementModel,
    AuthSessionModel,
    MaterialFlagModel,
    MaterialModel,
    NotificationModel,
    QuizAttemptModel,
    QuizModel,
    QuizQuestionModel,
    RefreshTokenModel,
    ReportModel,
    RoleModel,
    StudentProgressModel,
    StudentSubjectModel,
    SubjectModel,
    SystemSettingModel,
    UserModel,
]

_STARTUP_REPAIRS_RAN = False


def _get_alembic_config():
    """Build an Alembic Config pointing at backend/alembic.ini."""
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ini_path = os.path.join(backend_dir, "alembic.ini")
    cfg = Config(ini_path)
    cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    return cfg


def _alembic_version_table_exists(cfg):
    """Return True when the alembic version table already exists in the DB."""
    from sqlalchemy import inspect

    from extensions import db

    return inspect(db.engine).has_table("version_table")


def run_migrations():
    """Run ``alembic upgrade head`` to bring the schema to the latest version.

    Failed migrations raise an exception and stop startup — they are never
    swallowed.
    """
    cfg = _get_alembic_config()
    command.upgrade(cfg, "head")


def run_startup_repairs(app):
    """Run idempotent schema/data repairs once per process at startup.

    1. ``db.create_all()`` creates tables for fresh databases (idempotent).
    2. Every mapped model's columns are checked against the live database
       schema; any missing column is added directly with ``ALTER TABLE ... ADD
       COLUMN``. This is more reliable than Alembic ``upgrade head`` because it
       inspects actual column presence rather than version_table bookkeeping,
       so existing databases provisioned before a column was added are healed
       even when the Alembic version table already says ``head``.
    3. Data-only repairs (avatar normalization, demo account backfills, etc.)
       run last.

    Safe to call multiple times: runs exactly once per process.
    """
    global _STARTUP_REPAIRS_RAN
    if _STARTUP_REPAIRS_RAN:
        return
    _STARTUP_REPAIRS_RAN = True
    with app.app_context():
        # db.create_all() is idempotent: only creates tables that don't exist.
        db.create_all()
        _add_missing_columns()
        # Alembic bookkeeping: mark schema as current after any direct column
        # repairs so future ``alembic`` commands stay consistent.
        cfg = _get_alembic_config()
        if not _alembic_version_table_exists(cfg):
            command.stamp(cfg, "head")
        else:
            command.upgrade(cfg, "head")
        _normalize_avatar_placeholders()
        _normalize_user_emails()
        _purge_test_announcements()
        _ensure_demo_email_verified()
        _ensure_demo_passwords()


def _mysql_ddl_type(column):
    """Map a SQLAlchemy column type to a MySQL-compatible DDL type string.

    ``column.type.compile(dialect=...)`` sometimes produces types MySQL rejects
    (e.g. ``DATETIME`` without fractional-seconds precision for
    ``DateTime(timezone=True)``). This helper emits explicit MySQL DDL so that
    ``ALTER TABLE ... ADD COLUMN`` works reliably.
    """
    from sqlalchemy import String, Integer, Boolean, Text, Float, DateTime, BigInteger

    col_type = column.type
    if isinstance(col_type, DateTime):
        return "DATETIME(6)"
    if isinstance(col_type, String):
        return f"VARCHAR({col_type.length or 255})"
    if isinstance(col_type, BigInteger):
        return "BIGINT"
    if isinstance(col_type, Integer):
        return "INT"
    if isinstance(col_type, Boolean):
        return "TINYINT(1)"
    if isinstance(col_type, Text):
        return "TEXT"
    if isinstance(col_type, Float):
        return "DOUBLE"
    # Fall back to SQLAlchemy's own compilation for unhandled types.
    return col_type.compile(dialect=db.engine.dialect)


def _add_missing_columns():
    """Ensure every mapped model column exists in the live database.

    ``db.create_all()`` only creates whole tables that don't exist yet; it does
    not add columns to tables that were already present. Existing databases
    provisioned before a column (typically a ``*_dt`` native datetime column)
    was added therefore lack those columns, and any ``SELECT *`` against the
    model raises ``OperationalError: Unknown column ...``, surfacing as a 500
    on login and register.

    We inspect each mapped model's columns against ``information_schema`` and
    issue ``ALTER TABLE ... ADD COLUMN`` for any missing one. Nullable columns
    default to NULL for existing rows, so they keep working; non-nullable
    columns with a scalar default get that default.
    """
    from sqlalchemy import inspect, text

    inspector = inspect(db.engine)

    for model in ALL_MODELS:
        table = model.__tablename__
        if not inspector.has_table(table):
            continue
        existing = {col["name"] for col in inspector.get_columns(table)}
        expected = {c.name for c in model.__table__.columns}
        missing = expected - existing

        with db.engine.connect() as conn:
            # Add missing columns
            added = set()
            if missing:
                for col_name in sorted(missing):
                    column = model.__table__.columns[col_name]
                    col_type = _mysql_ddl_type(column)
                    null_clause = " NULL" if column.nullable else " NOT NULL"
                    default_clause = ""
                    if not column.nullable and column.default is not None:
                        default = column.default
                        if getattr(default, "is_scalar", False):
                            default_clause = f" DEFAULT {default.arg}"
                    try:
                        conn.execute(
                            text(
                                f"ALTER TABLE {table} "
                                f"ADD COLUMN {col_name} {col_type}"
                                f"{default_clause}{null_clause}"
                            )
                        )
                        print(f"[Database] added missing column {table}.{col_name}")
                        added.add(col_name)
                    except Exception as e:
                        print(f"[Database] could not add column {table}.{col_name}: {e}")
                existing.update(added)
                conn.commit()

            # Resize existing columns that store UUIDs or HMAC-SHA256 hex digests
            # to fit longer values (e.g. VARCHAR(16) -> VARCHAR(64)).
            # Runs for every table on every startup, independent of missing columns.
            # Direct ALTER TABLE ... MODIFY COLUMN is idempotent: resizing to the
            # same length is harmless.
            table_column_map = {
                "users": ("email_verify_code", "two_factor_code", "reset_otp"),
                "auth_sessions": ("session_id",),
                "refresh_tokens": ("jti",),
            }
            cols_to_resize = table_column_map.get(table, ())
            for col_name in cols_to_resize:
                if col_name not in model.__table__.columns:
                    continue
                try:
                    conn.execute(
                        text(
                            f"ALTER TABLE {table} "
                            f"MODIFY COLUMN {col_name} VARCHAR(64)"
                        )
                    )
                    # Verify the resize took effect by querying information_schema.
                    result = conn.execute(
                        text(
                            "SELECT CHARACTER_MAXIMUM_LENGTH "
                            "FROM information_schema.COLUMNS "
                            f"WHERE TABLE_NAME = '{table}' AND COLUMN_NAME = '{col_name}'"
                        )
                    )
                    row = result.fetchone()
                    actual_len = row[0] if row else None
                    print(f"[Database] resized column {table}.{col_name} to VARCHAR(64) "
                          f"(verified length={actual_len})")
                except Exception as e:
                    short_msg = str(e).splitlines()[0][:160] if str(e) else e.__class__.__name__
                    print(f"[Database] could not resize column {table}.{col_name}: {short_msg}")

            # Add missing *_dt native datetime columns that SQLAlchemy expects but
            # MySQL lacks. These are added explicitly because the generic
            # column-type compilation above may not produce a MySQL-compatible
            # type for DateTime(timezone=True).
            dt_column_map = {
                "ai_generated_content": ("created_at_dt", "updated_at_dt"),
                "activity_logs": ("created_at_dt",),
                "announcements": ("created_at_dt", "updated_at_dt"),
                "quizzes": ("created_at_dt", "updated_at_dt"),
                "quiz_attempts": ("submitted_at_dt",),
                "reports": ("created_at_dt", "updated_at_dt"),
                "subjects": ("created_at_dt", "updated_at_dt"),
                "users": ("created_at_dt", "last_login_dt", "locked_until_dt",
                          "two_factor_expires_at_dt", "reset_otp_expires_at_dt",
                          "email_verify_expires_at_dt"),
            }
            dt_cols_to_add = dt_column_map.get(table, ())
            for col_name in dt_cols_to_add:
                if col_name in existing:
                    continue
                try:
                    conn.execute(
                        text(
                            f"ALTER TABLE {table} "
                            f"ADD COLUMN {col_name} DATETIME(6) NULL"
                        )
                    )
                    print(f"[Database] added missing column {table}.{col_name} DATETIME(6)")
                except Exception as e:
                    short_msg = str(e).splitlines()[0][:160] if str(e) else e.__class__.__name__
                    print(f"[Database] could not add column {table}.{col_name}: {short_msg}")
            conn.commit()


def _normalize_avatar_placeholders():
    """Heals legacy corrupted avatar values (the string 'None', etc.) to real NULLs."""
    try:
        from sqlalchemy import text
        db.session.execute(
            text("UPDATE users SET profile_picture = NULL "
                 "WHERE profile_picture IN ('None', 'none', 'null', 'undefined', '')")
        )
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        print("[Database] avatar normalization skipped:", e)


def _normalize_user_emails():
    """Trims stray whitespace/newlines from legacy user emails.

    Older imports and admin edits could store values like
    ``"teacher@studylens.edu\\n"``. Login compares normalized values, but the
    stored row should still be healed so exports and exact-match queries are
    correct. Rows whose trimmed form would collide with another account are
    left untouched and reported instead of violating the unique constraint.
    """
    try:
        users = UserModel.query.all()
        counts = {}
        for user in users:
            key = (user.email or "").strip().lower()
            if key:
                counts[key] = counts.get(key, 0) + 1

        changed = 0
        for user in users:
            cleaned = (user.email or "").strip()
            if not cleaned or cleaned == user.email:
                continue
            if counts.get(cleaned.lower(), 0) > 1:
                print(f"[Database] email normalization skipped for {user.user_id}: duplicate normalized value")
                continue
            user.email = cleaned
            changed += 1

        if changed:
            db.session.commit()
            print(f"[Database] normalized {changed} user email(s)")
    except Exception as e:
        db.session.rollback()
        print("[Database] email normalization skipped:", e)


def _purge_test_announcements():
    """Removes leftover automated-test announcements (smoke titles and posts by
    temporary test accounts) so they never surface for real users."""
    try:
        leftovers = AnnouncementModel.query.filter(
            db.or_(
                AnnouncementModel.title.in_(_SMOKE_ANNOUNCEMENT_TITLES),
                AnnouncementModel.teacher_id.like("usr-teacher-t2-%"),
            )
        ).all()
        if leftovers:
            for ann in leftovers:
                db.session.delete(ann)
            db.session.commit()
            print(f"[Database] purged {len(leftovers)} leftover test announcement(s)")
    except Exception as e:
        db.session.rollback()
        print("[Database] test announcement purge skipped:", e)


def _ensure_demo_passwords():
    """Backfills a password hash only when the stored hash is missing.

    Never overwrites an existing hash: doing so would silently revert an
    operator's password change at the next restart.
    """
    demo_accounts = {
        "usr-teacher-1": DEMO_TEACHER_PASSWORD,
        "usr-admin-1": DEMO_ADMIN_PASSWORD,
    }
    changed = False
    for user_id, plain in demo_accounts.items():
        if not plain:
            continue
        try:
            user = db.session.get(UserModel, user_id)
            if user and not user.password_hash:
                user.password_hash = generate_password_hash(plain)
                changed = True
        except Exception as e:
            print(f"[Database] demo password backfill skipped for {user_id}: {e}")
    try:
        if changed:
            db.session.commit()
    except Exception as e:
        print("[Database] demo password backfill commit skipped:", e)


def _ensure_demo_email_verified():
    """Marks the built-in seed demo accounts as email-verified (idempotent).

    These accounts are provisioned by the institution rather than self-registered,
    so they skip the registration email check. Without this, the documented demo
    logins would be blocked by the verify-email gate.
    """
    demo_ids = ["usr-teacher-1", "usr-admin-1"]
    changed = False
    for user_id in demo_ids:
        try:
            user = db.session.get(UserModel, user_id)
            if user and not user.email_verified:
                user.email_verified = 1
                user.email_verify_code = None
                user.email_verify_expires_at = None
                user.email_verify_attempts = None
                changed = True
        except Exception as e:
            print(f"[Database] demo email-verified backfill skipped for {user_id}: {e}")
    try:
        if changed:
            db.session.commit()
    except Exception as e:
        print("[Database] demo email-verified backfill commit skipped:", e)
