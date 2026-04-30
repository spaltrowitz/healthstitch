# Scrunch: Invisible Onboarding — UX Specification

**Author:** Jan (Design Lead)  
**Responds to:** Kenickie's PM Spec (2025-07-17)  
**Status:** Draft  
**Date:** 2025-07-17

---

## Design Philosophy

Onboarding should be something the user never notices happened. The product earns context through use, not interrogation. Three principles guide every decision:

1. **Content is the onboarding.** The homepage delivers value before we know anything about the user. Personalization is a refinement, not a prerequisite.
2. **Ask inside the experience, not before it.** Every data-collection moment is embedded in a surface the user is already engaging with. It looks like product, not process.
3. **Graceful ignorance.** A user who never answers a single prompt gets a fully functional product. Personalization lifts the experience; its absence never degrades it.

This replaces the old bottom-sheet onboarding wizard entirely. No modals, no interstitials, no gates.

---

## 1. Zero-State Homepage

The homepage must work cold — no profile, no history, no signals. It serves every persona on first load.

### Layout (Mobile-First)

```
┌─────────────────────────────┐
│  [Scrunch logo]    [Search] │
├─────────────────────────────┤
│                             │
│  Hero: Editorial image      │
│  "Find what works for       │
│   your curls."              │
│  (No CTA button — scroll    │
│   is the action)            │
│                             │
├─────────────────────────────┤
│  ┌───────────────────────┐  │
│  │ 🌀 Curl Types         │  │
│  │ Wavy · Curly · Coily  │  │
│  │ [horizontal scroll]   │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Popular This Week     │  │
│  │ [content card]        │  │
│  │ [content card]        │  │
│  │ [content card]        │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Routines & Techniques │  │
│  │ [content card]        │  │
│  │ [content card]        │  │
│  └───────────────────────┘  │
│                             │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │ "New to curly hair?"  │  │  ← Safety net (see §5)
│  │  Start here →         │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ Product Reviews       │  │
│  │ [content card]        │  │
│  │ [content card]        │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘
```

### Persona Coverage

| Persona | What they find immediately | How |
|---------|---------------------------|-----|
| **Experienced curly** (knows their type) | Curl-type entry points, product reviews, advanced techniques | Curl Types rail + Routines section |
| **Newly natural / transitioning** | Beginner-friendly content, orientation | "New to curly hair?" card + Popular This Week |
| **Parent / caregiver** | Kids' curl care, gentle routines | Surfaced in Popular / Routines via editorial curation |
| **Product hunter** | Reviews, ingredient analysis | Product Reviews section + Search |
| **Casual browser** | Trending content, community picks | Popular This Week — editorial, no personalization needed |

### Zero-State Content Strategy

- **No algorithmic ranking on visit 1.** Content is editorially curated. This guarantees quality and prevents cold-start weirdness.
- **Sections are broad by design.** "Popular This Week" spans all curl types. "Routines & Techniques" mixes beginner and advanced. The user self-selects by tapping what interests them — and Layer 1 captures that signal.
- **Hero copy is inclusive.** "Find what works for your curls" doesn't assume expertise. It works for a 3C veteran and a first-timer.

---

## 2. Deferred Inline Prompt Card

Kenickie's spec requires the prompt after 3+ product views. Here's the exact design.

### Visual Design

The card is styled to rhyme with content cards but has a distinct (not disruptive) visual signal.

```
┌─────────────────────────────────┐
│                                 │
│  [content card — article]       │
│                                 │
├─────────────────────────────────┤
│                                 │
│  [content card — article]       │
│                                 │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │  What are your curls    │    │
│  │  like?                  │    │
│  │                         │    │
│  │  ┌──────┐ ┌──────┐     │    │
│  │  │ Wavy │ │Curly │     │    │
│  │  └──────┘ └──────┘     │    │
│  │  ┌──────┐ ┌──────┐     │    │
│  │  │Coily │ │ Not  │     │    │
│  │  │      │ │ sure │     │    │
│  │  └──────┘ └──────┘     │    │
│  │                         │    │
│  │  [ Skip ] (text link)   │    │
│  │                         │    │
│  └─────────────────────────┘    │
├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┤
│                                 │
│  [content card — article]       │
│                                 │
└─────────────────────────────────┘
```

