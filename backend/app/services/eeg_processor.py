import numpy as np
from scipy import signal
import time

CHANNELS = ['Fp1','Fp2','F3','F4','C3','C4','P3','P4','O1','O2']
SAMPLE_RATE = 256
BANDS = {'delta': (0.5,4), 'theta': (4,8), 'alpha': (8,13), 'beta': (13,30), 'gamma': (30,100)}

ANOMALY_SPIKE_THRESHOLD = 3.0
ANOMALY_PROLONGED_DURATION_SEC = 10.0
ANOMALY_PROLONGED_FATIGUE_THRESHOLD = 60.0

_brain_state_history: list[dict] = []
_anomaly_alerts: list[dict] = []
_last_alert_time: float = 0.0
_ALERT_COOLDOWN_SEC = 5.0

def generate_mock_eeg(duration_sec: float = 5.0) -> dict:
    t = np.linspace(0, duration_sec, int(SAMPLE_RATE * duration_sec))
    data = {}
    for ch in CHANNELS:
        sig = 0.5*np.sin(2*np.pi*10*t) + 0.3*np.sin(2*np.pi*20*t) + 0.2*np.random.randn(len(t))
        data[ch] = sig.tolist()
    return {'channels': CHANNELS, 'sample_rate': SAMPLE_RATE, 'data': data, 'time': t.tolist(), 'duration': duration_sec}

def compute_band_power(channel_data: list, sample_rate: int) -> dict:
    freqs, psd = signal.welch(channel_data, fs=sample_rate, nperseg=256)
    result = {}
    for name, (low, high) in BANDS.items():
        mask = (freqs >= low) & (freqs <= high)
        result[name] = float(np.trapz(psd[mask], freqs[mask])) if mask.any() else 0.0
    return result

def compute_spectrogram(channel_data: list, sample_rate: int) -> dict:
    f, t, Sxx = signal.spectrogram(channel_data, fs=sample_rate, nperseg=128, noverlap=64)
    return {'frequencies': f.tolist(), 'time': t.tolist(), 'power': (10*np.log10(Sxx+1e-10)).tolist()}

def compute_brain_state(channel_data: list, sample_rate: int) -> dict:
    import time
    bands = compute_band_power(channel_data, sample_rate)
    total = sum(bands.values()) + 1e-10
    beta_rel = bands['beta'] / total
    alpha_rel = bands['alpha'] / total
    theta_rel = bands['theta'] / total
    focus = min(100.0, max(0.0, (beta_rel * 300) + np.random.uniform(-5, 5)))
    relaxation = min(100.0, max(0.0, (alpha_rel * 300) + np.random.uniform(-5, 5)))
    fatigue = min(100.0, max(0.0, (theta_rel * 300) + np.random.uniform(-5, 5)))
    scores = {'focused': focus, 'relaxed': relaxation, 'fatigued': fatigue}
    max_score = max(scores.values())
    if max_score < 50:
        status = 'neutral'
        status_label = '平稳'
        status_color = '#757575'
    else:
        status = max(scores, key=scores.get)
        if status == 'focused':
            status_label = '专注'
            status_color = '#1976d2'
        elif status == 'relaxed':
            status_label = '放松'
            status_color = '#388e3c'
        else:
            status_label = '疲劳'
            status_color = '#d32f2f'
    return {
        'focus': round(focus, 1),
        'relaxation': round(relaxation, 1),
        'fatigue': round(fatigue, 1),
        'status': status,
        'statusLabel': status_label,
        'statusColor': status_color,
        'timestamp': int(time.time() * 1000)
    }

def compute_correlation(target_channel: str, all_data: dict, sample_rate: int) -> dict:
    target_data = np.array(all_data[target_channel])
    correlations = []
    for ch in CHANNELS:
        if ch == target_channel:
            correlations.append({
                'channel': ch,
                'targetChannel': target_channel,
                'correlation': 1.0,
                'coherence': 1.0
            })
            continue
        ch_data = np.array(all_data[ch])
        corr = float(np.corrcoef(target_data, ch_data)[0, 1])
        f, coh = signal.coherence(target_data, ch_data, fs=sample_rate, nperseg=128)
        alpha_mask = (f >= 8) & (f <= 13)
        mean_coh = float(np.mean(coh[alpha_mask])) if alpha_mask.any() else 0.0
        correlations.append({
            'channel': ch,
            'targetChannel': target_channel,
            'correlation': round(corr, 4),
            'coherence': round(mean_coh, 4)
        })
    return {'targetChannel': target_channel, 'correlations': correlations}

