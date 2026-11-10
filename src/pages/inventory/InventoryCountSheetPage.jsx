import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Empty,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import { PrinterOutlined, SaveOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { inventoryAPI, productsAPI } from '../../services/api';
import './countSheet.css';

const { Text } = Typography;

const STORES = ['큰길', '태광'];
// 실사표에 표시할 카테고리 순서 (목록에 없는 카테고리는 뒤에 가나다순)
const CATEGORY_ORDER = ['원부재료', '부재료', '식재료', '시럽', '티백', '콤부차', '디저트', '소모품', '폐기'];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (v) => {
  const n = num(v);
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};
const recordTime = (r) => {
  const d = r.date ? dayjs(r.date) : null;
  return d && d.isValid() ? d.valueOf() : 0;
};
const normName = (v) => (v || '').toString().replace(/\s+/g, '').toLowerCase();
const draftKey = (store, month) => `tium-count-draft:${store}:${month}`;

/**
 * 재고 실사표: 매장·월을 골라 실사표를 인쇄하고,
 * 종이에 적은 실사 수량을 같은 순서로 입력해 해당 월 현재고에 반영한다.
 * - 저장 시 바꾸는 칸: 현재고(실사 수량), 당월소비(전달재고+입고−실사), 비고(수정한 경우만)
 * - 그 외 칸은 기존 값을 그대로 다시 보낸다 (백엔드 PUT이 빠진 칸을 비우기 때문)
 */
const InventoryCountSheetPage = () => {
  const [store, setStore] = useState('큰길');
  const [month, setMonth] = useState(dayjs());
  const [mode, setMode] = useState('print');
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierMap, setSupplierMap] = useState(new Map()); // 품목 마스터: 품목명 → 발주처
  const [blind, setBlind] = useState(false);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [counts, setCounts] = useState({}); // { [id]: number }
  const [notes, setNotes] = useState({}); // { [id]: string }
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRefs = useRef({});

  const monthStr = month.format('YYYY-MM');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await inventoryAPI.getAll({ store, month: monthStr, page: 1, limit: 5000 });
      const rows = res.data?.data || [];
      // 같은 품목이 여러 건(일별 기록 등)이면 가장 최근 기록 1건만 실사 대상으로 사용
      const latest = new Map();
      rows.forEach((r) => {
        const key = `${r.category || ''}|${(r.item_name || '').trim()}`;
        const prev = latest.get(key);
        if (!prev || recordTime(r) > recordTime(prev) || (recordTime(r) === recordTime(prev) && r.id > prev.id)) {
          latest.set(key, r);
        }
      });
      setDuplicateCount(rows.length - latest.size);
      setRecords([...latest.values()]);
      // 임시 저장된 입력값 복원
      let draft = null;
      try {
        draft = JSON.parse(localStorage.getItem(draftKey(store, monthStr)) || 'null');
      } catch {
        draft = null;
      }
      setCounts(draft?.counts || {});
      setNotes(draft?.notes || {});
      if (draft && Object.keys(draft.counts || {}).length > 0) {
        message.info('이전에 입력하던 실사 수량을 불러왔습니다.');
      }
    } catch (e) {
      console.error(e);
      message.error('재고 데이터를 불러오지 못했습니다.');
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // 재고 기록에 발주처가 비어 있으면 품목 마스터의 발주처로 보여준다 (화면 표시만, 저장값은 그대로)
  useEffect(() => {
    productsAPI
      .getAll()
      .then((res) => {
        const m = new Map();
        (Array.isArray(res.data) ? res.data : []).forEach((p) => {
          if (p.supplier && !m.has(normName(p.item_name))) m.set(normName(p.item_name), p.supplier);
        });
        setSupplierMap(m);
      })
      .catch((e) => console.error('품목 마스터 조회 실패:', e));
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, monthStr]);

  // 입력값 임시 저장 (새로고침해도 유지)
  useEffect(() => {
    try {
      if (Object.keys(counts).length === 0 && Object.keys(notes).length === 0) {
        localStorage.removeItem(draftKey(store, monthStr));
      } else {
        localStorage.setItem(draftKey(store, monthStr), JSON.stringify({ counts, notes }));
      }
    } catch {
      /* 저장 공간을 못 쓰는 환경이면 무시 */
    }
  }, [counts, notes, store, monthStr]);

  const allCategories = useMemo(() => {
    const set = [...new Set(records.map((r) => r.category || '기타'))];
    return set.sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return a.localeCompare(b, 'ko');
    });
  }, [records]);

  const supplierOf = (r) => (r.supplier || '').trim() || supplierMap.get(normName(r.item_name)) || '';

  const allSuppliers = useMemo(
    () => [...new Set(records.map((r) => supplierOf(r) || '미지정'))].sort((a, b) => a.localeCompare(b, 'ko')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [records, supplierMap],
  );

  // 카테고리 → 품목명 순으로 정렬하고 인쇄·입력에 같은 번호를 붙인다
  const rows = useMemo(() => {
    const visible = records.filter(
      (r) =>
        (categories.length === 0 || categories.includes(r.category || '기타')) &&
        (suppliers.length === 0 || suppliers.includes(supplierOf(r) || '미지정')),
    );
    const sorted = [...visible].sort((a, b) => {
      const ca = allCategories.indexOf(a.category || '기타');
      const cb = allCategories.indexOf(b.category || '기타');
      if (ca !== cb) return ca - cb;
      return (a.item_name || '').localeCompare(b.item_name || '', 'ko');
    });
    return sorted.map((r, i) => {
      const prev = num(r.previous_stock);
      const intake = num(r.current_intake);
      const book = num(r.current_stock);
      return { ...r, no: i + 1, _prev: prev, _intake: intake, _book: book, _cat: r.category || '기타', _sup: supplierOf(r) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, categories, suppliers, allCategories, supplierMap]);

  const grouped = useMemo(() => {
    const g = [];
    rows.forEach((r) => {
      const last = g[g.length - 1];
      if (last && last.category === r._cat) last.items.push(r);
      else g.push({ category: r._cat, items: [r] });
    });
    return g;
  }, [rows]);

  const enteredCount = rows.filter((r) => counts[r.id] !== undefined && counts[r.id] !== null).length;

  const changes = useMemo(
    () =>
      rows
        .filter((r) => {
          const c = counts[r.id];
          const hasCount = c !== undefined && c !== null;
          const noteChanged = notes[r.id] !== undefined && notes[r.id] !== (r.notes || '');
          return (hasCount && num(c) !== r._book) || noteChanged;
        })
        .map((r) => {
          const c = counts[r.id];
          const hasCount = c !== undefined && c !== null;
          const actual = hasCount ? num(c) : r._book;
          return {
            ...r,
            _actual: actual,
            _diff: actual - r._book,
            _consumption: hasCount ? r._prev + r._intake - actual : num(r.current_consumption),
            _countChanged: hasCount && num(c) !== r._book,
            _newNotes: notes[r.id] !== undefined ? notes[r.id] : r.notes || '',
          };
        }),
    [rows, counts, notes],
  );

  const handlePrint = () => {
    if (rows.length === 0) {
      message.warning('인쇄할 품목이 없습니다.');
      return;
    }
    window.print();
  };

  const focusNext = (index) => {
    const next = rows[index + 1];
    if (next && inputRefs.current[next.id]) {
      inputRefs.current[next.id].focus();
      inputRefs.current[next.id].select?.();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    let ok = 0;
    const failed = [];
    for (const r of changes) {
      // 기존 기록의 모든 칸을 그대로 보내고 현재고·소비량·비고만 바꾼다
      const payload = {
        month: r.month,
        store: r.store,
        category: r.category,
        item_name: r.item_name,
        unit: r.unit,
        previous_stock: r.previous_stock,
        current_intake: r.current_intake,
        current_consumption: r._countChanged ? r._consumption : r.current_consumption,
        current_stock: r._countChanged ? r._actual : r.current_stock,
        min_stock: r.min_stock,
        unit_cost: r.unit_cost,
        supplier: r.supplier,
        notes: r._newNotes,
      };
      try {
        await inventoryAPI.update(r.id, payload);
        ok++;
      } catch (e) {
        console.error(e);
        failed.push(r.item_name);
      }
    }
    setSaving(false);
    setPreviewOpen(false);
    if (failed.length === 0) {
      message.success(`${ok}개 품목의 실사 결과를 반영했습니다.`);
      setCounts({});
      setNotes({});
      try {
        localStorage.removeItem(draftKey(store, monthStr));
      } catch {
        /* 무시 */
      }
    } else {
      message.error(`${ok}개 반영, ${failed.length}개 실패: ${failed.slice(0, 5).join(', ')}${failed.length > 5 ? ' 외' : ''}`);
    }
    fetchData();
  };

  const resetInputs = () => {
    Modal.confirm({
      title: '입력한 실사 수량을 모두 지울까요?',
      content: '저장하지 않은 입력값만 지워지며, 재고 데이터는 바뀌지 않습니다.',
      okText: '지우기',
      cancelText: '취소',
      onOk: () => {
        setCounts({});
        setNotes({});
      },
    });
  };

  const inputColumns = [
    { title: 'No', dataIndex: 'no', width: 56, align: 'center' },
    { title: '구분', dataIndex: '_cat', width: 96, render: (v) => <Tag>{v}</Tag> },
    { title: '품목', dataIndex: 'item_name', ellipsis: true },
    { title: '발주처', dataIndex: '_sup', width: 110, ellipsis: true, render: (v) => v || <Text type="secondary">-</Text> },
    { title: '단위', dataIndex: 'unit', width: 70, align: 'center' },
    { title: '전달재고', dataIndex: '_prev', width: 90, align: 'right', render: fmt },
    { title: '당월입고', dataIndex: '_intake', width: 90, align: 'right', render: fmt },
    { title: '장부재고', dataIndex: '_book', width: 90, align: 'right', render: fmt },
    {
      title: '실사 수량',
      key: 'count',
      width: 130,
      render: (_, r, index) => (
        <InputNumber
          ref={(el) => {
            inputRefs.current[r.id] = el;
          }}
          value={counts[r.id] ?? null}
          min={0}
          step={1}
          placeholder="입력"
          style={{ width: '100%' }}
          onChange={(v) =>
            setCounts((prev) => {
              const next = { ...prev };
              if (v === null || v === undefined) delete next[r.id];
              else next[r.id] = v;
              return next;
            })
          }
          onPressEnter={() => focusNext(index)}
        />
      ),
    },
    {
      title: '차이',
      key: 'diff',
      width: 80,
      align: 'right',
      render: (_, r) => {
        const c = counts[r.id];
        if (c === undefined || c === null) return <Text type="secondary">-</Text>;
        const d = num(c) - r._book;
        if (d === 0) return <Text type="secondary">0</Text>;
        return <Text type={d < 0 ? 'danger' : 'success'}>{d > 0 ? '+' : ''}{fmt(d)}</Text>;
      },
    },
    {
      title: '비고',
      key: 'notes',
      width: 180,
      render: (_, r) => (
        <Input
          size="small"
          value={notes[r.id] ?? r.notes ?? ''}
          onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
        />
      ),
    },
  ];

  const previewColumns = [
    { title: 'No', dataIndex: 'no', width: 50 },
    { title: '품목', dataIndex: 'item_name' },
    { title: '장부재고', dataIndex: '_book', align: 'right', render: fmt },
    { title: '→ 실사(새 현재고)', dataIndex: '_actual', align: 'right', render: (v) => <b>{fmt(v)}</b> },
    {
      title: '차이',
      dataIndex: '_diff',
      align: 'right',
      render: (d) => (d === 0 ? '0' : <Text type={d < 0 ? 'danger' : 'success'}>{d > 0 ? '+' : ''}{fmt(d)}</Text>),
    },
    {
      title: '당월소비',
      key: 'cons',
      align: 'right',
      render: (_, r) =>
        r._consumption < 0 ? (
          <Text type="warning">{fmt(r._consumption)} ⚠</Text>
        ) : (
          `${fmt(r.current_consumption)} → ${fmt(r._consumption)}`
        ),
    },
  ];

  const negativeConsumption = changes.filter((c) => c._countChanged && c._consumption < 0);

  return (
    <div className="count-sheet-page">
      {/* ── 화면용 조작부 (인쇄 시 숨김) ── */}
      <Card className="no-print" size="small" style={{ marginBottom: 16 }}>
        <Space wrap size="middle">
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { label: '🖨️ 실사표 인쇄', value: 'print' },
              { label: '✏️ 실사 수량 입력', value: 'input' },
            ]}
          />
          <Select value={store} onChange={setStore} style={{ width: 100 }} options={STORES.map((s) => ({ value: s, label: s }))} />
          <DatePicker picker="month" value={month} onChange={(v) => v && setMonth(v)} allowClear={false} format="YYYY년 MM월" />
          <Select
            mode="multiple"
            allowClear
            placeholder="전체 카테고리"
            value={categories}
            onChange={setCategories}
            style={{ minWidth: 200 }}
            options={allCategories.map((c) => ({ value: c, label: c }))}
            maxTagCount="responsive"
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="전체 발주처"
            value={suppliers}
            onChange={setSuppliers}
            style={{ minWidth: 180 }}
            options={allSuppliers.map((c) => ({ value: c, label: c }))}
            maxTagCount="responsive"
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>새로고침</Button>
          {mode === 'print' ? (
            <>
              <Checkbox checked={blind} onChange={(e) => setBlind(e.target.checked)}>
                장부 수량 가리기
              </Checkbox>
              <Button type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>인쇄</Button>
            </>
          ) : (
            <>
              <Button onClick={resetInputs} disabled={enteredCount === 0 && Object.keys(notes).length === 0}>입력 초기화</Button>
              <Button type="primary" icon={<SaveOutlined />} disabled={changes.length === 0} onClick={() => setPreviewOpen(true)}>
                변경 내용 확인 후 저장 ({changes.length})
              </Button>
            </>
          )}
        </Space>
        {duplicateCount > 0 && (
          <Alert
            style={{ marginTop: 12 }}
            type="info"
            showIcon
            title={`같은 품목이 여러 건 있는 경우(${duplicateCount}건) 가장 최근 기록만 실사표에 넣었습니다.`}
          />
        )}
      </Card>

      <Spin spinning={loading}>
        {!loading && records.length === 0 ? (
          <Empty
            className="no-print"
            description={
              <span>
                {store} {month.format('YYYY년 M월')} 재고 데이터가 없습니다.
                <br />
                재고 관리 화면에서 &apos;월 복사&apos;로 먼저 이번 달 품목을 만들어 주세요.
              </span>
            }
          />
        ) : mode === 'print' ? (
          /* ── 인쇄용 실사표 ── */
          <div className="count-sheet">
            <div className="cs-head">
              <div className="cs-title">🌱 틔움 재고 실사표</div>
              <div className="cs-sub">
                {store}점 · {month.format('YYYY년 M월')}
                {categories.length > 0 && ` · ${categories.join(', ')}`}
                {suppliers.length > 0 && ` · 발주처: ${suppliers.join(', ')}`} · 총 {rows.length}품목
              </div>
              <table className="cs-sign">
                <tbody>
                  <tr>
                    <th>실사일</th><td>&nbsp;&nbsp;&nbsp;&nbsp;년&nbsp;&nbsp;&nbsp;&nbsp;월&nbsp;&nbsp;&nbsp;&nbsp;일</td>
                    <th>실사자</th><td />
                    <th>확인자</th><td />
                  </tr>
                </tbody>
              </table>
            </div>
            <table className="cs-table">
              <colgroup>
                <col style={{ width: '5%' }} />
                <col />
                <col style={{ width: '13%' }} />
                <col style={{ width: '7%' }} />
                {!blind && <col style={{ width: '8%' }} />}
                {!blind && <col style={{ width: '8%' }} />}
                {!blind && <col style={{ width: '8%' }} />}
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>No</th>
                  <th>품목</th>
                  <th>발주처</th>
                  <th>단위</th>
                  {!blind && <th>전달재고</th>}
                  {!blind && <th>당월입고</th>}
                  {!blind && <th>장부재고</th>}
                  <th className="cs-write">실사 수량</th>
                  <th>비고</th>
                </tr>
              </thead>
              {grouped.map((g) => (
                <tbody key={g.category}>
                  <tr className="cs-cat">
                    <td colSpan={blind ? 6 : 9}>{g.category} ({g.items.length})</td>
                  </tr>
                  {g.items.map((r) => (
                    <tr key={r.id}>
                      <td className="c">{r.no}</td>
                      <td>{r.item_name}</td>
                      <td className="cs-sup">{r._sup}</td>
                      <td className="c">{r.unit || ''}</td>
                      {!blind && <td className="r">{fmt(r._prev)}</td>}
                      {!blind && <td className="r">{fmt(r._intake)}</td>}
                      {!blind && <td className="r">{fmt(r._book)}</td>}
                      <td className="cs-write" />
                      <td />
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
            <div className="cs-foot">
              출력 {dayjs().format('YYYY-MM-DD HH:mm')} · 입력은 관리자페이지 &gt; 재고 &gt; 재고 실사표 &gt; &apos;실사 수량 입력&apos;에서 같은 No 순서로 입력
            </div>
          </div>
        ) : (
          /* ── 실사 수량 입력 ── */
          <div className="no-print">
            <Alert
              style={{ marginBottom: 12 }}
              type="info"
              showIcon
              icon={<EditOutlined />}
              title={`실사표의 No 순서대로 입력하세요. Enter를 누르면 다음 품목으로 넘어갑니다. (${enteredCount}/${rows.length} 입력)`}
              description="빈칸으로 둔 품목은 바뀌지 않습니다. 저장하면 해당 월 기록의 현재고가 실사 수량으로, 당월소비가 '전달재고+당월입고−실사 수량'으로 바뀌고 나머지 칸은 그대로입니다."
            />
            <Table
              size="small"
              rowKey="id"
              columns={inputColumns}
              dataSource={rows}
              pagination={false}
              scroll={{ x: 1110 }}
              rowClassName={(r) => (counts[r.id] !== undefined && counts[r.id] !== null ? 'cs-row-done' : '')}
            />
          </div>
        )}
      </Spin>

      <Modal
        title={`실사 결과 반영 — ${store} ${month.format('YYYY년 M월')}`}
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={handleSave}
        okText={`${changes.length}개 품목 저장`}
        cancelText="취소"
        confirmLoading={saving}
        width={820}
      >
        <p>아래 품목만 바뀝니다. 장부재고와 같은 수량을 입력한 품목은 저장하지 않습니다.</p>
        {negativeConsumption.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={`${negativeConsumption.length}개 품목은 실사 수량이 '전달재고+입고'보다 많아 소비량이 음수가 됩니다. 입고 누락이 없는지 확인해 주세요.`}
          />
        )}
        <Table size="small" rowKey="id" columns={previewColumns} dataSource={changes} pagination={false} scroll={{ y: 400 }} />
      </Modal>
    </div>
  );
};

export default InventoryCountSheetPage;
