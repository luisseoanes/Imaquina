"""Semillas de desarrollo local.

NO son datos de produccion ni una migracion: crean usuarios con **contrasena
conocida** para poder entrar a la app en local. Por eso el script se niega a
correr si `ENV` no es `local`, salvo `--force`.

Es idempotente: cada entidad se crea sólo si no existe, así que se puede
relanzar sin duplicar nada ni reventar por claves únicas.

Uso:  make seed
"""

import asyncio
import sys
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import Role
from app.core.security import hash_password

# Registra TODOS los mapeadores: `content_blocks.media_asset_id` apunta a
# `media_assets`, y sin el modelo cargado SQLAlchemy no resuelve la FK.
from app.db import all_models  # noqa: F401
from app.db.session import SessionLocal
from app.modules.catalog.models import (
    MOMENT_ORDER,
    BlockKind,
    BlockTranslation,
    ContentBlock,
    Moment,
    MomentTranslation,
    Project,
    ProjectStatus,
    ProjectTranslation,
)
from app.modules.identity.models import (
    Calendar,
    Course,
    Enrollment,
    Institution,
    License,
    User,
)
from app.modules.publishing import service as publishing
from app.modules.publishing.models import ProjectVersion

PASSWORD = "imaquina2027"
INSTITUCION = "Colegio de Pruebas Imaquina"
SLUG = "semaforo-inteligente"
CURSO = "5A - Robotica"

# Dominio `example.com`: es el reservado por IANA para documentacion y
# `EmailStr` lo acepta. Ojo con `.test` y `.local` — son special-use y
# email-validator los RECHAZA, con lo que el login seria imposible.
USUARIOS = [
    ("admin@imaquina.example.com", "Admin de Pruebas", Role.ADMIN, None),
    ("editor@imaquina.example.com", "Editora de Contenido", Role.EDITOR, None),
    ("docente@imaquina.example.com", "Docente de Pruebas", Role.TEACHER, None),
    ("estudiante@imaquina.example.com", "Estudiante de Pruebas", Role.STUDENT, "5"),
]

# Un bloque de texto por momento: `validate_for_publish` exige que ninguno
# este vacio, y asi el snapshot tiene algo que servir.
MOMENTOS = {
    "intro": ("Introduccion e inclusion", "Hoy vamos a construir un semaforo."),
    "inquiry": ("Indagacion", "Observen un cruce de su barrio: cuanto dura cada luz?"),
    "design": ("Diseno", "Dibujen el circuito antes de cablear nada."),
    "build": ("Construccion", "Conecten los LED a los pines 9, 10 y 11."),
    "communicate": ("Comunicacion", "Graben un video de 60 segundos explicandolo."),
    "assess": ("Evaluacion", "Responde el cuestionario del proyecto."),
}


