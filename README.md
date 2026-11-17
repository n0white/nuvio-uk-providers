# Nuvio UK Providers

Порт українських провайдерів із [CakesTwix/cloudstream-extensions-uk](https://github.com/CakesTwix/cloudstream-extensions-uk) у формат нативних JS-плагінів для **Nuvio** (`NuvioMobile` / `NuvioTV`).

## Провайдери в репозиторії

- **Фільми / серіали / мультфільми / дорами (активні):**
  - `Eneyida.tv` (`eneyida`), `UAFlix.net` (`uafix`), `UASerials.com` (`uaserials`), `Kinostrain.com` (`kinostrain`), `KinoVezha.tv` (`kinovezha`), `KinoTron.tv` (`kinotron`), `Serialno.tv` (`serialno`), `Цікава Ідея` (`cikava-ideya`), `BambooUA` (`bambooua`), `DoramyWorld` (`doramy`).
- **Аніме (активні):**
  - `AniTube.in.ua` (`anitube`), `AnimeON.club` (`animeon`), `AnimeUA.club` (`animeua`), `Coani.net` (`coani`), `UFDub.com` (`ufdub`), `Unimay.media` (`unimay`).
- **Вимкнені за замовчуванням:**
  - `Uakino.best` (`uakino`) — закритий Cloudflare (`403`), підтримує дзеркало / `cf_clearance` у налаштуваннях.
  - `KlonTV` (`klonua`) — пошук на `klonua.com` тимчасово повертає порожній `#dle-content`.

## Структура проєкту

```text
nuvio-uk-providers/
├── manifest.json          # Маніфест репозиторію для Nuvio
├── build.js               # Збірка esbuild у QuickJS-сумісний формат (IIFE, ES2016)
├── server.js              # Локальний HTTP-сервер для тестування в Nuvio
├── test_providers.js      # Скрипт перевірки провайдерів у Node.js
├── src/                   # Вихідний код провайдерів та спільних утиліт
└── providers/             # Зібрані бандли для Nuvio
```

## Як додати в Nuvio

### Варіант 1: Через GitHub (рекомендовано)
1. Відкрийте **Nuvio → Settings → Plugins → Add Repository** (у версії APK з GitHub Releases, не Google Play).
2. Вставте посилання:
   ```text
   https://raw.githubusercontent.com/n0white/nuvio-uk-providers/main/manifest.json
   ```
3. Оновіть список і користуйтеся потрібними провайдерами.

### Варіант 2: Локальний тест у мережі (Developer Plugin Tester)
1. Запустіть сервер на комп'ютері (`npm start` або `node server.js`).
2. Додайте `http://<ваш-локальний-IP>:3000/manifest.json` у Nuvio.

## Розробка та тестування

```bash
npm install        # Встановити залежності
npm run build      # Зібрати providers/*.js
npm test           # Перевірити getStreams на реальних TMDB ID
```
