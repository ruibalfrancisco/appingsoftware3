# Casos de prueba

Los casos definidos en el documento de requerimientos (UT, IT, E2E) más los que corren contra
los ambientes desplegados (smoke y QA). Cada fila dice qué se prueba, qué se espera y en qué
prueba automatizada está. La lista completa de pruebas, con su resultado, sale en el informe
de cada corrida del pipeline ("Informe · ...").

| Nivel | Cantidad | Dónde corre | Informe en el pipeline |
| --- | ---: | --- | --- |
| Unitarias (backend + frontend) | 158 + 95 | CI, en cada PR y en `main` | Informe · pruebas unitarias |
| Integración (API + PostGIS + S3) | 71 | CI | Informe · pruebas de integración (API + PostGIS + S3) |
| E2E en el navegador | 8 | CI | Informe · pruebas E2E (navegador) |
| Smoke | 3 | QA y producción, después de cada deploy | Informe · QA (smoke + integración) / Informe · producción (smoke) |
| Integración en QA | 5 | QA, después de cada deploy | Informe · QA (smoke + integración) |

Rutas: las de backend son relativas a `backend/tests/`, las de frontend a `frontend/src/` y
las de Playwright a `e2e/tests/`.

---

## Unitarias

Reglas de negocio aisladas, sin base de datos ni red.

| ID | Caso | Resultado esperado | Prueba |
| --- | --- | --- | --- |
| UT-01 | Prioridad de un reclamo con 1 vecino (RN-04) | Es igual a su gravedad | `unit/test_prioridad.py::test_ut01_con_un_vecino_la_prioridad_es_su_gravedad` |
| UT-02 | 12 vecinos con gravedad 6 (RN-04) | Prioridad 27,5 | `unit/test_prioridad.py::test_ut02_doce_vecinos_con_gravedad_6_da_27_5` |
| UT-03 | Dos reclamos con la misma prioridad (RN-04) | Va primero el más antiguo | `unit/test_prioridad.py::test_ut03_a_igual_prioridad_va_primero_el_mas_antiguo` |
| UT-04 | Gravedad 0, 11, decimal o de otro tipo (RN-03) | Se rechaza | `unit/test_gravedad.py::test_ut04_rechaza_fuera_de_rango_decimales_y_otros_tipos` |
| UT-05 | Cada transición de estado permitida y prohibida, por ejemplo Resuelto → Pendiente (RN-05) | Las del diagrama pasan; las demás fallan | `unit/test_estados.py::test_ut05_solo_pasan_las_transiciones_del_diagrama`, `::test_ut05_resuelto_a_pendiente_falla` |
| UT-06 | Punto en el centro de Villa Allende, en Córdoba capital y sobre el borde del ejido (RN-06) | Válido, inválido y válido | `unit/test_geocerca.py::test_ut06_puntos_dentro_del_ejido`, `::test_ut06_puntos_fuera_del_ejido`, `::test_ut06_un_punto_sobre_el_borde_es_valido` |
| UT-07 | DNI con 6, 7, 8 y 9 dígitos, con puntos y con letras (RN-09) | Acepta 7 u 8 dígitos (con o sin puntos); rechaza el resto | `unit/test_identidad.py::test_ut07_dni_valido`, `::test_ut07_dni_invalido` |
| UT-08 | Etiqueta de la gravedad en la pantalla | 3 es Leve, 7 es Grave, 10 es Urgente | `dominio/gravedad.test.ts` ("UT-08 etiqueta de gravedad") |
| UT-09 | El asistente para cargar un reclamo | No avanza sin foto ni con el pin fuera de Villa Allende | `paginas/reclamos.test.tsx` ("UT-09 sin foto no avanza", "UT-09 y CU-04 4a...") |

Otras unitarias importantes:

| Caso | Resultado esperado | Prueba |
| --- | --- | --- |
| 5 ingresos fallidos en 15 minutos (CU-03) | Bloquea la cuenta 15 minutos; 4 no bloquean y los fallos viejos no cuentan | `unit/test_cuentas.py::test_cu03_*` |
| Cómo se guardan las contraseñas (RNF-07) | Hash Argon2, nunca en texto | `unit/test_seguridad.py::test_rnf07_las_contraseñas_se_guardan_con_argon2` |
| Sesión adulterada o vieja | No sirve | `unit/test_seguridad.py::test_una_sesion_adulterada_no_sirve`, `::test_sesiones_invalidas` |
| Foto subida por el vecino (RN-10) | Se guarda sin EXIF, achicada a 1600 px y en JPEG | `unit/test_fotos.py::test_rn10_*` |
| A quién se avisa un cambio de estado (RN-07) | Al creador y a quienes apoyaron, sin repetir y sin avisarle al autor del cambio | `unit/test_gestion.py::test_rn07_*` |
| Límite de 5 reclamos por día (RN-08) | El día es el de Córdoba, no el de UTC | `unit/test_reclamos_dominio.py::test_rn08_*` |
| Similares (RN-01) | Radio de 50 m y como máximo 5 | `unit/test_apoyos.py::test_rn01_radio_de_50_metros_y_hasta_5_similares` |
| Pantallas del back office (frontend) | Un vecino no ve el Tablero; un reclamo cerrado no ofrece cambios | `paginas/gestion.test.tsx` |
| Error del backend en un formulario (CU-01 3a) | Se muestra sin perder lo cargado | `paginas/paginas.test.tsx` |

