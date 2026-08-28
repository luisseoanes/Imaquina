"""Asignaciones: el docente encarga un proyecto a un curso con fecha límite.

El progreso ya vive en `learning.Progress` (por momento); una asignación sólo
añade el "para cuándo" y a quién. El estado por alumno (a tiempo / tarde /
sin empezar) se CALCULA cruzando `Progress` con `due_at`, no se guarda: así no
hay dos fuentes de verdad que puedan desincronizarse.

`assignments` LEE `catalog` y `learning`, y llama a los SERVICIOS de
`notifications` y `audit` — nunca escribe modelos ajenos (arquitectura.md §2).
"""
