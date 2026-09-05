'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, LayoutDashboard, Package, FolderTree, ShoppingCart, Users, Tag, Star, Wrench, FileText, Mail, Image, Settings, FileBarChart, Menu, X, LogOut, Truck, Megaphone, Layers, BarChart3, Home, ShieldCheck, UserCog, Gift, Bell, Boxes, LifeBuoy, TrendingUp, Sun, Moon, Bot, MessageCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { NotificationCenter } from './notification-center';

type NavGroup = { label: string; items: { href: string; label: string; icon: any; masterOnly?: boolean }[] };

const navGroups: NavGroup[] = [
  { label: '', items: [{ href: '/admin', label: 'ড্যাশবোর্ড', icon: LayoutDashboard }] },
  { label: 'অর্ডার', items: [
    { href: '/admin/orders', label: 'সকল অর্ডার', icon: ShoppingCart },
    { href: '/admin/orders?source=website', label: 'ওয়েবসাইট অর্ডার', icon: ShoppingCart },
    { href: '/admin/orders?source=ads', label: 'Ads অর্ডার', icon: Megaphone },
  ] },
  { label: 'ক্যাটালগ', items: [
    { href: '/admin/products', label: 'প্রোডাক্ট', icon: Package },
    { href: '/admin/categories', label: 'ক্যাটাগরি', icon: FolderTree },
    { href: '/admin/combos', label: 'কম্বো প্যাক', icon: Boxes },
    { href: '/admin/inventory', label: 'ইনভেন্টরি', icon: Layers },
    { href: '/admin/batches', label: 'ব্যাচ / এক্সপায়রি', icon: Layers },
  ] },
  { label: 'Ads ও মার্কেটিং', items: [
    { href: '/admin/ads-landing', label: 'Ads Landing Pages', icon: Megaphone },
    { href: '/admin/animated-landing', label: 'Animated Landing Pages', icon: Sparkles },
    { href: '/admin/campaigns', label: 'ক্যাম্পেইন ট্র্যাকিং', icon: BarChart3 },
    { href: '/admin/settings?tab=marketing', label: 'মার্কেটিং সেটিংস', icon: Tag },
  ] },
  { label: 'AI', items: [
    { href: '/admin/ai', label: 'AI Center', icon: Bot },
    { href: '/admin/ai-messenger', label: 'AI Messenger', icon: MessageCircle },
  ] },
  { label: 'কাস্টমার', items: [{ href: '/admin/customers', label: 'কাস্টমার', icon: Users }] },
  { label: 'কন্টেন্ট', items: [
    { href: '/admin/homepage', label: 'হোমপেজ', icon: Home },
    { href: '/admin/banners', label: 'ব্যানার', icon: Image },
    { href: '/admin/services', label: 'সার্ভিস', icon: Wrench },
    { href: '/admin/blog', label: 'ব্লগ / গাইড', icon: FileText },
    { href: '/admin/reviews', label: 'রিভিউ', icon: Star },
    { href: '/admin/pages', label: 'পেজ', icon: FileBarChart },
  ] },
  { label: 'প্রমোশন', items: [
    { href: '/admin/promotions', label: 'ফ্রি গিফট প্রমোশন', icon: Gift },
    { href: '/admin/popups', label: 'প্রোমোশনাল পপআপ', icon: Megaphone },
    { href: '/admin/coupons', label: 'কুপন', icon: Tag },
    { href: '/admin/stock-notifications', label: 'স্টক নোটিফিকেশন', icon: Bell },
  ] },
  { label: 'অপারেশন', items: [
    { href: '/admin/support', label: 'সাপোর্ট / অভিযোগ', icon: LifeBuoy },
    { href: '/admin/reports', label: 'রিপোর্ট', icon: TrendingUp },
  ] },
  { label: 'অ্যাডমিন', items: [{ href: '/admin/admin-management', label: 'এডমিন ম্যানেজমেন্ট', icon: UserCog, masterOnly: true }] },
  { label: 'সেটিংস', items: [
    { href: '/admin/delivery', label: 'ডেলিভারি', icon: Truck },
    { href: '/admin/settings', label: 'সাধারণ সেটিংস', icon: Settings },
    { href: '/admin/navigation', label: 'নেভিগেশন', icon: Menu },
  ] },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const isLoginPage = pathname === '/allahmohammad/admin/login786';

  useEffect(() => {
    const savedTheme = (localStorage.getItem('admin_theme') as 'light' | 'dark') || 'light';
    setTheme(savedTheme);
    if (savedTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    if (isLoginPage) { setLoading(false); return; }
    checkAdmin();
  }, [isLoginPage, pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('admin_theme', nextTheme);
    if (nextTheme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  };

  const checkAdmin = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }
    const { data } = await supabase.rpc('is_admin');
    if (!data) { router.push('/'); return; }
    setAdminEmail(session.user.email || '');
    const { data: masterData } = await supabase.rpc('is_master_admin');
    setIsMasterAdmin(!!masterData);
    setIsAdmin(true);
    setLoading(false);
  };

  if (isLoginPage) return <>{children}</>;
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!isAdmin) return null;

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/'); };
  const isActive = (href: string) => {
    const cleanHref = href.split('?')[0];
    if (cleanHref === '/admin') return pathname === '/admin';
    return pathname.startsWith(cleanHref);
  };

  return (
    <div className="min-h-screen bg-secondary/10 text-foreground">
      <div className="sticky top-0 z-45 flex items-center justify-between border-b border-border bg-background px-4 py-3 lg:hidden">
        <button onClick={() => setSidebarOpen(true)} className="p-1"><Menu className="h-6 w-6" /></button>
        <span className="font-bold text-primary">SEED BARI Admin</span>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="rounded-lg border border-border p-2 hover:bg-secondary">{theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}</button>
          <button onClick={handleLogout} className="p-1 text-destructive"><LogOut className="h-5 w-5" /></button>
        </div>
      </div>
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform overflow-y-auto border-r border-border bg-background transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border p-4">
            <Link href="/admin" className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><span className="text-sm font-bold">G</span></div><span className="font-bold text-primary">SEED BARI</span></Link>
            <div className="flex items-center gap-1"><button onClick={toggleTheme} className="hidden lg:flex rounded-lg border border-border p-2 hover:bg-secondary" title="থিম পরিবর্তন করুন">{theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}</button><button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="h-5 w-5" /></button></div>
          </div>
          <div className="border-b border-border px-4 py-3"><div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{adminEmail.charAt(0).toUpperCase()}</div><div><p className="text-xs text-muted-foreground truncate max-w-[140px]">{adminEmail}</p><span className={`flex items-center gap-1 text-xs font-semibold ${isMasterAdmin ? 'text-primary' : 'text-muted-foreground'}`}><ShieldCheck className="h-3 w-3" />{isMasterAdmin ? 'MASTER ADMIN' : 'ADMIN'}</span></div></div></div>
          <nav className="flex-1 overflow-y-auto p-3">{navGroups.map((group, gidx) => { const items = group.items.filter((item) => !item.masterOnly || isMasterAdmin); if (items.length === 0) return null; return <div key={gidx} className="mb-4">{group.label && <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">{group.label}</p>}{items.map((item) => <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={`mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive(item.href) ? 'bg-primary text-primary-foreground' : 'text-foreground/70 hover:bg-secondary'}`}><item.icon className="h-4 w-4" />{item.label}</Link>)}</div>; })}</nav>
          <div className="border-t border-border p-3"><button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"><LogOut className="h-4 w-4" /> লগআউট</button></div>
        </div>
      </aside>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="lg:pl-64"><NotificationCenter /><main className="p-4 lg:p-8">{children}</main></div>
    </div>
  );
}
