---
name: ui-ux-pro-max
description: "Comprehensive design guide for web, mobile, and desktop applications. Contains 67 styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 22 technology stacks."
---

# ui-ux-pro-max

Comprehensive design guide for web, mobile, and desktop applications. Contains 67 styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 22 technology stacks. Searchable database with priority-based recommendations.

# Prerequisites

The bundled scripts require Python 3 (standard library only — no third-party packages, no network access). Check if it is available:

```bash
python3 --version || python --version
```

If Python is not installed, **do not install it yourself**. Stop and ask the user to install Python 3 using their preferred method (e.g. from [python.org](https://www.python.org/downloads/) or their OS package manager), then continue once it is available. Never run package-manager or system-modifying commands (`sudo`, `brew`, `apt`, `winget`, etc.) on the user's machine for this skill.

If the user prefers not to install Python, skip the CLI searches and rely on the reference sections below.

> **Note:** On Windows, use `python` instead of `python3` to run scripts (e.g., `python .github/prompts/ui-ux-pro-max/scripts/search.py` instead of `python3 ...`).

---

## How to Use This Skill

Use this skill when the user requests any of the following:

| Scenario | Trigger Examples | Start From |
|----------|-----------------|------------|
| **New project / page** | "Build a landing page", "Build a dashboard" | Step 1 → Step 2 (design system) |
| **New component** | "Create a pricing card", "Add a modal" | Step 3 (domain search: style, ux) |
| **Choose style / color / font** | "What style fits a fintech app?", "Recommend a color palette" | Step 2 (design system) |
| **Review existing UI** | "Review this page for UX issues", "Check accessibility" | Quick Reference checklist |
| **Fix a UI bug** | "Button hover is broken", "Layout shifts on load" | Quick Reference → relevant section |
| **Improve / optimize** | "Make this faster", "Improve mobile experience" | Step 3 (domain search: ux, react) |
| **Implement dark mode** | "Add dark mode support" | Step 3 (domain: style "dark mode") |
| **Add charts / data viz** | "Add an analytics dashboard chart" | Step 3 (domain: chart) |
| **Stack best practices** | "React performance tips", "SwiftUI navigation" | Step 4 (stack search) |

Follow this workflow:

### Step 1: Analyze User Requirements

Extract key information from user request:
- **Product type**: SaaS, e-commerce, portfolio, healthcare, beauty, service, etc.
- **Target audience**: Consumer or B2B, age group, usage context
- **Style keywords**: playful, vibrant, minimal, dark mode, content-first, immersive, etc.
- **Stack**: React, Next.js, Vue, HTML+Tailwind, React Native, Flutter, etc.

### Step 2: Generate Design System (REQUIRED)

**Always start with `--design-system`** to get comprehensive recommendations with reasoning:

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:
1. Searches domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

**Example:**
```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "beauty spa wellness service" --design-system -p "Serenity Spa"
```

### Step 2b: Persist Design System (Master + Overrides Pattern)

To save the design system for **hierarchical retrieval across sessions**, add `--persist`:

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

This creates:
- `design-system/MASTER.md` — Global Source of Truth with all design rules
- `design-system/pages/` — Folder for page-specific overrides

**With page-specific override:**
```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

This also creates:
- `design-system/pages/dashboard.md` — Page-specific deviations from Master

**How hierarchical retrieval works:**
1. When building a specific page (e.g., "Checkout"), first check `design-system/pages/checkout.md`
2. If the page file exists, its rules **override** the Master file
3. If not, use `design-system/MASTER.md` exclusively

**Context-aware retrieval prompt:**
```
I am building the [Page Name] page. Please read design-system/MASTER.md.
Also check if design-system/pages/[page-name].md exists.
If the page file exists, prioritize its rules.
If not, use the Master rules exclusively.
Now, generate the code...
```

### Step 2c: Design Dials (optional)

Three optional 1-10 sliders that tune `--design-system` output without changing your query:

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<query>" --design-system --variance <1-10> --motion <1-10> --density <1-10>
```

| Dial | Low (1-3) | Mid (4-7) | High (8-10) |
|------|-----------|-----------|-------------|
| `--variance` | Centered / minimal | Balanced / modern | Bold / asymmetric (Brutalism, Bento Grids) |
| `--motion` | Subtle micro-interactions | Standard scroll/stagger | Complex choreography (GSAP) |
| `--density` | Spacious (24-96px) | Standard (16-64px) | Dense/dashboard (8-32px) |

**Example:**
```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "internal analytics dashboard" --design-system --variance 8 --motion 7 --density 8 -p "Ops Console"
```

### Step 3: Supplement with Detailed Searches (as needed)

After getting the design system, use domain searches to get additional details:

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

**When to use detailed searches:**

| Need | Domain | Example |
|------|--------|---------|
| Product type patterns | `product` | `--domain product "entertainment social"` |
| More style options | `style` | `--domain style "glassmorphism dark"` |
| Color palettes | `color` | `--domain color "entertainment vibrant"` |
| Font pairings | `typography` | `--domain typography "playful modern"` |
| Chart recommendations | `chart` | `--domain chart "real-time dashboard"` |
| UX best practices | `ux` | `--domain ux "animation accessibility"` |
| Landing structure | `landing` | `--domain landing "hero social-proof"` |
| React perf | `react` | `--domain react "rerender memo list"` |
| Icon suggestions | `icons` | `--domain icons "navigation arrows"` |
| Individual Google Fonts | `google-fonts` | `--domain google-fonts "variable sans serif"` |
| GSAP animation snippets | `gsap` | `--domain gsap "scroll reveal stagger"` |

### Step 4: Stack Guidelines

Get implementation-specific best practices for the user's stack:

```bash
python .github/prompts/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack>
```

---

## Search Reference

### Available Domains

| Domain | Use For | Example Keywords |
|--------|---------|------------------|
| `product` | Product type recommendations | SaaS, e-commerce, portfolio, healthcare, beauty |
| `style` | UI styles, colors, effects | glassmorphism, minimalism, dark mode, brutalism |
| `typography` | Font pairings, Google Fonts | elegant, playful, professional, modern |
| `color` | Color palettes by product type | saas, ecommerce, healthcare, beauty, fintech |
| `landing` | Page structure, CTA strategies | hero, testimonial, pricing, social-proof |
| `chart` | Chart types, library recommendations | trend, comparison, timeline, funnel |
| `ux` | Best practices, anti-patterns | animation, accessibility, z-index, loading |
| `gsap` | GSAP animation skeletons | scroll reveal, stagger, magnetic cursor |
| `react` | React/Next.js performance | waterfall, bundle, suspense, memo, rerender |
| `icons` | Icon recommendations | arrow, navigation, lucide, phosphor |
| `google-fonts` | Individual Google Fonts lookup | sans serif, monospace, variable font |

### Available Stacks

`react`, `nextjs`, `vue`, `svelte`, `astro`, `swiftui`, `react-native`, `flutter`, `nuxtjs`, `nuxt-ui`, `html-tailwind`, `shadcn`, `jetpack-compose`, `threejs`, `angular`, `laravel`, `javafx`, `wpf`, `winui`, `avalonia`, `uno`, `uwp`

---

## Output Formats

```bash
# ASCII box (default)
python .github/prompts/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown
python .github/prompts/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown

# Full JSON (untruncated)
python .github/prompts/ui-ux-pro-max/scripts/search.py "SaaS" --domain style --json
```

---

## Pre-Delivery Checklist

Before delivering UI code, verify:

- [ ] No emojis used as icons (use SVG/vector icons instead)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast ≥4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px breakpoints tested
- [ ] Touch targets ≥44×44pt (iOS) or ≥48×48dp (Android)
- [ ] Dark mode contrast independently verified
- [ ] All meaningful images/icons have accessibility labels
