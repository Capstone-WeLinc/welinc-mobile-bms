import { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { CaretDownIcon, CheckIcon, ChevronIcon } from "../components/BmsIcons";
import { OptionPickerModal } from "../components/OptionPickerModal";
import { COLORS } from "../constants/colors";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { ADD_ONS } from "../seeders/addOns";
import { ADD_ON_PAYMENTS, PAYMENT_METHODS, toPaymentMethod } from "../seeders/payments";
import type { AddOnPayment, JobOrder, PaymentMethod, PostServiceRecord } from "../types/bms";
import { formatPeso, getPaymentBreakdown } from "../utils/money";

type FieldKey = "arrival" | "notes" | "issue";

/**
 * Where this record stands with the server (spec bms/0022), shown at the top of the form.
 * Null when there is nothing to say (sent, or never submitted).
 */
export function syncNotice(record: PostServiceRecord | undefined, locked: boolean): { tone: "info" | "warning" | "error"; text: string } | null {
  if (locked) return { tone: "info", text: "Finalized by office. This record can no longer be changed." };
  if (!record) return null;
  if (record.syncBlocked) return { tone: "error", text: `Not sent: ${record.lastError ?? "the server refused this record"}. Fix it and submit again.` };
  if (record.syncPending && record.lastError) return { tone: "warning", text: `Not sent yet: ${record.lastError} It will be retried automatically.` };
  if (record.syncPending) return { tone: "warning", text: "Saved on this phone. It will be sent when you're online." };
  if (record.lastError) return { tone: "info", text: record.lastError };
  return null;
}

function Checkbox({ checked }: { checked: boolean }) {
  return <View style={[styles.checkbox, checked && styles.checkboxChecked]}>{checked ? <CheckIcon size={15} /> : null}</View>;
}

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {children}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

/** "14:05" -> { hour: "2", minute: "05", period: "PM" } */
function splitTime(time: string | undefined): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!time) return { hour: "", minute: "", period: "AM" };
  const [h, m] = time.split(":").map(Number);
  return { hour: String(h % 12 === 0 ? 12 : h % 12), minute: String(m).padStart(2, "0"), period: h >= 12 ? "PM" : "AM" };
}

/** Returns "HH:mm" (24h) or null if the hour/minute are not valid. */
function toTime24(hour: string, minute: string, period: "AM" | "PM"): string | null {
  const h = Number(hour);
  const m = Number(minute);
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute) || h < 1 || h > 12 || m < 0 || m > 59) return null;
  const h24 = (h % 12) + (period === "PM" ? 12 : 0);
  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface PostServiceFormScreenProps {
  jobOrder: JobOrder;
  /** Previously submitted record, if any, to edit */
  existingRecord?: PostServiceRecord;
  onSubmit: (record: PostServiceRecord) => Promise<void>;
  /** Back button and Android back. Goes to the list, or to Notifications when opened from one. */
  onBack: () => void;
  /** Screen reader label of the back button */
  backLabel?: string;
}

