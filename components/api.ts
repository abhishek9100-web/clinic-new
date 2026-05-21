// --- Interfaces ---
export interface Doctor { id?: string; customId?: string; name: string; specialization: string; fee: number; phone: string; available: boolean; }
export interface Medicine {
  id?: string; customId?: string; name: string; schedule: string; batchNumber: string;
  pricePerTablet: number; tabletsPerSheet: number; sheetsPerPack: number; category: string;
  manufacturer: string; expiryDate: string | Date; stockQuantity: number; description: string;
  pack?: string; hsn?: string; mrp?: number; gst?: number; dis?: number; amt?: number; free?: number;
}
export interface OPRecord { opId: string; name: string; age: string; gender: string; phone: string; village: string; doctorId: string; doctorName: string; consultationFee: number; finalAmount: number; paymentMethod: string; transactionId?: string; date: string | Date; status: "waiting" | "in-consultation" | "completed"; vitals?: { bp: string; weight: string; temperature: string }; referredByRmpId?: string; referredByRmpName?: string; isAdmitted?: boolean; }
export interface XRayService { id?: string; customId?: string; name: string; bodyPart: string; amount: number; description: string; }
export interface XRayOrder { id?: string; orderId?: string; opId: string; patientName: string; phone: string; serviceIds: string[]; serviceNames: string[]; amount: number; referredBy?: string; date: string | Date; status: "pending" | "completed"; paymentMethod: string; }
export interface ECGService { id?: string; customId?: string; name: string; bodyPart: string; amount: number; description: string; }
export interface ECGOrder { id?: string; orderId?: string; opId: string; patientName: string; phone: string; serviceIds: string[]; serviceNames: string[]; amount: number; referredBy?: string; date: string | Date; status: "pending" | "completed"; paymentMethod: string; }
export interface LabService { id?: string; customId?: string; name: string; category: string; amount: number; description: string; }
export interface LabOrder { id?: string; orderId?: string; opId: string; patientName: string; phone: string; serviceIds: string[]; serviceNames: string[]; amount: number; referredBy?: string; date: string | Date; status: "pending" | "completed"; paymentMethod: string; }
export interface OtherService { id?: string; customId?: string; name: string; category: string; amount: number; description: string; }
export interface OtherOrder { id?: string; orderId?: string; opId: string; patientName: string; phone: string; serviceIds: string[]; serviceNames: string[]; amount: number; referredBy?: string; date: string | Date; status: "pending" | "completed"; paymentMethod: string; }
export interface Receipt {
  id?: string; receiptId?: string; opId: string; patientName: string; phone: string;
  age?: string; gender?: string; doctorName?: string;
  type: "op" | "payment" | "medicine" | "xray" | "ecg" | "treatment" | "surgery" | "ip" | "scan" | "lab" | "other";
  category: string; amount: number; method: string; date: string | Date; time: string;
  details?: string;
  itemDetails?: { name: string; quantity?: number; amount: number; batchNumber?: string; manufacturer?: string; expiryDate?: string | Date; schedule?: string; }[];
}
export interface RMP { id?: string; customId?: string; name: string; phone: string; specialization: string; clinicName: string; address: string; discountPercent: number; }
export interface TreatmentEntry { id?: string; date: string | Date; time: string; type: string; description: string; notes: string; administeredBy: string; }
export interface IPRecord { ipId: string; opId: string; name: string; age: string; gender: string; phone: string; village: string; room: string; bed: string; doctor: string; disease: string; department: string; admissionType: "General Admission" | "Surgical Admission"; management: "Medical Management" | "Surgical Management"; admissionCharges: number; dateOfAdmission: string | Date; dateOfDischarge: string | Date; diagnosis: string; type: "Full Treatment" | "Doses Only"; admitted?: string; status: "critical" | "stable" | "recovering" | "discharged"; treatments: TreatmentEntry[]; notes: string; }
export interface SurgeryRecord { id: string; ipId: string; patientName: string; phone: string; surgery: string; surgeon: string; date: string | Date; preOpNotes?: string; status: "scheduled" | "completed" | "cancelled"; }

// ─── Lab Report interfaces ────────────────────────────────────────────────────

export interface LabReportRow {
  investigation: string;
  value:         string;
  unit:          string;
  normalValue:   string;
}

