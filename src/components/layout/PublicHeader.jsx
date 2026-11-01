import React from 'react';
import { Heart, LogIn, UserRoundPlus } from 'lucide-react';

export default function PublicHeader({ onGoToLogin, onGoToRegister, onGoToLanding }) {
  return (
    <header className="sj-public-header">
      <div className="sj-public-header-inner">
        <button type="button" onClick={onGoToLanding} className="sj-brand-lockup" aria-label="SambungJaga beranda">
          <span className="sj-brand-mark"><Heart size={20} fill="currentColor" /></span>
          <span><strong>Sambung<span>Jaga</span></strong><small>Care continuity platform</small></span>
        </button>
        <nav className="sj-public-nav" aria-label="Navigasi halaman">
          <a href="#cara-kerja">Cara kerja</a>
          <a href="#peran">Untuk siapa</a>
        </nav>
        <div className="sj-public-actions">
          <button type="button" onClick={onGoToLogin} className="sj-public-btn"><LogIn size={15} /> Masuk</button>
          <button type="button" onClick={onGoToRegister} className="sj-public-btn sj-public-btn-primary"><UserRoundPlus size={15} /> Daftar</button>
        </div>
      </div>
    </header>
  );
}
