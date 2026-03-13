import { exec } from 'child_process';
import { promisify } from 'util';
import dgram from 'dgram';

const execAsync = promisify(exec);

interface NetworkDevice {
    ip: string;
    hostname: string | null;
    mac: string;
    vendor: string | null;
}

interface NetworkData {
    devices: NetworkDevice[];
    gateway: string | null;
    scanned_at: number;
}

let cache: NetworkData | null = null;
let lastFetch = 0;
const CACHE_TTL = 3 * 60 * 1000;

const MAC_VENDORS: Record<string, string> = {
    'b8:27:eb': 'Raspberry Pi',
    'dc:a6:32': 'Raspberry Pi',
    'e4:5f:01': 'Raspberry Pi',
    'd8:3a:dd': 'Raspberry Pi',
    '2c:cf:67': 'Raspberry Pi',
    '00:14:22': 'Dell',
    'f0:18:98': 'Apple',
    '3c:22:fb': 'Apple',
    'a4:83:e7': 'Apple',
    'ac:de:48': 'Apple',
    '00:1a:2b': 'Apple',
    '78:7b:8a': 'Apple',
    '38:f9:d3': 'Apple',
    'a0:99:9b': 'Apple',
    '14:98:77': 'Apple',
    '00:cd:fe': 'Apple',
    'c8:69:cd': 'Apple',
    '6c:40:08': 'Apple',
    '3c:06:30': 'Apple',
    'f0:d4:e2': 'Apple',
    '8c:85:90': 'Apple',
    '88:66:a5': 'Apple',
    'b0:be:76': 'Samsung',
    '8c:f5:a3': 'Samsung',
    'ac:5f:3e': 'Samsung',
    '00:26:37': 'Samsung',
    '54:60:09': 'Google',
    'f4:f5:d8': 'Google',
    '3c:5a:b4': 'Google',
    'a4:77:33': 'Google',
    '30:fd:38': 'Google',
    '44:07:0b': 'Google',
    'fc:65:de': 'Amazon',
    'a0:02:dc': 'Amazon',
    '74:c2:46': 'Amazon',
    '68:54:fd': 'Amazon',
    '40:b4:cd': 'Amazon',
    '84:d6:d0': 'Intel',
    '00:1e:67': 'Intel',
    '3c:97:0e': 'Intel',
    'a4:c3:f0': 'Intel',
    '00:1b:21': 'Intel',
    'ec:08:6b': 'TP-Link',
    '50:c7:bf': 'TP-Link',
    'c0:25:e9': 'TP-Link',
    '14:cc:20': 'TP-Link',
    'b0:95:75': 'TP-Link',
    'a4:2b:b0': 'Netgear',
    'e0:46:9a': 'Netgear',
    '28:c6:8e': 'Netgear',
    '9c:3d:cf': 'Netgear',
    '20:e5:2a': 'Netgear',
    'cc:40:d0': 'Synology',
    '00:11:32': 'Synology',
    'bc:ee:7b': 'Ubiquiti',
    '78:8a:20': 'Ubiquiti',
    'f4:92:bf': 'Ubiquiti',
    'fc:ec:da': 'Ubiquiti',
    '24:5a:4c': 'Ubiquiti',
    'b4:fb:e4': 'Ubiquiti',
    '00:50:56': 'VMware',
    '00:0c:29': 'VMware',
    '00:15:5d': 'Microsoft (Hyper-V)',
    'dc:a2:66': 'Espressif (ESP)',
    '24:0a:c4': 'Espressif (ESP)',
    '30:ae:a4': 'Espressif (ESP)',
    'a4:cf:12': 'Espressif (ESP)',
    'ec:fa:bc': 'Espressif (ESP)',
};

function lookupVendor(mac: string): string | null {
    const prefix = mac.toLowerCase().slice(0, 8);
    return MAC_VENDORS[prefix] ?? null;
}

