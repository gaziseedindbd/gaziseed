import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type CountryCode = 'BD' | 'IN';
type InsightRow = {
  campaign_id: string;
  campaign_name: string | null;
  account_name: string | null;
  account_currency: string | null;
  date_start: string;
  impressions: number | string | null;
  clicks: number | string | null;
  spend: number | string | null;
  purchases: number | string | null;
  purchase_value: number | string | null;
  ctr: number | string | null;
  cpc: number | string | null;
  fetched_at: string;
};

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function numeric(value: number | string | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: Request) {
  try {
    const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
    if (!bearer) {
      return NextResponse.json({ ok: false, message: 'Authentication required' }, { status: 401 });
    }

    const admin = serviceClient();
    if (!admin) {
      return NextResponse.json({ ok: false, message: 'Server configuration incomplete' }, { status: 500 });
    }

    const { data: { user }, error: userError } = await admin.auth.getUser(bearer);
    if (userError || !user) {
      return NextResponse.json({ ok: false, message: 'Authentication required' }, { status: 401 });
    }

    const { data: adminRow, error: adminError } = await admin
      .from('admin_users')
      .select('user_id,role,country_code')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRow) {
      return NextResponse.json({ ok: false, message: 'Admin access required' }, { status: 403 });
    }

    let countryCode = String(adminRow.country_code || '').toUpperCase();
    if (adminRow.role === 'master_admin') {
      const { data: branchContext, error: branchError } = await admin
        .from('admin_branch_context')
        .select('country_code')
        .eq('user_id', user.id)
        .maybeSingle();
      if (branchError) throw branchError;
      countryCode = String(branchContext?.country_code || '').toUpperCase();
    }

    if (countryCode !== 'IN' && countryCode !== 'BD') {
      return NextResponse.json({ ok: false, message: 'Unable to verify admin branch' }, { status: 403 });
    }

    const query = new URL(request.url).searchParams;
    const requestedDays = Number(query.get('days') || 30);
    const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - days);
    const sinceDate = since.toISOString().slice(0, 10);

    const accountEnv = countryCode === 'IN' ? 'META_ADS_ACCOUNT_ID_IN' : 'META_ADS_ACCOUNT_ID_BD';
    const accountConfigured = Boolean(
      (process.env[accountEnv] || '').trim() &&
      (process.env.META_ADS_ACCESS_TOKEN || '').trim(),
    );

    const { data, error } = await admin
      .from('meta_ads_insights_daily')
      .select('campaign_id,campaign_name,account_name,account_currency,date_start,impressions,clicks,spend,purchases,purchase_value,ctr,cpc,fetched_at')
      .eq('country_code', countryCode as CountryCode)
      .gte('date_start', sinceDate)
      .order('date_start', { ascending: false })
      .limit(5000);

    if (error) throw error;

    const rows = (data || []) as InsightRow[];
    const campaigns = new Map<string, {
      campaign_id: string;
      campaign_name: string;
      spend: number;
      impressions: number;
      clicks: number;
      purchases: number;
      purchase_value: number;
      currency: string | null;
    }>();
    let lastSyncedAt: string | null = null;

    for (const row of rows) {
      const current = campaigns.get(row.campaign_id) || {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name || 'Unnamed campaign',
        spend: 0,
        impressions: 0,
        clicks: 0,
        purchases: 0,
        purchase_value: 0,
        currency: row.account_currency || null,
      };
      current.spend += numeric(row.spend);
      current.impressions += numeric(row.impressions);
      current.clicks += numeric(row.clicks);
      current.purchases += numeric(row.purchases);
      current.purchase_value += numeric(row.purchase_value);
      campaigns.set(row.campaign_id, current);
      if (!lastSyncedAt || row.fetched_at > lastSyncedAt) lastSyncedAt = row.fetched_at;
    }

    const campaignRows = Array.from(campaigns.values())
      .map((campaign) => ({
        ...campaign,
        ctr: campaign.impressions > 0 ? (campaign.clicks / campaign.impressions) * 100 : 0,
        cpc: campaign.clicks > 0 ? campaign.spend / campaign.clicks : 0,
        purchase_roas: campaign.spend > 0 ? campaign.purchase_value / campaign.spend : 0,
      }))
      .sort((a, b) => b.spend - a.spend);

    const totals = campaignRows.reduce((sum, campaign) => ({
      spend: sum.spend + campaign.spend,
      impressions: sum.impressions + campaign.impressions,
      clicks: sum.clicks + campaign.clicks,
      purchases: sum.purchases + campaign.purchases,
      purchase_value: sum.purchase_value + campaign.purchase_value,
    }), { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0 });

    return NextResponse.json({
      ok: true,
      countryCode,
      days,
      configured: accountConfigured,
      syncEnabled: process.env.META_ADS_SYNC_ENABLED === 'true',
      lastSyncedAt,
      campaignCount: campaignRows.length,
      summary: {
        ...totals,
        ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
        cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
        purchase_roas: totals.spend > 0 ? totals.purchase_value / totals.spend : 0,
      },
      campaigns: campaignRows,
      currency: rows[0]?.account_currency || (countryCode === 'IN' ? 'INR' : 'BDT'),
    });
  } catch (error) {
    console.error('Admin Meta Ads report failed:', error);
    return NextResponse.json({ ok: false, message: 'Meta Ads report could not be loaded' }, { status: 500 });
  }
}
