import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

type CoughPrototypeClassId = 'whooping' | 'wet' | 'dry';

interface AcousticMetricsInput {
  durationSec: number;
  coughBurstCount: number;
  coughDecayMs: number;
  fundamentalFreqHz: number;
  pitchStabilityHz: number;
  averageVolumeDb: number;
  peakVolumeDb: number;
  jitterPercent: number;
  shimmerPercent: number;
  voicingRatioPercent: number;
  speechRateSyllablesPerSec: number;
  spectralCentroidHz: number;
  waveformPeaks: number[];
}

interface AnalyzeVoiceRequestBody {
  audioBase64?: string;
  mimeType?: string;
  promptType?: string;
  inputSource?: 'microphone' | 'reference-sample';
  metrics: AcousticMetricsInput;
}

interface CoughClassScore {
  classId: CoughPrototypeClassId;
  label: string;
  englishLabel: string;
  confidencePercent: number;
  acousticReason: string;
}

interface ConditionItem {
  id: string;
  name: string;
  englishName: string;
  probabilityPercent: number;
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
  observedAcousticSignals: string[];
}

interface RecommendationItem {
  title: string;
  description: string;
  priority: 'routine' | 'attention' | 'medical';
}

interface ProviderOutput {
  primaryClassId: CoughPrototypeClassId;
  coughClassification: string;
  classificationScores: CoughClassScore[];
  analysisMode: 'ai-experimental' | 'demo-fallback';
  modelName: string;
  disclaimerNote: string;
  vocalSummary: string;
  voiceCharacteristicTags: string[];
  conditions: ConditionItem[];
  recommendations: RecommendationItem[];
}

interface LoadedPrototypeRef {
  order: number;
  classId: CoughPrototypeClassId;
  label: string;
  englishLabel: string;
  fileName: string;
  base64Wav: string;
  signature: {
    durationSec: number;
    coughBurstCount: number;
    coughDecayMs: number;
    spectralCentroidHz: number;
    shimmerPercent: number;
    voicingRatioPercent: number;
  };
}

const PROTOTYPE_DEFS: Array<{
  order: number;
  classId: CoughPrototypeClassId;
  label: string;
  englishLabel: string;
  fileName: string;
}> = [
  {
    order: 1,
    classId: 'whooping',
    label: 'เสียงการไอกรน',
    englishLabel: 'Whooping Cough (Pertussis)',
    fileName: 'a3_mono_16kHz_37f8fe08.wav',
  },
  {
    order: 2,
    classId: 'wet',
    label: 'เสียงไอมีเสมหะ',
    englishLabel: 'Wet / Productive Cough',
    fileName: '001328dc-ea5d-4847-9ccf-c5aa2a3f2d0f_mono_16kHz_3fc7b2ad.wav',
  },
  {
    order: 3,
    classId: 'dry',
    label: 'เสียงไอแห้ง',
    englishLabel: 'Dry / Non-Productive Cough',
    fileName: 'audio_mono_16k_fc9635c5.wav',
  },
];

function parseWavPcm16(buffer: Buffer): { sampleRate: number; samples: Float32Array } {
  let offset = 12;
  let sampleRate = 16000;
  let dataOffset = 44;
  let dataLength = Math.max(0, buffer.length - 44);

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      sampleRate = buffer.readUInt32LE(offset + 12);
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataLength = Math.min(chunkSize, buffer.length - dataOffset);
      break;
    }
    offset += 8 + chunkSize + (chunkSize % 2);
  }

  const count = Math.floor(dataLength / 2);
  const samples = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    samples[i] = buffer.readInt16LE(dataOffset + i * 2) / 32768;
  }
  return { sampleRate, samples };
}

