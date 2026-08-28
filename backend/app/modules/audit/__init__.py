"""Registro de auditoría.

Son datos de menores (Ley 1581): quién creó o desactivó una cuenta, publicó
contenido, cambió una nota o restableció una contraseña queda anotado aquí.

Append-only: `record(...)` sólo inserta. Los demás módulos llaman a
`audit.service.record(...)`, nunca escriben la tabla.
"""
