import net from 'node:net';
import { EventEmitter } from 'node:events';
import { LuxConnectionError } from './errors.js';
const DEFAULT_CONFIG = {
    host: '127.0.0.1',
    port: 6379,
    connectTimeout: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
};
function findCRLF(buf, from) {
    for (let i = from; i < buf.length - 1; i++) {
        if (buf[i] === 0x0d && buf[i + 1] === 0x0a)
            return i;
    }
    return -1;
}
function parseResp(buf, pos) {
    if (pos >= buf.length)
        return null;
    const ch = buf[pos];
    if (ch === 0x2b || ch === 0x2d || ch === 0x3a) {
        const lineEnd = findCRLF(buf, pos);
        if (lineEnd === -1)
            return null;
        const val = buf.subarray(pos + 1, lineEnd).toString();
        const type = ch === 0x2d ? 'error' : ch === 0x3a ? 'integer' : 'simple';
        return { type, raw: val, end: lineEnd + 2 };
    }
    if (ch === 0x24) {
        const lineEnd = findCRLF(buf, pos);
        if (lineEnd === -1)
            return null;
        const len = parseInt(buf.subarray(pos + 1, lineEnd).toString(), 10);
        if (len === -1)
            return { type: 'null', raw: '', end: lineEnd + 2 };
        const dataStart = lineEnd + 2;
        const dataEnd = dataStart + len;
        if (buf.length < dataEnd + 2)
            return null;
        return {
            type: 'bulk',
            raw: buf.subarray(dataStart, dataEnd).toString(),
            end: dataEnd + 2,
        };
    }
    if (ch === 0x2a) {
        const lineEnd = findCRLF(buf, pos);
        if (lineEnd === -1)
            return null;
        const count = parseInt(buf.subarray(pos + 1, lineEnd).toString(), 10);
        if (count === -1)
            return { type: 'null', raw: '', end: lineEnd + 2 };
        let cursor = lineEnd + 2;
        const items = [];
        for (let i = 0; i < count; i++) {
            const item = parseResp(buf, cursor);
            if (item === null)
                return null;
            items.push(item.raw);
            cursor = item.end;
        }
        return { type: 'array', raw: JSON.stringify(items), end: cursor };
    }
    return null;
}
export class Subscriber extends EventEmitter {
    config;
    socket = null;
    connected = false;
    buf = Buffer.alloc(0);
    channels = new Map();
    pendingConfirms = [];
    constructor(config) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    async connect() {
        if (this.connected)
            return;
        const { host, port, connectTimeout, retryAttempts, retryDelay } = this.config;
        for (let attempt = 0; attempt <= (retryAttempts ?? 3); attempt++) {
            try {
                await this.tryConnect(host, port, connectTimeout ?? 5000);
                this.connected = true;
                this.emit('connect');
                return;
            }
            catch (err) {
                if (attempt < (retryAttempts ?? 3)) {
                    await new Promise((r) => setTimeout(r, retryDelay ?? 1000));
                }
                else {
                    throw new LuxConnectionError(host, port, err);
                }
            }
        }
    }
    tryConnect(host, port, timeout) {
        return new Promise((resolve, reject) => {
            const socket = net.createConnection({ host, port });
            const timer = setTimeout(() => {
                socket.destroy();
                reject(new Error('Connection timed out'));
            }, timeout);
            socket.on('connect', () => {
                clearTimeout(timer);
                socket.setNoDelay(true);
                this.socket = socket;
                this.setupSocket();
                resolve();
            });
            socket.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    setupSocket() {
        if (!this.socket)
            return;
        this.socket.on('data', (data) => {
            this.buf = Buffer.concat([this.buf, data]);
            this.processBuffer();
        });
        this.socket.on('close', () => {
            this.connected = false;
            this.socket = null;
            this.emit('disconnect');
        });
        this.socket.on('error', (err) => {
            this.emit('error', err);
        });
    }
    processBuffer() {
        while (true) {
            const result = parseResp(this.buf, 0);
            if (result === null)
                break;
            this.buf = this.buf.subarray(result.end);
            if (result.type !== 'array')
                continue;
            let items;
            try {
                items = JSON.parse(result.raw);
            }
            catch {
                continue;
            }
            const [kind, channel, data] = items;
            if (kind === 'message') {
                const handlers = this.channels.get(channel);
                if (handlers) {
                    for (const handler of handlers) {
                        handler(data);
                    }
                }
                this.emit('message', channel, data);
            }
            else if (kind === 'subscribe' || kind === 'unsubscribe') {
                const confirm = this.pendingConfirms.shift();
                if (confirm)
                    confirm();
            }
        }
    }
    encode(args) {
        let out = `*${args.length}\r\n`;
        for (const arg of args) {
            out += `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`;
        }
        return out;
    }
    sendRaw(args) {
        return new Promise((resolve, reject) => {
            if (!this.socket || !this.connected) {
                return reject(new LuxConnectionError(this.config.host, this.config.port));
            }
            this.pendingConfirms.push(resolve);
            this.socket.write(this.encode(args), (err) => {
                if (err)
                    reject(err);
            });
        });
    }
    async subscribe(channels, handler) {
        const list = Array.isArray(channels) ? channels : [channels];
        for (const ch of list) {
            const handlers = this.channels.get(ch) ?? [];
            handlers.push(handler);
            this.channels.set(ch, handlers);
        }
        for (const ch of list) {
            await this.sendRaw(['SUBSCRIBE', ch]);
        }
    }
    async unsubscribe(channel) {
        if (!channel) {
            const all = Array.from(this.channels.keys());
            for (const ch of all) {
                await this.sendRaw(['UNSUBSCRIBE', ch]);
            }
            this.channels.clear();
            return;
        }
        const list = Array.isArray(channel) ? channel : [channel];
        for (const ch of list) {
            await this.sendRaw(['UNSUBSCRIBE', ch]);
            this.channels.delete(ch);
        }
    }
    get activeChannels() {
        return Array.from(this.channels.keys());
    }
    get channelCount() {
        return this.channels.size;
    }
    get isConnected() {
        return this.connected;
    }
    async close() {
        if (this.channels.size > 0) {
            await this.unsubscribe();
        }
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
            this.connected = false;
        }
        this.removeAllListeners();
    }
}
//# sourceMappingURL=subscriber.js.map