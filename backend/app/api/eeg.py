from fastapi import APIRouter
from ..services.eeg_processor import generate_mock_eeg, compute_band_power, compute_spectrogram, compute_brain_state, compute_correlation, analyze_anomaly, get_anomaly_alerts, clear_anomaly_alerts, SAMPLE_RATE

router = APIRouter(prefix="/eeg", tags=["eeg"])

@router.get("/stream")
async def stream_eeg(duration: float = 5.0):
    return generate_mock_eeg(duration)

@router.get("/bands/{channel}")
async def band_power(channel: str):
    data = generate_mock_eeg(5.0)
    if channel in data['data']:
        return {'channel': channel, 'bands': compute_band_power(data['data'][channel], SAMPLE_RATE)}
    return {'error': 'Channel not found'}

@router.get("/brain-state/{channel}")
async def brain_state(channel: str):
    data = generate_mock_eeg(5.0)
    if channel in data['data']:
        return {'channel': channel, 'state': compute_brain_state(data['data'][channel], SAMPLE_RATE)}
    return {'error': 'Channel not found'}

@router.get("/spectrogram/{channel}")
async def spectrogram(channel: str):
    data = generate_mock_eeg(5.0)
    if channel in data['data']:
        return {'channel': channel, 'spectrogram': compute_spectrogram(data['data'][channel], SAMPLE_RATE)}
    return {'error': 'Channel not found'}

@router.get("/correlation/{channel}")
async def correlation(channel: str, duration: float = 3.0):
    data = generate_mock_eeg(duration)
    if channel not in data['data']:
        return {'error': 'Channel not found'}
    return compute_correlation(channel, data['data'], SAMPLE_RATE)

@router.get("/channels")
async def list_channels():
    from ..services.eeg_processor import CHANNELS
    return {'channels': CHANNELS}

@router.get("/sample/{channel}")
async def full_sample(channel: str, duration: float = 3.0):
    data = generate_mock_eeg(duration)
    if channel not in data['data']:
        return {'error': 'Channel not found'}
    channel_data = data['data'][channel]
    brain_state = compute_brain_state(channel_data, SAMPLE_RATE)
    anomaly = analyze_anomaly(channel, channel_data, SAMPLE_RATE, brain_state)
    return {
        'channel': channel,
        'eeg': data,
        'bands': compute_band_power(channel_data, SAMPLE_RATE),
        'brainState': brain_state,
        'correlation': compute_correlation(channel, data['data'], SAMPLE_RATE),
        'anomaly': anomaly,
    }

@router.get("/anomaly/{channel}")
async def anomaly_check(channel: str, duration: float = 3.0):
    data = generate_mock_eeg(duration)
    if channel not in data['data']:
        return {'error': 'Channel not found'}
    channel_data = data['data'][channel]
    brain_state = compute_brain_state(channel_data, SAMPLE_RATE)
    return analyze_anomaly(channel, channel_data, SAMPLE_RATE, brain_state)

@router.get("/anomaly-alerts")
async def anomaly_alerts(limit: int = 50):
    return {'alerts': get_anomaly_alerts(limit), 'total': len(get_anomaly_alerts(limit))}

@router.delete("/anomaly-alerts")
async def anomaly_alerts_clear():
    clear_anomaly_alerts()
    return {'status': 'ok', 'message': 'All anomaly alerts cleared'}
