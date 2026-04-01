import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { Plus, Trash2, Loader2, X, Gift } from 'lucide-react';

interface Plan {
  id: number;
  name: string;
  monthly_price: number;
  monthly_quota: number;
  allowed_models?: string[];
  rate_limit: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminSubscriptionPlans() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    monthly_price: 0,
    monthly_quota: 0,
    allowed_models: '',
    rate_limit: 0,
    is_active: true,
  });

  const [showGrant, setShowGrant] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grant, setGrant] = useState({ user_id: '', plan_id: 0, months: 1, auto_renew: false });

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Plan[]>('/admin/subscription-plans');
      setPlans(res.data);
      setGrant((g) => (g.plan_id === 0 && res.data.length > 0 ? { ...g, plan_id: res.data[0].id } : g));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const createPlan = async () => {
    try {
      setCreating(true);
      const allowed = newPlan.allowed_models
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await api.post('/admin/subscription-plans', {
        name: newPlan.name,
        monthly_price: Number(newPlan.monthly_price) || 0,
        monthly_quota: Number(newPlan.monthly_quota) || 0,
        allowed_models: allowed,
        rate_limit: Number(newPlan.rate_limit) || 0,
        is_active: !!newPlan.is_active,
      });
      setShowCreate(false);
      setNewPlan({ name: '', monthly_price: 0, monthly_quota: 0, allowed_models: '', rate_limit: 0, is_active: true });
      fetchPlans();
    } finally {
      setCreating(false);
    }
  };

  const deletePlan = async (id: number) => {
    if (!window.confirm(t('admin.confirm_delete_subscription_plan'))) return;
    await api.delete(`/admin/subscription-plans/${id}`);
    fetchPlans();
  };

  const grantSubscription = async () => {
    try {
      setGranting(true);
      await api.post('/admin/subscriptions/grant', {
        user_id: grant.user_id,
        plan_id: grant.plan_id,
        months: grant.months,
        auto_renew: grant.auto_renew,
      });
      setShowGrant(false);
      setGrant({ user_id: '', plan_id: grant.plan_id, months: 1, auto_renew: false });
      alert(t('admin.subscription_granted'));
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('admin.subscription_plans')}</h1>
          <p className="text-gray-400 mt-2">{t('admin.subscription_plans_desc')}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGrant(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Gift className="w-5 h-5" />
            {t('admin.grant_subscription')}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            {t('admin.create_subscription_plan')}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-950">
                <tr className="text-left text-gray-400">
                  <th className="px-6 py-3">{t('admin.plan_name')}</th>
                  <th className="px-6 py-3">{t('admin.monthly_price')}</th>
                  <th className="px-6 py-3">{t('admin.monthly_quota')}</th>
                  <th className="px-6 py-3">{t('admin.rate_limit')}</th>
                  <th className="px-6 py-3">{t('admin.active')}</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {plans.map((p) => (
                  <tr key={p.id} className="text-gray-200">
                    <td className="px-6 py-3 font-medium">{p.name}</td>
                    <td className="px-6 py-3">¥{Number(p.monthly_price).toFixed(2)}</td>
                    <td className="px-6 py-3">¥{Number(p.monthly_quota).toFixed(2)}</td>
                    <td className="px-6 py-3">{p.rate_limit || '-'}</td>
                    <td className="px-6 py-3">{p.is_active ? t('admin.active') : t('admin.inactive')}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => deletePlan(p.id)}
                        className="text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && (
                  <tr>
                    <td className="px-6 py-6 text-center text-gray-500" colSpan={6}>
                      {t('admin.no_data')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-white">{t('admin.create_subscription_plan')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.plan_name')}</label>
                <input
                  value={newPlan.name}
                  onChange={(e) => setNewPlan((p) => ({ ...p, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.monthly_price')}</label>
                  <input
                    type="number"
                    value={newPlan.monthly_price}
                    onChange={(e) => setNewPlan((p) => ({ ...p, monthly_price: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.monthly_quota')}</label>
                  <input
                    type="number"
                    value={newPlan.monthly_quota}
                    onChange={(e) => setNewPlan((p) => ({ ...p, monthly_quota: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.rate_limit')}</label>
                  <input
                    type="number"
                    value={newPlan.rate_limit}
                    onChange={(e) => setNewPlan((p) => ({ ...p, rate_limit: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                  />
                </div>
                <div className="flex items-center gap-2 mt-7">
                  <input
                    type="checkbox"
                    checked={newPlan.is_active}
                    onChange={(e) => setNewPlan((p) => ({ ...p, is_active: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-300">{t('admin.active')}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.allowed_models')}</label>
                <input
                  value={newPlan.allowed_models}
                  onChange={(e) => setNewPlan((p) => ({ ...p, allowed_models: e.target.value }))}
                  placeholder={t('admin.allowed_models_placeholder')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={createPlan}
                  disabled={creating || !newPlan.name.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGrant && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-white">{t('admin.grant_subscription')}</h3>
              <button onClick={() => setShowGrant(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.user_id')}</label>
                <input
                  value={grant.user_id}
                  onChange={(e) => setGrant((g) => ({ ...g, user_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.plan')}</label>
                  <select
                    value={grant.plan_id}
                    onChange={(e) => setGrant((g) => ({ ...g, plan_id: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">{t('admin.months')}</label>
                  <input
                    type="number"
                    value={grant.months}
                    onChange={(e) => setGrant((g) => ({ ...g, months: Number(e.target.value) }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={grant.auto_renew}
                  onChange={(e) => setGrant((g) => ({ ...g, auto_renew: e.target.checked }))}
                />
                <span className="text-sm text-gray-300">{t('admin.auto_renew')}</span>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowGrant(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={grantSubscription}
                  disabled={granting || !grant.user_id.trim() || grant.plan_id === 0}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {granting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

