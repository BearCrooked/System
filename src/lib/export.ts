import * as XLSX from 'xlsx';
import type { WorkRecord } from '../types';
import { calculateRecordSalary, generateSalaryDetails, calculateTotalSalary } from './salary';

/**
 * 导出工作记录到 Excel
 */
export function exportRecordsToExcel(
  records: WorkRecord[],
  fileName: string = '工作记录'
) {
  const wb = XLSX.utils.book_new();

  // 工作记录明细 Sheet
  const recordData = records.map((r) => ({
    日期: r.record_date,
    姓名: r.user_name,
    项目名称: r.project_name,
    工作量: r.workload,
    '加班(小时)': r.overtime,
    '单价(元)': r.unit_price_snapshot,
    '加班费率(元/小时)': r.overtime_rate_snapshot,
    '薪资(元)': calculateRecordSalary(r),
    备注: r.notes,
  }));

  const ws1 = XLSX.utils.json_to_sheet(recordData);

  // 设置列宽
  ws1['!cols'] = [
    { wch: 12 }, // 日期
    { wch: 10 }, // 姓名
    { wch: 16 }, // 项目名称
    { wch: 8 },  // 工作量
    { wch: 10 }, // 加班
    { wch: 10 }, // 单价
    { wch: 14 }, // 加班费率
    { wch: 10 }, // 薪资
    { wch: 20 }, // 备注
  ];

  XLSX.utils.book_append_sheet(wb, ws1, '工作记录明细');

  // 薪资汇总 Sheet
  const details = generateSalaryDetails(records);
  const summaryData = details.map((d) => ({
    项目名称: d.projectName,
    记录条数: d.recordCount,
    总工作量: d.totalWorkload,
    '总加班(小时)': d.totalOvertime,
    '基本薪资(元)': d.totalBasePay,
    '加班费(元)': d.totalOvertimePay,
    '小计(元)': d.totalSalary,
  }));

  // 添加合计行
  const totalSalary = calculateTotalSalary(records);
  summaryData.push({
    项目名称: '【合计】',
    记录条数: records.length,
    总工作量: records.reduce((s, r) => s + r.workload, 0),
    '总加班(小时)': records.reduce((s, r) => s + r.overtime, 0),
    '基本薪资(元)': details.reduce((s, d) => s + d.totalBasePay, 0),
    '加班费(元)': details.reduce((s, d) => s + d.totalOvertimePay, 0),
    '小计(元)': totalSalary,
  });

  const ws2 = XLSX.utils.json_to_sheet(summaryData);
  ws2['!cols'] = [
    { wch: 16 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws2, '薪资汇总');

  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

/**
 * 导出多个用户的薪资到 Excel（管理员用）
 */
export function exportAllUsersSalaryToExcel(
  userRecordsMap: Map<string, WorkRecord[]>,
  month: string
) {
  const wb = XLSX.utils.book_new();

  // 总汇总 Sheet
  const overviewData: Record<string, unknown>[] = [];

  userRecordsMap.forEach((records, userName) => {
    const totalSalary = calculateTotalSalary(records);
    overviewData.push({
      姓名: userName,
      记录条数: records.length,
      总工作量: records.reduce((s, r) => s + r.workload, 0),
      '总加班(小时)': records.reduce((s, r) => s + r.overtime, 0),
      '月薪合计(元)': totalSalary,
    });

    // 为每个用户创建单独的 Sheet
    const userRecordData = records.map((r) => ({
      日期: r.record_date,
      项目名称: r.project_name,
      工作量: r.workload,
      '加班(小时)': r.overtime,
      '单价(元)': r.unit_price_snapshot,
      '加班费率(元/小时)': r.overtime_rate_snapshot,
      '薪资(元)': calculateRecordSalary(r),
      备注: r.notes,
    }));

    if (userRecordData.length > 0) {
      const ws = XLSX.utils.json_to_sheet(userRecordData);
      // Sheet 名最多 31 个字符
      const sheetName = userName.slice(0, 28);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  });

  const wsOverview = XLSX.utils.json_to_sheet(overviewData);
  wsOverview['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
  ];

  // 把总汇总放在第一个 Sheet
  wb.SheetNames.unshift('薪资总览');
  wb.Sheets['薪资总览'] = wsOverview;

  XLSX.writeFile(wb, `全员薪资_${month}.xlsx`);
}
