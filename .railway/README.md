# Infraestructura de Railway como código

`railway.ts` describe el proyecto de Railway: servicios, base PostGIS con su volumen, regiones,
builder, pre-deploy de migraciones y healthchecks. El mismo archivo vale para `staging` y
`production`. Las variables de entorno **no** se manejan acá: se cargan en Railway.

`deploy.yml` lo aplica en cada despliegue, primero en staging y después de la aprobación en
producción. Si el plan incluye algo destructivo (borrar un servicio o un volumen), el pipeline
falla en lugar de borrarlo.

## Comandos (desde la raíz del repo)

```bash
cd .railway && npm ci && cd ..                     # una vez: instala el SDK de Railway
railway config plan  --environment staging        # muestra qué cambiaría (no toca nada)
railway config apply --environment staging        # aplica después de confirmar
```

> **Cuidado:** al aplicar, Railway borra todo recurso del proyecto que no esté declarado en
> `railway.ts`. Nunca quites `PostGIS` ni `postgis-volume`.

**En Windows** el SDK busca el ejecutable `railway.exe` en la variable `_`. Si `plan` dice que
necesita una versión más nueva del CLI, en PowerShell corré antes:

```powershell
$env:_ = "$env:APPDATA\npm\node_modules\@railway\cli\bin\railway.exe"
```
