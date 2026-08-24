"""Chat con RAG y guardrails en capas (R5, R8, R9).

Capa 1: clasificador barato previo (Haiku).
Capa 2: prompt de sistema con alcance explícito + instrucción de redirección.
Capa 3: registro de rechazos para afinar.
Capa 4: rate limit por usuario (protege costo y evita abuso).
"""

import uuid
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

import redis.asyncio as redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import TenantContext
from app.core.errors import NotFound, RateLimited
from app.modules.assistant.models import ChatMessage, ChatSession, DocumentChunk
from app.modules.assistant.provider import (
    AssistantProvider,
    ChatContext,
    RetrievedChunk,
)

# Turnos de HISTORIAL que se le pasan al modelo (C1). No todo el historial:
# cada turno extra es tokens que se pagan en cada pregunta de la sesión.
HISTORY_MAX_MESSAGES = 20

_redis: redis.Redis | None = None


def _cliente_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(str(settings.REDIS_URL))
    return _redis


async def revisar_rate_limit(tenant: TenantContext) -> None:
    """N7: ventana fija de una hora. Antes de tocar el provider -- es lo que
    protege el costo real, revisar después ya habría gastado el token."""
    r = _cliente_redis()
    ventana = datetime.now(UTC).strftime("%Y%m%d%H")
    clave = f"chat_rate:{tenant.user_id}:{ventana}"
    actual = await r.incr(clave)
    if actual == 1:
        await r.expire(clave, 3600)
    if actual > settings.CHAT_RATE_LIMIT_PER_HOUR:
        raise RateLimited(
            "Has alcanzado el límite de preguntas por hora. Intenta más tarde."
        )


async def _historial(db: AsyncSession, session_id: uuid.UUID) -> list[dict[str, str]]:
    """C1: los últimos turnos de la sesión, ANTES de añadir la pregunta
    actual -- esa va aparte como `ctx.question`, no debe duplicarse aquí."""
    filas = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
    ).scalars().all()
    return [
        {"role": m.role, "content": m.content} for m in filas[-HISTORY_MAX_MESSAGES:]
    ]

REDIRECT = {
    "es": (
        "Esa pregunta se sale de lo que puedo acompañar. Sigamos con tu "
        "proyecto de robótica: ¿en qué parte del prototipo estás trabajando?"
    ),
    "en": (
        "That question is outside what I can help with. Let's get back to your "
        "robotics project: which part of the prototype are you working on?"
    ),
}


async def retrieve(
    db: AsyncSession,
    *,
    query_embedding: list[float],
    lang: str,
    moment_id: uuid.UUID | None,
    k: int = settings.RAG_TOP_K,
) -> list[RetrievedChunk]:
    """Búsqueda vectorial, priorizando el momento actual como contexto."""
    stmt = (
        select(DocumentChunk)
        .where(DocumentChunk.lang == lang)
        .order_by(DocumentChunk.embedding.cosine_distance(query_embedding))
        .limit(k)
    )
    rows = (await db.execute(stmt)).scalars().all()

    # El contenido del momento en curso va primero en el prompt.
    if moment_id:
        rows = sorted(rows, key=lambda c: c.moment_id != moment_id)

    return [
        RetrievedChunk(
            content=c.content,
            project_slug=str(c.project_id),
            moment_type=str(c.moment_id) if c.moment_id else None,
        )
        for c in rows
    ]


