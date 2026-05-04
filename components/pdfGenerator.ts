import jsPDF from "jspdf";

export interface Doctor { id: string; name: string; specialization: string; fee: number; phone: string; available: boolean; }
export interface Medicine { id: string; name: string; schedule: string; batchNumber: string; pricePerTablet: number; tabletsPerSheet: number; sheetsPerPack: number; category: string; manufacturer: string; expiryDate: string; stockQuantity: number; description: string; }
export interface OPRecord { opId: string; name: string; age: string; gender: string; phone: string; village: string; doctorId: string; doctorName: string; consultationFee: number; finalAmount: number; paymentMethod: string; transactionId?: string; date: string; status: string; vitals?: { bp: string; weight: string; temperature: string }; isAdmitted?: boolean; }
export interface IPRecord { ipId: string; opId: string; name: string; age: string; gender: string; phone: string; village: string; room: string; bed: string; doctor: string; disease: string; department: string; admissionType: string; management: string; admissionCharges: number; dateOfAdmission: string; dateOfDischarge: string; diagnosis: string; type: string; status: string; treatments: any[]; notes: string; }

// --- ADDED "ecg" to the type below ---
export interface Receipt {
  id: string;
  receiptId?: string;
  opId: string;
  patientName: string;
  phone: string;
  type: "op" | "payment" | "medicine" | "xray" | "treatment" | "surgery" | "ip" | "scan" | "lab" | "ecg";
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

function outputPDF(doc: jsPDF, filename: string) {
  doc.autoPrint();
  const blob = doc.output("blob");
  const blobUrl = URL.createObjectURL(blob);
  const printWindow = window.open(blobUrl, "_blank");
  if (!printWindow) doc.save(filename);
}

function formatAppDate(val: any): string {
  if (!val) return "N/A";
  if (typeof val === 'string') {
    const datePart = val.split('T')[0]; 
    const parts = datePart.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; 
  }
  let d = new Date(val);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  }
  return String(val);
}

function formatAppTime(val: any): string {
  if (!val) return "";
  if (typeof val === 'string') {
    if (!val.includes('T') && !val.includes(':') && !val.toLowerCase().includes('m')) return ""; 
    if (val.includes('T')) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    if (!val.includes('T') && val.includes(':')) {
      if (val.toLowerCase().includes('am') || val.toLowerCase().includes('pm')) return val;
      const parts = val.split(':');
      if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
      }
    }
  }
  if (val instanceof Date) return val.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    if (typeof val === 'string' && !val.includes('T') && !val.includes(':')) return "";
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
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
  let words = ""; let remaining = Math.floor(amount);
  if (Math.floor(remaining / 10000000) > 0) { words += numToWords(Math.floor(remaining / 10000000)) + " CRORE "; remaining %= 10000000; }
  if (Math.floor(remaining / 100000) > 0) { words += numToWords(Math.floor(remaining / 100000)) + " LAKH "; remaining %= 100000; }
  if (Math.floor(remaining / 1000) > 0) { words += numToWords(Math.floor(remaining / 1000)) + " THOUSAND "; remaining %= 1000; }
  if (Math.floor(remaining / 100) > 0) { words += numToWords(Math.floor(remaining / 100)) + " HUNDRED "; remaining %= 100; }
  if (remaining > 0) words += numToWords(remaining);
  return words.trim();
}

