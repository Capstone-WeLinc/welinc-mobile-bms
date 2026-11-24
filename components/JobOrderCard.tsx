import type { ReactNode } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/colors";
import type { JobOrder } from "../types/bms";
import { formatDayMonth, formatTime12h } from "../utils/dates";
import { ChevronIcon } from "./BmsIcons";
import { StatusPill } from "./StatusPill";

interface JobOrderCardProps {
  jobOrder: JobOrder;
  /** Leave out to make the card not tappable. */
  onPress?: () => void;
  /** Screen-reader hint for what tapping the card does, e.g. "View details." */
  actionLabel: string;
  /** Bottom of the card. Defaults to a "View Details ›" row. */
  footer?: ReactNode;
}

/** Job order summary card used by the Job Orders and Post Service lists. */
export function JobOrderCard({ jobOrder, onPress, actionLabel, footer }: JobOrderCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${jobOrder.jobOrderNumber}, ${jobOrder.clientName}. ${actionLabel}`}
    >
      <View style={styles.cardTop}>
        <Text style={styles.jobOrderNumber}>{jobOrder.jobOrderNumber}</Text>
        <StatusPill status={jobOrder.status} />
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoCol}>
          <Text style={styles.label}>Client</Text>
          <Text style={styles.value} numberOfLines={1}>{jobOrder.clientName}</Text>
        </View>
        <View style={[styles.infoCol, styles.infoColRight]}>
          <Text style={styles.label}>Date and Time</Text>
          <Text style={[styles.value, styles.alignRight]}>
            {formatDayMonth(jobOrder.date)} · {formatTime12h(jobOrder.pickupTime)}
          </Text>
        </View>
      </View>

      <View style={styles.stops}>
        <View style={styles.stop}>
          <View style={[styles.dot, { backgroundColor: COLORS.navy }]} />
          <Text style={styles.stopText} numberOfLines={2}>{jobOrder.pickupAddress}</Text>
        </View>
        <View style={styles.stop}>
          <View style={[styles.dot, { backgroundColor: COLORS.gold }]} />
          <Text style={styles.stopText} numberOfLines={2}>{jobOrder.deliveryAddress}</Text>
        </View>
      </View>

      {footer ?? (
        <View style={styles.defaultFooter}>
          <Text style={styles.viewDetails}>View Details</Text>
          <ChevronIcon size={22} color={COLORS.text} />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 14,
    backgroundColor: "#ffffff",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  jobOrderNumber: { fontSize: 19, fontWeight: "800", color: COLORS.navy },

  infoRow: { flexDirection: "row", gap: 12, marginTop: 14 },
  infoCol: { flex: 1 },
  infoColRight: { alignItems: "flex-end" },
  label: { fontSize: 13, color: COLORS.muted, marginBottom: 2 },
  value: { fontSize: 16, fontWeight: "800", color: COLORS.navy },
  alignRight: { textAlign: "right" },

  stops: { gap: 8, marginTop: 14 },
  stop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  stopText: { flex: 1, fontSize: 15, lineHeight: 21, color: COLORS.navy },

  defaultFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  viewDetails: { fontSize: 16, fontWeight: "800", color: COLORS.navy },
});
