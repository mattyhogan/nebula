<script lang="ts">
	import { getWeather, type WeatherData } from '$lib/api';

	let now = $state(new Date());
	let weather: WeatherData | null = $state(null);

	const greeting = $derived.by(() => {
		const h = now.getHours();
		if (h < 5) return 'late night';
		if (h < 12) return 'good morning';
		if (h < 17) return 'good afternoon';
		if (h < 21) return 'good evening';
		return 'late night';
	});

	const dayName = $derived(now.toLocaleDateString([], { weekday: 'long' }));
	const dateStr = $derived(now.toLocaleDateString([], { month: 'long', day: 'numeric' }));
	const hours = $derived(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
	const seconds = $derived(now.toLocaleTimeString([], { second: '2-digit' }).slice(-2));

	const weatherIcons: Record<string, string> = {
		'clear': '\u2600',
		'partly-cloudy': '\u26C5',
		'cloudy': '\u2601',
		'fog': '\u{1F32B}',
		'rain': '\u{1F327}',
		'snow': '\u{1F328}',
		'thunder': '\u26A1',
	};

	$effect(() => {
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	$effect(() => {
		getWeather().then((w) => (weather = w)).catch(() => {});
		const id = setInterval(() => {
			getWeather().then((w) => (weather = w)).catch(() => {});
		}, 10 * 60 * 1000);
		return () => clearInterval(id);
	});
</script>

<div class="flex h-full flex-col justify-between gap-4">
	<div>
		<div class="font-mono text-[10px] uppercase tracking-[0.3em] text-hud-cyan/40">{greeting}</div>
		<div class="mt-2 flex items-baseline gap-1">
			<span class="font-mono text-5xl font-bold tabular-nums tracking-tight text-text" style="line-height: 1">{hours}</span>
			<span class="font-mono text-xl tabular-nums text-text-dim/30" style="animation: hud-pulse 1s ease-in-out infinite">{seconds}</span>
		</div>
		<div class="mt-2 font-mono text-xs tracking-wide text-text-dim">{dayName}, {dateStr}</div>
	</div>

	{#if weather}
		<div class="space-y-3">
			<div class="flex items-start justify-between gap-3">
				<div>
					<div class="flex items-center gap-2.5">
						<span class="text-2xl" style="filter: saturate(0.7)">{weatherIcons[weather.icon] ?? '\u2601'}</span>
						<div>
							<div class="font-mono text-3xl font-bold tabular-nums text-text" style="line-height: 1">{weather.temp_f}<span class="text-sm font-normal text-text-dim/50">&deg;</span></div>
							<div class="font-mono text-[10px] text-text-secondary/70">{weather.condition}</div>
						</div>
					</div>
				</div>
				<div class="text-right space-y-0.5 pt-0.5">
					<div class="font-mono text-[10px] tabular-nums text-text-dim/50">feels {weather.feels_like_f}&deg;</div>
					<div class="font-mono text-[10px] tabular-nums text-text-dim/50">{weather.humidity}% hum</div>
					<div class="font-mono text-[10px] tabular-nums text-text-dim/50">{weather.wind_mph}mph {weather.wind_dir}</div>
				</div>
			</div>

			{#if weather.forecast.length > 0}
				<div class="flex gap-1 border-t border-panel-border/30 pt-2.5">
					{#each weather.forecast as day}
						{@const d = new Date(day.date + 'T12:00:00')}
						<div class="flex-1 rounded-md bg-white/[0.02] px-1.5 py-1.5 text-center">
							<div class="font-mono text-[9px] uppercase tracking-wider text-text-dim/40">{d.toLocaleDateString([], { weekday: 'short' })}</div>
							<div class="my-0.5 text-base" style="filter: saturate(0.7)">{weatherIcons[day.icon] ?? '\u2601'}</div>
							<div class="font-mono text-[10px] tabular-nums">
								<span class="text-text/80">{day.high_f}&deg;</span>
								<span class="text-text-dim/30"> {day.low_f}&deg;</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<div class="font-mono text-[9px] text-text-dim/25 tracking-wide">{weather.location}</div>
		</div>
	{:else}
		<div class="font-mono text-[10px] text-text-dim/30" style="animation: hud-pulse 1.5s ease-in-out infinite">loading weather...</div>
	{/if}
</div>
