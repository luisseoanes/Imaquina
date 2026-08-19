"""Capa de servicio de media.

Existe para que otros modulos pregunten por un asset sin importar su modelo:
la regla de `arquitectura.md` 2 es que un modulo llama al SERVICIO de otro.
"""

import uuid
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict, NotFound
from app.modules.media.models import MediaAsset

# Prefijo MIME por familia: el editor filtra por "imagenes", no por
# "image/webp".
FAMILIAS = ("image", "audio", "video", "application")


async def asset_existe(db: AsyncSession, asset_id: uuid.UUID) -> bool:
    return (
        await db.execute(select(MediaAsset.id).where(MediaAsset.id == asset_id))
    ).scalar_one_or_none() is not None


def _serializar(asset: MediaAsset, usos: int) -> dict[str, Any]:
    return {
        "id": str(asset.id),
        "s3_key": asset.s3_key,
        "mime_type": asset.mime_type,
        "size_bytes": asset.size_bytes,
        "original_filename": asset.original_filename,
        "duration_seconds": asset.duration_seconds,
        "alt_text": asset.alt_text,
        "created_at": asset.created_at.isoformat(),
        # Cuantos bloques lo usan: el editor necesita saberlo ANTES de intentar
        # borrar, no despues de recibir un 409.
        "used_in": usos,
    }


async def listar(
    db: AsyncSession,
    *,
    familia: str | None = None,
    buscar: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """La libreria es reutilizable, asi que crece: paginada desde el dia 1."""
    filtros = []
    if familia:
        filtros.append(MediaAsset.mime_type.startswith(f"{familia}/"))
    if buscar:
        patron = f"%{buscar}%"
        filtros.append(
            or_(
                MediaAsset.original_filename.ilike(patron),
                MediaAsset.alt_text.ilike(patron),
            )
        )

    total = (
        await db.execute(select(func.count(MediaAsset.id)).where(*filtros))
    ).scalar_one()

    assets = (
        (
            await db.execute(
                select(MediaAsset)
                .where(*filtros)
                .order_by(MediaAsset.created_at.desc())
                .limit(limit)
                .offset(offset)
            )
        )
        .scalars()
        .all()
    )

    usos = await _usos(db, [a.id for a in assets])
    return {
        "total": total,
        "items": [_serializar(a, usos.get(a.id, 0)) for a in assets],
    }


async def _usos(db: AsyncSession, asset_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    # Import dentro de la funcion: catalog ya importa este modulo para validar
    # `media_asset_id`, y a nivel de modulo seria circular.
    from app.modules.catalog import service as catalog

    return await catalog.uso_de_assets(db, asset_ids)


async def borrar(db: AsyncSession, asset_id: uuid.UUID) -> None:
    """No se borra un asset en uso.

    `content_blocks.media_asset_id` tiene ON DELETE SET NULL: borrarlo dejaria
    los bloques que lo usan apuntando a nada, sin aviso y posiblemente en un
    proyecto ya publicado.
    """
    asset = (
        await db.execute(select(MediaAsset).where(MediaAsset.id == asset_id))
    ).scalar_one_or_none()
    if asset is None:
        raise NotFound("Asset no encontrado")

    if usos := (await _usos(db, [asset_id])).get(asset_id, 0):
        raise Conflict(
            f"El asset se usa en {usos} bloque(s). Quitalo de ahi antes de borrarlo."
        )

    # Solo se da de baja de la libreria. El objeto en S3 lo limpia un trabajo
    # aparte (ver backlog): borrarlo aqui, dentro de la transaccion, dejaria un
    # fichero destruido si el commit falla despues.
    await db.delete(asset)
    await db.flush()
