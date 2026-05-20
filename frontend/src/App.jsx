import { useState, useCallback, useRef } from 'react';
import { useSignalR } from './hooks/useSignalR';
import { IncomingCallModal } from './components/IncomingCallModal';
import { DevicesPage } from './pages/DevicesPage';
import { DoorPanel } from './components/DoorPanel';

const s = {
  app: { minHeight: '100vh', paddingTop: 56 },
  topbar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 20px', height: 56,
    background: 'rgba(26,26,46,0.97)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #0f3460',
  },
  logo: { fontWeight: 800, fontSize: 18, letterSpacing: 1, color: '#4ade80' },
  nav: { display: 'flex', gap: 4 },
  navBtn: (active) => ({
    padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
    background: active ? '#0f3460' : 'transparent',
    color: active ? '#fff' : '#94a3b8',
    border: 'none', cursor: 'pointer',
  }),
  status: (connected) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: connected ? '#4ade80' : '#f87171',
  }),
  dot: (connected) => ({
    width: 7, height: 7, borderRadius: '50%',
    background: connected ? '#4ade80' : '#f87171',
  }),
  idle: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: 'calc(100vh - 56px)', gap: 12, color: '#94a3b8',
  },
  icon: { fontSize: 60, marginBottom: 8 },
  idleTitle: { fontSize: 22, fontWeight: 700, color: '#e2e8f0' },
};

export default function App() {
  const [tab, setTab] = useState('home');
  const [call, setCall] = useState(null);
  const [answered, setAnswered] = useState(false);
  const notifAudio = useRef(null);

  const stopRing = () => {
    if (notifAudio.current) { notifAudio.current.pause(); notifAudio.current.currentTime = 0; }
  };

  const handlers = {
    onIncomingCall: useCallback((data) => {
      setCall(data);
      setAnswered(false);
      try {
        notifAudio.current = new Audio('/ringtone.mp3');
        notifAudio.current.loop = true;
        notifAudio.current.play().catch(() => {});
      } catch {}
      if (Notification.permission === 'granted') {
        new Notification('Damafon', {
          body: `${data.deviceName || 'Qurilma'}: qo\'ng\'iroq keldi`,
          icon: '/favicon.ico',
        });
      }
    }, []),

    onCallEnded: useCallback((data) => {
      setCall((prev) => (prev?.channelId === data.channelId ? null : prev));
      setAnswered(false);
      stopRing();
    }, []),

    onCallAnswered: useCallback((data) => {
      setAnswered(true);
    }, []),

    onActiveSessions: useCallback((sessions) => {
      if (sessions?.length > 0) {
        setCall(sessions[0]);
        setAnswered(sessions[0].status === 'Answered');
      }
    }, []),
  };

  const { connected, invoke } = useSignalR(handlers);

  const handleAnswer = useCallback(async () => {
    if (!call) return;
    stopRing();
    await invoke('AnswerCall', call.channelId);
    setAnswered(true);
    if (Notification.permission === 'default') Notification.requestPermission();
  }, [call, invoke]);

  const handleReject = useCallback(async () => {
    if (!call) return;
    stopRing();
    await invoke('RejectCall', call.channelId);
    setCall(null);
  }, [call, invoke]);

  const handleHangup = useCallback(async () => {
    if (!call) return;
    await invoke('HangupCall', call.channelId);
    setCall(null);
    setAnswered(false);
  }, [call, invoke]);

  return (
    <div style={s.app}>
      {/* Top bar */}
      <div style={s.topbar}>
        <div style={s.logo}>DAMAFON</div>
        <nav style={s.nav}>
          <button style={s.navBtn(tab === 'home')} onClick={() => setTab('home')}>
            🏠 Bosh sahifa
          </button>
          <button style={s.navBtn(tab === 'devices')} onClick={() => setTab('devices')}>
            📹 Qurilmalar
          </button>
        </nav>
        <div style={s.status(connected)}>
          <span style={s.dot(connected)} />
          {connected ? 'Ulangan' : 'Ulanmoqda...'}
        </div>
      </div>

      {/* Sahifalar */}
      {tab === 'home' && (
        <div>
          <div style={{ ...s.idle, height: 'auto', paddingTop: 40, paddingBottom: 20 }}>
            <div style={s.icon}>🏠</div>
            <div style={s.idleTitle}>Damafon Intercom</div>
            <div style={{ fontSize: 13 }}>
              {connected ? 'Qo\'ng\'iroqlar kutilmoqda...' : 'Server bilan ulanilmoqda...'}
            </div>
          </div>
          <DoorPanel />
        </div>
      )}

      {tab === 'devices' && <DevicesPage />}

      {/* Qo'ng'iroq modal (istalgan sahifada chiqadi) */}
      {call && (
        <IncomingCallModal
          call={call}
          answered={answered}
          onAnswer={handleAnswer}
          onReject={handleReject}
          onHangup={handleHangup}
        />
      )}
    </div>
  );
}
