/**
 * labReportPdfGenerator.ts
 *
 * Design: Black & white only — no color, clean clinical layout.
 * Multi-page: sections overflow automatically to new pages.
 * All common lab investigation types with full fields included.
 */

import jsPDF from 'jspdf';

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

// ─── Image cache ──────────────────────────────────────────────────────────────

const _imgCache: Record<string, string> = {};

async function loadImgBase64(src: string): Promise<string | null> {
  if (_imgCache[src]) return _imgCache[src];
  try {
    const res  = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload  = () => { _imgCache[src] = fr.result as string; resolve(fr.result as string); };
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

function parseNormalRange(normalValue: string): [number | null, number | null] {
  if (!normalValue) return [null, null];
  const rangeMatch = normalValue.match(/([\d.]+)\s*(?:–|-|to)\s*([\d.]+)/i);
  if (rangeMatch) return [parseFloat(rangeMatch[1]), parseFloat(rangeMatch[2])];
  const ltMatch = normalValue.match(/<\s*([\d.]+)/);
  if (ltMatch) return [null, parseFloat(ltMatch[1])];
  const gtMatch = normalValue.match(/>\s*([\d.]+)/);
  if (gtMatch) return [parseFloat(gtMatch[1]), null];
  return [null, null];
}

function flagValue(value: string, normalValue: string): 'L' | 'H' | '' {
  const num = parseFloat(value.replace(/[^0-9.]/g, ''));
  if (isNaN(num)) return '';
  const [lo, hi] = parseNormalRange(normalValue);
  if (lo !== null && num < lo) return 'L';
  if (hi !== null && num > hi) return 'H';
  return '';
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const MARGIN      = 14;
const PAGE_H      = 297; // A4 mm
const FOOTER_H    = 30;  // reserved at bottom for footer
const BODY_LIMIT  = PAGE_H - FOOTER_H;

// ─── Header ───────────────────────────────────────────────────────────────────

async function drawHeader(
  doc:    jsPDF,
  w:      number,
  logoB64: string | null,
  docB64:  string | null
): Promise<number> {
  let y = MARGIN;

  // Logo left
  if (logoB64) {
    try { doc.addImage(logoB64, 'PNG', MARGIN, y, 22, 22); } catch (_) {}
  } else {
    doc.setDrawColor(0); doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, 22, 22);
    doc.setFont('times', 'bold'); doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('L', MARGIN + 7, y + 15);
  }

  // Doctor image right
  if (docB64) {
    try { doc.addImage(docB64, 'PNG', w - MARGIN - 22, y + 2, 20, 20); } catch (_) {}
  }

  // Phone top-right
  doc.setFont('times', 'bold'); doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('Cell : 9849012345, 9618012345', w - MARGIN, y + 4, { align: 'right' });

  // Lab name
  y += 12;
  doc.setFont('times', 'bold'); doc.setFontSize(17);
  doc.setTextColor(0);
  doc.text('Health Care Laboratory', w / 2, y, { align: 'center' });

  y += 6;
  doc.setFont('times', 'normal'); doc.setFontSize(9);
  doc.text('Beside Aadhya hospital, backside Nandi temple, Nandipet', w / 2, y, { align: 'center' });

  y += 5;
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);

  return y + 4;
}

// ─── Patient block ────────────────────────────────────────────────────────────

function drawPatientBlock(
  doc:     jsPDF,
  w:       number,
  patient: LabReportPatient,
  y:       number
): number {
  doc.setFontSize(8.5);
  doc.setTextColor(0);

  const lColon = MARGIN + 24;
  const lVal   = lColon + 2.5;
  const rCol   = w / 2 + 6;
  const rColon = rCol + 24;
  const rVal   = rColon + 2.5;
  const rowH   = 4.8;

  const doctorDisplay = patient.doctorName
    ? patient.doctorName.toLowerCase().startsWith('dr')
      ? patient.doctorName
      : `Dr. ${patient.doctorName}`
    : 'Dr. Thirupathi Kandli';

  const printDate = formatDate(patient.reportDate);
  const printTime = formatAppTime(patient.reportDate);

  const writeLine = (
    lKey: string, lValue: string,
    rKey: string, rValue: string
  ) => {
    doc.setFont('times', 'bold');
    doc.text(lKey, MARGIN, y);
    doc.text(':', lColon, y);
    doc.setFont('times', 'normal');
    doc.text(lValue, lVal, y);
    doc.setFont('times', 'bold');
    doc.text(rKey, rCol, y);
    doc.text(':', rColon, y);
    doc.setFont('times', 'normal');
    doc.text(rValue, rVal, y);
    y += rowH;
  };

  writeLine('Patient Name', patient.patientName || 'N/A', 'Patient Id',   patient.opId    || 'N/A');
  writeLine('Age / Gender', `${patient.age || 'N/A'} / ${patient.gender || 'N/A'}`, 'Phone', patient.phone || 'N/A');
  writeLine('Consultant',   doctorDisplay, 'Report Date', `${printDate}${printTime ? '  ' + printTime : ''}`);
  writeLine('Report Id',    patient.reportId || 'N/A', 'Village',    patient.village  || 'N/A');

  y += 1;
  doc.setDrawColor(0); doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 4;

  return y;
}

// ─── Footer ───────────────────────────────────────────────────────────────────

async function drawFooter(
  doc:    jsPDF,
  w:      number,
  signB64: string | null
) {
  const sigY = PAGE_H - FOOTER_H + 4;

  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.line(MARGIN, sigY, w - MARGIN, sigY);

  doc.setFontSize(7);
  doc.setFont('times', 'italic');
  doc.setTextColor(80);
  doc.text('This report is for diagnostic purposes only. Please correlate clinically.', MARGIN, sigY + 5);
  doc.text('F = Flag  |  L = Low  |  H = High', MARGIN, sigY + 10);

  if (signB64) {
    try { doc.addImage(signB64, 'PNG', w - MARGIN - 38, sigY - 10, 26, 10); } catch (_) {}
  }

  doc.setFont('times', 'bold'); doc.setFontSize(8);
  doc.setTextColor(0);
  doc.text('SK Salman (DMLT)',  w - MARGIN, sigY + 6,  { align: 'right' });
  doc.text('Lab Technician',    w - MARGIN, sigY + 11, { align: 'right' });
}

// ─── Table section ────────────────────────────────────────────────────────────

function drawTableSection(
  doc:     jsPDF,
  w:       number,
  section: LabReportSection,
  y:       number,
  renderHeaderFn: () => Promise<number>,
  patient: LabReportPatient,
  signB64: string | null,
  logoB64: string | null,
  docB64:  string | null
): Promise<number> {
  return new Promise(async (resolve) => {
    const rows = section.rows || [];

    // Section title
    const sectionTitleH = 14;
    const headerRowH    = 10;
    const dataRowH      = 10;  // generous row height for clear spacing

    // Check if we have space for title + header + at least 1 row
    if (y + sectionTitleH + headerRowH + dataRowH > BODY_LIMIT) {
      await drawFooter(doc, w, signB64);
      doc.addPage();
      y = await renderHeaderFn();
      y = drawPatientBlock(doc, w, patient, y);
    }

    // Section title — rule above, bold centred text, rule below
    doc.setDrawColor(0); doc.setLineWidth(0.4);
    doc.line(MARGIN, y, w - MARGIN, y);
    y += 2;
    doc.setFont('times', 'bold'); doc.setFontSize(11);
    doc.setTextColor(0);
    doc.text(section.sectionTitle, w / 2, y + 6, { align: 'center' });
    y += 10;
    doc.setLineWidth(0.4);
    doc.line(MARGIN, y, w - MARGIN, y);
    y += 6;

    // Column positions
    const c1    = MARGIN + 2;
    const c2    = w * 0.50;
    const cFlag = w * 0.60;
    const c3    = w * 0.65;
    const c4    = w * 0.80;

    // Table header row
    doc.setFont('times', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(0);
    doc.text('INVESTIGATION', c1,    y);
    doc.text('VALUE',         c2,    y);
    doc.text('F',             cFlag, y);
    doc.text('UNITS',         c3,    y);
    doc.text('NORMAL VALUE',  c4,    y);
    y += 3;
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, w - MARGIN, y);
    y += 7;  // spacious gap after header rule before first data row

    for (const row of rows) {
      // Page break check
      if (y + dataRowH > BODY_LIMIT) {
        await drawFooter(doc, w, signB64);
        doc.addPage();
        y = await renderHeaderFn();
        y = drawPatientBlock(doc, w, patient, y);

        // Reprint column header on continuation page
        doc.setFont('times', 'bold'); doc.setFontSize(8.5);
        doc.text(`${section.sectionTitle} (continued)`, w / 2, y, { align: 'center' });
        y += 6;
        doc.setLineWidth(0.3); doc.line(MARGIN, y, w - MARGIN, y); y += 3;
        doc.text('INVESTIGATION', c1, y); doc.text('VALUE', c2, y);
        doc.text('F', cFlag, y); doc.text('UNITS', c3, y); doc.text('NORMAL VALUE', c4, y);
        y += 3; doc.line(MARGIN, y, w - MARGIN, y); y += 7;
      }

      const flag = flagValue(row.value, row.normalValue);

      doc.setFont('times', 'normal'); doc.setFontSize(9);
      doc.setTextColor(0);
      doc.text(row.investigation || '', c1, y);

      // Value — bold
      doc.setFont('times', 'bold'); doc.setFontSize(9);
      doc.text(row.value || '', c2, y);

      // L / H flag — bold
      if (flag) {
        doc.setFont('times', 'bold'); doc.setFontSize(9);
        doc.text(flag, cFlag, y);
      }

      doc.setFont('times', 'normal'); doc.setFontSize(9);
      doc.text(row.unit        || '', c3, y);
      doc.text(row.normalValue || '', c4, y);

      // Light separator line between rows for readability
      doc.setDrawColor(180);
      doc.setLineWidth(0.1);
      doc.line(MARGIN, y + 3, w - MARGIN, y + 3);
      doc.setDrawColor(0);

      y += dataRowH;
    }

    // Method
    if (section.method) {
      y += 2;
      doc.setFontSize(8);
      doc.setFont('times', 'italic');
      doc.setTextColor(80);
      doc.text(`Method : ${section.method}`, MARGIN + 2, y);
      doc.setTextColor(0);
      y += 6;
    }

    y += 6;
    resolve(y);
  });
}

// ─── Free-text section ────────────────────────────────────────────────────────

async function drawFreeTextSection(
  doc:     jsPDF,
  w:       number,
  section: LabReportSection,
  y:       number,
  renderHeaderFn: () => Promise<number>,
  patient: LabReportPatient,
  signB64: string | null
): Promise<number> {
  const lines    = section.freeTextRows || [];
  const lineH    = 7;
  const titleH   = 12;

  if (y + titleH + lineH > BODY_LIMIT) {
    await drawFooter(doc, w, signB64);
    doc.addPage();
    y = await renderHeaderFn();
    y = drawPatientBlock(doc, w, patient, y);
  }

  doc.setDrawColor(0); doc.setLineWidth(0.3);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 1;
  doc.setFont('times', 'bold'); doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(section.sectionTitle, w / 2, y + 5, { align: 'center' });
  y += 9;
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 5;

  for (const line of lines) {
    if (y + lineH > BODY_LIMIT) {
      await drawFooter(doc, w, signB64);
      doc.addPage();
      y = await renderHeaderFn();
      y = drawPatientBlock(doc, w, patient, y);
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      const mid = w / 2;
      doc.setFont('times', 'bold'); doc.setFontSize(9);
      doc.text(key, mid - 5, y, { align: 'right' });
      doc.setFont('times', 'normal');
      doc.text(`:  ${val}`, mid - 4, y);
    } else {
      doc.setFont('times', 'bold'); doc.setFontSize(9);
      doc.text(line, w / 2, y, { align: 'center' });
    }
    y += lineH;
  }

  if (section.method) {
    y += 1;
    doc.setFontSize(7.5); doc.setFont('times', 'italic'); doc.setTextColor(60);
    doc.text(`Method : ${section.method}`, MARGIN + 2, y);
    doc.setTextColor(0);
    y += 5;
  }

  y += 4;
  return y;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateLabReportPDF(
  patient:  LabReportPatient,
  sections: LabReportSection[],
  reportId?: string
) {
  const [logoB64, docB64, signB64] = await Promise.all([
    loadImgBase64('/lablo.png'),
    loadImgBase64('/doc1.png'),
    loadImgBase64('/nsign.png'),
  ]);

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w   = doc.internal.pageSize.getWidth();

  const renderHeaderFn = async (): Promise<number> =>
    drawHeader(doc, w, logoB64, docB64);

  let y = await renderHeaderFn();
  y = drawPatientBlock(doc, w, patient, y);

  if (reportId) {
    doc.setFont('times', 'normal'); doc.setFontSize(7.5); doc.setTextColor(80);
    doc.text(`Report ID: ${reportId}`, w - MARGIN, y - 1, { align: 'right' });
    doc.setTextColor(0);
  }

  for (const section of sections) {
    if (section.sectionType === 'freetext') {
      y = await drawFreeTextSection(doc, w, section, y, renderHeaderFn, patient, signB64);
    } else {
      y = await drawTableSection(doc, w, section, y, renderHeaderFn, patient, signB64, logoB64, docB64);
    }
  }

  await drawFooter(doc, w, signB64);

  const safe = (patient.patientName || 'Patient').replace(/\s+/g, '_');
  outputPDF(doc, `${reportId || 'LabReport'}_${safe}.pdf`);
}

// ─── Templates ───────────────────────────────────────────────────────────────

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

  // ── Haematology ────────────────────────────────────────────────────────────
  {
    reportType: 'CBC', displayName: 'Complete Blood Picture (CBC / Haemogram)',
    sectionTitle: 'COMPLETE BLOOD PICTURE (HAEMOGRAM)', sectionType: 'table',
    method: 'AUTOMATED CELL COUNTER',
    fields: [
      { investigation: 'Haemoglobin (Hb)',  unit: 'g/dL',       normalValue: '13.0 – 17.0 (M) / 11.5 – 16.5 (F)' },
      { investigation: 'RBC Count',         unit: 'mill/cumm',  normalValue: '4.5 – 5.5 (M) / 3.9 – 5.0 (F)' },
      { investigation: 'WBC Count (TLC)',   unit: 'cells/cumm', normalValue: '4000 – 11000' },
      { investigation: 'Platelet Count',    unit: 'Lakhs/cumm', normalValue: '1.5 – 4.5' },
      { investigation: 'HCT / PCV',         unit: '%',          normalValue: '40 – 50 (M) / 36 – 46 (F)' },
      { investigation: 'MCV',               unit: 'fL',         normalValue: '76 – 96' },
      { investigation: 'MCH',               unit: 'pg',         normalValue: '25 – 32' },
      { investigation: 'MCHC',              unit: 'g/dL',       normalValue: '30 – 36' },
      { investigation: 'RDW-CV',            unit: '%',          normalValue: '11.5 – 14.5' },
      { investigation: 'MPV',               unit: 'fL',         normalValue: '7.5 – 12.5' },
      { investigation: 'ESR',               unit: 'mm/hr',      normalValue: '0 – 20 (M) / 0 – 30 (F)' },
    ],
  },
  {
    reportType: 'DIFF_COUNT', displayName: 'Differential Leucocyte Count (DLC)',
    sectionTitle: 'DIFFERENTIAL LEUCOCYTE COUNT', sectionType: 'table',
    fields: [
      { investigation: 'Neutrophils',   unit: '%', normalValue: '40 – 75' },
      { investigation: 'Lymphocytes',   unit: '%', normalValue: '20 – 45' },
      { investigation: 'Monocytes',     unit: '%', normalValue: '02 – 10' },
      { investigation: "Eosinophils",   unit: '%', normalValue: '01 – 06' },
      { investigation: 'Basophils',     unit: '%', normalValue: '00 – 02' },
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
      { investigation: 'Bleeding Time', unit: 'Min Sec', normalValue: '1 – 5 Minutes' },
      { investigation: 'Clotting Time', unit: 'Min Sec', normalValue: '3 – 7 Minutes' },
    ],
  },
  {
    reportType: 'PT_INR', displayName: 'Prothrombin Time & INR',
    sectionTitle: 'PROTHROMBIN TIME (PT) & INR', sectionType: 'table',
    fields: [
      { investigation: 'Prothrombin Time (Patient)', unit: 'seconds', normalValue: '11 – 14 seconds' },
      { investigation: 'Prothrombin Time (Control)', unit: 'seconds', normalValue: '11 – 14 seconds' },
      { investigation: 'INR',                        unit: '',        normalValue: '0.9 – 1.1' },
      { investigation: 'PT Activity',                unit: '%',       normalValue: '70 – 100 %' },
    ],
  },
  {
    reportType: 'APTT', displayName: 'aPTT (Activated Partial Thromboplastin Time)',
    sectionTitle: 'ACTIVATED PARTIAL THROMBOPLASTIN TIME (aPTT)', sectionType: 'table',
    fields: [
      { investigation: 'aPTT (Patient)', unit: 'seconds', normalValue: '25 – 35 seconds' },
      { investigation: 'aPTT (Control)', unit: 'seconds', normalValue: '25 – 35 seconds' },
    ],
  },
  {
    reportType: 'PERIPHERAL_SMEAR', displayName: 'Peripheral Blood Smear',
    sectionTitle: 'PERIPHERAL BLOOD SMEAR EXAMINATION', sectionType: 'freetext',
    freeTextKeys: [
      'RBC Morphology',
      'WBC Morphology',
      'Platelet Morphology',
      'Parasites',
      'Impression',
    ],
  },

  // ── Biochemistry ───────────────────────────────────────────────────────────
  {
    reportType: 'RFT', displayName: 'Renal Function Test (RFT)',
    sectionTitle: 'RENAL FUNCTION TEST', sectionType: 'table',
    fields: [
      { investigation: 'Serum Creatinine',     unit: 'mg/dL', normalValue: '0.7 – 1.5' },
      { investigation: 'Blood Urea Nitrogen',  unit: 'mg/dL', normalValue: '7.0 – 25.0' },
      { investigation: 'Blood Urea',           unit: 'mg/dL', normalValue: '14 – 45' },
      { investigation: 'Serum Uric Acid',      unit: 'mg/dL', normalValue: '3.5 – 7.2 (M) / 2.5 – 6.2 (F)' },
      { investigation: 'eGFR',                 unit: 'mL/min/1.73m²', normalValue: '> 90' },
    ],
  },
  {
    reportType: 'LFT', displayName: 'Liver Function Test (LFT)',
    sectionTitle: 'LIVER FUNCTION TEST', sectionType: 'table',
    fields: [
      { investigation: 'Total Bilirubin',       unit: 'mg/dL', normalValue: '0.2 – 1.2' },
      { investigation: 'Direct (Conjugated)',   unit: 'mg/dL', normalValue: '0.0 – 0.3' },
      { investigation: 'Indirect (Unconjugated)', unit: 'mg/dL', normalValue: '0.1 – 0.8' },
      { investigation: 'SGOT (AST)',            unit: 'U/L',   normalValue: '10 – 40' },
      { investigation: 'SGPT (ALT)',            unit: 'U/L',   normalValue: '7 – 56' },
      { investigation: 'Alkaline Phosphatase',  unit: 'U/L',   normalValue: '44 – 147' },
      { investigation: 'GGT',                   unit: 'U/L',   normalValue: '11 – 50' },
      { investigation: 'Total Protein',         unit: 'g/dL',  normalValue: '6.0 – 8.3' },
      { investigation: 'Serum Albumin',         unit: 'g/dL',  normalValue: '3.5 – 5.0' },
      { investigation: 'Serum Globulin',        unit: 'g/dL',  normalValue: '2.3 – 3.5' },
      { investigation: 'A/G Ratio',             unit: '',      normalValue: '1.1 – 2.5' },
    ],
  },
  {
    reportType: 'TOTAL_BILIRUBIN', displayName: 'Serum Bilirubin',
    sectionTitle: 'REPORT ON SERUM BILIRUBIN', sectionType: 'table',
    fields: [
      { investigation: 'Total Bilirubin',    unit: 'mg/dL', normalValue: '0.2 – 1.2' },
      { investigation: 'Direct Bilirubin',   unit: 'mg/dL', normalValue: '0.0 – 0.3' },
      { investigation: 'Indirect Bilirubin', unit: 'mg/dL', normalValue: '0.1 – 0.8' },
    ],
  },
  {
    reportType: 'SERUM_CREATININE', displayName: 'Serum Creatinine',
    sectionTitle: 'SERUM CREATININE', sectionType: 'table',
    fields: [
      { investigation: 'Serum Creatinine', unit: 'mg/dL', normalValue: '0.7 – 1.5' },
    ],
  },
  {
    reportType: 'SERUM_URIC_ACID', displayName: 'Serum Uric Acid',
    sectionTitle: 'SERUM URIC ACID', sectionType: 'table',
    fields: [
      { investigation: 'Serum Uric Acid', unit: 'mg/dL', normalValue: '3.5 – 7.2 (M) / 2.5 – 6.2 (F)' },
    ],
  },
  {
    reportType: 'BLOOD_GLUCOSE_FASTING', displayName: 'Fasting Blood Sugar (FBS)',
    sectionTitle: 'FASTING BLOOD SUGAR', sectionType: 'table',
    fields: [
      { investigation: 'Fasting Blood Glucose', unit: 'mg/dL', normalValue: '70 – 100' },
    ],
  },
  {
    reportType: 'RBS', displayName: 'Random Blood Sugar (RBS)',
    sectionTitle: 'RANDOM BLOOD SUGAR', sectionType: 'table',
    fields: [
      { investigation: 'Random Blood Glucose', unit: 'mg/dL', normalValue: '70 – 140' },
    ],
  },
  {
    reportType: 'PPBS', displayName: 'Post-Prandial Blood Sugar (PPBS)',
    sectionTitle: 'POST-PRANDIAL BLOOD SUGAR (2hr after meal)', sectionType: 'table',
    fields: [
      { investigation: 'Post-Prandial Glucose', unit: 'mg/dL', normalValue: '< 140' },
    ],
  },
  {
    reportType: 'OGTT', displayName: 'Oral Glucose Tolerance Test (OGTT)',
    sectionTitle: 'ORAL GLUCOSE TOLERANCE TEST (OGTT)', sectionType: 'table',
    fields: [
      { investigation: 'Fasting Glucose',  unit: 'mg/dL', normalValue: '70 – 100' },
      { investigation: '1/2 Hour Glucose', unit: 'mg/dL', normalValue: '< 200' },
      { investigation: '1 Hour Glucose',   unit: 'mg/dL', normalValue: '< 180' },
      { investigation: '2 Hours Glucose',  unit: 'mg/dL', normalValue: '< 140' },
      { investigation: '3 Hours Glucose',  unit: 'mg/dL', normalValue: '70 – 100' },
    ],
  },
  {
    reportType: 'HBA1C', displayName: 'HbA1c (Glycated Haemoglobin)',
    sectionTitle: 'HbA1c — GLYCATED HAEMOGLOBIN', sectionType: 'table',
    fields: [
      { investigation: 'HbA1c',         unit: '%',        normalValue: '< 5.7 (Normal)' },
      { investigation: 'Mean Blood Glucose (eAG)', unit: 'mg/dL', normalValue: '< 117 (Normal)' },
    ],
  },
  {
    reportType: 'LIPID_PROFILE', displayName: 'Lipid Profile',
    sectionTitle: 'LIPID PROFILE', sectionType: 'table',
    fields: [
      { investigation: 'Total Cholesterol',   unit: 'mg/dL', normalValue: '< 200 (Desirable)' },
      { investigation: 'Triglycerides',       unit: 'mg/dL', normalValue: '< 150' },
      { investigation: 'HDL Cholesterol',     unit: 'mg/dL', normalValue: '> 40 (M) / > 50 (F)' },
      { investigation: 'LDL Cholesterol',     unit: 'mg/dL', normalValue: '< 100 (Optimal)' },
      { investigation: 'VLDL Cholesterol',    unit: 'mg/dL', normalValue: '< 30' },
      { investigation: 'Non-HDL Cholesterol', unit: 'mg/dL', normalValue: '< 130' },
      { investigation: 'Total Chol / HDL Ratio', unit: '', normalValue: '< 5' },
      { investigation: 'LDL / HDL Ratio',    unit: '',      normalValue: '< 3.5' },
    ],
  },
  {
    reportType: 'CALCIUM', displayName: 'Serum Calcium',
    sectionTitle: 'SERUM CALCIUM', sectionType: 'table',
    fields: [
      { investigation: 'Serum Calcium',      unit: 'mg/dL', normalValue: '8.5 – 10.5' },
      { investigation: 'Ionised Calcium',    unit: 'mmol/L', normalValue: '1.15 – 1.35' },
    ],
  },
  {
    reportType: 'ELECTROLYTES', displayName: 'Serum Electrolytes',
    sectionTitle: 'SERUM ELECTROLYTES', sectionType: 'table',
    fields: [
      { investigation: 'Serum Sodium (Na⁺)',     unit: 'mEq/L', normalValue: '136 – 145' },
      { investigation: 'Serum Potassium (K⁺)',   unit: 'mEq/L', normalValue: '3.5 – 5.0' },
      { investigation: 'Serum Chloride (Cl⁻)',   unit: 'mEq/L', normalValue: '98 – 107' },
      { investigation: 'Serum Bicarbonate (HCO₃)',unit: 'mEq/L', normalValue: '22 – 29' },
    ],
  },
  {
    reportType: 'IRON_STUDIES', displayName: 'Iron Studies (Serum Iron & TIBC)',
    sectionTitle: 'IRON STUDIES', sectionType: 'table',
    fields: [
      { investigation: 'Serum Iron',          unit: 'µg/dL', normalValue: '60 – 170' },
      { investigation: 'TIBC',                unit: 'µg/dL', normalValue: '240 – 450' },
      { investigation: 'Transferrin Saturation', unit: '%',  normalValue: '20 – 50' },
      { investigation: 'Serum Ferritin',      unit: 'ng/mL', normalValue: '12 – 300 (M) / 12 – 150 (F)' },
    ],
  },
  {
    reportType: 'VITAMIN_D', displayName: 'Vitamin D (25-OH)',
    sectionTitle: '25-HYDROXY VITAMIN D', sectionType: 'table',
    method: 'CMIA / ELISA',
    fields: [
      { investigation: '25-OH Vitamin D', unit: 'ng/mL', normalValue: '> 30 (Sufficient) / 20–30 (Insufficient) / < 20 (Deficient)' },
    ],
  },
  {
    reportType: 'VITAMIN_B12', displayName: 'Vitamin B12 (Cobalamin)',
    sectionTitle: 'SERUM VITAMIN B12', sectionType: 'table',
    method: 'CMIA / ELISA',
    fields: [
      { investigation: 'Vitamin B12', unit: 'pg/mL', normalValue: '200 – 900' },
    ],
  },
  {
    reportType: 'CRP', displayName: 'C-Reactive Protein (CRP)',
    sectionTitle: 'C-REACTIVE PROTEIN (CRP)', sectionType: 'table',
    method: 'Immunoturbidimetry',
    fields: [
      { investigation: 'CRP', unit: 'mg/L', normalValue: '< 6.0 (Negative)' },
    ],
  },
  {
    reportType: 'HS_CRP', displayName: 'High Sensitivity CRP (hs-CRP)',
    sectionTitle: 'HIGH SENSITIVITY CRP (hs-CRP)', sectionType: 'table',
    method: 'Immunoturbidimetry',
    fields: [
      { investigation: 'hs-CRP', unit: 'mg/L', normalValue: '< 1.0 (Low risk) / 1.0–3.0 (Avg) / > 3.0 (High risk)' },
    ],
  },
  {
    reportType: 'UREA', displayName: 'Blood Urea / BUN',
    sectionTitle: 'BLOOD UREA & BUN', sectionType: 'table',
    fields: [
      { investigation: 'Blood Urea',            unit: 'mg/dL', normalValue: '14 – 45' },
      { investigation: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL', normalValue: '7 – 25' },
    ],
  },
  {
    reportType: 'AMYLASE_LIPASE', displayName: 'Serum Amylase & Lipase',
    sectionTitle: 'SERUM AMYLASE & LIPASE', sectionType: 'table',
    fields: [
      { investigation: 'Serum Amylase', unit: 'U/L', normalValue: '30 – 110' },
      { investigation: 'Serum Lipase',  unit: 'U/L', normalValue: '13 – 60' },
    ],
  },
  {
    reportType: 'CARDIAC_ENZYMES', displayName: 'Cardiac Enzymes / Markers',
    sectionTitle: 'CARDIAC ENZYMES', sectionType: 'table',
    method: 'Immunoassay',
    fields: [
      { investigation: 'Troponin I',      unit: 'ng/mL', normalValue: '< 0.04 (Negative)' },
      { investigation: 'Troponin T',      unit: 'ng/mL', normalValue: '< 0.01 (Negative)' },
      { investigation: 'CK-MB',           unit: 'U/L',   normalValue: '< 25' },
      { investigation: 'CPK (Total)',     unit: 'U/L',   normalValue: '38 – 308 (M) / 26 – 192 (F)' },
      { investigation: 'LDH',            unit: 'U/L',   normalValue: '140 – 280' },
    ],
  },
  {
    reportType: 'PROTEIN_TOTAL', displayName: 'Total Protein & Albumin',
    sectionTitle: 'SERUM PROTEIN & ALBUMIN', sectionType: 'table',
    fields: [
      { investigation: 'Total Protein', unit: 'g/dL', normalValue: '6.0 – 8.3' },
      { investigation: 'Albumin',       unit: 'g/dL', normalValue: '3.5 – 5.0' },
      { investigation: 'Globulin',      unit: 'g/dL', normalValue: '2.3 – 3.5' },
      { investigation: 'A/G Ratio',    unit: '',      normalValue: '1.1 – 2.5' },
    ],
  },

  // ── Thyroid ────────────────────────────────────────────────────────────────
  {
    reportType: 'TSH', displayName: 'Thyroid Function Test (TSH / T3 / T4)',
    sectionTitle: 'THYROID FUNCTION TEST', sectionType: 'table',
    method: 'Chemiluminescence Immunoassay (CLIA)',
    fields: [
      { investigation: 'TSH (Thyroid Stimulating Hormone)', unit: 'mIU/L', normalValue: '0.4 – 4.0' },
      { investigation: 'T3 (Triiodothyronine)',              unit: 'ng/dL', normalValue: '80 – 220' },
      { investigation: 'T4 (Thyroxine)',                    unit: 'µg/dL', normalValue: '5.1 – 14.1' },
      { investigation: 'Free T3 (fT3)',                     unit: 'pg/mL', normalValue: '2.3 – 4.2' },
      { investigation: 'Free T4 (fT4)',                     unit: 'ng/dL', normalValue: '0.89 – 1.76' },
    ],
  },
  {
    reportType: 'TSH_ONLY', displayName: 'TSH Only',
    sectionTitle: 'THYROID STIMULATING HORMONE (TSH)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'TSH', unit: 'mIU/L', normalValue: '0.4 – 4.0' },
    ],
  },

  // ── Serology ───────────────────────────────────────────────────────────────
  {
    reportType: 'RA_FACTOR', displayName: 'RA Factor (Rheumatoid Factor)',
    sectionTitle: 'RHEUMATOID FACTOR (RA FACTOR)', sectionType: 'table',
    method: 'Immunoturbidimetry',
    fields: [
      { investigation: 'RA Factor', unit: 'IU/mL', normalValue: '< 20 (Negative)' },
    ],
  },
  {
    reportType: 'ASO_TITER', displayName: 'ASO Titer',
    sectionTitle: 'ANTI-STREPTOLYSIN O (ASO) TITER', sectionType: 'freetext',
    freeTextKeys: ['Test for ASO', 'Result'],
  },
  {
    reportType: 'WIDAL', displayName: 'Widal Test (Typhoid)',
    sectionTitle: 'REPORT ON WIDAL TEST', sectionType: 'freetext',
    freeTextKeys: [
      'Salmonella Typhi "O"',
      'Salmonella Typhi "H"',
      'Salmonella Paratyphi "A" (H)',
      'Salmonella Paratyphi "B" (H)',
    ],
  },
  {
    reportType: 'MALARIA', displayName: 'Malaria Parasite (ICT / MP)',
    sectionTitle: 'REPORT ON MALARIA PARASITE', sectionType: 'freetext',
    freeTextKeys: ['Plasmodium Falciparum', 'Plasmodium Vivax', 'Malaria Antigen (Rapid)'],
  },
  {
    reportType: 'DENGUE', displayName: 'Dengue NS1 Antigen & Antibody',
    sectionTitle: 'DENGUE TEST (NS1 Ag / IgM / IgG)', sectionType: 'freetext',
    freeTextKeys: ['NS1 Antigen', 'IgM Antibody', 'IgG Antibody'],
  },
  {
    reportType: 'TYPHIDOT', displayName: 'Typhidot (Typhoid IgM / IgG)',
    sectionTitle: 'TYPHIDOT TEST', sectionType: 'freetext',
    freeTextKeys: ['IgM (Acute Infection)', 'IgG (Past Infection)'],
  },
  {
    reportType: 'HBsAg', displayName: 'Hepatitis B Surface Antigen (HBsAg)',
    sectionTitle: 'HEPATITIS B SURFACE ANTIGEN (HBsAg)', sectionType: 'freetext',
    freeTextKeys: ['HBsAg (Rapid)'],
  },
  {
    reportType: 'ANTI_HCV', displayName: 'Anti HCV (Hepatitis C Antibody)',
    sectionTitle: 'ANTI-HCV TEST', sectionType: 'freetext',
    freeTextKeys: ['Anti-HCV (Rapid)'],
  },
  {
    reportType: 'HIV', displayName: 'HIV 1 & 2 Antibody',
    sectionTitle: 'HIV 1 & 2 ANTIBODY (TRIDOT)', sectionType: 'freetext',
    freeTextKeys: ['HIV 1', 'HIV 2'],
  },
  {
    reportType: 'VDRL', displayName: 'VDRL (Syphilis)',
    sectionTitle: 'VDRL TEST (SYPHILIS)', sectionType: 'freetext',
    freeTextKeys: ['VDRL Result', 'VDRL Titre (if Reactive)'],
  },
  {
    reportType: 'TORCH', displayName: 'TORCH Panel',
    sectionTitle: 'TORCH PANEL', sectionType: 'table',
    method: 'ELISA',
    fields: [
      { investigation: 'Toxoplasma IgM',   unit: '', normalValue: '< 1.0 (Negative)' },
      { investigation: 'Toxoplasma IgG',   unit: '', normalValue: '< 1.0 (Negative)' },
      { investigation: 'Rubella IgM',      unit: 'IU/mL', normalValue: '< 1.0 (Negative)' },
      { investigation: 'Rubella IgG',      unit: 'IU/mL', normalValue: '< 10 (Negative)' },
      { investigation: 'CMV IgM',          unit: '', normalValue: '< 1.0 (Negative)' },
      { investigation: 'CMV IgG',          unit: '', normalValue: '< 1.0 (Negative)' },
      { investigation: 'HSV IgM',          unit: '', normalValue: '< 1.0 (Negative)' },
      { investigation: 'HSV IgG',          unit: '', normalValue: '< 1.0 (Negative)' },
    ],
  },
  {
    reportType: 'PREGNANCY_TEST', displayName: 'Urine Pregnancy Test (UPT)',
    sectionTitle: 'URINE PREGNANCY TEST (Beta-hCG)', sectionType: 'freetext',
    freeTextKeys: ['Beta-hCG (Urine)', 'Result'],
  },
  {
    reportType: 'BETA_HCG_SERUM', displayName: 'Serum Beta hCG (Quantitative)',
    sectionTitle: 'SERUM BETA-hCG (QUANTITATIVE)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'Beta-hCG', unit: 'mIU/mL', normalValue: 'Non-pregnant: < 5  |  Refer chart for gestational age' },
    ],
  },
  {
    reportType: 'ANA', displayName: 'ANA (Antinuclear Antibody)',
    sectionTitle: 'ANTINUCLEAR ANTIBODY (ANA) PROFILE', sectionType: 'freetext',
    method: 'Indirect Immunofluorescence',
    freeTextKeys: ['ANA Result', 'Titre', 'Pattern'],
  },

  // ── Urine ──────────────────────────────────────────────────────────────────
  {
    reportType: 'URINE_ROUTINE', displayName: 'Urine Routine Examination',
    sectionTitle: 'URINE ROUTINE EXAMINATION', sectionType: 'table',
    fields: [
      { investigation: 'Colour',           unit: '',      normalValue: 'Pale Yellow' },
      { investigation: 'Appearance / Turbidity', unit: '', normalValue: 'Clear' },
      { investigation: 'Reaction (pH)',     unit: '',      normalValue: '4.5 – 8.0' },
      { investigation: 'Specific Gravity', unit: '',      normalValue: '1.010 – 1.030' },
      { investigation: 'Protein',          unit: '',      normalValue: 'Nil' },
      { investigation: 'Glucose',          unit: '',      normalValue: 'Nil' },
      { investigation: 'Ketones',          unit: '',      normalValue: 'Nil' },
      { investigation: 'Bile Salts',       unit: '',      normalValue: 'Nil' },
      { investigation: 'Bile Pigments',    unit: '',      normalValue: 'Nil' },
      { investigation: 'Urobilinogen',     unit: '',      normalValue: 'Normal' },
      { investigation: 'Nitrites',         unit: '',      normalValue: 'Negative' },
      { investigation: 'Leucocyte Esterase', unit: '',   normalValue: 'Negative' },
    ],
  },
  {
    reportType: 'URINE_MICROSCOPY', displayName: 'Urine Microscopy',
    sectionTitle: 'URINE MICROSCOPY', sectionType: 'table',
    fields: [
      { investigation: 'Pus Cells (WBC)',   unit: '/HPF', normalValue: '0 – 5' },
      { investigation: 'RBC',               unit: '/HPF', normalValue: '0 – 2' },
      { investigation: 'Epithelial Cells',  unit: '/HPF', normalValue: 'Few' },
      { investigation: 'Casts',             unit: '/LPF', normalValue: 'Nil' },
      { investigation: 'Crystals',          unit: '',     normalValue: 'Nil' },
      { investigation: 'Bacteria',          unit: '',     normalValue: 'Nil' },
      { investigation: 'Yeast Cells',       unit: '',     normalValue: 'Nil' },
    ],
  },
  {
    reportType: 'URINE_CULTURE', displayName: 'Urine Culture & Sensitivity',
    sectionTitle: 'URINE CULTURE & SENSITIVITY', sectionType: 'freetext',
    freeTextKeys: [
      'Culture Result',
      'Organism Isolated',
      'Colony Count',
      'Sensitivity (Antibiotics effective)',
      'Resistance (Antibiotics resistant)',
    ],
  },
  {
    reportType: 'URINE_24HR_PROTEIN', displayName: '24-Hour Urine Protein',
    sectionTitle: '24-HOUR URINE PROTEIN', sectionType: 'table',
    fields: [
      { investigation: 'Total Volume (24hr)', unit: 'mL',    normalValue: '600 – 2000' },
      { investigation: 'Urine Protein',       unit: 'mg/24h', normalValue: '< 150' },
      { investigation: 'Urine Creatinine',    unit: 'mg/24h', normalValue: '800 – 2000' },
    ],
  },
  {
    reportType: 'URINE_MICROALBUMIN', displayName: 'Urine Microalbumin / ACR',
    sectionTitle: 'URINE MICROALBUMIN & ALBUMIN-CREATININE RATIO', sectionType: 'table',
    fields: [
      { investigation: 'Urine Microalbumin', unit: 'mg/L',   normalValue: '< 30' },
      { investigation: 'Urine Creatinine',   unit: 'mg/dL',  normalValue: '—' },
      { investigation: 'ACR (Ratio)',        unit: 'mg/g',   normalValue: '< 30 (Normal)' },
    ],
  },

  // ── Stool ──────────────────────────────────────────────────────────────────
  {
    reportType: 'STOOL_ROUTINE', displayName: 'Stool Routine Examination',
    sectionTitle: 'STOOL ROUTINE EXAMINATION', sectionType: 'table',
    fields: [
      { investigation: 'Colour',          unit: '', normalValue: 'Brown' },
      { investigation: 'Consistency',     unit: '', normalValue: 'Formed / Soft' },
      { investigation: 'Reaction (pH)',   unit: '', normalValue: 'Neutral / Alkaline' },
      { investigation: 'Blood',           unit: '', normalValue: 'Nil' },
      { investigation: 'Mucus',           unit: '', normalValue: 'Nil' },
      { investigation: 'Pus Cells',       unit: '/HPF', normalValue: '0 – 2' },
      { investigation: 'RBC',             unit: '/HPF', normalValue: 'Nil' },
      { investigation: 'Ova / Cysts',     unit: '', normalValue: 'Not seen' },
      { investigation: 'Parasites',       unit: '', normalValue: 'Not seen' },
      { investigation: 'Fat Globules',    unit: '', normalValue: 'Not seen' },
      { investigation: 'Undigested Food', unit: '', normalValue: 'Not seen' },
    ],
  },
  {
    reportType: 'OCCULT_BLOOD', displayName: 'Stool Occult Blood',
    sectionTitle: 'FAECAL OCCULT BLOOD TEST (FOBT)', sectionType: 'freetext',
    freeTextKeys: ['Faecal Occult Blood'],
  },

  // ── Hormones ───────────────────────────────────────────────────────────────
  {
    reportType: 'FSH_LH', displayName: 'FSH & LH (Gonadotropins)',
    sectionTitle: 'FSH & LH (GONADOTROPINS)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'FSH', unit: 'mIU/mL', normalValue: 'Follicular: 3.5–12.5 / Midcycle: 4.7–21.5 / Luteal: 1.7–7.7 / Post-menopausal: 25.8–134.8' },
      { investigation: 'LH',  unit: 'mIU/mL', normalValue: 'Follicular: 2.4–12.6 / Midcycle: 14.0–95.6 / Luteal: 1.0–11.4' },
    ],
  },
  {
    reportType: 'PROLACTIN', displayName: 'Serum Prolactin',
    sectionTitle: 'SERUM PROLACTIN', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'Prolactin', unit: 'ng/mL', normalValue: '2.0 – 18.0 (M) / 2.0 – 29.0 (F, non-pregnant)' },
    ],
  },
  {
    reportType: 'TESTOSTERONE', displayName: 'Serum Testosterone (Total)',
    sectionTitle: 'SERUM TESTOSTERONE', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'Total Testosterone', unit: 'ng/dL', normalValue: '270 – 1070 (M) / 15 – 70 (F)' },
    ],
  },
  {
    reportType: 'CORTISOL', displayName: 'Serum Cortisol',
    sectionTitle: 'SERUM CORTISOL', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'Cortisol (AM / Morning)', unit: 'µg/dL', normalValue: '6 – 23' },
      { investigation: 'Cortisol (PM / Evening)', unit: 'µg/dL', normalValue: '2 – 11' },
    ],
  },
  {
    reportType: 'INSULIN_FASTING', displayName: 'Fasting Insulin & HOMA-IR',
    sectionTitle: 'FASTING INSULIN & INSULIN RESISTANCE (HOMA-IR)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'Fasting Insulin', unit: 'µIU/mL', normalValue: '3 – 25' },
      { investigation: 'HOMA-IR',         unit: '',        normalValue: '< 2.5 (Normal)' },
    ],
  },
  {
    reportType: 'PTH', displayName: 'Parathyroid Hormone (PTH)',
    sectionTitle: 'PARATHYROID HORMONE (iPTH)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'iPTH (Intact PTH)', unit: 'pg/mL', normalValue: '15 – 65' },
    ],
  },

  // ── Microbiology / Culture ─────────────────────────────────────────────────
  {
    reportType: 'BLOOD_CULTURE', displayName: 'Blood Culture & Sensitivity',
    sectionTitle: 'BLOOD CULTURE & SENSITIVITY', sectionType: 'freetext',
    freeTextKeys: [
      'Culture Result',
      'Organism Isolated',
      'Sensitivity (Antibiotics effective)',
      'Resistance (Antibiotics resistant)',
      'Incubation Period',
    ],
  },
  {
    reportType: 'SPUTUM_AFB', displayName: 'Sputum for AFB (TB)',
    sectionTitle: 'SPUTUM FOR AFB (ZIEHL-NEELSEN STAIN)', sectionType: 'freetext',
    freeTextKeys: ['Smear 1 (Morning)', 'Smear 2 (Spot)', 'Smear 3 (Morning)', 'AFB Grading'],
  },
  {
    reportType: 'THROAT_SWAB', displayName: 'Throat Swab Culture & Sensitivity',
    sectionTitle: 'THROAT SWAB CULTURE & SENSITIVITY', sectionType: 'freetext',
    freeTextKeys: ['Culture Result', 'Organism Isolated', 'Sensitivity', 'Resistance'],
  },

  // ── Tumour Markers ─────────────────────────────────────────────────────────
  {
    reportType: 'PSA', displayName: 'PSA (Prostate Specific Antigen)',
    sectionTitle: 'PROSTATE SPECIFIC ANTIGEN (PSA)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'Total PSA',  unit: 'ng/mL', normalValue: '< 4.0 (Age < 60)  /  < 6.5 (Age > 60)' },
      { investigation: 'Free PSA',   unit: 'ng/mL', normalValue: '—' },
      { investigation: 'Free / Total PSA Ratio', unit: '%', normalValue: '> 25% (Benign likely)' },
    ],
  },
  {
    reportType: 'CEA', displayName: 'CEA (Carcinoembryonic Antigen)',
    sectionTitle: 'CARCINOEMBRYONIC ANTIGEN (CEA)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'CEA', unit: 'ng/mL', normalValue: '< 3.0 (Non-smoker) / < 5.0 (Smoker)' },
    ],
  },
  {
    reportType: 'CA_125', displayName: 'CA-125 (Ovarian Tumour Marker)',
    sectionTitle: 'CA-125 (TUMOUR MARKER)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'CA-125', unit: 'U/mL', normalValue: '< 35' },
    ],
  },
  {
    reportType: 'AFP', displayName: 'AFP (Alpha Fetoprotein)',
    sectionTitle: 'ALPHA-FETOPROTEIN (AFP)', sectionType: 'table',
    method: 'CLIA',
    fields: [
      { investigation: 'AFP', unit: 'ng/mL', normalValue: '< 10 (Non-pregnant adults)' },
    ],
  },

  // ── Compound panels ────────────────────────────────────────────────────────
  {
    reportType: 'SURGICAL_PROFILE', displayName: 'Surgical / Pre-op Profile',
    sectionTitle: 'SURGICAL PROFILE (PRE-OPERATIVE)',
    sectionType: 'table',
    fields: [], // dynamically assembled from CBC + DIFF + BT/CT + BLOOD_GROUP
  },
  {
    reportType: 'ANTENATAL_PROFILE', displayName: 'Antenatal Profile',
    sectionTitle: 'ANTENATAL PROFILE',
    sectionType: 'table',
    fields: [], // assembled from CBC + Blood Group + HBsAg + VDRL + HIV + Blood Glucose
  },
  {
    reportType: 'DIABETES_PANEL', displayName: 'Diabetes Panel',
    sectionTitle: 'DIABETES PANEL', sectionType: 'table',
    fields: [
      { investigation: 'Fasting Blood Glucose',      unit: 'mg/dL', normalValue: '70 – 100' },
      { investigation: 'Post-Prandial Glucose (2hr)', unit: 'mg/dL', normalValue: '< 140' },
      { investigation: 'HbA1c',                      unit: '%',     normalValue: '< 5.7 (Normal)' },
      { investigation: 'Fasting Insulin',            unit: 'µIU/mL', normalValue: '3 – 25' },
      { investigation: 'HOMA-IR',                    unit: '',       normalValue: '< 2.5' },
    ],
  },
  {
    reportType: 'COMPREHENSIVE_METABOLIC', displayName: 'Comprehensive Metabolic Panel',
    sectionTitle: 'COMPREHENSIVE METABOLIC PANEL (CMP)', sectionType: 'table',
    fields: [
      { investigation: 'Blood Glucose (Fasting)',   unit: 'mg/dL',  normalValue: '70 – 100' },
      { investigation: 'Serum Creatinine',          unit: 'mg/dL',  normalValue: '0.7 – 1.5' },
      { investigation: 'Blood Urea Nitrogen (BUN)', unit: 'mg/dL',  normalValue: '7 – 25' },
      { investigation: 'Serum Sodium',              unit: 'mEq/L',  normalValue: '136 – 145' },
      { investigation: 'Serum Potassium',           unit: 'mEq/L',  normalValue: '3.5 – 5.0' },
      { investigation: 'Serum Chloride',            unit: 'mEq/L',  normalValue: '98 – 107' },
      { investigation: 'Total Protein',             unit: 'g/dL',   normalValue: '6.0 – 8.3' },
      { investigation: 'Serum Albumin',             unit: 'g/dL',   normalValue: '3.5 – 5.0' },
      { investigation: 'Total Bilirubin',           unit: 'mg/dL',  normalValue: '0.2 – 1.2' },
      { investigation: 'SGOT (AST)',                unit: 'U/L',    normalValue: '10 – 40' },
      { investigation: 'SGPT (ALT)',                unit: 'U/L',    normalValue: '7 – 56' },
      { investigation: 'Alkaline Phosphatase',      unit: 'U/L',    normalValue: '44 – 147' },
      { investigation: 'Serum Calcium',             unit: 'mg/dL',  normalValue: '8.5 – 10.5' },
    ],
  },
];