import React, { useState } from 'react';
import { useEEGStore } from '../store/eeg';
import { AnomalyAlert } from '../types';

const CHANNEL_NAMES: Record<string, string> = {
  Fp1: '左前额', Fp2: '右前额', F3: '左额', F4: '右额',
  C3: '左中央', C4: '右中央', P3: '左顶', P4: '右顶',
  O1: '左枕', O2: '右枕'
};

const severityColor = (severity: number): string => {
  if (severity >= 0.7) return '#d32f2f';
  if (severity >= 0.4) return '#f57c00';
  return '#fbc02d';
};

const severityLabel = (severity: number): string => {
  if (severity >= 0.7) return '高';
  if (severity >= 0.4) return '中';
  return '低';
};

const formatTime = (ts: number): string => {
  return new Date(ts).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDate = (ts: number): string => {
  return new Date(ts).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
};

type FilterType = 'all' | 'spike' | 'prolonged_fatigue';

export const AnomalyAlertCenter: React.FC = () => {
  const {
    anomalyResult,
    anomalyAlerts,
    anomalyAlertCount,
    showAnomalyPanel,
    clearAnomalyAlerts,
    toggleAnomalyPanel,
  } = useEEGStore();

  const [filter, setFilter] = useState<FilterType>('all');

  const filteredAlerts = filter === 'all'
    ? anomalyAlerts
    : anomalyAlerts.filter(a => a.type === filter);

  const spikeCount = anomalyAlerts.filter(a => a.type === 'spike').length;
  const prolongedCount = anomalyAlerts.filter(a => a.type === 'prolonged_fatigue').length;

  const latestAlerts = anomalyAlerts.slice(-3).reverse();

  const groupedByDate = filteredAlerts.reduce<Record<string, AnomalyAlert[]>>((acc, alert) => {
    const date = formatDate(alert.timestamp);
    if (!acc[date]) acc[date] = [];
    acc[date].push(alert);
    return acc;
  }, {});

  return (
    <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', margin: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '20px' }}>🚨</span>
          异常告警中心
          {anomalyAlertCount > 0 && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '20px',
              height: '20px',
              padding: '0 6px',
              background: '#d32f2f',
              color: '#fff',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              {anomalyAlertCount}
            </span>
          )}
        </h3>
        <button
          onClick={toggleAnomalyPanel}
          style={{
            padding: '4px 10px',
            background: showAnomalyPanel ? '#e3f2fd' : '#f5f5f5',
            color: showAnomalyPanel ? '#1565c0' : '#666',
            border: '1px solid ' + (showAnomalyPanel ? '#90caf9' : '#e0e0e0'),
            borderRadius: '6px',
            fontSize: '12px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {showAnomalyPanel ? '收起' : '展开'}
        </button>
      </div>

      {anomalyResult && anomalyResult.hasAnomaly && (
        <div style={{
          padding: '12px',
          background: 'linear-gradient(135deg, #ffebee, #ffcdd2)',
          borderRadius: '10px',
          border: '1px solid #ef9a9a',
          marginBottom: '12px',
          animation: 'alertFlash 0.6s ease-in-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#c62828' }}>检测到实时异常</span>
          </div>
          {anomalyResult.alerts.map((alert, idx) => (
            <div key={idx} style={{
              fontSize: '12px',
              color: '#b71c1c',
              padding: '4px 0',
              borderBottom: idx < anomalyResult.alerts.length - 1 ? '1px solid rgba(239,154,154,0.5)' : 'none',
            }}>
              {alert.type === 'spike' ? '⚡' : '😴'} {alert.description}
            </div>
          ))}
        </div>
      )}

      {!anomalyResult?.hasAnomaly && (
        <div style={{
          padding: '12px',
          background: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
          borderRadius: '10px',
          border: '1px solid #a5d6a7',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <span style={{ fontSize: '16px' }}>✅</span>
          <span style={{ fontSize: '12px', color: '#2e7d32', fontWeight: 500 }}>当前状态正常，未检测到异常</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <StatBadge label="脑波突变" count={spikeCount} icon="⚡" color="#f57c00" />
        <StatBadge label="持续疲劳" count={prolongedCount} icon="😴" color="#d32f2f" />
        <StatBadge label="总计" count={anomalyAlertCount} icon="📊" color="#1565c0" />
      </div>

      {latestAlerts.length > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#999', marginBottom: '6px', fontWeight: 500 }}>最新告警</div>
          {latestAlerts.map((alert, idx) => (
            <div key={idx} style={{
              padding: '8px 10px',
              background: idx === 0 ? '#fff3e0' : '#fafafa',
              borderRadius: '6px',
              marginBottom: '4px',
              borderLeft: `3px solid ${severityColor(alert.severity)}`,
              fontSize: '11px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>{alert.type === 'spike' ? '⚡' : '😴'}</span>
                  <span style={{ fontWeight: 600, color: '#333' }}>
                    {alert.type === 'spike' ? '脑波突变' : '持续疲劳'}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    padding: '1px 5px',
                    borderRadius: '3px',
                    background: severityColor(alert.severity) + '20',
                    color: severityColor(alert.severity),
                    fontWeight: 600,
                  }}>
                    {severityLabel(alert.severity)}
                  </span>
                </div>
                <div style={{ color: '#666', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {CHANNEL_NAMES[alert.channel] || alert.channel}
                  {alert.type === 'prolonged_fatigue' && alert.durationSec ? ` · ${alert.durationSec}s` : ''}
                  {alert.type === 'spike' && alert.maxZScore ? ` · Z=${alert.maxZScore}` : ''}
                </div>
              </div>
              <div style={{ fontSize: '10px', color: '#999', flexShrink: 0, marginLeft: '8px' }}>
                {formatTime(alert.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAnomalyPanel && (
        <div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {([['all', '全部'], ['spike', '突变'], ['prolonged_fatigue', '持续疲劳']] as [FilterType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: '4px 10px',
                  background: filter === key ? '#1565c0' : '#f5f5f5',
                  color: filter === key ? '#fff' : '#666',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                {label}
              </button>
            ))}
            {anomalyAlertCount > 0 && (
              <button
                onClick={clearAnomalyAlerts}
                style={{
                  padding: '4px 10px',
                  background: '#ffebee',
                  color: '#d32f2f',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  marginLeft: 'auto',
                }}
              >
                清除全部
              </button>
            )}
          </div>

          {filteredAlerts.length === 0 ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: '#999',
              fontSize: '13px',
              border: '1px dashed #e0e0e0',
              borderRadius: '8px',
            }}>
              {anomalyAlertCount === 0 ? '暂无异常告警记录' : '当前筛选条件下无记录'}
            </div>
          ) : (
            <div style={{ maxHeight: '320px', overflow: 'auto' }}>
              {Object.entries(groupedByDate).reverse().map(([date, alerts]) => (
                <div key={date} style={{ marginBottom: '12px' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#999',
                    fontWeight: 600,
                    paddingBottom: '4px',
                    borderBottom: '1px solid #f0f0f0',
                    marginBottom: '6px',
                  }}>
                    {date}
                  </div>
                  {alerts.reverse().map((alert, idx) => (
                    <AlertDetailRow key={idx} alert={alert} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes alertFlash {
          0%, 100% { opacity: 1; }
          25% { opacity: 0.7; }
          50% { opacity: 1; }
          75% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

const StatBadge: React.FC<{ label: string; count: number; icon: string; color: string }> = ({ label, count, icon, color }) => (
  <div style={{
    flex: 1,
    padding: '8px',
    background: color + '0a',
    borderRadius: '8px',
    border: `1px solid ${color}20`,
    textAlign: 'center',
  }}>
    <div style={{ fontSize: '14px', marginBottom: '2px' }}>{icon}</div>
    <div style={{ fontSize: '16px', fontWeight: 700, color }}>{count}</div>
    <div style={{ fontSize: '10px', color: '#999' }}>{label}</div>
  </div>
);

const AlertDetailRow: React.FC<{ alert: AnomalyAlert }> = ({ alert }) => (
  <div style={{
    padding: '10px',
    borderRadius: '6px',
    borderLeft: `3px solid ${severityColor(alert.severity)}`,
    marginBottom: '6px',
    background: '#fafafa',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>{alert.type === 'spike' ? '⚡' : '😴'}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
          {alert.type === 'spike' ? '脑波突变' : '持续疲劳异常'}
        </span>
        <span style={{
          fontSize: '10px',
          padding: '1px 5px',
          borderRadius: '3px',
          background: severityColor(alert.severity) + '20',
          color: severityColor(alert.severity),
          fontWeight: 600,
        }}>
          {severityLabel(alert.severity)}
        </span>
      </div>
      <span style={{ fontSize: '10px', color: '#999' }}>{formatTime(alert.timestamp)}</span>
    </div>
    <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.5' }}>
      <div>通道: {CHANNEL_NAMES[alert.channel] || alert.channel} ({alert.channel})</div>
      {alert.type === 'spike' && (
        <>
          <div>Z分数: {alert.maxZScore} · 突变值: {alert.spikeValue?.toFixed(4)} · 均值: {alert.meanValue} · 标准差: {alert.stdValue}</div>
          <div>突变时刻: {alert.spikeTime?.toFixed(3)}s</div>
        </>
      )}
      {alert.type === 'prolonged_fatigue' && (
        <>
          <div>平均疲劳度: {alert.avgFatigue} · 持续时长: {alert.durationSec}s</div>
          <div>异常时段: {alert.startTime} ~ {alert.endTime}</div>
        </>
      )}
    </div>
  </div>
);
