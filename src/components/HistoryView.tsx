import { Download, Eye, History, Mic, Trash2 } from 'lucide-react';
import { SavedAnalysisRecord } from '../types/voiceHealth';
import { downloadAnalysisPdf } from '../utils/pdfReport';

interface HistoryViewProps {
  records: SavedAnalysisRecord[];
  onSelectRecord: (record: SavedAnalysisRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onStartRecording: () => void;
}

export function HistoryView({
  records,
  onSelectRecord,
  onDeleteRecord,
  onClearAll,
  onStartRecording,
}: HistoryViewProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            ประวัติการวิเคราะห์เสียงไอย้อนหลัง
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            ข้อมูลถูกจัดเก็บไว้ในเบราว์เซอร์ของคุณเท่านั้นเพื่อความเป็นส่วนตัวสูงสุด สามารถเปิดดูหรือลบออกได้ทุกเมื่อ
          </p>
        </div>

        <div className="flex items-center gap-3">
          {records.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>ล้างประวัติทั้งหมด</span>
            </button>
          )}
          <button
            type="button"
            onClick={onStartRecording}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            <span>บันทึกเสียงไอใหม่</span>
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <div className="rounded-2xl border border-sky-100 bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-sky-50 text-sky-600">
            <History className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-slate-900">
            ยังไม่มีประวัติการวิเคราะห์เสียงไอที่บันทึกไว้
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            เมื่อคุณทำการบันทึกเสียงไอและจำแนกผลเสร็จสิ้น สามารถกดปุ่ม &ldquo;บันทึกผลการวิเคราะห์&rdquo; เพื่อเก็บไว้ติดตามอาการได้ที่นี่
          </p>
          <button
            type="button"
            onClick={onStartRecording}
            className="mt-6 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            <span>เริ่มต้นบันทึกเสียงไอครั้งแรก</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {records.map((rec) => {
            const top = rec.conditions[0];
            const dateStr = new Date(rec.analyzedAt).toLocaleString('th-TH', {
              dateStyle: 'medium',
              timeStyle: 'short',
            });
            const burstCount = rec.acousticMetrics.coughBurstCount ?? 1;

            return (
              <div
                key={rec.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-sky-100 bg-white p-5 shadow-xs transition-colors hover:border-sky-200 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-slate-500">
                    {dateStr} · ตรวจพบ {burstCount} ระลอกไอ · Centroid{' '}
                    <span className="font-mono tabular-nums">
                      {Math.round(rec.acousticMetrics.spectralCentroidHz)} Hz
                    </span>
                  </p>
                  <h2 className="mt-1 truncate text-base font-bold text-slate-900">
                    {rec.coughClassification || (top ? top.name : rec.label)}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-600">
                    {rec.vocalSummary}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {top && (
                    <div className="mr-2 text-right">
                      <span className="block text-[11px] text-slate-500">
                        {top.name.slice(0, 18)}...
                      </span>
                      <span className="font-mono tabular-nums text-lg font-bold text-sky-700">
                        {top.probabilityPercent}%
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectRecord(rec)}
                    className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    <span>ดูรายละเอียด</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadAnalysisPdf(rec)}
                    aria-label="ดาวน์โหลดรายงาน PDF"
                    className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-sky-50"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteRecord(rec.id)}
                    aria-label="ลบรายการนี้"
                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
