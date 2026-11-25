"""Subject, roster and grade handlers."""

import datetime

from flask import jsonify, request
from sqlalchemy import func

from db.session import _commit_or_warn
from extensions import db
from lib.id import generate_id
from models import (
    AnnouncementModel,
    MaterialModel,
    QuizAttemptModel,
    StudentSubjectModel,
    SubjectModel,
    UserModel,
)
from services.analytics_service import _latest_attempt_percentages
from services.log_service import log_action
from services.subject_service import _missing_attempt_entries


def get_subjects():
    current_user = getattr(request, "current_user", None) or {}
    requester_role = current_user.get("role") or ""
    requester_id = current_user.get("id") or ""

    limit = request.args.get("limit", type=int)
    offset = request.args.get("offset", type=int)

    subs = SubjectModel.query.all()

    # Privacy Rule: teachers only see the subjects they are assigned to manage.
    if requester_role == "teacher":
        subs = [s for s in subs if s.teacher_id == requester_id]

    # Privacy Rule: students only see the subjects they are enrolled in.
    if requester_role == "student" and requester_id:
        enrolled_ids = {
            en.subject_id for en in StudentSubjectModel.query.filter_by(student_id=requester_id).all()
        }
        subs = [s for s in subs if s.subject_id in enrolled_ids]

    # Batch-compute roster counts and material counts in ONE grouped query each,
    # instead of one query per subject (N+1). Attach to each subject so to_dict
    # stays pure.
    roster_counts = dict(
        db.session.query(
            StudentSubjectModel.subject_id, func.count(StudentSubjectModel.student_subject_id)
        )
        .group_by(StudentSubjectModel.subject_id)
        .all()
    )
    material_counts = dict(
        db.session.query(
            MaterialModel.subject_id, func.count(MaterialModel.material_id)
        )
        .filter(MaterialModel.subject_id.isnot(None))
        .group_by(MaterialModel.subject_id)
        .all()
    )
    teacher_ids = {s.teacher_id for s in subs if s.teacher_id}
    teacher_rows = (
        db.session.query(UserModel.user_id, UserModel.profile_picture, UserModel.department)
        .filter(UserModel.user_id.in_(teacher_ids))
        .all()
    ) if teacher_ids else []
    teacher_info = {uid: (avatar, dept) for uid, avatar, dept in teacher_rows}
    for s in subs:
        s._roster_count = roster_counts.get(s.subject_id)
        s.material_count = material_counts.get(s.subject_id, 0)
        avatar_dept = teacher_info.get(s.teacher_id)
        s._teacher_avatar = avatar_dept[0] if avatar_dept else None
        s._teacher_department = avatar_dept[1] if avatar_dept else None

    total = len(subs)
    if limit is None and offset is None:
        # Legacy array response for clients that have not been updated.
        results = []
        for s in subs:
            d = s.to_dict()
            d["materialCount"] = material_counts.get(s.subject_id, 0)
            results.append(d)
        return jsonify(results)
    limit = max(1, min(200, limit or 100))
    offset = max(0, offset or 0)
    page = subs[offset:offset + limit]
    return jsonify({
        "items": [s.to_dict() for s in page],
        "total": total,
        "limit": limit,
        "offset": offset,
        "hasMore": (offset + len(page)) < total,
    })


def create_subject():
    data = request.json or {}
    code = (data.get("code") or "").strip()
    name = (data.get("name") or "").strip()
    teacher_id = (data.get("teacherId") or "").strip()

    if not code or not name:
        return jsonify({"error": "Subject code and name are required.", "code": "BAD_REQUEST"}), 400
    if not teacher_id:
        return jsonify({"error": "Please assign a teacher to manage this subject.", "code": "BAD_REQUEST"}), 400

    teacher = db.session.get(UserModel, teacher_id)
    if not teacher:
        return jsonify({"error": "Assigned teacher account was not found.", "code": "BAD_REQUEST"}), 400
    if teacher.role != "teacher":
        return jsonify({"error": "Only a teacher account can be assigned to manage a subject.", "code": "BAD_REQUEST"}), 400

    if SubjectModel.query.filter_by(subject_code=code).first():
        return jsonify({"error": f"A subject with code '{code}' already exists.", "code": "DUPLICATE"}), 409

    new_sub = SubjectModel(
        subject_id=generate_id("sub"),
        teacher_id=teacher.user_id,
        subject_code=code,
        subject_name=name,
        description=(data.get("description") or "").strip() or None,
        semester=data.get("semester") or "1st Semester",
        course=data.get("course") or "BSIT",
        school_year=data.get("schoolYear") or "2026-2027",
        teacher_name=teacher.to_dict()["name"],
        student_count=0,
        material_count=0,
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    )
    new_sub._teacher_avatar = teacher.profile_picture
    db.session.add(new_sub)
    _commit_or_warn("subject creation")
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_CREATE", f"Created subject '{code} - {name}' and assigned {teacher.to_dict()['name']}")
    return jsonify(new_sub.to_dict()), 201


