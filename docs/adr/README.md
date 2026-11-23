# Registro de decisiones de arquitectura (ADR)

Cada decisión que el tribunal puede preguntar se documenta en un archivo corto con contexto,
decisión, alternativas descartadas y consecuencias. Un ADR no se edita después de aceptado: si
la decisión cambia, se escribe uno nuevo que lo reemplaza.

| ADR | Decisión | Estado |
| --- | --- | --- |
| [0001](0001-monorepo-con-un-solo-pipeline.md) | Monorepo con un solo pipeline | Aceptada |
| [0002](0002-entrega-continua-con-aprobacion-manual.md) | Entrega continua con aprobación manual | Aceptada |
| [0003](0003-github-actions-despliega-con-el-cli-de-railway.md) | GitHub Actions despliega con el CLI de Railway | Aceptada; `railway.toml` reemplazado por el 0006 |
| [0004](0004-uv-y-lockfiles-para-dependencias.md) | uv y lockfiles para dependencias | Aceptada |
| [0005](0005-rustfs-como-s3-local.md) | RustFS como S3 local en lugar de MinIO | Aceptada |
| [0006](0006-infraestructura-de-railway-como-codigo.md) | Infraestructura de Railway como código | Aceptada (reemplaza parte del 0003) |
| [0007](0007-la-web-hace-de-proxy-de-la-api.md) | La web hace de proxy de la API (cookies propias) | Aceptada |
| [0008](0008-mapa-con-openstreetmap.md) | Mapa con OpenStreetMap en lugar de Google Maps | Aceptada |

Pendientes de escribir (ver "Decisiones a justificar" en el documento de requerimientos):
PostGIS para distancias y geocerca, prioridad con logaritmo, base
real en integración, Railway Bucket para fotos, una sola app React y cuenta propia con DNI.
