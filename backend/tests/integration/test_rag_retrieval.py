"""Recuperación vectorial del RAG (F4).

Antes de esto, `assistant.service.retrieve` no tenía ni un test: la
exploración que motivó F5 encontró que ni siquiera se invocaba en producción
(el router nunca pasaba `query_embedding`). Este test fija el contrato: el
chunk más cercano en coseno sale primero, y el contenido del momento actual
se prioriza sobre uno más cercano mas de otro momento.
"""

import uuid
from datetime import date, timedelta

from app.core.config import settings
from app.modules.assistant import service
from app.modules.assistant.models import DocumentChunk
from app.modules.catalog.models import Moment, Project

DIM = settings.EMBEDDING_DIM


def _vector(i: int) -> list[float]:
    """Vectores casi ortogonales entre sí: `_vector(i)` es el más cercano
    a sí mismo en coseno, muy lejos de los demás."""
    v = [0.0] * DIM
    v[i] = 1.0
    return v


async def _proyecto_con_momentos(db) -> tuple[Project, Moment, Moment]:
    proyecto = Project(slug=f"p-{uuid.uuid4().hex[:6]}", grade="5", status="published")
    db.add(proyecto)
    await db.flush()
    m1 = Moment(project_id=proyecto.id, type="intro", order=0)
    m2 = Moment(project_id=proyecto.id, type="inquiry", order=1)
    db.add_all([m1, m2])
    await db.flush()
    return proyecto, m1, m2


async def test_recupera_el_chunk_mas_cercano_en_coseno(db):
    proyecto, m1, _m2 = await _proyecto_con_momentos(db)
    db.add_all(
        [
            DocumentChunk(
                project_id=proyecto.id, moment_id=m1.id, lang="es",
                content="cercano", embedding=_vector(0),
            ),
            DocumentChunk(
                project_id=proyecto.id, moment_id=m1.id, lang="es",
                content="lejano", embedding=_vector(1),
            ),
        ]
    )
    await db.flush()

    resultado = await service.retrieve(
        db, query_embedding=_vector(0), lang="es", moment_id=None, k=2
    )

    assert resultado[0].content == "cercano"


async def test_prioriza_el_contenido_del_momento_actual(db):
    proyecto, m1, m2 = await _proyecto_con_momentos(db)
    db.add_all(
        [
            # Este es el mas cercano en coseno, pero de OTRO momento.
            DocumentChunk(
                project_id=proyecto.id, moment_id=m2.id, lang="es",
                content="otro momento", embedding=_vector(0),
            ),
            # Este esta mas lejos en coseno, pero es del momento en curso.
            DocumentChunk(
                project_id=proyecto.id, moment_id=m1.id, lang="es",
                content="momento actual", embedding=_vector(1),
            ),
        ]
    )
    await db.flush()

    resultado = await service.retrieve(
        db, query_embedding=_vector(0), lang="es", moment_id=m1.id, k=2
    )

    assert resultado[0].content == "momento actual"


async def _usuario_con_licencia(db, *, role: str = "student"):
    from app.core.security import hash_password
    from app.modules.identity.models import Calendar, Institution, License, User

    inst = Institution(name=f"Colegio {uuid.uuid4().hex[:6]}", calendar=Calendar.A)
    db.add(inst)
    await db.flush()
    db.add(
        License(
            institution_id=inst.id,
            calendar=Calendar.A,
            valid_from=date.today() - timedelta(days=1),
            valid_to=date.today() + timedelta(days=365),
            seats=10,
        )
    )
    user = User(
        email=f"u-{uuid.uuid4().hex[:6]}@imaquina.example.com",
        full_name="Usuario",
        password_hash=hash_password("x"),
        role=role,
        institution_id=inst.id,
        grade="5",
    )
    db.add(user)
    await db.flush()
    return user, inst


async def test_sin_embedder_no_se_llama_a_retrieve(db, monkeypatch):
    """`ask()` no debe intentar recuperar nada si no hay embedder (dev/CI sin
    GEMINI_API_KEY): un vector de ceros haría fallar `cosine_distance` en
    pgvector, así que `chunks` debe quedar vacío en vez de reventar."""
    from app.modules.assistant.models import ChatSession
    from app.modules.assistant.provider import StubProvider

    user, inst = await _usuario_con_licencia(db)
    session = ChatSession(user_id=user.id, institution_id=inst.id, lang="es")
    db.add(session)
    await db.flush()

    tokens = [
        t
        async for t in service.ask(
            db,
            StubProvider(reply="ok"),
            session_id=session.id,
            question="hola",
            tenant=None,
            grade=None,
            lang="es",
            embedder=None,
        )
    ]

    assert "".join(tokens).strip() == "ok"
