# UI Redesign Implementation Specification: Skolopals

## 1. Design System & Color Tokens

### 1.1 Surface & Background Palette
* **Page Canvas Background (`--bg-canvas`)**: `#FAF8F5` (Warm off-white / alabaster tint across the main page body).
* **Navbar Surface (`--bg-navbar`)**: `#FFFFFF` (Pure white top bar with subtle bottom border `#EAE6DF`).
* **Hero Container Fill (`--bg-hero`)**: Linear gradient from `#EEF4FA` (top-left) to `#E6EFF8` (bottom-right), accented along the bottom edge with overlapping organic wave layers in `#F8D7E8` (soft pink) and `#FCF3CF` (soft cream/yellow).
* **Location Pill Surface (`--bg-badge-location`)**: `#DCE7F3` (Muted ice blue).
* **Process Card Surfaces (4-Column Grid)**:
  * **Card 1 (`1. Assessment`)**: Top accent bar `#D81B7A` (`4px` height); card fill linear gradient `#FDF2F8` (top) to `#FCE7F3` (bottom).
  * **Card 2 (`2. Learning plan`)**: Top accent bar `#0288D1` (`4px` height); card fill linear gradient `#F0F8FF` (top) to `#E0F2FE` (bottom).
  * **Card 3 (`3. Tutoring & homework`)**: Top accent bar `#FBC02D` (`4px` height); card fill linear gradient `#FFFDF2` (top) to `#FEF9C3` (bottom).
  * **Card 4 (`4. Reports & feedback`)**: Top accent bar `#7B1FA2` (`4px` height); card fill linear gradient `#F8F4FC` (top) to `#F3E8FF` (bottom).
* **Pricing Banner Surface (`--bg-banner-promo`)**: `#FDF4D7` (Warm cream yellow) with a `1px solid #F5E6B8` border.

### 1.2 Brand, Text & Interactive Colors
* **Primary Brand Navy (`--color-navy-primary`)**: `#1B2559` (Used for main headings, card titles, hero headline part 1, active nav text, and secondary button text/border).
* **Primary Brand Magenta (`--color-magenta-primary`)**: `#D81B7A` (Used for hero headline highlight `"Succeeding Tomorrow."`, primary CTA fill `"Enrol a learner"`, pricing highlight `"R 450"`, and logo `"SKO"` / `"P A"` accents).
* **Secondary Brand Purple (`--color-purple-auth`)**: `#6A1B9A` (Used for top-right `"Log out"` solid button).
* **Interactive Link Blue (`--color-link`)**: `#0277BD` (Used for inline text link `"See the full price list."`).
* **Body Copy Slate (`--text-body`)**: `#334155` (High-readability dark slate for subtitles, card descriptions, and banner copy).
* **Muted Nav Text (`--text-nav`)**: `#1E293B` (Dark charcoal for inactive top navigation links).
* **Decorative Accents**:
  * Top-left photo burst lines (3 strokes): `#D81B7A` (Magenta).
  * Bottom-right photo burst lines (3 strokes): `#FBC02D` (Warm yellow).

---

## 2. Typography Scale & Hierarchy

Use a clean geometric/humanist sans-serif font stack: `'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif`.

| Element | Font Size | Font Weight | Line Height | Letter Spacing | Color Token |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Hero Headline (`H1`)** | `42px` (`2.625rem`) | `800` (ExtraBold) | `1.15` | `-0.02em` | `#1B2559` / `#D81B7A` |
| **Section Heading (`H2`)** | `28px` (`1.75rem`) | `800` (ExtraBold) | `1.25` | `-0.015em` | `#1B2559` |
| **Promo Banner Heading** | `22px` (`1.375rem`) | `800` (ExtraBold) | `1.3` | `-0.01em` | `#1B2559` / `#D81B7A` |
| **Hero Subtitle** | `16px` (`1rem`) | `500` (Medium) | `1.5` | `0` | `#334155` |
| **Card Title (`H3`)** | `16px` (`1rem`) | `700` (Bold) | `1.35` | `0` | `#1B2559` |
| **Card Body / Banner Body** | `14px` (`0.875rem`) | `400` (Regular) | `1.5` | `0` | `#334155` |
| **Nav Links & Buttons** | `14px` (`0.875rem`) | `600` (SemiBold) | `1.0` | `0` | Varies by state |
| **Location Pill Text** | `12px` (`0.75rem`) | `600` (SemiBold) | `1.0` | `0.01em` | `#334155` |

---

## 3. Layout Grid & Spacing System

