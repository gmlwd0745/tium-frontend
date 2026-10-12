// 매출 리포트 차트 공용 조각 (툴팁·범례)
import { won } from './salesUtils';

export function WonTooltip({ active, payload, label, showTotal = false, extra }) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e4e7', borderRadius: 6, padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 13, minWidth: 160,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#0b0b0b' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, color: '#52514e' }}>
          <span>
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color || p.fill, marginRight: 6,
            }} />
            {p.name}
          </span>
          <span style={{ color: '#0b0b0b' }}>{won(p.value)}</span>
        </div>
      ))}
      {showTotal && payload.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f0f0f0', marginTop: 4, paddingTop: 4 }}>
          <span>합계</span>
          <b>{won(total)}</b>
        </div>
      )}
      {extra && extra(payload)}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13, color: '#52514e', marginBottom: 8 }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, marginRight: 6 }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}