function computeReferenceSignature(buffer: Buffer): LoadedPrototypeRef['signature'] {
  const { sampleRate, samples } = parseWavPcm16(buffer);
  const durationSec = Math.max(0.5, samples.length / sampleRate);
  const frameSize = Math.floor(sampleRate * 0.03);
  const hopSize = Math.floor(frameSize / 2);
  const hopDurationMs = (hopSize / sampleRate) * 1000;

  let zcr = 0;
  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    sumSq += samples[i] * samples[i];
    if (i > 0 && ((samples[i - 1] >= 0 && samples[i] < 0) || (samples[i - 1] < 0 && samples[i] >= 0))) {
      zcr++;
    }
  }
  const overallRms = Math.sqrt(sumSq / Math.max(1, samples.length));

  const frameRms: number[] = [];
  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let sq = 0;
    for (let j = 0; j < frameSize; j++) {
      const s = samples[start + j];
      sq += s * s;
    }
    frameRms.push(Math.sqrt(sq / frameSize));
  }

  const maxRms = frameRms.reduce((m, v) => (v > m ? v : m), 0);
  const onset = Math.max(0.025, maxRms * 0.36);
  const offset = onset * 0.45;

  let coughBurstCount = 0;
  let inBurst = false;
  let lastEnd = -100;
  const minGap = Math.max(2, Math.floor(140 / hopDurationMs));
  const burstsMs: number[] = [];
  let bStart = 0;

  for (let i = 0; i < frameRms.length; i++) {
    if (!inBurst && frameRms[i] >= onset && i - lastEnd >= minGap) {
      inBurst = true;
      bStart = i;
      coughBurstCount++;
    } else if (inBurst && frameRms[i] < offset) {
      inBurst = false;
      lastEnd = i;
      burstsMs.push((i - bStart) * hopDurationMs);
    }
  }
  if (inBurst) {
    burstsMs.push((frameRms.length - bStart) * hopDurationMs);
  }

  const coughDecayMs =
    burstsMs.length > 0
      ? Math.round(burstsMs.reduce((a, b) => a + b, 0) / burstsMs.length)
      : 240;

  const activeThreshold = Math.max(0.015, overallRms * 0.45);
  const activeFrames = frameRms.filter((r) => r >= activeThreshold);
  const voicingRatioPercent =
    frameRms.length > 0 ? (activeFrames.length / frameRms.length) * 100 : 0;

  let shimmerPercent = 3.2;
  if (activeFrames.length > 2) {
    let diff = 0;
    let avg = 0;
    for (let i = 1; i < activeFrames.length; i++) {
      diff += Math.abs(activeFrames[i] - activeFrames[i - 1]);
      avg += (activeFrames[i] + activeFrames[i - 1]) / 2;
    }
    if (avg > 0) {
      shimmerPercent = Math.min(18, Math.max(1, (diff / avg) * 100));
    }
  }

  const spectralCentroidHz = Math.min(4800, Math.max(400, (zcr / durationSec) * 0.65));

  return {
    durationSec,
    coughBurstCount,
    coughDecayMs,
    spectralCentroidHz,
    shimmerPercent,
    voicingRatioPercent,
  };
}

function loadCoughPrototypes(): LoadedPrototypeRef[] {
  const publicDir = path.resolve(__dirname, 'public/assets/aistudio');
  const distDir = path.resolve(__dirname, 'dist/assets/aistudio');
  const dir = fs.existsSync(publicDir) ? publicDir : distDir;
  const loaded: LoadedPrototypeRef[] = [];

  for (const def of PROTOTYPE_DEFS) {
    const filePath = path.join(dir, def.fileName);
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      loaded.push({
        ...def,
        base64Wav: buf.toString('base64'),
        signature: computeReferenceSignature(buf),
      });
    } else {
      console.warn(`Warning: Cough prototype file missing at ${filePath}`);
    }
  }
  return loaded;
}

const REFERENCE_PROTOTYPES = loadCoughPrototypes();

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(95, Math.round(value)));
}