* **Max Content Width**: `1280px` centered horizontally (`margin: 0 auto`) with `24px` horizontal outer padding on desktop.
* **Vertical Section Rhythm**:
  * Navbar height: `68px` (full-bleed white bar).
  * Navbar to Hero Banner top margin: `24px`.
  * Hero Banner to `"How Skolopals works"` section: `40px`.
  * Section Heading (`H2`) to content below: `20px`.
  * `"How Skolopals works"` grid to Pricing Banner: `24px`.
  * Pricing Banner to `"What we teach"` heading: `36px`.

---

## 4. Component-by-Component Implementation Instructions

### 4.1 Top Navigation Bar (`<header>`)
* **Layout**: Full-width white bar (`#FFFFFF`), `height: 68px`, `border-bottom: 1px solid #EAE6DF`, flexbox `justify-content: space-between`, `align-items: center`, horizontal padding `32px`.
* **Left Cluster (Brand + Nav Links)**:
  * **Logo (`SKOLO PALS`)**: Custom playful stacked wordmark on the far left. Top row `"SKOLO"` in bold rounded letters (`S`, `K`, `O` in `#D81B7A`, `L`, `O` in `#0288D1`). Bottom row `"P A L S"` inside 4 individual colored square tiles (`#D81B7A`, `#0288D1`, `#FBC02D`, `#7B1FA2`) with crisp white uppercase letters.
  * **Navigation Links** (`margin-left: 36px`, `gap: 24px`):
    * Items: `Home`, `Subjects`, `Our Tutors`, `Timetable`, `Holiday Programmes`, `Fees`, `Contact`.
    * **Active State (`Home`)**: Text color `#0277BD`, `font-weight: 700`, with a `3px` solid `#0277BD` bottom indicator bar pinned to the bottom edge of the navbar (`border-radius: 2px 2px 0 0`).
    * **Inactive State**: Text color `#1E293B`, `font-weight: 500`; hover transitions to `#0277BD`.
* **Right Cluster (Auth Actions)**:
  * **Container**: `display: flex`, `gap: 12px`, `align-items: center`.
  * **`Dashboard` Button**: Outline button—`background: #FFFFFF`, `border: 1px solid #CBD5E1`, `color: #1E293B`, `border-radius: 8px`, `padding: 9px 18px`, `font-weight: 600`.
  * **`Log out` Button**: Solid button—`background: #6A1B9A`, `border: none`, `color: #FFFFFF`, `border-radius: 8px`, `padding: 9px 18px`, `font-weight: 600`.

### 4.2 Hero Banner Section
* **Container**: Rounded card (`border-radius: 20px`), `overflow: hidden`, `position: relative`, `padding: 48px 56px`, background `#EDF4FB` with subtle multi-stop pastel wave SVG/CSS overlays spanning the bottom `45px` (blending `#F8D7E8` on the left into `#FCF3CF` on the right).
* **Grid Structure**: 2-column CSS Grid (`grid-template-columns: 1.25fr 0.75fr`, `gap: 40px`, `align-items: center`).
* **Left Column (Copy & CTAs)**:
  1. **Location Pill**: Inline-flex pill (`background: #DCE7F3`, `border-radius: 9999px`, `padding: 6px 14px`, `margin-bottom: 20px`) containing `"Damonsville · Brits · North West"`.
  2. **Headline (`H1`)**: Two-tone inline text (`margin-bottom: 16px`):
     * `<span style="color: #1B2559">Learning Today. </span>`
     * `<span style="color: #D81B7A">Succeeding Tomorrow.</span>`
  3. **Subheadline**: `"Affordable after-school tutoring, homework support and reading intervention for Grade R to Grade 12, following the CAPS curriculum."` (`max-width: 580px`, `margin-bottom: 28px`).
  4. **Button Group** (`display: flex`, `gap: 14px`):
     * **Primary CTA (`Enrol a learner`)**: Solid magenta fill (`background: #D81B7A`, `color: #FFFFFF`, `border-radius: 8px`, `padding: 12px 24px`, `font-weight: 700`).
     * **Secondary CTA (`See our fees`)**: Transparent/white outline button (`background: rgba(255, 255, 255, 0.7)`, `border: 1.5px solid #1B2559`, `color: #1B2559`, `border-radius: 8px`, `padding: 12px 24px`, `font-weight: 700`).