async def _sembrar(db: AsyncSession) -> None:
    inst = (
        await db.execute(
            select(Institution).where(Institution.name == INSTITUCION)
        )
    ).scalar_one_or_none()
    if inst is None:
        inst = Institution(name=INSTITUCION, calendar=Calendar.A)
        db.add(inst)
        await db.flush()
        print(f"  + institucion {INSTITUCION}")

    lic = (
        await db.execute(
            select(License)
            .where(License.institution_id == inst.id)
            .order_by(License.valid_to.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if lic is None:
        # Vigencia amplia a proposito: una licencia vencida deja el login
        # devolviendo 403 y parece un bug del backend.
        db.add(
            License(
                institution_id=inst.id,
                calendar=Calendar.A,
                valid_from=date(date.today().year, 1, 1),
                valid_to=date(date.today().year + 2, 12, 31),
                seats=50,
            )
        )
        print("  + licencia vigente")

    creados: dict[str, User] = {}
    for email, nombre, rol, grado in USUARIOS:
        user = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if user is None:
            user = User(
                email=email,
                full_name=nombre,
                password_hash=hash_password(PASSWORD),
                role=rol,
                grade=grado,
                institution_id=inst.id,
            )
            db.add(user)
            await db.flush()
            print(f"  + usuario {email} ({rol})")
        creados[rol] = user

    curso = (
        await db.execute(
            select(Course).where(
                Course.institution_id == inst.id, Course.name == CURSO
            )
        )
    ).scalar_one_or_none()
    if curso is None:
        curso = Course(
            institution_id=inst.id,
            name=CURSO,
            grade="5",
            teacher_id=creados[Role.TEACHER].id,
        )
        db.add(curso)
        await db.flush()
        print(f"  + curso {CURSO}")

    matricula = (
        await db.execute(
            select(Enrollment).where(
                Enrollment.course_id == curso.id,
                Enrollment.user_id == creados[Role.STUDENT].id,
            )
        )
    ).scalar_one_or_none()
    if matricula is None:
        db.add(Enrollment(course_id=curso.id, user_id=creados[Role.STUDENT].id))
        print("  + matricula del estudiante")

    await _sembrar_proyecto(db, autor=creados[Role.EDITOR])


async def _sembrar_proyecto(db: AsyncSession, *, autor: User) -> None:
    """Un proyecto completo y publicado.

    Sin esto se puede entrar pero la app esta vacia: no hay nada que renderizar
    en el momento ni contra lo que probar el chat.
    """
    proyecto = (
        await db.execute(select(Project).where(Project.slug == SLUG))
    ).scalar_one_or_none()
    if proyecto is None:
        proyecto = Project(
            slug=SLUG,
            grade="5",
            kit="Kit basico de robotica",
            order=1,
            # Flujo editorial (fase 4): el gate de publicacion exige aprobado.
            status=ProjectStatus.APPROVED,
        )
        db.add(proyecto)
        await db.flush()
        db.add(
            ProjectTranslation(
                project_id=proyecto.id,
                lang="es",
                title="Semaforo inteligente",
                summary="Construye un semaforo que reacciona al trafico.",
            )
        )

        for orden, tipo in enumerate(MOMENT_ORDER):
            titulo, cuerpo = MOMENTOS[tipo]
            momento = Moment(project_id=proyecto.id, type=tipo, order=orden)
            db.add(momento)
            await db.flush()
            db.add(
                MomentTranslation(
                    moment_id=momento.id,
                    lang="es",
                    title=titulo,
                    # R4: sólo la ve el docente. Sirve para comprobar que
                    # `serialize_moment_for` la filtra de verdad.
                    teacher_note=f"[GUIA DOCENTE] Puntos clave de '{titulo}'.",
                    # R8: el chat abre con esta pregunta.
                    chatbot_opening_prompt=(
                        f"Que sabes ya sobre {titulo.lower()}?"
                        if tipo != "assess"
                        else None
                    ),
                )
            )
            bloque = ContentBlock(moment_id=momento.id, kind=BlockKind.TEXT, order=0)
            db.add(bloque)
            await db.flush()
            db.add(BlockTranslation(block_id=bloque.id, lang="es", body=cuerpo))

        await db.flush()
        print(f"  + proyecto '{SLUG}' con sus 6 momentos")

    ya_publicado = (
        await db.execute(
            select(ProjectVersion).where(
                ProjectVersion.project_id == proyecto.id,
                ProjectVersion.is_current.is_(True),
            )
        )
    ).scalar_one_or_none()
    if ya_publicado is None:
        # Se publica con el servicio real, no a mano: asi el snapshot lo
        # construye el mismo codigo que en produccion y pasa su validacion.
        version = await publishing.publish(db, proyecto.id, published_by=autor.id)
        print(f"  + publicado como version {version.version}")


async def main() -> None:
    forzar = "--force" in sys.argv
    if settings.ENV != "local" and not forzar:
        sys.exit(
            f"Rechazado: ENV={settings.ENV}. Estas semillas crean usuarios con "
            "contrasena conocida. Si de verdad quieres sembrar aqui, --force."
        )

    print(f"Sembrando en {settings.ENV}...")
    async with SessionLocal() as db:
        await _sembrar(db)
        await db.commit()

    print("\nListo. Todos los usuarios comparten la contrasena:", PASSWORD)
    for email, _, rol, _ in USUARIOS:
        print(f"  {rol:8} {email}")


if __name__ == "__main__":
    asyncio.run(main())
