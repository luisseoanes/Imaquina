"""Capa de servicio de media.

Existe para que otros modulos pregunten por un asset sin importar su modelo:
la regla de `arquitectura.md` 2 es que un modulo llama al SERVICIO de otro.
"""

import uuid
from collections.abc import Iterable
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import Conflict, NotFound, ValidationFailed
from app.modules.media.models import MediaAsset, MediaFolder

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
        "url": settings.media_url(asset.s3_key),
        "mime_type": asset.mime_type,
        "size_bytes": asset.size_bytes,
        "original_filename": asset.original_filename,
        "duration_seconds": asset.duration_seconds,
        "alt_text": asset.alt_text,
        "folder_id": str(asset.folder_id) if asset.folder_id else None,
        "has_captions": bool(asset.captions_vtt),
        "created_at": asset.created_at.isoformat(),
        # Cuantos bloques lo usan: el editor necesita saberlo ANTES de intentar
        # borrar, no despues de recibir un 409.
        "used_in": usos,
    }


async def urls_por_id(
    db: AsyncSession, asset_ids: Iterable[uuid.UUID]
) -> dict[str, dict[str, Any]]:
    """Los datos de reproduccion de varios assets, en UNA query.

    Existe para el camino de lectura del estudiante: el snapshot publicado
    guarda `media_asset_id`, no la URL —si la congelara, mover el bucket
    dejaria el contenido ya publicado apuntando a la nada—, asi que se resuelve
    al servir. `learning` la llama en vez de tocar `MediaAsset`: leer el modelo
    de otro modulo se permite, pero llamar a su servicio es lo preferido
    (arquitectura.md 2).

    Devuelve un mapa por id EN TEXTO, que es como viaja dentro del snapshot.
    Un id que ya no exista simplemente no sale: el bloque se queda sin URL en
    vez de romper el momento entero.
    """
    ids = list(dict.fromkeys(asset_ids))
    if not ids:
        return {}

    assets = (
        (await db.execute(select(MediaAsset).where(MediaAsset.id.in_(ids))))
        .scalars()
        .all()
    )
    return {
        str(a.id): {
            "url": settings.media_url(a.s3_key),
            "mime_type": a.mime_type,
            "duration_seconds": a.duration_seconds,
            "captions_vtt": a.captions_vtt,
        }
        for a in assets
    }


async def listar(
    db: AsyncSession,
    *,
    familia: str | None = None,
    buscar: str | None = None,
    folder_id: uuid.UUID | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """La libreria es reutilizable, asi que crece: paginada desde el dia 1."""
    filtros = []
    if familia:
        filtros.append(MediaAsset.mime_type.startswith(f"{familia}/"))
    if folder_id is not None:
        filtros.append(MediaAsset.folder_id == folder_id)
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


# --- Carpetas y edición del asset (fase 6) -----------------------------


async def listar_carpetas(db: AsyncSession) -> list[dict[str, Any]]:
    filas = (
        (await db.execute(select(MediaFolder).order_by(MediaFolder.name)))
        .scalars()
        .all()
    )
    return [
        {
            "id": str(f.id),
            "name": f.name,
            "parent_id": str(f.parent_id) if f.parent_id else None,
        }
        for f in filas
    ]


async def crear_carpeta(
    db: AsyncSession, *, name: str, parent_id: uuid.UUID | None
) -> dict[str, Any]:
    if parent_id is not None:
        existe = (
            await db.execute(select(MediaFolder.id).where(MediaFolder.id == parent_id))
        ).scalar_one_or_none()
        if existe is None:
            raise NotFound("Carpeta padre no encontrada")
    carpeta = MediaFolder(name=name, parent_id=parent_id)
    db.add(carpeta)
    await db.flush()
    return {"id": str(carpeta.id), "name": carpeta.name,
            "parent_id": str(parent_id) if parent_id else None}


async def borrar_carpeta(db: AsyncSession, folder_id: uuid.UUID) -> None:
    """Los assets dentro NO se borran: su `folder_id` queda a NULL (raíz)."""
    carpeta = (
        await db.execute(select(MediaFolder).where(MediaFolder.id == folder_id))
    ).scalar_one_or_none()
    if carpeta is None:
        raise NotFound("Carpeta no encontrada")
    await db.delete(carpeta)
    await db.flush()


async def _get_asset(db: AsyncSession, asset_id: uuid.UUID) -> MediaAsset:
    asset = (
        await db.execute(select(MediaAsset).where(MediaAsset.id == asset_id))
    ).scalar_one_or_none()
    if asset is None:
        raise NotFound("Asset no encontrado")
    return asset


async def actualizar_asset(
    db: AsyncSession, asset_id: uuid.UUID, **campos: Any
) -> dict[str, Any]:
    """Editar metadatos: alt, carpeta, subtítulos VTT. No toca el binario."""
    asset = await _get_asset(db, asset_id)
    if "folder_id" in campos and campos["folder_id"] is not None:
        existe = (
            await db.execute(
                select(MediaFolder.id).where(MediaFolder.id == campos["folder_id"])
            )
        ).scalar_one_or_none()
        if existe is None:
            raise NotFound("Carpeta no encontrada")
    for campo in ("alt_text", "captions_vtt", "folder_id"):
        if campo in campos:
            setattr(asset, campo, campos[campo])
    await db.flush()
    usos = await _usos(db, [asset_id])
    return _serializar(asset, usos.get(asset_id, 0))


async def sugerir_alt(db: AsyncSession, asset_id: uuid.UUID, lang: str) -> dict[str, Any]:
    """Pide al puerto de modelo un texto alternativo. Es una sugerencia: no se
    guarda, la devuelve para que el editor decida."""
    from app.modules.assistant.provider import get_assistant_provider

    asset = await _get_asset(db, asset_id)
    if not asset.mime_type.startswith("image/"):
        raise ValidationFailed("Sólo se sugiere alt-text para imágenes")
    provider = get_assistant_provider()
    sugerido = await provider.suggest_alt_text(
        settings.media_url(asset.s3_key), lang
    )
    return {"alt_text": sugerido}


async def borrar(db: AsyncSession, asset_id: uuid.UUID) -> str:
    """No se borra un asset en uso.

    `content_blocks.media_asset_id` tiene ON DELETE SET NULL: borrarlo dejaria
    los bloques que lo usan apuntando a nada, sin aviso y posiblemente en un
    proyecto ya publicado.

    Devuelve el `s3_key` para que el router encole su limpieza (S19): el
    objeto en el bucket no se borra aqui, dentro de la transaccion -- si el
    commit falla despues, quedaria un fichero destruido que la BD sigue
    referenciando.
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

    s3_key = asset.s3_key
    await db.delete(asset)
    await db.flush()
    return s3_key
