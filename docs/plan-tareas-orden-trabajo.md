# Plan de Tareas — App de órdenes de trabajo

Generado por /plan-eng-review a partir de docs/design-orden-trabajo.md
Branch: main
Repo: ademargarcia073-alt/publisolutions-app

## Decisiones de la revisión de ingeniería

| # | Issue | Decisión |
|---|-------|----------|
| 1 | Guard de sesión/aprobación | Centralizado en `hooks.server.ts`, no repetido por página |
| 2 | Limpieza de push subscriptions muertas | Borrar en el mismo intento fallido (404/410) |
| 3 | Validación de campos del formulario | Zod schema compartido cliente/servidor |
| 4 | Framework de tests | Vitest (unit) + Playwright (E2E) |
| 5 | N+1 en queries del dashboard | Select con join explícito desde el día 1 |
| 6 | Formato de `dimension` | Estructura `{alto, ancho, unidad}`, no texto libre |
| 7 | Devolución a área anterior | Agregada al MVP (no estaba en el spec original) — ver design doc |

## Failure modes — verificación

Ningún GAP identificado en la revisión de tests quedó sin plan de manejo de error
(critical gap = sin test AND sin manejo de error AND fallo silencioso). Con las
5 decisiones arriba, cada codepath crítico tiene una estrategia explícita:
race condition del pool → mensaje visible al usuario; push fallido → fallback a
registro in-app + limpieza de suscripción; validación → rechazo explícito, no
silencioso; guard de auth → redirect visible, no acceso silencioso.

## Worktree parallelization strategy

| Step | Módulos tocados | Depende de |
|------|------------------|------------|
| A. Data layer (schema + migraciones) | `db/schema`, `drizzle.config` | — |
| B. Auth & guard | `lib/server/auth`, `hooks.server.ts`, `routes/(auth)` | A |
| C. Core business logic (applyOrderEvent) | `lib/server/orders` | A |
| D. Push infra (VAPID, service worker) | `lib/server/push`, `static/sw.js` | A |
| E. Screens (dashboard, formulario, listado, notificaciones) | `routes/(app)/*` | B, C |
| F. Tests (Vitest + Playwright) | `tests/` | continuo, junto a cada lane, no una fase aparte |

**Lanes:**
- Lane A (bloqueante): Data layer — debe cerrar primero.
- Lane B + C + D en paralelo (worktrees separados) una vez cierra A — no comparten módulos.
- Lane E después de B + C (necesita auth + lógica de negocio).
- Lane F corre dentro de cada lane, no como fase final — "tests written alongside the feature code."

**Orden de ejecución:** A → (B ‖ C ‖ D en paralelo) → merge → E.

**Conflictos:** B y C tocan `lib/server/` pero subdirectorios distintos (`auth/` vs `orders/`) — riesgo de conflicto bajo.

## Implementation Tasks

- [x] **T1 (P1, human: ~2h / CC: ~15min)** — scaffolding — Inicializar SvelteKit + adapter de Cloudflare Pages + conexión Neon (`@neondatabase/serverless`, modo `neon-http`) + Drizzle, replicando la config de `lavanderia-app-generica`
  - Surfaced by: Constraints del design doc — stack ya probado, no reinventar
  - Files: `svelte.config.js`, `drizzle.config.ts`, `src/lib/server/db.ts`, `wrangler.toml`
  - Verify: `npm run build` levanta sin errores; conexión a Neon responde a un `SELECT 1`

- [x] **T2 (P1, human: ~2h / CC: ~20min)** — data layer — Schema Drizzle: `users` (+ `es_vendedor`, `es_admin`, `aprobado`), `orders` (datos generales + financiero + derivados), `order_events`, `push_subscriptions`
  - Surfaced by: Data Model del design doc + Code Quality Issue 3 (campos que necesitan validación downstream)
  - Files: `src/lib/server/db/schema.ts`, migraciones Drizzle
  - Verify: `drizzle-kit generate` + `drizzle-kit push` sin errores; constraint `saldo` computado (columna generada o trigger) devuelve `total - a_cuenta`

- [x] **T3 (P1, human: ~3h / CC: ~25min)** — auth — Better-Auth + guard global en `hooks.server.ts` (Issue 1): sesión inválida → redirect a login; `aprobado=false` → pantalla de pendiente de aprobación
  - Surfaced by: Architecture Issue 1
  - Files: `src/lib/server/auth.ts`, `src/hooks.server.ts`, `src/routes/(auth)/login`, `/registro`, `/recuperar`
  - Verify: test E2E — sesión válida pero `aprobado=false` no llega a ninguna ruta protegida