### Visual Differentiation (Without Feeling Foreign)

- **Background:** 1-step lighter/warmer than content cards (e.g., soft peach tint vs white). Not a colored banner — just a warmth shift.
- **Border:** None. Uses the same card radius and shadow as content cards.
- **Icon:** Small ✨ or 🌀 emoji next to the question — warm, not corporate.
- **Typography:** Same typeface as content headlines. Slightly smaller size (body-large vs headline-small). Conversational tone.

### Pill Buttons

- Rounded pill shape, outline style by default.
- On tap: fill with brand accent color, subtle scale-up (102%), haptic feedback on mobile.
- Only one selectable per prompt (single-choice).
- "Not sure" is always an option. Selecting it is a valid answer that routes the user to exploratory content.

### Dismissal Behavior

| Action | Result |
|--------|--------|
| Tap a pill | Card collapses with a soft fade (200ms). Brief "Thanks! ✓" inline confirmation replaces the card for 1.5s, then the feed closes the gap. |
| Tap "Skip" | Card fades out (150ms). Feed closes the gap. Same prompt won't return for 7 days. |
| Scroll past without interaction | Card remains in feed for the duration of the session. On next session, it repositions to appear after the 4th content item instead of 3rd (backs off slightly). |
| Dismiss explicitly (swipe on mobile) | Same as "Skip." |

### Prompt Queue — Adapted for Scrunch

Kenickie defines 4 prompts in priority order. Here's the Scrunch-specific copy:

| Priority | Question | Options | When Contextual |
|----------|----------|---------|-----------------|
| 1 | "What are your curls like?" | Wavy · Curly · Coily · Not sure | Always first — unless user arrived via curl-type-specific content (then skip, infer from that) |
| 2 | "What's your focus right now?" | Styling · Health · Products · Learning the basics | After curl type is known or skipped |
| 3 | "How often do you want to hear from us?" | Daily · Weekly · Just browsing | Shown only to Returner segment (came back ≥2 sessions) |
| 4 | "Who are you caring for?" | My hair · My kid's hair · Both | Shown only if user has viewed kids/family content |

### Placement Rules

- **Feed view:** Between content items 3 and 4 (first prompt) or 4 and 5 (subsequent prompts on later sessions).
- **Detail view:** Below article body, above "Related" section — as a contextual callout.
- **Never** above the fold. **Never** before real content.

---

## 3. Progressive Disclosure Strategy

Features reveal themselves as the user's behavior warrants. Nothing is hidden permanently — it's sequenced.

### Disclosure Timeline

```
Session 1–2          Session 3–4            Session 5+
─────────────        ─────────────          ─────────────
Browse               Save / Bookmark        My Routine builder
Read articles        Follow curl types      Ingredient checker
Search               Inline prompts         Share to community
Tap curl types       "Try this routine"     Goal tracking
                     suggestions            Notifications
                                            Product diary
```

### How Features Appear

New features don't pop in with badges or tooltips. They materialize in context:

- **Save/Bookmark:** On sessions 3–4, content cards gain a subtle bookmark icon in the top-right corner. It fades in (opacity 0→1 over the first 500ms the card is in viewport). No "NEW" badge. No tooltip. If the user taps it, they see a minimal save confirmation. If they don't, it remains quietly available.

- **"Try this routine" suggestions:** After a user has read 3+ routine articles, a contextual suggestion card appears in the Related section: "Based on what you've been reading, this routine might work for your curls." Feels like smart content, not feature promotion.

- **My Routine builder:** Surfaces as a CTA at the bottom of a routine article the user has bookmarked: "Want to save this as your routine?" One tap creates it. The feature is discovered through use, not through a feature tour.

- **Ingredient checker:** Appears as a contextual link inside product review articles: "Check these ingredients for your curl type →". Only shown after curl type is known (via prompt or inference).

### Transition Behavior

When the feed reorders due to new personalization signal:

- **No instant shuffle.** On the next page load or pull-to-refresh, new ordering takes effect. The user perceives it as "fresh content" rather than rearrangement.
- **Crossfade for in-session updates:** If a prompt answer triggers immediate reranking, new cards crossfade in (opacity transition, 300ms) while displaced cards fade out. Scroll position is preserved.
- Answering Kenickie's open question: **no animation for reordering.** Subtle is better than clever. The content just *is* better next time they look.

