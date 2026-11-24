import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export const CODE_LENGTH = 6;

interface CodeInputProps {
  value: string;
  onChange: (code: string) => void;
  onSubmit?: () => void;
  editable?: boolean;
  accessibilityLabel: string;
}

/**
 * A 6 digit code entry: six boxes over one hidden text field, so paste and the
 * phone's "fill code from email/SMS" suggestion both work. Same look as the VRMS/VMMS app.
 */
export const CodeInput = forwardRef<TextInput, CodeInputProps>(function CodeInput(
  { value, onChange, onSubmit, editable = true, accessibilityLabel },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.slots}>
        {Array.from({ length: CODE_LENGTH }, (_, index) => (
          <View key={index} style={[styles.slot, index === Math.min(value.length, CODE_LENGTH - 1) && styles.slotActive]}>
            <Text style={styles.slotText}>{value[index] ?? ""}</Text>
          </View>
        ))}
      </View>
      <TextInput
        ref={ref}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoComplete="one-time-code"
        autoFocus
        editable={editable}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, CODE_LENGTH))}
        onSubmitEditing={onSubmit}
        selectionColor="#e8b800"
        style={styles.input}
        textContentType="oneTimeCode"
        value={value}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { height: 52, marginBottom: 16, justifyContent: "center" },
  slots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  slot: {
    width: 42,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d4dced",
    backgroundColor: "#eaf0ff",
    alignItems: "center",
    justifyContent: "center",
  },
  slotActive: { borderColor: "#f4c400", borderWidth: 2 },
  slotText: { color: "#14192d", fontSize: 22, fontWeight: "700" },
  // Covers the boxes so a tap anywhere focuses it; nearly invisible so the boxes show through.
  input: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, color: "transparent", opacity: 0.02 },
});
