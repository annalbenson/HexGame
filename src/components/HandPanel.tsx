import { CREATURE_TEMPLATES } from '../game/creatures'
import type { GameAction } from '../game/gameReducer'
import type { GameState } from '../game/types'

interface HandPanelProps {
  state: GameState
  dispatch: (action: GameAction) => void
}

export function HandPanel({ state, dispatch }: HandPanelProps) {
  const mana = state.mana[state.activePlayer]

  return (
    <div id="hand-panel">
      <div className={`turn-banner turn-${state.activePlayer}`}>
        Turn {state.turnNumber} — {state.activePlayer === 'orange' ? 'Orange' : 'Purple'} ({mana} mana)
      </div>
      <div id="cards">
        {CREATURE_TEMPLATES.map((template) => {
          const isSelected = state.selection?.type === 'card' && state.selection.templateId === template.id
          const affordable = mana >= template.cost
          return (
            <button
              key={template.id}
              className={`card${isSelected ? ' selected' : ''}`}
              disabled={!affordable}
              onClick={() => dispatch({ type: 'SELECT_CARD', templateId: template.id })}
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
