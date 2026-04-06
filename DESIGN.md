# Design System: Ardent Forge

**Project ID:** `31574771765770371`
**Colorscheme:** Iron & Ember
**Device Targets:** Mobile-first (390px), Large screen (2560px)

---

## 1. Visual Theme & Atmosphere

### Creative North Star: "The Kinetic Anvil"

Ardent Forge is not a lifestyle app. It is a high-precision instrument for physical engineering. The visual language draws from **Industrial Brutalism** -- cold, machined metal surfaces lit by the volatile glow of molten material. Every screen feels like a readout panel on heavy machinery: dense with data, unapologetic in its weight, and stripped of anything decorative.

**Atmosphere keywords:** Industrial, utilitarian, high-density, aggressive, dark-forge, machine-shop, brutalist, data-rich, high-contrast.

The layout philosophy is **Intentional Asymmetry**. Significant data points -- a max squat, a volume total, a session clock -- are oversized and offset, mimicking the readout of heavy equipment. The system prioritizes "Minimum Taps" efficiency by exposing complex data through density rather than hiding it behind layers of navigation.

**What this is NOT:** Soft, friendly, playful, rounded, pastel, minimalist-chic, or "wellness." There are no illustrations, no gradient blobs, no cheerful micro-copy. The language is commands and readouts: "EXECUTE," "LOGGED," "VARIANCE," "METRIC_LOAD."

---

## 2. Color Palette & Roles: "Iron & Ember"

The palette is rooted in the heat of the forge -- cold, heavy metals contrasted against the volatile glow of molten material. Colors are organized into functional tiers.

### Surface Hierarchy (The "Milled Block")

Treat the UI as a machined metal block. Depth is achieved by "milling out" layers at different tonal depths, never by drop shadows.

| Token                       | Hex       | Descriptive Name  | Role                                                                   |
| --------------------------- | --------- | ----------------- | ---------------------------------------------------------------------- |
| `surface-container-lowest`  | `#0E0E0E` | Forge Pit Black   | The deepest recess. Inactive navigation trays, recessed gutters.       |
| `surface-dim` / `surface`   | `#131313` | Anvil Black       | The primary canvas. Default page background.                           |
| `surface-container-low`     | `#1C1B1B` | Tempered Charcoal | Slight lift above canvas. Alternating row stripes in long data logs.   |
| `surface-container`         | `#201F1F` | Worn Iron         | Mid-elevation modules. Card backgrounds, content sections.             |
| `surface-container-high`    | `#2A2A2A` | Brushed Gunmetal  | Elevated interactive modules. Workout log entries, active form fields. |
| `surface-container-highest` | `#353534` | Polished Steel    | Highest tonal lift. Timers, active set cards, scrollbar thumbs.        |
| `surface-bright`            | `#393939` | Slag Grey         | Floating overlays, frosted glass panels, surface highlights.           |
| `surface-variant`           | `#353534` | Matte Alloy       | Variant surface for differentiated containers.                         |

### Primary: The "Molten" Accent

The signature orange represents heated metal -- volatile, attention-commanding, used sparingly for critical action triggers.

| Token                      | Hex       | Descriptive Name | Role                                                              |
| -------------------------- | --------- | ---------------- | ----------------------------------------------------------------- |
| `primary`                  | `#FFB59C` | Ember Glow       | Primary text accents, active input underlines, icon highlights.   |
| `primary-container`        | `#FB5C1C` | Forge Orange     | High-impact CTA backgrounds (Start Workout, Finish Set, EXECUTE). |
| `primary-fixed`            | `#FFDBCF` | Cooling Bloom    | Fixed primary surfaces in multi-theme contexts.                   |
| `primary-fixed-dim`        | `#FFB59C` | Dimmed Ember     | Subdued fixed primary variant.                                    |
| `on-primary`               | `#5C1900` | Burnt Umber      | Text/icons on primary surfaces.                                   |
| `on-primary-container`     | `#511500` | Deep Soot        | Text/icons on primary container surfaces.                         |
| `on-primary-fixed`         | `#390C00` | Charred Core     | Text on fixed primary surfaces.                                   |
| `on-primary-fixed-variant` | `#832700` | Smoked Copper    | Text on fixed primary variant surfaces.                           |
| `inverse-primary`          | `#AB3600` | Cooled Ember     | Primary in inverted (light) contexts.                             |
| `surface-tint`             | `#FFB59C` | Tinted Ember     | Tint overlay for elevated surfaces.                               |

