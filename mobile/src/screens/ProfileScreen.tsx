import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Image, ActivityIndicator, AppState } from 'react-native';
import { Building2, Calendar, Edit3, Save, Camera, FileBadge, Trash2, Activity } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { uploadAvatar, resolveMaterialFileUrl, getJSON } from '../services/api';
import { Card, Badge, Field, PrimaryButton, OutlineButton, SectionHeader } from '../components/ui';
import { RelativeTime } from '../utils/time';

const translations: Record<string, Record<string, string>> = {
  en: {
    "Account Details": "Account Details",
    "Full Name": "Full Name",
    "Department / Faculty (Read-only)": "Department / Faculty (Read-only)",
    "Email Address": "Email Address",
    "User Role": "User Role",
    "Department": "Department",
    "Security & Credentials": "Security & Credentials",
    "Password Authentication": "Password Authentication",
    "Keep your StudyLens account protected": "Keep your StudyLens account protected",
    "Change Password": "Change Password",
    "Set New Password": "Set New Password",
    "Current Password": "Current Password",
    "New Password": "New Password",
    "Confirm Password": "Confirm Password",
    "Update Password": "Update Password",
    "Cancel": "Cancel",
    "Account Stats": "Account Stats",
    "Quizzes Taken": "Quizzes Taken",
    "Flashcards Created": "Flashcards Created",
    "Study Hours": "Study Hours",
    "Materials Uploaded": "Materials Uploaded",
    "Recent Activity": "Recent Activity",
    "Profile updated": "Profile updated",
    "Password changed": "Password changed",
    "Account created": "Account created",
    "Preferences": "Preferences",
    "Dark Mode": "Dark Mode",
    "Switch between light and dark theme": "Switch between light and dark theme",
    "Email Notifications": "Email Notifications",
    "Receive updates about your learning progress": "Receive updates about your learning progress",
    "Language": "Language",
    "App display language": "App display language",
    "English": "English",
    "Filipino": "Filipino",
    "Edit Profile": "Edit Profile",
    "Save Edit": "Save Edit",
    "Save Changes": "Save Changes",
    "Profile updated successfully!": "Profile updated successfully!",
    "Full name is required.": "Full name is required.",
    "Please enter a valid email address.": "Please enter a valid email address.",
    "Just now": "Just now",
    "Earlier today": "Earlier today",
  },
  fil: {
    "Account Details": "Mga Detalye ng Kuwenta",
    "Full Name": "Pangalang Buo",
    "Department / Faculty (Read-only)": "Departamento / Kolehiya (Read-only)",
    "Email Address": "Email na Adres",
    "User Role": "Katungkulan ng Usuario",
    "Department": "Departamento",
    "Security & Credentials": "Seguridad at Mga Krekensiyal",
    "Password Authentication": "Pagpapatunay ng Password",
    "Keep your StudyLens account protected": "Protektahan ang inyong account sa StudyLens",
    "Change Password": "Baguhin ang Password",
    "Set New Password": "Itakda ang Bagong Password",
    "Current Password": "Nasa Kasalukuyang Password",
    "New Password": "Bagong Password",
    "Confirm Password": "Kumpirmahin ang Password",
    "Update Password": "I-update ang Password",
    "Cancel": "Kanselahin",
    "Account Stats": "Mga Estadistika ng Kuwenta",
    "Quizzes Taken": "Mga Quiz na Nakuha",
    "Flashcards Created": "Mga Flashcard na Likha",
    "Study Hours": "Oras ng Pag-aaral",
    "Materials Uploaded": "Mga Materyals na In-upload",
    "Recent Activity": "Kasalukuyang Aktibidad",
    "Profile updated": "Profile na-update",
    "Password changed": "Password na-bago",
    "Account created": "Kuwenta na-likha",
    "Preferences": "Mga Paging",
    "Dark Mode": "Dark Mode",
    "Switch between light and dark theme": "Mag-switch sa liwanag at dilim na theme",
    "Email Notifications": "Mga Notipikasyon sa Email",
    "Receive updates about your learning progress": "Tumanggap ng mga update sa inyong progreso sa pag-aaral",
    "Language": "Wika",
    "App display language": "Wika ng pagpapakita ng App",
    "English": "Ingles",
    "Filipino": "Filipino",
    "Edit Profile": "I-edit ang Profile",
    "Save Edit": "I-save ang Edit",
    "Save Changes": "I-save ang mga Pagbabago",
    "Profile updated successfully!": "Profile na-update nang maayos!",
    "Full name is required.": "Kinakailangan ang pangalang buo.",
    "Please enter a valid email address.": "Maaari pong pumili ng tunay na email na adres.",
    "Just now": "Nang kahapon",
    "Earlier today": "Nang mas maaga ngayon",
  },
};