---

## 4. State Transitions & Micro-Interactions

### Inline Prompt Card Lifecycle

```
                    ┌──────────┐
                    │  Hidden  │
                    └────┬─────┘
                         │ product_view_count >= 3
                         ▼
                    ┌──────────┐
              ┌─────│ Visible  │─────┐
              │     └────┬─────┘     │
         user taps       │      scroll past
          a pill     tap Skip    (no action)
              │          │           │
              ▼          ▼           ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ Answered │ │Skipped │ │ Passive  │
        │ (✓ msg)  │ │(fade)  │ │(persists)│
        └────┬─────┘ └───┬────┘ └────┬─────┘
             │           │           │
             │      7-day cooldown   │ next session:
             │           │           │ reposition
             ▼           ▼           ▼
        ┌──────────┐ ┌────────┐ ┌──────────┐
        │ Profile  │ │ Queue  │ │  Retry   │
        │ enriched │ │ paused │ │ (moved   │
        └──────────┘ └────────┘ │  down 1) │
                                └──────────┘
```

### Micro-Interactions

| Interaction | Animation | Duration | Easing |
|-------------|-----------|----------|--------|
| Pill button tap | Fill color + scale to 102% | 150ms | ease-out |
| Haptic (mobile) | Light impact | — | — |
| Card collapse (answered) | Height to 0 + fade | 200ms | ease-in-out |
| "Thanks ✓" confirmation | Fade in, hold, fade out | 300ms in, 1.5s hold, 200ms out | ease-in, ease-out |
| Card dismiss (skip/swipe) | Opacity to 0 | 150ms | ease-out |
| Feed gap close | Cards below translate up | 250ms | ease-out (spring) |
| Bookmark icon appear (new feature) | Opacity 0→1 | 500ms | ease-in |
| Personalized card crossfade | Old opacity out, new in | 300ms | linear |

### Content Card States

```
Default Card          Bookmarkable Card (session 3+)     Bookmarked
┌──────────────┐      ┌──────────────┐                   ┌──────────────┐
│ [image]      │      │ [image]   🔖│                   │ [image]   🔖│ (filled)
│ Title        │      │ Title     ░░ │                   │ Title     ██ │
│ Snippet...   │  →   │ Snippet...   │               →   │ Snippet...   │
│ [meta]       │      │ [meta]       │                   │ ✓ Saved      │
└──────────────┘      └──────────────┘                   └──────────────┘
```

---

## 5. "New to Curly Hair?" Safety Net

This is the one piece of structure we preserve for complete beginners who *want* guidance. It is opt-in, embedded, and non-blocking.

### Placement

- Lives in the homepage feed, positioned **after** the Routines & Techniques section (roughly 60–70% scroll depth).
- It's not a banner. It's a content card with a distinct but gentle visual treatment.

### Design

```
┌──────────────────────────────────────┐
│                                      │
│  🌱 New to curly hair?              │
│                                      │
│  No worries. We'll walk you through  │
│  the basics — curl types, first      │
│  routines, products that actually    │
│  work.                               │
│                                      │
│  [ Start here → ]                    │
│                                      │
└──────────────────────────────────────┘
```

### Visual Treatment

- **Background:** Soft gradient (warm white → lightest brand tint). Differentiated from content cards but not loud.
- **Emoji lead:** 🌱 — growth/beginner metaphor, warm and inviting.
- **Copy tone:** Reassuring, not condescending. "No worries" signals that not knowing is normal. "Actually work" signals the community is practical, not preachy.
- **CTA:** Text button with arrow, not a filled button. Low pressure.

### Tap Behavior

Tapping "Start here →" opens a **curated beginner content lane** — not a wizard, not a form. It's a filtered feed:

```
┌─────────────────────────────────┐
│  ← Back           Curly Basics  │
├─────────────────────────────────┤
│                                 │
│  [article] What's My Curl Type? │
│  [article] Your First Routine   │
│  [article] Products to Start    │
│  [article] Terms You'll Hear    │
│  [article] Common Mistakes      │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Ready for more?         │    │
│  │ [ Explore everything →] │    │
│  └─────────────────────────┘    │
│                                 │
└─────────────────────────────────┘
```

