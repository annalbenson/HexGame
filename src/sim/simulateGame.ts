import { territoryCounts } from '../game/board'
import { createInitialState, gameReducer } from '../game/gameReducer'
import type { GameState, PlayerId } from '../game/types'
import { enumerateIntents, intentToActions, type Intent } from './intents'
import { STRATEGIES, type StrategyName } from './strategies'

const MAX_ACTIONS_PER_TURN = 20
/** Hard safety net, well past the game's own BACKSTOP_TURN fallback — if this ever fires, something in the reducer failed to produce a winner, not a real game outcome. */
const MAX_TURNS_SAFETY = 200

export interface GameStats {
  winner: PlayerId | 'draw'
  winReason: 'elimination' | 'countdown' | 'backstop' | 'aborted'
  turns: number
  firstPlayer: PlayerId
  territory: Record<PlayerId, number>
  castCounts: Record<PlayerId, Record<string, number>>
  bigGuyFielded: Record<PlayerId, boolean>
  cardsBurned: Record<PlayerId, number>
}

function applyIntent(state: GameState, intent: Intent): GameState {
  let next = state
  for (const action of intentToActions(intent)) next = gameReducer(next, action)
  return next
}

export function simulateGame(strategies: Record<PlayerId, StrategyName>): GameStats {
  let state = createInitialState()
  const startingTotals: Record<PlayerId, number> = {
    orange: state.players.orange.deck.length + state.players.orange.hand.length,
    purple: state.players.purple.deck.length + state.players.purple.hand.length,
  }
  const firstPlayer = state.activePlayer
  const castCounts: Record<PlayerId, Record<string, number>> = { orange: {}, purple: {} }
  const bigGuyFielded: Record<PlayerId, boolean> = { orange: false, purple: false }

  let turnsElapsed = 0
  let aborted = false

  while (!state.winner) {
    if (turnsElapsed >= MAX_TURNS_SAFETY) {
      aborted = true
      break
    }
    const activePlayer = state.activePlayer
    const strategy = STRATEGIES[strategies[activePlayer]]
    let actionsThisTurn = 0

    while (actionsThisTurn < MAX_ACTIONS_PER_TURN && !state.winner) {
      const intent = strategy(state, enumerateIntents(state))
      if (intent.kind === 'cast') {
        castCounts[activePlayer][intent.card.templateId] = (castCounts[activePlayer][intent.card.templateId] ?? 0) + 1
        if (intent.card.templateId === 'the-big-guy') bigGuyFielded[activePlayer] = true
      }
      state = applyIntent(state, intent)
      actionsThisTurn++
      if (intent.kind === 'end') break
    }
    if (actionsThisTurn >= MAX_ACTIONS_PER_TURN && !state.winner) {
      state = gameReducer(state, { type: 'END_TURN' })
    }
    turnsElapsed++
  }

  const territory = territoryCounts(state.creatures)
  const cardsBurned: Record<PlayerId, number> = { orange: 0, purple: 0 }
  for (const playerId of ['orange', 'purple'] as PlayerId[]) {
    const player = state.players[playerId]
    const castTotal = Object.values(castCounts[playerId]).reduce((a, b) => a + b, 0)
    cardsBurned[playerId] = startingTotals[playerId] - (player.deck.length + player.hand.length + castTotal)
  }

  return {
    winner: aborted ? 'draw' : (state.winner ?? 'draw'),
    winReason: aborted ? 'aborted' : (state.winReason ?? 'backstop'),
    turns: state.turnNumber,
    firstPlayer,
    territory,
    castCounts,
    bigGuyFielded,
    cardsBurned,
  }
}
