from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from uuid import UUID, uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from jose import JWTError, jwt

from app.core.config import settings

_hasher = PasswordHasher()

TokenType = Literal["access", "refresh"]


def hash_password(raw: str) -> str:
    return _hasher.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        _hasher.verify(hashed, raw)
        return True
    except VerifyMismatchError:
        return False


def create_token(
    *,
    subject: UUID,
    institution_id: UUID | None,
    role: str,
    token_type: TokenType = "access",
    license_valid_to: datetime | None = None,
) -> str:
    now = datetime.now(UTC)
    delta = (
        timedelta(minutes=settings.ACCESS_TOKEN_MINUTES)
        if token_type == "access"
        else timedelta(days=settings.REFRESH_TOKEN_DAYS)
    )
    # La vigencia de licencia (R2) nunca extiende mas alla de su fecha final.
    expires = now + delta
    if license_valid_to is not None:
        expires = min(expires, license_valid_to)

    payload: dict[str, Any] = {
        "sub": str(subject),
        "inst": str(institution_id) if institution_id else None,
        "role": role,
        "type": token_type,
        "iat": now,
        "exp": expires,
    }
    # N2: solo el refresh lleva jti -- es el que se rota/revoca. El access
    # dura 15 minutos y nunca se guarda en BD, no hace falta rastrearlo.
    if token_type == "refresh":
        payload["jti"] = str(uuid4())
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any] | None:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
