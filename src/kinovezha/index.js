import { runDleSiteProvider } from '../utils/dle-site.js';

const CONFIG = {
    providerName: 'KinoVezha',
    mainUrl: 'https://kinovezha.tv',
    cardSelector: '.movie-item',
    useDecodeAndReverse: true,
    playerFormat: 'season-ep',
    playReferer: 'https://tortuga.wtf/',
    getCard($, $el) {
        return {
            title: $el.find('.movie-item__title').first().text().trim(),
            href: $el.find('.movie-item__link').first().attr('href') || $el.find('a').first().attr('href'),
        };
    },
    getDetail($) {
        const yearStr = $('.inner-page__list li').eq(0).find('a').first().text().trim();
        return {
            title: $('.inner-page__title').first().text().trim(),
            year: /^\d{4}$/.test(yearStr) ? parseInt(yearStr, 10) : null,
            playerUrl: $('.video-responsive > iframe').first().attr('src') || $('.video-responsive iframe').first().attr('data-src'),
        };
    },
};

async function getStreams(tmdbId, mediaType, season, episode) {
    return runDleSiteProvider(CONFIG, tmdbId, mediaType, season, episode);
}

module.exports = { getStreams };