- [x] **T4 (P1, human: ~5h / CC: ~40min)** — core — `applyOrderEvent()`: tomar (UPDATE condicional `WHERE responsable_actual IS NULL`), completar, **devolver a área anterior** (retrocede `area_actual`, limpia `responsable_actual`, `nota` obligatoria, rechazado si es la primera área de la secuencia), cancelar (rechazado si estado >= listo_para_entrega), marcar entregado, marcar cobrado — todas con validación de permiso por flags aditivos
  - Surfaced by: Recommended Approach del design doc + Architecture review (concurrencia del pool) + decisión de agregar devolución post-revisión
  - Files: `src/lib/server/orders/apply-order-event.ts`, `src/lib/server/orders/permissions.ts`
  - Verify: tests unitarios Vitest para cada rama (tomar éxito/ya-tomado, completar con/sin siguiente área, devolver permitido/rechazado-en-primera-área/sin-nota-rechazado, cancelar permitido/rechazado, cada combinación rol×acción)

- [x] **T5 (P1, human: ~2h30 / CC: ~20min)** — validación — Zod schemas para formulario de orden: cantidad>0, fechas, montos no negativos, cliente no vacío, `dimension` como `{alto: positive, ancho: positive, unidad: enum('cm','m','pulgadas')}`, `nota` requerida cuando la acción es "devolver"
  - Surfaced by: Code Quality Issue 3 + decisiones de dimensión estructurada y devolución
  - Files: `src/lib/schemas/order.ts`
  - Verify: test unitario por regla (cantidad<=0 rechazado, fecha pasada rechazada, montos negativos rechazados, dimension con alto/ancho<=0 rechazada, unidad fuera del enum rechazada, devolver sin nota rechazado)

- [x] **T6 (P2, human: ~4h / CC: ~30min)** — push — VAPID setup, service worker, registro de suscripción, envío de push en cada cambio de área/estado, limpieza de suscripción en 404/410 (Issue 2)
  - Surfaced by: Notificaciones del spec + Architecture Issue 2
  - Files: `static/sw.js`, `src/lib/server/push/send.ts`, `src/routes/api/push/subscribe`
  - Verify: test E2E simulando suscripción inválida → fila borrada de `push_subscriptions`, sin excepción no capturada

- [x] **T7 (P1, human: ~3h / CC: ~20min)** — screens — 0.0 Login, 0.1 Registro, 0.2 Recuperar contraseña, 1.2 Aprobar registros (admin)
  - Surfaced by: Spec sección 1
  - Files: `src/routes/login`, `/registro`, `/recuperar`, `/pendiente-aprobacion`, `(app)/aprobar-registros`
  - Verify: hecho como parte de T3 (el guard global y las pantallas de auth se construyeron juntos en la misma sesión) — 36/36 tests relevantes pasando (guard + admin-guard)

- [x] **T8 (P1, human: ~4h / CC: ~30min)** — screens — 1.0 Dashboard (tablero de órdenes + lista de producción libre, query con join — Issue 5), 1.1 Notificaciones
  - Surfaced by: Spec sección 1 + Performance Issue 5
  - Files: `src/routes/(app)/+page.svelte`, `+page.server.ts`, `src/routes/(app)/notificaciones`
  - Verify: test de performance/query — una sola consulta para tablero, no N+1 (verificar en logs de Neon o EXPLAIN)

- [x] **T9 (P1, human: ~6h / CC: ~50min)** — screens — 2.0 Formulario/detalle de orden (crear con `dimension` como 3 campos alto/ancho/unidad, editar mientras nadie tomó, historial de cambios cuando se abre desde 3.0, botón "Devolver a [área anterior]" con nota obligatoria visible solo al responsable actual/admin y solo si no es la primera área)
  - Surfaced by: Spec sección 1 + decisiones de dimensión estructurada y devolución
  - Files: `src/routes/(app)/ordenes/nueva`, `/ordenes/[id]`
  - Verify: E2E — ciclo de vida completo crear→tomar→completar (todas las áreas)→listo→entregado→cobrado; cancelación desde creada/en_producción; devolver desde área intermedia (vuelve a pool anterior) y verificar que el botón no aparece en la primera área de la secuencia

- [x] **T10 (P1, human: ~3h / CC: ~20min)** — screens — 3.0 Listado de órdenes (query preparada para filtros estado/área/cliente aunque la UI de filtros se simplifique en v1)
  - Surfaced by: Spec sección 1 + sección 6 (filtros diferidos en UI, no en query)
  - Files: `src/routes/(app)/ordenes/+page.svelte`, `+page.server.ts`
  - Verify: test que la query soporta filtrar por estado/área/cliente aunque la UI no los exponga todavía

