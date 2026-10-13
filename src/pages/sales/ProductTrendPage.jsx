// 상품 판매 추이 (예: 샐러드) — POS "일자별 상품 매출" 파일 기반
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Select, DatePicker, Segmented, Space, Typography, Table, Empty, Spin, Button, Tag, Alert, message,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import {
  STORES, STORE_COLORS, won, shortWon, pct, periodKey, periodLabel, axisProps, gridProps,
} from './salesUtils';
import { Legend } from './ChartBits';
import './sales.css';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const DEFAULT_KEYWORDS = ['샐러드'];
const isMarkdown = (name) => /마감/.test(name); // 마감할인 품목 (예: "마감 샐러드", "샐러드 마감할인")

function ValueTooltip({ active, payload, label, metric }) {
  if (!active || !payload?.length) return null;
  const fmt = (v) => (metric === 'qty' ? `${Math.round(v).toLocaleString()}개` : won(v));
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e4e7', borderRadius: 6, padding: '8px 12px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 170 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => {
        const d = p.payload;
        const s = p.dataKey;
        return (
          <div key={s} style={{ color: '#52514e' }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 6 }} />
            {s} <b style={{ color: '#0b0b0b' }}>{fmt(p.value)}</b>
            {metric !== 'price' && d[`${s}_md`] > 0 && <span> (마감 {d[`${s}_md`]}개)</span>}
          </div>
        );
      })}
    </div>
  );
}

