let active = $state(false);
let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let rafId: number | null = null;

let lastClapTime = 0;
let cooldown = false;
const CLAP_THRESHOLD = 0.4;
const DOUBLE_GAP_MIN = 100;
const DOUBLE_GAP_MAX = 500;
const COOLDOWN_MS = 800;

let onDoubleClap: (() => void) | null = null;

function detect() {
	if (!analyser) return;
	const data = new Uint8Array(analyser.fftSize);
	analyser.getByteTimeDomainData(data);

	let peak = 0;
	for (let i = 0; i < data.length; i++) {
		const v = Math.abs((data[i] - 128) / 128);
		if (v > peak) peak = v;
	}

	if (peak > CLAP_THRESHOLD && !cooldown) {
		const now = performance.now();
		const gap = now - lastClapTime;

		if (gap > DOUBLE_GAP_MIN && gap < DOUBLE_GAP_MAX) {
			cooldown = true;
			lastClapTime = 0;
			onDoubleClap?.();
			setTimeout(() => { cooldown = false; }, COOLDOWN_MS);
		} else {
			lastClapTime = now;
		}
	}

	rafId = requestAnimationFrame(detect);
}

export async function startClapDetection(cb: () => void): Promise<boolean> {
	if (active) return true;
	onDoubleClap = cb;
	try {
		stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		ctx = new AudioContext();
		const source = ctx.createMediaStreamSource(stream);
		analyser = ctx.createAnalyser();
		analyser.fftSize = 512;
		source.connect(analyser);
		active = true;
		rafId = requestAnimationFrame(detect);
		return true;
	} catch {
		return false;
	}
}

export function stopClapDetection() {
	active = false;
	onDoubleClap = null;
	if (rafId != null) cancelAnimationFrame(rafId);
	rafId = null;
	if (ctx) { ctx.close().catch(() => {}); ctx = null; }
	if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
	analyser = null;
}

export function isClapActive() { return active; }
