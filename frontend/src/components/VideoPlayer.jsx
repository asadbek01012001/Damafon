import { useEffect, useRef } from 'react';

const styles = {
  wrapper: {
    position: 'relative',
    width: '100%',
    background: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: '16/9',
  },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  overlay: {
    position: 'absolute', inset: 0, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    color: '#94a3b8', fontSize: 14, background: '#111',
  },
  badge: {
    position: 'absolute', top: 10, left: 10,
    background: '#ef4444', color: '#fff',
    padding: '2px 8px', borderRadius: 6,
    fontSize: 11, fontWeight: 700, letterSpacing: 1,
    display: 'flex', alignItems: 'center', gap: 4,
  },
  dot: {
    width: 6, height: 6, borderRadius: '50%',
    background: '#fff', animation: 'pulse 1s infinite',
  },
};

export function VideoPlayer({ stream, state }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream]);

  return (
    <div style={styles.wrapper}>
      {state === 'live' ? (
        <>
          <video
            ref={videoRef}
            style={styles.video}
            autoPlay
            playsInline
          />
          <div style={styles.badge}>
            <span style={styles.dot} />
            LIVE
          </div>
        </>
      ) : (
        <div style={styles.overlay}>
          {state === 'connecting' && 'Video yuklanmoqda...'}
          {state === 'error' && 'Video ulanmadi'}
          {state === 'idle' && 'Video yo\'q'}
        </div>
      )}
    </div>
  );
}