function t(key: string, lang: string): string {
  return translations[lang]?.[key] || translations["en"][key] || key;
}

export default function ProfileScreen({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { colors } = useTheme();
  const { currentUser, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(currentUser?.name || '');

  const [email, setEmail] = useState(currentUser?.email || '');

  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);

  const [language, setLanguage] = useState('en');

  useEffect(() => {
    const loadLang = async () => {
      try {
        const stored = await AsyncStorage.getItem('studylens_language');
        if (stored) setLanguage(stored);
      } catch {
        // ignore storage failures
      }
    };
    loadLang();
  }, []);
  const [stats, setStats] = useState<{
    quizzesTaken: number;
    flashcardsCreated: number;
    studyHours: number;
    materialsUploaded: number;
  }>({ quizzesTaken: 0, flashcardsCreated: 0, studyHours: 0, materialsUploaded: 0 });

  const [recentActivity, setRecentActivity] = useState<{ id: string; action: string; details: string; timestamp: string }[]>([]);
  const fetchStats = async () => {
    if (!currentUser) return;
    try {
      const data = await getJSON(
        `/users/${currentUser.id}/stats`,
        { quizzesTaken: 0, flashcardsCreated: 0, studyHours: 0, materialsUploaded: 0 }
      );
      setStats({
        quizzesTaken: data.quizzesTaken ?? 0,
        flashcardsCreated: data.flashcardsCreated ?? 0,
        studyHours: data.studyHours ?? 0,
        materialsUploaded: data.materialsUploaded ?? 0,
      });
      setRecentActivity(Array.isArray(data.recentActivity) ? data.recentActivity : []);
    } catch {
      // ignore fetch failures, stats stay at 0
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    fetchStats();
    const interval = setInterval(fetchStats, 20000);
    const onFocus = () => fetchStats();
    const onVisible = () => {
      if (AppState && AppState.currentState === 'active') fetchStats();
    };
    const subscription = AppState.addEventListener('change', onVisible);
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [currentUser]);

  if (!currentUser) return null;

  const initial = (currentUser.name || 'U').charAt(0).toUpperCase();
  const initials = currentUser.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const pickAvatar = async () => {
    if (!currentUser || uploadingAvatar || !isEditing) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast('Allow photo library access to choose a profile photo.', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setUploadingAvatar(true);
    try {
      const ext = (asset.mimeType?.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const updated = await uploadAvatar(
        currentUser.id,
        asset.uri,
        `avatar_${Date.now()}.${ext}`,
        asset.mimeType || 'image/jpeg'
      );
      await updateProfile({ avatar: updated.avatar });
      showToast('Profile photo updated.');
    } catch (err) {
      showToast((err as Error).message || 'Could not upload the profile photo.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removePhoto = async () => {
    if (!currentUser?.avatar || removingAvatar) return;
    setRemovingAvatar(true);
    try {
      await updateProfile({ avatar: null });
      showToast('Profile photo removed.');
    } catch (err) {
      showToast((err as Error).message || 'Could not remove the profile photo.', 'error');
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      showToast('Full name is required.', 'error');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setIsEditing(false);
    updateProfile({ name: name.trim(), email: email.trim() }).catch(() => showToast('Could not save profile changes.', 'error'));
    showToast('Profile updated successfully!');
    void fetchStats();
  };

  const handlePasswordChange = async () => {
    if (!newPassword || newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    setPasswordSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      showToast('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
    } catch (err) {
      showToast((err as Error).message || 'Could not update the password. Check your current password and try again.', 'error');
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const roleBadge = (() => {
    switch (currentUser.role) {
      case 'admin':
        return { label: 'System Administrator', color: '#e11d48' };
      case 'teacher':
        return { label: 'Faculty Instructor', color: '#9333ea' };
      default:
        return { label: 'Enrolled Student', color: colors.primary };
    }
  })();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Hero banner */}
      <View style={[styles.banner, { backgroundColor: colors.primary }]}>
        <View style={styles.bannerInner}>
          <View>
            <TouchableOpacity
              onPress={isEditing ? pickAvatar : undefined}
              disabled={!isEditing || uploadingAvatar}
              style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' }]}
            >
              {currentUser.avatar ? (
                <Image source={{ uri: resolveMaterialFileUrl(currentUser.avatar) || undefined }} style={styles.avatarImage} />
              ) : uploadingAvatar ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.avatarText}>{initials || initial}</Text>
              )}
            </TouchableOpacity>
            {isEditing && (
              <View style={[styles.avatarBadge, { backgroundColor: '#fff' }]}>
                <Camera size={11} color={colors.primary} />
              </View>
            )}
            {isEditing && currentUser.avatar && (
              <TouchableOpacity onPress={removePhoto} disabled={removingAvatar} style={[styles.avatarRemove, { backgroundColor: colors.danger }]}>
                {removingAvatar ? <ActivityIndicator size="small" color="#fff" /> : <Trash2 size={11} color="#fff" />}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.bannerBody}>
            <View style={styles.nameRow}>
              <Text style={styles.bannerName} numberOfLines={1}>{currentUser.name}</Text>
              <Badge text={roleBadge.label} color="#fff" bg="rgba(255,255,255,0.18)" />
            </View>
            <Text style={styles.bannerEmail}>{currentUser.email}</Text>
            <View style={styles.bannerMeta}>
              <View style={styles.metaItem}>
                <Building2 size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaText}>{currentUser.department || 'General Department'}</Text>
              </View>
              {currentUser.studentId ? (
                <View style={styles.metaItem}>
                  <FileBadge size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={[styles.metaText, { fontFamily: 'monospace' }]}>ID: {currentUser.studentId}</Text>
                </View>
              ) : null}
              <View style={styles.metaItem}>
                <Calendar size={13} color="rgba(255,255,255,0.85)" />
                <Text style={styles.metaText}>Joined {new Date(currentUser.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
          </View>

          {!isEditing ? (
            <TouchableOpacity onPress={() => { setName(currentUser.name); setIsEditing(true); }} style={styles.editBtn}>
              <Edit3 size={13} color="#fff" />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handleSave} style={styles.editBtn}>
              <Save size={13} color="#fff" />
              <Text style={styles.editBtnText}>Save Edit</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Account & Security (Combined) */}
      <Card style={styles.panel}>
        {/* Account Details Section */}
        <View style={{ gap: 10, marginBottom: 8 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800', marginLeft: 2 }}>
            {t("Account Details", language)}
          </Text>
          {isEditing ? (
            <View style={{ gap: 12 }}>
              <Field label="Full Name" value={name} onChangeText={setName} placeholder="Your name" />
              <View>
                <Text style={styles.readOnlyLabel}>Department / Faculty (Read-only)</Text>
                <View style={[styles.readOnlyBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600' }}>{currentUser.department || 'General'}</Text>
                </View>
              </View>
              <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="you@example.com" />
              <View style={styles.btnRow}>
                <OutlineButton label="Cancel" onPress={() => setIsEditing(false)} style={{ flex: 1 }} />
                <PrimaryButton label="Save Changes" onPress={handleSave} disabled={!name.trim()} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={styles.detailLabel}>{t("Full Name", language)}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{currentUser.name}</Text>
              </View>
              <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={styles.detailLabel}>{t("Email Address", language)}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{currentUser.email}</Text>
              </View>
              <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={styles.detailLabel}>{t("User Role", language)}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground, textTransform: 'capitalize' }]}>{currentUser.role}</Text>
              </View>
              <View style={[styles.detailBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={styles.detailLabel}>{t("Department", language)}</Text>
                <Text style={[styles.detailValue, { color: colors.foreground }]}>{currentUser.department || 'General'}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />

        {/* Security & Credentials Section */}
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text style={{ color: colors.foreground, fontSize: 14, fontWeight: '800', marginLeft: 2 }}>
            {t("Security & Credentials", language)}
          </Text>
          {!showPasswordChange ? (
            <TouchableOpacity onPress={() => setShowPasswordChange(true)} style={[styles.securityRow, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.securityTitle, { color: colors.foreground }]}>Password Authentication</Text>
                <Text style={[styles.securitySub, { color: colors.mutedForeground }]}>Keep your StudyLens account protected</Text>
              </View>
              <View style={[styles.changePwBtn, { backgroundColor: colors.indigoSoft }]}>
                <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Change Password</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[styles.securityForm, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}>
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>Set New Password</Text>
              <Field label="Current Password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter your current password" secureTextEntry />
              <Field label="New Password" value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" secureTextEntry />
              <Field label="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry />
              <View style={styles.btnRow}>
                <OutlineButton label="Cancel" onPress={() => { setShowPasswordChange(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }} style={{ flex: 1 }} />
                <PrimaryButton label={passwordSubmitting ? 'Updating...' : 'Update Password'} onPress={handlePasswordChange} loading={passwordSubmitting} disabled={passwordSubmitting} style={{ flex: 1 }} />
              </View>
            </View>
          )}
        </View>
      </Card>

      {/* Recent Activity */}
      <Card style={styles.panel}>
        <SectionHeader title={t("Recent Activity", language)} />
        <View style={{ gap: 10 }}>
          {recentActivity.length > 0 ? (
            recentActivity.map((log) => (
              <View key={log.id} style={[styles.activityItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Activity size={14} color={colors.primary} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>{log.action}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{log.details || log.action}</Text>
                  <RelativeTime iso={log.timestamp} />
                </View>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.mutedForeground, fontSize: 10, textAlign: 'center', paddingVertical: 16 }}>No recent activity yet.</Text>
          )}
        </View>
      </Card>

      {/* Account Stats */}
      <Card style={styles.panel}>
        <SectionHeader title={t("Account Stats", language)} />
        <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 8, overflow: 'hidden' }}>
          <View style={[styles.statItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t("Quizzes Taken", language)}</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{stats.quizzesTaken}</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t("Flashcards Created", language)}</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{stats.flashcardsCreated}</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t("Study Hours", language)}</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{stats.studyHours}</Text>
          </View>
          <View style={[styles.statItem, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t("Materials Uploaded", language)}</Text>
            <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '900', marginTop: 3 }}>{stats.materialsUploaded}</Text>
          </View>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { borderRadius: 16, padding: 18, boxShadow: '0 6px 14px rgba(0, 0, 0, 0.12)', elevation: 6 },
  bannerInner: { flexDirection: 'column', gap: 12 },
  avatar: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 68, height: 68, borderRadius: 34 },
  avatarBadge: { position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#5b51d8' },
  avatarRemove: { position: 'absolute', bottom: -1, right: -1, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#5b51d8' },
  avatarText: { fontSize: 26, fontWeight: '900', color: '#fff' },
  bannerBody: { gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  bannerName: { fontSize: 20, fontWeight: '800', color: '#fff', maxWidth: '100%' },
  bannerEmail: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  bannerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: 'rgba(255,255,255,0.85)', fontSize: 12 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  editBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  panel: { gap: 12, padding: 16 },
  readOnlyLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, color: '#64748b' },
  readOnlyBox: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  detailBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  detailLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, color: '#64748b' },
  detailValue: { fontSize: 14, fontWeight: '800', marginTop: 3 },
  securityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  securityTitle: { fontSize: 14, fontWeight: '700' },
  securitySub: { fontSize: 12, marginTop: 2 },
  changePwBtn: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  securityForm: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  statItem: { flexDirection: 'column', gap: 4, alignItems: 'center', minWidth: 110, padding: 12, borderRadius: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 },
});
