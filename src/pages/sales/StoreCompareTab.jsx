import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Segmented, Table, Typography, Empty, Select, Alert } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import {
  STORES, STORE_COLORS, won, shortWon, pct, groupDaily, summarize, WEEKDAYS,
  axisProps, gridProps,
} from './salesUtils';
import { WonTooltip, Legend } from './ChartBits';

const { Text } = Typography;

function GroupedBars({ data, xKey, height = 280 }) {
  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
          <CartesianGrid {...gridProps} />
          <XAxis dataKey={xKey} {...axisProps} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...axisProps} tickFormatter={shortWon} width={56} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<WonTooltip showTotal />} />
          {STORES.map((s) => (
            <Bar key={s} dataKey={s} name={s} fill={STORE_COLORS[s]} radius={[4, 4, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const StoreCompareTab = ({ daily, overview, store }) => {
  const [unit, setUnit] = useState('week');
  const [hourlyKey, setHourlyKey] = useState(null);
  const [hourly, setHourly] = useState([]);

  // 시간별 데이터셋: 기간 단위로 묶기 (매장별로 저장되어 있음)
  const hourlyPeriods = useMemo(() => {
    const m = new Map();
    for (const d of overview?.hourly || []) {
      const k = `${d.period_start}|${d.period_end}`;
      if (!m.has(k)) m.set(k, { ...d, store: STORES.filter((s) => (overview.hourly || []).some((x) => `${x.period_start}|${x.period_end}` === k && x.store === s)).join('·') });
    }
    return [...m.values()];
  }, [overview]);

  useEffect(() => {
    if (!hourlyKey && hourlyPeriods.length) setHourlyKey(`${hourlyPeriods[0].period_start}|${hourlyPeriods[0].period_end}`);
  }, [hourlyPeriods, hourlyKey]);

  useEffect(() => {
    if (!hourlyKey) return;
    const [periodStart, periodEnd] = hourlyKey.split('|');
    salesAPI.getHourly({ periodStart, periodEnd }).then((res) => setHourly(res.data)).catch(() => setHourly([]));
  }, [hourlyKey]);

  const perStore = useMemo(
    () => STORES.map((s) => ({ store: s, rows: daily.filter((r) => r.store === s) })).map((x) => ({ ...x, ...summarize(x.rows) })),
    [daily]
  );
  const grandTotal = perStore.reduce((a, s) => a + s.total, 0);
  const grouped = useMemo(() => groupDaily(daily, unit), [daily, unit]);

  // 요일별 평균 (영업일 기준)
  const weekday = useMemo(() => {
    const acc = {};
    for (const r of daily) {
      const wd = dayjs(r.sale_date).day();
      acc[wd] = acc[wd] || { wd, label: WEEKDAYS[wd] };
      acc[wd][`${r.store}_sum`] = (acc[wd][`${r.store}_sum`] || 0) + r.total_amount;
      acc[wd][`${r.store}_n`] = (acc[wd][`${r.store}_n`] || 0) + 1;
    }
    return [1, 2, 3, 4, 5, 6, 0]
      .filter((wd) => acc[wd])
      .map((wd) => {
        const o = { label: acc[wd].label };
        STORES.forEach((s) => { o[s] = acc[wd][`${s}_n`] ? acc[wd][`${s}_sum`] / acc[wd][`${s}_n`] : 0; });
        return o;
      });
  }, [daily]);

  const hourlyData = useMemo(() => {
    const m = new Map();
    for (const r of hourly) {
      if (!m.has(r.hour)) m.set(r.hour, { hour: r.hour, label: `${r.hour}시` });
      m.get(r.hour)[r.store] = r.total_amount;
      m.get(r.hour)[`${r.store}_receipts`] = r.receipt_count;
    }
    return [...m.values()].sort((a, b) => a.hour - b.hour);
  }, [hourly]);

  if (!daily.length) return <Empty description="선택한 기간에 일자별 매출이 없습니다." />;

  return (
    <div>
      {store && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="매장 비교는 두 매장을 함께 보여줍니다. 위의 매장 선택을 '전체 매장'으로 바꿔주세요." />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {perStore.map((s) => (
          <Col xs={24} md={12} key={s.store}>
            <Card size="small" title={
              <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: STORE_COLORS[s.store], marginRight: 8 }} />{s.store}</span>
            }>
              <Row gutter={8}>
                <Col span={8}><Text type="secondary">매출</Text><div style={{ fontSize: 18, fontWeight: 600 }}>{won(s.total)}</div><Text type="secondary">비중 {pct(grandTotal ? (s.total / grandTotal) * 100 : null)}</Text></Col>
                <Col span={8}><Text type="secondary">영업일 평균</Text><div style={{ fontSize: 18, fontWeight: 600 }}>{won(s.perDay)}</div><Text type="secondary">{s.days}일 영업</Text></Col>
                <Col span={8}><Text type="secondary">객단가</Text><div style={{ fontSize: 18, fontWeight: 600 }}>{won(s.avgTicket)}</div><Text type="secondary">{s.receipts.toLocaleString()}건</Text></Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small" title="기간별 매장 매출"
        extra={<Segmented value={unit} onChange={setUnit} options={[{ label: '일', value: 'day' }, { label: '주', value: 'week' }, { label: '월', value: 'month' }]} />}>
        <Legend items={STORES.map((s) => ({ label: s, color: STORE_COLORS[s] }))} />
        <GroupedBars data={grouped} xKey="label" />
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card size="small" title="요일별 평균 매출 (영업일 기준)">
            <Legend items={STORES.map((s) => ({ label: s, color: STORE_COLORS[s] }))} />
            <GroupedBars data={weekday} xKey="label" height={240} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="시간대별 매출"
            extra={hourlyPeriods.length > 0 && (
              <Select size="small" value={hourlyKey} onChange={setHourlyKey} style={{ minWidth: 190 }}
                options={hourlyPeriods.map((d) => ({ value: `${d.period_start}|${d.period_end}`, label: `${d.period_start} ~ ${d.period_end}` }))} />
            )}>
            {hourlyData.length ? (
              <>
                <Legend items={STORES.map((s) => ({ label: s, color: STORE_COLORS[s] }))} />
                <GroupedBars data={hourlyData} xKey="label" height={240} />
                <Text type="secondary">시간별 매출 파일의 기간 기준 (위 날짜 선택과 별개)</Text>
              </>
            ) : (
              <Empty description="시간별 매출 파일을 올리면 표시됩니다." />
            )}
          </Card>
        </Col>
      </Row>

      <Card size="small" title="결제 구성" style={{ marginTop: 16 }}>
        <Table
          size="small"
          rowKey="store"
          pagination={false}
          scroll={{ x: true }}
          dataSource={perStore.map((s) => {
            const sum = (k) => s.rows.reduce((a, r) => a + (r[k] || 0), 0);
            const hasDetail = s.rows.some((r) => r.detail_level === 'full');
            return { store: s.store, total: s.total, point: sum('point_amount'), credit: sum('credit_amount'), etc: sum('etc_amount'), cash: sum('cash_amount'), card: sum('card_amount'), hasDetail };
          })}
          columns={[
            { title: '매장', dataIndex: 'store' },
            { title: '매출', dataIndex: 'total', align: 'right', render: won },
            { title: '포인트', dataIndex: 'point', align: 'right', render: (v, r) => (r.hasDetail ? `${won(v)} (${pct(r.total ? (v / r.total) * 100 : null)})` : '-') },
            { title: '외상', dataIndex: 'credit', align: 'right', render: (v, r) => (r.hasDetail ? `${won(v)} (${pct(r.total ? (v / r.total) * 100 : null)})` : '-') },
            { title: '기타', dataIndex: 'etc', align: 'right', render: won },
            { title: '현금·카드', key: 'cc', align: 'right', render: (_, r) => won(r.cash + r.card) },
          ]}
        />
        <Text type="secondary">포인트·외상 구분은 "일자별 매출" 파일에만 있습니다.</Text>
      </Card>
    </div>
  );
};

export default StoreCompareTab;
