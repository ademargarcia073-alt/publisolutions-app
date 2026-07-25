# publisolutions-app

App de órdenes de trabajo (señalética/impresiones) — digitaliza el proceso en
papel del cliente. Ver `docs/spec-original.md` (spec del cliente),
`docs/design-orden-trabajo.md` (design doc) y `docs/plan-tareas-orden-trabajo.md`
(plan de tareas de implementación) para el contexto completo.

Stack: SvelteKit + Cloudflare Pages + Neon (Postgres, `neon-http`) + Drizzle +
Better-Auth + Web Push.

## Desarrollo

```bash
bun install
cp .env.example .env   # completar DATABASE_URL, BETTER_AUTH_SECRET, etc.
bun run db:push        # aplica el schema a la base de Neon
bun run dev
```

### Notificaciones push (Web Push / VAPID)

Generar el par de claves una sola vez por deploy (`web-push` ya está
instalado como dependencia, así que `bunx` lo encuentra sin instalar nada
extra):

```bash
bunx web-push generate-vapid-keys
```

Completar en `.env`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (las que imprime
el comando de arriba) y `VAPID_SUBJECT` (un `mailto:` de contacto — lo exige
el protocolo Web Push, no es configuración de esta app). Sin estas tres
variables, `sendPushToUser` falla explícitamente en vez de enviar push a
medias.

## Deploy

### 1. Neon (base de datos)

1. Crear un proyecto en [Neon](https://neon.tech) (o reusar el de
   `lavanderia-app-generica` si el cliente comparte infraestructura — en ese
   caso, una base nueva dentro del mismo proyecto Neon alcanza).
2. Copiar el connection string que da Neon — sirve tal cual para
   `@neondatabase/serverless` en modo `neon-http`, sin parámetros extra.
3. Con `DATABASE_URL` apuntando a esa base (local, `.env` — nunca commiteado):
   ```bash
   bun run db:push
   ```
   Crea las 9 tablas (`user`, `session`, `account`, `verification` de
   Better-Auth + `user_permissions`, `orders`, `order_events`,
   `push_subscriptions`, `notifications` de la app). Correrlo de nuevo
   después de cualquier cambio de schema es seguro (`drizzle-kit push` es
   idempotente).

### 2. Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git
   → elegir este repo (`ademargarcia073-alt/publisolutions-app`), rama `main`.
2. Build settings:
   - **Build command:** `bun run build`
   - **Build output directory:** `.svelte-kit/cloudflare` (ya está en
     `wrangler.jsonc` como `pages_build_output_dir` — Cloudflare lo autodetecta,
     pero conviene confirmarlo si el wizard lo pide a mano).
   - **Root directory:** `/` (raíz del repo).
3. Settings → Environment variables (cargar para Production **y** Preview) —
   los nombres exactos están en `.env.example`:
   - `DATABASE_URL` — el connection string de Neon del paso 1.
   - `ORIGIN` — la URL pública del deploy (`https://<proyecto>.pages.dev` o el
     dominio custom, una vez asignado).
   - `BETTER_AUTH_SECRET` — 32+ caracteres de alta entropía, p. ej.
     `openssl rand -hex 32`. Nunca reusar el de otro proyecto.
   - `RESEND_API_KEY` — de la cuenta de Resend (recuperar contraseña, 0.2).
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — ver sección
     de Web Push arriba.
4. Guardar y disparar el primer deploy (o hacer un push a `main` — desde acá
   en adelante, cada push a `main` build-and-deploya solo).

### 3. Bootstrap del primer admin

El primer usuario admin no tiene a nadie que lo apruebe (1.2 "Aprobar
registros" requiere ya ser admin para entrar). Después de que el deploy esté
arriba:

1. La persona que va a ser admin se registra normalmente por `/registro`
   (queda "pendiente de aprobación", como cualquiera).
2. Quien tiene acceso a `DATABASE_URL` corre, una sola vez:
   ```bash
   bun run admin:bootstrap admin@cliente.com
   ```
   Este comando busca esa cuenta ya existente y la promueve a
   `aprobado=true, es_admin=true`. No crea usuarios ni toca contraseñas — si
   el email no existe todavía, falla con un mensaje claro en vez de no hacer
   nada en silencio. Ver `scripts/admin-bootstrap.ts`.
3. Desde ahí, ese admin usa `/aprobar-registros` (1.2) para el resto —
   incluyendo asignar `es_vendedor`/`es_admin` a futuras cuentas.

No hay ningún otro camino de auto-promoción a admin en el código — este
script corre fuera del runtime de la app, a mano, una vez por deploy.

**Tocar flags de un usuario ya aprobado:** a diferencia del primer admin,
para el resto lo normal es usar `/aprobar-registros` (1.2) o, una vez
implementada, la pantalla de administración de usuarios (ver plan de tareas,
T13). Para casos puntuales de CLI (p. ej. testing) sin pasar por SQL a mano:

```bash
bun run permisos:set admin@cliente.com --vendedor
```

Solo actualiza los flags pasados como argumento (`--vendedor`/`--no-vendedor`,
`--admin`/`--no-admin`); el resto queda igual. Falla si el usuario no existe o
todavía no fue aprobado. Ver `scripts/permisos-set.ts`.

### 4. Smoke test post-deploy

1. Abrir la URL pública → `/registro` → crear la cuenta admin → confirmar que
   redirige a "pendiente de aprobación" (no al dashboard).
2. Correr `admin:bootstrap` (paso 3).
3. `/login` con esa cuenta → debería entrar directo al dashboard (1.0).
4. Confirmar que el tablero carga sin error (aunque esté vacío, sin órdenes
   todavía) y que `/aprobar-registros` es accesible para ese usuario.
