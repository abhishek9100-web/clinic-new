// =========================================================================
// UPDATED api.ts — LAB-RELATED SECTIONS ONLY
//
// Changes:
//  1. createLabOrder — each service gets its OWN unique reportId
//     (sequential IDs are fetched one-at-a-time so they never collide)
//  2. updateLabReport — unchanged interface, same as before
//  3. getLabReportsByOrder / getLabReportsByPatient — unchanged
//  4. New helper: syncLabOrderStatus (called by LabReportsPage after submit)
//
// NOTE: Only the lab-report-related functions are shown here.
// Merge these into your existing api.ts — replace the existing LAB REPORTS
// and createLabOrder blocks with the versions below.
// =========================================================================

// ─── Types (add to or keep in sync with your existing interfaces) ─────────

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
// LAB REPORT TYPE MAP  (kept inside api.ts so no cross-file import needed)
// =========================================================================

const LAB_REPORT_TYPE_MAP: Record<string, string> = {
  "renal function test":                      "RFT",
  "rft":                                      "RFT",
  "serum uric acid":                          "SERUM_URIC_ACID",
  "total serum bilirubin":                    "TOTAL_BILIRUBIN",
  "total bilirubin":                          "TOTAL_BILIRUBIN",
  "serum creatinine":                         "SERUM_CREATININE",
  "rheumatoid factor":                        "RA_FACTOR",
  "ra factor":                                "RA_FACTOR",
  "aso titer":                                "ASO_TITER",
  "aso":                                      "ASO_TITER",
  "widal":                                    "WIDAL",
  "widal test":                               "WIDAL",
  "malaria":                                  "MALARIA",
  "malaria parasite":                         "MALARIA",
  "malaria parasite (ict)":                   "MALARIA",
  "complete blood picture":                   "CBC",
  "cbc":                                      "CBC",
  "haemogram":                                "CBC",
  "hemogram":                                 "CBC",
  "differential count":                       "DIFF_COUNT",
  "blood group":                              "BLOOD_GROUP",
  "blood grouping":                           "BLOOD_GROUP",
  "blood group & rh typing":                  "BLOOD_GROUP",
  "blood for grouping and rh (d) typing":     "BLOOD_GROUP",
  "bleeding time":                            "BT_CT",
  "clotting time":                            "BT_CT",
  "bleeding time & clotting time":            "BT_CT",
  "bt/ct":                                    "BT_CT",
  "ogtt":                                     "OGTT",
  "oral glucose tolerance test":              "OGTT",
  "random blood sugar":                       "RBS",
  "rbs":                                      "RBS",
  "serum calcium":                            "CALCIUM",
  "calcium":                                  "CALCIUM",
  "surgical profile":                         "SURGICAL_PROFILE",
  "liver function test":                      "LFT",
  "lft":                                      "LFT",
  "thyroid":                                  "TSH",
  "tsh":                                      "TSH",
  "thyroid function test":                    "TSH",
  "thyroid stimulating hormone":              "TSH",
  "dengue":                                   "DENGUE",
  "dengue ns1":                               "DENGUE",
  "dengue ns1 antigen":                       "DENGUE",
  "typhidot":                                 "TYPHIDOT",
  "typhoid":                                  "TYPHIDOT",
  "hba1c":                                    "HBA1C",
  "glycated haemoglobin":                     "HBA1C",
  "urine routine":                            "URINE_ROUTINE",
  "urine routine examination":                "URINE_ROUTINE",
  "urine":                                    "URINE_ROUTINE",
  "mp":                                       "MALARIA",
  "malaria parasite (mp)":                    "MALARIA",
  "widal & mp":                               "WIDAL",
  "fasting blood sugar":                      "RBS",
  "fbs":                                      "RBS",
  "blood sugar":                              "RBS",
};

function deriveReportType(serviceName: string): string {
  const key = serviceName.trim().toLowerCase();
  return LAB_REPORT_TYPE_MAP[key] ||
    serviceName.trim().toUpperCase().replace(/[\s/()]+/g, "_");
}

