import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../constants/colors";
import { CheckIcon } from "./BmsIcons";

interface OptionPickerModalProps<T extends string> {
  visible: boolean;
  title: string;
  options: Array<{ key: T; label: string }>;
  value: T | null;
  onSelect: (key: T) => void;
  onClose: () => void;
}

export function OptionPickerModal<T extends string>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: OptionPickerModalProps<T>) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>{title}</Text>
          {options.map((option) => {
            const selected = option.key === value;
            return (
              <TouchableOpacity
                key={option.key}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => {
                  onSelect(option.key);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text>
                {selected ? (
                  <View style={styles.checkBadge}>
                    <CheckIcon size={14} />
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  sheet: { width: "100%", maxWidth: 420, backgroundColor: "#ffffff", borderRadius: 14, padding: 18 },
  title: { fontSize: 19, fontWeight: "800", color: COLORS.navy, marginBottom: 14 },
  option: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  optionSelected: { borderColor: COLORS.navy, borderWidth: 1.5, backgroundColor: COLORS.navySoft },
  optionText: { fontSize: 17, color: COLORS.text },
  optionTextSelected: { fontWeight: "700", color: COLORS.navy },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  cancel: {
    marginTop: 4,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 16, fontWeight: "700", color: COLORS.navy },
});
