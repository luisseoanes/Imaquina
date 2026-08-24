from datetime import UTC, date, datetime, time
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import Admin, Db, Staff, Tenant
from app.core.errors import LicenseExpired, PermissionDenied, Unauthenticated
from app.core.security import create_token, decode_token, verify_password
from app.modules.identity import service
from app.modules.identity.models import License, User

router = APIRouter(prefix="/auth", tags=["auth"])


async def _vigencia(db: AsyncSession, user: User) -> datetime | None:
    """Fin de vigencia de la licencia, o None si el usuario no tiene institucion.

    R2: se valida al EMITIR el token, no solo en el login. Si esto viviera solo
    dentro de /login, un refresh renovaria el acceso de una licencia ya vencida
    indefinidamente.
    """
    if not user.institution_id:
        return None

    lic = (
        await db.execute(
            select(License)
            .where(License.institution_id == user.institution_id)
            .order_by(License.valid_to.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if lic is None or not lic.covers(date.today()):
        raise LicenseExpired("La licencia de la institucion no esta vigente")

    # valid_to es una fecha; la licencia cubre el dia completo.
    return datetime.combine(lic.valid_to, time.max, tzinfo=UTC)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    lang: str


class MeOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    grade: str | None
    lang: str


@router.post("/login", response_model=TokenOut)
async def login(payload: LoginIn, db: Db) -> TokenOut:
    user = (
        await db.execute(select(User).where(User.email == payload.email))
    ).scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise PermissionDenied("Credenciales invalidas")
    if not user.is_active:
        raise PermissionDenied("Cuenta desactivada")

    # La vigencia ademas RECORTA la duracion del token: si la licencia vence el
    # viernes, un refresh emitido el jueves no puede durar 30 dias.
    valid_to = await _vigencia(db, user)

    return TokenOut(
        access_token=create_token(
            subject=user.id,
            institution_id=user.institution_id,
            role=user.role,
            token_type="access",
            license_valid_to=valid_to,
        ),
        refresh_token=await service.emitir_refresh(db, user, license_valid_to=valid_to),
        role=user.role,
        lang=user.preferred_lang,
    )


class RefreshIn(BaseModel):
    refresh_token: str


class AccessOut(BaseModel):
    access_token: str
    # N2: rotación real -- el refresh que se acaba de canjear queda revocado
    # y este es el único que sirve de aquí en adelante. El cliente TIENE que
    # guardarlo o se queda sin forma de refrescar en el siguiente intento.
    refresh_token: str
    token_type: str = "bearer"


@router.post("/refresh", response_model=AccessOut)
async def refresh(payload: RefreshIn, db: Db) -> AccessOut:
    """Canjea un refresh token por un access token nuevo y ROTA el refresh.

    El rol y la institucion se releen de la BASE DE DATOS, no de los claims del
    token: si a alguien se le cambia el rol o se le desactiva la cuenta, el
    cambio surte efecto en el siguiente refresco y no dentro de 30 dias.
    """
    claims = decode_token(payload.refresh_token)
    if claims is None or claims.get("type") != "refresh":
        raise Unauthenticated("Token de refresco invalido o expirado")

    user = (
        await db.execute(select(User).where(User.id == UUID(claims["sub"])))
    ).scalar_one_or_none()
    if user is None or not user.is_active:
        raise Unauthenticated("La cuenta ya no esta activa")

    # La vigencia se revisa ANTES de rotar: si la licencia expiró, el refresh
    # no se quema -- puede volver a servir en cuanto se renueve la licencia,
    # que es una condición que se autocorrige sola, a diferencia de un jti
    # robado. Rotar solo pasa en el camino feliz.
    valid_to = await _vigencia(db, user)
    await service.rotar_refresh(db, claims["jti"])

    return AccessOut(
        access_token=create_token(
            subject=user.id,
            institution_id=user.institution_id,
            role=user.role,
            token_type="access",
            license_valid_to=valid_to,
        ),
        refresh_token=await service.emitir_refresh(db, user, license_valid_to=valid_to),
    )


@router.post("/logout", status_code=204)
async def logout(payload: RefreshIn, db: Db) -> None:
    """Revoca el refresh token. No exige que siga vigente: cerrar sesión dos
    veces con el mismo token, o uno ya expirado, no debe dar error."""
    claims = decode_token(payload.refresh_token)
    if claims is not None and claims.get("type") == "refresh":
        await service.revocar_refresh(db, claims["jti"])


@router.get("/me", response_model=MeOut)
async def me(tenant: Tenant, db: Db) -> MeOut:
    user = (
        await db.execute(select(User).where(User.id == tenant.user_id))
    ).scalar_one()
    return MeOut(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        grade=user.grade,
        lang=user.preferred_lang,
    )


# --- Alta y gestión de cuentas (N3) -----------------------------------------
#
# Guard `Admin`, no `Author`: crear cuentas es de un rol aparte, ni editor ni
# docente pueden hacerlo. Todo scopeado a `tenant.institution_id` -- son datos
# de menores, cruzar instituciones es un incidente.

admin_router = APIRouter(prefix="/admin", tags=["admin"])


class UserIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8)
    role: str = Field(pattern="^(student|teacher|editor|admin)$")
    grade: str | None = Field(default=None, max_length=20)


class UserPatch(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    role: str | None = Field(default=None, pattern="^(student|teacher|editor|admin)$")
    grade: str | None = None
    is_active: bool | None = None


@admin_router.get("/users")
async def list_users(admin: Admin, db: Db):
    return await service.list_users(db, admin.require_institution())


@admin_router.post("/users", status_code=201)
async def create_user(payload: UserIn, admin: Admin, db: Db):
    return await service.create_user(
        db, institution_id=admin.require_institution(), **payload.model_dump()
    )


@admin_router.patch("/users/{user_id}")
async def update_user(user_id: UUID, payload: UserPatch, admin: Admin, db: Db):
    datos = payload.model_dump(exclude_unset=True)
    return await service.update_user(db, user_id, admin.require_institution(), **datos)


# --- Cursos y matrículas (N4) ------------------------------------------------
#
# Crear cursos y matricular es del administrador; un docente solo LISTA los
# suyos (`Staff`, filtrado por `teacher_id`).

courses_router = APIRouter(prefix="/courses", tags=["courses"])


class CourseIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    grade: str = Field(min_length=1, max_length=20)
    teacher_id: UUID | None = None


class EnrollIn(BaseModel):
    user_id: UUID


@courses_router.get("")
async def list_courses(staff: Staff, db: Db, mine: bool = False):
    """`mine=true`: solo los cursos donde `teacher_id` es quien pide (lo que
    ve un docente). Sin el filtro, la vista de administración ve todos."""
    teacher_id = staff.user_id if mine else None
    return await service.list_courses(
        db, institution_id=staff.require_institution(), teacher_id=teacher_id
    )


@courses_router.post("", status_code=201)
async def create_course(payload: CourseIn, admin: Admin, db: Db):
    return await service.create_course(
        db, institution_id=admin.require_institution(), **payload.model_dump()
    )


@courses_router.post("/{course_id}/enrollments", status_code=204)
async def enroll(course_id: UUID, payload: EnrollIn, admin: Admin, db: Db) -> None:
    await service.enroll(db, course_id, admin.require_institution(), payload.user_id)


@courses_router.delete("/{course_id}/enrollments/{user_id}", status_code=204)
async def unenroll(course_id: UUID, user_id: UUID, admin: Admin, db: Db) -> None:
    await service.unenroll(db, course_id, admin.require_institution(), user_id)


@courses_router.get("/{course_id}/students")
async def course_students(course_id: UUID, staff: Staff, db: Db):
    return await service.estudiantes_de(db, course_id, staff.require_institution())
