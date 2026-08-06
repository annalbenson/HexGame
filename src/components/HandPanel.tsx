import { useMemo } from 'react'
import { CREATURE_ART } from '../game/art'
import { controlsTerritoryBeyondHome, territoryCounts } from '../game/board'
import { effectiveStats, getTemplate } from '../game/creatures'
import { BIG_GUY_COUNTDOWN } from '../game/gameReducer'
import type { GameAction } from '../game/gameReducer'
import type { GameState, PlayerId } from '../game/types'

interface HandPanelProps {
  state: GameState
  dispatch: (action: GameAction) => void
}

const PLAYER_LABEL: Record<PlayerId, string> = { orange: 'Orange', purple: 'Purple' }

function winMessage(state: GameState): string {
  const isDraw = state.winner === 'draw'
  const winner = state.winner as PlayerId
  const loser: PlayerId = winner === 'orange' ? 'purple' : 'orange'

  if (state.winReason === 'elimination') {
    return isDraw ? 'Both sides were wiped out — draw!' : `${PLAYER_LABEL[winner]} wins by eliminating the opposing forces!`
  }
  if (state.winReason === 'countdown') {
    return isDraw
      ? 'Both Big Guys ran out their clocks on the same turn — draw!'
      : `${PLAYER_LABEL[winner]} outlasts ${PLAYER_LABEL[loser]}'s Big Guy and wins by survival!`
  }
  return isDraw
    ? 'Neither side gambled on The Big Guy, and territory was tied when the standoff timed out — draw!'
    : `Neither side gambled on The Big Guy — ${PLAYER_LABEL[winner]} wins by holding more territory when the standoff timed out.`
}

export function HandPanel({ state, dispatch }: HandPanelProps) {
  const active = state.players[state.activePlayer]
  const territory = useMemo(() => territoryCounts(state.territoryPressure), [state.territoryPressure])
  const leader: PlayerId | null = territory.orange > territory.purple ? 'orange' : territory.purple > territory.orange ? 'purple' : null
  const hasTerritory = useMemo(
    () => controlsTerritoryBeyondHome(state.activePlayer, state.territoryPressure),
    [state.activePlayer, state.territoryPressure],
  )
  const activeCountdowns = (['orange', 'purple'] as PlayerId[])
    .filter((casterId) => state.bigGuyCastTurn[casterId] !== null)
    .map((casterId) => {
      const opponent: PlayerId = casterId === 'orange' ? 'purple' : 'orange'
      const remaining = Math.max(0, BIG_GUY_COUNTDOWN - (state.turnNumber - state.bigGuyCastTurn[casterId]!))
      return { casterId, opponent, remaining }
    })

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
      {activeCountdowns.length > 0 && (
        <div id="big-guy-countdown">
          {activeCountdowns.map(({ casterId, opponent, remaining }) => (
            <span key={casterId} className="countdown-warning">
              {PLAYER_LABEL[opponent]} wins in {remaining} {remaining === 1 ? 'turn' : 'turns'} unless {PLAYER_LABEL[casterId]}'s Big Guy finishes the job
            </span>
          ))}
        </div>
      )}
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
          const territoryBlocked = !template.capturesTerrain && !hasTerritory
          const { power, toughness, bonus } = effectiveStats(template, state.turnNumber)
          return (
            <button
              key={card.instanceId}
              className={`card${isSelected ? ' selected' : ''}${isBigGuy ? ' big-guy' : ''}`}
              disabled={!affordable || centerBlocked || territoryBlocked}
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
                {territoryBlocked && <div className="card-locked">requires territory beyond your home hex</div>}
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
