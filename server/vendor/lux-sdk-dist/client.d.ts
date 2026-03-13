import { EventEmitter } from 'node:events';
import { Subscriber } from './subscriber.js';
import type { LuxConfig, LuxValue, SetOptions } from './types.js';
export declare class Lux extends EventEmitter {
    private config;
    private socket;
    private connected;
    private responses;
    private queue;
    private buf;
    constructor(config?: Partial<LuxConfig>);
    connect(): Promise<void>;
    private tryConnect;
    private setupSocket;
    private flush;
    private encode;
    private send;
    disconnect(): Promise<void>;
    get isConnected(): boolean;
    createSubscriber(): Subscriber;
    ping(message?: string): Promise<string>;
    set(key: string, value: string, options?: SetOptions): Promise<string>;
    get(key: string): Promise<LuxValue>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
    keys(pattern?: string): Promise<string[]>;
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    incrby(key: string, amount: number): Promise<number>;
    expire(key: string, seconds: number): Promise<boolean>;
    ttl(key: string): Promise<number>;
    append(key: string, value: string): Promise<number>;
    dbsize(): Promise<number>;
    flushdb(): Promise<string>;
    save(): Promise<string>;
    info(): Promise<string>;
    publish(channel: string, message: string): Promise<number>;
}
//# sourceMappingURL=client.d.ts.map