function applyHospitalHeader(doc: jsPDF, w: number, title: string = "") {
  doc.setTextColor(0, 0, 0); doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("NEW LIFE CARE HOSPITAL", w / 2, 15, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Nandipet, Telangana | Ph: +91-XXXX-XXXXXX", w / 2, 21, { align: "center" });
  if (title) {
    doc.setDrawColor(0, 0, 0); doc.line(10, 27, w - 10, 27); doc.setFillColor(220, 220, 220);
    doc.rect(w / 2 - 35, 29, 70, 6, "F"); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(title, w / 2, 33.5, { align: "center" }); doc.line(10, 40, w - 10, 40);
  }
}

function applyHospitalHeaderlab(doc: jsPDF, w: number, title: string = "") {
  doc.setTextColor(0, 0, 0); doc.setFontSize(18); doc.setFont("helvetica", "bold");
  doc.text("Health Care Laboratory", w / 2, 15, { align: "center" });
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text("Beside Aadhya hospital, backside Nandi temple, Nandipet", w / 2, 21, { align: "center" });
  doc.text("Ph: +91-XXXX-XXXXXX", w / 2, 26, { align: "center" });
  if (title) {
    doc.setDrawColor(0, 0, 0); doc.line(10, 30, w - 10, 30); doc.setFillColor(220, 220, 220);
    doc.rect(w / 2 - 35, 32, 70, 6, "F"); doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text(title, w / 2, 36.5, { align: "center" }); doc.line(10, 42, w - 10, 42); 
  }
}

function renderServiceItemText(doc: jsPDF, text: string, x: number, y: number) {
  if (!text) return;
  const bracketMatch = text.match(/^(.*?)\s*\((.*?)\)$/);
  if (bracketMatch) {
    const mainName = bracketMatch[1].trim(); const subPart = " : " + bracketMatch[2].trim();
    doc.setFont("helvetica", "normal"); doc.text(mainName, x, y);
    const textWidth = doc.getTextWidth(mainName);
    doc.setFont("helvetica", "bold"); doc.text(subPart, x + textWidth, y);
    return;
  }
  const splitIndex = text.indexOf(" - ");
  if (splitIndex !== -1) {
    const mainName = text.substring(0, splitIndex).trim(); const subName = " " + text.substring(splitIndex).trim(); 
    doc.setFont("helvetica", "bold"); doc.text(mainName, x, y);
    const textWidth = doc.getTextWidth(mainName);
    doc.setFont("helvetica", "normal"); doc.text(subName, x + textWidth, y);
    return;
  }
  doc.setFont("helvetica", "normal"); doc.text(text, x, y);
}

function applyBillPatientDetails(doc: jsPDF, w: number, details: any, startY: number = 52) {
  let y = startY; doc.setFontSize(10); doc.setFont("helvetica", "normal");
  doc.text("Patient Name", 15, y); doc.text(`: ${details.patientName || "N/A"}`, 50, y);
  doc.text("Patient Id", 115, y); doc.text(`: ${details.opId || "N/A"}`, 145, y); y += 6;
  doc.text("Age", 15, y); doc.text(`: ${details.age || "N/A"} Years`, 50, y);
  doc.text("Gender", 115, y); doc.text(`: ${details.gender || "N/A"}`, 145, y); y += 6;
  doc.text("Consultant Doctor", 15, y); doc.text(`: ${details.doctorName || "N/A"}`, 50, y);
  doc.text("Phone", 115, y); doc.text(`: ${details.phone || "N/A"}`, 145, y); y += 10;
  doc.text("Receipt Id", 15, y); doc.setFont("helvetica", "bold"); doc.text(`: ${details.receiptId || "N/A"}`, 50, y); doc.setFont("helvetica", "normal");
  const printDate = formatAppDate(details.date); const printTime = formatAppTime(details.time || details.date);
  doc.text("Receipt Date", 115, y); doc.text(`: ${printDate}   ${printTime}`.trim(), 145, y); y += 6;
  doc.text("Head", 15, y); doc.text(`: ${details.headCategory || "N/A"}`, 50, y); y += 10;
  doc.setDrawColor(0, 0, 0); doc.line(10, y, w - 10, y); y += 6;
  return y; 
}

// ─── MASTER PDF GENERATOR ROUTER ───
export function generateReceiptPDF(receipt: Receipt, patient?: OPRecord | IPRecord) {
  if (!receipt) return;
  const type = receipt.type?.toLowerCase() || "";
  const mockPatient = patient || {
    opId: receipt.opId, name: receipt.patientName, phone: receipt.phone,
    age: (receipt as any).age || "N/A", gender: (receipt as any).gender || "N/A", doctorName: (receipt as any).doctorName || "N/A",
    finalAmount: receipt.amount, paymentMethod: receipt.method,
  } as OPRecord;

  if (type === "medicine") {
    let itemsToRender: MedicineBillItem[] = [];
    if (receipt.itemDetails && receipt.itemDetails.length > 0) {
       itemsToRender = receipt.itemDetails.map(it => ({
           medicine: { 
             name: it.name, 
             pricePerTablet: (it.amount || 0) / (it.quantity || 1),
             batchNumber: it.batchNumber || "-",
             manufacturer: it.manufacturer || "-",
             expiryDate: it.expiryDate || "",
             schedule: it.schedule || "-"
           } as Medicine,
           quantity: it.quantity || 1
       }));
    } else {
       itemsToRender = [{ medicine: { name: receipt.details || "Medicine", pricePerTablet: receipt.amount || 0 } as Medicine, quantity: 1 }];
    }
    return generateMedicineBillPDF(mockPatient, receipt, itemsToRender, receipt.method || "CASH");
  }

  // --- ADDED "ecg" to the service bill routes ---
  if (["lab", "xray", "surgery", "treatment", "scan", "ecg"].includes(type)) {
    let itemsToRender: ServiceBillItem[] = [];
    if (receipt.itemDetails && receipt.itemDetails.length > 0) {
       itemsToRender = receipt.itemDetails.map(it => ({ name: it.name, amount: it.amount || 0, paid: it.amount || 0 }));
    } else if (receipt.details && receipt.details.includes(",")) {
       const names = receipt.details.split(",").map(n => n.trim());
       const splitAmount = receipt.amount / Math.max(1, names.length);
       itemsToRender = names.map(name => ({ name, amount: splitAmount, paid: splitAmount }));
    } else {
       itemsToRender = [{ name: receipt.details || receipt.category || "Service", amount: receipt.amount || 0, paid: receipt.amount || 0 }];
    }
    return generateServiceBillPDF(receipt.category || "Service Bill", mockPatient, receipt, itemsToRender, receipt.method || "CASH");
  }

  if (type === "ip") {
    const mockIp = (patient as any) || { ipId: receipt.opId, opId: receipt.opId, name: receipt.patientName, phone: receipt.phone, doctor: (receipt as any).doctorName || "N/A" } as IPRecord;
    return generateAdmissionPDF(mockIp, receipt);
  }

  return generatePaymentPDF(mockPatient as OPRecord, receipt);
}

// ─── Individual Generators ───

export function generateFinalBillPDF(ip: IPRecord, patientReceipts: Receipt[]) {
  if (!ip) return; const doc = new jsPDF(); const w = doc.internal.pageSize.getWidth(); const pageHeight = doc.internal.pageSize.getHeight();
  let y = 15; let pageNumber = 1;
  const addHeader = () => {
    doc.setTextColor(0, 0, 0); doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.text("NEW LIFE CARE HOSPITAL", w / 2, y, { align: "center" }); y += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("MANAGED BY NEW LIFE CARE HOSPITAL TRUST", w / 2, y, { align: "center" }); y += 4;
    doc.text("Nandipet, Telangana | Ph: +91-XXXX-XXXXXX", w / 2, y, { align: "center" }); y += 8;
    doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.text("Final Bill", w / 2, y, { align: "center" }); y += 6;
    doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); doc.line(10, y, w - 10, y); y += 6; doc.setFontSize(9);
    doc.setFont("helvetica", "bold"); doc.text("Patient Name", 12, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.name || "N/A"}`, 35, y);
    doc.setFont("helvetica", "bold"); doc.text("IP No", 110, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.ipId || "N/A"}`, 145, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.text("Age/Gender", 12, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.age || "N/A"} Y / ${ip.gender || "N/A"}`, 35, y);
    doc.setFont("helvetica", "bold"); doc.text("OP No", 110, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.opId || "N/A"}`, 145, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.text("Mobile No", 12, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.phone || "N/A"}`, 35, y);
    doc.setFont("helvetica", "bold"); doc.text("Bill No", 110, y); doc.setFont("helvetica", "normal"); doc.text(`: FB-${ip.ipId || "N/A"}`, 145, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.text("Doctor", 12, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.doctor || "N/A"}`, 35, y);
    doc.setFont("helvetica", "bold"); doc.text("Admission Date", 110, y); doc.setFont("helvetica", "normal"); doc.text(`: ${formatAppDate(ip.dateOfAdmission)} ${formatAppTime(ip.dateOfAdmission)}`.trim(), 145, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.text("Department", 12, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.department || "General"}`, 35, y);
    doc.setFont("helvetica", "bold"); const dDate = ip.dateOfDischarge || new Date(); doc.text("Discharge Date", 110, y); doc.setFont("helvetica", "normal"); doc.text(`: ${formatAppDate(dDate)} ${formatAppTime(dDate)}`.trim(), 145, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.text("Ward/Bed No", 12, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.room || "-"} / ${ip.bed || "-"}`, 35, y); y += 6;
    doc.line(10, y, w - 10, y); y += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.text("Date & Time", 12, y); doc.text("Description", 45, y); doc.text("Rate", 140, y); doc.text("Qty", 160, y); doc.text("Amount", 195, y, { align: "right" }); y += 3;
    doc.line(10, y, w - 10, y); y += 6;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > pageHeight - 20) {
      doc.setFontSize(8); doc.text(`Page ${pageNumber}`, w / 2, pageHeight - 10, { align: "center" }); doc.addPage(); pageNumber++; y = 15; addHeader();
    }
  };

  addHeader(); 
  
  // CRITICAL FIX: Explicitly parse boundaries to ensure only receipts between admission and discharge are included
  const admissionTimestamp = new Date(ip.dateOfAdmission).getTime();
  const dischargeTimestamp = ip.dateOfDischarge ? new Date(ip.dateOfDischarge).getTime() : Infinity;

  // Filter IP Advances
  const advances = (patientReceipts || []).filter(r => {
    if (r.type !== "ip") return false; 
    let recTimestamp = new Date(r.date).getTime();
    if (r.time && typeof r.time === 'string' && typeof r.date === 'string' && !r.date.includes('T')) {
       const combined = new Date(`${r.date} ${r.time}`); 
       if (!isNaN(combined.getTime())) recTimestamp = combined.getTime();
    }
    // Block advances generated after the discharge
    if (dischargeTimestamp !== Infinity && !isNaN(recTimestamp) && recTimestamp > dischargeTimestamp) return false;
    // Block advances generated long before admission (Allow 24 hr buffer for early admission deposits)
    if (!isNaN(admissionTimestamp) && !isNaN(recTimestamp) && recTimestamp < (admissionTimestamp - 86400000)) return false; 
    return true;
  });

  // Filter regular billed receipts (Services, Meds, Labs)
  const billedReceipts = (patientReceipts || []).filter(r => {
    if (r.type === "ip" || r.type === "op") return false; 
    let recTimestamp = new Date(r.date).getTime();
    if (r.time && typeof r.time === 'string' && typeof r.date === 'string' && !r.date.includes('T')) {
       const combined = new Date(`${r.date} ${r.time}`); 
       if (!isNaN(combined.getTime())) recTimestamp = combined.getTime();
    }
    // Strict block: Cannot be before admission
    if (!isNaN(admissionTimestamp) && !isNaN(recTimestamp) && recTimestamp < admissionTimestamp) return false;
    // Strict block: Cannot be after discharge
    if (dischargeTimestamp !== Infinity && !isNaN(recTimestamp) && recTimestamp > dischargeTimestamp) return false;
    return true;
  });

  const groups = [ { title: "SERVICES & TREATMENTS", types: ["treatment", "surgery", "payment"] }, { title: "INVESTIGATIONS", types: ["lab", "xray", "scan"] }, { title: "PHARMACY", types: ["medicine"] } ];
  let grossTotal = 0;

  groups.forEach(group => {
    const groupReceipts = billedReceipts.filter(r => group.types.includes(r.type)); if (groupReceipts.length === 0) return;
    checkPageBreak(15); doc.setFont("helvetica", "bold"); doc.text(group.title, 12, y); y += 5; doc.setFont("helvetica", "normal");
    let groupTotal = 0;
    groupReceipts.forEach(rec => {
      const formattedDT = `${formatAppDate(rec.date)} ${formatAppTime(rec.time || rec.date)}`.trim();
      if (rec.itemDetails && rec.itemDetails.length > 0) {
        rec.itemDetails.forEach(item => {
          checkPageBreak(8); doc.text(formattedDT, 12, y); const lines = doc.splitTextToSize(item.name || "", 85); doc.text(lines, 45, y);
          const rate = (item.amount || 0) / (item.quantity || 1); doc.text(rate.toFixed(2), 140, y); doc.text(String(item.quantity || 1), 160, y); doc.text((item.amount || 0).toFixed(2), 195, y, { align: "right" });
          groupTotal += (item.amount || 0); y += (lines.length * 4);
        });
      } else {
        checkPageBreak(8); doc.text(formattedDT, 12, y); const desc = rec.details || rec.category || "Service"; const lines = doc.splitTextToSize(desc, 85); doc.text(lines, 45, y);
        doc.text((rec.amount || 0).toFixed(2), 140, y); doc.text("1", 160, y); doc.text((rec.amount || 0).toFixed(2), 195, y, { align: "right" }); groupTotal += (rec.amount || 0); y += (lines.length * 4);
      }
    });
    checkPageBreak(10); y += 2; doc.setFont("helvetica", "bold"); doc.text(`${group.title} TOTAL:`, 140, y, { align: "right" }); doc.text(groupTotal.toFixed(2), 195, y, { align: "right" }); grossTotal += groupTotal; y += 8;
  });

  checkPageBreak(60); doc.setDrawColor(0, 0, 0); doc.line(10, y, w - 10, y); y += 6;
  const advanceTotal = advances.reduce((sum, r) => sum + (r.amount || 0), 0); const netPayable = Math.max(0, grossTotal - advanceTotal); const currentBalance = grossTotal - advanceTotal;

  doc.setFont("helvetica", "bold"); doc.text("Rupees in words:", 12, y); doc.setFont("helvetica", "normal");
  const words = `${amountToWords(netPayable > 0 ? netPayable : grossTotal)} RUPEES ONLY`; const splitWords = doc.splitTextToSize(words, 100); doc.text(splitWords, 45, y);
  doc.setFont("helvetica", "bold"); doc.text("Gross Total", 130, y); doc.text(":", 160, y); doc.text(grossTotal.toFixed(2), 195, y, { align: "right" }); y += 5;
  doc.text("Less Discount", 130, y); doc.text(":", 160, y); doc.text("0.00", 195, y, { align: "right" }); y += 5;
  doc.text("Total GST", 130, y); doc.text(":", 160, y); doc.text("0.00", 195, y, { align: "right" }); y += 5;
  doc.line(130, y, 195, y); y += 4; doc.text("Net Bill Amount", 130, y); doc.text(":", 160, y); doc.text(grossTotal.toFixed(2), 195, y, { align: "right" }); y += 5;
  doc.text("Less Advance", 130, y); doc.text(":", 160, y); doc.text(advanceTotal.toFixed(2), 195, y, { align: "right" }); y += 5;
  doc.line(130, y, 195, y); y += 4; doc.text("Net Payable", 130, y); doc.text(":", 160, y); doc.text(netPayable.toFixed(2), 195, y, { align: "right" }); y += 5;
  doc.text("Current Balance", 130, y); doc.text(":", 160, y); doc.text(currentBalance.toFixed(2), 195, y, { align: "right" }); y += 10;

  if (advances.length > 0) {
    doc.setFont("helvetica", "bold"); doc.text("Receipt Details (Advances)", 12, y); y += 5;
    doc.setFontSize(7); doc.text("SNo", 12, y); doc.text("Date & Time", 20, y); doc.text("Receipt No", 55, y); doc.text("Amount", 85, y); doc.text("Mode", 105, y); y += 4; doc.setFont("helvetica", "normal");
    advances.forEach((adv, i) => {
      doc.text(String(i + 1), 12, y); doc.text(`${formatAppDate(adv.date)} ${formatAppTime(adv.time || adv.date)}`.trim(), 20, y);
      doc.text(adv.receiptId || adv.id || "N/A", 55, y); doc.text((adv.amount || 0).toFixed(2), 85, y); doc.text(adv.method || "N/A", 105, y); y += 4;
    });
    doc.setFont("helvetica", "bold"); doc.text(`Sub Total: ${advanceTotal.toFixed(2)}`, 85, y); y += 10;
  }
  checkPageBreak(30); y = Math.max(y, pageHeight - 35); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("Patient/Attendant Signatory", 12, y); doc.text("Prepared By: ADMIN", w - 15, y, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text(`Page ${pageNumber} of ${pageNumber}`, w / 2, pageHeight - 10, { align: "center" });
  outputPDF(doc, `${ip.ipId || "Patient"}_Final_Discharge_Bill.pdf`);
}

