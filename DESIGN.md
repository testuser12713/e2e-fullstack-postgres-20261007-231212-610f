# Design — Project Identity

> This document is project-long-lived. Tokens are not changed without
> the Architect's approval. Developers MUST use these tokens
> instead of improvising their own colors/spacings.

## Style Direction

Calm modern light UI: soft neutral surfaces, generous white space and a single muted teal accent (Stripe/Linear restraint) — no decoration, clarity for rooms, times and conflicts first.

## Colors

- `--color-bg`: **#F6F7F9**
- `--color-surface`: **#FFFFFF**
- `--color-surface-sunken`: **#F2F4F7**
- `--color-fg`: **#16181D**
- `--color-fg-secondary`: **#3F4652**
- `--color-muted`: **#667085**
- `--color-border`: **#E3E6EB**
- `--color-border-strong`: **#CDD3DC**
- `--color-accent`: **#157A6E**
- `--color-accent-hover`: **#10675D**
- `--color-accent-active`: **#0C544C**
- `--color-accent-soft`: **#E6F2F0**
- `--color-accent-fg-on-soft`: **#0F5F57**
- `--color-focus-ring`: **#5AADA4**
- `--color-danger`: **#B42318**
- `--color-danger-soft`: **#FEF3F2**
- `--color-warning`: **#B54708**
- `--color-warning-soft`: **#FFFAEB**
- `--color-success`: **#067647**
- `--color-success-soft`: **#ECFDF3**
- `--color-overlay`: **rgba(16, 24, 40, 0.45)**

## Typography

- `font_family`: "Inter", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif
- `font_stack_note`: system-first fallback; no webfont needed, Inter if locally available
- `heading_weight`: 600
- `body_weight`: 400
- `label_weight`: 600
- `size_scale`: 12px caption / 13px label / 14px body-small / 15px body / 16px card-title / 20px h2 / 24px h1 / 32px page-title
- `line_height`: 1.5 body, 1.25 headings
- `numeric`: font-variant-numeric: tabular-nums on all times, dates, seat counts and durations

## Spacing Scale

- `--space-0`: 4px
- `--space-1`: 8px
- `--space-2`: 12px
- `--space-3`: 16px
- `--space-4`: 24px
- `--space-5`: 32px
- `--space-6`: 48px
- `--space-7`: 64px

## Border-Radii

- `--radius-sm`: 6px
- `--radius-md`: 10px
- `--radius-lg`: 16px
- `--radius-pill`: 999px

## Components

### Button

