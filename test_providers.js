/**
 * Local test script for compiled Nuvio UK providers.
 * Usage: node test_providers.js
 */

const anitube = require('./providers/anitube.js');
const eneyida = require('./providers/eneyida.js');
const uafix = require('./providers/uafix.js');
const uaserials = require('./providers/uaserials.js');

async function runCase(label, provider, args) {
    const start = Date.now();
    try {
        const streams = await provider.getStreams(...args);
        const ms = Date.now() - start;
        console.log(`\n[${label}] ${streams.length} stream(s) in ${ms} ms`);
        for (const s of streams.slice(0, 5)) {
            console.log(`  - ${s.name} | ${s.quality} • ${s.language} | ${s.url}`);
            if (s.subtitles && s.subtitles.length > 0) {
                console.log(`    subs: ${s.subtitles.map(sub => `${sub.name}: ${sub.url}`).join(', ')}`);
            }
        }
        return streams;
    } catch (e) {
        console.error(`[${label}] ERROR:`, e);
        return [];
    }
}

async function main() {
    console.log('Testing compiled UK providers...');

    // AniTube
    await runCase('AniTube: Frieren S1E1', anitube, ['209867', 'tv', 1, 1]);
    await runCase('AniTube: Black Clover S2E7', anitube, ['73223', 'tv', 2, 7]);
    await runCase('AniTube: Spirited Away (Movie)', anitube, ['129', 'movie', null, null]);

    // Eneyida
    await runCase('Eneyida: Fight Club (Movie 550)', eneyida, ['550', 'movie', null, null]);
    await runCase('Eneyida: Breaking Bad S1E1 (1396)', eneyida, ['1396', 'tv', 1, 1]);

    // UAFlix
    await runCase('UAFlix: Fight Club (Movie 550)', uafix, ['550', 'movie', null, null]);
    await runCase('UAFlix: Stranger Things S1E1 (66732)', uafix, ['66732', 'tv', 1, 1]);

    // UASerials
    await runCase('UASerials: Fight Club (Movie 550)', uaserials, ['550', 'movie', null, null]);
    await runCase('UASerials: Breaking Bad S1E1 (1396)', uaserials, ['1396', 'tv', 1, 1]);
}

main();
