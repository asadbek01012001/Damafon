const styles = {
  bar: {
    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 20px',
    background: 'rgba(26,26,46,0.95)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #0f3460',
  },
  logo: { fontWeight: 800, fontSize: 18, letterSpacing: 1, color: '#4ade80' },
  right: { display: 'flex', alignItems: 'center', gap: 12 },
  indicator: (connected) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, color: connected ? '#4ade80' : '#f87171',
  }),
  dot: (connected) => ({
    width: 8, height: 8, borderRadius: '50%',
    background: connected ? '#4ade80' : '#f87171',
  }),
};

export function StatusBar({ connected }) {
  return (
    <div style={styles.bar}>
      <div style={styles.logo}>DAMAFON</div>
      <div style={styles.right}>
        <div style={styles.indicator(connected)}>
          <span style={styles.dot(connected)} />
          {connected ? 'Ulangan' : 'Ulanmoqda...'}
        </div>
      </div>
    </div>
  );
}
