export const DATABASE_NAME = "bms_mobile.db";
export const DATABASE_VERSION = 5;

// Row shapes as stored in SQLite. Booleans are 0/1 and arrays/objects are JSON text.
// Repositories convert these to and from the app types in types/bms.ts.

export interface JobOrderRow {
  id: string;
  jobOrderNumber: string;
  bookingNumber: string;
  status: string;
  postServiceFormSubmitted: number;
  clientName: string;
  contactNumber: string;
  date: string;
  pickupTime: string;
  dispatchTime: string;
  driverId: string;
  driverName: string;
  helperIds: string;
  helperNames: string;
  garage: string;
  vehicle: string;
  pickupArea: string;
  pickupAddress: string;
  deliveryArea: string;
  deliveryAddress: string;
  estimatedItems: number;
  itemDescription: string;
  customerInstruction: string;
  insured: number;
  paymentMethod: string;
  charges: string;
  downPayment: number;
  postServiceLocked: number;
  updatedAt: string;
}

export interface PostServiceRecordRow {
  jobOrderId: string;
  serviceCompleted: number;
  arrivalTime: string;
  addOnKeys: string;
  paymentMethod: string;
  addOnPayment: string | null;
  completionNotes: string;
  issueReported: number;
  issueDetails: string;
  submittedAt: string;
  syncPending: number;
  syncBlocked: number;
  lastError: string | null;
  baseVersion: string | null;
}

export interface WeeklyAvailabilityRow {
  userId: string;
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
  updatedAt: string;
  syncPending: number;
}

export interface LeaveRequestRow {
  id: string;
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  submittedAt: string;
  syncPending: number;
}

export interface NotificationRow {
  id: string;
  userId: string;
  type: string;
  actorName: string;
  message: string;
  createdAt: string;
  read: number;
  jobOrderId: string | null;
  driversOnly: number;
  readSyncPending: number;
  profileField: string | null;
}

/**
 * Column definitions of post_service_records. Shared with the migrations, which rebuild the
 * table whenever its stored definition differs from this one (SQLite can't alter a CHECK).
 */
export const POST_SERVICE_RECORDS_COLUMNS_SQL = `
    jobOrderId TEXT PRIMARY KEY NOT NULL,
    serviceCompleted INTEGER NOT NULL CHECK (serviceCompleted IN (0, 1)),
    arrivalTime TEXT NOT NULL,
    addOnKeys TEXT NOT NULL DEFAULT '[]',
    paymentMethod TEXT NOT NULL CHECK (paymentMethod IN ('CASH', 'GCASH', 'BANK_TRANSFER', 'XENDIT')),
    addOnPayment TEXT CHECK (addOnPayment IS NULL OR addOnPayment IN ('COD', 'GCASH', 'BANK_TRANSFER', 'XENDIT', 'UNPAID')),
    completionNotes TEXT NOT NULL DEFAULT '',
    issueReported INTEGER NOT NULL DEFAULT 0 CHECK (issueReported IN (0, 1)),
    issueDetails TEXT NOT NULL DEFAULT '',
    submittedAt TEXT NOT NULL,
    syncPending INTEGER NOT NULL DEFAULT 1 CHECK (syncPending IN (0, 1)),
    syncBlocked INTEGER NOT NULL DEFAULT 0 CHECK (syncBlocked IN (0, 1)),
    lastError TEXT,
    baseVersion TEXT
`;

