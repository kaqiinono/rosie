import intoTheWild from './story-warriors-volumes/the-prophecies-begin/01-into-the-wild.json'
import fireAndIce from './story-warriors-volumes/the-prophecies-begin/02-fire-and-ice.json'
import forestOfSecrets from './story-warriors-volumes/the-prophecies-begin/03-forest-of-secrets.json'
import risingStorm from './story-warriors-volumes/the-prophecies-begin/04-rising-storm.json'
import aDangerousPath from './story-warriors-volumes/the-prophecies-begin/05-a-dangerous-path.json'
import theDarkestHour from './story-warriors-volumes/the-prophecies-begin/06-the-darkest-hour.json'
import midnight from './story-warriors-volumes/the-new-prophecy/01-midnight.json'
import moonrise from './story-warriors-volumes/the-new-prophecy/02-moonrise.json'
import dawn from './story-warriors-volumes/the-new-prophecy/03-dawn.json'
import starlight from './story-warriors-volumes/the-new-prophecy/04-starlight.json'
import twilight from './story-warriors-volumes/the-new-prophecy/05-twilight.json'
import sunset from './story-warriors-volumes/the-new-prophecy/06-sunset.json'
import theSight from './story-warriors-volumes/power-of-three/01-the-sight.json'
import darkRiver from './story-warriors-volumes/power-of-three/02-dark-river.json'
import outcast from './story-warriors-volumes/power-of-three/03-outcast.json'
import eclipse from './story-warriors-volumes/power-of-three/04-eclipse.json'
import longShadows from './story-warriors-volumes/power-of-three/05-long-shadows.json'
import sunrise from './story-warriors-volumes/power-of-three/06-sunrise.json'
import theFourthApprentice from './story-warriors-volumes/omen-of-the-stars/01-the-fourth-apprentice.json'
import fadingEchoes from './story-warriors-volumes/omen-of-the-stars/02-fading-echoes.json'
import nightWhispers from './story-warriors-volumes/omen-of-the-stars/03-night-whispers.json'
import signOfTheMoon from './story-warriors-volumes/omen-of-the-stars/04-sign-of-the-moon.json'
import theForgottenWarrior from './story-warriors-volumes/omen-of-the-stars/05-the-forgotten-warrior.json'
import theLastHope from './story-warriors-volumes/omen-of-the-stars/06-the-last-hope.json'
import theSunTrail from './story-warriors-volumes/dawn-of-the-clans/01-the-sun-trail.json'
import thunderRising from './story-warriors-volumes/dawn-of-the-clans/02-thunder-rising.json'
import theFirstBattle from './story-warriors-volumes/dawn-of-the-clans/03-the-first-battle.json'
import theBlazingStar from './story-warriors-volumes/dawn-of-the-clans/04-the-blazing-star.json'
import aForestDivided from './story-warriors-volumes/dawn-of-the-clans/05-a-forest-divided.json'
import pathOfStars from './story-warriors-volumes/dawn-of-the-clans/06-path-of-stars.json'
import theApprenticesQuest from './story-warriors-volumes/a-vision-of-shadows/01-the-apprentices-quest.json'
import thunderAndShadow from './story-warriors-volumes/a-vision-of-shadows/02-thunder-and-shadow.json'
import shatteredSky from './story-warriors-volumes/a-vision-of-shadows/03-shattered-sky.json'
import darkestNight from './story-warriors-volumes/a-vision-of-shadows/04-darkest-night.json'
import riverOfFire from './story-warriors-volumes/a-vision-of-shadows/05-river-of-fire.json'
import theRagingStorm from './story-warriors-volumes/a-vision-of-shadows/06-the-raging-storm.json'
import lostStars from './story-warriors-volumes/the-broken-code/01-lost-stars.json'
import theSilentThaw from './story-warriors-volumes/the-broken-code/02-the-silent-thaw.json'
import veilOfShadows from './story-warriors-volumes/the-broken-code/03-veil-of-shadows.json'
import darknessWithin from './story-warriors-volumes/the-broken-code/04-darkness-within.json'
import thePlaceOfNoStars from './story-warriors-volumes/the-broken-code/05-the-place-of-no-stars.json'
import aLightInTheMist from './story-warriors-volumes/the-broken-code/06-a-light-in-the-mist.json'
import river from './story-warriors-volumes/a-starless-clan/01-river.json'
import sky from './story-warriors-volumes/a-starless-clan/02-sky.json'
import shadow from './story-warriors-volumes/a-starless-clan/03-shadow.json'
import thunder from './story-warriors-volumes/a-starless-clan/04-thunder.json'
import wind from './story-warriors-volumes/a-starless-clan/05-wind.json'
import star from './story-warriors-volumes/a-starless-clan/06-star.json'
import type { StorySeries, StoryVolume } from './story-types'

function season(seasonNumber: number, slug: string, title: string, description: string, volumes: StoryVolume[]): StorySeries {
  return { seasonNumber, slug: `warriors-${slug}`, title: `Warriors: ${title}`, language: 'en', author: 'Erin Hunter', description, volumes }
}

export const warriorsSeries: StorySeries[] = [
  season(
    1, 'the-prophecies-begin', 'The Prophecies Begin',
    'Follow Rusty into the forest, where four Clans hunt, quarrel and share a code of their own.',
    [intoTheWild, fireAndIce, forestOfSecrets, risingStorm, aDangerousPath, theDarkestHour],
  ),
  season(
    2, 'the-new-prophecy', 'The New Prophecy',
    'Young cats from different Clans follow a message from their ancestors far beyond the forest.',
    [midnight, moonrise, dawn, starlight, twilight, sunset],
  ),
  season(
    3, 'power-of-three', 'Power of Three',
    'Three ThunderClan littermates grow up by the lake in the shadow of a prophecy about their powers.',
    [theSight, darkRiver, outcast, eclipse, longShadows, sunrise],
  ),
  season(
    4, 'omen-of-the-stars', 'Omen of the Stars',
    'As a threat grows in the Dark Forest, the cats of the lake must learn which voices to trust.',
    [theFourthApprentice, fadingEchoes, nightWhispers, signOfTheMoon, theForgottenWarrior, theLastHope],
  ),
  season(
    5, 'dawn-of-the-clans', 'Dawn of the Clans',
    'Mountain cats set out in search of food and shelter in the days before the forest Clans existed.',
    [theSunTrail, thunderRising, theFirstBattle, theBlazingStar, aForestDivided, pathOfStars],
  ),
  season(
    6, 'a-vision-of-shadows', 'A Vision of Shadows',
    'Alderpaw sets out to trace a lost Clan, and the cats around the lake face the return of old rivals.',
    [theApprenticesQuest, thunderAndShadow, shatteredSky, darkestNight, riverOfFire, theRagingStorm],
  ),
  season(
    7, 'the-broken-code', 'The Broken Code',
    'When the medicine cats lose contact with StarClan, three young cats must question the orders of a leader.',
    [lostStars, theSilentThaw, veilOfShadows, darknessWithin, thePlaceOfNoStars, aLightInTheMist],
  ),
  season(
    8, 'a-starless-clan', 'A Starless Clan',
    'Frostpaw, Sunbeam and Nightheart find their loyalties tested as the Clans begin to change the warrior code.',
    [river, sky, shadow, thunder, wind, star],
  ),
]
