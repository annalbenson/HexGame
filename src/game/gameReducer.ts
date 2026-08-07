import { axialDistance, CENTER_COORDS, controlsTerritoryBeyondHome, createEmptyPressure, hexKey, ownerOf, tentacleTargets, territoryCounts, updatePressure } from './board'
import { CREATURE_TEMPLATES, effectiveStats, getEffectivePower, getTemplate } from './creatures'
import { buildStartingHand, drawCards, MAX_HAND_SIZE } from './deck'
import type { CardInstance, CreatureInstance, CreatureTemplate, GameState, PlayerId, PlayerState } from './types'

const STARTING_MANA = 1
const MANA_INCOME = 1
const DRAW_PER_TURN = 1
const TERRITORY_ADVANTAGE_BONUS = 1
/** Coin-flip odds that killing a Mushroom hands its owner a fresh one to replant, instead of healing the attacker. Without this, a player who loses every Mushroom copy they've drawn has no way back into the territory game at all. */
const MUSHROOM_EAT_HARVEST_CHANCE = 0.5
/** Turns after The Big Guy is cast before its owner's opponent wins outright by having survived it — the "gamble" arc's actual payoff/risk. Exported for the board's live countdown display. */
export const BIG_GUY_COUNTDOWN = 6
/** Backstop only — if neither player ever casts The Big Guy, the game would otherwise never end. Deliberately far past when a real game normally resolves; territory tiebreak, same as the old flat survival rule it replaces. */
const BACKSTOP_TURN = 45

export type GameAction =
  | { type: 'SELECT_CARD'; instanceId: string }
  | { type: 'SELECT_CREATURE'; hexKey: string }
  | { type: 'CLICK_HEX'; q: number; r: number }
  | { type: 'DESELECT' }
  | { type: 'END_TURN' }
  | { type: 'RESET' }

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
    territoryPressure: createEmptyPressure(),
    selection: null,
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

type MushroomEatOutcome = { kind: 'heal'; toughness: number } | { kind: 'harvest'; card: CardInstance }

let harvestedCardCounter = 0

/**
 * Killing a Mushroom is a coin flip between healing the attacker to full and
 * handing its owner a fresh Mushroom card to replant — "eating" it either
 * nourishes you or you walk away with its spores. The harvest half exists
 * specifically so a player who's lost every Mushroom copy they've drawn
 * isn't permanently locked out of ever re-establishing territory.
 */
function resolveMushroomEat(owner: PlayerId, attackerTemplate: CreatureTemplate, bonusPower: number | undefined): MushroomEatOutcome {
  if (Math.random() < MUSHROOM_EAT_HARVEST_CHANCE) {
    const mushroomTemplateId = CREATURE_TEMPLATES.find((t) => t.capturesTerrain)!.id
    return { kind: 'harvest', card: { instanceId: `${owner}-harvested-${harvestedCardCounter++}`, templateId: mushroomTemplateId } }
  }
  return { kind: 'heal', toughness: attackerTemplate.toughness + (bonusPower ?? 0) }
}

/** Respects the hand-size cap the same way a normal draw would — a harvested card is lost if the hand's already full, not a special case that ignores the limit. */
function addCardToHand(players: Record<PlayerId, PlayerState>, owner: PlayerId, card: CardInstance): Record<PlayerId, PlayerState> {
  const player = players[owner]
  if (player.hand.length >= MAX_HAND_SIZE) return players
  return { ...players, [owner]: { ...player, hand: [...player.hand, card] } }
}

