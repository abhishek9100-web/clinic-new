import jsPDF from "jspdf";

export interface Doctor { id: string; name: string; specialization: string; fee: number; phone: string; available: boolean; }
export interface Medicine { id: string; name: string; schedule: string; batchNumber: string; pricePerTablet: number; tabletsPerSheet: number; sheetsPerPack: number; category: string; manufacturer: string; expiryDate: string; stockQuantity: number; description: string; }
export interface OPRecord { opId: string; name: string; age: string; gender: string; phone: string; village: string; doctorId: string; doctorName: string; consultationFee: number; finalAmount: number; paymentMethod: string; transactionId?: string; date: string; status: string; vitals?: { bp: string; weight: string; temperature: string }; isAdmitted?: boolean; }
export interface IPRecord { ipId: string; opId: string; name: string; age: string; gender: string; phone: string; village: string; room: string; bed: string; doctor: string; disease: string; department: string; admissionType: string; management: string; admissionCharges: number; dateOfAdmission: string; dateOfDischarge: string; diagnosis: string; type: string; status: string; treatments: any[]; notes: string; }

export interface Receipt {
  id: string;
  receiptId?: string;
  opId: string;
  patientName: string;
  phone: string;
  type: "op" | "payment" | "medicine" | "xray" | "treatment" | "surgery" | "ip" | "scan" | "lab" | "ecg" | "other";
  category: string;
  amount: number;
  method: string;
  date: string;
  time: string;
  details?: string;
  itemDetails?: { name: string; quantity?: number; amount: number; batchNumber?: string; manufacturer?: string; expiryDate?: string; schedule?: string; }[];
}

export interface ServiceBillItem { name: string; amount: number; paid: number; }
export interface MedicineBillItem { medicine: Medicine; quantity: number; }

// --- Global Theme Colors ---
const lightBlue = [0, 51, 153];
const redColor = [220, 20, 60];

// =========================================================================
// HELPERS
// =========================================================================

function outputPDF(doc: jsPDF, filename: string) {
  doc.autoPrint();
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, "_blank");
  if (!printWindow) doc.save(filename);
}

function formatAppDate(val: any): string {
  if (!val) return "N/A";
  if (typeof val === "string") {
    const datePart = val.split("T")[0];
    const parts = datePart.split("-");
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return String(val);
}

function formatAppTime(val: any): string {
  if (!val) return "";
  if (typeof val === "string") {
    if (!val.includes("T") && !val.includes(":") && !val.toLowerCase().includes("m")) return "";
    if (val.includes("T")) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    }
    if (!val.includes("T") && val.includes(":")) {
      if (val.toLowerCase().includes("am") || val.toLowerCase().includes("pm")) return val;
      const parts = val.split(":");
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        return `${String(h).padStart(2, "0")}:${m} ${ampm}`;
      }
    }
  }
  if (val instanceof Date) return val.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    if (typeof val === "string" && !val.includes("T") && !val.includes(":")) return "";
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  }
  return "";
}

function amountToWords(amount: number): string {
  if (!amount || amount === 0) return "ZERO";
  const a = ["", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN"];
  const b = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
  const numToWords = (n: number): string => {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  };
  let words = "";
  let remaining = Math.floor(amount);
  if (Math.floor(remaining / 10000000) > 0) { words += numToWords(Math.floor(remaining / 10000000)) + " CRORE "; remaining %= 10000000; }
  if (Math.floor(remaining / 100000) > 0) { words += numToWords(Math.floor(remaining / 100000)) + " LAKH "; remaining %= 100000; }
  if (Math.floor(remaining / 1000) > 0) { words += numToWords(Math.floor(remaining / 1000)) + " THOUSAND "; remaining %= 1000; }
  if (Math.floor(remaining / 100) > 0) { words += numToWords(Math.floor(remaining / 100)) + " HUNDRED "; remaining %= 100; }
  if (remaining > 0) words += numToWords(remaining);
  return words.trim();
}

function drawWatermark(doc: jsPDF, w: number, h: number, offsetY: number) {
  const logoUrl = "/newlo.png";
  doc.setGState(new (doc as any).GState({ opacity: 0.10 }));
  try { doc.addImage(logoUrl, "PNG", w / 2 - 40, offsetY + (h / 2) - 40, 80, 80); } catch (e) {}
  doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
}

// =========================================================================
// HEADER BUILDERS
// =========================================================================

function drawCommonHeader(
  doc: jsPDF,
  w: number,
  yOffset: number,
  title: string = "",
  isLab: boolean = false
): number {
  const MARGIN = 10;
  doc.setFont("times");

  let y = yOffset + MARGIN;

  if (isLab) {
    doc.setFontSize(10);
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.setFont("times", "bold");
    doc.text("Cell : 9849012345, 9618012345", w - MARGIN, y + 4, { align: "right" });

    try { doc.addImage("/lablo.png", "PNG", MARGIN, y, 24, 24); } catch (e) {
      doc.setDrawColor(lightBlue[0], lightBlue[1], lightBlue[2]);
      doc.setLineWidth(0.5);
      doc.rect(MARGIN, y, 24, 24);
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
      doc.text("L", MARGIN + 8, y + 16);
    }

    // --- Added Registration Number below the left logo ---
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.text("Rg.No DM&HO No: 1129/2025", MARGIN, y + 28);
    // -----------------------------------------------------

    try { doc.addImage("/doc1.png", "PNG", w - MARGIN - 24, y + 2, 24, 24); } catch (e) {}

    y += 12;

    doc.setFontSize(17);
    doc.setFont("times", "bold");
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.text("Health Care Laboratory", w / 2, y, { align: "center" });

    y += 8;

    doc.setFontSize(11);
    doc.setFont("times", "normal");
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.text("Beside Aadhya hospital, backside Nandi temple, Nandipet", w / 2, y, { align: "center" });

    y += 6;

  } else {
    doc.setFontSize(10);
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.setFont("times", "bold");
    doc.text("Cell : 8106698380", w - MARGIN, y + 4, { align: "right" });

    try { doc.addImage("/newlo.png", "PNG", MARGIN, y, 24, 24); } catch (e) {}
    try { doc.addImage("/doc1.png", "PNG", w - MARGIN - 24, y + 2, 24, 24); } catch (e) {}

    y += 12;

    doc.setFontSize(17);
    doc.setFont("times", "bold");
    const text1 = "NEW "; const text2 = "LIFE "; const text3 = "CARE MULTI SPECIALITY HOSPITAL";
    const tw1 = doc.getTextWidth(text1); const tw2 = doc.getTextWidth(text2); const tw3 = doc.getTextWidth(text3);
    let startX = (w - (tw1 + tw2 + tw3)) / 2;
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]); doc.text(text1, startX, y); startX += tw1;
    doc.setTextColor(redColor[0], redColor[1], redColor[2]); doc.text(text2, startX, y); startX += tw2;
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]); doc.text(text3, startX, y);

    y += 3;
    doc.setFontSize(9);
    doc.setFont("times", "bold");
    const servicesItems = [
      { text: "GENERAL", isButton: true },
      { text: "*", isButton: false },
      { text: "ORTHOPEDICS", isButton: true },
      { text: "*", isButton: false },
      { text: "SURGERY", isButton: true },
    ];
    const paddingX = 8; const gap = 4;
    const metrics = servicesItems.map((item) => {
      const tW = doc.getTextWidth(item.text);
      const elW = item.isButton ? tW + paddingX : tW;
      return { ...item, tW, elW };
    });
    const totalW = metrics.reduce((sum, m) => sum + m.elW, 0) + (metrics.length - 1) * gap;
    let currX = (w - totalW) / 2;
    doc.setLineWidth(0.3);
    metrics.forEach((m) => {
      if (m.isButton) {
        doc.setDrawColor(lightBlue[0], lightBlue[1], lightBlue[2]);
        doc.roundedRect(currX, y, m.elW, 6, 2, 2, "S");
        doc.setTextColor(redColor[0], redColor[1], redColor[2]);
        doc.text(m.text, currX + paddingX / 2, y + 4.2);
      } else {
        doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
        doc.text(m.text, currX, y + 4.2);
      }
      currX += m.elW + gap;
    });
    y += 10;

    doc.setFontSize(12);
    doc.setFont("times", "normal");
    doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
    doc.text(" opposite Nandi statue, old GK Hospital, Nandipet, 503212", w / 2, y, { align: "center" });

    y += 12;
  }

  if (title) {
       y += 4;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);

    doc.line(MARGIN, y, w - MARGIN , y);
    y += 2;
    doc.setFontSize(11); doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(title, w / 2, y + 4, { align: "center" });
    y += 8;
    doc.line(MARGIN, y, w - MARGIN, y);
    return y + 8;
  }
  return y;
}
// =========================================================================
// PATIENT DETAILS BLOCK — STANDARD (for OPD card, final bill, admission)
// =========================================================================

