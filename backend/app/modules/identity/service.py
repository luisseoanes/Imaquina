"""Cuentas, cursos y matrículas — el lado de ESCRITURA de identidad (N2-N4).

`router.py` mantenía toda la lógica de auth escrita a mano; este archivo la
extiende con lo que faltaba (rotación de refresh, alta de cuentas, cursos)
siguiendo el mismo patrón router-delgado/servicio que ya usa `catalog`.
"""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import Conflict, NotFound, Unauthenticated, ValidationFailed
from app.core.security import (
    create_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.identity.models import Course, Enrollment, RefreshToken, User

ROLES_VALIDOS = ("student", "teacher", "editor", "admin")

# --- Refresh tokens: rotación y revocación (N2) -----------------------------


async def emitir_refresh(
    db: AsyncSession, user: User, *, license_valid_to: datetime | None
) -> str:
    """Crea un refresh y lo registra: sin la fila no hay forma de revocarlo."""
    token = create_token(
        subject=user.id,
        institution_id=user.institution_id,
        role=user.role,
        token_type="refresh",
        license_valid_to=license_valid_to,
    )
    claims = decode_token(token)
    if claims is None:  # pragma: no cover - se acaba de firmar con la misma clave
        raise Unauthenticated("No se pudo emitir el token de refresco")

    db.add(
        RefreshToken(
            jti=claims["jti"],
            user_id=user.id,
            expires_at=datetime.fromtimestamp(claims["exp"], tz=UTC),
        )
    )
    await db.flush()
    return token


async def rotar_refresh(db: AsyncSession, jti: str) -> None:
    """Consume el jti (rotación real, no solo reemisión).

    Un jti que ya se usó, que no existe o que venció se trata igual: no hay
    forma de distinguir "robado y reutilizado" de "nunca existió" desde fuera,
    así que ambos casos son el mismo error.
    """
    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    ).scalar_one_or_none()
    if (
        row is None
        or row.revoked_at is not None
        or row.expires_at < datetime.now(UTC)
    ):
        raise Unauthenticated("Token de refresco invalido o expirado")
    row.revoked_at = datetime.now(UTC)
    await db.flush()


async def revocar_refresh(db: AsyncSession, jti: str) -> None:
    """Logout: revoca sin exigir que siga vigente (cerrar sesión dos veces
    con el mismo token no debe reventar)."""
    row = (
        await db.execute(select(RefreshToken).where(RefreshToken.jti == jti))
    ).scalar_one_or_none()
    if row is not None and row.revoked_at is None:
        row.revoked_at = datetime.now(UTC)
        await db.flush()


async def revocar_todos_los_refresh(db: AsyncSession, user_id: uuid.UUID) -> None:
    """Mata todas las sesiones vivas del usuario (N15).

    OJO con el alcance: el access token es stateless y NO se puede revocar, así
    que quien tenga uno en la mano sigue entrando hasta que expire —15 minutos.
    Esto corta la renovación, no el acceso inmediato. Acortar esa ventana exige
    una lista de revocación de access tokens, que es justo lo que
    `arquitectura.md` §10 descarta.
    """
    filas = (
        await db.execute(
            select(RefreshToken).where(
                RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)
            )
        )
    ).scalars().all()
    ahora = datetime.now(UTC)
    for fila in filas:
        fila.revoked_at = ahora
    await db.flush()


# --- Alta y gestión de cuentas (N3) -----------------------------------------


def _serializar_user(user: User) -> dict[str, Any]:
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "grade": user.grade,
        "is_active": user.is_active,
    }


async def list_users(db: AsyncSession, institution_id: uuid.UUID) -> list[dict[str, Any]]:
    rows = (
        await db.execute(
            select(User)
            .where(User.institution_id == institution_id)
            .order_by(User.full_name)
        )
    ).scalars().all()
    return [_serializar_user(u) for u in rows]


async def create_user(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    email: str,
    full_name: str,
    password: str,
    role: str,
    grade: str | None = None,
) -> dict[str, Any]:
    if role not in ROLES_VALIDOS:
        raise ValidationFailed(f"Rol inválido: {role}")

    existe = (
        await db.execute(select(User.id).where(User.email == email))
    ).scalar_one_or_none()
    if existe:
        raise Conflict(f"Ya existe una cuenta con el correo '{email}'")

    user = User(
        email=email,
        full_name=full_name,
        password_hash=hash_password(password),
        role=role,
        grade=grade,
        institution_id=institution_id,
    )
    db.add(user)
    await db.flush()
    return _serializar_user(user)


async def _get_user_de_institucion(
    db: AsyncSession, user_id: uuid.UUID, institution_id: uuid.UUID
) -> User:
    user = (
        await db.execute(
            select(User).where(
                User.id == user_id, User.institution_id == institution_id
            )
        )
    ).scalar_one_or_none()
    if user is None:
        raise NotFound("Usuario no encontrado")
    return user


