"""Auth y vigencias (R2).

Lo importante aquí no es que el hash funcione (eso lo garantiza argon2),
sino que la licencia acorte de verdad la vida del token: si la licencia
vence el viernes, un token emitido el jueves no puede durar 30 días.
"""

from datetime import UTC, date, datetime, timedelta
from uuid import uuid4

from app.core.security import (
    create_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.identity.models import License


def test_password_hash_no_es_reversible():
    h = hash_password("robotica-2027")
    assert h != "robotica-2027"
    assert verify_password("robotica-2027", h)
    assert not verify_password("otra-clave", h)


def test_dos_hashes_de_la_misma_clave_difieren():
    """Salt distinto por hash; si esto falla, el salt no se está aplicando."""
    assert hash_password("igual") != hash_password("igual")


def test_token_roundtrip_conserva_identidad_y_tenant():
    user, inst = uuid4(), uuid4()
    token = create_token(subject=user, institution_id=inst, role="teacher")
    payload = decode_token(token)

    assert payload is not None
    assert payload["sub"] == str(user)
    assert payload["inst"] == str(inst)
    assert payload["role"] == "teacher"
    assert payload["type"] == "access"


def test_token_manipulado_no_decodifica():
    token = create_token(subject=uuid4(), institution_id=None, role="student")
    assert decode_token(token[:-4] + "aaaa") is None
    assert decode_token("basura") is None


def test_la_licencia_recorta_la_expiracion_del_token():
    """R2: la vigencia manda sobre la duración normal del token."""
    vence_pronto = datetime.now(UTC) + timedelta(minutes=3)

    token = create_token(
        subject=uuid4(),
        institution_id=uuid4(),
        role="student",
        token_type="refresh",  # duraría 30 días
        license_valid_to=vence_pronto,
    )
    exp = datetime.fromtimestamp(decode_token(token)["exp"], tz=UTC)

    assert exp <= vence_pronto + timedelta(seconds=1)


def test_sin_licencia_el_token_usa_su_duracion_normal():
    token = create_token(subject=uuid4(), institution_id=None, role="admin")
    exp = datetime.fromtimestamp(decode_token(token)["exp"], tz=UTC)
    assert exp > datetime.now(UTC) + timedelta(minutes=10)


def test_license_covers_los_bordes_del_calendario():
    """Calendario A: feb -> dic 2027. Los extremos cuentan como vigentes."""
    lic = License(
        institution_id=uuid4(),
        calendar="A",
        valid_from=date(2027, 2, 1),
        valid_to=date(2027, 12, 15),
        seats=300,
    )
    assert lic.covers(date(2027, 2, 1))
    assert lic.covers(date(2027, 12, 15))
    assert lic.covers(date(2027, 6, 30))
    assert not lic.covers(date(2027, 1, 31))
    assert not lic.covers(date(2027, 12, 16))


def test_calendario_b_cruza_el_cambio_de_ano():
    """Calendario B: sep 2027 -> jun 2028."""
    lic = License(
        institution_id=uuid4(),
        calendar="B",
        valid_from=date(2027, 9, 1),
        valid_to=date(2028, 6, 30),
        seats=200,
    )
    assert lic.covers(date(2027, 12, 31))
    assert lic.covers(date(2028, 1, 1))
    assert not lic.covers(date(2028, 7, 1))


def test_el_router_de_login_pasa_la_vigencia_al_token():
    """Regresión: `valid_to` se calculaba y se tiraba a la basura, así que la
    licencia NO recortaba el token. Lo detectó ruff (F841), no un test.

    Este guard verifica que la llamada siga pasando `license_valid_to`.
    """
    import inspect

    from app.modules.identity import router

    fuente = inspect.getsource(router.login)
    assert "license_valid_to=valid_to" in fuente, (
        "login() debe pasar la vigencia de la licencia a create_token, "
        "o el token sobrevive a la licencia (R2)"
    )
