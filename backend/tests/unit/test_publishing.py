"""El snapshot es camino de lectura y punto de rollback a la vez."""

import uuid

from app.modules.publishing.service import build_snapshot


class _Tr:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class _Fake:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def _proyecto():
    bloque = _Fake(
        id=uuid.uuid4(),
        kind="text",
        order=0,
        media_asset_id=None,
        translations=[_Tr(lang="es", body="Arma el chasis", caption=None, alt_text=None)],
    )
    momento = _Fake(
        id=uuid.uuid4(),
        type="intro",
        order=0,
        blocks=[bloque],
        translations=[
            _Tr(
                lang="es",
                title="Introduccion",
                teacher_note="Equipos de 4",
                chatbot_opening_prompt="Que crees que hace un robot seguidor?",
            )
        ],
    )
    return _Fake(
        id=uuid.uuid4(),
        slug="seguidor-de-linea",
        grade="5",
        kit="Kit basico",
        moments=[momento],
        translations=[_Tr(lang="es", title="Seguidor de linea", summary=None)],
    )


def test_snapshot_incluye_los_bloques_y_el_prompt_de_apertura():
    snap = build_snapshot(_proyecto(), "es")
    assert snap["title"] == "Seguidor de linea"
    momento = snap["moments"][0]
    assert momento["blocks"][0]["body"] == "Arma el chasis"
    assert momento["chatbot_opening_prompt"]


def test_snapshot_guarda_la_guia_docente():
    """El snapshot es la verdad completa; el filtro por rol ocurre al servir."""
    snap = build_snapshot(_proyecto(), "es")
    assert snap["moments"][0]["teacher_note"] == "Equipos de 4"
