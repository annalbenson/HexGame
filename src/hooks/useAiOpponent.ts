import { useEffect } from 'react'
import { enumerateIntents, intentToActions } from '../sim/intents'
import { STRATEGIES, type StrategyName } from '../sim/strategies'
import type { GameAction } from '../game/gameReducer'
import type { GameState, PlayerId } from '../game/types'

const AI_MOVE_DELAY_MS = 550

/**
 * Drives one AI-controlled player's turns automatically, one intent at a
 * time, using the same bot strategies as the headless playtest harness
 * (src/sim). Re-schedules itself after every dispatched action via the
 * effect's `state` dependency, so it naturally stops the instant it's no
 * longer the AI's turn — a human action, END_TURN, a win, or the strategy
 * being switched to "none" all just fall out of the same guard clauses,
 * no separate stop/cancel bookkeeping needed.
 */
export function useAiOpponent(state: GameState, dispatch: (action: GameAction) => void, player: PlayerId, strategy: StrategyName | null) {
  useEffect(() => {
    if (!strategy) return
    if (state.winner) return
    if (state.activePlayer !== player) return

    const timer = setTimeout(() => {
      const intent = STRATEGIES[strategy](state, enumerateIntents(state))
      for (const action of intentToActions(intent)) dispatch(action)
    }, AI_MOVE_DELAY_MS)

    return () => clearTimeout(timer)
  }, [state, dispatch, player, strategy])
}
