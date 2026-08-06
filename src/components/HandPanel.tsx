import { getTemplate } from '../game/creatures'
import type { GameAction } from '../game/gameReducer'
import type { GameState, PlayerId } from '../game/types'

interface HandPanelProps {
  state: GameState
  dispatch: (action: GameAction) => void
}

const PLAYER_LABEL: Record<PlayerId, string> = { orange: 'Orange', purple: 'Purple' }

export function HandPanel({ state, dispatch }: HandPanelProps) {
  const active = state.players[state.activePlayer]

  return (
    <div id="hand-panel">
      <div className={`turn-banner turn-${state.activePlayer}`}>
        Turn {state.turnNumber} — {PLAYER_LABEL[state.activePlayer]} ({active.mana} mana)
      </div>
      <div id="deck-status">
        {(['orange', 'purple'] as PlayerId[]).map((id) => (
          <span key={id} className={`deck-count deck-${id}`}>
            {PLAYER_LABEL[id]}: {state.players[id].hand.length} in hand, {state.players[id].deck.length} in deck
          </span>
        ))}
      </div>
      <div id="cards">
        {active.hand.length === 0 && <div className="empty-hand">No cards in hand</div>}
        {active.hand.map((card) => {
          const template = getTemplate(card.templateId)
          const isSelected = state.selection?.type === 'card' && state.selection.instanceId === card.instanceId
          const affordable = active.mana >= template.cost
          return (
            <button
              key={card.instanceId}
              className={`card${isSelected ? ' selected' : ''}`}
              disabled={!affordable}
              onClick={() => dispatch({ type: 'SELECT_CARD', instanceId: card.instanceId })}
            >
              <div className="card-name">{template.name}</div>
              <div className="card-stats">
                {template.power}/{template.toughness} · move {template.movement}
              </div>
              <div className="card-cost">{template.cost} mana</div>
            </button>
          )
        })}
      </div>
      <button id="end-turn" onClick={() => dispatch({ type: 'END_TURN' })}>
        End Turn
      </button>
    </div>
  )
}
