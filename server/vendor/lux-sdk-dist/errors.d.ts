export declare class LuxError extends Error {
    constructor(message: string);
}
export declare class LuxConnectionError extends LuxError {
    constructor(host: string, port: number, cause?: Error);
}
export declare class LuxCommandError extends LuxError {
    readonly command: string;
    constructor(command: string, message: string);
}
//# sourceMappingURL=errors.d.ts.map