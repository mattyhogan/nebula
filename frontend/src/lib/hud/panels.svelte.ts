import type { HandState } from './hands.svelte';

export interface Panel {
	id: string;
	x: number;
	y: number;
	w: number;
	h: number;
	z: number;
	minW: number;
	minH: number;
}

const GRAB_RADIUS = 0.08;
const RESIZE_EDGE = 0.03;

export function createPanelManager(initialPanels: Panel[]) {
	let panels: Panel[] = $state(structuredClone(initialPanels));
	let grabbed: { id: string; offsetX: number; offsetY: number; startZ: number; startDepth: number } | null = $state(null);
	let resizing: { id: string; startW: number; startH: number; startDist: number } | null = $state(null);
	let stretching: { id: string; startW: number; startH: number; startDist: number; startX: number; startY: number } | null = $state(null);
	let hovered: string | null = $state(null);

	let settling = new Map<string, { vz: number; targetZ: number }>();
	let settleFrame = 0;

	function settleLoop() {
		let active = false;
		for (const p of panels) {
			const s = settling.get(p.id);
			if (!s) continue;
			if (grabbed?.id === p.id) { settling.delete(p.id); continue; }

			const force = (s.targetZ - p.z) * 0.08;
			s.vz = (s.vz + force) * 0.85;
			p.z += s.vz;

			if (Math.abs(s.vz) < 0.1 && Math.abs(p.z - s.targetZ) < 0.5) {
				p.z = s.targetZ;
				settling.delete(p.id);
			} else {
				active = true;
			}
		}
		if (active) {
			settleFrame = requestAnimationFrame(settleLoop);
		} else {
			settleFrame = 0;
		}
	}

	function startSettle(id: string, targetZ: number) {
		settling.set(id, { vz: 0, targetZ });
		if (!settleFrame) settleFrame = requestAnimationFrame(settleLoop);
	}

	function update(hands: HandState[]) {
		const h0 = hands[0];
		const h1 = hands[1];

		if (!h0) {
			if (grabbed) grabbed = null;
			if (resizing) resizing = null;
			if (stretching) stretching = null;
			hovered = null;
			return;
		}

		const { pinching, pinchX, pinchY, depth } = h0;
		const bothPinching = pinching && h1?.pinching;

		if (bothPinching && !grabbed) {
			const midX = (pinchX + h1.pinchX) / 2;
			const midY = (pinchY + h1.pinchY) / 2;
			const dist = Math.hypot(pinchX - h1.pinchX, pinchY - h1.pinchY);

			if (!stretching) {
				const target = findPanelAt(midX, midY);
				if (target) {
					const panel = panels.find((p) => p.id === target)!;
					stretching = {
						id: target,
						startW: panel.w,
						startH: panel.h,
						startDist: dist,
						startX: panel.x + panel.w / 2,
						startY: panel.y + panel.h / 2
					};
					bringToFront(target);
				}
			}

			if (stretching) {
				const s = stretching;
				const panel = panels.find((p) => p.id === s.id);
				if (panel) {
					const scale = dist / s.startDist;
					const newW = Math.max(panel.minW, s.startW * scale);
					const newH = Math.max(panel.minH, s.startH * scale);
					panel.x = clamp(s.startX - newW / 2, 0, 1 - newW);
					panel.y = clamp(s.startY - newH / 2, 0, 1 - newH);
					panel.w = newW;
					panel.h = newH;
				}
			}

			hovered = stretching?.id ?? null;
			return;
		}

		if (stretching && !bothPinching) {
			stretching = null;
		}

		hovered = findPanelAt(pinchX, pinchY);

		if (pinching && !grabbed && !resizing && !stretching) {
			const target = findPanelAt(pinchX, pinchY);
			if (target) {
				const panel = panels.find((p) => p.id === target)!;
				const nearRight = Math.abs(pinchX - (panel.x + panel.w)) < RESIZE_EDGE;
				const nearBottom = Math.abs(pinchY - (panel.y + panel.h)) < RESIZE_EDGE;

				if (nearRight || nearBottom) {
					resizing = {
						id: target,
						startW: panel.w,
						startH: panel.h,
						startDist: Math.hypot(pinchX - panel.x, pinchY - panel.y)
					};
				} else {
					grabbed = {
						id: target,
						offsetX: pinchX - panel.x,
						offsetY: pinchY - panel.y,
						startZ: panel.z,
						startDepth: depth
					};
					bringToFront(target);
				}
			}
		}

		if (!pinching) {
			if (grabbed) {
				const g = grabbed;
				const panel = panels.find((p) => p.id === g.id);
				if (panel && Math.abs(panel.z) > 5) {
					startSettle(g.id, panel.z);
				}
				grabbed = null;
			}
			resizing = null;
		}

		if (grabbed) {
			const panel = panels.find((p) => p.id === grabbed!.id);
			if (panel) {
				panel.x = clamp(pinchX - grabbed.offsetX, 0, 1 - panel.w);
				panel.y = clamp(pinchY - grabbed.offsetY, 0, 1 - panel.h);
				const depthDelta = depth - grabbed.startDepth;
				panel.z = clamp(grabbed.startZ + depthDelta, -600, 600);
			}
		}

		if (resizing) {
			const panel = panels.find((p) => p.id === resizing!.id);
			if (panel) {
				const currentDist = Math.hypot(pinchX - panel.x, pinchY - panel.y);
				const scale = currentDist / resizing.startDist;
				panel.w = Math.max(panel.minW, resizing.startW * scale);
				panel.h = Math.max(panel.minH, resizing.startH * scale);
			}
		}
	}

	function findPanelAt(x: number, y: number): string | null {
		for (let i = panels.length - 1; i >= 0; i--) {
			const p = panels[i];
			if (x >= p.x - GRAB_RADIUS && x <= p.x + p.w + GRAB_RADIUS &&
				y >= p.y - GRAB_RADIUS && y <= p.y + p.h + GRAB_RADIUS) {
				return p.id;
			}
		}
		return null;
	}

	function bringToFront(id: string) {
		const idx = panels.findIndex((p) => p.id === id);
		if (idx >= 0 && idx < panels.length - 1) {
			const [panel] = panels.splice(idx, 1);
			panels.push(panel);
		}
	}

	function clamp(v: number, min: number, max: number) {
		return Math.min(max, Math.max(min, v));
	}

	function mouseDown(id: string, e: MouseEvent, container: HTMLElement) {
		const rect = container.getBoundingClientRect();
		const mx = (e.clientX - rect.left) / rect.width;
		const my = (e.clientY - rect.top) / rect.height;
		const panel = panels.find((p) => p.id === id);
		if (!panel) return;

		const nearRight = Math.abs(mx - (panel.x + panel.w)) < 0.02;
		const nearBottom = Math.abs(my - (panel.y + panel.h)) < 0.02;

		if (nearRight || nearBottom) {
			resizing = { id, startW: panel.w, startH: panel.h, startDist: Math.hypot(mx - panel.x, my - panel.y) };
		} else {
			grabbed = { id, offsetX: mx - panel.x, offsetY: my - panel.y, startZ: panel.z, startDepth: 0 };
			bringToFront(id);
		}

		let lastMy = my;

		function onMove(ev: MouseEvent) {
			const nx = (ev.clientX - rect.left) / rect.width;
			const ny = (ev.clientY - rect.top) / rect.height;

			if (grabbed) {
				const p = panels.find((pp) => pp.id === grabbed!.id);
				if (p) {
					p.x = clamp(nx - grabbed.offsetX, 0, 1 - p.w);
					p.y = clamp(ny - grabbed.offsetY, 0, 1 - p.h);
					if (ev.shiftKey) {
						p.z = clamp(p.z + (lastMy - ny) * 600, -300, 300);
					}
				}
			}
			if (resizing) {
				const p = panels.find((pp) => pp.id === resizing!.id);
				if (p) {
					const d = Math.hypot(nx - p.x, ny - p.y);
					const scale = d / resizing.startDist;
					p.w = Math.max(p.minW, resizing.startW * scale);
					p.h = Math.max(p.minH, resizing.startH * scale);
				}
			}
			lastMy = ny;
		}

		function onUp() {
			if (grabbed) {
				const p = panels.find((pp) => pp.id === grabbed!.id);
				if (p && Math.abs(p.z) > 5) startSettle(grabbed.id, p.z);
			}
			grabbed = null;
			resizing = null;
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
		}

		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	function panelTransform(p: Panel): string {
		return `translateZ(${p.z}px)`;
	}

	return {
		get panels() { return panels; },
		get grabbed() { return grabbed; },
		get resizing() { return resizing; },
		get stretching() { return stretching; },
		get hovered() { return hovered; },
		update,
		mouseDown,
		panelTransform
	};
}
