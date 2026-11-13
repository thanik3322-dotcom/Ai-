import { Activity, AudioWaveform, BrainCircuit, Gauge, Timer, Volume2 } from 'lucide-react';

interface AnalyzingViewProps {
  progress: number;
  stageLabel: string;
}

export function AnalyzingView({ progress, stageLabel }: AnalyzingViewProps) {
  const parameters = [
    {
      icon: AudioWaveform,
      title: 'ตรวจจับระลอกและจังหวะการไอ (Cough Burst Detection)',
      detail: 'แยกจำนวนครั้งของการไอและช่วงพักลมหายใจออกจากเสียงพื้นหลัง',
      activeAt: 15,
    },
    {
      icon: Volume2,
      title: 'แรงกระแทกและความดังสูงสุด (Peak Intensity dBFS)',
      detail: 'วัดระดับพลังงานในช่วงการระเบิดลมหายใจขณะไอ',
      activeAt: 32,
    },
    {
      icon: Activity,
      title: 'ความถี่เด่นและสเปกตรัมเสียง (Spectral Centroid & Pitch)',
      detail: 'แยกความคมของไอแห้งและความก้องช่วงต่ำ-กลางของไอมีเสมหะ',
      activeAt: 50,
    },
    {
      icon: Timer,
      title: 'ระยะเวลาการสลายตัวของเสียงไอ (Decay Duration)',
      detail: 'ประเมินความยาวคลื่นเสียงช่วงปลายและเสียงหวีดแทรกในหลอดลม',
      activeAt: 68,
    },
    {
      icon: Gauge,
      title: 'จำแนกประเภทเสียงไอด้วย AI (Cough Classification)',
      detail: 'เปรียบเทียบรูปแบบเสียงเพื่อจำแนกประเภทและประเมินความเสี่ยงเบื้องต้น',
      activeAt: 84,
    },
  ];

  const clampedProgress = Math.max(4, Math.min(100, Math.round(progress)));

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-sky-100 bg-white p-6 shadow-xs sm:p-10">
        {/* AI Acoustic Scan Animation */}
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-28 w-28 items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-sky-200 bg-sky-50/70 animate-ping"
              style={{ animationDuration: '2.2s' }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-3 rounded-full border border-sky-300 bg-sky-100/60"
            />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-sky-600 text-white shadow-sm">
              <BrainCircuit className="h-8 w-8" aria-hidden="true" />
            </div>
          </div>

          <h1 className="font-display mt-6 text-balance text-xl font-bold text-slate-900 sm:text-2xl">
            AI กำลังประมวลผลและวิเคราะห์ลักษณะเสียงไอของคุณ...
          </h1>
          <p className="mt-2 text-sm text-slate-600">{stageLabel}</p>
        </div>

        {/* Progress Bar */}
        <div className="mt-8">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>ความคืบหน้าการจำแนกเสียงไอ</span>
            <span className="font-mono tabular-nums text-sky-700">
              {clampedProgress}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={clampedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-3 w-full overflow-hidden rounded-full bg-[#EBF4FF]"
          >
            <div
              className="h-full rounded-full bg-sky-600 transition-[width] duration-300 ease-out"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
        </div>

        {/* Analyzed Cough Characteristics Checklist */}
        <div className="mt-8 divide-y divide-sky-100 rounded-xl border border-sky-100 bg-[#F8FBFF] px-4 py-2 sm:px-5">
          {parameters.map((param) => {
            const Icon = param.icon;
            const completed = clampedProgress >= param.activeAt + 14;
            const inProgress =
              !completed && clampedProgress >= param.activeAt;

            return (
              <div
                key={param.title}
                className="flex items-center justify-between gap-4 py-3.5"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      completed
                        ? 'bg-sky-600 text-white'
                        : inProgress
                        ? 'bg-sky-100 text-sky-700'
                        : 'border border-sky-100 bg-white text-slate-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {param.title}
                    </p>
                    <p className="text-xs text-slate-500">{param.detail}</p>
                  </div>
                </div>

                <span
                  className={`font-mono shrink-0 text-xs font-medium ${
                    completed
                      ? 'text-sky-700'
                      : inProgress
                      ? 'text-amber-600'
                      : 'text-slate-400'
                  }`}
                >
                  {completed
                    ? 'เสร็จสิ้น'
                    : inProgress
                    ? 'กำลังวิเคราะห์'
                    : 'รอดำเนินการ'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
