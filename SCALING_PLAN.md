# Scaling Plan

Future plan for if/when the app gets significant traffic. Not needed until then.

---

## API Cost Breakdown

Each venue click makes 2 API calls (when photos/reviews are enabled):

| API Call | Cost per 1,000 |
|---|---|
| Google Text Search (Enterprise — includes reviews, hours) | $35 |
| Google Photo | $7 |
| **Total per click** | **~$0.042** |

Google gives $200/month free credit = ~4,750 clicks/month.

### Estimated monthly costs at scale

| Daily active users | Clicks/day (5 per user) | Monthly cost (after $200 credit) |
|---|---|---|
| 30 | 150 | $0 (free tier) |
| 100 | 500 | $430 |
| 200 | 1,000 | $1,060 |
| 600 | 3,000 | $3,580 |

---

## Freemium Model

### Free tier
- Venue details (image, reviews, rating, hours) only available near user's current GPS location
- Clicking venues in remote areas (via "search this area" on a different part of the map) shows basic info only (name, category) — no API-fetched details
- This feels natural since the core use case is local exploration
- Implementation: compare venue coords to user's geolocation, block detail fetch if distance exceeds a threshold

### Paid tier ($2-3/mo or ~$20/yr)
- Unlimited venue details anywhere on the map
- Stripe checkout + simple auth (magic link email)
- 50 paid users at $3/mo = $150/mo revenue

---

## Aggressive Caching

Caching alone can reduce API costs by 80-90%.

### Client-side cache
- localStorage keyed by place ID
- Reduces repeat clicks on same venue per user
- No backend needed

### Shared server-side cache (the big win)
- Cloudflare Worker + KV store
- If 50 users click the same popular bar, that's 1 API call instead of 50
- TTL of 6-24 hours (venue details don't change frequently)
- Also solves the Foursquare CORS problem — one proxy handles both caching + CORS

### Cost impact of caching

| Scenario (500 daily users, 5 clicks each) | Daily API calls | Monthly cost |
|---|---|---|
| No caching, no cap | 2,500 | $3,150 |
| Free tier location gating | ~2,000 | $2,520 |
| + client cache (~30% reduction) | ~1,400 | $1,764 |
| + shared server cache (~80% reduction) | ~280 | $353 |
| + 50 paid users at $3/mo | — | $353 - $150 = $203 |

---

## Safety Net: Hard Quota Cap

Set a daily request limit in Google Cloud Console so the bill can never exceed a chosen amount. The API stops responding after the cap — no surprise charges.

- Google Cloud Console > APIs & Services > Quotas
- Set budget alerts at $200 (free credit exhausted) and at your max spend

---

## What Needs to Be Built (when the time comes)

1. **Serverless proxy with KV cache** (Cloudflare Worker) — handles Foursquare CORS + shared caching in one service
2. **Location-based gating logic** in App.jsx — compare venue coords to user's geolocation, block detail fetch if too far for free tier
3. **Stripe checkout + lightweight auth** for paid tier
4. **Google Cloud budget alerts + quota caps** as a safety net