export interface LabReportSection {
  sectionTitle:  string;
  sectionType:   "table" | "freetext";
  rows?:         LabReportRow[];
  freeTextRows?: string[];
  method?:       string;
}

export interface LabReportRecord {
  _id?:        string;
  reportId:    string;
  orderId:     string;
  opId:        string;
  serialNo:    number;
  patientName: string;
  phone:       string;
  age:         string;
  gender:      string;
  village:     string;
  doctorName:  string;
  reportDate:  string;
  reportType:  string;
  sections:    LabReportSection[];
  status:      "pending" | "completed";
  filledBy:    string;
  filledAt:    string | null;
  createdAt?:  string;
  updatedAt?:  string;
}

// =========================================================================
// LAB TEMPLATE MAP
// Used inside createLabOrder to derive a reportType key from a service name.
// Keeps this file self-contained — no import from labReportPdfGenerator needed.
// =========================================================================

const LAB_REPORT_TYPE_MAP: Record<string, string> = {
  // Full display name → reportType key
  "renal function test":                      "RFT",
  "rft":                                       "RFT",
  "serum uric acid":                           "SERUM_URIC_ACID",
  "total serum bilirubin":                     "TOTAL_BILIRUBIN",
  "total bilirubin":                           "TOTAL_BILIRUBIN",
  "serum creatinine":                          "SERUM_CREATININE",
  "rheumatoid factor":                         "RA_FACTOR",
  "ra factor":                                 "RA_FACTOR",
  "aso titer":                                 "ASO_TITER",
  "aso":                                       "ASO_TITER",
  "widal":                                     "WIDAL",
  "widal test":                                "WIDAL",
  "malaria":                                   "MALARIA",
  "malaria parasite":                          "MALARIA",
  "malaria parasite (ict)":                    "MALARIA",
  "complete blood picture":                    "CBC",
  "cbc":                                       "CBC",
  "haemogram":                                 "CBC",
  "hemogram":                                  "CBC",
  "differential count":                        "DIFF_COUNT",
  "blood group":                               "BLOOD_GROUP",
  "blood grouping":                            "BLOOD_GROUP",
  "blood group & rh typing":                   "BLOOD_GROUP",
  "blood for grouping and rh (d) typing":      "BLOOD_GROUP",
  "bleeding time":                             "BT_CT",
  "clotting time":                             "BT_CT",
  "bleeding time & clotting time":             "BT_CT",
  "bt/ct":                                     "BT_CT",
  "ogtt":                                      "OGTT",
  "oral glucose tolerance test":               "OGTT",
  "random blood sugar":                        "RBS",
  "rbs":                                       "RBS",
  "serum calcium":                             "CALCIUM",
  "calcium":                                   "CALCIUM",
  "surgical profile":                          "SURGICAL_PROFILE",
  "liver function test":                       "LFT",
  "lft":                                       "LFT",
  "thyroid":                                   "TSH",
  "tsh":                                       "TSH",
  "thyroid function test":                     "TSH",
  "thyroid stimulating hormone":               "TSH",
  "dengue":                                    "DENGUE",
  "dengue ns1":                                "DENGUE",
  "dengue ns1 antigen":                        "DENGUE",
  "typhidot":                                  "TYPHIDOT",
  "typhoid":                                   "TYPHIDOT",
  "hba1c":                                     "HBA1C",
  "glycated haemoglobin":                      "HBA1C",
  "urine routine":                             "URINE_ROUTINE",
  "urine routine examination":                 "URINE_ROUTINE",
  "urine":                                     "URINE_ROUTINE",
  "mp":                                        "MALARIA",
  "malaria parasite (mp)":                     "MALARIA",
  "widal & mp":                                "WIDAL",   // handled as WIDAL; MP gets its own separate record
  "fasting blood sugar":                       "RBS",
  "fbs":                                       "RBS",
  "blood sugar":                               "RBS",
};

/**
 * Derive a reportType key from a lab service name.
 * Falls back to an uppercased, underscored version of the name.
 */
function deriveReportType(serviceName: string): string {
  const key = serviceName.trim().toLowerCase();
  return LAB_REPORT_TYPE_MAP[key] || serviceName.trim().toUpperCase().replace(/[\s/()]+/g, "_");
}

