import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { BarChart3, Loader2 } from 'lucide-react';

type Overview = {
  days: number;
  total_users: number;
  new_users: number;
  active_users: number;
  calls: number;
  successful_calls: number;
  success_rate: number;
  tokens: number;
  recharge_amount: number;
  consumption_amount: number;
  provider_cost: number;
  gross_profit: number;
  gross_margin: number;
  top_models: Array<{
    model: string;
    calls: number;
    tokens: number;
    revenue: number;
    provider_cost: number;
    profit: number;
    avg_latency_ms: number;
  }>;
};

type InvitationMetrics = {
  days: number;
  items: Array<{
    code: string;
    remark: string;
    registrations: number;
    activated_users: number;
    recharged_users: number;
    recharge_amount: number;
    consumption_amount: number;
  }>;
};

const formatMoney = (v: number) => {
  if (!Number.isFinite(v)) return '-';
  return `¥${v.toFixed(2)}`;
};

const formatPercent = (v: number) => {
  if (!Number.isFinite(v)) return '-';
  return `${(v * 100).toFixed(2)}%`;
};

export default function AdminAnalyticsPage() {
  const { t } = useTranslation();
  const [days, setDays] = useState(7);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [invites, setInvites] = useState<InvitationMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const daysOptions = useMemo(() => [1, 7, 30], []);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [o, i] = await Promise.all([
          api.get<Overview>('/admin/metrics/overview', { params: { days } }),
          api.get<InvitationMetrics>('/admin/metrics/invitations', { params: { days: Math.max(days, 7) } }),
        ]);
        if (canceled) return;
        setOverview(o.data);
        setInvites(i.data);
      } finally {
        if (!canceled) setLoading(false);
      }
    };
    load();
    return () => {
      canceled = true;
    };
  }, [days]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-cyan-400" />
            {t('admin.analytics')}
          </h1>
          <p className="text-gray-400 mt-2">{t('admin.analytics_desc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-gray-400">{t('admin.range_days')}</div>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white"
          >
            {daysOptions.map((d) => (
              <option key={d} value={d}>
                {d === 1 ? t('admin.range_today') : t('admin.range_last_days', { days: d })}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      )}

      {!loading && overview && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.total_users')}</div>
              <div className="text-2xl font-bold text-white mt-2">{overview.total_users}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.new_users')}</div>
              <div className="text-2xl font-bold text-white mt-2">{overview.new_users}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.active_users')}</div>
              <div className="text-2xl font-bold text-white mt-2">{overview.active_users}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.success_rate')}</div>
              <div className="text-2xl font-bold text-white mt-2">{formatPercent(overview.success_rate)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.recharge_amount')}</div>
              <div className="text-2xl font-bold text-green-400 mt-2">{formatMoney(overview.recharge_amount)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.consumption_amount')}</div>
              <div className="text-2xl font-bold text-yellow-400 mt-2">{formatMoney(overview.consumption_amount)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.provider_cost')}</div>
              <div className="text-2xl font-bold text-gray-200 mt-2">{formatMoney(overview.provider_cost)}</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="text-sm text-gray-400">{t('admin.gross_profit')}</div>
              <div className="text-2xl font-bold text-cyan-300 mt-2">{formatMoney(overview.gross_profit)}</div>
              <div className="text-xs text-gray-500 mt-2">
                {t('admin.gross_margin')}{t('common.colon', { defaultValue: '：' })}
                {formatPercent(overview.gross_margin)}
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-800">
              <div className="text-white font-semibold">{t('admin.top_models')}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-950">
                  <tr className="text-left text-gray-400">
                    <th className="px-6 py-3">{t('admin.model')}</th>
                    <th className="px-6 py-3">{t('admin.calls')}</th>
                    <th className="px-6 py-3">{t('admin.tokens')}</th>
                    <th className="px-6 py-3">{t('admin.revenue')}</th>
                    <th className="px-6 py-3">{t('admin.cost')}</th>
                    <th className="px-6 py-3">{t('admin.profit')}</th>
                    <th className="px-6 py-3">{t('admin.avg_latency')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {overview.top_models.map((m) => (
                    <tr key={m.model} className="text-gray-200">
                      <td className="px-6 py-3 font-mono">{m.model}</td>
                      <td className="px-6 py-3">{m.calls}</td>
                      <td className="px-6 py-3">{m.tokens}</td>
                      <td className="px-6 py-3">{formatMoney(m.revenue)}</td>
                      <td className="px-6 py-3">{formatMoney(m.provider_cost)}</td>
                      <td className="px-6 py-3">{formatMoney(m.profit)}</td>
                      <td className="px-6 py-3">{Math.round(m.avg_latency_ms)} ms</td>
                    </tr>
                  ))}
                  {overview.top_models.length === 0 && (
                    <tr>
                      <td className="px-6 py-6 text-center text-gray-500" colSpan={7}>
                        {t('admin.no_data')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && invites && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <div className="text-white font-semibold">{t('admin.invitation_metrics')}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-950">
                <tr className="text-left text-gray-400">
                  <th className="px-6 py-3">{t('admin.invitation_code')}</th>
                  <th className="px-6 py-3">{t('admin.remark')}</th>
                  <th className="px-6 py-3">{t('admin.registrations')}</th>
                  <th className="px-6 py-3">{t('admin.activated_users')}</th>
                  <th className="px-6 py-3">{t('admin.recharged_users')}</th>
                  <th className="px-6 py-3">{t('admin.recharge_amount')}</th>
                  <th className="px-6 py-3">{t('admin.consumption_amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {invites.items.map((it) => (
                  <tr key={it.code} className="text-gray-200">
                    <td className="px-6 py-3 font-mono">{it.code}</td>
                    <td className="px-6 py-3 text-gray-400">{it.remark || '-'}</td>
                    <td className="px-6 py-3">{it.registrations}</td>
                    <td className="px-6 py-3">{it.activated_users}</td>
                    <td className="px-6 py-3">{it.recharged_users}</td>
                    <td className="px-6 py-3">{formatMoney(it.recharge_amount)}</td>
                    <td className="px-6 py-3">{formatMoney(it.consumption_amount)}</td>
                  </tr>
                ))}
                {invites.items.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-center text-gray-500" colSpan={7}>
                      {t('admin.no_data')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