**Signature Texture -- The Molten Gradient:**
For high-impact CTAs and hero elements, apply a 135-degree linear gradient from Ember Glow to Forge Orange. This simulates the internal glow of heated metal.

```
background: linear-gradient(135deg, #FFB59C 0%, #FB5C1C 100%);
```

### Secondary: Cool Steel

A restrained blue-grey for secondary actions and supporting information. Provides visual relief against the warm primary.

| Token                        | Hex       | Descriptive Name    | Role                                                     |
| ---------------------------- | --------- | ------------------- | -------------------------------------------------------- |
| `secondary`                  | `#B1CAD7` | Quenched Steel Blue | Secondary text, metadata labels, supporting information. |
| `secondary-container`        | `#334A55` | Deep Slate          | Secondary action backgrounds (Add Exercise, Edit).       |
| `secondary-fixed`            | `#CDE6F4` | Frosted Chrome      | Fixed secondary surfaces.                                |
| `secondary-fixed-dim`        | `#B1CAD7` | Brushed Titanium    | Subdued fixed secondary variant.                         |
| `on-secondary`               | `#1C333E` | Midnight Teal       | Text on secondary surfaces.                              |
| `on-secondary-container`     | `#A0B9C5` | Oxidized Silver     | Text on secondary container surfaces.                    |
| `on-secondary-fixed`         | `#051E28` | Abyssal Teal        | Text on fixed secondary surfaces.                        |
| `on-secondary-fixed-variant` | `#334A55` | Shadowed Slate      | Text on fixed secondary variant surfaces.                |

### Tertiary: Arc Light

An electric blue for data visualization, links, and tertiary actions. Used in charts and progression graphs.

| Token                       | Hex       | Descriptive Name | Role                                                  |
| --------------------------- | --------- | ---------------- | ----------------------------------------------------- |
| `tertiary`                  | `#86CFFF` | Arc Flash Blue   | Chart lines, data points, links, tertiary highlights. |
| `tertiary-container`        | `#019AD8` | Welding Blue     | Tertiary action backgrounds, active chart segments.   |
| `tertiary-fixed`            | `#C8E6FF` | Pale Arc         | Fixed tertiary surfaces.                              |
| `tertiary-fixed-dim`        | `#86CFFF` | Cooled Arc       | Subdued fixed tertiary variant.                       |
| `on-tertiary`               | `#00344C` | Deep Current     | Text on tertiary surfaces.                            |
| `on-tertiary-container`     | `#002D43` | Inked Depth      | Text on tertiary container surfaces.                  |
| `on-tertiary-fixed`         | `#001E2E` | Midnight Pool    | Text on fixed tertiary surfaces.                      |
| `on-tertiary-fixed-variant` | `#004C6D` | Submerged Teal   | Text on fixed tertiary variant surfaces.              |

### Error States

| Token                | Hex       | Descriptive Name | Role                                       |
| -------------------- | --------- | ---------------- | ------------------------------------------ |
| `error`              | `#FFB4AB` | Warning Flare    | Error text, destructive action indicators. |
| `error-container`    | `#93000A` | Alarm Red        | Error state backgrounds.                   |
| `on-error`           | `#690005` | Deep Warning     | Text on error surfaces.                    |
| `on-error-container` | `#FFDAD6` | Soft Alert       | Text on error container surfaces.          |

### Text & Outlines

