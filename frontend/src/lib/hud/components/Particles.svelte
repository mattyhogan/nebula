<script lang="ts">
	let { ambientMode = false }: { ambientMode?: boolean } = $props();

	let canvas: HTMLCanvasElement | undefined = $state();

	interface Particle {
		x: number;
		y: number;
		z: number;
		vx: number;
		vy: number;
		size: number;
		alpha: number;
	}

	const BASE_COUNT = 30;
	const AMBIENT_COUNT = 42;
	let particles: Particle[] = [];
	let raf = 0;
	let lastDraw = 0;
	const FRAME_INTERVAL = 50;

	function getTimeOfDayColors(): { r: number; g: number; b: number }[] {
		const hour = new Date().getHours();

		if (hour >= 21 || hour < 5) {
			return [
				{ r: 40, g: 50, b: 180 },
				{ r: 90, g: 40, b: 160 },
				{ r: 60, g: 60, b: 200 }
			];
		}

		if (hour >= 5 && hour < 10) {
			return [
				{ r: 220, g: 160, b: 50 },
				{ r: 200, g: 130, b: 40 },
				{ r: 240, g: 190, b: 80 }
			];
		}

		if (hour >= 17 && hour < 21) {
			return [
				{ r: 230, g: 120, b: 60 },
				{ r: 220, g: 80, b: 100 },
				{ r: 240, g: 150, b: 90 }
			];
		}

		return [
			{ r: 77, g: 168, b: 255 },
			{ r: 120, g: 200, b: 255 },
			{ r: 200, g: 230, b: 255 }
		];
	}

	function spawn(): Particle {
		return {
			x: Math.random(),
			y: Math.random(),
			z: Math.random(),
			vx: (Math.random() - 0.5) * 0.0003,
			vy: -0.0001 - Math.random() * 0.0003,
			size: 0.5 + Math.random() * 1.5,
			alpha: 0.1 + Math.random() * 0.25
		};
	}

	$effect(() => {
		if (!canvas) return;
		const ctx = canvas.getContext('2d')!;

		const targetCount = ambientMode ? AMBIENT_COUNT : BASE_COUNT;
		while (particles.length < targetCount) particles.push(spawn());
		if (particles.length > targetCount) particles.length = targetCount;

		const speedFactor = ambientMode ? 0.6 : 1;
		let colors = ambientMode ? getTimeOfDayColors() : null;
		let colorRefreshTimer = 0;

		function resize() {
			canvas!.width = canvas!.offsetWidth;
			canvas!.height = canvas!.offsetHeight;
		}
		resize();
		window.addEventListener('resize', resize);

		function draw(now: number) {
			if (now - lastDraw < FRAME_INTERVAL) { raf = requestAnimationFrame(draw); return; }
			lastDraw = now;
			const w = canvas!.width;
			const h = canvas!.height;
			ctx.clearRect(0, 0, w, h);

			if (ambientMode) {
				colorRefreshTimer++;
				if (colorRefreshTimer > 600) {
					colors = getTimeOfDayColors();
					colorRefreshTimer = 0;
				}
			}

			for (let i = 0; i < particles.length; i++) {
				const p = particles[i];
				p.x += p.vx * speedFactor;
				p.y += p.vy * speedFactor;
				if (p.y < -0.05 || p.x < -0.05 || p.x > 1.05) {
					Object.assign(p, spawn());
					p.y = 1.05;
				}

				const depth = 0.3 + p.z * 0.7;
				const sx = p.x * w;
				const sy = p.y * h;
				const sr = p.size * depth;

				ctx.beginPath();
				ctx.arc(sx, sy, sr, 0, Math.PI * 2);
				if (ambientMode && colors) {
					const c = colors[i % colors.length];
					ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${p.alpha * depth})`;
				} else {
					ctx.fillStyle = `rgba(77, 168, 255, ${p.alpha * depth})`;
				}
				ctx.fill();
			}

			raf = requestAnimationFrame(draw);
		}
		raf = requestAnimationFrame(draw);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	});
</script>

<canvas
	bind:this={canvas}
	class="pointer-events-none absolute inset-0 h-full w-full z-0"
></canvas>
