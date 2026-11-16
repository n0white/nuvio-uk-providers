# Nuvio UK Providers

Порт українських провайдерів із [CakesTwix/cloudstream-extensions-uk](https://github.com/CakesTwix/cloudstream-extensions-uk) у формат нативних JS-плагінів для **Nuvio** (`NuvioMobile` / `NuvioTV`).

## Провайдери в репозиторії

- **AniTube.in.ua** (`anitube`) — аніме фільми та серіали (Ashdi, MoonAnime, FenixPlay, Tortuga, CSST).
- **Eneyida.tv** (`eneyida`) — фільми, серіали, мультфільми та аніме.
- **UAFlix.net** (`uafix`) — фільми, серіали, дорами та мультфільми.
- **UASerials.com** (`uaserials`) — серіали, фільми та аніме.
- **Uakino.best** (`uakino`, вимкнений за замовчуванням) — потребує дзеркало або `cf_clearance` через захист Cloudflare.

## Структура проєкту

```text
nuvio-uk-providers/
├── manifest.json          # Маніфест репозиторію для Nuvio
├── build.js               # Збірка esbuild у QuickJS-сумісний формат (IIFE, ES2016)
├── server.js              # Локальний HTTP-сервер для тестування в Nuvio
├── test_providers.js      # Скрипт перевірки провайдерів у Node.js
├── src/
│   ├── anitube/index.js
│   ├── eneyida/index.js
│   ├── uafix/index.js
│   ├── uaserials/index.js
│   ├── uakino/index.js
│   └── utils/             # Спільні утиліти (TMDB/AniList/Kitsu, matching, PlayerJS, extractors)
└── providers/             # Зібрані бандли для Nuvio
```

## Як додати в Nuvio

### Варіант 1: Через GitHub (рекомендовано)
1. Завантажте цей репозиторій (разом із папкою `providers/` та файлом `manifest.json`) у свій GitHub-репозиторій.
2. У додатку **Nuvio** відкрийте **Settings → Plugins** (Налаштування → Плагіни).
3. Вставте посилання на raw `manifest.json`:
   ```text
   https://raw.githubusercontent.com/<ваш-логін>/<ваш-репо>/main/manifest.json
   ```
4. Оновіть список і увімкніть **AniTube.in.ua** та **Uakino.best**.

### Варіант 2: Локальний тест у мережі (Developer Plugin Tester)
1. Запустіть сервер на комп'ютері:
   ```bash
   npm start
   ```
2. Сервер виведе адресу виду `http://192.168.x.x:3000/manifest.json`.
3. Вставте її у **Nuvio → Settings → Plugins** або **Developer → Plugin Tester** (пристрій та ПК мають бути в одній Wi-Fi мережі).

## Важливо щодо Uakino (`uakino.best`) та Cloudflare
На відміну від CloudStream (де є вбудований WebView `CloudflareKiller`), JS-плагіни в Nuvio виконують HTTP-запити напряму через QuickJS + OkHttp.
- `anitube.in.ua` працює напряму без Cloudflare (HTTP 200).
- `uakino.best` часто захищений Cloudflare (віддає `403 Just a moment...` на автоматичні запити). Якщо у вашій мережі `uakino.best` блокується, відкрийте налаштування плагіна **Uakino.best** у Nuvio (`hasSettings: true`) та вкажіть:
  - **Базовий URL (дзеркало)** — якщо використовуєте власний проксі/дзеркало; або
  - **Cookie (`cf_clearance=...`)** і відповідний **User-Agent** з вашого браузера.

## Розробка та тестування

```bash
npm install        # Встановити залежності
npm run build      # Зібрати providers/*.js
npm run build:minify
npm test           # Перевірити getStreams на реальних TMDB ID
```
