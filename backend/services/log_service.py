"""Activity/audit log persistence."""

import datetime

from flask import g, request

from extensions import db
from lib.id import generate_id
from models import ActivityLogModel

def log_action(user_id, user_name, user_role, action, details):
    """Stage an audit log entry within the current request transaction.

    ``log_action`` no longer commits the session itself: it only stages the
    row (flush) so the audit entry commits or rolls back atomically with the
    caller's own database work. A failed log write never fails the request.
    """
    try:
        log_item = ActivityLogModel(
            log_id=generate_id("log"),
            user_id=user_id,
            user_name=user_name,
            user_role=user_role,
            activity=action,
            details=details,
            ip_address=request.remote_addr or "127.0.0.1",
            device=request.user_agent.platform or "Web Browser",
            browser=request.user_agent.browser or "Chrome/Edge",
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
        )
        db.session.add(log_item)
        db.session.flush()
        # Flag the request so app-level after_request can persist entries that
        # are staged *after* an endpoint's last explicit commit.
        g.audit_log_pending = True
    except Exception as e:
        print("Failed to record audit log:", e)
        try:
            db.session.rollback()
        except Exception:
            pass
