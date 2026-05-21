import { useEffect, useRef, useState } from 'react';
import { VideoPlayer } from './VideoPlayer';
import { useWebRTC } from '../hooks/useWebRTC';
import { openDoor, openDeviceDoor } from '../services/apiService';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(6px)',
  },
  card: {
    background: '#1a1a2e',
    border: '1px solid #0f3460',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 480,
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  header: { display: 'flex', alignItems: 'center', gap: 14 },
  avatar: {
    width: 52, height: 52, borderRadius: '50%',
    background: 'linear-gradient(135deg, #0f3460, #4ade80)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24,
  },
  callerInfo: { flex: 1 },
  callerName: { fontWeight: 700, fontSize: 18, color: '#e2e8f0' },
  callerNum: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  ringing: { fontSize: 12, color: '#fbbf24', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 },
  ringDot: { width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', animation: 'pulse 1s infinite' },
  micRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    fontSize: 13, color: '#94a3b8',
  },
  micBtn: (active) => ({
    padding: '8px 16px', borderRadius: 20,
    background: active ? '#4ade80' : '#374151',
    color: active ? '#000' : '#fff',
    fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: 6,
  }),
  actions: { display: 'flex', gap: 12 },
  btnAccept: {
    flex: 1, padding: '12px 0', borderRadius: 12,
    background: '#22c55e', color: '#fff', fontSize: 15, fontWeight: 700,
    boxShadow: '0 4px 20px rgba(34,197,94,0.4)',
  },
  btnReject: {
    flex: 1, padding: '12px 0', borderRadius: 12,
    background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700,
    boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
  },
  btnHangup: {
    flex: 1, padding: '12px 0', borderRadius: 12,
    background: '#ef4444', color: '#fff', fontSize: 15, fontWeight: 700,
  },
  btnDoor: {
    flex: 1, padding: '12px 0', borderRadius: 12,
    background: '#f59e0b', color: '#000', fontSize: 15, fontWeight: 700,
    boxShadow: '0 4px 20px rgba(245,158,11,0.4)',
  },
  doorMsg: { textAlign: 'center', fontSize: 13, color: '#4ade80', fontWeight: 600 },
  callTimer: { textAlign: 'center', fontSize: 14, color: '#94a3b8', fontWeight: 600, letterSpacing: 1 },
};

function useCallTimer(active) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function IncomingCallModal({ call, onAnswer, onReject, onHangup, answered, sipState, acceptSip, hangupSip, muteMic }) {
  const sipAudioRef = useRef(null);
  const sipAcceptedRef = useRef(false);
  const { stream, videoState, connect, disconnect, toggleLocalMic } = useWebRTC();
  const [micOn, setMicOn] = useState(true);
  const [doorMsg, setDoorMsg] = useState('');
  const timer = useCallTimer(answered);

  const sipEnabled = call.sipEnabled !== false;

  // Video + audio ulanish
  useEffect(() => {
    if (!answered) return;
    const streamName = call.deviceId ? `device_${call.deviceId}` : 'dahua_sub';
    connect(streamName, !sipEnabled);
    return () => disconnect();
  }, [answered]);

  // SIP audio — faqat SIP qurilmalar uchun, bir marta
  useEffect(() => {
    if (!sipEnabled) return;
    if (!answered) { sipAcceptedRef.current = false; return; }
    if (sipState === 'calling' && !sipAcceptedRef.current) {
      sipAcceptedRef.current = true;
      acceptSip(sipAudioRef.current).catch(() => {});
    }
  }, [answered, sipState]);

  const handleDoor = async () => {
    try {
      if (call.deviceId) await openDeviceDoor(call.deviceId);
      else await openDoor();
      setDoorMsg('Eshik ochildi!');
      setTimeout(() => setDoorMsg(''), 3000);
    } catch {
      setDoorMsg('Xatolik yuz berdi');
      setTimeout(() => setDoorMsg(''), 3000);
    }
  };

  const handleHangup = () => {
    hangupSip().catch(() => {});
    onHangup();
  };

  const toggleMic = () => {
    const next = !micOn;
    setMicOn(next);
    if (!sipEnabled) {
      toggleLocalMic(next);   // go2rtc RTSP backchannel mic
    } else {
      muteMic(next);           // SIP.js peer connection audio track
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Sarlavha */}
        <div style={styles.header}>
          <div style={styles.avatar}>🔔</div>
          <div style={styles.callerInfo}>
            <div style={styles.callerName}>{call.deviceName || 'Mehmon keldi'}</div>
            <div style={styles.callerNum}>{call.callerId}</div>
            {!answered && (
              <div style={styles.ringing}>
                <span style={styles.ringDot} />
                Qo'ng'iroq kelmoqda...
              </div>
            )}
          </div>
        </div>

        {/* Qo'ng'iroq qabul qilinganida */}
        {answered && (
          <>
            {/* Video */}
            <VideoPlayer stream={stream} state={videoState} />

            {/* Vaqt + mikrofon */}
            <div style={styles.callTimer}>{timer}</div>
            <div style={styles.micRow}>
              <button style={styles.micBtn(micOn)} onClick={toggleMic}>
                {micOn ? '🎤 Mikrofon yoqiq' : '🔇 Mikrofon o\'chiq'}
              </button>
            </div>

            {/* SIP audio elementi (ko'rinmas) */}
            <audio ref={sipAudioRef} autoPlay style={{ display: 'none' }} />
          </>
        )}

        {doorMsg && <div style={styles.doorMsg}>{doorMsg}</div>}

        {/* Tugmalar */}
        <div style={styles.actions}>
          {!answered ? (
            <>
              <button style={styles.btnAccept} onClick={onAnswer}>Qabul qilish</button>
              <button style={styles.btnReject} onClick={onReject}>Rad etish</button>
            </>
          ) : (
            <>
              <button style={styles.btnDoor} onClick={handleDoor}>🔓 Eshikni och</button>
              <button style={styles.btnHangup} onClick={handleHangup}>📵 Tugatish</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
