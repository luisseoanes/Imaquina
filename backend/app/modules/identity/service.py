"""Cuentas, cursos y matrículas — el lado de ESCRITURA de identidad (N2-N4).

`router.py` mantenía toda la lógica de auth escrita a mano; este archivo la
extiende con lo que faltaba (rotación de refresh, alta de cuentas, cursos)
siguiendo el mismo patrón router-delgado/servicio que ya usa `catalog`.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Unauthenticated
from app.core.security import create_token, decode_token
from app.modules.identity.models import RefreshToken, User

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
