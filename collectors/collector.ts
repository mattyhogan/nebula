import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { Flux } from '@luxdb/flux';
import { z } from 'zod';

const LUX_URL = process.env.LUX_URL || 'lux://lux:6379';
const COLLECTOR_ID = process.env.COLLECTOR_ID || 'system';
const COLLECTOR_NAME = process.env.COLLECTOR_NAME || 'System';
const INTERVAL = 2000;
const HISTORY_LEN = 60;

const cpuHistory: number[] = [];
const tempHistory: number[] = [];
const rxBandwidthHistory: number[] = [];
const txBandwidthHistory: number[] = [];
let prevIdle = 0;
let prevTotal = 0;
let prevRxBytes = 0;
let prevTxBytes = 0;
let hasPrevNetwork = false;

function getCpuUsage(): number {
    const stat = readFileSync('/proc/stat', 'utf-8');
    const parts = stat.split('\n')[0].split(/\s+/).slice(1).map(Number);
    const idle = parts[3] + parts[4];
    const total = parts.reduce((a, b) => a + b, 0);
    const diffIdle = idle - prevIdle;
    const diffTotal = total - prevTotal;
    prevIdle = idle;
    prevTotal = total;
    if (diffTotal === 0) return 0;
    return Math.round((1 - diffIdle / diffTotal) * 100);
}

function getCpuTemp(): number {
    const paths = [
        '/sys/class/thermal/thermal_zone0/temp',
        '/sys/class/hwmon/hwmon0/temp1_input',
        '/sys/class/hwmon/hwmon1/temp1_input',
    ];
    for (const p of paths) {
        try {
            return Math.round(parseInt(readFileSync(p, 'utf-8')) / 100) / 10;
        } catch {}
    }
    return 0;
}

function getMemory() {
    const info = readFileSync('/proc/meminfo', 'utf-8');
    const total = parseInt(info.match(/MemTotal:\s+(\d+)/)![1]) / 1024;
    const available = parseInt(info.match(/MemAvailable:\s+(\d+)/)![1]) / 1024;
    const used = total - available;
    return { used: Math.round(used), total: Math.round(total) };
}

function getDisk() {
    const lines = execSync('df -BM / | tail -1').toString().split(/\s+/);
    return { used: parseInt(lines[2]), total: parseInt(lines[1]) };
}

