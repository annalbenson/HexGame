import { useMemo } from 'react'
import { CREATURE_ART } from '../game/art'
import { territoryCounts } from '../game/board'
import { effectiveStats, getTemplate } from '../game/creatures'
import type { GameAction } from '../game/gameReducer'
import type { GameState, PlayerId } from '../game/types'

interface HandPanelProps {
  state: GameState
  dispatch: (action: GameAction) => void
}

const PLAYER_LABEL: Record<PlayerId, string> = { orange: 'Orange', purple: 'Purple' }

function winMessage(state: GameState): string {
  const isDraw = state.winner === 'draw'
  if (state.winReason === 'elimination') {
    return isDraw ? 'Both sides were wiped out — draw!' : `${PLAYER_LABEL[state.winner as PlayerId]} wins by eliminating the opposing forces!`
  }
  return isDraw
    ? 'Territory was tied when the countdown hit turn 30 — draw!'
    : `${PLAYER_LABEL[state.winner as PlayerId]} wins by holding more territory when the countdown hit turn 30!`
}

export function HandPanel({ state, dispatch }: HandPanelProps) {
  const active = state.players[state.activePlayer]
  const territory = useMemo(() => territoryCounts(state.creatures), [state.creatures])
  const leader: PlayerId | null = territory.orange > territory.purple ? 'orange' : territory.purple > territory.orange ? 'purple' : null

  if (state.winner) {
    return (
      <div id="hand-panel">
        <div className={`game-over${state.winner !== 'draw' ? ` game-over-${state.winner}` : ''}`}>{winMessage(state)}</div>
      </div>
    )
  }

  return (
    <div id="hand-panel">
      <div className={`turn-banner turn-${state.activePlayer}`}>
        Turn {state.turnNumber} — {PLAYER_LABEL[state.activePlayer]} ({active.mana} mana)
      </div>
      <div id="territory-status">
        <span className="territory-count territory-orange">Orange {territory.orange}</span>
        <span className="territory-divider">·</span>
        <span className="territory-count territory-purple">Purple {territory.purple}</span>
        {leader && <span className="territory-leader">{PLAYER_LABEL[leader]} holds the mana edge (+1/turn)</span>}
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
          const isBigGuy = Boolean(template.growthPerTurn)
          const hasCenterControl = state.centerControlAtTurnStart === state.activePlayer
          const centerBlocked = Boolean(template.requiresCenterControl) && !hasCenterControl
          const { power, toughness, bonus } = effectiveStats(template, state.turnNumber)
          return (
            <button
              key={card.instanceId}
              className={`card${isSelected ? ' selected' : ''}${isBigGuy ? ' big-guy' : ''}`}
              disabled={!affordable || centerBlocked}
              onClick={() => dispatch({ type: 'SELECT_CARD', instanceId: card.instanceId })}
            >
              <div className="card-cost-badge">{template.cost}</div>
              <div className="card-art" style={{ backgroundImage: `url(${CREATURE_ART[template.id]})` }} />
              <div className="card-body">
                <div className="card-name">{template.name}</div>
                <div className="card-stats">
                  {power}/{toughness} · move {template.movement}
                </div>
                {isBigGuy && (
                  <div className="card-growth">
                    growing — currently +{bonus}/+{bonus}
                  </div>
                )}
                {centerBlocked && <div className="card-locked">requires center hex at turn start</div>}
              </div>
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
