import { Image, ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";

interface SplashScreenProps {
  onContinue: () => void;
}

const welincLogo = require("../assets/welinc_logo.jpg");

/** Same look as the VRMS/VMMS splash screen. Tap anywhere to continue. */
export function SplashScreen({ onContinue }: SplashScreenProps) {
  return (
    <Pressable accessibilityLabel="Open WeLinc Logistics. Tap to continue." accessibilityRole="button" onPress={onContinue} style={styles.touchTarget}>
      <ImageBackground source={welincLogo} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
        <View style={styles.overlay} />
        <View style={styles.content}>
          <View style={styles.brandRow}>
            <View style={styles.logoTile}>
              <Image source={welincLogo} style={styles.logo} resizeMode="cover" />
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>WeLinc Logistics</Text>
            <Text style={styles.heroTitle}>
              <Text style={styles.heroAccent}>Fleet Personnel</Text> Workspace
            </Text>
            <Text style={styles.heroSubtitle}>
              Your schedule, job orders, and post-service records in one place for WeLinc drivers and helpers.
            </Text>
          </View>

          <Text style={styles.tapHint}>Tap anywhere to continue</Text>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: { flex: 1 },
  background: { flex: 1, backgroundColor: "#101958" },
  backgroundImage: { opacity: 0.32, transform: [{ scale: 1.25 }] },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(12, 20, 82, 0.82)" },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 28, paddingBottom: 28 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  logoTile: { width: 48, height: 48, borderRadius: 12, overflow: "hidden", backgroundColor: "#f4c400", borderWidth: 2, borderColor: "#f4c400" },
  logo: { width: "100%", height: "100%", transform: [{ scale: 1.45 }] },
  hero: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 12 },
  heroTitle: { color: "#ffffff", fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.5, textAlign: "center" },
  heroAccent: { color: "#f4c400" },
  heroSubtitle: { maxWidth: 310, marginTop: 18, color: "#d4d9ee", fontSize: 16, lineHeight: 24, fontWeight: "500", textAlign: "center" },
  tapHint: { color: "#aeb5d2", fontSize: 15, fontWeight: "600", textAlign: "center" },
});