| Token                | Hex       | Descriptive Name | Role                                                     |
| -------------------- | --------- | ---------------- | -------------------------------------------------------- |
| `on-surface`         | `#E5E2E1` | Bone White       | Primary body text on dark surfaces.                      |
| `on-background`      | `#E5E2E1` | Bone White       | Primary text on background.                              |
| `on-surface-variant` | `#E4BEB4` | Warm Ash         | Secondary/muted text, descriptions, timestamps.          |
| `outline`            | `#AB8980` | Oxidized Edge    | Visible borders when required, dividers.                 |
| `outline-variant`    | `#5B4039` | Ghost Line       | Subtle separators. Use at 15% opacity for ghost borders. |
| `inverse-surface`    | `#E5E2E1` | Inverted Bone    | Inverted surface contexts (tooltips, snackbars).         |
| `inverse-on-surface` | `#313030` | Inverted Text    | Text on inverted surfaces.                               |

### The "No-Line" Rule

**Prohibit 1px solid borders for sectioning.** Boundaries between content modules are defined exclusively through background color shifts. A workout log entry (`surface-container-high`) sits directly on the `surface` canvas. The eye perceives depth through tonal shifts, not mechanical lines.

**Ghost Borders (accessibility exception):** When a boundary is required for accessibility in data-heavy tables, use the `outline-variant` token at **15% opacity**: `rgba(91, 64, 57, 0.15)`. It should be felt, not seen.

---

## 3. Typography Rules

A dual-font strategy balances industrial character with high-density data legibility.

### Display & Headlines: Space Grotesk

A tech-leaning, high-utility geometric sans-serif. Wide apertures and geometric construction evoke stenciled machinery markings. Used for all display text, headlines, and titles.

- **Display Large (3.5rem):** Massive, unapologetic progress numbers -- total weight lifted, 1RM values, session clocks.
- **Headline Large to Medium:** Section headers, workout names, program titles.
- **Title Large:** Workout and program names. Set in **ALL-CAPS with 5% letter-spacing** to enhance the industrial, authoritative tone.
- **Title Medium/Small:** Sub-headers, card titles.

### Body & Labels: Inter

Chosen for exceptional legibility at small scales. Workout logs, rep counts, technical notes, and dense data tables use Inter to ensure no data is misread during high-intensity training.

- **Body Large/Medium:** Primary reading text, exercise descriptions, instructions.
- **Body Small:** Dense data -- set logs, timestamps, metadata.
- **Label Large/Medium:** Form labels, navigation items, category badges.
- **Label Small:** Micro-text -- units, abbreviations, status indicators.

### Typographic Tone

- Use **COMMANDS**, not "Tips." Use **EXECUTE**, not "Go." Use **LOGGED**, not "Saved."
- Section headers and navigation labels should be ALL-CAPS where the industrial tone demands authority.
- Numbers (weights, reps, percentages) should use Space Grotesk at display scale to feel like machine readouts.

---

## 4. Component Stylings

### The "Hard Edge" Rule

**All components use 0px border-radius. No exceptions.** No rounded corners, no subtle curves, no `rounded-lg`. Squares and hard angles only. The single exception is `rounded-full` (9999px) for specific circular indicators (e.g., avatar circles, status dots).

### Buttons

