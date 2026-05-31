# Lights Card

A standalone, fully configurable Home Assistant Lovelace card for toggling and dimming lights. Extracted from the Kitchen Dashboard Card lights section, with the same look and feel.

## Features

- Configurable list of lights — add/remove entirely in the visual editor (no YAML required)
- Per light: entity, label, icon, and a **Dimmable** flag
- Interactions: **tap** to toggle, **hold** (~0.6s) for the more-info popup, **drag** left/right to set brightness on dimmable lights
- Two themes: **Classic** (Dark Navy) and **Holo Home** (cyan HUD)
- Optional **Frosted Glass** mode with adjustable opacity and blur
- Optional header (title, icon, live date/time, status dot)
- Configurable columns (1–4), responsive on desktop, tablet, and mobile via `ResizeObserver`

## Installation

### HACS (custom repository)

1. HACS → Frontend → ⋮ → Custom repositories
2. Add `https://github.com/robman2026/lights-card` as a **Dashboard** (Lovelace) repository
3. Install **Lights Card**

### Manual

1. Copy `lights-card.js` to `/config/www/lights-card.js`
2. Settings → Dashboards → ⋮ → Resources → Add resource
   - URL: `/local/lights-card.js`
   - Type: **JavaScript module**

## Usage

Add the card via the dashboard UI (search "Lights Card") and configure it with the visual editor, or use YAML:

```yaml
type: custom:lights-card
theme: classic            # classic | holo
show_header: true
card_title: Lights
lights_columns: 2
lights:
  - entity: light.ceiling
    label: Ceiling
    icon: mdi:ceiling-light
    dimmable: true
  - entity: switch.lamp
    label: Lamp
    icon: mdi:lamp
    dimmable: false
```

### Options

| Option            | Type    | Default               | Description                                   |
|-------------------|---------|-----------------------|-----------------------------------------------|
| `theme`           | string  | `classic`             | `classic` or `holo`                           |
| `show_header`     | boolean | `true`                | Show the header row                           |
| `card_title`      | string  | `Lights`              | Header title                                  |
| `card_icon`       | string  | `mdi:lightbulb-group` | Header icon                                   |
| `title_position`  | string  | `left`                | `left` or `center`                            |
| `show_datetime`   | boolean | `true`                | Show live date/time in header                 |
| `show_status_dot` | boolean | `false`               | Show an online/offline dot                    |
| `status_entity`   | string  | —                     | Entity that drives the status dot             |
| `label_lights`    | string  | `Lights`              | Section label above the tiles                 |
| `lights_columns`  | number  | `2`                   | Columns (1–4); drops to 2 on narrow screens   |
| `frosted_glass`   | boolean | `false`               | Translucent blurred background                |
| `frosted_opacity` | number  | `0.52`                | Glass opacity (0.1–0.9)                        |
| `frosted_blur`    | number  | `22`                  | Blur strength in px (4–40)                     |
| `lights`          | list    | `[]`                  | List of lights (see below)                    |

### Per-light options

| Option     | Type    | Description                                                        |
|------------|---------|--------------------------------------------------------------------|
| `entity`   | string  | `light.*`, `switch.*`, or `input_boolean.*`                        |
| `label`    | string  | Display name (auto-filled from `friendly_name` when picking)       |
| `icon`     | string  | Any icon id with a `:` (`mdi:`, `hass:`, `phu:`, `custom:`, etc.)  |
| `dimmable` | boolean | Enables the drag-to-dim brightness bar (auto for `light.*`)        |

## Notes

- Dimming uses `light.turn_on` with `brightness_pct`, which remains valid in current Home Assistant releases.
- The card is responsive via `ResizeObserver` rather than CSS media queries (which don't work in HA's Shadow DOM).

## License

MIT