function applyBillPatientDetails(doc: jsPDF, w: number, details: any, startY: number): number {
  const MARGIN = 10;
  let y = startY;
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  const lColon = MARGIN + 25;
  const lVal = lColon + 3;
  const rCol = w / 2 + 10;
  const rColon = rCol + 25;
  const rVal = rColon + 3;

  const writeLine = (lKey: string, lValue: string, rKey: string, rValue: string, isBoldValue: boolean = false) => {
    doc.setFont("times", "bold");
    doc.text(lKey, MARGIN, y); doc.text(":", lColon, y);
    doc.setFont("times", "normal"); doc.text(lValue, lVal, y);
    doc.setFont("times", "bold");
    doc.text(rKey, rCol, y); doc.text(":", rColon, y);
    if (!isBoldValue) doc.setFont("times", "normal");
    doc.text(rValue, rVal, y);
    y += 5;
  };

  writeLine("Patient Name", details.patientName || "N/A", "Patient Id", details.opId || "N/A");
  writeLine("Age/Gender", `${details.age || "N/A"} / ${details.gender || "N/A"}`, "Phone", details.phone || "N/A");

  const printDate = formatAppDate(details.date);
  const printTime = formatAppTime(details.time || details.date);
  writeLine("Consultant", details.doctorName || "N/A", "Receipt Date", `${printDate} ${printTime}`.trim());
  writeLine("Receipt Id", details.receiptId || "N/A", "Head", details.headCategory || "N/A", true);

  y += 2;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 5;
  return y;
}

// =========================================================================
// PATIENT DETAILS BLOCK — COMPACT (for receipts: service, payment, pharmacy)
// =========================================================================

function applyCompactPatientDetails(doc: jsPDF, w: number, details: any, startY: number): number {
  const MARGIN = 10;
  let y = startY;
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  const lColon = MARGIN + 22;
  const lVal = lColon + 2.5;
  const rCol = w / 2 + 8;
  const rColon = rCol + 22;
  const rVal = rColon + 2.5;
  const rowH = 4;

  const writeLine = (lKey: string, lValue: string, rKey: string, rValue: string, isBoldValue: boolean = false) => {
    doc.setFont("times", "bold");
    doc.text(lKey, MARGIN, y); doc.text(":", lColon, y);
    doc.setFont("times", "normal"); doc.text(lValue, lVal, y);
    doc.setFont("times", "bold");
    doc.text(rKey, rCol, y); doc.text(":", rColon, y);
    if (!isBoldValue) doc.setFont("times", "normal");
    doc.text(rValue, rVal, y);
    y += rowH;
  };

  writeLine("Patient Name", details.patientName || "N/A", "Patient Id", details.opId || "N/A");
  writeLine("Age/Gender", `${details.age || "N/A"} / ${details.gender || "N/A"}`, "Phone", details.phone || "N/A");

  const printDate = formatAppDate(details.date);
  const printTime = formatAppTime(details.time || details.date);
  writeLine("Consultant", details.doctorName || "N/A", "Receipt Date", `${printDate} ${printTime}`.trim());
  writeLine("Receipt Id", details.receiptId || "N/A", "Head", details.headCategory || "N/A", true);

  y += 1.5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, w - MARGIN, y);
  y += 4;
  return y;
}

// =========================================================================
// RENDER SERVICE ITEM (bold main + normal sub)
// =========================================================================

function renderServiceItemText(doc: jsPDF, text: string, x: number, y: number) {
  if (!text) return;
  const splitIndex = text.indexOf(" - ");
  if (splitIndex !== -1) {
    const mainName = text.substring(0, splitIndex).trim();
    const subName = " " + text.substring(splitIndex).trim();
    doc.setFont("times", "bold"); doc.text(mainName, x, y);
    const textWidth = doc.getTextWidth(mainName);
    doc.setFont("times", "normal"); doc.text(subName, x + textWidth, y);
    return;
  }
  doc.setFont("times", "normal"); doc.text(text, x, y);
}

// =========================================================================
// RECEIPT TIMESTAMP → ms helper
// =========================================================================

function receiptTimestamp(rec: Receipt): number {
  if (rec.date && typeof rec.date === "string" && rec.date.includes("T")) {
    return new Date(rec.date).getTime();
  }
  if (rec.time && typeof rec.time === "string" && rec.date) {
    const combined = new Date(`${rec.date} ${rec.time}`);
    if (!isNaN(combined.getTime())) return combined.getTime();
  }
  return new Date(rec.date).getTime();
}

