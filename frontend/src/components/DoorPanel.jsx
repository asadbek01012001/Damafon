import { useState, useEffect, useRef } from 'react';
import { getDevices, openDeviceDoor } from '../services/apiService';
import { GO2RTC_URL } from '../services/apiService';

const s = {
  wrap: { padding: '16px 20px', maxWidth: 560, margin: '0 auto' },
  title: { fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 14, letterSpacing: 1 },
  card: {
    background: '#1a1a2e', border: '1px solid #0f3460',
    borderRadius: 16, overflow: 'hidden', marginBottom: 16,
  },
  videoBox: {
    width: '100%', aspectRatio: '16/9',
    background: '#000', position: 'relative',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  videoOverlay: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    color: '#475569', fontSize: 13, flexDirection: 'column', gap: 8,
  },
  liveBadge: {
    position: 'absolute', top: 10, left: 10,
    background: '#ef4444', color: '#fff',
    padding: '2px 8px', borderRadius: 6,
    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4,
  },
  liveDot: {
    width: 6, height: 6, borderRadius: '50%', background: '#fff',
    animation: 'pulse 1s infinite',
  },
  bottom: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '12px 16px', gap: 12,
  },
  info: { flex: 1 },
  name: { fontWeight: 700, fontSize: 15, color: '#e2e8f0' },
  host: { fontSize: 12, color: '#64748b', marginTop: 2 },
  brand: (b) => ({
    fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, marginLeft: 8,
    background: b === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
    color: b === 1 ? '#f87171' : '#60a5fa',
  }),
  msg: (ok) => ({
    fontSize: 12, fontWeight: 600, marginTop: 2,
    color: ok ? '#4ade80' : '#f87171',
  }),
  btn: (state) => ({
    padding: '10px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14,
    background: state === 'loading' ? '#374151'
      : state === 'ok' ? '#22c55e'
      : 'linear-gradient(135deg, #f59e0b, #d97706)',
    color: state === 'loading' ? '#6b7280' : '#000',
    minWidth: 110, textAlign: 'center', whiteSpace: 'nowrap',
  }),
  empty: { color: '#64748b', fontSize: 14, textAlign: 'center', padding: '40px 0' },
};

function LiveStream({ deviceId }) {
  const videoRef = useRef(null);
  const pcRef = useRef(null);
  const [status, setStatus] = useState('connecting'); // connecting | live | error

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        const ms = new MediaStream();
        if (videoRef.current) videoRef.current.srcObject = ms;

        pc.ontrack = (e) => e.streams[0]?.getTracks().forEach((t) => ms.addTrack(t));
        pc.onconnectionstatechange = () => {
          if (cancelled) return;
          if (pc.connectionState === 'connected') setStatus('live');
          if (pc.connectionState === 'failed') setStatus('error');
        };

        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise((res) => {
          if (pc.iceGatheringState === 'complete') { res(); return; }
          pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === 'complete') res(); };
          setTimeout(res, 3000);
        });

        const streamName = `device_${deviceId}`;
        const resp = await fetch(`${GO2RTC_URL}/api/webrtc?src=${streamName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription.sdp,
        });

        if (!resp.ok) throw new Error(`go2rtc ${resp.status}`);
        const sdp = await resp.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: 'answer', sdp });
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    start();
    return () => {
      cancelled = true;
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [deviceId]);

  return (
    <div style={s.videoBox}>
      <video ref={videoRef} style={s.video} autoPlay playsInline muted />
      {status !== 'live' && (
        <div style={s.videoOverlay}>
          <span style={{ fontSize: 28 }}>📷</span>
          <span>{status === 'connecting' ? 'Video yuklanmoqda...' : 'Video ulanmadi'}</span>
        </div>
      )}
      {status === 'live' && (
        <div style={s.liveBadge}>
          <span style={s.liveDot} />
          LIVE
        </div>
      )}
    </div>
  );
}

function DoorCard({ device }) {
  const [state, setState] = useState('idle'); // idle | loading | ok | error

  const handleOpen = async () => {
    setState('loading');
    try {
      await openDeviceDoor(device.id);
      setState('ok');
    } catch {
      setState('error');
    } finally {
      setTimeout(() => setState('idle'), 3000);
    }
  };

  return (
    <div style={s.card}>
      <LiveStream deviceId={device.id} />
      <div style={s.bottom}>
        <div style={s.info}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={s.name}>{device.name}</span>
            <span style={s.brand(device.brand)}>
              {device.brand === 1 ? 'Hikvision' : 'Dahua'}
            </span>
          </div>
          <div style={s.host}>{device.httpHost}</div>
          {state === 'ok' && <div style={s.msg(true)}>✓ Eshik ochildi</div>}
          {state === 'error' && <div style={s.msg(false)}>✗ Ulanmadi</div>}
        </div>
        <button
          style={s.btn(state)}
          onClick={handleOpen}
          disabled={state === 'loading'}
        >
          {state === 'loading' ? 'Ochilmoqda...'
            : state === 'ok' ? '✓ Ochildi'
            : '🔓 Ochish'}
        </button>
      </div>
    </div>
  );
}

export function DoorPanel() {
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    getDevices()
      .then((r) => setDevices(r.data.filter((d) => d.enabled)))
      .catch(() => {});
  }, []);

  return (
    <div style={s.wrap}>
      <div style={s.title}>🚪 QURILMALAR</div>
      {devices.length === 0 && (
        <div style={s.empty}>
          Qurilma topilmadi.<br />
          <span style={{ fontSize: 12 }}>"Qurilmalar" bo'limidan qo'shing.</span>
        </div>
      )}
      {devices.map((d) => <DoorCard key={d.id} device={d} />)}
    </div>
  );
}
