import { axialDistance, CENTER_COORDS, controlsTerritoryBeyondHome, hexKey, ownerOf, territoryCounts } from './board'
import { effectiveStats, getEffectivePower, getTemplate } from './creatures'
import { buildStartingHand, drawCards } from './deck'
import type { CreatureInstance, GameState, PlayerId, PlayerState } from './types'

const STARTING_MANA = 1
const MANA_INCOME = 1
const DRAW_PER_TURN = 1
const TERRITORY_ADVANTAGE_BONUS = 1
/** Turns after The Big Guy is cast before its owner's opponent wins outright by having survived it — the "gamble" arc's actual payoff/risk. Exported for the board's live countdown display. */
export const BIG_GUY_COUNTDOWN = 6
/** Backstop only — if neither player ever casts The Big Guy, the game would otherwise never end. Deliberately far past when a real game normally resolves; territory tiebreak, same as the old flat survival rule it replaces. */
const BACKSTOP_TURN = 45
/** How many turns a capturesTerrain creature (Magic Mushroom) lives before withering — claimed ground has to be actively maintained, not planted once and forgotten. */
const MUSHROOM_LIFESPAN = 8

export type GameAction =
  | { type: 'SELECT_CARD'; instanceId: string }
  | { type: 'SELECT_CREATURE'; hexKey: string }
  | { type: 'CLICK_HEX'; q: number; r: number }
  | { type: 'DESELECT' }
  | { type: 'END_TURN' }

function createPlayerState(playerId: PlayerId): PlayerState {
  const { deck, hand } = buildStartingHand(playerId)
  return { mana: STARTING_MANA, deck, hand, hasFielded: false }
}

export function createInitialState(): GameState {
  return {
    activePlayer: 'orange',
    turnNumber: 1,
    players: { orange: createPlayerState('orange'), purple: createPlayerState('purple') },
    creatures: {},
    selection: null,
    centerControlAtTurnStart: null,
    bigGuyCastTurn: { orange: null, purple: null },
    winner: null,
    winReason: null,
  }
}

function otherPlayer(player: PlayerId): PlayerId {
  return player === 'orange' ? 'purple' : 'orange'
}

function coordsFromKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

function castCreature(state: GameState, instanceId: string, q: number, r: number): GameState {
  const key = hexKey(q, r)
  if (state.creatures[key]) return state
  if (ownerOf({ q, r }, state.creatures) !== state.activePlayer) return state

  const player = state.players[state.activePlayer]
  const card = player.hand.find((c) => c.instanceId === instanceId)
  if (!card) return state

  const template = getTemplate(card.templateId)
  if (player.mana < template.cost) return state
  if (template.requiresCenterControl && state.centerControlAtTurnStart !== state.activePlayer) return state
  if (!template.capturesTerrain && !controlsTerritoryBeyondHome(state.activePlayer, state.creatures)) return state

  const { toughness, bonus } = effectiveStats(template, state.turnNumber)
  const newCreature: CreatureInstance = {
    templateId: card.templateId,
    owner: state.activePlayer,
    currentToughness: toughness,
    hasSummoningSickness: true,
    hasActedThisTurn: false,
    bonusPower: bonus,
    expiresOnTurn: template.capturesTerrain ? state.turnNumber + MUSHROOM_LIFESPAN : undefined,
  }

  const nextHand = player.hand.filter((c) => c.instanceId !== instanceId)

  return {
    ...state,
    players: {
      ...state.players,
      [state.activePlayer]: { ...player, mana: player.mana - template.cost, hand: nextHand, hasFielded: true },
    },
    creatures: { ...state.creatures, [key]: newCreature },
    selection: null,
    bigGuyCastTurn: template.triggersCountdown
      ? { ...state.bigGuyCastTurn, [state.activePlayer]: state.turnNumber }
      : state.bigGuyCastTurn,
  }
}

function moveOrAttack(state: GameState, fromKey: string, q: number, r: number): GameState {
  const attacker = state.creatures[fromKey]
  if (!attacker || attacker.owner !== state.activePlayer) return state
  if (attacker.hasSummoningSickness || attacker.hasActedThisTurn) return state

  const from = coordsFromKey(fromKey)
  const template = getTemplate(attacker.templateId)
  if (axialDistance(from, { q, r }) > template.movement) return state

  const toKey = hexKey(q, r)
  if (toKey === fromKey) return state

  const defender = state.creatures[toKey]
  const nextCreatures = { ...state.creatures }

  if (!defender) {
    delete nextCreatures[fromKey]
    nextCreatures[toKey] = { ...attacker, hasActedThisTurn: true }
  } else if (defender.owner === attacker.owner) {
    return state
  } else {
    const updatedAttacker: CreatureInstance = {
      ...attacker,
      currentToughness: attacker.currentToughness - getEffectivePower(defender),
      hasActedThisTurn: true,
    }
    const updatedDefender: CreatureInstance = {
      ...defender,
      currentToughness: defender.currentToughness - getEffectivePower(attacker),
    }

    const attackerSurvives = updatedAttacker.currentToughness > 0
    const defenderSurvives = updatedDefender.currentToughness > 0

    delete nextCreatures[fromKey]
    delete nextCreatures[toKey]

    if (defenderSurvives) nextCreatures[toKey] = updatedDefender
    if (attackerSurvives) {
      nextCreatures[defenderSurvives ? fromKey : toKey] = updatedAttacker
    }
  }

  return { ...state, creatures: nextCreatures, selection: null }
}

