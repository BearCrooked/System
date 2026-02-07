import { useState, useEffect, useCallback } from 'react';
import {
  Tabs,
  Table,
  Button,
  Space,
  Card,
  Tag,
  message,
  Modal,
  Select,
  DatePicker,
  Input,
  Form,
  InputNumber,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Typography,
  Switch,
  Divider,
} from 'antd';
import {
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  PlusOutlined,
  CalculatorOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase, nameToEmail } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { WorkRecord, Profile, ProjectPreset, EmployeeTypeSetting } from '../types';
import { EMPLOYEE_TYPE_LABELS, ROLE_LABELS } from '../types';
import { calculateRecordSalary, calculateTotalSalary, generateSalaryDetails } from '../lib/salary';
import { exportRecordsToExcel, exportAllUsersSalaryToExcel } from '../lib/export';

const { Title, Text } = Typography;
const { confirm } = Modal;

export default function Admin() {
  const { profile: adminProfile } = useAuth();

  // 用户管理
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);

  // 工作记录
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userRecords, setUserRecords] = useState<WorkRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  // 薪资计算
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);

  // 预设管理
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeTypeSetting[]>([]);
  const [editPresetModal, setEditPresetModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<ProjectPreset | null>(null);
  const [presetForm] = Form.useForm();
  const [settingsForm] = Form.useForm();

  // --- 数据加载 ---
  const fetchProfiles = useCallback(async () => {
    setProfilesLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at');
      if (error) {
        console.error('获取用户列表失败:', error);
        message.error('获取用户列表失败: ' + error.message);
      } else {
        setProfiles((data as Profile[]) || []);
      }
    } catch (err) {
      console.error('网络错误:', err);
      message.error('网络错误，请刷新重试');
    } finally {
      setProfilesLoading(false);
    }
  }, []);

  const fetchUserRecords = useCallback(async () => {
    if (!selectedUser) return;
    setRecordsLoading(true);
    const startDate = selectedMonth.startOf('month').format('YYYY-MM-DD');
    const endDate = selectedMonth.endOf('month').format('YYYY-MM-DD');

    const { data } = await supabase
      .from('work_records')
      .select('*')
      .eq('user_id', selectedUser.id)
      .gte('record_date', startDate)
      .lte('record_date', endDate)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false });

    setUserRecords((data as WorkRecord[]) || []);
    setSelectedRowKeys([]);
    setRecordsLoading(false);
  }, [selectedUser, selectedMonth]);

  const fetchPresets = useCallback(async () => {
    const { data } = await supabase
      .from('project_presets')
      .select('*')
      .order('sort_order');
    if (data) setPresets(data as ProjectPreset[]);
  }, []);

  const fetchEmployeeSettings = useCallback(async () => {
    const { data } = await supabase.from('employee_type_settings').select('*');
    if (data) setEmployeeSettings(data as EmployeeTypeSetting[]);
  }, []);

  useEffect(() => {
    fetchProfiles();
    fetchPresets();
    fetchEmployeeSettings();
  }, [fetchProfiles, fetchPresets, fetchEmployeeSettings]);

  useEffect(() => {
    fetchUserRecords();
  }, [fetchUserRecords]);

  // --- 用户管理操作 ---
  const handleUpdateProfile = async (
    userId: string,
    field: string,
    value: string
  ) => {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', userId);

    if (error) {
      message.error('更新失败: ' + error.message);
    } else {
      message.success('更新成功');
      fetchProfiles();
    }
  };

  // --- 批量删除（需要密码验证） ---
  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要删除的记录');
      return;
    }

    let passwordInput = '';

    confirm({
      title: '批量删除确认',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>
            即将删除 <strong>{selectedRowKeys.length}</strong> 条记录，此操作不可恢复。
          </p>
          <p>请输入您的密码以确认：</p>
          <Input.Password
            prefix={<LockOutlined />}
            placeholder="输入密码确认"
            onChange={(e) => {
              passwordInput = e.target.value;
            }}
          />
        </div>
      ),
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        // 验证密码
        if (!adminProfile) return;
        const email = nameToEmail(adminProfile.name);
        const { error: authError } = await supabase.auth.signInWithPassword({
          email,
          password: passwordInput,
        });

        if (authError) {
          message.error('密码验证失败');
          throw new Error('密码错误');
        }

        // 执行删除
        const { error } = await supabase
          .from('work_records')
          .delete()
          .in('id', selectedRowKeys);

        if (error) {
          message.error('删除失败: ' + error.message);
        } else {
          message.success(`成功删除 ${selectedRowKeys.length} 条记录`);
          setSelectedRowKeys([]);
          fetchUserRecords();
        }
      },
    });
  };

  // --- 薪资计算 ---
  const salaryDetails = generateSalaryDetails(userRecords);
  const totalSalary = calculateTotalSalary(userRecords);

  const handleExportUserSalary = () => {
    if (userRecords.length === 0) {
      message.warning('没有数据可导出');
      return;
    }
    const monthStr = selectedMonth.format('YYYY-MM');
    exportRecordsToExcel(
      userRecords,
      `${selectedUser?.name}_工作记录_${monthStr}`
    );
    message.success('导出成功');
  };

  const handleExportAllSalary = async () => {
    const startDate = selectedMonth.startOf('month').format('YYYY-MM-DD');
    const endDate = selectedMonth.endOf('month').format('YYYY-MM-DD');

    const { data: allRecords } = await supabase
      .from('work_records')
      .select('*')
      .gte('record_date', startDate)
      .lte('record_date', endDate)
      .order('record_date', { ascending: false });

    if (!allRecords || allRecords.length === 0) {
      message.warning('该月份没有数据');
      return;
    }

    const userRecordsMap = new Map<string, WorkRecord[]>();
    (allRecords as WorkRecord[]).forEach((record) => {
      const name = record.user_name;
      if (!userRecordsMap.has(name)) userRecordsMap.set(name, []);
      userRecordsMap.get(name)!.push(record);
    });

    exportAllUsersSalaryToExcel(userRecordsMap, selectedMonth.format('YYYY-MM'));
    message.success('全员薪资导出成功');
  };

  // --- 预设管理 ---
  const handleSavePreset = async () => {
    try {
      const values = await presetForm.validateFields();
      if (editingPreset) {
        const { error } = await supabase
          .from('project_presets')
          .update(values)
          .eq('id', editingPreset.id);
        if (error) throw error;
        message.success('更新成功');
      } else {
        const { error } = await supabase.from('project_presets').insert(values);
        if (error) throw error;
        message.success('添加成功');
      }
      setEditPresetModal(false);
      setEditingPreset(null);
      presetForm.resetFields();
      fetchPresets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'message' in err) {
        message.error('操作失败: ' + (err as { message: string }).message);
      }
    }
  };

  const handleDeletePreset = async (id: string) => {
    const { error } = await supabase.from('project_presets').delete().eq('id', id);
    if (error) {
      message.error('删除失败: ' + error.message);
    } else {
      message.success('删除成功');
      fetchPresets();
    }
  };

  const handleSaveEmployeeSettings = async (setting: EmployeeTypeSetting) => {
    const dailyWage = settingsForm.getFieldValue(`daily_wage_${setting.type_name}`);
    const overtimeRate = settingsForm.getFieldValue(`overtime_rate_${setting.type_name}`);

    const { error } = await supabase
      .from('employee_type_settings')
      .update({
        daily_wage: dailyWage,
        overtime_rate: overtimeRate,
      })
      .eq('id', setting.id);

    if (error) {
      message.error('保存失败: ' + error.message);
    } else {
      message.success(`${setting.type_label} 设置已保存`);
      fetchEmployeeSettings();
    }
  };

  // --- 用户列表表格 ---
  const userColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 140,
      render: (role: string, record: Profile) => (
        <Select
          value={role}
          size="small"
          style={{ width: 110 }}
          onChange={(val) => handleUpdateProfile(record.id, 'role', val)}
          options={[
            { value: 'user', label: '普通用户' },
            { value: 'admin', label: '管理员' },
          ]}
        />
      ),
    },
    {
      title: '身份',
      dataIndex: 'employee_type',
      key: 'employee_type',
      width: 140,
      render: (type: string, record: Profile) => (
        <Select
          value={type}
          size="small"
          style={{ width: 100 }}
          onChange={(val) => handleUpdateProfile(record.id, 'employee_type', val)}
          options={[
            { value: 'intern', label: '实习' },
            { value: 'regular', label: '正式' },
            { value: 'manager', label: '管理' },
          ]}
        />
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: Profile) => (
        <Button
          type="link"
          icon={<UserOutlined />}
          onClick={() => setSelectedUser(record)}
        >
          查看记录
        </Button>
      ),
    },
  ];

  // --- 工作记录表格 ---
  const recordColumns = [
    {
      title: '日期',
      dataIndex: 'record_date',
      key: 'record_date',
      width: 100,
      render: (d: string) => dayjs(d).format('MM-DD'),
    },
    {
      title: '项目',
      dataIndex: 'project_name',
      key: 'project_name',
      width: 130,
      render: (n: string) => <Tag color="blue">{n}</Tag>,
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
      title: '单价',
      dataIndex: 'unit_price_snapshot',
      key: 'unit_price_snapshot',
      width: 80,
      align: 'right' as const,
      render: (v: number) => `¥${v}`,
    },
    {
      title: '薪资',
      key: 'salary',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, record: WorkRecord) => (
        <Text strong>¥{calculateRecordSalary(record).toFixed(0)}</Text>
      ),
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
    },
  ];

  // --- 预设表格 ---
  const presetColumns = [
    { title: '项目名称', dataIndex: 'project_name', key: 'project_name' },
    {
      title: '单价(元)',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 100,
      render: (v: number) => `¥${v}`,
    },
    {
      title: '单位',
      dataIndex: 'unit_label',
      key: 'unit_label',
      width: 80,
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 80,
      render: (active: boolean, record: ProjectPreset) => (
        <Switch
          checked={active}
          size="small"
          onChange={async (checked) => {
            await supabase
              .from('project_presets')
              .update({ is_active: checked })
              .eq('id', record.id);
            fetchPresets();
          }}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 60,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: unknown, record: ProjectPreset) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPreset(record);
              presetForm.setFieldsValue(record);
              setEditPresetModal(true);
            }}
          />
          <Popconfirm
            title="确定删除此预设？"
            onConfirm={() => handleDeletePreset(record.id)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ====== 渲染 ======
  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        管理面板
      </Title>

      <Tabs
        defaultActiveKey="users"
        items={[
          {
            key: 'users',
            label: '用户管理',
            children: (
              <div>
                <Card title="所有用户" size="small" style={{ marginBottom: 16 }}>
                  <Table
                    columns={userColumns}
                    dataSource={profiles}
                    rowKey="id"
                    loading={profilesLoading}
                    size="small"
                    scroll={{ x: 600 }}
                    pagination={false}
                  />
                </Card>

                {/* 选中用户的记录 */}
                {selectedUser && (
                  <Card
                    title={
                      <Space>
                        <span>{selectedUser.name} 的工作记录</span>
                        <Tag>{EMPLOYEE_TYPE_LABELS[selectedUser.employee_type]}</Tag>
                        <Tag color={selectedUser.role === 'admin' ? 'red' : 'blue'}>
                          {ROLE_LABELS[selectedUser.role]}
                        </Tag>
                      </Space>
                    }
                    size="small"
                    extra={
                      <Button size="small" onClick={() => setSelectedUser(null)}>
                        关闭
                      </Button>
                    }
                  >
                    {/* 工具栏 */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 16,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <Space>
                        <DatePicker
                          picker="month"
                          value={selectedMonth}
                          onChange={(d) => d && setSelectedMonth(d)}
                          allowClear={false}
                          size="small"
                        />
                        <Button
                          size="small"
                          icon={<CalculatorOutlined />}
                          onClick={() => setSalaryModalVisible(true)}
                          disabled={userRecords.length === 0}
                        >
                          薪资明细
                        </Button>
                      </Space>
                      <Space>
                        {selectedRowKeys.length > 0 && (
                          <Button
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={handleBatchDelete}
                          >
                            删除选中 ({selectedRowKeys.length})
                          </Button>
                        )}
                        <Button
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={handleExportUserSalary}
                          disabled={userRecords.length === 0}
                        >
                          导出Excel
                        </Button>
                        <Button
                          size="small"
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={handleExportAllSalary}
                        >
                          导出全员薪资
                        </Button>
                      </Space>
                    </div>

                    {/* 统计 */}
                    <Row gutter={[12, 8]} style={{ marginBottom: 16 }}>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="记录数"
                          value={userRecords.length}
                          suffix="条"
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="总工作量"
                          value={userRecords.reduce((s, r) => s + r.workload, 0)}
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="总加班"
                          value={userRecords.reduce((s, r) => s + r.overtime, 0)}
                          suffix="h"
                          precision={1}
                        />
                      </Col>
                      <Col xs={12} sm={6}>
                        <Statistic
                          title="月薪合计"
                          value={totalSalary}
                          prefix="¥"
                          precision={0}
                          valueStyle={{ color: '#3f8600' }}
                        />
                      </Col>
                    </Row>

                    {/* 记录表格 */}
                    <Table
                      rowSelection={{
                        selectedRowKeys,
                        onChange: (keys) => setSelectedRowKeys(keys as string[]),
                      }}
                      columns={recordColumns}
                      dataSource={userRecords}
                      rowKey="id"
                      loading={recordsLoading}
                      size="small"
                      scroll={{ x: 650 }}
                      pagination={{ pageSize: 30 }}
                    />
                  </Card>
                )}
              </div>
            ),
          },
          {
            key: 'presets',
            label: '预设管理',
            children: (
              <Row gutter={16}>
                {/* 项目预设 */}
                <Col xs={24} lg={14}>
                  <Card
                    title="项目预设"
                    size="small"
                    extra={
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setEditingPreset(null);
                          presetForm.resetFields();
                          setEditPresetModal(true);
                        }}
                      >
                        添加项目
                      </Button>
                    }
                  >
                    <Table
                      columns={presetColumns}
                      dataSource={presets}
                      rowKey="id"
                      size="small"
                      scroll={{ x: 500 }}
                      pagination={false}
                    />
                  </Card>
                </Col>

                {/* 员工身份设置 */}
                <Col xs={24} lg={10}>
                  <Card title="员工身份设置" size="small">
                    <Form form={settingsForm} layout="vertical">
                      {employeeSettings.map((setting) => (
                        <div key={setting.id}>
                          <Title level={5}>
                            {setting.type_label}（{setting.type_name}）
                          </Title>
                          <Row gutter={[12, 0]}>
                            <Col xs={11} sm={10}>
                              <Form.Item
                                label="日薪(元)"
                                name={`daily_wage_${setting.type_name}`}
                                initialValue={setting.daily_wage}
                              >
                                <InputNumber
                                  style={{ width: '100%' }}
                                  min={0}
                                  precision={2}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={11} sm={10}>
                              <Form.Item
                                label="加班费率(元/时)"
                                name={`overtime_rate_${setting.type_name}`}
                                initialValue={setting.overtime_rate}
                              >
                                <InputNumber
                                  style={{ width: '100%' }}
                                  min={0}
                                  precision={2}
                                />
                              </Form.Item>
                            </Col>
                            <Col xs={2} sm={4}>
                              <Form.Item label=" ">
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => handleSaveEmployeeSettings(setting)}
                                >
                                  保存
                                </Button>
                              </Form.Item>
                            </Col>
                          </Row>
                          <Divider style={{ margin: '8px 0 16px' }} />
                        </div>
                      ))}
                    </Form>
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      {/* 薪资明细弹窗 */}
      <Modal
        title={`${selectedUser?.name} - ${selectedMonth.format('YYYY年MM月')} 薪资明细`}
        open={salaryModalVisible}
        onCancel={() => setSalaryModalVisible(false)}
        width="92%"
        style={{ maxWidth: 700 }}
        footer={[
          <Button key="export" icon={<DownloadOutlined />} onClick={handleExportUserSalary}>
            导出Excel
          </Button>,
          <Button key="close" type="primary" onClick={() => setSalaryModalVisible(false)}>
            关闭
          </Button>,
        ]}
      >
        <Table
          dataSource={salaryDetails}
          rowKey="projectName"
          size="small"
          scroll={{ x: 550 }}
          pagination={false}
          columns={[
            { title: '项目', dataIndex: 'projectName', key: 'projectName' },
            { title: '记录数', dataIndex: 'recordCount', key: 'recordCount', width: 70 },
            { title: '工作量', dataIndex: 'totalWorkload', key: 'totalWorkload', width: 80 },
            {
              title: '加班(时)',
              dataIndex: 'totalOvertime',
              key: 'totalOvertime',
              width: 80,
            },
            {
              title: '基本薪资',
              dataIndex: 'totalBasePay',
              key: 'totalBasePay',
              width: 100,
              render: (v: number) => `¥${v.toFixed(0)}`,
            },
            {
              title: '加班费',
              dataIndex: 'totalOvertimePay',
              key: 'totalOvertimePay',
              width: 80,
              render: (v: number) => `¥${v.toFixed(0)}`,
            },
            {
              title: '小计',
              dataIndex: 'totalSalary',
              key: 'totalSalary',
              width: 100,
              render: (v: number) => <Text strong>¥{v.toFixed(0)}</Text>,
            },
          ]}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0} colSpan={5}>
                <Text strong>月薪合计</Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={5} colSpan={2} align="right">
                <Text strong style={{ color: '#3f8600', fontSize: 16 }}>
                  ¥{totalSalary.toFixed(0)}
                </Text>
              </Table.Summary.Cell>
            </Table.Summary.Row>
          )}
        />
      </Modal>

      {/* 编辑/新增预设弹窗 */}
      <Modal
        title={editingPreset ? '编辑项目预设' : '添加项目预设'}
        open={editPresetModal}
        onCancel={() => {
          setEditPresetModal(false);
          setEditingPreset(null);
          presetForm.resetFields();
        }}
        onOk={handleSavePreset}
        okText="保存"
      >
        <Form form={presetForm} layout="vertical">
          <Form.Item
            label="项目名称"
            name="project_name"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如: Ai漫剪辑" />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={8}>
              <Form.Item
                label="单价(元)"
                name="unit_price"
                rules={[{ required: true, message: '请输入单价' }]}
                initialValue={0}
              >
                <InputNumber style={{ width: '100%' }} min={0} precision={2} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item
                label="单位"
                name="unit_label"
                initialValue="集"
              >
                <Select
                  options={[
                    { value: '集', label: '集' },
                    { value: '天', label: '天' },
                    { value: '次', label: '次' },
                    { value: '小时', label: '小时' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={8}>
              <Form.Item label="排序" name="sort_order" initialValue={0}>
                <InputNumber style={{ width: '100%' }} min={0} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
