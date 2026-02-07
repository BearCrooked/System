import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  DatePicker,
  Space,
  Card,
  Tag,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
  List,
  Avatar,
  Modal,
  Typography,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  UserOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { WorkRecord, Profile } from '../types';
import { calculateRecordSalary, calculateTotalSalary } from '../lib/salary';
import { exportRecordsToExcel } from '../lib/export';
import AddRecordModal from '../components/AddRecordModal';
import { EMPLOYEE_TYPE_LABELS } from '../types';

const { Text } = Typography;

export default function Dashboard() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // 查看其他用户
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [selectedUserRecords, setSelectedUserRecords] = useState<WorkRecord[]>([]);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [userRecordsLoading, setUserRecordsLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const startDate = selectedMonth.startOf('month').format('YYYY-MM-DD');
    const endDate = selectedMonth.endOf('month').format('YYYY-MM-DD');

    const { data } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', profile.id)
      .gte('record_date', startDate)
      .lte('record_date', endDate)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false });

    setRecords((data as WorkRecord[]) || []);
    setLoading(false);
  }, [profile, selectedMonth]);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('name');
    if (data) setAllProfiles(data as Profile[]);
  }, []);

  useEffect(() => {
    fetchRecords();
    fetchProfiles();
  }, [fetchRecords, fetchProfiles]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('work_records').delete().eq('id', id);
    if (error) {
      message.error('删除失败: ' + error.message);
    } else {
      message.success('删除成功');
      fetchRecords();
    }
  };

  const handleViewUser = async (user: Profile) => {
    setSelectedUser(user);
    setUserModalVisible(true);
    setUserRecordsLoading(true);

    const startDate = selectedMonth.startOf('month').format('YYYY-MM-DD');
    const endDate = selectedMonth.endOf('month').format('YYYY-MM-DD');

    const { data } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', user.id)
      .gte('record_date', startDate)
      .lte('record_date', endDate)
      .order('record_date', { ascending: false });

    setSelectedUserRecords((data as WorkRecord[]) || []);
    setUserRecordsLoading(false);
  };

  const handleExport = () => {
    if (records.length === 0) {
      message.warning('当前月份没有数据可导出');
      return;
    }
    const monthStr = selectedMonth.format('YYYY-MM');
    exportRecordsToExcel(records, `${profile?.name}_工作记录_${monthStr}`);
    message.success('导出成功');
  };

  const totalSalary = calculateTotalSalary(records);
  const today = dayjs().format('YYYY-MM-DD');

  const columns = [
    {
      title: '日期',
      dataIndex: 'record_date',
      key: 'record_date',
      width: 110,
      render: (date: string) => dayjs(date).format('MM-DD'),
    },
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 140,
      render: (name: string) => <Tag color="blue">{name}</Tag>,
    },
    {
      title: '工作量',
      dataIndex: 'workload',
      key: 'workload',
      width: 80,
      align: 'center' as const,
    },
    {
      title: '加班(时)',
      dataIndex: 'overtime',
      key: 'overtime',
      width: 80,
      align: 'center' as const,
      render: (v: number) => (v > 0 ? <Text type="warning">{v}h</Text> : '-'),
    },
    {
      title: '薪资',
      key: 'salary',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, record: WorkRecord) => {
        const salary = calculateRecordSalary(record);
        return <Text strong>¥{salary.toFixed(0)}</Text>;
      },
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 70,
      render: (_: unknown, record: WorkRecord) => {
        const isToday = record.record_date === today;
        return isToday ? (
          <Popconfirm
            title="确定删除此条记录？"
            onConfirm={() => handleDelete(record.id)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        ) : null;
      },
    },
  ];

  // 其他用户（排除自己）
  const otherUsers = allProfiles.filter((p) => p.id !== profile?.id);

  return (
    <Row gutter={24}>
      {/* 左侧主区域 */}
      <Col xs={24} lg={17}>
        <Card>
          {/* 头部工具栏 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <Space>
              <CalendarOutlined />
              <DatePicker
                picker="month"
                value={selectedMonth}
                onChange={(date: Dayjs | null) => date && setSelectedMonth(date)}
                allowClear={false}
              />
            </Space>
            <Space>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleExport}
                disabled={records.length === 0}
              >
                导出Excel
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setShowAddModal(true)}
              >
                添加记录
              </Button>
            </Space>
          </div>

          {/* 薪资统计 */}
          <Row gutter={[16, 8]} style={{ marginBottom: 16 }}>
            <Col xs={8} sm={8}>
              <Statistic
                title="本月记录"
                value={records.length}
                suffix="条"
              />
            </Col>
            <Col xs={8} sm={8}>
              <Statistic
                title="总加班"
                value={records.reduce((s, r) => s + r.overtime, 0)}
                suffix="h"
                precision={1}
              />
            </Col>
            <Col xs={8} sm={8}>
              <Statistic
                title="月薪资"
                value={totalSalary}
                prefix="¥"
                precision={0}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
          </Row>

          {/* 工作记录表格 */}
          <Table
            columns={columns}
            dataSource={records}
            rowKey="id"
            loading={loading}
            size="middle"
            scroll={{ x: 650 }}
            pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
            locale={{ emptyText: <Empty description="暂无工作记录" /> }}
          />
        </Card>
      </Col>

      {/* 右侧其他用户面板 */}
      <Col xs={24} lg={7}>
        <Card title="其他用户" size="small">
          {otherUsers.length === 0 ? (
            <Empty description="暂无其他用户" />
          ) : (
            <List
              dataSource={otherUsers}
              renderItem={(user) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '8px 0' }}
                  onClick={() => handleViewUser(user)}
                >
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} size="small" />}
                    title={
                      <Space>
                        <span>{user.name}</span>
                        <Tag style={{ fontSize: 11 }}>
                          {EMPLOYEE_TYPE_LABELS[user.employee_type]}
                        </Tag>
                      </Space>
                    }
                  />
                  <Button type="link" size="small">
                    查看
                  </Button>
                </List.Item>
              )}
            />
          )}
        </Card>
      </Col>

      {/* 添加记录弹窗 */}
      <AddRecordModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={fetchRecords}
      />

      {/* 查看其他用户记录弹窗 */}
      <Modal
        title={`${selectedUser?.name} 的工作记录 - ${selectedMonth.format('YYYY年MM月')}`}
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
        width="90%"
        style={{ maxWidth: 800 }}
      >
        {selectedUserRecords.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Statistic
              title="月薪合计"
              value={calculateTotalSalary(selectedUserRecords)}
              prefix="¥"
              precision={0}
            />
          </div>
        )}
        <Table
          columns={columns.filter((c) => c.key !== 'action')}
          dataSource={selectedUserRecords}
          rowKey="id"
          loading={userRecordsLoading}
          size="small"
          scroll={{ x: 500 }}
          pagination={false}
          locale={{ emptyText: <Empty description="该用户本月暂无记录" /> }}
        />
      </Modal>
    </Row>
  );
}
