# Decisiones técnicas · Reclamos Villa Allende

Trabajo Práctico Integrador de Ingeniería de Software III (UCC, 2026).

Este documento explica **qué se construyó, cómo funciona el pipeline y por qué se tomó cada
decisión**. El detalle de cada decisión de arquitectura, con las alternativas descartadas, está
en [`docs/adr/`](docs/adr/README.md). Los casos de prueba están en
[`docs/casos-de-prueba.md`](docs/casos-de-prueba.md).

| | |
| --- | --- |
| Repositorio (público) | https://github.com/ruibalfrancisco/appingsoftware3 |
| QA (ambiente `staging`) | https://web-staging-c24ee5fe.up.railway.app |
| Producción | https://web-production-6fad12ff.up.railway.app |
| CI/CD | GitHub Actions: [`ci.yml`](.github/workflows/ci.yml) y [`deploy.yml`](.github/workflows/deploy.yml) |
| Nube | Railway (servicios `web`, `api`, `PostGIS` y bucket `fotos`, uno por ambiente) |

---

## 1. La aplicación

Una web app instalable (PWA, pensada para el celular) para que los vecinos de Villa Allende
reporten problemas urbanos (baches, luminarias, basura...) con foto y ubicación, apoyen los
reclamos que ya cargó otro vecino y sigan su estado. La Municipalidad los atiende desde un
Tablero ordenado por prioridad, les cambia el estado y avisa a los vecinos.

Cumple lo que pide la consigna:

| Pide la consigna | En este proyecto |
| --- | --- |
| Servicio de frontend | `frontend/`: React 19 + Vite + TypeScript + Tailwind, servido por nginx (servicio `web`) |
| Servicio de backend | `backend/`: FastAPI + SQLAlchemy + Alembic, Python 3.12 (servicio `api`) |
| Base de datos | PostgreSQL 17 con PostGIS (servicio `PostGIS`), más un bucket S3 para las fotos |
| Repositorio Git público | GitHub, público |

---

## 2. Cómo se cumple cada punto del pipeline

```
                    ┌──────────────── ci.yml (en cada PR y otra vez en main) ────────────────┐
 PR ──► lint-y-tipos + unitarias ──► integracion · e2e · imagenes (build)   seguridad (en paralelo)
                    └─────────────────────────────────────────────────────────────────────────┘
                                   │ los 6 jobs son checks obligatorios para mergear
                                   ▼
 merge a main ──► deploy.yml: CI de nuevo ──► QA: deploy + smoke + pruebas de integración
                                          ──► aprobación manual ──► Producción: deploy + smoke ──► tag vX.Y.Z
```

| Pide la consigna | Cómo se cumple |
| --- | --- |
| Cada PR aprobado a la rama principal construye la aplicación | La rama `main` (el "master" de este repo) está protegida: solo se entra por PR, con la rama al día y los 6 checks en verde. Al mergear, `deploy.yml` corre solo: repite el CI sobre el commit exacto que se va a desplegar y construye las imágenes. |
| Correr las pruebas unitarias y mostrar los resultados | Job `unitarias`: pytest (backend) y Vitest (frontend). Publica el check **"Informe · pruebas unitarias"** con cada prueba, una tabla de cobertura en el resumen de la corrida y el informe HTML de cobertura como artefacto. |
| Superadas las unitarias, deploy automático a QA | Los jobs `integracion`, `e2e` e `imagenes` esperan a `lint-y-tipos` y `unitarias` (`needs`). El job **"QA (staging)"** de `deploy.yml` depende de todo el CI y despliega solo, sin intervención. |
| Ejecutar pruebas de integración en QA, con informe | Con la versión nueva ya publicada en QA corren el smoke test y las **pruebas de integración en QA (QA-01 a QA-05)** contra la web, la API, la base y el bucket de ese ambiente. Se publica **"Informe · QA (smoke + integración)"** y el HTML de Playwright como artefacto. Antes, en el CI, ya corrieron las pruebas de integración contra PostGIS real y los E2E en el navegador, cada una con su informe. |
| Aprobación manual para pasar a producción | El job **"Producción"** usa el ambiente `production` de GitHub, que tiene un revisor obligatorio. GitHub frena la corrida hasta que alguien aprueba con "Review deployments". Solo la rama `main` puede desplegar ahí. |
| Si falla una unitaria, se aborta el build y lo que sigue | El job `unitarias` falla, `integracion`, `e2e` e `imagenes` quedan **skipped**, el PR no se puede mergear y, por lo tanto, no se despliega nada. En `main` pasaría lo mismo: QA depende del CI completo. |
| Presentar los casos de prueba | [`docs/casos-de-prueba.md`](docs/casos-de-prueba.md) y la lista completa en cada informe de la corrida. |

