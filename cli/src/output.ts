import chalk from 'chalk';

const NEBULA_CYAN = '#4dd8ff';

export const ui = {
    brand: (text: string) => chalk.hex(NEBULA_CYAN).bold(text),
    success: (text: string) => console.log(chalk.green('  ✓ ') + text),
    error: (text: string) => console.error(chalk.red('  ✗ ') + text),
    warn: (text: string) => console.log(chalk.yellow('  ! ') + text),
    info: (text: string) => console.log(chalk.dim('  · ') + text),
    dim: (text: string) => chalk.dim(text),
    cyan: (text: string) => chalk.hex(NEBULA_CYAN)(text),
    heading: (text: string) => console.log('\n' + chalk.bold(text)),
    blank: () => console.log(),
};

export function printCliError(err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    ui.error(msg);
    process.exit(1);
}

export function runAction<TArgs extends unknown[]>(fn: (...args: TArgs) => void | Promise<void>) {
    return async (...args: TArgs) => {
        try {
            await fn(...args);
        } catch (err) {
            printCliError(err);
        }
    };
}
