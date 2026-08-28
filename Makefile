# El backend se maneja con uv. `backend/uv.lock` fija TODAS las versiones
# transitivas, asi que el entorno es identico en Linux y en Windows — que es
# lo que `pyproject.toml` con rangos `>=` no garantizaba.
#
# `uv run` resuelve el interprete solo: no hay que activar nada ni saber si el
# venv usa bin/ (Linux-macOS) o Scripts/ (Windows). Nunca escribas aqui una
# ruta de interprete fija.
#
# Instalar uv: https://docs.astral.sh/uv/getting-started/installation/
# En Windows, invocar make desde Git Bash o WSL (cmd.exe no resuelve rutas de
# ejecutable con barras normales).

UV ?= uv

.DEFAULT_GOAL := help
.PHONY: help require-uv sync lock up down testdb api worker seed migrate revision test test-unit test-int lint fix

help:          ## Lista los comandos disponibles
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sort | awk -F':.*##' '{printf "  \033[36m%-12s\033[0m%s\n", $$1, $$2}'

require-uv:
	@command -v $(UV) >/dev/null 2>&1 || { \
	  echo "Falta uv. Instalalo: https://docs.astral.sh/uv/getting-started/installation/"; \
	  exit 1; }

sync: require-uv   ## Crea/actualiza backend/.venv exactamente segun uv.lock
	cd backend && $(UV) sync

lock: require-uv   ## Sube las dependencias a su ultima version compatible y reescribe uv.lock
	cd backend && $(UV) lock --upgrade

up:            ## Levanta Postgres + Redis
	docker compose up -d db redis

down:          ## Para los contenedores
	docker compose down

testdb:        ## Crea la base de datos de tests (requiere `make up`)
	docker compose exec -T db psql -U imaquina -c "CREATE DATABASE imaquina_test" || true

api: require-uv    ## Backend en local
	cd backend && $(UV) run uvicorn app.main:app --reload

worker: require-uv ## Worker de background
	cd backend && $(UV) run arq app.workers.worker.WorkerSettings

seed: require-uv      ## Datos de desarrollo: institucion, licencia, 4 roles y un proyecto publicado
	cd backend && $(UV) run python -m app.db.seeds

migrate: require-uv   ## alembic upgrade head
	cd backend && $(UV) run alembic upgrade head

revision: require-uv  ## make revision m="mensaje"
	cd backend && $(UV) run alembic revision --autogenerate -m "$(m)"

test: require-uv      ## Todo (los de integración se saltan si no hay DB)
	cd backend && $(UV) run pytest -q

test-unit: require-uv ## Sin infraestructura, siempre corren
	cd backend && $(UV) run pytest tests/unit -q

test-int: require-uv  ## Requiere `make up && make testdb`
	cd backend && $(UV) run pytest tests/integration -q

lint: require-uv      ## ruff check
	cd backend && $(UV) run ruff check app tests

fix: require-uv       ## ruff check --fix
	cd backend && $(UV) run ruff check app tests --fix