### Cómo verlo en GitHub

- **Informes de pruebas:** en la corrida (pestaña *Actions*), el *Summary* muestra una tabla por
  informe. También aparecen como checks con nombre "Informe · ..." en el PR o en el commit, con
  la lista de cada prueba y el detalle de las que fallaron.
- **Artefactos:** `informe-unitarias` (JUnit y cobertura HTML), `informe-e2e` e `informe-qa`
  (informe HTML de Playwright, con trazas si hubo reintentos).
- **Qué versión está en cada ambiente:** `/api/health` responde la versión y el commit. El
  pipeline espera a que QA informe el commit nuevo antes de probar, así nunca prueba la versión
  vieja.

---

## 3. Herramientas: por qué GitHub Actions y Railway

El profesor habilitó usar GitHub Actions y Railway en lugar de Azure DevOps y Azure.

**GitHub Actions**

- El código ya vive en GitHub: PRs, checks, protección de rama y CI/CD en el mismo lugar.
- Los **ambientes** de GitHub (`staging`, `production`) dan lo que pide la consigna sin
  herramientas extra: revisores obligatorios (aprobación manual), secretos por ambiente y
  restricción de ramas.
- Pipeline como código (YAML versionado y revisado por PR). Un **workflow reutilizable**
  (`ci.yml`) corre igual en el PR y en `main`, sin duplicar pasos.
- Minutos gratis para repositorios públicos.

**Railway**

- Un proyecto con **dos ambientes** (staging y production) con los mismos servicios y todo
  separado: base, bucket, variables y dominios.
- Corre los Dockerfiles del repo tal cual. PostGIS es la imagen oficial `postgis/postgis`, la
  misma que usa el CI y el docker-compose local.
- Red privada entre servicios, buckets S3, healthchecks y un comando previo al deploy (las
  migraciones).
- La **infraestructura es código** ([`.railway/railway.ts`](.railway/railway.ts), ADR 0006) y el
  pipeline la aplica en cada despliegue con un CLI de versión fija.
- Alternativas descartadas: con Azure había que armar por separado el registry, el hosting de
  contenedores (ACI o App Service), la base con PostGIS y el almacenamiento, y la cuenta estándar
  pide tarjeta. Render y Fly.io no traen ambientes con base y bucket propios con la misma
  facilidad. Más detalle en los ADR 0002, 0003 y 0006.

---

## 4. El pipeline en detalle

### 4.1 CI (`ci.yml`): en cada PR y antes de cada despliegue

