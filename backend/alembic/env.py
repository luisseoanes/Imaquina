from logging.config import fileConfig

import pgvector.sqlalchemy
from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.all_models import Base  # noqa: F401  (registra todos los modelos)

config = context.config
# Respeta una url ya fijada (los tests apuntan a una base desechable);
# si no hay ninguna, la del entorno.
config.set_main_option(
    "sqlalchemy.url",
    config.get_main_option("sqlalchemy.url") or settings.sync_database_url,
)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def render_item(type_, obj, autogen_context):
    """Alembic emite `pgvector.sqlalchemy...VECTOR` sin importar el modulo.

    Sin esto, toda migracion que toque `DocumentChunk.embedding` se genera con
    un NameError dentro. Se registra el import y se renderiza el tipo publico.
    """
    if type_ == "type" and isinstance(obj, pgvector.sqlalchemy.Vector):
        autogen_context.imports.add("import pgvector.sqlalchemy")
        return f"pgvector.sqlalchemy.Vector(dim={obj.dim})"
    return False


def run_migrations_offline() -> None:
    context.configure(
        url=settings.sync_database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_item=render_item,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_item=render_item,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
