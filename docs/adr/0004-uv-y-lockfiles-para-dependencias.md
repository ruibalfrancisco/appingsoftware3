# 0004 · uv y lockfiles para dependencias

- **Estado:** aceptada · 2026-11-22

## Contexto

Un build reproducible exige que local, CI y Railway instalen exactamente las mismas versiones,
incluidas las dependencias transitivas.

## Decisión

- Backend: [uv](https://docs.astral.sh/uv/) con `pyproject.toml` y `uv.lock`. CI usa
  `uv sync --locked` (falla si el lock no coincide) y el Dockerfile `uv sync --frozen`.
- Frontend y e2e: npm con `package-lock.json` y `npm ci`.
- Dependabot propone actualizaciones semanales agrupadas; pip-audit y npm audit corren en CI.

## Alternativas descartadas

- **pip con requirements.txt:** sin lock de transitivas salvo con herramientas extra
  (pip-tools), y bastante más lento en CI.
- **Poetry:** resuelve el lock, pero es más lento y uv además instala Python.

## Consecuencias

- Instalar el entorno del backend es un comando (`uv sync`) y uv descarga Python 3.12 si falta.
- Hay que commitear los lockfiles en cada cambio de dependencias.
