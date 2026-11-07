import React from 'react';
import { Home, Smartphone, LayoutDashboard, FileSignature, GitPullRequest, Users, Cpu, BookOpen, ShieldAlert } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'landing_page', label: 'Landing Page', icon: Home, badge: 'Overview' },
    { id: 'caregiver_pwa', label: 'Pengasuh PWA Mobile', icon: Smartphone, badge: 'P5 Ledger' },
    { id: 'supervisor_dashboard', label: 'Dashboard Supervisor', icon: LayoutDashboard, badge: 'P1-P3 Graph' },
    { id: 'handover_contract', label: 'Kontrak Serah Terima', icon: FileSignature, badge: '2-Sided' },
    { id: 'execution_trace', label: 'Execution Trace Viewer', icon: GitPullRequest, badge: 'Explainable' },
    { id: 'family_portal', label: 'Family Portal', icon: Users, badge: 'Consent PDP' },
    { id: 'simulator_lab', label: 'Simulator P4 & Lab', icon: Cpu, badge: 'Failure-Set' },
    { id: 'rule_library', label: 'Rule Library', icon: BookOpen, badge: 'v2.1' },
    { id: 'audit_trail', label: 'Audit Trail [A]', icon: ShieldAlert, badge: 'Hash-Chain' },
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
