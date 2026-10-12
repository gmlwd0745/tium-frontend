import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Card, Typography, Table, Tag, Space, Button, Alert, Row, Col, Popconfirm, message, Descriptions,
} from 'antd';
import {
  InboxOutlined, CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, BarChartOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import './sales.css';
import { won } from './salesUtils';

const { Title, Text, Paragraph } = Typography;
const { Dragger } = Upload;

const TYPE_LABEL = { daily: '일자별 매출', products: '상품별 매출', hourly: '시간별 매출' };
const TYPE_COLOR = { daily: 'blue', products: 'purple', hourly: 'cyan' };

const SalesUploadPage = () => {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState([]);
  const [overview, setOverview] = useState(null);
  const [uploads, setUploads] = useState([]);

  const load = async () => {
    try {
      const [ov, up] = await Promise.all([salesAPI.getOverview(), salesAPI.getUploads({ limit: 20 })]);
      setOverview(ov.data);
      setUploads(up.data);
    } catch {
      message.error('매출 데이터 현황을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (fileList) => {
    const formData = new FormData();
    fileList.forEach((f) => formData.append('files', f));
    setUploading(true);
    try {
      const res = await salesAPI.upload(formData);
      setResults(res.data.results);
      const ok = res.data.results.filter((r) => r.ok).length;
      const fail = res.data.results.length - ok;
      if (fail === 0) message.success(`${ok}개 파일을 반영했습니다.`);
      else message.warning(`${ok}개 반영, ${fail}개 실패 — 아래 결과를 확인해주세요.`);
      load();
    } catch (e) {
      message.error(e.response?.data?.error || '업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // 여러 파일을 한 번에 끌어놓으면 한 번만 전송
  const pending = useRef([]);
  const timer = useRef(null);
  const beforeUpload = (file) => {
    pending.current.push(file);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const batch = pending.current;
      pending.current = [];
      handleUpload(batch);
    }, 50);
    return false;
  };

  const removeDataset = async (type, d) => {
    try {
      const res = await salesAPI.deleteDataset({ type, periodStart: d.period_start, periodEnd: d.period_end, store: d.store });
      message.success(`${res.data.removed}행을 삭제했습니다.`);
      load();
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  const datasetColumns = (type) => [
    { title: '기간', key: 'p', render: (_, d) => `${d.period_start} ~ ${d.period_end}` },
    { title: '범위', dataIndex: 'store', render: (s) => (s === '전체' ? <Tag>두 매장 합계</Tag> : <Tag color="geekblue">{s}</Tag>) },
    { title: '행 수', dataIndex: 'row_count', align: 'right' },
    { title: '매출 합계', dataIndex: 'total_amount', align: 'right', render: won },
    {
      title: '',
      key: 'a',
      width: 60,
      render: (_, d) => (
        <Popconfirm
          title="이 기간 매출 데이터를 삭제할까요?"
          description="매출 리포트용으로 올린 데이터만 지워지고, 다른 관리 데이터에는 영향이 없습니다."
          onConfirm={() => removeDataset(type, d)}
          okText="삭제"
          cancelText="취소"
        >
          <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="삭제" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div className="sales-page">
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <div>
          <Title level={4} style={{ margin: 0 }}>매출 업로드</Title>
          <Text type="secondary">POS에서 내려받은 매출 엑셀을 그대로 올리면 매출 리포트에 반영됩니다.</Text>
        </div>
        <Button type="primary" icon={<BarChartOutlined />} onClick={() => navigate('/sales')}>매출 리포트 보기</Button>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Dragger
            multiple
            accept=".xls,.xlsx"
            showUploadList={false}
            beforeUpload={beforeUpload}
            disabled={uploading}
            style={{ padding: 16 }}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">{uploading ? '반영 중입니다…' : '파일을 끌어놓거나 클릭해서 선택하세요 (여러 개 가능)'}</p>
            <p className="ant-upload-hint">파일 종류는 제목으로 자동 인식합니다. 같은 기간을 다시 올리면 새 파일 내용으로 바뀝니다.</p>
          </Dragger>

          {results.length > 0 && (
            <Card size="small" title="방금 올린 결과" style={{ marginTop: 16 }}>
              {results.map((r) => (
                <div key={r.fileName} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  {r.ok ? (
                    <Space wrap>
                      <CheckCircleOutlined style={{ color: '#008300' }} />
                      <Tag color={TYPE_COLOR[r.type]}>{TYPE_LABEL[r.type]}</Tag>
                      <Text>{r.periodStart} ~ {r.periodEnd}</Text>
                      <Text type="secondary">{r.scope === '전체' ? '두 매장' : r.scope} · {r.rows}행 · {won(r.total)}</Text>
                    </Space>
                  ) : (
                    <Space align="start">
                      <CloseCircleOutlined style={{ color: '#e34948' }} />
                      <div>
                        <Text strong>{r.fileName}</Text>
                        <div><Text type="danger">{r.error}</Text></div>
                      </div>
                    </Space>
                  )}
                </div>
              ))}
            </Card>
          )}
        </Col>

        <Col xs={24} lg={10}>
          <Card size="small" title="POS에서 내려받을 보고서">
            <Paragraph style={{ marginBottom: 8 }}>
              매장은 <b>큰길·태광 둘 다 선택</b>하고 기간을 정해 아래 보고서를 엑셀로 저장하세요.
            </Paragraph>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="일자별 매출">매출 추이·매장 비교·손익 (필수)</Descriptions.Item>
              <Descriptions.Item label="상품별 매출">메뉴 순위·메뉴 원가율</Descriptions.Item>
              <Descriptions.Item label="시간별 매출">시간대별 매장 비교</Descriptions.Item>
              <Descriptions.Item label="매장별 일자 매출">월 단위 일자 매출 (일자별 대신 사용 가능)</Descriptions.Item>
            </Descriptions>
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message="매장별 메뉴 순위가 필요하면"
              description="POS의 상품별 매출은 두 매장을 합쳐서 나옵니다. 매장을 하나씩만 선택해 따로 내려받아 올리면 매장별 순위도 볼 수 있습니다."
            />
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ marginTop: 24 }}>저장된 매출 데이터</Title>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card size="small" title="일자별 매출">
            {overview?.daily?.row_count ? (
              <>
                <div><Text strong>{overview.daily.min_date} ~ {overview.daily.max_date}</Text></div>
                <Text type="secondary">{overview.daily.row_count}건 (일자×매장)</Text>
              </>
            ) : (
              <Text type="secondary">아직 없습니다</Text>
            )}
          </Card>
        </Col>
        <Col xs={24} lg={16}>
          <Card size="small" title="상품별 매출">
            <Table size="small" rowKey={(d) => `${d.period_start}${d.period_end}${d.store}`} pagination={false}
              columns={datasetColumns('products')} dataSource={overview?.products || []}
              locale={{ emptyText: '아직 없습니다' }} scroll={{ x: true }} />
          </Card>
        </Col>
        <Col xs={24}>
          <Card size="small" title="시간별 매출">
            <Table size="small" rowKey={(d) => `${d.period_start}${d.period_end}${d.store}`} pagination={false}
              columns={datasetColumns('hourly')} dataSource={overview?.hourly || []}
              locale={{ emptyText: '아직 없습니다' }} scroll={{ x: true }} />
          </Card>
        </Col>
      </Row>

      <Title level={5} style={{ marginTop: 24 }}>최근 업로드 기록</Title>
      <Table
        size="small"
        rowKey="id"
        dataSource={uploads}
        pagination={false}
        scroll={{ x: true }}
        columns={[
          { title: '올린 시각', dataIndex: 'created_at', render: (v) => dayjs(v).format('YYYY-MM-DD HH:mm') },
          { title: '파일', dataIndex: 'file_name', ellipsis: true },
          { title: '종류', dataIndex: 'report_type', render: (t) => <Tag color={TYPE_COLOR[t]}>{TYPE_LABEL[t] || t}</Tag> },
          { title: '기간', key: 'p', render: (_, r) => `${r.period_start} ~ ${r.period_end}` },
          { title: '행 수', dataIndex: 'row_count', align: 'right' },
          { title: '매출 합계', dataIndex: 'total_amount', align: 'right', render: won },
        ]}
      />
    </div>
  );
};

export default SalesUploadPage;
