import { useMemo } from 'react'
import { territoryCounts } from '../game/board'
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

/** The status strip below the board: turn banner, territory, Big Guy countdown, deck counts, End Turn. Each player's hand renders separately as a vertical side panel flanking the board — see HandSidePanel.tsx / App.tsx — so this bar's height stays fixed regardless of hand size. */
export function HandPanel({ state, dispatch }: HandPanelProps) {
  const active = state.players[state.activePlayer]
  const territory = useMemo(() => territoryCounts(state.territoryPressure), [state.territoryPressure])
  const leader: PlayerId | null = territory.orange > territory.purple ? 'orange' : territory.purple > territory.orange ? 'purple' : null
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
      <button id="end-turn" onClick={() => dispatch({ type: 'END_TURN' })}>
        End Turn
      </button>
    </div>
  )
}
