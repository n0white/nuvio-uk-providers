import { runDleSiteProvider } from '../utils/dle-site.js';

const CONFIG = {
    providerName: 'KinoTron',
    mainUrl: 'https://kinotron.tv',
    searchUrl: 'https://kinotron.tv/index.php?do=search',
    cardSelector: '.th-item',
    useDecodeAndReverse: false,
    playerFormat: 'dub-season-ep',
    playReferer: 'https://tortuga.wtf/',
    getCard($, $el) {
        return {
            title: $el.find('.th-title').first().text().trim(),
            href: $el.find('.th-in').first().attr('href') || $el.find('a').first().attr('href'),
        };
    },
    getDetail($) {
        const yearStr = $('.flist li').eq(0).find('a').first().text().trim();
        const $iframe = $('div.video-box iframe').first();
        return {
            title: $('.full h1').first().text().trim(),
            year: /^\d{4}$/.test(yearStr) ? parseInt(yearStr, 10) : null,
            playerUrl: $iframe.attr('data-src') || $iframe.attr('src'),
        };
    },
};

async function getStreams(tmdbId, mediaType, season, episode) {
    return runDleSiteProvider(CONFIG, tmdbId, mediaType, season, episode);
}

module.exports = { getStreams };