function normalizeRisk(level: string, prob: number): 'low' | 'medium' | 'high' {
  if (level === 'high' || prob >= 65) return 'high';
  if (level === 'medium' || prob >= 35) return 'medium';
  return 'low';
}

function buildAcousticSimilarityFallback(
  metrics: AcousticMetricsInput,
  reason: string
): ProviderOutput {
  // Compute real distance against the 3 uploaded reference WAV prototypes
  const scoresRaw = REFERENCE_PROTOTYPES.map((proto) => {
    const s = proto.signature;
    const dBurst = Math.abs(metrics.coughBurstCount - s.coughBurstCount) / Math.max(1, s.coughBurstCount);
    const dDuration = Math.abs(metrics.durationSec - s.durationSec) / Math.max(1, s.durationSec);
    const dCentroid = Math.abs(metrics.spectralCentroidHz - s.spectralCentroidHz) / 1500;
    const dDecay = Math.abs(metrics.coughDecayMs - s.coughDecayMs) / 300;
    const dShimmer = Math.abs(metrics.shimmerPercent - s.shimmerPercent) / 6;

    const distance = dBurst * 1.4 + dDuration * 1.1 + dCentroid * 1.0 + dDecay * 0.9 + dShimmer * 0.8;
    const weight = Math.exp(-distance * 1.15);
    return { proto, weight };
  });

  const weightSum = scoresRaw.reduce((acc, item) => acc + item.weight, 0) || 1;
  const normalizedPercents = scoresRaw.map((item) =>
    Math.round((item.weight / weightSum) * 100)
  );
  // Adjust rounding difference to sum to 100
  const diffSum = 100 - normalizedPercents.reduce((a, b) => a + b, 0);
  if (normalizedPercents.length > 0) {
    normalizedPercents[0] += diffSum;
  }

  const classificationScores: CoughClassScore[] = scoresRaw
    .map((item, idx) => {
      const p = item.proto;
      const reasonMap: Record<CoughPrototypeClassId, string> = {
        whooping: `เทียบเคียงจำนวนระลอกไอ (${metrics.coughBurstCount} ครั้ง) และความต่อเนื่องของเสียง (${metrics.durationSec.toFixed(1)} วินาที) กับต้นแบบไอกรน (${p.signature.coughBurstCount} ครั้ง / ${p.signature.durationSec.toFixed(1)} วินาที)`,
        wet: `เทียบเคียงความสั่นสะเทือน Shimmer (${metrics.shimmerPercent.toFixed(1)}%) และความถี่สเปกตรัม (${Math.round(metrics.spectralCentroidHz)} Hz) กับต้นแบบไอมีเสมหะ`,
        dry: `เทียบเคียงระยะสลายเสียง (${metrics.coughDecayMs} ms) และความคมของสเปกตรัม (${Math.round(metrics.spectralCentroidHz)} Hz) กับต้นแบบไอแห้ง`,
      };
      return {
        classId: p.classId,
        label: p.label,
        englishLabel: p.englishLabel,
        confidencePercent: Math.max(1, normalizedPercents[idx] ?? 33),
        acousticReason: reasonMap[p.classId],
      };
    })
    .sort((a, b) => b.confidencePercent - a.confidencePercent);

  const topClass = classificationScores[0] || {
    classId: 'dry' as CoughPrototypeClassId,
    label: 'เสียงไอแห้ง',
    englishLabel: 'Dry Cough',
    confidencePercent: 50,
    acousticReason: 'ประเมินจากค่าสัญญาณเสียงเบื้องต้น',
  };

  const conditions: ConditionItem[] = [
    {
      id: 'whooping-pertussis',
      name: 'รูปแบบเสียงใกล้เคียงการไอกรน / ไอเป็นชุดต่อเนื่อง (Pertussis Pattern)',
      englishName: 'Paroxysmal / Whooping Cough Similarity',
      probabilityPercent: clampPercent(
        classificationScores.find((c) => c.classId === 'whooping')?.confidencePercent ?? 20
      ),
      riskLevel: normalizeRisk(
        '',
        classificationScores.find((c) => c.classId === 'whooping')?.confidencePercent ?? 20
      ),
      explanation:
        'ข้อมูลประเมินจากความคล้ายเชิงสัญญาณ (Acoustic Template Matching): พิจารณาความถี่ของระลอกไอต่อเนื่องและระยะเวลาการออกแรงไอเทียบกับไฟล์ต้นแบบเสียงไอกรน',
      observedAcousticSignals: [
        `จำนวนระลอกไอ ${metrics.coughBurstCount} ครั้ง`,
        `ความยาวคลื่นต่อเนื่อง ${metrics.durationSec.toFixed(1)} วินาที`,
      ],
    },
    {
      id: 'wet-productive-cough',
      name: 'รูปแบบเสียงใกล้เคียงการไอมีเสมหะ (Productive / Bronchial Secretion)',
      englishName: 'Wet / Productive Cough Similarity',
      probabilityPercent: clampPercent(
        classificationScores.find((c) => c.classId === 'wet')?.confidencePercent ?? 30
      ),
      riskLevel: normalizeRisk(
        '',
        classificationScores.find((c) => c.classId === 'wet')?.confidencePercent ?? 30
      ),
      explanation:
        'ข้อมูลประเมินจากความคล้ายเชิงสัญญาณ (Acoustic Template Matching): พิจารณาความแปรปรวนของแอมพลิจูด (Shimmer) และความทุ้มช่วงกลาง-ต่ำเทียบกับไฟล์ต้นแบบเสียงไอมีเสมหะ',
      observedAcousticSignals: [
        `Shimmer ${metrics.shimmerPercent.toFixed(1)}%`,
        `ความถี่เด่น ${Math.round(metrics.fundamentalFreqHz)} Hz`,
      ],
    },
    {
      id: 'dry-cough-irritation',
      name: 'รูปแบบเสียงใกล้เคียงการไอแห้ง / ระคายเคืองคอ (Dry Cough Irritation)',
      englishName: 'Dry / Non-Productive Cough Similarity',
      probabilityPercent: clampPercent(
        classificationScores.find((c) => c.classId === 'dry')?.confidencePercent ?? 30
      ),
      riskLevel: normalizeRisk(
        '',
        classificationScores.find((c) => c.classId === 'dry')?.confidencePercent ?? 30
      ),
      explanation:
        'ข้อมูลประเมินจากความคล้ายเชิงสัญญาณ (Acoustic Template Matching): พิจารณาความคมสั้นของคลื่นเสียงและ Spectral Centroid เทียบกับไฟล์ต้นแบบเสียงไอแห้ง',
      observedAcousticSignals: [
        `Spectral Centroid ${Math.round(metrics.spectralCentroidHz)} Hz`,
        `ระยะสลายเสียง ${metrics.coughDecayMs} ms`,
      ],
    },
  ].sort((a, b) => b.probabilityPercent - a.probabilityPercent);

  return {
    primaryClassId: topClass.classId,
    coughClassification: `${topClass.label} (${topClass.englishLabel})`,
    classificationScores,
    analysisMode: 'demo-fallback',
    modelName: 'Acoustic Prototype Matcher (Fallback)',
    disclaimerNote: `แสดงผลการเทียบเคียงจากค่าอะคูสติกพื้นฐาน (${reason}) — ผลลัพธ์เป็นการคัดกรองเบื้องต้นเพื่อการสาธิต ไม่ใช่การวินิจฉัยโรคทางการแพทย์`,
    vocalSummary: `เปรียบเทียบสัญญาณเสียงกับต้นแบบทั้ง 3 ประเภทแล้ว พบว่าลักษณะเสียงมีความสอดคล้องกับ "${topClass.label}" มากที่สุด (${topClass.confidencePercent}%) โดยตรวจจับได้ ${metrics.coughBurstCount} ระลอกไอ ความถี่สเปกตรัม ${Math.round(metrics.spectralCentroidHz)} Hz`,
    voiceCharacteristicTags: [
      `ตรงกับต้นแบบ: ${topClass.label}`,
      `ตรวจพบ ${metrics.coughBurstCount} ระลอก`,
      `Centroid ${Math.round(metrics.spectralCentroidHz)} Hz`,
      `Decay ${metrics.coughDecayMs} ms`,
    ],
    conditions,
    recommendations: [
      {
        title: 'สังเกตลักษณะการไอและระยะเวลาที่เป็น',
        description:
          'จดบันทึกลักษณะอาการ (ไอแห้ง ไอมีเสมหะ หรือไอเป็นชุดจนเหนื่อย) เพื่อใช้เป็นข้อมูลประกอบเมื่อปรึกษาแพทย์',
        priority: 'routine',
      },
      {
        title: 'ดื่มน้ำอุ่นและหลีกเลี่ยงสิ่งกระตุ้นทางเดินหายใจ',
        description:
          'จิบน้ำอุ่นสม่ำเสมอ หลีกเลี่ยงฝุ่น PM2.5 ควันบุหรี่ และอากาศเย็นจัด',
        priority: 'attention',
      },
      {
        title: 'พบแพทย์ทันทีหากมีอาการไอเป็นชุดรุนแรงหรือหายใจลำบาก',
        description:
          'หากไอต่อเนื่องจนอาเจียน หายใจมีเสียงวู้ป มีไข้สูง หรือไอนานเกิน 2 สัปดาห์ ควรเข้ารับการตรวจจากแพทย์โดยตรง',
        priority: 'medical',
      },
    ],
  };
}

class GeminiCoughProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async analyze(input: AnalyzeVoiceRequestBody): Promise<ProviderOutput> {
    const { audioBase64, mimeType, promptType, metrics } = input;

    const systemInstruction = `คุณคือระบบปัญญาประดิษฐ์สำหรับจำแนกเสียงไอเชิงทดลอง (Few-Shot Cough Acoustic Classifier)
ภารกิจของคุณคือฟังไฟล์เสียงต้นแบบทั้ง 3 ประเภทที่แนบให้ตามลำดับ ได้แก่:
1) "เสียงการไอกรน" (whooping) — ลักษณะการไอเป็นชุดถี่ๆ ต่อเนื่องหลายระลอกและมีจังหวะสูดหายใจเข้าเสียงแหลมยาว (whoop)
2) "เสียงไอมีเสมหะ" (wet) — ลักษณะเสียงไอทุ้มก้อง มีเสียงสั่นของเสมหะ/ฟองอากาศปนในจังหวะไอ
3) "เสียงไอแห้ง" (dry) — ลักษณะเสียงไอสั้น คม ชัด ไม่มีเสียงเสมหะครืดคราดแทรก

จากนั้นให้ฟัง [ไฟล์เสียงเป้าหมายของผู้ใช้] และเปรียบเทียบกับเสียงต้นแบบทั้ง 3 เสียงอย่างละเอียด:
- จำแนกว่าเสียงเป้าหมายใกล้เคียงกับคลาสใดมากที่สุดในฟิลด์ primaryClassId ("whooping", "wet", หรือ "dry")
- ให้คะแนนเปอร์เซ็นต์ความเหมือน/ความเป็นไปได้ครบทั้ง 3 คลาสใน classificationScores (รวมกันให้ใกล้เคียง 100%)
- ห้ามวินิจฉัยยืนยันโรคทางการแพทย์เด็ดขาด ให้ระบุชัดเจนว่าเป็นการจำแนกเชิงอะคูสติกและการคัดกรองเบื้องต้นเท่านั้น`;

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    // Attach the 3 reference prototype WAVs as multimodal few-shot audio anchors
    for (const proto of REFERENCE_PROTOTYPES) {
      parts.push({
        text: `[ไฟล์เสียงต้นแบบลำดับที่ ${proto.order}: ${proto.label} (${proto.englishLabel}) — classId: "${proto.classId}"]\nค่าอ้างอิงที่วัดได้จากต้นแบบนี้: ระลอกไอ ${proto.signature.coughBurstCount} ครั้ง, ความยาว ${proto.signature.durationSec.toFixed(1)} วิ, Spectral Centroid ${Math.round(proto.signature.spectralCentroidHz)} Hz, ระยะสลาย ${proto.signature.coughDecayMs} ms, Shimmer ${proto.signature.shimmerPercent.toFixed(1)}%`,
      });
      parts.push({
        inlineData: {
          mimeType: 'audio/wav',
          data: proto.base64Wav,
        },
      });
    }