def detect_spike_anomaly(channel_data: list, sample_rate: int) -> dict | None:
    arr = np.array(channel_data)
    mean_val = np.mean(arr)
    std_val = np.std(arr)
    if std_val < 1e-10:
        return None
    z_scores = np.abs((arr - mean_val) / std_val)
    max_z = float(np.max(z_scores))
    max_idx = int(np.argmax(z_scores))
    if max_z >= ANOMALY_SPIKE_THRESHOLD:
        spike_time = max_idx / sample_rate
        return {
            'type': 'spike',
            'severity': min(1.0, (max_z - ANOMALY_SPIKE_THRESHOLD) / ANOMALY_SPIKE_THRESHOLD),
            'maxZScore': round(max_z, 2),
            'spikeTime': round(spike_time, 3),
            'spikeValue': float(arr[max_idx]),
            'meanValue': round(float(mean_val), 4),
            'stdValue': round(float(std_val), 4),
            'timestamp': int(time.time() * 1000),
        }
    return None

def detect_prolonged_anomaly(brain_state: dict) -> dict | None:
    global _brain_state_history, _anomaly_alerts, _last_alert_time
    now = time.time()
    _brain_state_history.append({**brain_state, '_server_time': now})
    cutoff = now - ANOMALY_PROLONGED_DURATION_SEC * 2
    _brain_state_history = [s for s in _brain_state_history if s['_server_time'] > cutoff]
    window = [s for s in _brain_state_history if now - s['_server_time'] <= ANOMALY_PROLONGED_DURATION_SEC]
    if len(window) < 3:
        return None
    fatigue_scores = [s['fatigue'] for s in window]
    avg_fatigue = sum(fatigue_scores) / len(fatigue_scores)
    all_fatigued = all(s['fatigue'] >= ANOMALY_PROLONGED_FATIGUE_THRESHOLD for s in window)
    if all_fatigued and avg_fatigue >= ANOMALY_PROLONGED_FATIGUE_THRESHOLD:
        if now - _last_alert_time < _ALERT_COOLDOWN_SEC:
            return None
        start_ts = int(window[0]['timestamp'])
        end_ts = int(window[-1]['timestamp'])
        alert = {
            'type': 'prolonged_fatigue',
            'severity': min(1.0, (avg_fatigue - ANOMALY_PROLONGED_FATIGUE_THRESHOLD) / 40.0),
            'avgFatigue': round(avg_fatigue, 1),
            'durationSec': round((window[-1]['_server_time'] - window[0]['_server_time']), 1),
            'startTimestamp': start_ts,
            'endTimestamp': end_ts,
            'startTime': time.strftime('%H:%M:%S', time.localtime(start_ts / 1000)),
            'endTime': time.strftime('%H:%M:%S', time.localtime(end_ts / 1000)),
            'timestamp': int(now * 1000),
        }
        _anomaly_alerts.append(alert)
        _last_alert_time = now
        return alert
    return None

def get_anomaly_alerts(limit: int = 50) -> list[dict]:
    return _anomaly_alerts[-limit:]

def clear_anomaly_alerts() -> None:
    global _anomaly_alerts
    _anomaly_alerts = []

def analyze_anomaly(channel: str, channel_data: list, sample_rate: int, brain_state: dict) -> dict:
    spike = detect_spike_anomaly(channel_data, sample_rate)
    prolonged = detect_prolonged_anomaly(brain_state)
    alerts = []
    if spike:
        spike['channel'] = channel
        spike['description'] = f"通道 {channel} 检测到脑波突变，Z分数={spike['maxZScore']}，偏差值={spike['spikeValue']:.4f}"
        alerts.append(spike)
    if prolonged:
        prolonged['channel'] = channel
        prolonged['description'] = f"通道 {channel} 持续疲劳状态已 {prolonged['durationSec']}s，平均疲劳度={prolonged['avgFatigue']}"
        alerts.append(prolonged)
    return {
        'channel': channel,
        'hasAnomaly': len(alerts) > 0,
        'alerts': alerts,
        'timestamp': int(time.time() * 1000),
    }
