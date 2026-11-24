import os, io, json, jwt, secrets, datetime, mimetypes, threading, time
from functools import wraps
from flask import Flask, request, jsonify, send_file, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import func
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

from groq_service import (
    call_groq_ai,
    generate_quiz_with_groq,
    generate_flashcards_with_groq,
    generate_summary_with_groq,
    generate_reviewer_with_groq,
    explain_answer_with_groq,
    generate_hint_with_groq,
    generate_recommendations_with_groq,
    generate_title_with_groq,
    describe_image_with_groq,
    IMAGE_EXTENSIONS,
    reset_generation_source,
    generation_used_fallback,
    GroqAPIError
)
from cloud_storage import upload_file_to_cloud
from email_service import is_email_enabled, send_otp_email

from config import (
    ALLOWED_MATERIAL_EXTENSIONS,
    ALLOWED_ORIGINS,
    DB_POOL_RECYCLE,
    DB_TARGET,
    IS_PRODUCTION,
    MAX_EXTRACT_PAGES,
    MAX_UPLOAD_MB,
    PORT,
    SECRET_KEY,
)
from db import session as db_session
from db.session import _commit_or_warn
from extensions import db
from lib.constants import DEFAULT_SYSTEM_SETTINGS
from models import (
    AIGeneratedContentModel,
    ActivityLogArchiveModel,
    ActivityLogModel,
    AnnouncementModel,
    MaterialFlagModel,
    MaterialModel,
    NotificationModel,
    QuizAttemptModel,
    QuizModel,
    QuizQuestionModel,
    ReportModel,
    RoleModel,
    StudentProgressModel,
    StudentSubjectModel,
    SubjectModel,
    SystemSettingModel,
    UserModel,
)
from models.quiz import (
    _collision_safe_question_id,
    _merge_questions_json,
    _quiz_questions_for,
    _replace_quiz_questions,
)

from db.migrations import run_startup_repairs
from lib.auth import (
    _extract_session_token,
    require_auth,
    require_roles,
    token_required,
)
from lib.constants import (
    DEFAULT_SYSTEM_SETTINGS,
    EMAIL_VERIFY_EXPIRY_MINUTES,
    EMAIL_VERIFY_MAX_ATTEMPTS,
    LOCKOUT_BASE_MINUTES,
    LOCKOUT_MAX_MINUTES,
    MAX_AI_FLASHCARDS,
    MAX_AI_QUESTIONS,
    MAX_AI_CALLS_PER_MINUTE,
    MAX_LOGIN_ATTEMPTS,
    RESET_OTP_EXPIRY_MINUTES,
    RESET_OTP_MAX_ATTEMPTS,
    TWO_FACTOR_MAX_ATTEMPTS,
)
from lib.files import _clean_extracted_text, _delete_local_upload, _extract_text_from_file
from lib.rate_limit import _ai_rate_limited, _rate_limit_exceeded, _rate_limit_status
from lib.ai_content import _ai_content_to_dict, _trim_preview
from lib.validation import (
    _clamp_attempts,
    _clamp_count,
    _json_loads,
    _require_within_max,
    _reveal_answers,
    _validate_password_strength,
)
from services.access_service import _can_view_student_data, _teacher_covers_student
from services.ai_service import _save_ai_generated_content
from services.analytics_service import _build_student_learning_profile, _latest_attempt_percentages
from services.auth_service import (
    _apply_lockout,
    _clear_email_verify_state,
    _clear_login_failures,
    _email_verify_payload,
    _escalated_lockout_minutes,
    _generate_otp,
    _is_account_locked,
    _issue_email_verify_code,
    _lock_minutes_remaining,
    _register_login_failure,
    _user_is_email_verified,
    generate_token,
)
from services.log_service import log_action
from pdf.quiz import _build_quiz_pdf
from services.notification_service import (
    _create_notification,
    _fan_out_quiz_notification,
    _notification_recipients,
)
from services.report_service import REPORT_TYPES, _build_report_summary
from services.settings_service import (
    _boolify_settings,
    _enforce_archiving,
    _load_system_settings,
    _save_system_settings,
)

# Environment loading and the uploads directory are handled by config.py.

app = Flask(__name__)

from routes import register_blueprints  # noqa: E402

register_blueprints(app)

# Uploaded files are served through a hardened application route (serve_uploaded_file)
# instead of a public static mount: paths are resolved strictly inside the uploads
# root, and responses carry explicit Content-Type / nosniff / CSP-sandbox headers.
# The /uploads/<file> URL scheme is unchanged so existing frontend and mobile
# consumers keep working, but raw static directory serving is gone.

