import { runDleSiteProvider } from '../utils/dle-site.js';

const CONFIG = {
    providerName: 'Serialno',
    mainUrl: 'https://serialno.tv',
    cardSelector: '.th-item',
    useDecodeAndReverse: true,
    playerFormat: 'season-ep',
    playReferer: 'https://tortuga.wtf/',
    getCard($, $el) {
        return {
            title: $el.find('.th-title').first().text().trim(),
            href: $el.find('.th-in').first().attr('href') || $el.find('a').first().attr('href'),
        };
    },
    getDetail($) {
        const yearStr = $('.flist li').eq(1).find('a').first().text().trim();
        return {
            title: $('.full h1').first().text().trim(),
            year: /^\d{4}$/.test(yearStr) ? parseInt(yearStr, 10) : null,
            playerUrl: $('div.video-box iframe').first().attr('src') || $('div.video-box iframe').first().attr('data-src'),
        };
    },
};

async function getStreams(tmdbId, mediaType, season, episode) {
    return runDleSiteProvider(CONFIG, tmdbId, mediaType, season, episode);
}

module.exports = { getStreams };