// =========================================================================
// API HELPER
// =========================================================================

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("medcare_token") : null;
  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error: ${res.statusText}`);
  return data;
}


// =========================================================================
// SEQUENTIAL ID GENERATORS
// =========================================================================

function parseIdNumber(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function pad5(n: number): string {
  return String(n).padStart(5, "0");
}

export async function getLatestOpId(): Promise<string> {
  try {
    const ops = await getOPRecords();
    if (!ops || ops.length === 0) return "OP-00001";
    const maxNum = ops.reduce((max, r) => { const n = parseIdNumber(r.opId || ""); return n > max ? n : max; }, 0);
    return `OP-${pad5(maxNum + 1)}`;
  } catch { return `OP-${pad5(Math.floor(1 + Math.random() * 99999))}`; }
}

export async function getLatestReceiptId(): Promise<string> {
  try {
    const receipts = await getReceipts();
    if (!receipts || receipts.length === 0) return "REC-00001";
    const maxNum = receipts.reduce((max, r) => { const n = parseIdNumber(r.id || r.receiptId || ""); return n > max ? n : max; }, 0);
    return `REC-${pad5(maxNum + 1)}`;
  } catch { return `REC-${pad5(Math.floor(1 + Math.random() * 99999))}`; }
}

export async function getLatestIpId(): Promise<string> {
  try {
    const records = await getIPRecords();
    if (!records || records.length === 0) return "IP-00001";
    const maxNum = records.reduce((max, r) => { const n = parseIdNumber(r.ipId || ""); return n > max ? n : max; }, 0);
    return `IP-${pad5(maxNum + 1)}`;
  } catch { return `IP-${pad5(Math.floor(1 + Math.random() * 99999))}`; }
}

/**
 * Generate the next sequential LabReport ID.
 * Fetches all existing lab reports and increments from the highest number found.
 */
async function getLatestLabReportId(): Promise<string> {
  try {
    const reports = await getLabReports();
    if (!reports || reports.length === 0) return "LR-00001";
    const maxNum = reports.reduce((max, r) => {
      const n = parseIdNumber(r.reportId || "");
      return n > max ? n : max;
    }, 0);
    return `LR-${pad5(maxNum + 1)}`;
  } catch {
    return `LR-${pad5(Math.floor(1 + Math.random() * 99999))}`;
  }
}


// =========================================================================
// RMP
// =========================================================================

export async function getRMPs(): Promise<RMP[]> { return apiFetch<RMP[]>("/rmps"); }
export async function addRMP(rmp: Omit<RMP, "id" | "customId">): Promise<RMP> {
  const customId = `RMP-${Date.now().toString().slice(-4)}`;
  return apiFetch<RMP>("/rmps", { method: "POST", body: JSON.stringify({ ...rmp, customId }) });
}
export async function removeRMP(customId: string): Promise<void> { await apiFetch(`/rmps/${customId}`, { method: "DELETE" }); }
export async function getRMPReferrals(rmpId: string): Promise<OPRecord[]> {
  const records = await getOPRecords();
  return records.filter((r) => r.referredByRmpId === rmpId);
}


// =========================================================================
// DOCTORS
// =========================================================================

export async function getDoctors(): Promise<Doctor[]> { return apiFetch<Doctor[]>("/doctors"); }
export async function addDoctor(doc: Omit<Doctor, "id" | "customId">): Promise<Doctor> {
  const customId = `DOC-${Date.now().toString().slice(-4)}`;
  return apiFetch<Doctor>("/doctors", { method: "POST", body: JSON.stringify({ ...doc, customId }) });
}
export async function removeDoctor(customId: string): Promise<void> { await apiFetch(`/doctors/${customId}`, { method: "DELETE" }); }


// =========================================================================
// MEDICINES
// =========================================================================

export async function getMedicines(): Promise<Medicine[]> {
  return apiFetch<Medicine[]>("/medicines");
}

export async function addMedicine(med: Omit<Medicine, "id" | "customId">): Promise<Medicine> {
  const customId = `MED-${Date.now().toString().slice(-5)}`;
  return apiFetch<Medicine>("/medicines", { method: "POST", body: JSON.stringify({ ...med, customId }) });
}

export async function addMedicines(meds: Omit<Medicine, "id" | "customId">[]): Promise<void> {
  for (const med of meds) {
    await addMedicine(med);
  }
}

export async function updateMedicine(
  id: string,
  data: Partial<Omit<Medicine, "id" | "customId">>
): Promise<Medicine> {
  return apiFetch<Medicine>(`/medicines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteMedicine(id: string): Promise<void> {
  await apiFetch(`/medicines/${id}`, { method: "DELETE" });
}

