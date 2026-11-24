import { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { CheckIcon } from "../components/BmsIcons";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FormField } from "../components/FormField";
import { MobilePageHeader } from "../components/MobilePageHeader";
import { COLORS } from "../constants/colors";
import { useKeyboardAwareScroll } from "../hooks/useKeyboardAwareScroll";
import { useCurrentUser, useUserStore } from "../stores/userStore";
import type { TeamMember } from "../types/bms";
import { MONTH_NAMES, fromDateKey } from "../utils/dates";
import { PASSWORD_RULES, meetsPasswordRules } from "../utils/passwordRules";
import { formatPhMobile, normalizePhMobile } from "../utils/phone";

const ROLE_LABELS: Record<TeamMember["role"], string> = { driver: "Driver", helper: "Helper" };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Message = { type: "success" | "error"; text: string } | null;

function initials(user: TeamMember): string {
  return `${user.firstName[0] ?? ""}${user.lastName.split(/\s+/).map((p) => p[0]).join("")}`.slice(0, 3).toUpperCase();
}

function formatJoined(dateKey: string): string {
  const d = fromDateKey(dateKey);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function WarningIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3 2 20.5h20L12 3Z" fill="#dc2626" />
      <Path d="M12 9.5v5" stroke="#ffffff" strokeWidth={2.2} strokeLinecap="round" />
      <Path d="M12 17.6v.1" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

function StatusMessage({ message }: { message: Message }) {
  if (!message) return null;
  return <Text style={message.type === "success" ? styles.successText : styles.errorText}>{message.text}</Text>;
}

const profileFormFrom = (user: TeamMember) => ({
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  phone: formatPhMobile(user.phone),
});

const EMPTY_PASSWORDS = { current: "", next: "", confirm: "" };

export function ProfileScreen() {
  const user = useCurrentUser();
  const signOut = useUserStore((s) => s.signOut);
  const updateProfile = useUserStore((s) => s.updateProfile);
  const changePassword = useUserStore((s) => s.changePassword);
  const requestAccountDeletion = useUserStore((s) => s.requestAccountDeletion);
  const deletionRequested = useUserStore((s) => s.deletionRequested);

  const keyboard = useKeyboardAwareScroll();
  const fieldFocus = { onInputFocus: keyboard.onInputFocus, onInputBlur: keyboard.onInputBlur };

  const [confirm, setConfirm] = useState<"signOut" | "delete" | null>(null);
  const [deletionMessage, setDeletionMessage] = useState<Message>(null);

  // ----- Personal details -----
  const [profile, setProfile] = useState(() => profileFormFrom(user));
  const [profileTried, setProfileTried] = useState(false);
  const [profileMessage, setProfileMessage] = useState<Message>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  const saved = profileFormFrom(user);
  const profileChanged = (Object.keys(saved) as Array<keyof typeof saved>).some((k) => profile[k].trim() !== saved[k]);
  const normalizedPhone = normalizePhMobile(profile.phone);
  const profileErrors = {
    firstName: !profile.firstName.trim() ? "This field is required" : null,
    lastName: !profile.lastName.trim() ? "This field is required" : null,
    email: !profile.email.trim()
      ? "This field is required"
      : !EMAIL_PATTERN.test(profile.email.trim())
        ? "Enter a valid email address"
        : null,
    phone: !profile.phone.trim()
      ? "This field is required"
      : !normalizedPhone
        ? "Enter a PH mobile number, e.g. 0917 123 4567"
        : null,
  };

  const editProfile = (patch: Partial<typeof profile>) => {
    setProfile((current) => ({ ...current, ...patch }));
    setProfileMessage(null);
  };

  const saveProfile = async () => {
    setProfileTried(true);
    if (Object.values(profileErrors).some(Boolean) || !normalizedPhone) return;
    setProfileSaving(true);
    try {
      await updateProfile({
        firstName: profile.firstName.trim(),
        lastName: profile.lastName.trim(),
        email: profile.email.trim(),
        phone: normalizedPhone,
      });
      setProfile({ ...profile, phone: formatPhMobile(normalizedPhone) });
      setProfileTried(false);
      setProfileMessage({ type: "success", text: "Personal details saved." });
    } catch (error) {
      setProfileMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to save personal details." });
    } finally {
      setProfileSaving(false);
    }
  };

  const cancelProfile = () => {
    setProfile(profileFormFrom(user));
    setProfileTried(false);
    setProfileMessage(null);
  };

  // ----- Password -----
  const [passwords, setPasswords] = useState(EMPTY_PASSWORDS);
  const [passwordTried, setPasswordTried] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const passwordTyped = Object.values(passwords).some((v) => v.length > 0);
  const passwordErrors = {
    current: !passwords.current ? "This field is required" : null,
    next: !passwords.next
      ? "This field is required"
      : !meetsPasswordRules(passwords.next)
        ? "Password doesn't meet all the rules below"
        : passwords.next === passwords.current
          ? "New password must be different from the current one"
          : null,
    confirm: !passwords.confirm ? "This field is required" : passwords.confirm !== passwords.next ? "Passwords do not match" : null,
  };
  // The rules checklist gives live feedback while typing; the red error under New password
  // only appears after tapping Update (or once a different mistake applies, like matching the current one).
  const showPasswordError = (key: keyof typeof passwordErrors) => {
    if (passwordTried) return passwordErrors[key];
    if (key === "next" && passwords.next.length > 0 && meetsPasswordRules(passwords.next)) return passwordErrors.next;
    if (key === "confirm" && passwords.confirm.length > 0) return passwordErrors.confirm;
    return null;
  };

  const editPasswords = (patch: Partial<typeof passwords>) => {
    setPasswords((current) => ({ ...current, ...patch }));
    setPasswordMessage(null);
  };

  const savePassword = async () => {
    setPasswordTried(true);
    if (Object.values(passwordErrors).some(Boolean)) return;
    setPasswordSaving(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords(EMPTY_PASSWORDS);
      setPasswordTried(false);
      setPasswordMessage({ type: "success", text: "Password updated." });
    } catch (error) {
      setPasswordMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to update password." });
    } finally {
      setPasswordSaving(false);
    }
  };

  const cancelPassword = () => {
    setPasswords(EMPTY_PASSWORDS);
    setPasswordTried(false);
    setPasswordMessage(null);
  };

  return (
    <View style={styles.flex}>
      <ScrollView
        ref={keyboard.scrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, keyboard.contentPaddingBottom > 0 && { paddingBottom: keyboard.contentPaddingBottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View ref={keyboard.contentRef} collapsable={false}>
          <MobilePageHeader title="Profile" subtitle="Manage your personal details and account settings." />

          {/* Identity card */}
          <View style={[styles.card, styles.identityCard]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(user)}</Text>
            </View>
            <Text style={styles.name}>{user.name}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{ROLE_LABELS[user.role].toUpperCase()}</Text>
            </View>
            <View style={styles.identityLines}>
              {user.employeeId ? <Text style={styles.identityLine}>{user.employeeId}</Text> : null}
              <Text style={styles.identityLine}>{user.email}</Text>
              {user.phone ? <Text style={styles.identityLine}>{formatPhMobile(user.phone)}</Text> : null}
              {user.joinedDate ? <Text style={styles.identityLine}>Joined {formatJoined(user.joinedDate)}</Text> : null}
            </View>
            <TouchableOpacity style={styles.signOutButton} onPress={() => setConfirm("signOut")} accessibilityRole="button">
              <Text style={styles.signOutText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          {/* Personal details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal Details</Text>
            <FormField
              label="First name"
              required
              value={profile.firstName}
              onChangeText={(firstName) => editProfile({ firstName })}
              autoCapitalize="words"
              error={profileTried ? profileErrors.firstName : null}
              {...fieldFocus}
            />
            <FormField
              label="Last name"
              required
              value={profile.lastName}
              onChangeText={(lastName) => editProfile({ lastName })}
              autoCapitalize="words"
              error={profileTried ? profileErrors.lastName : null}
              {...fieldFocus}
            />
            {/* Changing the email needs a code sent to the new address (shared auth); not in the app yet. */}
            <FormField
              label="Email address"
              required
              readOnly
              value={profile.email}
              autoCapitalize="none"
              keyboardType="email-address"
              error={profileTried ? profileErrors.email : null}
              {...fieldFocus}
            />
            <FormField
              label="Mobile number"
              required
              value={profile.phone}
              onChangeText={(phone) => editProfile({ phone })}
              keyboardType="phone-pad"
              placeholder="0917 123 4567"
              error={profileTried ? profileErrors.phone : null}
              {...fieldFocus}
            />
            <FormField label="Role" value={ROLE_LABELS[user.role]} readOnly />

            <StatusMessage message={profileMessage} />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, (!profileChanged || profileSaving) && styles.buttonDisabled]}
                onPress={cancelProfile}
                disabled={!profileChanged || profileSaving}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, (!profileChanged || profileSaving) && styles.buttonDisabled]}
                onPress={() => void saveProfile()}
                disabled={!profileChanged || profileSaving}
              >
                <Text style={styles.primaryButtonText}>{profileSaving ? "Saving..." : "Save Changes"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Password */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Password</Text>
            <FormField
              label="Current password"
              required
              value={passwords.current}
              onChangeText={(current) => editPasswords({ current })}
              placeholder="Enter your current password"
              password
              error={showPasswordError("current")}
              {...fieldFocus}
            />
            <FormField
              label="New password"
              required
              value={passwords.next}
              onChangeText={(next) => editPasswords({ next })}
              placeholder="Create a new password"
              password
              error={showPasswordError("next")}
              {...fieldFocus}
            />
            <View style={styles.rules} accessibilityLabel="Password rules">
              {PASSWORD_RULES.map((rule) => {
                const met = rule.test(passwords.next);
                return (
                  <View key={rule.label} style={styles.ruleRow} accessibilityLabel={`${rule.label}, ${met ? "met" : "not met"}`}>
                    <View style={[styles.ruleIcon, met ? styles.ruleIconMet : styles.ruleIconUnmet]}>
                      {met ? <CheckIcon size={12} /> : null}
                    </View>
                    <Text style={[styles.ruleText, met && styles.ruleTextMet]}>{rule.label}</Text>
                  </View>
                );
              })}
            </View>
            <FormField
              label="Confirm new password"
              required
              value={passwords.confirm}
              onChangeText={(confirmValue) => editPasswords({ confirm: confirmValue })}
              placeholder="Re-enter new password"
              password
              error={showPasswordError("confirm")}
              {...fieldFocus}
            />

            <StatusMessage message={passwordMessage} />
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, (!passwordTyped || passwordSaving) && styles.buttonDisabled]}
                onPress={cancelPassword}
                disabled={!passwordTyped || passwordSaving}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, (!passwordTyped || passwordSaving) && styles.buttonDisabled]}
                onPress={() => void savePassword()}
                disabled={!passwordTyped || passwordSaving}
              >
                <Text style={styles.primaryButtonText}>{passwordSaving ? "Updating..." : "Update Password"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Account deletion */}
          <View style={styles.card}>
            <View style={styles.dangerTitleRow}>
              <WarningIcon />
              <Text style={styles.cardTitleNoMargin}>Account Deletion</Text>
            </View>
            <Text style={styles.dangerText}>
              Requesting deletion notifies your administrator. Once approved, your account and job order records are
              permanently removed — this can't be undone.
            </Text>
            <StatusMessage message={deletionMessage} />
            <TouchableOpacity
              style={[styles.deleteButton, deletionRequested && styles.buttonDisabled]}
              onPress={() => setConfirm("delete")}
              disabled={deletionRequested}
              accessibilityRole="button"
            >
              <Text style={styles.deleteText}>{deletionRequested ? "Deletion requested" : "Request account deletion"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirm === "signOut"}
        title="Sign out?"
        message="You will be signed out on this phone. Your saved data stays on the phone until someone else signs in."
        confirmLabel="Sign out"
        variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void signOut();
        }}
      />
      <ConfirmDialog
        visible={confirm === "delete"}
        title="Request account deletion?"
        message="Your administrator will be notified to review this request. Once approved, your account can't be recovered."
        confirmLabel="Send request"
        variant="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          setConfirm(null);
          await requestAccountDeletion();
          setDeletionMessage({ type: "success", text: "Request sent. Your administrator will review it." });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: "#ffffff" },
  content: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 36 },

  card: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff",
  },
  cardTitle: { fontSize: 19, fontWeight: "800", color: COLORS.navy, marginBottom: 14 },
  cardTitleNoMargin: { fontSize: 19, fontWeight: "800", color: COLORS.navy },

  identityCard: { alignItems: "center", paddingVertical: 22 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "#1f2a6b",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#ffffff", fontSize: 28, fontWeight: "800" },
  name: { fontSize: 21, fontWeight: "800", color: COLORS.navy, marginTop: 12 },
  rolePill: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
  },
  rolePillText: { fontSize: 13, fontWeight: "800", color: COLORS.navy, letterSpacing: 0.8 },
  identityLines: { alignItems: "center", gap: 4, marginTop: 16 },
  identityLine: { fontSize: 16, color: COLORS.text },
  signOutButton: {
    marginTop: 18,
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#f3a5a5",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutText: { color: COLORS.danger, fontSize: 15, fontWeight: "700" },

  rules: { gap: 8, marginTop: -4, marginBottom: 16, paddingHorizontal: 2 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ruleIcon: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ruleIconMet: { backgroundColor: COLORS.success },
  ruleIconUnmet: { borderWidth: 2, borderColor: "#c3c9d6" },
  ruleText: { flex: 1, fontSize: 15, color: COLORS.muted },
  ruleTextMet: { color: COLORS.success, fontWeight: "600" },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 6 },
  primaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
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

  dangerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dangerText: { fontSize: 15, lineHeight: 22, color: COLORS.muted, marginTop: 8 },
  deleteButton: {
    marginTop: 16,
    alignSelf: "center",
    minHeight: 46,
    paddingHorizontal: 22,
    borderRadius: 10,
    backgroundColor: "#fde2e2",
    borderWidth: 1,
    borderColor: "#f3a5a5",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: COLORS.danger, fontSize: 15, fontWeight: "700" },

  successText: { color: COLORS.success, fontSize: 15, fontWeight: "700", marginBottom: 12, marginTop: 4 },
  errorText: { color: COLORS.danger, fontSize: 15, fontWeight: "700", marginBottom: 12, marginTop: 4 },
});