// =========================================================================
// MASTER PDF GENERATOR ROUTER
// =========================================================================

export function generateReceiptPDF(receipt: Receipt, patient?: OPRecord | IPRecord) {
  if (!receipt) return;
  const type = receipt.type?.toLowerCase() || "";
  const mockPatient = patient || {
    opId: receipt.opId, name: receipt.patientName, phone: receipt.phone,
    age: (receipt as any).age || "N/A", gender: (receipt as any).gender || "N/A",
    doctorName: (receipt as any).doctorName || "N/A",
    finalAmount: receipt.amount, paymentMethod: receipt.method,
  } as OPRecord;

  if (type === "medicine") {
    let itemsToRender: MedicineBillItem[] = [];
    if (receipt.itemDetails && receipt.itemDetails.length > 0) {
      itemsToRender = receipt.itemDetails.map((it) => ({
        medicine: {
          name: it.name,
          pricePerTablet: (it.amount || 0) / (it.quantity || 1),
          batchNumber: it.batchNumber || "-",
          manufacturer: it.manufacturer || "-",
          expiryDate: it.expiryDate || "",
          schedule: it.schedule || "-",
        } as Medicine,
        quantity: it.quantity || 1,
      }));
    } else {
      itemsToRender = [{ medicine: { name: receipt.details || "Medicine", pricePerTablet: receipt.amount || 0 } as Medicine, quantity: 1 }];
    }
    return generateMedicineBillPDF(mockPatient, receipt, itemsToRender, receipt.method || "CASH");
  }

  if (["lab", "xray", "surgery", "treatment", "scan", "ecg", "other"].includes(type)) {
    let itemsToRender: ServiceBillItem[] = [];
    if (receipt.itemDetails && receipt.itemDetails.length > 0) {
      itemsToRender = receipt.itemDetails.map((it) => ({ name: it.name, amount: it.amount || 0, paid: it.amount || 0 }));
    } else if (receipt.details && receipt.details.includes(",")) {
      const names = receipt.details.split(",").map((n) => n.trim());
      const splitAmount = receipt.amount / Math.max(1, names.length);
      itemsToRender = names.map((name) => ({ name, amount: splitAmount, paid: splitAmount }));
    } else {
      itemsToRender = [{ name: receipt.details || receipt.category || "Service", amount: receipt.amount || 0, paid: receipt.amount || 0 }];
    }
    return generateServiceBillPDF(receipt.category || "Service Bill", mockPatient, receipt, itemsToRender, receipt.method || "CASH");
  }

  if (type === "ip") {
    const mockIp = (patient as any) || {
      ipId: receipt.opId, opId: receipt.opId, name: receipt.patientName,
      phone: receipt.phone, doctor: (receipt as any).doctorName || "N/A",
    } as IPRecord;
    return generateAdmissionPDF(mockIp, receipt);
  }

  return generatePaymentPDF(mockPatient as OPRecord, receipt);
}

// =========================================================================
// OPD REGISTRATION CARD
// =========================================================================

export function generateOPRegistrationPDF(record: OPRecord) {
  if (!record) return;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const MARGIN = 10;

  doc.setFont("times");

  drawWatermark(doc, w, h, 0);

  doc.setFontSize(10);
  doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.setFont("times", "bold");
  doc.text("Cell : 7989339601 , 8897940569", w - MARGIN, MARGIN + 4, { align: "right" });

  try {
    doc.addImage("/newlo.png", "PNG", w - MARGIN - 194, MARGIN + 2, 28, 28);
    doc.addImage("/doc1.png", "PNG", w - MARGIN - 24, MARGIN + 4, 30, 30);
  } catch (e) {}

  let y = MARGIN + 12;

  doc.setFontSize(17);
  doc.setFont("times", "bold");
  const text1 = "NEW "; const text2 = "LIFE "; const text3 = "CARE MULTI SPECIALITY HOSPITAL";
  const tw1 = doc.getTextWidth(text1); const tw2 = doc.getTextWidth(text2); const tw3 = doc.getTextWidth(text3);
  let startX = (w - (tw1 + tw2 + tw3)) / 2;
  doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]); doc.text(text1, startX, y); startX += tw1;
  doc.setTextColor(redColor[0], redColor[1], redColor[2]); doc.text(text2, startX, y); startX += tw2;
  doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]); doc.text(text3, startX, y);

  y += 3;
  doc.setFontSize(9);
  doc.setFont("times", "bold");
  const servicesItems = [
    { text: "GENERAL", isButton: true },
    { text: "*", isButton: false },
    { text: "ORTHOPEDICS", isButton: true },
    { text: "*", isButton: false },
    { text: "SURGERY", isButton: true },
  ];
  const paddingX = 8; const gap = 4;
  const metrics = servicesItems.map((item) => {
    const tW = doc.getTextWidth(item.text);
    const elW = item.isButton ? tW + paddingX : tW;
    return { ...item, tW, elW };
  });
  const totalW = metrics.reduce((sum, m) => sum + m.elW, 0) + (metrics.length - 1) * gap;
  let currX = (w - totalW) / 2;
  doc.setLineWidth(0.3);
  metrics.forEach((m) => {
    if (m.isButton) {
      doc.setDrawColor(lightBlue[0], lightBlue[1], lightBlue[2]);
      doc.roundedRect(currX, y, m.elW, 6, 2, 2, "S");
      doc.setTextColor(redColor[0], redColor[1], redColor[2]);
      doc.text(m.text, currX + paddingX / 2, y + 4.2);
    } else {
      doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
      doc.text(m.text, currX, y + 4.2);
    }
    currX += m.elW + gap;
  });
  y += 10;

  doc.setFontSize(12);
  doc.setFont("times", "normal");
  doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.text(" opposite Nandi statue, old GK Hospital, Nandipet, 503212", w / 2, y, { align: "center" });
  y += 3;

  try { doc.addImage("/247l.png", "PNG", w / 2 - 15, y, 30, 18); } catch (e) {}

  const doctorDisplayName = record.doctorName
    ? (record.doctorName.toLowerCase().startsWith("dr") ? record.doctorName.toUpperCase() : `Dr. ${record.doctorName.toUpperCase()}`)
    : "Dr. THIRUPATHI KANDLI";

  doc.setFontSize(15);
  doc.setFont("times", "bold");
  doc.setTextColor(redColor[0], redColor[1], redColor[2]);
  doc.text(doctorDisplayName, MARGIN, y + 15);

  doc.setFontSize(9);
  doc.setFont("times", "bold");
  doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.text("(MBBS)", MARGIN + 56, y + 20);

  const opDate = record.date ? new Date(record.date) : new Date();
  const validTill = new Date(opDate);
  validTill.setDate(validTill.getDate() + 15);

  doc.setFontSize(11);
  doc.setFont("times", "bold");
  doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.text(`OP ID : ${record.opId || "N/A"}`, w - MARGIN, y + 15, { align: "right" });
  doc.text(`Valid Till : ${formatAppDate(validTill)}`, w - MARGIN, y + 20, { align: "right" });

  y += 24;

  doc.setDrawColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, w - MARGIN, y);

  y += 6;
  doc.setTextColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.setFontSize(10);

  const pColon = MARGIN + 22;
  const pVal = pColon + 2;

  doc.setFont("times", "bold"); doc.text("Patient Name", MARGIN, y); doc.text(":", pColon, y);
  doc.setFont("times", "normal"); doc.text(record.name || "N/A", pVal, y);

  const wAge = MARGIN + 55;
  doc.setFont("times", "bold"); doc.text("Age", wAge, y); doc.text(":", wAge + 8, y);
  doc.setFont("times", "normal"); doc.text(record.age || "N/A", wAge + 11, y);

  const wSex = wAge + 25;
  doc.setFont("times", "bold"); doc.text("Gender", wSex, y); doc.text(":", wSex + 12, y);
  doc.setFont("times", "normal"); doc.text(record.gender || "N/A", wSex + 15, y);

  const wDept = wSex + 30;
  doc.setFont("times", "bold"); doc.text("Department", wDept, y); doc.text(":", wDept + 20, y);
  doc.setFont("times", "normal"); doc.text("General", wDept + 22, y);

  const printDate = formatAppDate(record.date || new Date());
  doc.setFont("times", "bold"); doc.text(`Date : ${printDate}`, w - MARGIN, y, { align: "right" });

  y += 8;

  doc.setFont("times", "bold"); doc.text("Village", MARGIN, y); doc.text(":", pColon, y);
  doc.setFont("times", "normal"); doc.text(record.village || "N/A", pVal, y);

  doc.setFont("times", "bold"); doc.text("Phone", wAge, y); doc.text(":", wAge + 11, y);
  doc.setFont("times", "normal"); doc.text(record.phone || "N/A", wAge + 14, y);

  y += 5;
  doc.line(MARGIN, y, w - MARGIN, y);

  const vitalsStartX = MARGIN;
  const vitalsStartY = y + 10;
  const verticalLineX = MARGIN + 30;

  let vy = vitalsStartY;
  const lineSpacing = 12;
  const vColon = vitalsStartX + 12;
  const vVal = vColon + 3;

  const printVital = (label: string, value: string) => {
    doc.setFont("times", "bold"); doc.text(label, vitalsStartX, vy); doc.text(":", vColon, vy);
    doc.setFont("times", "normal"); doc.text(value, vVal, vy);
    vy += lineSpacing;
  };

  printVital("BP", record.vitals?.bp || "");
  printVital("PR", record.vitals?.weight || "");
  printVital("Sp02", record.vitals?.temperature || "");
  printVital("Temp", "");
  printVital("RR", "");
  printVital("Weight", "");

  doc.setDrawColor(lightBlue[0], lightBlue[1], lightBlue[2]);
  doc.line(verticalLineX, y, verticalLineX, h - 20);

  doc.setFontSize(15);
  doc.setFont("times", "bold");
  doc.text("Rx", verticalLineX + 5, vitalsStartY);

  outputPDF(doc, `${record.opId || "Patient"}_OPD_Card.pdf`);
}