export function generateOPRegistrationPDF(record: OPRecord) {
  if (!record) return; const doc = new jsPDF(); const w = doc.internal.pageSize.getWidth(); const h = doc.internal.pageSize.getHeight();
  applyHospitalHeader(doc, w, "OPD CARD"); doc.setTextColor(0, 0, 0); doc.setFontSize(10); let y = 52; 
  doc.setFont("helvetica", "bold"); doc.text(`CR No.: ${record.opId || "N/A"}`, 15, y);
  const printDate = formatAppDate(record.date || new Date()); const printTime = formatAppTime(record.date || new Date());
  doc.text(`Date: ${printDate}  ${printTime}`.trim(), w - 15, y, { align: "right" });
  const opDate = record.date ? new Date(record.date) : new Date(); const validTill = new Date(opDate); validTill.setDate(validTill.getDate() + 15);
  y += 5; doc.setFontSize(9); doc.setTextColor(100, 100, 100); doc.text(`Valid Till: ${formatAppDate(validTill)}`, w - 15, y, { align: "right" }); doc.setTextColor(0, 0, 0); 
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); y += 4; doc.line(10, y, w - 10, y); doc.setFontSize(9); y += 8;
  const leftFields = [ ["Patient Name", record.name || "N/A"], ["Age/Sex", `${record.age || "N/A"} Yr / ${record.gender || "N/A"}`], ["Phone", record.phone || "N/A"], ["Village", record.village || "N/A"] ];
  const rightFields: string[][] = [ ["Doctor", record.doctorName || "N/A"], ["Department", "General"], ["Consultation Fee", `Rs. ${record.consultationFee || 0}`], ["Payment", (record.paymentMethod || "Cash").toUpperCase()] ];
  if (record.transactionId) rightFields.push(["Transaction ID", record.transactionId]);
  const startY = y; leftFields.forEach(([label, value]) => { doc.setFont("helvetica", "bold"); doc.text(`${label}:`, 15, y); doc.setFont("helvetica", "normal"); doc.text(String(value), 55, y); y += 6; });
  y = startY; rightFields.forEach(([label, value]) => { doc.setFont("helvetica", "bold"); doc.text(`${label}:`, 115, y); doc.setFont("helvetica", "normal"); doc.text(String(value), 160, y); y += 6; });
  y = startY + Math.max(leftFields.length, rightFields.length) * 6 + 4; doc.setDrawColor(0, 0, 0); doc.line(10, y, w - 10, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Vitals:", 15, y);
  if (record.vitals) { doc.setFont("helvetica", "normal"); doc.text(`BP: ${record.vitals.bp || "-"}  |  Weight: ${record.vitals.weight || "-"}  |  Temp: ${record.vitals.temperature || "-"}`, 40, y); }
  y += 8; doc.line(10, y, w - 10, y); y += 6; doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("Rx / Prescription:", 15, y);
  doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2); for (let lineY = y + 8; lineY < h - 40; lineY += 8) { doc.line(15, lineY, w - 15, lineY); }
  const invY = h - 35; doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.5); doc.line(10, invY, w - 10, invY); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("Investigations:", 15, invY + 6);
  doc.setFontSize(7); doc.setTextColor(120, 120, 120); doc.text("This is a computer-generated OPD card.", w / 2, h - 10, { align: "center" });
  outputPDF(doc, `${record.opId || "Patient"}_OPD_Card.pdf`);
}

