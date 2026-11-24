import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/colors";
import {
  DATE_OPTIONS,
  STATUS_FILTERS,
  dateFilterLabel,
  type DateFilter,
  type StatusFilter,
} from "../utils/jobOrderFilters";
import { CalendarIcon, CaretDownIcon } from "./BmsIcons";
import { DatePickerModal } from "./DatePickerModal";
import { OptionPickerModal } from "./OptionPickerModal";

interface JobOrderFiltersProps {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  date: DateFilter;
  onDateChange: (date: DateFilter) => void;
  resultCount: number;
}

/** Status chips (All / Pending / Ongoing / Done) plus the date filter button. */
export function JobOrderFilters({ status, onStatusChange, date, onDateChange, resultCount }: JobOrderFiltersProps) {
  const [picker, setPicker] = useState<"options" | "calendar" | null>(null);
  const dateActive = date.kind !== "ALL";

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {STATUS_FILTERS.map(({ key, label }) => {
          const active = key === status;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onStatusChange(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {status === "ONGOING" ? (
        <View style={styles.dateRow}>
          <View style={styles.todayNote}>
            <CalendarIcon size={20} color={COLORS.navy} />
            <Text style={styles.todayNoteText}>Ongoing job orders are for today only</Text>
          </View>
          <Text style={styles.resultCount}>
            {resultCount} job order{resultCount === 1 ? "" : "s"}
          </Text>
        </View>
      ) : (
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={[styles.dateButton, dateActive && styles.dateButtonActive]}
            onPress={() => setPicker("options")}
            accessibilityRole="button"
            accessibilityLabel={`Date filter, ${dateFilterLabel(date)}`}
          >
            <CalendarIcon size={20} color={dateActive ? "#ffffff" : COLORS.navy} />
            <Text style={[styles.dateButtonText, dateActive && styles.dateButtonTextActive]} numberOfLines={1}>
              {dateFilterLabel(date)}
            </Text>
            <CaretDownIcon size={14} color={dateActive ? "#ffffff" : COLORS.text} />
          </TouchableOpacity>
          {dateActive ? (
            <TouchableOpacity style={styles.clearButton} onPress={() => onDateChange({ kind: "ALL" })} accessibilityRole="button">
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.resultCount}>
            {resultCount} job order{resultCount === 1 ? "" : "s"}
          </Text>
        </View>
      )}

      <OptionPickerModal
        visible={picker === "options"}
        title="Show job orders for"
        options={DATE_OPTIONS}
        value={date.kind === "DATE" ? "PICK" : date.kind}
        onSelect={(key) => {
          if (key === "PICK") {
            // Open the calendar after the option list has closed (needed on iOS).
            setTimeout(() => setPicker("calendar"), 300);
          } else {
            onDateChange({ kind: key });
          }
        }}
        onClose={() => setPicker((current) => (current === "options" ? null : current))}
      />
      <DatePickerModal
        visible={picker === "calendar"}
        title="Choose a date"
        value={date.kind === "DATE" ? date.date : null}
        onSelect={(picked) => onDateChange({ kind: "DATE", date: picked })}
        onClose={() => setPicker(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 10, paddingTop: 18, paddingBottom: 12 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#eef0f5",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: COLORS.navy },
  chipText: { fontSize: 15, fontWeight: "700", color: COLORS.text, letterSpacing: 0.3 },
  chipTextActive: { color: "#ffffff" },

  dateRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  dateButton: {
    flexShrink: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    backgroundColor: "#ffffff",
  },
  dateButtonActive: { backgroundColor: COLORS.navy },
  dateButtonText: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: COLORS.navy },
  dateButtonTextActive: { color: "#ffffff" },
  clearButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 4 },
  clearText: { fontSize: 15, fontWeight: "700", color: COLORS.navy, textDecorationLine: "underline" },
  resultCount: { marginLeft: "auto", fontSize: 14, color: COLORS.muted },
  todayNote: {
    flexShrink: 1,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.navySoft,
  },
  todayNoteText: { flexShrink: 1, fontSize: 15, fontWeight: "700", color: COLORS.navy },
});
