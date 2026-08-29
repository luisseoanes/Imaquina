"""Datos de demostración para que el Content Studio no se vea vacío.

NO son datos de producción. Amplían lo que crea `seeds.py` (institución,
licencia, 4 roles, 1 proyecto) con un catálogo grande y realista: proyectos por
grado, lecciones, recursos, medios, rutas, plantillas, etiquetas, colecciones,
evaluaciones con preguntas, y actividad de estudiantes (progreso e intentos).

Idempotente: cada entidad se crea sólo si su slug/email no existe. Relanzable.
Se niega a correr si `ENV != local` salvo `--force`.

Uso:  cd backend && uv run python -m app.db.seed_demo
      (o dentro del contenedor:  docker compose exec api python -m app.db.seed_demo)
"""

import asyncio
import random
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db import all_models  # noqa: F401
from app.db.session import SessionLocal
from app.modules.assessment import service as assessment_service
from app.modules.assessment.models import Answer, Attempt, AttemptStatus, Choice, Question
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
from app.modules.identity.models import Course, Enrollment, Institution, User
from app.modules.learning.models import Progress, ProgressState
from app.modules.media.models import MediaAsset
from app.modules.publishing import service as publishing
from app.modules.publishing.models import ProjectVersion
from app.modules.studio.models import (
    Collection,
    CollectionItem,
    CollectionTranslation,
    ContentStatus,
    ContentTag,
    ContentTemplate,
    LearningPath,
    LearningPathItem,
    LearningPathTranslation,
    Lesson,
    LessonTranslation,
    Resource,
    ResourceTranslation,
    Tag,
)

RNG = random.Random(42)
PASSWORD = "imaquina2027"
INSTITUCION = "Colegio de Pruebas Imaquina"

AREAS = [
    "Electrónica",
    "Programación",
    "Mecánica",
    "Robótica",
    "Sensores",
    "Diseño 3D",
    "Pensamiento computacional",
]

MOMENTO_TITULOS = {
    "intro": "Introducción e inclusión",
    "inquiry": "Indagación",
    "design": "Diseño",
    "build": "Construcción",
    "communicate": "Comunicación",
    "assess": "Evaluación",
}

# (slug, grado, kit, titulo_es, resumen_es, publicado, titulo_en|None)
PROYECTOS = [
    (
        "mi-primer-robot",
        "Transición",
        "Kit exploradores",
        "Mi primer robot",
        "Un robot de cartón que enciende una luz al aplaudir.",
        True,
        "My first robot",
    ),
    (
        "robot-que-baila",
        "1",
        "Kit exploradores",
        "El robot que baila",
        "Programamos secuencias de movimiento con bloques de colores.",
        True,
        None,
    ),
    (
        "mano-robotica-de-carton",
        "2",
        "Kit básico de robótica",
        "Mano robótica de cartón",
        "Construimos una mano que agarra objetos con hilos y pitillos.",
        False,
        None,
    ),
    (
        "carro-solar",
        "3",
        "Kit energías",
        "Carro solar",
        "Un carrito que se mueve con la energía del sol.",
        True,
        "Solar car",
    ),
    (
        "alarma-para-mi-cuarto",
        "4",
        "Kit básico de robótica",
        "Alarma para mi cuarto",
        "Detecta cuando alguien abre la puerta y suena.",
        True,
        None,
    ),
    (
        "invernadero-automatico",
        "6",
        "Kit agrotech",
        "Invernadero automático",
        "Riega las plantas cuando la tierra está seca.",
        True,
        "Automatic greenhouse",
    ),
    (
        "brazo-hidraulico",
        "7",
        "Kit mecánica",
        "Brazo hidráulico",
        "Un brazo que levanta peso usando jeringas y agua.",
        False,
        None,
    ),
    (
        "dron-educativo",
        "9",
        "Kit aéreo",
        "Dron educativo",
        "Principios de vuelo y estabilización con giroscopio.",
        True,
        None,
    ),
    (
        "estacion-meteorologica-iot",
        "11",
        "Kit IoT",
        "Estación meteorológica IoT",
        "Mide temperatura y humedad y publica los datos en la nube.",
        False,
        None,
    ),
]

