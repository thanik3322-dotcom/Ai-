export type AppView =
  | 'home'
  | 'record'
  | 'analyzing'
  | 'results'
  | 'history'
  | 'health-guide';

export type RiskLevel = 'low' | 'medium' | 'high';

export type AnalysisMode = 'ai-experimental' | 'demo-fallback';

export type CoughPrototypeClassId = 'whooping' | 'wet' | 'dry';

export interface AcousticMetrics {
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

export interface CoughClassScore {
  classId: CoughPrototypeClassId;
  label: string;
  englishLabel: string;
  confidencePercent: number;
  acousticReason: string;
}

export interface ConditionAssessment {
  id: string;
  name: string;
  englishName: string;
  probabilityPercent: number;
  riskLevel: RiskLevel;
  explanation: string;
  observedAcousticSignals: string[];
}

export interface HealthRecommendation {
  title: string;
  description: string;
  priority: 'routine' | 'attention' | 'medical';
}

export interface VoiceAnalysisResult {
  id: string;
  analyzedAt: string;
  promptType: string;
  inputSource?: 'microphone' | 'reference-sample';
  primaryClassId?: CoughPrototypeClassId;
  coughClassification: string;
  classificationScores?: CoughClassScore[];
  analysisMode: AnalysisMode;
  modelName: string;
  disclaimerNote: string;
  vocalSummary: string;
  voiceCharacteristicTags: string[];
  acousticMetrics: AcousticMetrics;
  conditions: ConditionAssessment[];
  recommendations: HealthRecommendation[];
}

export interface SavedAnalysisRecord extends VoiceAnalysisResult {
  savedAt: string;
  label: string;
}
