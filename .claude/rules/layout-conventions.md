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
