.PHONY: up down api web worker migrate revision test test-unit test-int lint fix testdb

up:            ## Levanta Postgres + Redis
	docker compose up -d db redis

down:
	docker compose down

testdb:        ## Crea la base de datos de tests (requiere `make up`)
	docker compose exec -T db psql -U imaquina -c "CREATE DATABASE imaquina_test" || true

api:           ## Backend en local
	cd backend && .venv/Scripts/python -m uvicorn app.main:app --reload

worker:        ## Worker de background
	cd backend && .venv/Scripts/arq app.workers.worker.WorkerSettings

web:           ## Frontend
	cd frontend && npm run dev

migrate:
	cd backend && .venv/Scripts/alembic upgrade head

revision:      ## make revision m="mensaje"
	cd backend && .venv/Scripts/alembic revision --autogenerate -m "$(m)"

test:          ## Todo (los de integración se saltan si no hay DB)
	cd backend && .venv/Scripts/python -m pytest -q

test-unit:     ## Sin infraestructura, siempre corren
	cd backend && .venv/Scripts/python -m pytest tests/unit -q

test-int:      ## Requiere `make up && make testdb`
	cd backend && .venv/Scripts/python -m pytest tests/integration -q

lint:
	cd backend && .venv/Scripts/python -m ruff check app tests

fix:
	cd backend && .venv/Scripts/python -m ruff check app tests --fix
