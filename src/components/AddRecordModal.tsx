import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Input,
  Button,
  Space,
  Card,
  message,
  DatePicker,
  Divider,
} from 'antd';
import { MinusCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { ProjectPreset, EmployeeTypeSetting } from '../types';

interface AddRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RecordFormItem {
  project_name: string;
  workload: number;
  overtime: number;
  notes: string;
  record_date: dayjs.Dayjs;
}

export default function AddRecordModal({ open, onClose, onSuccess }: AddRecordModalProps) {
  const { profile } = useAuth();
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeTypeSetting[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [recordCount, setRecordCount] = useState(1);
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      fetchPresets();
      fetchEmployeeSettings();
      form.resetFields();
      setRecordCount(1);
      // 初始化默认值
      form.setFieldsValue({
        records: [getDefaultRecord()],
      });
    }
  }, [open]);

  const getDefaultRecord = (): RecordFormItem => ({
    project_name: '',
    workload: 0,
    overtime: 0,
    notes: '',
    record_date: dayjs(),
  });

  const fetchPresets = async () => {
    const { data } = await supabase
      .from('project_presets')
      .select('*')
      .eq('is_active', true)
      .order('sort_order');
    if (data) setPresets(data);
  };

  const fetchEmployeeSettings = async () => {
    const { data } = await supabase.from('employee_type_settings').select('*');
    if (data) setEmployeeSettings(data);
  };

  const getUnitPrice = (projectName: string): number => {
    if (projectName === '上班') {
      const setting = employeeSettings.find(
        (s) => s.type_name === profile?.employee_type
      );
      return setting?.daily_wage ?? 0;
    }
    const preset = presets.find((p) => p.project_name === projectName);
    return preset?.unit_price ?? 0;
  };

  const getOvertimeRate = (): number => {
    const setting = employeeSettings.find(
      (s) => s.type_name === profile?.employee_type
    );
    return setting?.overtime_rate ?? 9;
  };

  const handleCountChange = (count: number) => {
    setRecordCount(count);
    const currentRecords = form.getFieldValue('records') || [];
    if (count > currentRecords.length) {
      const newRecords = [...currentRecords];
      for (let i = currentRecords.length; i < count; i++) {
        newRecords.push(getDefaultRecord());
      }
      form.setFieldsValue({ records: newRecords });
    } else {
      form.setFieldsValue({ records: currentRecords.slice(0, count) });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (!profile) return;

      setSubmitting(true);
      const records = values.records.map((r: RecordFormItem) => ({
        user_id: profile.id,
        user_name: profile.name,
        project_name: r.project_name,
        workload: r.workload,
        overtime: r.overtime,
        unit_price_snapshot: getUnitPrice(r.project_name),
        overtime_rate_snapshot: getOvertimeRate(),
        notes: r.notes || '',
        record_date: r.record_date.format('YYYY-MM-DD'),
      }));

      const { error } = await supabase.from('work_records').insert(records);

      if (error) {
        message.error('添加失败: ' + error.message);
      } else {
        message.success(`成功添加 ${records.length} 条记录`);
        onSuccess();
        onClose();
      }
    } catch {
      // form validation error
    } finally {
      setSubmitting(false);
    }
  };

  // 工作量选项: 0-100
  const workloadOptions = Array.from({ length: 101 }, (_, i) => ({
    value: i,
    label: `${i}`,
  }));

  // 加班选项: 0, 0.5, 1, 1.5 ... 24
  const overtimeOptions = Array.from({ length: 49 }, (_, i) => ({
    value: i * 0.5,
    label: `${i * 0.5} 小时`,
  }));

  // 项目下拉选项
  const projectOptions = presets.map((p) => ({
    value: p.project_name,
    label: `${p.project_name} (${p.unit_price}元/${p.unit_label})`,
  }));

  return (
    <Modal
      title="添加工作记录"
      open={open}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
          提交
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Space>
          <span>添加条数:</span>
          <Select
            value={recordCount}
            onChange={handleCountChange}
            style={{ width: 80 }}
            options={Array.from({ length: 10 }, (_, i) => ({
              value: i + 1,
              label: `${i + 1}`,
            }))}
          />
          <span style={{ color: '#999' }}>
            当前用户: <strong>{profile?.name}</strong>
          </span>
        </Space>
      </div>

      <Form form={form} layout="vertical">
        <Form.List name="records">
          {(fields, { remove }) => (
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {fields.map((field, index) => (
                <Card
                  key={field.key}
                  size="small"
                  title={`记录 ${index + 1}`}
                  style={{ marginBottom: 12 }}
                  extra={
                    fields.length > 1 ? (
                      <Button
                        type="text"
                        danger
                        icon={<MinusCircleOutlined />}
                        onClick={() => {
                          remove(field.name);
                          setRecordCount((c) => c - 1);
                        }}
                      />
                    ) : null
                  }
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                    <Form.Item
                      {...field}
                      label="日期"
                      name={[field.name, 'record_date']}
                      rules={[{ required: true, message: '请选择日期' }]}
                      initialValue={dayjs()}
                    >
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      label="项目名称"
                      name={[field.name, 'project_name']}
                      rules={[{ required: true, message: '请选择或输入项目' }]}
                    >
                      <Select
                        showSearch
                        allowClear
                        placeholder="选择或输入项目"
                        options={projectOptions}
                        dropdownRender={(menu) => (
                          <>
                            {menu}
                            <Divider style={{ margin: '8px 0' }} />
                            <div style={{ padding: '4px 8px', color: '#999', fontSize: 12 }}>
                              可直接输入自定义项目名称
                            </div>
                          </>
                        )}
                      />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      label={`工作量`}
                      name={[field.name, 'workload']}
                      rules={[{ required: true, message: '请输入工作量' }]}
                      initialValue={0}
                    >
                      <Select
                        showSearch
                        placeholder="选择或输入"
                        options={workloadOptions}
                      />
                    </Form.Item>

                    <Form.Item
                      {...field}
                      label="加班"
                      name={[field.name, 'overtime']}
                      initialValue={0}
                    >
                      <Select
                        showSearch
                        placeholder="选择或输入"
                        options={overtimeOptions}
                      />
                    </Form.Item>
                  </div>

                  <Form.Item
                    {...field}
                    label="备注"
                    name={[field.name, 'notes']}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea rows={1} placeholder="可选备注" />
                  </Form.Item>
                </Card>
              ))}
            </div>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
