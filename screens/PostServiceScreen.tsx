import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { CheckIcon } from "../components/BmsIcons";
import { JobOrderCard } from "../components/JobOrderCard";
import { JobOrderFilters } from "../components/JobOrderFilters";
import { MobilePageHeader } from "../components/MobilePageHeader";
import { COLORS } from "../constants/colors";
import { useJobOrdersStore, useMyJobOrders } from "../stores/jobOrdersStore";
import type { JobOrder } from "../types/bms";
import { emptyFilterMessage, filterJobOrders, type DateFilter, type StatusFilter } from "../utils/jobOrderFilters";
import { PostServiceFormScreen } from "./PostServiceFormScreen";

/** Only ongoing job orders can be edited. Submitting the record marks the job as done. */
function CardFooter({ jobOrder, onEdit }: { jobOrder: JobOrder; onEdit: () => void }) {
  if (jobOrder.status === "COMPLETED") {
    return (
      <View style={styles.footer}>
        <View style={styles.submitted}>
          <View style={styles.submittedIcon}>
            <CheckIcon size={12} />
          </View>
          <Text style={styles.submittedText}>Record submitted · Job done</Text>
        </View>
      </View>
    );
  }

  const canEdit = jobOrder.status === "ONGOING";
  return (
    <View style={styles.footer}>
      <Text style={styles.footerNote}>{canEdit ? "Fill this out once the service is done." : "Available once the job is ongoing."}</Text>
      <TouchableOpacity
        style={[styles.editButton, !canEdit && styles.editButtonDisabled]}
        onPress={onEdit}
        disabled={!canEdit}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canEdit }}
      >
        <Text style={[styles.editButtonText, !canEdit && styles.editButtonTextDisabled]}>Edit Post-Service Record</Text>
      </TouchableOpacity>
    </View>
  );
}

interface PostServiceScreenProps {
  /** Open this job order's form right away (e.g. from a reminder notification). Only ongoing jobs open. */
  initialJobOrderId?: string | null;
  onLoadingChange?: (loading: boolean) => void;
}

export function PostServiceScreen({ initialJobOrderId, onLoadingChange }: PostServiceScreenProps) {
  const jobOrders = useMyJobOrders();
  const records = useJobOrdersStore((s) => s.postServiceRecords);
  const refreshJobOrders = useJobOrdersStore((s) => s.refresh);
  const saveRecord = useJobOrdersStore((s) => s.savePostServiceRecord);

  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [date, setDate] = useState<DateFilter>({ kind: "ALL" });
  const [editingId, setEditingId] = useState<string | null>(() =>
    initialJobOrderId && jobOrders.find((jo) => jo.id === initialJobOrderId)?.status === "ONGOING" ? initialJobOrderId : null,
  );
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const openForm = (id: string) => {
    setSavedMessage(null);
    setEditingId(id);
  };

  const editing = editingId ? jobOrders.find((jo) => jo.id === editingId) : undefined;
  if (editing) {
    return (
      <PostServiceFormScreen
        key={editing.id}
        jobOrder={editing}
        existingRecord={records[editing.id]}
        onBack={() => setEditingId(null)}
        onSubmit={async (record) => {
          await saveRecord(record);
          setEditingId(null);
          setSavedMessage(`Post-service record submitted. ${editing.jobOrderNumber} is now Done.`);
        }}
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
      <MobilePageHeader title="Post Service Completion" subtitle="Submit complete booking details once a service is completed." />

      <JobOrderFilters status={status} onStatusChange={setStatus} date={date} onDateChange={setDate} resultCount={visible.length} />

      {savedMessage ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{savedMessage}</Text>
        </View>
      ) : null}

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyFilterMessage(status, date)}</Text>
        </View>
      ) : (
        visible.map((jo) => (
          <JobOrderCard
            key={jo.id}
            jobOrder={jo}
            actionLabel={jo.status === "ONGOING" ? "Edit post-service record." : ""}
            onPress={jo.status === "ONGOING" ? () => openForm(jo.id) : undefined}
            footer={<CardFooter jobOrder={jo} onEdit={() => openForm(jo.id)} />}
          />
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitted: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  submittedIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
  },
  submittedText: { fontSize: 14, fontWeight: "700", color: COLORS.success },
  footerNote: { flex: 1, fontSize: 14, lineHeight: 19, color: COLORS.muted },
  editButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonDisabled: { backgroundColor: "#e5e8ef" },
  editButtonText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },
  editButtonTextDisabled: { color: "#8a93a6" },

  successBanner: { backgroundColor: "#eaf8ef", borderRadius: 10, padding: 14, marginBottom: 14 },
  successText: { color: COLORS.success, fontSize: 15, fontWeight: "700" },

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
