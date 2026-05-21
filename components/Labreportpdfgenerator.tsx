/**
 * labReportPdfGenerator.ts  (UPDATED)
 *
 * Changes:
 *  1. Patient block now mirrors pdfGenerator.ts applyCompactPatientDetails format
 *  2. Logo (/lablo.png) and signature (/nsign.png) loaded via fetch→base64 so
 *     they work inside browser preview windows (no cross-origin issues)
 *  3. L / H flag column added to table sections — compares numeric value against
 *     the numeric normal-range and prints "L" (low) or "H" (high) in red/blue
 *  4. Enhanced visual design: section-title bands, alternating row tints,
 *     bold-value column, tighter spacing
 */

import jsPDF from 'jspdf';

// ─── Colors ──────────────────────────────────────────────────────────────────
const BLUE  = [0,  51,  153] as const;
const RED   = [180, 20,  20] as const;
const BLACK = [0,   0,   0 ] as const;
const GRAY  = [120,120, 120] as const;
const LIGHT_BLUE_BG = [230, 236, 255] as const;
const LIGHT_GRAY_BG = [245, 245, 248] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LabReportRow {
  investigation: string;
  value:         string;
  unit:          string;
  normalValue:   string;
}

export interface LabReportSection {
  sectionTitle:  string;
  sectionType:   'table' | 'freetext';
  rows?:         LabReportRow[];
  freeTextRows?: string[];
  method?:       string;
}

export interface LabReportPatient {
  patientName: string;
  age:         string;
  gender:      string;
  village:     string;
  doctorName:  string;
  phone?:      string;
  opId?:       string;
  reportId?:   string;
  reportDate?: string | Date;
}

// ─── Image cache (base64) ─────────────────────────────────────────────────────
const _imgCache: Record<string, string> = {};

