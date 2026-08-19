from fastapi import APIRouter

from app.modules.assistant.router import router as assistant_router
from app.modules.catalog.router import router as catalog_router
from app.modules.identity.router import router as identity_router
from app.modules.learning.router import router as learning_router
from app.modules.media.router import router as media_router
from app.modules.publishing.router import router as publishing_router

api_router = APIRouter()
api_router.include_router(identity_router)
api_router.include_router(learning_router)
api_router.include_router(assistant_router)
# Content Studio: solo roles editor/admin (guard en cada router).
api_router.include_router(catalog_router)
api_router.include_router(publishing_router)
api_router.include_router(media_router)
