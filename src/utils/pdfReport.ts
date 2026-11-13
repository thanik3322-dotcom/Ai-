import { jsPDF } from 'jspdf';
import { VoiceAnalysisResult } from '../types/voiceHealth';

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const hasSegmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl;
  const tokens: string[] = hasSegmenter
    ? Array.from(
        new (Intl as unknown as {
          Segmenter: new (locale: string, opts: { granularity: string }) => {
            segment: (t: string) => Iterable<{ segment: string }>;
          };
        }).Segmenter('th', { granularity: 'word' }).segment(text),
        (s) => s.segment
      )
    : text.split('');

  const lines: string[] = [];
  let current = '';

  for (const token of tokens) {
    const candidate = current + token;
    if (ctx.measureText(candidate).width > maxWidth && current.length > 0) {
      lines.push(current.trimEnd());
      current = token.trimStart();
    } else {
      current = candidate;
    }
  }
  if (current.trim().length > 0) {
    lines.push(current.trimEnd());
  }
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export async function downloadAnalysisPdf(result: VoiceAnalysisResult): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const width = 1240;
  const height = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#EBF4FF';
  ctx.fillRect(0, 0, width, 165);
  ctx.fillStyle = '#0284C7';
  ctx.fillRect(0, 0, width, 10);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 34px "Plus Jakarta Sans", "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('AI Voice Health Analyzer', 64, 68);

  ctx.fillStyle = '#0369A1';
  ctx.font = '600 22px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('รายงานผลการวิเคราะห์และจำแนกเสียงไอเบื้องต้น (Cough Acoustic Report)', 64, 106);

  const dateText = new Date(result.analyzedAt).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  ctx.fillStyle = '#475569';
  ctx.font = '400 18px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText(
    `รหัสรายงาน: ${result.id}  ·  วันที่วิเคราะห์: ${dateText}  ·  โหมด: ${
      result.analysisMode === 'ai-experimental'
        ? 'AI Cough Classification'
        : 'ข้อมูลตัวอย่างเพื่อสาธิต (Demo)'
    }`,
    64,
    140
  );

  let y = 190;

  // Medical Safety Disclaimer Box
  ctx.fillStyle = '#FFFBEB';
  drawRoundedRect(ctx, 64, y, width - 128, 98, 14);
  ctx.fill();
  ctx.strokeStyle = '#FCD34D';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#92400E';
  ctx.font = '700 20px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('คำชี้แจงด้านความปลอดภัยทางการแพทย์', 88, y + 34);
  ctx.font = '400 18px "IBM Plex Sans Thai", sans-serif';
  const disclaimerLines = wrapCanvasText(ctx, result.disclaimerNote, width - 176);
  disclaimerLines.slice(0, 2).forEach((line, idx) => {
    ctx.fillText(line, 88, y + 63 + idx * 24);
  });

  y += 124;

  // Classification Banner
  ctx.fillStyle = '#EBF4FF';
  drawRoundedRect(ctx, 64, y, width - 128, 92, 12);
  ctx.fill();
  ctx.fillStyle = '#0369A1';
  ctx.font = '600 17px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('ผลการจำแนกลักษณะเสียงไอหลักเทียบต้นแบบ 3 ประเภท:', 88, y + 28);
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 22px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText(
    result.coughClassification || 'จำแนกลักษณะเสียงไอเบื้องต้น',
    88,
    y + 56
  );

  if (result.classificationScores && result.classificationScores.length > 0) {
    ctx.fillStyle = '#334155';
    ctx.font = '500 16px "IBM Plex Sans Thai", sans-serif';
    const scoreLine = result.classificationScores
      .map((s) => `${s.label}: ${s.confidencePercent}%`)
      .join('   ·   ');
    ctx.fillText(scoreLine, 88, y + 81);
  }

  y += 116;

  // Section 1: Acoustic Metrics
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 23px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('1. สรุปคุณลักษณะสัญญาณเสียงไอที่วัดได้จริง', 64, y);
  y += 16;

  const m = result.acousticMetrics;
  const burstCount = m.coughBurstCount ?? 1;
  const decayMs = m.coughDecayMs ?? 240;
  const peakDb = m.peakVolumeDb ?? m.averageVolumeDb;

  const metricBoxes = [
    { label: 'จำนวนระลอกเสียงไอ', value: `${burstCount} ครั้ง` },
    { label: 'ความถี่สเปกตรัม (Centroid)', value: `${Math.round(m.spectralCentroidHz)} Hz` },
    { label: 'ความดังสูงสุด (Peak)', value: `${peakDb.toFixed(1)} dBFS` },
    { label: 'ระยะสลายตัวของเสียงไอ', value: `${decayMs} ms` },
  ];

  const boxWidth = (width - 128 - 45) / 4;
  metricBoxes.forEach((item, idx) => {
    const bx = 64 + idx * (boxWidth + 15);
    ctx.fillStyle = '#F4F9FF';
    drawRoundedRect(ctx, bx, y, boxWidth, 92, 12);
    ctx.fill();
    ctx.strokeStyle = '#CBE4FA';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = '500 16px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(item.label, bx + 18, y + 32);

    ctx.fillStyle = '#0369A1';
    ctx.font = '700 25px "JetBrains Mono", "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(item.value, bx + 18, y + 70);
  });

  y += 116;

  ctx.fillStyle = '#334155';
  ctx.font = '400 18px "IBM Plex Sans Thai", sans-serif';
  const summaryLines = wrapCanvasText(ctx, result.vocalSummary, width - 128);
  summaryLines.slice(0, 3).forEach((line, idx) => {
    ctx.fillText(line, 64, y + idx * 26);
  });
  y += summaryLines.slice(0, 3).length * 26 + 22;

  // Section 2: Condition Screening Results
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 23px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText('2. ผลการจำแนกและความเป็นไปได้เบื้องต้นแยกตามกลุ่มอาการ', 64, y);
  y += 20;

  for (const cond of result.conditions.slice(0, 5)) {
    const cardHeight = 136;
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, 64, y, width - 128, cardHeight, 12);
    ctx.fill();
    ctx.strokeStyle = '#DCE8F5';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const riskText =
      cond.riskLevel === 'high'
        ? 'ความเสี่ยงสูง'
        : cond.riskLevel === 'medium'
        ? 'ความเสี่ยงปานกลาง'
        : 'ความเสี่ยงต่ำ';
    const barColor =
      cond.riskLevel === 'high'
        ? '#E11D48'
        : cond.riskLevel === 'medium'
        ? '#D97706'
        : '#0284C7';

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 19px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText(cond.name, 88, y + 34);

    ctx.fillStyle = barColor;
    ctx.font = '700 21px "JetBrains Mono", "IBM Plex Sans Thai", sans-serif';
    const rightLabel = `${cond.probabilityPercent}% (${riskText})`;
    const labelWidth = ctx.measureText(rightLabel).width;
    ctx.fillText(rightLabel, width - 88 - labelWidth, y + 34);

    const trackWidth = width - 176;
    ctx.fillStyle = '#E2E8F0';
    drawRoundedRect(ctx, 88, y + 48, trackWidth, 11, 5.5);
    ctx.fill();

    ctx.fillStyle = barColor;
    const fillW = Math.max(12, (trackWidth * cond.probabilityPercent) / 100);
    drawRoundedRect(ctx, 88, y + 48, fillW, 11, 5.5);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.font = '400 16px "IBM Plex Sans Thai", sans-serif';
    const expLines = wrapCanvasText(ctx, cond.explanation, width - 176);
    expLines.slice(0, 2).forEach((line, idx) => {
      ctx.fillText(line, 88, y + 84 + idx * 23);
    });

    y += cardHeight + 12;
  }

  // Section 3: Health Recommendations
  y += 10;
  if (y < height - 190) {
    ctx.fillStyle = '#0F172A';
    ctx.font = '700 21px "IBM Plex Sans Thai", sans-serif';
    ctx.fillText('3. คำแนะนำในการดูแลอาการไอและทางเดินหายใจเบื้องต้น', 64, y);
    y += 26;

    result.recommendations.slice(0, 3).forEach((rec) => {
      ctx.fillStyle = '#0369A1';
      ctx.font = '600 17px "IBM Plex Sans Thai", sans-serif';
      ctx.fillText(`• ${rec.title}`, 72, y);
      y += 22;
      ctx.fillStyle = '#475569';
      ctx.font = '400 15px "IBM Plex Sans Thai", sans-serif';
      const recLines = wrapCanvasText(ctx, rec.description, width - 160);
      recLines.slice(0, 2).forEach((line) => {
        ctx.fillText(line, 90, y);
        y += 20;
      });
      y += 6;
    });
  }

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, height - 64);
  ctx.lineTo(width - 64, height - 64);
  ctx.stroke();

  ctx.fillStyle = '#64748B';
  ctx.font = '400 15px "IBM Plex Sans Thai", sans-serif';
  ctx.fillText(
    'AI Voice Health Analyzer · รายงานการจำแนกเสียงไอเบื้องต้นนี้ไม่ใช่การวินิจฉัยโรค กรุณาปรึกษาแพทย์เพื่อการตรวจรักษาที่ถูกต้อง',
    64,
    height - 34
  );

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [width / 2, height / 2],
  });
  pdf.addImage(imgData, 'PNG', 0, 0, width / 2, height / 2);

  const stamp = new Date(result.analyzedAt)
    .toISOString()
    .slice(0, 16)
    .replace('T', '-')
    .replace(':', '');
  pdf.save(`ai-cough-health-report-${stamp}.pdf`);
}
