// Shared data types for the BMS driver/helper mobile app.

export type TeamRole = "driver" | "helper";

export type TeamMember = {
  /** Sign-in account id */
  id: string;
  /** Fleet driver / dispatch helper record id. Job orders list team members by this id. */
  teamMemberId?: string;
  /** e.g. "DRV-001" */
  employeeId?: string;
  firstName: string;
  lastName: string;
  /** "First Last", kept in sync with firstName/lastName */
  name: string;
  role: TeamRole;
  email: string;
  /** E.164 format, e.g. "+639171234567"; empty if not on record */
  phone: string;
  /** Local date in YYYY-MM-DD */
  joinedDate?: string;
};

export type BookingStatus = "PENDING" | "ONGOING" | "COMPLETED";

export type ChargeLine = {
  label: string;
  /** Amount in Philippine pesos */
  amount: number;
};

/** A booking/job order assigned to the driver or helper. Used by Home and Job Orders. */
export type JobOrder = {
  id: string;
  jobOrderNumber: string;
  bookingNumber: string;
  status: BookingStatus;
  postServiceFormSubmitted: boolean;

  // Client
  clientName: string;
  contactNumber: string;

  // Schedule
  /** Local date in YYYY-MM-DD */
  date: string;
  /** 24h time in HH:mm */
  pickupTime: string;
  /** 24h time in HH:mm */
  dispatchTime: string;

  // Vehicle and team
  /** Assigned driver's user id */
  driverId: string;
  driverName: string;
  /** Assigned helpers' user ids (same order as helperNames) */
  helperIds: string[];
  helperNames: string[];
  garage: string;
  vehicle: string;

  // Route
  /** Short city/area name, e.g. "Marikina" */
  pickupArea: string;
  pickupAddress: string;
  deliveryArea: string;
  deliveryAddress: string;

  // Job details
  estimatedItems: number;
  itemDescription: string;
  customerInstruction: string;

  // Insurance and payment
  insured: boolean;
  paymentMethod: string;
  charges: ChargeLine[];
};

export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type WeeklyAvailability = Record<Weekday, boolean>;

export type LeaveType = "SICK" | "VACATION" | "EMERGENCY" | "PERSONAL" | "OTHER";

export type LeaveRequest = {
  /** ISO timestamp, set when submitted */
  submittedAt?: string;
  leaveType: LeaveType;
  /** Local date in YYYY-MM-DD */
  startDate: string;
  /** Local date in YYYY-MM-DD */
  endDate: string;
  reason: string;
};

export type AddOn = {
  key: string;
  label: string;
  /** Price in Philippine pesos */
  price: number;
};

export type PaymentMethod = "CASH" | "GCASH" | "BANK_TRANSFER";

/** How the add-ons availed during the trip were (or will be) paid. */
export type AddOnPayment = "COD" | "GCASH" | "BANK_TRANSFER" | "UNPAID";

/** What the driver/helper submits after a service is done. */
export type PostServiceRecord = {
  jobOrderId: string;
  serviceCompleted: boolean;
  /** 24h time in HH:mm */
  arrivalTime: string;
  /** Keys of the add-ons availed during the trip */
  addOnKeys: string[];
  /** How the client paid for the booking */
  paymentMethod: PaymentMethod;
  /** How the add-ons were paid; null when no add-ons were availed */
  addOnPayment: AddOnPayment | null;
  completionNotes: string;
  issueReported: boolean;
  issueDetails: string;
  /** ISO timestamp */
  submittedAt: string;
};

export type NotificationType = "ASSIGNMENT" | "SCHEDULE_CHANGE" | "REMINDER" | "COMPLETED" | "ACCOUNT";

/** A piece of notification text; bold pieces are highlighted. */
export type NotificationTextPart = { text: string; bold?: boolean };

export type AppNotification = {
  id: string;
  type: NotificationType;
  /** Who the notification is from (shown as initials in the avatar) */
  actorName: string;
  message: NotificationTextPart[];
  /** ISO timestamp */
  createdAt: string;
  read: boolean;
  /** Job order this notification is about, if any */
  jobOrderId?: string;
  /** Only shown to drivers (e.g. post-service reminders) */
  driversOnly?: boolean;
};
