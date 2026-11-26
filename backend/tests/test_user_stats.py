"""Profile stats endpoint: recent activity must be readable on MySQL/TiDB.

MySQL and TiDB reject the ``NULLS LAST`` SQL clause, so the stats query must
never emit it (SQLite accepts it, which is why the bug slipped past the suite).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from app import db
from models import ActivityLogModel, UserModel
from tests.conftest import auth_headers_for


def _seed_logs(app_instance, count=3):
    with app_instance.app_context():
        now = datetime.now(timezone.utc)
        for i in range(count):
            created = (now - timedelta(minutes=i)).isoformat().replace("+00:00", "Z")
            db.session.add(ActivityLogModel(
                log_id=f"stats-test-{i}",
                user_id="stu-1",
                user_name="Alice Smith",
                user_role="student",
                activity=f"TEST_ACTION_{i}",
                details=f"details {i}",
                ip_address="127.0.0.1",
                created_at=created,
            ))
        db.session.commit()


def test_stats_returns_recent_activity(client, init_database, app_instance):
    _seed_logs(app_instance)
    with app_instance.app_context():
        student = db.session.get(UserModel, "stu-1")
        headers = auth_headers_for(student)

    resp = client.get("/api/users/stu-1/stats", headers=headers)
    assert resp.status_code == 200, resp.get_data(as_text=True)
    data = resp.get_json()

    assert data["quizzesTaken"] == 2
    assert data["flashcardsCreated"] == 1
    assert len(data["recentActivity"]) == 3

    # Newest first, and the timestamp stays a UTC "Z" string the UI can parse.
    actions = [item["action"] for item in data["recentActivity"]]
    assert actions == ["TEST_ACTION_0", "TEST_ACTION_1", "TEST_ACTION_2"]
    assert data["recentActivity"][0]["details"] == "details 0"
    assert data["recentActivity"][0]["timestamp"].endswith("Z")


def test_stats_query_never_emits_nulls_last(client, init_database, app_instance):
    """Guard against re-introducing ``.nullslast()`` (invalid on MySQL/TiDB)."""
    _seed_logs(app_instance)
    with app_instance.app_context():
        student = db.session.get(UserModel, "stu-1")
        headers = auth_headers_for(student)
        engine = db.engine

    statements = []

    def _capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", _capture)
    try:
        resp = client.get("/api/users/stu-1/stats", headers=headers)
    finally:
        event.remove(engine, "before_cursor_execute", _capture)

    assert resp.status_code == 200, resp.get_data(as_text=True)
    activity_sql = [s for s in statements if "activity_logs" in s.lower()]
    assert activity_sql, "stats endpoint did not query activity_logs"
    assert all("NULLS LAST" not in s.upper() for s in activity_sql), activity_sql
