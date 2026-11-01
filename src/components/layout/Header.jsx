import React, { useState, useEffect } from 'react';
import { Bell, Settings, User, Camera, Upload, LogOut, Heart, Shield, Trash2, X, AlertTriangle } from 'lucide-react';
import { formatDateID, formatTimeID } from '../../utils/common/formatters';
import Modal from '../common/Modal';
import { ROLE_LABELS } from '../../services/dashboard/staffService';

export default function Header({
  activeRole,
  currentUser,
  notifications = [],
  onDeleteNotification,
  onClearRoleNotifications,
  userAvatar,
  setUserAvatar,
  onLogout,
  title
}) {
  const [now, setNow] = useState(new Date());
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [showOnceToast, setShowOnceToast] = useState(true);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const initialsAvatar = (name) => {
    const ini = (name || 'U').replace(/\(.*?\)/g, '').split(/[\s,.]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'U';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#2a6f64"/><text x="50%" y="54%" font-family="Inter,Arial" font-size="48" fill="#fff" text-anchor="middle" dominant-baseline="middle">${ini}</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const currentProfile = {
    name: currentUser?.name || currentUser?.full_name || 'Pengguna SambungJaga',
    roleTitle: currentUser?.roleTitle || ROLE_LABELS[activeRole] || activeRole,
    email: currentUser?.email || '',
    defaultAvatar: currentUser?.avatar || initialsAvatar(currentUser?.name || currentUser?.full_name)
  };

  const displayAvatar = userAvatar || currentProfile.defaultAvatar;

  // Handle local file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setUserAvatar(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle URL change
  const handleUrlSubmit = (e) => {
    e.preventDefault();
    if (customAvatarUrl.trim()) {
      setUserAvatar(customAvatarUrl.trim());
      setCustomAvatarUrl('');
    }
  };

  // Preset Avatar selector
  const presetAvatars = [
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=120&q=80',
    'https://images.unsplash.com/photo-1594824813566-88855ce7890f?auto=format&fit=crop&w=120&q=80',
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80',
    'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=120&q=80',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80'
  ];

  // Role-targeted notifications
  const roleNotifs = notifications.filter(n => n.recipient_role === activeRole);
  const latestNotif = roleNotifs[0];

  useEffect(() => {
    setShowOnceToast(true);
    const timer = setTimeout(() => {
      setShowOnceToast(false);
    }, 7000);
    return () => clearTimeout(timer);
  }, [activeRole]);

  return (
    <>
      {/* Toast Notification Popup */}
      {showOnceToast && latestNotif && (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm w-[calc(100vw-2rem)] sm:w-96 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-sky-500/50 backdrop-blur-md animate-fade-in flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3 min-w-0 flex-1">
            <div className="p-2.5 bg-sky-600/40 text-sky-300 rounded-xl mt-0.5 shrink-0 border border-sky-500/30">
              <Bell className="w-4 h-4 animate-bounce text-sky-300" />
            </div>
            <div className="text-xs text-left min-w-0 flex-1">
              <div className="font-extrabold text-sky-300 flex items-center justify-between gap-2">
                <span className="truncate">{latestNotif.title}</span>
                <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-sky-800/80 font-mono text-sky-200 font-bold shrink-0">
                  {latestNotif.recipient_role}
                </span>
              </div>
              <p className="text-[11px] text-slate-200 mt-1 leading-snug font-medium line-clamp-3">
                {latestNotif.message}
              </p>
              <span className="text-[9px] text-slate-400 mt-1.5 block font-semibold">
                Dari: {latestNotif.sender_name}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowOnceToast(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition shrink-0"
            title="Tutup Pengingat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <header className="bg-white/80 border-b border-slate-200/70 px-4 sm:px-8 py-3 sticky top-0 z-40 backdrop-blur-md w-full overflow-visible">
        <div className="flex items-center justify-between gap-4 w-full">

          {/* Left Context Header Brand Tag (Search Bar Removed as Requested) */}
          <div className="flex items-center space-x-2.5">
            <span className="text-sm font-medium text-slate-600 flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-sky-600" />
              <span>{title || 'SambungJaga'}</span>
            </span>
          </div>

          {/* Right Info: Clock, Bell Notification, Settings, Avatar */}
          <div className="flex items-center space-x-4 text-xs text-slate-600 font-medium">
            {/* Realtime Date & Clock */}
            <div className="text-right hidden sm:block">
              <div className="text-[11px] text-slate-500 font-bold">{formatDateID(now)}</div>
              <div className="text-xs font-mono font-black text-slate-900">{formatTimeID(now)}</div>
            </div>

            {/* Bell Notification Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition focus:outline-none cursor-pointer"
                title="Notifikasi Peran Sistem"
              >
                <Bell className="w-4 h-4" />
                {roleNotifs.length > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 flex items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white animate-pulse">
                    {roleNotifs.length}
                  </span>
                )}
              </button>

              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[90] p-4 text-left animate-fade-in space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center">
                      <Bell className="w-3.5 h-3.5 mr-1.5 text-sky-600" /> Notifikasi ({roleNotifs.length})
                      <span className="ml-2 text-[10px] px-2 py-0.5 bg-sky-100 text-sky-800 rounded-full font-bold uppercase">{activeRole}</span>
                    </h4>
                    <div className="flex items-center space-x-2">
                      {roleNotifs.length > 0 && (
                        <button
                          onClick={() => onClearRoleNotifications && onClearRoleNotifications(activeRole)}
                          className="text-[10px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-0.5 cursor-pointer"
                          title="Hapus semua notifikasi peran ini"
                        >
                          <Trash2 className="w-3 h-3" /> Hapus Semua
                        </button>
                      )}
                      <button
                        onClick={() => setIsNotificationOpen(false)}
                        className="text-[10px] text-slate-400 hover:text-slate-600 font-bold ml-1 cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1 text-xs">
                    {roleNotifs.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 font-medium text-xs">
                        Tidak ada notifikasi baru untuk peran {activeRole}.
                      </div>
                    ) : (
                      roleNotifs.map((n) => (
                        <div
                          key={n.id}
                          className={`p-3.5 rounded-xl border transition duration-200 shadow-2xs ${
                            n.type === 'urgent' ? 'bg-rose-50 border-rose-200 text-rose-950' :
                            n.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-950' :
                            n.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' :
                            'bg-sky-50 border-sky-200 text-sky-950'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="font-extrabold text-xs text-slate-900 leading-tight flex-1 min-w-0 pr-1">
                              {n.title}
                            </div>
                            <button
                              onClick={() => onDeleteNotification && onDeleteNotification(n.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 hover:bg-slate-200/60 rounded-lg transition shrink-0 cursor-pointer"
                              title="Hapus Notifikasi"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <p className="text-[11px] text-slate-700 mt-1 leading-relaxed font-medium">
                            {n.message}
                          </p>

                          <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/60 text-[10px] text-slate-500 font-semibold">
                            <span>Dari: <strong className="text-slate-700">{n.sender_name || 'Sistem'}</strong></span>
                            <span className="font-mono text-slate-500">
                              {new Date(n.created_at || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
              title="Pengaturan Profil"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* User Avatar */}
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="relative group cursor-pointer"
              title="Klik untuk Kelola Profil & Foto"
            >
              <img
                src={displayAvatar}
                alt="User Profile"
                className="w-9 h-9 rounded-full object-cover border-2 border-sky-600 shadow-xs group-hover:scale-105 transition duration-200"
              />
              <div className="absolute -bottom-1 -right-1 bg-sky-600 text-white p-0.5 rounded-full border border-white shadow-xs">
                <Camera className="w-2.5 h-2.5" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Management & Avatar Upload Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Pengaturan Profil Pengguna"
      >
        <div className="space-y-6 text-left">

          {/* User Info Header */}
          <div className="flex items-center space-x-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="relative group shrink-0">
              <img
                src={displayAvatar}
                alt={currentProfile.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-sky-600 shadow-md"
              />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">{currentProfile.name}</h3>
              <p className="text-xs text-sky-700 font-bold">{currentProfile.roleTitle}</p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">{currentProfile.email}</p>
            </div>
          </div>

          {/* Option 1: File Uploader */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center">
              <Upload className="w-3.5 h-3.5 mr-1.5 text-sky-600" /> Unggah Foto Profil Baru (Dari Perangkat)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 cursor-pointer file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-sky-600 file:text-white hover:file:bg-sky-700"
            />
          </div>

          {/* Option 2: Image URL */}
          <form onSubmit={handleUrlSubmit} className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 flex items-center">
              <User className="w-3.5 h-3.5 mr-1.5 text-sky-600" /> Atau Pakai URL Foto Online
            </label>
            <div className="flex space-x-2">
              <input
                type="url"
                placeholder="https://example.com/photo.jpg"
                value={customAvatarUrl}
                onChange={(e) => setCustomAvatarUrl(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="submit"
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs transition cursor-pointer"
              >
                Ganti
              </button>
            </div>
          </form>

          {/* Option 3: Presets */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">Pilih dari Avatar Preset:</label>
            <div className="flex items-center space-x-3 overflow-x-auto pb-1">
              {presetAvatars.map((url, idx) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Preset ${idx}`}
                  onClick={() => setUserAvatar(url)}
                  className={`w-11 h-11 rounded-full object-cover cursor-pointer border-2 transition ${
                    displayAvatar === url ? 'border-sky-600 scale-110 shadow-md ring-2 ring-sky-300' : 'border-slate-200 hover:border-sky-400'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Footer Actions: Close or Explicit Logout */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setIsProfileModalOpen(false);
                onLogout();
              }}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-600" />
              <span>Keluar Sesi</span>
            </button>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(false)}
              className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-sky-600/20 transition cursor-pointer"
            >
              Selesai & Simpan
            </button>
          </div>

        </div>
      </Modal>
    </>
  );
}
