from datetime import UTC, date, datetime, time
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import Db, Tenant
from app.core.errors import LicenseExpired, PermissionDenied, Unauthenticated
from app.core.security import create_token, decode_token, verify_password
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

    common = dict(
        subject=user.id,
        institution_id=user.institution_id,
        role=user.role,
        license_valid_to=valid_to,
    )
    return TokenOut(
        access_token=create_token(**common, token_type="access"),
        refresh_token=create_token(**common, token_type="refresh"),
        role=user.role,
        lang=user.preferred_lang,
    )


class RefreshIn(BaseModel):
    refresh_token: str


class AccessOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/refresh", response_model=AccessOut)
async def refresh(payload: RefreshIn, db: Db) -> AccessOut:
    """Canjea un refresh token por un access token nuevo.

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

    return AccessOut(
        access_token=create_token(
            subject=user.id,
            institution_id=user.institution_id,
            role=user.role,
            token_type="access",
            license_valid_to=await _vigencia(db, user),
        )
    )


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