const ProductTrendPage = () => {
  const navigate = useNavigate();
  const [names, setNames] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [keywords, setKeywords] = useState(DEFAULT_KEYWORDS);
  const [range, setRange] = useState(null);
  const [unit, setUnit] = useState('day');
  const [metric, setMetric] = useState('qty');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([salesAPI.getProductTrendNames(), salesAPI.getOverview()])
      .then(([n, ov]) => {
        setNames(n.data);
        const cov = ov.data.productDaily || [];
        setCoverage(cov);
        if (cov.length) {
          const min = cov.reduce((a, c) => (c.min_date < a ? c.min_date : a), cov[0].min_date);
          const max = cov.reduce((a, c) => (c.max_date > a ? c.max_date : a), cov[0].max_date);
          setRange([dayjs(min), dayjs(max)]);
        }
      })
      .catch(() => message.error('상품 판매 데이터를 불러오지 못했습니다.'));
  }, []);

  const from = range?.[0]?.format('YYYY-MM-DD');
  const to = range?.[1]?.format('YYYY-MM-DD');

  useEffect(() => {
    if (!from || !to) return;
    setLoading(true);
    salesAPI.getProductTrend({ from, to, q: keywords.join(',') })
      .then((res) => setData(res.data))
      .catch(() => message.error('상품 판매 추이를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [from, to, keywords]);

  const rows = useMemo(() => data?.rows || [], [data]);

  // 날짜 축: 판매가 있었던 날 + 일자별 매출상 영업일 (판매 0인 영업일도 0으로 보이도록)
  const days = useMemo(() => {
    const set = new Set(rows.map((r) => r.sale_date));
    const lastProductDay = rows.reduce((a, r) => (r.sale_date > a ? r.sale_date : a), '');
    Object.values(data?.openDays || {}).flat().forEach((d) => {
      if (d >= from && d <= to && (!lastProductDay || d <= lastProductDay)) set.add(d);
    });
    return [...set].sort();
  }, [rows, data, from, to]);

  const series = useMemo(() => {
    const m = new Map();
    for (const d of days) {
      const k = periodKey(d, unit);
      if (!m.has(k)) m.set(k, { key: k, label: periodLabel(k, unit), days: new Set() });
      m.get(k).days.add(d);
    }
    for (const r of rows) {
      const g = m.get(periodKey(r.sale_date, unit));
      if (!g) continue;
      g[`${r.store}_qty`] = (g[`${r.store}_qty`] || 0) + r.quantity;
      g[`${r.store}_amt`] = (g[`${r.store}_amt`] || 0) + r.total_amount;
      if (isMarkdown(r.product_name)) g[`${r.store}_md`] = (g[`${r.store}_md`] || 0) + r.quantity;
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key)).map((g) => {
      const o = { ...g, days: g.days.size };
      STORES.forEach((s) => {
        const q = g[`${s}_qty`] || 0;
        const a = g[`${s}_amt`] || 0;
        o[`${s}_qty`] = q;
        o[`${s}_amt`] = a;
        o[`${s}_md`] = g[`${s}_md`] || 0;
        o[`${s}_price`] = q ? a / q : null;
      });
      return o;
    });
  }, [rows, days, unit]);

  const chartData = series.map((g) => {
    const o = { label: g.label };
    STORES.forEach((s) => {
      o[s] = metric === 'qty' ? g[`${s}_qty`] : g[`${s}_amt`];
      o[`${s}_md`] = g[`${s}_md`];
    });
    return o;
  });
  const priceData = series.map((g) => {
    const o = { label: g.label };
    STORES.forEach((s) => { o[s] = g[`${s}_price`]; });
    return o;
  });

  const kpis = useMemo(() => STORES.map((s) => {
    const rs = rows.filter((r) => r.store === s);
    const qty = rs.reduce((a, r) => a + r.quantity, 0);
    const amt = rs.reduce((a, r) => a + r.total_amount, 0);
    const md = rs.filter((r) => isMarkdown(r.product_name)).reduce((a, r) => a + r.quantity, 0);
    const sellDays = new Set(rs.filter((r) => r.quantity > 0).map((r) => r.sale_date)).size;
    return { store: s, qty, amt, md, sellDays, perDay: sellDays ? qty / sellDays : 0, price: qty ? amt / qty : 0 };
  }), [rows]);

  const productTable = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const k = `${r.store}|${r.product_name}`;
      const g = m.get(k) || { key: k, store: r.store, product_name: r.product_name, qty: 0, amt: 0, days: new Set(), first: r.sale_date, last: r.sale_date };
      g.qty += r.quantity;
      g.amt += r.total_amount;
      if (r.quantity > 0) g.days.add(r.sale_date);
      if (r.sale_date < g.first) g.first = r.sale_date;
      if (r.sale_date > g.last) g.last = r.sale_date;
      m.set(k, g);
    }
    return [...m.values()].map((g) => ({ ...g, days: g.days.size, price: g.qty ? g.amt / g.qty : 0 }))
      .sort((a, b) => a.store.localeCompare(b.store) || b.amt - a.amt);
  }, [rows]);

  const nameOptions = useMemo(() => {
    const opts = new Set(DEFAULT_KEYWORDS);
    names.forEach((n) => opts.add(n.product_name));
    return [...opts].map((v) => ({ value: v, label: v }));
  }, [names]);

  const hasAnyData = coverage && coverage.length > 0;

  return (
    <div className="sales-page">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 12 }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>상품 판매 추이</Title>
          <Text type="secondary">큰길·태광의 상품별 판매량과 판매가 변화를 날짜별로 봅니다.</Text>
        </div>
        <Button icon={<UploadOutlined />} onClick={() => navigate('/sales/upload')}>일자별 상품 매출 올리기</Button>
      </Space>

      {coverage && !hasAnyData ? (
        <Empty description="아직 올린 일자별 상품 매출 파일이 없습니다." style={{ padding: 60, textAlign: 'center' }}>
          <Text type="secondary">POS에서 매장을 하나씩 선택해 "일자별 상품 매출"을 월 단위로 내려받아 올려주세요.</Text>
        </Empty>
      ) : (
        <>
          <Space wrap style={{ marginBottom: 16 }}>
            <Select
              mode="tags"
              value={keywords}
              onChange={(v) => setKeywords(v.length ? v : DEFAULT_KEYWORDS)}
              options={nameOptions}
              style={{ minWidth: 260 }}
              placeholder="상품명 또는 키워드"
              tokenSeparators={[',']}
            />
            <RangePicker value={range} onChange={setRange} allowClear={false} />
            <Segmented value={unit} onChange={setUnit} options={[{ label: '일', value: 'day' }, { label: '주', value: 'week' }, { label: '월', value: 'month' }]} />
          </Space>
          {coverage?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary">올라온 데이터: </Text>
              {coverage.map((c) => <Tag key={c.store}>{c.store} {c.min_date} ~ {c.max_date}</Tag>)}
              <Text type="secondary">· 키워드가 들어간 상품을 모두 합칩니다 (예: "샐러드" → 샐러드, 라이트 샐러드, 마감 샐러드)</Text>
            </div>
          )}

          <Spin spinning={loading}>
            {!rows.length ? (
              <Empty description="선택한 조건에 맞는 판매 기록이 없습니다." />
            ) : (
              <>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  {kpis.map((k) => (
                    <Col xs={24} md={12} key={k.store}>
                      <Card size="small" title={<span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: STORE_COLORS[k.store], marginRight: 8 }} />{k.store}</span>}>
                        <Row gutter={8}>
                          <Col span={6}><Text type="secondary">판매수량</Text><div style={{ fontSize: 18, fontWeight: 600 }}>{k.qty.toLocaleString()}개</div><Text type="secondary">{won(k.amt)}</Text></Col>
                          <Col span={6}><Text type="secondary">판매일 평균</Text><div style={{ fontSize: 18, fontWeight: 600 }}>{k.perDay.toFixed(1)}개</div><Text type="secondary">{k.sellDays}일 판매</Text></Col>
                          <Col span={6}><Text type="secondary">평균 판매가</Text><div style={{ fontSize: 18, fontWeight: 600 }}>{won(k.price)}</div></Col>
                          <Col span={6}><Text type="secondary">마감할인 비중</Text><div style={{ fontSize: 18, fontWeight: 600 }}>{pct(k.qty ? (k.md / k.qty) * 100 : null)}</div><Text type="secondary">{k.md}개</Text></Col>
                        </Row>
                      </Card>
                    </Col>
                  ))}
                </Row>

                <Card size="small" title={`${unit === 'day' ? '일별' : unit === 'week' ? '주별' : '월별'} 판매 ${metric === 'qty' ? '수량' : '매출'}`}
                  extra={<Segmented size="small" value={metric} onChange={setMetric} options={[{ label: '수량', value: 'qty' }, { label: '매출', value: 'amt' }]} />}>
                  <Legend items={STORES.map((s) => ({ label: s, color: STORE_COLORS[s] }))} />
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                        <CartesianGrid {...gridProps} />
                        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
                        <YAxis {...axisProps} width={56} tickFormatter={metric === 'qty' ? (v) => `${v}` : shortWon} allowDecimals={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<ValueTooltip metric={metric} />} />
                        {STORES.map((s) => (
                          <Bar key={s} dataKey={s} name={s} fill={STORE_COLORS[s]} radius={[4, 4, 0, 0]} maxBarSize={32} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col xs={24} xl={10}>
                    <Card size="small" title="평균 판매가 추이 (매출 ÷ 수량)">
                      <Legend items={STORES.map((s) => ({ label: s, color: STORE_COLORS[s] }))} />
                      <div style={{ width: '100%', height: 240 }}>
                        <ResponsiveContainer>
                          <LineChart data={priceData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                            <CartesianGrid {...gridProps} />
                            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={8} />
                            <YAxis {...axisProps} width={56} tickFormatter={(v) => `${v.toLocaleString()}`} domain={[0, 'auto']} />
                            <Tooltip content={<ValueTooltip metric="price" />} />
                            {STORES.map((s) => (
                              <Line key={s} type="linear" dataKey={s} name={s} stroke={STORE_COLORS[s]} strokeWidth={2}
                                dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: STORE_COLORS[s] }} connectNulls />
                            ))}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <Text type="secondary">마감할인 판매가 섞인 날은 평균 판매가가 내려갑니다.</Text>
                    </Card>
                  </Col>
                  <Col xs={24} xl={14}>
                    <Card size="small" title="상품별 합계">
                      <Table
                        size="small"
                        rowKey="key"
                        pagination={false}
                        dataSource={productTable}
                        scroll={{ x: true }}
                        columns={[
                          { title: '매장', dataIndex: 'store', render: (s) => <Tag color={s === '큰길' ? 'blue' : 'orange'}>{s}</Tag> },
                          { title: '상품', dataIndex: 'product_name', render: (n) => (isMarkdown(n) ? <span>{n} <Tag>마감할인</Tag></span> : n) },
                          { title: '수량', dataIndex: 'qty', align: 'right', render: (v) => v.toLocaleString() },
                          { title: '매출', dataIndex: 'amt', align: 'right', render: won },
                          { title: '평균가', dataIndex: 'price', align: 'right', render: won },
                          { title: '판매일', dataIndex: 'days', align: 'right', render: (v) => `${v}일` },
                          { title: '기간', key: 'p', render: (_, r) => `${dayjs(r.first).format('M/D')}~${dayjs(r.last).format('M/D')}` },
                        ]}
                      />
                    </Card>
                  </Col>
                </Row>

                <Card size="small" title="기간별 상세" style={{ marginTop: 16 }}>
                  <Table
                    size="small"
                    rowKey="key"
                    dataSource={[...series].reverse()}
                    pagination={{ pageSize: 20, hideOnSinglePage: true }}
                    scroll={{ x: true }}
                    columns={[
                      { title: '기간', dataIndex: 'label' },
                      ...STORES.flatMap((s) => [
                        { title: `${s} 수량`, dataIndex: `${s}_qty`, align: 'right', render: (v, r) => (<span>{v.toLocaleString()}{r[`${s}_md`] > 0 && <Text type="secondary"> (마감 {r[`${s}_md`]})</Text>}</span>) },
                        { title: `${s} 매출`, dataIndex: `${s}_amt`, align: 'right', render: won },
                        { title: `${s} 평균가`, dataIndex: `${s}_price`, align: 'right', render: (v) => (v === null ? '-' : won(v)) },
                      ]),
                    ]}
                  />
                </Card>
                {!data?.openDays?.큰길?.length && !data?.openDays?.태광?.length && (
                  <Alert style={{ marginTop: 12 }} type="info" showIcon
                    title="일자별 매출 파일도 함께 올리면 판매가 0개였던 영업일도 0으로 표시됩니다." />
                )}
              </>
            )}
          </Spin>
        </>
      )}
    </div>
  );
};

export default ProductTrendPage;
