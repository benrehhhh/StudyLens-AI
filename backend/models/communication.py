from extensions import db
from sqlalchemy.orm import relationship

class NotificationModel(db.Model):
    __tablename__ = "notifications"
    notification_id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    read_at = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.String(64), nullable=False)
    target = db.Column(db.String(255), nullable=True)

    def to_dict(self):
        return {
            "id": self.notification_id,
            "userId": self.user_id,
            "title": self.title,
            "message": self.message,
            "isRead": bool(self.read_at),
            "createdAt": self.created_at or "",
            "target": self.target or None
        }

class AnnouncementModel(db.Model):
    __tablename__ = "announcements"
    announcement_id = db.Column(db.String(64), primary_key=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="CASCADE"), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.String(64), nullable=False)
    updated_at = db.Column(db.String(64), nullable=True)
    posted_at = db.Column(db.String(64), nullable=True)
    author_name = db.Column(db.String(128), nullable=False, default="Faculty")
    target_audience = db.Column(db.String(32), default="all")
    priority = db.Column(db.String(32), default="medium")

    subject = db.relationship("SubjectModel", foreign_keys=[subject_id])

    def _subject_name_loaded(self):
        """Resolve the subject display name from an already-loaded relationship.

        Never queries the database: returns None when the relationship has not
        been eagerly loaded.
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
            subject_name = ""
        return {
            "id": self.announcement_id,
            "teacherId": self.teacher_id,
            "title": self.title,
            "content": self.message,
            "authorName": self.author_name,
            "targetAudience": self.target_audience,
            "priority": self.priority,
            "subjectId": self.subject_id,
            "subjectName": subject_name,
            "createdAt": self.created_at or "",
        }