| Job | Qué hace | Corta si... |
| --- | --- | --- |
| `lint-y-tipos` | ruff (lint y formato) y mypy en el backend; ESLint, Prettier y `tsc` en el frontend; `tsc` en los E2E | hay errores de estilo o de tipos |
| `unitarias` | pytest y Vitest con cobertura. Publica el informe y la cobertura | falla una prueba, el dominio del backend queda por debajo de **80 %** o el frontend por debajo de **70 %** |
| `integracion` | pytest contra **PostGIS real** y un **S3 real** (RustFS) levantados como servicios del job | falla una prueba (por ejemplo, una regla que depende de la base) |
| `e2e` | levanta API, web (build de producción), PostGIS y Mailpit, y recorre la app en Chromium con la vista de un celular | falla un recorrido de usuario |
| `imagenes` | **build** de las imágenes Docker de `api` y `web`, las arranca y prueba que la web reenvía `/api` a la API | el Dockerfile no construye o los contenedores no se hablan |
| `seguridad` | gitleaks (secretos en todo el historial), pip-audit y npm audit | aparece un secreto o una vulnerabilidad alta |

`integracion`, `e2e` e `imagenes` dependen de `lint-y-tipos` y `unitarias`: no se gastan
minutos ni se construye nada si lo básico falla. `seguridad` corre en paralelo porque no
depende del código de la app.

### 4.2 CD (`deploy.yml`): en cada push a `main`

1. **CI otra vez**, sobre el commit exacto que se va a desplegar (el resultado de un PR puede
   cambiar después de mergear con otros).
2. **QA (staging)**, automático:
   - aplica la infraestructura (`railway config apply`). Sin `--confirm-destructive`, Railway
     rechaza cualquier cambio que borre recursos;
   - anota la versión (`VERSION`) y el commit en la imagen, y sube `api` y `web` con
     `railway up --ci`;
   - Railway corre `alembic upgrade head` antes de pasarle tráfico a la versión nueva. Si las
     migraciones fallan, sigue la versión anterior;
   - espera hasta que `/health` informe el commit nuevo, corre el smoke test y las pruebas de
     integración en QA, y publica los informes.
3. **Producción**: espera la aprobación manual. Después hace los mismos pasos de despliegue y
   corre solo el smoke test, que no escribe datos.
4. **Tag `vX.Y.Z`**: con producción verificada, crea el tag SemVer a partir del archivo
   `VERSION`. Para publicar una versión nueva se sube `VERSION` en el PR.

**Otras decisiones del CD**

- **Concurrencia por ambiente:** nunca hay dos despliegues al mismo ambiente a la vez, y una
  aprobación pendiente en producción no traba QA. Si quedan dos aprobaciones pendientes, se
  rechaza la vieja y se aprueba la nueva, que ya incluye todo.
- **Continuous Delivery, no Deployment:** producción queda siempre "a un clic" y una persona
  decide cuándo (ADR 0002).
- **Vuelta atrás:** si una versión sale mal, se revierte el commit con un PR y el pipeline
  despliega la anterior. En una urgencia, Railway permite volver a publicar un deployment
  anterior desde su panel.

### 4.3 Gestión de secretos

| Dónde | Qué | Por qué ahí |
| --- | --- | --- |
| Secretos de cada ambiente de GitHub | `RAILWAY_TOKEN` (un token de proyecto distinto por ambiente), `QA_USUARIO_CLAVE` (solo en `staging`) | El job de QA no puede tocar producción con su token. Los secretos no aparecen en los logs. |
| Variables de cada ambiente de GitHub | `RAILWAY_PROJECT_ID`, `WEB_URL`, `API_URL`, `QA_USUARIO_DNI` | No son secretas y cambian por ambiente |
| Variables de Railway | `DATABASE_URL`, `JWT_SECRET` (distinto por ambiente), `RESEND_API_KEY`, credenciales del bucket (por referencia) | Nunca están en el repo. La IaC no las maneja, así no se pueden borrar desde el código. |
| Repositorio | solo `.env.example` | gitleaks revisa todo el historial en cada PR |

---

## 5. Ambientes: QA y producción

Los dos son el **mismo servicio con configuración separada**: dos ambientes de un proyecto de
Railway, descriptos por el mismo `railway.ts`.

