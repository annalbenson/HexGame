import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { createBoard, polygonPoints, type TerrainType } from '../game/hexBoard'

const TERRAIN_COLORS: Record<TerrainType, string> = {
  forest: '#2f6b3a',
  hills: '#a9773f',
  plains: '#c9b458',
  desert: '#d9c17a',
  water: '#3a6ea5',
  mountains: '#7a7a7a',
}

const BOARD_WIDTH = 8
const BOARD_HEIGHT = 6

export function HexBoard() {
  const { grid, terrainByKey } = useMemo(() => createBoard(BOARD_WIDTH, BOARD_HEIGHT), [])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const hexes = grid.toArray()
  const viewWidth = grid.pixelWidth
  const viewHeight = grid.pixelHeight

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      style={{ background: '#0e1a12' }}
    >
      {hexes.map((hex) => {
        const key = hex.toString()
        const terrain = terrainByKey.get(key)!
        const isSelected = key === selectedKey

        return (
          <motion.polygon
            key={key}
            points={polygonPoints(hex)}
            fill={TERRAIN_COLORS[terrain]}
            stroke={isSelected ? '#ffffff' : '#0e1a12'}
            strokeWidth={isSelected ? 3 : 1}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: isSelected ? 1.06 : 1,
            }}
            whileHover={{ scale: 1.06, filter: 'brightness(1.15)' }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ cursor: 'pointer', transformOrigin: `${hex.x}px ${hex.y}px` }}
            onClick={() => setSelectedKey(key === selectedKey ? null : key)}
          />
        )
      })}
    </svg>
  )
}
