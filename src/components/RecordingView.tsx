import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  AudioWaveform,
  FlaskConical,
  Lock,
  Mic,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  Sparkles,
  Square,
  Volume2,
} from 'lucide-react';
import { COUGH_PROTOTYPES, CoughPrototypeInfo } from '../data/coughPrototypes';

interface RecordingViewProps {
  onBackHome: () => void;
  onAnalyzeAudio: (
    audioBlob: Blob,
    promptType: string,
    inputSource?: 'microphone' | 'reference-sample'
  ) => void;
  onOpenShare: () => void;
}

const COUGH_PROTOCOLS = [
  {
    id: 'voluntary-3-coughs',
    label: 'ไอปกติ 2–3 ครั้ง',
    title: 'ไออย่างเป็นธรรมชาติ 2–3 ครั้ง (เว้นช่วงสั้นๆ ระหว่างครั้ง)',
    guide:
      'ถืออุปกรณ์หรือไมโครโฟนห่างจากปากประมาณ 15–20 ซม. ในห้องที่เงียบ แล้วไอเบาๆ ถึงปานกลาง 2–3 ครั้ง',
  },
  {
    id: 'deep-chest-cough',
    label: 'ไอลึกจากหน้าอก',
    title: 'หายใจเข้าลึกแล้วไอออกจากหน้าอก 1–2 ครั้ง',
    guide:
      'ช่วยให้ระบบจำแนกความแตกต่างระหว่างเสียงไอแห้ง เสียงไอมีเสมหะ และจังหวะไอกรนได้ชัดเจนขึ้น',
  },
  {
    id: 'spontaneous-cough',
    label: 'บันทึกอาการไอต่อเนื่อง',
    title: 'บันทึกเสียงไอเมื่อมีอาการจริง 3–6 วินาที',
    guide:
      'เหมาะสำหรับผู้ที่มีอาการไอเป็นชุดหรือไอบ่อย กดเริ่มบันทึกแล้วไอตามอาการที่เกิดขึ้นจริง',
  },
];

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function RecordingView({
  onBackHome,
  onAnalyzeAudio,
  onOpenShare,
}: RecordingViewProps) {
  const [selectedPromptId, setSelectedPromptId] = useState(COUGH_PROTOCOLS[0].id);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [liveDb, setLiveDb] = useState(-60);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [playingPrototypeId, setPlayingPrototypeId] = useState<string | null>(null);
  const [loadingPrototypeId, setLoadingPrototypeId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const prototypeAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const selectedPrompt =
    COUGH_PROTOCOLS.find((p) => p.id === selectedPromptId) || COUGH_PROTOCOLS[0];

  const drawIdleWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    ctx.strokeStyle = '#DCE8F5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    const barCount = 48;
    const gap = width / barCount;
    ctx.fillStyle = '#BAE6FD';
    for (let i = 0; i < barCount; i++) {
      const h = 6 + Math.sin(i * 0.35) * 4;
      const x = i * gap + gap * 0.25;
      const w = Math.max(2, gap * 0.5);
      ctx.beginPath();
      ctx.roundRect(x, height / 2 - h / 2, w, h, 2);
      ctx.fill();
    }
    ctx.restore();
  };

  useEffect(() => {
    drawIdleWaveform();
    return () => {
      stopMediaResources();
      if (prototypeAudioRef.current) {
        prototypeAudioRef.current.pause();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const stopMediaResources = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerIntervalRef.current !== null) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  const renderLiveWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.fftSize;
    const timeData = new Float32Array(bufferLength);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const drawFrame = () => {
      if (!analyserRef.current) return;

      analyser.getFloatTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        sumSq += timeData[i] * timeData[i];
      }
      const rms = Math.sqrt(sumSq / timeData.length);
      const db = Math.max(-60, Math.min(0, Math.round(20 * Math.log10(Math.max(rms, 1e-4)))));
      setLiveDb(db);

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      const barCount = 48;
      const barGap = width / barCount;
      for (let i = 0; i < barCount; i++) {
        const binIndex = Math.min(
          freqData.length - 1,
          Math.floor((i / barCount) * (freqData.length * 0.5))
        );
        const norm = freqData[binIndex] / 255;
        const barHeight = Math.max(6, norm * (height * 0.78));
        const x = i * barGap + barGap * 0.24;
        const w = Math.max(2, barGap * 0.52);

        ctx.fillStyle = norm > 0.55 ? '#0284C7' : '#7DD3FC';
        ctx.beginPath();
        ctx.roundRect(x, height / 2 - barHeight / 2, w, barHeight, 3);
        ctx.fill();
      }

      ctx.strokeStyle = '#0369A1';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sliceWidth = width / timeData.length;
      let x = 0;
      for (let i = 0; i < timeData.length; i++) {
        const y = height / 2 + timeData[i] * (height * 0.44);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();

      ctx.restore();
      animFrameRef.current = requestAnimationFrame(drawFrame);
    };

    animFrameRef.current = requestAnimationFrame(drawFrame);
  };

  const startRecording = async () => {
    setErrorMessage(null);
    if (prototypeAudioRef.current) {
      prototypeAudioRef.current.pause();
      setPlayingPrototypeId(null);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage(
        'เบราว์เซอร์ของคุณไม่รองรับการบันทึกเสียงผ่านไมโครโฟน กรุณาใช้ Chrome, Edge, Safari หรือ Firefox รุ่นล่าสุด'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      setConsentAccepted(true);
      mediaStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      analyserRef.current = analyser;

      const preferredTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (recordedUrl) {
          URL.revokeObjectURL(recordedUrl);
        }
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setIsPlaying(false);
        setPlaybackProgress(0);
        stopMediaResources();
        drawIdleWaveform();
      };

      mediaRecorderRef.current = recorder;
      recorder.start(120);
      setRecordedBlob(null);
      setElapsedSeconds(0);
      setIsRecording(true);

      const startedAt = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startedAt) / 1000);
        setElapsedSeconds(secs);
      }, 250);

      renderLiveWaveform();
    } catch (err) {
      stopMediaResources();
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setErrorMessage(
          'ไม่ได้รับอนุญาตให้เข้าถึงไมโครโฟน กรุณากดอนุญาตสิทธิ์ไมโครโฟนที่แถบที่อยู่ของเบราว์เซอร์แล้วลองใหม่อีกครั้ง'
        );
      } else if (name === 'NotFoundError') {
        setErrorMessage(
          'ไม่พบอุปกรณ์ไมโครโฟนที่เชื่อมต่ออยู่ กรุณาตรวจสอบไมโครโฟน หรือทดลองทดสอบการจำแนกด้วยไฟล์เสียงต้นแบบด้านล่าง'
        );
      } else {
        setErrorMessage('ไม่สามารถเปิดใช้งานไมโครโฟนได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const resetRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setElapsedSeconds(0);
    setIsPlaying(false);
    setPlaybackProgress(0);
    setErrorMessage(null);
    drawIdleWaveform();
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !recordedUrl) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setErrorMessage('ไม่สามารถเล่นไฟล์เสียงไอที่บันทึกได้');
      }
    }
  };

  const handleAnalyzeClick = () => {
    if (!recordedBlob) return;
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    onAnalyzeAudio(recordedBlob, selectedPrompt.title, 'microphone');
  };

  const togglePrototypePlayback = async (proto: CoughPrototypeInfo) => {
    setErrorMessage(null);
    if (playingPrototypeId === proto.id && prototypeAudioRef.current) {
      prototypeAudioRef.current.pause();
      setPlayingPrototypeId(null);
      return;
    }

    if (prototypeAudioRef.current) {
      prototypeAudioRef.current.pause();
    }

    const audio = new Audio(proto.audioUrl);
    prototypeAudioRef.current = audio;
    audio.onended = () => setPlayingPrototypeId(null);
    audio.onerror = () => {
      setPlayingPrototypeId(null);
      setErrorMessage(`ไม่สามารถเล่นไฟล์เสียงต้นแบบ "${proto.label}" ได้`);
    };

    try {
      setPlayingPrototypeId(proto.id);
      await audio.play();
    } catch {
      setPlayingPrototypeId(null);
      setErrorMessage(`ไม่สามารถเล่นไฟล์เสียงต้นแบบ "${proto.label}" ได้`);
    }
  };

  const handleAnalyzePrototype = async (proto: CoughPrototypeInfo) => {
    setErrorMessage(null);
    setLoadingPrototypeId(proto.id);
    if (prototypeAudioRef.current) {
      prototypeAudioRef.current.pause();
      setPlayingPrototypeId(null);
    }
    try {
      const response = await fetch(proto.audioUrl);
      if (!response.ok) {
        throw new Error('ไม่สามารถโหลดไฟล์เสียงต้นแบบได้');
      }
      const wavBlob = await response.blob();
      onAnalyzeAudio(
        wavBlob,
        `ทดสอบจากไฟล์ต้นแบบลำดับที่ ${proto.order}: ${proto.label}`,
        'reference-sample'
      );
    } catch {
      setErrorMessage(`ไม่สามารถส่งไฟล์ต้นแบบ "${proto.label}" เข้าวิเคราะห์ได้`);
      setLoadingPrototypeId(null);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Breadcrumb / Back Action */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            if (isRecording) stopRecording();
            onBackHome();
          }}
          className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-sky-100 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>กลับไปหน้าแรก</span>
        </button>

        <button
          type="button"
          onClick={onOpenShare}
          className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg border border-sky-200 bg-sky-50/70 px-3.5 py-2 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-100 sm:text-sm"
        >
          <QrCode className="h-4 w-4 text-sky-600" aria-hidden="true" />
          <span>เปิดบนมือถือ (QR Code)</span>
        </button>
      </div>

      {/* Main Recording Card */}
      <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-xs sm:p-8">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            บันทึกเสียงไอเพื่อวิเคราะห์และจำแนก
          </h1>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">
            เลือกรูปแบบการไอที่ต้องการทดสอบ จากนั้นกดปุ่มเริ่มบันทึกเสียงแล้วไอให้ชัดเจนห่างจากไมค์ 15–20 ซม.
          </p>
        </div>

        {/* Prompt Selector Segmented Tabs */}
        <div className="mt-6">
          <div
            role="tablist"
            aria-label="เลือกรูปแบบการบันทึกเสียงไอ"
            className="grid grid-cols-1 gap-2 rounded-xl bg-[#F4F9FF] p-1.5 sm:grid-cols-3"
          >
            {COUGH_PROTOCOLS.map((item) => {
              const active = item.id === selectedPromptId;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={isRecording}
                  onClick={() => setSelectedPromptId(item.id)}
                  className={`cursor-pointer rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors sm:text-sm ${
                    active
                      ? 'bg-white text-sky-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-sky-100 bg-[#F4F9FF] px-5 py-4 text-center">
            <p className="text-sm font-semibold text-sky-900">
              {selectedPrompt.title}
            </p>
            <p className="mt-1 text-sm text-slate-600">{selectedPrompt.guide}</p>
          </div>
        </div>

        {/* Microphone Permission Notice before first capture */}
        {!consentAccepted && !recordedBlob && !isRecording && (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
            <Lock className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden="true" />
            <div className="text-xs leading-relaxed text-slate-700 sm:text-sm">
              <p className="font-semibold text-slate-900">
                การขออนุญาตเข้าถึงไมโครโฟนและความปลอดภัยในการอัดเสียงไอ
              </p>
              <p className="mt-0.5">
                เมื่อคุณกด &ldquo;เริ่มบันทึกเสียง&rdquo; เบราว์เซอร์จะขออนุญาตใช้ไมโครโฟน
                เสียงไอของคุณจะใช้เพื่อเทียบเคียงและจำแนกกับไฟล์เสียงต้นแบบชั่วคราวเท่านั้น ไม่มีการเก็บไฟล์เสียงถาวรบนเซิร์ฟเวอร์
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="mt-5 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Center Large Microphone & Status Stage */}
        <div className="mt-8 flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            {isRecording && (
              <span
                aria-hidden="true"
                className="absolute h-36 w-36 rounded-full bg-sky-200/60 animate-ping"
              />
            )}
            <button
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={Boolean(recordedBlob) && !isRecording}
              aria-label={isRecording ? 'หยุดบันทึกเสียง' : 'เริ่มบันทึกเสียง'}
              className={`relative z-10 flex h-28 w-28 cursor-pointer items-center justify-center rounded-full border-4 transition-transform active:scale-95 sm:h-32 sm:w-32 ${
                isRecording
                  ? 'border-rose-200 bg-rose-600 text-white shadow-md hover:bg-rose-700'
                  : recordedBlob
                  ? 'cursor-default border-sky-100 bg-sky-50 text-sky-600'
                  : 'border-sky-200 bg-sky-600 text-white shadow-md hover:bg-sky-700'
              }`}
            >
              {isRecording ? (
                <Square className="h-10 w-10 fill-current" aria-hidden="true" />
              ) : (
                <Mic className="h-12 w-12" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Live Status & Timer */}
          <div className="mt-5 flex flex-col items-center gap-1.5">
            {isRecording ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-rose-600 animate-pulse"
                />
                <span>กำลังบันทึกเสียงไอ...</span>
              </div>
            ) : recordedBlob ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                <AudioWaveform className="h-4 w-4 text-sky-600" aria-hidden="true" />
                <span>บันทึกเสียงไอเรียบร้อยแล้ว พร้อมฟังทวนหรือส่งจำแนก</span>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-600">
                พร้อมรับสัญญาณเสียงไอจากไมโครโฟน (แนะนำบันทึก 3–6 วินาที)
              </p>
            )}

            <div className="flex items-center gap-4 text-slate-900">
              <span className="font-mono tabular-nums text-3xl font-bold tracking-tight">
                {formatTimer(elapsedSeconds)}
              </span>
              {isRecording && (
                <span className="font-mono tabular-nums text-xs font-medium text-slate-500">
                  ระดับเสียง: {liveDb} dBFS
                </span>
              )}
            </div>
          </div>

          {/* Primary Record / Stop Button */}
          {!recordedBlob && (
            <div className="mt-6">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex min-h-12 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl bg-sky-600 px-8 py-3 text-base font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                >
                  <Mic className="h-5 w-5" aria-hidden="true" />
                  <span>เริ่มบันทึกเสียง</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex min-h-12 cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-xl bg-rose-600 px-8 py-3 text-base font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                >
                  <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                  <span>หยุดบันทึกเสียง</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Real-time Audio Waveform Canvas */}
        <div className="mt-8 rounded-xl border border-sky-100 bg-[#F8FBFF] p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium text-slate-700">
              กราฟคลื่นเสียงไอแบบเรียลไทม์ (Real-time Cough Waveform)
            </span>
            <span className="font-mono tabular-nums">
              {isRecording ? 'LIVE INPUT' : recordedBlob ? 'CAPTURED' : 'STANDBY'}
            </span>
          </div>
          <canvas
            ref={canvasRef}
            className="h-28 w-full rounded-lg bg-white"
            aria-label="กราฟคลื่นเสียงไอแบบเรียลไทม์"
          />
        </div>

        {/* Post-Recording Playback & Action Toolbar */}
        {recordedBlob && recordedUrl && (
          <div className="mt-6 rounded-xl border border-sky-200 bg-[#F4F9FF] p-5">
            <audio
              ref={audioRef}
              src={recordedUrl}
              onTimeUpdate={() => {
                const a = audioRef.current;
                if (a && a.duration && Number.isFinite(a.duration)) {
                  setPlaybackProgress((a.currentTime / a.duration) * 100);
                }
              }}
              onEnded={() => {
                setIsPlaying(false);
                setPlaybackProgress(0);
              }}
              className="hidden"
            />

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayback}
                  aria-label={isPlaying ? 'หยุดเล่นเสียงชั่วคราว' : 'เล่นเสียงไอที่บันทึก'}
                  className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-sky-200 bg-white text-sky-700 shadow-xs transition-colors hover:bg-sky-50"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Play className="h-5 w-5 translate-x-0.5" aria-hidden="true" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                    <span>ฟังเสียงไอที่บันทึกไว้ย้อนหลัง</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      ความยาว {formatTimer(elapsedSeconds)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-sky-100">
                    <div
                      className="h-full rounded-full bg-sky-600 transition-all duration-150"
                      style={{ width: `${playbackProgress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={resetRecording}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-sky-50"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>บันทึกเสียงใหม่</span>
                </button>

                <button
                  type="button"
                  onClick={handleAnalyzeClick}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-sky-700"
                >
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>วิเคราะห์เสียง</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3 Reference Cough Prototype Audios */}
      <section className="mt-8 rounded-2xl border border-sky-100 bg-white p-6 shadow-xs sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              คลังไฟล์เสียงไอต้นแบบ 3 ประเภทที่ใช้ในการจำแนก
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              ระบบใช้ไฟล์เสียงต้นแบบทั้ง 3 ไฟล์นี้เป็นฐานเทียบเคียงในการจำแนกเสียงไอ คุณสามารถกดฟังตัวอย่างหรือส่งเข้าทดสอบระบบจำแนกได้ทันที
            </p>
          </div>
          <span className="font-mono text-xs text-sky-700">16 kHz Mono WAV</span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {COUGH_PROTOTYPES.map((proto) => {
            const isProtoPlaying = playingPrototypeId === proto.id;
            const isLoading = loadingPrototypeId === proto.id;

            return (
              <div
                key={proto.id}
                className="flex flex-col justify-between rounded-xl border border-sky-100 bg-[#F8FBFF] p-4"
              >
                <div>
                  <p className="font-mono text-xs font-semibold text-sky-700">
                    ต้นแบบที่ 0{proto.order} · {proto.englishLabel}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-900">
                    {proto.label}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {proto.description}
                  </p>
                  <p className="mt-2 text-[11px] font-medium text-slate-500">
                    {proto.acousticCue}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-sky-100 pt-3">
                  <button
                    type="button"
                    disabled={isRecording}
                    onClick={() => togglePrototypePlayback(proto)}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 transition-colors hover:bg-sky-50 disabled:opacity-50"
                  >
                    {isProtoPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>หยุดฟัง</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>ฟังเสียงต้นแบบ</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isRecording || isLoading}
                    onClick={() => handleAnalyzePrototype(proto)}
                    className="inline-flex min-h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                  >
                    <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{isLoading ? 'กำลังส่ง...' : 'ทดสอบจำแนก'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
