# Tawf Islamic Foundation — Design Guidelines

> Source: provided by the project owner. This is the authoritative design system for the SWR
> (Staking Wakaf Ritel) frontend in `web/`. v1.1, March 2026.

## Overview

The Tawf Islamic Foundation website embodies ethical Web3 finance through a sophisticated,
trust-building design system that balances traditional Islamic aesthetics with modern digital
interfaces.

### Primary Focus

Zakat transparency for Southeast Asian students. All design decisions prioritise:

- **Trust** — every element must build credibility
- **Clarity** — users must understand where their zakat goes
- **Local Context** — designed for Indonesian/Malaysian users
- **Youth Appeal** — mobile-first, social, shareable

---

## Color Palette

| Token | Hex | Role |
|---|---|---|
| Tawf Green | `#0F3D30` | Primary brand — trust and Islamic heritage |
| Tawf Green Light | `#1A5242` | Hover states, secondary elements |
| Tawf Gold | `#C5A869` | Accent — value and authenticity |
| Tawf Sand | `#F9F6F0` | Background — warm and inviting |
| Tawf Ink | `#1A1A1A` | Primary text |
| Tawf Muted | `#6B7280` | Secondary text |

**Usage:** Green for primary CTAs, headings, navigation and trust elements. Gold for accents,
highlights and emphasis. Sand as the primary background. Ink for body text and dark UI. White for
cards and elevated surfaces.

---

## Typography

- **Serif:** Cormorant Garamond — all headings (h1–h6)
- **Sans-serif:** Inter — body text, UI, navigation

### Type Scale

```
Hero:        56px desktop / 56px mobile
H1:          60px desktop / 48px mobile
H2:          40px desktop / 36px mobile
H3:          28px desktop / 24px mobile
Body XL:     20px
Body Large:  18px
Body:        16px (default)
Small:       14px
```

**Principles:** serif headings for elegance and authority; sans-serif body for readability;
line-height 1.5–1.7 for body; wide tracking (0.2em) on uppercase labels; weights Light 300,
Regular 400, Medium 500, Semibold 600.

---

## Spacing

- Section padding: **96px** desktop / **64px** mobile vertical
- Container padding: **24px** horizontal
- Gap between cards: **24px**
- Internal card padding: **32–40px**
- Button padding: **16px 32px**
- Icon spacing: **12–16px** from text

## Border Radius

- Cards: **16px** (`rounded-2xl`)
- Boxes: **24px**
- Buttons: **full** (pill)
- Hero images: custom oval mask

---

## Components

### Navigation Bar
Height 80px, fixed with backdrop blur. Background `tawf-sand/90`. Bottom border `tawf-green/10`.
Logo in serif, 24px, medium. Links uppercase, 0.2em tracking, 14px, hover to `tawf-green`.

### Buttons

**Primary** — bg `tawf-green`, text `tawf-sand`, padding 16px 32px, pill, uppercase wide tracking,
hover `tawf-green-light`.

**Secondary** — transparent, 1px `tawf-green` border, text `tawf-green`, padding 10px 24px, pill,
hover fills with `tawf-green` and text becomes `tawf-sand`.

### Cards

**Standard** — bg `tawf-sand/30` or white, 1px `tawf-green/10` border, radius 16px, padding 32px,
subtle or no shadow.

**Feature** — icon container 56px circle on white, icon 32px `tawf-gold`, title serif 20px
`tawf-green`, description sans 16px `tawf-muted`, label uppercase 12px wide-tracked `tawf-gold`.

### Footer
Background `tawf-ink`, text white at 60% opacity, 64px vertical padding, 4 columns desktop / 1
mobile, links hover to `tawf-gold`, top border `white/10`.

---

## Layout Patterns

**Hero** — 2-column grid (text + image) on desktop, text column max-width 672px, image with oval
mask at 600px height, decorative low-opacity background circles, vertically centred.

**Content sections** — max width 1280px, consistent horizontal padding, alternating white / sand /
ink backgrounds, 2–4 column feature grids.

**Text content** — max width 768px for readability, centred for hero/intro and left for body, 16px
between paragraphs.

---

## Animation & Motion

Duration 0.6–1s, `easeOut`, 0.1s stagger between sequential items, scroll animations use
`whileInView` with `once: true`.

```jsx
// Fade in from bottom
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.8 }}

// Scale in
initial={{ opacity: 0, scale: 0.95 }}
animate={{ opacity: 1, scale: 1 }}
transition={{ duration: 1 }}
```

---

## Iconography

Lucide React, 20–32px, outline/stroke style with consistent weight. `tawf-gold` for feature icons,
`tawf-green` for navigation.

Common: Shield, HeartHandshake, Landmark (core values) · Coins, Building2, Network (financial) ·
ChevronRight, ArrowRight (navigation) · Sparkles, TrendingUp (growth).

---

## Imagery

Islamic architecture and geometric patterns. Oval masks for hero images, 90% opacity, maintained
aspect ratio, high resolution. Backgrounds may use concentric circles at 3% opacity, geometric
Islamic patterns, and gradient overlays for depth.

