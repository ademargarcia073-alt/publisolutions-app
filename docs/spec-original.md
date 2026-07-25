# Spec — App de órdenes de trabajo (señalética / impresiones)

Cliente: empresa de fotografía, señalética y letreros. Objetivo: digitalizar las órdenes de trabajo que hoy se manejan en papel, dar trazabilidad de producción y evitar que órdenes entregadas se pierdan antes de facturarse.

## 1. Pantallas

| Código | Nombre | Descripción |
|---|---|---|
| 0.0 | Iniciar sesión | Login. Si hay credenciales válidas, pasa a 1.0 |
| 0.1 | Registro | Alta de nuevo usuario. Requiere aprobación de un admin antes de poder ingresar |
| 0.2 | Recuperar contraseña | Flujo estándar de recuperación |
| 1.0 | Dashboard | Pantalla principal tras login. Muestra tablero de órdenes (área, estado, responsable) y, debajo, lista de personas de producción libres/sin actividad. Nav inferior: Inicio · Nueva orden · Todas las órdenes |
| 1.1 | Notificaciones | Listado cronológico de notificaciones dentro de la app (bell icon desde 1.0) |
| 1.2 | Aprobar registros | Solo admin. Lista de solicitudes de registro (0.1) pendientes de aprobación |
| 2.0 | Formulario / detalle de orden | Crear orden nueva (desde "Nueva orden") o ver/editar una existente (desde 3.0). Cuando se abre desde 3.0 incluye además el historial de cambios |
| 3.0 | Listado de órdenes | Todas las órdenes, cronológico, visible para todos los roles sin filtrar. Clic en una orden abre 2.0. Debería contemplar filtros (estado / área / cliente) desde el MVP para que no crezca inmanejable |

## 2. Roles y permisos

Modelo de **permisos aditivos**, no roles excluyentes. Usuario tiene flags:

- `es_vendedor` (boolean) — ~3 personas
- `es_admin` (boolean) — ~2 personas
- Producción: implícito para **todos** los usuarios aprobados, sin flag propio

| Acción | Vendedor | Producción (todos) | Admin |
|---|---|---|---|
| Crear orden (2.0) | Sí | No | Sí (si también es vendedor) |
| Editar datos generales mientras nadie tomó la orden | Sí (si es el creador) | No | Sí |
| Tomar / completar trabajo de un pool | No | Sí | Sí |
| Marcar "Entregado" | Sí (si es el creador) | No | Sí |
| Cancelar orden | Sí (si es el creador) | No | Sí |
| Marcar cobro | No | No | Sí |
| Ver todas las órdenes (3.0) | Sí | Sí | Sí |
| Aprobar registros (1.2) | No | No | Sí |

## 3. Modelo de datos — Orden de trabajo

**Datos generales** (vendedor, al crear; editables solo mientras nadie tomó la orden)
- `fecha_creacion` — automático
- `cliente` — texto libre (nombre/razón social); sin autocompletado en el MVP, evaluar lista reutilizable más adelante
- `tipo_trabajo` — lista desplegable
- `descripcion` — texto libre
- `cantidad`
- `dimension`
- `material`
- `acabado`
- `arte` — texto libre, opcional. Trabajo adicional sobre el diseño o el armado
- `fecha_entrega_comprometida`
- `vendedor_id` — automático, quien crea la orden

**Áreas de producción** — checkboxes simples, **orden fijo**: Diseño → Impresión → Corte → Metalmecánica → Armado. El vendedor solo marca cuáles aplican a este trabajo; el sistema respeta siempre ese orden para las marcadas.
- `areas_seleccionadas` — array ordenado (subconjunto del orden fijo)

**Financiero**
- `total`
- `a_cuenta`
- `saldo` — calculado automáticamente = `total - a_cuenta` (no editable a mano)
- `estado_cobro` — pendiente / cobrado
- `fecha_cobro`

**Automáticos / derivados**
- `area_actual` — siguiente área sin completar dentro de `areas_seleccionadas`
- `estado` — creada / en_producción / listo_para_entrega / entregado / cancelada
- `responsable_actual` — usuario que tomó el trabajo en `area_actual`; vacío mientras está en pool
- `fecha_entrega_real`

**Historial** (solo lectura, generado por el sistema)
- Lista de eventos: `{usuario, campo_o_area, valor_anterior, valor_nuevo, timestamp}`

## 4. Flujo de estados

```
creada (vendedor completa el formulario)
  → primer área de la secuencia entra a "pool"
     → alguien de producción la toma (responsable = ese usuario)
        → completa su parte
           → ¿hay siguiente área en la secuencia?
               sí → entra al pool de la siguiente área (repite el ciclo)
               no → estado = "listo_para_entrega" (automático)
  → "entregado" (lo marca el vendedor creador o cualquier admin, manual)
     → estado_cobro = "pendiente" → admin lo marca "cobrado"

Cancelación: posible desde "creada" o "en_producción" (no desde listo_para_entrega en adelante).
La marca el vendedor creador o cualquier admin.
```

## 5. Notificaciones

Doble canal, mismo evento dispara ambos:
- **Push nativo** (service worker + suscripciones por usuario) — llega esté o no la app abierta
- **Registro en 1.1** — queda como historial dentro de la app

Se notifica en **cada cambio de área/estado** a:
- Todo el grupo de producción (broadcast, sin filtrar por área — el personal rota entre áreas)
- El vendedor dueño de la orden

## 6. Pendientes / fuera del MVP inicial

- Lista de clientes reutilizable con autocompletado (por ahora texto libre)
- Filtros avanzados en 3.0 (contemplar desde el diseño de la query, aunque la UI de filtros se simplifique en la v1)
- Posibilidad de que el orden de áreas sea configurable por orden (por ahora es fijo de fábrica)
