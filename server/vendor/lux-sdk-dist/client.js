import net from 'node:net';
import { EventEmitter } from 'node:events';
import { Subscriber } from './subscriber.js';
import { LuxConnectionError, LuxCommandError } from './errors.js';
const DEFAULT_CONFIG = {
    host: '127.0.0.1',
    port: 6379,
    connectTimeout: 5000,
    retryAttempts: 3,
    retryDelay: 1000,
};
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
        const val = buf.subarray(dataStart, dataEnd).toString();
        return { type: 'bulk', raw: val, end: dataEnd + 2 };
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
        return { type: 'array', raw: items.join(','), end: cursor };
    }
    return null;
}
function findCRLF(buf, from) {
    for (let i = from; i < buf.length - 1; i++) {
        if (buf[i] === 0x0d && buf[i + 1] === 0x0a)
            return i;
    }
    return -1;
}
export class Lux extends EventEmitter {
    config;
    socket = null;
    connected = false;
    responses = [];
    queue = [];
    buf = Buffer.alloc(0);
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
            while (true) {
                const result = parseResp(this.buf, 0);
                if (result === null)
                    break;
                this.buf = this.buf.subarray(result.end);
                this.responses.push(result);
            }
            this.flush();
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
    flush() {
        while (this.responses.length > 0 && this.queue.length > 0) {
            const result = this.responses.shift();
            const pending = this.queue.shift();
            if (result.type === 'error') {
                pending.reject(new LuxCommandError('UNKNOWN', result.raw));
            }
            else {
                pending.resolve(result.raw);
            }
        }
    }
    encode(args) {
        let out = `*${args.length}\r\n`;
        for (const arg of args)
            out += `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`;
        return out;
    }
    send(args) {
        if (!this.socket || !this.connected) {
            return Promise.reject(new LuxConnectionError(this.config.host, this.config.port));
        }
        return new Promise((resolve, reject) => {
            this.queue.push({ resolve, reject });
            this.socket.write(this.encode(args));
            if (this.responses.length > 0)
                setImmediate(() => this.flush());
        });
    }
    async disconnect() {
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
            this.connected = false;
        }
    }
    get isConnected() {
        return this.connected;
    }
    createSubscriber() {
        return new Subscriber(this.config);
    }
    async ping(message) {
        return this.send(message ? ['PING', message] : ['PING']);
    }
    async set(key, value, options) {
        const args = ['SET', key, value];
        if (options?.ex !== undefined)
            args.push('EX', options.ex.toString());
        else if (options?.px !== undefined)
            args.push('PX', options.px.toString());
        return this.send(args);
    }
    async get(key) {
        const result = await this.send(['GET', key]);
        return result === '' ? null : result;
    }
    async del(...keys) {
        return parseInt(await this.send(['DEL', ...keys]), 10);
    }
    async exists(...keys) {
        return parseInt(await this.send(['EXISTS', ...keys]), 10);
    }
    async keys(pattern = '*') {
        const result = await this.send(['KEYS', pattern]);
        if (result === '')
            return [];
        return result.split(',');
    }
    async incr(key) {
        return parseInt(await this.send(['INCR', key]), 10);
    }
    async decr(key) {
        return parseInt(await this.send(['DECR', key]), 10);
    }
    async incrby(key, amount) {
        return parseInt(await this.send(['INCRBY', key, amount.toString()]), 10);
    }
    async expire(key, seconds) {
        return (await this.send(['EXPIRE', key, seconds.toString()])) === '1';
    }
    async ttl(key) {
        return parseInt(await this.send(['TTL', key]), 10);
    }
    async append(key, value) {
        return parseInt(await this.send(['APPEND', key, value]), 10);
    }
    async dbsize() {
        return parseInt(await this.send(['DBSIZE']), 10);
    }
    async flushdb() {
        return this.send(['FLUSHDB']);
    }
    async save() {
        return this.send(['SAVE']);
    }
    async info() {
        return this.send(['INFO']);
    }
    async publish(channel, message) {
        return parseInt(await this.send(['PUBLISH', channel, message]), 10);
    }
}
//# sourceMappingURL=client.js.map