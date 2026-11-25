# Reclamos Villa Allende

Web app instalable (PWA, mobile-first) para que los vecinos de Villa Allende reporten problemas
urbanos con foto y ubicación, y para que la Municipalidad los gestione por prioridad.
Trabajo práctico de Ingeniería de Software III: lo que se evalúa es el proceso de integración,
entrega y despliegue continuo.

## Estructura

```
frontend/   React 19 + Vite + TypeScript + Tailwind (servicio "web" en Railway)
backend/    FastAPI + SQLAlchemy + Alembic, Python 3.12 con uv (servicio "api")
e2e/        Playwright: E2E en el CI, smoke e integración en QA después de cada despliegue
infra/      docker-compose con PostGIS, RustFS (S3) y Mailpit para desarrollo local
.railway/   Infraestructura de Railway como código (servicios, base, regiones, healthchecks)
docs/adr/   Decisiones de arquitectura con alternativas descartadas
.github/    Workflows de CI/CD, acción de despliegue y Dependabot
```

## Pipeline

```
PR ──► ci.yml: lint-y-tipos + unitarias ──► integracion · e2e · imagenes (build) ──► merge a main
                seguridad (en paralelo)
main ──► deploy.yml: ci ──► QA (staging en Railway): smoke + pruebas de integración
                        ──► aprobación manual ──► producción + smoke ──► tag vX.Y.Z
```

- **ci.yml** corre en cada pull request; sus jobs son los checks obligatorios de `main`. Si fallan
  las unitarias o el lint, el build de las imágenes y las demás pruebas no corren.
- **deploy.yml** corre en cada push a `main`: repite el CI sobre el commit exacto, despliega a QA
  (el ambiente `staging`) con el CLI de Railway, espera que `/health` informe ese commit, corre
  el smoke test y las pruebas de integración contra QA, y queda esperando aprobación en el
  ambiente `production` de GitHub.
- Cada etapa publica su **informe de pruebas** (JUnit XML): aparece como un check más
  ("Informe · pruebas unitarias", "Informe · QA (smoke + integración)", etc.) y como tabla en el
  resumen de la corrida. Los informes HTML y de cobertura quedan como artefactos de la corrida.
- La versión vive en `VERSION`. Después del smoke de producción se crea el tag `v<VERSION>`;
  para publicar una versión nueva, se sube `VERSION` en el PR.

## Desarrollo local

Requisitos: Git, Docker Desktop (con WSL 2 en Windows), Node.js 26 LTS y
[uv](https://docs.astral.sh/uv/) (uv instala Python 3.12 solo).

Una sola vez: copiá `.env.example` a `.env` y completá `JWT_SECRET` con cualquier texto largo
(por ejemplo, el resultado de `openssl rand -hex 32`).

Cada vez que vas a trabajar (PowerShell, desde la raíz del repo):

```powershell
# 1. Servicios de apoyo: PostGIS, RustFS (S3) y Mailpit. Docker Desktop tiene que estar abierto.
docker compose -f infra/docker-compose.yml up -d

# 2. API en http://localhost:8000 (documentación interactiva en /docs)
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 127.0.0.1

# 3. Web en http://localhost:5173 (en otra terminal). Reenvía /api a la API.
cd frontend
npm ci
npm run dev
```

Bandeja de Mailpit (los emails de la app llegan acá): http://localhost:8025 · Consola de
RustFS: http://localhost:9001 · Para apagar todo: `docker compose -f infra/docker-compose.yml down`.

> **Windows:** el backend se conecta a `127.0.0.1` y no a `localhost`. Con `localhost`, Windows
> prueba primero IPv6 y cada conexión a Docker puede tardar varios segundos o quedar colgada.

## Personal municipal

Los operadores y administradores no se registran desde la app: se dan de alta con un script
(CU-10; el plan recorta la pantalla de usuarios municipales). Desde `backend/`:

```powershell
# Local: con CLAVE_INICIAL queda con esa contraseña.
$env:CLAVE_INICIAL="clave-de-prueba-1"
uv run python -m app.municipales --dni 20111222 --nombre Ana --apellido Pérez --email ana@villaallende.gob.ar --rol operador

# Sin CLAVE_INICIAL imprime un enlace de un solo uso (72 h) para que la persona elija su contraseña.
# --desactivar le corta el acceso y cierra sus sesiones.
uv run python -m app.municipales --dni 20111222 --desactivar
```

Al ingresar, el personal municipal va al Tablero; un vecino que intente usar `/gestion` recibe 403.

Los E2E del back office (E2E-04) ingresan como la operadora de prueba: en local, creala una vez
con `$env:CLAVE_INICIAL="clave-de-prueba-1"` y `--dni 20999888` (el CI la crea solo).

## Pruebas

| Qué | Comando |
| --- | --- |
| Backend: lint, formato y tipos | `cd backend && uv run ruff check . && uv run ruff format --check . && uv run mypy` |
| Backend: unitarias con cobertura | `cd backend && uv run python -m pytest -m "not integracion" --cov=app` |
| Backend: integración (con docker-compose levantado) | `cd backend && $env:DATABASE_URL="postgresql://reclamos:reclamos@127.0.0.1:5432/reclamos_pruebas"; uv run python -m pytest -m integracion` |
| Frontend: lint, formato y tipos | `cd frontend && npm run lint && npm run format:check && npm run typecheck` |
| Frontend: unitarias con cobertura | `cd frontend && npm run test:cov` |
| E2E (con la API y `npm run dev` corriendo) | `cd e2e && npx playwright install chromium` (una vez) y `$env:WEB_URL="http://localhost:5173"; npx playwright test --project=e2e` |
| Smoke contra un ambiente | `cd e2e && $env:WEB_URL="..."; $env:API_URL="..."; npm run smoke` |
| Integración en QA (o contra la app local) | `cd e2e && $env:WEB_URL="..."; $env:QA_USUARIO_DNI="..."; $env:QA_USUARIO_CLAVE="..."; npx playwright test --project=qa` |

Las pruebas de integración vacían la base antes de cada prueba: por eso usan `reclamos_pruebas`
y no la base con la que probás la app. Se crea una sola vez con
`docker compose -f infra/docker-compose.yml exec db createdb -U reclamos reclamos_pruebas`.

Cada prueba lleva el ID del documento de requerimientos (UT-xx, IT-xx, E2E-xx) para trazar
qué regla de negocio cubre. Las pruebas de integración en QA (QA-xx) usan una cuenta de personal
municipal que existe solo en ese ambiente; sin las variables, van contra la operadora local.

## Ramas y commits

Trunk-based: ramas cortas `feature/...` o `fix/...` que vuelven a `main` por PR en menos de dos
días. Commits con [Conventional Commits](https://www.conventionalcommits.org/es/) (`feat:`,
`fix:`, `test:`, `ci:`, `docs:`).