BLOQUES_POR_MOMENTO = {
    "intro": [
        "En este momento nos conocemos y activamos lo que ya sabemos del tema.",
        "Observa el video de ejemplo y anota tres cosas que te llamen la atención.",
    ],
    "inquiry": [
        "Formulen preguntas: ¿qué necesita el robot para funcionar?",
        "Investiguen en parejas y comparen sus respuestas con otro equipo.",
    ],
    "design": [
        "Dibujen el diseño antes de construir. Marquen materiales y medidas.",
        "Revisen el diseño con el docente y ajústenlo si hace falta.",
    ],
    "build": [
        "Sigan el diseño paso a paso. Prueben cada parte antes de continuar.",
        "Si algo no funciona, vuelvan al diseño: casi siempre está ahí la pista.",
    ],
    "communicate": [
        "Preparen una explicación de 2 minutos para presentar el proyecto.",
        "Graben un video corto mostrando el robot en funcionamiento.",
    ],
    "assess": [
        "Responde el cuestionario para cerrar el proyecto.",
    ],
}

LECCIONES = [
    ("que-es-un-circuito", "Electrónica", "¿Qué es un circuito?", 15, True),
    (
        "resistencias-y-colores",
        "Electrónica",
        "Resistencias y su código de colores",
        20,
        True,
    ),
    ("protoboard-desde-cero", "Electrónica", "La protoboard desde cero", 25, True),
    ("primeros-pasos-en-scratch", "Programación", "Primeros pasos en Scratch", 30, True),
    (
        "bucles-y-condicionales",
        "Programación",
        "Bucles y condicionales con bloques",
        30,
        True,
    ),
    ("variables-para-ninos", "Programación", "Variables explicadas con cajas", 20, False),
    ("motores-dc-vs-servo", "Mecánica", "Motores DC vs. servomotores", 20, True),
    ("engranajes-y-poleas", "Mecánica", "Engranajes y poleas", 25, True),
    ("el-sensor-ultrasonido", "Sensores", "El sensor de ultrasonido HC-SR04", 20, True),
    ("sensor-de-luz-ldr", "Sensores", "Sensor de luz (LDR)", 15, True),
    ("sensor-de-humedad-de-suelo", "Sensores", "Sensor de humedad de suelo", 15, False),
    ("introduccion-al-diseno-3d", "Diseño 3D", "Introducción al diseño 3D", 35, True),
    (
        "de-la-idea-al-prototipo",
        "Pensamiento computacional",
        "De la idea al prototipo",
        25,
        True,
    ),
    (
        "depurar-sin-frustrarse",
        "Pensamiento computacional",
        "Depurar sin frustrarse",
        20,
        True,
    ),
    (
        "trabajo-en-equipo-en-robotica",
        "Robótica",
        "Trabajo en equipo en robótica",
        15,
        True,
    ),
    ("seguridad-en-el-aula-taller", "Robótica", "Seguridad en el aula-taller", 15, True),
]

RECURSOS = [
    (
        "datasheet-hc-sr04",
        "Sensores",
        "link",
        "Datasheet HC-SR04",
        "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf",
    ),
    (
        "guia-arduino-uno",
        "Electrónica",
        "link",
        "Guía de referencia Arduino UNO",
        "https://docs.arduino.cc/hardware/uno-rev3",
    ),
    (
        "tinkercad-circuits",
        "Electrónica",
        "link",
        "Simulador Tinkercad Circuits",
        "https://www.tinkercad.com/circuits",
    ),
    (
        "scratch-editor",
        "Programación",
        "link",
        "Editor de Scratch",
        "https://scratch.mit.edu/projects/editor/",
    ),
    (
        "video-como-soldar",
        "Electrónica",
        "link",
        "Video: cómo soldar sin quemarse",
        "https://www.youtube.com/watch?v=example-soldar",
    ),
    ("plantilla-bitacora", "Robótica", "doc", "Plantilla de bitácora de proyecto", None),
    (
        "rubrica-feria-ciencias",
        "Robótica",
        "doc",
        "Rúbrica para la feria de ciencias",
        None,
    ),
    (
        "checklist-antes-de-publicar",
        "Robótica",
        "doc",
        "Checklist de calidad de contenido",
        None,
    ),
    (
        "libro-robotica-educativa",
        "Robótica",
        "file",
        "Manual de robótica educativa (PDF)",
        None,
    ),
    ("set-iconos-componentes", "Diseño 3D", "file", "Set de iconos de componentes", None),
    (
        "modelos-3d-piezas",
        "Diseño 3D",
        "link",
        "Repositorio de piezas 3D imprimibles",
        "https://www.thingiverse.com/",
    ),
    ("hoja-pinout-esp32", "Electrónica", "file", "Hoja de pinout ESP32", None),
    (
        "glosario-robotica",
        "Pensamiento computacional",
        "doc",
        "Glosario de robótica ES/EN",
        None,
    ),
    (
        "canciones-para-secuencias",
        "Programación",
        "link",
        "Canciones para practicar secuencias",
        "https://www.youtube.com/watch?v=example-secuencias",
    ),
    (
        "guia-inclusion-aula",
        "Robótica",
        "doc",
        "Guía de inclusión en el aula de robótica",
        None,
    ),
    ("presupuesto-kits", "Mecánica", "file", "Comparativa de kits y presupuesto", None),
]

