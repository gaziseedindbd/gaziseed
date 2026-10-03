import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type CountryCode = 'BD' | 'IN';

type MetaAdsConfig = {
  countryCode: CountryCode;
  accountId: string;
  campaignIds: string[];
  accessToken: string;
  graphVersion: string;
};

type MetaAdsInsightRow = {
  date_start?: string;
  date_stop?: string;
  account_id?: string;
  account_name?: string;
  account_currency?: string;
  campaign_id?: string;
  campaign_name?: string;
  impressions?: string | number;
  clicks?: string | number;
  spend?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  actions?: Array<{ action_type?: string; value?: string | number }>;
  action_values?: Array<{ action_type?: string; value?: string | number }>;
};

function getAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server configuration is incomplete');

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function envCampaignIds(countryCode: CountryCode): string[] {
  const key = countryCode === 'IN'
    ? 'META_ADS_CAMPAIGN_IDS_IN'
    : 'META_ADS_CAMPAIGN_IDS_BD';
  return (process.env[key] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeAccountId(value: string): string {
  return value.trim().replace(/^act_/i, '');
}

function getConfig(countryCode: CountryCode): MetaAdsConfig | null {
  const accountKey = countryCode === 'IN'
    ? 'META_ADS_ACCOUNT_ID_IN'
    : 'META_ADS_ACCOUNT_ID_BD';
  const accountId = normalizeAccountId(process.env[accountKey] || '');
  const accessToken = process.env.META_ADS_ACCESS_TOKEN?.trim() || '';
  if (!accountId || !accessToken) return null;

  return {
    countryCode,
    accountId,
    campaignIds: envCampaignIds(countryCode),
    accessToken,
    graphVersion: process.env.META_ADS_GRAPH_VERSION?.trim() || 'v26.0',
  };
}

function assertBranchIsolation(configs: MetaAdsConfig[]) {
  const bd = configs.find((config) => config.countryCode === 'BD');
  const inBranch = configs.find((config) => config.countryCode === 'IN');
  if (!bd || !inBranch) return;

  if (bd.accountId !== inBranch.accountId) return;

  const bdIds = new Set(bd.campaignIds);
  const overlap = inBranch.campaignIds.filter((id) => bdIds.has(id));
  if (!bd.campaignIds.length || !inBranch.campaignIds.length || overlap.length) {
    throw new Error(
      'Meta Ads branch isolation requires distinct ad accounts or explicit non-overlapping campaign ID filters for BD and IN.',
    );
  }
}

async function metaGet(
  config: MetaAdsConfig,
  path: string,
  params: Record<string, string>,
): Promise<any> {
  const url = new URL(
    'https://graph.facebook.com/' +
      config.graphVersion +
      '/' +
      path.replace(/^\//, ''),
  );
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set('access_token', config.accessToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        'Meta Ads API ' +
          response.status +
          ': ' +
          (typeof body?.error?.message === 'string' ? body.error.message : JSON.stringify(body)),
      );
    }
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCampaignInsights(
  config: MetaAdsConfig,
  since: string,
  until: string,
): Promise<MetaAdsInsightRow[]> {
  const fields = [
    'date_start',
    'date_stop',
    'account_id',
    'account_name',
    'account_currency',
    'campaign_id',
    'campaign_name',
    'impressions',
    'clicks',
    'spend',
    'ctr',
    'cpc',
    'actions',
    'action_values',
  ].join(',');

  const params: Record<string, string> = {
    level: 'campaign',
    time_increment: '1',
    time_range: JSON.stringify({ since, until }),
    fields,
    limit: '500',
    action_report_time: 'conversion',
  };

  if (config.campaignIds.length) {
    params.filtering = JSON.stringify([
      {
        field: 'campaign.id',
        operator: 'IN',
        value: config.campaignIds,
      },
    ]);
  }

  const rows: MetaAdsInsightRow[] = [];
  let nextPath = 'act_' + config.accountId + '/insights';
  let nextParams: Record<string, string> | null = params;

  while (nextPath) {
    const page = await metaGet(config, nextPath, nextParams || {});
    if (Array.isArray(page?.data)) rows.push(...(page.data as MetaAdsInsightRow[]));

    const next = page?.paging?.next;
    if (!next) break;

    const nextUrl = new URL(next);
    const relative = nextUrl.pathname.replace('/' + config.graphVersion + '/', '');
    nextPath = relative;
    nextParams = {};
    nextUrl.searchParams.forEach((value, key) => {
      if (key !== 'access_token') nextParams![key] = value;
    });
  }

  return rows;
}

function numberValue(value: string | number | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionMetric(
  actions: MetaAdsInsightRow['actions'],
  preferredTypes: string[],
): number {
  const rows = Array.isArray(actions) ? actions : [];
  for (const type of preferredTypes) {
    const match = rows.find((row) => row?.action_type === type);
    if (match) return numberValue(match.value);
  }

  const purchase = rows.find((row) =>
    String(row?.action_type || '').toLowerCase().includes('purchase'),
  );
  return purchase ? numberValue(purchase.value) : 0;
}

const PURCHASE_ACTION_TYPES = [
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
  'purchase',
  'omni_purchase',
  'offsite_conversion.purchase',
];

function mapInsight(row: MetaAdsInsightRow, countryCode: CountryCode, configuredAccountId: string): Record<string, unknown> | null {
  const impressions = Math.max(0, Math.round(numberValue(row.impressions)));
  const clicks = Math.max(0, Math.round(numberValue(row.clicks)));
  const spend = Math.max(0, numberValue(row.spend));
  const purchases = Math.max(0, actionMetric(row.actions, PURCHASE_ACTION_TYPES));
  const purchaseValue = Math.max(0, actionMetric(row.action_values, PURCHASE_ACTION_TYPES));
  const ctr = numberValue(row.ctr) || (impressions > 0 ? (clicks / impressions) * 100 : 0);
  const cpc = numberValue(row.cpc) || (clicks > 0 ? spend / clicks : 0);
  const purchaseRoas = spend > 0 ? purchaseValue / spend : 0;

  if (!row.campaign_id || !row.date_start || !row.date_stop) return null;

  return {
    country_code: countryCode,
    ad_account_id: normalizeAccountId(row.account_id || configuredAccountId),
    account_name: row.account_name || null,
    account_currency: row.account_currency || null,
    date_start: row.date_start,
    date_stop: row.date_stop,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name || '',
    impressions,
    clicks,
    spend,
    ctr,
    cpc,
    purchases,
    purchase_value: purchaseValue,
    purchase_roas: purchaseRoas,
    actions: Array.isArray(row.actions) ? row.actions : [],
    action_values: Array.isArray(row.action_values) ? row.action_values : [],
    fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function upsertRows(
  admin: SupabaseClient,
  rows: Array<Record<string, unknown>>,
): Promise<number> {
  if (!rows.length) return 0;
  let total = 0;
  for (let index = 0; index < rows.length; index += 100) {
    const chunk = rows.slice(index, index + 100);
    const { error } = await admin
      .from('meta_ads_insights_daily')
      .upsert(chunk, {
        onConflict: 'country_code,ad_account_id,date_start,date_stop,campaign_id',
      });
    if (error) throw error;
    total += chunk.length;
  }
  return total;
}

export async function syncMetaAdsInsights(days = 30): Promise<{
  processed_branches: string[];
  rows_upserted: number;
  errors: Array<{ country_code: CountryCode; message: string }>;
}> {
  const admin = getAdminClient();
  const configs = (['BD', 'IN'] as CountryCode[])
    .map(getConfig)
    .filter((config): config is MetaAdsConfig => Boolean(config));

  assertBranchIsolation(configs);

  const processedBranches: string[] = [];
  const errors: Array<{ country_code: CountryCode; message: string }> = [];
  let rowsUpserted = 0;

  const untilDate = new Date();
  untilDate.setUTCDate(untilDate.getUTCDate() - 1);
  const sinceDate = new Date(untilDate);
  sinceDate.setUTCDate(sinceDate.getUTCDate() - Math.max(1, days - 1));

  const until = untilDate.toISOString().slice(0, 10);
  const since = sinceDate.toISOString().slice(0, 10);

  for (const config of configs) {
    try {
      const rawRows = await fetchCampaignInsights(config, since, until);
      const mapped = rawRows
        .map((row) => mapInsight(row, config.countryCode, config.accountId))
        .filter((row): row is Record<string, unknown> => Boolean(row));

      rowsUpserted += await upsertRows(admin, mapped);
      processedBranches.push(config.countryCode);
    } catch (error) {
      errors.push({
        country_code: config.countryCode,
        message: error instanceof Error ? error.message : 'Meta Ads sync failed',
      });
    }
  }

  return {
    processed_branches: processedBranches,
    rows_upserted: rowsUpserted,
    errors,
  };
}

export async function getMetaAdsAiContext(
  countryCode: CountryCode,
  days = 30,
): Promise<{
  configured: boolean;
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    ctr: number;
    cpc: number;
    purchase_roas: number;
  };
  by_campaign: Array<{
    campaign_id: string;
    campaign_name: string;
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    ctr: number;
    cpc: number;
    purchase_roas: number;
    currency: string | null;
  }>;
  data_note: string;
}> {
  const accountKey = countryCode === 'IN'
    ? 'META_ADS_ACCOUNT_ID_IN'
    : 'META_ADS_ACCOUNT_ID_BD';
  const configured = Boolean(
    normalizeAccountId(process.env[accountKey] || '') &&
    process.env.META_ADS_ACCESS_TOKEN?.trim(),
  );
  if (!configured) {
    return {
      configured: false,
      summary: { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0, ctr: 0, cpc: 0, purchase_roas: 0 },
      by_campaign: [],
      data_note: 'Meta Ads Insights API is not configured for this branch. Do not invent ads metrics.',
    };
  }

  const admin = getAdminClient();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.max(1, days));
  const { data, error } = await admin
    .from('meta_ads_insights_daily')
    .select('campaign_id,campaign_name,account_currency,impressions,clicks,spend,purchases,purchase_value')
    .eq('country_code', countryCode)
    .gte('date_start', since.toISOString().slice(0, 10))
    .order('date_start', { ascending: false })
    .limit(5000);
  if (error) throw error;

  const byCampaign = new Map<string, {
    campaign_id: string;
    campaign_name: string;
    spend: number;
    impressions: number;
    clicks: number;
    purchases: number;
    purchase_value: number;
    currency: string | null;
  }>();

  for (const row of data || []) {
    const key = String(row.campaign_id);
    const current = byCampaign.get(key) || {
      campaign_id: key,
      campaign_name: String(row.campaign_name || ''),
      spend: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      purchase_value: 0,
      currency: row.account_currency || null,
    };
    current.spend += numberValue(row.spend);
    current.impressions += numberValue(row.impressions);
    current.clicks += numberValue(row.clicks);
    current.purchases += numberValue(row.purchases);
    current.purchase_value += numberValue(row.purchase_value);
    byCampaign.set(key, current);
  }

  const campaigns = Array.from(byCampaign.values()).map((row) => ({
    ...row,
    ctr: row.impressions > 0 ? (row.clicks / row.impressions) * 100 : 0,
    cpc: row.clicks > 0 ? row.spend / row.clicks : 0,
    purchase_roas: row.spend > 0 ? row.purchase_value / row.spend : 0,
  })).sort((a, b) => b.purchase_value - a.purchase_value);

  const totals = campaigns.reduce(
    (acc, row) => ({
      spend: acc.spend + row.spend,
      impressions: acc.impressions + row.impressions,
      clicks: acc.clicks + row.clicks,
      purchases: acc.purchases + row.purchases,
      purchase_value: acc.purchase_value + row.purchase_value,
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0 },
  );

  if (!campaigns.length) {
    return {
      configured: true,
      summary: { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0, ctr: 0, cpc: 0, purchase_roas: 0 },
      by_campaign: [],
      data_note: 'Meta Ads is configured, but no synced campaign insights are available for this branch yet.',
    };
  }

  return {
    configured: true,
    summary: {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      purchase_roas: totals.spend > 0 ? totals.purchase_value / totals.spend : 0,
    },
    by_campaign: campaigns,
    data_note: 'Spend, impressions, clicks, CPC, CTR and Meta-attributed purchase value are sourced from Meta Ads Insights API. Purchase ROAS is calculated as Meta-attributed purchase value divided by ad spend. It is not a claim about profitability and does not include non-Meta costs unless supplied separately.',
  };
}
