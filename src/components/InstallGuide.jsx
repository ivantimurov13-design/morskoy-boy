import { useEffect, useState } from 'react';
import { Tablet } from 'lucide-react';
export default function InstallGuide({ connection }) {
  const hosted = import.meta.env.VITE_HOSTED === 'true';
  const [offlineReady, setOfflineReady] = useState(false);
  useEffect(() => {
    let active = true;
    if (hosted && 'serviceWorker' in navigator) navigator.serviceWorker.ready.then(() => { if (active) setOfflineReady(true); });
    return () => { active = false; };
  }, [hosted]);
  const address = hosted ? new URL(import.meta.env.BASE_URL, location.origin).href : connection?.url || (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' ? location.origin : 'Адрес появится после запуска «Играть.command»');
  return <><div className="help-mode"><Tablet/><p>Добавь игру на экран «Домой», и она будет открываться по своей иконке.</p></div><ol className="help-steps">{!hosted && <li>Подключи iPad и этот Mac к одной домашней сети Wi‑Fi.</li>}<li>Открой Safari на iPad и введи адрес:<div className="connection-url">{address}</div>{!hosted && connection?.fallbackUrl && <details><summary>Если адрес не открылся</summary><div className="connection-url">{connection.fallbackUrl}</div></details>}</li><li>Нажми «Поделиться» → «На экран Домой». Если есть переключатель «Открывать как веб‑приложение», включи его. Нажми «Добавить».</li>{hosted && <li>Открой игру с новой иконки при включённом интернете и дождись загрузки.</li>}</ol>{hosted ? <><p className="install-note">Mac больше не нужен. Открывай игру на iPad, телефоне или компьютере по этой ссылке.</p><p className="small-note" role="status">{offlineReady ? 'Игра сохранена для запуска без интернета в этом браузере.' : 'Для первого запуска нужен интернет. Подожди, пока игра сохранится на устройстве.'} После установки открой игру с иконки один раз с интернетом. Браузер может очистить сохранённые файлы — тогда просто открой игру с интернетом снова.</p></> : <><p className="install-note">Mac должен быть включён, а окно запуска игры — открыто. Интернет не нужен, нужна общая Wi‑Fi сеть. В поездке без Mac этот локальный адрес не откроется.</p><p className="small-note">Если подключение не удалось, проверь, что Mac не спит, разрешён входящий доступ для Node.js и оба устройства находятся в обычной, а не гостевой сети.</p></>}</>;
}
