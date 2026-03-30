// src/lib/constants/status-colours.ts

// ── Colour Palette ──────────────────────────────────────────────────

/**
 * The seven named colours used for status display.
 * Values are Tailwind CSS 500 shades.
 */
export const STATUS_COLOURS = {
  grey:   '#9CA3AF',  // Gray-400 — initial / waiting
  blue:   '#3B82F6',  // Blue-500 — planning / preparation
  yellow: '#EAB308',  // Yellow-500 — active work
  orange: '#F97316',  // Orange-500 — blocked / needs attention
  green:  '#22C55E',  // Green-500 — done / success
  red:    '#EF4444',  // Red-500 — cancelled / terminal-negative
  purple: '#A855F7',  // Purple-500 — superseded
} as const;

/**
 * The name of a colour in the STATUS_COLOURS palette.
 */
export type StatusColourName = keyof typeof STATUS_COLOURS;

// ── Status → Colour Mapping ─────────────────────────────────────────

/**
 * Complete mapping of every known status string to its colour name.
 * Grouped by semantic category for readability.
 *
 * IMPORTANT: This record is intentionally typed as Record<string, StatusColourName>
 * (not a union of literal status keys) so that new statuses can be added
 * without a type error. Unknown statuses are handled by the fallback in
 * getStatusColour().
 */
const STATUS_TO_COLOUR: Record<string, StatusColourName> = {
  // ── Grey — initial / waiting ──────────────────────────────────────
  'proposed':           'grey',
  'queued':             'grey',
  'draft':              'grey',
  'reported':           'grey',

  // ── Blue — planning / preparation ─────────────────────────────────
  'designing':          'blue',
  'specifying':         'blue',
  'dev-planning':       'blue',
  'ready':              'blue',
  'planned':            'blue',
  'contributed':        'blue',
  'triaged':            'blue',
  'reproduced':         'blue',

  // ── Yellow — active work ──────────────────────────────────────────
  'active':             'yellow',
  'in-progress':        'yellow',
  'investigating':      'yellow',
  'developing':         'yellow',
  'root-cause-identified': 'yellow',

  // ── Orange — blocked / needs attention ────────────────────────────
  'blocked':            'orange',
  'needs-review':       'orange',
  'needs-rework':       'orange',
  'disputed':           'orange',
  'pending':            'orange',
  'mitigated':          'orange',

  // ── Green — done / success ────────────────────────────────────────
  'done':               'green',
  'closed':             'green',
  'verified':           'green',
  'approved':           'green',
  'accepted':           'green',
  'confirmed':          'green',
  'resolved':           'green',
  'responded':          'green',

  // ── Red — cancelled / terminal-negative ───────────────────────────
  'cancelled':          'red',
  'not-planned':        'red',
  'rejected':           'red',
  'duplicate':          'red',
  'retired':            'red',
  'cannot-reproduce':   'red',

  // ── Purple — superseded ───────────────────────────────────────────
  'superseded':         'purple',
};

// ── Lookup Functions ────────────────────────────────────────────────

/**
 * Returns the colour name for a given status string.
 *
 * @param status - Any entity status string
 * @returns The StatusColourName. Returns 'grey' for unknown/unrecognised statuses.
 *
 * @example
 * getStatusColour('active')     // → 'yellow'
 * getStatusColour('done')       // → 'green'
 * getStatusColour('xyz-future') // → 'grey'
 */
export function getStatusColour(status: string): StatusColourName {
  return STATUS_TO_COLOUR[status] ?? 'grey';
}

/**
 * Returns the hex colour code for a given status string.
 *
 * @param status - Any entity status string
 * @returns A hex colour string, e.g. '#22C55E'. Returns '#9CA3AF' (grey) for unknown statuses.
 *
 * @example
 * getStatusHex('done')          // → '#22C55E'
 * getStatusHex('xyz-future')    // → '#9CA3AF'
 */
export function getStatusHex(status: string): string {
  return STATUS_COLOURS[getStatusColour(status)];
}
