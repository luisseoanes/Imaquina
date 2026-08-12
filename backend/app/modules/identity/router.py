from datetime import UTC, date, datetime, time

from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from sqlalchemy import select

from app.core.deps import Db, Tenant
from app.core.errors import LicenseExpired, PermissionDenied
from app.core.security import create_token, verify_password
from app.modules.identity.models import License, User

router = APIRouter(prefix="/auth", tags=["auth"])


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

    # R2: la vigencia se valida al EMITIR el token, no solo en el login,
    # y ademas RECORTA su duracion: si la licencia vence el viernes, un
    # refresh token emitido el jueves no puede durar 30 dias.
    valid_to: datetime | None = None
    if user.institution_id:
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
        valid_to = datetime.combine(lic.valid_to, time.max, tzinfo=UTC)

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
