// honeycomb-grid v4's API differs substantially from v3 — most examples found
// online are v3-era (different traverser names, relative-not-absolute corner
// coordinates, etc.) and won't match usage in this file.
import { defineHex, Grid, spiral, Orientation } from 'honeycomb-grid'
import { getTemplate } from './creatures'
import type { CreatureInstance, PlayerId } from './types'

export const HEX_SIZE = 40
export const BOARD_RADIUS = 3

export const Tile = defineHex({
  dimensions: HEX_SIZE,
  orientation: Orientation.FLAT,
  origin: 'topLeft',
})

export type HexHandle = InstanceType<typeof Tile>

/**
 * Homes sit at opposite corners of the hex-shaped board. In flat-top hex pixel
 * space these two corners land top-left and bottom-right, so the board splits
 * along a genuine diagonal rather than a left/right or top/bottom line.
 */
export const HOME_COORDS: Record<PlayerId, { q: number; r: number }> = {
  orange: { q: -BOARD_RADIUS, r: 0 },
  purple: { q: BOARD_RADIUS, r: 0 },
}

export function createGrid() {
  return new Grid(Tile, spiral({ radius: BOARD_RADIUS, start: [0, 0] }))
}

/** The board's dead-center hex — see `ownerOf` — used as a contested strategic point The Big Guy requires control of. */
export const CENTER_COORDS = { q: 0, r: 0 }

export function hexKey(q: number, r: number): string {
  return `${q},${r}`
}

export function keyOf(hex: HexHandle): string {
  return hexKey(hex.q, hex.r)
}

export function polygonPoints(hex: HexHandle): string {
  return hex.corners.map((c) => `${c.x},${c.y}`).join(' ')
}

/**
 * True pixel bounding box of a set of hexes, from their actual corners.
 * `Grid.pixelWidth`/`pixelHeight` assume the grid's bounding box starts at
 * (0, 0), which only holds for grids anchored at their top-left hex (e.g. a
 * `rectangle` traverser). Our hex-shaped `spiral` grid is centered on (0, 0),
 * so hexes on the left/top of center have negative pixel coordinates — using
 * a "0 0 w h" viewBox would clip roughly half the board.
 */
export function boardBounds(hexes: HexHandle[]): { minX: number; minY: number; width: number; height: number } {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const hex of hexes) {
    for (const corner of hex.corners) {
      if (corner.x < minX) minX = corner.x
      if (corner.x > maxX) maxX = corner.x
      if (corner.y < minY) minY = corner.y
      if (corner.y > maxY) maxY = corner.y
    }
  }
  return { minX, minY, width: maxX - minX, height: maxY - minY }
}

/** Axial distance between two coordinate pairs (doesn't require a grid instance). */
export function axialDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** A player's home hex is permanently, unconditionally theirs — the one guaranteed anchor to cast from and expand out of. */
function homeOwnerOf(coords: { q: number; r: number }): PlayerId | null {
  if (coords.q === HOME_COORDS.orange.q && coords.r === HOME_COORDS.orange.r) return 'orange'
  if (coords.q === HOME_COORDS.purple.q && coords.r === HOME_COORDS.purple.r) return 'purple'
  return null
}

/** Accumulated per-hex territory pressure — see `updatePressure`. Keyed by hexKey; every grid hex has an entry once `createEmptyPressure` has run. */
export type TerritoryPressure = Record<string, Record<PlayerId, number>>

export const PRESSURE_PER_TURN = 2
export const PRESSURE_DECAY_PER_TURN = 1
export const PRESSURE_CAP = 6

export function createEmptyPressure(): TerritoryPressure {
  const pressure: TerritoryPressure = {}
  for (const hex of createGrid()) {
    pressure[hexKey(hex.q, hex.r)] = { orange: 0, purple: 0 }
  }
  return pressure
}

function mushroomOwnersInRange(coords: { q: number; r: number }, creatures: Record<string, CreatureInstance>): Set<PlayerId> {
  const owners = new Set<PlayerId>()
  for (const [key, creature] of Object.entries(creatures)) {
    if (!getTemplate(creature.templateId).capturesTerrain) continue
    const [mq, mr] = key.split(',').map(Number)
    if (axialDistance(coords, { q: mq, r: mr }) <= 1) owners.add(creature.owner)
  }
  return owners
}

/**
 * One turn's worth of pressure accumulation, called once per `endTurn`.
 * Every hex within 1 of a live Magic Mushroom gains PRESSURE_PER_TURN for
 * that Mushroom's owner (capped at PRESSURE_CAP, so a long-held hex plateaus
 * rather than growing forever); every hex *not* currently reinforced decays
 * by PRESSURE_DECAY_PER_TURN toward 0 instead of reverting instantly. Decay
 * being slower than growth means losing a Mushroom in combat drains a hex's
 * claim over a few turns rather than forfeiting it the instant it dies —
 * the direct fix for mushrooms "timing out" felt too abrupt.
 */
export function updatePressure(pressure: TerritoryPressure, creatures: Record<string, CreatureInstance>): TerritoryPressure {
  const next: TerritoryPressure = {}
  for (const hex of createGrid()) {
    const key = hexKey(hex.q, hex.r)
    const current = pressure[key] ?? { orange: 0, purple: 0 }
    const reinforcedBy = mushroomOwnersInRange(hex, creatures)
    next[key] = {
      orange: reinforcedBy.has('orange') ? Math.min(PRESSURE_CAP, current.orange + PRESSURE_PER_TURN) : Math.max(0, current.orange - PRESSURE_DECAY_PER_TURN),
      purple: reinforcedBy.has('purple') ? Math.min(PRESSURE_CAP, current.purple + PRESSURE_PER_TURN) : Math.max(0, current.purple - PRESSURE_DECAY_PER_TURN),
    }
  }
  return next
}

/**
 * Territory control, read off accumulated pressure (see `updatePressure`) —
 * not a live recompute from creature positions, since pressure has to
 * persist and decay across turns rather than snapping the instant a
 * Mushroom dies. Home hexes are checked first and are unconditional,
 * regardless of pressure. Equal (including 0-0, untouched) pressure is
 * contested/neutral.
 */
export function ownerOf(coords: { q: number; r: number }, pressure: TerritoryPressure): PlayerId | null {
  const home = homeOwnerOf(coords)
  if (home) return home

  const p = pressure[hexKey(coords.q, coords.r)] ?? { orange: 0, purple: 0 }
  if (p.orange > p.purple) return 'orange'
  if (p.purple > p.orange) return 'purple'
  return null
}

/** How many hexes each player currently controls (see `ownerOf`) — the mana-income tiebreaker. */
export function territoryCounts(pressure: TerritoryPressure): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = { orange: 0, purple: 0 }
  for (const hex of createGrid()) {
    const owner = ownerOf(hex, pressure)
    if (owner) counts[owner]++
  }
  return counts
}

/**
 * Whether a player owns any hex besides their own (unconditional) home hex —
 * the gate for casting non-Mushroom creatures. Home hex ownership alone
 * doesn't count, since every player already owns their home from turn one;
 * this specifically asks whether they've established ground with a live
 * Mushroom.
 */
export function controlsTerritoryBeyondHome(playerId: PlayerId, pressure: TerritoryPressure): boolean {
  const home = HOME_COORDS[playerId]
  for (const hex of createGrid()) {
    if (hex.q === home.q && hex.r === home.r) continue
    if (ownerOf(hex, pressure) === playerId) return true
  }
  return false
}
