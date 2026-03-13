import {
	FilesetResolver,
	HandLandmarker,
	type HandLandmarkerResult,
	type NormalizedLandmark
} from '@mediapipe/tasks-vision';

export type GestureType = 'none' | 'pinch' | 'fist' | 'open' | 'point' | 'peace';

export interface HandState {
	landmarks: NormalizedLandmark[];
	gesture: GestureType;
	pinching: boolean;
	pinchX: number;
	pinchY: number;
	depth: number;
	velocityX: number;
	speed: number;
}

const PINCH_ON = 0.055;
const PINCH_OFF = 0.09;
let detectInterval = 50;
const SMOOTH = 0.4;

function dist3d(a: NormalizedLandmark, b: NormalizedLandmark): number {
	return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function dist2d(a: NormalizedLandmark, b: NormalizedLandmark): number {
	return Math.hypot(a.x - b.x, a.y - b.y);
}

function fingerCurled(tip: NormalizedLandmark, pip: NormalizedLandmark, mcp: NormalizedLandmark): boolean {
	return dist2d(tip, mcp) < dist2d(pip, mcp) + 0.05;
}

function detectGesture(lm: NormalizedLandmark[]): GestureType {
	const indexCurl = fingerCurled(lm[8], lm[6], lm[5]);
	const middleCurl = fingerCurled(lm[12], lm[10], lm[9]);
	const ringCurl = fingerCurled(lm[16], lm[14], lm[13]);
	const pinkyCurl = fingerCurled(lm[20], lm[18], lm[17]);

	if (indexCurl && middleCurl && ringCurl && pinkyCurl) return 'fist';

	const wrist = lm[0];
	const indexExt = dist2d(lm[8], wrist) > dist2d(lm[6], wrist);
	const middleExt = dist2d(lm[12], wrist) > dist2d(lm[10], wrist);
	const ringExt = dist2d(lm[16], wrist) > dist2d(lm[14], wrist);
	const pinkyExt = dist2d(lm[20], wrist) > dist2d(lm[18], wrist);

	if (indexExt && middleExt && ringExt && pinkyExt) return 'open';
	if (indexExt && middleExt && ringCurl && pinkyCurl) return 'peace';
	if (indexExt && middleCurl && ringCurl && pinkyCurl) return 'point';

	return 'none';
}

export function createHandTracker() {
	let hands: HandState[] = $state([]);
	let ready = $state(false);
	let landmarker: HandLandmarker | null = null;
	let rafId = 0;
	let lastDetect = 0;

	const wasPinching = new Map<number, boolean>();
	const smoothed = new Map<number, { x: number; y: number; depth: number; vx: number }>();
	const baselineWidths = new Map<number, number>();

	async function init(video: HTMLVideoElement) {
		const vision = await FilesetResolver.forVisionTasks(
			'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
		);

		landmarker = await HandLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath:
					'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
				delegate: 'GPU'
			},
			runningMode: 'VIDEO',
			numHands: 1,
			minHandDetectionConfidence: 0.6,
			minHandPresenceConfidence: 0.6,
			minTrackingConfidence: 0.5
		});

		ready = true;
		detect(video);
	}

	function detect(video: HTMLVideoElement) {
		if (!landmarker || video.readyState < 2) {
			rafId = requestAnimationFrame(() => detect(video));
			return;
		}

		const now = performance.now();
		if (now - lastDetect >= detectInterval) {
			lastDetect = now;
			const result = landmarker.detectForVideo(video, now);
			hands = parseResult(result);
		}
		rafId = requestAnimationFrame(() => detect(video));
	}

	function parseResult(result: HandLandmarkerResult): HandState[] {
		return (result.landmarks || []).map((lm, handIdx) => {
			const thumbTip = lm[4];
			const indexTip = lm[8];
			const d = dist3d(thumbTip, indexTip);

			const was = wasPinching.get(handIdx) ?? false;
			const pinching = was ? d < PINCH_OFF : d < PINCH_ON;
			wasPinching.set(handIdx, pinching);

			const rawX = 1 - (thumbTip.x + indexTip.x) / 2;
			const rawY = (thumbTip.y + indexTip.y) / 2;

			const palmWidth = dist2d(lm[5], lm[17]);
			let baseline = baselineWidths.get(handIdx);
			if (!baseline) {
				baseline = palmWidth;
				baselineWidths.set(handIdx, baseline);
			} else {
				baseline += (palmWidth - baseline) * 0.003;
				baselineWidths.set(handIdx, baseline);
			}
			const rawDepth = (palmWidth / baseline - 1) * 1500;

			const prev = smoothed.get(handIdx);
			let sx: number, sy: number, sd: number, vx: number;
			if (prev) {
				sx = prev.x + (rawX - prev.x) * SMOOTH;
				sy = prev.y + (rawY - prev.y) * SMOOTH;
				sd = prev.depth + (rawDepth - prev.depth) * 0.2;
				vx = prev.vx * 0.5 + (rawX - prev.x) * 0.5;
			} else {
				sx = rawX;
				sy = rawY;
				sd = rawDepth;
				vx = 0;
			}
			smoothed.set(handIdx, { x: sx, y: sy, depth: sd, vx });

			const mirrored = lm.map((l) => ({ ...l, x: 1 - l.x }));
			const gesture: GestureType = pinching ? 'pinch' : detectGesture(lm);

			return {
				landmarks: mirrored,
				gesture,
				pinching,
				pinchX: sx,
				pinchY: sy,
				depth: sd,
				velocityX: vx,
				speed: Math.abs(vx)
			};
		});
	}

	function destroy() {
		cancelAnimationFrame(rafId);
		landmarker?.close();
		wasPinching.clear();
		smoothed.clear();
		baselineWidths.clear();
		hands = [];
		ready = false;
	}

	return {
		get hands() { return hands; },
		get ready() { return ready; },
		set throttle(ms: number) { detectInterval = ms; },
		init,
		destroy
	};
}
