// An endless activity history. Entry 0 is the newest; higher numbers are older.
// The first few are hand-written; everything past them is generated
// deterministically, so an entry reads the same every time you scroll back to it.

const RECENT = [
  {
    title: 'State access to lab components',
    summary: 'Lab components now have explicit access levels, so drafts stay private until they are ready.',
    points: [
      'Every component mapped to an owner',
      'Three levels: view, comment, edit',
      'Access changes are logged for review',
      'Drafts hidden from the public library',
    ],
  },
  {
    title: 'Opened lab to the wider team',
    summary: 'The lab is visible to the whole product org for the first time.',
    points: [
      'Invite link shared in #design',
      'Read-only by default for new members',
      'Feedback channel set up for questions',
    ],
  },
  {
    title: 'Refactored input states',
    summary: 'Text inputs share one set of states instead of four slightly different ones.',
    points: [
      'Error state uses the new red token',
      'Helper text spacing fixed at 4px',
      'Disabled opacity raised for contrast',
      'Old variants marked deprecated',
    ],
  },
  {
    title: 'Reviewed color contrast',
    status: 'warn',
    summary: 'A pass over every text and background pair in the palette.',
    points: [
      'Two pairs fell below AA and were adjusted',
      'Tokens renamed to describe their role',
      'Dark mode checked against the same rules',
    ],
  },
  {
    title: 'Published type ramp v2',
    summary: 'A tighter type scale with dedicated display sizes for marketing pages.',
    points: [
      'Display sizes added above 40px',
      'Line heights tightened on headings',
      'Mono face swapped to Roboto Mono',
    ],
  },
  {
    title: 'Audited icon library',
    summary: 'Cleaned up the icon set before it moves into the shared library.',
    points: [
      '41 duplicate icons removed',
      'Stroke widths unified at 1.5px',
      'Export sizes fixed at 16, 20 and 24',
    ],
  },
  {
    title: 'Merged button variants',
    summary: 'Seven button variants collapsed into three with clear rules for each.',
    points: [
      'Ghost style deprecated',
      'Focus ring matches the input focus',
      'Docs page regenerated with examples',
    ],
  },
  {
    title: 'Drafted spec for grid tokens',
    summary: 'A first proposal for layout tokens that work across web and mobile.',
    points: [
      'Column count set to 12 on desktop',
      'Gutter scale follows the spacing ramp',
      'Shared with design ops for comments',
    ],
  },
]

const VERBS = ['Reviewed', 'Rebuilt', 'Audited', 'Documented', 'Merged', 'Drafted', 'Tested', 'Archived', 'Published', 'Renamed']
const THINGS = [
  'card layouts',
  'modal states',
  'spacing scale',
  'chart colors',
  'table density',
  'menu patterns',
  'toast timings',
  'avatar sizes',
  'form validation',
  'tab components',
  'motion tokens',
  'empty states',
  'badge styles',
  'tooltip delays',
]
const SUMMARIES = [
  'Brought the {thing} in line with the rest of the system.',
  'A focused pass on {thing} after feedback from product teams.',
  'Cleared out inconsistencies in {thing} before the next release.',
  'Follow-up work on {thing} from the last design crit.',
]
const POINTS = [
  'Owners assigned for each piece',
  'Docs page regenerated with examples',
  'Shared with design ops for comments',
  'Two edge cases logged for later',
  'Tokens renamed to describe their role',
  'Figma library synced with code',
  'Changelog updated for the release',
  'Reviewed in the weekly crit',
  'Unused variants removed',
  'Usage guidelines added',
  'Snapshot tests passing',
  'Handed off to engineering',
]

// Small integer hash so generated entries are stable but varied.
export function hash(n) {
  let x = (n + 0x9e3779b9) | 0
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

function formatAge(hours) {
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  if (days < 14) return `${days} d ago`
  if (days < 60) return `${Math.floor(days / 7)} wk ago`
  if (days < 730) return `${Math.floor(days / 30)} mo ago`
  return `${Math.floor(days / 365)} yr ago`
}

// Hours since each entry, built up lazily as older entries are asked for.
const ages = [5]
function ageOf(k) {
  while (ages.length <= k) {
    const n = ages.length
    ages.push(ages[n - 1] + 3 + (hash(n) % 18))
  }
  return ages[k]
}

// Most entries are fine; roughly 1 in 10 needs attention and 1 in 20 is a problem.
function statusFor(k) {
  const roll = hash(k * 31 + 5) % 20
  return roll === 0 ? 'alert' : roll <= 2 ? 'warn' : 'ok'
}

const cache = new Map()

export function entryAt(k) {
  let entry = cache.get(k)
  if (entry) return entry
  const time = formatAge(ageOf(k))
  if (k < RECENT.length) {
    entry = { status: 'ok', ...RECENT[k], time }
  } else {
    const h = hash(k)
    const thing = THINGS[(h >>> 8) % THINGS.length]
    const first = hash(k * 7) % POINTS.length
    entry = {
      title: `${VERBS[h % VERBS.length]} ${thing}`,
      status: statusFor(k),
      summary: SUMMARIES[(h >>> 16) % SUMMARIES.length].replace('{thing}', thing),
      points: [0, 4, 7].map((j) => POINTS[(first + j) % POINTS.length]),
      time,
    }
  }
  cache.set(k, entry)
  return entry
}
