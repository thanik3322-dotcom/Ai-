import { useState } from 'react';
import {
  Activity,
  AudioWaveform,
  FileText,
  HeartPulse,
  History,
  Mic,
  QrCode,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { COUGH_PROTOTYPES } from '../data/coughPrototypes';
import { AppView } from '../types/voiceHealth';

interface HomeViewProps {
  historyCount: number;
  onStartRecording: () => void;
  onNavigate: (view: AppView) => void;
  onOpenShare: () => void;
}

export function HomeView({
  historyCount,
  onStartRecording,
  onNavigate,
  onOpenShare,
}: HomeViewProps) {
  const [heroImgError, setHeroImgError] = useState(false);
  const [biometricsImgError, setBiometricsImgError] = useState(false);

  const acousticDimensions = [
    {
      code: 'Burst Count · Cough Events',
      title: 'จำนวนระลอกและจังหวะการไอ',
      range: '1 – 5 ระลอก/คลิป',
      desc: 'ตรวจจับจำนวนครั้งของการไอและช่วงห่างระหว่างแต่ละระลอกการไอแบบอัตโนมัติ',
      icon: AudioWaveform,
    },
    {
      code: 'Centroid · Wet / Dry Timbre',
      title: 'ความถี่เด่นและความทุ้ม-แหลม',
      range: '450 – 3,800 Hz',
      desc: 'จำแนกความคมของเสียงไอแห้งกับเสียงสั่นก้องในช่วงความถี่กลาง-ต่ำของเสมหะ',
      icon: Activity,
    },
    {
      code: 'Peak Energy · Explosive Phase',
      title: 'แรงกระแทกและความดังของเสียงไอ',
      range: '-35 – -3 dBFS',
      desc: 'วัดระดับพลังงานสูงสุดในช่วงระเบิดลมหายใจและการคงตัวของพลังงานหลังไอ',
      icon: HeartPulse,
    },
    {
      code: 'Decay · Airway Turbulence',
      title: 'ระยะเวลาสลายตัวและลมแทรก',
      range: '150 – 550 ms',
      desc: 'ประเมินความปั่นป่วนของคลื่นเสียงและเสียงหวีดแทรกในหลอดลมช่วงท้ายการไอ',
      icon: Stethoscope,
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'อนุญาตไมโครโฟนและบันทึกเสียงไอ',
      description:
        'ระบบขอสิทธิ์ใช้งานไมโครโฟนอย่างโปร่งใส ให้คุณไอ 2–3 ครั้งห่างจากไมค์ประมาณ 15–20 ซม. พร้อมกราฟคลื่นเสียงเรียลไทม์',
    },
    {
      step: '02',
      title: 'สกัดคลื่นเสียงไอและจำแนกด้วย AI',
      description:
        'ประมวลผลจังหวะระลอกไอ ความถี่เด่น ความปั่นป่วน และส่งเสียงไอเข้าสู่ระบบ AI Backend เพื่อจำแนกลักษณะอาการ',
    },
    {
      step: '03',
      title: 'รับผลจำแนกประเภทเสียงไอและส่งออก PDF',
      description:
        'แสดงผลการจำแนก (เช่น ไอแห้ง หรือ ไอมีเสมหะ) กราฟเปรียบเทียบความเป็นไปได้ (%) ระดับความเสี่ยง และบันทึกประวัติย้อนหลัง',
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      {/* Hero Split Section */}
      <section className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-white p-6 shadow-xs sm:p-8 lg:col-span-7 lg:p-10">
          <div>
            <p className="text-sm font-medium text-sky-700">
              แพลตฟอร์มคัดกรองสุขภาพทางเดินหายใจด้วยเสียงไอ · Cough Acoustic AI
            </p>

            <h1 className="font-display mt-3 max-w-xl text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[42px] lg:leading-[1.16]">
              AI Voice Health Analyzer
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              ระบบปัญญาประดิษฐ์สำหรับวิเคราะห์เสียงไอ
              เพื่อจำแนกลักษณะอาการและประเมินความเสี่ยงความเป็นไปได้ของความผิดปกติทางเดินหายใจเบื้องต้น
              จากรูปแบบคลื่นเสียง ความถี่ แรงกระแทก และระยะเวลาสลายตัวของเสียงไอ
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={onStartRecording}
                className="inline-flex min-h-12 cursor-pointer items-center gap-2.5 whitespace-nowrap shrink-0 rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-xs transition-colors hover:bg-sky-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
                <span>เริ่มต้นวิเคราะห์เสียงไอ</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-sky-200 bg-sky-50/70 px-5 py-3 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              >
                <History className="h-4 w-4" aria-hidden="true" />
                <span>
                  {historyCount > 0
                    ? `ดูประวัติการวิเคราะห์ (${historyCount})`
                    : 'ดูประวัติการวิเคราะห์'}
                </span>
              </button>

              <button
                type="button"
                onClick={onOpenShare}
                className="inline-flex min-h-12 cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
              >
                <QrCode className="h-4 w-4 text-sky-600" aria-hidden="true" />
                <span>QR Code เปิดบนมือถือ</span>
              </button>
            </div>
          </div>

          {/* Non-diagnostic medical notice */}
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-sky-100 bg-[#F4F9FF] p-4">
            <ShieldCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-sky-700"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-slate-600 sm:text-sm">
              <span className="font-semibold text-slate-800">
                ข้อกำหนดความปลอดภัยทางการแพทย์:
              </span>{' '}
              ผลลัพธ์เป็นการจำแนกลักษณะเสียงไอและประเมินความเป็นไปได้เบื้องต้นเท่านั้น
              ไม่ใช่การวินิจฉัยโรคทางการแพทย์ เสียงไอที่บันทึกจะถูกประมวลผลชั่วคราวโดยคำนึงถึงความเป็นส่วนตัวสูงสุด
            </p>
          </div>
        </div>

        {/* Hero Visual Card */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xs lg:col-span-5">
          <div className="relative flex-1 overflow-hidden bg-[#EBF4FF]">
            {!heroImgError ? (
              <img
                src="/src/assets/images/hero_voice_analyzer_1794550696766.jpg"
                alt="ภาพประกอบระบบปัญญาประดิษฐ์วิเคราะห์คลื่นเสียงไอทางการแพทย์ AI Voice Health Analyzer"
                referrerPolicy="no-referrer"
                onError={() => setHeroImgError(true)}
                className="h-64 w-full object-cover sm:h-80 lg:h-full"
              />
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-white p-8 text-center lg:h-full">
                <AudioWaveform className="h-14 w-14 text-sky-600" aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-sky-900">
                  AI Cough Acoustic Classifier
                </p>
              </div>
            )}
          </div>
          <div className="border-t border-sky-100 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-4 text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                จำแนกลักษณะเสียงไอด้วย Web Audio & AI
              </span>
              <span className="font-mono tabular-nums text-sky-700">
                Cough Burst Telemetry
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Acoustic Parameters Strip */}
      <section aria-labelledby="acoustic-metrics-heading" className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="acoustic-metrics-heading"
            className="text-lg font-semibold text-slate-900 sm:text-xl"
          >
            ตัวชี้วัดสัญญาณเสียงไอที่ระบบตรวจวิเคราะห์เพื่อจำแนก
          </h2>
          <span className="text-xs text-slate-500">
            การสกัดคุณลักษณะคลื่นเสียงไอแบบเรียลไทม์บนเบราว์เซอร์
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {acousticDimensions.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.code}
                className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-white p-5 shadow-xs transition-colors hover:border-sky-200"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-medium text-sky-700">
                      {item.code}
                    </span>
                    <Icon className="h-4 w-4 shrink-0 text-sky-600" aria-hidden="true" />
                  </div>
                  <h3 className="mt-2.5 text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    {item.desc}
                  </p>
                </div>
                <div className="mt-4 border-t border-sky-50 pt-3">
                  <span className="font-mono tabular-nums text-xs font-semibold text-slate-700">
                    ช่วงอ้างอิงทั่วไป: {item.range}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 Cough Classification Prototypes Section */}
      <section aria-labelledby="cough-classes-heading" className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="cough-classes-heading"
            className="text-lg font-semibold text-slate-900 sm:text-xl"
          >
            เสียงไอต้นแบบ 3 ประเภทที่ใช้เป็นฐานในการจำแนก
          </h2>
          <button
            type="button"
            onClick={onStartRecording}
            className="cursor-pointer text-xs font-semibold text-sky-700 hover:underline"
          >
            ฟังเสียงต้นแบบและทดสอบจำแนก
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COUGH_PROTOTYPES.map((proto) => (
            <div
              key={proto.id}
              className="rounded-2xl border border-sky-100 bg-white p-5 shadow-xs"
            >
              <span className="font-mono text-xs font-semibold text-sky-700">
                0{proto.order} · {proto.englishLabel}
              </span>
              <h3 className="mt-1.5 text-base font-bold text-slate-900">
                {proto.label}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {proto.description}
              </p>
              <p className="mt-3 border-t border-sky-50 pt-2.5 text-xs text-slate-500">
                {proto.acousticCue}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works + Visual Diagram Split */}
      <section className="mt-12 grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-xs lg:col-span-5">
          {!biometricsImgError ? (
            <img
              src="/src/assets/images/vocal_biometrics_visual_1794550697440.jpg"
              alt="แผนภาพคลื่นความถี่เสียงไอและการสั่นพ้องของทางเดินหายใจ"
              referrerPolicy="no-referrer"
              onError={() => setBiometricsImgError(true)}
              className="h-64 w-full object-cover lg:h-full"
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center bg-sky-50 lg:h-full">
              <FileText className="h-12 w-12 text-sky-600" aria-hidden="true" />
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-2xl border border-sky-100 bg-white p-6 shadow-xs sm:p-8 lg:col-span-7">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
              ขั้นตอนการอัดเสียงไอและจำแนกด้วย AI
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              ออกแบบให้บันทึกเสียงไอได้สะดวกทั้งบนคอมพิวเตอร์ แท็บเล็ต และสมาร์ตโฟน พร้อมความเป็นส่วนตัวของข้อมูล
            </p>

            <div className="mt-6 divide-y divide-sky-100">
              {workflowSteps.map((s) => (
                <div key={s.step} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <span className="font-mono tabular-nums flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EBF4FF] text-sm font-semibold text-sky-700">
                    {s.step}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-sky-100 pt-5">
            <button
              type="button"
              onClick={() => onNavigate('health-guide')}
              className="cursor-pointer whitespace-nowrap text-sm font-semibold text-sky-700 underline-offset-4 hover:underline"
            >
              อ่านคำแนะนำการดูแลอาการไอ
            </button>
            <button
              type="button"
              onClick={onStartRecording}
              className="cursor-pointer whitespace-nowrap shrink-0 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
            >
              ไปหน้าบันทึกเสียงไอ
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
