// --- Interfaces ---
export interface Doctor { id?: string; customId?: string; name: string; specialization: string; fee: number; phone: string; available: boolean; }
export interface Medicine { id?: string; customId?: string; name: string; schedule: string; batchNumber: string; pricePerTablet: number; tabletsPerSheet: number; sheetsPerPack: number; category: string; manufacturer: string; expiryDate: string | Date; stockQuantity: number; description: string; }
export interface OPRecord { opId: string; name: string; age: string; gender: string; phone: string; village: string; doctorId: string; doctorName: string; consultationFee: number; finalAmount: number; paymentMethod: string; transactionId?: string; date: string | Date; status: "waiting" | "in-consultation" | "completed"; vitals?: { bp: string; weight: string; temperature: string }; referredByRmpId?: string; referredByRmpName?: string; isAdmitted?: boolean; }
export interface XRayService { id?: string; customId?: string; name: string; bodyPart: string; amount: number; description: string; }
export interface XRayOrder { id?: string; orderId?: string; opId: string; patientName: string; phone: string; serviceIds: string[]; serviceNames: string[]; amount: number; referredBy?: string; date: string | Date; status: "pending" | "completed"; paymentMethod: string; }
export interface ECGService { id?: string; customId?: string; name: string; bodyPart: string; amount: number; description: string; }
export interface ECGOrder { id?: string; orderId?: string; opId: string; patientName: string; phone: string; serviceIds: string[]; serviceNames: string[]; amount: number; referredBy?: string; date: string | Date; status: "pending" | "completed"; paymentMethod: string; }
export interface LabService { id?: string; customId?: string; name: string; category: string; amount: number; description: string; }
export interface LabOrder { id?: string; orderId?: string; opId: string; patientName: string; phone: string; serviceIds: string[]; serviceNames: string[]; amount: number; referredBy?: string; date: string | Date; status: "pending" | "completed"; paymentMethod: string; }
export interface Receipt { 
  id?: string; 
  receiptId?: string; 
  opId: string; 
  patientName: string; 
  phone: string; 
  age?: string; 
  gender?: string; 
  doctorName?: string; 
  type: "op" | "payment" | "medicine" | "xray" | "ecg" | "treatment" | "surgery" | "ip" | "scan" | "lab"; 
  category: string; 
  amount: number; 
  method: string; 
  date: string | Date; 
  time: string; 
  details?: string; 
  itemDetails?: { 
    name: string; 
    quantity?: number; 
    amount: number;
    batchNumber?: string;
    manufacturer?: string;
    expiryDate?: string | Date;
    schedule?: string;
  }[]; 
}
export interface RMP { id?: string; customId?: string; name: string; phone: string; specialization: string; clinicName: string; address: string; discountPercent: number; }
export interface TreatmentEntry { id?: string; date: string | Date; time: string; type: string; description: string; notes: string; administeredBy: string; }
export interface IPRecord { ipId: string; opId: string; name: string; age: string; gender: string; phone: string; village: string; room: string; bed: string; doctor: string; disease: string; department: string; admissionType: "General Admission" | "Surgical Admission"; management: "Medical Management" | "Surgical Management"; admissionCharges: number; dateOfAdmission: string | Date; dateOfDischarge: string | Date; diagnosis: string; type: "Full Treatment" | "Doses Only"; admitted?: string; status: "critical" | "stable" | "recovering" | "discharged"; treatments: TreatmentEntry[]; notes: string; }
export interface SurgeryRecord { id: string; ipId: string; patientName: string; phone: string; surgery: string; surgeon: string; date: string | Date; preOpNotes?: string; status: "scheduled" | "completed" | "cancelled"; }

