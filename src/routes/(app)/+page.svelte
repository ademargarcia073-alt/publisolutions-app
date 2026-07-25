<!--
	Placeholder — T8 reemplaza esto con el Dashboard real (1.0): tablero de
	órdenes + lista de producción libre.
-->
<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<h1>Hola, {data.user.name}</h1>
<p>Sesión válida y aprobada. Dashboard real llega en T8.</p>
