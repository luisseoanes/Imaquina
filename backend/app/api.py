from fastapi import APIRouter

from app.modules.assessment.router import learn_router as assessment_learn_router
from app.modules.assessment.router import router as assessment_router
from app.modules.assignments.router import router as assignments_router
from app.modules.assistant.router import router as assistant_router
from app.modules.assistant.router import staff_router as assistant_staff_router
from app.modules.audit.router import router as audit_router
from app.modules.catalog.router import router as catalog_router
from app.modules.identity.router import admin_router as identity_admin_router
from app.modules.identity.router import courses_router as identity_courses_router
from app.modules.identity.router import router as identity_router
from app.modules.learning.router import router as learning_router
from app.modules.media.router import router as media_router
from app.modules.notifications.router import router as notifications_router
from app.modules.publishing.router import router as publishing_router
from app.modules.review.router import router as review_router
from app.modules.search.router import router as search_router
from app.modules.studio.router import router as studio_router

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
api_router.include_router(review_router)
api_router.include_router(media_router)
api_router.include_router(assessment_router)
api_router.include_router(assessment_learn_router)
# Dominios propios del panel del editor (lecciones, recursos, rutas,
# plantillas, etiquetas, colecciones) + agregados de tablero.
api_router.include_router(studio_router)
# Fase 1 · columna vertebral: asignaciones, notificaciones, auditoría, búsqueda.
api_router.include_router(assignments_router)
api_router.include_router(notifications_router)
api_router.include_router(audit_router)
api_router.include_router(search_router)
