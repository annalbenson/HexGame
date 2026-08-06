import landingBg from '../assets/landing-bg.png'

interface LandingProps {
  onStartGame: () => void
}

export function Landing({ onStartGame }: LandingProps) {
  return (
    <div id="landing" style={{ backgroundImage: `url(${landingBg})` }}>
      <div id="landing-scrim" />
      <div id="landing-content">
        <h1 id="landing-title">HexGame</h1>
        <p id="landing-tagline">Claim the board. Feed the center. Survive what you summon.</p>
        <div id="landing-menu">
          <button className="landing-button landing-button-primary" onClick={onStartGame}>
            Start Game
          </button>
          <button className="landing-button" disabled title="Coming soon">
            Load Game
          </button>
          <button className="landing-button" disabled title="Coming soon">
            Tutorial
          </button>
        </div>
      </div>
    </div>
  )
}
