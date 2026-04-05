# Roebling Tab

A one-off bill splitter for the Roebling Sporting Club dinner on April 4, 2026. Six people tap the link, pick their name, check off what they had, and get a pre-filled Venmo button.

## What it does

- Hardcoded receipt (Check #102, $543.07 total) already loaded
- Each person claims their name once, then taps items
- Shared items (like the 16 pc wings) can be claimed by multiple people — cost splits evenly
- Tax, tip, and the 3% credit card surcharge split proportionally by each person's share
- Live sync — everyone sees each other's claims updating every ~4 seconds
- Venmo deep link with amount and memo pre-filled (works on mobile; on desktop Venmo ignores the amount param, a platform limitation)
- Sanjit sees "You paid the house" instead of a Venmo button

## Stack

- Next.js 14 (App Router)
- Vercel KV for shared state
- Tailwind CSS
- Framer Motion for animations
- Fraunces (display) + Instrument Sans (body) + JetBrains Mono (numerals)

## Deploy to Vercel

1. **Push this folder to a GitHub repo.**
   ```bash
   cd roebling-split
   git init
   git add .
   git commit -m "roebling tab"
   gh repo create roebling-split --private --source=. --push
   ```
   (Or use the GitHub UI, up to you.)

2. **Import the repo on Vercel.** Go to https://vercel.com/new, pick the repo, accept the defaults (framework auto-detects as Next.js), click Deploy.

3. **Add a KV store.** In the Vercel dashboard → your project → Storage tab → Create Database → KV. Name it whatever. When prompted, connect it to this project — Vercel auto-injects the `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc. environment variables.

4. **Redeploy** (the project → Deployments → most recent → ⋯ → Redeploy) so the app picks up the new env vars.

5. **Share the URL** with the group. Everyone hits the same URL, picks their name, and claims their items.

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without KV configured locally, the app uses an in-memory store that resets when the dev server restarts — fine for sanity testing but not for multi-device testing.

To test multi-device locally with a real KV store, copy `.env.local.example` to `.env.local` and paste the KV credentials from your Vercel project (Settings → Environment Variables → reveal values).

## Resetting claims

If you want to wipe all claims and start over (e.g. someone claimed the wrong items and everyone needs to restart):

```bash
curl -X POST https://your-deployment.vercel.app/api/reset
```

Or hit it from your browser's devtools console on the deployed URL:
```js
fetch("/api/reset", { method: "POST" })
```

## Customizing

- **Receipt data**: edit `lib/bill.ts` — the `buildItems()` function and `RECEIPT` object.
- **People**: same file, `PEOPLE` array. Add/remove names as needed.
- **Payer (Venmo handle)**: same file, `PAYER` object. The person whose Venmo receives the payments.
- **Colors/fonts**: `tailwind.config.ts` and `app/globals.css`.

## Notes

- The checkbox state is a shared list of who-claimed-what, stored as a single JSON blob in KV under `bill:roebling-apr4:claims`. Last-write-wins on race conditions, which is fine for a 6-person dinner.
- The Venmo URL scheme is `https://venmo.com/{handle}?txn=pay&amount=X&note=Y`. On mobile this opens the Venmo app with everything pre-filled. On desktop Venmo just opens the web profile and ignores the params — this is Venmo's decision, not something the app can fix.
- `maximumScale: 1` is set in the viewport to prevent accidental zoom-on-tap on iOS.
