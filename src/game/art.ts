import lvlOne from '../assets/lvl-one-mushroom.jpg'
import lvlTwo from '../assets/lvl-two-creature.jpg'
import lvlThree from '../assets/lvl-three-creature.jpg'
import lvlFive from '../assets/lvl-five-creature.jpg'
import bigGuy from '../assets/the-big-guy.jpg'

/** Card art per template, generated and named by Fibonacci cost tier (1/2/3/5/8). */
export const CREATURE_ART: Record<string, string> = {
  skitterling: lvlOne,
  'spore-crawler': lvlTwo,
  wraithling: lvlThree,
  behemoth: lvlFive,
  'the-big-guy': bigGuy,
}
