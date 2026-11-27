"""Refresh-token records for rotation-based session revocation (P1-01).

A refresh token is a long-lived, single-use secret. On each /api/auth/refresh
call the previous refresh jti is revoked and a new one is minted. Reuse of a
revoked refresh jti revokes the entire token family (all sessions for the user).
"""

from extensions import db


class RefreshTokenModel(db.Model):
    __tablename__ = "refresh_tokens"

    jti = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(
        db.String(64), db.ForeignKey("users.user_id"), nullable=False, index=True
    )
    created_at = db.Column(db.String(64), nullable=False)
    expires_at = db.Column(db.String(64), nullable=False)
    revoked_at = db.Column(db.String(64), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    ip_address = db.Column(db.String(64), nullable=True)

    def to_dict(self):
        return {
            "jti": self.jti,
            "userId": self.user_id,
            "createdAt": self.created_at or "",
            "expiresAt": self.expires_at or "",
            "revokedAt": self.revoked_at or "",
            "userAgent": self.user_agent,
            "ipAddress": self.ip_address,
        }
