import { Filter, Search } from 'lucide-react';
import { gameAlias, gameShape, gameTypeLabel, renderRtpLabel } from '@/lib/gameCatalog';
import type { GameInfo } from '@/lib/types';

interface LobbyPanelProps {
  algorithmCount: string;
  filteredGames: GameInfo[];
  gameCount: string;
  providerFilter: string;
  providerOptions: string[];
  providerCount: string;
  quickFilters: string[];
  search: string;
  selectedAlias: string;
  selectedGame: GameInfo | null;
  onProviderFilterChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onSelectGame: (game: GameInfo) => void;
}

export function LobbyPanel(props: LobbyPanelProps) {
  const { algorithmCount, filteredGames, gameCount, providerFilter, providerOptions, providerCount, quickFilters,
    search, selectedAlias, selectedGame, onProviderFilterChange, onSearchChange, onSelectGame } = props;

  return (
    <section className="panel panel--lobby" id="lobby">
      <div className="panel__head">
        <h2>Lobby</h2>
        <span className="panel__hint">{gameCount}</span>
      </div>
      <div className="search-row">
        <label className="field field--inline">
          <span>Search</span>
          <div className="search-input">
            <Search size={15} />
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} type="search" placeholder="Provider, game, alias" />
          </div>
        </label>
        <label className="field field--inline">
          <span>Filter</span>
          <div className="search-input">
            <Filter size={15} />
            <select value={providerFilter} onChange={(event) => onProviderFilterChange(event.target.value)}>
              {providerOptions.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </div>
        </label>
      </div>
      <div className="chips">
        {quickFilters.map((filter) => (
          <button key={filter} className={`chip ${providerFilter === filter ? 'is-active' : ''}`} type="button" onClick={() => onProviderFilterChange(filter)}>
            {filter}
          </button>
        ))}
      </div>
      <div className="stats">
        <div className="stat"><div className="label">Algorithms</div><div className="value">{algorithmCount}</div></div>
        <div className="stat"><div className="label">Providers</div><div className="value">{providerCount}</div></div>
        <div className="stat">
          <div className="label">Selected</div>
          <div className="value">{selectedGame ? `${selectedGame.Prov || '?'} / ${selectedGame.Name || '?'}` : 'None'}</div>
        </div>
      </div>
      <div className="game-grid">
        {filteredGames.length ? filteredGames.map((game) => {
          const alias = gameAlias(game);
          return (
            <button key={alias} className={`game-card ${alias === selectedAlias ? 'is-selected' : ''}`} type="button" onClick={() => onSelectGame(game)}>
              <div className="game-card__title">{game.Name || game.name || alias}</div>
              <div className="game-card__meta">{game.Prov || game.prov || 'Unknown provider'}</div>
              <div className="game-card__meta">{gameShape(game)} · {gameTypeLabel(game)} · {renderRtpLabel(game)}</div>
              <div className="game-card__chips">
                <span className="chip chip--soft">{gameTypeLabel(game)}</span>
                <span className="chip chip--soft">{gameShape(game)}</span>
                {(game.RTP || []).slice(0, 2).map((value) => <span key={`${alias}-${value}`} className="chip chip--soft">{Number(value).toFixed(2)}%</span>)}
              </div>
            </button>
          );
        }) : <div className="empty-state">No games match the current filter.</div>}
      </div>
    </section>
  );
}