    parts.push({
      text: `[ไฟล์เสียงเป้าหมายที่ต้องการจำแนก] (รูปแบบการบันทึก: ${promptType || 'บันทึกเสียงไอ'})
ค่าสัญญาณอะคูสติกที่วัดได้จากไฟล์เป้าหมาย:
- ระยะเวลาบันทึก: ${metrics.durationSec.toFixed(2)} วินาที
- จำนวนระลอกเสียงไอ: ${metrics.coughBurstCount} ครั้ง
- ระยะเวลาสลายตัวเฉลี่ยต่อระลอกไอ: ${metrics.coughDecayMs} มิลลิวินาที
- ความถี่เด่นเฉลี่ย: ${metrics.fundamentalFreqHz.toFixed(1)} Hz (±${metrics.pitchStabilityHz.toFixed(1)} Hz)
- ระดับความดังเฉลี่ย / สูงสุด: ${metrics.averageVolumeDb.toFixed(1)} / ${metrics.peakVolumeDb.toFixed(1)} dBFS
- ความปั่นป่วนความถี่ (Jitter): ${metrics.jitterPercent.toFixed(2)}%
- ความปั่นป่วนแอมพลิจูด (Shimmer): ${metrics.shimmerPercent.toFixed(2)}%
- ความคมสเปกตรัม (Spectral Centroid): ${metrics.spectralCentroidHz.toFixed(0)} Hz

กรุณาฟังเสียงเป้าหมายด้านล่างนี้เทียบกับไฟล์ต้นแบบทั้ง 3 ไฟล์ข้างต้น แล้วส่งผลจำแนกในรูปแบบ JSON`,
    });

