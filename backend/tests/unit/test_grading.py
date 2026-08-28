"""Calificación automática de los tipos de pregunta con estructura en `config`.

Funciones puras: sin base de datos. La ruta completa (guardar, enviar, nota)
se prueba en integración."""

import json

from app.modules.assessment import grading


def test_ordering_exige_la_secuencia_exacta():
    config = {"items": [{"id": "a"}, {"id": "b"}, {"id": "c"}]}
    assert grading.calificar("ordering", config, json.dumps(["a", "b", "c"]))
    assert not grading.calificar("ordering", config, json.dumps(["a", "c", "b"]))
    assert not grading.calificar("ordering", config, json.dumps(["a", "b"]))


def test_matching_compara_los_pares_sin_importar_el_orden():
    config = {
        "left": [{"id": "l1"}, {"id": "l2"}],
        "right": [{"id": "r1"}, {"id": "r2"}],
        "pairs": [["l1", "r2"], ["l2", "r1"]],
    }
    assert grading.calificar("matching", config, json.dumps({"l2": "r1", "l1": "r2"}))
    assert not grading.calificar("matching", config, json.dumps({"l1": "r1", "l2": "r2"}))


def test_cloze_normaliza_may_y_espacios_y_acepta_variantes():
    config = {
        "text": {"es": "El {{0}} da {{1}}."},
        "blanks": [
            {"id": "0", "answers": ["LED", "diodo emisor de luz"]},
            {"id": "1", "answers": ["luz"]},
        ],
    }
    assert grading.calificar("cloze", config, json.dumps({"0": " led ", "1": "Luz"}))
    assert not grading.calificar("cloze", config, json.dumps({"0": "led", "1": "sonido"}))


def test_config_para_estudiante_quita_la_clave_de_respuesta():
    matching = {
        "left": [{"id": "l1", "text": {"es": "A"}}],
        "right": [{"id": "r1", "text": {"es": "B"}}],
        "pairs": [["l1", "r1"]],
    }
    filtrado = grading.config_para_estudiante("matching", matching)
    assert "pairs" not in filtrado

    cloze = {"text": {"es": "x {{0}}"}, "blanks": [{"id": "0", "answers": ["luz"]}]}
    filtrado = grading.config_para_estudiante("cloze", cloze)
    assert filtrado["blanks"] == [{"id": "0"}]
    assert "answers" not in filtrado["blanks"][0]


def test_una_respuesta_ilegible_no_revienta_y_cuenta_como_incorrecta():
    assert not grading.calificar("ordering", {"items": [{"id": "a"}]}, "no es json")
    assert not grading.calificar("cloze", {"blanks": [{"id": "0"}]}, None)