// =========================================================================
// PAYMENT RECEIPT
// =========================================================================

export function generatePaymentPDF(record: OPRecord, receipt: Receipt) {
  if (!record || !receipt) return;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const finalAmt = record.finalAmount || receipt.amount || 0;
  const payMethod = record.paymentMethod || receipt.method || "Cash";
  const MARGIN = 10;

  const drawHalf = (offsetY: number, copyType: string) => {
    let y = drawCommonHeader(doc, w, offsetY, "Payment Receipt");
    y = applyCompactPatientDetails(doc, w, {
      patientName: record?.name || receipt?.patientName || "N/A",
      opId: record?.opId || receipt?.opId || "N/A",
      age: record?.age || "N/A", gender: record?.gender || "N/A",
      doctorName: record?.doctorName || "N/A",
      phone: record?.phone || receipt?.phone || "N/A",
      receiptId: receipt?.receiptId || receipt?.id || "N/A",
      date: receipt?.date || record?.date || new Date().toISOString(),
      time: receipt?.time || receipt?.date || record?.date || new Date().toISOString(),
      headCategory: "OP Consultation",
    }, y);

    doc.setFont("times", "bold"); doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text("SERVICE ITEM", MARGIN + 10, y);
    doc.text("AMOUNT", w - MARGIN - 20, y, { align: "right" });
    y += 3;
    doc.setDrawColor(0, 0, 0);
    doc.line(MARGIN + 5, y, w - MARGIN - 5, y);
    y += 5;

    doc.setTextColor(0, 0, 0);
    renderServiceItemText(doc, "OP Consultation", MARGIN + 10, y);
    doc.setFont("times", "normal");
    doc.text(`Rs. ${finalAmt.toFixed(2)}`, w - MARGIN - 20, y, { align: "right" });
    y += 6;
    doc.line(MARGIN + 5, y, w - MARGIN - 5, y); y += 6;

    doc.setFont("times", "bold");
    doc.text("TOTAL", MARGIN + 10, y);
    doc.text(`Rs. ${finalAmt.toFixed(2)}`, w - MARGIN - 20, y, { align: "right" });
    y += 12;

    doc.setFont("times", "normal");
    doc.text(`Payment Method: ${payMethod.toUpperCase()}`, MARGIN + 10, y);
    if (record.transactionId) { y += 5; doc.text(`Transaction ID: ${record.transactionId}`, MARGIN + 10, y); }

    const sigY = offsetY + (h / 2) - 15;
    doc.setFont("times", "bold");
    doc.text("Status: PAID", w - MARGIN - 10, y, { align: "right" });
    doc.text("Authorised Signatory", w - MARGIN - 10, sigY, { align: "right" });

    doc.setFontSize(8); doc.setFont("times", "normal"); doc.setTextColor(100, 100, 100);
    doc.text(copyType, w / 2, offsetY + (h / 2) - 5, { align: "center" });
  };

  drawHalf(0, "( Patient Copy )");
  doc.setDrawColor(150, 150, 150); doc.setLineDashPattern([2, 2], 0); doc.line(0, h / 2, w, h / 2); doc.setLineDashPattern([], 0);
  drawHalf(h / 2, "( Hospital Copy )");

  outputPDF(doc, `${record.opId || receipt.opId || "Patient"}_Payment.pdf`);
}

