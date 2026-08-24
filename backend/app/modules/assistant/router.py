from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select

from app.core.deps import Db, Staff, Tenant
from app.modules.assistant import service
from app.modules.assistant.models import ChatSession
from app.modules.assistant.provider import (
    AssistantProvider,
    get_assistant_provider,
)
from app.modules.identity.models import User

router = APIRouter(prefix="/chat", tags=["assistant"])

Provider = Annotated[AssistantProvider, Depends(get_assistant_provider)]


class StartIn(BaseModel):
    moment_id: UUID | None = None
    lang: str = "es"


@router.post("/sessions")
async def start_session(payload: StartIn, tenant: Tenant, db: Db):
    session = ChatSession(
        user_id=tenant.user_id,
        institution_id=tenant.require_institution(),
        moment_id=payload.moment_id,
        lang=payload.lang,
    )
    db.add(session)
    await db.flush()
    return {"session_id": str(session.id)}


@router.get("/sessions")
async def list_sessions(tenant: Tenant, db: Db, moment_id: UUID | None = None):
    """C2/C6: para que el frontend reuse la sesión del momento en vez de
    crear una nueva en cada montaje."""
    return await service.listar_sesiones(db, tenant, moment_id=moment_id)


@router.get("/sessions/{session_id}/messages")
async def session_messages(session_id: UUID, tenant: Tenant, db: Db):
    return await service.listar_mensajes(db, tenant, session_id)


class AskIn(BaseModel):
    question: str


@router.post("/sessions/{session_id}/ask")
async def ask(
    session_id: UUID,
    payload: AskIn,
    tenant: Tenant,
    db: Db,
    provider: Provider,
):
    """Respuesta en streaming (SSE). El primer token debe salir en <2s."""
    # N7: se revisa AQUI, antes del StreamingResponse -- dentro del generador
    # ya es tarde para devolver un 429 limpio (ver service.ask).
    await service.revisar_rate_limit(tenant)

    user = (
        await db.execute(select(User).where(User.id == tenant.user_id))
    ).scalar_one()

    async def event_stream():
        async for token in service.ask(
            db,
            provider,
            session_id=session_id,
            question=payload.question,
            tenant=tenant,
            grade=user.grade,
            lang=user.preferred_lang,
        ):
            yield f"data: {token}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# --- Registro de rechazos del guardrail (C5) --------------------------------

staff_router = APIRouter(prefix="/studio/assistant", tags=["studio"])


@staff_router.get("/rejections")
async def rejections(staff: Staff, db: Db, limit: int = 100):
    return await service.listar_rechazos(db, staff.require_institution(), limit=limit)
