"""API integration checks use a fresh isolated ledger, never the user's evidence."""
import importlib
import io
import json
import sys

import pytest
import numpy as np
import soundfile as sf
from fastapi.testclient import TestClient


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setenv('VOXTRACE_HOME', str(tmp_path / 'data'))
    monkeypatch.setenv('VOXTRACE_LEDGER_KEY', '12' * 32)
    monkeypatch.delenv('VOXTRACE_KEY_FILE', raising=False)
    monkeypatch.delenv('VOXTRACE_KEY_FP', raising=False)
    sys.modules.pop('voxtrace.api', None)
    module = importlib.import_module('voxtrace.api')
    module._audio.trained = False
    module.vt.video.model_path = tmp_path / 'missing.pt'
    with TestClient(module.app) as client:
        yield client, module
    module.ledger.db.close()
    sys.modules.pop('voxtrace.api', None)


def test_fresh_api_has_no_invented_results(api):
    client, module = api
    assert client.get('/incidents').json() == []
    status = client.get('/status').json()
    assert status['research'] == 'unmeasured'
    assert status['wazuh'] == 'not verified'
    assert status['audio']['available'] is False
    assert status['video']['available'] is False
    assert status['video']['reason'] == 'No trained video model is installed.'
    evaluation = client.get('/models/evaluation').json()
    assert evaluation['status'] == 'measured'
    assert len(evaluation['table']) == 3
    assert evaluation['table'][1]['roc_auc'] == pytest.approx(0.9401, abs=0.001)
    assert len(evaluation['roc_curve']) == 101
    assert evaluation['confusion_matrices']['audio']['tp'] > 0
    assert 'source audio dataset is not present' in evaluation['message']
    assert client.get('/iocs').json()[0]['source'].startswith('EXAMPLE-ONLY')
    assert any(ioc['value'] == 'ElevenLabs' for ioc in client.get('/iocs').json())
    assert client.post('/ledger/tamper-demo', json={'tamper': True}).status_code == 404
    assert client.post('/robustness/simulate', json={}).status_code == 404


def test_preview_inventory_is_separate_from_evaluation(api, tmp_path, monkeypatch):
    client, module = api
    preview = tmp_path / 'preview'
    for folder, names in (('video', ('real-1.mp4', 'real-2.mov')), ('deepfake', ('fake-1.mp4',))):
        directory = preview / folder
        directory.mkdir(parents=True)
        for name in names:
            (directory / name).write_bytes(b'preview')
    monkeypatch.setattr(module, 'VIDEO_PREVIEW_DIR', preview)

    data = client.get('/dataset/preview').json()
    assert data['total_videos'] == 3
    assert data['evaluated'] is False
    assert [item['count'] for item in data['classes']] == [2, 1]
    assert client.get('/models/evaluation').json()['status'] == 'measured'


def test_upload_preserves_unscored_evidence_and_matches_ioc(api):
    client, module = api
    result = client.post('/analyze', files={'audio': ('sample.wav', b'unscorable input', 'audio/wav')},
                         data={'observables': json.dumps({'phone': ['+910000000000']})})
    assert result.status_code == 200, result.text
    record = result.json()
    assert record['verdict'] == 'UNSCORED'
    assert record['audio_score'] is None and record['fused_score'] is None
    assert record['ioc_matches'][0]['value'] == '+910000000000'
    assert record['severity'] == 'MEDIUM'
    intel = client.get('/intel').json()
    assert intel['rule_card']['status'] == 'ACTIVE'
    assert len(intel['graph']['links']) == 1
    assert any(node['label'] == '+910000000000' for node in intel['graph']['nodes'])
    assert record['provenance']['run_id'] == record['record_hash']
    detail = client.get('/incidents/' + record['record_hash']).json()
    assert detail['evidence_files'][0]['sha256']
    assert not detail['simulated']
    assert client.get('/incidents', params={'search': 'sample.wav'}).json()[0]['record_hash'] == record['record_hash']
    verified = client.post('/ledger/verify').json()
    assert verified['chain_intact'], verified
    assert not verified['checked_key_fingerprint']
    bundle = client.get('/evidence/bundle/' + record['record_hash']).json()
    assert bundle['verification']['chain_intact']
    assert 'legal admissibility' in bundle['limitations']
    # Tampered evidence must be shown as failed verification, including in exports.
    with open(detail['evidence_files'][0]['path'], 'ab') as stream:
        stream.write(b'changed')
    assert not client.post('/ledger/verify').json()['chain_intact']
    assert not client.get('/evidence/bundle/' + record['record_hash']).json()['verification']['chain_intact']


def test_trained_audio_model_scores_upload(api):
    client, module = api
    module._audio.load(str(module.ROOT / 'models' / 'audio.joblib'))
    buffer = io.BytesIO()
    samples = (0.1 * np.random.default_rng(42).normal(size=16000)).astype('float32')
    sf.write(buffer, samples, 16000, format='WAV')
    buffer.seek(0)

    response = client.post('/analyze', files={'audio': ('voice.wav', buffer, 'audio/wav')})
    assert response.status_code == 200, response.text
    result = response.json()
    assert isinstance(result['audio_score'], float)
    assert 0 <= result['audio_score'] <= 1
    assert result['fused_score'] == result['audio_score']
    assert result['verdict'] in ('FAKE', 'REAL')
    incident = client.get('/incidents').json()[0]
    assert incident['model_versions']['audio'] == module._audio.version


def test_trained_audio_model_returns_unscored_for_unsupported_upload(api):
    client, module = api
    module._audio.load(str(module.ROOT / 'models' / 'audio.joblib'))

    response = client.post('/analyze', files={'audio': ('invalid.wav', b'not an audio file', 'audio/wav')})
    assert response.status_code == 200, response.text
    assert response.json()['verdict'] == 'UNSCORED'
    assert response.json()['audio_score'] is None


def test_video_and_invalid_inputs(api):
    client, module = api
    result = client.post('/analyze', files={'video': ('broken.mp4', b'', 'video/mp4')})
    assert result.status_code == 200, result.text
    assert result.json()['verdict'] == 'UNSCORED'
    assert result.json()['video_score'] is None
    assert result.json()['video_details']['error'] == 'No trained video model is available'
    assert 'No trained video model is available' in result.json()['warnings'][0]
    assert client.post('/analyze').status_code == 400
    assert client.post('/analyze', files={'audio': ('sample.wav', b'test')}, data={'observables': '[]'}).status_code == 422
    assert client.get('/incidents/unknown').status_code == 404
    assert client.get('/incidents?limit=-1').status_code == 422


def test_restored_dashboard_uses_real_empty_state(api):
    client, module = api
    metrics = client.get('/metrics').json()
    assert metrics['samples_analyzed'] == 0
    assert metrics['detections_over_time'] == []
    assert metrics['system_health']['wazuh_agent'] == 'NOT VERIFIED'
    assert client.get('/ledger/chain').json()['blocks'] == []
    assert client.get('/intel').json()['graph']['nodes'] == []
    assert client.get('/alerts').json()['alerts'] == []
    assert client.post('/robustness/status').json()['evasion_rate'] is None
    registry = client.get('/models/evaluation').json()['registry']
    assert {item['name'] for item in registry} == {'Audio baseline', 'Audio phone-augmented'}
    assert len(registry) == 2