- This is a real content feed, not a tutorial. Every item is a full article.
- Layer 1 inference runs here too — tapping "What's My Curl Type?" signals interest and informs personalization.
- The "Ready for more?" card at the bottom routes back to the full homepage, now potentially personalized from their beginner-lane interactions.

### Lifecycle

| Condition | Behavior |
|-----------|----------|
| First-time user, no signals | Card is visible in homepage feed |
| User tapped "Start here" previously | Card hides from homepage. "Curly Basics" accessible from nav/search |
| User has answered curl-type prompt | Card hides — they've self-identified as non-beginner |
| User has 5+ sessions | Card hides — behavioral signals suggest familiarity |
| User explicitly dismisses (swipe/X) | Card hides permanently |

---

## 6. Answering Kenickie's Open Questions

> **Q1: Visual treatment for inline prompt cards?**

See §2 above. Summary: warm background tint (not white, not colored), same card radius/shadow, conversational copy, pill buttons. The differentiation is tonal, not structural — it rhymes with content cards but has a warmer temperature. Target: noticeable-on-second-glance, not attention-grabbing.

> **Q2: Feed reordering transition?**

No animation. Reordering takes effect on next page load or pull-to-refresh. Users perceive "the feed got better," not "the feed moved." For in-session reranking after a prompt answer: crossfade (300ms, opacity only). Scroll position preserved. See §3.

> **Q3: Progressive feature disclosure — natural position or "new" indicator?**

Natural position, no indicator. Features appear where they'd logically live (bookmark icon on cards, CTA at bottom of articles). No "NEW" badges — they create a sense of being managed. The feature should feel like it was always there and the user just noticed it. See §3.

---

## 7. Accessibility

### Prompt Cards

- All pill buttons are `role="radio"` within a `role="radiogroup"`, with `aria-label` matching visible text.
- "Skip" link has `role="button"` and is keyboard-focusable.
- Prompt card has `aria-live="polite"` so screen readers announce it when it enters the viewport, but don't interrupt content reading.
- "Thanks ✓" confirmation: `aria-live="assertive"` for immediate feedback.
- Color contrast: prompt card warm tint must maintain ≥4.5:1 contrast ratio for all text. Pill outlines ≥3:1.

### Progressive Disclosure

- Features that appear on later sessions must not change landmark structure or tab order of existing elements. New interactive elements are appended, not inserted before existing ones.
- Bookmark icon: `aria-label="Save this article"`, toggles to `aria-label="Saved"` + `aria-pressed="true"`.

### Safety Net Card

- "Start here →" is a link (`<a>`), not a button, since it navigates to a new view.
- The beginner content lane is a standard page with heading hierarchy (h1: "Curly Basics", h2 per article title).
- "Ready for more?" link has clear destination text — never "Click here."

### Motion

- All animations respect `prefers-reduced-motion`. When reduced motion is preferred:
  - Card collapse/fade → instant visibility toggle.
  - Crossfade → instant swap.
  - Pill scale → no scale, color change only.
  - Bookmark fade-in → instant appear.

### Focus Management

- After a prompt card is dismissed (answered or skipped), focus moves to the next content card in the feed. No focus trap, no focus loss.
- Beginner lane "← Back" button returns focus to the safety net card's original position (or the nearest content card if hidden).

---

## 8. Superseded Patterns

| Old Pattern | Was | Now |
|-------------|-----|-----|
| Bottom-sheet onboarding wizard | Modal sheet with 3–5 steps, shown on first launch | **Killed.** Replaced by zero-state homepage + deferred inline prompts |
| "Tell us about your curls" gate | Required curl type selection before accessing content | **Killed.** Curl type is inferred or asked inline after 3 views |
| Profile completion bar | Persistent progress indicator encouraging data entry | **Killed.** No profile to complete. Personalization accumulates silently |
| Onboarding tooltip tour | Sequential tooltips highlighting features | **Killed.** Features appear progressively, discovered through use |
| "Welcome back" modal | Returning user prompt suggesting next actions | **Killed.** Feed personalization handles this implicitly |

---

*Jan — ready for review. Kenickie, flag anything that contradicts your intent. Engineering, flag anything that's infeasible in the event pipeline timeline.*
