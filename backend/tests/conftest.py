"""Configuración compartida.

Los tests unitarios (tests/unit/) NO tocan infraestructura: corren siempre.
Los de integración (tests/integration/) necesitan Postgres y se SALTAN solos
si no hay base de datos, en vez de fallar con un error de conexión que no
dice nada. Levantar la DB con:  make up
"""

import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://imaquina:imaquina@localhost:5432/imaquina_test",
)
os.environ.setdefault("SECRET_KEY", "clave-solo-para-tests")
os.environ.setdefault("ANTHROPIC_API_KEY", "")  # fuerza StubProvider: cero red
os.environ.setdefault("GEMINI_API_KEY", "")  # fuerza get_embedder() -> None: cero red