function parseArpOutput(output: string): { devices: NetworkDevice[]; gateway: string | null } {
    const devices: NetworkDevice[] = [];
    let gateway: string | null = null;
    const lines = output.split('\n');

    for (const line of lines) {
        const match = line.match(/^(\S+)\s+\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]+)/i);
        if (!match) continue;

        const rawHostname = match[1];
        const ip = match[2];
        const mac = match[3].toLowerCase();

        if (mac === '(incomplete)' || mac === 'ff:ff:ff:ff:ff:ff') continue;

        const hostname = rawHostname === '?' ? null : rawHostname;

        devices.push({
            ip,
            hostname,
            mac,
            vendor: lookupVendor(mac),
        });

        if (ip.endsWith('.1') && !gateway) {
            gateway = ip;
        }
    }

    return { devices, gateway };
}

async function detectGateway(): Promise<string | null> {
    try {
        const isLinux = process.platform === 'linux';
        const cmd = isLinux ? "ip route | grep default | awk '{print $3}' | head -1" : "netstat -rn | grep default | awk '{print $2}' | head -1";
        const { stdout } = await execAsync(cmd, { timeout: 5000 });
        const gw = stdout.trim().split('\n')[0];
        if (gw && /^\d+\.\d+\.\d+\.\d+$/.test(gw)) return gw;
    } catch {}
    return null;
}

async function pingSweep(subnet: string): Promise<void> {
    const base = subnet.replace(/\.\d+$/, '');
    const batch = 32;
    for (let start = 1; start < 255; start += batch) {
        const pings: Promise<void>[] = [];
        for (let i = start; i < Math.min(start + batch, 255); i++) {
            const ip = `${base}.${i}`;
            pings.push(
                execAsync(`ping -c 1 -W 1 ${ip}`, { timeout: 2000 }).then(() => {}).catch(() => {})
            );
        }
        await Promise.all(pings);
    }
}

async function fetchNetwork(): Promise<NetworkData> {
    const now = Date.now();
    if (cache && now - lastFetch < CACHE_TTL) return cache;

    try {
        const gateway = await detectGateway();
        if (!gateway) return Response.json({ devices: [], gateway: null, scanned_at: Date.now() });
        const subnet = gateway;

        await pingSweep(subnet);

        const { stdout } = await execAsync('arp -a', { timeout: 10000 });
        const { devices, gateway: arpGateway } = parseArpOutput(stdout);

        cache = {
            devices,
            gateway: gateway ?? arpGateway,
            scanned_at: Math.floor(now / 1000),
        };
        lastFetch = now;
        return cache;
    } catch (err) {
        console.error('network scan error:', (err as Error).message);
        if (cache) return cache;
        return { devices: [], gateway: null, scanned_at: Math.floor(now / 1000) };
    }
}

fetchNetwork().catch(() => {});

function buildMagicPacket(mac: string): Buffer {
    const macBytes = Buffer.from(mac.replace(/[:\-]/g, ''), 'hex');
    if (macBytes.length !== 6) throw new Error('invalid MAC address');
    const packet = Buffer.alloc(102);
    for (let i = 0; i < 6; i++) packet[i] = 0xff;
    for (let i = 0; i < 16; i++) macBytes.copy(packet, 6 + i * 6);
    return packet;
}

async function sendWol(mac: string): Promise<void> {
    const packet = buildMagicPacket(mac);
    const socket = dgram.createSocket('udp4');
    await new Promise<void>((resolve, reject) => {
        socket.once('error', reject);
        socket.bind(() => {
            socket.setBroadcast(true);
            socket.send(packet, 0, packet.length, 9, '255.255.255.255', (err) => {
                socket.close();
                if (err) reject(err);
                else resolve();
            });
        });
    });
}

export async function handleNetwork(req: Request, path: string): Promise<Response | null> {
    if (req.method === 'GET' && path === '/network') {
        const data = await fetchNetwork();
        return Response.json(data);
    }

    if (req.method === 'POST' && path === '/network/wol') {
        try {
            const body = await req.json() as { mac?: string };
            if (!body.mac || !/^([0-9a-f]{2}[:\-]){5}[0-9a-f]{2}$/i.test(body.mac)) {
                return Response.json({ error: 'invalid or missing mac address' }, { status: 400 });
            }
            await sendWol(body.mac);
            return Response.json({ ok: true, mac: body.mac });
        } catch (err) {
            console.error('wol error:', (err as Error).message);
            return Response.json({ error: 'failed to send WoL packet' }, { status: 500 });
        }
    }

    return null;
}
