// One long session with a coding agent working on the design-lab repo.
// Each timeline entry is a task in that session: the request, the work the
// agent did (tool calls, diffs, command output), and its summary.
//
// Block types:
//   { user: '...' }                         a message from you
//   { agent: '...', bullets?: [...] }       the agent talking
//   { tool, target, result, status? }       a tool call and its one-line result
//   { diff: 'path', lines: [[sign, text]] } an edit, sign is '+', '-' or ' '
//   { run: 'command', output: '...' }       a terminal command and its output
// Backticks in text render as inline code.

const WRITTEN = [
  // 0 — State access to lab components
  [
    {
      user: 'Now that the whole org can see the lab, people keep finding half-finished components and using them. Can we set access per component so drafts stay private until they’re ready?',
    },
    {
      agent: 'Makes sense. I’ll check how components are registered in the lab and how many are still drafts, then add an access policy on top of the org visibility we set up in the last task.',
    },
    { tool: 'Read', target: 'lab.config.ts', result: 'visibility: org · defaultRole: viewer' },
    { tool: 'Search', target: "status: 'draft'", result: '19 components across 7 packages' },
    { tool: 'Read', target: 'src/registry/component.ts', result: 'No access field on ComponentMeta' },
    {
      agent: 'Nothing in the registry knows about access yet, so every component inherits org-wide visibility. I’ll add three levels — view, comment and edit — and hide drafts from anyone who isn’t an owner.',
    },
    {
      diff: 'src/access/policy.ts',
      lines: [
        ['+', "export type Access = 'view' | 'comment' | 'edit'"],
        ['+', ''],
        ['+', 'export function canSee(meta: ComponentMeta, user: User) {'],
        ['+', "  if (meta.status !== 'draft') return true"],
        ['+', '  return meta.owners.includes(user.id)'],
        ['+', '}'],
        ['+', ''],
        ['+', 'export function accessFor(meta: ComponentMeta, user: User): Access {'],
        ['+', "  if (meta.owners.includes(user.id)) return 'edit'"],
        ['+', "  return meta.reviewers?.includes(user.id) ? 'comment' : 'view'"],
        ['+', '}'],
      ],
    },
    {
      diff: 'src/registry/component.ts',
      lines: [
        [' ', 'export interface ComponentMeta {'],
        [' ', '  name: string'],
        [' ', "  status: 'draft' | 'beta' | 'stable'"],
        ['+', '  owners: string[]'],
        ['+', '  reviewers?: string[]'],
        [' ', '}'],
      ],
    },
    { tool: 'Bash', target: 'node scripts/assign-owners.mjs', result: 'Owners set from CODEOWNERS for 214 components', status: 'ok' },
    {
      run: 'npm test -- access',
      output: ' PASS  src/access/policy.test.ts\n  ✓ drafts are hidden from viewers (4 ms)\n  ✓ owners always see their drafts (1 ms)\n  ✓ reviewers get comment access (1 ms)\n  ✓ stable components are visible to everyone\n\nTests: 4 passed, 4 total',
    },
    { user: 'Nice. Can you also log whenever someone’s access changes? Design ops will want an audit trail.' },
    { tool: 'Read', target: 'src/server/events.ts', result: 'Event bus with 6 existing event types' },
    {
      diff: 'src/access/policy.ts',
      lines: [
        ['+', 'export function setAccess(meta: ComponentMeta, user: User, level: Access) {'],
        ['+', '  const before = accessFor(meta, user)'],
        ['+', '  applyAccess(meta, user, level)'],
        ['+', "  events.emit('access.changed', { component: meta.name, user: user.id, before, after: level })"],
        ['+', '}'],
      ],
    },
    {
      run: 'lab access audit --since 1h',
      output: 'access.changed  Button       maya → edit      (was comment)\naccess.changed  DatePicker   jon  → comment   (was view)\naccess.changed  Toast        sam  → view      (was edit)\n\n3 events · written to logs/access.jsonl',
    },
    {
      agent: 'Access control is in, and every change is logged.',
      bullets: [
        'Every component is mapped to an owner, taken from CODEOWNERS',
        'Three levels: view, comment and edit',
        'Drafts are hidden from everyone except their owners',
        'Access changes go to `logs/access.jsonl` for design ops to review',
      ],
    },
  ],

  // 1 — Opened lab to the wider team
  [
    {
      user: 'Inputs look great. I think the lab is ready for more eyes — can you open it up to the whole product org? Read-only for now, I don’t want people editing yet.',
    },
    { agent: 'I’ll widen the lab’s visibility, default new people to viewers, and set up an invite plus a place for feedback.' },
    { tool: 'Read', target: 'lab.config.ts', result: "visibility: 'team' · 11 members" },
    {
      diff: 'lab.config.ts',
      lines: [
        [' ', 'export default defineLab({'],
        ['-', "  visibility: 'team',"],
        ['+', "  visibility: 'org',"],
        ['+', "  defaultRole: 'viewer',"],
        [' ', "  library: '@design-lab/components',"],
        [' ', '})'],
      ],
    },
    { tool: 'Bash', target: 'lab deploy --env preview', result: 'Preview ready · lab-pr-482.internal', status: 'ok' },
    { tool: 'Browse', target: 'lab-pr-482.internal (as viewer)', result: 'Edit controls hidden · comments disabled', status: 'ok' },
    {
      agent: 'The preview checks out as a viewer: components, docs and examples are all visible, and there’s no way to edit. Deploying it for real.',
    },
    {
      run: 'lab deploy --env production && lab invite create --org product --role viewer',
      output: '✓ Deployed design-lab@2.14.0\n✓ Invite link created\n  https://lab.internal/join/7Hq2\n  role: viewer · expires in 14 days',
    },
    { tool: 'Write', target: 'docs/FEEDBACK.md', result: '+24 lines · how to request a component or report a bug' },
    {
      agent: 'The lab is open to the product org.',
      bullets: [
        'Invite link is ready for you to share in #design',
        'Everyone joins as a read-only viewer',
        'Added `docs/FEEDBACK.md` pointing people to the feedback channel',
      ],
    },
  ],

  // 2 — Refactored input states
  [
    {
      user: 'Okay, inputs next. We have something like four different error states across text fields, selects and textareas and they all look slightly off from each other. Can you unify them?',
    },
    { agent: 'I’ll find every way the input components signal state today, then move them onto one shared set.' },
    { tool: 'Search', target: 'hasError|isError|invalid|error=', result: '4 patterns across 9 components' },
    { tool: 'Read', target: 'src/components/TextField/TextField.tsx', result: 'Uses hasError + its own red #e5484d' },
    { tool: 'Read', target: 'src/components/Select/Select.tsx', result: 'Uses invalid + border-danger token' },
    {
      agent: 'Each component invented its own state prop and colour. I’ll replace them with a single `state` prop and one shared style hook, so text fields, selects and textareas stay in sync.',
    },
    {
      diff: 'src/components/shared/useFieldState.ts',
      lines: [
        ['+', "export type FieldState = 'default' | 'error' | 'disabled'"],
        ['+', ''],
        ['+', 'export function useFieldState(state: FieldState) {'],
        ['+', '  return {'],
        ['+', "    'aria-invalid': state === 'error' || undefined,"],
        ['+', "    'data-state': state,"],
        ['+', '  }'],
        ['+', '}'],
      ],
    },
    {
      diff: 'src/components/TextField/TextField.css',
      lines: [
        ['-', '.field--error { border-color: #e5484d; }'],
        ['+', ".field[data-state='error'] { border-color: var(--color-border-danger); }"],
        ['-', '.field__help { margin-top: 6px; }'],
        ['+', '.field__help { margin-top: var(--space-1); }'],
        ['-', '.field:disabled { opacity: 0.4; }'],
        ['+', ".field[data-state='disabled'] { opacity: 0.6; }"],
      ],
    },
    { tool: 'Bash', target: 'npx jscodeshift -t codemods/field-state.ts src', result: '31 files changed · 0 errors', status: 'ok' },
    {
      run: 'npm test -- fields',
      output: ' PASS  TextField.test.tsx (12)\n PASS  Select.test.tsx (9)\n PASS  Textarea.test.tsx (7)\n\nTests: 28 passed, 28 total\nSnapshots: 6 updated',
    },
    {
      agent: 'All input components now share one set of states.',
      bullets: [
        'Error state uses the `border-danger` token everywhere',
        'Helper text spacing is fixed at 4px',
        'Disabled opacity raised from 0.4 to 0.6 for contrast',
        'Old `hasError` and `invalid` props still work but are marked deprecated',
      ],
    },
  ],

  // 3 — Reviewed color contrast (needs a decision)
  [
    {
      user: 'With the new type ramp in, can you check every text and background pair in the palette for contrast? I want everything at AA at least.',
    },
    { agent: 'I’ll check every text token against every surface it’s used on, in both themes.' },
    { tool: 'Read', target: 'tokens/color.json', result: '14 text tokens · 6 surfaces · 2 themes' },
    {
      run: 'node scripts/contrast.mjs --level AA',
      output: 'text.default  on surface.base     15.8:1  ✓\ntext.muted    on surface.base      7.1:1  ✓\ntext.subtle   on surface.raised    3.9:1  ✗  needs 4.5\nlink          on surface.inverse   4.1:1  ✗  needs 4.5\n…\n166 pairs checked · 2 failing',
    },
    {
      agent: 'Two pairs fail. `text.subtle` is an easy fix: it can go a step darker without changing how it looks next to `text.muted`. The link colour on inverse surfaces is the brand blue, so I’ll try the nearest shade first.',
    },
    {
      diff: 'tokens/color.json',
      lines: [
        [' ', '"text": {'],
        ['-', '  "subtle": { "value": "{gray.500}" },'],
        ['+', '  "subtle": { "value": "{gray.600}" },'],
        [' ', '},'],
        [' ', '"link": {'],
        ['-', '  "inverse": { "value": "{blue.400}" }'],
        ['+', '  "inverse": { "value": "{blue.300}" }'],
        [' ', '}'],
      ],
    },
    { tool: 'Bash', target: 'npm run tokens:build', result: 'Rebuilt 4 platforms', status: 'ok' },
    {
      run: 'node scripts/contrast.mjs --level AA',
      output: 'text.subtle   on surface.raised    4.8:1  ✓\nlink          on surface.inverse   4.3:1  ✗  needs 4.5\n\n166 pairs checked · 1 failing',
      status: 'warn',
    },
    { tool: 'Bash', target: 'node scripts/contrast.mjs --theme dark', result: '166 pairs · all passing', status: 'ok' },
    {
      agent: 'One pair still fails, and I’d rather not go further without you.',
      bullets: [
        '`text.subtle` fixed: now 4.8:1',
        'Tokens renamed to describe their role, e.g. `gray.600` → `text.subtle`',
        'Dark mode passes everywhere',
        '`link` on inverse surfaces is still 4.3:1. Getting it to 4.5 means going lighter than the brand blue allows. That’s a call for you or brand.',
      ],
      status: 'warn',
    },
  ],

  // 4 — Published type ramp v2
  [
    {
      user: 'Icons are clean, thanks. Marketing keeps asking for bigger display sizes, and our headings feel loose. Can you do a v2 of the type ramp?',
    },
    { agent: 'I’ll look at the current ramp and where headings are used, then tighten line heights and add display sizes above the current largest step.' },
    { tool: 'Read', target: 'tokens/typography.json', result: '9 steps · 12px to 40px · line-height 1.5 everywhere' },
    { tool: 'Search', target: 'font-size: (4[8-9]|[5-9][0-9])px', result: '23 one-off display sizes in marketing pages' },
    {
      agent: 'Marketing has been hard-coding 23 different sizes above 40px. Three display steps cover all of them within 2px.',
    },
    {
      diff: 'tokens/typography.json',
      lines: [
        [' ', '"heading": {'],
        ['-', '  "lineHeight": 1.5,'],
        ['+', '  "lineHeight": 1.2,'],
        [' ', '},'],
        ['+', '"display": {'],
        ['+', '  "1": { "size": "48px", "lineHeight": 1.1 },'],
        ['+', '  "2": { "size": "64px", "lineHeight": 1.05 },'],
        ['+', '  "3": { "size": "80px", "lineHeight": 1 }'],
        ['+', '},'],
        ['-', '"mono": { "family": "DM Mono" }'],
        ['+', '"mono": { "family": "Roboto Mono" }'],
      ],
    },
    { tool: 'Bash', target: 'npx jscodeshift -t codemods/display-sizes.ts apps/marketing', result: '23 sizes → display tokens', status: 'ok' },
    {
      run: 'npm run visual-test',
      output: 'Percy · 37 snapshots\n  12 changed  (headings, expected)\n  25 unchanged\n\nReview: percy.io/design-lab/builds/2291',
    },
    { tool: 'Bash', target: 'npm version minor -w tokens && npm publish -w tokens', result: '@design-lab/tokens@3.0.0 published', status: 'ok' },
    {
      agent: 'Type ramp v2 is published.',
      bullets: [
        'Three display sizes added above 40px: 48, 64 and 80',
        'Heading line height tightened from 1.5 to 1.2',
        'Mono face switched to Roboto Mono',
        'The 12 changed snapshots are all headings. Worth a quick look in Percy before marketing upgrades.',
      ],
    },
  ],

  // 5 — Audited icon library
  [
    {
      user: 'Before the icons move into the shared library, can you audit them? I’m pretty sure we have duplicates, and some look heavier than others.',
    },
    { agent: 'I’ll scan the whole set for duplicate paths, inconsistent strokes and odd export sizes.' },
    {
      run: 'node scripts/icon-audit.mjs icons/',
      output: '312 icons scanned\n  41 duplicates (identical paths, different names)\n  23 drawn with a 2px stroke, 289 with 1.5px\n  17 exported at non-standard sizes (18, 22, 28px)',
    },
    {
      agent: 'The heavier ones you noticed are the 23 drawn at 2px. For duplicates, I’ll keep whichever name is used most and alias the rest so nothing breaks.',
    },
    { tool: 'Search', target: '<Icon name=', result: '1,204 usages · 38 point at a duplicate name' },
    {
      diff: 'icons/manifest.json',
      lines: [
        ['-', '"close-x": "close-x.svg",'],
        ['-', '"cross": "cross.svg",'],
        ['+', '"close": "close.svg",'],
        ['+', '"close-x": { "alias": "close" },'],
        ['+', '"cross": { "alias": "close" },'],
      ],
    },
    { tool: 'Bash', target: 'npx svgo icons/ --config svgo.stroke-1.5.js', result: '23 icons normalised to 1.5px stroke', status: 'ok' },
    { tool: 'Bash', target: 'node scripts/export-icons.mjs --sizes 16,20,24', result: '813 files written', status: 'ok' },
    {
      run: 'npm test -- icons',
      output: ' PASS  icons.test.ts\n  ✓ every manifest entry resolves (812 ms)\n  ✓ aliases point at real icons\n  ✓ no stroke widths other than 1.5px\n\nTests: 3 passed, 3 total',
    },
    {
      agent: 'The icon set is clean and ready to move.',
      bullets: [
        '41 duplicate icons removed, with their old names kept as aliases',
        'Stroke widths unified at 1.5px',
        'Export sizes fixed at 16, 20 and 24',
      ],
    },
  ],

  // 6 — Merged button variants
  [
    {
      user: 'Design ops signed off on the grid spec. Next one: we have seven button variants and nobody knows which to use. Can you get us down to three?',
    },
    { agent: 'I’ll check how often each variant is used and how different they actually look before choosing what to keep.' },
    { tool: 'Search', target: '<Button variant=', result: '212 usages across 64 files' },
    {
      run: 'node scripts/count-props.mjs Button variant',
      output: 'primary     88\nsecondary   61\noutline     27   (renders the same as secondary)\nlink        14\nghost        9\nsubtle       8   (renders the same as secondary)\ndanger       5   (really a tone, not a variant)',
    },
    {
      agent: '`outline` and `subtle` render exactly like `secondary`, and `danger` is really a colour, not a style. That leaves primary, secondary and one quiet style. I’ll fold `ghost` and `link` into `quiet`.',
    },
    {
      diff: 'src/components/Button/Button.tsx',
      lines: [
        ['-', "  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'subtle' | 'danger'"],
        ['+', "  variant?: 'primary' | 'secondary' | 'quiet'"],
        ['+', "  tone?: 'default' | 'danger'"],
      ],
    },
    { tool: 'Bash', target: 'npx jscodeshift -t codemods/button-variants.ts src apps', result: '64 files changed · 0 errors', status: 'ok' },
    { tool: 'Edit', target: 'src/components/Button/Button.css', result: 'Focus ring now matches inputs (2px, offset 2px)' },
    {
      run: 'npm test -- Button && npm run docs:build',
      output: ' PASS  Button.test.tsx (18)\nTests: 18 passed, 18 total\n\n✓ Docs built · /components/button regenerated with 9 examples',
    },
    {
      agent: 'Buttons are down to three variants.',
      bullets: [
        '`primary`, `secondary` and `quiet`, plus a `tone="danger"` option',
        '`ghost` is deprecated and maps to `quiet` until the next major',
        'Focus ring matches the input focus',
        'Docs page regenerated with examples of each',
      ],
    },
  ],

  // 7 — Drafted spec for grid tokens
  [
    {
      user: 'Let’s start on layout. Can you draft a spec for grid tokens that works on web and mobile? Build it on the spacing ramp we already have, don’t invent new numbers.',
    },
    { agent: 'I’ll look at the spacing tokens and how pages are laid out today, then write the spec and a first tokens file.' },
    { tool: 'Search', target: 'grid-template-columns|columns=', result: '14 matches in 9 files' },
    { tool: 'Read', target: 'tokens/spacing.json', result: '12 steps · 2px to 96px' },
    { tool: 'Read', target: 'src/layouts/PageGrid.tsx', result: 'Hard-coded 12 columns, 24px gutters' },
    {
      agent: 'Columns and gutters are hard-coded in three different places, with slightly different values. I’ll pull them into tokens that point at the spacing ramp.',
    },
    { tool: 'Write', target: 'docs/specs/grid-tokens.md', result: '+86 lines' },
    {
      diff: 'tokens/grid.json',
      lines: [
        ['+', '"grid": {'],
        ['+', '  "columns": { "desktop": 12, "tablet": 8, "mobile": 4 },'],
        ['+', '  "gutter":  { "desktop": "{spacing.6}", "tablet": "{spacing.5}", "mobile": "{spacing.4}" },'],
        ['+', '  "margin":  { "desktop": "{spacing.8}", "tablet": "{spacing.6}", "mobile": "{spacing.4}" }'],
        ['+', '}'],
      ],
    },
    {
      run: 'npm run tokens:build',
      output: '✓ Built 4 platforms\n  web/css      grid.css     (+18 variables)\n  web/js       grid.js\n  ios          Grid.swift\n  android      grid.xml',
    },
    {
      agent: 'The grid spec and a first tokens file are ready.',
      bullets: [
        '12 / 8 / 4 columns for desktop, tablet and mobile',
        'Gutters and margins reference the spacing ramp instead of raw pixels',
        '`PageGrid.tsx` isn’t migrated yet. I left a TODO in the spec.',
        'Spec is in `docs/specs/grid-tokens.md`, shared with design ops for comments',
      ],
    },
  ],
]

