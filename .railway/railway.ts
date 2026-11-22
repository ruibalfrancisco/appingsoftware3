// Infraestructura de Railway como código (reemplaza a railway.toml, que Railway deja de leer
// el 2026-12-01). El mismo archivo describe los dos ambientes:
//
//   railway config plan  --environment staging      solo muestra qué cambiaría
//   railway config apply --environment staging      aplica después de confirmar
//
// IMPORTANTE: al aplicar, Railway BORRA todo recurso del proyecto que no esté declarado acá.
// No quitar PostGIS ni su volumen. Las variables no se manejan acá (variables.managed = false):
// se cargan en Railway y no se borran.
import { defineRailway, image, project, service, volume } from 'railway/iac'

// Una sola región: el plan Hobby no admite multirregión. US East es la más cercana a Argentina.
const SOLO_US_EAST = { 'us-east4-eqdc4a': 1 }

const REINICIO = { restartPolicyType: 'ON_FAILURE', restartPolicyMaxRetries: 3 } as const

const DOCKERFILE = { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile', buildEnvironment: 'V3' } as const

export default defineRailway(() => {
  const postgisVolume = volume('postgis-volume', {
    alerts: { usage: { '100': {}, '80': {}, '95': {} } },
    allowOnlineResize: true,
    region: 'us-east4-eqdc4a',
    sizeMB: 5000,
  })

  // Misma imagen que infra/docker-compose.yml y el job de integración de ci.yml.
  const PostGIS = service('PostGIS', {
    source: image('postgis/postgis:17-3.5'),
    build: { buildEnvironment: 'V3', builder: 'RAILPACK' },
    replicas: SOLO_US_EAST,
    deploy: { requiredMountPath: '/var/lib/postgresql/data' },
    networking: { privateNetworkEndpoint: 'postgis', tcpProxies: { '5432': {} } },
    volumeMounts: { '/var/lib/postgresql/data': postgisVolume },
  })

  // El código lo sube deploy.yml con `railway up backend --path-as-root`.
  const api = service('api', {
    build: DOCKERFILE,
    deploy: {
      // Migraciones antes de publicar la versión nueva; si fallan, sigue la anterior.
      preDeployCommand: ['alembic upgrade head'],
      healthcheckPath: '/health',
      healthcheckTimeout: 60,
      ...REINICIO,
    },
    replicas: SOLO_US_EAST,
  })

  // El código lo sube deploy.yml con `railway up frontend --path-as-root`.
  const web = service('web', {
    build: DOCKERFILE,
    deploy: { healthcheckPath: '/', healthcheckTimeout: 60, ...REINICIO },
    replicas: SOLO_US_EAST,
  })

  return project('reclamos-villa-allende', {
    variables: { managed: false },
    resources: [web, PostGIS, api, postgisVolume],
  })
})