export async function decreaseMedicineStock(medicineId: string, quantity: number): Promise<void> {
  if (!medicineId || quantity <= 0) return;
  let currentStock = 0;
  try {
    const med = await apiFetch<Medicine>(`/medicines/${medicineId}`);
    currentStock = med.stockQuantity ?? 0;
  } catch {
    // best-effort
  }
  const newQuantity = Math.max(0, currentStock - quantity);
  await apiFetch(`/medicines/${medicineId}`, {
    method: "PUT",
    body: JSON.stringify({ stockQuantity: newQuantity }),
  });
}

export async function checkMedicineStock(
  medicineId: string,
  requested: number
): Promise<{ ok: boolean; available: number }> {
  try {
    const med = await apiFetch<Medicine>(`/medicines/${medicineId}`);
    const available = med.stockQuantity ?? 0;
    return { ok: available >= requested, available };
  } catch {
    return { ok: true, available: 0 };
  }
}


// =========================================================================
// OP RECORDS
// =========================================================================

export async function getOPRecords(): Promise<OPRecord[]> { return apiFetch<OPRecord[]>("/oprecords"); }

export async function createOP(
  data: Omit<OPRecord, "opId" | "date" | "status" | "isAdmitted"> & { opId?: string }
): Promise<OPRecord> {
  const finalOpId = data.opId || (await getLatestOpId());
  const now = new Date();
  const payload = { ...data, opId: finalOpId, status: "waiting", isAdmitted: false, date: now.toISOString() };
  const rec = await apiFetch<OPRecord>("/oprecords", { method: "POST", body: JSON.stringify(payload) });
  await addReceipt({
    opId: rec.opId, patientName: rec.name, phone: rec.phone, age: rec.age, gender: rec.gender,
    doctorName: rec.doctorName, type: "op", category: "OP Consultation", amount: rec.finalAmount,
    method: rec.paymentMethod, details: `Consultation fee - ${rec.doctorName}`,
  });
  return rec;
}

export async function updateOPStatus(opId: string, status: OPRecord["status"]): Promise<void> {
  await apiFetch(`/oprecords/${opId}`, { method: "PUT", body: JSON.stringify({ status }) });
}


// =========================================================================
// X-RAY
// =========================================================================

export async function getXRayServices(): Promise<XRayService[]> {
  const services = await apiFetch<any[]>("/services");
  return services.filter((s) => s.customId?.startsWith("XRS-") || s.category === "X-Ray");
}
export async function addXRayService(svc: Omit<XRayService, "id" | "customId">): Promise<XRayService> {
  const customId = `XRS-${Date.now().toString().slice(-4)}`;
  return apiFetch<XRayService>("/services", { method: "POST", body: JSON.stringify({ ...svc, category: "X-Ray", customId }) });
}
export async function updateXRayService(customId: string, data: Partial<Omit<XRayService, "id" | "customId">>): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function removeXRayService(customId: string): Promise<void> { await apiFetch(`/services/${customId}`, { method: "DELETE" }); }
export async function getXRayOrders(): Promise<XRayOrder[]> {
  const orders = await apiFetch<XRayOrder[]>("/orders");
  return orders.filter((o) => o.orderId?.startsWith("XR-"));
}
export async function createXRayOrder(data: Omit<XRayOrder, "id" | "orderId" | "date" | "status">): Promise<XRayOrder> {
  const orderId = `XR-${Date.now().toString().slice(-5)}`;
  const order = await apiFetch<XRayOrder>("/orders", { method: "POST", body: JSON.stringify({ ...data, orderId, status: "pending" }) });
  const splitAmount = data.amount / (data.serviceNames.length || 1);
  await addReceipt({ opId: data.opId, patientName: data.patientName, phone: data.phone, type: "xray", category: "X-Ray Bill", amount: data.amount, method: data.paymentMethod, details: data.serviceNames.join(", "), itemDetails: data.serviceNames.map((name) => ({ name, quantity: 1, amount: splitAmount })) });
  return order;
}
export async function updateXRayStatus(orderId: string, status: XRayOrder["status"]): Promise<void> {
  await apiFetch(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ status }) });
}