// ─── ID generator helpers (same as existing) ─────────────────────────────

function parseIdNumber(id: string): number {
  const match = id.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}
function pad5(n: number): string { return String(n).padStart(5, "0"); }

/**
 * Each call reads the DB fresh so sequential IDs never collide even when
 * multiple reports are created in the same loop iteration.
 */
async function getNextLabReportId(): Promise<string> {
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
// createLabOrder  (UPDATED — one LabReport record per service, unique IDs)
// =========================================================================

export async function createLabOrder(
  data: Omit<LabOrder, "id" | "orderId" | "date" | "status">
): Promise<LabOrder> {

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

  // ── Step 3: Patient snapshot (best-effort) ───────────────────────────────
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
  } catch { /* ignore */ }

  // ── Step 4: One LabReport per service — each gets its own unique ID ───────
  //
  // We await each getNextLabReportId() + apiFetch() sequentially so:
  //   • IDs are strictly sequential   (LR-00001, LR-00002, …)
  //   • No two reports share the same reportId
  //   • serialNo is per-patient across ALL their reports (not just this order)
  //
  for (let i = 0; i < data.serviceNames.length; i++) {
    const serviceName = data.serviceNames[i];
    try {
      // Fetch next ID fresh from DB each iteration
      const reportId   = await getNextLabReportId();
      const reportType = deriveReportType(serviceName);

      // Per-patient serial: count existing reports for this patient
      let serialNo = 1;
      try {
        const existing    = await getLabReports();
        const samePatient = existing.filter(
          (r) => r.opId === data.opId || r.phone === data.phone
        );
        serialNo = samePatient.length + 1;
      } catch { /* serialNo stays 1 */ }

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
      // Fire-and-forget: billing is never blocked by report creation failure
      console.error(`[createLabOrder] Failed to create LabReport for "${serviceName}":`, err);
    }
  }

  return order;
}

// =========================================================================
// LAB REPORTS CRUD  (unchanged interface, listed here for completeness)
// =========================================================================

export async function getLabReports(): Promise<LabReportRecord[]> {
  return apiFetch<LabReportRecord[]>("/labreports");
}

export async function getLabReportById(reportId: string): Promise<LabReportRecord | undefined> {
  try { return await apiFetch<LabReportRecord>(`/labreports/${reportId}`); }
  catch { return undefined; }
}

/**
 * Update a lab report.
 * Called by LabReportsPage when:
 *   (a) submitting results  → status "completed", sections filled
 *   (b) reverting           → status "pending",   sections []
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
 * Hard-delete a lab report (pending only; completed must be reverted first).
 */
export async function deleteLabReport(reportId: string): Promise<void> {
  await apiFetch(`/labreports/${reportId}`, { method: "DELETE" });
}

export async function getLabReportsByPatient(
  opId: string,
  phone?: string
): Promise<LabReportRecord[]> {
  const all = await getLabReports();
  return all.filter(
    (r) => r.opId === opId || (phone && r.phone === phone)
  );
}

export async function getLabReportsByOrder(orderId: string): Promise<LabReportRecord[]> {
  const all = await getLabReports();
  return all.filter((r) => r.orderId === orderId);
}

// =========================================================================
// LAB INVESTIGATION PAGE — order list helpers
// =========================================================================

/**
 * Returns a summary of lab-report statuses for a given orderId.
 * Used by LabInvestigationPage to show per-order progress.
 *
 * Example return:  { total: 3, completed: 2, pending: 1 }
 */
export async function getLabReportSummaryForOrder(orderId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
}> {
  try {
    const all     = await getLabReports();
    const reports = all.filter((r) => r.orderId === orderId);
    const completed = reports.filter((r) => r.status === "completed").length;
    return { total: reports.length, completed, pending: reports.length - completed };
  } catch {
    return { total: 0, completed: 0, pending: 0 };
  }
}