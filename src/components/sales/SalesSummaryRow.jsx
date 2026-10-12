// 홈 화면 상단 매출 요약 (선택한 월·매장 기준)
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, Typography, Button } from 'antd';
import { RiseOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';

const { Text } = Typography;
const won = (v) => `${Math.round(v || 0).toLocaleString()}원`;

const SalesSummaryRow = ({ month, store }) => {
  const navigate = useNavigate();
  const [cur, setCur] = useState(null);
  const [prev, setPrev] = useState(null);
  const [pnl, setPnl] = useState(null);

  useEffect(() => {
    const m = dayjs(`${month}-01`);
    const pm = m.subtract(1, 'month');
    const range = (d) => ({ from: d.startOf('month').format('YYYY-MM-DD'), to: d.endOf('month').format('YYYY-MM-DD'), ...(store && { store }) });
    const sum = (rows) => ({
      total: rows.reduce((a, r) => a + (r.total_amount || 0), 0),
      receipts: rows.reduce((a, r) => a + (r.receipt_count || 0), 0),
      days: new Set(rows.map((r) => r.sale_date)).size,
    });
    Promise.all([salesAPI.getDaily(range(m)), salesAPI.getDaily(range(pm)), salesAPI.getPnl(range(m))])
      .then(([a, b, c]) => {
        // 이번 달이 진행 중이면 전월도 같은 날짜까지만 비교 (예: 10/1~7 ↔ 9/1~7)
        const lastDay = a.data.reduce((mx, r) => Math.max(mx, dayjs(r.sale_date).date()), 0);
        setCur(sum(a.data));
        setPrev(sum(b.data.filter((r) => dayjs(r.sale_date).date() <= lastDay)));
        setPnl(c.data.months[0] || null);
      })
      .catch(() => { setCur(null); setPnl(null); });
  }, [month, store]);

  if (!cur) return null;

  if (!cur.days) {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary">{month} 매출 데이터가 아직 없습니다. </Text>
        <Button type="link" size="small" onClick={() => navigate('/sales/upload')}>POS 매출 올리기</Button>
      </Card>
    );
  }

  const rate = prev?.total ? ((cur.total - prev.total) / prev.total) * 100 : null;

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16, textAlign: 'left' }}>
      <Col xs={24} sm={12} lg={8}>
        <Card size="small" hoverable onClick={() => navigate('/sales')}>
          <Statistic title={`${month} 매출${store ? ` (${store})` : ''}`} value={won(cur.total)} prefix={<RiseOutlined />}
            valueStyle={{ color: '#2a78d6', fontWeight: 600 }} />
          <Text type="secondary">
            {rate === null ? `${cur.days}일 영업` : (
              <>{rate >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} 전월 같은 기간 대비 {rate >= 0 ? '+' : ''}{rate.toFixed(1)}% · {cur.days}일 영업</>
            )}
          </Text>
        </Card>
      </Col>
      <Col xs={12} sm={6} lg={8}>
        <Card size="small">
          <Statistic title="객단가" value={won(cur.receipts ? cur.total / cur.receipts : 0)} />
          <Text type="secondary">{cur.receipts.toLocaleString()}건</Text>
        </Card>
      </Col>
      <Col xs={12} sm={6} lg={8}>
        <Card size="small" hoverable onClick={() => navigate('/sales?tab=profit')}>
          <Statistic title="매출 − 비용 (매입+법인카드)" value={pnl ? won(pnl.profit) : '-'} />
          <Text type="secondary">인건비 등 제외 · 비용률 {pnl?.costRatio !== null && pnl?.costRatio !== undefined ? `${pnl.costRatio}%` : '-'}</Text>
        </Card>
      </Col>
    </Row>
  );
};

export default SalesSummaryRow;
