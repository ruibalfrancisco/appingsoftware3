# 0002 · Entrega continua con aprobación manual

- **Estado:** aceptada · 2026-11-22

## Contexto

Los cambios en producción los ven vecinos reales. Al principio del proyecto la batería de
pruebas todavía es chica.

## Decisión

Continuous Delivery: cada merge a `main` se despliega solo a staging, corre el smoke test y
queda esperando que un revisor apruebe en el ambiente `production` de GitHub. Producción queda
siempre a un clic.

## Alternativas descartadas

- **Continuous Deployment (sin humano):** cada merge llegaría a producción. Se puede adoptar
  quitando la regla "Required reviewers" del ambiente cuando las pruebas den confianza.

## Consecuencias

- Hay un punto de control humano antes de producción, auditado en la pestaña Actions.
- El tiempo hasta producción depende de que alguien apruebe.
- El workflow ya es el de despliegue continuo: pasar de uno a otro es cambiar una regla, no
  código.
