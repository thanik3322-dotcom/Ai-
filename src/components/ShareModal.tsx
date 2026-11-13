import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  QrCode,
  Smartphone,
  X,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  initialTarget?: 'home' | 'record';
  serverAppUrl?: string;
  onClose: () => void;
}

export function resolveDefaultShareBaseUrl(serverAppUrl?: string): string {
  if (typeof window === 'undefined') {
    return serverAppUrl || '';
  }
  const origin = window.location.origin;
  const isLocal =
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('0.0.0.0');

  if (isLocal && serverAppUrl && serverAppUrl.startsWith('http')) {
    return serverAppUrl.replace(/\/+$/, '');
  }
  return origin.replace(/\/+$/, '');
}

export function ShareModal({
  isOpen,
  initialTarget = 'record',
  serverAppUrl,
  onClose,
}: ShareModalProps) {
  const [targetPage, setTargetPage] = useState<'home' | 'record'>(initialTarget);
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const defaultBase = resolveDefaultShareBaseUrl(serverAppUrl);
  const activeBase = (customBaseUrl.trim() || defaultBase).replace(/\/+$/, '');
  const fullShareUrl =
    targetPage === 'record' ? `${activeBase}/?view=record` : `${activeBase}/`;

  useEffect(() => {
    setTargetPage(initialTarget);
  }, [initialTarget, isOpen]);

  useEffect(() => {
    if (!isOpen || !fullShareUrl) return;
    let cancelled = false;

    QRCode.toDataURL(fullShareUrl, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, fullShareUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.getElementById('share-url-input') as HTMLInputElement | null;
      if (input) {
        input.select();
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `ai-voice-health-qr-${targetPage}.png`;
    link.click();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-sky-100 bg-white p-6 shadow-xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <QrCode className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="share-modal-title"
                className="font-display text-lg font-bold text-slate-900 sm:text-xl"
              >
                ลิงก์และ QR Code สำหรับมือถือหรือเครื่องอื่น
              </h2>
              <p className="text-xs text-slate-500">
                สแกนด้วยกล้องมือถือหรือส่งลิงก์เพื่อเปิดใช้งานและอัดเสียงไอได้ทันที
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Target Route Switcher */}
        <div className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl bg-[#F4F9FF] p-1">
          <button
            type="button"
            onClick={() => setTargetPage('record')}
            className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              targetPage === 'record'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เปิดหน้าบันทึกเสียงไอทันที
          </button>
          <button
            type="button"
            onClick={() => setTargetPage('home')}
            className={`cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
              targetPage === 'home'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เปิดหน้าแรกของเว็บไซต์
          </button>
        </div>

        {/* QR Code Display */}
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-sky-100 bg-[#F8FBFF] p-5">
          <div className="rounded-xl border border-sky-100 bg-white p-3 shadow-xs">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Code สำหรับเปิด ${fullShareUrl}`}
                className="h-48 w-48 sm:h-52 sm:w-52"
              />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center text-xs text-slate-400">
                กำลังสร้าง QR Code...
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <Smartphone className="h-4 w-4 text-sky-600" aria-hidden="true" />
            <span>เปิดกล้องมือถือสแกนเพื่อเข้าใช้งานโดยไม่ต้องพิมพ์ลิงก์</span>
          </div>
        </div>

        {/* Copyable Link Box */}
        <div className="mt-5">
          <label
            htmlFor="share-url-input"
            className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-700"
          >
            <span className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-sky-600" aria-hidden="true" />
              <span>ลิงก์สำหรับเปิดบนเครื่องอื่น</span>
            </span>
            {customBaseUrl && (
              <button
                type="button"
                onClick={() => setCustomBaseUrl('')}
                className="cursor-pointer text-xs font-medium text-sky-700 hover:underline"
              >
                ใช้ลิงก์เริ่มต้น
              </button>
            )}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="share-url-input"
              type="url"
              value={customBaseUrl ? fullShareUrl : fullShareUrl}
              onChange={(e) => {
                const raw = e.target.value;
                const stripped = raw.replace(/\/\?view=record$/, '').replace(/\/$/, '');
                setCustomBaseUrl(stripped);
              }}
              className="font-mono min-w-0 flex-1 rounded-xl border border-sky-200 bg-[#F8FBFF] px-3.5 py-2.5 text-xs text-slate-800 focus:border-sky-500 focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-sky-600 text-white hover:bg-sky-700'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>คัดลอกแล้ว</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>คัดลอกลิงก์</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sky-100 pt-4">
          <button
            type="button"
            onClick={handleDownloadQr}
            disabled={!qrDataUrl}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>ดาวน์โหลด QR Code (PNG)</span>
          </button>

          <a
            href={fullShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span>เปิดลิงก์ในแท็บใหม่</span>
          </a>
        </div>
      </div>
    </div>
  );
}
