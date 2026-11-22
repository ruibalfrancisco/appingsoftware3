# 0001 · Monorepo con un solo pipeline

- **Estado:** aceptada · 2026-11-22

## Contexto

La app tiene dos servicios (web y api) que cambian juntos: casi toda funcionalidad nueva toca
un endpoint y la pantalla que lo usa. El equipo es una sola persona y el plazo, dos semanas.

## Decisión

Un solo repositorio con `frontend/`, `backend/`, `e2e/` e `infra/`, y un solo pipeline que
prueba y despliega los dos servicios en el mismo flujo.

## Alternativas descartadas

- **Un repositorio por servicio:** cada uno con su pipeline. Un cambio que cruza los dos
  necesitaría dos PR coordinados y versiones compatibles entre sí.

## Consecuencias

- Un cambio de frontend y backend se prueba y se despliega junto, con un solo PR.
- El smoke test valida la combinación exacta que quedó publicada.
- El CI corre todo aunque el cambio toque un solo lado; con este tamaño de proyecto son pocos
  minutos y simplifica los checks obligatorios.
