# 0003 · GitHub Actions despliega con el CLI de Railway

- **Estado:** aceptada · 2026-11-22

## Contexto

Railway puede desplegar solo cuando cambia la rama (autodeploy) o recibir el código desde el
CLI. Queremos que todo el proceso, incluida la aprobación de producción, se vea en un lugar.

## Decisión

`deploy.yml` sube cada servicio con `railway up <carpeta> --path-as-root --ci` usando un token
de proyecto por ambiente, guardado como secreto del ambiente de GitHub. La versión del CLI está
fijada (5.75.0) y los flags `--project`, `--environment` y `--service` son explícitos.

La configuración de cada servicio (Dockerfile, pre-deploy de migraciones, healthcheck) vive en
`backend/railway.toml` y `frontend/railway.toml`, así queda versionada y pasa por PR.

Después de subir, el job espera a que `/health` informe el commit desplegado: `railway up --ci`
termina al terminar el build, antes de las migraciones y del healthcheck.

## Alternativas descartadas

- **Autodeploy de Railway con "Wait for CI":** más simple, pero se pierde la aprobación manual
  de GitHub y el smoke antes de producción dentro del mismo flujo. Queda como plan B.

## Consecuencias

- Toda la historia (CI, staging, smoke, aprobación, producción, tag) está en una sola corrida.
- Un cambio del CLI puede romper el despliegue: por eso la versión fija y Dependabot avisando.
- Cada token solo puede desplegar en su ambiente.
