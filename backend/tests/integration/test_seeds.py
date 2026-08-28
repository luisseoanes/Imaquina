"""Las semillas de desarrollo son idempotentes (B3).

`make seed` se documenta como "se puede correr las veces que haga falta", y eso
sólo es cierto si cada consulta busca SU fila por un identificador propio. La
primera versión buscaba el curso como "el único de la institución", así que en
cuanto un administrador creaba otro curso desde la aplicación —el uso normal—
resembrar reventaba con `MultipleResultsFound` y dejaba el entorno de
desarrollo sin forma de recuperarse.
"""

from sqlalchemy import func, select

from app.db.seeds import CURSO, _sembrar
from app.modules.identity.models import Calendar, Course, Institution, License, User


async def _contar(db, modelo) -> int:
    return (await db.execute(select(func.count()).select_from(modelo))).scalar_one()


async def test_sembrar_dos_veces_no_duplica_nada(db):
    await _sembrar(db)
    conteos = {
        m: await _contar(db, m) for m in (Institution, License, Course, User)
    }

    await _sembrar(db)

    for modelo, antes in conteos.items():
        assert await _contar(db, modelo) == antes, f"{modelo.__name__} se duplicó"


async def test_resembrar_con_un_curso_creado_a_mano(db):
    """El caso que rompía: alguien usa la aplicación y crea otro curso."""
    await _sembrar(db)
    inst = (
        await db.execute(select(Institution).limit(1))
    ).scalar_one()
    db.add(Course(institution_id=inst.id, name="Otro curso del profe", grade="6"))
    await db.flush()

    await _sembrar(db)  # no debe lanzar MultipleResultsFound

    cursos = (
        await db.execute(select(Course).where(Course.institution_id == inst.id))
    ).scalars().all()
    nombres = {c.name for c in cursos}
    assert nombres == {CURSO, "Otro curso del profe"}


async def test_resembrar_con_una_licencia_extra(db):
    """Misma trampa con las licencias: se toma la de vigencia más larga."""
    from datetime import date, timedelta

    await _sembrar(db)
    inst = (await db.execute(select(Institution).limit(1))).scalar_one()
    db.add(
        License(
            institution_id=inst.id,
            calendar=Calendar.A,
            valid_from=date.today() - timedelta(days=400),
            valid_to=date.today() - timedelta(days=40),
            seats=10,
        )
    )
    await db.flush()

    await _sembrar(db)

    licencias = (
        await db.execute(select(License).where(License.institution_id == inst.id))
    ).scalars().all()
    assert len(licencias) == 2, "no debería crear una tercera"
