#!/usr/bin/env bash
# Conecta las credenciales del bucket "fotos" (declarado en .railway/railway.ts) a la api, por
# referencia: si Railway rota las claves, la api toma las nuevas sola. Es idempotente.
#
# Va en un script y no en el workflow porque GitHub Actions interpreta ${{ ... }} como propio.
# Uso: conectar-bucket.sh <ambiente>
set -euo pipefail

ambiente="${1:?Uso: conectar-bucket.sh <staging|production>}"

referencia() { printf '${{fotos.%s}}' "$1"; }

railway variable set --service api --environment "$ambiente" --skip-deploys \
  "AWS_ENDPOINT_URL=$(referencia ENDPOINT)" \
  "AWS_ACCESS_KEY_ID=$(referencia ACCESS_KEY_ID)" \
  "AWS_SECRET_ACCESS_KEY=$(referencia SECRET_ACCESS_KEY)" \
  "AWS_S3_BUCKET_NAME=$(referencia BUCKET)" \
  "AWS_DEFAULT_REGION=$(referencia REGION)" \
  "AWS_S3_ADDRESSING_STYLE=virtual"

echo "Bucket de fotos conectado a la api en ${ambiente}"