Variants: primary (bg=accent #157A6E, text #FFFFFF), secondary (bg=surface, 1px border #E3E6EB, text fg), ghost (transparent, text fg-secondary), destructive (bg=danger #B42318, text #FFFFFF). Size: padding 10px 16px (compact) / 12px 20px (default), radius=md 10px, font 14px/600. min-height 44px on every variant (touch target), full-width when inside mobile sheets. States: default; hover = primary #10675D / secondary bg #F2F4F7 / ghost bg #F2F4F7; active = one step darker (#0C544C) plus translateY(1px); focus-visible = 2px #5AADA4 ring with 2px offset (always visible, never removed); disabled = opacity 0.45, cursor not-allowed, no hover change; loading = label replaced by 16px spinner, width locked, disabled. Transition 120ms ease-out on bg/border/transform only. Icon+label gap 8px; icon 16px.

### AmenityTag

Pill chip, radius=pill, padding 4px 10px, font 13px/500, non-interactive display variant: bg=accent-soft #E6F2F0, text=#0F5F57, no border. Never truncate an amenity: multi-word tags wrap the row, the chip itself stays on one line (white-space: nowrap). Filter variant (interactive): unselected bg=surface-sunken #F2F4F7, text=muted, 1px border #E3E6EB; selected bg=accent, text #FFFFFF, border=accent; hover unselected border=border-strong; focus-visible 2px #5AADA4 ring; min-height 32px, on phone the whole chip row gets 44px tap rows via 6px vertical margin.

### AmenityFilter

Chip row above the room list: chips in a horizontally scrollable strip on phone (scroll-snap, hidden scrollbar, edge fade), wrapping flex row with 8px gap from 640px up. First chip is 'Alle' (clears the filter). Single-select. Right-aligned result count '12 Räume' in 13px muted, updates live; screen reader announces it via aria-live=polite. Empty result: EmptyState with a 'Filter zurücksetzen' secondary button.

### RoomCard

Surface card: bg=surface, 1px border #E3E6EB, radius=lg 16px, padding 20px, gap 12px, subtle shadow 0 1px 2px rgba(16,24,40,0.05). Row 1: room name 16px/600 fg (link-styled if it opens the day view). Row 2: seats line '8 Plätze' 14px muted with a 16px users icon, tabular-nums. Row 3: amenity tags, flex wrap, gap 8px; if no amenities show 'Keine Ausstattung angegeben' 13px muted italic. Row 4: actions — primary 'Buchen' (accent) + secondary 'Tag ansehen'; on phone both stack full-width, desktop stays a right-aligned row. Hover (desktop only): border=accent-tinted #9CCBC4, shadow 0 4px 12px rgba(16,24,40,0.08). Whole card must never overflow its grid column; long names wrap, no ellipsis mid-word.

### FormField

Vertical stack gap 6px: label 13px/600 fg (never placeholder-only), control, then message slot. Control: bg=surface, 1px border #E3E6EB, radius=md 10px, padding 10px 12px, font 15px, min-height 44px, placeholder=muted. Focus: border=accent + 2px #5AADA4 ring. Error: border=danger #B42318, message 13px danger with 12px alert icon below the control, input aria-invalid + aria-describedby. Helper/hint text 13px muted below. Validation messages appear only after the field was edited (blurred once) or after a submit attempt — never on first render.

### DateTimeField

FormField variant using datetime-local, min-height 44px, tabular-nums, plus a persistent hint 'Zeiten in der Büro-Zeitzone (Europe/Berlin)' 13px muted below the pair. Start and end sit side by side from 640px (gap 16px) and stack below. Client rules surfaced inline: required, end strictly after start ('Das Ende muss nach dem Beginn liegen.'), duration <= 8h ('Eine Buchung darf höchstens 8 Stunden dauern.'). Native picker on phone; a 'Heute' quick-fill chip sets start to the next full hour and end to start + 1h.

### SeatCountField

Number stepper: 44px square ghost - / + buttons (aria-label 'Plätze verringern'/'Plätze erhöhen') around a centered 15px tabular-nums value or a plain number input, min-height 44px, integer only, min 1, max 999, radius=md, border like FormField. Used in room creation (API-only surface, no dedicated screen required) and as the minimum-seats input of the free-room search — there label 'Mindestzahl Plätze'.

### ErrorBanner

Inline alert block, width 100%, radius=md, padding 12px 16px, 4px left border, role=alert. Variants: error (bg=danger-soft #FEF3F2, border=#B42318, title 14px/600 'Buchung nicht möglich'), warning (bg=warning-soft #FFFAEB, border=#B54708, title e.g. 'Bereits begonnen'), success (bg=success-soft #ECFDF3, border=#067647). Structure: 16px status icon, title line, then the readable message from the API body (code + message) in 14px fg-secondary; validation errors additionally list the affected fields as 'Feld: Meldung' rows, one per line, prefixed by the field label in 600. Never render a raw HTTP status or JSON blob to the user. Has a dismiss X (44px hit area).

### BookingListItem

Row inside a surface list card, padding 12px 16px, 1px bottom divider #E3E6EB (last row none), radius=0. Columns: time range '09:00 – 11:00' 14px/600 accent, tabular-nums, min-width 108px, fixed so all rows align; then title 15px/600 fg and 'gebucht von Anna' 13px muted; right side 13px muted duration '2 Std.'. Locked (already started) rows: whole row at 55% text opacity, a 14px amber lock icon with tooltip/text 'Bereits begonnen — nicht mehr änderbar', edit and delete rendered disabled with the same explanation as title text. Divider-based list, no per-item card shadow, so the day stays scannable.

### DayViewHeader

Sticky sub-header above the list: '‹ Vorheriger Tag' and 'Nächster Tag ›' icon buttons (44x44), centered date label 'Mi, 11.03.2026' 16px/600 with weekday and tabular-nums, secondary 'Heute' button, and a native date input as jump target (44px, min-width 150px). On phone the label moves to its own line above the three controls; nothing wraps into horizontal scroll. A muted line under the header names the room and notes 'Alle Zeiten in Europe/Berlin'.

### RoomDayList

Surface card (radius=lg, 1px border) wrapping BookingListItem rows, sorted ascending by start time as the API returns them. Empty: EmptyState 'Keine Buchungen an diesem Tag' plus a primary 'Raum buchen' button that opens the booking sheet prefilled with this room and the selected day (start = next full hour). Loading: 3 skeleton rows at 56px with a subtle pulse, no layout shift. Error: ErrorBanner with a 'Erneut versuchen' secondary button.

### FreeRoomSearchForm

Single row from 900px: start DateTimeField, end DateTimeField, SeatCountField 'Mindestzahl Plätze', primary 'Freie Räume suchen'; below 900px everything stacks full-width with 16px gaps, submit button last and full-width. Client-side guard before the request: end after start and duration <= 8h, otherwise inline messages instead of a request. Result region sits directly beneath, scrolls into view on success, and reuses RoomCard with a prefilled 'Buchen' primary action (room + period carried over) and a secondary 'Frei' state badge (bg=success-soft, text=#067647, pill).

### Sheet / BookingForm

One form, two shells. Desktop >=900px: right side sheet, max-width 480px, full height, radius=lg on the left edge only, slide-in 180ms ease-out, overlay rgba(16,24,40,0.45). Phone: full-screen sheet sliding up, radius=lg top corners, header 56px with 44px close button, footer sticky above the safe area. Header: title 'Buchung' or 'Buchung bearbeiten' 20px/600. Fields in order: Raum (select, searchable by name, shows seats + tags in the option), Gebucht von (text), Titel (text), Beginn, Ende. Footer: primary 'Buchung speichern' (loading state while the request runs), secondary 'Abbrechen'. On 409 the sheet stays open, the ErrorBanner appears pinned at the top of the form body with the API message naming the conflicting booking, and focus moves to the banner. Escape closes; closing with unsaved edits asks 'Änderungen verwerfen?'.

### AppHeader

Sticky top bar, height 64px, bg=surface with bottom border #E3E6EB, container max-width 1120px, padding matches the page gutter. Left: wordmark 'Raumbuchung' 16px/600. Right/center: nav items 'Räume' and 'Freie Räume', 14px/500, inactive text fg-secondary, active text accent with a 2px accent underline at the bar's bottom edge, min touch height 44px. On phone the nav collapses into a horizontally scrollable pair next to the wordmark (no hamburger needed for two items).

### EmptyState

Centered block, padding 48px 24px, gap 12px: 40px outline icon in muted, headline 16px/600 fg, body 14px muted (max-width 42ch), one primary action. Used for empty room list, empty day, empty search result and API load failure (with 'Erneut versuchen').

### ComingSoonButton

Mandatory escape hatch for AC-16: any control whose action is not yet wired is rendered as a disabled Button (secondary variant, disabled state) with a visible suffix label 'kommt bald' in 12px muted next to the label, plus title text explaining it. No enabled control may exist that silently does nothing — an enabled control always triggers its action or shows an ErrorBanner.

## Layout Principles

- Container: max-width 1120px, centered, gutter 16px <640px, 24px 640-1023px, 32px >=1024px. Minimum supported viewport 320px; verify at 375px and 1440px.
- Mobile-first breakpoints: sm 640px (room grid 1 -> 2 columns, forms go side-by-side), md 900px (search form single row, booking form becomes a side sheet), lg 1200px (room grid 3 columns). Grid/stack gaps: 16px phone, 24px desktop.
- Room list: CSS grid, 1 column <640, 2 columns 640-1199, 3 columns >=1200; equal-height cards via align-items: stretch; card of the list is the click target for the day view.
- Vertical rhythm: page top padding 24px phone / 32px desktop below the 64px sticky header; 32px between sections (24px phone), 16px between cards, 8-12px inside a card.
- Phone width: no horizontal page scroll ever. Lists/tables degrade to stacked cards, long text wraps, filter chip strips scroll only within their own row. Every interactive element has a >=44x44px hit area and 8px minimum spacing between adjacent targets.
- Single format for every date, time, duration, seat count and amount across all screens: date 'Mi, 11.03.2026' (short German weekday, DD.MM.YYYY), time 24h zero-padded '09:00', range '09:00 - 11:00' with an en dash and no repeated date, duration '2 Std. 30 Min.' (and '45 Min.', '8 Std.'), seats '8 Plätze' / '1 Platz'. All values in the office timezone with one global note 'Alle Zeiten in Europe/Berlin' - no per-value timezone suffix in the UI, while the API keeps full ISO-8601 with offset.
- All numbers use tabular-nums and are right/center-aligned where they stack vertically (times, seat counts, durations).
- Colour discipline: accent only for the primary action, the current selection and focus; neutral greys for everything structural; red strictly for errors and 409 conflicts; amber strictly for the 'already started / locked' state; green only for the positive 'frei' badge. On white surfaces body text #3F4652 or darker to stay above 4.5:1 contrast.
- Elevation: two levels only - resting cards 0 1px 2px rgba(16,24,40,0.05), overlays/sheets 0 12px 32px rgba(16,24,40,0.16). No gradients, no coloured borders on cards, no decorative illustration.
- Motion: 120ms for hover/state, 180ms ease-out for sheets and toasts; wrap everything in prefers-reduced-motion: reduce to disable transforms.
- Accessibility: visible focus ring on every focusable element, semantic landmarks (header/main), labels on all inputs, role=alert for errors, aria-live=polite for filter result counts, buttons carry text or aria-label, disabled controls expose why they are disabled.
- German copy everywhere in the UI (headings, buttons, hints, error messages), with the error text from the API shown verbatim as the human-readable message.
- Loading and empty are first-class states on every screen: skeletons on first load, EmptyState with a single next action when nothing matches, ErrorBanner with 'Erneut versuchen' on failure.
