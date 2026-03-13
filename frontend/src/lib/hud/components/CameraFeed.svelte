<script lang="ts">
	let { onReady }: { onReady?: (video: HTMLVideoElement) => void } = $props();

	let video: HTMLVideoElement | undefined = $state();
	let active = $state(false);
	let error = $state('');

	$effect(() => {
		if (!video) return;
		navigator.mediaDevices
			.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
			.then((stream) => {
				video!.srcObject = stream;
				active = true;
				video!.onloadeddata = () => {
					onReady?.(video!);
				};
			})
			.catch((err) => {
				error = err.message;
			});

		return () => {
			const stream = video?.srcObject as MediaStream | null;
			stream?.getTracks().forEach((t) => t.stop());
		};
	});
</script>

<video
	bind:this={video}
	autoplay
	playsinline
	muted
	class="absolute inset-0 h-full w-full object-cover -scale-x-100"
	class:opacity-0={!active}
	style="transition: opacity 0.5s ease"
></video>

{#if error}
	<div class="absolute inset-0 flex items-center justify-center bg-bg">
		<div class="text-center">
			<p class="font-mono text-sm text-hud-red mb-2">Camera: {error}</p>
			<p class="font-mono text-xs text-text-dim">Allow camera access to enable AR mode</p>
		</div>
	</div>
{/if}
