import { StyleSheet, Text, View } from "react-native";

import type { BookingStatus } from "../types/bms";

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "PENDING",
  ONGOING: "ONGOING",
  COMPLETED: "DONE",
};

const STATUS_STYLES: Record<BookingStatus, { color: string; background: string; border: string }> = {
  PENDING: { color: "#b45309", background: "#fff7e6", border: "#f5c46b" },
  ONGOING: { color: "#1d6fd8", background: "#e8f2ff", border: "#7db3f5" },
  COMPLETED: { color: "#15803d", background: "#eaf8ef", border: "#86d19f" },
};

export function StatusPill({ status, size = "small" }: { status: BookingStatus; size?: "small" | "large" }) {
  const colors = STATUS_STYLES[status];
  return (
    <View style={[styles.pill, size === "large" && styles.pillLarge, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Text style={[styles.text, size === "large" && styles.textLarge, { color: colors.color }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  pillLarge: { paddingHorizontal: 14, paddingVertical: 5 },
  text: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4 },
  textLarge: { fontSize: 14 },
});
