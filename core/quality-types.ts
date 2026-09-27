import type { QualityConfig, QualityFinding } from "./content-quality";

type AnalysisCheck = { name: string; status: string; detail: string };
type Location = {
  piece: string;
  line: number;
  excerpt: string;
  start?: number;
  end?: number;
};
type Repetition = {
  stems: string[];
  n: number;
  count: number;
  pieceCount: number;
  example: string;
  perPiece: Record<string, number>;
  locations: Location[];
};
type ProseMetrics = {
  words?: number;
  sentences?: number;
  passiveSentences?: number;
  adverbsPer1000?: number;
};
export type WorkerAnalysis = {
  fatal?: string;
  checks: AnalysisCheck[];
  findings: QualityFinding[];
  repetitions: Repetition[];
  metrics?: Record<string, ProseMetrics>;
  versions?: Record<string, unknown>;
  examples?: Record<string, unknown>;
};
export type QualityReport = WorkerAnalysis & {
  generatedAt: string;
  summary: string;
  config: QualityConfig;
  stale: unknown[];
  pieces: {
    id: string;
    title: string;
    language: string;
    sources: string[];
    metrics?: ProseMetrics | null;
  }[];
};
