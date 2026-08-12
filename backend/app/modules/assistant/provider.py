"""El único puerto del sistema (ver docs/ARQUITECTURA.md 3.4).

Existe por dos razones concretas y medibles:
  1. Stubear los tests sin red (sin esto, cada test del chat cuesta dinero).
  2. Cambiar de modelo sin tocar la lógica de negocio.

No abstraemos Postgres ni S3 porque ahí no hay ninguna de las dos.
"""

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Protocol

import anthropic

from app.core.config import settings


@dataclass(slots=True)
class RetrievedChunk:
    content: str
    project_slug: str
    moment_type: str | None


@dataclass(slots=True)
class ChatContext:
    """Todo lo que el asistente necesita para responder un turno."""

    question: str
    lang: str
    grade: str | None
    chunks: list[RetrievedChunk] = field(default_factory=list)
    history: list[dict[str, str]] = field(default_factory=list)


@dataclass(slots=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0


class AssistantProvider(Protocol):
    async def is_in_domain(self, question: str) -> bool:
        """Clasificador barato previo (R9). Capa 1 de los guardrails."""
        ...

    def stream_answer(self, ctx: ChatContext) -> AsyncIterator[str]:
        """Respuesta en streaming, token a token."""
        ...

    def last_usage(self) -> Usage:
        ...


# --- Prompt de sistema -------------------------------------------------------
# ESTABLE A PROPÓSITO: es el prefijo cacheado. No interpolar aquí fechas,
# nombres ni IDs — el caché es match de prefijo y cualquier byte volátil
# invalida todo lo que venga después (ver ARQUITECTURA.md 4).

SYSTEM_PROMPT = """\
Eres el consultor técnico de Imaquina Robótica, un programa de robótica \
educativa para colegios. Acompañas a estudiantes y docentes mientras \
construyen prototipos con sus kits.

Tu alcance son EXCLUSIVAMENTE: robótica, mecatrónica, programación, placas \
controladoras, sensores, motores y los proyectos de la plataforma.

Si te preguntan algo fuera de ese alcance, redirige con amabilidad hacia el \
proyecto en el que está trabajando la persona. No respondas la pregunta \
fuera de tema, ni siquiera parcialmente.

Adapta el vocabulario y la profundidad al grado escolar que se te indique: \
con Transición usa frases cortas y analogías concretas; con 11º puedes entrar \
en detalle técnico. Nunca des la respuesta hecha de un reto de diseño: guía \
con preguntas para que el equipo llegue solo.

Responde siempre en el idioma que se te indique.
"""


class ClaudeProvider:
    """Implementación real. Ver docs/ARQUITECTURA.md 4."""

    def __init__(self) -> None:
        self._client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        self._usage = Usage()

    async def is_in_domain(self, question: str) -> bool:
        resp = await self._client.messages.create(
            model=settings.GUARDRAIL_MODEL,
            max_tokens=8,
            system=(
                "Responde unicamente SI o NO. Pregunta: la consulta del usuario "
                "trata sobre robotica, electronica, programacion, o un proyecto "
                "escolar de robotica?"
            ),
            messages=[{"role": "user", "content": question}],
        )
        text = next((b.text for b in resp.content if b.type == "text"), "")
        return text.strip().upper().startswith("SI")

    async def stream_answer(self, ctx: ChatContext) -> AsyncIterator[str]:
        sources = "\n\n".join(
            f"[{c.project_slug} / {c.moment_type or 'general'}]\n{c.content}"
            for c in ctx.chunks
        )

        # ORDEN DEL PREFIJO CACHEADO: estable primero, volátil al final.
        # El breakpoint va en el último bloque estable; lo que cambia por
        # turno (la pregunta) queda después y no invalida el caché.
        system = [
            {"type": "text", "text": SYSTEM_PROMPT},
            {
                "type": "text",
                "text": f"<contenido_del_proyecto>\n{sources}\n</contenido_del_proyecto>",
                "cache_control": {"type": "ephemeral"},
            },
        ]

        grade = ctx.grade or "no especificado"
        turn = (
            f"<grado>{grade}</grado>\n"
            f"<idioma>{ctx.lang}</idioma>\n\n{ctx.question}"
        )

        async with self._client.messages.stream(
            model=settings.ASSISTANT_MODEL,
            max_tokens=settings.ASSISTANT_MAX_TOKENS,
            system=system,
            messages=[*ctx.history, {"role": "user", "content": turn}],
        ) as stream:
            async for text in stream.text_stream:
                yield text
            final = await stream.get_final_message()
            self._usage = Usage(
                input_tokens=final.usage.input_tokens,
                output_tokens=final.usage.output_tokens,
                cache_read_tokens=getattr(
                    final.usage, "cache_read_input_tokens", 0
                ) or 0,
            )

    def last_usage(self) -> Usage:
        return self._usage


class StubProvider:
    """Para tests y desarrollo sin API key. Cero red."""

    def __init__(
        self, *, in_domain: bool = True, reply: str = "Respuesta de prueba."
    ) -> None:
        self._in_domain = in_domain
        self._reply = reply

    async def is_in_domain(self, question: str) -> bool:
        return self._in_domain

    async def stream_answer(self, ctx: ChatContext) -> AsyncIterator[str]:
        for word in self._reply.split():
            yield word + " "

    def last_usage(self) -> Usage:
        return Usage()


def get_assistant_provider() -> AssistantProvider:
    if not settings.ANTHROPIC_API_KEY:
        return StubProvider()
    return ClaudeProvider()