function castCreature(state: GameState, instanceId: string, q: number, r: number): GameState {
  const key = hexKey(q, r)
  const player = state.players[state.activePlayer]
  const card = player.hand.find((c) => c.instanceId === instanceId)
  if (!card) return state

  const template = getTemplate(card.templateId)

  // Every other creature requires an empty hex. The Big Guy is the one
  // exception: casting it onto your own creature sacrifices that creature
  // instead of being blocked — an enemy occupant still blocks it, so the
  // center has to be cleared by combat first if someone else is standing
  // there.
  const occupant = state.creatures[key]
  const isSacrifice = template.mustCastOnCenter && occupant?.owner === state.activePlayer
  if (occupant && !isSacrifice) return state

  if (ownerOf({ q, r }, state.territoryPressure) !== state.activePlayer) return state
  if (player.mana < template.cost) return state
  if (template.mustCastOnCenter && (q !== CENTER_COORDS.q || r !== CENTER_COORDS.r)) return state
  if (!template.capturesTerrain && !controlsTerritoryBeyondHome(state.activePlayer, state.territoryPressure)) return state

  const { toughness, bonus } = effectiveStats(template, state.turnNumber)
  const newCreature: CreatureInstance = {
    templateId: card.templateId,
    owner: state.activePlayer,
    currentToughness: toughness,
    hasSummoningSickness: true,
    hasActedThisTurn: false,
    bonusPower: bonus,
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
    const updatedDefenderToughness = defender.currentToughness - getEffectivePower(attacker)
    const defenderSurvives = updatedDefenderToughness > 0
    // Killing a Mushroom is a coin flip: heal to full, or harvest a fresh
    // Mushroom card — a direct reward for going on the attack rather than
    // just holding ground, and self-limiting since it only pays off against
    // Mushrooms an opponent actually plants.
    const ateAMushroom = !defenderSurvives && getTemplate(defender.templateId).capturesTerrain
    const attackerToughnessAfterCombat = attacker.currentToughness - getEffectivePower(defender)
    const attackerSurvives = attackerToughnessAfterCombat > 0
    const eatOutcome = ateAMushroom && attackerSurvives ? resolveMushroomEat(attacker.owner, template, attacker.bonusPower) : null

    const updatedAttacker: CreatureInstance = {
      ...attacker,
      currentToughness: eatOutcome?.kind === 'heal' ? eatOutcome.toughness : attackerToughnessAfterCombat,
      hasActedThisTurn: true,
    }
    const updatedDefender: CreatureInstance = { ...defender, currentToughness: updatedDefenderToughness }

    delete nextCreatures[fromKey]
    delete nextCreatures[toKey]

    if (defenderSurvives) nextCreatures[toKey] = updatedDefender
    if (attackerSurvives) {
      nextCreatures[defenderSurvives ? fromKey : toKey] = updatedAttacker
    }

    if (eatOutcome?.kind === 'harvest') {
      return {
        ...state,
        creatures: nextCreatures,
        players: addCardToHand(state.players, attacker.owner, eatOutcome.card),
        selection: null,
      }
    }
  }

  return { ...state, creatures: nextCreatures, selection: null }
}

/**
 * The Big Guy's alternative to moveOrAttack — it never moves (movement: 0),
 * instead striking the first enemy found in a chosen direction at unlimited
 * range (see tentacleTargets in board.ts). One-way damage: unlike normal
 * combat, the target can't hit back, since nothing walked into contact.
 */
function tentacleStrike(state: GameState, fromKey: string, q: number, r: number): GameState {
  const attacker = state.creatures[fromKey]
  if (!attacker || attacker.owner !== state.activePlayer) return state
  if (attacker.hasSummoningSickness || attacker.hasActedThisTurn) return state

  const from = coordsFromKey(fromKey)
  const validTargets = tentacleTargets(from, state.creatures, state.activePlayer)
  if (!validTargets.some((t) => t.q === q && t.r === r)) return state

  const toKey = hexKey(q, r)
  const defender = state.creatures[toKey]
  if (!defender) return state

  const updatedDefenderToughness = defender.currentToughness - getEffectivePower(attacker)
  const defenderSurvives = updatedDefenderToughness > 0
  // Same "eating a Mushroom" coin flip as moveOrAttack — Big Guy never takes
  // counter-damage from a tentacle strike, but it can have been damaged
  // earlier by something that walked up and hit it normally.
  const ateAMushroom = !defenderSurvives && getTemplate(defender.templateId).capturesTerrain
  const eatOutcome = ateAMushroom ? resolveMushroomEat(attacker.owner, getTemplate(attacker.templateId), attacker.bonusPower) : null

  const nextCreatures = {
    ...state.creatures,
    [fromKey]: {
      ...attacker,
      hasActedThisTurn: true,
      currentToughness: eatOutcome?.kind === 'heal' ? eatOutcome.toughness : attacker.currentToughness,
    },
  }
  if (defenderSurvives) {
    nextCreatures[toKey] = { ...defender, currentToughness: updatedDefenderToughness }
  } else {
    delete nextCreatures[toKey]
  }

  if (eatOutcome?.kind === 'harvest') {
    return {
      ...state,
      creatures: nextCreatures,
      players: addCardToHand(state.players, attacker.owner, eatOutcome.card),
      selection: null,
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
    if (creature.owner === nextPlayer) {
      nextCreatures[key] = { ...creature, hasSummoningSickness: false, hasActedThisTurn: false }
    }
  }

  const nextPressure = updatePressure(state.territoryPressure, nextCreatures)

  const incomingPlayer = state.players[nextPlayer]
  const { deck, hand } = drawCards(incomingPlayer.deck, incomingPlayer.hand, DRAW_PER_TURN)

  const counts = territoryCounts(nextPressure)
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
    territoryPressure: nextPressure,
    selection: null,
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
    const territory = territoryCounts(state.territoryPressure)
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
        const selected = state.creatures[selection.hexKey]
        if (selected && getTemplate(selected.templateId).hasTentacleStrike) {
          return tentacleStrike(state, selection.hexKey, q, r)
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
  if (action.type === 'RESET') return createInitialState()
  if (state.winner) return state
  const nextState = applyAction(state, action)
  const result = checkWinner(nextState)
  return { ...nextState, winner: result?.winner ?? null, winReason: result?.reason ?? null }
}
