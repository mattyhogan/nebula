import type { Component } from 'svelte';
import type { ServiceSnapshot } from '$lib/types';

import HelloPanel from './components/HelloPanel.svelte';
import VitalsPanel from './components/VitalsPanel.svelte';
import CapacityPanel from './components/CapacityPanel.svelte';
import TelemetryPanel from './components/TelemetryPanel.svelte';
import SystemPanel from './components/SystemPanel.svelte';
import ChangelogPanel from './components/ChangelogPanel.svelte';
import NeroChat from './components/NeroChat.svelte';
import TerminalPanel from './components/TerminalPanel.svelte';
import CalendarPanel from './components/CalendarPanel.svelte';
import NewsPanel from './components/NewsPanel.svelte';
import KioskPanel from './components/KioskPanel.svelte';
import HeatmapPanel from './components/HeatmapPanel.svelte';
import NetworkPanel from './components/NetworkPanel.svelte';
import SpotifyPanel from './components/SpotifyPanel.svelte';

export interface PanelContext {
	snapshots: ServiceSnapshot[];
	metrics: any[];
	progress: any[];
	timeseries: any[];
	tables: any[];
	isActive: boolean;
}

export interface PanelDef {
	id: string;
	label: string;
	component: Component<any>;
	getProps?: (ctx: PanelContext) => Record<string, unknown>;
	category: 'core' | 'integration' | 'tool';
	feature?: string;
}

export const panels: PanelDef[] = [
	{ id: 'hello', label: 'hello', component: HelloPanel, category: 'core' },
	{ id: 'vitals', label: 'vitals', component: VitalsPanel, getProps: ctx => ({ metrics: ctx.metrics }), category: 'core' },
	{ id: 'capacity', label: 'capacity', component: CapacityPanel, getProps: ctx => ({ progress: ctx.progress }), category: 'core' },
	{ id: 'charts', label: 'telemetry', component: TelemetryPanel, getProps: ctx => ({ timeseries: ctx.timeseries }), category: 'core' },
	{ id: 'system', label: 'system', component: SystemPanel, getProps: ctx => ({ snapshots: ctx.snapshots, tables: ctx.tables }), category: 'core' },
	{ id: 'changelog', label: 'changelog', component: ChangelogPanel, category: 'integration', feature: 'changelog' },
	{ id: 'nero', label: 'nero', component: NeroChat, category: 'integration', feature: 'nero' },
	{ id: 'terminal', label: 'terminal', component: TerminalPanel, getProps: ctx => ({ active: ctx.isActive }), category: 'tool' },
	{ id: 'calendar', label: 'calendar', component: CalendarPanel, category: 'integration', feature: 'calendar' },
	{ id: 'news', label: 'news', component: NewsPanel, category: 'integration' },
	{ id: 'kiosk', label: 'kiosk', component: KioskPanel, category: 'tool', feature: 'kiosk' },
	{ id: 'heatmap', label: 'activity', component: HeatmapPanel, category: 'core' },
	{ id: 'network', label: 'network', component: NetworkPanel, category: 'core' },
	{ id: 'spotify', label: 'spotify', component: SpotifyPanel, category: 'integration', feature: 'spotify' },
];

export const panelMap = new Map(panels.map(p => [p.id, p]));
