import { Command } from 'commander';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ui, runAction } from '../output.js';
import { findProjectRoot } from '../util.js';

const PANEL_TEMPLATE = (name: string, className: string) => `<script lang="ts">
\tlet { active }: { active?: boolean } = $props();
</script>

<div class="flex h-full flex-col gap-3">
\t<div class="flex items-center justify-center h-full">
\t\t<span class="font-mono text-sm text-text-dim/50">${className}</span>
\t</div>
</div>
`;

export function registerAddPanelCommand(program: Command) {
    program
        .command('add-panel')
        .description('Scaffold a new panel component')
        .argument('<name>', 'Panel name (kebab-case, e.g. my-panel)')
        .option('-c, --category <cat>', 'Panel category (core, integration, tool)', 'integration')
        .option('-f, --feature <key>', 'Feature flag key (optional)')
        .action(runAction(async (name: string, opts) => {
            const root = findProjectRoot();
            const pascal = name
                .split('-')
                .map(w => w[0].toUpperCase() + w.slice(1))
                .join('');
            const className = pascal.endsWith('Panel') ? pascal : pascal + 'Panel';

            const componentPath = join(root, 'frontend/src/lib/hud/components', `${className}.svelte`);
            const registryPath = join(root, 'frontend/src/lib/hud/registry.ts');

            if (existsSync(componentPath)) {
                throw new Error(`${className}.svelte already exists`);
            }

            if (!existsSync(registryPath)) {
                throw new Error('Could not find registry.ts');
            }

            writeFileSync(componentPath, PANEL_TEMPLATE(name, className));

            let registry = readFileSync(registryPath, 'utf-8');

            const lastImportIdx = registry.lastIndexOf('\nimport ');
            const nextNewline = registry.indexOf('\n', lastImportIdx + 1);
            const importLine = `\nimport ${className} from './components/${className}.svelte';`;
            registry = registry.slice(0, nextNewline) + importLine + registry.slice(nextNewline);

            const featureStr = opts.feature ? `, feature: '${opts.feature}'` : '';
            const entry = `\t{ id: '${name}', label: '${name}', component: ${className}, category: '${opts.category}'${featureStr} },`;

            const closingBracket = registry.lastIndexOf('];');
            registry = registry.slice(0, closingBracket) + entry + '\n' + registry.slice(closingBracket);

            writeFileSync(registryPath, registry);

            ui.heading(`Created ${ui.brand(className)}`);
            ui.success(`component: frontend/src/lib/hud/components/${className}.svelte`);
            ui.success(`registry:  added to frontend/src/lib/hud/registry.ts`);
            ui.blank();
            ui.info(`id: ${ui.cyan(name)}`);
            ui.info(`category: ${ui.cyan(opts.category)}`);
            if (opts.feature) ui.info(`feature: ${ui.cyan(opts.feature)}`);
            ui.blank();
        }));
}
