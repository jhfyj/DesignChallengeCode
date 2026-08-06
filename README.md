# Weekly Design Challenge

Each week's project lives in its own folder under `weeks/`, as its own npm workspace with its own dependencies.

## Run the current week

```
npm run dev
```

This reads `week.config.json` to find which week is "current" and runs that workspace's dev server.

To run a specific week regardless of the config:

```
npm run dev -- --week=1
npm run dev -- --week=week-01-react
```

## Build the current week

```
npm run build
```

Same `--week=` override works here too.

## Starting a new week

1. Scaffold a new folder inside `weeks/`, e.g.:
   ```
   npm create vite@latest weeks/week-02-<framework> -- --template <template>
   ```
2. Run `npm install` at the repo root (workspaces pick up the new folder automatically).
3. Update `week.config.json`:
   ```json
   { "current": "week-02-<framework>" }
   ```
