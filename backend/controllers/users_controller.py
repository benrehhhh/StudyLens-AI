"""User directory, profile and account-stat handlers."""

import datetime
import os

from flask import jsonify, request
from lib.password import hash_password, rehash_if_legacy, verify_password

from cloud_storage import upload_avatar_to_cloud
from db.session import _commit_or_warn, get_last_commit_error
from extensions import db
from lib.id import generate_id
from lib.validation import _validate_password_strength
from models import (
    AIGeneratedContentModel,
    AnnouncementModel,
    AuthSessionModel,
    ActivityLogModel,
    MaterialModel,
    QuizAttemptModel,
    QuizModel,
    RefreshTokenModel,
    StudentSubjectModel,
    SubjectModel,
    UserModel,
)
from services.auth_service import _issue_email_verify_code, find_user_by_email, normalize_email
from services.log_service import log_action


def get_users():
    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role") or ""
    user_id = current_user.get("id") or ""
    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", type=int)
    users = UserModel.query.all()
    if role == "teacher":
        # Teachers may only enumerate students enrolled in subjects they manage.
        managed = [s.subject_id for s in SubjectModel.query.filter_by(teacher_id=user_id).all()]
        enrolled_ids = {
            e.student_id
            for e in StudentSubjectModel.query.filter(StudentSubjectModel.subject_id.in_(managed)).all()
        } if managed else set()
        users = [u for u in users if u.user_id in enrolled_ids]
    elif role != "admin":
        return jsonify({"error": "You do not have permission to view the user directory.", "code": "FORBIDDEN"}), 403

    total = len(users)
    if limit is None and offset is None:
        return jsonify([u.to_dict() for u in users])
    limit = max(1, min(200, limit or 100))
    offset = max(0, offset or 0)
    page = users[offset:offset + limit]
    return jsonify({
        "items": [u.to_dict() for u in page],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": (offset + len(page)) < total,
    })


