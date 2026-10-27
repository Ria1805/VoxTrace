export type FXLevel = 'off' | 'lite' | 'max';
export type UserRole = 'Analyst' | 'Admin' | 'Auditor';
export type Verdict = 'REAL' | 'FAKE' | 'UNSCORED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNSCORED';

export interface EvidenceFile {
  path: string;
  sha256: string;
}

export interface Incident {
  id?: number;
  seq: number;
  ts: number;
  evidence_path: string;
  evidence_sha256: string;
  evidence_files: EvidenceFile[];
  audio_score: number | null;
  video_score: number | null;
  fused_score: number | null;
  verdict: Verdict;
  severity: Severity;
  model_versions: {
    audio?: string;
    video?: string;
    [key: string]: string | undefined;
  };
  ioc_matches: Array<{
    type: string;
    value: string;
    tag?: string;
    source?: string;
  }>;
  playbook_actions: string[];
  actor: string;
  prev_hash: string;
  record_hash: string;
  signature: string;
  key_fp?: string;
  audio_timeline?: Array<{
    start: number;
    end: number;
    score: number;
    suspicious: boolean;
  }>;
  video_frames?: Array<{
    frame_id: number;
    timestamp: number;
    crop_label: string;
    sharpness_laplacian: number;
    blink_anomaly_score: number;
    mouth_sync_delta_ms: number;
    fake_prob: number;
  }>;
  fusion_breakdown?: {
    w_audio: number;
    w_video: number;
    audio_contribution: number | null;
    video_contribution: number | null;
    formula: string;
    rationale: string;
  };
}

export interface LedgerBlock {
  seq: number;
  ts: number;
  evidence_sha256: string;
  fused_score: number | null;
  verdict: Verdict;
  prev_hash: string;
  record_hash: string;
  signature: string;
  actor: string;
  link_verified?: boolean;
}

export interface LedgerVerification {
  chain_intact: boolean;
  problems: string[];
  key_fp: string;
  checked_against_external_head: boolean;
  checked_key_fingerprint: boolean;
  external_head_source?: string;
  scanned_at?: number;
}

export interface SystemMetrics {
  samples_analyzed: number;
  fakes_flagged: number;
  reals_count: number;
  unscored_count: number;
  open_incidents: number;
  ledger_integrity: boolean;
  integrity_problems: string[];
  key_fp: string;
  ioc_matches_today: number;
  fused_score_distribution: Array<{ range: string; count: number }>;
  detections_over_time: Array<{ date: string; fakes: number; reals: number; unscored: number }>;
  system_health: {
    api: string;
    model_audio: string;
    model_video: string;
    wazuh_agent: string;
    ledger: string;
    key_fingerprint: string;
  };
}

export interface IOCIndicator {
  type: string;
  value: string;
  tag: string;
  source: string;
  confidence: string;
  campaign?: string;
  last_seen: string;
}

export interface CorrelationGraphNode {
  id: string;
  label: string;
  type: 'detection' | 'phone' | 'domain' | 'tool' | 'campaign';
  severity?: string;
}

export interface CorrelationGraphLink {
  source: string;
  target: string;
  relation: string;
}

export interface AlertItem {
  id: string;
  timestamp: string;
  rule_id: number;
  level: number;
  description: string;
  mitre_technique: string;
  mitre_name: string;
  verdict: string;
  severity: Severity;
  details: string;
  status: string;
  rule_mode: string;
}

export interface MitreTechnique {
  technique: string;
  tactic: string;
  name: string;
  rule_id: string;
  coverage: string;
  mode: string;
  notes: string;
}
