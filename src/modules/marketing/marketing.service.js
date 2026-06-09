/**
 * Marketing Campaigns & Ad Analytics (V2.2 §6.15) — business logic.
 *
 * Ad accounts + campaigns + daily spend, plus the attribution report that ties
 * ad spend to actual sales: orders carry utm_campaign, so revenue is matched
 * to the ad campaign by name → ROAS. Connects marketing to the sales spine.
 */

"use strict";

const repo = require("./marketing.repo");
const events = require("./marketing.events");
const { audit } = require("../../middleware/audit");
const { money, toCurrencyString } = require("../../utils/money");
const { NotFoundError } = require("../../utils/errors");

const A = (
  brand,
  user,
  action_key,
  target_type,
  target_id,
  after,
  request_id,
) =>
  audit({
    business: brand,
    user_id: user ? user.user_id : null,
    action_key,
    target_type,
    target_id,
    after,
    request_id,
  });

// ── Ad accounts ────────────────────────────────────────────
function listAdAccounts({ brand }) {
  return repo.listAdAccounts({ brand });
}
async function connectAdAccount({ brand, user, request_id, input }) {
  const acc = await repo.createAdAccount({ brand, account: input });
  await A(
    brand,
    user,
    "marketing.ad_account.connect",
    "ad_account",
    acc.ad_account_id,
    { platform: input.platform },
    request_id,
  );
  return acc;
}
async function revokeAdAccount({ brand, user, request_id, id }) {
  const ok = await repo.deactivateAdAccount({ brand, id });
  if (!ok) throw new NotFoundError("Ad account");
  await A(
    brand,
    user,
    "marketing.ad_account.revoke",
    "ad_account",
    id,
    null,
    request_id,
  );
}

// ── Ad campaigns ───────────────────────────────────────────
function listAdCampaigns(args) {
  return repo.listAdCampaigns(args);
}
async function getAdCampaign({ brand, id }) {
  const c = await repo.getAdCampaign({ brand, id });
  if (!c) throw new NotFoundError("Ad campaign");
  return c;
}
async function createAdCampaign({ brand, user, request_id, input }) {
  const c = await repo.createAdCampaign({ brand, c: input });
  await A(
    brand,
    user,
    "marketing.ad_campaign.create",
    "ad_campaign",
    c.ad_campaign_id,
    { name: input.name },
    request_id,
  );
  events.emit("ad_campaign.created", {
    brand,
    ad_campaign_id: c.ad_campaign_id,
  });
  return c;
}
async function setAdCampaignStatus({ brand, user, request_id, id, status }) {
  const c = await repo.getAdCampaign({ brand, id });
  if (!c) throw new NotFoundError("Ad campaign");
  const updated = await repo.setAdCampaignStatus({ brand, id, status });
  await A(
    brand,
    user,
    "marketing.ad_campaign.status",
    "ad_campaign",
    id,
    { status },
    request_id,
  );
  return updated;
}

// ── Spend ──────────────────────────────────────────────────
async function recordSpend({ brand, user, request_id, id, input }) {
  const c = await repo.getAdCampaign({ brand, id });
  if (!c) throw new NotFoundError("Ad campaign");
  const row = await repo.recordSpend({
    ad_campaign_id: id,
    metric_date: input.metric_date || new Date().toISOString().slice(0, 10),
    s: input,
  });
  await A(
    brand,
    user,
    "marketing.spend.record",
    "ad_campaign",
    id,
    { metric_date: row.metric_date },
    request_id,
  );
  return row;
}

/**
 * Attribution report: ad spend per campaign joined to sales revenue by
 * utm_campaign (matched on campaign name), with ROAS.
 */
async function attributionReport({ brand, from, to }) {
  const [spend, sales] = await Promise.all([
    repo.adSpendSummary({ brand, from, to }),
    repo.salesByUtmCampaign({ brand, from, to }),
  ]);
  const salesByName = new Map();
  for (const s of sales) salesByName.set(s.utm_campaign, s);

  const rows = spend.map((sp) => {
    const matched = salesByName.get(sp.name);
    const revenue = money(matched ? matched.revenue_ngn : 0);
    const spendNgn = money(sp.spend_ngn);
    const roas = spendNgn.gt(0) ? revenue.dividedBy(spendNgn) : null;
    if (matched) salesByName.delete(sp.name);
    return {
      ad_campaign_id: sp.ad_campaign_id,
      campaign: sp.name,
      platform: sp.platform,
      spend_ngn: toCurrencyString(spendNgn),
      impressions: Number(sp.impressions),
      clicks: Number(sp.clicks),
      conversions: Number(sp.conversions),
      orders: matched ? matched.orders : 0,
      revenue_ngn: toCurrencyString(revenue),
      roas: roas ? Number(roas.toFixed(2)) : null,
    };
  });
  // utm_campaigns with sales but no matching ad campaign (organic / other).
  const unattributed = [...salesByName.values()].map((s) => ({
    campaign: s.utm_campaign,
    platform: null,
    spend_ngn: "0.00",
    orders: s.orders,
    revenue_ngn: toCurrencyString(money(s.revenue_ngn)),
    roas: null,
  }));

  return {
    period: { from: from || null, to: to || null },
    attributed: rows,
    unattributed,
  };
}

module.exports = {
  listAdAccounts,
  connectAdAccount,
  revokeAdAccount,
  listAdCampaigns,
  getAdCampaign,
  createAdCampaign,
  setAdCampaignStatus,
  recordSpend,
  attributionReport,
};
