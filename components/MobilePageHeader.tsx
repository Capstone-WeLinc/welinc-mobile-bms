import { StyleSheet, Text, View } from "react-native";

export function MobilePageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  title: { fontSize: 32, fontWeight: "800", color: "#0b1250" },
  subtitle: { color: "#475569", fontSize: 17, lineHeight: 24, marginTop: 4 },
});
