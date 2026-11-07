import React from 'react';
import { Home, Smartphone, LayoutDashboard, FileSignature, GitPullRequest, Users, Cpu, BookOpen, ShieldAlert } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'landing_page', label: 'Halaman Utama', icon: Home, badge: 'Ikhtisar' },
    { id: 'caregiver_pwa', label: 'Pengasuh Mobile', icon: Smartphone, badge: 'Buku Kas P5' },
    { id: 'supervisor_dashboard', label: 'Dashboard Supervisor', icon: LayoutDashboard, badge: 'Grafik P1-P3' },
    { id: 'handover_contract', label: 'Serah Terima Shift', icon: FileSignature, badge: '2 Sisi' },
    { id: 'execution_trace', label: 'Pelacakan Keputusan AI', icon: GitPullRequest, badge: 'Transparan' },
    { id: 'family_portal', label: 'Portal Keluarga', icon: Users, badge: 'Privasi PDP' },
    { id: 'simulator_lab', label: 'Simulator P4 & Lab', icon: Cpu, badge: 'Analisis Kegagalan' },
    { id: 'rule_library', label: 'Perpustakaan Aturan', icon: BookOpen, badge: 'v2.1' },
    { id: 'audit_trail', label: 'Jejak Audit [A]', icon: ShieldAlert, badge: 'Rantai Hash' },
  ];

  return (
    <nav className="bg-white/80 border-b border-slate-200/90 px-4 shadow-2xs">
      <div className="w-full flex space-x-1.5 overflow-x-auto scrollbar-none py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-sky-500 text-white shadow-md shadow-sky-500/20 font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                  isActive ? 'bg-sky-600/60 text-sky-100' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