// --- API Helper ---
async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('medcare_token') : null;

  const res = await fetch(`/api${endpoint}`, {
    ...options,
    headers: { 
      "Content-Type": "application/json", 
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...options?.headers 
    },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error: ${res.statusText}`);
  return data;
}

// --- SEQUENTIAL ID GENERATORS ---
export async function getLatestReceiptId(): Promise<string> {
  try {
    const receipts = await getReceipts();
    if (!receipts || receipts.length === 0) return "REC-1000";
    
    let maxNum = 1000;
    receipts.forEach(r => {
      const match = (r.id || r.receiptId || "").match(/\d+/);
      if (match) {
         const num = parseInt(match[0], 10);
         if (num > maxNum) maxNum = num;
      }
    });
    
    return `REC-${maxNum + 1}`;
  } catch (error) {
    return `REC-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

export async function getLatestOpId(): Promise<string> {
  try {
    const ops = await getOPRecords();
    if (!ops || ops.length === 0) return "OP-1000";
    
    let maxNum = 1000;
    ops.forEach(r => {
      const match = (r.opId || "").match(/\d+/);
      if (match) {
         const num = parseInt(match[0], 10);
         if (num > maxNum) maxNum = num;
      }
    });
    
    return `OP-${maxNum + 1}`;
  } catch (error) {
    return `OP-${Math.floor(1000 + Math.random() * 9000)}`;
  }
}

// --- RMP ---
export async function getRMPs(): Promise<RMP[]> {
  return apiFetch<RMP[]>('/rmps');
}

export async function addRMP(rmp: Omit<RMP, "id" | "customId">): Promise<RMP> {
  const customId = `RMP-${Date.now().toString().slice(-4)}`;
  return apiFetch<RMP>('/rmps', { method: 'POST', body: JSON.stringify({ ...rmp, customId }) });
}

export async function removeRMP(customId: string): Promise<void> {
  await apiFetch(`/rmps/${customId}`, { method: 'DELETE' });
}

export async function getRMPReferrals(rmpId: string): Promise<OPRecord[]> {
  const records = await getOPRecords();
  return records.filter((r) => r.referredByRmpId === rmpId);
}

// --- Doctors ---
export async function getDoctors(): Promise<Doctor[]> {
  return apiFetch<Doctor[]>('/doctors');
}

export async function addDoctor(doc: Omit<Doctor, "id" | "customId">): Promise<Doctor> {
  const customId = `DOC-${Date.now().toString().slice(-4)}`;
  return apiFetch<Doctor>('/doctors', { method: 'POST', body: JSON.stringify({ ...doc, customId }) });
}

export async function removeDoctor(customId: string): Promise<void> {
  await apiFetch(`/doctors/${customId}`, { method: 'DELETE' });
}

// --- Medicines ---
export async function getMedicines(): Promise<Medicine[]> {
  return apiFetch<Medicine[]>('/medicines');
}

export async function addMedicine(med: Omit<Medicine, "id" | "customId">): Promise<Medicine> {
  const customId = `MED-${Date.now().toString().slice(-5)}`;
  return apiFetch<Medicine>('/medicines', { method: 'POST', body: JSON.stringify({ ...med, customId }) });
}

export async function addMedicines(meds: Omit<Medicine, "id" | "customId">[]): Promise<void> {
  for (const med of meds) {
    await addMedicine(med);
  }
}

export async function decreaseMedicineStock(medicineId: string, quantity: number): Promise<void> {
  const meds = await getMedicines();
  const med = meds.find(m => m.customId === medicineId);
  if (med) {
    const newQuantity = Math.max(0, med.stockQuantity - quantity);
    await apiFetch(`/medicines/${medicineId}`, { 
      method: 'PUT', 
      body: JSON.stringify({ stockQuantity: newQuantity }) 
    });
  }
}

// --- OP ---
export async function getOPRecords(): Promise<OPRecord[]> {
  return apiFetch<OPRecord[]>('/oprecords');
}

export async function createOP(data: Omit<OPRecord, "opId" | "date" | "status" | "isAdmitted"> & { opId?: string }): Promise<OPRecord> {
  const finalOpId = data.opId || await getLatestOpId(); 
  const now = new Date();
  
  const payload = { 
    ...data, 
    opId: finalOpId, 
    status: "waiting", 
    isAdmitted: false,
    date: now.toISOString()
  };
  
  const rec = await apiFetch<OPRecord>('/oprecords', { method: 'POST', body: JSON.stringify(payload) });
  
  await addReceipt({
    opId: rec.opId, patientName: rec.name, phone: rec.phone, age: rec.age, gender: rec.gender, doctorName: rec.doctorName,
    type: "op", category: "OP Consultation", amount: rec.finalAmount, method: rec.paymentMethod, details: `Consultation fee - ${rec.doctorName}`,
  });
  
  return rec;
}

export async function updateOPStatus(opId: string, status: OPRecord["status"]): Promise<void> {
  await apiFetch(`/oprecords/${opId}`, { method: 'PUT', body: JSON.stringify({ status }) });
}

// --- X-Ray ---
export async function getXRayServices(): Promise<XRayService[]> {
  const services = await apiFetch<any[]>('/services');
  return services.filter(s => s.category === 'X-Ray');
}

export async function addXRayService(svc: Omit<XRayService, "id" | "customId">): Promise<XRayService> {
  const customId = `XRS-${Date.now().toString().slice(-4)}`;
  return apiFetch<XRayService>('/services', { method: 'POST', body: JSON.stringify({ ...svc, category: 'X-Ray', customId }) });
}

export async function updateXRayService(customId: string, data: Partial<Omit<XRayService, "id" | "customId">>): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function removeXRayService(customId: string): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: 'DELETE' });
}

