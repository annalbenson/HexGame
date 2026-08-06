import { useReducer } from 'react'
import { HexBoard } from './components/HexBoard'
import { HandPanel } from './components/HandPanel'
import { createInitialState, gameReducer } from './game/gameReducer'
import './App.css'

function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)

  return (
    <div id="app-root">
      <h1>HexGame</h1>
      <div id="board-container">
        <HexBoard state={state} dispatch={dispatch} />
      </div>
      <HandPanel state={state} dispatch={dispatch} />
    </div>
  )
}

export default App