---

## Integración

La API (FastAPI con `TestClient`) contra **PostgreSQL + PostGIS real** y, en las pruebas de
fotos, un **S3 real** (RustFS). Cada prueba arranca con la base vacía y las migraciones
aplicadas.

| ID | Caso | Resultado esperado | Prueba |
| --- | --- | --- | --- |
| IT-01 | Crear un reclamo | Queda Pendiente, con 1 apoyo del creador y la prioridad calculada | `integracion/test_reclamos_api.py::test_it01_crear_reclamo_queda_pendiente_con_el_creador_como_primer_apoyo` |
| IT-02 | Buscar similares (RN-01) | Devuelve uno a 49 m y no uno a 51 m; ignora otros tipos y los cerrados | `integracion/test_apoyos_api.py::test_it02_similares_a_49_m_si_a_51_m_no_ni_otros_tipos_ni_cerrados` |
| IT-03 | Apoyar dos veces el mismo reclamo (RN-02) | 409 y la base no suma | `integracion/test_apoyos_api.py::test_it03_apoyar_dos_veces_responde_409_y_la_base_no_suma` |
| IT-04 | Apoyar el propio reclamo (RN-02) | 409 | `integracion/test_apoyos_api.py::test_it04_apoyar_el_propio_reclamo_responde_409` |
| IT-05 | Crear un reclamo fuera del ejido aunque el frontend lo deje (RN-06) | 422 | `integracion/test_reclamos_api.py::test_it05_fuera_del_ejido_responde_422_aunque_el_frontend_lo_permita` |
| IT-06 | Sexto reclamo del día (RN-08) | 429 | `integracion/test_reclamos_api.py::test_it06_el_sexto_reclamo_del_dia_responde_429` |
| IT-07 | Un vecino intenta entrar al back office o cambiar un estado | 403 | `integracion/test_gestion_api.py::test_it07_un_vecino_no_entra_al_back_office_ni_cambia_estados` |
| IT-08 | Cada cambio de estado (RN-07) | Genera una novedad para el creador y para cada vecino que apoyó. Los avisos por email se recortaron (RF-21); las novedades quedan en la app. | `integracion/test_gestion_api.py::test_it08_cada_cambio_genera_novedades_para_el_creador_y_los_que_apoyaron` |
| IT-09 | Foto guardada y respuestas públicas (RNF-08) | La foto no tiene EXIF y el detalle no expone DNI ni email | `integracion/test_reclamos_api.py::test_it09_la_foto_guardada_no_tiene_exif_y_el_detalle_no_expone_datos_personales` |
| IT-10 | Migraciones de Alembic sobre una base vacía | Suben y bajan sin errores | `integracion/test_migraciones.py::test_it10_las_migraciones_suben_y_bajan_sin_errores` |

Otras pruebas de integración importantes:

| Caso | Resultado esperado | Prueba |
| --- | --- | --- |
| Registro, verificación por email y sesión (CU-01, CU-02) | El enlace sirve una sola vez y vence a las 24 horas | `integracion/test_cuentas_api.py::test_cu01_cu02_*`, `::test_cu02_*` |
| Ingreso con datos incorrectos (CU-03) | Mensaje genérico, sin revelar si existe la cuenta | `integracion/test_cuentas_api.py::test_cu03_credenciales_incorrectas_con_mensaje_generico` |
| Recuperar la contraseña (CU-11) | No revela si la cuenta existe; cambiar la clave cierra las otras sesiones | `integracion/test_cuentas_api.py::test_cu11_*` |
| Ejemplo de la tabla de RN-04 | Semáforo roto con 3 vecinos y gravedad 9 da 23,3 | `integracion/test_apoyos_api.py::test_rn04_tabla_semaforo_roto_3_vecinos_con_gravedad_9_da_23_3` |
| Tablero municipal (CU-07) | De mayor a menor prioridad; filtra por tipo, estado, área y fecha | `integracion/test_gestion_api.py::test_cu07_*` |
| Recorrido del back office (CU-08) | Pendiente → En revisión → En proceso → Resuelto, con la foto del después | `integracion/test_gestion_api.py::test_cu08_recorrido_completo_hasta_resuelto_con_foto_del_despues` |
| Transición no permitida (RN-05) | 409 | `integracion/test_gestion_api.py::test_rn05_transiciones_no_permitidas_responden_409` |
| Fotos en un bucket S3 real | Se guardan y se leen del bucket; la URL que se entrega está firmada | `integracion/test_reclamos_api.py::test_las_fotos_van_a_un_bucket_s3_real` |
| Modelos de SQLAlchemy y migraciones | Coinciden (no falta ninguna migración) | `integracion/test_migraciones.py::test_los_modelos_coinciden_con_las_migraciones` |