async def ask(
    db: AsyncSession,
    provider: AssistantProvider,
    *,
    session_id: uuid.UUID,
    question: str,
    tenant: TenantContext,
    grade: str | None,
    lang: str = "es",
    query_embedding: list[float] | None = None,
) -> AsyncIterator[str]:
    # N7: el rate limit se revisa en el router, ANTES de construir el
    # `StreamingResponse` (ver `router.py`) -- una vez la respuesta empieza a
    # transmitirse, una excepción aquí dentro ya no puede convertirse en un
    # 429 JSON limpio, la conexión ya se comprometió a un 200.
    session = (
        await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    ).scalar_one()

    # ANTES de anadir el turno actual: si no, el propio mensaje que se acaba
    # de guardar aparecería duplicado dentro de `history` y como `question`.
    history = await _historial(db, session_id)

    mensaje_usuario = ChatMessage(session_id=session_id, role="user", content=question)
    db.add(mensaje_usuario)

    # --- Guardrail capa 1 ------------------------------------------------
    if not await provider.is_in_domain(question):
        # El rechazo se marca en la PREGUNTA, no en la respuesta enlatada de
        # redirección (esa es siempre el mismo texto fijo, no sirve para
        # afinar el clasificador -- C5 necesita saber QUÉ se rechazó).
        mensaje_usuario.was_redirected = True
        reply = REDIRECT.get(lang, REDIRECT["es"])
        db.add(ChatMessage(session_id=session_id, role="assistant", content=reply))
        await db.flush()
        yield reply
        return

    chunks = (
        await retrieve(
            db,
            query_embedding=query_embedding,
            lang=lang,
            moment_id=session.moment_id,
        )
        if query_embedding
        else []
    )

    ctx = ChatContext(
        question=question, lang=lang, grade=grade, chunks=chunks, history=history
    )

    parts: list[str] = []
    async for token in provider.stream_answer(ctx):
        parts.append(token)
        yield token

    usage = provider.last_usage()
    db.add(
        ChatMessage(
            session_id=session_id,
            role="assistant",
            content="".join(parts),
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            cache_read_tokens=usage.cache_read_tokens,
        )
    )
    await db.flush()


# --- Historial de sesiones (C2) ---------------------------------------------


async def listar_sesiones(
    db: AsyncSession, tenant: TenantContext, *, moment_id: uuid.UUID | None = None
) -> list[dict[str, Any]]:
    """Las sesiones del usuario, más recientes primero. `moment_id` filtra a
    "la sesión de este momento" -- lo que necesita `ChatPanel` para reusar en
    vez de crear una nueva en cada montaje (C6)."""
    stmt = select(ChatSession).where(ChatSession.user_id == tenant.user_id)
    if moment_id is not None:
        stmt = stmt.where(ChatSession.moment_id == moment_id)
    filas = (
        await db.execute(stmt.order_by(ChatSession.created_at.desc()))
    ).scalars().all()
    return [
        {
            "id": str(s.id),
            "moment_id": str(s.moment_id) if s.moment_id else None,
            "lang": s.lang,
            "created_at": s.created_at.isoformat(),
        }
        for s in filas
    ]


async def listar_mensajes(
    db: AsyncSession, tenant: TenantContext, session_id: uuid.UUID
) -> list[dict[str, Any]]:
    """Solo el dueño puede leer su propia sesión -- filtra por `user_id`, no
    solo por `id`, o cualquiera con el UUID leería la conversación de otro."""
    session = (
        await db.execute(
            select(ChatSession).where(
                ChatSession.id == session_id, ChatSession.user_id == tenant.user_id
            )
        )
    ).scalar_one_or_none()
    if session is None:
        raise NotFound("Sesión no encontrada")

    filas = (
        await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
    ).scalars().all()
    return [{"id": str(m.id), "role": m.role, "content": m.content} for m in filas]


# --- Registro de rechazos del guardrail (C5) --------------------------------


async def listar_rechazos(
    db: AsyncSession, institution_id: uuid.UUID, *, limit: int = 100
) -> list[dict[str, Any]]:
    """Solo lectura -- afinar el clasificador es de Luis (ver CLAUDE.md), esto
    solo le da de dónde tirar."""
    filas = (
        await db.execute(
            select(ChatMessage)
            .join(ChatSession, ChatSession.id == ChatMessage.session_id)
            .where(
                ChatSession.institution_id == institution_id,
                ChatMessage.was_redirected.is_(True),
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
        )
    ).scalars().all()
    return [
        {"id": str(m.id), "content": m.content, "created_at": m.created_at.isoformat()}
        for m in filas
    ]
