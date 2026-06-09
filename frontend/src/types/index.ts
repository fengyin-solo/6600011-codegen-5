export interface EEGData { channels: string[]; sample_rate: number; data: Record<string, number[]>; time: number[]; duration: number; }
export interface BandPower { delta: number; theta: number; alpha: number; beta: number; gamma: number; }
export interface BrainState {
  focus: number;
  relaxation: number;
  fatigue: number;
  status: 'focused' | 'relaxed' | 'fatigued' | 'neutral';
  statusLabel: string;
  statusColor: string;
  timestamp: number;
}
export interface ChannelCorrelation {
  channel: string;
  targetChannel: string;
  correlation: number;
  coherence: number;
}
export interface CorrelationData {
  targetChannel: string;
  correlations: ChannelCorrelation[];
}

export interface RecordingFrame {
  relativeTime: number;
  eeg: EEGData;
  bands: BandPower;
  brainState: BrainState;
}

export interface Recording {
  id: string;
  name: string;
  channel: string;
  startTime: number;
  endTime: number;
  duration: number;
  frames: RecordingFrame[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  currentFrame: RecordingFrame | null;
}

export interface AnomalyAlert {
  type: 'spike' | 'prolonged_fatigue';
  severity: number;
  channel: string;
  description: string;
  timestamp: number;
  maxZScore?: number;
  spikeTime?: number;
  spikeValue?: number;
  meanValue?: number;
  stdValue?: number;
  avgFatigue?: number;
  durationSec?: number;
  startTimestamp?: number;
  endTimestamp?: number;
  startTime?: string;
  endTime?: string;
}

export interface AnomalyResult {
  channel: string;
  hasAnomaly: boolean;
  alerts: AnomalyAlert[];
  timestamp: number;
}