---

## End-to-end (en el CI)

Playwright con Chromium en la vista de un celular (Pixel 7), contra la app levantada en el CI:
build de producción de la web, API, PostGIS y Mailpit, que atrapa los emails.

| ID | Recorrido | Resultado esperado | Prueba |
| --- | --- | --- | --- |
| E2E-01 | Registro, verificación con el email que llega a Mailpit e ingreso (CU-01 a CU-03) | El vecino queda con la sesión iniciada | `e2e/cuentas.spec.ts` |
| E2E-02 | Crear un reclamo completo: tipo, foto, ubicación, detalles y confirmación (CU-04) | Se crea en menos de 60 segundos (RNF-01) | `e2e/reclamos.spec.ts` |
| E2E-03 | Encontrar un reclamo similar y apoyarlo (CU-05) | Suma el apoyo y sube la prioridad | `e2e/reclamos.spec.ts` |
| E2E-04 | La operadora lo resuelve con la foto del después y el vecino ve el resultado (CU-07, CU-08) | El vecino ve "Resuelto", el comentario y la foto. La bandeja de Novedades llega en la etapa 6. | `e2e/gestion.spec.ts` |
| E2E-05 | El pin fuera de Villa Allende (CU-04 4a) | No deja confirmar la ubicación | `e2e/reclamos.spec.ts` |
| E2E-06 | Accesibilidad con axe en las pantallas principales (RNF-06) | Pendiente (etapa de pulido) | — |

También: recuperar la contraseña desde el email (CU-11), "Mis reclamos" con la ubicación en la
lista y en el mapa, y un vecino que entra a `/tablero` ve que es solo para personal municipal.
E2E-07 (regresión visual) quedó fuera por el recorte del plan.

---

## Smoke (QA y producción)

Después de cada despliegue, contra el ambiente recién publicado. No escriben datos, por eso
corren también en producción.

| Caso | Resultado esperado | Prueba |
| --- | --- | --- |
| `/health` de la API | `ok`, con la versión y **el commit que se acaba de desplegar** | `smoke/sistema.spec.ts` |
| `/api/health` a través de la web | La web reenvía a la API por la red privada | `smoke/sistema.spec.ts` |
| La web carga | Muestra la pantalla de inicio y "API conectada" | `smoke/sistema.spec.ts` |

---

## Integración en QA

Después de desplegar en QA (staging), contra el ambiente real: web en Railway, proxy `/api`,
API, base PostGIS con las migraciones aplicadas y bucket de fotos. Usan una cuenta de personal
municipal que existe solo en QA. Si alguna falla, el pipeline no ofrece el pase a producción.

| ID | Caso | Resultado esperado | Prueba |
| --- | --- | --- | --- |
| QA-01 | Catálogo de tipos de reclamo | La base de QA tiene las migraciones y los tipos semilla (Bache, Luminaria rota, Semáforo roto...) | `qa/integracion.spec.ts` |
| QA-02 | Pedir datos privados sin sesión | `/reclamos/mios` y `/gestion/reclamos` responden 401 | `qa/integracion.spec.ts` |
| QA-03 | Ingreso con datos incorrectos desde la web | La web muestra el error que manda la API ("DNI, email o contraseña incorrectos") y no navega | `qa/integracion.spec.ts` |
| QA-04 | Ingreso del personal municipal desde la web | Llega al Tablero con la cantidad de reclamos de la base de QA | `qa/integracion.spec.ts` |
| QA-05 | Recorrido completo | Carga un reclamo con foto, la foto se baja del bucket con la URL firmada, el reclamo aparece en el Tablero, se rechaza desde la web con el motivo y el estado y el historial quedan en la base | `qa/integracion.spec.ts` |

QA-05 respeta el límite de 5 reclamos por día (RN-08). Si la cuenta de prueba ya lo alcanzó
(muchos despliegues el mismo día), la prueba se saltea y el motivo aparece en el informe.