| Aspecto | QA (`staging`) | Producción (`production`) | Por qué |
| --- | --- | --- | --- |
| Cuándo se despliega | Automático en cada merge a `main` | Después de la aprobación manual | QA es la última verificación; producción la decide una persona |
| Base y bucket | Propios, con datos de prueba | Propios, con datos reales | Las pruebas de QA nunca tocan datos reales |
| Pruebas después del deploy | Smoke + integración (QA-01 a 05) | Solo smoke (no escribe datos) | Se prueba a fondo antes de producción, sin ensuciar producción |
| Cuenta de prueba | DNI 20999777, solo existe en QA | No existe | Las pruebas de QA no dependen de una persona |
| Secretos | `JWT_SECRET` y token de Railway propios | Distintos | Una sesión de QA no sirve en producción |
| Réplicas y región | 1 réplica, US East | 1 réplica, US East | El plan Hobby no admite multirregión. Escalar es cambiar `replicas` en `railway.ts` |
| Monitoreo | `/health` con versión y commit, logs de Railway | Igual | |

Lo mismo en los dos ambientes: imágenes construidas desde los mismos Dockerfiles, migraciones
antes de publicar, healthcheck, reinicio automático si el proceso se cae y la red privada entre
`web` y `api`.

---

## 6. Estrategia de pruebas

Pirámide de pruebas: muchas unitarias rápidas en la base y pocas pruebas lentas de punta a
punta arriba. Cada prueba lleva, cuando corresponde, el ID del documento de requerimientos
(UT-xx, IT-xx, E2E-xx, RN-xx, CU-xx) para saber qué regla cubre.

| Nivel | Herramienta | Cantidad | Dónde corre | Qué cubre |
| --- | --- | ---: | --- | --- |
| Unitarias backend | pytest | 158 | CI | Reglas de negocio puras (prioridad, estados, geocerca, límites, contraseñas, fotos), sin base |
| Unitarias frontend | Vitest + Testing Library (jsdom) | 95 | CI | Validaciones, componentes y pantallas con la API simulada |
| Integración backend | pytest + TestClient | 71 | CI | Cada endpoint contra PostGIS y S3 reales: SQL, transacciones, roles, migraciones |
| E2E | Playwright (Chromium, vista de celular) | 8 | CI | Recorridos completos de usuario en el navegador, con los emails atrapados en Mailpit |
| Smoke | Playwright | 3 | QA y producción | Que la versión desplegada responde y la web llega a la API |
| Integración en QA | Playwright | 5 | QA | El ambiente real: base, bucket, web, API y roles (sección 2) |

Cantidades al 25/11/2026; la lista exacta sale en el informe de cada corrida.

**Umbrales de cobertura:** 80 % en el dominio del backend (hoy 100 %) y 70 % en el frontend
(hoy ~94 % de líneas). Por debajo, el job falla. La cobertura total del backend se mide aparte
en las unitarias y en las de integración, porque las rutas se prueban contra la base real.

### Qué se simula y qué no (mocks)

| Dependencia | Unitarias | Integración y E2E | Por qué |
| --- | --- | --- | --- |
| Base de datos | No se usa: el dominio es código puro | **Real** (PostGIS en un contenedor) | Las distancias, la geocerca y los `SELECT ... FOR UPDATE` dependen de PostGIS y de PostgreSQL. Un SQLite o un mock no prueba lo que importa. |
| Almacenamiento de fotos (S3) | Implementación en memoria (`AlmacenEnMemoria`) | En memoria, más una prueba contra S3 real (RustFS) | Se reemplaza por inyección de dependencias de FastAPI, sin tocar el código de producción |
| Email (SMTP / Resend) | Clase falsa de SMTP y `urlopen` reemplazado con `monkeypatch` | En memoria (integración) y **Mailpit** (E2E) | Las pruebas nunca mandan emails reales. En E2E el email se lee de Mailpit como lo leería el vecino. |
| Direcciones (Nominatim) | Respuesta simulada | Desactivado (`GEOCODIFICAR=false`) | No depender de un servicio externo con límite de uso |
| API, desde el frontend | `fetch` reemplazado (`simularApi`) | Real | El componente se prueba con el contrato de la API, sin levantar el backend |
| Mapa (WebGL) | Mapa simulado (`VITE_MAPA=simulado`) | Simulado en CI, **real en QA** | jsdom y el CI no tienen WebGL ni red; QA usa el mapa de verdad |

