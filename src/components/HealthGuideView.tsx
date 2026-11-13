import { ArrowLeft, Droplets, HeartPulse, Mic, ShieldAlert, Stethoscope, Wind } from 'lucide-react';
import { VoiceAnalysisResult } from '../types/voiceHealth';

interface HealthGuideViewProps {
  latestResult: VoiceAnalysisResult | null;
  onStartRecording: () => void;
  onBackToResult?: () => void;
}

export function HealthGuideView({
  latestResult,
  onStartRecording,
  onBackToResult,
}: HealthGuideViewProps) {
  const generalGuides = [
    {
      icon: Droplets,
      title: 'บรรเทาอาการไอและลดการระคายเคืองคอ',
      points: [
        'จิบน้ำอุ่นหรือน้ำสะอาดบ่อยๆ ตลอดวัน เพื่อช่วยให้เสมหะไม่เหนียวข้นและลดอาการระคายคอ',
        'หลีกเลี่ยงเครื่องดื่มเย็นจัด ของทอด หรืออาหารรสจัดในช่วงที่มีอาการไอต่อเนื่อง',
        'หากมีอาการไอแห้งตอนกลางคืน ลองหนุนหมอนให้ศีรษะสูงขึ้นเล็กน้อยเพื่อลดการไหลย้อน',
      ],
    },
    {
      icon: Wind,
      title: 'ดูแลสภาพแวดล้อมและทางเดินหายใจ',
      points: [
        'สวมหน้ากากอนามัยเมื่ออยู่ในบริเวณที่มีฝุ่น PM2.5 ควันรถ หรืออากาศเปลี่ยนแปลงฉับพลัน',
        'ปรับความชื้นในห้องนอนให้เหมาะสม ไม่อยู่ในห้องแอร์ที่แห้งหรือเย็นจัดเกินไป',
        'งดสูบบุหรี่และหลีกเลี่ยงควันบุหรี่มือสองซึ่งกระตุ้นการอักเสบของหลอดลมโดยตรง',
      ],
    },
    {
      icon: Stethoscope,
      title: 'สุขอนามัยเมื่อมีอาการไอและข้อสังเกต',
      points: [
        'ปิดปากและจมูกด้วยทิชชูหรือข้อพับแขนทุกครั้งที่ไอ และล้างมือให้สะอาดอยู่เสมอ',
        'สังเกตลักษณะเสมหะ (ใส ขาว เหลือง/เขียว) ช่วงเวลาที่ไอบ่อย และอาการร่วมเช่นไข้หรือคัดจมูก',
        'หลีกเลี่ยงการซื้อยาปฏิชีวนะรับประทานเองโดยไม่ปรึกษาแพทย์หรือเภสัชกร',
      ],
    },
  ];

  const redFlags = [
    'ไอต่อเนื่องนานเกิน 2 สัปดาห์โดยไม่ดีขึ้น หรืออาการไอรุนแรงขึ้นเรื่อยๆ',
    'มีไข้สูง หนาวสั่น หายใจหอบเหนื่อย แน่นหน้าอก หรือหายใจมีเสียงหวีด',
    'ไอมีเสมหะปนเลือด น้ำหนักลดผิดปกติ หรือเหงื่อออกมากผิดปกติในตอนกลางคืน',
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            คำแนะนำการดูแลอาการไอและสุขภาพทางเดินหายใจ
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            แนวทางดูแลตนเองเมื่อมีอาการไอแห้ง ไอมีเสมหะ และสัญญาณเตือนที่ควรเข้าพบแพทย์
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onBackToResult && (
            <button
              type="button"
              onClick={onBackToResult}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>กลับไปหน้าผลวิเคราะห์</span>
            </button>
          )}
          <button
            type="button"
            onClick={onStartRecording}
            className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            <span>บันทึกเสียงไอตรวจเช็ก</span>
          </button>
        </div>
      </div>

      {latestResult && latestResult.recommendations.length > 0 && (
        <section className="mb-8 rounded-2xl border border-sky-200 bg-[#EBF4FF] p-6">
          <div className="flex items-center gap-2 text-sky-900">
            <HeartPulse className="h-5 w-5 text-sky-700" aria-hidden="true" />
            <h2 className="text-lg font-bold">
              คำแนะนำเฉพาะจากผลจำแนกเสียงไอล่าสุด ({latestResult.coughClassification})
            </h2>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {latestResult.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-sky-100 bg-white p-4 shadow-xs"
              >
                <p className="text-xs font-semibold text-sky-700">
                  {rec.priority === 'medical'
                    ? 'ควรติดตามใกล้ชิด'
                    : rec.priority === 'attention'
                    ? 'การดูแลเพิ่มเติม'
                    : 'การดูแลประจำวัน'}
                </p>
                <h3 className="mt-1 text-sm font-bold text-slate-900">
                  {rec.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                  {rec.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {generalGuides.map((guide) => {
          const Icon = guide.icon;
          return (
            <div
              key={guide.title}
              className="rounded-2xl border border-sky-100 bg-white p-6 shadow-xs"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-base font-bold text-slate-900">
                {guide.title}
              </h2>
              <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-600">
                {guide.points.map((pt) => (
                  <li key={pt} className="flex gap-2">
                    <span className="text-sky-600" aria-hidden="true">
                      •
                    </span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <section className="mt-8 rounded-2xl border border-rose-200 bg-rose-50/70 p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-rose-700" aria-hidden="true" />
          <div>
            <h2 className="text-base font-bold text-rose-950 sm:text-lg">
              สัญญาณเตือนที่ควรเข้าพบแพทย์ทันที
            </h2>
            <p className="mt-1 text-sm text-rose-900/90">
              ระบบวิเคราะห์และจำแนกเสียงไอด้วย AI เป็นเพียงการคัดกรองเบื้องต้น หากคุณมีอาการดังต่อไปนี้ ควรเข้ารับการตรวจวินิจฉัยจากแพทย์โดยตรง:
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-rose-950">
              {redFlags.map((flag) => (
                <li key={flag} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
