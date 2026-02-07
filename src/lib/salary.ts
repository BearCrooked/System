import type { WorkRecord } from '../types';

/**
 * 计算单条工作记录的薪资
 * 公式：
 *   普通项目: unit_price_snapshot * workload + overtime * overtime_rate_snapshot
 *   "上班"项目: unit_price_snapshot(=身份日薪) * workload(天数) + overtime * overtime_rate_snapshot
 * 两者公式一致，因为"上班"在创建时已将日薪存入 unit_price_snapshot
 */
export function calculateRecordSalary(record: WorkRecord): number {
  const basePay = record.unit_price_snapshot * record.workload;
  const overtimePay = record.overtime * record.overtime_rate_snapshot;
  return basePay + overtimePay;
}

/**
 * 计算多条记录的总薪资
 */
export function calculateTotalSalary(records: WorkRecord[]): number {
  return records.reduce((sum, record) => sum + calculateRecordSalary(record), 0);
}

/**
 * 生成薪资明细
 */
export interface SalaryDetail {
  projectName: string;
  recordCount: number;
  totalWorkload: number;
  totalOvertime: number;
  totalBasePay: number;
  totalOvertimePay: number;
  totalSalary: number;
}

export function generateSalaryDetails(records: WorkRecord[]): SalaryDetail[] {
  const grouped = new Map<string, WorkRecord[]>();

  records.forEach((record) => {
    const key = record.project_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(record);
  });

  const details: SalaryDetail[] = [];

  grouped.forEach((groupRecords, projectName) => {
    const totalWorkload = groupRecords.reduce((s, r) => s + r.workload, 0);
    const totalOvertime = groupRecords.reduce((s, r) => s + r.overtime, 0);
    const totalBasePay = groupRecords.reduce(
      (s, r) => s + r.unit_price_snapshot * r.workload,
      0
    );
    const totalOvertimePay = groupRecords.reduce(
      (s, r) => s + r.overtime * r.overtime_rate_snapshot,
      0
    );

    details.push({
      projectName,
      recordCount: groupRecords.length,
      totalWorkload,
      totalOvertime,
      totalBasePay,
      totalOvertimePay,
      totalSalary: totalBasePay + totalOvertimePay,
    });
  });

  return details;
}
