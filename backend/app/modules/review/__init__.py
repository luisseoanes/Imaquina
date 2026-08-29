"""Flujo editorial: comentarios en hilo y control de cambios de estado.

Este módulo posee los COMENTARIOS y el HISTORIAL. Las transiciones de estado
del proyecto (`draft`→`in_review`→`approved`) las hace `catalog.service` sobre
su propio modelo — `review` nunca escribe `Project`, sólo lo lee y registra el
evento (regla de dependencia, `docs/arquitectura.md` §2).
"""
