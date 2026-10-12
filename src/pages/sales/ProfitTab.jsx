import { useEffect, useMemo, useState } from 'react';
import {
  Row, Col, Card, Table, Typography, Empty, Select, Space, Alert, Spin, Statistic, Tag, Button, Modal, Form,
  InputNumber, Radio, Switch, Tooltip as AntTooltip, message,
} from 'antd';
import { WarningOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import { SINGLE_COLOR, COST_COLOR, won, shortWon, pct, datasetKey, datasetLabel, axisProps, gridProps } from './salesUtils';
import { WonTooltip, Legend } from './ChartBits';

const { Text, Paragraph } = Typography;

const SOURCE_TAG = {
  auto: { color: 'blue', label: '자동 연결' },
  mapped: { color: 'geekblue', label: '직접 연결' },
  manual: { color: 'purple', label: '원가 직접 입력' },
  excluded: { color: 'default', label: '계산 제외' },
};

function MappingModal({ item, menuOptions, onClose, onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const mode = Form.useWatch('mode', form);

  useEffect(() => {
    if (!item) return;
    const src = item.cost_source;
    form.setFieldsValue({
      mode: src === 'manual' ? 'cost' : src === 'mapped' ? 'menu' : src === 'excluded' ? 'exclude' : 'auto',
      menu_price_id: src === 'mapped' ? item.matched_menus?.[0]?.id : undefined,
      unit_cost: src === 'manual' ? item.unit_cost : undefined,
    });
  }, [item, form]);

  const save = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      await salesAPI.saveMapping({
        pos_name: item.product_name,
        menu_price_id: v.mode === 'menu' ? v.menu_price_id : null,
        unit_cost: v.mode === 'cost' ? v.unit_cost : null,
        excluded: v.mode === 'exclude',
      });
      message.success('원가 연결을 저장했습니다.');
      onSaved();
    } catch {
      message.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!item} title={`원가 연결 · ${item?.product_name || ''}`} onCancel={onClose} onOk={save}
      okText="저장" cancelText="취소" confirmLoading={saving} destroyOnHidden>
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        POS 상품명과 메뉴 단가를 연결하면 판매수량 × 메뉴 원가로 원가율을 계산합니다. 매출 데이터나 메뉴 단가 자체는 바뀌지 않습니다.
      </Paragraph>
      <Form form={form} layout="vertical">
        <Form.Item name="mode" label="방식">
          <Radio.Group>
            <Space orientation="vertical">
              <Radio value="auto">자동 연결 (이름으로 찾기)</Radio>
              <Radio value="menu">메뉴 단가에서 선택</Radio>
              <Radio value="cost">개당 원가 직접 입력 (베이커리·스낵 등)</Radio>
              <Radio value="exclude">원가율 계산에서 제외</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
        {mode === 'menu' && (
          <Form.Item name="menu_price_id" label="메뉴" rules={[{ required: true, message: '메뉴를 선택해주세요' }]}>
            <Select showSearch optionFilterProp="label" placeholder="메뉴 검색"
              options={menuOptions.map((m) => ({ value: m.id, label: `${m.name} · ${m.cost !== null ? won(m.cost) : '원가 없음'}` }))} />
          </Form.Item>
        )}
        {mode === 'cost' && (
          <Form.Item name="unit_cost" label="개당 원가 (원)" rules={[{ required: true, message: '원가를 입력해주세요' }]}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

const ProfitTab = ({ from, to, store, overview }) => {
  const [pnl, setPnl] = useState([]);
  const [pnlLoading, setPnlLoading] = useState(false);
  const datasets = useMemo(() => overview?.products || [], [overview]);
  const [key, setKey] = useState(datasets[0] ? datasetKey(datasets[0]) : null);
  const [products, setProducts] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);
  const [onlyUnmatched, setOnlyUnmatched] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!from || !to) return;
    setPnlLoading(true);
    salesAPI.getPnl({ from, to, ...(store && { store }) })
      .then((res) => setPnl(res.data.months))
      .catch(() => message.error('손익 자료를 불러오지 못했습니다.'))
      .finally(() => setPnlLoading(false));
  }, [from, to, store]);

  const loadProducts = () => {
    if (!key) return;
    const [periodStart, periodEnd, s] = key.split('|');
    setProdLoading(true);
    salesAPI.getProducts({ periodStart, periodEnd, store: s })
      .then((res) => setProducts(res.data))
      .catch(() => message.error('상품별 매출을 불러오지 못했습니다.'))
      .finally(() => setProdLoading(false));
  };

  useEffect(() => {
    if (!key && datasets[0]) setKey(datasetKey(datasets[0]));
  }, [datasets, key]);
  useEffect(loadProducts, [key]);

  const pnlTotal = useMemo(() => {
    const t = pnl.reduce((a, m) => ({
      sales: a.sales + m.sales, purchase: a.purchase + m.purchase, card: a.card + m.card, cost: a.cost + m.cost, orders: a.orders + m.orders,
    }), { sales: 0, purchase: 0, card: 0, cost: 0, orders: 0 });
    return { ...t, profit: t.sales - t.cost, costRatio: t.sales ? (t.cost / t.sales) * 100 : null };
  }, [pnl]);

  const chartData = pnl.map((m) => ({ ...m, label: dayjs(`${m.month}-01`).format('YY년 M월'), 매출: m.sales, '비용(매입+법인카드)': m.cost }));

  const costItems = useMemo(() => {
    const list = (products?.items || []).filter((i) => i.cost_source !== 'zero');
    const filtered = onlyUnmatched ? list.filter((i) => i.est_cost === null && !i.excluded) : list;
    return [...filtered].sort((a, b) => b.total_amount - a.total_amount);
  }, [products, onlyUnmatched]);

  const sum = products?.summary;

  return (
    <div>
      <Card size="small" title="월별 손익" extra={<Text type="secondary">{store || '전체 매장'} · 월 단위</Text>}>
        <Spin spinning={pnlLoading}>
          {pnl.length === 0 ? <Empty /> : (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                <Col xs={12} lg={6}><Statistic title="매출" value={won(pnlTotal.sales)} /></Col>
                <Col xs={12} lg={6}><Statistic title="비용 (매입+법인카드)" value={won(pnlTotal.cost)} /></Col>
                <Col xs={12} lg={6}><Statistic title="매출 − 비용" value={won(pnlTotal.profit)} /></Col>
                <Col xs={12} lg={6}><Statistic title="매출 대비 비용률" value={pct(pnlTotal.costRatio)} /></Col>
              </Row>
              <Legend items={[{ label: '매출', color: SINGLE_COLOR }, { label: '비용(매입+법인카드)', color: COST_COLOR }]} />
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="28%">
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} tickFormatter={shortWon} width={56} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<WonTooltip extra={(p) => {
                      const d = p[0]?.payload;
                      return d ? <div style={{ borderTop: '1px solid #f0f0f0', marginTop: 4, paddingTop: 4 }}>매출 − 비용 <b>{won(d.profit)}</b></div> : null;
                    }} />} />
                    <Bar dataKey="매출" name="매출" fill={SINGLE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="비용(매입+법인카드)" name="비용(매입+법인카드)" fill={COST_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <Table
                size="small"
                rowKey="month"
                pagination={false}
                scroll={{ x: true }}
                style={{ marginTop: 12 }}
                dataSource={pnl}
                columns={[
                  { title: '월', dataIndex: 'month' },
                  { title: '매출', dataIndex: 'sales', align: 'right', render: (v, r) => (r.salesDays ? won(v) : <Text type="secondary">매출 없음</Text>) },
                  { title: '매입 (세금계산서)', dataIndex: 'purchase', align: 'right', render: won },
                  { title: '법인카드', dataIndex: 'card', align: 'right', render: won },
                  { title: '비용 합계', dataIndex: 'cost', align: 'right', render: won },
                  { title: '매출 − 비용', dataIndex: 'profit', align: 'right', render: (v) => <b>{v < 0 ? '▼ ' : ''}{won(v)}</b> },
                  { title: '비용률', dataIndex: 'costRatio', align: 'right', render: (v) => pct(v) },
                  { title: <AntTooltip title="세금계산서와 겹칠 수 있어 합계에는 넣지 않았습니다"><span>발주 (참고) <InfoCircleOutlined /></span></AntTooltip>, dataIndex: 'orders', align: 'right', render: won },
                ]}
              />
              <Alert style={{ marginTop: 12 }} type="warning" showIcon
                message="인건비·임차료 등은 포함되지 않은 단순 손익입니다."
                description="매출 데이터가 없는 달이나 아직 세금계산서·법인카드를 입력하지 않은 달은 실제와 다를 수 있습니다." />
            </>
          )}
        </Spin>
      </Card>

      <Card size="small" title="메뉴 원가율" style={{ marginTop: 16 }}
        extra={datasets.length > 0 && (
          <Select size="small" value={key} onChange={setKey} style={{ minWidth: 260 }}
            options={datasets.map((d) => ({ value: datasetKey(d), label: datasetLabel(d) }))} />
        )}>
        {!datasets.length ? <Empty description="상품별 매출 파일을 올리면 메뉴 원가율을 볼 수 있습니다." /> : (
          <Spin spinning={prodLoading}>
            {sum && (
              <Row gutter={[16, 16]} style={{ marginBottom: 12 }}>
                <Col xs={12} lg={6}><Statistic title="추정 원가율" value={pct(sum.costRatio)} /><Text type="secondary">원가가 연결된 메뉴 기준</Text></Col>
                <Col xs={12} lg={6}><Statistic title="추정 원가" value={won(sum.matchedCost)} /><Text type="secondary">매출 {won(sum.matchedSales)} 중</Text></Col>
                <Col xs={12} lg={6}><Statistic title="원가 연결 비율" value={pct(sum.coverage)} /><Text type="secondary">전체 매출 중 원가를 아는 비율</Text></Col>
                <Col xs={12} lg={6}><Statistic title="원가 미연결 품목" value={sum.unmatchedCount} suffix="개" /><Text type="secondary">베이커리·스낵 등</Text></Col>
              </Row>
            )}
            <Space style={{ marginBottom: 8 }} wrap>
              <Switch checked={onlyUnmatched} onChange={setOnlyUnmatched} /> <Text>원가 미연결 품목만 보기</Text>
            </Space>
            <Table
              size="small"
              rowKey={(r) => `${r.product_code}-${r.product_name}`}
              dataSource={costItems}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: true }}
              columns={[
                { title: '분류', dataIndex: 'category', width: 100 },
                { title: '메뉴', dataIndex: 'product_name' },
                { title: '판매수량', dataIndex: 'quantity', align: 'right', render: (v) => v.toLocaleString() },
                { title: '매출', dataIndex: 'total_amount', align: 'right', render: won, sorter: (a, b) => a.total_amount - b.total_amount },
                { title: '평균 판매가', dataIndex: 'avg_price', align: 'right', render: won },
                { title: '개당 원가', dataIndex: 'unit_cost', align: 'right', render: (v) => (v === null ? '-' : won(v)) },
                {
                  title: '원가율',
                  dataIndex: 'cost_ratio',
                  align: 'right',
                  sorter: (a, b) => (a.cost_ratio ?? -1) - (b.cost_ratio ?? -1),
                  render: (v) => (v === null ? '-' : v >= 100
                    ? <Tag color="red" icon={<WarningOutlined />}>{pct(v)} 원가 초과</Tag>
                    : pct(v)),
                },
                {
                  title: '원가 연결',
                  key: 'src',
                  render: (_, r) => {
                    const t = SOURCE_TAG[r.cost_source];
                    const names = r.matched_menus?.map((m) => m.name).filter((n, i, arr) => arr.indexOf(n) === i).join(', ');
                    return (
                      <Space size={4} wrap>
                        {t ? <Tag color={t.color}>{t.label}</Tag> : <Tag color="orange">미연결</Tag>}
                        {names && <Text type="secondary" style={{ fontSize: 12 }}>{names}</Text>}
                      </Space>
                    );
                  },
                },
                {
                  title: '',
                  key: 'edit',
                  width: 60,
                  render: (_, r) => <Button size="small" icon={<SettingOutlined />} onClick={() => setEditing(r)} aria-label="원가 연결 설정" />,
                },
              ]}
            />
            <Text type="secondary">
              원가율 = (판매수량 × 메뉴 단가의 원가) ÷ 매출. HOT/ICE 원가가 다르면 평균을 씁니다. 사내 지원으로 판매가가 낮은 메뉴는 100%를 넘을 수 있습니다.
            </Text>
          </Spin>
        )}
      </Card>

      <MappingModal
        item={editing}
        menuOptions={products?.menuOptions || []}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); loadProducts(); }}
      />
    </div>
  );
};

export default ProfitTab;