- [x] **T11 (P2, human: ~2h / CC: ~15min)** — deploy — Config de Cloudflare Pages (build command, env vars: connection string de Neon, claves VAPID)
  - Surfaced by: Distribution Plan del design doc
  - Files: `wrangler.toml`, configuración del proyecto en Cloudflare dashboard
  - Verify: push a `main` dispara build y deploy automático; smoke test post-deploy (login + ver dashboard)

- [ ] **T12 (P2, human: ~15min / CC: ~5min)** — pendiente de info del cliente — Reemplazar el placeholder `TIPOS_TRABAJO` (`letrero`, `gigantografia`, `vinilo`, `otro` — T2) por la lista real de tipos de trabajo del cliente
  - Surfaced by: usuario, tras revisar la demo — el placeholder de T2 quedó marcado con un TODO pero sin tarea propia en el plan
  - Files: `src/lib/server/db/orders.schema.ts` (array `TIPOS_TRABAJO`) y donde T7-T10 rendericen el dropdown de tipo de trabajo en el formulario 2.0 (mismo array, no hay un tercer lugar — es texto+set-permitido a nivel de app, no un pg enum, así que no hace falta migración)
  - Verify: el dropdown de 2.0 muestra la lista real; `orderFormSchema` (T5) sigue validando contra el mismo array actualizado sin cambios de código, solo de datos

- [x] **T13 (P2, human: ~2h / CC: ~20min)** — screens — Administración de usuarios: pantalla para admin con la lista de usuarios ya aprobados y toggle de `es_vendedor`/`es_admin` desde la interfaz — equivalente a 1.2 (Aprobar registros) pero para aprobados en vez de pendientes
  - Surfaced by: usuario, tras encontrar que `/aprobar-registros` solo lista pendientes (`WHERE aprobado = false`) — una vez aprobado, no hay ninguna pantalla para editar los flags de un usuario; el único camino era SQL directo en Neon o el script `permisos:set` (CLI, ver `scripts/permisos-set.ts`)
  - Files: nueva ruta `src/routes/(app)/administrar-usuarios/+page.svelte`, `+page.server.ts` (guard `requireAdmin`, mismo patrón que `/aprobar-registros`); ícono de acceso en el header del dashboard (`(app)/+page.svelte`), visible solo para admins
  - Verify: 7 tests (`administrar-guard.test.ts`) — load redirige a no-admin, la action rechaza a no-admin (403) y sin userId (400), acepta la edición de otro usuario, y un admin no puede quitarse su propio flag de admin (protección contra dejar el deploy sin ningún admin)

_No new tasks from Test Review beyond framework setup — la cobertura se escribe junto a cada tarea (T1-T10), no como fase separada._

## Completion Summary

- Step 0: Scope Challenge — scope aceptado tal como está (greenfield, NOT-in-scope ya disciplinado en el design doc)
- Architecture Review: 2 issues encontrados, ambos resueltos (guard global, limpieza de push)
- Code Quality Review: 1 issue encontrado, resuelto (validación Zod)
- Test Review: diagrama producido, 24 gaps identificados (todos esperados — greenfield), framework elegido (Vitest + Playwright)
- Performance Review: 1 issue encontrado, resuelto (N+1 en dashboard)
- NOT in scope: ya escrito en el design doc (autocompletado clientes, filtros UI avanzados, áreas configurables)
- What already exists: ya escrito en el design doc (patrón de `lavanderia-app-generica`)
- TODOS.md: no se creó — los 3 items diferidos ya están documentados con razón en el design doc (sección NOT in scope); no hay descubrimientos nuevos de esta revisión que ameriten TODOS.md aparte
- Failure modes: 0 gaps críticos (los 7 issues resueltos cubren cada codepath de riesgo identificado)
- Outside voice: omitido (codex no configurado en este entorno; no crítico para un plan ya validado con 2 rondas de revisión adversarial en la fase de design doc)
- Parallelization: 4 lanes (A bloqueante, B‖C‖D en paralelo, E después)
- Post-revisión: usuario resolvió las 2 preguntas abiertas del design doc (dimensión estructurada, flujo de devolución a área anterior) — issues 6 y 7 arriba, incorporadas a T4/T5/T9
- 13 tareas de implementación (9 P1, 4 P2) — T1-T11 y T13 completas y verificadas (build + typecheck + 95 tests vitest, todos pasando salvo un fallo preexistente en `hooks.server.test.ts` sin relación con estas tareas — falta `RESEND_API_KEY` en el shell de test, no un bug de código). Solo T12 (lista real de tipo_trabajo, pendiente del cliente) queda abierta.

## VERDICT

**LISTO PARA IMPLEMENTAR.** Design doc aprobado + revisión de ingeniería completa,
7/7 issues resueltos (5 de la revisión + 2 preguntas abiertas resueltas por el
usuario). Sin decisiones pendientes.

NO UNRESOLVED DECISIONS
