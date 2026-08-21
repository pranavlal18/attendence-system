import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { AttendanceMatrix, AttendanceMatrixCell } from "@/services/report-service";

const PAGE_HEADER_BG: [number, number, number] = [41, 41, 41];
const ROW_ALT_BG: [number, number, number] = [244, 244, 245];
const ABSENT_RED: [number, number, number] = [185, 28, 28];

function monthLabel(monthYear: string): string {
  const [y, m] = monthYear.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface WorkerTotals {
  present: number;
  fulls: number;
  halves: number;
}

function computeTotals(cells: Record<number, AttendanceMatrixCell>): WorkerTotals {
  let present = 0;
  let fulls = 0;
  let halves = 0;
  for (const c of Object.values(cells)) {
    if (c === "" || c === "A") continue;
    present += 1;
    if (c === "F") fulls += 1;
    else if (c === "2F") fulls += 2;
    else if (c === "H") halves += 1;
    else if (c === "FH") {
      fulls += 1;
      halves += 1;
    }
  }
  return { present, fulls, halves };
}

export function generateAttendancePdf(matrix: AttendanceMatrix): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ---- Header block ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Attendance Report", 14, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(
    `${monthLabel(matrix.monthYear)}  ·  until ${formatDate(matrix.endDate)}  ·  generated ${new Date().toLocaleString("en-GB")}`,
    14,
    18
  );
  doc.setTextColor(0);

  // ---- Table columns: Name + days + totals ----
  const totalsHeadBg: [number, number, number] = [55, 65, 81];
  const head = [
    [
      { content: "Worker", styles: { halign: "left" as const } },
      ...matrix.days.map(String),
      { content: "P", styles: { fillColor: totalsHeadBg } },
      { content: "F", styles: { fillColor: totalsHeadBg } },
      { content: "H", styles: { fillColor: totalsHeadBg } },
    ],
  ];

  const body = matrix.workers.map((w) => {
    const totals = computeTotals(w.cells);
    return [
      w.workerName,
      ...matrix.days.map((d) => w.cells[d] ?? ""),
      String(totals.present),
      String(totals.fulls),
      String(totals.halves),
    ];
  });

  const dayCount = Math.max(matrix.days.length, 1);
  // Budget: page ~297mm; name 32 + totals 3*11 = 65 -> remaining split across days
  const dayColWidth = Math.min(7.5, Math.max(4.5, (pageWidth - 14 * 2 - 32 - 33 - 8) / dayCount));

  autoTable(doc, {
    head,
    body,
    startY: 22,
    margin: { left: 14, right: 14, top: 22 },
    theme: "grid",
    styles: {
      font: "helvetica",
      fontSize: 6.5,
      cellPadding: { top: 1.2, right: 0.5, bottom: 1.2, left: 0.5 },
      halign: "center",
      valign: "middle",
      lineColor: [203, 203, 210],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: PAGE_HEADER_BG,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 6.5,
      halign: "center",
    },
    alternateRowStyles: { fillColor: ROW_ALT_BG },
    columnStyles: {
      0: { cellWidth: 32, halign: "left", fontStyle: "bold" },
      ...Object.fromEntries(
        matrix.days.map((_, i) => [i + 1, { cellWidth: dayColWidth }])
      ),
      [dayCount + 1]: { cellWidth: 11, fillColor: [238, 238, 240], fontStyle: "bold" },
      [dayCount + 2]: { cellWidth: 11, fillColor: [238, 238, 240], fontStyle: "bold" },
      [dayCount + 3]: { cellWidth: 11, fillColor: [238, 238, 240], fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index > 0 && data.column.index <= dayCount) {
        const v = String(data.cell.raw ?? "");
        if (v === "A") {
          data.cell.styles.textColor = ABSENT_RED;
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  // ---- Footers (after table: total page count is now known) ----
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 6, {
      align: "center",
    });
    doc.setTextColor(0);
  }

  // ---- Legend under the table ----
  type WithLastTable = jsPDF & { lastAutoTable?: { finalY: number } };
  const finalY = (doc as WithLastTable).lastAutoTable?.finalY ?? 30;
  let legendY = finalY + 6;
  if (legendY > pageHeight - 14) legendY = pageHeight - 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(90);
  doc.text(
    "F = 1 Full   ·   2F = 2 Fulls   ·   H = Half   ·   FH = 1 Full + 1 Half   ·   A = Absent   ·   P/F/H = Present days / Total Fulls / Total Halves",
    14,
    legendY
  );
  doc.setTextColor(0);

  const safeName = `attendance-${matrix.monthYear}.pdf`;
  doc.save(safeName);
}