export function PostServiceFormScreen({
  jobOrder,
  existingRecord,
  onSubmit,
  onBack,
  backLabel = "Back to post service list",
}: PostServiceFormScreenProps) {
  const initialTime = splitTime(existingRecord?.arrivalTime);
  const [serviceCompleted, setServiceCompleted] = useState(existingRecord?.serviceCompleted ?? false);
  const [hour, setHour] = useState(initialTime.hour);
  const [minute, setMinute] = useState(initialTime.minute);
  const [period, setPeriod] = useState<"AM" | "PM">(initialTime.period);
  const [addOnKeys, setAddOnKeys] = useState<string[]>(existingRecord?.addOnKeys ?? []);
  const [notes, setNotes] = useState(existingRecord?.completionNotes ?? "");
  const [issueReported, setIssueReported] = useState(existingRecord?.issueReported ?? false);
  const [issueDetails, setIssueDetails] = useState(existingRecord?.issueDetails ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    existingRecord?.paymentMethod ?? toPaymentMethod(jobOrder.paymentMethod),
  );
  const [addOnPayment, setAddOnPayment] = useState<AddOnPayment | null>(existingRecord?.addOnPayment ?? null);
  const [picker, setPicker] = useState<"paymentMethod" | "addOnPayment" | null>(null);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Finalized on the web: the driver can only read the record (spec bms/0022).
  const readOnly = jobOrder.postServiceLocked;
  const notice = syncNotice(existingRecord, readOnly);

  const minuteRef = useRef<TextInput>(null);

  // Keep the focused input visible above the keyboard.
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Partial<Record<FieldKey, number>>>({});
  const focused = useRef<FieldKey | null>(null);
  const keyboardHeight = useKeyboardHeight();
  const scrollToField = (key: FieldKey) => {
    const y = fieldY.current[key];
    if (y !== undefined) scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
  };
  useEffect(() => {
    if (keyboardHeight > 0 && focused.current) {
      const key = focused.current;
      requestAnimationFrame(() => scrollToField(key));
    }
  }, [keyboardHeight]);
  const focusProps = (key: FieldKey) => ({
    onFocus: () => {
      focused.current = key;
      if (keyboardHeight > 0) scrollToField(key);
    },
    onBlur: () => {
      if (focused.current === key) focused.current = null;
    },
  });

  // Android back button returns to the list.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const bookingTotal = jobOrder.charges.reduce((sum, line) => sum + line.amount, 0);
  const addOnsTotal = ADD_ONS.filter((a) => addOnKeys.includes(a.key)).reduce((sum, a) => sum + a.price, 0);
  const payment = getPaymentBreakdown(bookingTotal + addOnsTotal, jobOrder.downPayment);
  const peso = (amount: number) => formatPeso(amount, { alwaysShowCents: true });
  const arrivalTime = toTime24(hour, minute, period);
  const timeTouched = hour !== "" || minute !== "";

  const errors = {
    serviceCompleted: !serviceCompleted ? "This field is required" : null,
    arrivalTime: !arrivalTime ? (timeTouched ? "Enter a valid time, e.g. 2:30 PM" : "This field is required") : null,
    issueDetails: issueReported && !issueDetails.trim() ? "Please describe the issue" : null,
    paymentMethod: !paymentMethod ? "This field is required" : null,
    addOnPayment: addOnKeys.length > 0 && !addOnPayment ? "Select how the add-ons were paid" : null,
    notes: !notes.trim() ? "This field is required" : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const toggleAddOn = (key: string) =>
    setAddOnKeys((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const submit = async () => {
    if (readOnly) return;
    setTriedSubmit(true);
    if (hasErrors || !arrivalTime || !paymentMethod) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        jobOrderId: jobOrder.id,
        serviceCompleted,
        arrivalTime,
        addOnKeys,
        paymentMethod,
        addOnPayment: addOnKeys.length > 0 ? addOnPayment : null,
        completionNotes: notes.trim(),
        issueReported,
        issueDetails: issueReported ? issueDetails.trim() : "",
        submittedAt: new Date().toISOString(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel={backLabel}>
          <ChevronIcon size={16} direction="left" color={COLORS.text} strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{readOnly ? "Post-Service Record" : "Edit Post-Service Record"}</Text>
          <Text style={styles.jobOrderNumber}>{jobOrder.jobOrderNumber}</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 16 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Booking summary */}
        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryLabel}>Booking Number</Text>
            <Text style={styles.summaryValue}>{jobOrder.bookingNumber}</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Client</Text>
              <Text style={styles.summaryValue}>{jobOrder.clientName}</Text>
            </View>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Contact Number</Text>
              <Text style={styles.summaryValue}>{jobOrder.contactNumber}</Text>
            </View>
          </View>
          <View style={styles.payment} accessibilityLabel="Payment summary">
            <View style={styles.paymentRow}>
              <View style={styles.paymentLabelCol}>
                <Text style={styles.paymentLabel}>Total Service Amount</Text>
                <Text style={styles.summaryHint}>
                  {addOnsTotal > 0 ? `Full cost of the service, incl. ${peso(addOnsTotal)} in add-ons` : "Full cost of the service"}
                </Text>
              </View>
              <Text style={styles.paymentValue}>{peso(payment.totalAmount)}</Text>
            </View>
            <View style={styles.paymentRow}>
              <View style={styles.paymentLabelCol}>
                <Text style={styles.paymentLabel}>Down Payment</Text>
                <Text style={styles.summaryHint}>Already paid by the client</Text>
              </View>
              <Text style={styles.paymentValue}>{peso(payment.downPayment)}</Text>
            </View>
            <View style={[styles.paymentRow, styles.paymentBalanceRow]}>
              <View style={styles.paymentLabelCol}>
                <Text style={styles.paymentBalanceLabel}>Remaining Balance</Text>
                <Text style={styles.summaryHint}>
                  {payment.remainingBalance === 0 ? "Fully paid" : "Still to be paid by the client"}
                </Text>
              </View>
              <Text style={styles.summaryTotal}>{peso(payment.remainingBalance)}</Text>
            </View>
          </View>
        </View>

        {notice ? (
          <View style={[styles.notice, styles[`notice_${notice.tone}`]]} accessibilityRole="alert">
            <Text style={[styles.noticeText, styles[`noticeText_${notice.tone}`]]}>{notice.text}</Text>
          </View>
        ) : null}

        {readOnly ? null : (
          <View style={styles.savedBanner}>
            <Text style={styles.savedBannerText}>Submitting this record will mark the job order as Done.</Text>
          </View>
        )}

        {/* Every field below is locked once the office finalizes the record. */}
        <View pointerEvents={readOnly ? "none" : "auto"} style={readOnly ? styles.readOnly : undefined}>

        {/* Service completed */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setServiceCompleted((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: serviceCompleted }}
        >
          <Checkbox checked={serviceCompleted} />
          <Text style={styles.checkLabel}>
            Service successfully completed<Text style={styles.required}> *</Text>
          </Text>
        </TouchableOpacity>
        {triedSubmit && errors.serviceCompleted ? <Text style={styles.errorText}>{errors.serviceCompleted}</Text> : null}

        {/* Arrival time */}
        <View onLayout={(e) => (fieldY.current.arrival = e.nativeEvent.layout.y)}>
          <FieldLabel required>Arrival time</FieldLabel>
          <View style={styles.timeRow}>
            <View style={[styles.timeBox, triedSubmit && errors.arrivalTime && styles.inputError]}>
              <TextInput
                style={styles.timeInput}
                value={hour}
                onChangeText={(text) => {
                  const digits = text.replace(/\D/g, "").slice(0, 2);
                  setHour(digits);
                  if (digits.length === 2) minuteRef.current?.focus();
                }}
                placeholder="HH"
                placeholderTextColor={COLORS.faint}
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Arrival hour"
                {...focusProps("arrival")}
              />
              <Text style={styles.timeColon}>:</Text>
              <TextInput
                ref={minuteRef}
                style={styles.timeInput}
                value={minute}
                onChangeText={(text) => setMinute(text.replace(/\D/g, "").slice(0, 2))}
                placeholder="MM"
                placeholderTextColor={COLORS.faint}
                keyboardType="number-pad"
                maxLength={2}
                accessibilityLabel="Arrival minute"
                {...focusProps("arrival")}
              />
            </View>
            <View style={styles.periodToggle}>
              {(["AM", "PM"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodButton, period === p && styles.periodButtonActive]}
                  onPress={() => setPeriod(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: period === p }}
                >
                  <Text style={[styles.periodText, period === p && styles.periodTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          {triedSubmit && errors.arrivalTime ? <Text style={styles.errorText}>{errors.arrivalTime}</Text> : null}
        </View>

        {/* Add-ons */}
        <FieldLabel>Add-ons</FieldLabel>
        <View style={styles.addOns}>
          {ADD_ONS.map((addOn) => {
            const checked = addOnKeys.includes(addOn.key);
            return (
              <TouchableOpacity
                key={addOn.key}
                style={[styles.addOnRow, checked && styles.addOnRowChecked]}
                onPress={() => toggleAddOn(addOn.key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${addOn.label}, ${formatPeso(addOn.price)}`}
              >
                <Checkbox checked={checked} />
                <Text style={styles.addOnLabel}>{addOn.label}</Text>
                <Text style={styles.addOnPrice}>{formatPeso(addOn.price, { alwaysShowCents: true })}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hint}>Select only materials availed during the trip. Booking materials are not changed.</Text>

        {/* Payment */}
        <FieldLabel required>Payment method</FieldLabel>
        <TouchableOpacity
          style={[styles.select, triedSubmit && errors.paymentMethod && styles.inputError]}
          onPress={() => setPicker("paymentMethod")}
          accessibilityRole="button"
          accessibilityLabel={`Payment method, ${PAYMENT_METHODS.find((m) => m.key === paymentMethod)?.label ?? "not selected"}`}
        >
          <Text style={[styles.selectText, !paymentMethod && styles.placeholder]}>
            {PAYMENT_METHODS.find((m) => m.key === paymentMethod)?.label ?? "Select payment method"}
          </Text>
          <CaretDownIcon size={18} />
        </TouchableOpacity>
        <Text style={styles.hint}>How the client paid for this booking. Booked as: {jobOrder.paymentMethod}.</Text>
        {triedSubmit && errors.paymentMethod ? <Text style={styles.errorText}>{errors.paymentMethod}</Text> : null}

        {addOnKeys.length > 0 ? (
          <>
            <FieldLabel required>Add-ons payment</FieldLabel>
            <TouchableOpacity
              style={[styles.select, triedSubmit && errors.addOnPayment && styles.inputError]}
              onPress={() => setPicker("addOnPayment")}
              accessibilityRole="button"
              accessibilityLabel={`Add-ons payment, ${ADD_ON_PAYMENTS.find((p) => p.key === addOnPayment)?.label ?? "not selected"}`}
            >
              <Text style={[styles.selectText, !addOnPayment && styles.placeholder]}>
                {ADD_ON_PAYMENTS.find((p) => p.key === addOnPayment)?.label ?? "How were the add-ons paid?"}
              </Text>
              <CaretDownIcon size={18} />
            </TouchableOpacity>
            <Text style={styles.hint}>
              Add-ons total: {formatPeso(addOnsTotal, { alwaysShowCents: true })}.
              {addOnPayment === "UNPAID" ? " The office will collect this from the client." : ""}
            </Text>
            {triedSubmit && errors.addOnPayment ? <Text style={styles.errorText}>{errors.addOnPayment}</Text> : null}
          </>
        ) : null}

        {/* Completion notes */}
        <View onLayout={(e) => (fieldY.current.notes = e.nativeEvent.layout.y)}>
          <FieldLabel required>Completion notes</FieldLabel>
          <TextInput
            style={[styles.textArea, triedSubmit && errors.notes && styles.inputError]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Enter notes about the service completion."
            placeholderTextColor={COLORS.faint}
            multiline
            textAlignVertical="top"
            maxLength={1000}
            {...focusProps("notes")}
          />
          {triedSubmit && errors.notes ? <Text style={styles.errorText}>{errors.notes}</Text> : null}
        </View>

        {/* Issue reported */}
        <TouchableOpacity
          style={[styles.checkRow, styles.issueRow, issueReported && styles.addOnRowChecked]}
          onPress={() => setIssueReported((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: issueReported }}
        >
          <Checkbox checked={issueReported} />
          <Text style={styles.checkLabel}>Issue Reported</Text>
        </TouchableOpacity>

        {issueReported ? (
          <View onLayout={(e) => (fieldY.current.issue = e.nativeEvent.layout.y)}>
            <FieldLabel required>Issue details</FieldLabel>
            <TextInput
              style={[styles.textArea, triedSubmit && errors.issueDetails && styles.inputError]}
              value={issueDetails}
              onChangeText={setIssueDetails}
              placeholder="Describe what happened (e.g. damaged item, delay, customer complaint)."
              placeholderTextColor={COLORS.faint}
              multiline
              textAlignVertical="top"
              maxLength={1000}
              {...focusProps("issue")}
            />
            {triedSubmit && errors.issueDetails ? <Text style={styles.errorText}>{errors.issueDetails}</Text> : null}
          </View>
        ) : null}

        </View>

        {triedSubmit && hasErrors ? (
          <Text style={[styles.errorText, styles.submitError]}>Please complete the required fields above.</Text>
        ) : null}

        {readOnly ? null : (
          <View style={styles.submitRow}>
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={() => void submit()}
              disabled={submitting}
            >
              <Text style={styles.submitText}>{submitting ? "Submitting..." : "Submit"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <OptionPickerModal
        visible={picker === "paymentMethod"}
        title="Payment method"
        options={PAYMENT_METHODS}
        value={paymentMethod}
        onSelect={setPaymentMethod}
        onClose={() => setPicker(null)}
      />
      <OptionPickerModal
        visible={picker === "addOnPayment"}
        title="How were the add-ons paid?"
        options={ADD_ON_PAYMENTS}
        value={addOnPayment}
        onSelect={setAddOnPayment}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.navy },
  jobOrderNumber: { fontSize: 16, fontWeight: "800", color: COLORS.gold, marginTop: 2 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },

  summary: { backgroundColor: "#eef0f6", borderRadius: 12, padding: 16, gap: 12 },
  summaryRow: { flexDirection: "row", gap: 12 },
  summaryCol: { flex: 1 },
  summaryLabel: { fontSize: 13, color: COLORS.muted, marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: "800", color: COLORS.navy },
  summaryTotal: { fontSize: 20, fontWeight: "800", color: COLORS.navy },
  summaryHint: { fontSize: 13, color: COLORS.muted, marginTop: 2 },

  payment: { gap: 10, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#d7dbe7" },
  paymentRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  paymentLabelCol: { flex: 1 },
  paymentLabel: { fontSize: 15, fontWeight: "700", color: COLORS.navy },
  paymentValue: { fontSize: 16, fontWeight: "800", color: COLORS.navy },
  paymentBalanceRow: { paddingTop: 10, borderTopWidth: 1, borderTopColor: "#d7dbe7" },
  paymentBalanceLabel: { fontSize: 16, fontWeight: "800", color: COLORS.navy },

  savedBanner: { marginTop: 12, backgroundColor: COLORS.navySoft, borderRadius: 10, padding: 12 },
  savedBannerText: { color: COLORS.navy, fontSize: 14, fontWeight: "600" },

  notice: { marginTop: 12, borderRadius: 10, padding: 12, borderWidth: 1 },
  notice_info: { backgroundColor: COLORS.navySoft, borderColor: COLORS.navySoft },
  notice_warning: { backgroundColor: "#fff8e6", borderColor: "#f1d48a" },
  notice_error: { backgroundColor: "#fdecec", borderColor: "#f2b8b8" },
  noticeText: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  noticeText_info: { color: COLORS.navy },
  noticeText_warning: { color: "#7a5a00" },
  noticeText_error: { color: COLORS.danger },
  readOnly: { opacity: 0.6 },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, marginTop: 14 },
  checkLabel: { flex: 1, fontSize: 17, color: COLORS.text },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.text,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: COLORS.navy, borderColor: COLORS.navy },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  required: { color: COLORS.danger },
  errorText: { color: COLORS.danger, fontSize: 14, fontWeight: "600", marginTop: 6 },
  inputError: { borderColor: COLORS.danger, borderWidth: 1.5 },

  timeRow: { flexDirection: "row", gap: 10 },
  timeBox: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
  },
  timeInput: { width: 44, fontSize: 18, color: COLORS.text, textAlign: "center", paddingVertical: 8 },
  timeColon: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginHorizontal: 8 },
  periodToggle: { flexDirection: "row", borderRadius: 10, borderWidth: 1.5, borderColor: COLORS.navy, overflow: "hidden" },
  periodButton: { minWidth: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  periodButtonActive: { backgroundColor: COLORS.navy },
  periodText: { fontSize: 16, fontWeight: "700", color: COLORS.navy },
  periodTextActive: { color: "#ffffff" },

  addOns: { gap: 10 },
  addOnRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addOnRowChecked: { borderColor: COLORS.navy, borderWidth: 1.5, backgroundColor: "#f7f8fc" },
  addOnLabel: { flex: 1, fontSize: 16, color: COLORS.text },
  addOnPrice: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  hint: { fontSize: 13, lineHeight: 19, color: COLORS.muted, marginTop: 10 },

  select: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
  },
  selectText: { flexShrink: 1, fontSize: 16, color: COLORS.text },
  placeholder: { color: COLORS.faint },
  textArea: {
    minHeight: 110,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    fontSize: 16,
    color: COLORS.text,
  },
  issueRow: {
    marginTop: 18,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  submitError: { marginTop: 16 },
  submitRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 20 },
  submitButton: {
    minHeight: 50,
    minWidth: 140,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  buttonDisabled: { opacity: 0.45 },
});