function getUptime(): string {
    const secs = Math.floor(parseFloat(readFileSync('/proc/uptime', 'utf-8').split(' ')[0]));
    const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function getLoadAvg(): number[] {
    return readFileSync('/proc/loadavg', 'utf-8').split(' ').slice(0, 3).map(Number);
}

function getNetworkRx(): string {
    try {
        const devs = readFileSync('/proc/net/dev', 'utf-8').split('\n').slice(2);
        let bytes = 0;
        for (const line of devs) {
            const p = line.trim().split(/\s+/);
            if (!p[0] || p[0] === 'lo:') continue;
            bytes += parseInt(p[1]) || 0;
        }
        if (bytes > 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
        if (bytes > 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
        return `${(bytes / 1024).toFixed(0)} KB`;
    } catch {
        return 'N/A';
    }
}

function readNetworkBytes(): { rx: number; tx: number } {
    try {
        const devs = readFileSync('/proc/net/dev', 'utf-8').split('\n').slice(2);
        let rx = 0;
        let tx = 0;
        for (const line of devs) {
            const p = line.trim().split(/\s+/);
            if (!p[0] || p[0] === 'lo:') continue;
            rx += parseInt(p[1]) || 0;
            tx += parseInt(p[9]) || 0;
        }
        return { rx, tx };
    } catch {
        return { rx: 0, tx: 0 };
    }
}

function updateBandwidth(): void {
    const { rx, tx } = readNetworkBytes();
    if (hasPrevNetwork) {
        const rxDelta = Math.max(0, rx - prevRxBytes);
        const txDelta = Math.max(0, tx - prevTxBytes);
        const rxKBps = Math.round((rxDelta / (INTERVAL / 1000)) / 1024 * 100) / 100;
        const txKBps = Math.round((txDelta / (INTERVAL / 1000)) / 1024 * 100) / 100;
        rxBandwidthHistory.push(rxKBps);
        txBandwidthHistory.push(txKBps);
        if (rxBandwidthHistory.length > HISTORY_LEN) rxBandwidthHistory.shift();
        if (txBandwidthHistory.length > HISTORY_LEN) txBandwidthHistory.shift();
    }
    prevRxBytes = rx;
    prevTxBytes = tx;
    hasPrevNetwork = true;
}

function getProcessCount(): number {
    try {
        return parseInt(execSync('ls /proc | grep -c "^[0-9]"').toString().trim());
    } catch {
        return 0;
    }
}

const flux = new Flux({ url: LUX_URL, name: `${COLLECTOR_ID}-collector` });

flux.expose('collect', {
    description: 'Collect current system metrics from this machine',
    schema: z.object({}),
    async handler() {
        return buildPayload();
    },
});

await flux.start();
await flux.join('metrics');

getCpuUsage();
const initNet = readNetworkBytes();
prevRxBytes = initNet.rx;
prevTxBytes = initNet.tx;
await new Promise((r) => setTimeout(r, 100));

console.log(`${COLLECTOR_NAME} collector online, pushing metrics every ${INTERVAL / 1000}s`);
console.log(`connected to ${LUX_URL}`);

function buildPayload() {
    const cpu = getCpuUsage();
    const temp = getCpuTemp();
    const mem = getMemory();
    const disk = getDisk();
    const load = getLoadAvg();

    cpuHistory.push(cpu);
    if (cpuHistory.length > HISTORY_LEN) cpuHistory.shift();
    tempHistory.push(temp);
    if (tempHistory.length > HISTORY_LEN) tempHistory.shift();

    updateBandwidth();

    const rxMax = rxBandwidthHistory.length > 0 ? Math.max(10, ...rxBandwidthHistory) : 10;
    const txMax = txBandwidthHistory.length > 0 ? Math.max(10, ...txBandwidthHistory) : 10;

    return {
        service: {
            id: COLLECTOR_ID,
            name: COLLECTOR_NAME,
            icon: 'server',
            color: '#a855f7',
            status: cpu > 85 ? 'degraded' : 'healthy',
        },
        cards: [
            { id: 'cpu', title: 'CPU Usage', type: 'metric', size: 'sm', order: 0, data: { value: cpu, unit: '%', thresholds: { warn: 60, crit: 85 } } },
            { id: 'temp', title: 'CPU Temp', type: 'metric', size: 'sm', order: 1, data: { value: temp, unit: '\u00b0C', thresholds: { warn: 75, crit: 90 } } },
            { id: 'memory', title: 'Memory', type: 'progress', size: 'md', order: 2, data: { value: mem.used, max: mem.total, label: `${mem.used}/${mem.total} MB` } },
            { id: 'disk', title: 'Disk', type: 'progress', size: 'md', order: 3, data: { value: disk.used, max: disk.total, label: `${(disk.used / 1024).toFixed(0)}/${(disk.total / 1024).toFixed(0)} GB` } },
            { id: 'sys', title: 'System', type: 'table', size: 'lg', order: 4, data: { rows: [{ key: 'Uptime', value: getUptime() }, { key: 'Load', value: load.map((l) => l.toFixed(2)).join('  ') }, { key: 'Processes', value: getProcessCount().toString() }, { key: 'Network RX', value: getNetworkRx() }] } },
            { id: 'cpu-hist', title: 'CPU History', type: 'timeseries', size: 'md', order: 5, data: { points: [...cpuHistory], unit: '%', max: 100, min: 0 } },
            { id: 'temp-hist', title: 'Temp History', type: 'timeseries', size: 'md', order: 6, data: { points: [...tempHistory], unit: '\u00b0C', max: 100, min: 20 } },
            { id: 'net-rx', title: 'Network RX', type: 'timeseries', size: 'md', order: 7, data: { points: [...rxBandwidthHistory], unit: 'KB/s', max: rxMax, min: 0 } },
            { id: 'net-tx', title: 'Network TX', type: 'timeseries', size: 'md', order: 8, data: { points: [...txBandwidthHistory], unit: 'KB/s', max: txMax, min: 0 } },
        ],
    };
}

async function tick() {
    try {
        const payload = buildPayload();
        await flux.ctx.set('metrics', `svc:${payload.service.id}`, payload);
    } catch (err) {
        console.error('push error:', (err as Error).message);
    }
}

await tick();
setInterval(tick, INTERVAL);
