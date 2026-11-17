/**
 * Local test script for compiled Nuvio UK providers.
 * Usage: node test_providers.js
 */

async function runCase(label, providerPath, args) {
    const start = Date.now();
    try {
        const provider = require(providerPath);
        const streams = await provider.getStreams(...args);
        const ms = Date.now() - start;
        const first = streams[0]
            ? `${streams[0].name} | ${streams[0].quality} • ${streams[0].language} | ${streams[0].url.slice(0, 70)}`
            : '-';
        console.log(`${label.padEnd(36)} -> ${String(streams.length).padStart(2)} stream(s) (${String(ms).padStart(4)}ms) | ${first}`);
        return streams;
    } catch (e) {
        console.error(`${label.padEnd(36)} -> ERROR: ${e.message}`);
        return [];
    }
}

async function main() {
    console.log('Testing compiled UK providers...\n');

    await Promise.all([
        runCase('AniTube: Frieren S1E1', './providers/anitube.js', ['209867', 'tv', 1, 1]),
        runCase('AniTube: Black Clover S2E7', './providers/anitube.js', ['73223', 'tv', 2, 7]),
        runCase('AnimeON: Frieren S1E1', './providers/animeon.js', ['209867', 'tv', 1, 1]),
        runCase('AnimeUA: Frieren S1E1', './providers/animeua.js', ['209867', 'tv', 1, 1]),
        runCase('Coani: Medalist S1E1', './providers/coani.js', ['237529', 'tv', 1, 1]),
        runCase('Unimay: DAN DA DAN S1E1', './providers/unimay.js', ['240411', 'tv', 1, 1]),
        runCase('UFDub: Aladdin 2 (Movie)', './providers/ufdub.js', ['15969', 'movie', null, null]),
        runCase('Eneyida: Breaking Bad S1E1', './providers/eneyida.js', ['1396', 'tv', 1, 1]),
        runCase('UAFlix: Stranger Things S1E1', './providers/uafix.js', ['66732', 'tv', 1, 1]),
        runCase('UASerials: Fight Club (Movie)', './providers/uaserials.js', ['550', 'movie', null, null]),
        runCase('Kinostrain: Oppenheimer (Movie)', './providers/kinostrain.js', ['872585', 'movie', null, null]),
        runCase('KinoVezha: Dune (Movie)', './providers/kinovezha.js', ['438631', 'movie', null, null]),
        runCase('KinoTron: Oppenheimer (Movie)', './providers/kinotron.js', ['872585', 'movie', null, null]),
        runCase('Serialno: Breaking Bad S1E1', './providers/serialno.js', ['1396', 'tv', 1, 1]),
        runCase('CikavaIdeya: Resident Alien S1E1', './providers/cikava-ideya.js', ['96580', 'tv', 1, 1]),
        runCase('Doramy: Destined with You S1E1', './providers/doramy.js', ['215001', 'tv', 1, 1]),
    ]);

    console.log('\nChecking Pokemon S10E2 (TMDB 60572) false-positive regression...');
    const pokemonChecks = await Promise.all([
        runCase('Pokemon S10E2 [AniTube]', './providers/anitube.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [UAFlix]', './providers/uafix.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [UASerials]', './providers/uaserials.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [Eneyida]', './providers/eneyida.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [KinoVezha]', './providers/kinovezha.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [KinoTron]', './providers/kinotron.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [Serialno]', './providers/serialno.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [AnimeON]', './providers/animeon.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [AnimeUA]', './providers/animeua.js', ['60572', 'tv', 10, 2]),
        runCase('Pokemon S10E2 [Kinostrain]', './providers/kinostrain.js', ['60572', 'tv', 10, 2]),
    ]);

    const allPokemon = pokemonChecks.flat();
    const badPokemon = allPokemon.filter(s =>
        /arceus|хроніки|детектив|пікачу|pokemon_s2|сезон\s*2\b/i.test(`${s.name || ''} ${s.language || ''} ${s.url || ''}`)
    );
    if (badPokemon.length > 0) {
        console.error('\nFAIL: False-positive Pokemon streams found:', badPokemon);
        process.exitCode = 1;
    } else {
        console.log(`\nPASS: 0 false-positive Pokemon movies/wrong seasons (${allPokemon.length} valid S10E2 streams).`);
    }
}

main();
