<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="relative min-h-screen bg-background font-sans text-text">
	{@render children()}
</div>
