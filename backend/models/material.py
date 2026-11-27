from extensions import db
from models.subject import SubjectModel
from models.user import UserModel
from sqlalchemy.orm import relationship

class MaterialModel(db.Model):
    __tablename__ = "learning_materials"
    material_id = db.Column(db.String(64), primary_key=True)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="SET NULL"), nullable=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    file_url = db.Column(db.String(255), nullable=True)
    file_type = db.Column(db.String(30), nullable=False)
    file_size = db.Column(db.String(32), nullable=True)
    extracted_text = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.String(64), nullable=False)
    material_type = db.Column(db.String(50), default="course")
    uploaded_by = db.Column(db.String(128), nullable=False, default="Faculty")
    uploader_role = db.Column(db.String(32), nullable=False, default="teacher")

    subject = db.relationship("SubjectModel", foreign_keys=[subject_id])
    teacher = db.relationship("UserModel", foreign_keys=[teacher_id])

    def _subject_name_loaded(self):
        """Resolve the subject display name from an already-loaded relationship.

        Never queries the database: returns None when the relationship has not
        been eagerly loaded, so callers must use joined/selectin loading to
        avoid N+1 queries.
        """
        from sqlalchemy.inspection import inspect
        try:
            if not inspect(self).attrs.subject.loaded:
                return None
        except Exception:
            return None
        sub = self.subject
        if sub is None:
            return None
        return f"{sub.subject_code} - {sub.subject_name}"

    def to_dict(self):
        subject_name = self._subject_name_loaded()
        if subject_name is None:
            if self.subject_id in ("", None):
                subject_name = ""
            else:
                subject_name = self.title
        return {
            "id": self.material_id,
            "title": self.title,
            "description": self.description,
            "subjectId": self.subject_id,
            "subjectName": subject_name,
            "fileType": self.file_type,
            "fileUrl": self.file_url,
            "fileSize": self.file_size,
            "extractedText": self.extracted_text,
            "uploadedBy": self.uploaded_by,
            "uploaderRole": self.uploader_role,
            "uploaderId": self.teacher_id,
            "materialType": self.material_type,
            "createdAt": self.uploaded_at or "",
        }

class MaterialFlagModel(db.Model):
    """A content-review flag an administrator raises on a teacher's uploaded
    material (e.g. wrong file, wrong subject). Resolved flags are kept as an
    audit trail; resolution notes are teacher-provided."""

    __tablename__ = "material_flags"
    flag_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), db.ForeignKey("learning_materials.material_id", ondelete="SET NULL"), nullable=True)
    flagged_by = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    category = db.Column(db.String(50), nullable=False, default="Other")
    note = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.String(64), nullable=False)
    resolved_at = db.Column(db.String(64), nullable=True)
    resolved_by = db.Column(db.String(64), nullable=True)
    resolution_note = db.Column(db.Text, nullable=True)

    def to_dict(self):
        def name_for(user_id):
            if not user_id:
                return None
            try:
                u = db.session.get(UserModel, user_id)
                if not u:
                    return None
                return f"{u.first_name} {u.last_name}".strip() or u.email
            except Exception:
                return None
        mat = None
        sub = None
        try:
            mat = db.session.get(MaterialModel, self.material_id)
            sub = db.session.get(SubjectModel, mat.subject_id) if mat and mat.subject_id else None
        except Exception:
            pass
        return {
            "id": self.flag_id,
            "materialId": self.material_id,
            "materialTitle": mat.title if mat else "(deleted material)",
            "subjectId": sub.subject_id if sub else (mat.subject_id if mat else None),
            "subjectName": f"{sub.subject_code} - {sub.subject_name}" if sub else None,
            "flaggedById": self.flagged_by,
            "flaggedByName": name_for(self.flagged_by),
            "category": self.category,
            "note": self.note,
            "status": self.status,
            "createdAt": self.created_at or "",
            "resolvedAt": self.resolved_at or "",
            "resolvedById": self.resolved_by,
            "resolvedByName": name_for(self.resolved_by),
            "resolutionNote": self.resolution_note,
        }

class AIGeneratedContentModel(db.Model):
    __tablename__ = "ai_generated_content"
    content_id = db.Column(db.String(64), primary_key=True)
    material_id = db.Column(db.String(64), db.ForeignKey("learning_materials.material_id", ondelete="SET NULL"), nullable=True)
    generated_by = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(32), nullable=False)
    generated_text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64), nullable=False)
