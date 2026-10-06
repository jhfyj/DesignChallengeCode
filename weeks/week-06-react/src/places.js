import madrid from './places/madrid.jpg'
import amsterdam from './places/amsterdam.jpg'
import ginza from './places/ginza.jpg'
import chongqing from './places/chongqing.jpg'
import frankfurt from './places/frankfurt.jpg'
import porto from './places/porto.jpg'
import newyork from './places/newyork.jpg'
import losangeles from './places/losangeles.jpg'

// Every place is a photo plus the clock it keeps. To add one, drop the image in
// src/places/, import it above, and append an entry. Nothing else changes: the
// dot grid is sampled from the photo at runtime.
//
//   crop     the [top, bottom] slice of the photo the tile shows, as
//            fractions of its height.
//   cropX    the [left, right] slice, as fractions of its width. Leave it out
//            to keep the full width; a landscape photo needs it to make a
//            portrait tile.
//   lat, lng where it is, for its dot on the world map.
//   sunrise, sunset   local hours, fractional. Rough is fine; they only steer
//            the dawn and dusk blend.
//   look     how the photo is read -- where the sky can reach, what counts as
//            a light, what the ground becomes by day. Every knob and its
//            default is listed at LOOK in dotfield.js.
export const PLACES = [
  {
    id: 'madrid',
    name: 'Madrid, Spain',
    timeZone: 'Europe/Madrid',
    lat: 40.42,
    lng: -3.7,
    image: madrid,
    crop: [0.05, 0.75],
    cropX: [0.12, 0.88],
    sunrise: 7.9,
    sunset: 20.2,
    // A street in the centre on a clear evening, the facades in late sun, so
    // an invented night: the buildings stay faintly lit by the street, their
    // own windows light up, the shopfronts glow and the iron lanterns on the
    // walls come on. The painted facades are colourful enough to pass for
    // string lights, so those are off.
    look: {
      horizon: 0.6,
      daylit: true,
      skyLift: 0.35,
      panes: true,
      windows: 0.8,
      strings: 1,
      facade: 0.38,
      shops: 0.84,
      lamps: [
        [0.145, 0.69],
        [0.5, 0.72],
        [0.95, 0.66],
      ],
    },
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam, Netherlands',
    timeZone: 'Europe/Amsterdam',
    lat: 52.37,
    lng: 4.9,
    image: amsterdam,
    crop: [0.2, 0.75],
    cropX: [0.45, 0.785],
    sunrise: 7.8,
    sunset: 19.1,
    // The Damrak canal houses in late sun, so an invented night: the houses
    // stay faintly lit and their own windows light up, lamps run along the
    // waterline, and it all ripples in the canal. Sunlit brick is warm and saturated enough to pass for
    // bunting or floodlit stone, so both are switched off.
    look: {
      horizon: 0.78,
      daylit: true,
      skyLift: 0.35,
      panes: true,
      windows: 0.8,
      strings: 1,
      facade: 0.4,
      promenade: true,
      reflect: true,
      ripple: true,
    },
  },
  {
    id: 'ginza',
    name: 'Ginza, Japan',
    timeZone: 'Asia/Tokyo',
    lat: 35.67,
    lng: 139.77,
    image: ginza,
    crop: [0.22, 1],
    sunrise: 5.6,
    sunset: 17.4,
    // Tokyo from above at night: an empty black sky over a carpet of lights
    // too small for one dot each, so the bar is lowered to let the scatter
    // and the lit tower through alongside the highway.
    look: {
      horizon: 0.3,
      glow: [0.05, 0.28],
      ground: [0.3, 0.32, 0.36],
      gain: 0.6,
    },
  },
  {
    id: 'chongqing',
    name: 'Chongqing, China',
    timeZone: 'Asia/Shanghai',
    lat: 29.56,
    lng: 106.55,
    image: chongqing,
    crop: [0.25, 0.9],
    cropX: [0.4, 0.75],
    sunrise: 7.1,
    sunset: 18.9,
    // A skyline across the river, cut to the densest towers. The unlit towers
    // are as black as the sky, so by day they go with it and the made-up
    // skyline stands in; the river below ripples like a wet street.
    look: {
      horizon: 0.75,
      towers: true,
      ripple: true,
      ground: [0.26, 0.31, 0.38],
      gain: 0.5,
    },
  },
  {
    id: 'frankfurt',
    name: 'Frankfurt, Germany',
    timeZone: 'Europe/Berlin',
    lat: 50.11,
    lng: 8.68,
    image: frankfurt,
    crop: [0.25, 0.75],
    cropX: [0.2, 0.74],
    sunrise: 7.4,
    sunset: 18.9,
    // Taken on a sunny afternoon, so the photo is the day and the night is
    // invented from it -- see daylit in dotfield.js. The crop keeps the
    // towers, the red church and the Main, and leaves the camera watermark
    // and most of the bridge railing out.
    look: {
      horizon: 0.7,
      daylit: true,
      skyLift: 0.35,
      ripple: true,
      flood: true,
      promenade: true,
      reflect: true,
    },
  },
  {
    id: 'porto',
    name: 'Porto, Portugal',
    timeZone: 'Europe/Lisbon',
    lat: 41.15,
    lng: -8.61,
    image: porto,
    crop: [0.15, 0.85],
    cropX: [0.12, 0.88],
    sunrise: 7.6,
    sunset: 19.1,
    // A sunny old-town street hung with bunting, so another invented night:
    // the buildings stay faintly lit by the street and their own windows light
    // up, the bunting becomes festival string lights, the shopfronts glow, the
    // TV tower across the river gets its red light, and the two street lamps
    // in the photo come on.
    look: {
      horizon: 0.6,
      daylit: true,
      skyLift: 0.35,
      panes: true,
      windows: 0.8,
      strings: 0.14,
      facade: 0.55,
      shops: 0.85,
      beacon: [0.34, 0.46],
      lamps: [[0.26, 0.33], [0.92, 0.87]],
    },
  },
  {
    id: 'newyork',
    name: 'New York, USA',
    timeZone: 'America/New_York',
    lat: 40.71,
    lng: -74.01,
    image: newyork,
    crop: [0.2, 0.85],
    cropX: [0.28, 0.98],
    sunrise: 7,
    sunset: 18.6,
    // Taken at sunset, so the photo is the dusk: the streaked orange sky is
    // sky (it would otherwise score as one huge light), and the towers are
    // silhouettes with a few real lit windows. At night they stand out from
    // a darker sky, their windows mostly lit as Midtown's are, their crowns
    // floodlit, and an aviation light on the Hudson Yards spire.
    look: {
      horizon: 0.56,
      duskPhoto: true,
      invent: true,
      skyLift: 0.5,
      skyDrop: 0.35,
      skyStep: 0.13,
      glow: [0.12, 0.35],
      windows: 0.42,
      strings: 1,
      mass: [0.2, 0.2, 0.23],
      nightSky: [0.11, 0.12, 0.17],
      crowns: true,
      ground: [0.32, 0.34, 0.38],
      gain: 0.6,
    },
  },
  {
    id: 'losangeles',
    name: 'Los Angeles, California',
    timeZone: 'America/Los_Angeles',
    lat: 34.05,
    lng: -118.24,
    image: losangeles,
    crop: [0.28, 0.98],
    cropX: [0.12, 0.55],
    sunrise: 6.9,
    sunset: 18.5,
    // The basin from the hills at night: a sky glowing with the city's haze
    // (bright, but sky), a carpet of lights along the horizon -- every dot a
    // light, sodium orange, white and the odd cool LED -- with a boulevard
    // running into it, and dark hills scattered with houses.
    look: {
      horizon: 0.4,
      haze: true,
      skyLift: 0.65,
      // Measured above each row's haze (see haze in dotfield.js), so the
      // carpet of lights stays a scatter instead of fusing into a white bar.
      glow: [0.04, 0.3],
      // Except the band where the basin spreads out below: every dot a light.
      carpet: [0.38, 0.62],
      ground: [0.33, 0.32, 0.27],
      gain: 0.5,
    },
  },
]
