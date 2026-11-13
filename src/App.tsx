import { useEffect, useState } from 'react';
import { AnalyzingView } from './components/AnalyzingView';
import { HealthGuideView } from './components/HealthGuideView';
import { HistoryView } from './components/HistoryView';
import { HomeView } from './components/HomeView';
import { Navbar } from './components/Navbar';
import { RecordingView } from './components/RecordingView';
import { ResultsView } from './components/ResultsView';
import { ShareModal } from './components/ShareModal';
import {
  AppView,
  SavedAnalysisRecord,
  VoiceAnalysisResult,
} from './types/voiceHealth';
import { blobToBase64, extractAcousticMetrics } from './utils/audioAnalyzer';
import {
  clearAllHistory,
  deleteHistoryRecord,
  loadAnalysisHistory,
  saveAnalysisToHistory,
} from './utils/historyStorage';

function getInitialViewFromUrl(): AppView {
  if (typeof window === 'undefined') return 'home';
  const param = new URLSearchParams(window.location.search).get('view');
  if (param === 'record' || param === 'history' || param === 'health-guide') {
    return param;
  }
  return 'home';
}

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>(() =>
    getInitialViewFromUrl()
  );
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('กำลังเตรียมข้อมูลสัญญาณเสียงไอ...');
  const [currentResult, setCurrentResult] = useState<VoiceAnalysisResult | null>(null);
  const [historyRecords, setHistoryRecords] = useState<SavedAnalysisRecord[]>(() =>
    loadAnalysisHistory()
  );
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<'home' | 'record'>('record');
  const [serverAppUrl, setServerAppUrl] = useState<string>('');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { appUrl?: string } | null) => {
        if (data?.appUrl) {
          setServerAppUrl(data.appUrl);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentView]);

  const openShareModal = (target: 'home' | 'record' = 'record') => {
    setShareTarget(target);
    setShareOpen(true);
  };

  const handleAnalyzeAudio = async (
    audioBlob: Blob,
    promptType: string,
    inputSource: 'microphone' | 'reference-sample' = 'microphone'
  ) => {
    setAnalysisError(null);
    setCurrentView('analyzing');
    setAnalysisProgress(12);
    setAnalysisStage('กำลังถอดรหัสสัญญาณเสียงไอผ่าน Web Audio API...');

    try {
      const metrics = await extractAcousticMetrics(audioBlob);
      setAnalysisProgress(42);
      setAnalysisStage('กำลังตรวจจับระลอกไอ ความถี่สเปกตรัม และระยะสลายเสียง...');

      const audioBase64 = await blobToBase64(audioBlob);
      setAnalysisProgress(65);
      setAnalysisStage('กำลังเทียบเคียงเสียงไอกับต้นแบบ 3 ประเภทบน Backend...');

      // Smooth visual progress while awaiting backend AI inference
      const progressTicker = window.setInterval(() => {
        setAnalysisProgress((prev) => (prev < 92 ? prev + 3 : prev));
      }, 320);

      try {
        const response = await fetch('/api/analyze-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            mimeType: audioBlob.type || 'audio/webm',
            promptType,
            inputSource,
            metrics,
          }),
        });

        window.clearInterval(progressTicker);

        if (!response.ok) {
          throw new Error('ไม่สามารถประมวลผลเสียงบนเซิร์ฟเวอร์ได้');
        }

        const data = (await response.json()) as VoiceAnalysisResult;
        setAnalysisProgress(100);
        setAnalysisStage('จัดทำรายงานผลเบื้องต้นเสร็จสมบูรณ์');

        window.setTimeout(() => {
          setCurrentResult(data);
          setCurrentView('results');
        }, 350);
      } catch (err) {
        window.clearInterval(progressTicker);
        throw err;
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'เกิดข้อผิดพลาดระหว่างการวิเคราะห์เสียง กรุณาลองบันทึกใหม่อีกครั้ง';
      setAnalysisError(message);
      setCurrentView('record');
    }
  };

  const handleSaveResult = (result: VoiceAnalysisResult) => {
    const updated = saveAnalysisToHistory(result);
    setHistoryRecords(updated);
  };

  const handleDeleteRecord = (id: string) => {
    const updated = deleteHistoryRecord(id);
    setHistoryRecords(updated);
  };

  const handleClearAllHistory = () => {
    const updated = clearAllHistory();
    setHistoryRecords(updated);
  };

  const isCurrentSaved = currentResult
    ? historyRecords.some((r) => r.id === currentResult.id)
    : false;

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F9FF] text-slate-900">
      <Navbar
        currentView={currentView}
        historyCount={historyRecords.length}
        onNavigate={(view) => {
          setAnalysisError(null);
          setCurrentView(view);
        }}
      />

      <main className="flex-1">
        {analysisError && currentView === 'record' && (
          <div className="mx-auto mt-6 max-w-4xl px-4 sm:px-6 lg:px-8">
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              {analysisError}
            </div>
          </div>
        )}

        {currentView === 'home' && (
          <HomeView
            historyCount={historyRecords.length}
            onStartRecording={() => setCurrentView('record')}
            onNavigate={(view) => setCurrentView(view)}
            onOpenShare={() => openShareModal('record')}
          />
        )}

        {currentView === 'record' && (
          <RecordingView
            onBackHome={() => setCurrentView('home')}
            onAnalyzeAudio={handleAnalyzeAudio}
            onOpenShare={() => openShareModal('record')}
          />
        )}

        {currentView === 'analyzing' && (
          <AnalyzingView
            progress={analysisProgress}
            stageLabel={analysisStage}
          />
        )}

        {currentView === 'results' && currentResult && (
          <ResultsView
            result={currentResult}
            isSaved={isCurrentSaved}
            onSaveResult={handleSaveResult}
            onBackHome={() => setCurrentView('home')}
            onRecordAgain={() => setCurrentView('record')}
            onOpenHealthGuide={() => setCurrentView('health-guide')}
          />
        )}

        {currentView === 'history' && (
          <HistoryView
            records={historyRecords}
            onSelectRecord={(record) => {
              setCurrentResult(record);
              setCurrentView('results');
            }}
            onDeleteRecord={handleDeleteRecord}
            onClearAll={handleClearAllHistory}
            onStartRecording={() => setCurrentView('record')}
          />
        )}

        {currentView === 'health-guide' && (
          <HealthGuideView
            latestResult={currentResult}
            onStartRecording={() => setCurrentView('record')}
            onBackToResult={
              currentResult ? () => setCurrentView('results') : undefined
            }
          />
        )}
      </main>

      <footer className="border-t border-sky-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>
            AI Voice Health Analyzer · เพื่อการคัดกรองเบื้องต้นและการศึกษาเท่านั้น ไม่ใช่การวินิจฉัยโรคทางการแพทย์
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => openShareModal('record')}
              className="cursor-pointer font-medium text-sky-700 hover:underline"
            >
              ลิงก์และ QR Code มือถือ
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('health-guide')}
              className="cursor-pointer hover:text-sky-700 hover:underline"
            >
              คำแนะนำสุขภาพ
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('history')}
              className="cursor-pointer hover:text-sky-700 hover:underline"
            >
              ประวัติการวิเคราะห์
            </button>
          </div>
        </div>
      </footer>

      <ShareModal
        isOpen={shareOpen}
        initialTarget={shareTarget}
        serverAppUrl={serverAppUrl}
        onClose={() => setShareOpen(false)}
      />
    </div>
  );
}