async function loadImgBase64(src: string): Promise<string | null> {
  if (_imgCache[src]) return _imgCache[src];
  try {
    const res  = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload  = () => { const b64 = (fr.result as string); _imgCache[src] = b64; resolve(b64); };
      fr.onerror = () => reject(null);
      fr.readAsDataURL(blob);
    });
  } catch { return null; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function outputPDF(doc: jsPDF, filename: string) {
  doc.autoPrint();
  const blob    = doc.output('blob');
  const blobUrl = URL.createObjectURL(blob);
  const win     = window.open(blobUrl, '_blank');
  if (!win) doc.save(filename);
}

function formatDate(val: string | Date | undefined | null): string {
  if (!val) return new Date().toLocaleDateString('en-IN');
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatAppTime(val: any): string {
  if (!val) return '';
  if (typeof val === 'string' && val.includes('T')) {
    const d = new Date(val);
    if (!isNaN(d.getTime()))
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return '';
}

/**
 * parseNormalRange — extract [low, high] from strings like:
 *   "0.7 – 1.5 mg/dl"   "< 180 mg/dl"   "70 – 100"   "11.5 – 16.5"
 * Returns [null, null] when not parseable.
 */
function parseNormalRange(normalValue: string): [number | null, number | null] {
  if (!normalValue) return [null, null];
  // "X – Y" or "X - Y" or "X to Y"
  const rangeMatch = normalValue.match(/([\d.]+)\s*(?:–|-|to)\s*([\d.]+)/i);
  if (rangeMatch) return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
  // "< X"
  const ltMatch = normalValue.match(/<\s*([\d.]+)/);
  if (ltMatch) return [null, parseFloat(ltMatch[1])];
  // "> X"
  const gtMatch = normalValue.match(/>\s*([\d.]+)/);
  if (gtMatch) return [parseFloat(gtMatch[1]), null];
  return [null, null];
}

/**
 * Returns 'L', 'H', or '' for a given value vs normalValue string.
 */
function flagValue(value: string, normalValue: string): 'L' | 'H' | '' {
  const num = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  const [lo, hi] = parseNormalRange(normalValue);
  if (lo !== null && num < lo) return 'L';
  if (hi !== null && num > hi) return 'H';
  return '';
}

// ─── Lab Header ───────────────────────────────────────────────────────────────

async function drawLabHeader(
  doc: jsPDF,
  w: number,
  MARGIN: number,
  logoB64: string | null,
  docB64:  string | null
): Promise<number> {
  let y = MARGIN;

  // Phone
  doc.setFont('times', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('Cell : 9849012345, 9618012345', w - MARGIN, y + 4, { align: 'right' });

  // Logo left
  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', MARGIN, y, 24, 24); } catch (_) {}
  } else {
    doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
    doc.setLineWidth(0.4);
    doc.rect(MARGIN, y, 24, 24);
    doc.setFontSize(13);
    doc.text('L', MARGIN + 8, y + 16);
  }

  // Doctor image right
  if (docB64) {
    try { doc.addImage(docB64, 'PNG', w - MARGIN - 24, y + 2, 22, 22); } catch (_) {}
  }

  y += 13;
  doc.setFontSize(18);
  doc.setFont('times', 'bold');
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text('Health Care Laboratory', w / 2, y, { align: 'center' });

  y += 7;
  doc.setFontSize(10);
  doc.setFont('times', 'normal');
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text(
    'Beside Aadhya hospital, backside Nandi temple, Nandipet',
    w / 2, y, { align: 'center' }
  );

  y += 5;
  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, w - MARGIN, y);

  return y + 4;
}

// ─── Patient block — mirrors applyCompactPatientDetails from pdfGenerator ────

function drawPatientBlock(
  doc: jsPDF,
  w: number,
  MARGIN: number,
  patient: LabReportPatient,
  y: number
): number {
  doc.setFontSize(8.5);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

  const lColon = MARGIN + 22;
  const lVal   = lColon + 2.5;
  const rCol   = w / 2 + 8;
  const rColon = rCol  + 22;
  const rVal   = rColon + 2.5;
  const rowH   = 4.5;

  const doctorDisplay = patient.doctorName
    ? patient.doctorName.toLowerCase().startsWith('dr')
      ? patient.doctorName
      : `Dr. ${patient.doctorName}`
    : 'Dr. Thirupathi Kandli';

  const printDate = formatDate(patient.reportDate);
  const printTime = formatAppTime(patient.reportDate);

  const writeLine = (
    lKey: string, lValue: string,
    rKey: string, rValue: string,
    boldRight = false
  ) => {
    doc.setFont('times', 'bold');
    doc.text(lKey, MARGIN, y); doc.text(':', lColon, y);
    doc.setFont('times', 'normal'); doc.text(lValue, lVal, y);
    doc.setFont('times', 'bold');
    doc.text(rKey, rCol, y); doc.text(':', rColon, y);
    if (!boldRight) doc.setFont('times', 'normal');
    doc.text(rValue, rVal, y);
    y += rowH;
  };

  writeLine(
    'Patient Name', patient.patientName || 'N/A',
    'Patient Id',   patient.opId || 'N/A'
  );
  writeLine(
    'Age/Gender', `${patient.age || 'N/A'} / ${patient.gender || 'N/A'}`,
    'Phone',       patient.phone || 'N/A'
  );
  writeLine(
    'Consultant',  doctorDisplay,
    'Report Date', `${printDate}${printTime ? ' ' + printTime : ''}`
  );
  writeLine(
    'Report Id',   patient.reportId || 'N/A',
    'Village',     patient.village  || 'N/A',
    true
  );

  y += 1.5;
  doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 4;

  return y;
}

// ─── Table section with L/H column ───────────────────────────────────────────

function drawTableSection(
  doc: jsPDF,
  w: number,
  MARGIN: number,
  section: LabReportSection,
  y: number
): number {
  const rows = section.rows || [];

  // ── Section title band ──
  doc.setFillColor(LIGHT_BLUE_BG[0], LIGHT_BLUE_BG[1], LIGHT_BLUE_BG[2]);
  doc.rect(MARGIN, y - 1, w - MARGIN * 2, 8, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text(section.sectionTitle, w / 2, y + 5, { align: 'center' });
  y += 10;

  // ── Column positions ──
  const c1 = MARGIN + 2;          // Investigation
  const c2 = w * 0.48;            // Value
  const cFlag = w * 0.58;         // L / H
  const c3 = w * 0.63;            // Unit
  const c4 = w * 0.78;            // Normal Value

  // ── Header row ──
  doc.setFontSize(8.5);
  doc.setFont('times', 'bold');
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text('INVESTIGATION', c1,    y);
  doc.text('VALUE',         c2,    y);
  doc.text('F',             cFlag, y);
  doc.text('UNITS',         c3,    y);
  doc.text('NORMAL VALUE',  c4,    y);
  y += 2.5;
  doc.setDrawColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setLineWidth(0.35);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 4;

  // ── Data rows ──
  rows.forEach((row, i) => {
    // alternating row tint
    if (i % 2 === 1) {
      doc.setFillColor(LIGHT_GRAY_BG[0], LIGHT_GRAY_BG[1], LIGHT_GRAY_BG[2]);
      doc.rect(MARGIN, y - 3.5, w - MARGIN * 2, 6, 'F');
    }

    const flag = flagValue(row.value, row.normalValue);

    doc.setFont('times', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(row.investigation || '', c1, y);

    // Value bold
    doc.setFont('times', 'bold');
    doc.text(row.value || '', c2, y);

    // L / H flag
    if (flag === 'L') {
      doc.setTextColor(0, 80, 200);
      doc.setFont('times', 'bold');
      doc.text('L', cFlag, y);
    } else if (flag === 'H') {
      doc.setTextColor(RED[0], RED[1], RED[2]);
      doc.setFont('times', 'bold');
      doc.text('H', cFlag, y);
    }

    doc.setFont('times', 'normal');
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(row.unit        || '', c3, y);
    doc.text(row.normalValue || '', c4, y);

    y += 6;
  });

  // Method line
  if (section.method) {
    y += 1;
    doc.setFontSize(7.5);
    doc.setFont('times', 'italic');
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(`Method : ${section.method}`, MARGIN + 2, y);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    y += 5;
  }

  y += 4;
  return y;
}

// ─── Free-text section ────────────────────────────────────────────────────────

function drawFreeTextSection(
  doc: jsPDF,
  w: number,
  MARGIN: number,
  section: LabReportSection,
  y: number
): number {
  const lines = section.freeTextRows || [];

  // Section title band
  doc.setFillColor(LIGHT_BLUE_BG[0], LIGHT_BLUE_BG[1], LIGHT_BLUE_BG[2]);
  doc.rect(MARGIN, y - 1, w - MARGIN * 2, 8, 'F');
  doc.setFont('times', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.text(section.sectionTitle, w / 2, y + 5, { align: 'center' });
  y += 12;

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

  lines.forEach((line, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(LIGHT_GRAY_BG[0], LIGHT_GRAY_BG[1], LIGHT_GRAY_BG[2]);
      doc.rect(MARGIN, y - 4, w - MARGIN * 2, 7, 'F');
    }
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      const mid = w / 2;
      doc.setFont('times', 'bold');
      doc.text(key, mid - 5, y, { align: 'right' });
      doc.setFont('times', 'normal');
      doc.text(`: ${val}`, mid - 4, y);
    } else {
      doc.setFont('times', 'bold');
      doc.text(line, w / 2, y, { align: 'center' });
    }
    y += 7;
  });

  if (section.method) {
    y += 1;
    doc.setFontSize(7.5);
    doc.setFont('times', 'italic');
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(`Method : ${section.method}`, MARGIN + 2, y);
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    y += 5;
  }

  y += 4;
  return y;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

async function drawLabFooter(
  doc: jsPDF,
  w: number,
  MARGIN: number,
  pageH: number,
  signB64: string | null
) {
  const sigY = pageH - 28;

  doc.setDrawColor(BLUE[0], BLUE[1], BLUE[2]);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, sigY - 2, w - MARGIN, sigY - 2);

  // Disclaimer text left
  doc.setFontSize(7);
  doc.setFont('times', 'italic');
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('This report is for diagnostic purposes only. Please correlate clinically.', MARGIN, sigY + 4);
  doc.text('F = Flag  |  L = Low  |  H = High', MARGIN, sigY + 9);

  // Signature image right
  if (signB64) {
    try { doc.addImage(signB64, 'PNG', w - MARGIN - 42, sigY - 14, 30, 12); } catch (_) {}
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text('SK Salman (DMLT)', w - MARGIN, sigY + 5,  { align: 'right' });
  doc.text('Lab Technician',   w - MARGIN, sigY + 10, { align: 'right' });
}

// ─── PUBLIC: Main generator ───────────────────────────────────────────────────

export async function generateLabReportPDF(
  patient:   LabReportPatient,
  sections:  LabReportSection[],
  reportId?: string
) {
  // Pre-load images (they will be base64 so they render in any preview window)
  const [logoB64, docB64, signB64] = await Promise.all([
    loadImgBase64('/lablo.png'),
    loadImgBase64('/doc1.png'),
    loadImgBase64('/nsign.png'),
  ]);

  const doc    = new jsPDF();
  const w      = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const MARGIN = 12;

  const renderHeader = async (): Promise<number> => {
    return drawLabHeader(doc, w, MARGIN, logoB64, docB64);
  };

  let y = await renderHeader();
  y = drawPatientBlock(doc, w, MARGIN, patient, y);

  // Report ID label
  if (reportId) {
    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(`Report ID: ${reportId}`, w - MARGIN, y - 1, { align: 'right' });
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  }

  for (const section of sections) {
    if (y > pageH - 45) {
      doc.addPage();
      y = await renderHeader();
      y = drawPatientBlock(doc, w, MARGIN, patient, y);
    }
    if (section.sectionType === 'freetext') {
      y = drawFreeTextSection(doc, w, MARGIN, section, y);
    } else {
      y = drawTableSection(doc, w, MARGIN, section, y);
    }
  }

  await drawLabFooter(doc, w, MARGIN, pageH, signB64);

  const safe = (patient.patientName || 'Patient').replace(/\s+/g, '_');
  outputPDF(doc, `${reportId || 'LabReport'}_${safe}.pdf`);
}

// ─── Template configs ─────────────────────────────────────────────────────────

export interface LabTemplateField {
  investigation: string;
  unit:          string;
  normalValue:   string;
}

export interface LabTemplate {
  reportType:    string;
  displayName:   string;
  sectionTitle:  string;
  sectionType:   'table' | 'freetext';
  fields?:       LabTemplateField[];
  freeTextKeys?: string[];
  method?:       string;
}

export const LAB_TEMPLATES: LabTemplate[] = [
  {
    reportType: 'RFT', displayName: 'Renal Function Test',
    sectionTitle: 'RENAL FUNCTION TEST', sectionType: 'table',
    fields: [
      { investigation: 'SERUM CREATININE',  unit: 'mg/dl', normalValue: '0.7 – 1.5 mg/dl' },
      { investigation: 'BLOOD UREA',        unit: 'mg/dl', normalValue: '14 – 45 mg/dl' },
      { investigation: 'SERUM URIC ACID',   unit: 'mg/dl', normalValue: '3.5 – 7.2 mg/dl' },
      { investigation: 'BUN',               unit: 'mg/dl', normalValue: '7.0 – 25.0 mg/dl' },
    ],
  },
  {
    reportType: 'SERUM_URIC_ACID', displayName: 'Serum Uric Acid',
    sectionTitle: 'SERUM URIC ACID', sectionType: 'table',
    fields: [
      { investigation: 'SERUM URIC ACID', unit: 'Mg/dl', normalValue: '3.5 – 7.2 Mg/dl' },
    ],
  },
  {
    reportType: 'TOTAL_BILIRUBIN', displayName: 'Total Serum Bilirubin',
    sectionTitle: 'REPORT ON TOTAL SERUM BILIRUBIN', sectionType: 'table',
    fields: [
      { investigation: 'TOTAL BILIRUBIN',    unit: 'mg/dl', normalValue: '0.2 – 1.0 mg/dl' },
      { investigation: 'DIRECT BILIRUBIN',   unit: 'mg/dl', normalValue: '0.0 – 0.2 mg/dl' },
      { investigation: 'INDIRECT BILIRUBIN', unit: 'mg/dl', normalValue: '0.2 – 0.8 mg/dl' },
    ],
  },
  {
    reportType: 'SERUM_CREATININE', displayName: 'Serum Creatinine',
    sectionTitle: 'SERUM CREATININE', sectionType: 'table',
    fields: [
      { investigation: 'SERUM CREATININE', unit: 'Mg/dl', normalValue: '0.7 – 1.5 Mg/dl' },
    ],
  },
  {
    reportType: 'RA_FACTOR', displayName: 'Rheumatoid Factor (RA Factor)',
    sectionTitle: 'RHEUMATOID FACTOR (RA FACTOR)', sectionType: 'table',
    method: 'Immunoassay Turbidimetry',
    fields: [{ investigation: 'RA FACTOR', unit: 'Iu/l', normalValue: '0 – 20 Iu/l' }],
  },
  {
    reportType: 'ASO_TITER', displayName: 'ASO Titer',
    sectionTitle: 'ASO TITER', sectionType: 'freetext',
    freeTextKeys: ['TEST FOR ASO'],
  },
  {
    reportType: 'WIDAL', displayName: 'Widal Test',
    sectionTitle: 'REPORT ON WIDAL', sectionType: 'freetext',
    freeTextKeys: [
      'SALMONELLA TYPE "O"',
      'SALMONELLA TYPE "H"',
      'SALMONELLA PARATYPE "A" (H)',
      'SALMONELLA PARATYPE "B" (H)',
    ],
  },
  {
    reportType: 'MALARIA', displayName: 'Malaria Parasite (ICT)',
    sectionTitle: 'REPORT ON MALARIA', sectionType: 'freetext',
    freeTextKeys: ['PLASMODIUM FALCIPARUM', 'PLASMODIUM VIVAX'],
  },
  {
    reportType: 'CBC', displayName: 'Complete Blood Picture (CBC)',
    sectionTitle: 'COMPLETE BLOOD PICTURE (HAEMOGRAM)', sectionType: 'table',
    method: 'AUTOMATED CELL COUNTER',
    fields: [
      { investigation: 'Hemoglobin (%)',  unit: 'gm.%',      normalValue: '11.5 – 16.5' },
      { investigation: 'R B C Count',    unit: 'mill/cmm',  normalValue: '3.9 – 5.5' },
      { investigation: 'W B C Count',    unit: '/ cum',     normalValue: '4000 – 11000' },
      { investigation: 'Platelet Count', unit: 'Lacks/cmm', normalValue: '1.5 – 4.5' },
      { investigation: 'H C T',          unit: '%',         normalValue: '40 – 50' },
      { investigation: 'M C V',          unit: 'FL',        normalValue: '76 – 96' },
      { investigation: 'M C H',          unit: 'pg.',       normalValue: '25 – 32' },
      { investigation: 'M C H C',        unit: 'g/dl',      normalValue: '30 – 36' },
    ],
  },
  {
    reportType: 'DIFF_COUNT', displayName: 'Differential Count',
    sectionTitle: 'DIFFERENTIAL COUNT', sectionType: 'table',
    fields: [
      { investigation: 'Neutrophils',  unit: '%', normalValue: '40 – 75' },
      { investigation: 'Lymphocytes', unit: '%', normalValue: '20 – 45' },
      { investigation: 'Monocytes',   unit: '%', normalValue: '02 – 10' },
      { investigation: "Eosinophil's",unit: '%', normalValue: '01 – 06' },
      { investigation: 'Basophils',   unit: '%', normalValue: '00 – 02' },
    ],
  },
  {
    reportType: 'BLOOD_GROUP', displayName: 'Blood Group & Rh Typing',
    sectionTitle: 'BLOOD FOR GROUPING AND Rh (D) TYPING', sectionType: 'freetext',
    freeTextKeys: ['Blood Group', 'Rh (D) Typing'],
  },
  {
    reportType: 'BT_CT', displayName: 'Bleeding Time & Clotting Time',
    sectionTitle: 'BLEEDING TIME & CLOTTING TIME', sectionType: 'table',
    fields: [
      { investigation: 'BLEEDING TIME', unit: 'Min Sec', normalValue: '1 – 5 MINUTES' },
      { investigation: 'CLOTTING TIME', unit: 'Min Sec', normalValue: '3 – 7 MINUTES' },
    ],
  },
  {
    reportType: 'OGTT', displayName: 'Oral Glucose Tolerance Test (OGTT)',
    sectionTitle: 'ORAL GLUCOSE TOLERANCE TEST (OGTT)', sectionType: 'table',
    fields: [
      { investigation: 'FASTING GLUCOSE', unit: 'mg/dl', normalValue: '70 – 100 mg/dl' },
      { investigation: '1 HOUR GLUCOSE',  unit: 'mg/dl', normalValue: '0 – 180 mg/dl' },
      { investigation: '2 HOURS GLUCOSE', unit: 'mg/dl', normalValue: '0 – 140 mg/dl' },
    ],
  },
  {
    reportType: 'RBS', displayName: 'Random Blood Sugar (RBS)',
    sectionTitle: 'RANDOM BLOOD SUGAR', sectionType: 'table',
    fields: [
      { investigation: 'RANDOM BLOOD SUGAR', unit: 'mg/dl', normalValue: '70 – 140 mg/dl' },
    ],
  },
  {
    reportType: 'CALCIUM', displayName: 'Serum Calcium',
    sectionTitle: 'SERUM CALCIUM', sectionType: 'table',
    fields: [
      { investigation: 'SERUM CALCIUM', unit: 'mg/dl', normalValue: '8.5 – 10.5 mg/dl' },
    ],
  },
  {
    reportType: 'SURGICAL_PROFILE', displayName: 'Surgical Profile',
    sectionTitle: 'SURGICAL PROFILE', sectionType: 'table',
    fields: [],
  },
  {
    reportType: 'LFT', displayName: 'Liver Function Test (LFT)',
    sectionTitle: 'LIVER FUNCTION TEST', sectionType: 'table',
    fields: [
      { investigation: 'SGOT (AST)',           unit: 'U/L',  normalValue: '10 – 40 U/L' },
      { investigation: 'SGPT (ALT)',           unit: 'U/L',  normalValue: '7 – 56 U/L' },
      { investigation: 'ALKALINE PHOSPHATASE', unit: 'U/L',  normalValue: '44 – 147 U/L' },
      { investigation: 'TOTAL PROTEIN',        unit: 'g/dl', normalValue: '6.0 – 8.3 g/dl' },
      { investigation: 'ALBUMIN',              unit: 'g/dl', normalValue: '3.5 – 5.0 g/dl' },
      { investigation: 'GLOBULIN',             unit: 'g/dl', normalValue: '2.3 – 3.5 g/dl' },
    ],
  },
  {
    reportType: 'TSH', displayName: 'Thyroid Stimulating Hormone (TSH)',
    sectionTitle: 'THYROID FUNCTION TEST', sectionType: 'table',
    method: 'Immunoassay',
    fields: [
      { investigation: 'TSH', unit: 'mIU/L', normalValue: '0.4 – 4.0 mIU/L' },
      { investigation: 'T3',  unit: 'ng/dl',  normalValue: '80 – 220 ng/dl' },
      { investigation: 'T4',  unit: 'µg/dl',  normalValue: '5.1 – 14.1 µg/dl' },
    ],
  },
  {
    reportType: 'DENGUE', displayName: 'Dengue NS1 Antigen & Antibody',
    sectionTitle: 'DENGUE TEST', sectionType: 'freetext',
    freeTextKeys: ['NS1 ANTIGEN', 'IgM ANTIBODY', 'IgG ANTIBODY'],
  },
  {
    reportType: 'TYPHIDOT', displayName: 'Typhidot (Typhoid IgM/IgG)',
    sectionTitle: 'TYPHIDOT TEST', sectionType: 'freetext',
    freeTextKeys: ['IgM (Acute)', 'IgG (Past Infection)'],
  },
  {
    reportType: 'HBA1C', displayName: 'HbA1c (Glycated Haemoglobin)',
    sectionTitle: 'HbA1c TEST', sectionType: 'table',
    fields: [
      { investigation: 'HbA1c', unit: '%', normalValue: '0 – 5.7 (Normal)' },
    ],
  },
  {
    reportType: 'URINE_ROUTINE', displayName: 'Urine Routine Examination',
    sectionTitle: 'URINE ROUTINE EXAMINATION', sectionType: 'table',
    fields: [
      { investigation: 'Colour',     unit: '',     normalValue: 'Pale Yellow' },
      { investigation: 'Appearance', unit: '',     normalValue: 'Clear' },
      { investigation: 'pH',         unit: '',     normalValue: '4.5 – 8.0' },
      { investigation: 'Protein',    unit: '',     normalValue: 'Nil' },
      { investigation: 'Glucose',    unit: '',     normalValue: 'Nil' },
      { investigation: 'Ketones',    unit: '',     normalValue: 'Nil' },
      { investigation: 'Blood',      unit: '',     normalValue: 'Nil' },
      { investigation: 'Pus Cells',  unit: '/HPF', normalValue: '0 – 5 /HPF' },
      { investigation: 'RBC',        unit: '/HPF', normalValue: '0 – 2 /HPF' },
    ],
  },
];