export function generatePaymentPDF(record: OPRecord, receipt: Receipt) {
  if (!record || !receipt) return; const doc = new jsPDF(); const w = doc.internal.pageSize.getWidth();
  applyHospitalHeader(doc, w, "Payment Receipt"); const finalAmt = record.finalAmount || receipt.amount || 0;
  let y = applyBillPatientDetails(doc, w, { patientName: record?.name || receipt?.patientName || "N/A", opId: record?.opId || receipt?.opId || "N/A", age: record?.age || "N/A", gender: record?.gender || "N/A", doctorName: record?.doctorName || "N/A", phone: record?.phone || receipt?.phone || "N/A", receiptId: receipt?.receiptId || receipt?.id || "N/A", date: receipt?.date || record?.date || new Date().toISOString(), time: receipt?.time || receipt?.date || record?.date || new Date().toISOString(), headCategory: "OP Consultation" }, 52);
  doc.setFillColor(240, 240, 240); doc.rect(15, y - 5, w - 30, 10, "F"); doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.text("SERVICE ITEM", 20, y); doc.text("AMOUNT", 160, y); y += 10;
  renderServiceItemText(doc, "OP Consultation", 20, y); doc.setFont("helvetica", "normal"); doc.text(`Rs. ${(finalAmt).toFixed(2)}`, 160, y); y += 8; doc.setDrawColor(0, 0, 0); doc.line(15, y, w - 15, y); y += 8;
  doc.setFont("helvetica", "bold"); doc.text("TOTAL", 20, y); doc.text(`Rs. ${(finalAmt).toFixed(2)}`, 160, y); y += 15; doc.setFont("helvetica", "normal"); const payMethod = record.paymentMethod || receipt.method || "Cash";
  doc.text(`Payment Method: ${payMethod.toUpperCase()}`, 20, y); if (record.transactionId) { y += 6; doc.text(`Transaction ID: ${record.transactionId}`, 20, y); } doc.text("Status: PAID", w - 20, y, { align: "right" });
  outputPDF(doc, `${record.opId || receipt.opId || "Patient"}_Payment.pdf`);
}

