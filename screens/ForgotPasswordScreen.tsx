import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { CheckCircleIcon, EyeIcon, EyeOffIcon } from "../components/BmsIcons";
import { CODE_LENGTH, CodeInput } from "../components/CodeInput";
import { authService } from "../services/AuthService";
import { PASSWORD_RULES, meetsPasswordRules } from "../utils/passwordRules";

interface ForgotPasswordScreenProps {
  /** Back to the sign-in screen. */
  onBack: () => void;
}

type RecoveryStep = "request" | "verify" | "newPassword" | "complete";

const RESEND_SECONDS = 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const welincLogo = require("../assets/welinc_logo.jpg");
const movingTrucks = require("../assets/trucks_moving.gif");

function isInvalidResetCode(error: unknown): boolean {
  return error instanceof Error && /invalid or expired|expired|invalid code|otp/i.test(error.message);
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Reset a forgotten password with a 6 digit code from shared auth, in three steps:
 * email → code → new password. Same flow as the VRMS/VMMS app.
 */
export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [step, setStep] = useState<RecoveryStep>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendWait, setResendWait] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const codeInputRef = useRef<TextInput>(null);
  const cleanEmail = email.trim().toLowerCase();
  const passwordOk = meetsPasswordRules(newPassword);

  useEffect(() => {
    if (resendWait <= 0) return;
    const timer = setTimeout(() => setResendWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendWait]);

  useEffect(() => {
    if (step === "verify" && !loading && error) codeInputRef.current?.focus();
  }, [step, loading, error]);

  const requestResetCode = async () => {
    if (loading) return;
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await authService.requestPasswordReset(cleanEmail);
      setOtp("");
      setStep("verify");
      setResendWait(RESEND_SECONDS);
    } catch (requestError) {
      setError(message(requestError, "We couldn't send the code. Check your connection and try again."));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (loading || otp.length !== CODE_LENGTH) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await authService.verifyPasswordResetCode(cleanEmail, otp);
      setStep("newPassword");
    } catch (verifyError) {
      if (isInvalidResetCode(verifyError)) {
        setError("That code isn't right or has expired. Check it, or send a new one.");
        setOtp("");
      } else {
        setError(message(verifyError, "We couldn't check the code. Check your connection and try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (resending || loading || resendWait > 0) return;
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      await authService.requestPasswordReset(cleanEmail);
      setOtp("");
      setResendWait(RESEND_SECONDS);
      setNotice("We sent a new code. The old one no longer works.");
    } catch (resendError) {
      setError(message(resendError, "We couldn't send the code. Check your connection and try again."));
    } finally {
      setResending(false);
    }
  };

  const resetPassword = async () => {
    if (loading) return;
    setError(null);
    if (!passwordOk) {
      setError("Your new password doesn't meet all the requirements.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword({ email: cleanEmail, otp, newPassword });
      setStep("complete");
    } catch (resetError) {
      if (isInvalidResetCode(resetError)) {
        // The code ran out while the person was typing: go back and get a new one.
        setOtp("");
        setStep("verify");
        setError("That code expired. Send a new one, then set your password.");
      } else {
        setError(message(resetError, "We couldn't change your password. Check your connection and try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const changeEmail = () => {
    setStep("request");
    setOtp("");
    setError(null);
    setNotice(null);
    setResendWait(0);
  };

  const errorBox = error ? (
    <View accessibilityRole="alert" style={styles.errorNotice}>
      <Text style={styles.errorText}>{error}</Text>
    </View>
  ) : null;

  return (
    <View style={styles.screen}>
      <Image accessibilityLabel="WeLinc delivery trucks" source={movingTrucks} style={styles.trucksBackground} resizeMode="cover" />
      {/* "padding" on both platforms: the app is edge-to-edge, so Android doesn't resize for the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.cardArea} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            {step !== "complete" ? (
              <TouchableOpacity
                accessibilityLabel="Back to sign in"
                accessibilityRole="button"
                disabled={loading}
                onPress={onBack}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>{"< Back to Sign In"}</Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.logoTile}>
              <Image source={welincLogo} style={styles.logo} resizeMode="cover" />
            </View>

            {step === "request" ? (
              <>
                <Text style={styles.title}>Reset your password</Text>
                <Text style={styles.subtitle}>Enter your email and we will send you a 6 digit code.</Text>
                {errorBox}
                <Text style={styles.label}>Email</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  editable={!loading}
                  keyboardType="email-address"
                  onChangeText={(text) => {
                    setEmail(text);
                    setError(null);
                  }}
                  onSubmitEditing={() => void requestResetCode()}
                  placeholder="you@welinc.com"
                  placeholderTextColor="#64708d"
                  returnKeyType="send"
                  style={styles.input}
                  value={email}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => void requestResetCode()}
                  style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
                >
                  {loading ? <ActivityIndicator color="#101958" /> : <Text style={styles.buttonText}>Send code</Text>}
                </Pressable>
              </>
            ) : null}

            {step === "verify" ? (
              <>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>
                  If <Text style={styles.strong}>{cleanEmail}</Text> has a WeLinc account, we sent it a 6 digit code.
                </Text>
                {notice ? (
                  <View style={styles.successNotice}>
                    <Text style={styles.successText}>{notice}</Text>
                  </View>
                ) : null}
                {errorBox}
                <Text style={styles.label}>Code</Text>
                <CodeInput
                  ref={codeInputRef}
                  accessibilityLabel="6-digit reset code"
                  editable={!loading}
                  onChange={(value) => {
                    setOtp(value);
                    setError(null);
                  }}
                  onSubmit={() => void verifyCode()}
                  value={otp}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={loading || otp.length !== CODE_LENGTH}
                  onPress={() => void verifyCode()}
                  style={({ pressed }) => [
                    styles.button,
                    (pressed || loading || otp.length !== CODE_LENGTH) && styles.buttonPressed,
                  ]}
                >
                  {loading ? <ActivityIndicator color="#101958" /> : <Text style={styles.buttonText}>Verify</Text>}
                </Pressable>
                <View style={styles.secondaryActions}>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={resendWait > 0 || resending || loading}
                    onPress={() => void resendCode()}
                    style={styles.secondaryButton}
                  >
                    <Text style={[styles.highlightLink, (resendWait > 0 || resending) && styles.disabledLink]}>
                      {resendWait > 0 ? `Resend code in ${resendWait} s` : resending ? "Sending…" : "Resend code"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={changeEmail}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryLink}>Use a different email</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : null}

            {step === "newPassword" ? (
              <>
                <Text style={styles.title}>Set a new password</Text>
                <Text style={styles.subtitle}>
                  For <Text style={styles.highlightText}>{cleanEmail}</Text>.
                </Text>
                {errorBox}
                <Text style={styles.label}>New password</Text>
                <View>
                  <TextInput
                    accessibilityLabel="New password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    autoCorrect={false}
                    editable={!loading}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      setError(null);
                    }}
                    placeholder="New password"
                    placeholderTextColor="#64708d"
                    secureTextEntry={!showNewPassword}
                    style={[styles.input, styles.passwordInput]}
                    value={newPassword}
                  />
                  <TouchableOpacity
                    accessibilityLabel={showNewPassword ? "Hide new password" : "Show new password"}
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={() => setShowNewPassword((shown) => !shown)}
                    style={styles.eyeButton}
                  >
                    {showNewPassword ? <EyeOffIcon size={24} color="#4b5578" /> : <EyeIcon size={24} color="#4b5578" />}
                  </TouchableOpacity>
                </View>

                {newPassword.length > 0 ? (
                  <View style={styles.rules}>
                    {PASSWORD_RULES.map((rule) => {
                      const met = rule.test(newPassword);
                      return (
                        <View
                          key={rule.label}
                          accessible
                          accessibilityLabel={`${rule.label}: ${met ? "met" : "not met"}`}
                          style={styles.ruleRow}
                        >
                          {met ? <CheckCircleIcon size={18} color="#79b86b" /> : <View style={styles.ruleDot} />}
                          <Text style={[styles.ruleText, met && styles.ruleMet]}>{rule.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                <Text style={styles.label}>Confirm password</Text>
                <View>
                  <TextInput
                    accessibilityLabel="Confirm new password"
                    autoCapitalize="none"
                    autoComplete="new-password"
                    autoCorrect={false}
                    editable={!loading}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setError(null);
                    }}
                    onSubmitEditing={() => void resetPassword()}
                    placeholder="Confirm password"
                    placeholderTextColor="#64708d"
                    returnKeyType="done"
                    secureTextEntry={!showConfirmPassword}
                    style={[styles.input, styles.passwordInput]}
                    value={confirmPassword}
                  />
                  <TouchableOpacity
                    accessibilityLabel={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                    accessibilityRole="button"
                    disabled={loading}
                    onPress={() => setShowConfirmPassword((shown) => !shown)}
                    style={styles.eyeButton}
                  >
                    {showConfirmPassword ? <EyeOffIcon size={24} color="#4b5578" /> : <EyeIcon size={24} color="#4b5578" />}
                  </TouchableOpacity>
                </View>

                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => void resetPassword()}
                  style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
                >
                  {loading ? <ActivityIndicator color="#101958" /> : <Text style={styles.buttonText}>Change password</Text>}
                </Pressable>
              </>
            ) : null}

            {step === "complete" ? (
              <>
                <Text style={styles.title}>Password changed</Text>
                <Text style={styles.subtitle}>Sign in with your new password.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={onBack}
                  style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                  <Text style={styles.buttonText}>Sign in</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// Matches LoginScreen's card so the two screens feel like one flow.
const styles = StyleSheet.create({
  screen: { flex: 1, position: "relative", backgroundColor: "#ffffff" },
  flex: { flex: 1 },
  cardArea: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 22, paddingVertical: 24 },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#30376c",
    borderRadius: 24,
    backgroundColor: "#171c52",
    padding: 24,
    shadowColor: "#02051e",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
  backButton: { alignSelf: "flex-start", marginBottom: 18, paddingVertical: 6, paddingRight: 10 },
  backButtonText: { color: "#f4c400", fontSize: 16, fontWeight: "700" },
  logoTile: {
    alignSelf: "center",
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f4c400",
    borderWidth: 2,
    borderColor: "#f4c400",
    marginBottom: 16,
  },
  logo: { width: "100%", height: "100%", transform: [{ scale: 1.55 }] },
  title: { color: "#ffffff", fontSize: 28, lineHeight: 34, fontWeight: "900", letterSpacing: -0.45 },
  subtitle: { color: "#aeb5d2", fontSize: 16, lineHeight: 22, marginTop: 4, marginBottom: 20 },
  strong: { color: "#ffffff", fontWeight: "700" },
  highlightText: { color: "#f4c400" },
  label: { color: "#d9dcec", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    color: "#14192d",
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 16,
  },
  passwordInput: { paddingRight: 56 },
  eyeButton: { position: "absolute", right: 4, top: 0, height: 52, width: 48, alignItems: "center", justifyContent: "center" },
  rules: { marginTop: -6, marginBottom: 14, gap: 4 },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 22 },
  ruleDot: { width: 14, height: 14, marginHorizontal: 2, borderRadius: 7, borderWidth: 1.5, borderColor: "#7f89a6" },
  ruleText: { flex: 1, color: "#aeb5d2", fontSize: 13, lineHeight: 18 },
  ruleMet: { color: "#ffffff" },
  button: {
    borderRadius: 12,
    minHeight: 54,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4c400",
    shadowColor: "#f4c400",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonPressed: { opacity: 0.72 },
  buttonText: { color: "#101958", fontSize: 18, fontWeight: "900" },
  errorNotice: {
    borderWidth: 1,
    borderColor: "rgba(252,165,165,0.2)",
    borderRadius: 12,
    backgroundColor: "rgba(252,165,165,0.1)",
    padding: 14,
    marginBottom: 18,
  },
  errorText: { color: "#fecaca", fontSize: 15, lineHeight: 21 },
  successNotice: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    padding: 14,
    marginBottom: 18,
  },
  successText: { color: "rgba(255,255,255,0.75)", fontSize: 15, lineHeight: 21 },
  secondaryActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  secondaryButton: { minHeight: 44, justifyContent: "center", paddingVertical: 8 },
  highlightLink: { color: "#f4c400", fontSize: 15, fontWeight: "600" },
  secondaryLink: { color: "rgba(255,255,255,0.65)", fontSize: 15 },
  disabledLink: { color: "rgba(255,255,255,0.45)" },
  trucksBackground: { position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 170 },
});
