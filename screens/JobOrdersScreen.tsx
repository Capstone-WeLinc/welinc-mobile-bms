import { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { JobOrderCard } from "../components/JobOrderCard";
import { JobOrderFilters } from "../components/JobOrderFilters";
import { MobilePageHeader } from "../components/MobilePageHeader";
import { COLORS } from "../constants/colors";
import { useJobOrdersStore, useMyJobOrders } from "../stores/jobOrdersStore";
import { emptyFilterMessage, filterJobOrders, type DateFilter, type StatusFilter } from "../utils/jobOrderFilters";
import { JobOrderDetailsScreen } from "./JobOrderDetailsScreen";

interface JobOrdersScreenProps {
  /** Open this job order's details right away (e.g. when coming from Home). */
  initialJobOrderId?: string | null;
  /** True when initialJobOrderId was opened from a notification: Back on its details returns to Notifications. */
  fromNotification?: boolean;
  onBackToNotifications?: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function JobOrdersScreen({ initialJobOrderId, fromNotification = false, onBackToNotifications, onLoadingChange }: JobOrdersScreenProps) {
  const jobOrders = useMyJobOrders();
  const refreshJobOrders = useJobOrdersStore((s) => s.refresh);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [date, setDate] = useState<DateFilter>({ kind: "ALL" });
  const [selectedId, setSelectedId] = useState<string | null>(initialJobOrderId ?? null);
  // Only the job order opened by the notification goes back to Notifications; ones opened from this list don't.
  const [notificationEntryId, setNotificationEntryId] = useState<string | null>(
    fromNotification ? (initialJobOrderId ?? null) : null,
  );
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setSelectedId(initialJobOrderId ?? null);
  }, [initialJobOrderId]);

  const returnsToNotifications = selectedId !== null && selectedId === notificationEntryId && !!onBackToNotifications;
  const closeDetails = useCallback(() => {
    if (returnsToNotifications) onBackToNotifications?.();
    else setSelectedId(null);
  }, [returnsToNotifications, onBackToNotifications]);

  const openFromList = (id: string) => {
    setNotificationEntryId(null);
    setSelectedId(id);
  };

  // Android back button closes the details page instead of leaving the app.
  useEffect(() => {
    if (!selectedId) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      closeDetails();
      return true;
    });
    return () => sub.remove();
  }, [selectedId, closeDetails]);

  const visible = useMemo(() => filterJobOrders(jobOrders, status, date), [jobOrders, status, date]);

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

  const selected = selectedId ? jobOrders.find((jo) => jo.id === selectedId) : undefined;
  if (selected) {
    return (
      <JobOrderDetailsScreen
        jobOrder={selected}
        onBack={closeDetails}
        backLabel={returnsToNotifications ? "Back to notifications" : undefined}
      />
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[COLORS.navy, COLORS.gold]} tintColor={COLORS.navy} />
      }
    >
      <MobilePageHeader title="Job Orders" subtitle="View and manage your assigned bookings and delivery tasks." />

      <JobOrderFilters status={status} onStatusChange={setStatus} date={date} onDateChange={setDate} resultCount={visible.length} />

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyFilterMessage(status, date)}</Text>
        </View>
      ) : (
        visible.map((jo) => (
          <JobOrderCard key={jo.id} jobOrder={jo} actionLabel="View details." onPress={() => openFromList(jo.id)} />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },
  empty: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 28,
    alignItems: "center",
  },
  emptyText: { color: COLORS.muted, fontSize: 16 },
});
