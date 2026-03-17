import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Users, Database, DollarSign, Settings, Ticket } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  
  if (!user?.is_admin) {
    return <div className="p-8 text-center text-red-500">{t('admin.access_denied')}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-white">{t('admin.dashboard_title')}</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link to="/admin/users" className="bg-gray-800 border border-gray-700 p-6 rounded-xl hover:bg-gray-750 hover:border-blue-500/50 transition-all group">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-xl text-white">{t('admin.user_management')}</h3>
            </div>
          </div>
          <p className="text-gray-400">{t('admin.user_management_desc')}</p>
        </Link>
        
        <Link to="/admin/models" className="bg-gray-800 border border-gray-700 p-6 rounded-xl hover:bg-gray-750 hover:border-green-500/50 transition-all group">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
              <Database className="w-8 h-8 text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-xl text-white">{t('admin.models_providers')}</h3>
            </div>
          </div>
          <p className="text-gray-400">{t('admin.models_providers_desc')}</p>
        </Link>
        
        <Link to="/admin/transactions" className="bg-gray-800 border border-gray-700 p-6 rounded-xl hover:bg-gray-750 hover:border-purple-500/50 transition-all group">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-xl text-white">{t('admin.transactions')}</h3>
            </div>
          </div>
          <p className="text-gray-400">{t('admin.transactions_desc')}</p>
        </Link>

        <Link to="/admin/invitation-codes" className="bg-gray-800 border border-gray-700 p-6 rounded-xl hover:bg-gray-750 hover:border-yellow-500/50 transition-all group">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
              <Ticket className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h3 className="font-semibold text-xl text-white">{t('admin.invitation_codes')}</h3>
            </div>
          </div>
          <p className="text-gray-400">{t('admin.invitation_codes_desc')}</p>
        </Link>

        <Link to="/admin/config" className="bg-gray-800 border border-gray-700 p-6 rounded-xl hover:bg-gray-750 hover:border-orange-500/50 transition-all group">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
              <Settings className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-xl text-white">{t('admin.system_config')}</h3>
            </div>
          </div>
          <p className="text-gray-400">{t('admin.system_config_desc')}</p>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
