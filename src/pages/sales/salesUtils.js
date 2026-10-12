import dayjs from 'dayjs';

export const STORES = ['큰길', '태광'];

// 매장 색상: 매장(엔티티)마다 고정. 필터를 바꿔도 색이 바뀌지 않는다.
export const STORE_COLORS = { 큰길: '#2a78d6', 태광: '#eb6834', 전체: '#2a78d6' };
export const SINGLE_COLOR = '#2a78d6';
export const COST_COLOR = '#8c8c8c';

export const won = (v) => {
  if (v === null || v === undefined || Number.isNaN(v)) return '-';
  return `${Math.round(v).toLocaleString()}원`;
};

// 축 눈금용 축약 (만원 단위)
export const shortWon = (v) => {
  if (!v) return '0';
  const abs = Math.abs(v);
  if (abs >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
  if (abs >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
  return v.toLocaleString();
};

export const pct = (v, digits = 1) => (v === null || v === undefined || Number.isNaN(v) ? '-' : `${v.toFixed(digits)}%`);

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function periodKey(dateStr, unit) {
  const d = dayjs(dateStr);
  if (unit === 'month') return d.format('YYYY-MM');
  if (unit === 'week') {
    const monday = d.subtract((d.day() + 6) % 7, 'day');
    return monday.format('YYYY-MM-DD');
  }
  return d.format('YYYY-MM-DD');
}

export function periodLabel(key, unit) {
  if (unit === 'month') return dayjs(`${key}-01`).format('YY년 M월');
  if (unit === 'week') {
    const s = dayjs(key);
    return `${s.format('M/D')}~${s.add(6, 'day').format('M/D')}`;
  }
  const d = dayjs(key);
  return `${d.format('M/D')}(${WEEKDAYS[d.day()]})`;
}

/** 일자별 행 → 기간(일/주/월)·매장별 합계 */
export function groupDaily(rows, unit) {
  const map = new Map();
  for (const r of rows) {
    const key = periodKey(r.sale_date, unit);
    if (!map.has(key)) {
      map.set(key, { key, label: periodLabel(key, unit), total: 0, receipts: 0, days: new Set() });
    }
    const g = map.get(key);
    g[r.store] = (g[r.store] || 0) + (r.total_amount || 0);
    g[`${r.store}_receipts`] = (g[`${r.store}_receipts`] || 0) + (r.receipt_count || 0);
    g.total += r.total_amount || 0;
    g.receipts += r.receipt_count || 0;
    g.days.add(r.sale_date);
  }
  return [...map.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((g) => ({ ...g, days: g.days.size, avgTicket: g.receipts ? g.total / g.receipts : 0 }));
}

export function summarize(rows) {
  const total = rows.reduce((s, r) => s + (r.total_amount || 0), 0);
  const receipts = rows.reduce((s, r) => s + (r.receipt_count || 0), 0);
  const days = new Set(rows.map((r) => r.sale_date)).size;
  return { total, receipts, days, avgTicket: receipts ? total / receipts : 0, perDay: days ? total / days : 0 };
}

export function changeRate(cur, prev) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

export const datasetKey = (d) => `${d.period_start}|${d.period_end}|${d.store}`;
export const datasetLabel = (d) =>
  `${dayjs(d.period_start).format('YY.M.D')} ~ ${dayjs(d.period_end).format('YY.M.D')} · ${d.store === '전체' ? '두 매장 합계' : d.store}`;

// 차트 축·격자 공통 스타일 (눈에 덜 띄게)
export const axisProps = {
  tick: { fill: '#52514e', fontSize: 12 },
  axisLine: { stroke: '#d9d9d9' },
  tickLine: false,
};

export const gridProps = { stroke: '#f0f0f0', vertical: false };
