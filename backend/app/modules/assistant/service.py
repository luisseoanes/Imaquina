"""Chat con RAG y guardrails en capas (R5, R8, R9).

Capa 1: clasificador barato previo (Haiku).
Capa 2: prompt de sistema con alcance explícito + instrucción de redirección.
Capa 3: registro de rechazos para afinar.
Capa 4: rate limit por usuario (protege costo y evita abuso).
"""

import uuid
from collections.abc import AsyncIterator

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import TenantContext
from app.modules.assistant.models import ChatMessage, ChatSession, DocumentChunk
from app.modules.assistant.provider import (
    AssistantProvider,
    ChatContext,
    RetrievedChunk,
)

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
    session = (
        await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    ).scalar_one()

    db.add(ChatMessage(session_id=session_id, role="user", content=question))

    # --- Guardrail capa 1 ------------------------------------------------
    if not await provider.is_in_domain(question):
        reply = REDIRECT.get(lang, REDIRECT["es"])
        db.add(
            ChatMessage(
                session_id=session_id,
                role="assistant",
                content=reply,
                was_redirected=True,
            )
        )
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

    ctx = ChatContext(question=question, lang=lang, grade=grade, chunks=chunks)

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
