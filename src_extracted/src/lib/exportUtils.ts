import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export const formatCurrency = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString('en-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ar-SA', {
    calendar: 'gregory',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

interface ExcelExportOptions {
  fileName: string;
  sheetName: string;
  title: string;
  headers: string[];
  data: any[][];
  columnWidths?: number[];
  summary?: { label: string; value: string }[];
}

export const exportToExcel = async (options: ExcelExportOptions) => {
  const { fileName, sheetName, title, headers, data, columnWidths, summary } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName, {
    properties: { defaultColWidth: 20 },
    views: [{ rightToLeft: true }]
  });

  let currentRow = 1;

  worksheet.mergeCells(currentRow, 1, currentRow, headers.length);
  const titleCell = worksheet.getCell(currentRow, 1);
  titleCell.value = title;
  titleCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  currentRow++;

  worksheet.mergeCells(currentRow, 1, currentRow, headers.length);
  const dateCell = worksheet.getCell(currentRow, 1);
  dateCell.value = `تاريخ التقرير: ${formatDate(new Date().toISOString())}`;
  dateCell.font = { size: 12, italic: true };
  dateCell.alignment = { horizontal: 'center' };
  currentRow++;

  if (summary && summary.length > 0) {
    currentRow++;
    summary.forEach(item => {
      worksheet.mergeCells(currentRow, 1, currentRow, headers.length);
      const summaryCell = worksheet.getCell(currentRow, 1);
      summaryCell.value = `${item.label}: ${item.value}`;
      summaryCell.font = { size: 13, bold: true };
      summaryCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      summaryCell.alignment = { horizontal: 'center', vertical: 'middle' };
      currentRow++;
    });
    currentRow++;
  }

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  headerRow.eachCell((cell) => {
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  data.forEach((row, index) => {
    const dataRow = worksheet.addRow(row);
    dataRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    if (index % 2 === 0) {
      dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    }
  });

  if (columnWidths) {
    columnWidths.forEach((width, index) => {
      worksheet.getColumn(index + 1).width = width;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

interface PDFExportOptions {
  fileName: string;
  title: string;
  headers: string[];
  data: any[][];
  summary?: { label: string; value: string }[];
  orientation?: 'portrait' | 'landscape';
}

export const exportToPDF = (options: PDFExportOptions) => {
  const { fileName, title, headers, data, summary, orientation = 'portrait' } = options;

  const doc = new jsPDF(orientation, 'mm', 'a4');

  let yPosition = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`تاريخ التقرير: ${formatDate(new Date().toISOString())}`, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
  yPosition += 10;

  if (summary && summary.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    summary.forEach(item => {
      doc.text(`${item.label}: ${item.value}`, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
      yPosition += 7;
    });
    yPosition += 5;
  }

  doc.autoTable({
    head: [headers],
    body: data,
    startY: yPosition,
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 3,
      halign: 'right'
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246]
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 }
  });

  doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
};
