export class LuxError extends Error {
    constructor(message) {
        super(message);
        this.name = 'LuxError';
    }
}
export class LuxConnectionError extends LuxError {
    constructor(host, port, cause) {
        super(`Failed to connect to Lux at ${host}:${port}${cause ? ` - ${cause.message}` : ''}`);
        this.name = 'LuxConnectionError';
    }
}
export class LuxCommandError extends LuxError {
    command;
    constructor(command, message) {
        super(`[${command}] ${message}`);
        this.name = 'LuxCommandError';
        this.command = command;
    }
}
//# sourceMappingURL=errors.js.map