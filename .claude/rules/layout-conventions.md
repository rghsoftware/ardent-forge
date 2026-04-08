# Layout Conventions

## Content Width Constraint

All authenticated pages use `max-w-5xl` (1024px) as the standard content-width constraint. This prevents excessive line lengths and content sprawl on wide screens while maintaining comfortable readability.

Apply `mx-auto max-w-5xl` to the main content wrapper on every authenticated page, including early-return states (loading, error, not-found) to avoid jarring width shifts when data loads.

```tsx
// Standard page wrapper pattern
<div className="min-h-[100dvh] bg-surface-anvil">
  <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8">{/* Page content */}</div>
</div>
```

## Responsive Padding

Use progressive horizontal padding across breakpoints:

- Mobile: `px-4`
- Tablet (`md:`): `px-6`
- Desktop (`lg:`): `px-8`

## No Divider Lines (Iron & Ember)

**Prohibited:** `border-t`, `border-b`, `border-l`, `border-r` with any
`border-surface-*` color are not allowed as section dividers. This is a
non-negotiable constraint of the Iron & Ember design system
(CLAUDE.md §Design Context — "no divider lines (tonal layering)").

Communicate section breaks through **tonal depth** instead: shift the
background surface (`bg-surface-pit/40`, `bg-surface-gunmetal/60`,
`bg-surface-iron`, `bg-surface-charcoal/40`) to create visual separation
without drawing a line.

```tsx
// Bad: border divider (violates Iron & Ember)
<div className="border-t border-surface-steel pt-6">
  <h2>Section title</h2>
</div>

// Bad: "or" separator with flanking border lines
<div className="flex items-center gap-3">
  <div className="flex-1 border-t border-surface-steel" />
  <span>or</span>
  <div className="flex-1 border-t border-surface-steel" />
</div>

// Good: tonal shift communicates the break
<div className="bg-surface-pit/40 px-4 py-6">
  <h2>Section title</h2>
</div>

// Good: bare "or" with spacing, no lines
<div className="my-8 text-center text-xs uppercase tracking-widest text-warm-ash">
  or
</div>
```

**Exceptions:** None for new code. Pre-existing violations in
`gym-management-section.tsx` and `_authenticated/index.tsx` are grandfathered
but should migrate opportunistically. If a new feature genuinely needs a
visual separator that tonal depth cannot express, raise it as a design
system change, not a one-off escape hatch.

**How to apply:** Grep for `border-t border-surface`, `border-b border-surface`,
etc. in code review. Any match on new or touched code is a blocker.