export function generateAdmissionPDF(ip: IPRecord, receipt: Receipt) {
  if (!ip || !receipt) return; const doc = new jsPDF(); const w = doc.internal.pageSize.getWidth(); applyHospitalHeader(doc, w);
  const recId = receipt?.receiptId || receipt?.id || "N/A"; const paymentType = receipt?.method?.toUpperCase() || "CASH";
  let y = 36; doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text("Advance Money Receipt", w / 2, y, { align: "center" }); y += 4; doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.3); doc.line(10, y, w - 10, y); y += 6; doc.setFontSize(9);
  const leftStart = 15; const leftColon = 45; const rightStart = 115; const rightColon = 145;
  doc.setFont("helvetica", "bold"); doc.text("IP No", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.ipId || "N/A"}`, leftColon, y); doc.setFont("helvetica", "bold"); doc.text("Doctor", rightStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.doctor || "N/A"}`, rightColon, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("OP No", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.opId || "N/A"}`, leftColon, y); doc.setFont("helvetica", "bold"); doc.text("Trans Type", rightStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.admissionType || "N/A"}`, rightColon, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Name", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.name || "N/A"}`, leftColon, y); doc.setFont("helvetica", "bold"); doc.text("Receipt No", rightStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${recId}`, rightColon, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Age/Gender", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.age || "N/A"} Y / ${ip.gender || "N/A"}`, leftColon, y); doc.setFont("helvetica", "bold"); doc.text("Receipt Date", rightStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${formatAppDate(ip.dateOfAdmission || receipt?.date)}  ${formatAppTime(receipt?.time || new Date().toISOString())}`.trim(), rightColon, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Phone/Village", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.phone || "N/A"} / ${ip.village || "N/A"}`, leftColon, y); doc.setFont("helvetica", "bold"); doc.text("Bed No", rightStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.room || "N/A"} ${ip.bed ? ' - ' + ip.bed : ''}`, rightColon, y); y += 4; doc.line(10, y, w - 10, y); y += 5;
  const actualAmount = receipt?.amount || ip.admissionCharges || 0; doc.setFont("helvetica", "bold"); doc.text("IP Advance", leftStart, y); doc.text(`Amount of Rs. ${actualAmount}/-`, w / 2, y, { align: "center" }); y += 3; doc.line(10, y, w - 10, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Payment Type", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${paymentType}`, leftColon, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Amount", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${(actualAmount).toFixed(2)}`, leftColon, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Amount In Words", leftStart, y); doc.setFont("helvetica", "normal"); const words = `RUPEES ${amountToWords(actualAmount)} ONLY`; const splitWords = doc.splitTextToSize(`: ${words}`, w - leftColon - 10); doc.text(splitWords, leftColon, y); y += (splitWords.length * 5) + 3;
  doc.setFont("helvetica", "bold"); doc.text("Diagnosis", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.diagnosis || ip.disease || "N/A"}`, leftColon, y); y += 6;
  doc.setFont("helvetica", "bold"); doc.text("Management", leftStart, y); doc.setFont("helvetica", "normal"); doc.text(`: ${ip.management || "N/A"}`, leftColon, y); y += 6;
  if (ip.notes) { doc.setFont("helvetica", "bold"); doc.text("Notes", leftStart, y); doc.setFont("helvetica", "normal"); const splitNotes = doc.splitTextToSize(`: ${ip.notes}`, w - leftColon - 10); doc.text(splitNotes, leftColon, y); y += (splitNotes.length * 5); }
  y += 20; doc.setFont("helvetica", "bold"); doc.text("Created By : ADMIN", leftStart, y); const now = new Date(); const printStr = `${formatAppDate(now)}  ${formatAppTime(now)}`; doc.text(`Bill Date & Time : ${printStr}`, w / 2, y, { align: "center" }); y += 6; doc.text(`Print Date & Time : ${printStr}`, w / 2, y, { align: "center" }); doc.setFont("helvetica", "normal"); doc.text("Authorised Signatory", w - 15, y, { align: "right" }); doc.setLineWidth(0.2); doc.line(w - 55, y - 4, w - 15, y - 4);
  outputPDF(doc, `${ip.ipId || "Patient"}_Advance_Receipt.pdf`);
}

