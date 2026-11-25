import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal as RNModal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

// ---------------- Card ----------------
export const Card: React.FC<{ style?: any; children: React.ReactNode; onPress?: () => void; onLayout?: any; outline?: boolean }> = ({
  style,
  children,
  onPress,
  onLayout,
  outline,
}) => {
  const { colors } = useTheme();
  const cardStyle = [
    styles.card,
    outline
      ? { backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 2 }
      : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} onLayout={onLayout} style={cardStyle}>
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={cardStyle} onLayout={onLayout}>{children}</View>;
};

// ---------------- Badge ----------------
export const Badge: React.FC<{ color?: string; bg?: string; text?: string; children?: React.ReactNode; mono?: boolean }> = ({
  color,
  bg,
  text,
  children,
  mono,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: bg || colors.primarySoft }]}>
      {children}
      {text && (
        <Text style={{ color: color || colors.primary, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4, fontFamily: mono ? 'monospace' : undefined }}>
          {text}
        </Text>
      )}
    </View>
  );
};

// ---------------- SectionHeader ----------------
export const SectionHeader: React.FC<{ title: string; subtitle?: string; actionLabel?: string; onAction?: () => void }> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        {subtitle && <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {actionLabel && (
        <TouchableOpacity onPress={onAction}>
          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ---------------- StatCard ----------------
export const StatCard: React.FC<{ label: string; value: string; delta?: string; deltaColor?: string; icon: React.ReactNode; iconBg?: string; onPress?: () => void }> = ({
  label,
  value,
  delta,
  deltaColor,
  icon,
  iconBg,
  onPress,
}) => {
  const { colors } = useTheme();
  return (
    <Card style={styles.statCard} onPress={onPress}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
        {delta && <Text style={{ color: deltaColor || colors.success, fontSize: 11, fontWeight: '600' }}>{delta}</Text>}
      </View>
      <View style={[styles.statIcon, { backgroundColor: iconBg || colors.indigoSoft }]}>{icon}</View>
    </Card>
  );
};

// ---------------- ProgressBar ----------------
export const ProgressBar: React.FC<{ value: number; color?: string; trackColor?: string; height?: number }> = ({
  value,
  color,
  trackColor,
  height,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor || colors.surface, height: height || 8 }]}>
      <View style={[styles.progressFill, { backgroundColor: color || colors.primary, width: `${Math.max(0, Math.min(100, value))}%` }]} />
    </View>
  );
};

// ---------------- Modal ----------------
export const Modal: React.FC<{ visible: boolean; onClose: () => void; title?: string; subtitle?: string; children: React.ReactNode }> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
}) => {
  const { colors } = useTheme();
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(title || subtitle) && (
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1, paddingRight: 24 }}>
                {title && <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>}
                {subtitle && <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 2 }}>{subtitle}</Text>}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                <X size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          )}
          {children}
        </View>
      </View>
    </RNModal>
  );
};

// ---------------- Stepper ----------------
export const Stepper: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
}) => {
  const { colors } = useTheme();
  const amount = step || 1;
  const btn = (disabled: boolean) => ({
    backgroundColor: disabled ? colors.surface : colors.surfaceAlt,
    opacity: disabled ? 0.4 : 1,
  });
  return (
    <View style={styles.stepperRow}>
      <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '600', flex: 1 }}>{label}</Text>
      <View style={styles.stepperControl}>
        <TouchableOpacity onPress={() => onChange(Math.max(min, value - amount))} style={[styles.stepperBtn, btn(value <= min)]}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '800' }}>-</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: '800', minWidth: 32, textAlign: 'center' }}>{value}</Text>
        <TouchableOpacity onPress={() => onChange(Math.min(max, value + amount))} style={[styles.stepperBtn, btn(value >= max)]}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '800' }}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ---------------- SegmentedButtons ----------------
export const SegmentedButtons: React.FC<{
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}> = ({ options, value, onChange }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surface }]}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segmentItem, active ? { backgroundColor: colors.card, boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)', elevation: 1 } : null]}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: active ? colors.foreground : colors.mutedForeground }}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ---------------- Field ----------------
export const Field: React.FC<{
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
  onSubmitEditing?: () => void;
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
}> = ({ label, value, onChangeText, placeholder, multiline, secureTextEntry, keyboardType, onSubmitEditing, returnKeyType }) => {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 5 }}>
      {label && <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>{label}</Text>}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        onSubmitEditing={onSubmitEditing}
        returnKeyType={returnKeyType}
        style={[
          styles.fieldInput,
          multiline && { minHeight: 80, textAlignVertical: 'top' },
          { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.foreground },
        ]}
      />
    </View>
  );
};

// ---------------- EmptyState ----------------
export const EmptyState: React.FC<{ icon: React.ReactNode; title: string; subtitle?: string }> = ({ icon, title, subtitle }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={{ opacity: 0.6 }}>{icon}</View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      {subtitle && <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: 'center' }}>{subtitle}</Text>}
    </View>
  );
};

// ---------------- Primary/Outline buttons ----------------
export const PrimaryButton: React.FC<{ label: string; onPress?: () => void; loading?: boolean; disabled?: boolean; style?: any; color?: string; textColor?: string }> = ({
  label,
  onPress,
  loading,
  disabled,
  style,
  color,
  textColor,
}) => {
  const { colors } = useTheme();
  const bg = disabled ? colors.surface : color || colors.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.primaryBtn, { backgroundColor: bg }, disabled && { opacity: 0.6 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={textColor || '#fff'} size="small" />
      ) : (
        <Text style={{ color: disabled ? colors.mutedForeground : textColor || '#fff', fontSize: 14, fontWeight: '700' }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
};

export const OutlineButton: React.FC<{ label: string; onPress?: () => void; disabled?: boolean; style?: any; color?: string }> = ({
  label,
  onPress,
  disabled,
  style,
  color,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.outlineBtn, { borderColor: colors.border }, disabled && { opacity: 0.5 }, style]}
    >
      <Text style={{ color: color || colors.foreground, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  );
};

// ---------------- Loading ----------------
export const LoadingView: React.FC<{ label?: string }> = ({ label }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.loadingView}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 10 }}>{label || 'Loading...'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: 16, padding: 16, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)', elevation: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800' },
  statCard: { width: '30%', flexGrow: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 92 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { borderRadius: 99, overflow: 'hidden', width: '100%' },
  progressFill: { height: '100%', borderRadius: 99 },
  modalOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 460, borderRadius: 20, borderWidth: 1, padding: 18, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalClose: { padding: 4 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepperControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 2 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  fieldInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontWeight: '500' },
  emptyState: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700' },
  primaryBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  outlineBtn: { borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  loadingView: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export const isWeb = Platform.OS === 'web';