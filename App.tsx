import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  BellIcon,
  ClockIcon,
  DocumentIcon,
  HomeIcon,
  ListIcon,
  ProfileIcon,
} from "./components/BmsIcons";
import { HomeScreen } from "./screens/HomeScreen";
import { AvailabilityScreen } from "./screens/AvailabilityScreen";
import { JobOrdersScreen } from "./screens/JobOrdersScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { PostServiceScreen } from "./screens/PostServiceScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { ForgotPasswordScreen } from "./screens/ForgotPasswordScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { SplashScreen } from "./screens/SplashScreen";
import { initializeDatabase } from "./database/database";
import { authService } from "./services/AuthService";
import { syncService } from "./services/SyncService";
import { useAvailabilityStore } from "./stores/availabilityStore";
import { useJobOrdersStore } from "./stores/jobOrdersStore";
import { useUserStore } from "./stores/userStore";
import { useNotificationsStore, useUnreadCount } from "./stores/notificationsStore";

type TabKey = "home" | "availability" | "job-orders" | "forms" | "notifications" | "profile";

const ACTIVE_ICON = "#d4a93f";
const INACTIVE_ICON = "#b8c0e0";

const TABS: Array<{
  key: TabKey;
  label: string;
  Icon: (props: { color: string; size?: number }) => ReactElement;
}> = [
  { key: "home", label: "Home", Icon: HomeIcon },
  { key: "availability", label: "Set Availability", Icon: ClockIcon },
  { key: "job-orders", label: "Job Orders", Icon: ListIcon },
  { key: "forms", label: "Post Service Completion", Icon: DocumentIcon },
  { key: "notifications", label: "Notifications", Icon: BellIcon },
  { key: "profile", label: "Profile", Icon: ProfileIcon },
];


