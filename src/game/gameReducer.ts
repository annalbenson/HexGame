import { axialDistance, hexKey, ownerOf } from './board'
import { getTemplate } from './creatures'
import { buildShuffledDeck, drawCards, STARTING_HAND_SIZE } from './deck'
import type { CreatureInstance, GameState, PlayerId, PlayerState } from './types'

const STARTING_MANA = 2
const MANA_INCOME = 2
const DRAW_PER_TURN = 1

export type GameAction =
  | { type: 'SELECT_CARD'; instanceId: string }
  | { type: 'SELECT_CREATURE'; hexKey: string }
  | { type: 'CLICK_HEX'; q: number; r: number }
  | { type: 'DESELECT' }
  | { type: 'END_TURN' }

function createPlayerState(playerId: PlayerId): PlayerState {
  const deck = buildShuffledDeck(playerId)
  const { deck: remainingDeck, hand } = drawCards(deck, [], STARTING_HAND_SIZE)
  return { mana: STARTING_MANA, deck: remainingDeck, hand }
}

export function createInitialState(): GameState {
  return {
    activePlayer: 'orange',
    turnNumber: 1,
    players: { orange: createPlayerState('orange'), purple: createPlayerState('purple') },
    creatures: {},
    selection: null,
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
  if (ownerOf({ q, r }) !== state.activePlayer) return state

  const player = state.players[state.activePlayer]
  const card = player.hand.find((c) => c.instanceId === instanceId)
  if (!card) return state

  const template = getTemplate(card.templateId)
  if (player.mana < template.cost) return state

  const newCreature: CreatureInstance = {
    templateId: card.templateId,
    owner: state.activePlayer,
    currentToughness: template.toughness,
    hasSummoningSickness: true,
    hasActedThisTurn: false,
  }

  const nextHand = player.hand.filter((c) => c.instanceId !== instanceId)

  return {
    ...state,
    players: {
      ...state.players,
      [state.activePlayer]: { ...player, mana: player.mana - template.cost, hand: nextHand },
    },
    creatures: { ...state.creatures, [key]: newCreature },
    selection: null,
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
    const defenderTemplate = getTemplate(defender.templateId)
    const updatedAttacker: CreatureInstance = {
      ...attacker,
      currentToughness: attacker.currentToughness - defenderTemplate.power,
      hasActedThisTurn: true,
    }
    const updatedDefender: CreatureInstance = {
      ...defender,
      currentToughness: defender.currentToughness - template.power,
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
  const nextCreatures = { ...state.creatures }
  for (const key of Object.keys(nextCreatures)) {
    const creature = nextCreatures[key]
    if (creature.owner === nextPlayer) {
      nextCreatures[key] = { ...creature, hasSummoningSickness: false, hasActedThisTurn: false }
    }
  }

  const incomingPlayer = state.players[nextPlayer]
  const { deck, hand } = drawCards(incomingPlayer.deck, incomingPlayer.hand, DRAW_PER_TURN)

  return {
    ...state,
    activePlayer: nextPlayer,
    turnNumber: state.turnNumber + 1,
    players: {
      ...state.players,
      [nextPlayer]: { ...incomingPlayer, mana: incomingPlayer.mana + MANA_INCOME, deck, hand },
    },
    creatures: nextCreatures,
    selection: null,
  }
}

export function gameReducer(state: GameState, action: GameAction): GameState {
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