export async function getXRayOrders(): Promise<XRayOrder[]> {
  const orders = await apiFetch<XRayOrder[]>('/orders');
  return orders.filter(o => o.orderId?.startsWith("XR-")); 
}

export async function createXRayOrder(data: Omit<XRayOrder, "id" | "orderId" | "date" | "status">): Promise<XRayOrder> {
  const orderId = `XR-${Date.now().toString().slice(-5)}`;
  const payload = { ...data, orderId, status: "pending" };
  const order = await apiFetch<XRayOrder>('/orders', { method: 'POST', body: JSON.stringify(payload) });

  const splitAmount = data.amount / (data.serviceNames.length || 1);
  const itemDetails = data.serviceNames.map(name => ({ name, quantity: 1, amount: splitAmount }));

  await addReceipt({
    opId: data.opId, patientName: data.patientName, phone: data.phone, type: "xray", category: "X-Ray Bill",
    amount: data.amount, method: data.paymentMethod, details: data.serviceNames.join(", "),
    itemDetails
  });
  return order;
}

export async function updateXRayStatus(orderId: string, status: XRayOrder["status"]): Promise<void> {
  await apiFetch(`/orders/${orderId}`, { method: 'PUT', body: JSON.stringify({ status }) });
}

// --- ECG ---
export async function getECGServices(): Promise<ECGService[]> {
  const services = await apiFetch<any[]>('/services');
  return services.filter(s => s.category === 'ECG');
}

export async function addECGService(svc: Omit<ECGService, "id" | "customId">): Promise<ECGService> {
  const customId = `ECGS-${Date.now().toString().slice(-4)}`;
  return apiFetch<ECGService>('/services', { method: 'POST', body: JSON.stringify({ ...svc, category: 'ECG', customId }) });
}

export async function updateECGService(customId: string, data: Partial<Omit<ECGService, "id" | "customId">>): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function removeECGService(customId: string): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: 'DELETE' });
}

export async function getECGOrders(): Promise<ECGOrder[]> {
  const orders = await apiFetch<ECGOrder[]>('/orders');
  return orders.filter(o => o.orderId?.startsWith("ECG-")); 
}

export async function createECGOrder(data: Omit<ECGOrder, "id" | "orderId" | "date" | "status">): Promise<ECGOrder> {
  const orderId = `ECG-${Date.now().toString().slice(-5)}`;
  const payload = { ...data, orderId, status: "pending" };
  const order = await apiFetch<ECGOrder>('/orders', { method: 'POST', body: JSON.stringify(payload) });

  const splitAmount = data.amount / (data.serviceNames.length || 1);
  const itemDetails = data.serviceNames.map(name => ({ name, quantity: 1, amount: splitAmount }));

  await addReceipt({
    opId: data.opId, patientName: data.patientName, phone: data.phone, type: "ecg", category: "ECG Bill",
    amount: data.amount, method: data.paymentMethod, details: data.serviceNames.join(", "),
    itemDetails
  });
  return order;
}

