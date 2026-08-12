"""Validación al publicar (Content Studio).

Se valida al PUBLICAR, no al escribir: el editor puede guardar a medias.
Estas reglas son las que impiden que el cliente publique un proyecto roto
para cientos de estudiantes.
"""

import uuid

from app.modules.catalog.models import MOMENT_ORDER
from app.modules.publishing.service import validate_for_publish


class _Obj:
    def __init__(self, **kw):
        self.__dict__.update(kw)


def _bloque(body="Contenido"):
    return _Obj(
        id=uuid.uuid4(),
        kind="text",
        order=0,
        media_asset_id=None,
        translations=[_Obj(lang="es", body=body, caption=None, alt_text=None)],
    )


def _momento(tipo, *, con_titulo=True, con_bloques=True):
    return _Obj(
        id=uuid.uuid4(),
        type=tipo,
        order=MOMENT_ORDER.index(tipo),
        blocks=[_bloque()] if con_bloques else [],
        translations=[
            _Obj(
                lang="es",
                title=f"Momento {tipo}",
                teacher_note=None,
                chatbot_opening_prompt=None,
            )
        ]
        if con_titulo
        else [],
    )


def _proyecto(momentos=None, *, con_titulo=True):
    return _Obj(
        id=uuid.uuid4(),
        slug="seguidor-de-linea",
        grade="5",
        kit="Kit basico",
        moments=momentos if momentos is not None else [_momento(t) for t in MOMENT_ORDER],
        translations=[_Obj(lang="es", title="Seguidor de linea", summary=None)]
        if con_titulo
        else [],
    )


def test_proyecto_completo_no_tiene_problemas():
    assert validate_for_publish(_proyecto(), "es") == []


def test_exige_los_seis_momentos():
    """R7: faltar un momento del recorrido metodológico bloquea la publicación."""
    incompletos = [_momento(t) for t in MOMENT_ORDER[:4]]
    problemas = validate_for_publish(_proyecto(incompletos), "es")

    assert any("communicate" in p for p in problemas)
    assert any("assess" in p for p in problemas)
    assert len(problemas) == 2


def test_momento_sin_contenido_bloquea():
    momentos = [_momento(t) for t in MOMENT_ORDER]
    momentos[2] = _momento(MOMENT_ORDER[2], con_bloques=False)

    problemas = validate_for_publish(_proyecto(momentos), "es")
    assert any("no tiene contenido" in p for p in problemas)


def test_momento_sin_titulo_traducido_bloquea():
    momentos = [_momento(t) for t in MOMENT_ORDER]
    momentos[0] = _momento(MOMENT_ORDER[0], con_titulo=False)

    problemas = validate_for_publish(_proyecto(momentos), "es")
    assert any("no tiene título" in p for p in problemas)


def test_proyecto_sin_titulo_bloquea():
    problemas = validate_for_publish(_proyecto(con_titulo=False), "es")
    assert any("título del proyecto" in p for p in problemas)


def test_publicar_solo_en_es_es_valido():
    """El proyecto puede publicarse en español aunque falte el inglés (R6):
    la traducción la escribe el cliente cuando la tenga."""
    assert validate_for_publish(_proyecto(), "es") == []
    assert validate_for_publish(_proyecto(), "en") != []
