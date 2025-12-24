import { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  TrendingUp,
  FileText,
  Megaphone,
  Lightbulb,
  MessageSquare,
  Target,
  Filter,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Проекты', href: '/projects', icon: FolderOpen },
    { name: 'Аналитика', href: '/analytics', icon: TrendingUp },
    { name: 'Семантика', href: '/semantics', icon: FileText },
    { name: 'Кампании', href: '/campaign', icon: Megaphone },
    { name: 'Креативы', href: '/creatives', icon: Lightbulb },
    { name: 'Объявления', href: '/ads', icon: MessageSquare },
    { name: 'Стратегия', href: '/strategy', icon: Target },
    { name: 'Минус-слова', href: '/minus-words', icon: Filter },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className={`bg-white border-r border-gray-200 transition-all duration-300 sticky top-0 h-screen ${
          sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'
        }`}>
          <div className="flex flex-col h-full w-64">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-primary-600">Нейродиректолог</h1>
                <p className="text-sm text-gray-600 mt-1">AI для Яндекс.Директ</p>
              </div>
            </div>

            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-50 text-primary-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-600 font-medium">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name || 'User'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Выйти"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1">
          {/* Top bar with toggle button */}
          <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200 px-4 py-2 flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
              title={sidebarCollapsed ? 'Показать меню' : 'Скрыть меню'}
            >
              {sidebarCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <span className="text-sm text-gray-500">
              {sidebarCollapsed ? 'Меню скрыто' : ''}
            </span>
          </div>
          <div className={`p-8 ${sidebarCollapsed ? 'w-full' : 'max-w-7xl mx-auto'}`}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