// =========================================================================
// ECG
// =========================================================================

export async function getECGServices(): Promise<ECGService[]> {
  const services = await apiFetch<any[]>("/services");
  return services.filter((s) => s.customId?.startsWith("ECGS-") || s.category === "ECG");
}
export async function addECGService(svc: Omit<ECGService, "id" | "customId">): Promise<ECGService> {
  const customId = `ECGS-${Date.now().toString().slice(-4)}`;
  return apiFetch<ECGService>("/services", { method: "POST", body: JSON.stringify({ ...svc, category: "ECG", customId }) });
}
export async function updateECGService(customId: string, data: Partial<Omit<ECGService, "id" | "customId">>): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function removeECGService(customId: string): Promise<void> { await apiFetch(`/services/${customId}`, { method: "DELETE" }); }
export async function getECGOrders(): Promise<ECGOrder[]> {
  const orders = await apiFetch<ECGOrder[]>("/orders");
  return orders.filter((o) => o.orderId?.startsWith("ECG-"));
}
export async function createECGOrder(data: Omit<ECGOrder, "id" | "orderId" | "date" | "status">): Promise<ECGOrder> {
  const orderId = `ECG-${Date.now().toString().slice(-5)}`;
  const order = await apiFetch<ECGOrder>("/orders", { method: "POST", body: JSON.stringify({ ...data, orderId, status: "pending" }) });
  const splitAmount = data.amount / (data.serviceNames.length || 1);
  await addReceipt({ opId: data.opId, patientName: data.patientName, phone: data.phone, type: "ecg", category: "ECG Bill", amount: data.amount, method: data.paymentMethod, details: data.serviceNames.join(", "), itemDetails: data.serviceNames.map((name) => ({ name, quantity: 1, amount: splitAmount })) });
  return order;
}
export async function updateECGStatus(orderId: string, status: ECGOrder["status"]): Promise<void> {
  await apiFetch(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ status }) });
}


// =========================================================================
// LAB INVESTIGATION
// =========================================================================

export async function getLabServices(): Promise<LabService[]> {
  const services = await apiFetch<any[]>("/services");
  return services.filter((s) => s.customId?.startsWith("LAB-") || (!s.customId?.startsWith("XRS-") && !s.customId?.startsWith("ECGS-") && !s.customId?.startsWith("OTH-")));
}

export async function getLabOrders(): Promise<LabOrder[]> {
  const orders = await apiFetch<LabOrder[]>("/orders");
  return orders.filter((o) => o.orderId?.startsWith("LB-") || (!o.orderId?.startsWith("XR-") && !o.orderId?.startsWith("ECG-") && !o.orderId?.startsWith("OTH-")));
}

export async function addLabService(svc: Omit<LabService, "id" | "customId">): Promise<LabService> {
  const customId = `LAB-${Date.now().toString().slice(-4)}`;
  return apiFetch<LabService>("/services", { method: "POST", body: JSON.stringify({ ...svc, customId }) });
}

export async function updateLabService(customId: string, data: Partial<Omit<LabService, "id" | "customId">>): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function removeLabService(customId: string): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: "DELETE" });
}

/**
 * createLabOrder
 *
 * 1. Creates the LabOrder record (existing behaviour — unchanged)
 * 2. Creates the billing Receipt  (existing behaviour — unchanged)
 * 3. NEW: Creates one LabReport record per service ordered (status: "pending")
 *    so the Lab Reports page immediately shows them as awaiting results.
 *
 * Report creation is fire-and-forget: if it fails for any individual test
 * the order and receipt are NOT rolled back — billing is never blocked.
 */
