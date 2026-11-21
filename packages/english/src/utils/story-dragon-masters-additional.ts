import type { StoryVolume } from './story-types'
import griffithsGuide from './story-dragon-masters-volumes/00-griffiths-guide-for-dragon-masters.json'
import volume03 from './story-dragon-masters-volumes/03-secret-of-the-water-dragon.json'
import volume04 from './story-dragon-masters-volumes/04-power-of-the-fire-dragon.json'
import volume05 from './story-dragon-masters-volumes/05-song-of-the-poison-dragon.json'
import volume06 from './story-dragon-masters-volumes/06-flight-of-the-moon-dragon.json'
import volume07 from './story-dragon-masters-volumes/07-search-for-the-lightning-dragon.json'
import volume08 from './story-dragon-masters-volumes/08-roar-of-the-thunder-dragon.json'
import volume09 from './story-dragon-masters-volumes/09-chill-of-the-ice-dragon.json'
import volume10 from './story-dragon-masters-volumes/10-waking-the-rainbow-dragon.json'
import volume11 from './story-dragon-masters-volumes/11-shine-of-the-silver-dragon.json'
import volume12 from './story-dragon-masters-volumes/12-treasure-of-the-gold-dragon.json'
import volume13 from './story-dragon-masters-volumes/13-eye-of-the-earthquake-dragon.json'
import volume14 from './story-dragon-masters-volumes/14-the-land-of-the-spring-dragon.json'
import volume15 from './story-dragon-masters-volumes/15-future-of-the-time-dragon.json'
import volume16 from './story-dragon-masters-volumes/16-call-of-the-sound-dragon.json'
import volume17 from './story-dragon-masters-volumes/17-fortress-of-the-stone-dragon.json'
import volume18 from './story-dragon-masters-volumes/18-heat-of-the-lava-dragon.json'
import volume19 from './story-dragon-masters-volumes/19-wave-of-the-sea-dragon.json'
import volume20 from './story-dragon-masters-volumes/20-howl-of-the-wind-dragon.json'
import volume21 from './story-dragon-masters-volumes/21-bloom-of-the-flower-dragon.json'
import volume22 from './story-dragon-masters-volumes/22-guarding-the-invisible-dragons.json'
import volume23 from './story-dragon-masters-volumes/23-curse-of-the-shadow-dragon.json'
import volume24 from './story-dragon-masters-volumes/24-dawn-of-the-light-dragon.json'

export const additionalDragonMastersVolumes: StoryVolume[] = [
  volume03,
  volume04,
  volume05,
  volume06,
  volume07,
  volume08,
  volume09,
  volume10,
  volume11,
  volume12,
  volume13,
  volume14,
  volume15,
  volume16,
  volume17,
  volume18,
  volume19,
  volume20,
  volume21,
  volume22,
  volume23,
  volume24,
  { ...griffithsGuide, kind: 'guide' },
]
