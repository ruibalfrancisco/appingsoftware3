# Reclamos Villa Allende

Web app instalable (PWA, mobile-first) para que los vecinos de Villa Allende reporten problemas
urbanos con foto y ubicación, y para que la Municipalidad los gestione por prioridad.
Trabajo práctico de Ingeniería de Software III: lo que se evalúa es el proceso de integración,
entrega y despliegue continuo.

## Estructura

```
frontend/   React 19 + Vite + TypeScript + Tailwind (servicio "web" en Railway)
backend/    FastAPI + SQLAlchemy + Alembic, Python 3.12 con uv (servicio "api")
e2e/        Playwright: smoke test después de cada despliegue (y los E2E más adelante)
infra/      docker-compose con PostGIS, RustFS (S3) y Mailpit para desarrollo local
docs/adr/   Decisiones de arquitectura con alternativas descartadas
.github/    Workflows de CI/CD, acción de despliegue y Dependabot
```

## Pipeline

```
PR ──► ci.yml: lint-y-tipos · unitarias · integracion · imagenes · seguridad ──► merge a main
main ──► deploy.yml: ci ──► staging (Railway) + smoke ──► aprobación manual ──► production + smoke ──► tag vX.Y.Z
```

- **ci.yml** corre en cada pull request; sus jobs son los checks obligatorios de `main`.
- **deploy.yml** corre en cada push a `main`: repite el CI sobre el commit exacto, despliega a
  staging con el CLI de Railway, espera que `/health` informe ese commit, corre el smoke test y
  queda esperando aprobación en el ambiente `production` de GitHub.
- La versión vive en `VERSION`. Después del smoke de producción se crea el tag `v<VERSION>`;
  para publicar una versión nueva, se sube `VERSION` en el PR.

## Desarrollo local

Requisitos: Git, Docker Desktop, Node.js 26 LTS y [uv](https://docs.astral.sh/uv/) (uv instala
Python 3.12 solo).

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d   # PostGIS, RustFS y Mailpit

# API en http://localhost:8000 (docs en /docs)
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# Web en http://localhost:5173 (en otra terminal)
cd frontend
npm ci
npm run dev
```

Bandeja de Mailpit: http://localhost:8025 · Consola de RustFS: http://localhost:9001

## Pruebas

| Qué | Comando |
| --- | --- |
| Backend: lint, formato y tipos | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy` |
| Backend: unitarias con cobertura | `cd backend && uv run python -m pytest -m "not integracion" --cov=app` |
| Backend: integración (necesita la base de docker-compose) | `cd backend && uv run python -m pytest -m integracion` |
| Frontend: lint, formato y tipos | `cd frontend && npm run lint && npm run format:check && npm run typecheck` |
| Frontend: unitarias con cobertura | `cd frontend && npm run test:cov` |
| Smoke contra un ambiente | `cd e2e && WEB_URL=... API_URL=... npm run smoke` |

Cada prueba lleva el ID del documento de requerimientos (UT-xx, IT-xx, E2E-xx) para trazar
qué regla de negocio cubre.

## Ramas y commits

Trunk-based: ramas cortas `feature/...` o `fix/...` que vuelven a `main` por PR en menos de dos
días. Commits con [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat:`,
`fix:`, `test:`, `ci:`, `docs:`).
