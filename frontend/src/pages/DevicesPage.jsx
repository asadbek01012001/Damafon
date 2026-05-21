import { useState, useEffect } from 'react';
import { getDevices, createDevice, updateDevice, deleteDevice } from '../services/apiService';

const BRANDS = [
  { value: 0, label: 'Dahua' },
  { value: 1, label: 'Hikvision' },
];

const DEFAULTS_BY_BRAND = {
  0: { rtspPort: 554, httpPort: 80 },   // Dahua
  1: { rtspPort: 554, httpPort: 80 },   // Hikvision
};

const EMPTY = {
  brand: 0,
  name: '',
  enabled: true,
  sipEnabled: true,
  sipCallerId: '',
  rtspHost: '',
  rtspPort: 554,
  rtspUsername: 'admin',
  rtspPassword: '',
  rtspChannel: 1,
  httpHost: '',
  httpPort: 80,
  httpUsername: 'admin',
  httpPassword: '',
  httpChannel: 1,
};

const s = {
  page: { padding: '20px', maxWidth: 700, margin: '0 auto' },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#e2e8f0' },
  card: {
    background: '#1a1a2e', border: '1px solid #0f3460',
    borderRadius: 14, padding: 20, marginBottom: 16,
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  deviceName: { fontWeight: 700, fontSize: 16, color: '#e2e8f0' },
  badge: (enabled) => ({
    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
    background: enabled ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
    color: enabled ? '#4ade80' : '#f87171',
  }),
  meta: { fontSize: 13, color: '#64748b', marginTop: 6 },
  btnRow: { display: 'flex', gap: 8, marginTop: 12 },
  btnEdit: { padding: '6px 14px', borderRadius: 8, background: '#0f3460', color: '#fff' },
  btnDel: { padding: '6px 14px', borderRadius: 8, background: '#7f1d1d', color: '#fff' },
  addBtn: {
    width: '100%', padding: '12px', borderRadius: 12, marginBottom: 20,
    background: 'linear-gradient(135deg, #0f3460, #4ade80)',
    color: '#fff', fontSize: 15, fontWeight: 700,
  },
  form: {
    background: '#16213e', border: '1px solid #0f3460',
    borderRadius: 14, padding: 24, marginBottom: 20,
  },
  formTitle: { fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#e2e8f0' },
  section: { fontSize: 12, fontWeight: 700, color: '#4ade80', marginBottom: 8, marginTop: 16, letterSpacing: 1 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  label: { display: 'flex', flexDirection: 'column', gap: 4 },
  labelText: { fontSize: 12, color: '#94a3b8' },
  input: {
    padding: '8px 12px', borderRadius: 8, border: '1px solid #1e3a5f',
    background: '#0f1929', color: '#e2e8f0', fontSize: 14, width: '100%',
  },
  select: {
    padding: '8px 12px', borderRadius: 8, border: '1px solid #1e3a5f',
    background: '#0f1929', color: '#e2e8f0', fontSize: 14, width: '100%',
  },
  brandBadge: (brand) => ({
    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
    background: brand === 1 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
    color: brand === 1 ? '#f87171' : '#60a5fa',
    marginLeft: 8,
  }),
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  saveBtn: {
    marginTop: 20, padding: '10px 24px', borderRadius: 10,
    background: '#22c55e', color: '#fff', fontWeight: 700, fontSize: 14,
  },
  cancelBtn: {
    marginTop: 20, marginLeft: 10, padding: '10px 24px', borderRadius: 10,
    background: '#374151', color: '#fff', fontWeight: 700, fontSize: 14,
  },
  empty: { textAlign: 'center', color: '#64748b', padding: 40 },
};

function Field({ label, value, onChange, type = 'text', span }) {
  return (
    <div style={{ ...s.label, ...(span ? { gridColumn: '1 / -1' } : {}) }}>
      <span style={s.labelText}>{label}</span>
      <input
        style={s.input}
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        autoComplete="off"
      />
    </div>
  );
}

function DeviceForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div style={s.form}>
      <div style={s.formTitle}>{initial?.id ? 'Qurilmani tahrirlash' : 'Yangi qurilma qo\'shish'}</div>

      <div style={s.grid}>
        {/* Brend tanlash */}
        <div style={s.label}>
          <span style={s.labelText}>Brend *</span>
          <select
            style={s.select}
            value={form.brand}
            onChange={(e) => setForm((f) => ({ ...f, brand: Number(e.target.value) }))}
          >
            {BRANDS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>

        <Field label="Qurilma nomi *" value={form.name} onChange={set('name')} />

        <Field label="SIP Caller ID (qurilma Local Number)" value={form.sipCallerId} onChange={set('sipCallerId')} />

        <div style={s.label}>
          <div style={s.checkRow}>
            <input type="checkbox" checked={form.enabled}
              onChange={(e) => set('enabled')(e.target.checked)} id="enabled" />
            <label htmlFor="enabled" style={{ color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Faol</label>
          </div>
          <div style={s.checkRow}>
            <input type="checkbox" checked={form.sipEnabled ?? true}
              onChange={(e) => set('sipEnabled')(e.target.checked)} id="sipEnabled" />
            <label htmlFor="sipEnabled" style={{ color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>SIP ovoz (Asterisk)</label>
          </div>
        </div>
      </div>

      <div style={s.section}>📹 RTSP VIDEO SOZLAMALARI</div>
      <div style={s.grid}>
        <Field label="IP manzil *" value={form.rtspHost} onChange={set('rtspHost')} />
        <Field label="Port" value={form.rtspPort} onChange={set('rtspPort')} type="number" />
        <Field label="Login" value={form.rtspUsername} onChange={set('rtspUsername')} />
        <Field label="Parol" value={form.rtspPassword} onChange={set('rtspPassword')} type="password" />
        <Field label="Kanal" value={form.rtspChannel} onChange={set('rtspChannel')} type="number" />
      </div>

      <div style={s.section}>🚪 ESHIK BOSHQARUVI (HTTP API)</div>
      <div style={s.grid}>
        <Field label="IP manzil *" value={form.httpHost} onChange={set('httpHost')} />
        <Field label="Port" value={form.httpPort} onChange={set('httpPort')} type="number" />
        <Field label="Login" value={form.httpUsername} onChange={set('httpUsername')} />
        <Field label="Parol" value={form.httpPassword} onChange={set('httpPassword')} type="password" />
        <Field label="Eshik kanali" value={form.httpChannel} onChange={set('httpChannel')} type="number" />
      </div>

      <div>
        <button style={s.saveBtn} onClick={() => onSave(form)}>Saqlash</button>
        <button style={s.cancelBtn} onClick={onCancel}>Bekor qilish</button>
      </div>
    </div>
  );
}

export function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [editing, setEditing] = useState(null);  // null | 'new' | device
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await getDevices();
      setDevices(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    try {
      if (editing === 'new') await createDevice(form);
      else await updateDevice(editing.id, form);
      setEditing(null);
      await load();
    } catch (e) {
      alert('Xatolik: ' + (e.response?.data?.title || e.message));
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`"${name}" ni o'chirishni tasdiqlaysizmi?`)) return;
    await deleteDevice(id);
    await load();
  };

  return (
    <div style={s.page}>
      <div style={s.title}>Qurilmalar boshqaruvi</div>

      {editing && (
        <DeviceForm
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {!editing && (
        <button style={s.addBtn} onClick={() => setEditing('new')}>
          + Yangi qurilma qo'shish
        </button>
      )}

      {loading && <div style={s.empty}>Yuklanmoqda...</div>}

      {!loading && devices.length === 0 && (
        <div style={s.empty}>
          Hali qurilma qo'shilmagan.<br />
          "Yangi qurilma qo'shish" tugmasini bosing.
        </div>
      )}

      {devices.map((d) => (
        <div key={d.id} style={s.card}>
          <div style={s.row}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={s.deviceName}>{d.name}</div>
              <span style={s.brandBadge(d.brand)}>
                {d.brand === 1 ? 'Hikvision' : 'Dahua'}
              </span>
            </div>
            <span style={s.badge(d.enabled)}>{d.enabled ? 'Faol' : 'Faol emas'}</span>
          </div>
          <div style={s.meta}>
            🎥 RTSP: {d.rtspHost}:{d.rtspPort} · kanal {d.rtspChannel}
          </div>
          <div style={s.meta}>
            🚪 HTTP: {d.httpHost}:{d.httpPort}
          </div>
          {d.sipEnabled && d.sipCallerId && (
            <div style={s.meta}>📞 SIP Caller ID: {d.sipCallerId}</div>
          )}
          {!d.sipEnabled && (
            <div style={{ ...s.meta, marginTop: 8, padding: '6px 10px', background: 'rgba(251,191,36,0.08)', borderRadius: 6, border: '1px solid rgba(251,191,36,0.2)' }}>
              🔗 Hikvision HTTP event URL:<br />
              <span style={{ fontSize: 11, color: '#fbbf24', wordBreak: 'break-all' }}>
                POST http://{window.location.hostname}:5050/api/hikvision/{d.id}/event
              </span>
            </div>
          )}
          <div style={s.btnRow}>
            <button style={s.btnEdit} onClick={() => setEditing(d)}>Tahrirlash</button>
            <button style={s.btnDel} onClick={() => handleDelete(d.id, d.name)}>O'chirish</button>
          </div>
        </div>
      ))}
    </div>
  );
}
