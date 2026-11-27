import { useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { CalendarIcon, CaretDownIcon, CheckIcon } from "../components/BmsIcons";
import { DatePickerModal } from "../components/DatePickerModal";
import { MobilePageHeader } from "../components/MobilePageHeader";
import { OptionPickerModal } from "../components/OptionPickerModal";
import { COLORS } from "../constants/colors";
import { useKeyboardHeight } from "../hooks/useKeyboardHeight";
import { LEAVE_TYPES, WEEKDAYS } from "../seeders/availability";
import { useAvailabilityStore, useMyWeeklyAvailability } from "../stores/availabilityStore";
import { useCurrentUser } from "../stores/userStore";
import type { LeaveRequest, LeaveType, Weekday, WeeklyAvailability } from "../types/bms";
import { formatShortDate, inclusiveDayCount } from "../utils/dates";

function FieldLabel({ children, required = false }: { children: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {children}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

function DayCheckbox({
  label,
  checked,
  editable,
  onToggle,
  fullWidth,
}: {
  label: string;
  checked: boolean;
  editable: boolean;
  onToggle: () => void;
  fullWidth?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.dayOption, fullWidth && styles.dayOptionFull, checked && styles.dayOptionChecked]}
      onPress={onToggle}
      disabled={!editable}
      activeOpacity={0.8}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !editable }}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <CheckIcon size={15} /> : null}
      </View>
      <Text style={styles.dayLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const EMPTY_LEAVE = { leaveType: null as LeaveType | null, startDate: null as string | null, endDate: null as string | null, reason: "" };

export function AvailabilityScreen() {
  // Weekly availability
  const user = useCurrentUser();
  const { availability: savedAvailability, isSet: availabilitySet } = useMyWeeklyAvailability(user);
  const saveWeekly = useAvailabilityStore((s) => s.saveWeekly);
  const submitLeaveRequest = useAvailabilityStore((s) => s.submitLeave);
  const loadAvailability = useAvailabilityStore((s) => s.loadForUser);
  const [refreshing, setRefreshing] = useState(false);
  const [draftAvailability, setDraftAvailability] = useState<WeeklyAvailability>(savedAvailability);
  const [editing, setEditing] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Leave request
  const [leave, setLeave] = useState(EMPTY_LEAVE);
  const [picker, setPicker] = useState<"leaveType" | "startDate" | "endDate" | null>(null);
  const [leaveMessage, setLeaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Keep the reason box visible above the keyboard while typing.
  const scrollRef = useRef<ScrollView>(null);
  const reasonFocused = useRef(false);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (keyboardHeight > 0 && reasonFocused.current) {
      // Wait a frame so the added bottom padding is laid out before scrolling.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  }, [keyboardHeight]);

  const shown = editing ? draftAvailability : savedAvailability;
  // The first save always counts as a change, even if the days picked match the empty start.
  const hasChanges = !availabilitySet || WEEKDAYS.some(({ key }) => draftAvailability[key] !== savedAvailability[key]);

  const toggleDay = (day: Weekday) => {
    setDraftAvailability((current) => ({ ...current, [day]: !current[day] }));
    setAvailabilityMessage(null);
  };

  const startEditing = () => {
    setDraftAvailability(savedAvailability);
    setAvailabilityMessage(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraftAvailability(savedAvailability);
    setAvailabilityMessage(null);
    setEditing(false);
  };

  const saveAvailability = async () => {
    if (!WEEKDAYS.some(({ key }) => draftAvailability[key])) {
      setAvailabilityMessage({ type: "error", text: "Select at least one day you can work." });
      return;
    }
    await saveWeekly(user.id, draftAvailability);
    setEditing(false);
    setAvailabilityMessage({ type: "success", text: "Weekly availability saved." });
  };

  const updateLeave = (patch: Partial<typeof EMPTY_LEAVE>) => {
    setLeave((current) => {
      const next = { ...current, ...patch };
      // Keep the end date valid when the start date moves past it.
      if (patch.startDate && next.endDate && next.endDate < patch.startDate) next.endDate = null;
      return next;
    });
    setLeaveMessage(null);
  };

  const totalDays = leave.startDate && leave.endDate ? inclusiveDayCount(leave.startDate, leave.endDate) : null;

  const submitLeave = async () => {
    if (!leave.leaveType || !leave.startDate || !leave.endDate) {
      setLeaveMessage({ type: "error", text: "Please select a leave type, start date and end date." });
      return;
    }
    const request: LeaveRequest = {
      submittedAt: new Date().toISOString(),
      leaveType: leave.leaveType,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason.trim(),
    };
    setSubmitting(true);
    try {
      await submitLeaveRequest(user.id, request);
      setLeave(EMPTY_LEAVE);
      setLeaveMessage({ type: "success", text: "Leave request sent. You'll be notified once the administrator reviews it." });
    } finally {
      setSubmitting(false);
    }
  };

  const leaveTypeLabel = LEAVE_TYPES.find((t) => t.key === leave.leaveType)?.label;
  const weekdayRows = WEEKDAYS.slice(0, 6);
  const sunday = WEEKDAYS[6];

  /** Pull to refresh: reload the saved availability and leave requests (on this phone until the BMS backend has routes). */
  const refresh = async () => {
    setRefreshing(true);
    try {
      await loadAvailability(user.id);
    } catch (error) {
      console.warn("[Availability] Refresh failed", error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, keyboardHeight > 0 && { paddingBottom: keyboardHeight + 16 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[COLORS.navy, COLORS.gold]} tintColor={COLORS.navy} />
        }
      >
        <MobilePageHeader
          title="Set Availability"
          subtitle="Choose the days and times you're available for assignments."
        />

        {/* Weekly availability */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Availability</Text>
          <Text style={styles.cardSubtitle}>
            {editing ? "Tap the days you can work each week." : "Select the days you can work each week."}
          </Text>

          <View style={styles.dayGrid}>
            {weekdayRows.map(({ key, label }) => (
              <DayCheckbox key={key} label={label} checked={shown[key]} editable={editing} onToggle={() => toggleDay(key)} />
            ))}
            <DayCheckbox
              label={sunday.label}
              checked={shown[sunday.key]}
              editable={editing}
              onToggle={() => toggleDay(sunday.key)}
              fullWidth
            />
          </View>

          {!availabilitySet && !editing && !availabilityMessage ? (
            <Text style={styles.noticeText}>You haven't set your availability yet. Tap Edit to choose your days.</Text>
          ) : null}

          {availabilityMessage ? (
            <Text style={availabilityMessage.type === "success" ? styles.successText : styles.errorText}>
              {availabilityMessage.text}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.secondaryButton} onPress={editing ? cancelEditing : startEditing}>
              <Text style={styles.secondaryButtonText}>{editing ? "Cancel" : "Edit"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, (!editing || !hasChanges) && styles.buttonDisabled]}
              onPress={() => void saveAvailability()}
              disabled={!editing || !hasChanges}
            >
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* File a leave */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>File a Leave</Text>
          <Text style={styles.cardSubtitle}>Your request will be sent to the administrator for approval.</Text>

          <FieldLabel required>Leave type</FieldLabel>
          <TouchableOpacity style={styles.input} onPress={() => setPicker("leaveType")} accessibilityRole="button" accessibilityLabel={`Leave type, ${leaveTypeLabel ?? "not selected"}`}>
            <Text style={[styles.inputText, !leaveTypeLabel && styles.placeholder]}>{leaveTypeLabel ?? "Select leave type"}</Text>
            <CaretDownIcon size={18} />
          </TouchableOpacity>

          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <FieldLabel required>Start date</FieldLabel>
              <TouchableOpacity style={[styles.input, styles.dateInput]} onPress={() => setPicker("startDate")} accessibilityRole="button" accessibilityLabel={`Start date, ${leave.startDate ? formatShortDate(leave.startDate) : "not selected"}`}>
                <Text style={[styles.inputText, !leave.startDate && styles.placeholder]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {leave.startDate ? formatShortDate(leave.startDate) : "Select date"}
                </Text>
                <CalendarIcon size={20} />
              </TouchableOpacity>
            </View>
            <View style={styles.dateField}>
              <FieldLabel required>End date</FieldLabel>
              <TouchableOpacity style={[styles.input, styles.dateInput]} onPress={() => setPicker("endDate")} accessibilityRole="button" accessibilityLabel={`End date, ${leave.endDate ? formatShortDate(leave.endDate) : "not selected"}`}>
                <Text style={[styles.inputText, !leave.endDate && styles.placeholder]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {leave.endDate ? formatShortDate(leave.endDate) : "Select date"}
                </Text>
                <CalendarIcon size={20} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total days</Text>
            <Text style={styles.totalValue}>
              {totalDays === null ? "—" : `${totalDays} day${totalDays === 1 ? "" : "s"}`}
            </Text>
          </View>

          <FieldLabel>Reason for leave</FieldLabel>
          <TextInput
            style={styles.textArea}
            value={leave.reason}
            onChangeText={(reason) => updateLeave({ reason })}
            placeholder="Briefly explain your reason for leave"
            placeholderTextColor={COLORS.faint}
            multiline
            textAlignVertical="top"
            maxLength={500}
            onFocus={() => {
              reasonFocused.current = true;
              if (keyboardHeight > 0) scrollRef.current?.scrollToEnd({ animated: true });
            }}
            onBlur={() => {
              reasonFocused.current = false;
            }}
          />

          {leaveMessage ? (
            <Text style={leaveMessage.type === "success" ? styles.successText : styles.errorText}>{leaveMessage.text}</Text>
          ) : null}

          <View style={styles.submitRow}>
            <TouchableOpacity
              style={[styles.primaryButton, styles.submitButton, submitting && styles.buttonDisabled]}
              onPress={() => void submitLeave()}
              disabled={submitting}
            >
              <Text style={styles.primaryButtonText}>{submitting ? "Submitting..." : "Submit Leave Request"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <OptionPickerModal
        visible={picker === "leaveType"}
        title="Leave type"
        options={LEAVE_TYPES}
        value={leave.leaveType}
        onSelect={(leaveType) => updateLeave({ leaveType })}
        onClose={() => setPicker(null)}
      />
      <DatePickerModal
        visible={picker === "startDate"}
        title="Start date"
        value={leave.startDate}
        onSelect={(startDate) => updateLeave({ startDate })}
        onClose={() => setPicker(null)}
      />
      <DatePickerModal
        visible={picker === "endDate"}
        title="End date"
        value={leave.endDate}
        minDate={leave.startDate}
        onSelect={(endDate) => updateLeave({ endDate })}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },

  card: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  cardTitle: { fontSize: 19, fontWeight: "800", color: COLORS.navy },
  cardSubtitle: { fontSize: 15, lineHeight: 21, color: COLORS.muted, marginTop: 4, marginBottom: 14 },

  dayGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  dayOption: {
    width: "48.5%",
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
  },
  dayOptionFull: { width: "100%" },
  dayOptionChecked: { borderColor: COLORS.navy, borderWidth: 1.5, backgroundColor: "#f7f8fc" },
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
  dayLabel: { fontSize: 17, color: COLORS.text },

  buttonRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: COLORS.navy, fontSize: 16, fontWeight: "700" },
  buttonDisabled: { opacity: 0.45 },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
    marginTop: 6,
  },
  required: { color: COLORS.danger },
  input: {
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
    marginBottom: 10,
  },
  inputText: { flexShrink: 1, fontSize: 16, color: COLORS.text },
  placeholder: { color: COLORS.faint },
  dateRow: { flexDirection: "row", gap: 10 },
  dateField: { flex: 1 },
  dateInput: { paddingHorizontal: 10, gap: 6 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.navySoft,
    marginBottom: 10,
  },
  totalLabel: { fontSize: 16, color: COLORS.text },
  totalValue: { fontSize: 16, fontWeight: "800", color: COLORS.text },
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
  submitRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  submitButton: { flex: 0 },

  successText: { color: COLORS.success, fontSize: 15, fontWeight: "700", marginTop: 12 },
  noticeText: { color: COLORS.muted, fontSize: 15, fontWeight: "600", marginTop: 12 },
  errorText: { color: COLORS.danger, fontSize: 15, fontWeight: "700", marginTop: 12 },
});
