# Meta Ads Insights API setup

GAZI SEED can enrich the AI Business, Sales, Marketing and Facebook/Instagram Ads assistants with first-party Meta Ads Insights API data.

## Required Vercel environment variables

- `META_ADS_ACCESS_TOKEN`: Meta Marketing API access token with the permissions required to read Ads Insights for the configured ad account(s).
- `META_ADS_ACCOUNT_ID_BD`: BD ad account ID. The optional `act_` prefix is accepted.
- `META_ADS_ACCOUNT_ID_IN`: IN ad account ID. The optional `act_` prefix is accepted.
- `META_ADS_CAMPAIGN_IDS_BD`: optional comma-separated campaign IDs when BD and IN share one ad account.
- `META_ADS_CAMPAIGN_IDS_IN`: optional comma-separated campaign IDs when BD and IN share one ad account.
- `META_ADS_GRAPH_VERSION`: optional Graph API version; defaults to `v26.0`.

## Branch isolation

The worker treats BD and IN as separate data scopes.

- Separate ad accounts are the cleanest configuration.
- When the same ad account is used for both branches, both branches must have explicit, non-overlapping campaign ID allowlists.
- The worker rejects an unsafe same-account configuration that could mix countries.

## What is stored

A service-role-only `meta_ads_insights_daily` table stores one campaign/day snapshot with:

- spend
- impressions
- clicks
- CTR
- CPC
- Meta-attributed purchase actions
- Meta-attributed purchase value
- calculated purchase ROAS
- raw `actions` and `action_values` payloads

The worker re-syncs the most recent 30 days each day so delayed attribution can update existing rows.

## AI behavior

AI context includes campaign-level and account-level Meta Ads metrics for the selected branch. AI must not invent ad data when the API is not configured or the table has no synced rows.

Purchase ROAS is calculated as:

`Meta-attributed purchase value / Meta ad spend`

It is not a profitability metric and does not include non-Meta costs.

The integration uses the Meta Marketing API Insights endpoint at the campaign level with daily time increments. The requested fields are based on the current Meta Marketing API Insights model and include spend, impressions, clicks, CTR, CPC, actions and action values.