---

## Accessibility

WCAG AA minimum contrast. Dark text on light, light text on dark; no low-contrast pairings.
Minimum touch target 44×44px, clear focus states, keyboard navigation, screen-reader labels.
Custom selection: `tawf-gold/30` background with `tawf-green` text.

---

## Responsive Breakpoints

```
Mobile:   < 768px
Tablet:   768–1024px
Desktop:  > 1024px
Large:    > 1280px
```

Mobile adaptations: single column, reduced type scale, 4rem instead of 6rem spacing, stacked
navigation, full-width buttons.

---

## Content Tone & Voice

Authoritative yet accessible. Direct and honest — *"Not as promises. As on-chain reality."*
Mission-driven, technically precise with proper Islamic finance terms, community-focused "we"
language.

Key phrases: *"Baitul Maal, rebuilt for the digital age"* · *"Not as promises. As on-chain
reality."* · *"From profit into purpose"* · *"Architecturally mandatory"*

---

## Design Principles

1. **Trust Through Transparency** — clear hierarchy, visible governance, onchain verification emphasis
2. **Heritage Meets Innovation** — traditional Islamic aesthetics with modern Web3 functionality
3. **Purpose Over Profit** — mission-first messaging, community benefit, ethical finance
4. **Clarity & Simplicity** — clean layouts, ample whitespace, no unnecessary decoration
5. **Warmth & Approachability** — warm palette, friendly spacing, human-centred language

---

## Localization: Indonesian / Malay Context

Primary audience is Southeast Asian students in Indonesia and Malaysia.

**Language** — English primary for reach, Bahasa Indonesia / Bahasa Melayu secondary for local
resonance. Keep key Islamic terms in Arabic (zakat, waqf, asnaf, nisab) with tooltips.

**Local payments** — Indonesia: GoPay, OVO, Dana, bank transfer. Malaysia: Touch 'n Go, GrabPay,
bank transfer. CTAs should accommodate these.

**Terminology**

| Term | Arabic | Indonesian | Malay |
|---|---|---|---|
| Zakat | Zakat | Zakat | Zakat |
| Waqf | Waqf | Wakaf | Wakaf |
| Alms | Sadaqah | Sedekah | Sedekah |
| Poor | Fuqara | Fakir Miskin | Fakir Miskin |
| Muslim Board | MUI | MUI | JAKIM |

**Considerations** — mobile-first (most users are on smartphones), social sharing (Instagram
Stories, WhatsApp status), modesty (respectful imagery, no human faces in hero images), font
support for Jawi/Arabic script where appropriate.

**Currency** — Indonesia: `Rp 750.000` (dots for thousands, no decimals). Malaysia: `RM 250.00`.
Always clarify the currency alongside amounts.

**Date & time** — `YYYY-MM-DD` or `DD Month YYYY`. Consider the Hijri calendar for Islamic events.
Timezones: WIB (GMT+7) Indonesia, MYT (GMT+8) Malaysia.

---

## Implementation Notes

Design tokens live in `web/src/styles/index.css` as CSS custom properties:

```css
--color-tawf-green: #0F3D30;
--spacing-section: 6rem;
--radius-card: 1rem;
--text-hero: 3.5rem;
```

Tailwind CSS v4 with the `@theme` directive, utility-first, custom classes `bg-tawf-green`,
`text-tawf-gold`, responsive modifiers `md:` / `lg:`.

```ts
const SECTION_PADDING = "py-16 md:py-24";
const CONTAINER_PADDING = "px-6";
const MAX_WIDTH = "max-w-7xl";
const RADIUS_CARD = "rounded-2xl";
const RADIUS_BUTTON = "rounded-full";
```

Stack: React 19, TypeScript 5.8, Vite 6.2, Tailwind CSS v4.

---

## Brand Assets

**Logo** — Cormorant Garamond, 24px in navigation, `tawf-green`, medium (500), wide tracking.

**Tagline** — "The non-profit, public-trust cornerstone of the Tawf ecosystem."

---

## Do's and Don'ts

**Do** — serif headings · consistent spacing · pill buttons · subtle animations · emphasise mission
and values · warm inviting colours · clear CTAs

**Don't** — bright saturated colours · overcrowded layouts · multiple font families · hiding
important information · aggressive sales language · compromising accessibility · ignoring mobile

---

## SWR-specific application notes

Added for this repo; not part of the source document.

- **Fonts are self-hosted** via `@fontsource` packages rather than loaded from Google Fonts.
  A frontend that phones out to a third party on every visit leaks visitor IPs and breaks under
  a blocked CDN — both CROPS findings the rest of this project works to avoid.
- **Honesty over reassurance.** The tone guide says *"Not as promises. As on-chain reality."* The
  vault carries genuine FX risk (rupiah principal backed by ETH-correlated assets). The solvency
  ratio is shown plainly rather than styled away, and the risk is stated before a user signs.
- **Rupiah formatting** uses `Intl.NumberFormat('id-ID')` — dots for thousands, no decimals —
  applied to IDRX base units after decimal conversion.