function endTurn(state: GameState): GameState {
  const nextPlayer = otherPlayer(state.activePlayer)
  const nextTurnNumber = state.turnNumber + 1
  const nextCreatures = { ...state.creatures }
  for (const key of Object.keys(nextCreatures)) {
    const creature = nextCreatures[key]
    if (creature.expiresOnTurn !== undefined && creature.expiresOnTurn <= nextTurnNumber) {
      delete nextCreatures[key]
      continue
    }
    if (creature.owner === nextPlayer) {
      nextCreatures[key] = { ...creature, hasSummoningSickness: false, hasActedThisTurn: false }
    }
  }

  const incomingPlayer = state.players[nextPlayer]
  const { deck, hand } = drawCards(incomingPlayer.deck, incomingPlayer.hand, DRAW_PER_TURN)
  const centerOccupant = nextCreatures[hexKey(CENTER_COORDS.q, CENTER_COORDS.r)]

  const counts = territoryCounts(nextCreatures)
  const territoryBonus = counts[nextPlayer] > counts[state.activePlayer] ? TERRITORY_ADVANTAGE_BONUS : 0

  return {
    ...state,
    activePlayer: nextPlayer,
    turnNumber: nextTurnNumber,
    players: {
      ...state.players,
      [nextPlayer]: { ...incomingPlayer, mana: incomingPlayer.mana + MANA_INCOME + territoryBonus, deck, hand },
    },
    creatures: nextCreatures,
    selection: null,
    centerControlAtTurnStart: centerOccupant?.owner ?? null,
  }
}

interface WinResult {
  winner: PlayerId | 'draw'
  reason: 'elimination' | 'countdown' | 'backstop'
}

/**
 * Three ways a game ends. Elimination: a player who has fielded at least one
 * creature but currently has none left loses — `hasFielded` distinguishes
 * that from simply not having played anything yet (which shouldn't end the
 * game). This applies at any point, before or after The Big Guy. Countdown:
 * casting The Big Guy starts a BIG_GUY_COUNTDOWN-turn clock against its
 * owner — if the opponent hasn't been wiped out by the time it expires, the
 * opponent wins outright, no territory involved. If both players' clocks
 * expire on the same turn, it's a draw. Backstop: if *neither* player ever
 * casts The Big Guy, nothing above can ever resolve the game — BACKSTOP_TURN
 * is a deliberately distant fallback (territory tiebreak) purely to close
 * that edge case; it should be invisible in any game where someone gambles.
 */
function checkWinner(state: GameState): WinResult | null {
  const counts: Record<PlayerId, number> = { orange: 0, purple: 0 }
  for (const creature of Object.values(state.creatures)) counts[creature.owner]++

  const orangeEliminated = state.players.orange.hasFielded && counts.orange === 0
  const purpleEliminated = state.players.purple.hasFielded && counts.purple === 0
  if (orangeEliminated && purpleEliminated) return { winner: 'draw', reason: 'elimination' }
  if (orangeEliminated) return { winner: 'purple', reason: 'elimination' }
  if (purpleEliminated) return { winner: 'orange', reason: 'elimination' }

  const survivors = (['orange', 'purple'] as PlayerId[]).filter((casterId) => {
    const castTurn = state.bigGuyCastTurn[casterId]
    return castTurn !== null && state.turnNumber - castTurn >= BIG_GUY_COUNTDOWN
  }).map(otherPlayer)
  if (survivors.length === 2) return { winner: 'draw', reason: 'countdown' }
  if (survivors.length === 1) return { winner: survivors[0], reason: 'countdown' }

  const neitherCastBigGuy = state.bigGuyCastTurn.orange === null && state.bigGuyCastTurn.purple === null
  if (neitherCastBigGuy && state.turnNumber >= BACKSTOP_TURN) {
    const territory = territoryCounts(state.creatures)
    if (territory.orange > territory.purple) return { winner: 'orange', reason: 'backstop' }
    if (territory.purple > territory.orange) return { winner: 'purple', reason: 'backstop' }
    return { winner: 'draw', reason: 'backstop' }
  }
  return null
}

function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SELECT_CARD':
      return { ...state, selection: { type: 'card', instanceId: action.instanceId } }
    case 'SELECT_CREATURE': {
      const creature = state.creatures[action.hexKey]
      if (!creature || creature.owner !== state.activePlayer) return state
      return { ...state, selection: { type: 'creature', hexKey: action.hexKey } }
    }
    case 'DESELECT':
      return { ...state, selection: null }
    case 'END_TURN':
      return endTurn(state)
    case 'CLICK_HEX': {
      const { q, r } = action
      const key = hexKey(q, r)
      const occupant = state.creatures[key]
      const { selection } = state

      if (selection?.type === 'card') {
        return castCreature(state, selection.instanceId, q, r)
      }
      if (selection?.type === 'creature') {
        if (occupant && occupant.owner === state.activePlayer) {
          if (key === selection.hexKey) return { ...state, selection: null }
          return { ...state, selection: { type: 'creature', hexKey: key } }
        }
        return moveOrAttack(state, selection.hexKey, q, r)
      }
      if (occupant && occupant.owner === state.activePlayer) {
        return { ...state, selection: { type: 'creature', hexKey: key } }
      }
      return state
    }
    default:
      return state
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.winner) return state
  const nextState = applyAction(state, action)
  const result = checkWinner(nextState)
  return { ...nextState, winner: result?.winner ?? null, winReason: result?.reason ?? null }
}
