import { Gamepad2, Play, Sparkles, WalletCards } from 'lucide-react';
import { ActivityLedger } from '@/components/ActivityLedger';
import type { ActivityItem, GameSession } from '@/lib/types';

const SYMBOLS: Record<number, string> = {
  1: 'A', 2: 'K', 3: 'Q', 4: 'J', 5: '10', 6: '9',
  7: '7', 8: '★', 9: '♦', 10: '♣', 11: '♥', 12: '✦',
};

interface GamePanelProps {
  activity: ActivityItem[];
  bet: number;
  boardCells: unknown[][];
  boardWidth: number;
  gameType?: GameSession['gameType'];
  kenoPicks: string;
  meta: string;
  mult: number;
  pending: { any: boolean; collect: boolean; double: boolean; open: boolean; spin: boolean };
  sel: number;
  state: string;
  title: string;
  onBetChange: (value: number) => void;
  onClearActivity: () => void;
  onCollect: () => void;
  onDouble: () => void;
  onKenoPicksChange: (value: string) => void;
  onMultChange: (value: number) => void;
  onOpen: () => void;
  onSelChange: (value: number) => void;
  onSpin: () => void;
}

export function GamePanel(props: GamePanelProps) {
  const { activity, bet, boardCells, boardWidth, gameType, kenoPicks, meta, mult, pending, sel, state, title,
    onBetChange, onClearActivity, onCollect, onDouble, onKenoPicksChange, onMultChange, onOpen, onSelChange, onSpin } = props;

  return (
    <section className="panel panel--game" id="game" aria-busy={pending.any}>
      <div className="panel__head">
        <h2>Game</h2>
        <span className="panel__hint">{state}</span>
      </div>
      <div className="featured">
        <div className="featured__art" aria-hidden="true"><span>S</span></div>
        <div className="featured__copy">
          <div className="featured__title">{title}</div>
          <div className="featured__meta">{meta}</div>
        </div>
      </div>
      <div className="board-wrap">
        <div className="board" style={{ gridTemplateColumns: boardWidth ? `repeat(${boardWidth}, minmax(0, 1fr))` : undefined }}>
          {boardCells.length ? boardCells.flat().map((cell, index) => {
            const numeric = typeof cell === 'number' ? cell : Number(cell);
            const value = Number.isFinite(numeric) && SYMBOLS[numeric] ? SYMBOLS[numeric] : String(cell || '•');
            return <div className="cell" key={`${index}-${value}`}>{value}</div>;
          }) : <div className="empty-state" style={{ gridColumn: '1 / -1' }}>Open a game to render the board.</div>}
        </div>
      </div>
      <div className="controls">
        <label className="field">
          <span>Bet</span>
          <input value={bet} onChange={(event) => onBetChange(Number(event.target.value || 0))} type="number" min={0} step="0.01" />
        </label>
        {gameType === 'keno' ? (
          <label className="field controls__wide-field">
            <span>Keno numbers</span>
            <input value={kenoPicks} onChange={(event) => onKenoPicksChange(event.target.value)} type="text" inputMode="numeric" placeholder="1, 7, 14, 23" />
          </label>
        ) : (
          <>
            <label className="field">
              <span>Lines / Sel</span>
              <input value={sel} onChange={(event) => onSelChange(Number(event.target.value || 0))} type="number" min={0} step={1} />
            </label>
            <label className="field">
              <span>Multiplier</span>
              <input value={mult} onChange={(event) => onMultChange(Number(event.target.value || 2))} type="number" min={2} step={1} />
            </label>
          </>
        )}
      </div>
      <div className="actions actions--wide">
        <button className="btn btn--primary" type="button" onClick={onOpen} disabled={pending.any}>
          <Gamepad2 size={16} /><span>{pending.open ? 'Opening…' : 'Open selected'}</span>
        </button>
        <button className="btn" type="button" onClick={onSpin} disabled={pending.any}>
          <Play size={16} /><span>{pending.spin ? 'Spinning…' : 'Spin'}</span>
        </button>
        <button className="btn" type="button" onClick={onDouble} disabled={pending.any}>
          <Sparkles size={16} /><span>{pending.double ? 'Doubling…' : 'Double'}</span>
        </button>
        <button className="btn" type="button" onClick={onCollect} disabled={pending.any}>
          <WalletCards size={16} /><span>{pending.collect ? 'Collecting…' : 'Collect'}</span>
        </button>
      </div>
      <ActivityLedger activity={activity} onClear={onClearActivity} />
    </section>
  );
}
