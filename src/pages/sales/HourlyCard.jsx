// 시간대별 매출 카드 — 날짜(하루 또는 기간)를 골라서 보기
// POS "시간별 매출"은 내려받은 기간 전체의 합계라서, 하루 단위로 보려면 하루씩 내려받은 파일이 필요하다.
import { useEffect, useMemo, useState } from 'react';
import { Card, DatePicker, Segmented, Space, Typography, Empty, Spin, Tag, Tooltip as AntTooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import dayjs from 'dayjs';
import { salesAPI } from '../../services/api';
import { STORES, STORE_COLORS, won, shortWon, axisProps, gridProps } from './salesUtils';
import { WonTooltip, Legend } from './ChartBits';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const HourlyCard = ({ from, to, overview }) => {
  const [range, setRange] = useState(from && to ? [dayjs(from), dayjs(to)] : null);
  const [mode, setMode] = useState('sum');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // 위쪽 기간을 바꾸면 이 카드도 따라감 (이후 카드에서 따로 바꿀 수 있음)
  useEffect(() => {
    if (from && to) setRange([dayjs(from), dayjs(to)]);
  }, [from, to]);

  const rFrom = range?.[0]?.format('YYYY-MM-DD');
  const rTo = range?.[1]?.format('YYYY-MM-DD');

  useEffect(() => {
    if (!rFrom || !rTo) return;
    setLoading(true);
    salesAPI.getHourlyRange({ from: rFrom, to: rTo })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [rFrom, rTo]);

  // 하루짜리 시간별 파일이 있는 날짜 (달력에 점으로 표시)
  const singleDays = useMemo(
    () => new Set((overview?.hourly || []).filter((d) => d.period_start === d.period_end).map((d) => d.period_start)),
    [overview]
  );
  const latestDay = useMemo(() => [...singleDays].sort().pop(), [singleDays]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.hours.map((h) => {
      const o = { label: `${h.hour}시` };
      STORES.forEach((s) => {
        const v = h[s] || 0;
        const days = data.coveredDays?.[s] || 0;
        o[s] = mode === 'avg' && days ? v / days : v;
      });
      return o;
    });
  }, [data, mode]);

  const peak = useMemo(() => {
    let best = null;
    for (const h of chartData) {
      const t = STORES.reduce((a, s) => a + (h[s] || 0), 0);
      if (!best || t > best.total) best = { label: h.label, total: t };
    }
    return best;
  }, [chartData]);

  const isSingleDay = rFrom && rFrom === rTo;
  const covered = data?.coveredDays || {};
  const datasets = data?.datasets || [];
  const multiDayFiles = datasets.filter((d) => d.days > 1);

  const presets = [
    ...(latestDay ? [{ label: `최근 하루 (${dayjs(latestDay).format('M/D')})`, value: [dayjs(latestDay), dayjs(latestDay)] }] : []),
    ...(from && to ? [{ label: '위에서 고른 기간', value: [dayjs(from), dayjs(to)] }] : []),
  ];

  return (
    <Card
      size="small"
      title="시간대별 매출"
      extra={(
        <Space wrap size={8}>
          <RangePicker
            size="small"
            value={range}
            onChange={setRange}
            allowClear={false}
            presets={presets}
            cellRender={(current, info) => {
              if (info.type !== 'date') return info.originNode;
              const has = singleDays.has(current.format('YYYY-MM-DD'));
              return (
                <div className="ant-picker-cell-inner" style={{ position: 'relative' }}>
                  {current.date()}
                  {has && (
                    <span style={{ position: 'absolute', left: '50%', bottom: -2, transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: 2, background: STORE_COLORS.큰길 }} />
                  )}
                </div>
              );
            }}
          />
          {!isSingleDay && (
            <Segmented size="small" value={mode} onChange={setMode} options={[{ label: '합계', value: 'sum' }, { label: '일평균', value: 'avg' }]} />
          )}
        </Space>
      )}
    >
      <Spin spinning={loading}>
        {chartData.length ? (
          <>
            <Space wrap style={{ marginBottom: 8, justifyContent: 'space-between', width: '100%' }}>
              <Legend items={STORES.map((s) => ({ label: s, color: STORE_COLORS[s] }))} />
              {peak && (
                <Text type="secondary">
                  가장 바쁜 시간 <b style={{ color: '#0b0b0b' }}>{peak.label}</b> · {won(peak.total)}{mode === 'avg' && !isSingleDay ? ' (일평균)' : ''}
                </Text>
              )}
            </Space>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="22%">
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={shortWon} width={56} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={<WonTooltip showTotal />} />
                  {STORES.map((s) => (
                    <Bar key={s} dataKey={s} name={s} fill={STORE_COLORS[s]} radius={[4, 4, 0, 0]} maxBarSize={36} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <Space wrap size={4} style={{ marginTop: 4 }}>
              <Text type="secondary">반영된 날:</Text>
              {STORES.map((s) => (
                <Tag key={s}>{s} {covered[s] || 0}일</Tag>
              ))}
              {multiDayFiles.length > 0 && (
                <AntTooltip title={multiDayFiles.map((d) => `${d.store} ${d.period_start}~${d.period_end}`).join(', ')}>
                  <Text type="secondary"><InfoCircleOutlined /> 여러 날을 합친 파일 포함</Text>
                </AntTooltip>
              )}
            </Space>
          </>
        ) : (
          <Empty
            description={(
              <span>
                이 날짜의 시간별 매출 파일이 없습니다.<br />
                <Text type="secondary">POS에서 시간별 매출을 <b>하루 단위</b>(시작일=종료일)로 내려받아 올리면 날짜별로 볼 수 있습니다. 달력에 점이 있는 날이 올라와 있는 날입니다.</Text>
              </span>
            )}
          />
        )}
      </Spin>
    </Card>
  );
};

export default HourlyCard;
