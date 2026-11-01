import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Heart, Loader2 } from 'lucide-react';
import { useSambungJaga } from './hooks/core/useSambungJaga';
import PublicHeader from './components/layout/PublicHeader';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Footer from './components/layout/Footer';
import CommandCenter from './components/dashboard/CommandCenter';

// Pre-Login Pages
import LandingPage from './pages/auth/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Post-Login Pages
import CaregiverMobilePage from './pages/caregiver/CaregiverMobilePage';
import SupervisorDashboardPage from './pages/dashboard/SupervisorDashboardPage';
import HandoverPage from './pages/handover/HandoverPage';
import ExecutionTracePage from './pages/trace/ExecutionTracePage';
import FamilyPortalPage from './pages/family/FamilyPortalPage';
import SimulatorLabPage from './pages/simulator/SimulatorLabPage';
import RuleLibraryPage from './pages/rule/RuleLibraryPage';
import AuditTrailPage from './pages/audit/AuditTrailPage';
import ExecutionTraceModal from './components/trace/ExecutionTraceModal';
import { supabase } from './supabase/client/client';
import { getAuthenticatedAccount, signOutUser } from './services/auth/authService';

const PAGE_TITLES = {
  caregiver_pwa: 'Tugas & Laporan',
  supervisor_dashboard: 'Pengawasan Klinis',
  handover_contract: 'Serah Terima Shift',
  execution_trace: 'Jejak Keputusan AI',
  family_portal: 'Portal Keluarga',
  simulator_lab: 'Simulator & Analisis',
  rule_library: 'Aturan & Kebijakan',
  audit_trail: 'Audit Trail'
};

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const navigate = useNavigate();
  const location = useLocation();

  const {
    activeRole,
    setActiveRole,
    currentUser,
    loginUserAccount,
    logoutUserAccount,
    residents,
    staff,
    obligations,
    epistemicFacts,
    notifications,
    deleteNotification,
    clearRoleNotifications,
    auditTrail,
    handoverContracts,
    rules,
    setRules,
    spotChallenges,
    isOffline,
    setIsOffline,
    offlineQueue,
    syncOfflineLedger,
    captureCareReport,
    submitEvidenceAndClose,
    approveAuthorityAction,
    createObligation,
    signHandoverContract,
    createHandoverContract,
    selectedTrace,
    setSelectedTrace,
    isLoading,
    userAvatar,
    setUserAvatar,
    autopilotPlan,
    runAutopilot
  } = useSambungJaga();

  // A browser-stored role is never treated as proof of identity. Restore only a real Supabase session.
  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!active) return;
        if (data.session?.user) {
          const account = await getAuthenticatedAccount(data.session.user);
          if (active && account) {
            loginUserAccount(account);
            setIsLoggedIn(true);
          } else if (active) {
            await supabase.auth.signOut();
            setIsLoggedIn(false);
          }
        } else if (active) {
          setIsLoggedIn(false);
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('currentUser');
          localStorage.removeItem('activeRole');
        }
      } catch (error) {
        console.warn('Session restoration failed:', error);
        if (active) setIsLoggedIn(false);
      } finally {
        if (active) setIsAuthChecking(false);
      }
    };
    restoreSession();
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT' && active) {
        logoutUserAccount();
        setIsLoggedIn(false);
      }
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Global Loading State component for elegant data fetch
  const GlobalLoader = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
      <div className="relative flex items-center justify-center">
        <Loader2 className="w-16 h-16 text-sky-200 animate-spin" />
        <Heart className="w-6 h-6 text-sky-600 absolute animate-pulse" />
      </div>
      <div className="text-center space-y-1">
        <h2 className="text-sky-800 font-black text-lg">SambungJaga</h2>
        <p className="text-slate-500 font-semibold text-xs animate-pulse">Memuat Data Sistem Terverifikasi...</p>
      </div>
    </div>
  );

  // Auth Handlers — only authenticated profiles can enter a role workspace.
  const handleLoginSuccess = (roleId, accountObj) => {
    if (!accountObj?.id || !accountObj?.role) {
      navigate('/login');
      return;
    }
    loginUserAccount(accountObj);
    setIsLoggedIn(true);
    if (accountObj.role === 'caregiver') navigate('/app/caregiver_pwa');
    else if (accountObj.role === 'family') navigate('/app/family_portal');
    else if (accountObj.role === 'admin_hr') navigate('/app/simulator_lab');
    else navigate('/app/supervisor_dashboard');
  };

  const handleLogout = async () => {
    try { await signOutUser(); } catch (error) { console.warn('Sign out warning:', error); }
    logoutUserAccount();
    setIsLoggedIn(false);
    navigate('/');
  };

  const defaultWorkspace = activeRole === 'caregiver'
    ? 'caregiver_pwa'
    : activeRole === 'family'
      ? 'family_portal'
      : activeRole === 'admin_hr'
        ? 'simulator_lab'
        : 'supervisor_dashboard';
  const defaultPath = `/app/${defaultWorkspace}`;

  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f5f8f6]">
        <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-lg shadow-emerald-950/5">
          <Heart className="h-7 w-7 fill-emerald-700 text-emerald-700" />
          <Loader2 className="absolute -inset-1 h-[72px] w-[72px] animate-spin text-emerald-300" />
        </div>
        <div className="text-center"><h1 className="font-extrabold tracking-tight text-slate-800">SambungJaga</h1><p className="mt-1 text-xs text-slate-500">Memeriksa sesi yang aman…</p></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f8f6] text-slate-800 font-sans selection:bg-emerald-100 selection:text-emerald-950 w-full overflow-x-hidden">
      <Routes>
        {!isLoggedIn ? (
          <>
            <Route
              path="/"
              element={
                <div className="min-h-screen flex flex-col justify-between w-full">
                  <PublicHeader
                    onGoToLanding={() => navigate('/')}
                    onGoToLogin={() => navigate('/login')}
                    onGoToRegister={() => navigate('/register')}
                  />
                  <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6">
                    <LandingPage
                      onGoToLogin={() => navigate('/login')}
                      onGoToRegister={() => navigate('/register')}
                      onDirectDemoLogin={handleLoginSuccess}
                    />
                  </main>
                  <Footer onGoToLanding={() => navigate('/')} />
                </div>
              }
            />
            <Route
              path="/login"
              element={
                <LoginPage
                  onLoginSuccess={handleLoginSuccess}
                  onGoToRegister={() => navigate('/register')}
                  onGoToLanding={() => navigate('/')}
                />
              }
            />
            <Route
              path="/register"
              element={
                <RegisterPage
                  onRegisterSuccess={handleLoginSuccess}
                  onGoToLogin={() => navigate('/login')}
                  onGoToLanding={() => navigate('/')}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        ) : isLoading ? (
          // Elegant loading animation when logged in but data is fetching
          <Route path="*" element={<GlobalLoader />} />
        ) : (
          <Route
            path="/app/*"
            element={
              <div className="flex flex-col md:flex-row min-h-screen w-full overflow-x-hidden">
                <Sidebar
                  activeTab={location.pathname.replace('/app/', '') || (activeRole === 'caregiver' ? 'caregiver_pwa' : activeRole === 'family' ? 'family_portal' : activeRole === 'admin_hr' ? 'simulator_lab' : 'supervisor_dashboard')}
                  setActiveTab={(tab) => navigate(`/app/${tab}`)}
                  activeRole={activeRole}
                  currentUser={currentUser}
                  obligations={obligations}
                  isOffline={isOffline}
                  setIsOffline={setIsOffline}
                  offlineQueue={offlineQueue}
                  syncOfflineLedger={syncOfflineLedger}
                  onLogout={handleLogout}
                />
                <div className="flex-1 flex flex-col justify-between min-w-0 w-full overflow-x-hidden">
                  <Header
                    activeRole={activeRole}
                    currentUser={currentUser}
                    notifications={notifications}
                    onDeleteNotification={deleteNotification}
                    onClearRoleNotifications={clearRoleNotifications}
                    userAvatar={userAvatar}
                    setUserAvatar={setUserAvatar}
                    onLogout={handleLogout}
                    title={PAGE_TITLES[location.pathname.replace('/app/', '')] || 'Ruang Kerja'}
                  />
                  <main className="sj-app-main">
                    {location.pathname.replace('/app/', '') === 'supervisor_dashboard' && ['supervisor', 'admin_hr'].includes(activeRole) && <CommandCenter
                      activeRole={activeRole}
                      currentUser={currentUser}
                      obligations={obligations}
                      residents={residents}
                      autopilotPlan={autopilotPlan}
                      onRunAutopilot={runAutopilot}
                      onCommand={(text) => captureCareReport({
                        text,
                        sourceType: 'text',
                        residentId: 'auto',
                        actorName: currentUser?.name || currentUser?.full_name || activeRole
                      })}
                    />}
                    <Routes>
                      <Route index element={<Navigate to={defaultPath} replace />} />
                      <Route
                        path="caregiver_pwa"
                        element={
                          activeRole !== 'caregiver' ? <Navigate to={defaultPath} replace /> : <CaregiverMobilePage
                            residents={residents}
                            obligations={obligations}
                            onCaptureSubmit={captureCareReport}
                            onSubmitEvidence={submitEvidenceAndClose}
                            onOpenTraceModal={setSelectedTrace}
                            isOffline={isOffline}
                            offlineQueue={offlineQueue}
                            currentUser={currentUser}
                          />
                        }
                      />
                      <Route
                        path="supervisor_dashboard"
                        element={
                          activeRole === 'family' ? <Navigate to="/app/family_portal" replace /> : activeRole === 'caregiver' ? <Navigate to="/app/caregiver_pwa" replace /> : <SupervisorDashboardPage
                            obligations={obligations}
                            epistemicFacts={epistemicFacts}
                            residents={residents}
                            staff={staff}
                            currentUser={currentUser}
                            spotChallenges={spotChallenges}
                            onSubmitEvidence={submitEvidenceAndClose}
                            onApproveAction={approveAuthorityAction}
                            onCreateObligation={createObligation}
                            onOpenTraceModal={setSelectedTrace}
                            setActiveTab={(tab) => navigate(`/app/${tab}`)}
                            onRunAutopilot={runAutopilot}
                            autopilotPlan={autopilotPlan}
                          />
                        }
                      />
                      <Route
                        path="handover_contract"
                        element={
                          activeRole === 'family' ? <Navigate to="/app/family_portal" replace /> : <HandoverPage
                            handoverContracts={handoverContracts}
                            onSignContract={signHandoverContract}
                            onCreateContract={createHandoverContract}
                            currentUserRole={activeRole}
                            currentUser={currentUser}
                            staff={staff}
                            obligations={obligations}
                            residents={residents}
                          />
                        }
                      />
                      <Route
                        path="execution_trace"
                        element={
                          activeRole === 'family' ? <Navigate to="/app/family_portal" replace /> : <ExecutionTracePage
                            obligations={obligations}
                            onOpenTraceModal={setSelectedTrace}
                          />
                        }
                      />
                      <Route
                        path="family_portal"
                        element={
                          activeRole !== 'family' ? <Navigate to={defaultPath} replace /> : <FamilyPortalPage
                            residents={residents}
                            obligations={obligations}
                            epistemicFacts={epistemicFacts}
                          />
                        }
                      />
                      <Route
                        path="simulator_lab"
                        element={activeRole === 'family' || activeRole === 'caregiver' ? <Navigate to={defaultPath} replace /> : <SimulatorLabPage staff={staff} obligations={obligations} />}
                      />
                      <Route
                        path="rule_library"
                        element={
                          activeRole === 'family' ? <Navigate to="/app/family_portal" replace /> : <RuleLibraryPage
                            rules={rules}
                            setRules={setRules}
                            activeRole={activeRole}
                            currentUser={currentUser}
                            obligations={obligations}
                            epistemicFacts={epistemicFacts}
                          />
                        }
                      />
                      <Route path="audit_trail" element={['supervisor', 'admin_hr'].includes(activeRole) ? <AuditTrailPage auditTrail={auditTrail} /> : <Navigate to={defaultPath} replace />} />
                      <Route
                        path="*"
                        element={<Navigate to={defaultPath} replace />}
                      />
                    </Routes>
                  </main>
                  <Footer compact onGoToLanding={handleLogout} />
                </div>
              </div>
            }
          />
        )}
        <Route
          path="*"
          element={<Navigate to={isLoggedIn ? defaultPath : '/'} replace />}
        />
      </Routes>

      {/* Trace Modal Global */}
      {selectedTrace && (
        <ExecutionTraceModal
          isOpen={!!selectedTrace}
          onClose={() => setSelectedTrace(null)}
          obligation={selectedTrace}
        />
      )}
    </div>
  );
}
