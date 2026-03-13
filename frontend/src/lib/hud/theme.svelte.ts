export type ThemeName = 'cyan' | 'amber' | 'green' | 'red';

const themeOrder: ThemeName[] = ['cyan', 'amber', 'green', 'red'];

const themeLabels: Record<ThemeName, string> = {
	cyan: 'Cyan',
	amber: 'Amber Terminal',
	green: 'Green Phosphor',
	red: 'Red Alert'
};

type ThemeVars = Record<string, string>;

const themes: Record<ThemeName, ThemeVars> = {
	cyan: {
		'--color-background': '#09090b',
		'--color-surface': '#131316',
		'--color-surface-hover': '#1c1c21',
		'--color-border': '#232329',
		'--color-text': '#fafafa',
		'--color-text-secondary': '#a1a1aa',
		'--color-text-dim': '#52525b',
		'--color-accent': '#2dd4bf',
		'--color-accent-dim': '#14b8a6',
		'--color-panel': 'rgba(12, 14, 22, 0.96)',
		'--color-panel-border': 'rgba(80, 160, 255, 0.12)',
		'--color-panel-border-hover': 'rgba(80, 160, 255, 0.3)',
		'--color-hud-blue': '#4da8ff',
		'--color-hud-cyan': '#00e5ff',
		'--color-hud-green': '#00e676',
		'--color-hud-yellow': '#ffd740',
		'--color-hud-red': '#ff5252',
		'--color-hud-purple': '#b388ff',
		'--color-glow': 'rgba(77, 168, 255, 0.08)',
		'--color-bg': '#0a0a0c'
	},
	amber: {
		'--color-background': '#0a0a06',
		'--color-surface': '#141208',
		'--color-surface-hover': '#1e1b0e',
		'--color-border': '#2a2614',
		'--color-text': '#fef3c7',
		'--color-text-secondary': '#d4a24a',
		'--color-text-dim': '#6b5a2e',
		'--color-accent': '#ffb300',
		'--color-accent-dim': '#cc8f00',
		'--color-panel': 'rgba(14, 12, 4, 0.96)',
		'--color-panel-border': 'rgba(255, 179, 0, 0.12)',
		'--color-panel-border-hover': 'rgba(255, 179, 0, 0.3)',
		'--color-hud-blue': '#ffb300',
		'--color-hud-cyan': '#ffc107',
		'--color-hud-green': '#ffca28',
		'--color-hud-yellow': '#ffd740',
		'--color-hud-red': '#ff8f00',
		'--color-hud-purple': '#ffab00',
		'--color-glow': 'rgba(255, 179, 0, 0.08)',
		'--color-bg': '#0a0a06'
	},
	green: {
		'--color-background': '#050a05',
		'--color-surface': '#0a140a',
		'--color-surface-hover': '#0f1e0f',
		'--color-border': '#1a2e1a',
		'--color-text': '#c8f7c8',
		'--color-text-secondary': '#5ce65c',
		'--color-text-dim': '#2a6b2a',
		'--color-accent': '#00ff41',
		'--color-accent-dim': '#00cc33',
		'--color-panel': 'rgba(4, 12, 4, 0.96)',
		'--color-panel-border': 'rgba(0, 255, 65, 0.12)',
		'--color-panel-border-hover': 'rgba(0, 255, 65, 0.3)',
		'--color-hud-blue': '#00ff41',
		'--color-hud-cyan': '#33ff66',
		'--color-hud-green': '#00ff41',
		'--color-hud-yellow': '#66ff66',
		'--color-hud-red': '#00cc33',
		'--color-hud-purple': '#44dd55',
		'--color-glow': 'rgba(0, 255, 65, 0.08)',
		'--color-bg': '#050a05'
	},
	red: {
		'--color-background': '#0c0404',
		'--color-surface': '#160808',
		'--color-surface-hover': '#220c0c',
		'--color-border': '#3a1414',
		'--color-text': '#fecaca',
		'--color-text-secondary': '#f87171',
		'--color-text-dim': '#7f1d1d',
		'--color-accent': '#ff3333',
		'--color-accent-dim': '#cc2222',
		'--color-panel': 'rgba(16, 4, 4, 0.96)',
		'--color-panel-border': 'rgba(255, 51, 51, 0.12)',
		'--color-panel-border-hover': 'rgba(255, 51, 51, 0.3)',
		'--color-hud-blue': '#ff3333',
		'--color-hud-cyan': '#ff4444',
		'--color-hud-green': '#ff6666',
		'--color-hud-yellow': '#ff5555',
		'--color-hud-red': '#ff3333',
		'--color-hud-purple': '#ff4466',
		'--color-glow': 'rgba(255, 51, 51, 0.08)',
		'--color-bg': '#0c0404'
	}
};

function loadTheme(): ThemeName {
	if (typeof localStorage === 'undefined') return 'cyan';
	const stored = localStorage.getItem('nebula:theme');
	if (stored && themeOrder.includes(stored as ThemeName)) return stored as ThemeName;
	return 'cyan';
}

let currentTheme: ThemeName = $state(loadTheme());
let showToast = $state(false);
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function applyTheme(name: ThemeName) {
	if (typeof document === 'undefined') return;
	const vars = themes[name];
	const root = document.documentElement;
	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(key, value);
	}
}

function cycleTheme() {
	const idx = themeOrder.indexOf(currentTheme);
	currentTheme = themeOrder[(idx + 1) % themeOrder.length];
	localStorage.setItem('nebula:theme', currentTheme);
	applyTheme(currentTheme);

	if (toastTimeout) clearTimeout(toastTimeout);
	showToast = true;
	toastTimeout = setTimeout(() => {
		showToast = false;
	}, 1500);
}

function initTheme() {
	applyTheme(currentTheme);
}

function getThemeLabel(): string {
	return themeLabels[currentTheme];
}

function getThemeName(): ThemeName {
	return currentTheme;
}

function isToastVisible(): boolean {
	return showToast;
}

export { cycleTheme, initTheme, getThemeLabel, getThemeName, isToastVisible, themes, themeLabels, themeOrder };
export type { ThemeVars };
