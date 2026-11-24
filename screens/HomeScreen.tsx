import { useCallback, useMemo, useState } from "react";
import type { ReactElement } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { MobilePageHeader } from "../components/MobilePageHeader";
import { COLORS } from "../constants/colors";
import {
  ArrowCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronIcon,
  ClockIcon,
  FormIcon,
  PinIcon,
  TruckIcon,
} from "../components/BmsIcons";
import { StatusPill } from "../components/StatusPill";
import { useJobOrdersStore, useMyJobOrders } from "../stores/jobOrdersStore";
import type { TeamMember, JobOrder } from "../types/bms";
import {
  MONTH_ABBR,
  MONTH_NAMES,
  WEEKDAY_SHORT,
  buildMonthGrid,
  formatLongDate,
  formatTime12h,
  toDateKey,
} from "../utils/dates";



interface HomeScreenProps {
  user: TeamMember;
  onOpenBooking?: (booking: JobOrder) => void;
  onLoadingChange?: (loading: boolean) => void;
}

function OverviewTile({
  icon,
  iconBackground,
  value,
  label,
}: {
  icon: ReactElement;
  iconBackground: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.tile}>
      <View style={[styles.tileIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.tileText}>
        <Text style={styles.tileValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.tileLabel} numberOfLines={2}>{label}</Text>
      </View>
    </View>
  );
}