// =========================================================================
// ADMISSION RECEIPT
// =========================================================================

export function generateAdmissionPDF(ip: IPRecord, receipt: Receipt) {
  if (!ip || !receipt) return;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const recId = receipt?.receiptId || receipt?.id || "N/A";
  const paymentType = receipt?.method?.toUpperCase() || "CASH";
  const actualAmount = receipt?.amount || ip.admissionCharges || 0;
  const MARGIN = 10;

  const drawHalf = (offsetY: number, copyType: string) => {
    let y = drawCommonHeader(doc, w, offsetY, "Advance Money Receipt");

    const lStart = MARGIN; const lColon = MARGIN + 25; const lVal = lColon + 3;
    const rStart = w / 2; const rColon = rStart + 25; const rVal = rColon + 3;

    doc.setFontSize(9); doc.setTextColor(0, 0, 0);

    const writeRow = (k1: string, v1: string, k2: string, v2: string) => {
      doc.setFont("times", "bold"); doc.text(k1, lStart, y); doc.text(":", lColon, y);
      doc.setFont("times", "normal"); doc.text(v1, lVal, y);
      doc.setFont("times", "bold"); doc.text(k2, rStart, y); doc.text(":", rColon, y);
      doc.setFont("times", "normal"); doc.text(v2, rVal, y);
      y += 5;
    };

    writeRow("IP No", ip.ipId || "N/A", "Doctor", ip.doctor || "N/A");
    writeRow("OP No", ip.opId || "N/A", "Trans Type", ip.admissionType || "N/A");
    writeRow("Name", ip.name || "N/A", "Receipt No", recId);
    writeRow("Age/Gender", `${ip.age || "N/A"} / ${ip.gender || "N/A"}`, "Date", `${formatAppDate(ip.dateOfAdmission || receipt?.date)} ${formatAppTime(receipt?.time)}`.trim());
    writeRow("Phone", ip.phone || "N/A", "Bed No", `${ip.room || "N/A"} ${ip.bed ? "- " + ip.bed : ""}`);

    y += 2; doc.setDrawColor(0, 0, 0);
    doc.line(MARGIN, y, w - MARGIN, y); y += 6;

    doc.setFont("times", "bold"); doc.text("IP Advance", lStart, y); doc.text(`Amount of Rs. ${actualAmount}/-`, w / 2, y, { align: "center" }); y += 4;
    doc.line(MARGIN, y, w - MARGIN, y); y += 6;

    doc.setFont("times", "bold"); doc.text("Payment Type", lStart, y); doc.text(":", lColon, y); doc.setFont("times", "normal"); doc.text(paymentType, lVal, y); y += 5;
    doc.setFont("times", "bold"); doc.text("Amount", lStart, y); doc.text(":", lColon, y); doc.setFont("times", "normal"); doc.text(`${actualAmount.toFixed(2)}`, lVal, y); y += 5;

    doc.setFont("times", "bold"); doc.text("In Words", lStart, y); doc.text(":", lColon, y); doc.setFont("times", "normal");
    const words = `RUPEES ${amountToWords(actualAmount)} ONLY`;
    const splitWords = doc.splitTextToSize(words, w - lColon - 10);
    doc.text(splitWords, lVal, y); y += (splitWords.length * 5);

    const sigY = offsetY + (h / 2) - 15;
    doc.setFont("times", "bold"); doc.text("Created By : ADMIN", lStart, sigY);
    doc.text("Authorised Signatory", w - MARGIN, sigY, { align: "right" });

    doc.setFontSize(8); doc.setFont("times", "normal"); doc.setTextColor(100, 100, 100);
    doc.text(copyType, w / 2, offsetY + (h / 2) - 5, { align: "center" });
  };

  drawHalf(0, "( Patient Copy )");
  doc.setDrawColor(150, 150, 150); doc.setLineDashPattern([2, 2], 0); doc.line(0, h / 2, w, h / 2); doc.setLineDashPattern([], 0);
  drawHalf(h / 2, "( Hospital Copy )");

  outputPDF(doc, `${ip.ipId || "Patient"}_Advance_Receipt.pdf`);
}

// =========================================================================
// SERVICE BILL (X-Ray / ECG / Lab / Treatment / Other)
// =========================================================================