async def update_user(
    db: AsyncSession,
    user_id: uuid.UUID,
    institution_id: uuid.UUID,
    **campos: Any,
) -> dict[str, Any]:
    """Nunca borra: `is_active=False` es el único apagado. Hay `Attempt` y
    `Progress` colgando de un usuario, borrar la fila los dejaría huérfanos."""
    user = await _get_user_de_institucion(db, user_id, institution_id)

    if (role := campos.get("role")) is not None:
        if role not in ROLES_VALIDOS:
            raise ValidationFailed(f"Rol inválido: {role}")
        user.role = role
    for campo in ("full_name", "grade"):
        if (valor := campos.get(campo)) is not None:
            setattr(user, campo, valor)
    if (activo := campos.get("is_active")) is not None:
        user.is_active = activo

    await db.flush()
    return _serializar_user(user)


# --- Contraseñas (N15) -------------------------------------------------------


async def cambiar_password(
    db: AsyncSession, user_id: uuid.UUID, *, actual: str, nueva: str
) -> User:
    """El propio usuario cambia su contraseña, probando que sabe la actual.

    Exigir la actual es lo que separa esto de un secuestro de cuenta: sin ella,
    un access token robado bastaría para dejar fuera al dueño legítimo.
    """
    user = (
        await db.execute(select(User).where(User.id == user_id))
    ).scalar_one_or_none()
    if user is None:
        raise NotFound("Usuario no encontrado")
    if not verify_password(actual, user.password_hash):
        raise ValidationFailed("La contraseña actual no es correcta")
    if verify_password(nueva, user.password_hash):
        raise ValidationFailed("La contraseña nueva debe ser distinta de la actual")

    user.password_hash = hash_password(nueva)
    await db.flush()
    await revocar_todos_los_refresh(db, user.id)
    return user


async def reset_password(
    db: AsyncSession,
    user_id: uuid.UUID,
    institution_id: uuid.UUID,
    *,
    nueva: str,
) -> dict[str, Any]:
    """El administrador fija una contraseña para una cuenta de SU institución.

    No pide la actual —el administrador no la sabe, ese es el punto— así que la
    frontera de datos es lo único que protege esto: `_get_user_de_institucion`
    da 404 para una cuenta de otra institución, no 403, para no confirmar que
    ese correo existe en la plataforma.
    """
    user = await _get_user_de_institucion(db, user_id, institution_id)
    user.password_hash = hash_password(nueva)
    await db.flush()
    await revocar_todos_los_refresh(db, user.id)
    return _serializar_user(user)


# --- Cursos y matrículas (N4) ------------------------------------------------


def _serializar_course(course: Course) -> dict[str, Any]:
    return {
        "id": str(course.id),
        "name": course.name,
        "grade": course.grade,
        "teacher_id": str(course.teacher_id) if course.teacher_id else None,
    }


async def create_course(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    name: str,
    grade: str,
    teacher_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    course = Course(
        institution_id=institution_id, name=name, grade=grade, teacher_id=teacher_id
    )
    db.add(course)
    await db.flush()
    return _serializar_course(course)


async def list_courses(
    db: AsyncSession,
    *,
    institution_id: uuid.UUID,
    teacher_id: uuid.UUID | None = None,
) -> list[dict[str, Any]]:
    """`teacher_id` filtra a "mis cursos": lo que ve un docente que no es
    editor/admin. Sin filtro, la vista de administración ve todos."""
    stmt = select(Course).where(Course.institution_id == institution_id)
    if teacher_id is not None:
        stmt = stmt.where(Course.teacher_id == teacher_id)
    rows = (await db.execute(stmt.order_by(Course.name))).scalars().all()
    return [_serializar_course(c) for c in rows]


async def _get_course(
    db: AsyncSession, course_id: uuid.UUID, institution_id: uuid.UUID
) -> Course:
    course = (
        await db.execute(
            select(Course)
            .where(Course.id == course_id, Course.institution_id == institution_id)
            .options(selectinload(Course.enrollments))
        )
    ).scalar_one_or_none()
    if course is None:
        raise NotFound("Curso no encontrado")
    return course


async def enroll(
    db: AsyncSession,
    course_id: uuid.UUID,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    course = await _get_course(db, course_id, institution_id)
    estudiante = await _get_user_de_institucion(db, user_id, institution_id)
    if any(e.user_id == estudiante.id for e in course.enrollments):
        raise Conflict("El estudiante ya está matriculado en este curso")
    db.add(Enrollment(course_id=course.id, user_id=estudiante.id))
    await db.flush()


async def unenroll(
    db: AsyncSession,
    course_id: uuid.UUID,
    institution_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    course = await _get_course(db, course_id, institution_id)
    fila = next((e for e in course.enrollments if e.user_id == user_id), None)
    if fila is None:
        raise NotFound("El estudiante no está matriculado en este curso")
    await db.delete(fila)
    await db.flush()


async def estudiantes_de(
    db: AsyncSession, course_id: uuid.UUID, institution_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Roster del curso. Lo usa `learning.progreso_del_curso` (N6) para cruzar
    matrícula con `Progress` sin que `learning` toque el modelo `Enrollment`
    directamente."""
    course = await _get_course(db, course_id, institution_id)
    ids = [e.user_id for e in course.enrollments]
    if not ids:
        return []
    rows = (await db.execute(select(User).where(User.id.in_(ids)))).scalars().all()
    return [_serializar_user(u) for u in rows]
