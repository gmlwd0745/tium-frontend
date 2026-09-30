import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Table,
  Button,
  Space,
  Alert,
  Typography,
  Tag,
  Popconfirm,
  Empty,
  message,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { inventoryAPI } from '../../services/api';

const { Text } = Typography;

// 품목명 비교용 정규화 (앞뒤 공백 제거, 연속 공백 하나로)
const normalizeName = (name) => (name || '').toString().trim().replace(/\s+/g, ' ');

// 등록 기준일 문자열 (일별 date 우선, 없으면 월)
const recordDateText = (item) => {
  if (item.date) {
    const d = dayjs(item.date);
    return d.isValid() ? d.format('YYYY-MM-DD') : String(item.date);
  }
  return item.month || '-';
};

// 정렬용 키: 날짜/월 → id
const sortKey = (item) => `${recordDateText(item)}|${String(item.id).padStart(10, '0')}`;

/**
 * 재고 중복 데이터 정리 모달
 * - 기준: 같은 매장 + 같은 품목명 (날짜 무관)
 * - 검사 범위: 재고 화면 상단 필터(매장/월/날짜/카테고리)
 * - 사용자가 직접 체크한 항목만 삭제 (자동 삭제 없음)
 */
const DuplicateCleanupModal = ({ open, onClose, filters, onDeleted }) => {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [groups, setGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // 검사 범위 필터 (재고부족 필터는 제외)
  const scopeFilters = useMemo(() => {
    const f = {};
    if (filters?.store) f.store = filters.store;
    if (filters?.date) f.date = filters.date;
    else if (filters?.month) f.month = filters.month;
    if (filters?.category) f.category = filters.category;
    return f;
  }, [filters]);

  const scopeText = [
    scopeFilters.store ? `매장: ${scopeFilters.store}` : '매장: 전체',
    scopeFilters.date
      ? `날짜: ${scopeFilters.date}`
      : scopeFilters.month
        ? `월: ${scopeFilters.month}`
        : '기간: 전체',
    scopeFilters.category ? `카테고리: ${scopeFilters.category}` : '카테고리: 전체',
  ];

  const findDuplicates = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const response = await inventoryAPI.getAll({ ...scopeFilters, page: 1, limit: 100000 });
      const items = response.data.data || [];

      const map = new Map();
      items.forEach((item) => {
        const key = `${item.store}||${normalizeName(item.item_name)}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
      });

      const result = [];
      map.forEach((list, key) => {
        if (list.length < 2) return;
        const sorted = [...list].sort((a, b) => sortKey(b).localeCompare(sortKey(a))); // 최신 먼저
        result.push({
          key,
          store: sorted[0].store,
          item_name: normalizeName(sorted[0].item_name),
          items: sorted,
        });
      });
      result.sort((a, b) =>
        a.store === b.store ? a.item_name.localeCompare(b.item_name) : a.store.localeCompare(b.store)
      );
      setGroups(result);
    } catch (error) {
      console.error(error);
      message.error('중복 데이터를 불러오지 못했습니다.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) findDuplicates();
  }, [open]);

  const toggle = (id, checked) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  // 편의 기능: 각 그룹에서 가장 최근 1건만 남기고 나머지 선택 (삭제는 아님)
  const selectAllButLatest = () => {
    const ids = [];
    groups.forEach((g) => g.items.slice(1).forEach((item) => ids.push(item.id)));
    setSelectedIds(ids);
  };

  // 한 그룹의 전체 항목을 모두 지우는 경우 경고용
  const fullyDeletedGroups = groups.filter((g) => g.items.every((item) => selectedIds.includes(item.id)));

  const handleDelete = async () => {
    setDeleting(true);
    let success = 0;
    const failed = [];
    for (const id of selectedIds) {
      try {
        await inventoryAPI.delete(id);
        success++;
      } catch (error) {
        console.error('삭제 실패:', id, error);
        failed.push(id);
      }
    }
    setDeleting(false);
    if (failed.length === 0) {
      message.success(`${success}건의 중복 데이터를 삭제했습니다.`);
    } else {
      message.warning(`${success}건 삭제, ${failed.length}건 실패했습니다. 다시 확인해 주세요.`);
    }
    onDeleted?.();
    findDuplicates();
  };

  const columns = [
    {
      title: '삭제',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <input
          type="checkbox"
          style={{ width: 16, height: 16, cursor: 'pointer' }}
          checked={selectedIds.includes(record.id)}
          onChange={(e) => toggle(record.id, e.target.checked)}
        />
      ),
    },
    { title: '날짜/월', width: 110, render: (_, r) => recordDateText(r) },
    { title: '카테고리', dataIndex: 'category', width: 90 },
    { title: '품목명(원본)', dataIndex: 'item_name' },
    { title: '단위', dataIndex: 'unit', width: 60 },
    { title: '전달재고', dataIndex: 'previous_stock', width: 80, align: 'right' },
    { title: '입고', dataIndex: 'current_intake', width: 70, align: 'right' },
    { title: '소비', dataIndex: 'current_consumption', width: 70, align: 'right' },
    { title: '현재고', dataIndex: 'current_stock', width: 80, align: 'right' },
    { title: '비고', dataIndex: 'notes', ellipsis: true },
    { title: 'ID', dataIndex: 'id', width: 70 },
  ];

  const totalDupRows = groups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <Modal
      title="🧹 중복 데이터 정리"
      open={open}
      onCancel={onClose}
      width={1100}
      footer={[
        <Button key="close" onClick={onClose}>
          닫기
        </Button>,
        <Popconfirm
          key="delete"
          title={`선택한 ${selectedIds.length}건을 삭제할까요?`}
          description={
            fullyDeletedGroups.length > 0
              ? `⚠️ ${fullyDeletedGroups.length}개 품목은 남는 데이터 없이 전부 삭제됩니다. 삭제 후 되돌릴 수 없습니다.`
              : '삭제 후에는 되돌릴 수 없습니다.'
          }
          onConfirm={handleDelete}
          okText="삭제"
          okButtonProps={{ danger: true }}
          cancelText="취소"
          disabled={selectedIds.length === 0}
        >
          <Button danger type="primary" icon={<DeleteOutlined />} disabled={selectedIds.length === 0} loading={deleting}>
            선택 항목 삭제 ({selectedIds.length})
          </Button>
        </Popconfirm>,
      ]}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="middle">
        <Alert
          type="info"
          showIcon
          title="같은 매장 + 같은 품목명으로 2건 이상 등록된 데이터를 묶어서 보여 줍니다. (날짜 무관)"
          description={
            <div>
              <div>
                검사 범위: {scopeText.map((t) => <Tag key={t}>{t}</Tag>)}
                <Text type="secondary">(재고 화면 상단 필터 기준)</Text>
              </div>
              <div style={{ marginTop: 4 }}>
                체크한 항목만 삭제됩니다. 각 묶음은 최신 등록 건이 맨 위에 있습니다.
              </div>
            </div>
          }
        />
        {!scopeFilters.date && !scopeFilters.month && (
          <Alert
            type="warning"
            showIcon
            title="기간 필터가 없어 다른 달·다른 날짜의 정상 기록도 함께 묶여 보일 수 있습니다. 날짜/월을 꼭 확인하고 선택해 주세요."
          />
        )}

        <Space wrap>
          <Text>
            중복 품목 <Text strong>{groups.length}</Text>개 · 관련 데이터 <Text strong>{totalDupRows}</Text>건
          </Text>
          <Button size="small" onClick={selectAllButLatest} disabled={groups.length === 0}>
            각 품목 최신 1건만 남기고 선택
          </Button>
          <Button size="small" onClick={() => setSelectedIds([])} disabled={selectedIds.length === 0}>
            선택 해제
          </Button>
          <Button size="small" onClick={findDuplicates} loading={loading}>
            다시 검사
          </Button>
        </Space>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {!loading && groups.length === 0 ? (
            <Empty description="중복 데이터가 없습니다." />
          ) : (
            groups.map((g) => (
              <div key={g.key} style={{ marginBottom: 16 }}>
                <Space style={{ marginBottom: 6 }}>
                  <Tag color="blue">{g.store}</Tag>
                  <Text strong>{g.item_name}</Text>
                  <Tag color="orange">{g.items.length}건</Tag>
                </Space>
                <Table
                  size="small"
                  rowKey="id"
                  columns={columns}
                  dataSource={g.items}
                  pagination={false}
                  loading={loading}
                  scroll={{ x: 900 }}
                  onRow={(record) => ({
                    style: selectedIds.includes(record.id) ? { background: '#fff1f0' } : undefined,
                  })}
                />
              </div>
            ))
          )}
        </div>
      </Space>
    </Modal>
  );
};

export default DuplicateCleanupModal;
