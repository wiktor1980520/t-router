import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Ticket, 
  Plus, 
  Trash2, 
  Loader2,
  X,
  Calendar,
  User as UserIcon,
  StickyNote
} from 'lucide-react';
import api from '../../lib/api';
import type { AxiosError } from 'axios';

interface InvitationCode {
  id: number;
  code: string;
  remark: string;
  created_by: string;
  created_at: string;
}

export default function InvitationCodesPage() {
  const { t } = useTranslation();
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [remark, setRemark] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const fetchCodes = async () => {
    try {
      setLoading(true);
      const response = await api.get<InvitationCode[]>('/admin/invitation-codes');
      setCodes(response.data);
    } catch (error) {
      console.error('Failed to fetch invitation codes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      setError('');
      await api.post('/admin/invitation-codes', { remark });
      setRemark('');
      setShowCreateModal(false);
      fetchCodes();
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ error?: string }>;
      setError(axiosErr.response?.data?.error || 'Failed to create invitation code');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('admin.confirm_delete_invitation'))) return;
    try {
      await api.delete(`/admin/invitation-codes/${id}`);
      fetchCodes();
    } catch (error) {
      console.error('Failed to delete invitation code:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Ticket className="w-8 h-8 text-yellow-400" />
            {t('admin.invitation_codes')}
          </h1>
          <p className="text-gray-400 mt-2">{t('admin.invitation_codes_desc')}</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          {t('admin.create_invitation')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : codes.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
          <Ticket className="w-12 h-12 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">{t('admin.no_invitation_codes')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {codes.map((code) => (
            <div key={code.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors relative group">
              <button
                onClick={() => handleDelete(code.id)}
                className="absolute top-4 right-4 text-gray-500 hover:text-red-500 transition-colors p-2"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <Ticket className="w-6 h-6 text-yellow-500" />
                </div>
                <span className="text-2xl font-mono font-bold text-white tracking-wider">
                  {code.code}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-2 text-sm text-gray-400">
                  <StickyNote className="w-4 h-4 mt-0.5 shrink-0" />
                  <span className="break-all">{code.remark || t('admin.no_remark')}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>{formatDate(code.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <UserIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">Admin ID: {code.created_by}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-800">
              <h3 className="text-xl font-semibold text-white">{t('admin.create_invitation')}</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  {t('admin.remark')}
                </label>
                <textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={t('admin.remark_placeholder')}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all h-32 resize-none"
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('common.confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
