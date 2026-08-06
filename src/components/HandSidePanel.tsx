import { useMemo } from 'react'
import { CREATURE_ART } from '../game/art'
import { CENTER_COORDS, controlsTerritoryBeyondHome, hexKey, ownerOf } from '../game/board'
import { effectiveStats, getTemplate } from '../game/creatures'
import type { GameAction } from '../game/gameReducer'
import type { GameState, PlayerId } from '../game/types'

interface HandSidePanelProps {
  state: GameState
  dispatch: (action: GameAction) => void
  playerId: PlayerId
  /** Which seat, if any, the AI controls — changes this column's label from "Orange"/"Purple" to "Opponent"/"You". Null in 2-player hotseat mode. */
  aiPlayer: PlayerId | null
}

const PLAYER_LABEL: Record<PlayerId, string> = { orange: 'Orange', purple: 'Purple' }

/** A single player's hand as a vertical side panel flanking the board — orange on the left, purple on the right (see App.tsx), so the board's own height never shrinks as a hand grows past what fits without scrolling. */
export function HandSidePanel({ state, dispatch, playerId, aiPlayer }: HandSidePanelProps) {
  const player = state.players[playerId]
  const interactive = playerId === state.activePlayer
  const hasTerritory = useMemo(
    () => controlsTerritoryBeyondHome(playerId, state.territoryPressure),
    [playerId, state.territoryPressure],
  )

  const label = aiPlayer === playerId ? 'Opponent' : aiPlayer !== null ? 'You' : PLAYER_LABEL[playerId]

  return (
    <div className={`hand-side-panel hand-side-panel-${playerId}${interactive ? ' hand-side-panel-active' : ''}`}>
      <div className="hand-side-panel-header">
        <span className={`hand-side-panel-label hand-side-panel-label-${playerId}`}>{label}</span>
        <span className="hand-side-panel-mana">{player.mana} mana</span>
      </div>
      <div className="cards">
        {player.hand.length === 0 && <div className="empty-hand">No cards in hand</div>}
        {player.hand.map((card) => {
          const template = getTemplate(card.templateId)
          const isSelected = interactive && state.selection?.type === 'card' && state.selection.instanceId === card.instanceId
          const affordable = player.mana >= template.cost
          const isBigGuy = Boolean(template.growthPerTurn)

          const centerOccupant = state.creatures[hexKey(CENTER_COORDS.q, CENTER_COORDS.r)]
          const centerHeldByEnemy = Boolean(template.mustCastOnCenter) && Boolean(centerOccupant) && centerOccupant.owner !== playerId
          const centerNotOwned = Boolean(template.mustCastOnCenter) && ownerOf(CENTER_COORDS, state.territoryPressure) !== playerId
          const centerBlocked = centerHeldByEnemy || centerNotOwned
          const willSacrifice = Boolean(template.mustCastOnCenter) && !centerBlocked && centerOccupant?.owner === playerId

          const territoryBlocked = !template.capturesTerrain && !hasTerritory
          const { power, toughness, bonus } = effectiveStats(template, state.turnNumber)

          return (
            <button
              key={card.instanceId}
              className={`card${isSelected ? ' selected' : ''}${isBigGuy ? ' big-guy' : ''}`}
              disabled={!interactive || !affordable || centerBlocked || territoryBlocked}
              onClick={() => dispatch({ type: 'SELECT_CARD', instanceId: card.instanceId })}
            >
              <div className="card-cost-badge">{template.cost}</div>
              <div className="card-art" style={{ backgroundImage: `url(${CREATURE_ART[template.id]})` }} />
              <div className="card-body">
                <div className="card-name">{template.name}</div>
                <div className="card-stats">
                  {power}/{toughness} · move {template.movement}
                </div>
                {isBigGuy && (
                  <div className="card-growth">
                    growing — currently +{bonus}/+{bonus}
                  </div>
                )}
                {centerHeldByEnemy && <div className="card-locked">enemy holds the center hex</div>}
                {centerNotOwned && !centerHeldByEnemy && <div className="card-locked">requires owning the center hex</div>}
                {willSacrifice && centerOccupant && (
                  <div className="card-growth">sacrifices {getTemplate(centerOccupant.templateId).name} on the center hex</div>
                )}
                {territoryBlocked && <div className="card-locked">requires territory beyond your home hex</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
