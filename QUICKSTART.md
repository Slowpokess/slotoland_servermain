# 🚀 Quick Start Guide - Slotopol Server

## ✅ Что уже сделано

Сервер успешно собран и запущен! Вот текущее состояние:

- **Бинарный файл:** `./slot-server` (35MB)
- **Порт:** 8080
- **База данных:** SQLite в памяти (`:memory:`)
- **Статус:** ✅ Работает

## 📡 Проверка работы сервера

```bash
# Проверить, что сервер отвечает
curl -i http://localhost:8080/ping

# Получить список всех игр
curl "http://localhost:8080/game/list?inc=all" | head -100

# Получить алгоритмы игр
curl http://localhost:8080/game/algs | head -100
```

## 👤 Тестовые пользователи (только dev/demo)

Dev/demo seed может создать тестовые аккаунты автоматически. Не переносите их
пароли в production и не храните credentials в документации. Для локальной
проверки передайте email и пароль через переменные окружения:

```bash
export EMAIL="player@example.org"
export SECRET="<локальный demo-пароль>"
```

## 🔐 Авторизация

### Способ 1: Через Basic Auth (простой)

```bash
# Войти как локальный demo-пользователь
curl -X POST http://localhost:8080/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"secret\":\"$SECRET\"}"
```

**Ответ:**

```json
{
  "uid": 3,
  "email": "player@example.org",
  "access": "<access-token-from-signin>",
  "refresh": "<refresh-token-from-signin>",
  "expire": "2026-01-10T06:38:00Z",
  "living": "2026-01-12T06:38:00Z"
}
```

### Способ 2: Через JWT Token

```bash
# Сохранить токен из ответа /signin в переменную
TOKEN="<token-from-signin>"

# Использовать токен для запросов
curl -X POST http://localhost:8080/game/new \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cid":1,"uid":3,"alias":"Novomatic/Joker Dolphin"}'
```

## 🎮 Создание игры

```bash
# Сначала войдите и получите токен
TOKEN=$(curl -s -X POST http://localhost:8080/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"secret\":\"$SECRET\"}" \
  | jq -r '.access')

# Создать новую игру
curl -X POST http://localhost:8080/game/new \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "cid": 1,
    "uid": 3,
    "alias": "Novomatic/Joker Dolphin"
  }'
```

**Ответ:**

```json
{
  "gid": 1,
  "state": "opened",
  "game": {
    "alias": "novomatic/jokerdolphin",
    "screen": [[1,2,3,4,5],[6,7,8,9,10],[11,12,13,14,15]],
    "bet": 1,
    "sel": 5,
    "wallet": 1000
  },
  "wallet": 1000
}
```

## 🎰 Игра - Крутить слоты

```bash
GID=1
TOKEN="your-token-here"

# Сделать спин
curl -X POST http://localhost:8080/slot/spin \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"gid\":$GID}"

# Изменить ставку
curl -X POST http://localhost:8080/slot/bet/set \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"gid\":$GID,\"bet\":2}"

# Удвоить выигрыш (double-up)
curl -X POST http://localhost:8080/slot/doubleup \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"gid\":$GID,\"mult\":2}"

# Собрать выигрыш
curl -X POST http://localhost:8080/slot/collect \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"gid\":$GID}"
```

## 🎲 Пример полного цикла игры

```bash
#!/bin/bash

# 1. Войти
RESP=$(curl -s -X POST http://localhost:8080/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"secret\":\"$SECRET\"}")

TOKEN=$(echo $RESP | jq -r '.access')
echo "Token: $TOKEN"

# 2. Создать игру
RESP=$(curl -s -X POST http://localhost:8080/game/new \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"cid":1,"uid":3,"alias":"Novomatic/Joker Dolphin"}')

GID=$(echo $RESP | jq -r '.gid')
WALLET=$(echo $RESP | jq -r '.wallet')
echo "Game ID: $GID, Wallet: $WALLET"

# 3. Сделать 5 спинов
for i in {1..5}; do
  RESP=$(curl -s -X POST http://localhost:8080/slot/spin \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"gid\":$GID}")

  GAIN=$(echo $RESP | jq -r '.gain // 0')
  WALLET=$(echo $RESP | jq -r '.wallet')
  echo "Spin $i: Gain=$GAIN, Wallet=$WALLET"
  sleep 1
done
```

## 📊 Доступные игры

Получить список всех игр:

```bash
# Все игры
curl "http://localhost:8080/game/list?inc=all" | jq '.list | length'

# Только Novomatic
curl "http://localhost:8080/game/list?inc=novomatic" | jq '.list[:3]'

# Только NetEnt
curl "http://localhost:8080/game/list?inc=netent" | jq '.list[:3]'

# Игры с RTP > 95%
curl "http://localhost:8080/game/list?inc=all" | jq '.list[] | select(.rtp > 95)'
```

