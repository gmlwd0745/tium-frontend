import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Select,
  DatePicker,
  Space,
  Typography,
  Spin,
  Table,
  Tag,
  Alert,
  Divider,
} from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  ShoppingOutlined,
  CreditCardOutlined,
  WarningOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { transactionsAPI, expensesAPI, ordersAPI, inventoryAPI } from '../services/api';

const { Title, Text } = Typography;

const DashboardPage = () => {
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedStore, setSelectedStore] = useState(''); // 전체
  const [stats, setStats] = useState({
    currentMonth: {
      transactions: 0,
      expenses: 0,
      total: 0,
    },
    previousMonth: {
      transactions: 0,
      expenses: 0,
      total: 0,
    },
    transactionsByClient: {
      milk: 0,
      coffee: 0,
      assa: 0,
    },
    expensesByMerchant: [],
    storeComparison: {
      큰길: { transactions: 0, expenses: 0 },
      태광: { transactions: 0, expenses: 0 },
    },
    // 발주/재고 관련 추가
    orders: {
      totalAmount: 0,
      totalCount: 0,
      topItems: [],
    },
    inventory: {
      lowStockCount: 0,
      totalItems: 0,
      alerts: [],
    },
  });

  useEffect(() => {
    fetchDashboardData();
  }, [selectedMonth, selectedStore]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const currentMonth = selectedMonth;
      const previousMonth = dayjs(selectedMonth).subtract(1, 'month').format('YYYY-MM');

      // 이번 달 거래금액
      const currentTransactionsRes = await transactionsAPI.getAll({
        page: 1,
        limit: 10000,
        month: currentMonth,
        ...(selectedStore && { store: selectedStore }),
      });
      const currentTransactions = currentTransactionsRes.data.data;
      const currentTransactionsTotal = currentTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      // 이번 달 법인카드
      const currentExpensesRes = await expensesAPI.getAll({
        page: 1,
        limit: 10000,
        month: currentMonth,
        ...(selectedStore && { store: selectedStore }),
      });
      const currentExpenses = currentExpensesRes.data.data;
      const currentExpensesTotal = currentExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

      // 전월 거래금액
      const previousTransactionsRes = await transactionsAPI.getAll({
        page: 1,
        limit: 10000,
        month: previousMonth,
        ...(selectedStore && { store: selectedStore }),
      });
      const previousTransactions = previousTransactionsRes.data.data;
      const previousTransactionsTotal = previousTransactions.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      // 전월 법인카드
      const previousExpensesRes = await expensesAPI.getAll({
        page: 1,
        limit: 10000,
        month: previousMonth,
        ...(selectedStore && { store: selectedStore }),
      });
      const previousExpenses = previousExpensesRes.data.data;
      const previousExpensesTotal = previousExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

      // 거래처별 집계 (이번 달)
      const milk = currentTransactions
        .filter(t => t.client === '우유')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const coffee = currentTransactions
        .filter(t => t.client === '원두')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
      const assa = currentTransactions
        .filter(t => t.client === '아싸컴퍼니')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

      // 가맹점별 집계 (이번 달 법인카드)
      const merchantMap = {};
      currentExpenses.forEach(expense => {
        const merchant = expense.merchant_name || '기타';
        if (!merchantMap[merchant]) {
          merchantMap[merchant] = 0;
        }
        merchantMap[merchant] += parseFloat(expense.amount) || 0;
      });
      const expensesByMerchant = Object.entries(merchantMap)
        .map(([merchant, amount]) => ({ merchant, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10); // 상위 10개

      // 매장별 비교 (매장 필터 없을 때만)
      let storeComparison = {
        큰길: { transactions: 0, expenses: 0 },
        태광: { transactions: 0, expenses: 0 },
      };

      if (!selectedStore) {
        // 큰길
        const 큰길TransactionsRes = await transactionsAPI.getAll({
          page: 1,
          limit: 10000,
          month: currentMonth,
          store: '큰길',
        });
        const 큰길ExpensesRes = await expensesAPI.getAll({
          page: 1,
          limit: 10000,
          month: currentMonth,
          store: '큰길',
        });
        storeComparison.큰길.transactions = 큰길TransactionsRes.data.data.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        storeComparison.큰길.expenses = 큰길ExpensesRes.data.data.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        // 태광
        const 태광TransactionsRes = await transactionsAPI.getAll({
          page: 1,
          limit: 10000,
          month: currentMonth,
          store: '태광',
        });
        const 태광ExpensesRes = await expensesAPI.getAll({
          page: 1,
          limit: 10000,
          month: currentMonth,
          store: '태광',
        });
        storeComparison.태광.transactions = 태광TransactionsRes.data.data.reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
        storeComparison.태광.expenses = 태광ExpensesRes.data.data.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      }

      // ========== 발주 데이터 ==========
      const startDate = dayjs(currentMonth).startOf('month').format('YYYY-MM-DD');
      const endDate = dayjs(currentMonth).endOf('month').format('YYYY-MM-DD');

      const ordersRes = await ordersAPI.getAll({
        start_date: startDate,
        end_date: endDate,
        ...(selectedStore && { store: selectedStore }),
        limit: 10000,
      });
      const orders = ordersRes.data.data || [];
      const totalOrderAmount = orders.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);
      const totalOrderCount = orders.length;

      // 발주 TOP 5
      const orderItemMap = {};
      orders.forEach(order => {
        const key = order.item_name;
        if (!orderItemMap[key]) {
          orderItemMap[key] = { item_name: key, quantity: 0, amount: 0, unit: order.unit || '' };
        }
        orderItemMap[key].quantity += parseFloat(order.quantity) || 0;
        orderItemMap[key].amount += parseFloat(order.total_price) || 0;
      });
      const topOrderItems = Object.values(orderItemMap)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // ========== 재고 데이터 ==========
      const inventoryRes = await inventoryAPI.getAll({
        month: currentMonth,
        ...(selectedStore && { store: selectedStore }),
        limit: 10000,
      });
      const inventory = inventoryRes.data.data || [];
      const totalInventoryItems = inventory.length;

      // 재고 알림
      const alertsRes = await inventoryAPI.getAlerts(selectedStore ? { store: selectedStore } : {});
      const alerts = alertsRes.data || [];
      const lowStockCount = alerts.length;

      setStats({
        currentMonth: {
          transactions: currentTransactionsTotal,
          expenses: currentExpensesTotal,
          total: currentTransactionsTotal + currentExpensesTotal,
        },
        previousMonth: {
          transactions: previousTransactionsTotal,
          expenses: previousExpensesTotal,
          total: previousTransactionsTotal + previousExpensesTotal,
        },
        transactionsByClient: {
          milk,
          coffee,
          assa,
        },
        expensesByMerchant,
        storeComparison,
        orders: {
          totalAmount: totalOrderAmount,
          totalCount: totalOrderCount,
          topItems: topOrderItems,
        },
        inventory: {
          lowStockCount,
          totalItems: totalInventoryItems,
          alerts: alerts.slice(0, 5), // 상위 5개만
        },
      });
    } catch (error) {
      console.error('대시보드 데이터 로딩 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  // 증감률 계산
  const calculateChangeRate = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const totalChangeRate = calculateChangeRate(
    stats.currentMonth.total,
    stats.previousMonth.total
  );

  const transactionsChangeRate = calculateChangeRate(
    stats.currentMonth.transactions,
    stats.previousMonth.transactions
  );

  const expensesChangeRate = calculateChangeRate(
    stats.currentMonth.expenses,
    stats.previousMonth.expenses
  );

  // 가맹점 테이블 컬럼
  const merchantColumns = [
    {
      title: '순위',
      key: 'rank',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '가맹점',
      dataIndex: 'merchant',
      key: 'merchant',
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount) => `${amount.toLocaleString()}원`,
    },
  ];

  // 발주 TOP 5 컬럼
  const orderItemColumns = [
    {
      title: '순위',
      key: 'rank',
      width: 60,
      render: (_, __, index) => index + 1,
    },
    {
      title: '품목',
      dataIndex: 'item_name',
      key: 'item_name',
    },
    {
      title: '수량',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right',
      render: (value, record) => `${value.toLocaleString()} ${record.unit}`,
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      align: 'right',
      render: (amount) => `${amount.toLocaleString()}원`,
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2}>📊 통합 대시보드</Title>
          <Text type="secondary">거래금액, 법인카드, 발주, 재고를 한눈에</Text>
        </Col>
        <Col>
          <Space>
            <Text strong>매장:</Text>
            <Select
              style={{ width: 120 }}
              placeholder="전체"
              value={selectedStore || undefined}
              onChange={(value) => setSelectedStore(value || '')}
              allowClear
            >
              <Select.Option value="큰길">큰길</Select.Option>
              <Select.Option value="태광">태광</Select.Option>
            </Select>

            <Text strong>월:</Text>
            <DatePicker
              picker="month"
              value={dayjs(selectedMonth)}
              onChange={(date) => setSelectedMonth(date.format('YYYY-MM'))}
              style={{ width: 150 }}
            />
          </Space>
        </Col>
      </Row>

      <Spin spinning={loading}>
        {/* 재고 부족 알림 */}
        {stats.inventory.lowStockCount > 0 && (
          <Alert
            message={`🚨 재고 부족 알림 (${stats.inventory.lowStockCount}개 품목)`}
            description={
              <Space wrap>
                {stats.inventory.alerts.map(item => (
                  <Tag key={item.id} color="red">
                    {item.item_name}: {item.current_stock}/{item.min_stock} {item.unit}
                  </Tag>
                ))}
                {stats.inventory.lowStockCount > 5 && <Tag>+{stats.inventory.lowStockCount - 5}개 더...</Tag>}
              </Space>
            }
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        {/* 주요 지표 - 5개 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8} lg={8} xl={8}>
            <Card>
              <Statistic
                title={`${selectedMonth} 총 지출 ${selectedStore ? `(${selectedStore})` : ''}`}
                value={stats.currentMonth.total}
                suffix="원"
                prefix={<DollarOutlined />}
                valueStyle={{ color: '#cf1322', fontSize: 24, fontWeight: 'bold' }}
              />
              <div style={{ marginTop: 16 }}>
                {totalChangeRate >= 0 ? (
                  <Text type="danger">
                    <ArrowUpOutlined /> 전월 대비 {totalChangeRate.toFixed(1)}% 증가
                  </Text>
                ) : (
                  <Text type="success">
                    <ArrowDownOutlined /> 전월 대비 {Math.abs(totalChangeRate).toFixed(1)}% 감소
                  </Text>
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={8} xl={8}>
            <Card>
              <Statistic
                title="거래금액 (우유/원두/아싸)"
                value={stats.currentMonth.transactions}
                suffix="원"
                prefix={<ShoppingOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
              <div style={{ marginTop: 16 }}>
                {transactionsChangeRate >= 0 ? (
                  <Text style={{ color: '#ff4d4f' }}>
                    <ArrowUpOutlined /> 전월 대비 {transactionsChangeRate.toFixed(1)}%
                  </Text>
                ) : (
                  <Text style={{ color: '#52c41a' }}>
                    <ArrowDownOutlined /> 전월 대비 {Math.abs(transactionsChangeRate).toFixed(1)}%
                  </Text>
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={8} xl={8}>
            <Card>
              <Statistic
                title="법인카드 지출"
                value={stats.currentMonth.expenses}
                suffix="원"
                prefix={<CreditCardOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
              <div style={{ marginTop: 16 }}>
                {expensesChangeRate >= 0 ? (
                  <Text style={{ color: '#ff4d4f' }}>
                    <ArrowUpOutlined /> 전월 대비 {expensesChangeRate.toFixed(1)}%
                  </Text>
                ) : (
                  <Text style={{ color: '#52c41a' }}>
                    <ArrowDownOutlined /> 전월 대비 {Math.abs(expensesChangeRate).toFixed(1)}%
                  </Text>
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={8} xl={8}>
            <Card>
              <Statistic
                title="발주 금액"
                value={stats.orders.totalAmount}
                suffix="원"
                prefix={<ShoppingCartOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">발주 건수: {stats.orders.totalCount}건</Text>
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} md={8} lg={8} xl={8}>
            <Card>
              <Statistic
                title="재고 관리"
                value={stats.inventory.totalItems}
                suffix="개 품목"
                prefix={<InboxOutlined />}
                valueStyle={{ color: stats.inventory.lowStockCount > 0 ? '#ff4d4f' : '#52c41a' }}
              />
              <div style={{ marginTop: 16 }}>
                <Text type={stats.inventory.lowStockCount > 0 ? 'danger' : 'secondary'}>
                  <WarningOutlined /> 재고부족: {stats.inventory.lowStockCount}개
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">💰 거래 및 지출 분석</Divider>

        {/* 거래처별 분석 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={24}>
            <Card title="거래처별 지출 현황">
              <Row gutter={16}>
                <Col xs={24} sm={8}>
                  <Card>
                    <Statistic
                      title="우유"
                      value={stats.transactionsByClient.milk}
                      suffix="원"
                      valueStyle={{ color: '#1890ff' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        {stats.currentMonth.transactions > 0
                          ? `전체의 ${((stats.transactionsByClient.milk / stats.currentMonth.transactions) * 100).toFixed(1)}%`
                          : '0%'}
                      </Text>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card>
                    <Statistic
                      title="원두"
                      value={stats.transactionsByClient.coffee}
                      suffix="원"
                      valueStyle={{ color: '#52c41a' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        {stats.currentMonth.transactions > 0
                          ? `전체의 ${((stats.transactionsByClient.coffee / stats.currentMonth.transactions) * 100).toFixed(1)}%`
                          : '0%'}
                      </Text>
                    </div>
                  </Card>
                </Col>
                <Col xs={24} sm={8}>
                  <Card>
                    <Statistic
                      title="아싸컴퍼니"
                      value={stats.transactionsByClient.assa}
                      suffix="원"
                      valueStyle={{ color: '#faad14' }}
                    />
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">
                        {stats.currentMonth.transactions > 0
                          ? `전체의 ${((stats.transactionsByClient.assa / stats.currentMonth.transactions) * 100).toFixed(1)}%`
                          : '0%'}
                      </Text>
                    </div>
                  </Card>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Divider orientation="left">📦 발주 및 재고 분석</Divider>

        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {/* 발주 TOP 5 */}
          <Col xs={24} lg={12}>
            <Card title="📊 발주 TOP 5">
              <Table
                dataSource={stats.orders.topItems}
                columns={orderItemColumns}
                rowKey="item_name"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>

          {/* 법인카드 상위 가맹점 */}
          <Col xs={24} lg={12}>
            <Card title="💳 법인카드 상위 가맹점 (TOP 10)">
              <Table
                dataSource={stats.expensesByMerchant}
                columns={merchantColumns}
                rowKey="merchant"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>

        {/* 매장별 비교 */}
        {!selectedStore && (
          <>
            <Divider orientation="left">🏪 매장별 비교</Divider>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    title="큰길"
                    value={stats.storeComparison.큰길.transactions + stats.storeComparison.큰길.expenses}
                    suffix="원"
                    valueStyle={{ color: '#1890ff' }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">거래금액: {stats.storeComparison.큰길.transactions.toLocaleString()}원</Text>
                    <br />
                    <Text type="secondary">법인카드: {stats.storeComparison.큰길.expenses.toLocaleString()}원</Text>
                  </div>
                </Card>
              </Col>
              <Col xs={24} sm={12}>
                <Card>
                  <Statistic
                    title="태광"
                    value={stats.storeComparison.태광.transactions + stats.storeComparison.태광.expenses}
                    suffix="원"
                    valueStyle={{ color: '#52c41a' }}
                  />
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">거래금액: {stats.storeComparison.태광.transactions.toLocaleString()}원</Text>
                    <br />
                    <Text type="secondary">법인카드: {stats.storeComparison.태광.expenses.toLocaleString()}원</Text>
                  </div>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
};

export default DashboardPage;