export async function createLabOrder(data: Omit<LabOrder, "id" | "orderId" | "date" | "status">): Promise<LabOrder> {
  // ── Step 1: Create the order ──────────────────────────────────────────────
  const orderId = `LB-${Date.now().toString().slice(-5)}`;
  const order = await apiFetch<LabOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ ...data, orderId, status: "pending" }),
  });

  // ── Step 2: Create billing receipt ───────────────────────────────────────
  const splitAmount = data.amount / (data.serviceNames.length || 1);
  await addReceipt({
    opId:        data.opId,
    patientName: data.patientName,
    phone:       data.phone,
    type:        "lab",
    category:    "Lab Investigation Bill",
    amount:      data.amount,
    method:      data.paymentMethod,
    details:     data.serviceNames.join(", "),
    itemDetails: data.serviceNames.map((name) => ({ name, quantity: 1, amount: splitAmount })),
  });

  // ── Step 3: Fetch patient snapshot for denormalised fields ────────────────
  // Best-effort — if lookup fails we still proceed with empty strings.
  let patientSnap = { age: "", gender: "", village: "", doctorName: "" };
  try {
    const pt =
      (await findPatientByPhone(data.phone)) ||
      (await findPatientByPhonePartial(data.phone));
    if (pt) {
      patientSnap = {
        age:        pt.age        || "",
        gender:     pt.gender     || "",
        village:    pt.village    || "",
        doctorName: pt.doctorName || "",
      };
    }
  } catch {
    // ignore — snapshot is optional
  }

  // ── Step 4: Create one LabReport per service (fire-and-forget) ───────────
  for (const serviceName of data.serviceNames) {
    // Each report gets its own sequential ID — we await sequentially so IDs
    // don't collide (getLatestLabReportId reads the DB each time).
    try {
      const reportId   = await getLatestLabReportId();
      const reportType = deriveReportType(serviceName);

      // Count how many reports already exist for this patient to set serialNo
      let serialNo = 1;
      try {
        const existing = await getLabReports();
        const samePatient = existing.filter(
          (r) => r.opId === data.opId || r.phone === data.phone
        );
        serialNo = samePatient.length + 1;
      } catch {
        // serialNo defaults to 1 if we can't read
      }

      await apiFetch<LabReportRecord>("/labreports", {
        method: "POST",
        body: JSON.stringify({
          reportId,
          orderId,
          opId:        data.opId        || "",
          serialNo,
          patientName: data.patientName || "",
          phone:       data.phone       || "",
          age:         patientSnap.age,
          gender:      patientSnap.gender,
          village:     patientSnap.village,
          doctorName:  patientSnap.doctorName,
          reportType,
          reportDate:  new Date().toISOString(),
          sections:    [],
          status:      "pending",
          filledBy:    "",
          filledAt:    null,
        } as Omit<LabReportRecord, "_id" | "createdAt" | "updatedAt">),
      });
    } catch (err) {
      // Log but do not block — billing must never fail because of report creation
      console.error(`[createLabOrder] Failed to create LabReport for "${serviceName}":`, err);
    }
  }

  return order;
}

export async function updateLabStatus(orderId: string, status: LabOrder["status"]): Promise<void> {
  await apiFetch(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ status }) });
}


// =========================================================================
// OTHER SERVICES
// =========================================================================

export async function getOtherServices(): Promise<OtherService[]> {
  const services = await apiFetch<any[]>("/services");
  return services.filter((s) => s.customId?.startsWith("OTH-") || s.id?.startsWith("default-"));
}
export async function addOtherService(svc: Omit<OtherService, "id" | "customId">): Promise<OtherService> {
  const customId = `OTH-${Date.now().toString().slice(-4)}`;
  return apiFetch<OtherService>("/services", { method: "POST", body: JSON.stringify({ ...svc, customId }) });
}
export async function updateOtherService(customId: string, data: Partial<Omit<OtherService, "id" | "customId">>): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function removeOtherService(customId: string): Promise<void> { await apiFetch(`/services/${customId}`, { method: "DELETE" }); }
export async function getOtherOrders(): Promise<OtherOrder[]> {
  const orders = await apiFetch<OtherOrder[]>("/orders");
  return orders.filter((o) => o.orderId?.startsWith("OTH-"));
}
export async function createOtherOrder(data: Omit<OtherOrder, "id" | "orderId" | "date" | "status">): Promise<OtherOrder> {
  const orderId = `OTH-${Date.now().toString().slice(-5)}`;
  const order = await apiFetch<OtherOrder>("/orders", { method: "POST", body: JSON.stringify({ ...data, orderId, status: "pending" }) });
  const splitAmount = data.amount / (data.serviceNames.length || 1);
  const billTitle = data.serviceNames.length === 1 ? `${data.serviceNames[0]} Bill` : data.serviceNames.length > 1 ? "Other Services Bill" : "Service Bill";
  await addReceipt({ opId: data.opId, patientName: data.patientName, phone: data.phone, type: "treatment", category: billTitle, amount: data.amount, method: data.paymentMethod, details: data.serviceNames.join(", "), itemDetails: data.serviceNames.map((name) => ({ name, quantity: 1, amount: splitAmount })) });
  return order;
}
export async function updateOtherStatus(orderId: string, status: OtherOrder["status"]): Promise<void> {
  await apiFetch(`/orders/${orderId}`, { method: "PUT", body: JSON.stringify({ status }) });
}


