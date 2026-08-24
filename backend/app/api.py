from fastapi import APIRouter

from app.modules.assistant.router import router as assistant_router
from app.modules.assistant.router import staff_router as assistant_staff_router
from app.modules.catalog.router import router as catalog_router
from app.modules.identity.router import admin_router as identity_admin_router
from app.modules.identity.router import courses_router as identity_courses_router
from app.modules.identity.router import router as identity_router
from app.modules.learning.router import router as learning_router
from app.modules.media.router import router as media_router
from app.modules.publishing.router import router as publishing_router

api_router = APIRouter()
api_router.include_router(identity_router)
api_router.include_router(identity_admin_router)
api_router.include_router(identity_courses_router)
api_router.include_router(learning_router)
api_router.include_router(assistant_router)
api_router.include_router(assistant_staff_router)
# Content Studio: solo roles editor/admin (guard en cada router).
api_router.include_router(catalog_router)
api_router.include_router(publishing_router)
api_router.include_router(media_router)
