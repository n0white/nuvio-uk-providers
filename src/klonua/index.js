import { runDleSiteProvider } from '../utils/dle-site.js';

const CONFIG = {
    providerName: 'KlonUA',
    mainUrl: 'https://klonua.com',
    cardSelector: '.short-news__slide-item',
    useDecodeAndReverse: false,
    playerFormat: 'dub-season-ep',
    playReferer: 'https://tortuga.wtf/',
    getCard($, $el) {
        const $a = $el.find('.card-link__style, .text-module__main').first();
        return {
            title: $a.text().trim(),
            href: $a.attr('href'),
        };
    },
    getDetail($) {
        let year = null;
        $('.table-info__item').each((_, el) => {
            if ($(el).find('.table__category').text().trim() === 'Рік:') {
                const y = parseInt($(el).find('a').first().text().trim(), 10);
                if (Number.isFinite(y)) year = y;
            }
        });
        const $iframe = $('div.film-player iframe').first();
        return {
            title: $('.seo-h1__position').first().text().trim() || $('h1').first().text().trim(),
            year,
            playerUrl: $iframe.attr('data-src') || $iframe.attr('src'),
        };
    },
};

async function getStreams(tmdbId, mediaType, season, episode) {
    return runDleSiteProvider(CONFIG, tmdbId, mediaType, season, episode);
}

module.exports = { getStreams };
