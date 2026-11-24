import { useRef, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from "react-native";

import { COLORS } from "../constants/colors";
import { EyeIcon, EyeOffIcon } from "./BmsIcons";

interface FormFieldProps extends Omit<TextInputProps, "style" | "onFocus" | "onBlur"> {
  label: string;
  required?: boolean;
  /** Shown in red under the input */
  error?: string | null;
  /** Grey, non-editable field */
  readOnly?: boolean;
  onInputFocus?: (input: TextInput) => void;
  onInputBlur?: () => void;
  /** Hide the text and show an eye button to reveal it (for passwords). */
  password?: boolean;
}

/** Uppercase label + input + optional error, matching the app's form style. */
export function FormField({ label, required, error, readOnly, onInputFocus, onInputBlur, password, ...inputProps }: FormFieldProps) {
  const inputRef = useRef<TextInput>(null);
  const [revealed, setRevealed] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View>
        <TextInput
          ref={inputRef}
          style={[styles.input, password && styles.inputWithToggle, readOnly && styles.inputReadOnly, error ? styles.inputError : null]}
          editable={!readOnly}
          placeholderTextColor={COLORS.faint}
          accessibilityLabel={label}
          onFocus={() => inputRef.current && onInputFocus?.(inputRef.current)}
          onBlur={onInputBlur}
          {...inputProps}
          {...(password ? { secureTextEntry: !revealed, autoCapitalize: "none" as const, autoCorrect: false } : null)}
        />
        {password ? (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setRevealed((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={revealed ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          >
            {revealed ? <EyeOffIcon size={24} /> : <EyeIcon size={24} />}
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.muted,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  required: { color: COLORS.danger },
  input: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    fontSize: 16,
    color: COLORS.text,
  },
  inputWithToggle: { paddingRight: 54 },
  toggle: { position: "absolute", right: 0, top: 0, bottom: 0, width: 52, alignItems: "center", justifyContent: "center" },
  inputReadOnly: { backgroundColor: "#e9ecf2", color: COLORS.muted },
  inputError: { borderColor: COLORS.danger, borderWidth: 1.5 },
  error: { color: COLORS.danger, fontSize: 14, fontWeight: "600", marginTop: 6 },
});
