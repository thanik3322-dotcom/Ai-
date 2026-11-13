import { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  AudioWaveform,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Download,
  HeartPulse,
  Info,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { RiskLevel, VoiceAnalysisResult } from '../types/voiceHealth';
import { downloadAnalysisPdf } from '../utils/pdfReport';

interface ResultsViewProps {
  result: VoiceAnalysisResult;
  isSaved: boolean;
  onSaveResult: (result: VoiceAnalysisResult) => void;
  onBackHome: () => void;
  onRecordAgain: () => void;
  onOpenHealthGuide: () => void;
}

function getRiskMeta(level: RiskLevel) {
  if (level === 'high') {
    return {
      label: 'ความเสี่ยงสูง',
      textColor: 'text-rose-700',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
      barColor: 'bg-rose-500',
      Icon: ShieldAlert,
    };
  }
  if (level === 'medium') {
    return {
      label: 'ความเสี่ยงปานกลาง',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      barColor: 'bg-amber-500',
      Icon: AlertTriangle,
    };
  }
  return {
    label: 'ความเสี่ยงต่ำ',
    textColor: 'text-sky-700',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    barColor: 'bg-sky-500',
    Icon: CheckCircle2,
  };
}

function CoughAcousticRadarChart({ result }: { result: VoiceAnalysisResult }) {
  const m = result.acousticMetrics;
  const burstCount = m.coughBurstCount ?? 1;
  const decayMs = m.coughDecayMs ?? 240;
  const peakDb = m.peakVolumeDb ?? m.averageVolumeDb;

  const axes = [
    {
      label: 'Bursts',
      value: Math.min(100, Math.max(18, (burstCount / 5) * 100)),
    },
    {
      label: 'Peak dB',
      value: Math.min(100, Math.max(18, ((peakDb + 55) / 52) * 100)),
    },
    {
      label: 'Centroid',
      value: Math.min(100, Math.max(18, (m.spectralCentroidHz / 3500) * 100)),
    },
    {
      label: 'Decay ms',
      value: Math.min(100, Math.max(18, (decayMs / 550) * 100)),
    },
    {
      label: 'Turbulence',
      value: Math.min(100, Math.max(18, (m.shimmerPercent / 14) * 100)),
    },
  ];

  const cx = 135;
  const cy = 125;
  const maxR = 82;
  const levels = [0.25, 0.5, 0.75, 1];

  const getPoint = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * maxR * ratio,
      y: cy + Math.sin(angle) * maxR * ratio,
    };
  };

  const dataPoints = axes
    .map((ax, i) => {
      const p = getPoint(i, ax.value / 100);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 270 250"
      className="mx-auto h-56 w-full max-w-[270px]"
      role="img"
      aria-label="แผนภูมิเรดาร์แสดงโปรไฟล์สัญญาณเสียงไอ 5 มิติ"
    >
      {levels.map((lv) => {
        const pts = axes
          .map((_, i) => {
            const p = getPoint(i, lv);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(' ');
        return (
          <polygon
            key={lv}
            points={pts}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth="1"
          />
        );
      })}

      {axes.map((ax, i) => {
        const edge = getPoint(i, 1);
        const labelPos = getPoint(i, 1.24);
        return (
          <g key={ax.label}>
            <line
              x1={cx}
              y1={cy}
              x2={edge.x}
              y2={edge.y}
              stroke="#E2E8F0"
              strokeWidth="1"
            />
            <text
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-slate-600 font-mono text-[10px] font-semibold uppercase"
            >
              {ax.label}
            </text>
          </g>
        );
      })}

      <polygon
        points={dataPoints}
        fill="rgba(14, 165, 233, 0.20)"
        stroke="#0284C7"
        strokeWidth="2"
      />
      {axes.map((ax, i) => {
        const p = getPoint(i, ax.value / 100);
        return (
          <circle
            key={ax.label}
            cx={p.x}
            cy={p.y}
            r="3.5"
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        );
      })}
    </svg>
  );
}

export function ResultsView({
  result,
  isSaved,
  onSaveResult,
  onBackHome,
  onRecordAgain,
  onOpenHealthGuide,
}: ResultsViewProps) {
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    setPdfDownloading(true);
    setPdfError(null);
    try {
      await downloadAnalysisPdf(result);
    } catch {
      setPdfError('ไม่สามารถสร้างไฟล์ PDF ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setPdfDownloading(false);
    }
  };

  const formattedDate = new Date(result.analyzedAt).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const m = result.acousticMetrics;
  const burstCount = m.coughBurstCount ?? 1;
  const decayMs = m.coughDecayMs ?? 240;
  const peakDb = m.peakVolumeDb ?? m.averageVolumeDb;
  const isDemoMode = result.analysisMode === 'demo-fallback';
  const sourceLabel =
    result.inputSource === 'reference-sample'
      ? 'ทดสอบจากไฟล์เสียงต้นแบบ'
      : 'บันทึกเสียงจากไมโครโฟน';

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Action Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">
            รหัส {result.id} · {formattedDate} · {sourceLabel} · {result.modelName}
          </p>
          <h1 className="font-display mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            ผลการวิเคราะห์และจำแนกเสียงไอเบื้องต้น
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>กลับไปหน้าแรก</span>
          </button>

          <button
            type="button"
            onClick={() => onSaveResult(result)}
            disabled={isSaved}
            className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isSaved
                ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
            }`}
          >
            {isSaved ? (
              <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Bookmark className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{isSaved ? 'บันทึกผลแล้ว' : 'บันทึกผลการวิเคราะห์'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfDownloading}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 disabled:opacity-60"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>
              {pdfDownloading ? 'กำลังสร้าง PDF...' : 'ดาวน์โหลดรายงานผลในรูปแบบ PDF'}
            </span>
          </button>
        </div>
      </div>

      {pdfError && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {pdfError}
        </div>
      )}

      {/* Mandatory Medical & Demo Safety Banner */}
      <div
        role="note"
        className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 sm:p-5 ${
          isDemoMode
            ? 'border-amber-200 bg-amber-50/90 text-amber-950'
            : 'border-sky-200 bg-[#EBF4FF] text-slate-800'
        }`}
      >
        <Info
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            isDemoMode ? 'text-amber-700' : 'text-sky-700'
          }`}
          aria-hidden="true"
        />
        <div className="text-sm leading-relaxed">
          <p className="font-bold">
            {isDemoMode
              ? 'โหมดเทียบสัญญาณอะคูสติกกับต้นแบบ 3 ประเภท (Prototype Matching)'
              : 'ข้อจำกัดความรับผิดชอบทางการแพทย์ (Non-Diagnostic Screening Notice)'}
          </p>
          <p className="mt-0.5 text-slate-700">{result.disclaimerNote}</p>
        </div>
      </div>

      {/* Primary Cough Classification + 3-Class Prototype Breakdown */}
      <section className="mb-6 rounded-2xl border border-sky-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold text-sky-700">
              ผลการจำแนกประเภทเสียงไอหลักเทียบกับเสียงต้นแบบ 3 ชนิด
            </p>
            <h2 className="font-display mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
              {result.coughClassification || 'จำแนกลักษณะเสียงไอเบื้องต้น'}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-sky-800">
            <AudioWaveform className="h-5 w-5 text-sky-600" aria-hidden="true" />
            <span>ตรวจพบ {burstCount} ระลอกไอ</span>
          </div>
        </div>

        {result.classificationScores && result.classificationScores.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-4 border-t border-sky-100 pt-5 md:grid-cols-3">
            {result.classificationScores.map((item, idx) => {
              const isTop = idx === 0 || item.classId === result.primaryClassId;
              return (
                <div
                  key={item.classId}
                  className={`rounded-xl border p-4 ${
                    isTop
                      ? 'border-sky-300 bg-[#F0F7FF]'
                      : 'border-sky-100 bg-[#F8FBFF]'
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold text-slate-900">
                      {item.label}
                    </span>
                    <span
                      className={`font-mono tabular-nums text-lg font-bold ${
                        isTop ? 'text-sky-700' : 'text-slate-600'
                      }`}
                    >
                      {item.confidencePercent}%
                    </span>
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">
                    {item.englishLabel}
                  </p>
                  <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-sky-100">
                    <div
                      className={`h-full rounded-full ${
                        isTop ? 'bg-sky-600' : 'bg-sky-300'
                      }`}
                      style={{ width: `${item.confidencePercent}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-slate-600">
                    {item.acousticReason}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Acoustic Summary & Radar Grid */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-white p-6 shadow-xs lg:col-span-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">
                สรุปลักษณะเสียงไอที่ตรวจพบ
              </h2>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                ความยาวบันทึก {m.durationSec.toFixed(1)} วินาที
              </span>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-base">
              {result.vocalSummary}
            </p>

            <p className="mt-3 text-xs font-medium text-sky-800">
              {result.voiceCharacteristicTags.join('  ·  ')}
            </p>
          </div>

          {/* Real Measured Cough Acoustic Metrics */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-sky-100 bg-[#F8FBFF] p-3.5">
              <p className="text-xs text-slate-500">จำนวนระลอกเสียงไอ</p>
              <p className="font-mono tabular-nums mt-1 text-xl font-bold text-slate-900">
                {burstCount}{' '}
                <span className="text-xs font-normal text-slate-500">ครั้ง</span>
              </p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-[#F8FBFF] p-3.5">
              <p className="text-xs text-slate-500">ความถี่สเปกตรัม (Centroid)</p>
              <p className="font-mono tabular-nums mt-1 text-xl font-bold text-slate-900">
                {Math.round(m.spectralCentroidHz)}{' '}
                <span className="text-xs font-normal text-slate-500">Hz</span>
              </p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-[#F8FBFF] p-3.5">
              <p className="text-xs text-slate-500">ความดังสูงสุด (Peak)</p>
              <p className="font-mono tabular-nums mt-1 text-xl font-bold text-slate-900">
                {peakDb.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">dBFS</span>
              </p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-[#F8FBFF] p-3.5">
              <p className="text-xs text-slate-500">ความถี่เด่น (Resonance)</p>
              <p className="font-mono tabular-nums mt-1 text-xl font-bold text-slate-900">
                {Math.round(m.fundamentalFreqHz)}{' '}
                <span className="text-xs font-normal text-slate-500">Hz</span>
              </p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-[#F8FBFF] p-3.5">
              <p className="text-xs text-slate-500">ระยะเวลาสลายเสียงไอ</p>
              <p className="font-mono tabular-nums mt-1 text-xl font-bold text-slate-900">
                {decayMs}{' '}
                <span className="text-xs font-normal text-slate-500">ms</span>
              </p>
            </div>

            <div className="rounded-xl border border-sky-100 bg-[#F8FBFF] p-3.5">
              <p className="text-xs text-slate-500">ความปั่นป่วนเสียง (Shimmer)</p>
              <p className="font-mono tabular-nums mt-1 text-xl font-bold text-slate-900">
                {m.shimmerPercent.toFixed(1)}{' '}
                <span className="text-xs font-normal text-slate-500">%</span>
              </p>
            </div>
          </div>

          {/* Captured Waveform Snapshot */}
          <div className="mt-5 rounded-xl border border-sky-100 bg-[#F8FBFF] px-4 py-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
              <span>รูปแบบคลื่นเสียงไอที่วิเคราะห์</span>
              <span className="font-mono tabular-nums">
                Jitter {m.jitterPercent.toFixed(2)}% · Avg {m.averageVolumeDb.toFixed(1)} dBFS
              </span>
            </div>
            <div className="flex h-10 items-center gap-[2px]">
              {m.waveformPeaks.map((peak, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-full bg-sky-500/80"
                  style={{ height: `${Math.max(12, Math.round(peak * 100))}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Acoustic Radar Chart */}
        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-white p-6 shadow-xs lg:col-span-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              แผนภาพโปรไฟล์เสียงไอ 5 มิติ
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              แสดงสมดุลความถี่ แรงกระแทก ระยะเวลาสลายตัว และความปั่นป่วนของเสียงไอ
            </p>
          </div>
          <div className="my-4">
            <CoughAcousticRadarChart result={result} />
          </div>
          <p className="border-t border-sky-50 pt-3 text-xs text-slate-500">
            ความแปรปรวนความถี่เด่น ±{m.pitchStabilityHz.toFixed(1)} Hz
          </p>
        </div>
      </section>

      {/* Comparison Bar Chart + Detailed Condition Breakdown */}
      <section className="mt-8 rounded-2xl border border-sky-100 bg-white p-6 shadow-xs sm:p-8">
        <div>
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
            ผลการประเมินความเป็นไปได้เบื้องต้นแยกตามกลุ่มอาการ
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            เปรียบเทียบความสอดคล้องในรูปแบบเปอร์เซ็นต์ (%) พร้อมระดับความเสี่ยงและคำอธิบายประกอบ
          </p>
        </div>

        {/* Visual Comparison Overview Bars */}
        <div className="mt-6 rounded-xl border border-sky-100 bg-[#F8FBFF] p-5">
          <p className="mb-4 text-xs font-semibold text-slate-700">
            กราฟเปรียบเทียบระดับความเป็นไปได้แต่ละรายการ (Comparison Chart)
          </p>
          <div className="space-y-3.5">
            {result.conditions.map((cond) => {
              const risk = getRiskMeta(cond.riskLevel);
              return (
                <div key={cond.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12">
                  <div className="truncate text-xs font-medium text-slate-800 sm:col-span-5 sm:text-sm">
                    {cond.name}
                  </div>
                  <div className="sm:col-span-5">
                    <div className="h-3 w-full overflow-hidden rounded-full bg-sky-100">
                      <div
                        className={`h-full rounded-full ${risk.barColor} transition-all duration-500`}
                        style={{ width: `${cond.probabilityPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:col-span-2 sm:justify-end sm:gap-2">
                    <span className={`font-mono tabular-nums text-sm font-bold ${risk.textColor}`}>
                      {cond.probabilityPercent}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detailed Condition Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4">
          {result.conditions.map((cond) => {
            const risk = getRiskMeta(cond.riskLevel);
            const RiskIcon = risk.Icon;

            return (
              <article
                key={cond.id}
                className="rounded-xl border border-sky-100 bg-white p-5 transition-colors hover:border-sky-200"
              >
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                      {cond.name}
                    </h3>
                    <p className="text-xs font-medium text-slate-500">
                      {cond.englishName}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${risk.bgColor} ${risk.borderColor} ${risk.textColor}`}
                    >
                      <RiskIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{risk.label}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-500">ความเป็นไปได้</span>
                      <p className={`font-mono tabular-nums text-2xl font-bold leading-none ${risk.textColor}`}>
                        {cond.probabilityPercent}%
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${risk.barColor}`}
                    style={{ width: `${cond.probabilityPercent}%` }}
                  />
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-700">
                  {cond.explanation}
                </p>

                {cond.observedAcousticSignals.length > 0 && (
                  <p className="mt-2.5 font-mono text-xs text-slate-500">
                    สัญญาณอ้างอิง: {cond.observedAcousticSignals.join('  ·  ')}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </section>

      {/* Bottom Action Bar */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRecordAgain}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>วิเคราะห์เสียงใหม่</span>
          </button>

          <button
            type="button"
            onClick={onOpenHealthGuide}
            className="inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100"
          >
            <HeartPulse className="h-4 w-4" aria-hidden="true" />
            <span>คำแนะนำเกี่ยวกับสุขภาพ</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>กลับไปหน้าแรก</span>
        </button>
      </div>
    </div>
  );
}
