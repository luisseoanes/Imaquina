"""Content Studio: dominios de autoría propios del panel del editor.

`catalog` cubre proyectos/momentos/bloques; `media`, la librería; `assessment`,
las evaluaciones; `publishing`, la publicación. Este módulo añade lo que el
panel del editor necesita ADEMÁS y que no encaja en ninguno de esos:

- Lecciones y recursos sueltos (contenido que no es un proyecto de 6 momentos).
- Rutas de aprendizaje (secuencias curadas de proyectos/lecciones).
- Plantillas reutilizables.
- Etiquetas y colecciones para organizar el catálogo.
- Agregados de tablero: dashboard, analítica y actividad de estudiantes.

Todo el contenido de este módulo es GLOBAL (sin `institution_id`), igual que
`Project`: los 36 proyectos y su material se comparten entre instituciones. Los
agregados de `analytics` sí se filtran por institución, vía el guard `Staff`.
"""
