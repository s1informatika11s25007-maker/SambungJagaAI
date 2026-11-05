import React, { useState, useEffect } from 'react';
import {
  Heart,
  Home,
  Users,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  FileSignature,
  Cpu,
  Layers,
  Lock,
  Wifi,
  WifiOff,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { ROLE_LABELS } from '../../services/dashboard/staffService';

export default function Sidebar({
  activeTab,
  setActiveTab,
  activeRole,
  currentUser,
  obligations = [],
  isOffline,
  setIsOffline,
  offlineQueue,
  syncOfflineLedger,
  onLogout
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);

  // Calculate dynamic active obligations count for badges
  const openCount = obligations.filter(o => o.status === 'open' || o.status === 'in_progress').length;
  const criticalCount = obligations.filter(o => (o.status === 'open' || o.status === 'in_progress') && (o.priority === 'critical' || o.priority === 'emergency')).length;

  // Dedicated Navigation Items strictly tailored per Role
  const getNavItemsByRole = (role) => {
    switch (role) {
      case 'caregiver':
        return [
          { id: 'caregiver_pwa', label: 'Care Dashboard', desc: 'Profil Penghuni, Laporan, Tugas & Foto Bukti', icon: Home, badgeCount: openCount || null },
          { id: 'workforce', label: 'Workforce', desc: 'Status Shift & Ketersediaan Caregiver', icon: Users },
          { id: 'handover_contract', label: 'Continuity & Activity', desc: 'Serah Terima Shift, Jejak Keputusan & Audit Trail', icon: FileSignature }
        ];
      case 'supervisor':
        return [
          { id: 'supervisor_dashboard', label: 'Supervisor Center', desc: 'Review Laporan, Bukti, Persetujuan A3 & Eskalasi', icon: ShieldCheck, badgeCount: criticalCount || null },
          { id: 'caregiver_pwa', label: 'Care Dashboard', desc: 'Pemantauan Tugas Perawatan & Kondisi Lansia', icon: Home, badgeCount: openCount || null },
          { id: 'workforce', label: 'Workforce', desc: 'Caregiver, Shift, Kompetensi & Ketersediaan Staf', icon: Users },
          { id: 'family_portal', label: 'Family Portal', desc: 'Tinjauan Izin PDP, Kunjungan & Pengaduan Keluarga', icon: Heart },
          { id: 'handover_contract', label: 'Continuity & Activity', desc: 'Handover 2 Sisi, Progress & Audit Trail', icon: FileSignature }
        ];
      case 'family':
        return [
          { id: 'family_portal', label: 'Family Care Portal', desc: 'Ringkasan Kemajuan Lansia, Kunjungan & Keluhan', icon: Heart },
          { id: 'handover_contract', label: 'Continuity & Activity', desc: 'Jurnal Perkembangan Lansia & Audit Trail Transparansi', icon: FileSignature }
        ];
      case 'admin_hr':
      default:
        return [
          { id: 'supervisor_dashboard', label: 'Supervisor Center', desc: 'Pengawasan Triage & Ringkasan Panti', icon: ShieldCheck, badgeCount: criticalCount || null },
          { id: 'workforce', label: 'Workforce Continuity', desc: 'Absensi, Shift, Onboarding/Offboarding Staf', icon: Users },
          { id: 'handover_contract', label: 'Continuity & Activity', desc: 'Kontrak Shift, Jejak Keputusan & Audit Trail', icon: FileSignature },
          { id: 'admin_agent_health', label: 'Agent Health', desc: 'Status 48 Agen dalam 8 Kelompok Orchestrated Mesh', icon: Cpu },
          { id: 'admin_queue', label: 'Queue Monitor', desc: 'Durable Queue, Outbox & Telemetri Server Scheduler 24/7', icon: Layers },
          { id: 'admin_security', label: 'Security & Config', desc: 'RLS Tenant Isolation, Audit Trail & Policy A0-A3', icon: Lock }
        ];
    }
  };

  const navItems = getNavItemsByRole(activeRole);
  const roleText = currentUser?.roleTitle || ROLE_LABELS[activeRole] || activeRole;
  const userName = currentUser?.name || currentUser?.full_name || '';

  const handleNavClick = (id) => {
    setActiveTab(id);
    setMobileOpen(false);
  };

  const full = !isCollapsed || mobileOpen;

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden bg-white/90 backdrop-blur px-4 py-3 flex items-center justify-between sticky top-0 z-40 border-b border-slate-200/70 w-full">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-sky-600 fill-sky-600" />
          <span className="text-base font-semibold text-slate-900 tracking-tight">Sambung<span className="text-sky-600">Jaga</span></span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] md:hidden" />
      )}

      <aside className={`fixed top-0 left-0 bottom-0 z-50 md:z-30 h-screen bg-white border-r border-slate-200/70 text-slate-600 transition-all duration-300 ease-in-out flex flex-col justify-between overflow-hidden ${
        isCollapsed ? 'md:w-20' : 'md:w-64'
      } ${mobileOpen ? 'translate-x-0 w-64 shadow-xl' : '-translate-x-full md:translate-x-0'}`}>

        <div className="px-3 py-4 space-y-6 overflow-y-auto scrollbar-none flex-1">
          {/* Brand + collapse */}
          <div className="flex items-center justify-between px-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
                <Heart className="w-5 h-5 fill-white" />
              </div>
              {full && (
                <div className="min-w-0">
                  <span className="text-base font-semibold text-slate-900 tracking-tight block leading-tight truncate">
                    Sambung<span className="text-sky-600">Jaga</span>
                  </span>
                  <span className="text-xs text-slate-400 block">Care Superagent</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              title={isCollapsed ? 'Perluas Sidebar' : 'Lipat Sidebar (Mode Rail)'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation */}
          <nav className="space-y-1" aria-label="Navigasi utama">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={`${item.label} — ${item.desc}`}
                  className={`w-full flex items-center ${full ? 'justify-between px-3 py-2.5' : 'justify-center p-3'} rounded-xl text-sm transition relative ${
                    isActive ? 'bg-sky-50 text-sky-800 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  {isActive && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] bg-sky-600 rounded-r-full" />}
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-sky-700' : 'text-slate-400'}`} />
                    {full && <span className="truncate">{item.label}</span>}
                  </span>
                  {full && item.badgeCount && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 shrink-0 ml-2">
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom: identity + connectivity + logout */}
        <div className={`p-3 border-t border-slate-100 space-y-1.5 shrink-0 ${full ? '' : 'flex flex-col items-center'}`}>
          {full && (
            <div className="px-2 pb-2 min-w-0">
              <span className="text-xs text-slate-400 block">Masuk sebagai</span>
              <span className="text-sm font-medium text-slate-800 truncate block capitalize">{userName || roleText}</span>
              {userName && <span className="text-xs text-slate-500 truncate block">{roleText}</span>}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (isOffline && offlineQueue.length > 0) syncOfflineLedger();
              else setIsOffline(!isOffline);
            }}
            title={!full ? (isOffline ? `P5 Offline (${offlineQueue.length})` : 'Cloud Sync Online') : undefined}
            className={`w-full flex items-center ${full ? 'justify-between px-3 py-2' : 'justify-center p-2.5'} rounded-xl text-xs font-medium transition ${
              isOffline ? 'bg-amber-50 text-amber-800' : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <span className="flex items-center gap-2">
              {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
              {full && <span>{isOffline ? `P5 Offline (${offlineQueue.length})` : 'Cloud Sync Online'}</span>}
            </span>
            {full && isOffline && offlineQueue.length > 0 && <RefreshCw className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onLogout}
            title={!full ? 'Keluar Sesi' : undefined}
            className={`w-full flex items-center ${full ? 'px-3 py-2 gap-2' : 'justify-center p-2.5'} rounded-xl text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition`}
          >
            <LogOut className="w-4 h-4" />
            {full && <span>Keluar Sesi</span>}
          </button>
        </div>
      </aside>

      {/* Spacer reserving desktop width */}
      <div className={`hidden md:block shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-20' : 'w-64'}`} />
    </>
  );
}
