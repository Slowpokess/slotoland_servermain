# Deployment Baseline

Обновлено: 2026-07-07

Цель этого слоя - дать минимальный production-like запуск без ручного хаоса: отдельный PostgreSQL, стабильные секреты, reverse proxy, миграции и понятный backup/restore.

## Базовая схема

- `nginx` принимает внешний HTTP-трафик;
- `slotopol` обслуживает API и health/readiness/metrics;
- `postgres` хранит производственные данные;
- `deploy/slot-app.prod.yaml` фиксирует prod-настройки без `xorm.Sync` на старте.

## Файлы базового контура

- [docker-compose.prod.yml](../docker-compose.prod.yml)
- [deploy/slot-app.prod.yaml](../deploy/slot-app.prod.yaml)
- [deploy/prod.env.example](../deploy/prod.env.example)
- [deploy/nginx.conf](../deploy/nginx.conf)

## Как поднять

1. Скопировать шаблон окружения:

```sh
cp deploy/prod.env.example deploy/prod.env
```

2. Заполнить `deploy/prod.env` реальными значениями:

- `SLOTOPOL_PG_PASSWORD`
- `SLOTOPOL_ACCESS_KEY`
- `SLOTOPOL_REFRESH_KEY`
- при необходимости `SLOTOPOL_BREVO_API_KEY`

3. Положить сертификат домена и приватный ключ вне Git в `deploy/tls/`:

- `deploy/tls/fullchain.pem`
- `deploy/tls/privkey.pem`

Nginx принимает внешний TLS на `443`, а HTTP на `80` перенаправляет на HTTPS.
Не запускайте production Compose без этих двух файлов.

Перед миграцией выполните preflight. Он не печатает значения секретов и
откажется работать с шаблонным env-файлом, короткими JWT-ключами, открытыми
правами `deploy/prod.env` или отсутствующими TLS-файлами:

```sh
bash deploy/check-prod-env.sh deploy/prod.env deploy/tls
```

4. Применить PostgreSQL migrations:

```sh
# Перед первой и каждой последующей migration нужен проверенный backup PostgreSQL.
docker compose --env-file deploy/prod.env -f docker-compose.prod.yml --profile tools run --rm migrate
```

5. Однократно создать production-клуб и администратора. Пароль должен находиться
в отдельном файле вне репозитория с правами `0600`; не передавайте его в аргументах
командной строки и не добавляйте в `deploy/prod.env`:

```sh
docker compose --env-file deploy/prod.env -f docker-compose.prod.yml run --rm --build \
  -v /secure/path/slotopol-admin-password:/run/secrets/admin-password:ro \
  --entrypoint ./slot-server slotopol \
  bootstrap \
  --club-name "Main" \
  --admin-email admin@example.org \
  --admin-name admin \
  --admin-secret-file /run/secrets/admin-password
```

Команда откажется работать не с PostgreSQL и откажется изменять базу, в которой
уже есть клуб или пользователь. Поэтому повторный запуск не создаёт второго
администратора и требует отдельной процедуры восстановления/изменения данных.

6. Поднять сервисы:

```sh
docker compose --env-file deploy/prod.env -f docker-compose.prod.yml up -d --build
```

7. Проверить статус:

- `GET /healthz`
- `GET /readyz`
- `GET /metrics` с admin-auth

После выпуска staging или первого production-контейнера выполните smoke-check
того же домена. Он проверяет health, readiness и выдачу frontend через Nginx:

```sh
bash deploy/smoke-prod.sh https://example.org
```

## Что важно не сломать

- `database.auto-sync` должен оставаться `false` в production;
- `SLOTOPOL_ACCESS_KEY` и `SLOTOPOL_REFRESH_KEY` должны быть постоянными между рестартами;
- `trusted-proxies` должен быть настроен под реальный reverse proxy или ingress;
- `readyz` должен проходить до выпуска трафика на публичный домен.

## Backup

Для PostgreSQL используйте безопасный backup-скрипт. Он создаёт custom-format
дамп с правами файла `0600` и не печатает значения окружения:

```sh
bash deploy/backup-postgres.sh deploy/prod.env docker-compose.prod.yml backups
```

Перед каждой миграцией и релизом храните backup вне сервера приложения и
проверьте, что созданный файл не пустой.

## Restore

Restore разрушительный: сначала остановите application traffic, проверьте
нужный backup и передайте явный `--confirm`:

```sh
bash deploy/restore-postgres.sh backups/slotopol-YYYYMMDDTHHMMSSZ.dump \
  deploy/prod.env docker-compose.prod.yml --confirm
```

## Дополнение по SQLite

SQLite остается dev/demo вариантом. Для production baseline он не используется, поэтому backup/restore для публичного запуска строится вокруг PostgreSQL.