**Política de pruebas inestables:** en CI, Playwright reintenta una vez y guarda la traza del
reintento. Si una prueba sigue fallando, se arregla o se pone en cuarentena con un issue, nunca
se borra.

---

## 7. Flujo de trabajo con Git

- **Trunk-based development:** `main` siempre desplegable y ramas cortas (`feat/...`,
  `fix/...`, `ci/...`, `docs/...`) que vuelven por PR en uno o dos días.
- **Protección de `main`** (ruleset): PR obligatorio, rama al día con `main` y los 6 checks del
  CI obligatorios. Nadie pushea directo a `main`, ni siquiera el dueño.
- **Squash merge:** cada PR queda como un commit en `main`, con un mensaje que explica el cambio.
- **Conventional Commits** (`feat:`, `fix:`, `test:`, `ci:`, `docs:`, `chore:`), en español.
- **Versionado SemVer:** `VERSION` en el repo y tags `v0.1.0`, `v0.2.0`, `v0.3.0`..., que crea
  el pipeline al publicar en producción.
- **Dependabot:** actualizaciones semanales agrupadas. Hasta el final solo se aceptan menores y
  parches; las alertas de seguridad llegan igual.

---

## 8. Decisiones de arquitectura

Resumen; el detalle está en cada ADR.

| # | Decisión | Por qué, en una línea |
| --- | --- | --- |
| [0001](docs/adr/0001-monorepo-con-un-solo-pipeline.md) | Monorepo con un solo pipeline | Frontend y backend cambian juntos. Un PR prueba y despliega los dos en el mismo flujo. |
| [0002](docs/adr/0002-entrega-continua-con-aprobacion-manual.md) | Entrega continua con aprobación manual | QA automático; producción la decide una persona, como pide la consigna |
| [0003](docs/adr/0003-github-actions-despliega-con-el-cli-de-railway.md) | GitHub Actions despliega con el CLI de Railway | El pipeline controla cuándo y qué se despliega, con versión fija del CLI |
| [0004](docs/adr/0004-uv-y-lockfiles-para-dependencias.md) | uv y lockfiles | Builds reproducibles: el CI falla si el lock no coincide |
| [0005](docs/adr/0005-rustfs-como-s3-local.md) | RustFS como S3 local | MinIO dejó de publicar imágenes; RustFS es compatible con S3 y Apache 2.0 |
| [0006](docs/adr/0006-infraestructura-de-railway-como-codigo.md) | Infraestructura como código | Los dos ambientes salen del mismo archivo, revisado por PR |
| [0007](docs/adr/0007-la-web-hace-de-proxy-de-la-api.md) | La web hace de proxy de la API | Cookie de sesión propia (Safari bloquea las de terceros) y sin CORS |
| [0008](docs/adr/0008-mapa-con-openstreetmap.md) | Mapa con OpenStreetMap | Google Maps pedía pago por adelantado; MapLibre y OpenFreeMap son gratis y sin key |

Otras decisiones de diseño:

- **PostGIS para distancias y geocerca:** "similares a menos de 50 m" y "adentro del ejido" se
  resuelven en la base con tipos `geography` (metros reales) e índices espaciales, en lugar de
  calcularlos a mano en Python.
- **Prioridad con logaritmo (RN-04):** `prioridad = gravedad promedio × (1 + log2(vecinos))`.
  Cada vecino que apoya suma, pero cada vez menos. Así 50 vecinos con un problema leve no tapan
  uno urgente. Ejemplo: un semáforo roto con gravedad 9 y 3 vecinos da 23,3. Se recalcula en la
  misma transacción que el apoyo, con `SELECT ... FOR UPDATE`, para que dos apoyos simultáneos
  no se pisen.
