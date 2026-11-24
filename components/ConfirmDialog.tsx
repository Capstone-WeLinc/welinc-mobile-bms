import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/colors";

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ visible, title, message, confirmLabel, variant = "primary", onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, variant === "danger" ? styles.danger : styles.primary]}
              onPress={onConfirm}
              accessibilityRole="button"
            >
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", alignItems: "center", justifyContent: "center", padding: 16 },
  dialog: { width: "100%", maxWidth: 420, backgroundColor: "#ffffff", borderRadius: 14, padding: 22 },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.navy },
  message: { fontSize: 16, lineHeight: 23, color: COLORS.text, marginTop: 10 },
  actions: { flexDirection: "row", gap: 12, marginTop: 22 },
  button: { flex: 1, minHeight: 50, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  cancel: { borderWidth: 1.5, borderColor: COLORS.navy },
  cancelText: { color: COLORS.navy, fontSize: 16, fontWeight: "700" },
  primary: { backgroundColor: COLORS.navy },
  danger: { backgroundColor: "#c62828" },
  confirmText: { color: "#ffffff", fontSize: 16, fontWeight: "700", textAlign: "center" },
});
