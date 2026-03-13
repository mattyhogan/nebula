import { EventEmitter } from 'node:events';
import type { LuxConfig, ChannelHandler } from './types.js';
export declare class Subscriber extends EventEmitter {
    private config;
    private socket;
    private connected;
    private buf;
    private channels;
    private pendingConfirms;
    constructor(config?: Partial<LuxConfig>);
    connect(): Promise<void>;
    private tryConnect;
    private setupSocket;
    private processBuffer;
    private encode;
    private sendRaw;
    subscribe(channel: string, handler: ChannelHandler): Promise<void>;
    subscribe(channels: string[], handler: ChannelHandler): Promise<void>;
    unsubscribe(channel?: string | string[]): Promise<void>;
    get activeChannels(): string[];
    get channelCount(): number;
    get isConnected(): boolean;
    close(): Promise<void>;
}
//# sourceMappingURL=subscriber.d.ts.map