function BookingCard({ booking, onPress }: { booking: JobOrder; onPress?: () => void }) {
  return (
    <TouchableOpacity
      style={styles.bookingCard}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.jobOrderNumber}, ${booking.clientName}, pick-up ${formatTime12h(booking.pickupTime)}, ${booking.status.toLowerCase()}`}
    >
      <View style={styles.timeBox}>
        <Text style={styles.timeValue}>{formatTime12h(booking.pickupTime)}</Text>
        <Text style={styles.timeLabel}>Pick-up Time</Text>
      </View>

      <View style={styles.bookingBody}>
        <Text style={styles.jobOrder}>{booking.jobOrderNumber}</Text>
        <Text style={styles.client} numberOfLines={1}>{booking.clientName}</Text>
        <Text style={styles.route} numberOfLines={1}>
          {booking.pickupArea} - {booking.deliveryArea}
        </Text>
      </View>

      <View style={styles.bookingSide}>
        <StatusPill status={booking.status} />
        <ChevronIcon size={24} color={COLORS.text} />
      </View>
    </TouchableOpacity>
  );
}

export function HomeScreen({ user, onOpenBooking, onLoadingChange }: HomeScreenProps) {
  const todayKey = toDateKey(new Date());
  const tomorrowKey = toDateKey(new Date(Date.now() + 86_400_000));
  const bookings = useMyJobOrders();
  const refreshJobOrders = useJobOrdersStore((s) => s.refresh);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [refreshing, setRefreshing] = useState(false);

  const bookingDays = useMemo(() => new Set(bookings.map((b) => b.date)), [bookings]);

  const todaysBookings = useMemo(
    () => bookings.filter((b) => b.date === todayKey),
    [bookings, todayKey],
  );

  const overview = useMemo(() => {
    const nextPickup = todaysBookings
      .filter((b) => b.status !== "COMPLETED")
      .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime))[0];
    return {
      assigned: todaysBookings.length,
      pending: todaysBookings.filter((b) => b.status === "PENDING").length,
      ongoing: todaysBookings.filter((b) => b.status === "ONGOING").length,
      completed: todaysBookings.filter((b) => b.status === "COMPLETED").length,
      formsDue: bookings.filter((b) => b.status === "ONGOING" && !b.postServiceFormSubmitted).length,
      tomorrow: bookings.filter((b) => b.date === tomorrowKey).length,
      nextPickup: nextPickup ? formatTime12h(nextPickup.pickupTime) : "—",
    };
  }, [bookings, todaysBookings, tomorrowKey]);

  const selectedBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => a.pickupTime.localeCompare(b.pickupTime)),
    [bookings, selectedDate],
  );

  const grid = useMemo(
    () => buildMonthGrid(visibleMonth.year, visibleMonth.month),
    [visibleMonth],
  );

  const changeMonth = (delta: number) => {
    setVisibleMonth(({ year, month }) => {
      const next = new Date(year, month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const goToToday = () => {
    const now = new Date();
    setVisibleMonth({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(toDateKey(now));
  };

  const selectDay = (key: string, inMonth: boolean) => {
    setSelectedDate(key);
    if (!inMonth) {
      const [y, m] = key.split("-").map(Number);
      setVisibleMonth({ year: y, month: m - 1 });
    }
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    onLoadingChange?.(true);
    try {
      await refreshJobOrders();
    } finally {
      setRefreshing(false);
      onLoadingChange?.(false);
    }
  }, [onLoadingChange, refreshJobOrders]);

  const weeks: typeof grid[] = [];
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7));

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          colors={[COLORS.navy, COLORS.gold]}
          tintColor={COLORS.navy}
        />
      }
    >
      <MobilePageHeader
        title="Home"
        subtitle={`Hi, ${user.name}. Here's your schedule and tasks at a glance.`}
      />

      {/* Overview */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <Text style={styles.sectionMeta}>Today</Text>
      </View>

      <View style={styles.tileGrid}>
        <OverviewTile icon={<TruckIcon size={24} color={COLORS.navy} />} iconBackground={COLORS.navySoft} value={String(overview.assigned)} label="Bookings Assigned" />
        <OverviewTile icon={<ClockIcon size={24} color="#d48806" strokeWidth={1.8} />} iconBackground="#fdefd2" value={String(overview.pending)} label="Pending" />
        <OverviewTile icon={<ArrowCircleIcon size={24} color={COLORS.navy} />} iconBackground={COLORS.navySoft} value={String(overview.ongoing)} label="Ongoing" />
        <OverviewTile icon={<CheckCircleIcon size={24} />} iconBackground="#dcf3e3" value={String(overview.completed)} label="Completed" />
        {/* Post-service completion is for drivers only; helpers see tomorrow's bookings instead. */}
        {user.role === "driver" ? (
          <OverviewTile icon={<FormIcon size={24} />} iconBackground="#fadcdc" value={String(overview.formsDue)} label="Post-service forms due" />
        ) : (
          <OverviewTile icon={<CalendarIcon size={24} color="#be185d" />} iconBackground="#fbe0ec" value={String(overview.tomorrow)} label="Bookings tomorrow" />
        )}
        <OverviewTile icon={<PinIcon size={24} />} iconBackground="#ece3fb" value={overview.nextPickup} label="Next pickup" />
      </View>

      {/* Calendar */}
      <View style={styles.calendarCard}>
        <View style={styles.calendarHeader}>
          <TouchableOpacity style={styles.monthArrow} onPress={() => changeMonth(-1)} accessibilityLabel="Previous month">
            <ChevronIcon size={22} direction="left" color={COLORS.navy} />
          </TouchableOpacity>
          <Text
            style={styles.monthTitle}
            accessibilityLabel={`${MONTH_NAMES[visibleMonth.month]} ${visibleMonth.year}`}
          >
            {MONTH_ABBR[visibleMonth.month]} <Text style={styles.yearText}>{visibleMonth.year}</Text>
          </Text>
          <TouchableOpacity style={styles.monthArrow} onPress={() => changeMonth(1)} accessibilityLabel="Next month">
            <ChevronIcon size={22} color={COLORS.navy} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayButtonText}>Today</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAY_SHORT.map((day) => (
            <Text key={day} style={styles.weekday}>{day}</Text>
          ))}
        </View>

        {weeks.map((week, index) => (
          <View key={index} style={styles.weekRow}>
            {week.map((cell) => {
              const selected = cell.key === selectedDate;
              const hasBookings = bookingDays.has(cell.key);
              const isToday = cell.key === todayKey;
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={styles.dayCell}
                  onPress={() => selectDay(cell.key, cell.inMonth)}
                  accessibilityLabel={`${formatLongDate(cell.key)}${hasBookings ? ", has bookings" : ""}`}
                >
                  <View style={[styles.dayInner, selected && styles.daySelected, !selected && isToday && styles.dayToday]}>
                    <Text
                      style={[
                        styles.dayText,
                        !cell.inMonth && styles.dayOutside,
                        hasBookings && cell.inMonth && styles.dayBold,
                        selected && styles.dayTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                    <View
                      style={[
                        styles.dot,
                        hasBookings ? (selected ? styles.dotSelected : styles.dotActive) : null,
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Bookings for the selected day */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Bookings · {formatLongDate(selectedDate)}</Text>
        <Text style={styles.sectionMeta}>
          {selectedBookings.length} booking{selectedBookings.length === 1 ? "" : "s"}
        </Text>
      </View>

      {selectedBookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No bookings assigned on this day.</Text>
        </View>
      ) : (
        selectedBookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} onPress={() => onOpenBooking?.(booking)} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: COLORS.navy, flexShrink: 1 },
  sectionMeta: { fontSize: 16, fontWeight: "600", color: COLORS.text, marginLeft: 8 },

  tileGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  tile: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  tileIcon: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tileText: { flex: 1 },
  tileValue: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  tileLabel: { fontSize: 14, lineHeight: 18, color: COLORS.text, marginTop: 2 },

  calendarCard: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
  },
  calendarHeader: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 10 },
  monthArrow: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.navySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { flex: 1, textAlign: "center", fontSize: 21, fontWeight: "800", color: COLORS.navy },
  yearText: { color: "#6b74ad", fontWeight: "700" },
  todayButton: {
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: "center",
  },
  todayButtonText: { color: COLORS.navy, fontSize: 16, fontWeight: "700" },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 13, fontWeight: "600", color: "#8790a3", marginBottom: 10 },
  dayCell: { flex: 1, alignItems: "center", paddingVertical: 3 },
  dayInner: {
    width: "94%",
    maxWidth: 52,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  daySelected: { backgroundColor: COLORS.navy },
  dayToday: { borderWidth: 1.5, borderColor: COLORS.navy },
  dayText: { fontSize: 17, color: COLORS.text },
  dayOutside: { color: COLORS.faint },
  dayBold: { fontWeight: "800" },
  dayTextSelected: { color: "#ffffff", fontWeight: "800" },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 3, backgroundColor: "transparent" },
  dotActive: { backgroundColor: COLORS.text },
  dotSelected: { backgroundColor: COLORS.gold },

  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  timeBox: {
    width: 84,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: COLORS.navySoft,
    alignItems: "center",
  },
  timeValue: { fontSize: 16, fontWeight: "800", color: COLORS.navy },
  timeLabel: { fontSize: 11, color: COLORS.muted, marginTop: 2 },
  bookingBody: { flex: 1, marginLeft: 14 },
  jobOrder: { fontSize: 18, fontWeight: "800", color: COLORS.navy },
  client: { fontSize: 16, fontWeight: "700", color: COLORS.navy, marginTop: 3 },
  route: { fontSize: 15, color: COLORS.navy, marginTop: 6 },
  bookingSide: { alignItems: "flex-end", justifyContent: "space-between", alignSelf: "stretch", gap: 14, marginLeft: 8 },

  emptyCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyText: { color: COLORS.muted, fontSize: 16 },
});
