#!/usr/bin/env node

/**
 * Build script for nuvio-uk-providers.
 * Bundles each provider from src/<provider>/index.js into providers/<provider>.js
 * as a QuickJS-safe IIFE that also works in Node.js (module.exports) and Nuvio (globalThis.getStreams).
 *
 * Usage:
 *   node build.js                 # Build all providers
 *   node build.js eneyida uafix   # Build specific providers
 *   node build.js --minify        # Build all with minification
 */

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const outDir = path.join(__dirname, 'providers');

// Modules provided natively by Nuvio's QuickJS runtime (and installed in node_modules for local Node tests)
const EXTERNAL_MODULES = [
    'cheerio-without-node-native',
    'react-native-cheerio',
    'cheerio',
    'crypto-js',
    'axios'
];

function getProvidersToBuild() {
    const args = process.argv.slice(2).filter(arg => !arg.startsWith('-'));
    if (args.length > 0) return args;

    if (!fs.existsSync(srcDir)) {
        console.error('src/ directory not found.');
        process.exit(1);
    }

    return fs.readdirSync(srcDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name !== 'utils' && !d.name.startsWith('_'))
        .map(d => d.name)
        .sort();
}

async function buildProvider(providerName, minify = false) {
    const entryPoint = path.join(srcDir, providerName, 'index.js');
    const outFile = path.join(outDir, `${providerName}.js`);

    if (!fs.existsSync(entryPoint)) {
        console.warn(`Skipping ${providerName}: no src/${providerName}/index.js`);
        return false;
    }

    try {
        await esbuild.build({
            entryPoints: [entryPoint],
            bundle: true,
            outfile: outFile,
            format: 'iife',
            platform: 'browser',
            target: 'es2016',
            minify,
            sourcemap: false,
            globalName: '__provider',
            external: EXTERNAL_MODULES,
            banner: {
                js: `/**\n * ${providerName} - Nuvio UK Provider (from cloudstream-extensions-uk)\n * Generated: ${new Date().toISOString()}\n */`
            },
            footer: {
                js: [
                    '',
                    'if (typeof module !== "undefined" && module.exports) {',
                    '    module.exports = __provider;',
                    '}',
                    'if (__provider && __provider.getStreams) {',
                    '    if (typeof globalThis !== "undefined") globalThis.getStreams = __provider.getStreams;',
                    '    if (typeof global !== "undefined") global.getStreams = __provider.getStreams;',
                    '    if (typeof self !== "undefined") self.getStreams = __provider.getStreams;',
                    '}'
                ].join('\n')
            },
            logLevel: 'warning'
        });

        const stats = fs.statSync(outFile);
        const sizeKB = (stats.size / 1024).toFixed(1);
        console.log(`OK ${providerName}.js (${sizeKB} KB)`);
        return true;
    } catch (err) {
        console.error(`FAIL ${providerName}:`, err.message);
        return false;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const shouldMinify = args.includes('--minify');
    const providers = getProvidersToBuild();

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log(`Building ${providers.length} provider(s)${shouldMinify ? ' (minified)' : ''}...`);
    let success = 0;
    let failed = 0;

    for (const provider of providers) {
        const ok = await buildProvider(provider, shouldMinify);
        if (ok) success++;
        else failed++;
    }

    console.log(`Done: ${success} built, ${failed} failed/skipped.`);
    if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
