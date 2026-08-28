"""Notificaciones in-app.

Un `Notification` por (destinatario, evento). Los demás módulos NO escriben
esta tabla: llaman a `notifications.service.notify(...)` —patrón de
`arquitectura.md` §2, un módulo invoca el SERVICIO de otro, no su modelo—.

El cliente hace polling a `GET /notifications/unread-count` (barato) y abre
`GET /notifications` al desplegar la campana.
"""
