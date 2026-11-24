import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/colors";
import { MONTH_ABBR, MONTH_NAMES, WEEKDAY_SHORT, buildMonthGrid, formatLongDate, fromDateKey, toDateKey } from "../utils/dates";
import { ChevronIcon } from "./BmsIcons";

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  /** Currently chosen date (YYYY-MM-DD) or null */
  value: string | null;
  /** Days before this date (YYYY-MM-DD) can't be picked */
  minDate?: string | null;
  onSelect: (dateKey: string) => void;
  onClose: () => void;
}

export function DatePickerModal({ visible, title, value, minDate, onSelect, onClose }: DatePickerModalProps) {
  const initial = value ?? minDate ?? toDateKey(new Date());
  const [month, setMonth] = useState(() => {
    const d = fromDateKey(initial);
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // Re-open on the month of the chosen date each time the picker is shown.
  useEffect(() => {
    if (!visible) return;
    const d = fromDateKey(value ?? minDate ?? toDateKey(new Date()));
    setMonth({ year: d.getFullYear(), month: d.getMonth() });
  }, [visible, value, minDate]);

  const grid = useMemo(() => buildMonthGrid(month.year, month.month), [month]);
  const weeks: typeof grid[] = [];
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));

  const todayKey = toDateKey(new Date());

  const changeMonth = (delta: number) =>
    setMonth(({ year, month: m }) => {
      const next = new Date(year, m + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.header}>
            <TouchableOpacity style={styles.arrow} onPress={() => changeMonth(-1)} accessibilityLabel="Previous month">
              <ChevronIcon size={22} direction="left" color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={styles.monthTitle} accessibilityLabel={`${MONTH_NAMES[month.month]} ${month.year}`}>
              {MONTH_ABBR[month.month]} <Text style={styles.yearText}>{month.year}</Text>
            </Text>
            <TouchableOpacity style={styles.arrow} onPress={() => changeMonth(1)} accessibilityLabel="Next month">
              <ChevronIcon size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            {WEEKDAY_SHORT.map((d) => (
              <Text key={d} style={styles.weekday}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, index) => (
            <View key={index} style={styles.row}>
              {week.map((cell) => {
                const disabled = Boolean(minDate && cell.key < minDate);
                const selected = cell.key === value;
                const isToday = cell.key === todayKey;
                return (
                  <TouchableOpacity
                    key={cell.key}
                    style={styles.cell}
                    disabled={disabled}
                    onPress={() => {
                      onSelect(cell.key);
                      onClose();
                    }}
                    accessibilityLabel={formatLongDate(cell.key)}
                    accessibilityState={{ disabled, selected }}
                  >
                    <View style={[styles.dayInner, selected && styles.daySelected, !selected && isToday && styles.dayToday]}>
                      <Text
                        style={[
                          styles.dayText,
                          !cell.inMonth && styles.dayOutside,
                          disabled && styles.dayDisabled,
                          selected && styles.dayTextSelected,
                        ]}
                      >
                        {cell.day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 18,
  },
  title: { fontSize: 19, fontWeight: "800", color: COLORS.navy, textAlign: "center", marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 10 },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.navySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "800", color: COLORS.navy },
  yearText: { color: "#6b74ad", fontWeight: "700" },
  row: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: "#8790a3", marginBottom: 8 },
  cell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  dayInner: { width: "94%", maxWidth: 48, height: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: COLORS.navy },
  dayToday: { borderWidth: 1.5, borderColor: COLORS.navy },
  dayText: { fontSize: 17, color: COLORS.text },
  dayOutside: { color: COLORS.faint },
  dayDisabled: { color: "#d3d8e0" },
  dayTextSelected: { color: "#ffffff", fontWeight: "800" },
  cancel: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 16, fontWeight: "700", color: COLORS.navy },
});
