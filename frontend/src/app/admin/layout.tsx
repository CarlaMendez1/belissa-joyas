'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { LayoutDashboard, FolderTree, Package, Sliders, Settings, Crown, ArrowLeft, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    } else if (status === 'authenticated' && (session?.user as any)?.role !== 'administrador') {
      router.replace('/');
    }
  }, [status, session, router]);

  if (status === 'loading' || (session?.user as any)?.role !== 'administrador') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <p className="text-stone-400">Verificando acceso...</p>
      </div>
    );
  }

  const links = [
    { href: '/admin', label: 'Inicio', icon: LayoutDashboard },
    { href: '/admin/categorias', label: 'Categorías', icon: FolderTree },
    { href: '/admin/productos', label: 'Productos', icon: Package },
    { href: '/admin/opciones', label: 'Opciones', icon: Sliders },
    { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
    { href: '/admin/niveles-vip', label: 'Niveles VIP', icon: Crown },
  ];

  return (
    <div className="min-h-screen bg-stone-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-stone-200 flex flex-col">
        <div className="px-6 py-5 border-b border-stone-200">
          <h1 className="font-serif text-lg text-stone-800">Belissa Joyas</h1>
          <p className="text-xs text-stone-400">Panel de administración</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                <Icon className="w-4 h-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-stone-200 flex flex-col gap-1">
          {session?.user && (
            <div className="px-3 py-2 mb-1">
              <p className="text-sm font-medium text-stone-700 truncate">{session.user.name}</p>
              <p className="text-xs text-stone-400 truncate">{session.user.email}</p>
            </div>
          )}
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al sitio
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}