MEDIOS = [
    (
        "media/demo/portada-semaforo.jpg",
        "image/jpeg",
        240_000,
        "portada-semaforo.jpg",
        "Semáforo de LED construido por estudiantes de 5º",
        None,
    ),
    (
        "media/demo/protoboard.png",
        "image/png",
        180_000,
        "protoboard.png",
        "Protoboard con un circuito de un LED y una resistencia",
        None,
    ),
    (
        "media/demo/mano-robotica.jpg",
        "image/jpeg",
        310_000,
        "mano-robotica.jpg",
        "Mano robótica de cartón agarrando un marcador",
        None,
    ),
    (
        "media/demo/carro-solar.jpg",
        "image/jpeg",
        275_000,
        "carro-solar.jpg",
        "Carro solar de madera con panel fotovoltaico",
        None,
    ),
    (
        "media/demo/diagrama-circuito.png",
        "image/png",
        95_000,
        "diagrama-circuito.png",
        "Diagrama esquemático de un circuito con tres LED",
        None,
    ),
    (
        "media/demo/explicacion-servo.mp4",
        "video/mp4",
        8_400_000,
        "explicacion-servo.mp4",
        "Video explicando cómo funciona un servomotor",
        92,
    ),
    (
        "media/demo/robot-baila.mp4",
        "video/mp4",
        12_100_000,
        "robot-baila.mp4",
        "Robot ejecutando una secuencia de baile programada",
        45,
    ),
    (
        "media/demo/sonido-alarma.mp3",
        "audio/mpeg",
        320_000,
        "sonido-alarma.mp3",
        "Tono de alarma de 3 segundos",
        3,
    ),
    (
        "media/demo/podcast-inclusion.mp3",
        "audio/mpeg",
        4_800_000,
        "podcast-inclusion.mp3",
        "Episodio sobre inclusión en robótica",
        610,
    ),
    (
        "media/demo/manual-kit-basico.pdf",
        "application/pdf",
        1_600_000,
        "manual-kit-basico.pdf",
        "Manual del kit básico de robótica",
        None,
    ),
]

TAGS = [
    ("arduino", "Arduino", "info"),
    ("scratch", "Scratch", "info"),
    ("sensores", "Sensores", "brand"),
    ("motores", "Motores", "brand"),
    ("impresion-3d", "Impresión 3D", "note"),
    ("energia", "Energía", "success"),
    ("iot", "IoT", "info"),
    ("inclusion", "Inclusión", "success"),
    ("trabajo-en-equipo", "Trabajo en equipo", "note"),
    ("principiante", "Principiante", "success"),
    ("avanzado", "Avanzado", "danger"),
    ("feria-de-ciencias", "Feria de ciencias", "warning"),
]

NOMBRES = [
    "Valentina Ríos",
    "Samuel Ortega",
    "Isabella Mora",
    "Mateo Guzmán",
    "Sofía Cárdenas",
    "Sebastián Rojas",
    "Emma Villamil",
    "Tomás Beltrán",
    "Luciana Peña",
    "Emiliano Cruz",
    "Antonia Salazar",
    "Martín Quintero",
    "Camila Duarte",
    "Nicolás Pardo",
    "Manuela Ospina",
    "Alejandro Nieto",
    "Gabriela Lozano",
    "Daniel Acosta",
    "Salomé Restrepo",
    "Juan José Mejía",
    "Mariana Gil",
    "Andrés Camacho",
    "Paulina Rincón",
    "Felipe Zapata",
]

PREGUNTAS_MCQ = [
    (
        "¿Qué componente limita la corriente para no quemar un LED?",
        [
            ("La resistencia", True),
            ("El cable", False),
            ("La batería", False),
            ("El interruptor", False),
        ],
    ),
    (
        "¿Qué hace un bucle en programación?",
        [
            ("Repite instrucciones", True),
            ("Borra el programa", False),
            ("Apaga el robot", False),
        ],
    ),
    (
        "¿Para qué sirve un sensor?",
        [
            ("Para medir algo del entorno", True),
            ("Para dar energía", False),
            ("Para decorar", False),
        ],
    ),
]
PREGUNTAS_VF = [
    ("Un servomotor puede girar a una posición exacta.", True),
    ("La protoboard necesita soldadura para funcionar.", False),
]
PREGUNTAS_NUM = [
    ("¿A cuántos grados puede girar normalmente un servo estándar? (número)", 180.0),
]
PREGUNTAS_OPEN = [
    "Explica con tus palabras qué problema resuelve tu proyecto.",
    "¿Qué cambiarías de tu diseño si lo volvieras a hacer?",
]


