"""Subida directa a S3/R2 con URL prefirmada.

Un video de 200 MB NO puede pasar por FastAPI: el navegador sube directo
al bucket y aqui solo se registra la clave (arquitectura.md 7).
"""

import uuid
from datetime import UTC, datetime

import boto3
from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.deps import Author, Db
from app.core.errors import ValidationFailed
from app.modules.media.models import MediaAsset

router = APIRouter(prefix="/studio/media", tags=["studio"])

ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "audio/mpeg", "audio/mp4", "audio/wav",
    "video/mp4", "video/webm",
    "application/pdf",
}


def _s3():
    return boto3.client(
        "s3",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        region_name=settings.S3_REGION,
    )


class PresignIn(BaseModel):
    filename: str
    mime_type: str
    size_bytes: int = Field(gt=0)


class PresignOut(BaseModel):
    upload_url: str
    s3_key: str
    expires_in: int


@router.post("/presign", response_model=PresignOut)
async def presign(payload: PresignIn, author: Author) -> PresignOut:
    if payload.mime_type not in ALLOWED_MIME:
        raise ValidationFailed(f"Tipo no permitido: {payload.mime_type}")
    if payload.size_bytes > settings.MAX_UPLOAD_MB * 1024 * 1024:
        raise ValidationFailed(f"Excede el maximo de {settings.MAX_UPLOAD_MB} MB")

    stamp = datetime.now(UTC).strftime("%Y/%m")
    key = f"media/{stamp}/{uuid.uuid4()}/{payload.filename}"

    url = _s3().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": key,
            "ContentType": payload.mime_type,
        },
        ExpiresIn=settings.PRESIGNED_URL_TTL,
    )
    return PresignOut(
        upload_url=url, s3_key=key, expires_in=settings.PRESIGNED_URL_TTL
    )


class RegisterIn(BaseModel):
    s3_key: str
    mime_type: str
    size_bytes: int
    original_filename: str
    alt_text: str | None = None


@router.post("/register")
async def register(payload: RegisterIn, author: Author, db: Db):
    asset = MediaAsset(**payload.model_dump(), uploaded_by=author.user_id)
    db.add(asset)
    await db.flush()
    return {"id": str(asset.id), "s3_key": asset.s3_key}
