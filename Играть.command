#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  print 'Для запуска нужен Node.js. Установи LTS с https://nodejs.org и открой этот файл снова.'
  read -k 1
  exit 1
fi
if [[ ! -f dist/index.html ]]; then
  npm install && npm run build || { read -k 1; exit 1; }
fi
if curl -fsS http://localhost:4173/connection.json >/dev/null 2>&1; then
  open http://localhost:4173
  print 'Игра уже работает. Можно закрыть это окно.'
  exit 0
fi
node server.mjs &
game_pid=$!
trap 'kill "$game_pid" 2>/dev/null' EXIT INT TERM
sleep 1
if kill -0 "$game_pid" 2>/dev/null; then
  open http://localhost:4173
  caffeinate -i -w "$game_pid" &
  wait "$game_pid"
fi
