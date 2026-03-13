import { spawn, type Subprocess } from 'bun';

interface ShellEntry {
    proc: Subprocess;
    alive: boolean;
}

const shells: Map<object, ShellEntry> = new Map();

export const terminalWebSocket = {
    open(ws: any) {
        const shellUser = process.env.TERMINAL_USER || 'root';
        const proc = spawn(['script', '-qfc', `nsenter -t 1 -m -u -i -n -p -- su - ${shellUser}`, '/dev/null'], {
            stdin: 'pipe',
            stdout: 'pipe',
            stderr: 'pipe',
            env: {
                PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
                TERM: 'xterm-256color',
                HOME: process.env.TERMINAL_HOME || '/root',
            },
        });

        const entry: ShellEntry = { proc, alive: true };
        shells.set(ws, entry);

        const relay = async (stream: ReadableStream<Uint8Array> | null) => {
            if (!stream) return;
            const reader = stream.getReader();
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (!entry.alive) break;
                    try {
                        ws.send(new Buffer(value));
                    } catch { break; }
                }
            } catch {} finally {
                reader.releaseLock();
            }
        };

        relay(proc.stdout as ReadableStream<Uint8Array>);
        relay(proc.stderr as ReadableStream<Uint8Array>);

        proc.exited.then(() => {
            entry.alive = false;
            try { ws.close(); } catch {}
        });
    },

    message(ws: any, data: string | Buffer | ArrayBuffer) {
        const entry = shells.get(ws);
        if (!entry || !entry.alive) return;

        let bytes: Uint8Array;
        if (typeof data === 'string') {
            bytes = new TextEncoder().encode(data);
        } else if (data instanceof ArrayBuffer) {
            bytes = new Uint8Array(data);
        } else {
            bytes = data;
        }

        try {
            entry.proc.stdin.write(bytes);
            entry.proc.stdin.flush();
        } catch {}
    },

    close(ws: any) {
        const entry = shells.get(ws);
        if (!entry) return;
        entry.alive = false;
        try { entry.proc.kill(); } catch {}
        shells.delete(ws);
    },
};
