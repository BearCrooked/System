import { useEffect, useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import type { WorkRecord, ProjectPreset, EmployeeTypeSetting } from '../types';

interface EditRecordModalProps {
  open: boolean;
  record: WorkRecord | null;
  employeeType: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditRecordModal({
  open,
  record,
  employeeType,
  onClose,
  onSuccess,
}: EditRecordModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  const [employeeSettings, setEmployeeSettings] = useState<EmployeeTypeSetting[]>([]);

  useEffect(() => {
    if (open && record) {
      form.setFieldsValue({
        project_name: record.project_name,
        workload: record.workload,
        overtime: record.overtime,
        notes: record.notes,
        record_date: dayjs(record.record_date),
      });
    }
  }, [open, record, form]);

  useEffect(() => {
    if (!open) return;
    const fetchData = async () => {
      const [presetRes, settingRes] = await Promise.all([
        supabase.from('project_presets').select('*'),
        supabase.from('employee_type_settings').select('*'),
      ]);
      if (presetRes.data) setPresets(presetRes.data as ProjectPreset[]);
      if (settingRes.data) setEmployeeSettings(settingRes.data as EmployeeTypeSetting[]);
    };
    void fetchData();
  }, [open]);

  const getUnitPrice = (projectName: string): number => {
    if (projectName === '上班') {
      const setting = employeeSettings.find((s) => s.type_name === employeeType);
      return setting?.daily_wage ?? 0;
    }
    const preset = presets.find((p) => p.project_name === projectName);
    return preset?.unit_price ?? 0;
  };

  const getOvertimeRate = (): number => {
    const setting = employeeSettings.find((s) => s.type_name === employeeType);
    return setting?.overtime_rate ?? 9;
  };

  const handleSubmit = async () => {
    if (!record) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);

      const projectName = values.project_name.trim();
      const updates = {
        project_name: projectName,
        workload: values.workload,
        overtime: values.overtime,
        notes: values.notes || '',
        record_date: values.record_date.format('YYYY-MM-DD'),
        unit_price_snapshot: getUnitPrice(projectName),
        overtime_rate_snapshot: getOvertimeRate(),
      };

      const { error } = await supabase
        .from('work_records')
        .update(updates)
        .eq('id', record.id);

      if (error) {
        message.error('更新失败: ' + error.message);
        return;
      }
      message.success('更新成功');
      onSuccess();
      onClose();
    } catch {
      // validation error
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="编辑记录"
      open={open}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={submitting}
      okText="保存"
      cancelText="取消"
      width={520}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="项目名称"
          name="project_name"
          rules={[{ required: true, message: '请输入项目名称' }]}
        >
          <Input placeholder="例如：Ai漫剪辑 / 上班" />
        </Form.Item>
        <Form.Item
          label="工作量"
          name="workload"
          rules={[{ required: true, message: '请输入工作量' }]}
        >
          <InputNumber min={0} max={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          label="加班(时)"
          name="overtime"
          rules={[{ required: true, message: '请输入加班时长' }]}
        >
          <InputNumber min={0} max={24} step={0.5} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="备注" name="notes">
          <Input placeholder="可填写备注" />
        </Form.Item>
        <Form.Item
          label="日期"
          name="record_date"
          rules={[{ required: true, message: '请选择日期' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
