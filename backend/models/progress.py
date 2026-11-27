from extensions import db

class StudentProgressModel(db.Model):
    __tablename__ = "student_progress"
    progress_id = db.Column(db.String(64), primary_key=True)
    student_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    subject_id = db.Column(db.String(64), db.ForeignKey("subjects.subject_id", ondelete="CASCADE"), nullable=False)
    completion_percentage = db.Column(db.Float, default=0.0)
    average_score = db.Column(db.Float, default=0.0)
    learning_level = db.Column(db.String(32), default="Intermediate")
    updated_at = db.Column(db.String(64), nullable=False)
    last_activity = db.Column(db.String(64), nullable=False)