export function generateServiceBillPDF(
  title: string,
  patient: OPRecord | IPRecord | undefined,
  receipt: Receipt,
  items: ServiceBillItem[],
  paymentMethod: string
) {
  if (!receipt) return;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const isLabBill = title.toLowerCase().includes("lab");
  const MARGIN = 10;

  let itemsToRender = items && items.length > 0 ? items : [];
  if (itemsToRender.length === 0) {
    if (receipt.details && receipt.details.includes(",")) {
      const names = receipt.details.split(",").map((n) => n.trim());
      const splitAmount = receipt.amount / names.length;
      itemsToRender = names.map((name) => ({ name, amount: splitAmount, paid: splitAmount }));
    } else {
      itemsToRender = [{ name: receipt.details || receipt.category || "Service", amount: receipt.amount || 0, paid: receipt.amount || 0 }];
    }
  }

  const halfH = h / 2;
  const headerApprox = isLabBill ? 64 : 78;
  const footerApprox = 22;
  const availableH = halfH - headerApprox - footerApprox;

  const defaultRowH = 6;
  const minFontSize = 6;
  const defaultFontSize = 9;

  let fontSize = defaultFontSize;
  let rowH = defaultRowH;

  const requiredH = itemsToRender.length * defaultRowH + 15;
  if (requiredH > availableH && itemsToRender.length > 0) {
    const scale = availableH / requiredH;
    fontSize = Math.max(minFontSize, Math.floor(defaultFontSize * scale * 10) / 10);
    rowH = Math.max(3.5, defaultRowH * scale);
  }

  const drawHalf = (offsetY: number, copyType: string) => {
    let y = drawCommonHeader(doc, w, offsetY, title || "Service Bill", isLabBill);
    y = applyCompactPatientDetails(doc, w, {
      patientName: patient?.name || receipt?.patientName || "N/A",
      opId: patient?.opId || receipt?.opId || "N/A",
      age: patient?.age || "N/A", gender: patient?.gender || "N/A",
      doctorName: (patient as any)?.doctorName || (patient as any)?.doctor || "N/A",
      phone: patient?.phone || receipt?.phone || "N/A",
      receiptId: receipt?.receiptId || receipt?.id || "N/A",
      date: receipt?.date || new Date().toISOString(),
      time: receipt?.time || receipt?.date || new Date().toISOString(),
      headCategory: title || "Service",
    }, y);

    doc.setFont("times", "bold"); doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    doc.text("SERVICE ITEM", MARGIN + 10, y);
    doc.text("BILLED", 100, y); doc.text("PAID", 140, y);
    doc.text("BALANCE", w - MARGIN - 10, y, { align: "right" });
    y += 3;
    doc.setDrawColor(0, 0, 0);
    doc.line(MARGIN + 5, y, w - MARGIN - 5, y);
    y += rowH - 1;

    let totalBilled = 0; let totalPaid = 0;
    itemsToRender.forEach((item) => {
      const amount = item.amount || 0; const paid = item.paid || 0; const balance = amount - paid;
      totalBilled += amount; totalPaid += paid;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(fontSize);
      renderServiceItemText(doc, item.name || "Service", MARGIN + 10, y);
      doc.setFont("times", "normal");
      doc.text(`${amount.toFixed(2)}`, 100, y);
      doc.text(`${paid.toFixed(2)}`, 140, y);
      doc.text(`${balance.toFixed(2)}`, w - MARGIN - 10, y, { align: "right" });
      y += rowH;
    });

    doc.setDrawColor(0, 0, 0);
    doc.setFontSize(fontSize);
    doc.line(MARGIN + 5, y, w - MARGIN - 5, y); y += rowH - 1;
    doc.setFont("times", "bold");
    doc.text("TOTAL", MARGIN + 10, y);
    doc.text(`${totalBilled.toFixed(2)}`, 100, y);
    doc.text(`${totalPaid.toFixed(2)}`, 140, y);
    doc.text(`${(totalBilled - totalPaid).toFixed(2)}`, w - MARGIN - 10, y, { align: "right" });
    y += 8;

    doc.setFontSize(9);
    doc.setFont("times", "normal");
    doc.text(`Payment: ${(paymentMethod || "Cash").toUpperCase()}`, MARGIN + 10, y);

    const sigY = offsetY + (h / 2) - 15;
    if (isLabBill) {
      const printDate = formatAppDate(receipt?.date || new Date().toISOString());
      const printTime = formatAppTime(receipt?.time || receipt?.date || new Date().toISOString());
      doc.setFontSize(9); doc.text(`Issued Date : ${printDate} ${printTime}`, MARGIN + 10, sigY - 5);
      try { doc.addImage("/nsign.png", "PNG", w - MARGIN - 45, sigY - 18, 30, 15); } catch (e) {}
      doc.setFont("times", "bold"); doc.text("Name : SK Salman (DMLT)", w - MARGIN - 10, sigY, { align: "right" });
    } else {
      doc.setFont("times", "bold"); doc.text("Authorised Signatory", w - MARGIN - 10, sigY, { align: "right" });
    }

    doc.setFontSize(8); doc.setFont("times", "normal"); doc.setTextColor(100, 100, 100);
    doc.text(copyType, w / 2, offsetY + (h / 2) - 5, { align: "center" });
  };

  drawHalf(0, "( Patient Copy )");
  doc.setDrawColor(150, 150, 150); doc.setLineDashPattern([2, 2], 0); doc.line(0, h / 2, w, h / 2); doc.setLineDashPattern([], 0);
  drawHalf(h / 2, "( Hospital Copy )");

  const safeTitle = title ? title.replace(/\s/g, "_") : "Service_Bill";
  outputPDF(doc, `${patient?.opId || receipt?.opId || "Patient"}_${safeTitle}.pdf`);
}

// =========================================================================
// FINAL DISCHARGE BILL
//
// KEY FIX: Receipts are filtered STRICTLY by the IP record's own admission and
// discharge timestamps. This means:
//   • Each IP admission gets only the receipts that happened during that stay.
//   • If the same patient is re-admitted (new ipId), re-admission receipts do
//     NOT appear in the earlier stay's final bill.
//   • A 5-minute grace window is applied on both ends to catch receipts that
//     were created a few seconds before/after the admission or discharge action.
// =========================================================================

