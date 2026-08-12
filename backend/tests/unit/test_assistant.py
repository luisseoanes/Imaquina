"""Asistente: contrato del puerto y guardrails (R5, R8, R9).

Todo corre contra StubProvider: cero red, cero costo. Esa es exactamente
la razón por la que el puerto existe (ARQUITECTURA.md 3.4).
"""

import pytest

from app.modules.assistant.provider import (
    ChatContext,
    RetrievedChunk,
    StubProvider,
    get_assistant_provider,
)
from app.modules.assistant.service import REDIRECT


async def test_stub_provider_cumple_el_contrato():
    """Si el stub deja de cumplir el Protocol, los tests dejan de valer."""
    provider = StubProvider(reply="Conecta el motor al pin 9.")

    assert await provider.is_in_domain("como conecto el motor?")

    ctx = ChatContext(question="como conecto el motor?", lang="es", grade="5")
    tokens = [t async for t in provider.stream_answer(ctx)]
    assert "".join(tokens).strip() == "Conecta el motor al pin 9."


async def test_sin_api_key_se_usa_el_stub():
    """En desarrollo y CI no debe salir ni una petición a la API."""
    assert isinstance(get_assistant_provider(), StubProvider)


async def test_guardrail_marca_fuera_de_dominio():
    provider = StubProvider(in_domain=False)
    assert not await provider.is_in_domain("quien gano el mundial?")


@pytest.mark.parametrize("lang", ["es", "en"])
def test_hay_mensaje_de_redireccion_en_ambos_idiomas(lang):
    """R9: cuando la pregunta se sale de tema, el bot redirige — y lo hace
    en el idioma del usuario, no siempre en español."""
    mensaje = REDIRECT[lang]
    assert mensaje
    assert "?" in mensaje  # redirige preguntando, no cortando en seco


def test_el_prompt_de_sistema_no_lleva_nada_volatil():
    """El caché es match de prefijo: una fecha o un nombre en el system
    prompt invalida todo lo que venga después y dispara el costo
    (ARQUITECTURA.md 4). Este test es el que atrapa ese error."""
    from app.modules.assistant.provider import SYSTEM_PROMPT

    prohibidos = ["{", "}", "%s", "datetime", "now(", "uuid"]
    for token in prohibidos:
        assert token not in SYSTEM_PROMPT, (
            f"'{token}' en el system prompt: sugiere interpolación volátil "
            "que romperá el prompt caching"
        )


def test_el_contexto_acepta_chunks_recuperados():
    ctx = ChatContext(
        question="que hace el sensor?",
        lang="es",
        grade="Transicion",
        chunks=[
            RetrievedChunk(
                content="El sensor infrarrojo detecta la linea negra.",
                project_slug="seguidor-de-linea",
                moment_type="build",
            )
        ],
    )
    assert ctx.chunks[0].moment_type == "build"
    assert ctx.grade == "Transicion"
