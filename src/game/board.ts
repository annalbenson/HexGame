import { defineHex, Grid, spiral, Orientation } from 'honeycomb-grid'
import type { PlayerId } from './types'

export const HEX_SIZE = 40
export const BOARD_RADIUS = 3

export const Tile = defineHex({
  dimensions: HEX_SIZE,
  orientation: Orientation.FLAT,
  origin: 'topLeft',
})

export type HexHandle = InstanceType<typeof Tile>

export const HOME_COORDS: Record<PlayerId, { q: number; r: number }> = {
  orange: { q: -BOARD_RADIUS, r: 0 },
  purple: { q: BOARD_RADIUS, r: 0 },
}

export function createGrid() {
  return new Grid(Tile, spiral({ radius: BOARD_RADIUS, start: [0, 0] }))
}

export function hexKey(q: number, r: number): string {
  return `${q},${r}`
}

export function keyOf(hex: HexHandle): string {
  return hexKey(hex.q, hex.r)
}

export function polygonPoints(hex: HexHandle): string {
  return hex.corners.map((c) => `${c.x},${c.y}`).join(' ')
}

/** Axial distance between two coordinate pairs (doesn't require a grid instance). */
export function axialDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q
  const dr = a.r - b.r
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** Which player's territory a hex belongs to, based on proximity to each home. Ties are neutral. */
export function ownerOf(coords: { q: number; r: number }): PlayerId | null {
  const dOrange = axialDistance(coords, HOME_COORDS.orange)
  const dPurple = axialDistance(coords, HOME_COORDS.purple)
  if (dOrange < dPurple) return 'orange'
  if (dPurple < dOrange) return 'purple'
  return null
}
