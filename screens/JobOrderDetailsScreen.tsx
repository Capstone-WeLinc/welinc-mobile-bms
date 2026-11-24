import type { ReactNode } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ChevronIcon } from "../components/BmsIcons";
import { StatusPill } from "../components/StatusPill";
import { COLORS } from "../constants/colors";
import type { JobOrder } from "../types/bms";
import { formatLongDate, formatTime12h } from "../utils/dates";
import { formatPeso } from "../utils/money";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow} accessibilityRole="header">
        <View style={styles.sectionTitleBar} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, align = "left", onPress }: { label: string; value: string; align?: "left" | "right"; onPress?: () => void }) {
  const valueText = (
    <Text style={[styles.value, align === "right" && styles.alignRight, onPress && styles.link]}>{value}</Text>
  );
  return (
    <View style={[styles.field, align === "right" && styles.fieldRight]}>
      <Text style={[styles.label, align === "right" && styles.alignRight]}>{label}</Text>
      {onPress ? (
        <TouchableOpacity onPress={onPress} accessibilityRole="link" accessibilityLabel={`${label}, ${value}. Tap to call.`}>
          {valueText}
        </TouchableOpacity>
      ) : (
        valueText
      )}
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

interface JobOrderDetailsScreenProps {
  jobOrder: JobOrder;
  onBack: () => void;
}

export function JobOrderDetailsScreen({ jobOrder: jo, onBack }: JobOrderDetailsScreenProps) {
  const total = jo.charges.reduce((sum, line) => sum + line.amount, 0);
  const callClient = () => void Linking.openURL(`tel:${jo.contactNumber.replace(/\s/g, "")}`);

  return (
    <View style={styles.container}>
      {/* Fixed header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back to job orders"
        >
          <ChevronIcon size={16} direction="left" color={COLORS.text} strokeWidth={2.4} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Job Order Details</Text>
          <Text style={styles.jobOrderNumber}>{jo.jobOrderNumber}</Text>
        </View>
        <StatusPill status={jo.status} size="large" />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Section title="Client Details">
          <Row>
            <Field label="Booking Number" value={jo.bookingNumber} />
          </Row>
          <Row>
            <Field label="Client" value={jo.clientName} />
          </Row>
          <Row>
            <Field label="Contact Number" value={jo.contactNumber} onPress={callClient} />
          </Row>
        </Section>

        <Section title="Schedule">
          <Row>
            <Field label="Date" value={formatLongDate(jo.date)} />
          </Row>
          <Row>
            <Field label="Pick-up Time" value={formatTime12h(jo.pickupTime)} />
            <Field label="Dispatch Time" value={formatTime12h(jo.dispatchTime)} align="right" />
          </Row>
        </Section>

        <Section title="Vehicle and Team">
          <Row>
            <Field label="Driver" value={jo.driverName} />
            <Field label="Garage" value={jo.garage} align="right" />
          </Row>
          <Row>
            <Field label="Vehicle" value={jo.vehicle} />
          </Row>
          <Row>
            <Field label="Helper/s" value={jo.helperNames.length ? jo.helperNames.join(", ") : "None"} />
          </Row>
        </Section>

        <Section title="Route">
          <View style={styles.route}>
            <View style={styles.routeLine}>
              <View style={[styles.routeDot, { backgroundColor: COLORS.navy }]} />
              <View style={styles.routeConnector} />
              <View style={[styles.routeDot, { backgroundColor: COLORS.gold }]} />
            </View>
            <View style={styles.routeStops}>
              <View>
                <Text style={styles.label}>Pickup Address</Text>
                <Text style={styles.value}>{jo.pickupAddress}</Text>
              </View>
              <View>
                <Text style={styles.label}>Drop-off Address</Text>
                <Text style={styles.value}>{jo.deliveryAddress}</Text>
              </View>
            </View>
          </View>
        </Section>

        <Section title="Job Details">
          <Row>
            <Field label="Est. No. of Items" value={String(jo.estimatedItems)} />
          </Row>
          <Row>
            <Field label="Item Description" value={jo.itemDescription} />
          </Row>
          <Row>
            <Field label="Customer Instruction" value={jo.customerInstruction} />
          </Row>
        </Section>

        <Section title="Insurance and Payment">
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Insurance</Text>
            <Text style={styles.lineValueBold}>{jo.insured ? "Yes" : "No"}</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Payment Method</Text>
            <Text style={styles.lineValueBold}>{jo.paymentMethod}</Text>
          </View>
        </Section>

        <Section title="Payment Details">
          {jo.charges.map((line) => (
            <View key={line.label} style={styles.lineRow}>
              <Text style={styles.lineLabel}>{line.label}</Text>
              <Text style={styles.lineValue}>{formatPeso(line.amount)}</Text>
            </View>
          ))}
          <View style={[styles.lineRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{formatPeso(total)}</Text>
          </View>
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#ffffff",
  },
  backButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.navy },
  jobOrderNumber: { fontSize: 16, fontWeight: "800", color: COLORS.gold, marginTop: 2 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36, gap: 14 },

  section: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitleBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.gold },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: COLORS.navy, textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1 },
  fieldRight: { alignItems: "flex-end" },
  label: { fontSize: 13, color: COLORS.muted, marginBottom: 2 },
  value: { fontSize: 16, fontWeight: "700", color: COLORS.navy, lineHeight: 22 },
  alignRight: { textAlign: "right" },
  link: { textDecorationLine: "underline" },

  route: { flexDirection: "row", gap: 12 },
  routeLine: { alignItems: "center", paddingTop: 22, paddingBottom: 24 },
  routeDot: { width: 12, height: 12, borderRadius: 6 },
  routeConnector: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 4 },
  routeStops: { flex: 1, gap: 16 },

  lineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  lineLabel: { flex: 1, fontSize: 15, color: COLORS.text, lineHeight: 21 },
  lineValue: { fontSize: 16, fontWeight: "600", color: COLORS.navy },
  lineValueBold: { fontSize: 16, fontWeight: "800", color: COLORS.navy },
  totalRow: { marginTop: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  totalLabel: { fontSize: 18, fontWeight: "800", color: COLORS.navy },
  totalValue: { fontSize: 20, fontWeight: "800", color: COLORS.navy },
});