async def _existe(db: AsyncSession, modelo, **filtro) -> bool:
    stmt = select(func.count()).select_from(modelo)
    for k, v in filtro.items():
        stmt = stmt.where(getattr(modelo, k) == v)
    return bool((await db.execute(stmt)).scalar_one())


async def _get_inst(db: AsyncSession) -> Institution:
    inst = (
        await db.execute(select(Institution).where(Institution.name == INSTITUCION))
    ).scalar_one_or_none()
    if inst is None:
        sys.exit("Falta la base: corre primero  uv run python -m app.db.seeds")
    return inst


async def _proyectos(db: AsyncSession, inst: Institution) -> None:
    editor = (await db.execute(select(User).where(User.role == "editor"))).scalar_one()

    for orden, (slug, grado, kit, titulo, resumen, publicar, titulo_en) in enumerate(
        PROYECTOS, start=2
    ):
        if await _existe(db, Project, slug=slug):
            continue
        p = Project(slug=slug, grade=grado, kit=kit, order=orden)
        db.add(p)
        await db.flush()
        db.add(
            ProjectTranslation(project_id=p.id, lang="es", title=titulo, summary=resumen)
        )
        if titulo_en:
            db.add(
                ProjectTranslation(
                    project_id=p.id, lang="en", title=titulo_en, summary=resumen
                )
            )

        for i, tipo in enumerate(MOMENT_ORDER):
            mom = Moment(project_id=p.id, type=tipo, order=i)
            db.add(mom)
            await db.flush()
            db.add(
                MomentTranslation(
                    moment_id=mom.id,
                    lang="es",
                    title=MOMENTO_TITULOS[tipo],
                    teacher_note=f"[GUÍA DOCENTE] Objetivo de '{MOMENTO_TITULOS[tipo]}' "
                    f"en {titulo}. Tiempo sugerido: 45 min.",
                    chatbot_opening_prompt=(
                        None
                        if tipo == "assess"
                        else f"¿Qué sabes ya sobre {MOMENTO_TITULOS[tipo].lower()}?"
                    ),
                )
            )
            # traducción inglesa parcial: solo intro/inquiry, para que el
            # indicador de "falta traducir" tenga algo que mostrar.
            if titulo_en and tipo in ("intro", "inquiry"):
                db.add(
                    MomentTranslation(
                        moment_id=mom.id,
                        lang="en",
                        title=MOMENTO_TITULOS[tipo],
                    )
                )
            for b, cuerpo in enumerate(BLOQUES_POR_MOMENTO[tipo]):
                blk = ContentBlock(moment_id=mom.id, kind=BlockKind.TEXT, order=b)
                db.add(blk)
                await db.flush()
                db.add(
                    BlockTranslation(block_id=blk.id, lang="es", body=f"<p>{cuerpo}</p>")
                )
        await db.flush()
        print(f"  + proyecto {slug}")

        if publicar and not await _existe(db, ProjectVersion, project_id=p.id):
            try:
                # Flujo editorial (fase 4): se publica lo aprobado.
                p.status = ProjectStatus.APPROVED
                await db.flush()
                await publishing.publish(db, p.id, published_by=editor.id)
                print(f"    publicado {slug}")
            except Exception as e:  # noqa: BLE001
                print(f"    (no se pudo publicar {slug}: {e})")


async def _lecciones(db: AsyncSession) -> None:
    for slug, area, titulo, minutos, publicado in LECCIONES:
        if await _existe(db, Lesson, slug=slug):
            continue
        x = Lesson(
            slug=slug,
            area=area,
            estimated_minutes=minutos,
            status=ContentStatus.PUBLISHED if publicado else ContentStatus.DRAFT,
        )
        db.add(x)
        await db.flush()
        db.add(
            LessonTranslation(
                lesson_id=x.id,
                lang="es",
                title=titulo,
                summary=f"Lección de {area.lower()}: {titulo.lower()}.",
                body=(
                    f"<h3>{titulo}</h3><p>Contenido introductorio sobre "
                    f"{titulo.lower()}.</p><ul><li>Idea clave 1</li>"
                    f"<li>Idea clave 2</li><li>Idea clave 3</li></ul>"
                    f"<p>Practica con el ejercicio propuesto al final.</p>"
                ),
            )
        )
    print(f"  + {len(LECCIONES)} lecciones")


