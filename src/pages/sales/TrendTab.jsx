import { useMemo, useState } from 'react';
import { Row, Col, Card, Statistic, Segmented, Table, Typography, Empty, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { STORES, STORE_COLORS, won, shortWon, groupDaily, summarize, changeRate, axisProps, gridProps } from './salesUtils';
import { WonTooltip, Legend } from './ChartBits';

const { Text } = Typography;

function Delta({ value }) {
  if (value === null || value === undefined) return <Text type="secondary">직전 기간 데이터 없음</Text>;
  const Icon = value > 0 ? ArrowUpOutlined : value < 0 ? ArrowDownOutlined : MinusOutlined;
  return (
    <Text type="secondary">
      <Icon /> 직전 같은 기간 대비 {value > 0 ? '+' : ''}{value.toFixed(1)}%
    </Text>
  );
}

const TrendTab = ({ daily, prevDaily, store }) => {
  const [unit, setUnit] = useState('day');
  const cur = useMemo(() => summarize(daily), [daily]);
  const prev = useMemo(() => summarize(prevDaily), [prevDaily]);
  const grouped = useMemo(() => groupDaily(daily, unit), [daily, unit]);
  const series = store ? [store] : STORES;

  if (!daily.length) return <Empty description="선택한 기간에 일자별 매출이 없습니다." />;

  const kpis = [
    { title: '총 매출', value: won(cur.total), delta: changeRate(cur.total, prev.total) },
    { title: '영수 건수', value: `${cur.receipts.toLocaleString()}건`, delta: changeRate(cur.receipts, prev.receipts) },
    { title: '객단가', value: won(cur.avgTicket), delta: changeRate(cur.avgTicket, prev.avgTicket) },
    { title: `영업일 평균 (${cur.days}일)`, value: won(cur.perDay), delta: changeRate(cur.perDay, prev.perDay) },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {kpis.map((k) => (
          <Col xs={12} lg={6} key={k.title}>
            <Card size="small">
              <Statistic title={k.title} value={k.value} valueStyle={{ fontSize: 22, fontWeight: 600 }} />
              <Delta value={k.delta} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card
        size="small"
        title={`${unit === 'day' ? '일별' : unit === 'week' ? '주별' : '월별'} 매출${store ? ` · ${store}` : ' · 매장별 누적'}`}
        extra={<Segmented value={unit} onChange={setUnit} options={[{ label: '일', value: 'day' }, { label: '주', value: 'week' }, { label: '월', value: 'month' }]} />}
      >
        {series.length > 1 && <Legend items={series.map((s) => ({ label: s, color: STORE_COLORS[s] }))} />}
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart data={grouped} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
              <YAxis {...axisProps} tickFormatter={shortWon} width={56} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<WonTooltip showTotal />} />
              {series.map((s, i) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={s}
                  stackId="sales"
                  fill={STORE_COLORS[s]}
                  stroke="#fff"
                  strokeWidth={series.length > 1 ? 1 : 0}
                  radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card size="small" title="기간별 상세" style={{ marginTop: 16 }}>
        <Table
          size="small"
          rowKey="key"
          dataSource={[...grouped].reverse()}
          pagination={{ pageSize: 15, hideOnSinglePage: true }}
          scroll={{ x: true }}
          columns={[
            { title: '기간', dataIndex: 'label' },
            ...series.map((s) => ({ title: s, dataIndex: s, align: 'right', render: (v) => won(v || 0) })),
            ...(series.length > 1 ? [{ title: '합계', dataIndex: 'total', align: 'right', render: (v) => <b>{won(v)}</b> }] : []),
            { title: '영업일', dataIndex: 'days', align: 'right', render: (v) => `${v}일` },
            { title: '건수', dataIndex: 'receipts', align: 'right', render: (v) => v.toLocaleString() },
            { title: '객단가', dataIndex: 'avgTicket', align: 'right', render: won },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><b>합계</b></Table.Summary.Cell>
              {series.map((s, i) => (
                <Table.Summary.Cell key={s} index={i + 1} align="right">
                  {won(grouped.reduce((a, g) => a + (g[s] || 0), 0))}
                </Table.Summary.Cell>
              ))}
              {series.length > 1 && <Table.Summary.Cell index={9} align="right"><b>{won(cur.total)}</b></Table.Summary.Cell>}
              <Table.Summary.Cell index={10} align="right">{cur.days}일</Table.Summary.Cell>
              <Table.Summary.Cell index={11} align="right">{cur.receipts.toLocaleString()}</Table.Summary.Cell>
              <Table.Summary.Cell index={12} align="right">{won(cur.avgTicket)}</Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
        <Space style={{ marginTop: 8 }}>
          <Text type="secondary">객단가 = 매출 ÷ 영수 건수. 증감률은 선택 기간 바로 앞의 같은 길이 기간과 비교합니다.</Text>
        </Space>
      </Card>
    </div>
  );
};

export default TrendTab;
