import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportRow {
  driver: string;
  plate: string;
  route: string;
  passengers: string;
  tourist: string;
  date: string;
  distanceKm: number;
  durationMin: number;
  amount: number;
  status: string;
  receiptUrl: string;
}

const HEADERS = [
  'Sürücü',
  'Plaka',
  'Güzergah',
  'Yolcular',
  'Turist',
  'Tarih',
  'Mesafe (km)',
  'Süre (dk)',
  'Tutar (TL)',
  'Durum',
  'Fiş URL',
];

function toMatrix(rows: ExportRow[]): (string | number)[][] {
  return rows.map((r) => [
    r.driver,
    r.plate,
    r.route,
    r.passengers,
    r.tourist,
    r.date,
    r.distanceKm,
    r.durationMin,
    r.amount,
    r.status,
    r.receiptUrl,
  ]);
}

export function exportToExcel(rows: ExportRow[], fileName = 'surusler.xlsx') {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...toMatrix(rows)]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sürüşler');
  XLSX.writeFile(wb, fileName);
}

export function exportToPdf(rows: ExportRow[], fileName = 'surusler.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text('BisiCab - Surus Denetim Raporu', 14, 15);
  autoTable(doc, {
    startY: 22,
    head: [HEADERS.slice(0, 9)],
    body: toMatrix(rows).map((r) => r.slice(0, 9)),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [11, 15, 12], textColor: [245, 197, 24] },
  });
  doc.save(fileName);
}