async def _recursos(db: AsyncSession) -> None:
    for slug, area, kind, titulo, url in RECURSOS:
        if await _existe(db, Resource, slug=slug):
            continue
        x = Resource(
            slug=slug,
            area=area,
            kind=kind,
            url=url,
            status=ContentStatus.PUBLISHED if RNG.random() > 0.3 else ContentStatus.DRAFT,
        )
        db.add(x)
        await db.flush()
        db.add(
            ResourceTranslation(
                resource_id=x.id,
                lang="es",
                title=titulo,
                description=f"Recurso de apoyo para {area.lower()}.",
            )
        )
    print(f"  + {len(RECURSOS)} recursos")


async def _medios(db: AsyncSession) -> None:
    editor = (await db.execute(select(User).where(User.role == "editor"))).scalar_one()
    for s3_key, mime, size, filename, alt, dur in MEDIOS:
        if await _existe(db, MediaAsset, s3_key=s3_key):
            continue
        db.add(
            MediaAsset(
                s3_key=s3_key,
                mime_type=mime,
                size_bytes=size,
                original_filename=filename,
                alt_text=alt,
                duration_seconds=dur,
                uploaded_by=editor.id,
            )
        )
    print(f"  + {len(MEDIOS)} elementos de media")


async def _tags(db: AsyncSession) -> dict[str, Tag]:
    salida: dict[str, Tag] = {}
    for slug, nombre, color in TAGS:
        x = (await db.execute(select(Tag).where(Tag.slug == slug))).scalar_one_or_none()
        if x is None:
            x = Tag(slug=slug, name=nombre, color=color)
            db.add(x)
            await db.flush()
        salida[slug] = x
    print(f"  + {len(TAGS)} etiquetas")
    return salida


async def _asignar_tags(db: AsyncSession, tags: dict[str, Tag]) -> None:
    if await _existe(db, ContentTag):
        return
    lista = list(tags.values())
    ya = {
        (r[0], r[1])
        for r in (
            await db.execute(select(ContentTag.target_type, ContentTag.target_id))
        ).all()
    }
    n = 0
    for modelo, tipo in (
        (Lesson, "lesson"),
        (Project, "project"),
        (Resource, "resource"),
    ):
        filas = (await db.execute(select(modelo.id))).scalars().all()
        for fid in filas:
            if (tipo, fid) in ya:
                continue
            for tag in RNG.sample(lista, RNG.randint(1, 3)):
                db.add(ContentTag(tag_id=tag.id, target_type=tipo, target_id=fid))
                n += 1
    print(f"  + {n} etiquetas asignadas al contenido")


async def _plantillas(db: AsyncSession) -> None:
    editor = (await db.execute(select(User).where(User.role == "editor"))).scalar_one()
    plantillas = [
        (
            "proyecto-estandar-6-momentos",
            "project",
            "Proyecto estándar (6 momentos)",
            "El molde de referencia: los 6 momentos con un bloque de texto guía.",
            {
                "title": "Proyecto nuevo",
                "summary": "",
                "moments": {
                    t: {
                        "title": MOMENTO_TITULOS[t],
                        "blocks": [
                            {
                                "kind": "text",
                                "body": f"<p>Guía de {MOMENTO_TITULOS[t].lower()}.</p>",
                            }
                        ],
                    }
                    for t in MOMENTO_TITULOS
                },
            },
        ),
        (
            "proyecto-expres",
            "project",
            "Proyecto exprés (1 sesión)",
            "Versión corta para una sola clase.",
            {
                "title": "Proyecto exprés",
                "moments": {
                    "intro": {
                        "title": "Arranque",
                        "blocks": [{"kind": "text", "body": "<p>Reto del día.</p>"}],
                    },
                    "build": {
                        "title": "Manos a la obra",
                        "blocks": [{"kind": "text", "body": "<p>Construye.</p>"}],
                    },
                    "assess": {
                        "title": "Cierre",
                        "blocks": [
                            {"kind": "text", "body": "<p>Comparte resultados.</p>"}
                        ],
                    },
                },
            },
        ),
        (
            "leccion-teorica",
            "lesson",
            "Lección teórica",
            "Estructura para una lección de concepto.",
            {"sections": ["Idea", "Ejemplo", "Práctica"]},
        ),
        (
            "leccion-practica",
            "lesson",
            "Lección práctica",
            "Estructura para una lección de taller.",
            {"sections": ["Materiales", "Pasos", "Retos"]},
        ),
    ]
    for slug, kind, nombre, desc, payload in plantillas:
        if await _existe(db, ContentTemplate, slug=slug):
            continue
        db.add(
            ContentTemplate(
                slug=slug,
                kind=kind,
                name=nombre,
                description=desc,
                payload=payload,
                created_by=editor.id,
            )
        )
    print(f"  + {len(plantillas)} plantillas")


