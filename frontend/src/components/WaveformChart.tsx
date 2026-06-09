import React, { useEffect, useState, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useEEGStore } from '../store/eeg';
import { EEGData, BandPower, BrainState, CorrelationData, AnomalyResult, AnomalyAlert } from '../types';
import axios from 'axios';

const CHANNEL_NAMES: Record<string, string> = {
  Fp1: '左前额', Fp2: '右前额', F3: '左额', F4: '右额',
  C3: '左中央', C4: '右中央', P3: '左顶', P4: '右顶',
  O1: '左枕', O2: '右枕'
};

const ALL_CHANNELS = ['Fp1', 'Fp2', 'F3', 'F4', 'C3', 'C4', 'P3', 'P4', 'O1', 'O2'];
const SAMPLE_RATE = 256;

const generateMockEEG = (durationSec: number = 3.0): EEGData => {
  const length = Math.floor(SAMPLE_RATE * durationSec);
  const time: number[] = [];
  const data: Record<string, number[]> = {};
  for (let i = 0; i < length; i++) {
    time.push(i / SAMPLE_RATE);
  }
  for (const ch of ALL_CHANNELS) {
    const sig: number[] = [];
    const alphaFreq = 8 + Math.random() * 4;
    const betaFreq = 15 + Math.random() * 10;
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      const value = 0.5 * Math.sin(2 * Math.PI * alphaFreq * t) +
                    0.3 * Math.sin(2 * Math.PI * betaFreq * t) +
                    0.2 * (Math.random() * 2 - 1);
      sig.push(value);
    }
    data[ch] = sig;
  }
  return { channels: ALL_CHANNELS, sample_rate: SAMPLE_RATE, data, time, duration: durationSec };
};

const computeBandPower = (): BandPower => {
  const total = 10 + Math.random() * 5;
  return {
    delta: total * (0.2 + Math.random() * 0.1),
    theta: total * (0.15 + Math.random() * 0.1),
    alpha: total * (0.25 + Math.random() * 0.15),
    beta: total * (0.3 + Math.random() * 0.15),
    gamma: total * (0.1 + Math.random() * 0.05),
  };
};

const computeBrainState = (bands: BandPower): BrainState => {
  const total = bands.delta + bands.theta + bands.alpha + bands.beta + bands.gamma + 1e-10;
  const betaRel = bands.beta / total;
  const alphaRel = bands.alpha / total;
  const thetaRel = bands.theta / total;
  const focus = Math.min(100, Math.max(0, betaRel * 300 + (Math.random() - 0.5) * 10));
  const relaxation = Math.min(100, Math.max(0, alphaRel * 300 + (Math.random() - 0.5) * 10));
  const fatigue = Math.min(100, Math.max(0, thetaRel * 300 + (Math.random() - 0.5) * 10));
  const scores = { focused: focus, relaxed: relaxation, fatigued: fatigue };
  const maxScore = Math.max(...Object.values(scores));
  let status: 'focused' | 'relaxed' | 'fatigued' | 'neutral' = 'neutral';
  let statusLabel = '平稳';
  let statusColor = '#757575';
  if (maxScore >= 50) {
    const maxKey = Object.keys(scores).find(k => scores[k as keyof typeof scores] === maxScore) as keyof typeof scores;
    status = maxKey;
    if (status === 'focused') { statusLabel = '专注'; statusColor = '#1976d2'; }
    else if (status === 'relaxed') { statusLabel = '放松'; statusColor = '#388e3c'; }
    else { statusLabel = '疲劳'; statusColor = '#d32f2f'; }
  }
  return {
    focus: Math.round(focus * 10) / 10,
    relaxation: Math.round(relaxation * 10) / 10,
    fatigue: Math.round(fatigue * 10) / 10,
    status,
    statusLabel,
    statusColor,
    timestamp: Date.now(),
  };
};

