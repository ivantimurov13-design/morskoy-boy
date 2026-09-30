import { Anchor, Compass, Radar, UserRound, UsersRound, Monitor, ArrowRight, Play, Tablet, Medal, Waves, Globe } from 'lucide-react';
import { MODES } from '../engine.js';
const icons = { compass: Compass, anchor: Anchor, radar: Radar };
export default function Menu({ captain, setCaptain, opponent, setOpponent, mode, setMode, onStart, resume, onResume, stats, onInstall, onMedals, onlineResume, onOnlineResume }) {
  return <main className="menu">
    <div className="hero-art" role="img" aria-label="Игрушечный корабль плывёт к маяку на закате"/>
    <section className="hero-content"><h1>Большое море.<br/>Твои правила.</h1><p className="hero-copy">Собери флот, выбирай цель<br className="desktop-break"/> и стань легендой океана.</p>
      <fieldset className="choice-group"><legend>Твой капитан:</legend><div className="segment">{['Дамир', 'Даня'].map(name => <button key={name} aria-pressed={captain === name} onClick={() => setCaptain(name)}><UserRound/><span>{name}</span></button>)}</div></fieldset>
      <fieldset className="choice-group"><legend>Твой противник:</legend><div className="segment opponent-segment">{[['ai', 'Компьютер', Monitor], ['friend', 'Друг', UsersRound], ['online', 'По сети', Globe]].map(([value, title, Icon]) => <button key={value} aria-pressed={opponent === value} onClick={() => setOpponent(value)}><Icon/><span>{title}</span></button>)}</div></fieldset>
    </section>
    <div className="modes" role="group" aria-label="Режим игры">{Object.entries(MODES).map(([key, value]) => { const Icon = icons[value.icon]; return <button key={key} className={`mode ${mode === key ? 'selected' : ''}`} aria-pressed={mode === key} onClick={() => setMode(key)}><Icon className="mode-icon"/><span><strong>{value.title}</strong><small>{value.subtitle}</small></span></button>; })}</div>
    <div className="launch"><p className="mode-detail">{MODES[mode].detail}{opponent === 'friend' ? ' · по очереди на одном устройстве' : opponent === 'online' ? ' · каждый на своём устройстве' : ''}</p><button className="primary start" onClick={onStart}>{opponent === 'online' ? 'Играть по сети' : 'Начать приключение'} <ArrowRight/></button>{resume && <button className="resume" onClick={onResume}><Play size={18}/> Продолжить сохранённый бой</button>}{onlineResume && <button className="resume" onClick={onOnlineResume}><Globe size={18}/> Вернуться в сетевой бой</button>}</div>
    <footer className="menu-footer"><span><Waves size={23}/> Без рекламы. Только море и приключения.</span><div><button onClick={onMedals}><Medal size={18}/> Мои награды{stats[captain]?.wins ? ` · ${stats[captain].wins}` : ''}</button><button onClick={onInstall}><Tablet size={18}/> На iPad</button></div></footer>
  </main>;
}
