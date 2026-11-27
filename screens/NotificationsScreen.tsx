import { useCallback, useState } from "react";
import type { ReactElement } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { BellIcon, CheckIcon, ClockIcon, ListIcon } from "../components/BmsIcons";
import { MobilePageHeader } from "../components/MobilePageHeader";
import { COLORS } from "../constants/colors";
import { isVisibleTo, useMyNotifications, useNotificationsStore } from "../stores/notificationsStore";
import { useCurrentUser } from "../stores/userStore";
import type { AppNotification, NotificationType } from "../types/bms";
import { formatRelativeTime } from "../utils/dates";

const TYPE_BADGES: Record<NotificationType, { color: string; icon: ReactElement }> = {
  ASSIGNMENT: { color: "#2563eb", icon: <ListIcon size={12} color="#ffffff" strokeWidth={2.4} /> },
  SCHEDULE_CHANGE: { color: "#f59e0b", icon: <ClockIcon size={12} color="#ffffff" strokeWidth={2.4} /> },
  REMINDER: { color: "#dc2626", icon: <BellIcon size={12} color="#ffffff" strokeWidth={2.4} /> },
  COMPLETED: { color: "#2563eb", icon: <CheckIcon size={12} /> },
  ACCOUNT: { color: "#16a34a", icon: <CheckIcon size={12} /> },
};

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function NotificationRow({ notification, onPress }: { notification: AppNotification; onPress: () => void }) {
  const badge = TYPE_BADGES[notification.type];
  const plainText = notification.message.map((p) => p.text).join("");
  const time = formatRelativeTime(notification.createdAt);

  return (
    <TouchableOpacity
      style={[styles.row, !notification.read && styles.rowUnread]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${notification.read ? "" : "Unread. "}${plainText} ${time}`}
    >
      <View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(notification.actorName)}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.color }]}>{badge.icon}</View>
      </View>

      <View style={styles.body}>
        <Text style={styles.message}>
          {notification.message.map((part, index) => (
            <Text key={index} style={part.bold ? styles.bold : undefined}>
              {part.text}
            </Text>
          ))}
        </Text>
        <Text style={[styles.time, !notification.read && styles.timeUnread]}>{time}</Text>
      </View>

      {!notification.read ? <View style={styles.unreadDot} /> : null}
    </TouchableOpacity>
  );
}

interface NotificationsScreenProps {
  /** Called when a notification about a job order or a profile change is tapped. */
  onOpenNotification: (notification: AppNotification) => void;
  onLoadingChange?: (loading: boolean) => void;
}

export function NotificationsScreen({ onOpenNotification, onLoadingChange }: NotificationsScreenProps) {
  const role = useCurrentUser().role;
  const allNotifications = useMyNotifications();
  const notifications = allNotifications.filter((n) => isVisibleTo(n, role));
  const refreshNotifications = useNotificationsStore((s) => s.refresh);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [refreshing, setRefreshing] = useState(false);

  const sorted = [...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = sorted.filter((n) => !n.read);
  const read = sorted.filter((n) => n.read);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    onLoadingChange?.(true);
    try {
      await refreshNotifications();
    } finally {
      setRefreshing(false);
      onLoadingChange?.(false);
    }
  }, [onLoadingChange, refreshNotifications]);

  const open = (notification: AppNotification) => {
    markRead(notification.id);
    if (notification.jobOrderId || notification.profileField) onOpenNotification(notification);
  };

  const renderSection = (title: string, items: AppNotification[]) =>
    items.length > 0 ? (
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        {items.map((n) => (
          <NotificationRow key={n.id} notification={n} onPress={() => open(n)} />
        ))}
      </View>
    ) : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} colors={[COLORS.navy, COLORS.gold]} tintColor={COLORS.navy} />
      }
    >
      <View style={styles.headerWrap}>
        <MobilePageHeader title="Notifications" subtitle="Stay updated on new assignments, changes, and reminders." />

        <View style={styles.filterRow}>
          {(["ALL", "UNREAD"] as const).map((key) => {
            const active = key === filter;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {key === "ALL" ? "All" : `Unread${unread.length ? ` (${unread.length})` : ""}`}
                </Text>
              </TouchableOpacity>
            );
          })}
          {unread.length > 0 ? (
            <TouchableOpacity style={styles.markAll} onPress={markAllRead} accessibilityRole="button">
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {renderSection("New", unread)}
      {filter === "ALL" ? renderSection("Earlier", read) : null}

      {(filter === "UNREAD" ? unread.length : sorted.length) === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            {filter === "UNREAD" ? "You're all caught up. No unread notifications." : "No notifications yet."}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingTop: 20, paddingBottom: 36 },
  headerWrap: { paddingHorizontal: 18 },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 18, paddingBottom: 6 },
  chip: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#eef0f5",
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: COLORS.navy },
  chipText: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  chipTextActive: { color: "#ffffff" },
  markAll: { marginLeft: "auto", minHeight: 42, justifyContent: "center" },
  markAllText: { fontSize: 15, fontWeight: "700", color: COLORS.navy, textDecorationLine: "underline" },

  section: { marginTop: 18 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: COLORS.navy, paddingHorizontal: 18, marginBottom: 8 },

  // Rows run edge to edge so the unread highlight spans the full width, as in the design.
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingVertical: 14 },
  rowUnread: { backgroundColor: "#eaf0fd" },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "#1f2a6b",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 17, fontWeight: "800" },
  badge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  message: { fontSize: 16, lineHeight: 22, color: COLORS.text },
  bold: { fontWeight: "800" },
  time: { fontSize: 14, color: COLORS.muted, marginTop: 4 },
  timeUnread: { color: "#2563eb", fontWeight: "700" },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563eb" },

  empty: {
    marginTop: 18,
    marginHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  emptyText: { color: COLORS.muted, fontSize: 16, textAlign: "center" },
});