export async function updateECGStatus(orderId: string, status: ECGOrder["status"]): Promise<void> {
  await apiFetch(`/orders/${orderId}`, { method: 'PUT', body: JSON.stringify({ status }) });
}

// --- Lab Investigation ---
export async function getLabServices(): Promise<LabService[]> {
  const services = await apiFetch<any[]>('/services');
  return services.filter(s => s.category !== 'X-Ray' && s.category !== 'ECG'); 
}

export async function getLabOrders(): Promise<LabOrder[]> {
  const orders = await apiFetch<LabOrder[]>('/orders');
  return orders.filter(o => !o.orderId?.startsWith("XR-") && !o.orderId?.startsWith("ECG-"));
}

export async function addLabService(svc: Omit<LabService, "id" | "customId">): Promise<LabService> {
  const customId = `LAB-${Date.now().toString().slice(-4)}`;
  return apiFetch<LabService>('/services', { method: 'POST', body: JSON.stringify({ ...svc, customId }) });
}

export async function updateLabService(customId: string, data: Partial<Omit<LabService, "id" | "customId">>): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function removeLabService(customId: string): Promise<void> {
  await apiFetch(`/services/${customId}`, { method: 'DELETE' });
}

export async function createLabOrder(data: Omit<LabOrder, "id" | "orderId" | "date" | "status">): Promise<LabOrder> {
  const orderId = `LB-${Date.now().toString().slice(-5)}`;
  const payload = { ...data, orderId, status: "pending" };
  const order = await apiFetch<LabOrder>('/orders', { method: 'POST', body: JSON.stringify(payload) });

  const splitAmount = data.amount / (data.serviceNames.length || 1);
  const itemDetails = data.serviceNames.map(name => ({ name, quantity: 1, amount: splitAmount }));

  await addReceipt({
    opId: data.opId, patientName: data.patientName, phone: data.phone, type: "lab", category: "Lab Investigation Bill",
    amount: data.amount, method: data.paymentMethod, details: data.serviceNames.join(", "),
    itemDetails
  });
  return order;
}

export async function updateLabStatus(orderId: string, status: LabOrder["status"]): Promise<void> {
  await apiFetch(`/orders/${orderId}`, { method: 'PUT', body: JSON.stringify({ status }) });
}

// --- IP (Inpatient) ---
export async function getIPRecords(): Promise<IPRecord[]> {
  return apiFetch<IPRecord[]>('/iprecords');
}

export async function admitPatient(data: any): Promise<IPRecord> {
  let currentOpId = data.opId;
  
  if (!currentOpId) {
    const existingPatient = await findPatientByPhoneAll(data.phone);
    if (existingPatient && existingPatient.opId) {
      currentOpId = existingPatient.opId;
    } else {
      const newOp = await createOP({ ...data, consultationFee: 0, finalAmount: 0, paymentMethod: "cash", doctorId: "", doctorName: data.doctor });
      currentOpId = newOp.opId;
    }
  }

  await apiFetch(`/oprecords/${currentOpId}`, { method: 'PUT', body: JSON.stringify({ isAdmitted: true }) });

  const uniqueIpId = `IP-${Date.now().toString().slice(-6)}`;

  const payload: IPRecord = {
    ...data,
    ipId: uniqueIpId, 
    opId: currentOpId, 
    status: data.status || "stable",
    treatments: [],
    dateOfAdmission: data.dateOfAdmission || new Date().toISOString(),
  };

  const rec = await apiFetch<IPRecord>('/iprecords', { method: 'POST', body: JSON.stringify(payload) });

  if (data.admissionCharges > 0) {
    await addReceipt({
      opId: currentOpId, patientName: data.name, phone: data.phone, age: data.age, gender: data.gender,
      doctorName: data.doctor, type: "ip", category: "Admission Charges", amount: data.admissionCharges, method: data.paymentMethod || "cash",
      details: `${data.admissionType || 'Admission'} - ${data.department || 'General'}`,
    });
  }
  return rec;
}

