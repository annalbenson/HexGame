import { useReducer, useState } from 'react'
import { HexBoard } from './components/HexBoard'
import { HandPanel } from './components/HandPanel'
import { HandSidePanel } from './components/HandSidePanel'
import { Landing } from './components/Landing'
import { createInitialState, gameReducer } from './game/gameReducer'
import { useAiOpponent } from './hooks/useAiOpponent'
import type { StrategyName } from './sim/strategies'
import './App.css'

type OpponentSetting = 'none' | StrategyName

const OPPONENT_OPTIONS: { value: OpponentSetting; label: string }[] = [
  { value: 'none', label: '2-player (no AI)' },
  { value: 'random', label: 'Random' },
  { value: 'rusher', label: 'Rusher' },
  { value: 'turtler', label: 'Turtler' },
  { value: 'hoarder', label: 'Hoarder' },
]

/** Orange is always the AI seat when one's selected — orange also goes first, so the AI opens the game. Purple stays the human seat. */
const AI_PLAYER = 'orange'

function App() {
  const [screen, setScreen] = useState<'landing' | 'game'>('landing')
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const [opponent, setOpponent] = useState<OpponentSetting>('none')
  useAiOpponent(state, dispatch, AI_PLAYER, opponent === 'none' ? null : opponent)

  // Neither HexBoard nor HandPanel know an AI seat exists — they just call
  // whatever dispatch they're given. Swapping in a no-op during the AI's
  // turn is what actually stops the human from clicking the AI's cards or
  // pieces out from under it mid-move, without threading an "interactive"
  // flag through every click handler in both components.
  const isAiTurn = opponent !== 'none' && state.activePlayer === AI_PLAYER
  const guardedDispatch = isAiTurn ? () => {} : dispatch
  const aiPlayer = opponent === 'none' ? null : AI_PLAYER

  // Locked once a game is actually underway (something's been cast, or a
  // turn's passed) so switching strategies mid-game can't happen by
  // accident — unlocks again once the game ends or New Game resets it.
  const gameInProgress = !state.winner && (state.turnNumber > 1 || Object.keys(state.creatures).length > 0)

  if (screen === 'landing') {
    return <Landing onStartGame={() => setScreen('game')} />
  }

  return (
    <div id="app-root">
      <h1>HexGame</h1>
      <div id="opponent-select">
        <label htmlFor="opponent-strategy">Opponent</label>
        <select
          id="opponent-strategy"
          value={opponent}
          disabled={gameInProgress}
          onChange={(e) => setOpponent(e.target.value as OpponentSetting)}
        >
          {OPPONENT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <button
          id="new-game"
          onClick={() => {
            // Orange (the AI seat) always goes first, so if `opponent` stayed
            // set, useAiOpponent would see it's already the AI's turn on the
            // fresh state and move within ~550ms — re-locking the selector
            // before there's any real chance to change it. Clearing the
            // choice keeps the AI dormant until one's explicitly picked
            // again, same as on first load.
            setOpponent('none')
            dispatch({ type: 'RESET' })
          }}
        >
          New Game
        </button>
        {isAiTurn && <span id="ai-turn-indicator">AI is playing…</span>}
      </div>
      <div id="game-row">
        <HandSidePanel state={state} dispatch={guardedDispatch} playerId="orange" aiPlayer={aiPlayer} />
        <div id="board-container">
          <HexBoard state={state} dispatch={guardedDispatch} />
        </div>
        <HandSidePanel state={state} dispatch={guardedDispatch} playerId="purple" aiPlayer={aiPlayer} />
      </div>
      <HandPanel state={state} dispatch={guardedDispatch} />
    </div>
  )
}

export default App
