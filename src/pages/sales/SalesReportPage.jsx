import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Tabs, DatePicker, Select, Space, Button, Typography, Empty, Spin, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import './sales.css';
import TrendTab from './TrendTab';
import StoreCompareTab from './StoreCompareTab';
import MenuRankTab from './MenuRankTab';
import ProfitTab from './ProfitTab';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const TAB_KEYS = ['trend', 'store', 'menu', 'profit'];

const SalesReportPage = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = TAB_KEYS.includes(params.get('tab')) ? params.get('tab') : 'trend';

  const [overview, setOverview] = useState(null);
  const [range, setRange] = useState(null);
  const [store, setStore] = useState('');
  const [daily, setDaily] = useState([]);
  const [prevDaily, setPrevDaily] = useState([]);
  const [loading, setLoading] = useState(false);

  // 데이터가 있는 마지막 달을 기본 기간으로
  useEffect(() => {
    salesAPI.getOverview()
      .then((res) => {
        setOverview(res.data);
        const max = res.data.daily?.max_date;
        if (max) {
          // 마지막 달이 중순 전이면 지난달부터 보여줘서 비교할 데이터가 충분하도록
          const end = dayjs(max);
          const start = end.date() < 15 ? end.subtract(1, 'month').startOf('month') : end.startOf('month');
          setRange([start, end]);
        }
      })
      .catch(() => message.error('매출 데이터를 불러오지 못했습니다.'));
  }, []);

  const from = range?.[0]?.format('YYYY-MM-DD');
  const to = range?.[1]?.format('YYYY-MM-DD');

  useEffect(() => {
    if (!from || !to) return;
    const days = dayjs(to).diff(dayjs(from), 'day') + 1;
    const prevTo = dayjs(from).subtract(1, 'day');
    const prevFrom = prevTo.subtract(days - 1, 'day');
    setLoading(true);
    Promise.all([
      salesAPI.getDaily({ from, to, ...(store && { store }) }),
      salesAPI.getDaily({ from: prevFrom.format('YYYY-MM-DD'), to: prevTo.format('YYYY-MM-DD'), ...(store && { store }) }),
    ])
      .then(([cur, prev]) => {
        setDaily(cur.data);
        setPrevDaily(prev.data);
      })
      .catch(() => message.error('일자별 매출을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, [from, to, store]);

  const presets = useMemo(() => {
    const max = overview?.daily?.max_date ? dayjs(overview.daily.max_date) : dayjs();
    const min = overview?.daily?.min_date ? dayjs(overview.daily.min_date) : max;
    return [
      { label: '데이터 마지막 달', value: [max.startOf('month'), max] },
      { label: '그 전달', value: [max.subtract(1, 'month').startOf('month'), max.subtract(1, 'month').endOf('month')] },
      { label: '최근 3개월', value: [max.subtract(2, 'month').startOf('month'), max] },
      { label: '전체 기간', value: [min, max] },
    ];
  }, [overview]);

  const hasData = overview?.daily?.row_count > 0 || overview?.products?.length > 0;

  if (overview && !hasData) {
    return (
      <Empty className="sales-page" description="아직 올린 매출 데이터가 없습니다." style={{ padding: 60, textAlign: 'center' }}>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => navigate('/sales/upload')}>POS 매출 파일 올리기</Button>
      </Empty>
    );
  }

  const filterBar = (
    <Space wrap>
      <RangePicker value={range} onChange={setRange} presets={presets} allowClear={false} />
      <Select
        value={store}
        onChange={setStore}
        style={{ width: 120 }}
        options={[{ value: '', label: '전체 매장' }, { value: '큰길', label: '큰길' }, { value: '태광', label: '태광' }]}
      />
    </Space>
  );

  const usesRange = tab !== 'menu';

  return (
    <div className="sales-page">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 8 }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>매출 리포트</Title>
          {overview?.daily?.max_date && (
            <Text type="secondary">일자별 매출 {overview.daily.min_date} ~ {overview.daily.max_date} 반영됨</Text>
          )}
        </div>
        <Button icon={<UploadOutlined />} onClick={() => navigate('/sales/upload')}>매출 파일 올리기</Button>
      </Space>

      <Tabs
        activeKey={tab}
        onChange={(k) => setParams({ tab: k })}
        items={[
          { key: 'trend', label: '매출 추이' },
          { key: 'store', label: '매장 비교' },
          { key: 'menu', label: '메뉴 순위' },
          { key: 'profit', label: '원가율·손익' },
        ]}
      />
      {usesRange && <div style={{ marginBottom: 16 }}>{filterBar}</div>}

      <Spin spinning={loading}>
        {tab === 'trend' && <TrendTab daily={daily} prevDaily={prevDaily} store={store} />}
        {tab === 'store' && <StoreCompareTab daily={daily} overview={overview} store={store} />}
        {tab === 'menu' && <MenuRankTab overview={overview} />}
        {tab === 'profit' && <ProfitTab from={from} to={to} store={store} overview={overview} />}
      </Spin>
    </div>
  );
};

export default SalesReportPage;