# Hardened CORS: only known frontend origins may call the API. The Vite dev server
# runs on localhost:3000 by default; add LAN/host origin(s) via ALLOWED_ORIGINS.
# Credentials are required so the HttpOnly session cookie and X-CSRF-Token are
# sent cross-origin; origins must be explicit (never a wildcard) with credentials.
CORS(
    app,
    origins=ALLOWED_ORIGINS,
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "X-Client-Type"],
)

# Structured request logging + request ID middleware (P2-14).
from lib.logging_config import configure_logging, request_id_middleware

configure_logging(app)
request_id_middleware(app)


@app.after_request
def _security_headers(response):
    """Apply defense-in-depth security headers to every API response."""
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data: https:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    # HSTS only over HTTPS / in production.
    if IS_PRODUCTION or request.is_secure:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


@app.after_request
def _persist_pending_audit_logs(response):
    """Commit audit entries staged via ``log_action`` once the request finishes.

    ``log_action`` intentionally does not commit mid-request (P1-04). Endpoints
    that record their audit entry after their last explicit commit would
    otherwise have it rolled back at teardown, silently dropping history such
    as new registrations. Committing here keeps that invariant while ensuring
    the staged entry survives the request.
    """
    if getattr(g, "audit_log_pending", False):
        g.audit_log_pending = False
        _commit_or_warn("pending audit logs")
    return response


app.config["SECRET_KEY"] = SECRET_KEY
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024


@app.errorhandler(413)
def _handle_413(_err):
    return jsonify({
        "error": f"Upload is too large. The maximum allowed size is {MAX_UPLOAD_MB} MB.",
        "code": "FILE_TOO_LARGE",
    }), 413


@app.errorhandler(500)
def _handle_500(err):
    """Return JSON instead of HTML for unhandled server errors."""
    print(f"[Server] Unhandled 500: {err}")
    return jsonify({
        "error": "An unexpected server error occurred. Please try again.",
        "code": "INTERNAL_ERROR",
    }), 500

app.config["SQLALCHEMY_DATABASE_URI"] = DB_TARGET
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
if DB_TARGET.startswith("mysql"):
    # MySQL/TiDB drops idle pooled connections. pool_pre_ping validates the
    # connection before use, and pool_recycle retires stale ones first. TiDB
    # Cloud Starter closes idle connections after 5 minutes (default 300s).
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        "pool_pre_ping": True,
        "pool_recycle": DB_POOL_RECYCLE,
    }
db.init_app(app)

# Apply idempotent schema/data repairs once per process at startup so existing
# databases provisioned before a column was added keep working. On serverless
# platforms every cold start imports this module; set RUN_STARTUP_REPAIRS=false
# after the schema has been provisioned once to keep cold starts fast.
if os.getenv("RUN_STARTUP_REPAIRS", "true").strip().lower() in ("1", "true", "yes", "on"):
    run_startup_repairs(app)


@app.errorhandler(GroqAPIError)
def handle_groq_error(err):
    """Safe, structured error contract for Groq failures. Never leaks the API key."""
    status_map = {
        "INVALID_API_KEY": 503,
        "RATE_LIMITED": 429,
        "TIMEOUT": 504,
        "API_UNAVAILABLE": 502,
        "AI_SERVICE_DOWN": 502,
        "MODEL_NOT_FOUND": 502,
        "API_ERROR": 502,
        "COUNT_EXCEEDS_MAX": 400,
    }
    status = status_map.get(err.code, 502)
    return jsonify({"error": err.message, "code": err.code}), status


# ----------------------------------------------------
# REST API ENDPOINTS
# ----------------------------------------------------

# Global maintenance-mode gate applies to all /api/* routes.
from lib.middleware import enforce_maintenance_mode, enforce_production_demo_account_safety

app.before_request(enforce_maintenance_mode)
app.before_request(enforce_production_demo_account_safety)
if __name__ == "__main__":
    # Demo data is never seeded automatically. Provision it explicitly with:
    #   python backend/scripts/seed_dev.py
    #
    # Debug mode is opt-in ONLY (FLASK_DEBUG=true). The Werkzeug debugger is a
    # remote-code-execution vector on a public interface, so it is off by default.
    debug_mode = os.getenv("FLASK_DEBUG", "false").strip().lower() in ("1", "true", "yes", "on")
    print(f"StudyLens AI Python Flask Backend running on http://127.0.0.1:{PORT} (debug={debug_mode})")
    app.run(host="0.0.0.0", port=PORT, debug=debug_mode)
