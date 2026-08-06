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

/**
 * Live territory control. Nobody starts with any territory beyond their own
 * home hex — everything else is neutral until a player's Magic Mushroom
 * claims it (self + 6 neighbors), and reverts to neutral the instant that
 * mushroom dies (mushrooms have a limited lifespan — see MUSHROOM_LIFESPAN
 * in gameReducer.ts). So territory has to be actively established and then
 * maintained, not claimed once and forgotten. Recomputed fresh from current
 * creature positions every call, no separate bookkeeping needed. Home hexes
 * are checked first and can never be captured by an enemy mushroom's claim
 * radius, even if it reaches into range. If mushrooms from both owners reach
 * the same hex, it's contested/neutral.
 */
export function ownerOf(coords: { q: number; r: number }, creatures: Record<string, CreatureInstance>): PlayerId | null {
  const home = homeOwnerOf(coords)
  if (home) return home

  const claims = new Set<PlayerId>()
  for (const [key, creature] of Object.entries(creatures)) {
    if (!getTemplate(creature.templateId).capturesTerrain) continue
    const [mq, mr] = key.split(',').map(Number)
    if (axialDistance(coords, { q: mq, r: mr }) <= 1) claims.add(creature.owner)
  }
  if (claims.size === 1) return [...claims][0]
  return null
}

/** How many hexes each player currently controls (see `ownerOf`) — the mana-income tiebreaker. */
export function territoryCounts(creatures: Record<string, CreatureInstance>): Record<PlayerId, number> {
  const counts: Record<PlayerId, number> = { orange: 0, purple: 0 }
  for (const hex of createGrid()) {
    const owner = ownerOf(hex, creatures)
    if (owner) counts[owner]++
  }
  return counts
}