async def _rutas(db: AsyncSession) -> None:
    proyectos = {p.slug: p.id for p in (await db.execute(select(Project))).scalars()}
    lecciones = {x.slug: x.id for x in (await db.execute(select(Lesson))).scalars()}


    definiciones = [
        (
            "robotica-desde-cero",
            "Robótica desde cero (Transición–3°)",
            "3",
            "Ruta introductoria para los primeros grados.",
            [
                ("lesson", "seguridad-en-el-aula-taller"),
                ("lesson", "que-es-un-circuito"),
                ("project", "mi-primer-robot"),
                ("project", "robot-que-baila"),
                ("project", "carro-solar"),
            ],
        ),
        (
            "programacion-con-scratch",
            "Programación con Scratch",
            None,
            "De los primeros bloques a un proyecto completo.",
            [
                ("lesson", "primeros-pasos-en-scratch"),
                ("lesson", "bucles-y-condicionales"),
                ("lesson", "variables-para-ninos"),
                ("project", "robot-que-baila"),
            ],
        ),
        (
            "sensores-y-actuadores",
            "Sensores y actuadores",
            "6",
            "Cómo el robot percibe y actúa.",
            [
                ("lesson", "el-sensor-ultrasonido"),
                ("lesson", "sensor-de-luz-ldr"),
                ("lesson", "motores-dc-vs-servo"),
                ("project", "alarma-para-mi-cuarto"),
                ("project", "invernadero-automatico"),
            ],
        ),
        (
            "proyectos-iot",
            "Proyectos IoT",
            "9",
            "Conectar los proyectos a internet.",
            [
                ("lesson", "el-sensor-ultrasonido"),
                ("project", "invernadero-automatico"),
                ("project", "estacion-meteorologica-iot"),
            ],
        ),
        (
            "preparacion-feria-de-ciencias",
            "Preparación para la feria de ciencias",
            None,
            "Todo lo necesario para presentar un proyecto.",
            [
                ("lesson", "de-la-idea-al-prototipo"),
                ("lesson", "trabajo-en-equipo-en-robotica"),
                ("lesson", "depurar-sin-frustrarse"),
            ],
        ),
    ]
    n = 0
    for slug, titulo, grado, desc, items in definiciones:
        if await _existe(db, LearningPath, slug=slug):
            continue
        r = LearningPath(
            slug=slug,
            grade=grado,
            status=ContentStatus.PUBLISHED if grado != "9" else ContentStatus.DRAFT,
        )
        db.add(r)
        await db.flush()
        n += 1
        db.add(
            LearningPathTranslation(
                learning_path_id=r.id, lang="es", title=titulo, description=desc
            )
        )
        for i, (rt, ref_slug) in enumerate(items):
            tabla = proyectos if rt == "project" else lecciones
            if ref_slug in tabla:
                db.add(
                    LearningPathItem(
                        learning_path_id=r.id,
                        order=i,
                        ref_type=rt,
                        ref_id=tabla[ref_slug],
                    )
                )
    print(f"  + {n} rutas de aprendizaje")