export function generateFinalBillPDF(ip: IPRecord, patientReceipts: Receipt[]) {
  if (!ip) return;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const MARGIN = 10;
  let y = 0; let pageNumber = 1;

  // ── Build the strict time window for THIS ip record ──────────────────────
  // admissionTs: the exact moment this IP record was created/admitted.
  const admissionTs = ip.dateOfAdmission ? new Date(ip.dateOfAdmission).getTime() : 0;

  // Allow a 5-minute grace BEFORE the stored admission time so that receipts
  // created a few seconds earlier (e.g. the advance money receipt) are still
  // included.
  const GRACE_MS = 5 * 60 * 1000; // 5 minutes
  const windowStart = admissionTs - GRACE_MS;

  // dischargeTs: the moment this IP record was discharged.
  // If not yet discharged (Infinity) every receipt from admission onward is in.
  const dischargeTs = ip.dateOfDischarge
    ? new Date(ip.dateOfDischarge).getTime()
    : Infinity;

  // Allow a 5-minute grace AFTER the stored discharge time.
  const windowEnd = dischargeTs === Infinity ? Infinity : dischargeTs + GRACE_MS;

  /**
   * Returns true only if the receipt's timestamp falls within this IP's
   * admission–discharge window AND the receipt belongs to the same patient
   * (matched by opId or phone).
   */
  const isInWindow = (rec: Receipt): boolean => {
    const ts = receiptTimestamp(rec);
    if (isNaN(ts)) return false;
    // Must belong to this patient (by opId or phone)
    const samePatient =
      rec.opId === ip.opId ||
      (rec.phone && ip.phone && rec.phone === ip.phone);
    if (!samePatient) return false;
    // Must fall within this admission's time window
    return ts >= windowStart && ts <= windowEnd;
  };

  const addHeader = () => {
    drawWatermark(doc, w, pageHeight, 0);
    y = drawCommonHeader(doc, w, 0, "Final Bill");

    doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    const lColon = MARGIN + 25; const lVal = lColon + 3;
    const rCol = w / 2 + 10; const rColon = rCol + 25; const rVal = rColon + 3;

    const writeRow = (k1: string, v1: string, k2: string, v2: string) => {
      doc.setFont("times", "bold"); doc.text(k1, MARGIN, y); doc.text(":", lColon, y);
      doc.setFont("times", "normal"); doc.text(v1, lVal, y);
      doc.setFont("times", "bold"); doc.text(k2, rCol, y); doc.text(":", rColon, y);
      doc.setFont("times", "normal"); doc.text(v2, rVal, y);
      y += 5;
    };

    writeRow("Patient Name", ip.name || "N/A", "IP No", ip.ipId || "N/A");
    writeRow("Age/Gender", `${ip.age || "N/A"} / ${ip.gender || "N/A"}`, "OP No", ip.opId || "N/A");
    writeRow("Mobile No", ip.phone || "N/A", "Bill No", `FB-${ip.ipId || "N/A"}`);
    writeRow("Doctor", ip.doctor || "N/A", "Admission Date", `${formatAppDate(ip.dateOfAdmission)} ${formatAppTime(ip.dateOfAdmission)}`.trim());

    const dDate = ip.dateOfDischarge || new Date();
    writeRow("Department", ip.department || "General", "Discharge Date", `${formatAppDate(dDate)} ${formatAppTime(dDate)}`.trim());
    writeRow("Ward/Bed No", `${ip.room || "-"} / ${ip.bed || "-"}`, "", "");

    y += 2; doc.setDrawColor(0, 0, 0);
    doc.line(MARGIN, y, w - MARGIN, y); y += 5;

    doc.setFont("times", "bold"); doc.setFontSize(8);
    doc.text("Date & Time", MARGIN + 2, y);
    doc.text("Description", 45, y);
    doc.text("Rate", 140, y);
    doc.text("Qty", 160, y);
    doc.text("Amount", w - MARGIN - 2, y, { align: "right" });
    y += 3;
    doc.line(MARGIN, y, w - MARGIN, y);
    y += 6;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.setFontSize(8); doc.text(`Page ${pageNumber}`, w / 2, pageHeight - 10, { align: "center" });
      doc.addPage(); pageNumber++; y = 15; addHeader();
    }
  };

  addHeader();

  // ── Filter receipts to this admission's strict time window ───────────────
  // Advance / IP receipts: type === "ip"
  const advances = (patientReceipts || []).filter((r) => r.type === "ip" && isInWindow(r));

  // All other billable receipts in the window (exclude "op" type as that's
  // the OP registration receipt — not part of the inpatient bill)
  const billedReceipts = (patientReceipts || []).filter(
    (r) => r.type !== "ip" && r.type !== "op" && isInWindow(r)
  );

  const groups = [
    { title: "SERVICES & TREATMENTS", types: ["treatment", "surgery", "payment"] },
    { title: "INVESTIGATIONS", types: ["lab", "xray", "scan", "ecg"] },
    { title: "PHARMACY", types: ["medicine"] },
    { title: "OTHER SERVICES", types: ["other"] },
  ];
  let grossTotal = 0;

  groups.forEach((group) => {
    const groupReceipts = billedReceipts.filter((r) => group.types.includes(r.type));
    if (groupReceipts.length === 0) return;

    checkPageBreak(15);
    doc.setFont("times", "bold"); doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text(group.title, MARGIN + 2, y);
    y += 5;
    doc.setFont("times", "normal");

    let groupTotal = 0;
    groupReceipts.forEach((rec) => {
      const formattedDT = `${formatAppDate(rec.date)} ${formatAppTime(rec.time || rec.date)}`.trim();
      if (rec.itemDetails && rec.itemDetails.length > 0) {
        rec.itemDetails.forEach((item) => {
          checkPageBreak(8);
          doc.setFontSize(8);
          doc.text(formattedDT, MARGIN + 2, y);
          const lines = doc.splitTextToSize(item.name || "", 85);
          doc.text(lines, 45, y);
          const rate = (item.amount || 0) / (item.quantity || 1);
          doc.text(rate.toFixed(2), 140, y);
          doc.text(String(item.quantity || 1), 160, y);
          doc.text((item.amount || 0).toFixed(2), w - MARGIN - 2, y, { align: "right" });
          groupTotal += item.amount || 0;
          y += lines.length * 4;
        });
      } else {
        checkPageBreak(8);
        doc.setFontSize(8);
        doc.text(formattedDT, MARGIN + 2, y);
        const desc = rec.details || rec.category || "Service";
        const lines = doc.splitTextToSize(desc, 85);
        doc.text(lines, 45, y);
        doc.text((rec.amount || 0).toFixed(2), 140, y);
        doc.text("1", 160, y);
        doc.text((rec.amount || 0).toFixed(2), w - MARGIN - 2, y, { align: "right" });
        groupTotal += rec.amount || 0;
        y += lines.length * 4;
      }
    });

    checkPageBreak(10);
    y += 2;
    doc.setFont("times", "bold"); doc.setFontSize(8);
    doc.text(`${group.title} TOTAL:`, 140, y, { align: "right" });
    doc.text(groupTotal.toFixed(2), w - MARGIN - 2, y, { align: "right" });
    grossTotal += groupTotal;
    y += 8;
  });

  checkPageBreak(60);
  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN, y, w - MARGIN, y); y += 6;

  const advanceTotal = advances.reduce((sum, r) => sum + (r.amount || 0), 0);
  const netPayable = Math.max(0, grossTotal - advanceTotal);
  const currentBalance = grossTotal - advanceTotal;

  doc.setFont("times", "bold"); doc.setFontSize(9);
  doc.text("Rupees in words:", MARGIN + 2, y);
  doc.setFont("times", "normal");
  const words = `${amountToWords(netPayable > 0 ? netPayable : grossTotal)} RUPEES ONLY`;
  const splitWords = doc.splitTextToSize(words, 100);
  doc.text(splitWords, 45, y);

  const rightL = 140; const rightCol = 165; const rightR = w - MARGIN - 2;
  doc.setFont("times", "bold");
  doc.text("Gross Total", rightL, y); doc.text(":", rightCol, y); doc.text(grossTotal.toFixed(2), rightR, y, { align: "right" }); y += 5;
  doc.text("Less Discount", rightL, y); doc.text(":", rightCol, y); doc.text("0.00", rightR, y, { align: "right" }); y += 5;
  doc.text("Total GST", rightL, y); doc.text(":", rightCol, y); doc.text("0.00", rightR, y, { align: "right" }); y += 5;
  doc.line(rightL, y, rightR, y); y += 4;
  doc.text("Net Bill Amount", rightL, y); doc.text(":", rightCol, y); doc.text(grossTotal.toFixed(2), rightR, y, { align: "right" }); y += 5;
  doc.text("Less Advance", rightL, y); doc.text(":", rightCol, y); doc.text(advanceTotal.toFixed(2), rightR, y, { align: "right" }); y += 5;
  doc.line(rightL, y, rightR, y); y += 4;
  doc.text("Net Payable", rightL, y); doc.text(":", rightCol, y); doc.text(netPayable.toFixed(2), rightR, y, { align: "right" }); y += 5;
  doc.text("Current Balance", rightL, y); doc.text(":", rightCol, y); doc.text(currentBalance.toFixed(2), rightR, y, { align: "right" }); y += 10;

  if (advances.length > 0) {
    doc.setFont("times", "bold"); doc.setFontSize(9);
    doc.text("Receipt Details (Advances)", MARGIN + 2, y); y += 5;
    doc.setFontSize(8);
    doc.text("SNo", MARGIN + 2, y); doc.text("Date & Time", MARGIN + 12, y);
    doc.text("Receipt No", 55, y); doc.text("Amount", 85, y); doc.text("Mode", 105, y);
    y += 4; doc.setFont("times", "normal");
    advances.forEach((adv, i) => {
      doc.text(String(i + 1), MARGIN + 2, y);
      doc.text(`${formatAppDate(adv.date)} ${formatAppTime(adv.time || adv.date)}`.trim(), MARGIN + 12, y);
      doc.text(adv.receiptId || adv.id || "N/A", 55, y);
      doc.text((adv.amount || 0).toFixed(2), 85, y);
      doc.text(adv.method || "N/A", 105, y);
      y += 4;
    });
    doc.setFont("times", "bold"); doc.text(`Sub Total: ${advanceTotal.toFixed(2)}`, 85, y); y += 10;
  }

  checkPageBreak(30);
  y = Math.max(y, pageHeight - 35);
  doc.setFontSize(9); doc.setFont("times", "bold");
  doc.text("Patient/Attendant Signatory", MARGIN + 2, y);
  doc.text("Prepared By: ADMIN", w - MARGIN - 2, y, { align: "right" });
  doc.setFontSize(8); doc.setFont("times", "normal");
  doc.text(`Page ${pageNumber} of ${pageNumber}`, w / 2, pageHeight - 10, { align: "center" });

  outputPDF(doc, `${ip.ipId || "Patient"}_Final_Discharge_Bill.pdf`);
}