* **Right Column (Hero Image + Hand-Drawn Accents)**:
  * **Photo Frame**: `border-radius: 16px`, `overflow: hidden`, `aspect-ratio: 16 / 10`, `box-shadow: 0 10px 25px rgba(27, 37, 89, 0.08)`. Displays warm lifestyle photography of a tutor/student smiling while writing at a wooden desk with a laptop.
  * **Decorative Burst Lines**:
    * **Top-Left Corner**: 3 short rounded-cap diagonal SVG strokes (`#D81B7A`, `stroke-width: 4px`) radiating outward at `-45deg`, `-20deg`, and `-70deg` outside the top-left corner of the image.
    * **Bottom-Right Corner**: 3 short rounded-cap diagonal SVG strokes (`#FBC02D`, `stroke-width: 4px`) radiating outward outside the bottom-right corner of the image.

### 4.3 "How Skolopals works" Process Grid
* **Section Heading**: `"How Skolopals works"` (`H2`, `#1B2559`, `margin-bottom: 20px`).
* **Grid Layout**: 4 equal columns (`grid-template-columns: repeat(4, 1fr)`, `gap: 18px`). Responsive collapse: `repeat(2, 1fr)` on tablet, `1fr` on mobile.
* **Card Anatomy**:
  * Base structure: `border-radius: 12px`, `overflow: hidden`, `padding: 20px 22px 24px`, `position: relative`, subtle border `1px solid rgba(0, 0, 0, 0.04)`.
  * **Top Colored Strip**: `4px` solid top border (`border-top: 4px solid <accent-color>`).
  * **Card 1**: Title `"1. Assessment"` | Body `"Every learner starts with an assessment of reading, writing and mathematics."` | Top border `#D81B7A` | Gradient `#FDF2F8` -> `#FCE7F3`.
  * **Card 2**: Title `"2. Learning plan"` | Body `"We set goals per subject from what the assessment shows."` | Top border `#0288D1` | Gradient `#F0F8FF` -> `#E0F2FE`.
  * **Card 3**: Title `"3. Tutoring & homework"` | Body `"Small groups at the centre, Monday to Thursday and Saturday mornings."` | Top border `#FBC02D` | Gradient `#FFFDF2` -> `#FEF9C3`.
  * **Card 4**: Title `"4. Reports & feedback"` | Body `"Monthly monitoring, a termly report, and a conversation with you."` | Top border `#7B1FA2` | Gradient `#F8F4FC` -> `#F3E8FF`.

### 4.4 Full-Width Pricing Callout Banner
* **Container**: Full container width (`100%`), `background: #FDF4D7`, `border: 1px solid #F5E6B8`, `border-radius: 12px`, `padding: 22px 28px`.
* **Headline**: `"Small groups, from "` (`#1B2559`) + `"R 450"` (`#D81B7A`) + `" a month"` (`#1B2559`) in `22px` ExtraBold (`margin-bottom: 6px`).
* **Subtext**: `"One subject, two subjects, three, or all-subject support. Homework assistance and one-on-one tutoring are available too. "` (`#334155`) + inline anchor `"See the full price list."` (`color: #0277BD`, `font-weight: 600`, `text-decoration: none`, `hover: text-decoration: underline`).

### 4.5 Subsequent Section Header
* **Section Heading**: `"What we teach"` (`H2`, `28px`, `800` weight, `#1B2559`) positioned `36px` below the pricing callout banner.

---

## 5. Implementation Checklist for Refactoring Existing UI

1. **Global Body Reset**: Override any existing pure-white (`#FFFFFF`) or cool-gray page background with `#FAF8F5`.
2. **Navbar Restructure**: Ensure the navbar sits on a crisp `#FFFFFF` surface with a `1px` bottom divider, left-aligned menu links with an active bottom underline bar (`#0277BD`), and right-aligned `Dashboard` (outline) and `Log out` (`#6A1B9A` solid) buttons.
3. **Hero Migration**: Wrap the hero content inside a `20px`-rounded pastel blue container (`#EDF4FB`) with bottom SVG waves (`#F8D7E8` + `#FCF3CF`) and add the 3-stroke SVG burst decorations to the top-left (`#D81B7A`) and bottom-right (`#FBC02D`) corners of the hero image.
4. **Card Token Mapping**: Replace uniform white/gray cards in the "How it works" section with the 4 distinct semantic gradient cards (`pink`, `sky-blue`, `warm-yellow`, `purple`) topped with `4px` solid accent borders.
5. **Pricing Strip**: Style the pricing strip as a single-column rounded callout box (`#FDF4D7`) highlighting `"R 450"` in `#D81B7A` and `"See the full price list."` in `#0277BD`.