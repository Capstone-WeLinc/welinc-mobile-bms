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

import { EyeIcon, EyeOffIcon } from "../components/BmsIcons";
import { CODE_LENGTH, CodeInput } from "../components/CodeInput";
import { SEEDER_ACCOUNTS } from "../seeders/user";
import {
  USE_SEEDER_AUTH,
  authService,
  isEmailVerificationChallenge,
  type EmailVerificationChallenge,
} from "../services/AuthService";
import type { TeamMember } from "../types/bms";

interface LoginScreenProps {
  onAuthenticated: (user: TeamMember) => void | Promise<void>;
  onBack: () => void;
  onForgotPassword: () => void;
}

const welincLogo = require("../assets/welinc_logo.jpg");
const movingTrucks = require("../assets/trucks_moving.gif");
const RESEND_SECONDS = 60;

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Same look as the VRMS/VMMS sign-in screen, for BMS drivers and helpers. */
export function LoginScreen({ onAuthenticated, onBack, onForgotPassword }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Set when shared auth asks for the 6 digit code emailed to an unverified address.
  const [challenge, setChallenge] = useState<EmailVerificationChallenge | null>(null);
  const [code, setCode] = useState("");
  const [resendWait, setResendWait] = useState(0);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendWait <= 0) return;
    const timer = setTimeout(() => setResendWait((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendWait]);

  const login = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const result = await authService.login(email, password);
      if (isEmailVerificationChallenge(result)) {
        setChallenge(result);
        setCode("");
        setResendWait(RESEND_SECONDS);
        return;
      }
      await onAuthenticated(result);
    } catch (loginError) {
      setError(message(loginError, "Unable to sign in."));
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async () => {
    if (!challenge || loading || code.length !== CODE_LENGTH) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await onAuthenticated(await authService.verifyEmail(challenge.challengeId, code));
    } catch (verifyError) {
      setError(message(verifyError, "Unable to verify the code."));
      setCode("");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!challenge || loading || resendWait > 0) return;
    setError(null);
    setInfo(null);
    try {
      await authService.resendEmailCode(challenge.challengeId);
      setCode("");
      setResendWait(RESEND_SECONDS);
      setInfo("We sent a new code. The old one no longer works.");
    } catch (resendError) {
      setError(message(resendError, "Unable to send a new code."));
    }
  };

  const cancelVerification = () => {
    setChallenge(null);
    setCode("");
    setError(null);
    setInfo(null);
    setResendWait(0);
  };

  if (challenge) {
    return (
      <View style={styles.screen}>
        <Image accessibilityLabel="WeLinc delivery trucks" source={movingTrucks} style={styles.trucksBackground} resizeMode="cover" />
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView contentContainerStyle={styles.cardArea} keyboardShouldPersistTaps="handled">
            <View style={styles.card}>
              <TouchableOpacity
                accessibilityLabel="Back to sign in"
                accessibilityRole="button"
                disabled={loading}
                onPress={cancelVerification}
                style={styles.backButton}
              >
                <Text style={styles.backButtonText}>{"< Back to Sign In"}</Text>
              </TouchableOpacity>

              <View style={styles.logoTile}>
                <Image source={welincLogo} style={styles.logo} resizeMode="cover" />
              </View>

              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.subtitle}>
                Enter the 6 digit code sent to <Text style={styles.strong}>{challenge.email}</Text>. You only need to do this once.
              </Text>

              <Text style={styles.label}>Code</Text>
              <CodeInput
                accessibilityLabel="6-digit verification code"
                editable={!loading}
                onChange={(value) => {
                  setCode(value);
                  setError(null);
                }}
                onSubmit={() => void verifyEmail()}
                value={code}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {info ? <Text style={styles.info}>{info}</Text> : null}

              <Pressable
                accessibilityRole="button"
                disabled={loading || code.length !== CODE_LENGTH}
                onPress={() => void verifyEmail()}
                style={({ pressed }) => [
                  styles.button,
                  (pressed || loading || code.length !== CODE_LENGTH) && styles.buttonPressed,
                ]}
              >
                {loading ? <ActivityIndicator color="#101958" /> : <Text style={styles.buttonText}>Verify and sign in</Text>}
              </Pressable>

              <TouchableOpacity
                accessibilityRole="button"
                disabled={loading || resendWait > 0}
                onPress={() => void resendCode()}
                style={styles.resendButton}
              >
                <Text style={[styles.forgotPassword, resendWait > 0 && styles.disabledLink]}>
                  {resendWait > 0 ? `Resend code in ${resendWait} s` : "Resend code"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Image accessibilityLabel="WeLinc delivery trucks" source={movingTrucks} style={styles.trucksBackground} resizeMode="cover" />
      {/* "padding" on both platforms: the app is edge-to-edge, so Android doesn't resize for the keyboard. */}
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.cardArea} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <TouchableOpacity
              accessibilityLabel="Back to splash screen"
              accessibilityRole="button"
              disabled={loading}
              onPress={onBack}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>{"< Back"}</Text>
            </TouchableOpacity>

            <View style={styles.logoTile}>
              <Image source={welincLogo} style={styles.logo} resizeMode="cover" />
            </View>

            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>Enter your credentials to access your workspace</Text>

            <Text style={styles.label}>
              Email Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!loading}
              keyboardType="email-address"
              onChangeText={(text) => {
                setEmail(text);
                setError(null);
              }}
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="juandelacruz@welinc.ph"
              placeholderTextColor="#64708d"
              returnKeyType="next"
              style={styles.input}
              value={email}
              accessibilityLabel="Email address"
            />

            <View style={styles.passwordLabelRow}>
              <Text style={styles.label}>
                Password <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setError(null);
                  setInfo(null);
                  if (USE_SEEDER_AUTH) {
                    setInfo("Password reset needs the server. Seeder accounts use the password shown below.");
                    return;
                  }
                  onForgotPassword();
                }}
                accessibilityRole="button"
                disabled={loading}
                hitSlop={8}
              >
                <Text style={styles.forgotPassword}>Forgot password?</Text>
              </TouchableOpacity>
            </View>
            <View>
              <TextInput
                ref={passwordRef}
                autoCapitalize="none"
                autoComplete="password"
                autoCorrect={false}
                editable={!loading}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                onSubmitEditing={() => void login()}
                placeholder="Enter your password"
                placeholderTextColor="#64708d"
                returnKeyType="go"
                secureTextEntry={!showPassword}
                style={[styles.input, styles.passwordInput]}
                value={password}
                accessibilityLabel="Password"
              />
              <TouchableOpacity
                accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                accessibilityRole="button"
                disabled={loading}
                onPress={() => setShowPassword((value) => !value)}
                style={styles.eyeButton}
              >
                {showPassword ? <EyeOffIcon size={24} color="#4b5578" /> : <EyeIcon size={24} color="#4b5578" />}
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {info ? <Text style={styles.info}>{info}</Text> : null}

            <Pressable
              disabled={loading}
              onPress={() => void login()}
              style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
              accessibilityRole="button"
            >
              {loading ? <ActivityIndicator color="#101958" /> : <Text style={styles.buttonText}>Sign In</Text>}
            </Pressable>

            {USE_SEEDER_AUTH ? (
              <View style={styles.seederBox}>
                <Text style={styles.seederTitle}>Test mode: seeder accounts</Text>
                {SEEDER_ACCOUNTS.map(({ user, password: seederPassword }) => (
                  <TouchableOpacity
                    key={user.email}
                    onPress={() => {
                      setEmail(user.email);
                      setPassword(seederPassword);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Fill in the seeder ${user.role} account`}
                  >
                    <Text style={styles.seederLine}>
                      <Text style={styles.seederRole}>{user.role === "driver" ? "Driver" : "Helper"}: </Text>
                      {user.email} / {seederPassword}
                    </Text>
                  </TouchableOpacity>
                ))}
                <Text style={styles.seederHint}>Tap an account to fill it in.</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

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
  label: { color: "#d9dcec", fontSize: 15, fontWeight: "700", marginBottom: 8 },
  required: { color: "#f4c400" },
  input: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#eaf0ff",
    color: "#14192d",
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 16,
  },
  passwordLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  forgotPassword: { color: "#f4c400", fontSize: 14, fontWeight: "600", marginBottom: 8 },
  passwordInput: { paddingRight: 56 },
  eyeButton: { position: "absolute", right: 4, top: 0, height: 52, width: 48, alignItems: "center", justifyContent: "center" },
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
  error: { color: "#fecaca", fontSize: 15, lineHeight: 21, marginTop: -6, marginBottom: 16 },
  info: { color: "#d9dcec", fontSize: 15, lineHeight: 21, marginTop: -6, marginBottom: 16 },
  strong: { color: "#ffffff", fontWeight: "700" },
  resendButton: { alignSelf: "center", marginTop: 14, minHeight: 44, justifyContent: "center" },
  disabledLink: { color: "rgba(255,255,255,0.45)" },
  seederBox: { marginTop: 18, borderRadius: 12, borderWidth: 1, borderColor: "#3b4380", padding: 12, gap: 6 },
  seederTitle: { color: "#f4c400", fontSize: 14, fontWeight: "800" },
  seederLine: { color: "#d9dcec", fontSize: 14, lineHeight: 22 },
  seederRole: { fontWeight: "800" },
  seederHint: { color: "#8e96bd", fontSize: 13 },
  trucksBackground: { position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 170 },
});
