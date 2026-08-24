import uuid
from datetime import date, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Calendar(StrEnum):
    """Calendario escolar colombiano (R2)."""

    A = "A"  # feb -> dic
    B = "B"  # sep -> jun


class Institution(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "institutions"

    name: Mapped[str] = mapped_column(String(200))
    calendar: Mapped[str] = mapped_column(String(1), default=Calendar.A)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    users: Mapped[list["User"]] = relationship(back_populates="institution")


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email", name="uq_users_email"),)

    email: Mapped[str] = mapped_column(String(255), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="student")
    grade: Mapped[str | None] = mapped_column(String(20), nullable=True)
    preferred_lang: Mapped[str] = mapped_column(String(2), default="es")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    institution_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True, nullable=True
    )
    institution: Mapped["Institution | None"] = relationship(back_populates="users")


class License(Base, UUIDMixin, TimestampMixin):
    """Vigencia de acceso (R2).

    Vive aparte de User a proposito: renovar no debe recrear la cuenta,
    y el calendario A/B se modela como fechas, no como enum dentro del usuario.
    """

    __tablename__ = "licenses"

    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    calendar: Mapped[str] = mapped_column(String(1))
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date] = mapped_column(Date)
    seats: Mapped[int] = mapped_column(Integer, default=0)

    def covers(self, day: date) -> bool:
        return self.valid_from <= day <= self.valid_to


class Course(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "courses"

    institution_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("institutions.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(120))
    grade: Mapped[str] = mapped_column(String(20))
    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class Enrollment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "enrollments"
    __table_args__ = (UniqueConstraint("course_id", "user_id", name="uq_enrollment"),)

    course_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("courses.id", ondelete="CASCADE"), index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )


class RefreshToken(Base, UUIDMixin, TimestampMixin):
    """Rotación y revocación de refresh tokens (N2).

    El JWT es stateless por diseño; esta tabla es la excepción deliberada: sin
    ella no hay forma de invalidar un refresh robado, ni de rotarlo de verdad
    (reemitir sin invalidar el anterior no es rotación, es solo reemisión).
    """

    __tablename__ = "refresh_tokens"

    jti: Mapped[str] = mapped_column(String(36), unique=True, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
