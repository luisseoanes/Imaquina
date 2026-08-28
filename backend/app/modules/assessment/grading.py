"""Tipos de pregunta con estructura en `Question.config`.

Cada tipo define tres cosas y aquí viven las tres:
  - `validar(config)`   -> lo mínimo que se exige al guardar (no la completitud)
  - `para_estudiante(config)` -> el config SIN la clave de respuesta
  - `calificar(config, respuesta)` -> True/False

La respuesta del alumno viaja en `Answer.value_text` como JSON (una lista de
ids para `ordering`, un mapa para `matching`/`cloze`).

El texto va por idioma dentro del config (`{es: ..., en: ...}`), misma decisión
que los bloques interactivos: añadir un idioma no cambia la forma.
"""

import json
from typing import Any

DIFICULTADES = ("easy", "medium", "hard")


def _norm(s: Any) -> str:
    return " ".join(str(s or "").strip().lower().split())


def _cargar_respuesta(value_text: str | None) -> Any:
    if not value_text:
        return None
    try:
        return json.loads(value_text)
    except (ValueError, TypeError):
        return None


# --- Validación al guardar -------------------------------------------------


def validar_config(kind: str, config: Any) -> dict:
    if config is None:
        return {}
    if not isinstance(config, dict):
        raise _err("`config` debe ser un objeto")

    if kind == "ordering":
        _lista_de_items(config, "items")
    elif kind == "matching":
        _lista_de_items(config, "left")
        _lista_de_items(config, "right")
        if "pairs" in config and not isinstance(config["pairs"], list):
            raise _err("`config.pairs` debe ser una lista de [izquierda, derecha]")
    elif (
        kind == "cloze"
        and "blanks" in config
        and not isinstance(config["blanks"], list)
    ):
        raise _err("`config.blanks` debe ser una lista")
    return config


def _lista_de_items(config: dict, clave: str) -> None:
    if clave in config and not isinstance(config[clave], list):
        raise _err(f"`config.{clave}` debe ser una lista")


def _err(msg: str) -> Exception:
    from app.core.errors import ValidationFailed

    return ValidationFailed(msg)


# --- Filtrado para el estudiante ----------------------------------------


def config_para_estudiante(kind: str, config: dict) -> dict:
    """Quita la clave de respuesta. Para `ordering` además baraja los items
    (su orden ES la respuesta)."""
    config = config or {}
    if kind == "ordering":
        items = list(config.get("items") or [])
        # Barajado determinista por id: no hace falta azar real y así el
        # estudiante ve el mismo orden si recarga.
        items = sorted(items, key=lambda it: str(it.get("id", "")))
        return {**config, "items": items}
    if kind == "matching":
        return {
            "left": config.get("left") or [],
            "right": _barajar_derecha(config),
        }
    if kind == "cloze":
        return {
            "text": config.get("text") or {},
            "blanks": [
                {"id": b.get("id")} for b in (config.get("blanks") or [])
            ],
        }
    return config


def _barajar_derecha(config: dict) -> list:
    derecha = list(config.get("right") or [])
    return sorted(derecha, key=lambda it: str(it.get("id", "")))


# --- Calificación automática -------------------------------------------


def calificar(kind: str, config: dict, value_text: str | None) -> bool:
    respuesta = _cargar_respuesta(value_text)
    config = config or {}

    if kind == "ordering":
        esperado = [str(it.get("id")) for it in config.get("items") or []]
        return isinstance(respuesta, list) and [str(x) for x in respuesta] == esperado

    if kind == "matching":
        esperado = {
            str(a): str(b) for a, b in (config.get("pairs") or []) if a is not None
        }
        if not isinstance(respuesta, dict) or not esperado:
            return False
        return {str(k): str(v) for k, v in respuesta.items()} == esperado

    if kind == "cloze":
        blanks = config.get("blanks") or []
        if not isinstance(respuesta, dict) or not blanks:
            return False
        for b in blanks:
            aceptadas = {_norm(x) for x in (b.get("answers") or [])}
            if _norm(respuesta.get(str(b.get("id")))) not in aceptadas:
                return False
        return True

    return False