export async function updateIPStatus(ipId: string, status: IPRecord["status"]): Promise<void> {
  await apiFetch(`/iprecords/${ipId}`, { method: 'PUT', body: JSON.stringify({ status }) });
}

export async function addTreatmentEntry(ipId: string, entry: Omit<TreatmentEntry, "id" | "date" | "time">): Promise<void> {
  const ip = await apiFetch<IPRecord>(`/iprecords/${ipId}`);
  if (!ip) return;
  
  const now = new Date();
  const t: TreatmentEntry = {
    ...entry,
    date: now.toISOString(),
    time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
  
  const updatedTreatments = [...(ip.treatments || []), t];
  await apiFetch(`/iprecords/${ipId}`, { method: 'PUT', body: JSON.stringify({ treatments: updatedTreatments }) });
}

export async function findIPByIpId(ipId: string): Promise<IPRecord | undefined> {
  try { return await apiFetch<IPRecord>(`/iprecords/${ipId}`); } catch { return undefined; }
}

export async function getIPRecordsByPhone(phone: string): Promise<IPRecord[]> {
  const records = await getIPRecords();
  return records.filter((r) => r.phone === phone);
}

// --- Surgery ---
export async function getSurgeries(): Promise<SurgeryRecord[]> {
  return apiFetch<SurgeryRecord[]>('/surgeries');
}

export async function scheduleSurgery(data: Omit<SurgeryRecord, "id" | "status">): Promise<SurgeryRecord> {
  const id = `S-${Date.now().toString().slice(-4)}`;
  return apiFetch<SurgeryRecord>('/surgeries', { method: 'POST', body: JSON.stringify({ ...data, id, status: "scheduled" }) });
}

export async function updateSurgeryStatus(id: string, status: SurgeryRecord["status"]): Promise<void> {
  await apiFetch(`/surgeries/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
}

export async function getSurgeriesByPhone(phone: string): Promise<SurgeryRecord[]> {
  const surgeries = await getSurgeries();
  return surgeries.filter((r) => r.phone === phone);
}

export async function getSurgeriesByIpId(ipId: string): Promise<SurgeryRecord[]> {
  const surgeries = await getSurgeries();
  return surgeries.filter((r) => r.ipId === ipId);
}

// --- Receipts ---
export async function getReceipts(): Promise<Receipt[]> {
  return apiFetch<Receipt[]>('/receipts');
}

export async function addReceipt(data: Omit<Receipt, "id" | "receiptId" | "date" | "time">): Promise<Receipt> {
  const now = new Date();
  const generatedId = await getLatestReceiptId();

  const payload = {
    ...data,
    id: generatedId,
    receiptId: generatedId, 
    date: now.toISOString(),
    time: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
  
  return apiFetch<Receipt>('/receipts', { method: 'POST', body: JSON.stringify(payload) });
}

// --- Search Helpers ---
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
  return records.filter((r) =>
    r.phone.includes(q) || r.opId.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
  );
}

export async function findPatientByPhoneAll(phone: string): Promise<{ name: string; age: string; gender: string; phone: string; village: string; opId: string; doctorName?: string; date?: string | Date } | undefined> {
  const op = await findPatientByPhone(phone) || await findPatientByPhonePartial(phone);
  if (op) return { name: op.name, age: op.age, gender: op.gender, phone: op.phone, village: op.village, opId: op.opId, doctorName: op.doctorName, date: op.date };
  
  const ipRecords = await getIPRecords();
  const ip = ipRecords.find(r => r.phone === phone || r.phone.includes(phone));
  if (ip) return { name: ip.name, age: ip.age, gender: ip.gender || "", phone: ip.phone, village: ip.village || "", opId: ip.opId, doctorName: ip.doctor, date: ip.dateOfAdmission };
  
  return undefined;
}