export function generateMedicineBillPDF(patient: OPRecord | IPRecord | undefined, receipt: Receipt, items: MedicineBillItem[], paymentMethod: string) {
  if (!receipt) return; const doc = new jsPDF(); const w = doc.internal.pageSize.getWidth(); applyHospitalHeader(doc, w, "Pharmacy Bill");
  let y = applyBillPatientDetails(doc, w, { patientName: patient?.name || receipt?.patientName || "N/A", opId: patient?.opId || receipt?.opId || "N/A", age: patient?.age || "N/A", gender: patient?.gender || "N/A", doctorName: (patient as any)?.doctorName || (patient as any)?.doctor || "N/A", phone: patient?.phone || receipt?.phone || "N/A", receiptId: receipt?.receiptId || receipt?.id || "N/A", date: receipt?.date || new Date().toISOString(), time: receipt?.time || receipt?.date || new Date().toISOString(), headCategory: "Pharmacy Bill" }, 52);
  doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2); y += 2; doc.line(10, y, w - 10, y); y += 5; doc.setFont("helvetica", "bold"); doc.setFontSize(8); 
  doc.text("S.NO", 12, y); doc.text("PRODUCT NAME", 22, y); doc.text("SCH", 80, y); doc.text("MFG", 95, y); doc.text("BATCH", 115, y); doc.text("EXPIRY", 140, y); doc.text("QTY", 165, y); doc.text("RATE", 180, y); doc.text("AMOUNT", 200, y, { align: "right" }); y += 3; doc.line(10, y, w - 10, y); y += 6;
  let total = 0; doc.setFont("helvetica", "normal"); 
  let itemsToRender = items && items.length > 0 ? items : [];
  if (itemsToRender.length === 0 && receipt.itemDetails && receipt.itemDetails.length > 0) {
      itemsToRender = receipt.itemDetails.map(it => ({
          medicine: { name: it.name, pricePerTablet: (it.amount || 0) / (it.quantity || 1) } as Medicine, quantity: it.quantity || 1
      }));
  } else if (itemsToRender.length === 0) {
      itemsToRender = [{ medicine: { name: receipt.details || "Medicine", pricePerTablet: receipt.amount || 0 } as Medicine, quantity: 1 }];
  }

  itemsToRender.forEach((item, index) => {
    const amt = (item.quantity || 0) * (item.medicine?.pricePerTablet || 0); total += amt; doc.text(String(index + 1), 12, y);
    const nameLines = doc.splitTextToSize(item.medicine?.name || "Unknown", 55); doc.text(nameLines, 22, y);
    
    // CRITICAL FIX: Safe mapping so missing fields print as "-" instead of blanks
    doc.text((item.medicine as any)?.schedule || "-", 80, y);
    const mfg = (item.medicine as any)?.manufacturer || "-"; doc.text(mfg.length > 10 ? mfg.substring(0, 8) + ".." : mfg, 95, y);
    doc.text((item.medicine as any)?.batchNumber || "-", 115, y);
    const exp = (item.medicine as any)?.expiryDate; doc.text(exp ? formatAppDate(exp) : "-", 140, y);
    
    doc.text(String(item.quantity || 0), 165, y); doc.text((item.medicine?.pricePerTablet || 0).toFixed(2), 180, y); doc.text(amt.toFixed(2), 200, y, { align: "right" }); y += (nameLines.length * 4) + 2; 
  });

  y += 2; doc.line(10, y, w - 10, y); y += 6; doc.setFont("helvetica", "bold"); doc.text("TOTAL", 22, y); doc.text(total.toFixed(2), 200, y, { align: "right" }); y += 12; doc.setFont("helvetica", "normal"); doc.text(`Payment: ${(paymentMethod || "Cash").toUpperCase()}`, 12, y);
  outputPDF(doc, `${patient?.opId || receipt?.opId || "Patient"}_PharmacyBill.pdf`);
}