- **Base real en las pruebas de integración:** ver la sección 6.
- **Fotos en un bucket privado:** se guardan sin datos EXIF (la ubicación del celular del
  vecino) y se sirven con URLs firmadas que vencen.
- **Cuenta propia con DNI:** el municipio identifica al vecino por DNI. Las contraseñas se
  guardan con Argon2, la sesión va en una cookie `HttpOnly` y hay bloqueo temporal después de
  5 intentos fallidos.

---

## 9. Demostración para la validación

**Cambio pedido en el código**

1. Crear una rama, hacer el cambio, push y abrir el PR.
2. En el PR corre `ci.yml`. Mirar los checks y el informe "Informe · pruebas unitarias".
3. Mergear (squash). En *Actions* arranca `deploy`: CI → **QA (staging)**.
4. Cuando QA termina: abrir la URL de QA y ver el cambio. `/api/health` muestra el commit
   nuevo. En el *Summary* de la corrida están "Informe · QA (smoke + integración)" y el
   artefacto `informe-qa`.
5. La corrida queda en *Waiting*: **Review deployments** → `production` → **Approve and
   deploy**. Corre el smoke de producción y el cambio se ve en la URL de producción.

**Cambio que rompe una prueba unitaria**

1. Cambiar el valor esperado de una prueba, por ejemplo en
   `backend/tests/unit/test_prioridad.py`, y abrir el PR.
2. `unitarias` falla (el informe muestra cuál y por qué). `integracion`, `e2e` e `imagenes`
   quedan **skipped**: no se construye nada.
3. El botón de merge queda bloqueado por los checks obligatorios, así que no hay deploy a QA ni
   a producción.

---

## 10. Limitaciones conocidas

- **Una réplica por servicio en los dos ambientes:** es el límite del plan usado. La
  configuración para más réplicas ya está en `railway.ts`.
- **Sin registry externo de imágenes:** Railway construye y guarda cada imagen a partir del
  Dockerfile, y cada deployment queda inmutable y se puede volver a publicar. El CI construye y
  prueba las mismas imágenes en el job `imagenes`. Publicarlas además en GHCR con tag por
  versión es una mejora posible.
- **Emails:** sin dominio propio, Resend solo entrega al email de la cuenta de Resend. Alcanza
  para la demo, no para vecinos reales.
- **Datos de prueba en QA:** cada despliegue deja en QA un reclamo de prueba, ya rechazado, así
  no aparece en la cola del Tablero.
- **Recortes de alcance:** las funciones que el plan recortó para llegar al final (por ejemplo,
  la pantalla de usuarios municipales, que se reemplaza por un script) están anotadas en el
  documento de requerimientos. Si algo se atrasaba, se recortaba app, nunca pipeline ni pruebas.

---

## 11. Uso de inteligencia artificial

Usé **Claude Code** (Anthropic) como asistente de programación durante todo el proyecto, como
habilita la cátedra:

- **Qué hizo la IA:** propuso y escribió la mayor parte del código, los workflows, las pruebas
  y la documentación a partir de mis requerimientos, y ayudó a diagnosticar errores del
  pipeline y de Railway.
- **Qué hice yo:** definí la aplicación y sus requerimientos (casos de uso, reglas de negocio,
  plan por etapas), tomé las decisiones cuando había alternativas (por ejemplo, descartar
  Google Maps, el título automático del reclamo), creé y configuré las cuentas (GitHub,
  Railway, Resend), revisé y mergeé cada PR y aprobé cada pase a producción.
- **Cómo lo verifiqué:** ningún cambio entra a `main` sin pasar el CI completo. Revisé cada
  funcionalidad en QA antes de aprobarla, y cada decisión importante quedó escrita con sus
  alternativas (ADR) para poder defenderla.