// =========================================================================
// PHARMACY BILL
// =========================================================================

export function generateMedicineBillPDF(
  patient: OPRecord | IPRecord | undefined,
  receipt: Receipt,
  items: MedicineBillItem[],
  paymentMethod: string
) {
  if (!receipt) return;
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const MARGIN = 10;

  let itemsToRender = items && items.length > 0 ? items : [];
  if (itemsToRender.length === 0 && receipt.itemDetails && receipt.itemDetails.length > 0) {
    itemsToRender = receipt.itemDetails.map((it) => ({
      medicine: { name: it.name, pricePerTablet: (it.amount || 0) / (it.quantity || 1) } as Medicine,
      quantity: it.quantity || 1,
    }));
  } else if (itemsToRender.length === 0) {
    itemsToRender = [{ medicine: { name: receipt.details || "Medicine", pricePerTablet: receipt.amount || 0 } as Medicine, quantity: 1 }];
  }

  const headerApprox = 73;
  const footerApprox = 20;
  const availableH = h - headerApprox - footerApprox;
  const defaultRowH = 6;
  const minFontSize = 5.5;
  const defaultFontSize = 8;

  let fontSize = defaultFontSize;
  let rowH = defaultRowH;

  const requiredH = itemsToRender.length * defaultRowH + 15;
  if (requiredH > availableH && itemsToRender.length > 0) {
    const scale = availableH / requiredH;
    fontSize = Math.max(minFontSize, Math.floor(defaultFontSize * scale * 10) / 10);
    rowH = Math.max(3.5, defaultRowH * scale);
  }

  let y = drawCommonHeader(doc, w, 0, "Pharmacy Bill");
  y = applyCompactPatientDetails(doc, w, {
    patientName: patient?.name || receipt?.patientName || "N/A",
    opId: patient?.opId || receipt?.opId || "N/A",
    age: patient?.age || "N/A", gender: patient?.gender || "N/A",
    doctorName: (patient as any)?.doctorName || (patient as any)?.doctor || "N/A",
    phone: patient?.phone || receipt?.phone || "N/A",
    receiptId: receipt?.receiptId || receipt?.id || "N/A",
    date: receipt?.date || new Date().toISOString(),
    time: receipt?.time || receipt?.date || new Date().toISOString(),
    headCategory: "Pharmacy Bill",
  }, y);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  y += 2;
  doc.line(MARGIN, y, w - MARGIN, y); y += 5;

  doc.setFont("times", "bold"); doc.setFontSize(fontSize);
  doc.setTextColor(0, 0, 0);
  doc.text("S.NO", MARGIN + 2, y);
  doc.text("PRODUCT NAME", MARGIN + 12, y);
  doc.text("SCH", 80, y);
  doc.text("MFG", 95, y);
  doc.text("BATCH", 115, y);
  doc.text("EXPIRY", 140, y);
  doc.text("QTY", 165, y);
  doc.text("RATE", 175, y);
  doc.text("AMOUNT", w - MARGIN - 2, y, { align: "right" });
  y += 3;
  doc.line(MARGIN, y, w - MARGIN, y);
  y += rowH;

  let total = 0;
  doc.setFont("times", "normal");

  itemsToRender.forEach((item, index) => {
    const amt = (item.quantity || 0) * (item.medicine?.pricePerTablet || 0);
    total += amt;
    doc.setFontSize(fontSize);
    doc.setTextColor(0, 0, 0);
    doc.text(String(index + 1), MARGIN + 2, y);
    const nameLines = doc.splitTextToSize(item.medicine?.name || "Unknown", 55);
    doc.text(nameLines, MARGIN + 12, y);
    doc.text((item.medicine as any)?.schedule || "-", 80, y);
    const mfg = (item.medicine as any)?.manufacturer || "-";
    doc.text(mfg.length > 10 ? mfg.substring(0, 8) + ".." : mfg, 95, y);
    doc.text((item.medicine as any)?.batchNumber || "-", 115, y);
    const exp = (item.medicine as any)?.expiryDate;
    doc.text(exp ? formatAppDate(exp) : "-", 140, y);
    doc.text(String(item.quantity || 0), 165, y);
    doc.text((item.medicine?.pricePerTablet || 0).toFixed(2), 175, y);
    doc.text(amt.toFixed(2), w - MARGIN - 2, y, { align: "right" });
    y += (nameLines.length * (rowH - 1)) + (rowH - (rowH - 1) * nameLines.length > 0 ? rowH - (rowH - 1) * nameLines.length : 1);
  });

  y += 2;
  doc.setFontSize(fontSize);
  doc.line(MARGIN, y, w - MARGIN, y); y += rowH;
  doc.setFont("times", "bold");
  doc.text("TOTAL", MARGIN + 12, y);
  doc.text(total.toFixed(2), w - MARGIN - 2, y, { align: "right" });
  y += 10;

  doc.setFontSize(9);
  doc.setFont("times", "normal");
  doc.text(`Payment: ${(paymentMethod || "Cash").toUpperCase()}`, MARGIN + 2, y);

  outputPDF(doc, `${patient?.opId || receipt?.opId || "Patient"}_PharmacyBill.pdf`);
}