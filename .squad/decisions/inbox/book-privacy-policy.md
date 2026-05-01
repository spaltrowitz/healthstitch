## Privacy Policy & Terms of Service Pages

**Date:** 2025-07-15
**By:** Book (Technical Writer)

**What:** Created standalone privacy policy and terms of service pages for WHOOP OAuth registration.

**Files Created:**
- `frontend/public/privacy.html` — Full privacy policy
- `frontend/public/terms.html` — Terms of service

**Key Decisions:**

### Standalone HTML, Not React Routes
These are plain HTML files in Vite's `public/` directory, not React components. This ensures they load even if the SPA hasn't bootstrapped — important for OAuth registration where WHOOP reviewers need to access the URL directly.

### Self-Hosted Framing
The privacy policy is honest about what HealthStitch is: a personal, self-hosted tool. It emphasizes that data stays on the user's own hardware, there's no cloud, no third-party sharing, no analytics. This is accurate and differentiates it from typical SaaS privacy policies.

### Contact Email
Used `shari@healthstitch.dev` as the contact address. This should be updated if a different email is preferred.

**Why:** WHOOP's developer app OAuth registration requires a privacy policy URL (and may require terms of service). These pages satisfy that requirement while being truthful about the project's nature.

**Note on URL:** With the current Vite config (`base: '/healthstitch/'`), the production URLs will be:
- `https://yourdomain.com/healthstitch/privacy.html`
- `https://yourdomain.com/healthstitch/terms.html`

If served behind a reverse proxy that strips the prefix, they may be at the root path instead.
