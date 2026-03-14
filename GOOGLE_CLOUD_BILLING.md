# Google Cloud API Billing & Quota Management

## Free Credit
- Google provides **$200/month** free credit for Maps/Places APIs
- Billing dashboard shows `$0.00 / $200.00` until you exceed the credit
- Billing updates with a **24-48 hour delay** — recent usage won't show immediately

## Checking Usage
1. Go to **Billing → Reports**
2. Set date range to "Last 30 days"
3. Shows a breakdown by API and actual request counts

## Setting a Daily Quota (Hard Request Cap)
1. Go to **APIs & Services → Places API (New) → Quotas**
2. Find **SearchTextRequest per day** (the one City Quest actually uses)
3. Click the pencil/edit icon
4. Set value to **190** — this is the max daily requests that keeps monthly cost just under $200
   - Calculation: $200/month ÷ 30 days = ~$6.67/day ÷ $0.035/request = ~190 requests/day
5. Confirm the override warning (it's just a warning about reducing from the 75,000 default — safe to ignore)

## Setting a Budget Alert (Billing Notifications)
1. Go to **Billing → Budgets & alerts**
2. Create a new budget for your project
3. Set monthly amount to **$200**
4. Add alert thresholds at 50%, 90%, 100%
5. Optionally enable **"Link to a budget action"** to auto-disable billing when threshold is hit (true hard stop)

## Restricting the API Key
1. Go to **APIs & Services → Credentials → your key → Edit**
2. Under **API restrictions**: limit to Places API (New) only
3. Under **Application restrictions**: keep HTTP referrer restrictions
   - `julian-reyes.github.io/*`
   - `julianreyes.dev/*`
   - `localhost:5174/*`

## Pricing Reference
The app uses **Text Search (Advanced SKU)** because it requests advanced fields (rating, priceLevel, currentOpeningHours).

| SKU | Price per 1,000 requests | Per request |
|-----|--------------------------|-------------|
| Basic (id, address, location) | $32 | $0.032 |
| Advanced (rating, priceLevel, hours) | $35 | **$0.035** |
| Preferred (reviews, photos) | $40 | $0.040 |

### Cost Examples at Different Quotas
- 190 requests/day × $0.035 = ~$6.65/day → ~**$199/month** (just under free credit)
- 100 requests/day × $0.035 = ~$3.50/day → ~$105/month
- 20 requests/day × $0.035 = ~$0.70/day → ~$21/month

## Current Setup
- Daily quota set to **190 requests/day** (SearchTextRequest)
- API key restricted to HTTP referrers listed above
- App requests fields: `rating, userRatingCount, priceLevel, currentOpeningHours, formattedAddress, location`