export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  // Job order to open directly (set when a booking is tapped on Home).
  const [openJobOrderId, setOpenJobOrderId] = useState<string | null>(null);
  // Bumped on every tab press so tapping a tab always returns to that page's start.
  const [navKey, setNavKey] = useState(0);
  const user = useUserStore((s) => s.user);
  const unreadCount = useUnreadCount();
  const loadNotificationsFor = useNotificationsStore((s) => s.loadForUser);
  const refreshJobOrders = useJobOrdersStore((s) => s.refresh);
  const loadAvailabilityFor = useAvailabilityStore((s) => s.loadForUser);
  // Post Service Completion is for drivers only.
  const isDriver = user?.role === "driver";
  const visibleTabs = TABS.filter((tab) => tab.key !== "forms" || isDriver);
  const setUser = useUserStore((s) => s.setUser);
  const [restoring, setRestoring] = useState(true);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Load the signed-in user's data from SQLite. Notifications are built from job orders, so they load after.
  useEffect(() => {
    if (restoring || databaseError) return;
    if (!user) {
      void loadNotificationsFor(null);
      return;
    }
    (async () => {
      await Promise.all([refreshJobOrders(), loadAvailabilityFor(user.id)]);
      await loadNotificationsFor(user);
    })().catch((error) => console.error("[App] Failed to load local data", error));
  }, [user, restoring, databaseError, refreshJobOrders, loadAvailabilityFor, loadNotificationsFor]);

  // Sync again whenever the app comes back to the foreground (e.g. after the driver regains signal).
  useEffect(() => {
    if (!user || restoring || databaseError) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshJobOrders();
    });
    return () => subscription.remove();
  }, [user, restoring, databaseError, refreshJobOrders]);

  // Open the local SQLite database, and sign back in automatically if a session was saved on this phone.
  useEffect(() => {
    let mounted = true;
    const restore = authService.restoreSession().catch(() => null);
    Promise.all([initializeDatabase(), restore])
      .then(([, restored]) => mounted && setUser(restored))
      .catch((error) => {
        console.error("[App] Startup failed", error);
        if (mounted) setDatabaseError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => mounted && setRestoring(false));
    return () => {
      mounted = false;
    };
  }, [setUser]);

  /** Switch tabs and open a job order there (details on Job Orders, the form on Post Service). */
  const openJobOrderIn = (tab: "job-orders" | "forms", jobOrderId: string) => {
    setOpenJobOrderId(jobOrderId);
    setActiveTab(tab);
    setNavKey((k) => k + 1);
  };

  const goToTab = (key: TabKey) => {
    setOpenJobOrderId(null);
    setActiveTab(key);
    setNavKey((k) => k + 1);
  };

  if (restoring) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#f4c400" />
        </View>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  if (databaseError) {
    return (
      <SafeAreaProvider>
        <View style={styles.loading}>
          <Text style={styles.errorTitle}>Unable to initialize offline storage.</Text>
          <Text style={styles.errorDetails}>{databaseError}</Text>
        </View>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  if (showSplash) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.splash}>
          <SplashScreen onContinue={() => setShowSplash(false)} />
        </SafeAreaView>
        <StatusBar style="light" />
      </SafeAreaProvider>
    );
  }

  if (!user) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.signIn}>
          {showForgotPassword ? (
            <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />
          ) : (
            <LoginScreen
              onAuthenticated={async (signedIn) => {
                // A different team member on this phone must not see the previous user's cached data.
                await syncService.prepareFor(signedIn.id);
                setUser(signedIn);
                goToTab("home");
              }}
              onBack={() => setShowSplash(true)}
              onForgotPassword={() => setShowForgotPassword(true)}
            />
          )}
        </SafeAreaView>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <View style={styles.tabBar}>
          {visibleTabs.map(({ key, label, Icon }) => {
            const isActive = key === activeTab;
            return (
              <TouchableOpacity
                key={key}
                style={styles.tabButton}
                onPress={() => goToTab(key)}
                accessibilityRole="tab"
                accessibilityLabel={key === "notifications" && unreadCount > 0 ? `${label}, ${unreadCount} unread` : label}
                accessibilityState={{ selected: isActive }}
                activeOpacity={0.8}
              >
                <View>
                  <Icon size={30} color={isActive ? ACTIVE_ICON : INACTIVE_ICON} />
                  {key === "notifications" && unreadCount > 0 ? (
                    <View style={styles.tabBadge}>
                      <Text style={styles.tabBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <SafeAreaView style={styles.body} edges={["bottom"]}>
          {activeTab === "home" ? (
            <HomeScreen
              key={navKey}
              user={user}
              onOpenBooking={(jobOrder) => openJobOrderIn("job-orders", jobOrder.id)}
            />
          ) : activeTab === "availability" ? (
            <AvailabilityScreen key={navKey} />
          ) : activeTab === "job-orders" ? (
            <JobOrdersScreen key={navKey} initialJobOrderId={openJobOrderId} />
          ) : activeTab === "forms" && isDriver ? (
            <PostServiceScreen key={navKey} initialJobOrderId={openJobOrderId} />
          ) : activeTab === "notifications" ? (
            <NotificationsScreen
              key={navKey}
              onOpenNotification={(notification) => {
                if (!notification.jobOrderId) return;
                openJobOrderIn(notification.type === "REMINDER" && isDriver ? "forms" : "job-orders", notification.jobOrderId);
              }}
            />
          ) : (
            <ProfileScreen key={navKey} />
          )}
        </SafeAreaView>
      </SafeAreaView>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#070b45" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#101958", padding: 24 },
  errorTitle: { color: "#ffffff", fontSize: 16, fontWeight: "800", textAlign: "center" },
  errorDetails: { color: "#b8c0e0", fontSize: 13, marginTop: 8, textAlign: "center" },
  splash: { flex: 1, backgroundColor: "#101958" },
  signIn: { flex: 1, backgroundColor: "#ffffff" },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#070b45",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tabBadge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: "#dc2626",
    borderWidth: 2,
    borderColor: "#070b45",
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: { color: "#ffffff", fontSize: 11, fontWeight: "800" },
  tabButton: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 52 },
  body: { flex: 1, backgroundColor: "#ffffff" },
});
