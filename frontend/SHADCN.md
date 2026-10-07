# shadcn-style UI (JavaScript)

This frontend is **React + JSX + Vite + Tailwind v4**, not TypeScript. Integration prompts often show `.tsx`; use the same code in **`src/components/ui/*.jsx`** and drop type annotations.

## Paths

| Purpose | Path |
|--------|------|
| Entry | `src/main.jsx` |
| Styles / theme | `src/index.css` |
| shadcn config | `components.json` (`"tsx": false`) |
| `cn()` helper | `src/lib/utils.js` |
| UI blocks | **`src/components/ui/`** |

`@/` → `src/` via `vite.config.js`.

## Add CLI components as JSX

When pasting from shadcn or 21st.dev, rename `.tsx` → `.jsx` and remove `interface` / type imports. Or:

```bash
npx shadcn@latest add button
```

Then rename generated files to `.jsx` if the CLI emits TypeScript.

## Auth UI

- `src/components/ui/sign-in.jsx`
- `src/components/ui/sign-up.jsx`
- `src/pages/LoginPage.jsx`, `RegisterPage.jsx`
