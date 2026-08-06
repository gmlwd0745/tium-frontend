import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  Space,
  Typography,
  Table,
  DatePicker,
  message,
} from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  CreditCardOutlined,
  RiseOutlined,
  FallOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { analyticsAPI } from '../services/api';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedStore, setSelectedStore] = useState('all');
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);

  useEffect(() => {
    fetchDashboard();
  }, [selectedStore, dateRange]);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const response = await analyticsAPI.getDashboard({
        store: selectedStore !== 'all' ? selectedStore : undefined,
        start_date: dateRange[0].format('YYYY-MM-DD'),
        end_date: dateRange[1].format('YYYY-MM-DD'),
      });
      setDashboardData(response.data);
    } catch (error) {
      message.error('통계 데이터를 불러오는데 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const categoryColumns = [
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
    },
    {
      title: '건수',
      dataIndex: 'count',
      key: 'count',
      align: 'right',
      render: (value) => `${value}건`,
    },
    {
      title: '금액',
      dataIndex: 'total_amount',
      key: 'total_amount',
      align: 'right',
      render: (value) => `${value?.toLocaleString()}원`,
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2}>통계 및 분석</Title>
        </Col>
        <Col>
          <Space>
            <Select
              value={selectedStore}
              onChange={setSelectedStore}
              style={{ width: 120 }}
            >
              <Select.Option value="all">전체</Select.Option>
              <Select.Option value="큰길">큰길</Select.Option>
              <Select.Option value="태광">태광</Select.Option>
            </Select>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="YYYY-MM-DD"
            />
          </Space>
        </Col>
      </Row>

      {dashboardData ? (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="총 매출"
                  value={dashboardData.total_revenue || 0}
                  suffix="원"
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="총 발주"
                  value={dashboardData.total_orders || 0}
                  suffix="원"
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="법인카드 지출"
                  value={dashboardData.total_expenses || 0}
                  suffix="원"
                  prefix={<CreditCardOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card loading={loading}>
                <Statistic
                  title="순이익"
                  value={
                    (dashboardData.total_revenue || 0) -
                    (dashboardData.total_orders || 0) -
                    (dashboardData.total_expenses || 0)
                  }
                  suffix="원"
                  prefix={<BarChartOutlined />}
                  valueStyle={{
                    color:
                      (dashboardData.total_revenue || 0) -
                        (dashboardData.total_orders || 0) -
                        (dashboardData.total_expenses || 0) >=
                      0
                        ? '#52c41a'
                        : '#ff4d4f',
                  }}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={12}>
              <Card
                title="발주 카테고리별 분석"
                loading={loading}
              >
                <Table
                  dataSource={dashboardData.orders_by_category || []}
                  columns={categoryColumns}
                  pagination={false}
                  size="small"
                  rowKey="category"
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card
                title="법인카드 카테고리별 분석"
                loading={loading}
              >
                <Table
                  dataSource={dashboardData.expenses_by_category || []}
                  columns={categoryColumns}
                  pagination={false}
                  size="small"
                  rowKey="category"
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Card
                title="최근 거래"
                loading={loading}
              >
                {dashboardData.recent_transactions?.map((trans, idx) => (
                  <Card.Grid
                    key={idx}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        {trans.type === '입금' ? (
                          <RiseOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <FallOutlined style={{ color: '#ff4d4f' }} />
                        )}
                        <Text strong>{trans.description}</Text>
                      </Space>
                      <Space split="|">
                        <Text type="secondary">{trans.transaction_date}</Text>
                        <Text type="secondary">{trans.store}</Text>
                        <Text
                          strong
                          style={{
                            color: trans.type === '입금' ? '#52c41a' : '#ff4d4f',
                          }}
                        >
                          {trans.type === '입금' ? '+' : '-'}
                          {trans.amount?.toLocaleString()}원
                        </Text>
                      </Space>
                    </Space>
                  </Card.Grid>
                ))}
                {(!dashboardData.recent_transactions ||
                  dashboardData.recent_transactions.length === 0) && (
                  <Text type="secondary">거래 내역이 없습니다.</Text>
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card
                title="재고 알림"
                loading={loading}
              >
                {dashboardData.low_stock_items?.map((item, idx) => (
                  <Card.Grid
                    key={idx}
                    style={{ width: '100%', padding: '12px' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text strong>{item.item_name}</Text>
                      <Space split="|">
                        <Text type="secondary">{item.store}</Text>
                        <Text type="secondary">{item.category}</Text>
                        <Text type="danger">
                          재고: {item.current_stock} / 최소: {item.min_stock}{' '}
                          {item.unit}
                        </Text>
                      </Space>
                    </Space>
                  </Card.Grid>
                ))}
                {(!dashboardData.low_stock_items ||
                  dashboardData.low_stock_items.length === 0) && (
                  <Text type="secondary">재고 부족 항목이 없습니다.</Text>
                )}
              </Card>
            </Col>
          </Row>
        </>
      ) : (
        <Card loading={loading}>
          <Text type="secondary">데이터를 불러오는 중...</Text>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsPage;
