"""Startup schema/data repairs (P2-03) using Alembic."""

from sqlalchemy import inspect

import db.migrations as migrations
from app import app, db
from db.migrations import run_startup_repairs


def test_all_mapped_tables_are_checked_for_missing_columns():
    """Every mapped table must be covered by startup schema repairs."""
    mapped_tables = {model.__tablename__ for model in migrations.ALL_MODELS}
    expected_tables = {table.name for table in db.metadata.sorted_tables}
    assert expected_tables - mapped_tables == set()


def test_run_startup_repairs_is_idempotent(app_instance):
    """Running the repairs twice must not error or duplicate work."""
    with app_instance.app_context():
        run_startup_repairs(app_instance)
        run_startup_repairs(app_instance)


def test_run_startup_repairs_creates_tables(app_instance):
    """create_all within repairs produces the users table."""
    with app_instance.app_context():
        migrations._STARTUP_REPAIRS_RAN = False
        db.drop_all()
        run_startup_repairs(app_instance)
        inspector = inspect(db.engine)
        assert "users" in inspector.get_table_names()
        assert "auth_sessions" in inspector.get_table_names()
        assert "refresh_tokens" in inspector.get_table_names()


def test_run_startup_repairs_runs_alembic(app_instance):
    """Alembic upgrade head runs without error at startup."""
    with app_instance.app_context():
        migrations._STARTUP_REPAIRS_RAN = False
        db.drop_all()
        run_startup_repairs(app_instance)
        inspector = inspect(db.engine)
        assert "alembic_version" in inspector.get_table_names()


def test_data_repairs_run(app_instance):
    """Data-only repairs (avatar normalization, demo backfills) run at startup."""
    with app_instance.app_context():
        migrations._STARTUP_REPAIRS_RAN = False
        db.drop_all()
        run_startup_repairs(app_instance)


def test_no_unused_datetime_columns_are_mapped():
    """Native ``*_dt`` datetime columns were never populated and are removed."""
    for model in migrations.ALL_MODELS:
        dt_columns = {c.name for c in model.__table__.columns if c.name.endswith("_dt")}
        assert dt_columns == set(), f"{model.__tablename__} still maps {dt_columns}"


def test_dead_columns_are_not_mapped():
    """Orphan/dead columns must not be part of the ORM schema."""
    from models import QuizModel, UserModel

    quiz_columns = {c.name for c in QuizModel.__table__.columns}
    user_columns = {c.name for c in UserModel.__table__.columns}
    assert "instructions" not in quiz_columns
    assert "middle_name" not in user_columns
    assert "updated_at" not in user_columns
    assert "updated_at_dt" not in user_columns
    