import { axialDistance, CENTER_COORDS, controlsTerritoryBeyondHome, createGrid, hexKey, ownerOf, tentacleTargets } from '../game/board'
import { getTemplate } from '../game/creatures'
import type { GameAction } from '../game/gameReducer'
import type { CardInstance, CreatureInstance, GameState, PlayerId } from '../game/types'

/**
 * A bot-level move, one step above the reducer's raw two-click protocol
 * (SELECT_CARD/SELECT_CREATURE then CLICK_HEX). Legality here intentionally
 * re-derives from the same exported predicates the reducer itself uses
 * (ownerOf, controlsTerritoryBeyondHome) rather than trial-running the
 * reducer for every candidate hex — enumerating a full turn's candidates via
 * two real dispatches each would be the more "obviously correct" approach,
 * but is too slow across thousands of simulated games. The actual state
 * transition still always goes through the real `gameReducer` (see
 * applyIntent in simulateGame.ts); this file only decides what's worth
 * trying.
 */
export type Intent =
  | { kind: 'cast'; card: CardInstance; q: number; r: number }
  | { kind: 'move'; fromKey: string; q: number; r: number }
  | { kind: 'end' }

function coordsFromKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number)
  return { q, r }
}

function castTargetsFor(state: GameState, playerId: PlayerId, card: CardInstance): { q: number; r: number }[] {
  const template = getTemplate(card.templateId)
  const player = state.players[playerId]
  if (player.mana < template.cost) return []
  if (!template.capturesTerrain && !controlsTerritoryBeyondHome(playerId, state.territoryPressure)) return []

  if (template.mustCastOnCenter) {
    // Casting sacrifices an occupant of your own instead of requiring an
    // empty hex — but an enemy occupant still blocks it, same as gameReducer.
    const occupant = state.creatures[hexKey(CENTER_COORDS.q, CENTER_COORDS.r)]
    if (occupant && occupant.owner !== playerId) return []
    if (ownerOf(CENTER_COORDS, state.territoryPressure) !== playerId) return []
    return [{ q: CENTER_COORDS.q, r: CENTER_COORDS.r }]
  }

  const targets: { q: number; r: number }[] = []
  for (const hex of createGrid()) {
    if (state.creatures[hexKey(hex.q, hex.r)]) continue
    if (ownerOf(hex, state.territoryPressure) !== playerId) continue
    targets.push({ q: hex.q, r: hex.r })
  }
  return targets
}

function moveTargetsFor(state: GameState, playerId: PlayerId, fromKey: string, creature: CreatureInstance): { q: number; r: number }[] {
  if (creature.hasSummoningSickness || creature.hasActedThisTurn) return []
  const template = getTemplate(creature.templateId)
  const from = coordsFromKey(fromKey)
  if (template.hasTentacleStrike) return tentacleTargets(from, state.creatures, playerId)
  if (template.movement <= 0) return []

  const targets: { q: number; r: number }[] = []
  for (const hex of createGrid()) {
    const dist = axialDistance(from, hex)
    if (dist === 0 || dist > template.movement) continue
    const defender = state.creatures[hexKey(hex.q, hex.r)]
    if (defender && defender.owner === playerId) continue
    targets.push({ q: hex.q, r: hex.r })
  }
  return targets
}

/** All intents worth considering this micro-step, plus the always-available `end`. One entry per unique card template (not per copy — duplicate copies of the same card offer identical intents). */
export function enumerateIntents(state: GameState): Intent[] {
  const playerId = state.activePlayer
  const player = state.players[playerId]
  const intents: Intent[] = []

  const seenTemplates = new Set<string>()
  for (const card of player.hand) {
    if (seenTemplates.has(card.templateId)) continue
    seenTemplates.add(card.templateId)
    for (const { q, r } of castTargetsFor(state, playerId, card)) {
      intents.push({ kind: 'cast', card, q, r })
    }
  }

  for (const [key, creature] of Object.entries(state.creatures)) {
    if (creature.owner !== playerId) continue
    for (const { q, r } of moveTargetsFor(state, playerId, key, creature)) {
      intents.push({ kind: 'move', fromKey: key, q, r })
    }
  }

  intents.push({ kind: 'end' })
  return intents
}

/** The real reducer dispatches an intent requires — shared by the headless simulator and the live in-browser AI opponent, so both drive the same two-click protocol the same way. */
export function intentToActions(intent: Intent): GameAction[] {
  if (intent.kind === 'end') return [{ type: 'END_TURN' }]
  if (intent.kind === 'cast') {
    return [
      { type: 'SELECT_CARD', instanceId: intent.card.instanceId },
      { type: 'CLICK_HEX', q: intent.q, r: intent.r },
    ]
  }
  return [
    { type: 'SELECT_CREATURE', hexKey: intent.fromKey },
    { type: 'CLICK_HEX', q: intent.q, r: intent.r },
  ]
}
