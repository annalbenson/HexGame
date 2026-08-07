import { axialDistance, CENTER_COORDS, HOME_COORDS, hexKey } from '../game/board'
import { getEffectivePower, getTemplate } from '../game/creatures'
import type { GameState, PlayerId } from '../game/types'
import type { Intent } from './intents'

export type StrategyName = 'random' | 'rusher' | 'turtler' | 'hoarder'

type MoveIntent = Extract<Intent, { kind: 'move' }>
type CastIntent = Extract<Intent, { kind: 'cast' }>
type Strategy = (state: GameState, intents: Intent[]) => Intent

function otherPlayer(id: PlayerId): PlayerId {
  return id === 'orange' ? 'purple' : 'orange'
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function isCast(intent: Intent): intent is CastIntent {
  return intent.kind === 'cast'
}

function isMove(intent: Intent): intent is MoveIntent {
  return intent.kind === 'move'
}

/** null if the move isn't an attack (empty destination hex). Tentacle strikes are one-way -- the attacker never takes counter-damage, so bots shouldn't price that risk in. */
function combatOutcome(state: GameState, move: MoveIntent): { killsDefender: boolean; attackerDies: boolean } | null {
  const attacker = state.creatures[move.fromKey]
  const defender = state.creatures[hexKey(move.q, move.r)]
  if (!defender || defender.owner === attacker.owner) return null
  const attackerPower = getEffectivePower(attacker)
  const defenderPower = getEffectivePower(defender)
  const isTentacleStrike = getTemplate(attacker.templateId).hasTentacleStrike
  return {
    killsDefender: defender.currentToughness - attackerPower <= 0,
    attackerDies: !isTentacleStrike && attacker.currentToughness - defenderPower <= 0,
  }
}

function hasLiveMushroom(state: GameState, playerId: PlayerId): boolean {
  return Object.values(state.creatures).some((c) => c.owner === playerId && getTemplate(c.templateId).capturesTerrain)
}

/** Replanting toward the contested middle of the board rather than always the closest-to-home legal spot -- otherwise Mushrooms just cluster deep in a player's own territory turn after turn, out of reach for an opponent trying to attack one for the heal/harvest payoff. */
function frontierMushroomCast(mushroomCasts: CastIntent[]): CastIntent {
  return mushroomCasts.reduce((best, c) => (axialDistance(c, CENTER_COORDS) < axialDistance(best, CENTER_COORDS) ? c : best))
}

const random: Strategy = (_state, intents) => {
  const nonEnd = intents.filter((i) => i.kind !== 'end')
  if (nonEnd.length === 0) return { kind: 'end' }
  return pickRandom(nonEnd)
}

/** Aggressive tempo: takes any kill, otherwise dumps mana on the cheapest legal creature and pushes everything toward the enemy home. */
const rusher: Strategy = (state, intents) => {
  const playerId = state.activePlayer
  const moves = intents.filter(isMove)
  const casts = intents.filter(isCast)

  const attacks = moves.map((m) => ({ intent: m, outcome: combatOutcome(state, m) })).filter((x) => x.outcome !== null)
  const freeKills = attacks.filter((a) => a.outcome!.killsDefender && !a.outcome!.attackerDies)
  if (freeKills.length > 0) return freeKills[0].intent
  const tradeKills = attacks.filter((a) => a.outcome!.killsDefender)
  if (tradeKills.length > 0) return tradeKills[0].intent

  if (casts.length > 0) {
    const nonMushroom = casts.filter((c) => !getTemplate(c.card.templateId).capturesTerrain)
    const pool = nonMushroom.length > 0 ? nonMushroom : casts
    return pool.reduce((best, c) => (getTemplate(c.card.templateId).cost < getTemplate(best.card.templateId).cost ? c : best))
  }

  const enemyHome = HOME_COORDS[otherPlayer(playerId)]
  const advances = moves.filter((m) => combatOutcome(state, m) === null)
  if (advances.length > 0) {
    return advances.reduce((best, m) => (axialDistance(m, enemyHome) < axialDistance(best, enemyHome) ? m : best))
  }

  return { kind: 'end' }
}

/** Passive and territory-first: always keeps a Mushroom alive, only takes attacks it's sure to win, never advances without a reason. */
const turtler: Strategy = (state, intents) => {
  const playerId = state.activePlayer
  const moves = intents.filter(isMove)
  const casts = intents.filter(isCast)
  const mushroomCasts = casts.filter((c) => getTemplate(c.card.templateId).capturesTerrain)

  if (!hasLiveMushroom(state, playerId) && mushroomCasts.length > 0) return frontierMushroomCast(mushroomCasts)

  const safeAttacks = moves
    .map((m) => ({ intent: m, outcome: combatOutcome(state, m) }))
    .filter((x) => x.outcome?.killsDefender && !x.outcome.attackerDies)
  if (safeAttacks.length > 0) return safeAttacks[0].intent

  if (mushroomCasts.length > 0) return frontierMushroomCast(mushroomCasts)

  const otherCasts = casts.filter((c) => !getTemplate(c.card.templateId).capturesTerrain)
  if (otherCasts.length > 0) return pickRandom(otherCasts)

  return { kind: 'end' }
}

/** Hoards mana for The Big Guy: minimum Mushroom upkeep, no discretionary spending, contests the center, only fights safe trades. */
const hoarder: Strategy = (state, intents) => {
  const playerId = state.activePlayer
  const moves = intents.filter(isMove)
  const casts = intents.filter(isCast)
  const mushroomCasts = casts.filter((c) => getTemplate(c.card.templateId).capturesTerrain)

  if (!hasLiveMushroom(state, playerId) && mushroomCasts.length > 0) return frontierMushroomCast(mushroomCasts)

  const bigGuyCasts = casts.filter((c) => c.card.templateId === 'the-big-guy')
  if (bigGuyCasts.length > 0) return bigGuyCasts[0]

  const safeAttacks = moves
    .map((m) => ({ intent: m, outcome: combatOutcome(state, m) }))
    .filter((x) => x.outcome?.killsDefender && !x.outcome.attackerDies)
  if (safeAttacks.length > 0) return safeAttacks[0].intent

  const centerHeld = state.creatures[hexKey(CENTER_COORDS.q, CENTER_COORDS.r)]?.owner === playerId
  if (!centerHeld) {
    const advances = moves.filter((m) => combatOutcome(state, m) === null)
    if (advances.length > 0) {
      return advances.reduce((best, m) => (axialDistance(m, CENTER_COORDS) < axialDistance(best, CENTER_COORDS) ? m : best))
    }
  }

  return { kind: 'end' }
}

export const STRATEGIES: Record<StrategyName, Strategy> = { random, rusher, turtler, hoarder }
