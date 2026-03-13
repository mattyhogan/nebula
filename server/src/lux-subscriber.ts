import { Socket } from 'net';

type Callback = (channel: string, message: string) => void;

export class LuxBufSubscriber {
    private socket: Socket | null = null;
    private host: string;
    private port: number;
    private connected = false;
    private buf = Buffer.alloc(0);
    private listeners = new Map<string, Set<Callback>>();

    constructor(config: { host: string; port: number }) {
        this.host = config.host;
        this.port = config.port;
    }

    async connect(): Promise<void> {
        if (this.connected) return;
        return new Promise((resolve, reject) => {
            this.socket = new Socket();
            this.socket.on('connect', () => { this.connected = true; resolve(); });
            this.socket.on('data', (chunk: Buffer) => {
                this.buf = Buffer.concat([this.buf, chunk]);
                this.drain();
            });
            this.socket.on('error', (err) => { if (!this.connected) reject(err); });
            this.socket.on('close', () => { this.connected = false; });
            this.socket.setNoDelay(true);
            this.socket.connect(this.port, this.host);
        });
    }

    disconnect(): void {
        this.socket?.destroy();
        this.socket = null;
        this.connected = false;
    }

    subscribe(channel: string, callback: Callback): void {
        if (!this.socket || !this.connected) throw new Error('not connected');
        if (!this.listeners.has(channel)) {
            this.listeners.set(channel, new Set());
            const cmd = `*2\r\n$9\r\nSUBSCRIBE\r\n$${Buffer.byteLength(channel)}\r\n${channel}\r\n`;
            this.socket.write(cmd);
        }
        this.listeners.get(channel)!.add(callback);
    }

    unsubscribe(channel: string, callback?: Callback): void {
        if (!this.listeners.has(channel)) return;
        if (callback) {
            this.listeners.get(channel)!.delete(callback);
            if (this.listeners.get(channel)!.size === 0) this.listeners.delete(channel);
        } else {
            this.listeners.delete(channel);
        }
        if (!this.listeners.has(channel) && this.socket && this.connected) {
            const cmd = `*2\r\n$11\r\nUNSUBSCRIBE\r\n$${Buffer.byteLength(channel)}\r\n${channel}\r\n`;
            this.socket.write(cmd);
        }
    }

    private drain(): void {
        while (this.buf.length > 0) {
            const result = this.parseArray(0);
            if (!result) break;
            const [arr, consumed] = result;
            this.buf = this.buf.subarray(consumed);
            if (arr.length >= 3 && arr[0] === 'message') {
                const ch = arr[1] as string;
                const msg = arr[2] as string;
                const cbs = this.listeners.get(ch);
                if (cbs) for (const cb of cbs) cb(ch, msg);
            }
        }
    }

    private parseArray(pos: number): [unknown[], number] | null {
        if (pos >= this.buf.length || this.buf[pos] !== 0x2a) return null;
        const nl = this.buf.indexOf('\r\n', pos);
        if (nl === -1) return null;
        const count = parseInt(this.buf.subarray(pos + 1, nl).toString(), 10);
        if (count <= 0) return [[], nl + 2];

        const arr: unknown[] = [];
        let cursor = nl + 2;

        for (let i = 0; i < count; i++) {
            if (cursor >= this.buf.length) return null;
            const type = this.buf[cursor];

            if (type === 0x24) {
                const bnl = this.buf.indexOf('\r\n', cursor);
                if (bnl === -1) return null;
                const len = parseInt(this.buf.subarray(cursor + 1, bnl).toString(), 10);
                if (len === -1) {
                    arr.push(null);
                    cursor = bnl + 2;
                } else {
                    const dataStart = bnl + 2;
                    const dataEnd = dataStart + len;
                    if (dataEnd + 2 > this.buf.length) return null;
                    arr.push(this.buf.subarray(dataStart, dataEnd).toString('utf-8'));
                    cursor = dataEnd + 2;
                }
            } else if (type === 0x3a) {
                const inl = this.buf.indexOf('\r\n', cursor);
                if (inl === -1) return null;
                arr.push(parseInt(this.buf.subarray(cursor + 1, inl).toString(), 10));
                cursor = inl + 2;
            } else if (type === 0x2b) {
                const snl = this.buf.indexOf('\r\n', cursor);
                if (snl === -1) return null;
                arr.push(this.buf.subarray(cursor + 1, snl).toString());
                cursor = snl + 2;
            } else {
                return null;
            }
        }

        return [arr, cursor];
    }
}
