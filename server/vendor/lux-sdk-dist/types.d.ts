export interface LuxConfig {
    host: string;
    port: number;
    connectTimeout?: number;
    retryAttempts?: number;
    retryDelay?: number;
}
export interface SetOptions {
    ex?: number;
    px?: number;
}
export interface SubscriptionHandler {
    (channel: string, message: string): void;
}
export type LuxValue = string | null;
export type ChannelHandler = (message: string) => void;
//# sourceMappingURL=types.d.ts.map