import { useRef } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { COLORS } from "../constants/colors";
import { cleanPhLocalInput, spacePhLocal } from "../utils/phone";
import { PhoneIcon } from "./BmsIcons";

interface PhoneFieldProps {
  label: string;
  required?: boolean;
  /** The 10 digits after +63, e.g. "9171234567" (no spaces). */
  digits: string;
  onChangeDigits: (digits: string) => void;
  readOnly?: boolean;
  error?: string | null;
  highlighted?: boolean;
  onInputFocus?: (input: TextInput) => void;
  onInputBlur?: () => void;
}

/**
 * Philippine mobile number: a fixed "+63" box, then 10 digits (numbers only, nothing else can be
 * typed). Shown spaced as "917 123 4567"; the parent gets the bare digits.
 */
export function PhoneField({
  label,
  required,
  digits,
  onChangeDigits,
  readOnly,
  error,
  highlighted,
  onInputFocus,
  onInputBlur,
}: PhoneFieldProps) {
  const inputRef = useRef<TextInput>(null);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <View
        style={[
          styles.box,
          readOnly && styles.boxReadOnly,
          highlighted && styles.boxHighlighted,
          error ? styles.boxError : null,
        ]}
      >
        <View style={[styles.prefix, error ? styles.prefixError : null]}>
          <PhoneIcon size={20} color={COLORS.muted} />
          <Text style={styles.prefixText}>+63</Text>
        </View>
        <TextInput
          ref={inputRef}
          style={[styles.input, readOnly && styles.inputReadOnly]}
          value={spacePhLocal(digits)}
          onChangeText={(text) => onChangeDigits(cleanPhLocalInput(text))}
          editable={!readOnly}
          keyboardType="number-pad"
          autoComplete="tel-national"
          // 10 digits plus the two spaces of "917 123 4567"
          maxLength={12}
          placeholder="912 345 6789"
          placeholderTextColor={COLORS.faint}
          accessibilityLabel={`${label}, 10 digits after plus 63`}
          onFocus={() => inputRef.current && onInputFocus?.(inputRef.current)}
          onBlur={onInputBlur}
        />
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
  box: {
    flexDirection: "row",
    alignItems: "stretch",
    minHeight: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBackground,
    overflow: "hidden",
  },
  boxReadOnly: { backgroundColor: "#e9ecf2" },
  boxHighlighted: { borderColor: COLORS.gold, borderWidth: 2, backgroundColor: "#fdf6e3" },
  boxError: { borderColor: COLORS.danger, borderWidth: 1.5 },
  prefix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: "#eef1f6",
  },
  prefixError: { borderRightColor: "#f3a5a5" },
  prefixText: { fontSize: 16, color: COLORS.text },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 14, fontSize: 16, color: COLORS.text },
  inputReadOnly: { color: COLORS.muted },
  error: { color: COLORS.danger, fontSize: 14, fontWeight: "600", marginTop: 6 },
});