| Variant       | Background                      | Text Color                         | Behavior                                                            |
| ------------- | ------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| **Primary**   | `primary-container` (#FB5C1C)   | `on-primary-container` (#511500)   | High-contrast CTA. Start Workout, Finish Set, EXECUTE.              |
| **Molten**    | Molten gradient (135deg)        | `on-primary-container`             | Hero CTA. Uses the ember-to-forge gradient for maximum visual heat. |
| **Secondary** | `secondary-container` (#334A55) | `on-secondary-container` (#A0B9C5) | Supporting actions: Add Exercise, Edit, secondary confirmations.    |
| **Tertiary**  | Transparent                     | `primary` (#FFB59C)                | Text-only. ALL-CAPS styling. For inline and low-priority actions.   |

**Interaction feedback:** Active state applies `filter: brightness(1.25)` for an immediate, physical "hard tap" response. No hover animations or color transitions -- the feedback is instantaneous.

### Cards & Workout Log Entries

- **Shape:** Sharp, squared-off edges (0px radius).
- **Background:** `surface-container` (#201F1F) or `surface-container-high` (#2A2A2A) depending on elevation need.
- **Separation:** NO divider lines between cards. Use vertical whitespace from the spacing scale (1.75rem between exercises, 0.4rem between sets within an exercise). Alternating row stripes use `surface-container-low` (#1C1B1B).
- **Depth:** Achieved through tonal shift against the `surface` (#131313) canvas -- not shadows.
- **Milled Edge (optional):** For subtle top-edge definition, apply `box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05)`. A hair-thin light catch, as if the edge were machined.

### Input Fields

Industrial-style **underline inputs** are the standard. No boxed or outlined fields.

| State       | Treatment                                                                               |
| ----------- | --------------------------------------------------------------------------------------- |
| **Default** | No visible border. Text sits on the surface with a subtle `surface-container-high` bg.  |
| **Active**  | A 2px bottom bar in `primary` (#FFB59C) -- the molten underline.                        |
| **Filled**  | Text in `on-surface` (#E5E2E1). The underline remains in a muted `outline-variant`.     |
| **Error**   | `error` (#FFB4AB) text with `surface-container-highest` (#353534) background highlight. |

### Data Tables & Logs

- Columns use ALL-CAPS headers in `label-medium` with Inter.
- Column headers: SET, PRESCRIBED, ACTUAL, VARIANCE, STATUS, METRIC_LOAD, TIMESTAMP, LIFT_IDENTIFIER.
- Status badges: Flat rectangles with no border-radius. `primary-container` for COMPLETE, `surface-container-highest` for PENDING.
- Progress indicators use filled `check_circle` icons in `primary`.

### Progress & Metrics

- **Horizontal load bars** only. No circular rings, no radial charts. Use `primary` (#FFB59C) on `surface-container-highest` (#353534) for the bar and track.
- Large metric readouts (94% adherence, 12.4T volume) use Space Grotesk at `display-large` or `headline-large` scale.
- Charts use `tertiary` (#86CFFF) for primary data lines, `primary` (#FFB59C) for secondary, and `secondary` (#B1CAD7) for tertiary.

### Navigation

| Context          | Pattern                                                                                                                                                                                              |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile**       | Bottom tab bar. Four core sections: FORGE, TRACKER, LIBRARY, VAULT. Material Symbols icons with labels. Active tab highlighted in `primary`. Background: `surface-container-lowest` (#0E0E0E).       |
| **Large screen** | Left sidebar. Five items: Dashboard, Program Builder, Analytics, Library, Settings. Icon + text labels. Active item uses `primary` accent. Sidebar background: `surface-container-lowest` (#0E0E0E). |

### Floating & Sticky Elements (The "Heat Blur")

For floating action buttons, sticky timers, and pinned headers, use a frosted glass effect:

```css
background: rgba(19, 19, 19, 0.8);
backdrop-filter: blur(20px);
```

This creates industrial frosted glass, allowing the molten orange of background content to bleed through without sacrificing text legibility.

---

## 5. Layout Principles

### The "Milled" Grid

Spacing follows a 0.1rem base unit for surgical precision in data-heavy layouts.

| Scale          | Value      | Usage                                                                 |
| -------------- | ---------- | --------------------------------------------------------------------- |
| **Micro**      | 0.2-0.4rem | Internal component padding. Space between related data (Reps/Weight). |
| **Tight**      | 0.5-1rem   | Padding within cards, between label and value.                        |
| **Standard**   | 1.75rem    | Gap between distinct exercise blocks, between card groups.            |
| **Structural** | 3.5rem     | Major section separation within a page.                               |
| **Hero**       | 5.5rem     | Top-level page padding. Creates an editorial sense of scale.          |

### Density Philosophy

**Embrace density.** Professional athletes need more data, not less. Use `body-small` and `label-medium` Inter to fit more workout history on a single screen. Use tight spacing between related data and aggressive spacing between unrelated sections.

### Mobile Layout (< 768px)

- Single-column, full-bleed content.
- Bottom navigation bar (FORGE / TRACKER / LIBRARY / VAULT).
- Touch targets >= 48px for gym use with sweaty or gloved hands.
- Minimum viewport height: `max(884px, 100dvh)`.

### Large Screen Layout (>= 1024px)

- Left sidebar navigation (collapsed icon-only or expanded icon+text).
- Multi-column content area with 2-3 column grids for program builders and analytics.
- Sidebar background: `surface-container-lowest` (#0E0E0E).

### The Industrial Grid Pattern

For subtle background texture on data-heavy large screens:

```css
background-image: radial-gradient(circle, #201f1f 1px, transparent 1px);
background-size: 30px 30px;
```

A barely-perceptible dot grid that reinforces the precision instrument aesthetic.

---

## 6. Iconography

- **Icon set:** Material Symbols Outlined (Google Fonts).
- **Variation settings:** `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' <size>` where `opsz` tracks the rendered size dynamically (default 24).
- **Style rule:** Icons must serve a functional purpose. If a text label in `label-medium` is clearer, use text. Avoid thin-stroke "friendly" icon sets. When icons are necessary, they should be outlined by default (`FILL 0`), switching to filled (`FILL 1`) only for active/selected states.
- **Key icons in use:** `fitness_center`, `timer`, `menu_book`, `inventory_2`, `cloud_done`, `precision_manufacturing`, `grid_view`, `construction`, `monitoring`, `library_books`, `settings`, `check_circle`, `open_with`, `drag_indicator`, `add`.

---

## 7. Scrollbar Styling

Custom scrollbars reinforce the industrial aesthetic:

```css
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}
::-webkit-scrollbar-track {
  background: #0e0e0e;
}
::-webkit-scrollbar-thumb {
  background: #353534;
}
::-webkit-scrollbar-thumb:hover {
  background: #fb5c1c;
}
```

Narrow, utilitarian, with a molten-orange hover state.

---

## 8. Do's and Don'ts

### Do

- **Embrace density** -- fit more data per screen using small type scales and tight spacing for related values.
- **Use aggressive spacing** -- large gaps (5.5rem) between major sections, tight gaps (0.2rem) between related data.
- **Default to dark** -- `surface` (#131313) is always the baseline. The system is built for low-light gym environments.
- **Use tonal layering for depth** -- shift background colors to create perceived elevation, not shadows.
- **Use the molten gradient sparingly** -- reserve for hero CTAs and high-priority action triggers.
- **Maintain the vocabulary** -- COMMANDS, EXECUTE, LOGGED, VARIANCE, METRIC_LOAD. The copy is a readout, not a conversation.

### Don't

- **No rounded corners** -- any `border-radius` above 0px (except `9999px` for dots/avatars) violates the identity.
- **No 1px divider lines** -- use background color shifts exclusively for section boundaries.
- **No "playful" copy** -- no exclamation points in UI labels, no emoji, no casual tone.
- **No decorative icons** -- every icon earns its place through function.
- **No traditional drop shadows** -- depth is atmospheric density, not floating cards.
- **No circular progress rings** -- horizontal load bars only.
- **No light mode** -- the system is dark-only by design.

---

## 9. Screen Reference

| Screen Title                     | Device       | Dimensions  | Key Patterns                                                  |
| -------------------------------- | ------------ | ----------- | ------------------------------------------------------------- |
| The Forge (Dashboard)            | Mobile       | 780 x 4654  | Nav tabs, workout block cards, exercise lists, stat readouts  |
| Session Tracker (Active Workout) | Mobile       | 780 x 2282  | SET/PRESCRIBED/ACTUAL table, progress checks, elapsed timer   |
| The Vault (Analytics/1RM)        | Mobile       | 780 x 5500  | Progression charts, data tables, waveform visualizations      |
| Program Library                  | Mobile       | 780 x 10542 | Program archive cards, category badges, intensity metrics     |
| The Forge (Web Dashboard)        | Large screen | 2560 x 2982 | Sidebar nav, program details, session logs, load distribution |
| Program Builder (Large screen)   | Large screen | 2560 x 2048 | Sidebar nav, weekly layout, movement library, drag-drop       |
| The Vault (Web Analytics)        | Large screen | 2560 x 2048 | Sidebar nav, charts, analytics tables, system status          |