export function generateServiceBillPDF(title: string, patient: OPRecord | IPRecord | undefined, receipt: Receipt, items: ServiceBillItem[], paymentMethod: string) {
  if (!receipt) return; const doc = new jsPDF(); const w = doc.internal.pageSize.getWidth(); const h = doc.internal.pageSize.getHeight();
  const isLabBill = title.toLowerCase().includes("lab");
  if (isLabBill) { applyHospitalHeaderlab(doc, w, title || "Service Bill"); } else { applyHospitalHeader(doc, w, title || "Service Bill"); }
  let y = applyBillPatientDetails(doc, w, { patientName: patient?.name || receipt?.patientName || "N/A", opId: patient?.opId || receipt?.opId || "N/A", age: patient?.age || "N/A", gender: patient?.gender || "N/A", doctorName: (patient as any)?.doctorName || (patient as any)?.doctor || "N/A", phone: patient?.phone || receipt?.phone || "N/A", receiptId: receipt?.receiptId || receipt?.id || "N/A", date: receipt?.date || new Date().toISOString(), time: receipt?.time || receipt?.date || new Date().toISOString(), headCategory: title || "Service" }, 52); 
  doc.setFillColor(220, 220, 220); doc.rect(15, y - 5, w - 30, 10, "F"); doc.setFont("helvetica", "bold"); doc.text("SERVICE ITEM", 20, y); doc.text("BILLED AMOUNT", 100, y); doc.text("AMOUNT PAID", 140, y); doc.text("BALANCE", 178, y); y += 10;
  let totalBilled = 0; let totalPaid = 0; let itemsToRender = items && items.length > 0 ? items : [];
  if (itemsToRender.length === 0) {
     if (receipt.details && receipt.details.includes(",")) { const names = receipt.details.split(",").map(n => n.trim()); const splitAmount = receipt.amount / names.length; itemsToRender = names.map(name => ({ name: name, amount: splitAmount, paid: splitAmount })); } else { itemsToRender = [{ name: receipt.details || receipt.category || "Service", amount: receipt.amount || 0, paid: receipt.amount || 0 }]; }
  }
  itemsToRender.forEach((item) => { const amount = item.amount || 0; const paid = item.paid || 0; const balance = amount - paid; totalBilled += amount; totalPaid += paid; renderServiceItemText(doc, item.name || "Service", 20, y); doc.setFont("helvetica", "normal"); doc.text(`Rs. ${amount.toFixed(2)}`, 100, y); doc.text(`Rs. ${paid.toFixed(2)}`, 140, y); doc.text(`Rs. ${balance.toFixed(2)}`, 178, y); y += 8; });
  doc.line(15, y, w - 15, y); y += 8; doc.setFont("helvetica", "bold"); doc.text("TOTAL", 20, y); doc.text(`Rs. ${totalBilled.toFixed(2)}`, 100, y); doc.text(`Rs. ${totalPaid.toFixed(2)}`, 140, y); doc.text(`Rs. ${(totalBilled - totalPaid).toFixed(2)}`, 178, y); y += 12; doc.setFont("helvetica", "normal"); doc.text(`Payment: ${(paymentMethod || "Cash").toUpperCase()}`, 20, y);
  if (isLabBill) { y += 15; const printDate = formatAppDate(receipt?.date || new Date().toISOString()); const printTime = formatAppTime(receipt?.time || receipt?.date || new Date().toISOString()); doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text(`1. Issued Date : ${printDate}`, 15, y); doc.text(`2. Issued Time : ${printTime}`, 15, y + 6); doc.setDrawColor(0, 0, 0); doc.setLineWidth(0.2); doc.line(w - 60, y, w - 15, y); doc.setFont("helvetica", "bold"); doc.text("Name : SK Salman (DMLT)", w - 15, y + 6, { align: "right" }); }
  const safeTitle = title ? title.replace(/\s/g, "_") : "Service_Bill"; outputPDF(doc, `${patient?.opId || receipt?.opId || "Patient"}_${safeTitle}.pdf`);
}