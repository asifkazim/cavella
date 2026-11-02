# Cavella — Asset & licence register

Every visual asset shipped on the website must be listed here with its source and licence
**before** it is merged. No hot-linking: all assets are self-hosted (PRD NFR-C-03).

## Current assets (website v0.1)

| Asset | File | Source | Licence | Verified |
|---|---|---|---|---|
| Hero illustration (takeaway cup over tram line) | `apps/web/src/components/art/HeroArt.tsx` | Original SVG drawn for this project | Owned by Cavella (project work) | ✅ no third-party content |
| Map illustration (stylised, not geographic data) | `apps/web/src/components/art/MapArt.tsx` | Original SVG drawn for this project | Owned by Cavella | ✅ |
| Interim logo mark + wordmark | `apps/web/src/components/brand/Logo.tsx` | Original SVG + Fraunces typeface | Owned by Cavella; font under OFL 1.1 | ✅ |
| UI icons (menu, pin, clock, tram, social glyphs…) | `apps/web/src/components/ui/icons.tsx` | Original SVG paths drawn for this project | Owned by Cavella | ✅ — social glyphs are simplified generic shapes, used only to link to the business's own profiles |
| Display font **Fraunces** | via `next/font/google` (`src/app/fonts.ts`) | Google Fonts (Undercase Type) | SIL Open Font License 1.1 | ✅ OFL permits web embedding and self-hosting |
| Body font **Inter** | via `next/font/google` | Google Fonts (Rasmus Andersson) | SIL Open Font License 1.1 | ✅ |

`next/font` downloads the font files **at build time** and serves them from our own origin;
browsers never contact Google.

## Missing assets — `[PLACEHOLDER]`s to supply before launch (AC-REL-01)

| Placeholder | Where it appears | Requirements |
|---|---|---|
| `[PLACEHOLDER: logo asset]` | Header, footer, 404 (`Logo.tsx`) | Final logo as SVG (+ monochrome variant); permission to use in web and print |
| `[PLACEHOLDER: hero photo]` | Optional replacement for `HeroArt` | AVIF/WebP, ≥ 1600 px wide, ≤ 120 KB at display size; licence allowing commercial web use |
| `[PLACEHOLDER: static map image]` | Location section (`MapArt`) | Self-hosted static image; if derived from OpenStreetMap, include “© OpenStreetMap contributors” (ODbL). **Do not** embed Google/Apple map iframes (cookies, NFR-C-03) |
| Product photography | Not used yet | Own photos preferred (no licence risk); people in photos need signed model releases |
| Favicon / app icons / Open Graph image | Not yet created (outside this scope) | 512×512 PNG icon, maskable icon, 1200×630 OG image |

## Rules for adding photography

1. Prefer **photos taken by/for Cavella** (work-for-hire or written licence transferring commercial web rights).
2. Stock photos: record the **exact licence URL and download date** below; licences that allow
   commercial use without attribution (for example the Unsplash or Pexels licences) are acceptable,
   but keep proof. Avoid images with recognisable brands, logos, or identifiable people without releases.
3. Never use images found via search engines or social media without a written licence.
4. Optimise before committing (AVIF/WebP, responsive sizes) — see PRD NFR-P-03/04.

| Photo | File | Author / source URL | Licence + URL | Downloaded | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | — |
