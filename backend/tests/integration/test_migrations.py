"""Guard: los modelos y las migraciones no pueden divergir.

Las fixtures de integración crean el esquema con `Base.metadata.create_all`, que
es rápido pero se alimenta de los MODELOS. Si alguien añade una tabla o una
columna y olvida generar la migración, toda la suite sigue en verde y el fallo
aparece al desplegar, que es el peor sitio posible.

Este test cierra el agujero por el otro lado: levanta una base desechable
aplicando ÚNICAMENTE las migraciones y compara el resultado contra
`Base.metadata`. Si sobra o falta algo, falla diciendo qué.

Si falla: `uv run alembic revision --autogenerate -m "..."` y revisa la revisión.
"""

import os
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from alembic import command
from app.db.all_models import Base

BACKEND_DIR = Path(__file__).resolve().parents[2]
SCRATCH_DB = "imaquina_paridad"


def _url(database: str):
    """URL sincrona (alembic no es async) apuntando a `database`."""
    return (
        make_url(os.environ["DATABASE_URL"])
        .set(drivername="postgresql+psycopg")
        .set(database=database)
    )


def _dsn(database: str) -> str:
    # render_as_string(hide_password=False): str(url) enmascara la contrasena
    # con '***' y alembic no podria conectarse.
    return _url(database).render_as_string(hide_password=False)


@pytest.fixture(scope="module")
def base_migrada():
    """Base creada desde cero aplicando sólo `alembic upgrade head`."""
    try:
        admin = create_engine(_dsn("postgres"), isolation_level="AUTOCOMMIT")
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{SCRATCH_DB}"'))
            conn.execute(text(f'CREATE DATABASE "{SCRATCH_DB}"'))
    except Exception:
        if os.getenv("CI"):
            pytest.fail(
                "Postgres no disponible en CI: el guard de deriva entre "
                "modelos y migraciones NO puede saltarse aqui.",
                pytrace=False,
            )
        pytest.skip(
            "Postgres no disponible. Levantar con `make up`.",
            allow_module_level=True,
        )

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", _dsn(SCRATCH_DB))
    command.upgrade(cfg, "head")

    engine = create_engine(_dsn(SCRATCH_DB))
    yield engine
    engine.dispose()

    with admin.connect() as conn:
        conn.execute(text(f'DROP DATABASE IF EXISTS "{SCRATCH_DB}"'))
    admin.dispose()


def test_las_migraciones_reproducen_los_modelos(base_migrada):
    with base_migrada.connect() as conn:
        ctx = MigrationContext.configure(conn)
        diferencias = compare_metadata(ctx, Base.metadata)

    assert not diferencias, (
        "El esquema que producen las migraciones NO coincide con los modelos.\n"
        "Falta generar una migración (o la que hay está incompleta):\n\n"
        + "\n".join(f"  - {d}" for d in diferencias)
    )