def update_subject(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    data = request.json or {}
    new_code = (data.get("code") or sub.subject_code).strip()
    if data.get("code") and new_code != sub.subject_code and SubjectModel.query.filter_by(subject_code=new_code).first():
        return jsonify({"error": f"A subject with code '{new_code}' already exists.", "code": "DUPLICATE"}), 409

    sub.subject_code = new_code
    sub.subject_name = (data.get("name") or sub.subject_name).strip()
    sub.description = data.get("description") if data.get("description") is not None else sub.description
    sub.semester = data.get("semester") or sub.semester
    sub.course = data.get("course") or sub.course
    sub.school_year = data.get("schoolYear") or sub.school_year

    new_teacher_id = (data.get("teacherId") or "").strip()
    if new_teacher_id and new_teacher_id != sub.teacher_id:
        teacher = db.session.get(UserModel, new_teacher_id)
        if not teacher or teacher.role != "teacher":
            return jsonify({"error": "Only a teacher account can be assigned to manage a subject.", "code": "BAD_REQUEST"}), 400
        sub.teacher_id = teacher.user_id
        sub.teacher_name = teacher.to_dict()["name"]
        sub._teacher_avatar = teacher.profile_picture
        sub._teacher_department = teacher.department

    if not hasattr(sub, "_teacher_avatar"):
        teacher = db.session.get(UserModel, sub.teacher_id)
        sub._teacher_avatar = teacher.profile_picture if teacher else None
        sub._teacher_department = teacher.department if teacher else None

    _commit_or_warn("subject update")
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_UPDATE", f"Updated subject '{sub.subject_code} - {sub.subject_name}'")
    return jsonify(sub.to_dict()), 200


def delete_subject(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    code_name = f"{sub.subject_code} - {sub.subject_name}"
    try:
        AnnouncementModel.query.filter_by(subject_id=subject_id).delete()
        StudentSubjectModel.query.filter_by(subject_id=subject_id).delete()
        db.session.delete(sub)
        _commit_or_warn("subject deletion")
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Could not delete this subject because it still has linked records.", "code": "CONFLICT"}), 409

    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_DELETE", f"Deleted subject '{code_name}'")
    return jsonify({"success": True}), 200


def get_subject(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Access rule: admins, the teacher assigned to manage this subject, or an
    # enrolled student may open the subject workspace.
    is_assigned_teacher = role == "teacher" and user_id == sub.teacher_id
    is_enrolled_student = role == "student" and StudentSubjectModel.query.filter_by(
        subject_id=subject_id, student_id=user_id
    ).first() is not None
    if role != "admin" and not is_assigned_teacher and not is_enrolled_student:
        return jsonify({"error": "You are not authorized to view this subject.", "code": "FORBIDDEN"}), 403

    teacher = db.session.get(UserModel, sub.teacher_id)
    sub._teacher_avatar = teacher.profile_picture if teacher else None
    sub._teacher_department = teacher.department if teacher else None
    return jsonify(sub.to_dict()), 200


def get_subject_students(subject_id):
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    # Access rule: admins, the teacher assigned to manage this subject, or an
    # enrolled student may view the roster (people in the subject).
    is_assigned_teacher = role == "teacher" and user_id == sub.teacher_id
    is_enrolled_student = role == "student" and StudentSubjectModel.query.filter_by(
        subject_id=subject_id, student_id=user_id
    ).first() is not None
    if role != "admin" and not is_assigned_teacher and not is_enrolled_student:
        return jsonify({"error": "You are not authorized to view this subject roster.", "code": "FORBIDDEN"}), 403

    enrollments = StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    # Students only see peer names, never classmates' email addresses.
    include_email = role in ("admin", "teacher")
    students = []
    for en in enrollments:
        student = db.session.get(UserModel, en.student_id)
        if student:
            student_data = student.to_dict()
            entry = {
                "id": student.user_id,
                "name": student_data["name"],
                "avatar": student_data.get("avatar"),
                "studentId": student.student_id,
                "department": student_data.get("department"),
                "dateEnrolled": en.date_enrolled
            }
            if include_email:
                entry["email"] = student.email
            students.append(entry)
    students.sort(key=lambda s: s["name"].lower())
    return jsonify(students), 200


def assign_subject_students(subject_id):
    """Assign (enroll) one or more students to a subject. Admin-only, like teacher assignment."""
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    data = request.json or {}
    student_ids = data.get("studentIds") or []
    if not isinstance(student_ids, list) or not student_ids:
        return jsonify({"error": "Please provide at least one studentId to assign.", "code": "BAD_REQUEST"}), 400

    now_str = datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")
    existing = {
        en.student_id for en in StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    }
    added = 0
    for sid in student_ids:
        student = db.session.get(UserModel, sid)
        if not student or student.role != "student":
            continue
        if sid in existing:
            continue
        db.session.add(StudentSubjectModel(
            student_id=sid,
            subject_id=subject_id,
            date_enrolled=now_str
        ))
        existing.add(sid)
        added += 1

    if not _commit_or_warn("assign students to subject"):
        return jsonify({"error": "Could not save the enrollment. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_ENROLL",
               f"Assigned {added} student(s) to '{sub.subject_code} - {sub.subject_name}'")

    enrollments = StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    students = []
    for en in enrollments:
        student = db.session.get(UserModel, en.student_id)
        if student:
            student_data = student.to_dict()
            students.append({
                "id": student.user_id,
                "name": student_data["name"],
                "avatar": student_data.get("avatar"),
                "email": student.email,
                "studentId": student.student_id,
                "department": student_data.get("department"),
                "dateEnrolled": en.date_enrolled
            })
    students.sort(key=lambda s: s["name"].lower())
    return jsonify({"students": students, "added": added}), 201


def unassign_subject_students(subject_id):
    """Unassign (unenroll) one or more students from a subject. Admin-only."""
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    data = request.json or {}
    student_ids = data.get("studentIds") or []
    if not isinstance(student_ids, list) or not student_ids:
        return jsonify({"error": "Please provide at least one studentId to unassign.", "code": "BAD_REQUEST"}), 400

    removed = 0
    for sid in student_ids:
        en = StudentSubjectModel.query.filter_by(subject_id=subject_id, student_id=sid).first()
        if en:
            db.session.delete(en)
            removed += 1

    if not _commit_or_warn("unassign students from subject"):
        return jsonify({"error": "Could not save the removal. The database write failed. Please try again.", "code": "SAVE_FAILED"}), 500
    log_action(request.current_user["id"], request.current_user["name"], "admin", "SUBJECT_UNENROLL",
               f"Removed {removed} student(s) from '{sub.subject_code} - {sub.subject_name}'")

    enrollments = StudentSubjectModel.query.filter_by(subject_id=subject_id).all()
    students = []
    for en in enrollments:
        student = db.session.get(UserModel, en.student_id)
        if student:
            student_data = student.to_dict()
            students.append({
                "id": student.user_id,
                "name": student_data["name"],
                "avatar": student_data.get("avatar"),
                "email": student.email,
                "studentId": student.student_id,
                "dateEnrolled": en.date_enrolled
            })
    students.sort(key=lambda s: s["name"].lower())
    return jsonify({"students": students, "removed": removed}), 200


def get_subject_grades(subject_id):
    """Quiz grades for a subject.

    - Students see their own quiz attempts + computed final grade (average %).
    - Teachers/admins see a per-student breakdown for the subject roster.
    """
    sub = db.session.get(SubjectModel, subject_id)
    if not sub:
        return jsonify({"error": "Subject not found.", "code": "NOT_FOUND"}), 404

    current_user = getattr(request, "current_user", None) or {}
    role = current_user.get("role", "")
    user_id = current_user.get("id", "")

    is_assigned_teacher = role == "teacher" and user_id == sub.teacher_id
    is_enrolled_student = role == "student" and StudentSubjectModel.query.filter_by(
        subject_id=subject_id, student_id=user_id
    ).first() is not None
    if role != "admin" and not is_assigned_teacher and not is_enrolled_student:
        return jsonify({"error": "You are not authorized to view grades for this subject.", "code": "FORBIDDEN"}), 403

    attempts = (QuizAttemptModel.query
                .filter_by(subject_id=subject_id)
                .order_by(QuizAttemptModel.submitted_at.desc())
                .all())

    base = {"subjectId": subject_id, "subjectName": sub.subject_name}

    if role == "admin" or is_assigned_teacher:
        roster = []
        for en in StudentSubjectModel.query.filter_by(subject_id=subject_id).all():
            student = db.session.get(UserModel, en.student_id)
            if not student:
                continue
            own = [a.to_dict() for a in attempts if a.student_id == student.user_id]
            display = sorted(
                own + _missing_attempt_entries(subject_id, student.user_id, student.to_dict()["name"], own),
                key=lambda a: str(a.get("submittedAt") or ""),
                reverse=True,
            )
            latest_pcts = _latest_attempt_percentages(own)
            roster.append({
                "studentId": student.user_id,
                "studentName": student.to_dict()["name"],
                "attemptCount": len(own),
                "averagePercentage": round(sum(latest_pcts) / len(latest_pcts)) if latest_pcts else 0,
                "attempts": display,
            })
        roster.sort(key=lambda r: r["studentName"].lower())
        base["students"] = roster
    else:
        own = [a.to_dict() for a in attempts if a.student_id == user_id]
        display = sorted(
            own + _missing_attempt_entries(subject_id, user_id, current_user.get("name", "Student"), own),
            key=lambda a: str(a.get("submittedAt") or ""),
            reverse=True,
        )
        latest_pcts = _latest_attempt_percentages(own)
        base["studentId"] = user_id
        base["studentName"] = current_user.get("name", "Student")
        base["attemptCount"] = len(own)
        base["averagePercentage"] = round(sum(latest_pcts) / len(latest_pcts)) if latest_pcts else 0
        base["attempts"] = display

    return jsonify(base), 200
