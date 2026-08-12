"""Importa todos los modelos para que Alembic los descubra.

Sin esto, autogenerate produce migraciones vacias.
"""

from app.db.base import Base  # noqa: F401
from app.modules.assessment.models import *  # noqa: F403
from app.modules.assistant.models import *  # noqa: F403
from app.modules.catalog.models import *  # noqa: F403
from app.modules.identity.models import *  # noqa: F403
from app.modules.learning.models import *  # noqa: F403
from app.modules.media.models import *  # noqa: F403
from app.modules.publishing.models import *  # noqa: F403
