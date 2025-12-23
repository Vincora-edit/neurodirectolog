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
  LogOut
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuthStore();

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
      <div className="flex h-screen">
        <aside className="w-64 bg-white border-r border-gray-200">
          <div className="flex flex-col h-full">
            <div className="p-6 border-b border-gray-200">
              <h1 className="text-2xl font-bold text-primary-600">Нейродиректолог</h1>
              <p className="text-sm text-gray-600 mt-1">AI для Яндекс.Директ</p>
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

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