// =========================================================================
// IP (INPATIENT)
// =========================================================================

export async function getIPRecords(): Promise<IPRecord[]> { return apiFetch<IPRecord[]>("/iprecords"); }

export async function admitPatient(data: any): Promise<IPRecord> {
  let currentOpId = data.opId;
  if (!currentOpId) {
    const existingPatient = await findPatientByPhoneAll(data.phone);
    if (existingPatient?.opId) {
      currentOpId = existingPatient.opId;
    } else {
      const newOp = await createOP({ ...data, consultationFee: 0, finalAmount: 0, paymentMethod: "cash", doctorId: "", doctorName: data.doctor });
      currentOpId = newOp.opId;
    }
  }
  await apiFetch(`/oprecords/${currentOpId}`, { method: "PUT", body: JSON.stringify({ isAdmitted: true }) });
  const sequentialIpId = await getLatestIpId();
  const admissionDateTime = new Date().toISOString();
  const payload: IPRecord = { ...data, ipId: sequentialIpId, opId: currentOpId, status: data.status || "stable", treatments: [], dateOfAdmission: admissionDateTime };
  const rec = await apiFetch<IPRecord>("/iprecords", { method: "POST", body: JSON.stringify(payload) });
  if (data.admissionCharges > 0) {
    await addReceipt({ opId: currentOpId, patientName: data.name, phone: data.phone, age: data.age, gender: data.gender, doctorName: data.doctor, type: "ip", category: "Admission Charges", amount: data.admissionCharges, method: data.paymentMethod || "cash", details: `${data.admissionType || "Admission"} - ${data.department || "General"}` });
  }
  return rec;
}

export async function updateIPStatus(ipId: string, status: IPRecord["status"]): Promise<void> {
  await apiFetch(`/iprecords/${ipId}`, { method: "PUT", body: JSON.stringify({ status }) });
}
export async function addTreatmentEntry(ipId: string, entry: Omit<TreatmentEntry, "id" | "date" | "time">): Promise<void> {
  const ip = await apiFetch<IPRecord>(`/iprecords/${ipId}`);
  if (!ip) return;
  const now = new Date();
  const t: TreatmentEntry = { ...entry, date: now.toISOString(), time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
  await apiFetch(`/iprecords/${ipId}`, { method: "PUT", body: JSON.stringify({ treatments: [...(ip.treatments || []), t] }) });
}
export async function findIPByIpId(ipId: string): Promise<IPRecord | undefined> {
  try { return await apiFetch<IPRecord>(`/iprecords/${ipId}`); } catch { return undefined; }
}
export async function getIPRecordsByPhone(phone: string): Promise<IPRecord[]> {
  const records = await getIPRecords();
  return records.filter((r) => r.phone === phone);
}


// =========================================================================
// SURGERY
// =========================================================================

export async function getSurgeries(): Promise<SurgeryRecord[]> { return apiFetch<SurgeryRecord[]>("/surgeries"); }
export async function scheduleSurgery(data: Omit<SurgeryRecord, "id" | "status">): Promise<SurgeryRecord> {
  const id = `S-${Date.now().toString().slice(-4)}`;
  return apiFetch<SurgeryRecord>("/surgeries", { method: "POST", body: JSON.stringify({ ...data, id, status: "scheduled" }) });
}
export async function updateSurgeryStatus(id: string, status: SurgeryRecord["status"]): Promise<void> {
  await apiFetch(`/surgeries/${id}`, { method: "PUT", body: JSON.stringify({ status }) });
}
export async function getSurgeriesByPhone(phone: string): Promise<SurgeryRecord[]> {
  const surgeries = await getSurgeries();
  return surgeries.filter((r) => r.phone === phone);
}
export async function getSurgeriesByIpId(ipId: string): Promise<SurgeryRecord[]> {
  const surgeries = await getSurgeries();
  return surgeries.filter((r) => r.ipId === ipId);
}


// =========================================================================
// RECEIPTS
// =========================================================================

export async function getReceipts(): Promise<Receipt[]> { return apiFetch<Receipt[]>("/receipts"); }
export async function addReceipt(data: Omit<Receipt, "id" | "receiptId" | "date" | "time">): Promise<Receipt> {
  const now = new Date();
  const generatedId = await getLatestReceiptId();
  const payload = { ...data, id: generatedId, receiptId: generatedId, date: now.toISOString(), time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) };
  return apiFetch<Receipt>("/receipts", { method: "POST", body: JSON.stringify(payload) });
}


