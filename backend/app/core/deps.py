"""Dependencias transversales.

El aislamiento multi-tenant vive aqui. Ver docs/arquitectura.md 3.2:
toda consulta de datos por institucion DEBE pasar por TenantContext.
Retrofitear esto luego es un proyecto en si mismo.
"""

from dataclasses import dataclass
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import PermissionDenied, Unauthenticated
from app.core.security import decode_token
from app.db.session import get_db


class Role(StrEnum):
    STUDENT = "student"
    TEACHER = "teacher"
    EDITOR = "editor"
    ADMIN = "admin"


@dataclass(frozen=True, slots=True)
class TenantContext:
    """Identidad + frontera de datos del request en curso."""

    user_id: UUID
    institution_id: UUID | None
    role: Role

    @property
    def is_staff(self) -> bool:
        """Puede ver la guia docente (R4) y el tablero de resultados."""
        return self.role in (Role.TEACHER, Role.EDITOR, Role.ADMIN)

    @property
    def can_author(self) -> bool:
        """Puede entrar al Content Studio."""
        return self.role in (Role.EDITOR, Role.ADMIN)

    def require_institution(self) -> UUID:
        """Para consultas que SIEMPRE deben filtrarse por institucion."""
        if self.institution_id is None:
            raise PermissionDenied("El usuario no pertenece a ninguna institucion")
        return self.institution_id


async def get_tenant(
    authorization: Annotated[str | None, Header()] = None,
) -> TenantContext:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthenticated("Falta el token de acceso")

    payload = decode_token(authorization.split(" ", 1)[1])
    if payload is None or payload.get("type") != "access":
        raise Unauthenticated("Token invalido o expirado")

    inst = payload.get("inst")
    return TenantContext(
        user_id=UUID(payload["sub"]),
        institution_id=UUID(inst) if inst else None,
        role=Role(payload["role"]),
    )


def require_role(*allowed: Role):
    """Guard de rol para routers completos o endpoints sueltos."""

    async def _guard(
        tenant: Annotated[TenantContext, Depends(get_tenant)],
    ) -> TenantContext:
        if tenant.role not in allowed:
            raise PermissionDenied(
                f"Requiere uno de estos roles: {', '.join(allowed)}"
            )
        return tenant

    return _guard


# Alias para firmas de endpoint mas legibles.
Db = Annotated[AsyncSession, Depends(get_db)]
Tenant = Annotated[TenantContext, Depends(get_tenant)]
Author = Annotated[TenantContext, Depends(require_role(Role.EDITOR, Role.ADMIN))]
Staff = Annotated[
    TenantContext, Depends(require_role(Role.TEACHER, Role.EDITOR, Role.ADMIN))
]
