"""Fixtures que requieren Postgres real.

Los mocks de base de datos mienten (ARQUITECTURA.md 8), así que aquí se corre
contra un Postgres de verdad, con rollback por test. Si la DB no está
levantada, estos tests se saltan con un mensaje claro en vez de reventar.
"""

import os
from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.all_models import Base
from app.db.session import get_db
from app.main import app

DB_URL = os.environ["DATABASE_URL"]


async def _database_reachable() -> bool:
    eng = create_async_engine(DB_URL)
    try:
        async with eng.connect():
            return True
    except Exception:
        return False
    finally:
        await eng.dispose()


@pytest_asyncio.fixture(scope="session")
async def engine():
    if not await _database_reachable():
        pytest.skip(
            "Postgres no disponible. Levantar con `make up` y crear la base "
            "`imaquina_test`.",
            allow_module_level=True,
        )

    eng = create_async_engine(DB_URL)
    async with eng.begin() as conn:
        await conn.exec_driver_sql("CREATE EXTENSION IF NOT EXISTS vector")
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine) -> AsyncIterator[AsyncSession]:
    """Cada test corre en una transacción que se revierte al terminar."""
    async with engine.connect() as conn:
        trans = await conn.begin()
        session = async_sessionmaker(bind=conn, expire_on_commit=False)()
        yield session
        await session.close()
        await trans.rollback()


@pytest_asyncio.fixture
async def client(db) -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()
