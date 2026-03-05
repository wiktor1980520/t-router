import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Users as UsersIcon, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Eye, 
  ToggleLeft, 
  ToggleRight,
  Loader2
} from 'lucide-react';
import api from '../../lib/api';

interface User {
  id: string;
  email: string;
  phone?: string;
  balance: number;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  page_size: number;
}

export default function AdminUsers() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get<UsersResponse>(`/admin/users?page=${page}&page_size=${pageSize}`);
      setUsers(response.data.users);
      setTotal(response.data.total);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [page, pageSize]);

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    if (!window.confirm(currentStatus ? t('admin.confirm_disable') : t('admin.confirm_enable'))) return;
    
    try {
      await api.put(`/admin/users/${userId}/status`, { is_active: !currentStatus });
      fetchUsers(); // Refresh list
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      alert(t('admin.error_update_status'));
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  // Simple client-side search for now as backend doesn't support search yet
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (user.phone && user.phone.includes(searchTerm)) ||
    user.id.includes(searchTerm)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UsersIcon className="w-6 h-6" />
          {t('admin.user_management')}
        </h1>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.search_users')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="text-sm text-gray-400">
            {t('admin.total_users')}: {total}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-400">
            <thead className="bg-gray-900/50 text-gray-300 uppercase font-medium">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">{t('admin.email_phone')}</th>
                <th className="px-6 py-4">{t('admin.balance')}</th>
                <th className="px-6 py-4">{t('common.status')}</th>
                <th className="px-6 py-4">{t('common.created_at')}</th>
                <th className="px-6 py-4 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t('common.no_data')}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-500 truncate max-w-[100px]" title={user.id}>
                      {user.id.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{user.email}</div>
                      {user.phone && <div className="text-xs text-gray-500">{user.phone}</div>}
                      {user.is_admin && <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded ml-2">{t('common.admin_role')}</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-white">
                      ${user.balance.toFixed(2)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {user.is_active ? t('common.active') : t('common.disabled')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end gap-2">
                      <Link 
                        to={`/admin/users/${user.id}`}
                        className="p-2 hover:bg-gray-700 rounded-lg text-blue-400 hover:text-blue-300 transition-colors"
                        title={t('admin.user_detail')}
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleToggleStatus(user.id, user.is_active)}
                        className={`p-2 hover:bg-gray-700 rounded-lg transition-colors ${
                          user.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                        }`}
                        title={user.is_active ? t('admin.disable_user') : t('admin.enable_user')}
                      >
                        {user.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-700 flex justify-between items-center">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="p-2 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-400"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-gray-400">
            Page {page} of {totalPages || 1}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="p-2 hover:bg-gray-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-gray-400"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}