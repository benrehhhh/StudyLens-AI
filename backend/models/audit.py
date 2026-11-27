from extensions import db

class ActivityLogModel(db.Model):
    __tablename__ = "activity_logs"
    log_id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False)
    activity = db.Column(db.String(255), nullable=False)
    ip_address = db.Column(db.String(45), nullable=True)
    created_at = db.Column(db.String(64), nullable=False)
    device = db.Column(db.String(100), nullable=True)
    browser = db.Column(db.String(100), nullable=True)
    user_name = db.Column(db.String(128), nullable=False, default="User")
    user_role = db.Column(db.String(32), nullable=False, default="student")
    details = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.log_id,
            "userId": self.user_id,
            "userName": self.user_name,
            "userRole": self.user_role,
            "action": self.activity,
            "details": self.details or self.activity,
            "ipAddress": self.ip_address,
            "device": self.device,
            "browser": self.browser,
            "timestamp": self.created_at or ""
        }

class SystemSettingModel(db.Model):
    __tablename__ = "system_settings"
    setting_key = db.Column(db.String(64), primary_key=True)
    setting_value = db.Column(db.Text, nullable=False)

class ActivityLogArchiveModel(db.Model):
    __tablename__ = "audit_archive"
    archive_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    log_id = db.Column(db.String(64))
    user_id = db.Column(db.String(64))
    user_name = db.Column(db.String(128))
    user_role = db.Column(db.String(32))
    activity = db.Column(db.String(255))
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.String(64))
