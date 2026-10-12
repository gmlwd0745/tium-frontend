import { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Segmented, Table, Typography, Empty, Select, Space, Alert, Spin, Statistic, message } from 'antd';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { salesAPI } from '../../services/api';
import { SINGLE_COLOR, won, shortWon, pct, datasetKey, datasetLabel, axisProps } from './salesUtils';


const { Text } = Typography;

function RankTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e4e7', borderRadius: 6, padding: '8px 12px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ fontWeight: 600 }}>{d.rank}위 {d.product_name}</div>
      <div style={{ color: '#52514e' }}>{d.category}</div>
      <div>매출 {won(d.total_amount)} · {d.quantity.toLocaleString()}개</div>
      <div style={{ color: '#52514e' }}>{metric === 'amount' ? '매출' : '수량'} 비중 {pct(d.share)}</div>
    </div>
  );
}

const MenuRankTab = ({ overview }) => {
  const datasets = useMemo(() => overview?.products || [], [overview]);
  const [key, setKey] = useState(datasets[0] ? datasetKey(datasets[0]) : null);
  const [metric, setMetric] = useState('amount');
  const [categories, setCategories] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!key && datasets[0]) setKey(datasetKey(datasets[0]));
  }, [datasets, key]);

  useEffect(() => {
    if (!key) return;
    const [periodStart, periodEnd, store] = key.split('|');
    setLoading(true);
    salesAPI.getProducts({ periodStart, periodEnd, store })
      .then((res) => setData(res.data))
      .catch(() => message.error('상품별 매출을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [key]);

  const items = useMemo(() => (data?.items || []).filter((i) => i.total_amount > 0 && i.quantity > 0), [data]);
  const allCategories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items]);

  const ranked = useMemo(() => {
    const list = items.filter((i) => !categories.length || categories.includes(i.category));
    const field = metric === 'amount' ? 'total_amount' : 'quantity';
    const total = list.reduce((a, i) => a + i[field], 0);
    return [...list]
      .sort((a, b) => b[field] - a[field])
      .map((i, idx) => ({ ...i, rank: idx + 1, share: total ? (i[field] / total) * 100 : 0 }));
  }, [items, categories, metric]);

  const byCategory = useMemo(() => {
    const m = new Map();
    for (const i of items) {
      const c = m.get(i.category) || { category: i.category, total_amount: 0, quantity: 0, count: 0 };
      c.total_amount += i.total_amount;
      c.quantity += i.quantity;
      c.count += 1;
      m.set(i.category, c);
    }
    const total = items.reduce((a, i) => a + i.total_amount, 0);
    return [...m.values()].sort((a, b) => b.total_amount - a.total_amount).map((c) => ({ ...c, share: total ? (c.total_amount / total) * 100 : 0 }));
  }, [items]);

  if (!datasets.length) return <Empty description="상품별 매출 파일을 올리면 메뉴 순위를 볼 수 있습니다." />;

  const top = ranked.slice(0, 15);
  const field = metric === 'amount' ? 'total_amount' : 'quantity';
  const current = datasets.find((d) => datasetKey(d) === key);

  return (
    <Spin spinning={loading}>
      <Space wrap style={{ marginBottom: 16 }}>
        <Select value={key} onChange={setKey} style={{ minWidth: 280 }}
          options={datasets.map((d) => ({ value: datasetKey(d), label: datasetLabel(d) }))} />
        <Segmented value={metric} onChange={setMetric} options={[{ label: '매출액 순', value: 'amount' }, { label: '판매수량 순', value: 'qty' }]} />
        <Select mode="multiple" allowClear placeholder="분류 전체" value={categories} onChange={setCategories}
          style={{ minWidth: 200 }} options={allCategories.map((c) => ({ value: c, label: c }))} maxTagCount="responsive" />
      </Space>

      {current?.store === '전체' && datasets.every((d) => d.store === '전체') && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="두 매장 합계 순위입니다"
          description="매장별 순위를 보려면 POS에서 매장을 하나씩 선택해 상품별 매출을 따로 내려받아 올려주세요." />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="판매 품목 수" value={items.length} suffix="개" /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="총 판매수량" value={items.reduce((a, i) => a + i.quantity, 0)} suffix="개" /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="총 매출" value={won(items.reduce((a, i) => a + i.total_amount, 0))} /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="1위 메뉴 비중" value={ranked[0] ? `${ranked[0].product_name} ${pct(ranked[0].share)}` : '-'} valueStyle={{ fontSize: 18 }} /></Card></Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card size="small" title={`TOP 15 · ${metric === 'amount' ? '매출액' : '판매수량'}`}>
            <div style={{ width: '100%', height: Math.max(240, top.length * 28 + 20) }}>
              <ResponsiveContainer>
                <BarChart data={top} layout="vertical" margin={{ top: 0, right: 72, left: 0, bottom: 0 }} barCategoryGap={4}>
                  <CartesianGrid stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" {...axisProps} tickFormatter={metric === 'amount' ? shortWon : (v) => v.toLocaleString()} />
                  <YAxis type="category" dataKey="product_name" {...axisProps} width={110} interval={0} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<RankTooltip metric={metric} />} />
                  <Bar dataKey={field} fill={SINGLE_COLOR} radius={[0, 4, 4, 0]} maxBarSize={20}>
                    <LabelList dataKey={field} position="right" style={{ fill: '#52514e', fontSize: 12 }}
                      formatter={(v) => (metric === 'amount' ? shortWon(v) : `${v.toLocaleString()}개`)} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card size="small" title="분류별 매출">
            <Table
              size="small"
              rowKey="category"
              pagination={false}
              dataSource={byCategory}
              columns={[
                { title: '분류', dataIndex: 'category' },
                { title: '매출', dataIndex: 'total_amount', align: 'right', render: won },
                {
                  title: '비중',
                  dataIndex: 'share',
                  width: 130,
                  render: (v) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, background: '#f0f0f0', height: 8, borderRadius: 4 }}>
                        <div style={{ width: `${Math.min(v, 100)}%`, background: SINGLE_COLOR, height: 8, borderRadius: 4 }} />
                      </div>
                      <span style={{ width: 44, textAlign: 'right' }}>{pct(v)}</span>
                    </div>
                  ),
                },
                { title: '수량', dataIndex: 'quantity', align: 'right', render: (v) => v.toLocaleString() },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" title="전체 메뉴 순위" style={{ marginTop: 16 }}>
        <Table
          size="small"
          rowKey={(r) => `${r.product_code}-${r.product_name}`}
          dataSource={ranked}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: true }}
          columns={[
            { title: '순위', dataIndex: 'rank', width: 60, align: 'center' },
            { title: '분류', dataIndex: 'category', width: 110 },
            { title: '메뉴', dataIndex: 'product_name' },
            { title: '판매수량', dataIndex: 'quantity', align: 'right', render: (v) => v.toLocaleString(), sorter: (a, b) => a.quantity - b.quantity },
            { title: '매출', dataIndex: 'total_amount', align: 'right', render: won, sorter: (a, b) => a.total_amount - b.total_amount },
            { title: '평균 단가', dataIndex: 'avg_price', align: 'right', render: won },
            { title: '비중', dataIndex: 'share', align: 'right', render: (v) => pct(v) },
          ]}
        />
        <Text type="secondary">진동벨·캐리어처럼 0원 품목은 순위에서 뺐습니다.</Text>
      </Card>
    </Spin>
  );
};

export default MenuRankTab;
