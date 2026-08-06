import { simulateGame, type GameStats } from '../src/sim/simulateGame'
import type { StrategyName } from '../src/sim/strategies'

const STRATEGY_NAMES: StrategyName[] = ['random', 'rusher', 'turtler', 'hoarder']

function parseGamesArg(): number {
  const arg = process.argv.find((a) => a.startsWith('--games='))
  return arg ? Number(arg.split('=')[1]) : 20
}

function pct(n: number, total: number): string {
  return total === 0 ? ' - ' : `${Math.round((n / total) * 100)}%`.padStart(4)
}

function avg(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length
}

interface Matchup {
  orangeStrategy: StrategyName
  purpleStrategy: StrategyName
  stats: GameStats
}

function runMatchup(orangeStrategy: StrategyName, purpleStrategy: StrategyName, count: number): Matchup[] {
  const results: Matchup[] = []
  for (let i = 0; i < count; i++) {
    results.push({ orangeStrategy, purpleStrategy, stats: simulateGame({ orange: orangeStrategy, purple: purpleStrategy }) })
  }
  return results
}

function summarizeMatchup(orangeStrategy: StrategyName, purpleStrategy: StrategyName, games: Matchup[]) {
  const total = games.length
  const orangeWins = games.filter((g) => g.stats.winner === 'orange').length
  const purpleWins = games.filter((g) => g.stats.winner === 'purple').length
  const draws = games.filter((g) => g.stats.winner === 'draw').length
  const elimination = games.filter((g) => g.stats.winReason === 'elimination').length
  const survival = games.filter((g) => g.stats.winReason === 'survival').length
  const aborted = games.filter((g) => g.stats.winReason === 'aborted').length
  const avgTurns = avg(games.map((g) => g.stats.turns)).toFixed(1)
  const bigGuySeen = pct(games.filter((g) => g.stats.bigGuyFielded.orange || g.stats.bigGuyFielded.purple).length, total)

  console.log(
    `${orangeStrategy.padEnd(8)} vs ${purpleStrategy.padEnd(8)} | orange ${pct(orangeWins, total)} purple ${pct(purpleWins, total)} draw ${pct(draws, total)}` +
      ` | elim ${pct(elimination, total)} surv ${pct(survival, total)}${aborted > 0 ? ` ABORTED:${aborted}` : ''}` +
      ` | avg turns ${avgTurns} | big guy landed ${bigGuySeen}`,
  )
}

function main() {
  const count = parseGamesArg()
  console.log(`Running ${STRATEGY_NAMES.length * STRATEGY_NAMES.length} matchups x ${count} games each (${STRATEGY_NAMES.length * STRATEGY_NAMES.length * count} total)...\n`)

  const allGames: Matchup[] = []
  for (const orangeStrategy of STRATEGY_NAMES) {
    for (const purpleStrategy of STRATEGY_NAMES) {
      const games = runMatchup(orangeStrategy, purpleStrategy, count)
      summarizeMatchup(orangeStrategy, purpleStrategy, games)
      allGames.push(...games)
    }
  }

  const totalGames = allGames.length
  const firstPlayerWins = allGames.filter((g) => g.stats.winner === g.stats.firstPlayer).length
  const abortedTotal = allGames.filter((g) => g.stats.winReason === 'aborted').length

  console.log('\n--- Overall ---')
  console.log(`Total games: ${totalGames}`)
  console.log(`First-player win rate: ${pct(firstPlayerWins, totalGames)} (orange always goes first — isolates turn-order edge from strategy skill)`)
  if (abortedTotal > 0) {
    console.log(`⚠ ${abortedTotal} game(s) hit the safety cap without the reducer ever producing a winner — investigate before trusting these results.`)
  }

  console.log('\nPer-strategy (aggregated across both sides):')
  for (const strategyName of STRATEGY_NAMES) {
    const asOrange = allGames.filter((g) => g.orangeStrategy === strategyName)
    const asPurple = allGames.filter((g) => g.purpleStrategy === strategyName)
    const relevant = asOrange.length + asPurple.length
    const wins = asOrange.filter((g) => g.stats.winner === 'orange').length + asPurple.filter((g) => g.stats.winner === 'purple').length
    const bigGuyFielded =
      asOrange.filter((g) => g.stats.bigGuyFielded.orange).length + asPurple.filter((g) => g.stats.bigGuyFielded.purple).length
    const avgBurned = avg([...asOrange.map((g) => g.stats.cardsBurned.orange), ...asPurple.map((g) => g.stats.cardsBurned.purple)])
    const avgTerritory = avg([...asOrange.map((g) => g.stats.territory.orange), ...asPurple.map((g) => g.stats.territory.purple)])

    console.log(
      `${strategyName.padEnd(8)} | win rate ${pct(wins, relevant)} (${relevant} games) | big guy landed ${pct(bigGuyFielded, relevant)}` +
        ` | avg cards burned ${avgBurned.toFixed(2)} | avg final territory ${avgTerritory.toFixed(1)}`,
    )
  }
}

main()