async def _colecciones(db: AsyncSession) -> None:
    proyectos = {p.slug: p.id for p in (await db.execute(select(Project))).scalars()}
    lecciones = {x.slug: x.id for x in (await db.execute(select(Lesson))).scalars()}
    recursos = {x.slug: x.id for x in (await db.execute(select(Resource))).scalars()}

    definiciones = [
        (
            "destacados",
            "Destacados",
            "Lo mejor del catálogo para empezar.",
            [
                ("project", "mi-primer-robot"),
                ("project", "invernadero-automatico"),
                ("lesson", "primeros-pasos-en-scratch"),
            ],
        ),
        (
            "para-la-feria",
            "Para la feria",
            "Proyectos que lucen en una feria de ciencias.",
            [
                ("project", "carro-solar"),
                ("project", "dron-educativo"),
                ("resource", "rubrica-feria-ciencias"),
            ],
        ),
        (
            "nivel-inicial",
            "Nivel inicial",
            "Contenido para quien empieza.",
            [
                ("lesson", "que-es-un-circuito"),
                ("lesson", "seguridad-en-el-aula-taller"),
                ("project", "robot-que-baila"),
            ],
        ),
        (
            "kit-avanzado",
            "Requieren kit avanzado",
            "Necesitan componentes extra.",
            [
                ("project", "estacion-meteorologica-iot"),
                ("project", "dron-educativo"),
                ("resource", "hoja-pinout-esp32"),
            ],
        ),
        (
            "bilingue-listo",
            "Bilingüe listo",
            "Contenido con traducción al inglés.",
            [
                ("project", "mi-primer-robot"),
                ("project", "carro-solar"),
                ("project", "invernadero-automatico"),
            ],
        ),
    ]
    n = 0
    for slug, titulo, desc, items in definiciones:
        if await _existe(db, Collection, slug=slug):
            continue
        c = Collection(slug=slug)
        db.add(c)
        await db.flush()
        n += 1
        db.add(
            CollectionTranslation(
                collection_id=c.id, lang="es", title=titulo, description=desc
            )
        )
        tablas = {"project": proyectos, "lesson": lecciones, "resource": recursos}
        for i, (tt, ref_slug) in enumerate(items):
            if ref_slug in tablas[tt]:
                db.add(
                    CollectionItem(
                        collection_id=c.id,
                        order=i,
                        target_type=tt,
                        target_id=tablas[tt][ref_slug],
                    )
                )
    print(f"  + {n} colecciones")


async def _estudiantes(db: AsyncSession, inst: Institution) -> list[User]:
    docente = (await db.execute(select(User).where(User.role == "teacher"))).scalar_one()
    cursos: dict[str, Course] = {}
    for grado in ("Transición", "3", "5", "9"):
        c = (
            await db.execute(
                select(Course).where(
                    Course.institution_id == inst.id, Course.grade == grado
                )
            )
        ).scalar_one_or_none()
        if c is None:
            c = Course(
                institution_id=inst.id,
                name=f"{grado} · Robótica",
                grade=grado,
                teacher_id=docente.id,
            )
            db.add(c)
            await db.flush()
        cursos[grado] = c

    estudiantes: list[User] = []
    for i, nombre in enumerate(NOMBRES):
        email = f"est{i + 1:02d}@imaquina.example.com"
        u = (
            await db.execute(select(User).where(User.email == email))
        ).scalar_one_or_none()
        if u is None:
            grado = RNG.choice(list(cursos))
            u = User(
                email=email,
                full_name=nombre,
                password_hash=hash_password(PASSWORD),
                role="student",
                grade=grado,
                institution_id=inst.id,
            )
            db.add(u)
            await db.flush()
            db.add(Enrollment(course_id=cursos[grado].id, user_id=u.id))
        estudiantes.append(u)
    print(f"  + {len(NOMBRES)} estudiantes en 4 cursos")
    return estudiantes


async def _evaluaciones(db: AsyncSession) -> list:
    """Rellena la evaluación de los proyectos publicados con preguntas."""
    momentos = (
        (
            await db.execute(
                select(Moment)
                .join(Project, Project.id == Moment.project_id)
                .where(Moment.type == "assess", Project.status == "published")
            )
        )
        .scalars()
        .all()
    )
    assessment_ids = []
    for mom in momentos:
        a = await assessment_service.ensure_assessment(db, mom.id)
        aid = uuid.UUID(a["id"])
        assessment_ids.append(a["id"])
        if a["questions"]:
            continue
        for prompt, opciones in PREGUNTAS_MCQ:
            await assessment_service.create_question(
                db,
                aid,
                kind="mcq",
                prompt=prompt,
                points=2.0,
                choices=[{"label": lab, "is_correct": ok} for lab, ok in opciones],
            )
        for prompt, correcta in PREGUNTAS_VF:
            await assessment_service.create_question(
                db,
                aid,
                kind="true_false",
                prompt=prompt,
                points=1.0,
                choices=[
                    {"label": "Verdadero", "is_correct": correcta},
                    {"label": "Falso", "is_correct": not correcta},
                ],
            )
        for prompt, num in PREGUNTAS_NUM:
            await assessment_service.create_question(
                db,
                aid,
                kind="numeric",
                prompt=prompt,
                points=1.0,
                correct_numeric=num,
            )
        for prompt in PREGUNTAS_OPEN:
            await assessment_service.create_question(
                db,
                aid,
                kind="open",
                prompt=prompt,
                points=3.0,
            )
    print(f"  + evaluaciones de {len(momentos)} proyectos con preguntas")
    return assessment_ids