## 🛠️ Управление сервером

### Остановить сервер

```bash
# Найти процесс
ps aux | grep slot-server

# Убить процесс
kill 18295
```

### Перезапустить сервер

```bash
# Остановить
kill 18295

# Запустить снова
./slot-server -v web
```

### Запуск в фоне

```bash
# Запустить в фоне с логами
nohup ./slot-server -v web > server.log 2>&1 &

# Посмотреть логи
tail -f server.log

# Остановить
kill %1
```

## 🗄️ Работа с базой данных

### Текущая конфигурация (в памяти)

```yaml
database:
  driver-name: sqlite3
  club-source-name: :memory:
  spin-source-name: :memory:
```

**Проблема:** При рестарте все данные теряются!

### Использование файла базы данных

Редактируйте `config/slot-app.yaml`:

```yaml
database:
  driver-name: sqlite3
  club-source-name: slot-club.sqlite
  spin-source-name: slot-spin.sqlite
```

Перезапустите сервер:

```bash
kill 18295
./slot-server -v web
```

Теперь базы данных будут сохраняться в файлах:

- `slot-club.sqlite` - данные пользователей, клубов
- `slot-spin.sqlite` - логи спинов

### MySQL/PostgreSQL

```yaml
database:
  driver-name: mysql
  club-source-name: user:password@tcp(localhost:3306)/slot_club
  spin-source-name: user:password@tcp(localhost:3306)/slot_spin
```

## 📝 Конфигурация

Файл: `config/slot-app.yaml`

### Изменить порт

```yaml
web-server:
  port-http:
  - :9090  # вместо :8080
```

### Выключить логирование спинов

```yaml
database:
  use-spin-log: false
```

### Изменить лимиты

```yaml
gameplay:
  adjunct-limit: 50000      # макс. пополнение
  min-jackpot: 5000         # мин. джекпот
  max-spin-attempts: 500    # макс. попыток спина
```

## 🐛 Поиск проблем

### Проверить, что сервер запущен

```bash
# Проверить процесс
ps aux | grep slot-server

# Проверить порт
lsof -i :8080

# Проверить ответ
curl -v http://localhost:8080/ping
```

### Посмотреть логи

```bash
# Если запущен в фоне
tail -f server.log

# Если запущен напрямую
# Логи выводятся в stdout/stderr
```

### Ошибки

**Ошибка: "connection refused"**

```bash
# Сервер не запущен - запустите его
./slot-server -v web
```

**Ошибка: "filter with name '' does not recognized"**

```bash
# Используйте правильный фильтр
curl "http://localhost:8080/game/list?inc=all"
```

**Ошибка: "authorization is required"**

```bash
# Сначала войдите в систему
curl -X POST http://localhost:8080/signin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"secret\":\"$SECRET\"}"
```

## 📚 Следующие шаги

1. **Изучить API:**
   - Прочитайте `README.md` для полной документации API
   - Изучите `api/routes.go` для всех endpoint'ов

2. **Добавить свою игру:**
   - Создайте Lua скрипт в `helper/prov/`
   - Следуйте паттерну в `helper/lib/`

3. **Фронтенд:**
   - Создайте веб-интерфейс для игры
   - Используйте WebSocket для real-time обновлений

4. **Продакшен:**
   - Используйте Docker: `docker-compose up`
   - Настройте Nginx как reverse proxy
   - Добавьте SSL сертификаты (HTTPS)
   - Настройте мониторинг (Prometheus/Grafana)

## ⚠️ Важные предупреждения

### 🔒 БЕЗОПАСНОСТЬ

**НЕ ИСПОЛЬЗУЙТЕ В ПРОДАКШЕНЕ БЕЗ ИЗМЕНЕНИЙ:**

1. ❌ Пароли хранятся в открытом виде
2. ❌ JWT ключи в репозитории
3. ❌ Нет rate limiting
4. ❌ Нет HTTPS

**Обязательно исправьте перед продакшеном:**

- ✅ Добавить хеширование паролей (bcrypt/scrypt)
- ✅ Перенести секреты в переменные окружения
- ✅ Включить HTTPS
- ✅ Добавить rate limiting
- ✅ Настроить firewall

### 💾 База данных

**По умолчанию используется in-memory база данных:**

- Все данные теряются при рестарте
- Для продакшена используйте MySQL/PostgreSQL
- Настраивайте регулярные бэкапы

## 🎉 Удачи

Сервер готов к работе и тестированию!

Для вопросов и проблем:

- GitHub: <https://github.com/slotopol/server>
- Документация: `README.md`
- Docker: `docs/docker-config.md`
