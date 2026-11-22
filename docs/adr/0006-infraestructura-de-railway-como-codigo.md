# 0006 · Infraestructura de Railway como código

- **Estado:** aceptada · 2026-11-22 · reemplaza la parte de `railway.toml` del ADR 0003

## Contexto

El ADR 0003 dejaba la configuración de cada servicio (Dockerfile, pre-deploy de migraciones,
healthcheck) en `backend/railway.toml` y `frontend/railway.toml`. Al primer despliegue de prueba
la migración no corrió: Railway marcó "Config as Code" como obsoleto, los servicios nuevos ya no
leen esos archivos y los existentes dejan de leerlos el 2026-12-01, antes del final.

## Decisión

Describir el proyecto completo en `.railway/railway.ts` con el SDK oficial (`railway/iac`,
versión fija) y aplicarlo con `railway config apply`:

- Un solo archivo para staging y producción: servicios, PostGIS con su volumen, una región,
  builder Dockerfile, `alembic upgrade head` como pre-deploy y healthchecks.
- Las variables quedan fuera (`variables.managed = false`): se cargan en Railway, así no hay
  secretos en el repositorio y el código no puede borrarlas.
- `deploy.yml` aplica el archivo antes de subir el código en cada ambiente. Sin
  `--confirm-destructive`, Railway rechaza cualquier cambio que borre recursos y el job falla.

## Alternativas descartadas

- **Seguir con `railway.toml`:** deja de funcionar el 2026-12-01.
- **Configurar a mano en el panel:** funciona, pero no queda versionado ni revisado por PR, y
  staging y producción pueden quedar distintos sin que nadie lo note.

## Consecuencias

- Un cambio de infraestructura pasa por PR, staging, aprobación y producción, como el código.
- Riesgo: Railway borra lo que no esté declarado. Se mitiga con el plan previo, la falla ante
  cambios destructivos y la advertencia en el archivo.
- Se agrega una dependencia de Node en `.railway/` solo para el pipeline.
