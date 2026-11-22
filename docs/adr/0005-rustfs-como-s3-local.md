# 0005 · RustFS como S3 local en lugar de MinIO

- **Estado:** aceptada · 2026-11-22

## Contexto

En staging y producción las fotos van al Railway Bucket, compatible con S3. En local y en CI
hace falta un servidor S3 equivalente para que el código no cambie entre ambientes. El plan
original era MinIO, pero MinIO dejó de publicar imágenes de Docker (la imagen `minio/minio` ya
no está en Docker Hub).

## Decisión

Usar [RustFS](https://github.com/rustfs/rustfs) (`rustfs/rustfs:1.0.6`), servidor compatible
con S3 bajo licencia Apache 2.0, con versión fija en `infra/docker-compose.yml`.

## Alternativas descartadas

- **Compilar MinIO desde el código fuente:** agrega un paso de build propio sin beneficio.
- **Una imagen vieja de MinIO:** sin parches de seguridad y sin garantía de que siga publicada.
- **LocalStack:** emula muchos servicios de AWS; es más pesado de lo necesario para un bucket.

## Consecuencias

- boto3 se configura igual en todos los ambientes (`AWS_ENDPOINT_URL` y credenciales).
- Si RustFS se comporta distinto que el Railway Bucket en algún detalle, lo detectan el smoke y
  el nightly contra staging, que usan el bucket real.
