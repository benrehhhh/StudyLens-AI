"""Activity-log query and moderation handlers."""

from flask import jsonify, request

from db.session import _commit_or_warn
from extensions import db
from models import ActivityLogArchiveModel, ActivityLogModel
from services.log_service import log_action
from services.settings_service import _enforce_archiving, _load_system_settings

# Actions considered part of "Learning Materials Moderation" in the admin UI.
MODERATION_LOG_CODES = [
    "MATERIAL_UPLOAD", "MATERIAL_UPDATE", "MATERIAL_DELETE", "MATERIAL_AI_SAVE",
    "AI_QUIZ_GENERATE", "AI_SUMMARY_GENERATE", "AI_REVIEWER_GENERATE", "AI_FLASHCARDS_GENERATE",
    "AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE",
    "FLASHCARD_UPDATE", "SUMMARY_UPDATE", "REVIEWER_UPDATE",
    "FLASHCARD_DELETE", "SUMMARY_DELETE", "REVIEWER_DELETE",
]

# Coarse categories used by the admin audit-log filter. Grouping by category
# keeps the picker short and lets admins see every event in a domain instead of
# guessing which individual action code to select.
LOG_CATEGORY_CODES = {
    "accounts": [
        "USER_LOGIN", "USER_REGISTER", "USER_CREATED", "USER_UPDATED",
        "USER_STATUS_CHANGED", "USER_DELETED", "PASSWORD_RESET",
        "RESET_OTP_REQUESTED", "PASSWORD_CHANGED", "LOGIN_FAILED",
        "LOGIN_LOCKED", "ACCOUNT_LOCKED", "LOGIN_DISABLED",
        "EMAIL_VERIFY_REQUIRED", "EMAIL_VERIFY_RESUMED", "EMAIL_VERIFIED",
        "TWO_FACTOR_REQUIRED", "LOGOUT_ALL_DEVICES",
    ],
    "materials": [
        "MATERIAL_UPLOAD", "MATERIAL_UPDATE", "MATERIAL_DELETE",
        "MATERIAL_AI_SAVE", "MATERIAL_FLAG", "MATERIAL_FLAG_RESOLVED",
    ],
    "quizzes": [
        "QUIZ_CREATE", "QUIZ_UPDATE", "QUIZ_DELETE", "QUIZ_PUBLISH",
        "QUIZ_UNPUBLISH", "QUIZ_SUBMIT",
    ],
    "subjects": [
        "SUBJECT_CREATE", "SUBJECT_UPDATE", "SUBJECT_DELETE",
        "SUBJECT_ENROLL", "SUBJECT_UNENROLL",
    ],
    "ai": [
        "AI_QUIZ_GENERATE", "AI_SUMMARY_GENERATE", "AI_REVIEWER_GENERATE",
        "AI_FLASHCARDS_GENERATE", "AI_RESOURCE_GENERATE", "AI_RESOURCE_SAVE",
        "AI_SERVICE_DOWN", "FLASHCARD_UPDATE", "FLASHCARD_DELETE",
        "SUMMARY_UPDATE", "SUMMARY_DELETE", "REVIEWER_UPDATE",
        "REVIEWER_DELETE",
    ],
    "system": [
        "ANNOUNCEMENT_POSTED", "ANNOUNCEMENT_DELETED", "SETTINGS_UPDATED",
        "SYSTEM_BOOT", "REPORT_GENERATE", "LOGS_CLEARED", "DIAGNOSTIC_CHECK",
    ],
}


def get_activity_logs():
    try:
        # Auto audit archiving: old logs are archived when the setting is on,
        # not only when an admin saves system settings.
        _enforce_archiving(_load_system_settings())
    except Exception:
        pass
    try:
        page = max(1, int(request.args.get("page", 1) or 1))
    except (TypeError, ValueError):
        page = 1
    try:
        limit = max(1, min(500, int(request.args.get("limit", 25) or 25)))
    except (TypeError, ValueError):
        limit = 25

    query = ActivityLogModel.query

    # Role filter
    role = (request.args.get("role") or "").strip()
    if role:
        query = query.filter(ActivityLogModel.user_role == role)

    # Category filter (coarse grouping used by the admin filter picker)
    category = (request.args.get("category") or "").strip().lower()
    if category in LOG_CATEGORY_CODES:
        query = query.filter(ActivityLogModel.activity.in_(LOG_CATEGORY_CODES[category]))

    # Action filter (supports the special "__moderation__" umbrella)
    action = (request.args.get("action") or "").strip()
    if action:
        if action == "__moderation__":
            query = query.filter(ActivityLogModel.activity.in_(MODERATION_LOG_CODES))
        else:
            query = query.filter(ActivityLogModel.activity == action)

    # Free-text search across action, user name, details and IP
    search = (request.args.get("search") or "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                ActivityLogModel.activity.ilike(like),
                ActivityLogModel.user_name.ilike(like),
                ActivityLogModel.details.ilike(like),
                ActivityLogModel.ip_address.ilike(like),
            )
        )

    total = query.count()
    pages = max(1, (total + limit - 1) // limit)
    # Clamp to the last available page so a stale page number after filtering
    # never returns an empty list.
    page = min(page, pages)
    logs = (
        query.order_by(ActivityLogModel.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return jsonify({
        "logs": [l.to_dict() for l in logs],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages,
    })


def add_activity_log():
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or "usr-admin-1"
    user_name = current_user.get("name") or "System Administrator"
    user_role = "admin"
    action = data.get("action", "ADMIN_ACTION")
    details = data.get("details", "")
    log_action(user_id, user_name, user_role, action, details)
    return jsonify({"success": True})


def clear_activity_logs():
    current_user = getattr(request, "current_user", None) or {}
    user_id = current_user.get("id") or "sys-admin"
    user_name = current_user.get("name") or "System Administrator"
    user_role = current_user.get("role") or "system"
    try:
        # Archive every active log before deletion so the audit trail is retained.
        active_logs = ActivityLogModel.query.all()
        for log in active_logs:
            db.session.add(ActivityLogArchiveModel(
                log_id=log.log_id, user_id=log.user_id, user_name=log.user_name,
                user_role=log.user_role, activity=log.activity, details=log.details,
                ip_address=log.ip_address, created_at=log.created_at,
            ))
        ActivityLogModel.query.delete()
        _commit_or_warn("clear audit logs")

        # Retain one visible clearing record so administrators can audit who cleared logs.
        log_action(user_id, user_name, user_role, "LOGS_CLEARED", "Activity logs archived and cleared by administrator")
        _commit_or_warn("log clear action")
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Could not clear audit logs: {str(e)}", "code": "CLEAR_FAILED"}), 500
    return jsonify({"success": True}), 200
