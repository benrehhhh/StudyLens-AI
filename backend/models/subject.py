from extensions import db
from sqlalchemy.orm import relationship

class SubjectModel(db.Model):
    __tablename__ = "subjects"
    subject_id = db.Column(db.String(64), primary_key=True)
    teacher_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="RESTRICT"), nullable=False)
    subject_code = db.Column(db.String(20), nullable=False)
    subject_name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    semester = db.Column(db.String(20), default="1st Semester")
    course = db.Column(db.String(100), default="BSIT")
    school_year = db.Column(db.String(20), default="2026-2027")
    teacher_name = db.Column(db.String(128), nullable=False, default="Christian C. Barral, MIT")
    student_count = db.Column(db.Integer, default=51)
    material_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.String(64), nullable=False)

    teacher = db.relationship("UserModel", foreign_keys=[teacher_id])

    def to_dict(self):
        return {
            "id": self.subject_id,
            "code": self.subject_code,
            "name": self.subject_name,
            "description": self.description,
            "teacherId": self.teacher_id,
            "teacherName": self.teacher_name,
            "teacherAvatar": getattr(self, "_teacher_avatar", None),
            "teacherDepartment": getattr(self, "_teacher_department", None),
            "semester": self.semester,
            "course": self.course,
            "schoolYear": self.school_year,
            "studentCount": self.student_count,
            "materialCount": self.material_count,
            "createdAt": self.created_at or "",
        }

class StudentSubjectModel(db.Model):
    __tablename__ = "student_subjects"
    student_subject_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="CASCADE"), nullable=False)
    date_enrolled = db.Column(db.String(64), nullable=False)
