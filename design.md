# Design System — Bonkey Music

A locked design system for the **Bonkey Music** desktop audio application. Every page, view, and component redesign in this application reads from this specification.

## Genre
**atmospheric** (Dark-Tech Audio Workbench)

## Macrostructure Family
- **App Layout**: Workbench / Bento Hybrid
  - Left: Floating glass navigation sidebar (Rail N5)
  - Top: Integrated search & navigation command bar (Action Bar N13)
  - Center/Main: Ambient gradient hero banner + high-density audio tracklist / bento grid
  - Right (Drawer): Glassmorphic slide-out Queue Panel & Synced Lyrics View
  - Bottom: High-fidelity audio console player bar

## Theme Tokens
- `--color-paper`: `oklch(0.12 0.015 260)` (`#0b0c0e`) — Deep Obsidian background
- `--color-paper-2`: `oklch(0.16 0.018 260)` (`#121418`) — Secondary dark surface
- `--color-surface`: `rgba(255, 255, 255, 0.03)` — Glass backdrop cards
- `--color-surface-hover`: `rgba(255, 255, 255, 0.06)` — Interactive hover state
- `--color-ink`: `oklch(0.96 0.005 260)` (`#f1f2f4`) — Primary text
- `--color-ink-2`: `oklch(0.68 0.01 260)` (`#9ea3ad`) — Muted secondary text
- `--color-ink-3`: `oklch(0.48 0.01 260)` (`#60646c`) — Muted tertiary text
- `--color-rule`: `rgba(255, 255, 255, 0.06)` — Hairline border lines
- `--color-accent`: `oklch(0.68 0.22 35)` (`#ff4e2e`) — Electric Sunset Orange / Crimson
- `--color-accent-hover`: `oklch(0.72 0.24 35)` (`#ff6a4a`) — High-energy hover glow
- `--color-accent-soft`: `rgba(255, 78, 46, 0.12)` — Accent badge backdrop
- `--color-badge-hires`: `oklch(0.82 0.18 75)` (`#ffb020`) — Warm Amber Hi-Res Lossless badge
- `--color-focus`: `oklch(0.70 0.20 35)` — Keyboard focus ring outline

## Typography
- **Display / Interface**: `Geist Sans`, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- **Body**: `Geist Sans`, sans-serif
- **Mono / Tech Specs**: `Geist Mono`, "SF Mono", Monaco, Consolas, monospace
- **Type Scale**:
  - Hero Title: `clamp(1.75rem, 4vw, 3rem)` (weight 800, tracking -0.03em)
  - Section Head: `1.125rem` (weight 700, tracking -0.01em)
  - Item Title: `0.875rem` (weight 500)
  - Caption / Subtitle: `0.75rem` (weight 400)
  - Mono Badge: `0.6875rem` (weight 600, uppercase, tracking 0.04em)

## Spacing & Radius
- 4-point scale: `4px` (`--space-3xs`), `8px` (`--space-2xs`), `12px` (`--space-xs`), `16px` (`--space-sm`), `24px` (`--space-md`), `32px` (`--space-lg`), `48px` (`--space-xl`)
- Border Radius:
  - Outer Card: `16px` (`--radius-card-outer`)
  - Inner Tile: `10px` (`--radius-card-inner`)
  - Input / Pill: `9999px` (`--radius-pill`)

## Motion & Transitions
- `--ease-out`: `cubic-bezier(0.16, 1, 0.3, 1)`
- `--dur-fast`: `180ms`
- `--dur-normal`: `300ms`
- Hover Elevation: `translateY(-2px)` + `box-shadow: 0 8px 24px rgba(0,0,0,0.4)`
- Active Click Feedback: `transform: scale(0.96)`

## State Discipline
All controls & rows MUST handle 8 states cleanly:
- `default`, `hover`, `:focus-visible`, `:active`, `disabled`, `playing/active`, `drag-over`, `loading`

## Exports / CSS Variables Mapping
Defined in `src/renderer/src/assets/main.css`.
