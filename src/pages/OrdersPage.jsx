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
  Divider,
  Card,
  Typography,
  AutoComplete,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ordersAPI, productsAPI } from '../services/api';

const { Text } = Typography;

const OrdersPage = () => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [bulkModalVisible, setBulkModalVisible] = useState(false);
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [quickOrderModalVisible, setQuickOrderModalVisible] = useState(false);
  const [quickProductModalVisible, setQuickProductModalVisible] = useState(false);
  const [changeStoreModalVisible, setChangeStoreModalVisible] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState({});
  const [quickOrderItems, setQuickOrderItems] = useState([]);
  const [selectedQuickOrderKeys, setSelectedQuickOrderKeys] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const [productForm] = Form.useForm();
  const [quickOrderForm] = Form.useForm();
  const [quickProductForm] = Form.useForm();
  const [changeStoreForm] = Form.useForm();
  const [filters, setFilters] = useState({});

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [pagination.current, filters]);

  const fetchProducts = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data);
    } catch (error) {
      console.error('품목 목록 조회 실패:', error);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
      };
      console.log('📋 발주 조회 파라미터:', params);
      const response = await ordersAPI.getAll(params);
      console.log('✅ 발주 조회 결과:', response.data.data.length, '건');
      setOrders(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
      }));
    } catch (error) {
      message.error('발주 목록을 불러오는데 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingOrder(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleBulkAdd = () => {
    bulkForm.resetFields();
    bulkForm.setFieldsValue({
      order_date: dayjs(),
      store: '큰길',
      items: [{ item_name: '', quantity: 1, unit: '', unit_price: null }],
    });
    setBulkModalVisible(true);
  };

  const handleQuickOrder = () => {
    const initialItems = products.map(p => ({
      id: `product_${p.id}`,
      productId: p.id,
      item_name: p.item_name,
      category: p.category,
      supplier: p.supplier || '',
      unit: p.unit || '',
      unit_price: p.unit_price || 0,
      quantity: 0,
      isCustom: false,
    }));
    setQuickOrderItems(initialItems);
    setSupplierFilter('all');
    setCategoryFilter('all');
    setSearchText('');
    quickOrderForm.setFieldsValue({
      order_date: dayjs(),
      store: '큰길',
      supplier: '',
    });
    setQuickOrderModalVisible(true);
  };

  const handleQuickOrderSubmit = async (values) => {
    try {
      const { order_date, store, supplier } = values;
      const date = order_date.format('YYYY-MM-DD');

      const itemsToOrder = quickOrderItems.filter(item => item.quantity > 0);

      if (itemsToOrder.length === 0) {
        message.warning('발주할 상품을 선택하고 수량을 입력하세요.');
        return;
      }

      let successCount = 0;
      for (const item of itemsToOrder) {
        const data = {
          order_date: date,
          store,
          supplier: supplier || '',
          item_name: item.item_name,
          quantity: parseFloat(item.quantity),
          unit: item.unit || '',
          unit_price: item.unit_price || null,
          total_price: item.unit_price && item.quantity
            ? item.unit_price * parseFloat(item.quantity)
            : null,
          notes: '',
        };

        await ordersAPI.create(data);
        successCount++;
      }

      message.success(`${successCount}개 상품이 발주되었습니다.`);
      setQuickOrderModalVisible(false);
      setQuickOrderItems([]);
      fetchOrders();
    } catch (error) {
      message.error('빠른 발주에 실패했습니다.');
      console.error(error);
    }
  };

  const handleQuickOrderItemChange = (itemId, field, value) => {
    setQuickOrderItems(prev =>
      prev.map(item =>
        item.id === itemId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleAddQuickOrderItem = () => {
    const newItem = {
      id: `custom_${Date.now()}`,
      item_name: '',
      category: '',
      unit: '',
      unit_price: 0,
      quantity: 0,
      isCustom: true,
    };
    setQuickOrderItems(prev => [...prev, newItem]);
  };

  const handleRemoveQuickOrderItem = (itemId) => {
    setQuickOrderItems(prev => prev.filter(item => item.id !== itemId));
    setSelectedQuickOrderKeys(prev => prev.filter(key => key !== itemId));
  };

  const handleSelectAllQuickOrder = () => {
    const filteredItems = quickOrderItems.filter(item =>
      categoryFilter === 'all' || item.category === categoryFilter
    );
    setSelectedQuickOrderKeys(filteredItems.map(item => item.id));
  };

  const handleDeselectAllQuickOrder = () => {
    setSelectedQuickOrderKeys([]);
  };

  const handleBulkRemoveQuickOrderItems = async () => {
    if (selectedQuickOrderKeys.length === 0) {
      message.warning('삭제할 항목을 선택하세요.');
      return;
    }

    // 상품 데이터베이스에서 삭제할 항목 찾기
    const itemsToDelete = quickOrderItems.filter(item =>
      selectedQuickOrderKeys.includes(item.id) && item.productId
    );

    if (itemsToDelete.length > 0) {
      try {
        for (const item of itemsToDelete) {
          await productsAPI.delete(item.productId);
        }
        message.success(`${itemsToDelete.length}개 상품이 데이터베이스에서 삭제되었습니다.`);
        fetchProducts(); // 상품 목록 새로고침
      } catch (error) {
        message.error('상품 삭제에 실패했습니다.');
        console.error(error);
      }
    }

    // 모달에서도 제거
    setQuickOrderItems(prev => prev.filter(item => !selectedQuickOrderKeys.includes(item.id)));
    setSelectedQuickOrderKeys([]);
  };

  const handleClearAllProducts = async () => {
    try {
      const allProducts = products;
      for (const product of allProducts) {
        await productsAPI.delete(product.id);
      }
      message.success(`${allProducts.length}개 상품이 모두 삭제되었습니다.`);
      setQuickOrderModalVisible(false);
      fetchProducts();
    } catch (error) {
      message.error('전체 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleSaveAsProducts = async () => {
    if (selectedQuickOrderKeys.length === 0) {
      message.warning('저장할 항목을 선택하세요.');
      return;
    }

    try {
      const itemsToSave = quickOrderItems.filter(item =>
        selectedQuickOrderKeys.includes(item.id) && item.isCustom
      );

      if (itemsToSave.length === 0) {
        message.warning('새로 추가한 품목만 상품으로 저장할 수 있습니다.');
        return;
      }

      let successCount = 0;
      for (const item of itemsToSave) {
        if (!item.item_name) continue;

        const productData = {
          item_name: item.item_name,
          category: item.category || '기타',
          unit: item.unit || '',
          unit_price: item.unit_price || 0,
          supplier: item.supplier || '',
          notes: '',
        };

        await productsAPI.create(productData);
        successCount++;
      }

      message.success(`${successCount}개 품목이 상품으로 저장되었습니다.`);
      fetchProducts();
      setSelectedQuickOrderKeys([]);
    } catch (error) {
      message.error('상품 저장에 실패했습니다.');
      console.error(error);
    }
  };

  const handleUpdateSuppliers = async () => {
    if (selectedQuickOrderKeys.length === 0) {
      message.warning('공급업체를 업데이트할 항목을 선택하세요.');
      return;
    }

    try {
      const itemsToUpdate = quickOrderItems.filter(item =>
        selectedQuickOrderKeys.includes(item.id) && item.productId
      );

      if (itemsToUpdate.length === 0) {
        message.warning('이미 저장된 상품만 공급업체 정보를 업데이트할 수 있습니다.');
        return;
      }

      let successCount = 0;
      for (const item of itemsToUpdate) {
        // 기존 상품 정보 가져오기
        const productResponse = await productsAPI.getById(item.productId);
        const product = productResponse.data;

        // 공급업체 정보만 업데이트
        const updatedData = {
          ...product,
          supplier: item.supplier || '',
        };

        await productsAPI.update(item.productId, updatedData);
        successCount++;
      }

      message.success(`${successCount}개 품목의 공급업체 정보가 업데이트되었습니다.`);
      fetchProducts();
      setSelectedQuickOrderKeys([]);
    } catch (error) {
      message.error('공급업체 업데이트에 실패했습니다.');
      console.error(error);
    }
  };

  const handleUpdateProductInfo = async () => {
    if (selectedQuickOrderKeys.length === 0) {
      message.warning('상품 정보를 업데이트할 항목을 선택하세요.');
      return;
    }

    try {
      const itemsToUpdate = quickOrderItems.filter(item =>
        selectedQuickOrderKeys.includes(item.id) && item.productId
      );

      if (itemsToUpdate.length === 0) {
        message.warning('이미 저장된 상품만 정보를 업데이트할 수 있습니다.');
        return;
      }

      let successCount = 0;
      for (const item of itemsToUpdate) {
        if (!item.item_name || !item.item_name.trim()) {
          continue; // 품목명이 비어있으면 건너뛰기
        }

        // 기존 상품 정보 가져오기
        const productResponse = await productsAPI.getById(item.productId);
        const product = productResponse.data;

        // 전체 상품 정보 업데이트
        const updatedData = {
          ...product,
          item_name: item.item_name.trim(),
          category: item.category || product.category,
          unit: item.unit || product.unit,
          unit_price: item.unit_price || product.unit_price,
          supplier: item.supplier || product.supplier,
        };

        await productsAPI.update(item.productId, updatedData);
        successCount++;
      }

      message.success(`${successCount}개 품목의 상품 정보가 업데이트되었습니다.`);
      fetchProducts();
      setSelectedQuickOrderKeys([]);
    } catch (error) {
      message.error('상품 정보 업데이트에 실패했습니다.');
      console.error(error);
    }
  };

  const handleQuickProductAdd = () => {
    quickProductForm.resetFields();
    quickProductForm.setFieldsValue({
      category: '기타',
    });
    setQuickProductModalVisible(true);
  };

  const handleQuickProductSubmit = async (values) => {
    try {
      await productsAPI.create(values);
      message.success('상품이 등록되었습니다.');
      setQuickProductModalVisible(false);
      fetchProducts();
    } catch (error) {
      message.error('상품 등록에 실패했습니다.');
      console.error(error);
    }
  };

  const handleEdit = (record) => {
    setEditingOrder(record);
    form.setFieldsValue({
      ...record,
      order_date: dayjs(record.order_date),
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await ordersAPI.delete(id);
      message.success('발주가 삭제되었습니다.');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== id));
      fetchOrders();
    } catch (error) {
      message.error('발주 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleChangeStoreClick = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('수정할 항목을 선택하세요.');
      return;
    }
    changeStoreForm.resetFields();
    setChangeStoreModalVisible(true);
  };

  const handleChangeStoreSubmit = async (values) => {
    try {
      const { targetDate, targetStore } = values;

      // 둘 다 비어있으면 에러
      if (!targetDate && !targetStore) {
        message.warning('발주일자 또는 매장 중 하나 이상을 선택하세요.');
        return;
      }

      let successCount = 0;

      for (const id of selectedRowKeys) {
        const order = orders.find(o => o.id === id);
        if (order) {
          const updatedData = { ...order };

          // 발주일자 변경 (선택된 경우에만)
          if (targetDate) {
            updatedData.order_date = targetDate.format('YYYY-MM-DD');
          }

          // 매장 변경 (선택된 경우에만)
          if (targetStore) {
            updatedData.store = targetStore;
          }

          await ordersAPI.update(id, updatedData);
          successCount++;
        }
      }

      const changes = [];
      if (targetDate) changes.push('발주일자');
      if (targetStore) changes.push('매장');

      message.success(`${successCount}개 발주의 ${changes.join(', ')}이(가) 변경되었습니다.`);
      setChangeStoreModalVisible(false);
      setSelectedRowKeys([]);
      fetchOrders();
    } catch (error) {
      message.error('발주 수정에 실패했습니다.');
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
        await ordersAPI.delete(id);
      }
      message.success(`${selectedRowKeys.length}개 항목이 삭제되었습니다.`);
      setSelectedRowKeys([]);
      fetchOrders();
    } catch (error) {
      message.error('일괄 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        order_date: values.order_date.format('YYYY-MM-DD'),
        total_price: values.unit_price && values.quantity
          ? values.unit_price * values.quantity
          : values.total_price,
      };

      if (editingOrder) {
        await ordersAPI.update(editingOrder.id, data);
        message.success('발주가 수정되었습니다.');
      } else {
        await ordersAPI.create(data);
        message.success('발주가 등록되었습니다.');
      }

      setModalVisible(false);
      fetchOrders();
    } catch (error) {
      message.error('발주 저장에 실패했습니다.');
      console.error(error);
    }
  };

  const handleBulkSubmit = async (values) => {
    try {
      const { order_date, store, supplier, items } = values;
      const date = order_date.format('YYYY-MM-DD');

      let successCount = 0;
      for (const item of items) {
        const data = {
          order_date: date,
          store,
          supplier: supplier || '',
          item_name: item.item_name,
          quantity: item.quantity,
          unit: item.unit || '',
          unit_price: item.unit_price || null,
          total_price: item.unit_price && item.quantity
            ? item.unit_price * item.quantity
            : null,
          notes: item.notes || '',
        };

        await ordersAPI.create(data);
        successCount++;
      }

      message.success(`${successCount}개 품목이 등록되었습니다.`);
      setBulkModalVisible(false);
      fetchOrders();
    } catch (error) {
      message.error('일괄 등록에 실패했습니다.');
      console.error(error);
    }
  };

  const calculateItemTotal = (index) => {
    const items = bulkForm.getFieldValue('items') || [];
    const item = items[index];
    if (item && item.unit_price && item.quantity) {
      return item.unit_price * item.quantity;
    }
    return 0;
  };

  const calculateGrandTotal = () => {
    const items = bulkForm.getFieldValue('items') || [];
    return items.reduce((sum, item) => {
      if (item && item.unit_price && item.quantity) {
        return sum + (item.unit_price * item.quantity);
      }
      return sum;
    }, 0);
  };

  const handleProductSelect = (value, option, index) => {
    if (option && option.product) {
      const product = option.product;
      const items = bulkForm.getFieldValue('items');
      items[index] = {
        ...items[index],
        item_name: product.item_name,
        unit: product.unit,
        unit_price: product.unit_price,
      };
      bulkForm.setFieldsValue({ items });
    }
  };

  const handleProductAdd = () => {
    setEditingProduct(null);
    productForm.resetFields();
    setProductModalVisible(true);
  };

  const handleProductEdit = (product) => {
    setEditingProduct(product);
    productForm.setFieldsValue(product);
    setProductModalVisible(true);
  };

  const handleProductSubmit = async (values) => {
    try {
      if (editingProduct) {
        await productsAPI.update(editingProduct.id, values);
        message.success('품목이 수정되었습니다.');
      } else {
        await productsAPI.create(values);
        message.success('품목이 등록되었습니다.');
      }
      setProductModalVisible(false);
      fetchProducts();
    } catch (error) {
      message.error('품목 저장에 실패했습니다.');
      console.error(error);
    }
  };

  const handleProductDelete = async (id) => {
    try {
      await productsAPI.delete(id);
      message.success('품목이 삭제되었습니다.');
      fetchProducts();
    } catch (error) {
      message.error('품목 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await ordersAPI.export(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `발주리스트_${dayjs().format('YYYYMMDD')}.xlsx`);
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
    const formData = new FormData();
    formData.append('file', file);
    formData.append('store', '큰길');

    try {
      await ordersAPI.import(formData);
      message.success('엑셀 파일을 성공적으로 임포트했습니다.');
      fetchOrders();
    } catch (error) {
      message.error('엑셀 임포트에 실패했습니다.');
      console.error(error);
    }
    return false;
  };

  const handleProductImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await productsAPI.import(formData);
      message.success(`${response.data.count}개 상품이 등록되었습니다!`);
      fetchProducts();
    } catch (error) {
      message.error('상품 임포트에 실패했습니다.');
      console.error(error);
    }
    return false;
  };

  const columns = [
    {
      title: '발주일자',
      dataIndex: 'order_date',
      key: 'order_date',
      width: 110,
      sorter: true,
      render: (value) => {
        if (!value) return '-';
        // ISO 형식 날짜를 YYYY-MM-DD로 변환
        const date = typeof value === 'string' ? value.split('T')[0] : dayjs(value).format('YYYY-MM-DD');
        return date;
      },
    },
    {
      title: '매장',
      dataIndex: 'store',
      key: 'store',
      width: 70,
    },
    {
      title: '공급업체',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 80,
    },
    {
      title: '품목',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 200,
    },
    {
      title: '수량',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      render: (value, record) => `${parseFloat(value) || 0} ${record.unit || ''}`,
    },
    {
      title: '단가',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 90,
      render: (value) => value ? `${parseFloat(value).toLocaleString()}원` : '-',
    },
    {
      title: '총금액',
      dataIndex: 'total_price',
      key: 'total_price',
      width: 100,
      render: (value) => value ? `${parseFloat(value).toLocaleString()}원` : '-',
    },
    {
      title: '비고',
      dataIndex: 'notes',
      key: 'notes',
      width: 100,
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
      {/* 필터 */}
      <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
        <Space wrap>
          <div>
            <Text strong style={{ marginRight: 8 }}>매장:</Text>
            <Select
              style={{ width: 120 }}
              value={filters.store || 'all'}
              onChange={(value) => {
                if (value === 'all') {
                  const { store, ...rest } = filters;
                  setFilters(rest);
                } else {
                  setFilters({ ...filters, store: value });
                }
              }}
            >
              <Select.Option value="all">전체 매장</Select.Option>
              <Select.Option value="큰길">큰길</Select.Option>
              <Select.Option value="태광">태광</Select.Option>
            </Select>
          </div>

          <div>
            <Text strong style={{ marginRight: 8 }}>공급업체:</Text>
            <Select
              style={{ width: 150 }}
              value={filters.supplier || 'all'}
              onChange={(value) => {
                if (value === 'all') {
                  const { supplier, ...rest } = filters;
                  setFilters(rest);
                } else {
                  setFilters({ ...filters, supplier: value });
                }
              }}
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              <Select.Option value="all">전체 업체</Select.Option>
              <Select.Option value="메가커피">메가커피</Select.Option>
              <Select.Option value="쿠팡">쿠팡</Select.Option>
              <Select.Option value="아싸컴퍼니">아싸컴퍼니</Select.Option>
              <Select.Option value="프릳츠">프릳츠</Select.Option>
              <Select.Option value="드시모네">드시모네</Select.Option>
              <Select.Option value="매일유통">매일유통</Select.Option>
              <Select.Option value="네이버">네이버</Select.Option>
            </Select>
          </div>

          {(filters.store || filters.supplier) && (
            <Button
              type="primary"
              size="small"
              onClick={() => {
                setFilters({});
              }}
            >
              🔄 필터 초기화
            </Button>
          )}
        </Space>
      </Card>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleQuickOrder}
          disabled={products.length === 0}
        >
          ⚡ 빠른 발주 ({products.length}개 상품)
        </Button>
        <Button icon={<PlusOutlined />} onClick={handleBulkAdd}>
          여러 품목 등록
        </Button>
        <Button icon={<PlusOutlined />} onClick={handleAdd}>
          단일 품목 등록
        </Button>
        <Divider type="vertical" />
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleQuickProductAdd}
          style={{ borderColor: '#52c41a', color: '#52c41a' }}
        >
          📦 상품 등록
        </Button>
        <Upload
          beforeUpload={handleProductImport}
          accept=".xlsx,.xls"
          showUploadList={false}
        >
          <Button type="dashed">
            📦 메뉴단가 임포트
          </Button>
        </Upload>
        <Divider type="vertical" />
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
        {selectedRowKeys.length > 0 && (
          <>
            <Button
              type="dashed"
              onClick={handleChangeStoreClick}
              style={{ borderColor: '#1890ff', color: '#1890ff' }}
            >
              ✏️ 일괄 수정 ({selectedRowKeys.length})
            </Button>
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
          </>
        )}
      </Space>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        rowSelection={rowSelection}
        onChange={(newPagination) => {
          setPagination(newPagination);
        }}
        scroll={{ x: 1100 }}
        summary={(pageData) => {
          // 일별 총액 계산
          const dailyTotals = {};
          pageData.forEach(order => {
            // 날짜를 YYYY-MM-DD 형식으로 변환
            const date = order.order_date ?
              (typeof order.order_date === 'string' ? order.order_date.split('T')[0] : dayjs(order.order_date).format('YYYY-MM-DD')) :
              '';
            const key = `${date} (${order.store})`;
            if (!dailyTotals[key]) {
              dailyTotals[key] = 0;
            }
            // 문자열을 숫자로 변환
            dailyTotals[key] += parseFloat(order.total_price) || 0;
          });

          // 페이지 전체 총액
          const pageTotal = pageData.reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0);

          return (
            <>
              {Object.entries(dailyTotals).map(([dateStore, total]) => (
                <Table.Summary.Row key={dateStore} style={{ backgroundColor: '#f5f5f5' }}>
                  <Table.Summary.Cell index={0} colSpan={6}>
                    <Text strong>{dateStore} 소계</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>
                    <Text strong style={{ color: '#1890ff' }}>
                      {Math.round(total).toLocaleString()}원
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} colSpan={2} />
                </Table.Summary.Row>
              ))}
              <Table.Summary.Row style={{ backgroundColor: '#e6f7ff' }}>
                <Table.Summary.Cell index={0} colSpan={6}>
                  <Text strong>현재 페이지 총합</Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={6}>
                  <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                    {Math.round(pageTotal).toLocaleString()}원
                  </Text>
                </Table.Summary.Cell>
                <Table.Summary.Cell index={7} colSpan={2} />
              </Table.Summary.Row>
            </>
          );
        }}
      />

      {/* 단일 품목 등록 모달 */}
      <Modal
        title={editingOrder ? '발주 수정' : '발주 등록'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            store: '큰길',
            order_date: dayjs(),
          }}
        >
          <Form.Item
            name="order_date"
            label="발주일자"
            rules={[{ required: true, message: '발주일자를 선택하세요' }]}
          >
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>

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

          <Form.Item name="supplier" label="공급업체">
            <Input placeholder="네이버, 쿠팡 등" />
          </Form.Item>

          <Form.Item
            name="item_name"
            label="품목"
            rules={[{ required: true, message: '품목을 입력하세요' }]}
          >
            <Input placeholder="매실파우더, 레몬시럽 등" />
          </Form.Item>

          <Space style={{ width: '100%', display: 'flex' }}>
            <Form.Item
              name="quantity"
              label="수량"
              rules={[{ required: true, message: '수량을 입력하세요' }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="unit" label="단위" style={{ width: 100 }}>
              <Input placeholder="kg, 개" />
            </Form.Item>

            <Form.Item
              name="unit_price"
              label="단가"
              style={{ flex: 1 }}
            >
              <InputNumber
                min={0}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/,/g, '')}
                style={{ width: '100%' }}
                placeholder="0"
              />
            </Form.Item>
          </Space>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.quantity !== currentValues.quantity ||
              prevValues.unit_price !== currentValues.unit_price
            }
          >
            {({ getFieldValue }) => {
              const quantity = getFieldValue('quantity') || 0;
              const unitPrice = getFieldValue('unit_price') || 0;
              const total = quantity * unitPrice;
              return total > 0 ? (
                <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
                  <Text strong style={{ fontSize: 16 }}>
                    총금액: {total.toLocaleString()}원
                  </Text>
                </Card>
              ) : null;
            }}
          </Form.Item>

          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="추가 메모" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 여러 품목 일괄 등록 모달 */}
      <Modal
        title="여러 품목 일괄 등록"
        open={bulkModalVisible}
        onCancel={() => setBulkModalVisible(false)}
        onOk={() => bulkForm.submit()}
        width={900}
      >
        <Form
          form={bulkForm}
          layout="vertical"
          onFinish={handleBulkSubmit}
          initialValues={{
            order_date: dayjs(),
            store: '큰길',
            items: [{ item_name: '', quantity: 1, unit: '', unit_price: null }],
          }}
        >
          <Space style={{ width: '100%', marginBottom: 16 }}>
            <Form.Item
              name="order_date"
              label="발주일자"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <DatePicker />
            </Form.Item>

            <Form.Item
              name="store"
              label="매장"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <Select style={{ width: 120 }}>
                <Select.Option value="큰길">큰길</Select.Option>
                <Select.Option value="태광">태광</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="supplier"
              label="공급업체"
              style={{ marginBottom: 0 }}
            >
              <Input placeholder="네이버, 쿠팡 등" style={{ width: 150 }} />
            </Form.Item>
          </Space>

          <Divider>품목 목록</Divider>

          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }, index) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 16, background: '#fafafa' }}
                    title={`품목 ${index + 1}`}
                    extra={
                      fields.length > 1 ? (
                        <Button
                          type="link"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(name)}
                        >
                          삭제
                        </Button>
                      ) : null
                    }
                  >
                    <Space style={{ width: '100%', alignItems: 'flex-start' }}>
                      <Form.Item
                        {...restField}
                        name={[name, 'item_name']}
                        rules={[{ required: true, message: '품목명 필수' }]}
                        style={{ marginBottom: 0, flex: 2 }}
                      >
                        <AutoComplete
                          placeholder="품목명 입력 또는 선택"
                          options={products.map(p => ({
                            value: p.item_name,
                            label: `${p.item_name}${p.supplier ? ` (${p.supplier})` : ''}`,
                            product: p
                          }))}
                          onSelect={(value, option) => handleProductSelect(value, option, index)}
                          filterOption={(inputValue, option) =>
                            option.value.toLowerCase().includes(inputValue.toLowerCase())
                          }
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'quantity']}
                        rules={[{ required: true, message: '필수' }]}
                        style={{ marginBottom: 0, width: 80 }}
                      >
                        <InputNumber min={0} placeholder="수량" style={{ width: '100%' }} />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'unit']}
                        style={{ marginBottom: 0, width: 70 }}
                      >
                        <Input placeholder="단위" />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'unit_price']}
                        style={{ marginBottom: 0, width: 120 }}
                      >
                        <InputNumber
                          min={0}
                          formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={value => value.replace(/,/g, '')}
                          placeholder="단가"
                          style={{ width: '100%' }}
                        />
                      </Form.Item>

                      <Form.Item
                        {...restField}
                        name={[name, 'notes']}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input placeholder="비고" />
                      </Form.Item>
                    </Space>

                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) =>
                        prev.items?.[index]?.quantity !== curr.items?.[index]?.quantity ||
                        prev.items?.[index]?.unit_price !== curr.items?.[index]?.unit_price
                      }
                    >
                      {() => {
                        const total = calculateItemTotal(index);
                        return total > 0 ? (
                          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
                            금액: {total.toLocaleString()}원
                          </Text>
                        ) : null;
                      }}
                    </Form.Item>
                  </Card>
                ))}

                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                  style={{ marginBottom: 16 }}
                >
                  품목 추가
                </Button>
              </>
            )}
          </Form.List>

          <Form.Item
            noStyle
            shouldUpdate
          >
            {() => {
              const grandTotal = calculateGrandTotal();
              return grandTotal > 0 ? (
                <Card style={{ background: '#e6f7ff', borderColor: '#1890ff' }}>
                  <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                    총 발주 금액: {grandTotal.toLocaleString()}원
                  </Text>
                </Card>
              ) : null;
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* 빠른 발주 모달 */}
      <Modal
        title="⚡ 빠른 발주 - 등록된 상품 선택"
        open={quickOrderModalVisible}
        onCancel={() => setQuickOrderModalVisible(false)}
        onOk={() => quickOrderForm.submit()}
        width={1100}
      >
        <Form
          form={quickOrderForm}
          layout="vertical"
          onFinish={handleQuickOrderSubmit}
          initialValues={{
            order_date: dayjs(),
            store: '큰길',
          }}
        >
          <Space style={{ marginBottom: 16 }}>
            <Form.Item
              name="order_date"
              label="발주일자"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <DatePicker />
            </Form.Item>

            <Form.Item
              name="store"
              label="매장"
              rules={[{ required: true }]}
              style={{ marginBottom: 0 }}
            >
              <Select style={{ width: 120 }}>
                <Select.Option value="큰길">큰길</Select.Option>
                <Select.Option value="태광">태광</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="supplier"
              label="공급업체"
              style={{ marginBottom: 0 }}
            >
              <Select style={{ width: 150 }} placeholder="선택" allowClear>
                <Select.Option value="메가커피">메가커피</Select.Option>
                <Select.Option value="쿠팡">쿠팡</Select.Option>
                <Select.Option value="아싸컴퍼니">아싸컴퍼니</Select.Option>
                <Select.Option value="프릳츠">프릳츠</Select.Option>
                <Select.Option value="드시모네">드시모네</Select.Option>
                <Select.Option value="매일유통">매일유통</Select.Option>
                <Select.Option value="네이버">네이버</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Divider>
            <Space wrap>
              <span style={{ fontWeight: 'bold' }}>
                상품 목록 (필터링: {quickOrderItems.filter(item => {
                  const categoryMatch = categoryFilter === 'all' || item.category === categoryFilter;
                  const supplierMatch = supplierFilter === 'all' || item.supplier === supplierFilter;
                  const searchMatch = !searchText || item.item_name.toLowerCase().includes(searchText.toLowerCase());
                  return categoryMatch && supplierMatch && searchMatch;
                }).length}개 / 전체: {quickOrderItems.length}개)
              </span>
              <Input
                size="small"
                placeholder="🔍 품목명 검색..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 180 }}
                allowClear
              />
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Text type="secondary">공급업체:</Text>
                <Select
                  size="small"
                  value={supplierFilter}
                  onChange={setSupplierFilter}
                  style={{ width: 130 }}
                >
                  <Select.Option value="all">✓ 전체</Select.Option>
                  <Select.Option value="메가커피">메가커피</Select.Option>
                  <Select.Option value="쿠팡">쿠팡</Select.Option>
                  <Select.Option value="아싸컴퍼니">아싸컴퍼니</Select.Option>
                  <Select.Option value="프릳츠">프릳츠</Select.Option>
                  <Select.Option value="드시모네">드시모네</Select.Option>
                  <Select.Option value="매일유통">매일유통</Select.Option>
                  <Select.Option value="네이버">네이버</Select.Option>
                </Select>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Text type="secondary">카테고리:</Text>
                <Select
                  size="small"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  style={{ width: 130 }}
                >
                <Select.Option value="all">✓ 전체</Select.Option>
                <Select.Option value="파우더">파우더</Select.Option>
                <Select.Option value="청">청</Select.Option>
                <Select.Option value="시럽">시럽</Select.Option>
                <Select.Option value="원두">원두</Select.Option>
                <Select.Option value="소모품">소모품</Select.Option>
                <Select.Option value="우유">우유</Select.Option>
                <Select.Option value="티백">티백</Select.Option>
                <Select.Option value="콤부차">콤부차</Select.Option>
                <Select.Option value="기타">기타</Select.Option>
                </Select>
              </div>
              {(categoryFilter !== 'all' || supplierFilter !== 'all' || searchText) && (
                <Button
                  size="small"
                  onClick={() => {
                    setCategoryFilter('all');
                    setSupplierFilter('all');
                    setSearchText('');
                  }}
                >
                  필터 초기화
                </Button>
              )}
              <Button
                size="small"
                onClick={handleSelectAllQuickOrder}
              >
                전체선택
              </Button>
              <Button
                size="small"
                onClick={handleDeselectAllQuickOrder}
              >
                선택해제
              </Button>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddQuickOrderItem}
              >
                품목 추가
              </Button>
              {selectedQuickOrderKeys.length > 0 && (
                <>
                  <Button
                    type="primary"
                    size="small"
                    style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    onClick={handleSaveAsProducts}
                  >
                    💾 상품으로 저장 ({selectedQuickOrderKeys.length})
                  </Button>
                  <Button
                    type="primary"
                    size="small"
                    style={{ background: '#1890ff', borderColor: '#1890ff' }}
                    onClick={handleUpdateProductInfo}
                  >
                    ✏️ 상품 정보 저장 ({selectedQuickOrderKeys.length})
                  </Button>
                  <Popconfirm
                    title={`선택한 ${selectedQuickOrderKeys.length}개 상품을 데이터베이스에서 완전히 삭제하시겠습니까?`}
                    description="이 작업은 되돌릴 수 없습니다."
                    onConfirm={handleBulkRemoveQuickOrderItems}
                    okText="삭제"
                    cancelText="취소"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                    >
                      선택 삭제 ({selectedQuickOrderKeys.length})
                    </Button>
                  </Popconfirm>
                </>
              )}
              <Divider type="vertical" />
              <Popconfirm
                title="모든 상품을 데이터베이스에서 완전히 삭제하시겠습니까?"
                description={`총 ${products.length}개 상품이 삭제됩니다. 이 작업은 되돌릴 수 없습니다!`}
                onConfirm={handleClearAllProducts}
                okText="전체 삭제"
                cancelText="취소"
                okButtonProps={{ danger: true }}
              >
                <Button
                  danger
                  type="primary"
                  size="small"
                  icon={<DeleteOutlined />}
                >
                  🗑️ 전체 초기화
                </Button>
              </Popconfirm>
            </Space>
          </Divider>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <Table
              size="small"
              dataSource={quickOrderItems.filter(item => {
                const categoryMatch = categoryFilter === 'all' || item.category === categoryFilter;
                const supplierMatch = supplierFilter === 'all' || item.supplier === supplierFilter;
                const searchMatch = !searchText || item.item_name.toLowerCase().includes(searchText.toLowerCase());
                return categoryMatch && supplierMatch && searchMatch;
              })}
              rowKey="id"
              pagination={false}
              rowSelection={{
                selectedRowKeys: selectedQuickOrderKeys,
                onChange: (newSelectedRowKeys) => {
                  setSelectedQuickOrderKeys(newSelectedRowKeys);
                },
              }}
              columns={[
                {
                  title: '카테고리',
                  width: 100,
                  render: (_, record) => (
                    <Select
                      placeholder="카테고리"
                      size="small"
                      style={{ width: '100%' }}
                      value={record.category || undefined}
                      onChange={(value) => handleQuickOrderItemChange(record.id, 'category', value)}
                    >
                      <Select.Option value="파우더">파우더</Select.Option>
                      <Select.Option value="청">청</Select.Option>
                      <Select.Option value="시럽">시럽</Select.Option>
                      <Select.Option value="원두">원두</Select.Option>
                      <Select.Option value="소모품">소모품</Select.Option>
                      <Select.Option value="우유">우유</Select.Option>
                      <Select.Option value="티백">티백</Select.Option>
                      <Select.Option value="콤부차">콤부차</Select.Option>
                      <Select.Option value="기타">기타</Select.Option>
                    </Select>
                  ),
                },
                {
                  title: '품목명',
                  width: 250,
                  render: (_, record) => (
                    <Input
                      placeholder="품목명"
                      size="small"
                      style={{ width: '100%' }}
                      value={record.item_name || ''}
                      onChange={(e) => handleQuickOrderItemChange(record.id, 'item_name', e.target.value)}
                    />
                  ),
                },
                {
                  title: '공급업체',
                  width: 100,
                  render: (_, record) => (
                    <AutoComplete
                      placeholder="공급업체"
                      size="small"
                      style={{ width: '100%' }}
                      value={record.supplier || ''}
                      onChange={(value) => handleQuickOrderItemChange(record.id, 'supplier', value)}
                      options={[
                        { value: '메가커피' },
                        { value: '쿠팡' },
                        { value: '아싸컴퍼니' },
                        { value: '프릳츠' },
                        { value: '드시모네' },
                        { value: '매일유통' },
                        { value: '네이버' },
                      ]}
                    />
                  ),
                },
                {
                  title: '단위',
                  width: 80,
                  render: (_, record) => (
                    <Input
                      placeholder="단위"
                      size="small"
                      style={{ width: '100%' }}
                      value={record.unit || ''}
                      onChange={(e) => handleQuickOrderItemChange(record.id, 'unit', e.target.value)}
                    />
                  ),
                },
                {
                  title: '단가',
                  width: 100,
                  render: (_, record) => (
                    <InputNumber
                      min={0}
                      size="small"
                      placeholder="0"
                      style={{ width: '100%' }}
                      value={record.unit_price || 0}
                      onChange={(value) => handleQuickOrderItemChange(record.id, 'unit_price', value)}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => value.replace(/,/g, '')}
                    />
                  ),
                },
                {
                  title: '수량',
                  width: 80,
                  render: (_, record) => (
                    <InputNumber
                      min={0}
                      size="small"
                      placeholder="0"
                      style={{ width: '100%' }}
                      value={record.quantity || 0}
                      onChange={(value) => handleQuickOrderItemChange(record.id, 'quantity', value)}
                    />
                  ),
                },
                {
                  title: '금액',
                  width: 100,
                  align: 'right',
                  render: (_, record) => {
                    const quantity = parseFloat(record.quantity) || 0;
                    const unitPrice = parseFloat(record.unit_price) || 0;
                    const total = quantity * unitPrice;
                    return total > 0 ? (
                      <Text strong style={{ color: '#1890ff' }}>
                        {total.toLocaleString()}원
                      </Text>
                    ) : '-';
                  },
                },
                {
                  title: '작업',
                  width: 60,
                  fixed: 'right',
                  render: (_, record) => (
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveQuickOrderItem(record.id)}
                    />
                  ),
                },
              ]}
            />
          </div>

          <Card style={{ marginTop: 16, background: '#e6f7ff', borderColor: '#1890ff' }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text strong style={{ fontSize: 16 }}>
                선택된 상품: {quickOrderItems.filter(item => item.quantity > 0).length}개 / 총 {quickOrderItems.length}개
              </Text>
              <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                총 발주 금액:{' '}
                {quickOrderItems
                  .reduce((sum, item) => {
                    return sum + (parseFloat(item.unit_price) || 0) * (parseFloat(item.quantity) || 0);
                  }, 0)
                  .toLocaleString()}
                원
              </Text>
            </Space>
          </Card>
        </Form>
      </Modal>

      {/* 빠른 상품 등록 모달 */}
      <Modal
        title="📦 상품 등록"
        open={quickProductModalVisible}
        onCancel={() => setQuickProductModalVisible(false)}
        onOk={() => quickProductForm.submit()}
        width={500}
      >
        <Form
          form={quickProductForm}
          layout="vertical"
          onFinish={handleQuickProductSubmit}
        >
          <Form.Item
            name="category"
            label="카테고리"
            rules={[{ required: true, message: '카테고리를 선택하세요' }]}
          >
            <Select>
              <Select.Option value="파우더">파우더</Select.Option>
              <Select.Option value="청">청</Select.Option>
              <Select.Option value="시럽">시럽</Select.Option>
              <Select.Option value="원두">원두</Select.Option>
              <Select.Option value="소모품">소모품</Select.Option>
              <Select.Option value="우유">우유</Select.Option>
              <Select.Option value="티백">티백</Select.Option>
              <Select.Option value="콤부차">콤부차</Select.Option>
              <Select.Option value="기타">기타</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="item_name"
            label="품목명"
            rules={[{ required: true, message: '품목명을 입력하세요' }]}
          >
            <Input placeholder="예: 매실파우더, 레몬시럽 등" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="unit" label="단위">
                <Input placeholder="kg, ml, 개 등" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit_price" label="단가">
                <InputNumber
                  min={0}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/,/g, '')}
                  style={{ width: '100%' }}
                  placeholder="0"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="supplier" label="공급업체">
            <Input placeholder="선택사항" />
          </Form.Item>

          <Form.Item name="notes" label="비고">
            <Input.TextArea rows={2} placeholder="추가 메모" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 발주 일괄 수정 모달 */}
      <Modal
        title="✏️ 발주 일괄 수정"
        open={changeStoreModalVisible}
        onCancel={() => setChangeStoreModalVisible(false)}
        onOk={() => changeStoreForm.submit()}
        width={450}
      >
        <Form
          form={changeStoreForm}
          layout="vertical"
          onFinish={handleChangeStoreSubmit}
        >
          <Card size="small" style={{ background: '#f0f5ff', marginBottom: 16 }}>
            <Text>
              선택한 <Text strong style={{ color: '#1890ff' }}>{selectedRowKeys.length}개</Text> 발주를 일괄 수정합니다.
            </Text>
          </Card>

          <Form.Item
            name="targetDate"
            label="발주일자 변경 (선택사항)"
          >
            <DatePicker
              style={{ width: '100%' }}
              placeholder="변경하지 않으려면 비워두세요"
            />
          </Form.Item>

          <Form.Item
            name="targetStore"
            label="매장 변경 (선택사항)"
          >
            <Select placeholder="변경하지 않으려면 비워두세요" allowClear>
              <Select.Option value="큰길">큰길</Select.Option>
              <Select.Option value="태광">태광</Select.Option>
            </Select>
          </Form.Item>

          <Card size="small" style={{ background: '#fff7e6' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 변경하지 않을 항목은 비워두시면 됩니다.
              <br />• 발주일자와 매장을 선택적으로 변경할 수 있습니다.
              <br />• 품목, 수량, 단가 등은 그대로 유지됩니다.
            </Text>
          </Card>
        </Form>
      </Modal>
    </div>
  );
};

export default OrdersPage;
