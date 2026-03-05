import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Key, CreditCard, LogOut, Settings, Menu, X, Database, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

const Layout = () => {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigation = [
    { name: t('nav.dashboard'), href: '/dashboard', icon: LayoutDashboard },
    { name: t('nav.models'), href: '/dashboard/models', icon: Database },
    { name: t('nav.api_keys'), href: '/dashboard/keys', icon: Key },
    { name: t('nav.billing'), href: '/dashboard/billing', icon: CreditCard },
    { name: t('nav.settings'), href: '/dashboard/settings', icon: Settings },
  ];

  if (user?.is_admin) {
    navigation.push({ name: t('nav.admin'), href: '/admin', icon: ShieldCheck });
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 border-b border-gray-800 flex items-center px-4 z-30 justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">T</div>
          <span className="font-bold text-lg">TRouter</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
          className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-800"
        >
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={clsx(
        "fixed inset-y-0 left-0 z-50 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 hidden md:block">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">T</div>
            TRouter
          </h1>
        </div>
        
        <div className="p-6 md:hidden flex items-center justify-between">
             <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">T</div>
            TRouter
          </h1>
           <button onClick={() => setIsSidebarOpen(false)} className="text-gray-400">
            <X />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 mt-2 md:mt-0">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setIsSidebarOpen(false)}
              className={clsx(
                location.pathname === item.href
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white',
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md'
              )}
            >
              <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs text-white font-bold">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.email}</p>
              <p className="text-xs text-gray-500 truncate">{t('common.balance')}: ¥{user?.balance?.toFixed(2) || '0.00'}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center px-2 py-2 text-sm font-medium text-gray-400 rounded-md hover:bg-gray-800 hover:text-white"
          >
            <LogOut className="mr-3 h-5 w-5" />
            {t('nav.sign_out')}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden pt-16 md:pt-0 w-full">
        <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full flex flex-col">
          <div className="flex-1">
            <Outlet />
          </div>
          <footer className="mt-8 py-4 text-center text-sm text-gray-500 border-t border-gray-800">
            &copy; 2015-{new Date().getFullYear()} {t('common.company_name')}
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Layout;
