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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { expensesAPI } from '../services/api';

const { Text } = Typography;

const ExpensesPage = () => {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [summary, setSummary] = useState({ total: 0, categories: [] });
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [merchantList, setMerchantList] = useState([]);

  useEffect(() => {
    // selectedMonth가 변경되면 필터에 자동 반영
    const newFilters = { ...filters, month: selectedMonth };
    if (JSON.stringify(newFilters) !== JSON.stringify(filters)) {
      setFilters(newFilters);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchExpenses();
    fetchSummary();
  }, [pagination.current, filters]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const response = await expensesAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
      });
      setExpenses(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
      }));

      // 전체 데이터에서 가맹점 목록 및 총 지출 계산 (페이지네이션 무시)
      const allDataResponse = await expensesAPI.getAll({
        page: 1,
        limit: 10000,
        month: filters.month,
        store: filters.store,
      });
      const allData = allDataResponse.data.data;
      const merchants = [...new Set(allData.map(item => item.merchant_name).filter(Boolean))];
      setMerchantList(merchants.sort());

      // 총 지출 계산
      const total = allData.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
      setSummary(prev => ({ ...prev, total: Math.round(total) }));
    } catch (error) {
      message.error('법인카드 내역을 불러오는데 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await expensesAPI.getSummary(
        selectedMonth,
        filters.store ? { store: filters.store } : {}
      );

      // merchants 배열의 금액을 숫자로 변환
      const summary = {
        ...response.data,
        merchants: response.data.merchants?.map(m => ({
          ...m,
          total_amount: Math.round(parseFloat(m.total_amount) || 0)
        })) || []
      };

      setSummary(summary);
    } catch (error) {
      console.error('요약 정보 조회 실패:', error);
    }
  };

  const handleAdd = () => {
    setEditingExpense(null);
    form.resetFields();
    form.setFieldsValue({
      store: '큰길',
      use_date: dayjs(),
      month: dayjs().format('YYYY-MM'),
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingExpense(record);
    form.setFieldsValue({
      ...record,
      use_date: dayjs(record.use_date),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await expensesAPI.delete(id);
      message.success('법인카드 내역이 삭제되었습니다.');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== id));
      fetchExpenses();
      fetchSummary();
    } catch (error) {
      message.error('법인카드 내역 삭제에 실패했습니다.');
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
        await expensesAPI.delete(id);
      }
      message.success(`${selectedRowKeys.length}개 항목이 삭제되었습니다.`);
      setSelectedRowKeys([]);
      fetchExpenses();
      fetchSummary();
    } catch (error) {
      message.error('일괄 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        use_date: values.use_date.format('YYYY-MM-DD'),
        month: values.use_date.format('YYYY-MM'),
      };

      if (editingExpense) {
        await expensesAPI.update(editingExpense.id, data);
        message.success('법인카드 내역이 수정되었습니다.');
      } else {
        await expensesAPI.create(data);
        message.success('법인카드 내역이 등록되었습니다.');
      }

      setModalVisible(false);
      fetchExpenses();
      fetchSummary();
    } catch (error) {
      message.error('법인카드 내역 저장에 실패했습니다.');
      console.error(error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await expensesAPI.export(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `법인카드내역_${dayjs().format('YYYYMMDD')}.xlsx`);
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
      title: '법인카드 엑셀 임포트',
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
          <p style={{ color: '#888', fontSize: 12 }}>
            ※ 엑셀 파일의 각 시트(26.06, 25.12 등)에서 자동으로 월을 추출합니다.
          </p>
        </div>
      ),
      okText: '임포트',
      cancelText: '취소',
      onOk: async () => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('store', selectedStore);
        formData.append('month', selectedMonth); // 백엔드에서 사용 안함 (시트별 월 사용)

        try {
          await expensesAPI.import(formData);
          message.success('엑셀 파일을 성공적으로 임포트했습니다.');
          fetchExpenses();
          fetchSummary();
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
      title: '사용일자',
      dataIndex: 'use_date',
      key: 'use_date',
      width: 110,
      sorter: true,
      render: (value) => {
        if (!value) return '';
        const dateStr = typeof value === 'string' ? value : value.toISOString();
        return dateStr.split('T')[0];
      },
    },
    {
      title: '월',
      dataIndex: 'month',
      key: 'month',
      width: 100,
    },
    {
      title: '매장',
      dataIndex: 'store',
      key: 'store',
      width: 70,
    },
    {
      title: '가맹점(사용처)',
      dataIndex: 'merchant_name',
      key: 'merchant_name',
      width: 150,
      ellipsis: true,
    },
    {
      title: '분류',
      dataIndex: 'category',
      key: 'category',
      width: 130,
      ellipsis: true,
    },
    {
      title: '내용',
      dataIndex: 'notes',
      key: 'notes',
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
          <Text strong style={{ color: amount < 0 ? '#52c41a' : '#ff4d4f' }}>
            {amount.toLocaleString()}원
          </Text>
        );
      },
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
        title="🔍 법인카드 필터"
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
                const newMonth = date.format('YYYY-MM');
                setSelectedMonth(newMonth);
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
            <Text strong style={{ marginRight: 8 }}>가맹점:</Text>
            <Select
              style={{ width: 180 }}
              placeholder="가맹점 선택"
              value={filters.merchant_name || undefined}
              onChange={(value) => {
                const newFilters = { ...filters };
                if (value) {
                  newFilters.merchant_name = value;
                } else {
                  delete newFilters.merchant_name;
                }
                setFilters(newFilters);
              }}
              allowClear
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {merchantList.map(merchant => (
                <Select.Option key={merchant} value={merchant}>
                  {merchant}
                </Select.Option>
              ))}
            </Select>
          </div>

          <Button
            type="primary"
            onClick={() => {
              const today = dayjs().format('YYYY-MM');
              setSelectedMonth(today);
              setFilters({ month: today });
            }}
          >
            🔄 필터 초기화
          </Button>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title={`${selectedMonth} ${filters.store ? filters.store + ' ' : ''}총 지출`}
              value={summary.total}
              suffix="원"
              prefix={<CreditCardOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="가맹점 수"
              value={summary.categories?.length || 0}
              suffix="개"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="전체 항목 수"
              value={pagination.total}
              suffix="건"
            />
          </Card>
        </Col>
      </Row>

      {summary.merchants && summary.merchants.length > 0 && (
        <Card title="가맹점별 지출" style={{ marginBottom: 16 }} size="small">
          <Row gutter={16}>
            {summary.merchants.map((merchant) => (
              <Col span={6} key={merchant.merchant_name}>
                <Statistic
                  title={merchant.merchant_name}
                  value={merchant.total_amount}
                  suffix="원"
                  valueStyle={{ fontSize: 16 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {merchant.count}건
                </Text>
              </Col>
            ))}
          </Row>
        </Card>
      )}

      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          법인카드 내역 등록
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
            const allKeys = expenses.map(item => item.id);
            setSelectedRowKeys(allKeys);
          }}
          disabled={expenses.length === 0}
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
          title="정말 모든 법인카드 내역을 삭제하시겠습니까?"
          description="이 작업은 되돌릴 수 없습니다!"
          onConfirm={async () => {
            try {
              // 전체 데이터 가져오기
              const response = await expensesAPI.getAll({ page: 1, limit: 10000 });
              const allExpenses = response.data.data;

              // 모두 삭제
              for (const expense of allExpenses) {
                await expensesAPI.delete(expense.id);
              }

              message.success(`${allExpenses.length}개 항목이 모두 삭제되었습니다.`);
              setSelectedRowKeys([]);
              fetchExpenses();
              fetchSummary();
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
        dataSource={expenses}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        rowSelection={rowSelection}
        onChange={(newPagination, filters) => {
          setPagination(newPagination);
          setFilters(filters);
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title={editingExpense ? '법인카드 내역 수정' : '법인카드 내역 등록'}
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
                name="use_date"
                label="사용일자"
                rules={[{ required: true, message: '사용일자를 선택하세요' }]}
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
            name="category"
            label="카테고리"
            rules={[{ required: true, message: '카테고리를 선택하세요' }]}
          >
            <Select>
              <Select.Option value="소모품">소모품</Select.Option>
              <Select.Option value="부재료">부재료</Select.Option>
              <Select.Option value="디저트">디저트</Select.Option>
              <Select.Option value="멜론">멜론</Select.Option>
              <Select.Option value="이벤트">이벤트</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="내용"
            rules={[{ required: true, message: '내용을 입력하세요' }]}
          >
            <Input placeholder="지출 내용" />
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
                <Input placeholder="법인카드, 현금 등" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="추가 메모" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ExpensesPage;
