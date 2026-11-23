# 0007 · La web hace de proxy de la API

- **Estado:** aceptada · 2026-11-22

## Contexto

RNF-07 pide la sesión en una cookie httpOnly. La web y la api son dos servicios de Railway con
dominios distintos (`web-….up.railway.app` y `api-….up.railway.app`), y `up.railway.app` es un
sufijo público: para el navegador son dos sitios diferentes. Una cookie de la api sería de
terceros, y Safari y Firefox las bloquean por defecto. El login no funcionaría en iPhone, que
es un requisito (RNF-11: iOS 16+).

## Decisión

El nginx del servicio web reenvía `/api/*` a la api por la red privada de Railway
(`http://api.railway.internal:8080`, configurado en la variable `API_INTERNAL_URL`). El
navegador solo habla con el dominio de la web: la cookie de sesión es propia (`SameSite=Lax`)
y no hace falta CORS. En desarrollo, el proxy de Vite hace lo mismo hacia `localhost:8000`.

La api conserva su dominio público para el healthcheck y el smoke test.

## Alternativas descartadas

- **Cookie `SameSite=None` entre dominios:** sigue siendo de terceros; Safari la bloquea.
- **Token en `localStorage` con encabezado Authorization:** queda accesible desde JavaScript,
  justo lo que RNF-07 quiere evitar.
- **Dominio propio con subdominios `app.` y `api.`:** funcionaría (mismo sitio), pero depende de
  comprar y configurar un dominio antes del final.
- **Un solo servicio que sirva la web y la api:** rompe la separación de despliegues y escalado.

## Consecuencias

- Un salto más (nginx) en cada pedido a la api, dentro de la red privada de Railway.
- El job `imagenes` del CI prueba la misma topología con una red de Docker, y el smoke test
  verifica `/api/health` a través de la web en cada ambiente.
- La variable `API_INTERNAL_URL` del servicio web tiene que existir en cada ambiente.
