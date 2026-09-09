import { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Popconfirm,
  Card,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Tooltip,
  Checkbox,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MinusCircleOutlined,
  CoffeeOutlined,
} from '@ant-design/icons';
import { menuPricesAPI } from '../services/api';

const { Text } = Typography;

const CATEGORY_OPTIONS = ['커피', '음료', '에이드', '티', '블랜디드', '시즌음료', '기타'];

const formatWon = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${Math.round(value).toLocaleString()}원`;
};

// 레시피의 투입원가를 합산해 옵션별 원가를 계산 (백엔드 computeCostVariants와 동일한 로직)
const computeCostVariantsPreview = (recipe) => {
  const items = Array.isArray(recipe) ? recipe : [];
  const labels = [];
  for (const item of items) {
    if (item && item.variantLabel && !labels.includes(item.variantLabel)) {
      labels.push(item.variantLabel);
    }
  }
  const commonCost = items
    .filter((item) => item && !item.variantLabel)
    .reduce((sum, item) => sum + (parseFloat(item.inputCost) || 0), 0);

  if (labels.length === 0) {
    return [{ label: null, cost: commonCost }];
  }
  return labels.map((label) => {
    const optionCost = items
      .filter((item) => item && item.variantLabel === label)
      .reduce((sum, item) => sum + (parseFloat(item.inputCost) || 0), 0);
    return { label, cost: commonCost + optionCost };
  });
};

const MenuPricingPage = () => {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await menuPricesAPI.getAll();
      setItems(response.data);
    } catch (error) {
      message.error('메뉴 단가 목록을 불러오는데 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (categoryFilter && item.category !== categoryFilter) return false;
      if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }, [items, categoryFilter, searchText]);

  const summary = useMemo(() => {
    const total = items.length;
    const missingPrice = items.filter((item) => item.selling_price === null || item.selling_price === undefined).length;
    const withMargin = items.filter((item) => item.selling_price !== null && item.selling_price !== undefined && item.cost !== null);
    const avgMargin = withMargin.length
      ? withMargin.reduce((sum, item) => sum + (item.selling_price - item.cost), 0) / withMargin.length
      : 0;
    const categories = new Set(items.map((item) => item.category)).size;
    return { total, missingPrice, avgMargin, categories };
  }, [items]);

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({
      category: '커피',
      cost_variants: [{ label: '', cost: 0 }],
      recipe: [],
      auto_cost: true, // 새 메뉴는 레시피 기반 자동 계산을 기본값으로
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    form.setFieldsValue({
      category: record.category,
      name: record.name,
      selling_price: record.selling_price,
      notes: record.notes,
      cost_variants: record.cost_variants && record.cost_variants.length > 0
        ? record.cost_variants
        : [{ label: '', cost: record.cost || 0 }],
      recipe: record.recipe || [],
      // 기존 메뉴는 엑셀 원본 원가를 그대로 유지 (직접 켜기 전까지는 자동 계산 안 함)
      auto_cost: !!record.auto_cost,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await menuPricesAPI.delete(id);
      message.success('메뉴 단가가 삭제되었습니다.');
      fetchItems();
    } catch (error) {
      message.error('삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        category: values.category,
        name: values.name,
        selling_price: values.selling_price,
        notes: values.notes || '',
        auto_cost: !!values.auto_cost,
        cost_variants: (values.cost_variants || [])
          .filter((v) => v && v.cost !== undefined && v.cost !== null)
          .map((v) => ({ label: v.label || null, cost: parseFloat(v.cost) })),
        recipe: (values.recipe || [])
          .filter((r) => r && r.name)
          .map((r) => ({
            name: r.name,
            isDisposable: !!r.isDisposable,
            variantLabel: r.variantLabel || null,
            volume: r.volume !== undefined && r.volume !== null && r.volume !== '' ? parseFloat(r.volume) : null,
            unit: r.unit || null,
            price: r.price !== undefined && r.price !== null && r.price !== '' ? parseFloat(r.price) : null,
            unitPrice: r.unitPrice !== undefined && r.unitPrice !== null && r.unitPrice !== '' ? parseFloat(r.unitPrice) : null,
            inputAmount: r.inputAmount !== undefined && r.inputAmount !== null && r.inputAmount !== '' ? parseFloat(r.inputAmount) : null,
            inputCost: r.inputCost !== undefined && r.inputCost !== null && r.inputCost !== '' ? parseFloat(r.inputCost) : null,
          })),
      };

      if (!payload.auto_cost && payload.cost_variants.length === 0) {
        message.warning('원가를 최소 1개 이상 입력하세요.');
        return;
      }

      if (editingItem) {
        await menuPricesAPI.update(editingItem.id, payload);
        message.success('메뉴 단가가 수정되었습니다.');
      } else {
        await menuPricesAPI.create(payload);
        message.success('메뉴가 등록되었습니다.');
      }

      setModalVisible(false);
      fetchItems();
    } catch (error) {
      message.error('저장에 실패했습니다.');
      console.error(error);
    }
  };

  const renderRecipe = (record) => {
    const recipe = record.recipe || [];
    if (recipe.length === 0) {
      return <Text type="secondary">등록된 레시피가 없습니다.</Text>;
    }

    const recipeColumns = [
      {
        title: '구분',
        key: 'type',
        width: 80,
        render: (_, r) => (
          <Tag color={r.isDisposable ? 'default' : 'blue'}>
            {r.isDisposable ? '부자재' : '재료'}
          </Tag>
        ),
      },
      { title: '품목', dataIndex: 'name', key: 'name', width: 160 },
      {
        title: '옵션',
        dataIndex: 'variantLabel',
        key: 'variantLabel',
        width: 90,
        render: (v) => (v ? <Tag>{v}</Tag> : <Text type="secondary" style={{ fontSize: 12 }}>공통</Text>),
      },
      {
        title: '용량',
        key: 'volume',
        width: 100,
        render: (_, r) => (r.volume !== null && r.unit ? `${r.volume}${r.unit}` : '-'),
      },
      {
        title: '구매가',
        dataIndex: 'price',
        key: 'price',
        width: 100,
        align: 'right',
        render: (v) => (v !== null ? formatWon(v) : '-'),
      },
      {
        title: '단위단가',
        key: 'unitPrice',
        width: 110,
        align: 'right',
        render: (_, r) => (r.unitPrice !== null && r.unit ? `${r.unitPrice}원/${r.unit}` : '-'),
      },
      {
        title: '투입량',
        key: 'inputAmount',
        width: 90,
        align: 'right',
        render: (_, r) => (r.inputAmount !== null ? `${r.inputAmount}${r.unit || ''}` : '-'),
      },
      {
        title: '투입원가',
        dataIndex: 'inputCost',
        key: 'inputCost',
        width: 100,
        align: 'right',
        render: (v) => (v !== null ? <Text strong>{formatWon(v)}</Text> : '-'),
      },
    ];

    return (
      <Table
        columns={recipeColumns}
        dataSource={recipe}
        rowKey={(r, idx) => idx}
        pagination={false}
        size="small"
        style={{ maxWidth: 760 }}
      />
    );
  };

  const columns = [
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (value) => <Tag color="green">{value}</Tag>,
      sorter: (a, b) => a.category.localeCompare(b.category, 'ko'),
    },
    {
      title: '메뉴명',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      sorter: (a, b) => a.name.localeCompare(b.name, 'ko'),
    },
    {
      title: '원가',
      key: 'cost_variants',
      width: 260,
      render: (_, record) => {
        const variants = record.cost_variants;
        if (!variants || variants.length === 0) return '-';
        const body = variants.length === 1
          ? <Text>{formatWon(variants[0].cost)}</Text>
          : (
            <Space direction="vertical" size={0}>
              {variants.map((v, idx) => (
                <Text key={idx} style={{ fontSize: 12 }}>
                  {v.label ? `${v.label}: ` : `옵션${idx + 1}: `}
                  {formatWon(v.cost)}
                </Text>
              ))}
            </Space>
          );
        return (
          <Space direction="vertical" size={2}>
            {record.auto_cost && <Tag color="green" style={{ fontSize: 11 }}>자동계산</Tag>}
            {body}
          </Space>
        );
      },
    },
    {
      title: '판매가',
      dataIndex: 'selling_price',
      key: 'selling_price',
      width: 110,
      align: 'right',
      sorter: (a, b) => (a.selling_price || 0) - (b.selling_price || 0),
      render: (value) => (
        value === null || value === undefined
          ? <Tag color="warning">미입력</Tag>
          : <Text strong>{formatWon(value)}</Text>
      ),
    },
    {
      title: '마진',
      key: 'margin',
      width: 200,
      render: (_, record) => {
        if (record.selling_price === null || record.selling_price === undefined) return '-';
        if (!record.cost_variants || record.cost_variants.length <= 1) {
          const margin = record.selling_price - (record.cost || 0);
          return (
            <Text style={{ color: margin < 0 ? '#ff4d4f' : '#52c41a' }}>
              {margin < 0 ? '' : '+'}{formatWon(margin)}
            </Text>
          );
        }
        return (
          <Space direction="vertical" size={0}>
            {record.cost_variants.map((v, idx) => {
              const margin = record.selling_price - v.cost;
              return (
                <Text key={idx} style={{ fontSize: 12, color: margin < 0 ? '#ff4d4f' : '#52c41a' }}>
                  {margin < 0 ? '' : '+'}{formatWon(margin)}
                </Text>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: '비고',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: '작업',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
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

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="전체 메뉴 수" value={summary.total} suffix="개" prefix={<CoffeeOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="카테고리 수" value={summary.categories} suffix="개" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="평균 마진"
              value={Math.round(summary.avgMargin)}
              suffix="원"
              valueStyle={{ color: summary.avgMargin < 0 ? '#ff4d4f' : '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="판매가 미입력"
              value={summary.missingPrice}
              suffix="개"
              valueStyle={{ color: summary.missingPrice > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="🔍 메뉴 단가 필터"
        size="small"
        style={{ marginBottom: 16, border: '2px solid #1890ff', background: '#f0f5ff' }}
      >
        <Space wrap size="large">
          <div>
            <Text strong style={{ marginRight: 8 }}>카테고리:</Text>
            <Select
              style={{ width: 140 }}
              placeholder="전체"
              value={categoryFilter}
              onChange={setCategoryFilter}
              allowClear
            >
              {CATEGORY_OPTIONS.map((c) => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong style={{ marginRight: 8 }}>메뉴명 검색:</Text>
            <Input.Search
              style={{ width: 220 }}
              placeholder="메뉴명으로 검색"
              allowClear
              onSearch={setSearchText}
              onChange={(e) => { if (!e.target.value) setSearchText(''); }}
            />
          </div>
        </Space>
      </Card>

      <Space style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          메뉴 추가
        </Button>
      </Space>

      <Table
        columns={columns}
        dataSource={filteredItems}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `총 ${total}개` }}
        scroll={{ x: 1200 }}
        expandable={{
          expandedRowRender: renderRecipe,
          rowExpandable: (record) => (record.recipe || []).length > 0,
        }}
      />

      <Modal
        title={editingItem ? '메뉴 단가 수정' : '메뉴 추가'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={860}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="category"
                label="카테고리"
                rules={[{ required: true, message: '카테고리를 선택하세요' }]}
              >
                <Select showSearch allowClear={false}>
                  {CATEGORY_OPTIONS.map((c) => (
                    <Select.Option key={c} value={c}>{c}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="selling_price"
                label="판매가 (원)"
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/,/g, '')}
                  placeholder="판매가 입력"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="name"
            label="메뉴명"
            rules={[{ required: true, message: '메뉴명을 입력하세요' }]}
          >
            <Input placeholder="예: 아메리카노 HOT" />
          </Form.Item>

          <Form.Item name="auto_cost" label="원가 계산 방식" valuePropName="checked">
            <Switch checkedChildren="레시피에서 자동 계산" unCheckedChildren="직접 입력" />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.auto_cost !== cur.auto_cost || prev.recipe !== cur.recipe}>
            {({ getFieldValue }) => {
              const autoCost = getFieldValue('auto_cost');

              if (autoCost) {
                const preview = computeCostVariantsPreview(getFieldValue('recipe'));
                return (
                  <Form.Item label="원가 (자동 계산됨)">
                    <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
                      {preview.map((v, idx) => (
                        <div key={idx}>
                          <Text strong>{v.label || (preview.length > 1 ? `옵션${idx + 1}` : '원가')}: </Text>
                          <Text>{formatWon(v.cost)}</Text>
                        </div>
                      ))}
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        아래 레시피 항목의 투입원가 합계로 자동 계산됩니다. 특정 옵션에만 들어가는 재료는 각 항목의 "옵션명"에 입력하세요 (비우면 모든 옵션에 공통 적용).
                      </Text>
                    </Card>
                  </Form.Item>
                );
              }

              return (
                <Form.Item label="원가 (옵션별 직접 입력)">
                  <Form.List name="cost_variants">
                    {(fields, { add, remove }) => (
                      <>
                        {fields.map(({ key, name, ...restField }) => (
                          <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                            <Form.Item {...restField} name={[name, 'label']} style={{ marginBottom: 0 }}>
                              <Input placeholder="옵션명 (예: 올드독) - 선택" style={{ width: 160 }} />
                            </Form.Item>
                            <Form.Item
                              {...restField}
                              name={[name, 'cost']}
                              style={{ marginBottom: 0 }}
                              rules={[{ required: true, message: '원가를 입력하세요' }]}
                            >
                              <InputNumber min={0} placeholder="원가" style={{ width: 140 }} addonAfter="원" />
                            </Form.Item>
                            {fields.length > 1 && (
                              <MinusCircleOutlined onClick={() => remove(name)} />
                            )}
                          </Space>
                        ))}
                        <Button type="dashed" onClick={() => add({ label: '', cost: 0 })} block>
                          원가 옵션 추가
                        </Button>
                      </>
                    )}
                  </Form.List>
                </Form.Item>
              );
            }}
          </Form.Item>

          <Form.Item label="레시피 (재료/부자재)">
            <Form.List name="recipe">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      align="baseline"
                      wrap
                      style={{
                        display: 'flex',
                        marginBottom: 8,
                        padding: 8,
                        border: '1px solid #f0f0f0',
                        borderRadius: 4,
                      }}
                    >
                      <Form.Item
                        {...restField}
                        name={[name, 'isDisposable']}
                        valuePropName="checked"
                        style={{ marginBottom: 0, width: 70 }}
                      >
                        <Checkbox>부자재</Checkbox>
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        style={{ marginBottom: 0 }}
                        rules={[{ required: true, message: '품목명 필수' }]}
                      >
                        <Input placeholder="품목명" style={{ width: 130 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'volume']} style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="용량" style={{ width: 80 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'unit']} style={{ marginBottom: 0 }}>
                        <Input placeholder="단위" style={{ width: 60 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'price']} style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="구매가" style={{ width: 90 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'unitPrice']} style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="단위단가" style={{ width: 90 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'inputAmount']} style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="투입량" style={{ width: 80 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'inputCost']} style={{ marginBottom: 0 }}>
                        <InputNumber placeholder="투입원가" style={{ width: 90 }} />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'variantLabel']} style={{ marginBottom: 0 }}>
                        <Input placeholder="옵션명 (비우면 공통)" style={{ width: 130 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() => add({ name: '', isDisposable: false })}
                    block
                  >
                    레시피 항목 추가
                  </Button>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                    ※ "원가 계산 방식"이 [직접 입력]이면 레시피는 참고용으로만 표시되고, 위 원가는 자동으로 바뀌지 않습니다.
                    [레시피에서 자동 계산]으로 바꾸면 레시피 투입원가 합계로 원가가 자동 계산됩니다.
                  </Text>
                </>
              )}
            </Form.List>
          </Form.Item>

          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="추가 메모" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MenuPricingPage;
