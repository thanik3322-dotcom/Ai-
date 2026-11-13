import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AppView } from '../types/voiceHealth';

interface NavbarProps {
  currentView: AppView;
  historyCount: number;
  onNavigate: (view: AppView) => void;
}

export function Navbar({ currentView, historyCount, onNavigate }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (view: AppView) => {
    setMobileMenuOpen(false);
    onNavigate(view);
  };

  const navItems: Array<{ view: AppView; label: string }> = [
    { view: 'home', label: 'หน้าแรก' },
    { view: 'record', label: 'บันทึกเสียงไอ' },
    {
      view: 'history',
      label: historyCount > 0 ? `ประวัติย้อนหลัง (${historyCount})` : 'ประวัติย้อนหลัง',
    },
    { view: 'health-guide', label: 'คำแนะนำสุขภาพ' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="font-display cursor-pointer whitespace-nowrap shrink-0 text-left text-lg font-bold tracking-tight text-slate-900 transition-colors hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600"
        >
          AI Voice Health Analyzer
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="เมนูหลัก"
          className="hidden items-center gap-6 md:flex"
        >
          {navItems.map((item) => {
            const isActive =
              currentView === item.view ||
              (item.view === 'record' && currentView === 'analyzing');
            return (
              <button
                key={item.view}
                type="button"
                onClick={() => handleNav(item.view)}
                className={`cursor-pointer whitespace-nowrap shrink-0 border-b-2 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-600 ${
                  isActive
                    ? 'border-sky-600 text-sky-700'
                    : 'border-transparent text-slate-600 hover:border-sky-200 hover:text-slate-900'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleNav('record')}
            className="hidden cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 sm:inline-flex"
          >
            วิเคราะห์เสียงไอ
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-sky-100 bg-sky-50/70 text-slate-700 transition-colors hover:bg-sky-100 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-t border-sky-100 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = currentView === item.view;
              return (
                <button
                  key={item.view}
                  type="button"
                  onClick={() => handleNav(item.view)}
                  className={`flex min-h-11 w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-50 text-sky-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => handleNav('record')}
              className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              เริ่มต้นวิเคราะห์เสียงไอ
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
