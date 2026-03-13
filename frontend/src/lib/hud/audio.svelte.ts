let ctx: AudioContext | null = null;
let ambientGain: GainNode | null = null;
let ambientOscs: OscillatorNode[] = [];
let muted = false;

export function setMuted(m: boolean) { muted = m; }
export function isMuted() { return muted; }

function getCtx(): AudioContext {
	if (!ctx) ctx = new AudioContext();
	return ctx;
}

function playTone(freq: number, duration: number, volume: number, type: OscillatorType = 'sine') {
	if (muted) return;
	const c = getCtx();
	const osc = c.createOscillator();
	const gain = c.createGain();
	osc.type = type;
	osc.frequency.setValueAtTime(freq, c.currentTime);
	gain.gain.setValueAtTime(volume, c.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + duration);
	osc.connect(gain).connect(c.destination);
	osc.start();
	osc.stop(c.currentTime + duration);
}

export function playGrab() {
	playTone(880, 0.08, 0.06, 'sine');
	setTimeout(() => playTone(1320, 0.06, 0.04, 'sine'), 30);
}

export function playRelease() {
	playTone(660, 0.1, 0.05, 'sine');
	setTimeout(() => playTone(440, 0.08, 0.03, 'sine'), 40);
}

export function playResize() {
	playTone(1100, 0.05, 0.03, 'triangle');
}

export function playStretch() {
	playTone(550, 0.06, 0.04, 'triangle');
	setTimeout(() => playTone(770, 0.06, 0.03, 'triangle'), 25);
}

export function playSwipe(direction: 'left' | 'right') {
	const base = direction === 'right' ? 600 : 800;
	const end = direction === 'right' ? 800 : 600;
	if (muted) return;
	const c = getCtx();
	const osc = c.createOscillator();
	const gain = c.createGain();
	osc.type = 'sine';
	osc.frequency.setValueAtTime(base, c.currentTime);
	osc.frequency.linearRampToValueAtTime(end, c.currentTime + 0.12);
	gain.gain.setValueAtTime(0.04, c.currentTime);
	gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
	osc.connect(gain).connect(c.destination);
	osc.start();
	osc.stop(c.currentTime + 0.15);
}

export function startAmbient() {
	if (muted) return;
	const c = getCtx();
	ambientGain = c.createGain();
	ambientGain.gain.setValueAtTime(0, c.currentTime);
	ambientGain.gain.linearRampToValueAtTime(0.012, c.currentTime + 3);
	ambientGain.connect(c.destination);

	const freqs = [55, 82.5, 110, 165];
	for (const freq of freqs) {
		const osc = c.createOscillator();
		osc.type = 'sine';
		osc.frequency.setValueAtTime(freq, c.currentTime);

		const lfo = c.createOscillator();
		const lfoGain = c.createGain();
		lfo.type = 'sine';
		lfo.frequency.setValueAtTime(0.03 + Math.random() * 0.05, c.currentTime);
		lfoGain.gain.setValueAtTime(2, c.currentTime);
		lfo.connect(lfoGain).connect(osc.frequency);
		lfo.start();

		osc.connect(ambientGain!);
		osc.start();
		ambientOscs.push(osc, lfo);
	}
}

export function setAmbientMood(healthy: boolean) {
	if (!ambientGain) return;
	const c = getCtx();
	const target = healthy ? 0.012 : 0.02;
	ambientGain.gain.linearRampToValueAtTime(target, c.currentTime + 2);

	if (!healthy) {
		playTone(220, 0.4, 0.03, 'sawtooth');
		setTimeout(() => playTone(207, 0.4, 0.02, 'sawtooth'), 200);
	}
}

export function stopAmbient() {
	if (ambientGain) {
		const c = getCtx();
		ambientGain.gain.linearRampToValueAtTime(0, c.currentTime + 1);
	}
	setTimeout(() => {
		ambientOscs.forEach((o) => { try { o.stop(); } catch {} });
		ambientOscs = [];
		ambientGain = null;
	}, 1200);
}
