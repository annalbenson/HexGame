import { defineHex, Grid, rectangle, Orientation } from 'honeycomb-grid'

export const HEX_SIZE = 40

export const Tile = defineHex({
  dimensions: HEX_SIZE,
  orientation: Orientation.FLAT,
  origin: 'topLeft',
})

export type TerrainType = 'forest' | 'hills' | 'plains' | 'desert' | 'water' | 'mountains'

const TERRAIN_TYPES: TerrainType[] = ['forest', 'hills', 'plains', 'desert', 'water', 'mountains']

export function createBoard(width: number, height: number) {
  const grid = new Grid(Tile, rectangle({ width, height }))
  const terrainByKey = new Map<string, TerrainType>()

  grid.forEach((hex) => {
    const terrain = TERRAIN_TYPES[Math.floor(Math.random() * TERRAIN_TYPES.length)]
    terrainByKey.set(hex.toString(), terrain)
  })

  return { grid, terrainByKey }
}

export function polygonPoints(hex: InstanceType<typeof Tile>) {
  return hex.corners.map((c) => `${c.x},${c.y}`).join(' ')
}
