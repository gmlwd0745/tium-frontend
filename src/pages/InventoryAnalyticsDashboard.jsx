import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Space,
  Table,
  Tag,
  Progress,
  Alert,
  Spin,
  Typography,
  Button,
  Input,
} from 'antd';
import {
  WarningOutlined,
  CheckCircleOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  InboxOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ordersAPI, inventoryAPI } from '../services/api';

const { Title, Text } = Typography;

const InventoryAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedStore, setSelectedStore] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchText, setSearchText] = useState('');

  // 대시보드 데이터
  const [stats, setStats] = useState({
    totalOrderAmount: 0,
    totalOrderQuantity: 0,
    totalUsage: 0,
    lowStockItems: 0,
  });

  const [itemsData, setItemsData] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedStore, selectedCategory]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const params = {
        month: selectedMonth,
        ...(selectedStore !== 'all' && { store: selectedStore }),
        limit: 10000,
      };

      // 발주 데이터 가져오기
      const startDate = dayjs(selectedMonth).startOf('month').format('YYYY-MM-DD');
      const endDate = dayjs(selectedMonth).endOf('month').format('YYYY-MM-DD');

      const ordersResponse = await ordersAPI.getAll({
        start_date: startDate,
        end_date: endDate,
        ...(selectedStore !== 'all' && { store: selectedStore }),
        limit: 10000,
      });
      const orders = ordersResponse.data.data || [];

      // 재고 데이터 가져오기
      const inventoryResponse = await inventoryAPI.getAll({ ...params });
      const inventory = inventoryResponse.data.data || [];

      // 재고 알림 가져오기
      const alertsResponse = await inventoryAPI.getAlerts(selectedStore !== 'all' ? { store: selectedStore } : {});
      setAlerts(alertsResponse.data || []);

      // 데이터 가공
      processItemsData(orders, inventory);
      calculateStats(orders, inventory);
    } catch (error) {
      console.error('대시보드 데이터 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const processItemsData = (orders, inventory) => {
    // 품목별로 데이터 집계
    const itemMap = {};

    // 발주 데이터 집계
    orders.forEach(order => {
      const key = order.item_name;
      if (!itemMap[key]) {
        itemMap[key] = {
          item_name: key,
          category: '',
          unit: order.unit || '',
          ordered: 0,
          used: 0,
          stock: 0,
          min_stock: 0,
          orderAmount: 0,
        };
      }
      itemMap[key].ordered += parseFloat(order.quantity) || 0;
      itemMap[key].orderAmount += parseFloat(order.total_price) || 0;
    });

    // 재고 데이터 집계
    inventory.forEach(item => {
      const key = item.item_name;
      if (!itemMap[key]) {
        itemMap[key] = {
          item_name: key,
          category: item.category || '',
          unit: item.unit || '',
          ordered: 0,
          used: 0,
          stock: 0,
          min_stock: 0,
          orderAmount: 0,
        };
      }
      itemMap[key].category = item.category || '';
      itemMap[key].used += parseFloat(item.current_consumption) || 0;
      itemMap[key].stock = parseFloat(item.current_stock) || 0;
      itemMap[key].min_stock = parseFloat(item.min_stock) || 0;
    });

    // 배열로 변환 및 상태 계산
    const data = Object.values(itemMap)
      .map(item => {
        const usageRate = item.ordered > 0 ? (item.used / item.ordered) * 100 : 0;
        let status = '정상';
        let statusColor = 'green';

        // 재고 부족
        if (item.min_stock > 0 && item.stock < item.min_stock) {
          status = '재고부족';
          statusColor = 'red';
        }
        // 과다 발주 (발주량이 사용량의 2배 이상)
        else if (item.ordered > item.used * 2 && item.used > 0) {
          status = '과다발주';
          statusColor = 'orange';
        }
        // 발주 부족 (사용량이 발주량보다 많음)
        else if (item.used > item.ordered && item.ordered > 0) {
          status = '발주부족';
          statusColor = 'blue';
        }

        return {
          ...item,
          usageRate: usageRate.toFixed(1),
          status,
          statusColor,
          remaining: item.ordered - item.used,
        };
      })
      .filter(item => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
        if (searchText && !item.item_name.toLowerCase().includes(searchText.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => b.orderAmount - a.orderAmount);

    setItemsData(data);
  };

  const calculateStats = (orders, inventory) => {
    const totalOrderAmount = orders.reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0);
    const totalOrderQuantity = orders.reduce((sum, order) => sum + (parseFloat(order.quantity) || 0), 0);
    const totalUsage = inventory.reduce((sum, item) => sum + (parseFloat(item.current_consumption) || 0), 0);

    setStats({
      totalOrderAmount: Math.round(totalOrderAmount),
      totalOrderQuantity: Math.round(totalOrderQuantity),
      totalUsage,
      lowStockItems: alerts.length || 0,
    });
  };

  const handleRefresh = () => {
    fetchDashboardData();
  };

  // 테이블 컬럼
  const columns = [
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      fixed: 'left',
      filters: [
        { text: '정상', value: '정상' },
        { text: '재고부족', value: '재고부족' },
        { text: '과다발주', value: '과다발주' },
        { text: '발주부족', value: '발주부족' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status, record) => (
        <Tag color={record.statusColor}>{status}</Tag>
      ),
    },
    {
      title: '품목',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 200,
      fixed: 'left',
      sorter: (a, b) => a.item_name.localeCompare(b.item_name),
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      filters: [
        { text: '원부재료', value: '원부재료' },
        { text: '디저트', value: '디저트' },
        { text: '부재료', value: '부재료' },
        { text: '티백', value: '티백' },
        { text: '콤부차', value: '콤부차' },
        { text: '소모품', value: '소모품' },
      ],
      onFilter: (value, record) => record.category === value,
    },
    {
      title: '발주량',
      dataIndex: 'ordered',
      key: 'ordered',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.ordered - b.ordered,
      render: (value, record) => (
        <Text strong style={{ color: '#1890ff' }}>
          {Math.round(value).toLocaleString()} {record.unit}
        </Text>
      ),
    },
    {
      title: '소진량',
      dataIndex: 'used',
      key: 'used',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.used - b.used,
      render: (value, record) => (
        <Text strong style={{ color: '#52c41a' }}>
          {Math.round(value).toLocaleString()} {record.unit}
        </Text>
      ),
    },
    {
      title: '남은량',
      dataIndex: 'remaining',
      key: 'remaining',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.remaining - b.remaining,
      render: (value, record) => (
        <Text style={{ color: value < 0 ? '#ff4d4f' : '#8c8c8c' }}>
          {Math.round(value).toLocaleString()} {record.unit}
        </Text>
      ),
    },
    {
      title: '현재고',
      dataIndex: 'stock',
      key: 'stock',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.stock - b.stock,
      render: (value, record) => {
        const isLow = record.min_stock > 0 && value < record.min_stock;
        return (
          <Text strong style={{ color: isLow ? '#ff4d4f' : undefined }}>
            {value.toLocaleString()} {record.unit}
            {record.min_stock > 0 && (
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                (최소: {record.min_stock})
              </Text>
            )}
          </Text>
        );
      },
    },
    {
      title: '소진율',
      dataIndex: 'usageRate',
      key: 'usageRate',
      width: 150,
      align: 'right',
      sorter: (a, b) => parseFloat(a.usageRate) - parseFloat(b.usageRate),
      render: (value) => {
        const rate = parseFloat(value);
        let color = 'normal';
        if (rate >= 80 && rate <= 120) color = 'success';
        else if (rate > 120 || rate < 50) color = 'exception';

        return (
          <div>
            <Progress
              percent={Math.min(rate, 100)}
              size="small"
              status={color}
              style={{ width: 80, marginBottom: 4 }}
            />
            <Text style={{ fontSize: 12 }}>{value}%</Text>
          </div>
        );
      },
    },
    {
      title: '발주 금액',
      dataIndex: 'orderAmount',
      key: 'orderAmount',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.orderAmount - b.orderAmount,
      render: (value) => `${value.toLocaleString()}원`,
    },
  ];

  // 필터링된 데이터
  const filteredData = itemsData.filter(item => {
    if (searchText && !item.item_name.toLowerCase().includes(searchText.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div>
      {/* 헤더 */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            📊 재고 분석 대시보드
          </Title>
          <Text type="secondary">품목별 발주량과 소진량을 한눈에 확인하세요</Text>
        </Col>
        <Col>
          <Space>
            <DatePicker
              picker="month"
              value={dayjs(selectedMonth)}
              onChange={(date) => setSelectedMonth(date.format('YYYY-MM'))}
              format="YYYY년 MM월"
            />
            <Select
              style={{ width: 120 }}
              value={selectedStore}
              onChange={setSelectedStore}
            >
              <Select.Option value="all">전체 매장</Select.Option>
              <Select.Option value="큰길">큰길</Select.Option>
              <Select.Option value="태광">태광</Select.Option>
            </Select>
            <Select
              style={{ width: 150 }}
              value={selectedCategory}
              onChange={setSelectedCategory}
            >
              <Select.Option value="all">전체 카테고리</Select.Option>
              <Select.Option value="원부재료">원부재료</Select.Option>
              <Select.Option value="디저트">디저트</Select.Option>
              <Select.Option value="부재료">부재료</Select.Option>
              <Select.Option value="티백">티백</Select.Option>
              <Select.Option value="콤부차">콤부차</Select.Option>
              <Select.Option value="소모품">소모품</Select.Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              새로고침
            </Button>
          </Space>
        </Col>
      </Row>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 100 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 주요 지표 카드 */}
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="총 발주 금액"
                  value={stats.totalOrderAmount}
                  suffix="원"
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="총 소진량"
                  value={stats.totalUsage.toFixed(0)}
                  suffix="개"
                  prefix={<ShoppingCartOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="재고 부족 품목"
                  value={stats.lowStockItems}
                  suffix="개"
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: stats.lowStockItems > 0 ? '#ff4d4f' : '#52c41a' }}
                />
              </Card>
            </Col>

            <Col xs={24} sm={12} lg={6}>
              <Card>
                <Statistic
                  title="분석 품목 수"
                  value={filteredData.length}
                  suffix="개"
                  prefix={<InboxOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              </Card>
            </Col>
          </Row>

          {/* 재고 부족 알림 */}
          {alerts.length > 0 && (
            <Alert
              message={`🚨 재고 부족 알림 (${alerts.length}개 품목)`}
              description={
                <Space wrap>
                  {alerts.slice(0, 10).map(item => (
                    <Tag key={item.id} color="red">
                      {item.item_name}: {item.current_stock}/{item.min_stock} {item.unit}
                    </Tag>
                  ))}
                  {alerts.length > 10 && <Tag>+{alerts.length - 10}개 더...</Tag>}
                </Space>
              }
              type="error"
              showIcon
              style={{ marginBottom: 24 }}
            />
          )}

          {/* 품목별 상세 테이블 */}
          <Card
            title={`📋 품목별 발주/소진 상세 (${selectedMonth})`}
            extra={
              <Input
                placeholder="품목 검색..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
            }
          >
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="item_name"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `총 ${total}개 품목`,
              }}
              scroll={{ x: 1300 }}
              size="small"
            />
          </Card>

          {/* 인사이트 */}
          <Card title="💡 한눈에 보기" style={{ marginTop: 24 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {stats.lowStockItems > 0 && (
                <Alert
                  message="재고 부족 품목 발견"
                  description={`${stats.lowStockItems}개 품목의 재고가 최소 재고량 이하입니다. 즉시 발주를 진행하세요.`}
                  type="error"
                  showIcon
                  icon={<WarningOutlined />}
                />
              )}

              {itemsData.filter(item => item.status === '과다발주').length > 0 && (
                <Alert
                  message="과다 발주 품목"
                  description={
                    <div>
                      {itemsData
                        .filter(item => item.status === '과다발주')
                        .slice(0, 3)
                        .map(item => (
                          <div key={item.item_name}>
                            • <Text strong>{item.item_name}</Text>: 발주 {item.ordered} vs 소진 {item.used} (
                            {item.usageRate}%)
                          </div>
                        ))}
                    </div>
                  }
                  type="warning"
                  showIcon
                />
              )}

              {itemsData.filter(item => item.usageRate >= 80 && item.usageRate <= 120).length > 0 && (
                <Alert
                  message="효율적인 발주 품목"
                  description={`${
                    itemsData.filter(item => item.usageRate >= 80 && item.usageRate <= 120).length
                  }개 품목이 적정 소진율(80-120%)을 보이고 있습니다. 계속 유지하세요!`}
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                />
              )}
            </Space>
          </Card>
        </>
      )}
    </div>
  );
};

export default InventoryAnalyticsDashboard;
