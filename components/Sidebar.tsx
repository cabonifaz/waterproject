// components/Sidebar.tsx
// Barra lateral de navegación

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Sidebar = () => {
  const pathname = usePathname();

  const menuItems = [
    { href: '/proyectos', label: '📁 Proyectos' },
    { href: '/sprints', label: '🗓️ Sprints y Feriados' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white h-screen flex flex-col">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-2xl font-bold">📅 Cronograma</h1>
        <p className="text-sm text-slate-400 mt-1">Gestión de proyectos</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-4 py-2 rounded-lg transition-colors ${
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700 text-sm text-slate-400">
        <p>v1.0.0</p>
      </div>
    </aside>
  );
};

export default Sidebar;
