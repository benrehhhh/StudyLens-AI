import json

from extensions import db

class ReportModel(db.Model):
    __tablename__ = "reports"
    report_id = db.Column(db.String(64), primary_key=True)
    generated_by = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    report_type = db.Column(db.String(100), nullable=False)
    generated_at = db.Column(db.String(64), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    summary_json = db.Column(db.Text, nullable=True)
    target_id = db.Column(db.String(64), nullable=True)

    def to_dict(self):
        try: summary = json.loads(self.summary_json) if self.summary_json else None
        except Exception: summary = None
        return {
            "id": self.report_id,
            "generatedBy": self.generated_by,
            "reportType": self.report_type,
            "generatedAt": self.generated_at or "",
            "title": self.title,
            "summary": summary,
            "targetId": self.target_id
        }
