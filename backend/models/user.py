from extensions import db
from sqlalchemy import DateTime
import datetime

class RoleModel(db.Model):
    __tablename__ = "roles"
    role_id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    role_name = db.Column(db.String(30), nullable=False, unique=True)

class UserModel(db.Model):
    __tablename__ = "users"
    user_id = db.Column(db.String(64), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.role_id"), nullable=False, default=1)
    first_name = db.Column(db.String(100), nullable=False)
    last_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    profile_picture = db.Column(db.String(255), nullable=True)
    role = db.Column(db.String(32), nullable=False)
    department = db.Column(db.String(128), nullable=True)
    student_id = db.Column(db.String(64), nullable=True)
    status = db.Column(db.String(30), default="active")
    created_at = db.Column(db.String(64), nullable=False)
    created_at_dt = db.Column(DateTime(timezone=True), nullable=True)
    last_login = db.Column(db.String(64), nullable=True)
    last_login_dt = db.Column(DateTime(timezone=True), nullable=True)
    two_factor_code = db.Column(db.String(16), nullable=True)
    two_factor_expires_at = db.Column(db.String(64), nullable=True)
    two_factor_expires_at_dt = db.Column(DateTime(timezone=True), nullable=True)
    failed_login_attempts = db.Column(db.Integer, nullable=True)
    two_factor_attempts = db.Column(db.Integer, nullable=True)
    locked_until = db.Column(db.String(64), nullable=True)
    locked_until_dt = db.Column(DateTime(timezone=True), nullable=True)
    reset_otp = db.Column(db.String(16), nullable=True)
    reset_otp_expires_at = db.Column(db.String(64), nullable=True)
    reset_otp_expires_at_dt = db.Column(DateTime(timezone=True), nullable=True)
    reset_otp_attempts = db.Column(db.Integer, nullable=True)
    email_verified = db.Column(db.Integer, nullable=True)
    email_verify_code = db.Column(db.String(64), nullable=True)
    email_verify_expires_at = db.Column(db.String(64), nullable=True)
    email_verify_expires_at_dt = db.Column(DateTime(timezone=True), nullable=True)
    email_verify_attempts = db.Column(db.Integer, nullable=True)
    token_version = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return {
            "id": self.user_id,
            "name": full_name,
            "firstName": self.first_name,
            "lastName": self.last_name,
            "email": self.email,
            "role": self.role,
            "roleId": self.role_id,
            "avatar": self.profile_picture,
            "department": self.department,
            "studentId": self.student_id,
            "status": self.status,
            "createdAt": self.created_at_dt.isoformat().replace("+00:00", "Z") if self.created_at_dt else (self.created_at or ""),
            "lastLogin": self.last_login_dt.isoformat().replace("+00:00", "Z") if self.last_login_dt else (self.last_login or ""),
            "tokenVersion": self.token_version or 0,
        }
