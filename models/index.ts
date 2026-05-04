// app/models/index.ts
import { User } from './User';
import { Doctor } from './Doctor';
import { Medicine } from './Medicine';
import { OPRecord } from './OPRecord';
import { IPRecord } from './IPRecord';
import { Service } from './Service';
import { Order } from './Order';
import { Surgery } from './Surgery';
import { Receipt } from './Receipt';
import { RMP } from './RMP';

// This map connects the URL slug (e.g., /api/doctors) to the exact Mongoose model
export const ModelMap: Record<string, any> = {
  users: User,
  doctors: Doctor,
  medicines: Medicine,
  oprecords: OPRecord,
  iprecords: IPRecord,
  services: Service,
  orders: Order,
  surgeries: Surgery,
  receipts: Receipt,
  rmps: RMP,
};

// Helper function to map the collection name to your specific custom ID fields
export const getIdField = (collection: string) => {
  const map: Record<string, string> = {
    doctors: 'customId',
    medicines: 'customId',
    services: 'customId',
    rmps: 'customId',
    oprecords: 'opId',
    iprecords: 'ipId',
    orders: 'orderId',
    surgeries: 'id',
    receipts: 'receiptId'
  };
  return map[collection] || '_id'; // Fallback to MongoDB default if not found
};