// =========================================================================
// LAB REPORTS
// =========================================================================

/**
 * Fetch all lab reports from the DB.
 */
export async function getLabReports(): Promise<LabReportRecord[]> {
  return apiFetch<LabReportRecord[]>("/labreports");
}

/**
 * Fetch a single lab report by its reportId.
 */
export async function getLabReportById(reportId: string): Promise<LabReportRecord | undefined> {
  try {
    return await apiFetch<LabReportRecord>(`/labreports/${reportId}`);
  } catch {
    return undefined;
  }
}

/**
 * Update a lab report (fill in sections, change status, revert to pending, etc.).
 */
export async function updateLabReport(
  reportId: string,
  payload: Partial<Omit<LabReportRecord, "_id" | "reportId" | "createdAt" | "updatedAt">>
): Promise<LabReportRecord> {
  return apiFetch<LabReportRecord>(`/labreports/${reportId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/**
 * Hard-delete a lab report.
 * The API enforces that only pending reports can be hard-deleted.
 * Completed reports must be reverted to pending via updateLabReport first
 * (within the 15-minute window).
 */
export async function deleteLabReport(reportId: string): Promise<void> {
  await apiFetch(`/labreports/${reportId}`, { method: "DELETE" });
}

/**
 * Fetch all lab reports for a specific patient (by opId or phone).
 */
export async function getLabReportsByPatient(
  opId: string,
  phone?: string
): Promise<LabReportRecord[]> {
  const all = await getLabReports();
  return all.filter(
    (r) => r.opId === opId || (phone && r.phone === phone)
  );
}

/**
 * Fetch all lab reports linked to a specific lab order.
 */
export async function getLabReportsByOrder(orderId: string): Promise<LabReportRecord[]> {
  const all = await getLabReports();
  return all.filter((r) => r.orderId === orderId);
}


// =========================================================================
// SEARCH HELPERS
// =========================================================================

export async function findPatientByPhone(phone: string): Promise<OPRecord | undefined> {
  const records = await getOPRecords();
  const matches = records.filter((r) => r.phone === phone);
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}
export async function findPatientByPhonePartial(phone: string): Promise<OPRecord | undefined> {
  if (phone.length < 4) return undefined;
  const records = await getOPRecords();
  const matches = records.filter((r) => r.phone.includes(phone));
  return matches.length > 0 ? matches[matches.length - 1] : undefined;
}
export async function findPatientsByPhone(phone: string): Promise<OPRecord[]> {
  const records = await getOPRecords();
  return records.filter((r) => r.phone.includes(phone));
}
export async function findRecordByOpId(opId: string): Promise<OPRecord | undefined> {
  try { return await apiFetch<OPRecord>(`/oprecords/${opId}`); } catch { return undefined; }
}
export async function searchPatient(query: string): Promise<OPRecord[]> {
  const q = query.toLowerCase();
  const records = await getOPRecords();
  return records.filter((r) => r.phone.includes(q) || r.opId.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
}
export async function findPatientByPhoneAll(phone: string): Promise<{ name: string; age: string; gender: string; phone: string; village: string; opId: string; doctorName?: string; date?: string | Date; } | undefined> {
  const op = (await findPatientByPhone(phone)) || (await findPatientByPhonePartial(phone));
  if (op) return { name: op.name, age: op.age, gender: op.gender, phone: op.phone, village: op.village, opId: op.opId, doctorName: op.doctorName, date: op.date };
  const ipRecords = await getIPRecords();
  const ip = ipRecords.find((r) => r.phone === phone || r.phone.includes(phone));
  if (ip) return { name: ip.name, age: ip.age, gender: ip.gender || "", phone: ip.phone, village: ip.village || "", opId: ip.opId, doctorName: ip.doctor, date: ip.dateOfAdmission };
  return undefined;
}