// ---------- Generated tasks for everything older ----------

const OPENERS = [
  'Next up: can you take a look at {thing}?',
  'While we’re in here, {thing} could use some attention.',
  'Following on from the last one, can you clean up {thing}?',
  'Quick one: product teams keep asking about {thing}. Can you sort it out?',
]
const ASKS = [
  'They drifted from the rest of the system and I’d like them consistent.',
  'Make sure nothing breaks for the apps already using them.',
  'Keep it small if you can, we just need it tidy before the next release.',
]

const pascal = (thing) =>
  thing
    .split(' ')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join('')
    .replace(/s$/, '')

export function conversationFor(k, entry, hash) {
  if (k < WRITTEN.length) return WRITTEN[k]

  const thing = entry.title.split(' ').slice(1).join(' ')
  const name = pascal(thing)
  const h = hash(k * 13 + 1)
  const files = 4 + (h % 9)
  const usages = 20 + (h % 140)
  const tests = 6 + (h % 30)
  const failing = entry.status === 'alert'

  const blocks = [
    { user: `${OPENERS[h % OPENERS.length].replace('{thing}', thing)} ${ASKS[(h >>> 4) % ASKS.length]}` },
    { agent: `I’ll find where ${thing} are defined and used, make them consistent, and run the tests.` },
    { tool: 'Search', target: name, result: `${usages} usages across ${files} files` },
    { tool: 'Read', target: `src/components/${name}/${name}.tsx`, result: `${2 + (h % 4)} props with hard-coded values` },
    {
      agent: `Most of the drift comes from hard-coded values. I’ll move them onto tokens and update the ${files} files that use them.`,
    },
    {
      diff: `src/components/${name}/${name}.css`,
      lines: [
        ['-', `.${name.toLowerCase()} { padding: ${10 + (h % 6)}px; }`],
        ['+', `.${name.toLowerCase()} { padding: var(--space-3); }`],
        ['-', `.${name.toLowerCase()} { border-radius: ${3 + (h % 5)}px; }`],
        ['+', `.${name.toLowerCase()} { border-radius: var(--radius-2); }`],
      ],
    },
    { tool: 'Bash', target: `npx jscodeshift -t codemods/${name.toLowerCase()}.ts src`, result: `${files} files changed · 0 errors`, status: 'ok' },
    { tool: 'Read', target: `src/components/${name}/${name}.stories.tsx`, result: `${3 + (h % 5)} stories still pass raw values` },
    {
      diff: `src/components/${name}/${name}.stories.tsx`,
      lines: [
        [' ', `export const Compact = {`],
        ['-', `  args: { padding: ${6 + (h % 4)}, radius: ${2 + (h % 3)} },`],
        ['+', `  args: { density: 'compact' },`],
        [' ', `}`],
      ],
    },
    {
      run: 'npm run lint -- --fix',
      output: `✓ ${files + 3} files linted
  ${h % 4} warnings fixed automatically
  0 errors`,
    },
    failing
      ? {
          run: `npm test -- ${name}`,
          output: ` FAIL  ${name}.test.tsx\n  ✕ renders in compact density (31 ms)\n    Expected padding 8px, received 12px\n\nTests: 1 failed, ${tests - 1} passed, ${tests} total`,
          status: 'alert',
        }
      : {
          run: `npm test -- ${name}`,
          output: ` PASS  ${name}.test.tsx (${tests})\n\nTests: ${tests} passed, ${tests} total`,
        },
  ]

  if (failing) {
    blocks.push(
      { tool: 'Read', target: `src/components/${name}/${name}.test.tsx`, result: 'Test pins the old compact padding' },
      {
        agent: `One test is failing, and I don’t think I should just update it. Compact density relied on the old hard-coded padding, so moving to tokens changes how compact ${thing} look in two apps.`,
        bullets: [
          ...entry.points,
          'Blocked: should compact density get its own token, or follow the standard spacing? I’ve paused here.',
        ],
        status: 'alert',
      },
    )
  } else {
    blocks.push(
      { tool: 'Bash', target: 'npm run docs:build', result: 'Docs rebuilt', status: 'ok' },
      {
        agent: entry.status === 'warn' ? `Done, with one thing to check.` : `Done. ${entry.summary}`,
        bullets:
          entry.status === 'warn'
            ? [...entry.points, `${2 + (h % 3)} usages in apps/legacy weren’t updated because they pin an old version. Worth a look.`]
            : entry.points,
        status: entry.status === 'warn' ? 'warn' : undefined,
      },
    )
  }

  // About half the tasks get a follow-up question, like a real back-and-forth.
  if (!failing && (h >>> 9) % 2 === 0) {
    blocks.push(
      { user: `Does this change anything in dark mode?` },
      { tool: 'Bash', target: `node scripts/contrast.mjs --theme dark --only ${name}`, result: 'All pairs passing', status: 'ok' },
      { agent: `No. The tokens I switched to already have dark values, and the contrast check passes for every ${thing.replace(/s$/, '')} state.` },
    )
  }

  return blocks
}
