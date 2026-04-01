import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../lib/api';
import { Plus, Users, Loader2, X, Download } from 'lucide-react';

type OrgRow = {
  id: string;
  name: string;
  owner_id: string;
  monthly_budget: number;
  is_active: boolean;
  role: string;
};

type OrgDetail = {
  org: {
    id: string;
    name: string;
    owner_id: string;
    monthly_budget: number;
    is_active: boolean;
  };
  members: Array<{ user_id: string; email: string; role: string }>;
  period: string;
  spent: number;
};

export default function TeamPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [orgs, setOrgs] = useState<OrgRow[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', monthly_budget: 0 });

  const [selectedOrg, setSelectedOrg] = useState<OrgDetail | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get<OrgRow[]>('/team');
      setOrgs(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createOrg = async () => {
    try {
      setCreating(true);
      await api.post('/team', { name: newOrg.name, monthly_budget: Number(newOrg.monthly_budget) || 0 });
      setShowCreate(false);
      setNewOrg({ name: '', monthly_budget: 0 });
      load();
    } finally {
      setCreating(false);
    }
  };

  const openOrg = async (id: string) => {
    try {
      setLoadingOrg(true);
      const res = await api.get<OrgDetail>(`/team/${id}`);
      setSelectedOrg(res.data);
    } finally {
      setLoadingOrg(false);
    }
  };

  const exportCsv = async (orgId: string) => {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = new Date().toISOString().slice(0, 10);
    const res = await api.get(`/team/${orgId}/audit_logs/export`, {
      params: { from: fromStr, to: toStr },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `org_audit_logs_${orgId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-cyan-400" />
            {t('team.title')}
          </h1>
          <p className="text-gray-400 mt-2">{t('team.desc')}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('team.create')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orgs.map((o) => (
            <button
              key={o.id}
              onClick={() => openOrg(o.id)}
              className="text-left bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-cyan-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-semibold">{o.name}</div>
                <div className="text-xs text-gray-400">{o.role}</div>
              </div>
              <div className="mt-2 text-sm text-gray-400">
                {t('team.monthly_budget')}
                {t('common.colon', { defaultValue: '：' })}
                <span className="text-gray-200">¥{Number(o.monthly_budget || 0).toFixed(2)}</span>
              </div>
            </button>
          ))}
          {orgs.length === 0 && <div className="text-gray-500">{t('team.empty')}</div>}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-white">{t('team.create')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('team.name')}</label>
                <input
                  value={newOrg.name}
                  onChange={(e) => setNewOrg((v) => ({ ...v, name: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">{t('team.monthly_budget')}</label>
                <input
                  type="number"
                  value={newOrg.monthly_budget}
                  onChange={(e) => setNewOrg((v) => ({ ...v, monthly_budget: Number(e.target.value) }))}
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
                  onClick={createOrg}
                  disabled={creating || !newOrg.name.trim()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('common.confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedOrg && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedOrg.org.name}</h3>
                <div className="text-sm text-gray-400 mt-1">
                  {t('team.period')}
                  {t('common.colon', { defaultValue: '：' })}
                  {selectedOrg.period}
                  {'  '}
                  {t('team.spent')}
                  {t('common.colon', { defaultValue: '：' })}
                  ¥{Number(selectedOrg.spent || 0).toFixed(2)}
                </div>
              </div>
              <button onClick={() => setSelectedOrg(null)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-white font-semibold">{t('team.members')}</div>
                <button
                  onClick={() => exportCsv(selectedOrg.org.id)}
                  className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {t('team.export')}
                </button>
              </div>
              {loadingOrg ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : (
                <div className="border border-gray-800 rounded-xl overflow-hidden">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-950">
                      <tr className="text-left text-gray-400">
                        <th className="px-4 py-3">{t('team.email')}</th>
                        <th className="px-4 py-3">{t('team.role')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {selectedOrg.members.map((m) => (
                        <tr key={m.user_id} className="text-gray-200">
                          <td className="px-4 py-3">{m.email}</td>
                          <td className="px-4 py-3">{m.role}</td>
                        </tr>
                      ))}
                      {selectedOrg.members.length === 0 && (
                        <tr>
                          <td className="px-4 py-6 text-center text-gray-500" colSpan={2}>
                            {t('admin.no_data')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

