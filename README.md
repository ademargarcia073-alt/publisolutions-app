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

## Deploy — paso único de bootstrap

El primer usuario admin no tiene a nadie que lo apruebe (1.2 "Aprobar
registros" requiere ya ser admin para entrar). Después del primer deploy:

1. La persona que va a ser admin se registra normalmente por `/registro`
   (queda "pendiente de aprobación", como cualquiera).
2. Quien tiene acceso a las credenciales de deploy corre, una sola vez:
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