async def _actividad(
    db: AsyncSession, inst: Institution, estudiantes: list[User]
) -> None:
    if (
        await _existe(db, Attempt)
        and (await db.execute(select(func.count()).select_from(Attempt))).scalar_one() > 5
    ):
        return

    # Progreso por momento sobre proyectos publicados.
    momentos_pub = (
        (
            await db.execute(
                select(Moment.id)
                .join(Project, Project.id == Moment.project_id)
                .where(Project.status == "published")
            )
        )
        .scalars()
        .all()
    )
    for est in estudiantes:
        for mid in RNG.sample(momentos_pub, RNG.randint(3, min(12, len(momentos_pub)))):
            estado = RNG.choices(
                [
                    ProgressState.COMPLETED,
                    ProgressState.IN_PROGRESS,
                    ProgressState.NOT_STARTED,
                ],
                weights=[6, 3, 1],
            )[0]
            if await _existe(db, Progress, user_id=est.id, moment_id=mid):
                continue
            db.add(
                Progress(
                    user_id=est.id,
                    moment_id=mid,
                    institution_id=inst.id,
                    state=estado,
                    completed_at=(datetime.now(UTC) - timedelta(days=RNG.randint(1, 40)))
                    if estado == ProgressState.COMPLETED
                    else None,
                )
            )

    # Intentos de evaluación.
    evals = (
        await db.execute(
            select(Question.assessment_id, func.count(Question.id)).group_by(
                Question.assessment_id
            )
        )
    ).all()
    from app.modules.assessment.models import Assessment

    for assessment_id, _n in evals:
        preguntas = (
            (
                await db.execute(
                    select(Question).where(Question.assessment_id == assessment_id)
                )
            )
            .scalars()
            .all()
        )
        assess = (
            await db.execute(select(Assessment).where(Assessment.id == assessment_id))
        ).scalar_one()
        for est in RNG.sample(estudiantes, RNG.randint(8, 18)):
            puntaje = round(RNG.uniform(35, 100), 1)
            estado = (
                AttemptStatus.GRADED if RNG.random() > 0.4 else AttemptStatus.SUBMITTED
            )
            at = Attempt(
                assessment_id=assessment_id,
                student_id=est.id,
                institution_id=inst.id,
                status=estado,
                score=puntaje,
                submitted_at=datetime.now(UTC) - timedelta(days=RNG.randint(1, 30)),
                team_label=RNG.choice([None, "Equipo A", "Equipo B", "Equipo C"])
                if assess.team_mode
                else None,
            )
            db.add(at)
            await db.flush()
            for q in preguntas:
                choice_id = None
                val_text = None
                val_num = None
                correcto = RNG.random() > 0.35
                if q.kind in ("mcq", "true_false"):
                    ch = (
                        (
                            await db.execute(
                                select(Choice).where(Choice.question_id == q.id)
                            )
                        )
                        .scalars()
                        .all()
                    )
                    if ch:
                        pick = (
                            next((c for c in ch if c.is_correct), ch[0])
                            if correcto
                            else RNG.choice(ch)
                        )
                        choice_id = pick.id
                elif q.kind == "numeric":
                    val_num = (
                        q.correct_numeric if correcto else (q.correct_numeric or 0) + 10
                    )
                else:
                    val_text = "Mi proyecto ayuda a resolver un problema real del aula."
                db.add(
                    Answer(
                        attempt_id=at.id,
                        question_id=q.id,
                        choice_id=choice_id,
                        value_text=val_text,
                        value_numeric=val_num,
                        is_correct=correcto if q.kind != "open" else None,
                        teacher_score=RNG.choice([2.0, 2.5, 3.0])
                        if q.kind == "open" and estado == AttemptStatus.GRADED
                        else None,
                    )
                )
    print("  + progreso e intentos de evaluación de los estudiantes")


async def main() -> None:
    if settings.ENV != "local" and "--force" not in sys.argv:
        sys.exit(f"Rechazado: ENV={settings.ENV}. Usa --force si de verdad quieres.")

    print(f"Sembrando datos de demo en {settings.ENV}...")
    async with SessionLocal() as db:
        inst = await _get_inst(db)
        await _proyectos(db, inst)
        await _lecciones(db)
        await _recursos(db)
        await _medios(db)
        tags = await _tags(db)
        await _asignar_tags(db, tags)
        await _plantillas(db)
        await _rutas(db)
        await _colecciones(db)
        estudiantes = await _estudiantes(db, inst)
        await _evaluaciones(db)
        await _actividad(db, inst, estudiantes)
        await db.commit()
    print("\nListo. El Content Studio ya tiene contenido en todas las pestañas.")


if __name__ == "__main__":
    asyncio.run(main())