// This SQL contains no user input. Values are always written with bound parameters.
//
// `syncPending` marks rows written on the phone that the BMS backend has not
// received yet, so a future SyncService can push them when endpoints exist.
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS job_orders (
    id TEXT PRIMARY KEY NOT NULL,
    jobOrderNumber TEXT NOT NULL,
    bookingNumber TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ONGOING', 'COMPLETED')),
    postServiceFormSubmitted INTEGER NOT NULL DEFAULT 0 CHECK (postServiceFormSubmitted IN (0, 1)),
    clientName TEXT NOT NULL,
    contactNumber TEXT NOT NULL DEFAULT '',
    date TEXT NOT NULL,
    pickupTime TEXT NOT NULL,
    dispatchTime TEXT NOT NULL,
    driverId TEXT NOT NULL,
    driverName TEXT NOT NULL,
    helperIds TEXT NOT NULL DEFAULT '[]',
    helperNames TEXT NOT NULL DEFAULT '[]',
    garage TEXT NOT NULL DEFAULT '',
    vehicle TEXT NOT NULL DEFAULT '',
    pickupArea TEXT NOT NULL DEFAULT '',
    pickupAddress TEXT NOT NULL DEFAULT '',
    deliveryArea TEXT NOT NULL DEFAULT '',
    deliveryAddress TEXT NOT NULL DEFAULT '',
    estimatedItems INTEGER NOT NULL DEFAULT 0 CHECK (estimatedItems >= 0),
    itemDescription TEXT NOT NULL DEFAULT '',
    customerInstruction TEXT NOT NULL DEFAULT '',
    insured INTEGER NOT NULL DEFAULT 0 CHECK (insured IN (0, 1)),
    paymentMethod TEXT NOT NULL DEFAULT '',
    charges TEXT NOT NULL DEFAULT '[]',
    downPayment REAL NOT NULL DEFAULT 0 CHECK (downPayment >= 0),
    postServiceLocked INTEGER NOT NULL DEFAULT 0 CHECK (postServiceLocked IN (0, 1)),
    updatedAt TEXT NOT NULL
  );

  -- No foreign key to job_orders on purpose: a record still waiting to sync must
  -- survive even if its job order drops out of the latest server snapshot.
  CREATE TABLE IF NOT EXISTS post_service_records (${POST_SERVICE_RECORDS_COLUMNS_SQL});

  CREATE TABLE IF NOT EXISTS weekly_availability (
    userId TEXT PRIMARY KEY NOT NULL,
    monday INTEGER NOT NULL DEFAULT 0 CHECK (monday IN (0, 1)),
    tuesday INTEGER NOT NULL DEFAULT 0 CHECK (tuesday IN (0, 1)),
    wednesday INTEGER NOT NULL DEFAULT 0 CHECK (wednesday IN (0, 1)),
    thursday INTEGER NOT NULL DEFAULT 0 CHECK (thursday IN (0, 1)),
    friday INTEGER NOT NULL DEFAULT 0 CHECK (friday IN (0, 1)),
    saturday INTEGER NOT NULL DEFAULT 0 CHECK (saturday IN (0, 1)),
    sunday INTEGER NOT NULL DEFAULT 0 CHECK (sunday IN (0, 1)),
    updatedAt TEXT NOT NULL,
    syncPending INTEGER NOT NULL DEFAULT 1 CHECK (syncPending IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS leave_requests (
    id TEXT PRIMARY KEY NOT NULL,
    userId TEXT NOT NULL,
    leaveType TEXT NOT NULL CHECK (leaveType IN ('SICK', 'VACATION', 'EMERGENCY', 'PERSONAL', 'OTHER')),
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    submittedAt TEXT NOT NULL,
    syncPending INTEGER NOT NULL DEFAULT 1 CHECK (syncPending IN (0, 1)),
    CHECK (endDate >= startDate)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT NOT NULL,
    userId TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSIGNMENT', 'SCHEDULE_CHANGE', 'REMINDER', 'COMPLETED', 'ACCOUNT')),
    actorName TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0 CHECK (read IN (0, 1)),
    jobOrderId TEXT,
    driversOnly INTEGER NOT NULL DEFAULT 0 CHECK (driversOnly IN (0, 1)),
    readSyncPending INTEGER NOT NULL DEFAULT 0 CHECK (readSyncPending IN (0, 1)),
    profileField TEXT,
    PRIMARY KEY (userId, id)
  );

  CREATE TABLE IF NOT EXISTS sync_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_job_orders_driverId ON job_orders(driverId);
  CREATE INDEX IF NOT EXISTS idx_job_orders_date ON job_orders(date, pickupTime);
  CREATE INDEX IF NOT EXISTS idx_post_service_syncPending ON post_service_records(syncPending);
  CREATE INDEX IF NOT EXISTS idx_leave_requests_userId ON leave_requests(userId, submittedAt);
  CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId, createdAt);
`;
