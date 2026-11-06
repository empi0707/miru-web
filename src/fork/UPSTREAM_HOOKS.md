# Upstream Hooks

Files outside `src/fork/` that have been modified for fork features.
After each upstream sync, verify these changes are still applied.

## Sync workflow

```bash
git remote add upstream <upstream-repo-url>   # one-time
git fetch upstream
git rebase upstream/main                       # resolve conflicts commit-by-commit
```

Rebase surfaces conflicts one commit at a time, which is easier than a merge.

---

## `src/app/layout.tsx`

**Why:** Inject `BrandOverrideProvider` (URL-param brand/logo override) and `AdsLoader` (ads.html injection); use `BRAND_ICON` for browser tab favicon separately from navbar logo.

**Changes:**

1. Update the fork config import to include `BRAND_ICON`:
```ts
import { BRAND, BRAND_TAGLINE, BRAND_DESCRIPTION, BRAND_LOGO, BRAND_ICON, BRAND_APPLE_ICON } from "@/fork/config";
```

2. In the `metadata` object, change `icons.icon` from `BRAND_LOGO` to `BRAND_ICON`:
```ts
icons: {
  icon: BRAND_ICON,
  apple: BRAND_APPLE_ICON,
},
```

3. Add two more imports after the existing fork imports:
```ts
import { BrandOverrideProvider } from "@/fork/brand-override";
import AdsLoader from "@/fork/ads-loader";
```

4. In the JSX, wrap the entire `<body>` content with `<BrandOverrideProvider>` and add `<AdsLoader />` just before the closing `</BrandOverrideProvider>`:
```tsx
<body ...>
  <BrandOverrideProvider>
    <ThemeProvider ...>
      <QueryProvider>
        <NavBar />
        {children}
        <Footer />
      </QueryProvider>
    </ThemeProvider>
    <Toaster />
    <AdsLoader />
  </BrandOverrideProvider>
</body>
```

---

## `src/components/navbar.tsx`

**Why:** Use runtime brand/logo override from URL params instead of static config values.

**Changes:**

1. Replace:
```ts
import { BRAND, BRAND_LOGO } from "@/fork/config";
```
With:
```ts
import { useBrandOverride } from "@/fork/brand-override";
import { LOGO_TEXT_ENABLED } from "@/fork/config";
```

2. Add at the top of the `NavBar` component body (before `const auth = ...`):
```ts
const { brand, logo, isExternalLogo } = useBrandOverride();
```

3. Replace the `<Image>` logo block and `{BRAND}` text with:
```tsx
{isExternalLogo ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={logo} alt={`${brand} logo`} width={40} height={40}
    className="rounded-xl shadow-lg transition-transform group-hover:scale-105" />
) : (
  <Image src={logo} alt={`${brand} logo`} width={40} height={40}
    className="rounded-xl shadow-lg transition-transform group-hover:scale-105" />
)}
{LOGO_TEXT_ENABLED && (
  <h1 className={...}>{brand}</h1>
)}
```

---

## `src/components/footer.tsx`

**Why:** Same brand/logo override as navbar.

**Changes:**

1. Add `"use client";` as the very first line (component needs the hook).

2. Replace:
```ts
import Image from "next/image";
import { BRAND, BRAND_LOGO } from "@/fork/config";
```
With:
```ts
import Image from "next/image";
import { useBrandOverride } from "@/fork/brand-override";
import { LOGO_TEXT_ENABLED } from "@/fork/config";
```

3. Add at the top of the `Footer` component body:
```ts
const { brand, logo, isExternalLogo } = useBrandOverride();
```

4. Replace the `<Image>` block and all `{BRAND}` occurrences:
```tsx
{isExternalLogo ? (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={logo} alt={`${brand} logo`} width={40} height={40} className="rounded-xl shadow-md" />
) : (
  <Image src={logo} alt={`${brand} logo`} width={40} height={40} className="rounded-xl shadow-md" />
)}
{LOGO_TEXT_ENABLED && (
  <span ...>{brand}</span>
)}
```
And replace `{ brand: BRAND }` → `{ brand }` in the `t()` call, and `{BRAND}` → `{brand}` in the copyright line.

---

## `src/app/loading.tsx`

**Why:** Replace custom GIF spinner with generic Lucide icon.

**Changes:**

Replace `<Image src="/loader.gif" ...>` with:
```tsx
import { Loader2 } from "lucide-react";
// ...
<Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
```
Remove `import Image from "next/image"` if no longer used.

---

## `src/components/miru-player.tsx`

**Why:** Replace branded GIF loading image in Artplayer with a generic SVG spinner; replace fallback JSX spinner.

**Changes:**

1. Remove:
```ts
import loadingImage from "@/assets/genkai.gif";
import Image from "next/image";
```
Add:
```ts
import { Loader2 } from "lucide-react";
```

2. In the Artplayer `option` object, set `icons.loading` to this inline SVG string:
```ts
loading: `<svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="18" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4"/><circle cx="24" cy="24" r="18" fill="none" stroke="#22d3ee" stroke-width="4" stroke-linecap="round" stroke-dasharray="28 86"><animateTransform attributeName="transform" type="rotate" values="0 24 24;360 24 24" dur="0.75s" repeatCount="indefinite"/></circle></svg>`
```

3. Replace the JSX fallback `<Image>` loading placeholder with:
```tsx
<Loader2 className="h-12 w-12 animate-spin text-cyan-400" />
```
