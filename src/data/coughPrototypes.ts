import { CoughPrototypeClassId } from '../types/voiceHealth';

export interface CoughPrototypeInfo {
  order: number;
  id: CoughPrototypeClassId;
  label: string;
  englishLabel: string;
  fileName: string;
  audioUrl: string;
  description: string;
  acousticCue: string;
}

export const COUGH_PROTOTYPES: CoughPrototypeInfo[] = [
  {
    order: 1,
    id: 'whooping',
    label: 'เสียงการไอกรน',
    englishLabel: 'Whooping Cough (Pertussis)',
    fileName: 'a3_mono_16kHz_37f8fe08.wav',
    audioUrl: '/assets/aistudio/a3_mono_16kHz_37f8fe08.wav',
    description:
      'ลักษณะการไอเป็นชุดต่อเนื่องถี่ๆ ตามด้วยจังหวะสูดหายใจลึกเสียงแหลมยาวคล้ายเสียง "วู้ป" (Inspiratory Whoop)',
    acousticCue: 'ระลอกไอต่อเนื่องหลายชุด · ช่วงหายใจเข้าความถี่สูง · พลังงานต่อเนื่องยาว',
  },
  {
    order: 2,
    id: 'wet',
    label: 'เสียงไอมีเสมหะ',
    englishLabel: 'Wet / Productive Cough',
    fileName: '001328dc-ea5d-4847-9ccf-c5aa2a3f2d0f_mono_16kHz_3fc7b2ad.wav',
    audioUrl: '/assets/aistudio/001328dc-ea5d-4847-9ccf-c5aa2a3f2d0f_mono_16kHz_3fc7b2ad.wav',
    description:
      'เสียงไอที่มีความทุ้มก้องและเสียงสั่นสะเทือนคล้ายฟองอากาศหรือเสมหะในทางเดินหายใจช่วงกลาง-ท้ายจังหวะไอ',
    acousticCue: 'ความถี่เด่นช่วงกลาง-ต่ำ · มีการสั่นแทรกของแอมพลิจูด · ช่วงท้ายเสียงไม่คม',
  },
  {
    order: 3,
    id: 'dry',
    label: 'เสียงไอแห้ง',
    englishLabel: 'Dry / Non-Productive Cough',
    fileName: 'audio_mono_16k_fc9635c5.wav',
    audioUrl: '/assets/aistudio/audio_mono_16k_fc9635c5.wav',
    description:
      'เสียงไอที่สั้น คม ชัด และไม่มีเสียงเสมหะครืดคราดแทรก มักเกิดจากการระคายเคืองคอหรือหลอดลมส่วนต้น',
    acousticCue: 'ระยะสลายเสียงสั้นและคม · Spectral Centroid สูง · ไม่มีเสียงเสมหะก้อง',
  },
];
