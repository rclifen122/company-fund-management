import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import {
  Home,
  Users,
  PiggyBank,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
  User,
  Share2,
  Moon,
  Sun,
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const navigation = [
    { name: 'Bảng Điều Khiển', href: '/', icon: Home },
    { name: 'Nhân Viên', href: '/employees', icon: Users },
    { name: 'Thu Quỹ', href: '/fund-collection', icon: PiggyBank },
    { name: 'Chi Phí', href: '/expenses', icon: Receipt },
    { name: 'Chia Tiền', href: '/bill-sharing', icon: Share2 },
    { name: 'Cài Đặt', href: '/settings', icon: Settings },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const NavContent = ({ onItemClick }) => (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-50 to-indigo-100/70 text-indigo-700 shadow-sm dark:from-indigo-900/40 dark:to-indigo-800/30 dark:text-indigo-300'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200'
              }`}
              onClick={onItemClick}
            >
              <item.icon className={`mr-3 h-5 w-5 transition-colors ${
                isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-400'
              }`} />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-gray-100 dark:border-gray-700/50 p-3 space-y-1">
        {/* Dark mode toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="group flex w-full items-center px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200 transition-all duration-200"
        >
          {darkMode ? (
            <Sun className="mr-3 h-5 w-5 text-amber-500" />
          ) : (
            <Moon className="mr-3 h-5 w-5 text-gray-400" />
          )}
          {darkMode ? 'Chế Độ Sáng' : 'Chế Độ Tối'}
        </button>
        <button
          onClick={handleSignOut}
          className="group flex w-full items-center px-3 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Đăng Xuất
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50/80 dark:bg-gray-950 transition-colors duration-300">
      {/* Mobile sidebar overlay */}
      <div className={`fixed inset-0 z-40 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div
          className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-white dark:bg-gray-900 shadow-2xl">
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                <PiggyBank className="h-5 w-5 text-white" />
              </div>
              <span className="ml-2.5 text-lg font-bold text-gray-900 dark:text-white">
                Company Fund
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <NavContent onItemClick={() => setSidebarOpen(false)} />
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col lg:z-30">
        <div className="flex flex-1 flex-col min-h-0 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800">
          <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-gray-100 dark:border-gray-800">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
              <PiggyBank className="h-5 w-5 text-white" />
            </div>
            <span className="ml-2.5 text-lg font-bold text-gray-900 dark:text-white">
              Company Fund
            </span>
          </div>
          <div className="flex-1 flex flex-col overflow-y-auto">
            <NavContent onItemClick={() => {}} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col flex-1">
        {/* Top bar with blur effect */}
        <div className="sticky top-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
          <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5 text-gray-500" />
            </button>
            
            <div className="flex items-center space-x-3 ml-auto">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block">
                  Chào mừng trở lại!
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