def create_user():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    name = (data.get("name") or "").strip()
    role = data.get("role") or "student"
    department = data.get("department") or "College of Computer Studies"
    status = data.get("status") or "active"

    if not email or "@" not in email:
        return jsonify({"error": "A valid email address is required.", "code": "BAD_REQUEST"}), 400
    if not name:
        return jsonify({"error": "User name is required.", "code": "BAD_REQUEST"}), 400

    existing = find_user_by_email(email)
    if existing:
        return jsonify({"error": f"Account with email {email} already exists.", "code": "DUPLICATE"}), 409

    names = name.split(" ", 1)
    new_user = UserModel(
        user_id=generate_id(f"usr-{role}"),
        first_name=names[0],
        last_name=names[1] if len(names) > 1 else "",
        email=email,
        role=role,
        department=department,
        student_id=f"2024-STU-{int(datetime.datetime.now(datetime.timezone.utc).timestamp()) % 8999 + 1000}" if role == "student" else None,
        status=status,
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    password = data.get("password")
    strength_error = _validate_password_strength(password)
    if strength_error:
        return jsonify({"error": strength_error, "code": "PASSWORD_REQUIRED"}), 400
    new_user.password_hash = hash_password(password)
    db.session.add(new_user)
    if not _commit_or_warn("new user"):
        return jsonify({"error": "Could not save the user. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(new_user.user_id, new_user.to_dict()["name"], role, "USER_CREATED", f"Administrator created {role} account {email}")
    return jsonify(new_user.to_dict()), 201


def update_user(user_id):
    data = request.json or {}
    current_user = getattr(request, "current_user", None) or {}
    is_admin = current_user.get("role") == "admin"
    is_self = current_user.get("id") == user_id
    if not (is_admin or is_self):
        return jsonify({"error": "You do not have permission to edit this account.", "code": "FORBIDDEN"}), 403

    user = db.session.get(UserModel, user_id)
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404

    old_name = ""
    name_changed = False
    if data.get("name"):
        old_name = user.to_dict()["name"]
        names = str(data["name"]).split(" ", 1)
        user.first_name = names[0]
        user.last_name = names[1] if len(names) > 1 else ""
        if old_name != user.to_dict()["name"]:
            name_changed = True
    role_changed = False
    if is_admin and data.get("role"):
        role_changed = user.role != data["role"]
        user.role = data["role"]
    if data.get("department"):
        user.department = data["department"]
    admin_email_changed = False
    if data.get("email"):
        new_email = normalize_email(data["email"])
        if new_email != normalize_email(user.email):
            existing = find_user_by_email(new_email)
            if existing and existing.user_id != user_id:
                return jsonify({"error": "Email already in use.", "code": "EMAIL_EXISTS"}), 400
            user.email = new_email
            if not is_self:
                # Admin-initiated changes still require the account owner to
                # confirm the new address before it can be used to sign in.
                # Self-service profile edits save immediately without a
                # re-verification loop and keep the current session valid.
                admin_email_changed = True
                user.email_verified = 0
                _issue_email_verify_code(user)
        elif user.email != new_email:
            # Heal legacy whitespace-padded rows without treating the cleanup
            # as an email change.
            user.email = new_email
    if "avatar" in data:
        # Removal sends null/""; also guard against literal junk strings
        # ("None"/"null"/"undefined") that must never be stored as a URL.
        raw_avatar = data["avatar"]
        avatar_val = str(raw_avatar).strip() if raw_avatar else ""
        user.profile_picture = avatar_val if avatar_val.lower() not in ("", "none", "null", "undefined") else None
    status_changed = False
    if is_admin and data.get("status"):
        status_changed = user.status != data["status"]
        user.status = data["status"]
    password = data.get("password")
    if isinstance(password, str) and password:
        strength_error = _validate_password_strength(password)
        if strength_error:
            return jsonify({"error": strength_error, "code": "WEAK_PASSWORD"}), 400
        if not is_admin:
            current_password = data.get("currentPassword") or ""
            if not current_password or not verify_password(current_password, user.password_hash or ""):
                return jsonify({"error": "Your current password is incorrect.", "code": "INVALID_CREDENTIALS"}), 403
        new_hash = rehash_if_legacy(password, user.password_hash or "")
        user.password_hash = new_hash or hash_password(password)
        log_action(user.user_id, user.to_dict()["name"], user.role, "PASSWORD_RESET", f"Password updated for {user.email}")

    # Role changes, suspensions, email changes and password resets invalidate
    # that user's existing sessions so privileges are adjusted immediately.
    auth_attr_changed = role_changed or status_changed or admin_email_changed or (isinstance(password, str) and password)
    if auth_attr_changed:
        user.token_version = (user.token_version or 0) + 1

    if not _commit_or_warn("user update"):
        return jsonify({"error": "Could not update the user. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500

    # Propagate a name change to the snapshot fields that duplicate the user's
    # display name, so historical content reflects the updated identity. The
    # audit trail (activity_logs.user_name) is intentionally left immutable.
    if name_changed and old_name:
        new_name = user.to_dict()["name"]
        # Primary path: rows keyed by the user's id (announcements, subjects,
        # materials and quizzes the user authored).
        AnnouncementModel.query.filter_by(teacher_id=user.user_id).update(
            {AnnouncementModel.author_name: new_name}, synchronize_session=False
        )
        SubjectModel.query.filter_by(teacher_id=user.user_id).update(
            {SubjectModel.teacher_name: new_name}, synchronize_session=False
        )
        MaterialModel.query.filter_by(teacher_id=user.user_id).update(
            {MaterialModel.uploaded_by: new_name}, synchronize_session=False
        )
        QuizModel.query.filter_by(teacher_id=user.user_id).update(
            {QuizModel.created_by_name: new_name}, synchronize_session=False
        )
        # Fallback: any content still carrying the old display name gets patched
        # too, covering rows whose author id differs or where a snapshot was
        # stored without an exact id match (e.g. student-authored notes).
        AnnouncementModel.query.filter(
            AnnouncementModel.author_name == old_name
        ).update({AnnouncementModel.author_name: new_name}, synchronize_session=False)
        SubjectModel.query.filter(
            SubjectModel.teacher_name == old_name
        ).update({SubjectModel.teacher_name: new_name}, synchronize_session=False)
        MaterialModel.query.filter(
            MaterialModel.uploaded_by == old_name
        ).update({MaterialModel.uploaded_by: new_name}, synchronize_session=False)
        QuizModel.query.filter(
            QuizModel.created_by_name == old_name
        ).update({QuizModel.created_by_name: new_name}, synchronize_session=False)
        if not _commit_or_warn("name propagation"):
            print(f"[Name Propagation] FAILED for user {user.user_id}: old='{old_name}' new='{new_name}'")

    if status_changed:
        log_action(current_user.get("id") or "usr-admin-1", current_user.get("name") or "System", "admin",
                   "USER_STATUS_CHANGED", f"Status of {user.email} changed to {user.status}")
    log_action(user.user_id, user.to_dict()["name"], user.role, "USER_UPDATED", f"Profile of {user.email} updated")
    return jsonify(user.to_dict()), 200


def upload_user_avatar(user_id):
    current_user = getattr(request, "current_user", None) or {}
    is_admin = current_user.get("role") == "admin"
    is_self = current_user.get("id") == user_id
    if not (is_admin or is_self):
        return jsonify({"error": "You do not have permission to update this avatar.", "code": "FORBIDDEN"}), 403

    user = db.session.get(UserModel, user_id)
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404

    file = request.files.get("file")
    if not file or not file.filename:
        return jsonify({"error": "No image file provided.", "code": "BAD_REQUEST"}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    allowed = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    if ext not in allowed:
        return jsonify({"error": "Please upload a PNG, JPG, GIF, or WEBP image.", "code": "BAD_REQUEST"}), 400

    file_bytes = file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        return jsonify({"error": "Image must be 5 MB or smaller.", "code": "BAD_REQUEST"}), 400

    safe_ext = ext if ext in allowed else ".png"
    filename = generate_id(f"avatar_{user_id}") + safe_ext
    try:
        avatar_url = upload_avatar_to_cloud(file_bytes, filename, content_type=file.mimetype or "image/png")
    except Exception as err:
        print(f"[Avatar Upload] Failed for user {user_id}: {err}")
        return jsonify({
            "error": "Could not upload the profile photo. Please try again.",
            "code": "UPLOAD_FAILED",
        }), 500
    user.profile_picture = avatar_url

    if not _commit_or_warn("avatar update"):
        return jsonify({"error": "Could not save the avatar. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(user.user_id, user.to_dict()["name"], user.role, "USER_UPDATED", f"Profile picture updated for {user.email}")
    return jsonify(user.to_dict()), 200


def get_user_stats(user_id):
    current_user = getattr(request, "current_user", None) or {}
    is_admin = current_user.get("role") == "admin"
    is_self = current_user.get("id") == user_id
    if not (is_admin or is_self):
        return jsonify({"error": "You do not have permission to view these stats.", "code": "FORBIDDEN"}), 403

    user = db.session.get(UserModel, user_id)
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404

    quiz_attempts = QuizAttemptModel.query.filter_by(student_id=user_id).all()
    quizzes_taken = len(quiz_attempts)
    total_time_seconds = sum((a.time_taken or 0) for a in quiz_attempts)
    study_hours = round(total_time_seconds / 3600, 1)

    flashcards_created = AIGeneratedContentModel.query.filter_by(
        generated_by=user_id, content_type="Flashcard"
    ).count()

    materials_uploaded = MaterialModel.query.filter_by(teacher_id=user_id).count()

    recent_activity = (
        ActivityLogModel.query.filter_by(user_id=user_id)
        .order_by(ActivityLogModel.created_at.desc())
        .limit(5)
        .all()
    )

    return jsonify({
        "quizzesTaken": quizzes_taken,
        "flashcardsCreated": flashcards_created,
        "studyHours": study_hours,
        "materialsUploaded": materials_uploaded,
        "recentActivity": [
            {
                "id": log.log_id,
                "action": log.activity,
                "details": log.details or log.activity,
                "timestamp": log.created_at or "",
            }
            for log in recent_activity
        ],
    }), 200


def delete_user(user_id):
    user = db.session.get(UserModel, user_id)
    if not user:
        return jsonify({"error": "User not found.", "code": "NOT_FOUND"}), 404
    if user.role == "admin":
        return jsonify({"error": "Administrator accounts cannot be deleted.", "code": "FORBIDDEN"}), 403
    email = user.email

    # Clean up dependent rows that block deletion via foreign key constraints.
    # These are owned by the user and must be removed before the user row can go.
    AuthSessionModel.query.filter_by(user_id=user_id).delete()
    RefreshTokenModel.query.filter_by(user_id=user_id).delete()
    AIGeneratedContentModel.query.filter_by(generated_by=user_id).delete()
    MaterialModel.query.filter_by(teacher_id=user_id).delete()
    QuizModel.query.filter_by(teacher_id=user_id).delete()

    db.session.delete(user)
    if not _commit_or_warn("user deletion"):
        err_lower = get_last_commit_error().lower()
        if any(k in err_lower for k in ("integrityerror", "foreign key constraint", "cannot delete or update a parent row")):
            return jsonify({"error": "This user still has linked records (subjects, materials, quizzes, reports) and cannot be deleted. Remove those first.", "code": "HAS_DEPENDENTS"}), 409
        return jsonify({"error": "Could not delete the user. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action("usr-admin-1", "System", "admin", "USER_DELETED", f"Deleted account {email}")
    return jsonify({"success": True}), 200
