/**
 * Local test script for compiled Nuvio UK providers.
 * Usage: node test_providers.js
 */

const anitube = require('./providers/anitube.js');
const uakino = require('./providers/uakino.js');

async function runCase(label, provider, args) {
    const start = Date.now();
    try {
        const streams = await provider.getStreams(...args);
        const ms = Date.now() - start;
        console.log(`\n[${label}] ${streams.length} stream(s) in ${ms} ms`);
        for (const s of streams.slice(0, 5)) {
            console.log(`  - ${s.title} | ${s.quality} | ${s.type} | ${s.url}`);
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
    console.log('Testing compiled providers (providers/anitube.js, providers/uakino.js)...');

    // AniTube tests:
    // 1. Frieren (TMDB TV 209867) S1E1 and S2E1
    await runCase('AniTube: Frieren S1E1', anitube, ['209867', 'tv', 1, 1]);
    await runCase('AniTube: Frieren S2E1', anitube, ['209867', 'tv', 2, 1]);
    // 2. Attack on Titan (TMDB TV 1429) S1E1 and S2E1
    await runCase('AniTube: Attack on Titan S1E1', anitube, ['1429', 'tv', 1, 1]);
    await runCase('AniTube: Attack on Titan S2E1', anitube, ['1429', 'tv', 2, 1]);
    // 3. Spirited Away (TMDB Movie 129)
    await runCase('AniTube: Spirited Away (Movie)', anitube, ['129', 'movie', null, null]);

    // Uakino test:
    await runCase('Uakino: Fight Club (Movie)', uakino, ['550', 'movie', null, null]);
}

main();
