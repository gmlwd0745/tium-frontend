import { useState, useEffect } from 'react';
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
  Upload,
  Popconfirm,
  Card,
  Typography,
  Tag,
  Statistic,
  Row,
  Col,
  Badge,
  Divider,
  AutoComplete,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UploadOutlined,
  WarningOutlined,
  AlertOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { inventoryAPI, inventoryHistoryAPI, productsAPI, ordersAPI } from '../services/api';

const { Text } = Typography;

const InventoryPage = () => {
  const [loading, setLoading] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalForm] = Form.useForm();

  // 카테고리별 품목 리스트
  const categoryItems = {
    '티백': ['얼그레이', '페퍼민트', '캐모마일', '루이보스', '녹차', '우롱차'],
    '콤부차': ['레몬진저', '복숭아', '자몽', '청포도', '오리지널'],
    '소모품': ['일회용컵', '빨대', '냅킨', '테이크아웃백', '포장용기', '장갑'],
    '시럽': ['바닐라', '카라멜', '헤이즐넛', '초콜릿', '흑당'],
    '원부재료': [],
    '부재료': [],
    '디저트': [],
    '폐기': [],
  };
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [quickAddModalVisible, setQuickAddModalVisible] = useState(false);
  const [productSelectModalVisible, setProductSelectModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [copyMonthModalVisible, setCopyMonthModalVisible] = useState(false);
  const [loadOrdersModalVisible, setLoadOrdersModalVisible] = useState(false);
  const [dailyStartModalVisible, setDailyStartModalVisible] = useState(false);
  const [dailyIntakeModalVisible, setDailyIntakeModalVisible] = useState(false);
  const [dailyUsageModalVisible, setDailyUsageModalVisible] = useState(false);
  const [dailyAuditModalVisible, setDailyAuditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [quickAddItems, setQuickAddItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [productCategoryFilter, setProductCategoryFilter] = useState('all');
  const [productSupplierFilter, setProductSupplierFilter] = useState('all');
  const [historyData, setHistoryData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [selectedItemForHistory, setSelectedItemForHistory] = useState(null);
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const [quickAddForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [copyMonthForm] = Form.useForm();
  const [loadOrdersForm] = Form.useForm();
  const [dailyStartForm] = Form.useForm();
  const [dailyIntakeForm] = Form.useForm();
  const [dailyUsageForm] = Form.useForm();
  const [filters, setFilters] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);

  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockItems: 0,
    currentMonth: dayjs().format('YYYY-MM'),
  });

  useEffect(() => {
    fetchInventory();
    fetchAlerts();
    fetchRecentOrders();
  }, [pagination.current, filters]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      console.log('📊 재고 조회 필터:', filters);
      const response = await inventoryAPI.getAll({
        page: pagination.current,
        limit: pagination.pageSize,
        ...filters,
      });
      console.log('📦 조회된 재고 개수:', response.data.data.length);
      setInventory(response.data.data);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
      }));

      setStats(prev => ({
        ...prev,
        totalItems: response.data.pagination.total,
      }));
    } catch (error) {
      message.error('재고 목록을 불러오는데 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await inventoryAPI.getAlerts(filters.store ? { store: filters.store } : {});
      setAlerts(response.data);
      setStats(prev => ({
        ...prev,
        lowStockItems: response.data.length,
      }));
    } catch (error) {
      console.error('재고 알림 조회 실패:', error);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      // 최근 30일간의 발주 내역 가져오기
      const response = await ordersAPI.getAll({
        limit: 10000,
      });
      setRecentOrders(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch recent orders:', error);
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    setSelectedCategory(null);
    modalForm.resetFields();
    modalForm.setFieldsValue({
      store: '큰길',
      month: dayjs().format('YYYY-MM'),
      category: '원부재료',
      previous_stock: 0,
      current_intake: 0,
      current_consumption: 0,
      current_stock: 0,
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setEditingItem(record);
    setSelectedCategory(record.category);
    modalForm.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await inventoryAPI.delete(id);
      message.success('재고 항목이 삭제되었습니다.');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== id));
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('재고 항목 삭제에 실패했습니다.');
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
        await inventoryAPI.delete(id);
      }
      message.success(`${selectedRowKeys.length}개 항목이 삭제되었습니다.`);
      setSelectedRowKeys([]);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('일괄 삭제에 실패했습니다.');
      console.error(error);
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingItem) {
        await inventoryAPI.update(editingItem.id, values);
        message.success('재고 항목이 수정되었습니다.');
      } else {
        await inventoryAPI.create(values);
        message.success('재고 항목이 등록되었습니다.');
      }

      setModalVisible(false);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('재고 저장에 실패했습니다.');
      console.error(error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await inventoryAPI.export(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `재고리스트_${dayjs().format('YYYYMMDD')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('엑셀 파일이 다운로드되었습니다.');
    } catch (error) {
      message.error('엑셀 다운로드에 실패했습니다.');
      console.error(error);
    }
  };

  const handleImportClick = () => {
    importForm.setFieldsValue({
      store: '큰길',
      date: dayjs().format('YYYY-MM-DD'),
    });
    setUploadedFile(null);
    setImportModalVisible(true);
  };

  const handleFileUpload = (file) => {
    setUploadedFile(file);
    return false;
  };

  const handleImportSubmit = async (values) => {
    if (!uploadedFile) {
      message.warning('파일을 선택하세요.');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadedFile);
    formData.append('store', values.store);
    formData.append('date', values.date);

    try {
      const response = await inventoryAPI.import(formData);
      message.success(response.data.message || '엑셀 파일을 성공적으로 임포트했습니다.');
      setImportModalVisible(false);
      setUploadedFile(null);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error(error.response?.data?.error || '엑셀 임포트에 실패했습니다.');
      console.error(error);
    }
  };

  const handleQuickAdd = () => {
    const initialItems = [
      { id: 1, item_name: '', unit: '', current_stock: 0, min_stock: null },
    ];
    setQuickAddItems(initialItems);
    quickAddForm.setFieldsValue({
      month: dayjs().format('YYYY-MM'),
      store: '큰길',
      category: '원부재료',
    });
    setQuickAddModalVisible(true);
  };

  const handleProductSelectClick = async () => {
    try {
      const response = await productsAPI.getAll();
      setProducts(response.data);
      setProductSelectModalVisible(true);
    } catch (error) {
      message.error('품목 목록을 불러오는데 실패했습니다.');
      console.error(error);
    }
  };

  const handleProductsSelected = async () => {
    try {
      // 최신 발주 내역 조회
      const ordersResponse = await ordersAPI.getAll({ limit: 1000 });
      const allOrders = ordersResponse.data.data || [];

      const selectedItems = products
        .filter(p => selectedProducts.includes(p.id))
        .map(p => {
          // 해당 품목의 최신 발주 찾기 (날짜 기준 내림차순)
          const itemOrders = allOrders
            .filter(order => order.item_name === p.item_name)
            .sort((a, b) => {
              const dateA = a.order_date || '';
              const dateB = b.order_date || '';
              return dateB.localeCompare(dateA);
            });

          const latestOrder = itemOrders[0];
          const unitCost = latestOrder
            ? Math.round(parseFloat(latestOrder.unit_price) || 0)
            : (p.unit_price ? Math.round(parseFloat(p.unit_price) || 0) : null);

          return {
            id: Date.now() + Math.random(),
            item_name: p.item_name,
            unit: p.unit || 'g',
            current_stock: 0,
            min_stock: null,
            unit_cost: unitCost,
          };
        });

      setQuickAddItems(prev => [...prev, ...selectedItems]);
      setProductSelectModalVisible(false);
      setSelectedProducts([]);
      message.success(`${selectedItems.length}개 품목을 추가했습니다.`);
    } catch (error) {
      console.error('발주 내역 조회 실패:', error);
      // 에러가 발생해도 기본 단가로 추가
      const selectedItems = products
        .filter(p => selectedProducts.includes(p.id))
        .map(p => ({
          id: Date.now() + Math.random(),
          item_name: p.item_name,
          unit: p.unit || 'g',
          current_stock: 0,
          min_stock: null,
          unit_cost: p.unit_price ? Math.round(parseFloat(p.unit_price) || 0) : null,
        }));

      setQuickAddItems(prev => [...prev, ...selectedItems]);
      setProductSelectModalVisible(false);
      setSelectedProducts([]);
      message.success(`${selectedItems.length}개 품목을 추가했습니다.`);
    }
  };

  const handleCopyMonthClick = () => {
    copyMonthForm.setFieldsValue({
      fromMonth: dayjs().subtract(1, 'month').format('YYYY-MM'),
      toMonth: dayjs().format('YYYY-MM'),
      store: '큰길',
    });
    setCopyMonthModalVisible(true);
  };

  const handleLoadOrdersClick = () => {
    loadOrdersForm.setFieldsValue({
      month: dayjs().format('YYYY-MM'),
      store: '큰길',
    });
    setLoadOrdersModalVisible(true);
  };

  const handleLoadOrdersSubmit = async (values) => {
    try {
      const { month, store } = values;

      // 해당 월의 발주 내역 가져오기
      const startDate = dayjs(month).startOf('month').format('YYYY-MM-DD');
      const endDate = dayjs(month).endOf('month').format('YYYY-MM-DD');

      const response = await ordersAPI.getAll({
        store,
        limit: 10000, // 전체 가져오기
      });

      // 해당 월 범위의 발주만 필터링
      const ordersInMonth = response.data.data.filter(order => {
        const orderDate = order.order_date;
        return orderDate >= startDate && orderDate <= endDate;
      });

      if (ordersInMonth.length === 0) {
        message.warning(`${month} ${store} 매장의 발주 내역이 없습니다.`);
        return;
      }

      // 품목별로 수량 합산
      const itemMap = {};
      ordersInMonth.forEach(order => {
        const key = order.item_name;
        if (!itemMap[key]) {
          itemMap[key] = {
            item_name: order.item_name,
            unit: order.unit || '',
            quantity: 0,
            supplier: order.supplier || '',
            category: '', // 나중에 products에서 가져올 예정
          };
        }
        itemMap[key].quantity += order.quantity || 0;
      });

      // products에서 카테고리 정보 가져오기
      const productsResponse = await productsAPI.getAll();
      const productsMap = {};
      productsResponse.data.forEach(p => {
        productsMap[p.item_name] = p;
      });

      // 재고에 반영하기 위한 데이터 생성
      let successCount = 0;
      let skipCount = 0;

      for (const item of Object.values(itemMap)) {
        // 해당 월/매장/품목의 재고가 이미 있는지 확인
        const existingResponse = await inventoryAPI.getAll({
          month,
          store,
          limit: 1000,
        });

        const existingItem = existingResponse.data.data.find(
          inv => inv.item_name === item.item_name
        );

        if (existingItem) {
          // 기존 재고가 있으면 입고량만 업데이트
          await inventoryAPI.update(existingItem.id, {
            ...existingItem,
            current_intake: item.quantity,
            current_stock: (existingItem.previous_stock || 0) + item.quantity - (existingItem.current_consumption || 0),
          });
          successCount++;
        } else {
          // 없으면 새로 생성
          const product = productsMap[item.item_name];
          const newData = {
            month,
            store,
            category: product?.category || '기타',
            item_name: item.item_name,
            unit: item.unit,
            previous_stock: 0,
            current_intake: item.quantity,
            current_consumption: 0,
            current_stock: item.quantity,
            min_stock: product?.min_stock || null,
            unit_cost: product?.unit_price || null,
            supplier: item.supplier,
            notes: '발주내역에서 자동생성',
          };

          await inventoryAPI.create(newData);
          successCount++;
        }
      }

      message.success(`${successCount}개 품목의 입고 내역이 반영되었습니다.`);
      setLoadOrdersModalVisible(false);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('발주 내역 불러오기에 실패했습니다.');
      console.error(error);
    }
  };

  // 일일 재고 관리 - 오늘 재고 시작
  const handleDailyStartClick = () => {
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    dailyStartForm.setFieldsValue({
      today,
      yesterday,
      store: '큰길',
    });
    setDailyStartModalVisible(true);
  };

  const handleDailyStartSubmit = async (values) => {
    try {
      const { today, yesterday, store } = values;

      // 어제 재고 가져오기 (date 필드로 조회)
      const response = await inventoryAPI.getAll({
        date: yesterday,
        store,
        limit: 10000,
      });

      const yesterdayItems = response.data.data;
      if (yesterdayItems.length === 0) {
        message.warning(`${yesterday} ${store} 매장의 재고 데이터가 없습니다.`);
        return;
      }

      let successCount = 0;
      let updatedCount = 0;
      let createdCount = 0;

      // 오늘 날짜 재고 먼저 조회
      const todayResponse = await inventoryAPI.getAll({
        date: today,
        store,
        limit: 10000,
      });

      for (const item of yesterdayItems) {
        const existingToday = todayResponse.data.data.find(
          inv => inv.item_name === item.item_name
        );

        if (existingToday) {
          // 이미 있으면 전달재고만 업데이트
          await inventoryAPI.update(existingToday.id, {
            ...existingToday,
            date: today, // 날짜 필드 추가
            previous_stock: item.current_stock,
            current_stock: item.current_stock + (existingToday.current_intake || 0) - (existingToday.current_consumption || 0),
          });
          updatedCount++;
        } else {
          // 없으면 새로 생성 (어제 현재고를 오늘 시작재고로)
          const newData = {
            date: today, // 날짜 필드 추가
            store: item.store,
            category: item.category,
            item_name: item.item_name,
            unit: item.unit,
            previous_stock: item.current_stock, // 어제 현재고 → 오늘 시작재고
            current_intake: 0,
            current_consumption: 0,
            current_stock: item.current_stock,
            min_stock: item.min_stock,
            unit_cost: item.unit_cost,
            supplier: item.supplier,
            notes: `${yesterday} 재고에서 이월`,
          };

          await inventoryAPI.create(newData);
          createdCount++;
        }
        successCount++;
      }

      message.success(`${successCount}개 품목의 오늘 재고가 시작되었습니다. (신규: ${createdCount}, 업데이트: ${updatedCount})`);
      setDailyStartModalVisible(false);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('오늘 재고 시작에 실패했습니다.');
      console.error(error);
    }
  };

  const handleCopyMonthSubmit = async (values) => {
    try {
      const { fromMonth, toMonth, store } = values;

      // 원본 월 데이터 가져오기
      const response = await inventoryAPI.getAll({
        month: fromMonth,
        store,
        limit: 1000,
      });

      const sourceItems = response.data.data;
      if (sourceItems.length === 0) {
        message.warning(`${fromMonth} ${store} 매장의 재고 데이터가 없습니다.`);
        return;
      }

      // 새 월에 복사
      let successCount = 0;
      for (const item of sourceItems) {
        const newData = {
          month: toMonth,
          store: item.store,
          category: item.category,
          item_name: item.item_name,
          unit: item.unit,
          previous_stock: item.current_stock, // 이전 달 현재고 → 전달재고
          current_intake: 0,
          current_consumption: 0,
          current_stock: item.current_stock, // 초기값은 전달재고와 동일
          min_stock: item.min_stock,
          unit_cost: item.unit_cost,
          supplier: item.supplier || '',
          notes: '',
        };

        await inventoryAPI.create(newData);
        successCount++;
      }

      message.success(`${successCount}개 품목을 ${toMonth}로 복사했습니다.`);
      setCopyMonthModalVisible(false);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('월 복사에 실패했습니다.');
      console.error(error);
    }
  };

  const handleQuickAddItemChange = (itemId, field, value) => {
    setQuickAddItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  const handleAddQuickAddItem = () => {
    const newItem = {
      id: Date.now(),
      item_name: '',
      unit: '',
      current_stock: 0,
      min_stock: null,
    };
    setQuickAddItems(prev => [...prev, newItem]);
  };

  const handleRemoveQuickAddItem = (itemId) => {
    setQuickAddItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleQuickAddSubmit = async (values) => {
    try {
      const { month, store, category } = values;

      const validItems = quickAddItems.filter(item => item.item_name.trim());
      if (validItems.length === 0) {
        message.warning('최소 1개 이상의 품목을 입력하세요.');
        return;
      }

      // 카테고리에 따른 기본 공급업체
      let defaultSupplier = '';
      if (category === '원부재료') {
        defaultSupplier = '메가커피';
      } else if (category === '디저트') {
        defaultSupplier = '';
      } else if (category === '부재료') {
        defaultSupplier = '프릳츠';
      } else if (category === '티백') {
        defaultSupplier = '드시모네';
      } else if (category === '소모품') {
        defaultSupplier = '아싸컴퍼니';
      }

      let successCount = 0;
      for (const item of validItems) {
        const data = {
          month,
          store,
          category,
          item_name: item.item_name,
          unit: item.unit || '',
          previous_stock: 0,
          current_intake: 0,
          current_consumption: 0,
          current_stock: item.current_stock || 0,
          min_stock: item.min_stock || null,
          unit_cost: null,
          supplier: defaultSupplier,
          notes: '',
        };
        await inventoryAPI.create(data);
        successCount++;
      }

      message.success(`${successCount}개 품목이 등록되었습니다.`);
      setQuickAddModalVisible(false);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('빠른 재고 등록에 실패했습니다.');
      console.error(error);
    }
  };

  const handleTransfer = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('이동할 재고를 선택하세요.');
      return;
    }
    transferForm.setFieldsValue({
      from_store: '큰길',
      to_store: '태광',
    });
    setTransferModalVisible(true);
  };

  const handleTransferSubmit = async (values) => {
    try {
      const { from_store, to_store } = values;

      if (from_store === to_store) {
        message.warning('같은 매장으로는 이동할 수 없습니다.');
        return;
      }

      const selectedItems = inventory.filter(item =>
        selectedRowKeys.includes(item.id)
      );

      for (const item of selectedItems) {
        const newData = {
          ...item,
          store: to_store,
          notes: `${from_store}에서 이동`,
        };
        delete newData.id;
        delete newData.created_at;
        delete newData.updated_at;

        await inventoryAPI.create(newData);
        await inventoryAPI.delete(item.id);

        // 입출고 내역 기록
        await inventoryHistoryAPI.create({
          store: from_store,
          item_name: item.item_name,
          type: '이동',
          quantity: item.current_stock,
          unit: item.unit,
          transaction_date: dayjs().format('YYYY-MM-DD'),
          notes: `${to_store}로 이동`,
          reference_type: 'transfer',
        });
      }

      message.success(`${selectedItems.length}개 품목이 ${to_store}로 이동되었습니다.`);
      setTransferModalVisible(false);
      setSelectedRowKeys([]);
      fetchInventory();
      fetchAlerts();
    } catch (error) {
      message.error('재고 이동에 실패했습니다.');
      console.error(error);
    }
  };

  const handleViewHistory = async (record) => {
    try {
      setSelectedItemForHistory(record);
      const response = await inventoryHistoryAPI.getByItem(record.item_name, {
        store: record.store,
      });
      setHistoryData(response.data);
      setHistoryModalVisible(true);
    } catch (error) {
      message.error('입출고 내역을 불러오는데 실패했습니다.');
      console.error(error);
    }
  };

  const getStockStatus = (record) => {
    // 1. 재고 부족 체크 (최우선)
    if (record.min_stock && record.current_stock < record.min_stock) {
      const stockRatio = record.current_stock / record.min_stock;
      if (stockRatio <= 0.5) {
        return { color: 'red', text: '심각', icon: <AlertOutlined /> };
      } else {
        return { color: 'orange', text: '부족', icon: <WarningOutlined /> };
      }
    }

    // 2. 최근 발주 내역 체크 (경고)
    const sevenDaysAgo = dayjs().subtract(7, 'day').format('YYYY-MM-DD');
    const recentOrderForItem = recentOrders.find(order =>
      order.item_name === record.item_name &&
      order.store === record.store &&
      order.order_date >= sevenDaysAgo
    );

    if (!recentOrderForItem) {
      return { color: 'gold', text: '경고', icon: <WarningOutlined /> };
    }

    // 3. 정상
    return { color: 'green', text: '정상', icon: null };
  };

  const columns = [
    {
      title: '상태',
      key: 'status',
      width: 80,
      fixed: 'left',
      render: (_, record) => {
        const status = getStockStatus(record);
        return (
          <Tag color={status.color} icon={status.icon}>
            {status.text}
          </Tag>
        );
      },
    },
    {
      title: '월',
      dataIndex: 'month',
      key: 'month',
      width: 100,
      sorter: true,
    },
    {
      title: '매장',
      dataIndex: 'store',
      key: 'store',
      width: 70,
    },
    {
      title: '카테고리',
      dataIndex: 'category',
      key: 'category',
      width: 100,
    },
    {
      title: '품목',
      dataIndex: 'item_name',
      key: 'item_name',
      width: 150,
    },
    {
      title: '공급업체',
      dataIndex: 'supplier',
      key: 'supplier',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '단위',
      dataIndex: 'unit',
      key: 'unit',
      width: 60,
    },
    {
      title: '전달재고',
      dataIndex: 'previous_stock',
      key: 'previous_stock',
      width: 90,
      align: 'right',
      render: (value) => value?.toLocaleString() || '0',
    },
    {
      title: '당월입고',
      dataIndex: 'current_intake',
      key: 'current_intake',
      width: 90,
      align: 'right',
      render: (value) => value?.toLocaleString() || '0',
    },
    {
      title: '당월소비',
      dataIndex: 'current_consumption',
      key: 'current_consumption',
      width: 90,
      align: 'right',
      render: (value) => value?.toLocaleString() || '0',
    },
    {
      title: '현재고',
      dataIndex: 'current_stock',
      key: 'current_stock',
      width: 90,
      align: 'right',
      render: (value, record) => {
        const status = getStockStatus(record);
        return (
          <Text strong style={{ color: status?.color === 'red' ? '#ff4d4f' : undefined }}>
            {value?.toLocaleString() || '0'}
          </Text>
        );
      },
    },
    {
      title: '최소재고',
      dataIndex: 'min_stock',
      key: 'min_stock',
      width: 120,
      align: 'right',
      render: (value, record) => (
        <InputNumber
          size="small"
          min={0}
          value={value}
          placeholder="설정"
          style={{ width: '100%' }}
          onChange={async (newValue) => {
            try {
              await inventoryAPI.update(record.id, {
                ...record,
                min_stock: newValue,
              });
              message.success('최소재고가 설정되었습니다.');
              fetchInventory();
              fetchAlerts();
            } catch (error) {
              message.error('최소재고 설정에 실패했습니다.');
              console.error(error);
            }
          }}
        />
      ),
    },
    {
      title: '단가',
      dataIndex: 'unit_cost',
      key: 'unit_cost',
      width: 90,
      align: 'right',
      render: (value) => {
        if (!value) return '-';
        const amount = Math.round(parseFloat(value) || 0);
        return `${amount.toLocaleString()}원`;
      },
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
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            onClick={() => handleViewHistory(record)}
          >
            📋 내역
          </Button>
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
      {/* 일일 재고 관리 */}
      <Card
        title="📅 일일 재고 관리"
        style={{ marginBottom: 16 }}
        size="small"
      >
        <Space wrap>
          <Button
            type="primary"
            onClick={handleDailyStartClick}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            🌅 오늘 재고 시작
          </Button>
          <Button
            type="default"
            onClick={handleLoadOrdersClick}
            style={{ borderColor: '#1890ff', color: '#1890ff' }}
          >
            📦 입고 등록 (발주에서)
          </Button>
          <Divider type="vertical" />
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 매일 아침: "오늘 재고 시작"으로 어제 재고를 불러오세요 → 입고 등록 → 사용량 입력 → 재고 확인
          </Text>
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 재고 항목"
              value={stats.totalItems}
              suffix="개"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="재고 부족 알림"
              value={stats.lowStockItems}
              suffix="개"
              valueStyle={{ color: stats.lowStockItems > 0 ? '#ff4d4f' : '#52c41a' }}
              prefix={stats.lowStockItems > 0 ? <WarningOutlined /> : null}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="현재 월"
              value={stats.currentMonth}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Badge count={stats.lowStockItems} offset={[-10, 10]}>
              <Button
                type="primary"
                danger={stats.lowStockItems > 0}
                onClick={() => setFilters({ ...filters, lowStock: 'true' })}
                block
              >
                재고 부족 항목 보기
              </Button>
            </Badge>
          </Card>
        </Col>
      </Row>

      {alerts.length > 0 && (
        <Card
          title={
            <Space>
              <WarningOutlined style={{ color: '#ff4d4f' }} />
              <Text strong style={{ color: '#ff4d4f' }}>
                재고 부족 알림 ({alerts.length}개)
              </Text>
            </Space>
          }
          style={{ marginBottom: 16, borderColor: '#ff4d4f' }}
          size="small"
        >
          <Space wrap>
            {alerts.slice(0, 10).map(item => (
              <Tag key={item.id} color="red">
                {item.item_name}: {item.current_stock}/{item.min_stock} {item.unit}
              </Tag>
            ))}
            {alerts.length > 10 && (
              <Tag>+{alerts.length - 10}개 더...</Tag>
            )}
          </Space>
        </Card>
      )}

      <Card
        title="🔍 재고 필터"
        size="small"
        style={{
          marginBottom: 16,
          border: '2px solid #1890ff',
          background: '#f0f5ff'
        }}
      >
        <Space wrap size="large">
          <div>
            <Text strong style={{ marginRight: 8 }}>날짜별:</Text>
            <Input
              type="date"
              style={{ width: 160 }}
              value={filters.date || ''}
              onChange={(e) => setFilters({ ...filters, date: e.target.value, month: '' })}
              placeholder="날짜별"
            />
          </div>

          <Text type="secondary">또는</Text>

          <div>
            <Text strong style={{ marginRight: 8 }}>월별:</Text>
            <Input
              type="month"
              style={{ width: 150 }}
              value={filters.month || ''}
              onChange={(e) => setFilters({ ...filters, month: e.target.value, date: '' })}
              placeholder="월별"
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
            <Text strong style={{ marginRight: 8 }}>카테고리:</Text>
            <Select
              style={{ width: 120 }}
              placeholder="카테고리 선택"
              value={filters.category || undefined}
              onChange={(value) => {
                const newFilters = { ...filters };
                if (value) {
                  newFilters.category = value;
                } else {
                  delete newFilters.category;
                }
                setFilters(newFilters);
              }}
              allowClear
            >
              <Select.Option value="원부재료">원부재료</Select.Option>
              <Select.Option value="디저트">디저트</Select.Option>
              <Select.Option value="부재료">부재료</Select.Option>
              <Select.Option value="티백">티백</Select.Option>
              <Select.Option value="콤부차">콤부차</Select.Option>
              <Select.Option value="폐기">폐기</Select.Option>
            </Select>
          </div>

          <Button
            type="primary"
            onClick={() => {
              setFilters({});
            }}
            disabled={Object.keys(filters).length === 0}
          >
            🔄 필터 초기화
          </Button>
        </Space>
      </Card>

      <Space style={{ marginBottom: 16 }} wrap>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAdd}
        >
          재고 등록
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleQuickAdd}
          style={{ background: '#52c41a', borderColor: '#52c41a' }}
        >
          ⚡ 빠른 등록
        </Button>
        <Button
          type="default"
          onClick={handleCopyMonthClick}
        >
          📅 월 복사
        </Button>
        <Button
          type="default"
          onClick={handleLoadOrdersClick}
          style={{ borderColor: '#1890ff', color: '#1890ff' }}
        >
          📦 발주내역 불러오기
        </Button>
        <Button icon={<UploadOutlined />} onClick={handleImportClick}>
          엑셀 임포트
        </Button>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          엑셀 다운로드
        </Button>
        {selectedRowKeys.length > 0 && (
          <>
            <Button
              type="dashed"
              onClick={handleTransfer}
            >
              📦 재고 이동 ({selectedRowKeys.length})
            </Button>
          </>
        )}
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
      </Space>

      <Table
        columns={columns}
        dataSource={inventory}
        rowKey="id"
        loading={loading}
        pagination={pagination}
        rowSelection={rowSelection}
        onChange={(newPagination, tableFilters) => {
          setPagination(newPagination);
          // 테이블 필터는 무시하고 상단 필터만 사용
          // (테이블 필터는 배열 형태라서 백엔드와 맞지 않음)
        }}
        scroll={{ x: 1400 }}
      />

      <Modal
        title={editingItem ? '재고 수정' : '재고 등록'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        width={700}
      >
        <Form
          form={modalForm}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="month"
                label="월"
                rules={[{ required: true, message: '월을 입력하세요' }]}
              >
                <Input type="month" />
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

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="category"
                label="카테고리"
                rules={[{ required: true, message: '카테고리를 선택하세요' }]}
              >
                <Select
                  onChange={(value) => {
                    setSelectedCategory(value);
                    modalForm.setFieldsValue({ item_name: undefined });
                  }}
                >
                  <Select.Option value="원부재료">원부재료</Select.Option>
                  <Select.Option value="디저트">디저트</Select.Option>
                  <Select.Option value="부재료">부재료</Select.Option>
                  <Select.Option value="티백">티백</Select.Option>
                  <Select.Option value="콤부차">콤부차</Select.Option>
                  <Select.Option value="소모품">소모품</Select.Option>
                  <Select.Option value="시럽">시럽</Select.Option>
                  <Select.Option value="폐기">폐기</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="item_name"
                label="품목"
                rules={[{ required: true, message: '품목을 입력하세요' }]}
              >
                {selectedCategory && categoryItems[selectedCategory]?.length > 0 ? (
                  <AutoComplete
                    options={categoryItems[selectedCategory].map(item => ({ value: item }))}
                    placeholder="품목 선택 또는 직접 입력"
                    allowClear
                    filterOption={(inputValue, option) =>
                      option.value.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                    }
                  />
                ) : (
                  <Input placeholder="품목명 입력" />
                )}
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.category !== currentValues.category
                }
              >
                {({ getFieldValue }) => {
                  const category = getFieldValue('category');
                  let supplierOptions = [];

                  if (category === '원부재료') {
                    supplierOptions = ['메가커피', '쿠팡', '네이버', '아싸컴퍼니', '드시모네', '매일유통'];
                  } else if (category === '디저트') {
                    supplierOptions = [];
                  } else if (category === '부재료') {
                    supplierOptions = ['프릳츠'];
                  } else if (category === '티백') {
                    supplierOptions = ['드시모네', '매일유통'];
                  } else if (category === '소모품') {
                    supplierOptions = ['아싸컴퍼니'];
                  }

                  return (
                    <Form.Item
                      name="supplier"
                      label="공급업체"
                    >
                      <AutoComplete
                        options={supplierOptions.map(s => ({ value: s }))}
                        placeholder="공급업체 선택 또는 입력"
                        allowClear
                        filterOption={(inputValue, option) =>
                          option.value.toUpperCase().indexOf(inputValue.toUpperCase()) !== -1
                        }
                      />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="unit" label="단위">
                <Input placeholder="kg, 개 등" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="min_stock" label="최소재고">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="unit_cost" label="단가">
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

          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="previous_stock" label="전달재고">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="current_intake" label="당월입고">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="current_consumption" label="당월소비">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="current_stock" label="현재고">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.previous_stock !== currentValues.previous_stock ||
              prevValues.current_intake !== currentValues.current_intake ||
              prevValues.current_consumption !== currentValues.current_consumption
            }
          >
            {({ getFieldValue }) => {
              const prevStock = getFieldValue('previous_stock') || 0;
              const intake = getFieldValue('current_intake') || 0;
              const consumption = getFieldValue('current_consumption') || 0;
              const calculated = prevStock + intake - consumption;

              return calculated !== 0 ? (
                <Card size="small" style={{ marginBottom: 16, background: '#e6f7ff' }}>
                  <Text type="secondary">
                    계산된 재고: {calculated.toLocaleString()} (전달 {prevStock} + 입고 {intake} - 소비 {consumption})
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

      {/* 엑셀 임포트 모달 */}
      <Modal
        title="재고 엑셀 임포트"
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onOk={() => importForm.submit()}
        width={500}
      >
        <Form
          form={importForm}
          layout="vertical"
          onFinish={handleImportSubmit}
        >
          <Form.Item
            name="date"
            label="날짜 (일별 재고)"
            rules={[{ required: true, message: '날짜를 선택하세요' }]}
          >
            <Input type="date" />
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

          <Card size="small" style={{ background: '#fff7e6', marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              💡 엑셀 파일의 데이터가 선택한 날짜로 임포트됩니다.
            </Text>
          </Card>

          <Form.Item
            label="엑셀 파일"
            required
          >
            <Upload
              beforeUpload={handleFileUpload}
              accept=".xlsx,.xls"
              maxCount={1}
              onRemove={() => setUploadedFile(null)}
            >
              <Button icon={<UploadOutlined />}>파일 선택</Button>
            </Upload>
            {uploadedFile && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                선택된 파일: {uploadedFile.name}
              </Text>
            )}
          </Form.Item>

          <Card size="small" style={{ background: '#f0f5ff' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              엑셀 파일 형식 안내:
              <br />- 시트명에 따라 카테고리 자동 분류 (원부재료, 디저트, 부재료, 폐기)
              <br />- 품목명, 단위, 전달재고, 당월입고, 당월소비, 현재고 순서로 입력
            </Text>
          </Card>
        </Form>
      </Modal>

      {/* 빠른 재고 등록 모달 */}
      <Modal
        title="⚡ 빠른 재고 등록"
        open={quickAddModalVisible}
        onCancel={() => setQuickAddModalVisible(false)}
        onOk={() => quickAddForm.submit()}
        width={800}
      >
        <Form
          form={quickAddForm}
          layout="vertical"
          onFinish={handleQuickAddSubmit}
        >
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="month"
                label="월"
                rules={[{ required: true }]}
              >
                <Input type="month" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="store"
                label="매장"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="큰길">큰길</Select.Option>
                  <Select.Option value="태광">태광</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="category"
                label="카테고리"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="원부재료">원부재료</Select.Option>
                  <Select.Option value="디저트">디저트</Select.Option>
                  <Select.Option value="부재료">부재료</Select.Option>
                  <Select.Option value="티백">티백</Select.Option>
                  <Select.Option value="콤부차">콤부차</Select.Option>
                  <Select.Option value="폐기">폐기</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Divider>
            <Space>
              <span>품목 목록</span>
              <Button
                type="primary"
                size="small"
                onClick={handleProductSelectClick}
              >
                📦 품목 불러오기
              </Button>
              <Button
                type="dashed"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleAddQuickAddItem}
              >
                행 추가
              </Button>
            </Space>
          </Divider>

          <Table
            size="small"
            dataSource={quickAddItems}
            rowKey="id"
            pagination={false}
            columns={[
              {
                title: '품목명',
                width: 200,
                render: (_, record) => (
                  <Input
                    placeholder="품목명"
                    size="small"
                    value={record.item_name}
                    onChange={(e) =>
                      handleQuickAddItemChange(record.id, 'item_name', e.target.value)
                    }
                  />
                ),
              },
              {
                title: '단위',
                width: 100,
                render: (_, record) => (
                  <Input
                    placeholder="단위"
                    size="small"
                    value={record.unit}
                    onChange={(e) =>
                      handleQuickAddItemChange(record.id, 'unit', e.target.value)
                    }
                  />
                ),
              },
              {
                title: '현재고',
                width: 120,
                render: (_, record) => (
                  <InputNumber
                    placeholder="0"
                    size="small"
                    min={0}
                    style={{ width: '100%' }}
                    value={record.current_stock}
                    onChange={(value) =>
                      handleQuickAddItemChange(record.id, 'current_stock', value)
                    }
                  />
                ),
              },
              {
                title: '최소재고',
                width: 120,
                render: (_, record) => (
                  <InputNumber
                    placeholder="선택"
                    size="small"
                    min={0}
                    style={{ width: '100%' }}
                    value={record.min_stock}
                    onChange={(value) =>
                      handleQuickAddItemChange(record.id, 'min_stock', value)
                    }
                  />
                ),
              },
              {
                title: '작업',
                width: 60,
                render: (_, record) => (
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveQuickAddItem(record.id)}
                    disabled={quickAddItems.length === 1}
                  />
                ),
              },
            ]}
          />
        </Form>
      </Modal>

      {/* 재고 이동 모달 */}
      <Modal
        title="📦 재고 이동"
        open={transferModalVisible}
        onCancel={() => setTransferModalVisible(false)}
        onOk={() => transferForm.submit()}
        width={500}
      >
        <Form
          form={transferForm}
          layout="vertical"
          onFinish={handleTransferSubmit}
        >
          <Card size="small" style={{ marginBottom: 16, background: '#e6f7ff' }}>
            <Text strong>선택된 품목: {selectedRowKeys.length}개</Text>
          </Card>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="from_store"
                label="출발 매장"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="큰길">큰길</Select.Option>
                  <Select.Option value="태광">태광</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="to_store"
                label="도착 매장"
                rules={[{ required: true }]}
              >
                <Select>
                  <Select.Option value="큰길">큰길</Select.Option>
                  <Select.Option value="태광">태광</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffa940' }}>
            <Text type="warning" style={{ fontSize: 12 }}>
              ⚠️ 주의: 재고 이동은 출발 매장에서 해당 품목을 삭제하고 도착 매장에 추가합니다.
            </Text>
          </Card>
        </Form>
      </Modal>

      {/* 입출고 내역 모달 */}
      <Modal
        title={
          selectedItemForHistory ? (
            <Space>
              <span>📋 입출고 내역</span>
              <Tag color="blue">{selectedItemForHistory.item_name}</Tag>
              <Tag>{selectedItemForHistory.store}</Tag>
            </Space>
          ) : (
            '📋 입출고 내역'
          )
        }
        open={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setSelectedItemForHistory(null);
          setHistoryData([]);
        }}
        footer={null}
        width={800}
      >
        {selectedItemForHistory && (
          <Card size="small" style={{ marginBottom: 16, background: '#f0f5ff' }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic
                  title="현재고"
                  value={selectedItemForHistory.current_stock}
                  suffix={selectedItemForHistory.unit}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="당월입고"
                  value={selectedItemForHistory.current_intake}
                  suffix={selectedItemForHistory.unit}
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="당월소비"
                  value={selectedItemForHistory.current_consumption}
                  suffix={selectedItemForHistory.unit}
                  valueStyle={{ color: '#ff4d4f' }}
                />
              </Col>
            </Row>
          </Card>
        )}

        <Table
          size="small"
          dataSource={historyData}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: '일자',
              dataIndex: 'transaction_date',
              width: 110,
            },
            {
              title: '구분',
              dataIndex: 'type',
              width: 80,
              render: (type) => {
                const colors = {
                  입고: 'green',
                  출고: 'red',
                  이동: 'blue',
                  조정: 'orange',
                };
                return <Tag color={colors[type]}>{type}</Tag>;
              },
            },
            {
              title: '수량',
              dataIndex: 'quantity',
              width: 100,
              align: 'right',
              render: (value, record) => (
                <Text strong>
                  {value?.toLocaleString()} {record.unit}
                </Text>
              ),
            },
            {
              title: '비고',
              dataIndex: 'notes',
              ellipsis: true,
            },
            {
              title: '등록일시',
              dataIndex: 'created_at',
              width: 160,
              render: (value) => dayjs(value).format('YYYY-MM-DD HH:mm'),
            },
          ]}
        />

        {historyData.length === 0 && (
          <Card style={{ textAlign: 'center', padding: '40px' }}>
            <Text type="secondary">입출고 내역이 없습니다.</Text>
          </Card>
        )}
      </Modal>

      {/* 품목 선택 모달 */}
      <Modal
        title="📦 품목 선택"
        open={productSelectModalVisible}
        onCancel={() => {
          setProductSelectModalVisible(false);
          setSelectedProducts([]);
          setProductCategoryFilter('all');
          setProductSupplierFilter('all');
        }}
        onOk={handleProductsSelected}
        width={900}
        okText="선택 완료"
        cancelText="취소"
      >
        <Space style={{ marginBottom: 16 }} wrap>
          <span style={{ fontWeight: 'bold' }}>필터:</span>
          <Select
            style={{ width: 150 }}
            value={productCategoryFilter}
            onChange={setProductCategoryFilter}
          >
            <Select.Option value="all">전체 카테고리</Select.Option>
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

          <Select
            style={{ width: 150 }}
            value={productSupplierFilter}
            onChange={setProductSupplierFilter}
          >
            <Select.Option value="all">전체 공급업체</Select.Option>
            <Select.Option value="메가커피">메가커피</Select.Option>
            <Select.Option value="쿠팡">쿠팡</Select.Option>
            <Select.Option value="아싸컴퍼니">아싸컴퍼니</Select.Option>
            <Select.Option value="프릳츠">프릳츠</Select.Option>
            <Select.Option value="드시모네">드시모네</Select.Option>
            <Select.Option value="매일유통">매일유통</Select.Option>
            <Select.Option value="네이버">네이버</Select.Option>
          </Select>

          <Text type="secondary">
            (필터링: {products.filter(p => {
              const categoryMatch = productCategoryFilter === 'all' || p.category === productCategoryFilter;
              const supplierMatch = productSupplierFilter === 'all' || p.supplier === productSupplierFilter;
              return categoryMatch && supplierMatch;
            }).length}개 / 전체: {products.length}개)
          </Text>
        </Space>

        <Table
          size="small"
          dataSource={products.filter(p => {
            const categoryMatch = productCategoryFilter === 'all' || p.category === productCategoryFilter;
            const supplierMatch = productSupplierFilter === 'all' || p.supplier === productSupplierFilter;
            return categoryMatch && supplierMatch;
          })}
          rowKey="id"
          rowSelection={{
            selectedRowKeys: selectedProducts,
            onChange: (keys) => setSelectedProducts(keys),
          }}
          pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'] }}
          columns={[
            {
              title: '품목명',
              dataIndex: 'item_name',
              width: 250,
            },
            {
              title: '카테고리',
              dataIndex: 'category',
              width: 100,
              render: (category) => {
                const colors = {
                  파우더: 'blue',
                  청: 'green',
                  시럽: 'orange',
                  원두: 'brown',
                  소모품: 'purple',
                  우유: 'cyan',
                  기타: 'default',
                };
                return <Tag color={colors[category] || 'default'}>{category}</Tag>;
              },
            },
            {
              title: '단위',
              dataIndex: 'unit',
              width: 80,
            },
            {
              title: '단가',
              dataIndex: 'unit_price',
              width: 100,
              render: (price) => {
                if (!price) return '-';
                const amount = Math.round(parseFloat(price) || 0);
                return `${amount.toLocaleString()}원`;
              },
            },
            {
              title: '공급업체',
              dataIndex: 'supplier',
              ellipsis: true,
            },
          ]}
        />
      </Modal>

      {/* 월 복사 모달 */}
      <Modal
        title="📅 월 복사"
        open={copyMonthModalVisible}
        onCancel={() => setCopyMonthModalVisible(false)}
        onOk={() => copyMonthForm.submit()}
        width={500}
      >
        <Form
          form={copyMonthForm}
          layout="vertical"
          onFinish={handleCopyMonthSubmit}
        >
          <Form.Item
            name="fromMonth"
            label="복사할 원본 월"
            rules={[{ required: true, message: '원본 월을 선택하세요' }]}
          >
            <Input type="month" />
          </Form.Item>

          <Form.Item
            name="toMonth"
            label="복사될 대상 월"
            rules={[{ required: true, message: '대상 월을 선택하세요' }]}
          >
            <Input type="month" />
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

          <Card size="small" style={{ background: '#f0f5ff' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              • 원본 월의 "현재고"가 대상 월의 "전달재고"로 복사됩니다.
              <br />• 대상 월의 현재고는 전달재고와 동일하게 초기화됩니다.
              <br />• 입고/소비는 0으로 초기화됩니다.
            </Text>
          </Card>
        </Form>
      </Modal>

      {/* 발주내역 불러오기 모달 */}
      <Modal
        title="📦 발주내역 불러오기"
        open={loadOrdersModalVisible}
        onCancel={() => setLoadOrdersModalVisible(false)}
        onOk={() => loadOrdersForm.submit()}
        width={500}
      >
        <Form
          form={loadOrdersForm}
          layout="vertical"
          onFinish={handleLoadOrdersSubmit}
        >
          <Form.Item
            name="month"
            label="발주 월"
            rules={[{ required: true, message: '월을 선택하세요' }]}
          >
            <Input type="month" />
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

          <Card size="small" style={{ background: '#fff7e6' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <strong>📋 작동 방식:</strong>
              <br />• 선택한 월의 모든 발주 내역을 품목별로 합산합니다.
              <br />• 재고가 이미 있으면 "입고량"만 업데이트됩니다.
              <br />• 재고가 없으면 새로 생성하고 입고량을 설정합니다.
              <br />• 현재고 = 전달재고 + 입고량 - 소비량으로 자동 계산됩니다.
            </Text>
          </Card>
        </Form>
      </Modal>

      {/* 오늘 재고 시작 모달 */}
      <Modal
        title="🌅 오늘 재고 시작"
        open={dailyStartModalVisible}
        onCancel={() => setDailyStartModalVisible(false)}
        onOk={() => dailyStartForm.submit()}
        width={500}
      >
        <Form
          form={dailyStartForm}
          layout="vertical"
          onFinish={handleDailyStartSubmit}
        >
          <Card size="small" style={{ background: '#f0f5ff', marginBottom: 16 }}>
            <Text strong style={{ color: '#1890ff' }}>
              📌 어제 재고를 오늘 시작 재고로 불러옵니다
            </Text>
          </Card>

          <Form.Item
            name="yesterday"
            label="어제 날짜"
            rules={[{ required: true }]}
          >
            <Input type="date" />
          </Form.Item>

          <Form.Item
            name="today"
            label="오늘 날짜"
            rules={[{ required: true }]}
          >
            <Input type="date" />
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

          <Card size="small" style={{ background: '#fff7e6' }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <strong>📋 작동 방식:</strong>
              <br />• 어제의 "현재고"가 오늘의 "시작재고(전달재고)"가 됩니다.
              <br />• 오늘 날짜에 이미 재고가 있으면 시작재고만 업데이트됩니다.
              <br />• 없으면 새로 생성됩니다.
              <br />• 입고량과 사용량은 0으로 시작됩니다.
            </Text>
          </Card>
        </Form>
      </Modal>
    </div>
  );
};

export default InventoryPage;
