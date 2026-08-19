from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class DomainError(Exception):
    """Base de los errores de negocio. El router nunca traduce a HTTP a mano."""

    status_code = 400
    code = "domain_error"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class NotFound(DomainError):
    status_code = 404
    code = "not_found"


class Unauthenticated(DomainError):
    """No sabemos quien eres: falta el token, es invalido o ha expirado.

    Distinto de PermissionDenied a proposito. El cliente necesita saber si
    tiene que RENOVAR el acceso (401) o si simplemente no le corresponde
    (403); con un unico codigo no puede decidir y acaba echando al usuario.
    """

    status_code = 401
    code = "unauthenticated"


class PermissionDenied(DomainError):
    """Sabemos quien eres, pero esto no te toca."""

    status_code = 403
    code = "permission_denied"


class Conflict(DomainError):
    status_code = 409
    code = "conflict"


class LicenseExpired(DomainError):
    status_code = 403
    code = "license_expired"


class ValidationFailed(DomainError):
    status_code = 422
    code = "validation_failed"


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(DomainError)
    async def _handle(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )
