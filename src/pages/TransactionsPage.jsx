import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
  Select,
  message,
  Upload,
  Popconfirm,
  Card,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { transactionsAPI } from '../services/api';

const { Text } = Typography;

const TransactionsPage = () => {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedClient, setSelectedClient] = useState('우유'); // 선택된 거래처
  const [priceSettingVisible, setPriceSettingVisible] = useState(false); // 단가 설정 모달
  const [priceForm] = Form.useForm();
  const [manualAmountMode, setManualAmountMode] = useState(false); // 수기 금액 입력 모드

  // 기본 단가 설정 (localStorage에서 불러오기)
  const getDefaultPrices = () => {
    const saved = localStorage.getItem('milkPrices');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      우유: 2300,
      락토프리: 2950,
      휘핑크림: 10500,
    };
  };

  const [defaultPrices, setDefaultPrices] = useState(getDefaultPrices());

  const [stats, setStats] = useState({
    milk: 0,
    coffee: 0,
    assa: 0,
    gs: 0,
    bakery: 0,
    total: 0,
  });

  useEffect(() => {
    // selectedMonth가 변경되면 필터에 자동 반영
    const newFilters = { ...filters, month: selectedMonth };
    // startDate, endDate 제거 (transaction_month 사용)
    delete newFilters.startDate;
    delete newFilters.endDate;

    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchTransactions();
  }, [pagination.current, filters]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const response = await transactionsAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
      });
      setTransactions(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
      }));

      const milk = Math.round(response.data.data
        .filter(t => t.client === '우유')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0));
      const coffee = Math.round(response.data.data
        .filter(t => t.client === '원두')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0));
      const assa = Math.round(response.data.data
        .filter(t => t.client === '아싸컴퍼니')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0));
      const gs = Math.round(response.data.data
        .filter(t => t.client === 'GS 리테일')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0));
      const bakery = Math.round(response.data.data
        .filter(t => t.client === '베이커리(하이푸디)')
        .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0));

      setStats({
        milk,
        coffee,
        assa,
        gs,
        bakery,
        total: milk + coffee + assa + gs + bakery,
      });
    } catch (error) {
      message.error('거래 내역을 불러오는데 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingTransaction(null);
    setSelectedClient('우유');
    setManualAmountMode('batch'); // 일괄 입력이 기본값
    form.resetFields();
    form.setFieldsValue({
      store: '큰길',
      transaction_date: dayjs(selectedMonth + '-01'), // 선택된 월의 1일로 설정
      client: '우유',
      milk_quantity: 0,
      lacto_quantity: 0,
      cream_quantity: 0,
      amount: 0
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingTransaction(record);
    form.setFieldsValue({
      ...record,
      transaction_date: dayjs(record.transaction_date),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await transactionsAPI.delete(id);
      message.success('거래 내역이 삭제되었습니다.');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== id));
      fetchTransactions();
    } catch (error) {
      message.error('거래 내역 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('삭제할 항목을 선택하세요.');
      return;
    }

    try {
      for (const id of selectedRowKeys) {
        await transactionsAPI.delete(id);
      }
      message.success(`${selectedRowKeys.length}개 항목이 삭제되었습니다.`);
      setSelectedRowKeys([]);
      fetchTransactions();
    } catch (error) {
      message.error('일괄 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      // 우유 거래처인 경우 description 자동 생성
      let description = values.description || '';
      if (values.client === '우유' && values.item_name && values.quantity) {
        description = `${values.item_name} ${values.quantity}개`;
      }

      // transaction_month 제외하고 필드 추출
      const { transaction_month, ...restValues } = values;

      const data = {
        ...restValues,
        transaction_date: values.transaction_date.format('YYYY-MM-DD'),
        description,
      };

      // 디버깅: 전송할 데이터 확인
      console.log('🔍 전송할 데이터:', data);
      console.log('🚫 transaction_month:', transaction_month);

      if (editingTransaction) {
        await transactionsAPI.update(editingTransaction.id, data);
        message.success('거래 내역이 수정되었습니다.');
      } else {
        await transactionsAPI.create(data);
        message.success('거래 내역이 등록되었습니다.');
      }

      setModalVisible(false);
      fetchTransactions();
    } catch (error) {
      message.error('거래 내역 저장에 실패했습니다.');
      console.error(error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await transactionsAPI.export(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `거래내역_${dayjs().format('YYYYMMDD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      message.error('엑셀 다운로드에 실패했습니다.');
      console.error(error);
    }
  };

  const handleImport = async (file) => {
    let selectedStore = '큰길';

    // 임포트 전에 매장 선택하도록 모달 표시
    Modal.confirm({
      title: '세금계산서 발행(거래내역) 엑셀 임포트',
      content: (
        <div>
          <p style={{ marginBottom: 12 }}>파일: <strong>{file.name}</strong></p>
          <div style={{ marginBottom: 12 }}>
            <Text strong>매장 선택:</Text>
            <Select
              defaultValue="큰길"
              style={{ width: 120, marginLeft: 8 }}
              onChange={(value) => { selectedStore = value; }}
            >
              <Select.Option value="큰길">큰길</Select.Option>
              <Select.Option value="태광">태광</Select.Option>
            </Select>
          </div>
        </div>
      ),
      okText: '임포트',
      cancelText: '취소',
      onOk: async () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('store', selectedStore);

        try {
          await transactionsAPI.import(formData);
          message.success('엑셀 파일을 성공적으로 임포트했습니다.');
          fetchTransactions();
        } catch (error) {
          message.error('엑셀 임포트에 실패했습니다.');
          console.error(error);
        }
      }
    });
    return false;
  };

  const columns = [
    {
      title: '거래일자',
      dataIndex: 'transaction_date',
      key: 'transaction_date',
      width: 110,
      sorter: true,
      render: (value) => {
        if (!value) return '';
        const dateStr = typeof value === 'string' ? value : value.toISOString();
        return dateStr.split('T')[0];
      },
    },
    {
      title: '매장',
      dataIndex: 'store',
      key: 'store',
      width: 70,
    },
    {
      title: '거래처',
      dataIndex: 'client',
      key: 'client',
      width: 120,
      render: (client) => {
        const colorMap = {
          '우유': 'blue',
          '원두': 'green',
          '아싸컴퍼니': 'orange',
          'GS 리테일': 'purple',
          '베이커리(하이푸디)': 'magenta',
        };
        return <Tag color={colorMap[client] || 'default'}>{client}</Tag>;
      },
    },
    {
      title: '내용',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
    },
    {
      title: '금액',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (value) => {
        const amount = Math.round(parseFloat(value) || 0);
        return (
          <Text strong style={{ color: '#ff4d4f' }}>
            {amount.toLocaleString()}원
          </Text>
        );
      },
    },
    {
      title: '결제수단',
      dataIndex: 'payment_method',
      key: 'payment_method',
      width: 100,
    },
    {
      title: '비고',
      dataIndex: 'notes',
      key: 'notes',
      width: 120,
      ellipsis: true,
    },
    {
      title: '작업',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            수정
          </Button>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDelete(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  return (
    <div>
      <Card
        title="🔍 세금계산서 발행(거래내역) 필터"
        size="small"
        style={{
          marginBottom: 16,
          border: '2px solid #1890ff',
          background: '#f0f5ff'
        }}
      >
        <Space wrap size="large">
          <div>
            <Text strong style={{ marginRight: 8 }}>월 선택:</Text>
            <DatePicker
              picker="month"
              value={dayjs(selectedMonth)}
              onChange={(date) => {
                setSelectedMonth(date.format('YYYY-MM'));
              }}
              style={{ width: 150 }}
            />
          </div>

          <div>
            <Text strong style={{ marginRight: 8 }}>매장:</Text>
            <Select
              style={{ width: 120 }}
              placeholder="매장 선택"
              value={filters.store || undefined}
              onChange={(value) => {
                const newFilters = { ...filters };
                if (value) {
                  newFilters.store = value;
                } else {
                  delete newFilters.store;
                }
                setFilters(newFilters);
              }}
              allowClear
            >
              <Select.Option value="큰길">큰길</Select.Option>
              <Select.Option value="태광">태광</Select.Option>
            </Select>
          </div>

          <div>
            <Text strong style={{ marginRight: 8 }}>거래처:</Text>
            <Select
              style={{ width: 120 }}
              placeholder="거래처 선택"
              value={filters.client || undefined}
              onChange={(value) => {
                const newFilters = { ...filters };
                if (value) {
                  newFilters.client = value;
                } else {
                  delete newFilters.client;
                }
                setFilters(newFilters);
              }}
              allowClear
            >
              <Select.Option value="우유">우유</Select.Option>
              <Select.Option value="원두">원두</Select.Option>
              <Select.Option value="아싸컴퍼니">아싸컴퍼니</Select.Option>
              <Select.Option value="GS 리테일">GS 리테일</Select.Option>
              <Select.Option value="베이커리(하이푸디)">베이커리(하이푸디)</Select.Option>
            </Select>
          </div>

          <Button
            type="primary"
            onClick={() => {
              const today = dayjs().format('YYYY-MM');
              setSelectedMonth(today);
              setFilters({});
            }}
          >
            🔄 필터 초기화
          </Button>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="우유"
              value={stats.milk}
              suffix="원"
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="원두"
              value={stats.coffee}
              suffix="원"
              valueStyle={{ color: '#52c41a' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="아싸컴퍼니"
              value={stats.assa}
              suffix="원"
              valueStyle={{ color: '#faad14' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="GS 리테일"
              value={stats.gs}
              suffix="원"
              valueStyle={{ color: '#722ed1' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="베이커리(하이푸디)"
              value={stats.bakery}
              suffix="원"
              valueStyle={{ color: '#eb2f96' }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title={`${selectedMonth} 전체 합계 ${filters.store ? `(${filters.store})` : ''}`}
              value={stats.total}
              suffix="원"
              valueStyle={{ color: '#ff4d4f', fontWeight: 'bold', fontSize: 24 }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="default"
          onClick={() => {
            priceForm.setFieldsValue(defaultPrices);
            setPriceSettingVisible(true);
          }}
        >
          ⚙️ 우유 단가 설정
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          거래 등록
        </Button>
        <Upload
          beforeUpload={handleImport}
          accept=".xlsx,.xls"
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>엑셀 임포트</Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          엑셀 다운로드
        </Button>
        <Button
          onClick={() => {
            const allKeys = transactions.map(item => item.id);
            setSelectedRowKeys(allKeys);
          }}
          disabled={transactions.length === 0}
        >
          전체 선택
        </Button>
        {selectedRowKeys.length > 0 && (
          <Popconfirm
            title={`선택한 ${selectedRowKeys.length}개 항목을 삭제하시겠습니까?`}
            onConfirm={handleBulkDelete}
            okText="예"
            cancelText="아니오"
          >
            <Button danger icon={<DeleteOutlined />}>
              선택 삭제 ({selectedRowKeys.length})
            </Button>
          </Popconfirm>
        )}
        <Popconfirm
          title="정말 모든 거래 내역을 삭제하시겠습니까?"
          description="이 작업은 되돌릴 수 없습니다!"
          onConfirm={async () => {
            try {
              // 전체 데이터 가져오기
              const response = await transactionsAPI.getAll({ page: 1, limit: 10000 });
              const allTransactions = response.data.data;

              // 모두 삭제
              for (const transaction of allTransactions) {
                await transactionsAPI.delete(transaction.id);
              }

              message.success(`${allTransactions.length}개 항목이 모두 삭제되었습니다.`);
              setSelectedRowKeys([]);
              fetchTransactions();
            } catch (error) {
              message.error('전체 삭제에 실패했습니다.');
              console.error(error);
            }
          }}
          okText="예, 모두 삭제"
          cancelText="취소"
          okButtonProps={{ danger: true }}
        >
          <Button danger type="primary" icon={<DeleteOutlined />}>
            🗑️ 전체 삭제
          </Button>
        </Popconfirm>
      </Space>

      <Table
        columns={columns}
        dataSource={transactions}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        rowSelection={rowSelection}
        onChange={(newPagination, filters) => {
          setPagination(newPagination);
          setFilters(filters);
        }}
        scroll={{ x: 1300 }}
      />

      <Modal
        title={editingTransaction ? '거래 내역 수정' : '거래 내역 등록'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="transaction_date"
                label="거래일자"
                rules={[{ required: true, message: '거래일자를 선택하세요' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="store"
                label="매장"
                rules={[{ required: true, message: '매장을 선택하세요' }]}
              >
                <Select>
                  <Select.Option value="큰길">큰길</Select.Option>
                  <Select.Option value="태광">태광</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="client"
            label="거래처"
            rules={[{ required: true, message: '거래처를 선택하세요' }]}
          >
            <Select onChange={(value) => setSelectedClient(value)}>
              <Select.Option value="우유">우유</Select.Option>
              <Select.Option value="원두">원두</Select.Option>
              <Select.Option value="아싸컴퍼니">아싸컴퍼니</Select.Option>
              <Select.Option value="GS 리테일">GS 리테일</Select.Option>
              <Select.Option value="베이커리(하이푸디)">베이커리(하이푸디)</Select.Option>
            </Select>
          </Form.Item>

          {selectedClient === '우유' && (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Button
                  type={manualAmountMode === 'batch' ? 'primary' : 'default'}
                  size="small"
                  onClick={() => {
                    setManualAmountMode('batch');
                    form.setFieldsValue({
                      milk_quantity: 0,
                      lacto_quantity: 0,
                      cream_quantity: 0,
                      amount: 0
                    });
                  }}
                >
                  일괄 입력 (우유+락토프리+휘핑크림)
                </Button>
                <Button
                  type={manualAmountMode === 'auto' ? 'primary' : 'default'}
                  size="small"
                  onClick={() => {
                    setManualAmountMode('auto');
                    form.setFieldsValue({ amount: undefined });
                  }}
                >
                  개별 입력
                </Button>
                <Button
                  type={manualAmountMode === 'manual' ? 'primary' : 'default'}
                  size="small"
                  onClick={() => {
                    setManualAmountMode('manual');
                    form.setFieldsValue({
                      item_name: undefined,
                      quantity: undefined,
                      unit_price: undefined,
                      amount: undefined
                    });
                  }}
                >
                  토탈 금액만 입력
                </Button>
              </Space>

              {manualAmountMode === 'auto' ? (
                <>
                  <Form.Item
                    name="item_name"
                    label="품목"
                    rules={[{ required: true, message: '품목을 선택하세요' }]}
                  >
                    <Select
                      onChange={(value) => {
                        // 품목 선택시 기본 단가 자동 입력
                        form.setFieldsValue({ unit_price: defaultPrices[value] });
                        const quantity = form.getFieldValue('quantity');
                        if (quantity) {
                          form.setFieldsValue({ amount: quantity * defaultPrices[value] });
                        }
                      }}
                    >
                      <Select.Option value="우유">우유 ({defaultPrices['우유'].toLocaleString()}원)</Select.Option>
                      <Select.Option value="락토프리">락토프리 ({defaultPrices['락토프리'].toLocaleString()}원)</Select.Option>
                      <Select.Option value="휘핑크림">휘핑크림 ({defaultPrices['휘핑크림'].toLocaleString()}원)</Select.Option>
                    </Select>
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="quantity"
                        label="수량"
                        rules={[{ required: true, message: '수량을 입력하세요' }]}
                      >
                        <InputNumber
                          min={1}
                          style={{ width: '100%' }}
                          placeholder="0"
                          onChange={() => {
                            const quantity = form.getFieldValue('quantity');
                            const unit_price = form.getFieldValue('unit_price');
                            if (quantity && unit_price) {
                              form.setFieldsValue({ amount: quantity * unit_price });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="unit_price"
                        label="단가"
                        rules={[{ required: true, message: '단가를 입력하세요' }]}
                      >
                        <InputNumber
                          min={0}
                          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/,/g, '')}
                          style={{ width: '100%' }}
                          placeholder="0"
                          onChange={() => {
                            const quantity = form.getFieldValue('quantity');
                            const unit_price = form.getFieldValue('unit_price');
                            if (quantity && unit_price) {
                              form.setFieldsValue({ amount: quantity * unit_price });
                            }
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="amount"
                        label="금액"
                      >
                        <InputNumber
                          disabled
                          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/,/g, '')}
                          style={{ width: '100%' }}
                          placeholder="0"
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ) : manualAmountMode === 'batch' ? (
                <>
                  <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
                    <Text type="secondary">각 품목의 수량을 입력하면 자동으로 금액이 계산됩니다</Text>
                  </Card>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name="milk_quantity"
                        label={`우유 (${defaultPrices['우유'].toLocaleString()}원)`}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="수량"
                          onChange={() => {
                            const milk = form.getFieldValue('milk_quantity') || 0;
                            const lacto = form.getFieldValue('lacto_quantity') || 0;
                            const cream = form.getFieldValue('cream_quantity') || 0;
                            const total = (milk * defaultPrices['우유']) + (lacto * defaultPrices['락토프리']) + (cream * defaultPrices['휘핑크림']);
                            form.setFieldsValue({ amount: total });
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="lacto_quantity"
                        label={`락토프리 (${defaultPrices['락토프리'].toLocaleString()}원)`}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="수량"
                          onChange={() => {
                            const milk = form.getFieldValue('milk_quantity') || 0;
                            const lacto = form.getFieldValue('lacto_quantity') || 0;
                            const cream = form.getFieldValue('cream_quantity') || 0;
                            const total = (milk * defaultPrices['우유']) + (lacto * defaultPrices['락토프리']) + (cream * defaultPrices['휘핑크림']);
                            form.setFieldsValue({ amount: total });
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name="cream_quantity"
                        label={`휘핑크림 (${defaultPrices['휘핑크림'].toLocaleString()}원)`}
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="수량"
                          onChange={() => {
                            const milk = form.getFieldValue('milk_quantity') || 0;
                            const lacto = form.getFieldValue('lacto_quantity') || 0;
                            const cream = form.getFieldValue('cream_quantity') || 0;
                            const total = (milk * defaultPrices['우유']) + (lacto * defaultPrices['락토프리']) + (cream * defaultPrices['휘핑크림']);
                            form.setFieldsValue({ amount: total });
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="amount"
                    label="토탈 금액"
                  >
                    <InputNumber
                      disabled
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/,/g, '')}
                      style={{ width: '100%' }}
                      placeholder="0"
                    />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item
                    name="product_name"
                    label="품목/내용"
                  >
                    <Input placeholder="예: 우유 토탈" />
                  </Form.Item>

                  <Form.Item
                    name="amount"
                    label="토탈 금액"
                    rules={[{ required: true, message: '금액을 입력하세요' }]}
                  >
                    <InputNumber
                      min={0}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/,/g, '')}
                      style={{ width: '100%' }}
                      placeholder="0"
                    />
                  </Form.Item>
                </>
              )}
            </>
          )}

          {selectedClient === '아싸컴퍼니' && (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Button
                  type={manualAmountMode === 'auto' ? 'primary' : 'default'}
                  size="small"
                  onClick={() => {
                    setManualAmountMode('auto');
                    form.setFieldsValue({ amount: undefined });
                  }}
                >
                  개별 입력
                </Button>
                <Button
                  type={manualAmountMode === 'batch_assa' ? 'primary' : 'default'}
                  size="small"
                  onClick={() => {
                    setManualAmountMode('batch_assa');
                    form.setFieldsValue({
                      supplies_amount: 0,
                      ingredients_amount: 0,
                      amount: 0
                    });
                  }}
                >
                  소모품 + 식재료 일괄 입력
                </Button>
              </Space>

              {manualAmountMode === 'auto' ? (
                <>
                  <Form.Item
                    name="description"
                    label="내용"
                  >
                    <Input placeholder="거래 내용" />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="amount"
                        label="금액"
                        rules={[{ required: true, message: '금액을 입력하세요' }]}
                      >
                        <InputNumber
                          min={0}
                          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/,/g, '')}
                          style={{ width: '100%' }}
                          placeholder="0"
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="payment_method" label="결제수단">
                        <Input placeholder="현금, 계좌이체, 카드 등" />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ) : (
                <>
                  <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
                    <Text type="secondary">소모품과 식재료 금액을 입력하면 자동으로 합계가 계산됩니다</Text>
                  </Card>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="supplies_amount"
                        label="소모품 금액"
                      >
                        <InputNumber
                          min={0}
                          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/,/g, '')}
                          style={{ width: '100%' }}
                          placeholder="0"
                          onChange={() => {
                            const supplies = form.getFieldValue('supplies_amount') || 0;
                            const ingredients = form.getFieldValue('ingredients_amount') || 0;
                            form.setFieldsValue({ amount: supplies + ingredients });
                          }}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="ingredients_amount"
                        label="식재료 금액"
                      >
                        <InputNumber
                          min={0}
                          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/,/g, '')}
                          style={{ width: '100%' }}
                          placeholder="0"
                          onChange={() => {
                            const supplies = form.getFieldValue('supplies_amount') || 0;
                            const ingredients = form.getFieldValue('ingredients_amount') || 0;
                            form.setFieldsValue({ amount: supplies + ingredients });
                          }}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="amount"
                    label="토탈 금액"
                  >
                    <InputNumber
                      disabled
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/,/g, '')}
                      style={{ width: '100%' }}
                      placeholder="0"
                    />
                  </Form.Item>

                  <Form.Item
                    name="description"
                    label="내용"
                  >
                    <Input placeholder="예: 소모품 + 식재료" defaultValue="소모품 + 식재료" />
                  </Form.Item>
                </>
              )}
            </>
          )}

          {selectedClient !== '우유' && selectedClient !== '아싸컴퍼니' && (
            <>
              <Form.Item
                name="description"
                label="내용"
              >
                <Input placeholder="거래 내용" />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="amount"
                    label="금액"
                    rules={[{ required: true, message: '금액을 입력하세요' }]}
                  >
                    <InputNumber
                      min={0}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/,/g, '')}
                      style={{ width: '100%' }}
                      placeholder="0"
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="payment_method" label="결제수단">
                    <Input placeholder="현금, 계좌이체, 카드 등" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="추가 메모" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 우유 단가 설정 모달 */}
      <Modal
        title="⚙️ 우유 품목별 기본 단가 설정"
        open={priceSettingVisible}
        onCancel={() => setPriceSettingVisible(false)}
        onOk={() => {
          const values = priceForm.getFieldsValue();
          setDefaultPrices(values);
          localStorage.setItem('milkPrices', JSON.stringify(values));
          message.success('기본 단가가 저장되었습니다.');
          setPriceSettingVisible(false);
        }}
        width={400}
      >
        <Form
          form={priceForm}
          layout="vertical"
        >
          <Form.Item
            name="우유"
            label="우유 (기본 단가)"
            rules={[{ required: true, message: '우유 단가를 입력하세요' }]}
          >
            <InputNumber
              min={0}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/,/g, '')}
              style={{ width: '100%' }}
              placeholder="2300"
              addonAfter="원"
            />
          </Form.Item>

          <Form.Item
            name="락토프리"
            label="락토프리 (기본 단가)"
            rules={[{ required: true, message: '락토프리 단가를 입력하세요' }]}
          >
            <InputNumber
              min={0}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/,/g, '')}
              style={{ width: '100%' }}
              placeholder="2950"
              addonAfter="원"
            />
          </Form.Item>

          <Form.Item
            name="휘핑크림"
            label="휘핑크림 (기본 단가)"
            rules={[{ required: true, message: '휘핑크림 단가를 입력하세요' }]}
          >
            <InputNumber
              min={0}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/,/g, '')}
              style={{ width: '100%' }}
              placeholder="10500"
              addonAfter="원"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TransactionsPage;