    if (audioBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType.split(';')[0] || 'audio/webm',
          data: audioBase64,
        },
      });
    }

    const response = await this.ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            primaryClassId: {
              type: Type.STRING,
              description: 'คลาสที่ใกล้เคียงที่สุด: whooping, wet, หรือ dry',
            },
            coughClassification: {
              type: Type.STRING,
              description: 'ชื่อผลการจำแนกภาษาไทย เช่น เสียงการไอกรน, เสียงไอมีเสมหะ, หรือ เสียงไอแห้ง',
            },
            classificationScores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  classId: { type: Type.STRING, description: 'whooping, wet, หรือ dry' },
                  label: { type: Type.STRING },
                  englishLabel: { type: Type.STRING },
                  confidencePercent: { type: Type.INTEGER },
                  acousticReason: { type: Type.STRING },
                },
                required: [
                  'classId',
                  'label',
                  'englishLabel',
                  'confidencePercent',
                  'acousticReason',
                ],
              },
            },
            vocalSummary: {
              type: Type.STRING,
              description: 'สรุปลักษณะเสียงไอที่ตรวจพบเทียบกับต้นแบบ 2-3 ประโยคเป็นภาษาไทย',
            },
            voiceCharacteristicTags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            conditions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  englishName: { type: Type.STRING },
                  probabilityPercent: { type: Type.INTEGER },
                  riskLevel: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  observedAcousticSignals: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  'id',
                  'name',
                  'englishName',
                  'probabilityPercent',
                  'riskLevel',
                  'explanation',
                  'observedAcousticSignals',
                ],
              },
            },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  priority: { type: Type.STRING },
                },
                required: ['title', 'description', 'priority'],
              },
            },
          },
          required: [
            'primaryClassId',
            'coughClassification',
            'classificationScores',
            'vocalSummary',
            'voiceCharacteristicTags',
            'conditions',
            'recommendations',
          ],
        },
      },
    });

    const rawText = (response.text ?? '{}').trim();
    const parsed = JSON.parse(rawText) as {
      primaryClassId?: string;
      coughClassification?: string;
      classificationScores?: CoughClassScore[];
      vocalSummary?: string;
      voiceCharacteristicTags?: string[];
      conditions?: ConditionItem[];
      recommendations?: RecommendationItem[];
    };

    const validClassIds: CoughPrototypeClassId[] = ['whooping', 'wet', 'dry'];
    const defaultLabels: Record<CoughPrototypeClassId, { label: string; en: string }> = {
      whooping: { label: 'เสียงการไอกรน', en: 'Whooping Cough (Pertussis)' },
      wet: { label: 'เสียงไอมีเสมหะ', en: 'Wet / Productive Cough' },
      dry: { label: 'เสียงไอแห้ง', en: 'Dry / Non-Productive Cough' },
    };

    const classScoreMap = new Map<CoughPrototypeClassId, CoughClassScore>();
    for (const item of parsed.classificationScores ?? []) {
      const cid = validClassIds.includes(item.classId as CoughPrototypeClassId)
        ? (item.classId as CoughPrototypeClassId)
        : null;
      if (cid && !classScoreMap.has(cid)) {
        classScoreMap.set(cid, {
          classId: cid,
          label: defaultLabels[cid].label,
          englishLabel: defaultLabels[cid].en,
          confidencePercent: Math.max(0, Math.min(100, Math.round(item.confidencePercent))),
          acousticReason: item.acousticReason,
        });
      }
    }

    for (const cid of validClassIds) {
      if (!classScoreMap.has(cid)) {
        classScoreMap.set(cid, {
          classId: cid,
          label: defaultLabels[cid].label,
          englishLabel: defaultLabels[cid].en,
          confidencePercent: 5,
          acousticReason: 'ความสอดคล้องเชิงอะคูสติกต่ำกว่าคลาสหลัก',
        });
      }
    }

    const classificationScores = Array.from(classScoreMap.values()).sort(
      (a, b) => b.confidencePercent - a.confidencePercent
    );

    const primaryClassId: CoughPrototypeClassId = validClassIds.includes(
      parsed.primaryClassId as CoughPrototypeClassId
    )
      ? (parsed.primaryClassId as CoughPrototypeClassId)
      : classificationScores[0].classId;

    const conditions = (parsed.conditions ?? [])
      .map((c, idx) => {
        const prob = clampPercent(c.probabilityPercent);
        return {
          id: c.id || `cough-condition-${idx + 1}`,
          name: c.name,
          englishName: c.englishName,
          probabilityPercent: prob,
          riskLevel: normalizeRisk(c.riskLevel, prob),
          explanation: c.explanation,
          observedAcousticSignals: Array.isArray(c.observedAcousticSignals)
            ? c.observedAcousticSignals.slice(0, 3)
            : [],
        };
      })
      .sort((a, b) => b.probabilityPercent - a.probabilityPercent);

    if (conditions.length === 0) {
      throw new Error('AI returned empty conditions array');
    }

    return {
      primaryClassId,
      coughClassification:
        parsed.coughClassification ||
        `${defaultLabels[primaryClassId].label} (${defaultLabels[primaryClassId].en})`,
      classificationScores,
      analysisMode: 'ai-experimental',
      modelName: 'Gemini 4 Hydrogen (3-Prototype Few-Shot Cough Classifier)',
      disclaimerNote:
        'ผลลัพธ์นี้เป็นการจำแนกลักษณะเสียงไอเทียบกับไฟล์ต้นแบบทั้ง 3 ประเภท (ไอกรน, ไอมีเสมหะ, ไอแห้ง) ด้วยระบบ AI เชิงทดลองเท่านั้น ไม่ใช่การวินิจฉัยโรคทางการแพทย์',
      vocalSummary:
        parsed.vocalSummary ||
        'ระบบได้เปรียบเทียบไฟล์เสียงของคุณกับต้นแบบเสียงไอกรน เสียงไอมีเสมหะ และเสียงไอแห้งเรียบร้อยแล้ว',
      voiceCharacteristicTags:
        Array.isArray(parsed.voiceCharacteristicTags) && parsed.voiceCharacteristicTags.length > 0
          ? parsed.voiceCharacteristicTags.slice(0, 4)
          : [defaultLabels[primaryClassId].label],
      conditions,
      recommendations:
        Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
          ? parsed.recommendations.slice(0, 4).map((r) => ({
              title: r.title,
              description: r.description,
              priority:
                r.priority === 'medical' || r.priority === 'attention' ? r.priority : 'routine',
            }))
          : [
              {
                title: 'ดื่มน้ำอุ่นและสังเกตอาการต่อเนื่อง',
                description: 'ช่วยลดการระคายเคืองและหากอาการไม่ดีขึ้นภายใน 1-2 สัปดาห์ควรพบแพทย์',
                priority: 'routine',
              },
            ],
    };
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const hasGeminiKey = Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    res.json({
      status: 'ok',
      task: 'cough-3class-prototype-classification',
      appUrl: process.env.APP_URL || '',
      loadedPrototypes: REFERENCE_PROTOTYPES.map((p) => ({
        order: p.order,
        classId: p.classId,
        label: p.label,
        fileName: p.fileName,
        signature: p.signature,
      })),
      modelConnected: hasGeminiKey,
    });
  });

  app.post('/api/analyze-voice', async (req: Request, res: Response) => {
    try {
      const body = req.body as AnalyzeVoiceRequestBody;
      if (!body || !body.metrics) {
        res.status(400).json({ error: 'ไม่พบข้อมูลสัญญาณเสียงไอสำหรับวิเคราะห์' });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      const hasValidKey = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

      let output: ProviderOutput;
      if (hasValidKey && apiKey) {
        try {
          const provider = new GeminiCoughProvider(apiKey);
          output = await provider.analyze(body);
        } catch (aiErr) {
          console.error('Gemini cough analysis error, falling back to prototype similarity:', aiErr);
          output = buildAcousticSimilarityFallback(
            body.metrics,
            'การเชื่อมต่อ AI ขัดข้องชั่วคราว จึงแสดงผลการเทียบสัญญาณเสียงกับต้นแบบทั้ง 3 ไฟล์'
          );
        }
      } else {
        output = buildAcousticSimilarityFallback(
          body.metrics,
          'ยังไม่ได้ตั้งค่า GEMINI_API_KEY จึงแสดงผลการเทียบค่าอะคูสติกกับต้นแบบทั้ง 3 ไฟล์'
        );
      }

      res.json({
        id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        analyzedAt: new Date().toISOString(),
        promptType: body.promptType || 'บันทึกเสียงไอ',
        inputSource: body.inputSource || 'microphone',
        acousticMetrics: body.metrics,
        ...output,
      });
    } catch (err) {
      console.error('Error in /api/analyze-voice:', err);
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการประมวลผลสัญญาณเสียงไอบนเซิร์ฟเวอร์' });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `AI Voice Health Analyzer listening on http://0.0.0.0:${PORT} (${REFERENCE_PROTOTYPES.length} cough prototypes loaded)`
    );
  });
}

startServer();
