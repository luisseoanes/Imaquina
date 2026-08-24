"""Limpieza de media huérfana (S19).

`media.service.borrar` da de baja el registro sin tocar el bucket. El trabajo
ARQ es quien de verdad borra el objeto, y solo si para entonces sigue sin
haber ninguna fila con esa `s3_key` — la comprobación es la guarda contra
condiciones de carrera. No hay bucket real en estos tests: se sustituye
`boto3.client` por un doble y se comprueba que `delete_object` se llama (o no).
"""

import uuid
from datetime import date, timedelta
from unittest.mock import MagicMock, patch

from app.core.security import hash_password
from app.modules.identity.models import Calendar, Institution, License, User
from app.modules.media.models import MediaAsset
from app.workers.worker import delete_orphaned_media


class _MismaSesion:
    """Le presta al worker la MISMA sesión/transacción del test.

    `delete_orphaned_media` abre su propia sesión con `SessionLocal()` — en
    producción es lo correcto (nunca comparte sesión con el request HTTP),
    pero en test necesitamos que vea las filas que el test acaba de añadir
    sin tener que hacer commit. `__aexit__` no cierra nada: la fixture `db`
    sigue siendo la dueña del ciclo de vida.
    """

    def __init__(self, session):
        self._session = session

    async def __aenter__(self):
        return self._session

    async def __aexit__(self, *exc_info):
        return False


async def _con_sesion_del_test(db, monkeypatch):
    from app.workers import worker as worker_module

    monkeypatch.setattr(worker_module, "SessionLocal", lambda: _MismaSesion(db))


async def test_borra_el_objeto_si_ya_no_hay_ninguna_fila(db, monkeypatch):
    await _con_sesion_del_test(db, monkeypatch)

    cliente_falso = MagicMock()
    with patch("boto3.client", return_value=cliente_falso):
        resultado = await delete_orphaned_media({}, "media/2026/08/no-existe/foto.png")

    assert resultado["borrado"] is True
    cliente_falso.delete_object.assert_called_once()


async def test_no_borra_si_alguna_fila_sigue_apuntando_a_la_clave(db, monkeypatch):
    await _con_sesion_del_test(db, monkeypatch)

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
        full_name="editor",
        password_hash=hash_password("x"),
        role="editor",
        institution_id=inst.id,
    )
    db.add(user)
    await db.flush()
    db.add(
        MediaAsset(
            s3_key="media/2026/08/sigue-en-uso/foto.png",
            mime_type="image/png",
            size_bytes=10,
            original_filename="foto.png",
            uploaded_by=user.id,
        )
    )
    await db.flush()

    cliente_falso = MagicMock()
    with patch("boto3.client", return_value=cliente_falso):
        resultado = await delete_orphaned_media(
            {}, "media/2026/08/sigue-en-uso/foto.png"
        )

    assert resultado["borrado"] is False
    cliente_falso.delete_object.assert_not_called()
