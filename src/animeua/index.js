import { runDleSiteProvider } from '../utils/dle-site.js';

const CONFIG = {
    providerName: 'AnimeUA',
    mainUrl: 'https://animeua.club',
    cardSelector: 'a.poster',
    useDecodeAndReverse: false,
    playerFormat: 'dub-season-ep',
    playReferer: 'https://tortuga.wtf/',
    getCard($, $el) {
        return {
            title: $el.find('h3.poster__title').first().text().trim(),
            href: $el.attr('href') || $el.find('.fd-column').first().attr('href'),
        };
    },
    getDetail($) {
        const yearMatch = $('.pmovie__year').first().text().match(/\b(19\d{2}|20\d{2})\b/);
        const $iframe = $('.video-responsive > iframe').first();
        const eng = $('.pmovie__original-title').first().text().trim();
        return {
            title: $('.page__subcol-main h1').first().text().trim(),
            extraTitles: eng ? [eng] : [],
            year: yearMatch ? parseInt(yearMatch[1], 10) : null,
            playerUrl: $iframe.attr('data-src') || $iframe.attr('src'),
        };
    },
};

async function getStreams(tmdbId, mediaType, season, episode) {
    return runDleSiteProvider(CONFIG, tmdbId, mediaType, season, episode);
}

module.exports = { getStreams };