const computeCorrelation = (targetChannel: string, eegData: EEGData): CorrelationData => {
  const targetData = eegData.data[targetChannel];
  const correlations = ALL_CHANNELS.map(ch => {
    if (ch === targetChannel) {
      return { channel: ch, targetChannel, correlation: 1.0, coherence: 1.0 };
    }
    const chData = eegData.data[ch];
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
    const n = targetData.length;
    for (let i = 0; i < n; i++) {
      sumXY += targetData[i] * chData[i];
      sumX += targetData[i];
      sumY += chData[i];
      sumX2 += targetData[i] * targetData[i];
      sumY2 += chData[i] * chData[i];
    }
    const corr = (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    return {
      channel: ch,
      targetChannel,
      correlation: Math.round(corr * 10000) / 10000,
      coherence: Math.round((0.3 + Math.random() * 0.5) * 10000) / 10000,
    };
  });
  return { targetChannel, correlations };
};

const SPIKE_THRESHOLD = 3.0;
const PROLONGED_FATIGUE_THRESHOLD = 60.0;
const PROLONGED_WINDOW_SIZE = 3;
const _fatigueHistory: { fatigue: number; timestamp: number }[] = [];

const detectAnomalyFrontend = (channel: string, eegData: EEGData, brainState: BrainState): AnomalyResult => {
  const alerts: AnomalyAlert[] = [];
  const channelData = eegData.data[channel] || [];
  if (channelData.length > 0) {
    const mean = channelData.reduce((a, b) => a + b, 0) / channelData.length;
    const std = Math.sqrt(channelData.reduce((a, b) => a + (b - mean) ** 2, 0) / channelData.length);
    if (std > 1e-10) {
      const zScores = channelData.map(v => Math.abs((v - mean) / std));
      const maxZ = Math.max(...zScores);
      const maxIdx = zScores.indexOf(maxZ);
      if (maxZ >= SPIKE_THRESHOLD) {
        alerts.push({
          type: 'spike',
          severity: Math.min(1.0, (maxZ - SPIKE_THRESHOLD) / SPIKE_THRESHOLD),
          channel,
          description: `通道 ${channel} 检测到脑波突变，Z分数=${maxZ.toFixed(2)}，偏差值=${channelData[maxIdx].toFixed(4)}`,
          timestamp: Date.now(),
          maxZScore: Math.round(maxZ * 100) / 100,
          spikeTime: Math.round((maxIdx / eegData.sample_rate) * 1000) / 1000,
          spikeValue: channelData[maxIdx],
          meanValue: Math.round(mean * 10000) / 10000,
          stdValue: Math.round(std * 10000) / 10000,
        });
      }
    }
  }

  _fatigueHistory.push({ fatigue: brainState.fatigue, timestamp: brainState.timestamp });
  const cutoff = Date.now() - 30000;
  while (_fatigueHistory.length > 0 && _fatigueHistory[0].timestamp < cutoff) {
    _fatigueHistory.shift();
  }
  if (_fatigueHistory.length >= PROLONGED_WINDOW_SIZE) {
    const recent = _fatigueHistory.slice(-PROLONGED_WINDOW_SIZE);
    const allFatigued = recent.every(s => s.fatigue >= PROLONGED_FATIGUE_THRESHOLD);
    const avgFatigue = recent.reduce((a, s) => a + s.fatigue, 0) / recent.length;
    if (allFatigued && avgFatigue >= PROLONGED_FATIGUE_THRESHOLD) {
      const startTs = recent[0].timestamp;
      const endTs = recent[recent.length - 1].timestamp;
      const durationSec = (endTs - startTs) / 1000;
      alerts.push({
        type: 'prolonged_fatigue',
        severity: Math.min(1.0, (avgFatigue - PROLONGED_FATIGUE_THRESHOLD) / 40.0),
        channel,
        description: `通道 ${channel} 持续疲劳状态已 ${durationSec.toFixed(1)}s，平均疲劳度=${avgFatigue.toFixed(1)}`,
        timestamp: Date.now(),
        avgFatigue: Math.round(avgFatigue * 10) / 10,
        durationSec: Math.round(durationSec * 10) / 10,
        startTimestamp: startTs,
        endTimestamp: endTs,
        startTime: new Date(startTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        endTime: new Date(endTs).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    }
  }

  return {
    channel,
    hasAnomaly: alerts.length > 0,
    alerts,
    timestamp: Date.now(),
  };
};

export const WaveformChart: React.FC = () => {
  const {
    eegData, selectedChannel, setEEGData, setBandPower, setBrainState, setCorrelationData,
    isRecording, addRecordingFrame, playbackMode, setAnomalyResult, addAnomalyAlerts,
  } = useEEGStore();
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const fetchEEG = async () => {
    const state = useEEGStore.getState();
    if (state.playbackMode) return;
    setLoading(true);
    let eeg: EEGData, bands: BandPower, brainState: BrainState, correlation: CorrelationData;
    let anomaly: AnomalyResult | null = null;
    try {
      const { data } = await axios.get(`/api/eeg/sample/${state.selectedChannel}?duration=3`);
      eeg = data.eeg;
      bands = data.bands;
      brainState = data.brainState;
      correlation = data.correlation;
      anomaly = data.anomaly || null;
    } catch {
      eeg = generateMockEEG(3);
      bands = computeBandPower();
      brainState = computeBrainState(bands);
      correlation = computeCorrelation(state.selectedChannel, eeg);
      anomaly = detectAnomalyFrontend(state.selectedChannel, eeg, brainState);
    }
    state.setEEGData(eeg);
    state.setBandPower(bands);
    state.setBrainState(brainState);
    state.setCorrelationData(correlation);
    if (anomaly) {
      state.setAnomalyResult(anomaly);
      if (anomaly.hasAnomaly && anomaly.alerts.length > 0) {
        state.addAnomalyAlerts(anomaly.alerts);
      }
    } else {
      state.setAnomalyResult(null);
    }
    if (state.isRecording) {
      state.addRecordingFrame(eeg, bands, brainState);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (playbackMode) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    fetchEEG();
    intervalRef.current = window.setInterval(fetchEEG, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedChannel, playbackMode]);

  const chartData = eegData?.data[selectedChannel]?.map((v: number, i: number) => ({
    t: eegData.time[i]?.toFixed(3), value: v.toFixed(4)
  })) || [];

  const channelName = CHANNEL_NAMES[selectedChannel] || selectedChannel;

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>📈</span>
        <span>{selectedChannel}</span>
        <span style={{ fontSize: '13px', color: '#666', fontWeight: 400 }}>{channelName} · 波形图</span>
        {isRecording && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#d32f2f', fontWeight: 500 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d32f2f', animation: 'pulse 1s infinite' }} />
            录制中
          </span>
        )}
        {playbackMode && (
          <span style={{ fontSize: '12px', color: '#1565c0', fontWeight: 500 }}>⏮ 回放模式</span>
        )}
        {loading && !playbackMode && <span style={{ fontSize: '12px', color: '#999' }}>刷新中...</span>}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <XAxis dataKey="t" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip />
          <Line type="monotone" dataKey="value" stroke="#1565c0" dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
