import { Command } from 'commander';
import { execSync } from 'child_process';
import os from 'os';
import chalk from 'chalk';
import { ui, runAction } from '../output.js';

const REPO = 'mattyhogan/nebula';
const VERSION = process.env.NEBULA_VERSION || '0.1.0';

export function registerUpdateCommand(program: Command) {
    program
        .command('update')
        .description('Update nebula CLI to the latest version')
        .option('--check', 'Check for updates without installing')
        .action(runAction(async (opts) => {
            console.log(chalk.dim('Checking for updates...'));

            const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
            if (!response.ok) throw new Error('Could not check for updates');

            const data = await response.json();
            const latestTag = data.tag_name;
            const latestVersion = latestTag?.replace(/^v/, '');

            console.log(`  current: ${ui.cyan(VERSION)}`);
            console.log(`  latest:  ${ui.cyan(latestVersion)}`);

            if (latestVersion === VERSION) {
                ui.blank();
                ui.success('you are on the latest version');
                return;
            }

            if (opts.check) {
                ui.blank();
                ui.warn(`update available! run ${ui.cyan('nebula update')} to install.`);
                return;
            }

            const platform = os.platform();
            const arch = os.arch();
            const osName = platform === 'darwin' ? 'darwin' : 'linux';
            const archName = arch === 'arm64' ? 'arm64' : 'x64';
            const binary = `nebula-${osName}-${archName}`;

            const binaryUrl = `https://github.com/${REPO}/releases/download/${latestTag}/${binary}`;

            let currentPath: string;
            try {
                currentPath = execSync('which nebula', { encoding: 'utf-8' }).trim();
            } catch {
                currentPath = `${os.homedir()}/.local/bin/nebula`;
            }

            const needsSudo = currentPath.startsWith('/usr/local');

            console.log(chalk.dim(`\n  downloading ${binary}...`));
            console.log(chalk.dim(`  installing to ${currentPath}`));

            const installCmd = needsSudo
                ? `curl -fsSL -o /tmp/nebula "${binaryUrl}" && chmod +x /tmp/nebula && sudo mv /tmp/nebula "${currentPath}"`
                : `curl -fsSL -o /tmp/nebula "${binaryUrl}" && chmod +x /tmp/nebula && mv /tmp/nebula "${currentPath}"`;

            execSync(installCmd, { stdio: 'inherit' });

            ui.blank();
            ui.success(`updated to ${ui.cyan(latestVersion)}`);
        }));
}
