import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Bell, Megaphone, CheckCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAnnouncements } from '../context/AnnouncementsContext';
import { formatRelative } from '../utils/time';
import { Badge, EmptyState, SectionHeader } from '../components/ui';

export default function NotificationsScreen({ onNavigate, onOpenQuiz }: { onNavigate: (tab: string) => void; onOpenQuiz?: (quizId: string) => void }) {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const {
    bellItems,
    markNotificationRead,
    markAnnouncementRead,
    markAllNotificationsRead,
    markAllAnnouncementsRead,
    unreadCount,
    reloadAnnouncements,
  } = useAnnouncements();

  const sorted = [...bellItems].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const hasUnread = sorted.some((b) => !b.isRead);

  const handleMarkAll = () => {
    markAllNotificationsRead();
    markAllAnnouncementsRead();
    showToast('All notifications marked as read.');
  };

  const handlePress = (b: (typeof sorted)[number]) => {
    if (b.kind === 'announcement') {
      if (b.announcementId) markAnnouncementRead(b.announcementId);
      onNavigate('announcements');
      return;
    }
    if (b.notificationId) markNotificationRead(b.notificationId);
    if (b.target && b.target.startsWith('quiz:')) {
      const quizId = b.target.slice(5);
      Alert.alert(
        'Start this quiz?',
        'This quiz is timed. The timer begins immediately once you open it.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Start Quiz', onPress: () => { if (onOpenQuiz) onOpenQuiz(quizId); } },
        ]
      );
      return;
    }
    showToast(b.title, 'info');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.warning }]}>
          <Bell size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Notifications</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {unreadCount} unread
          </Text>
        </View>
        {hasUnread && (
          <TouchableOpacity
            onPress={handleMarkAll}
            style={[styles.markAllBtn, { backgroundColor: colors.primary }]}
            activeOpacity={0.8}
          >
            <CheckCheck size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Read All</Text>
          </TouchableOpacity>
        )}
      </View>

      {sorted.length === 0 ? (
        <EmptyState icon={<Bell size={36} color={colors.mutedForeground} />} title="No notifications" subtitle="System notices such as new quizzes and announcements will appear here." />
      ) : (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
          <SectionHeader title="Notifications" subtitle={`${sorted.length} item(s)`} actionLabel="Refresh" onAction={reloadAnnouncements} />
          <View style={{ gap: 10 }}>
            {sorted.map((b) => {
              const isAnnouncement = b.kind === 'announcement';
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => handlePress(b)}
                  activeOpacity={0.85}
                  style={[styles.itemCard, { backgroundColor: !b.isRead ? colors.surfaceAlt : colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.itemIcon, { backgroundColor: isAnnouncement ? 'rgba(139,92,246,0.14)' : 'rgba(245,158,11,0.14)' }]}>
                    {isAnnouncement ? <Megaphone size={16} color="#8b5cf6" /> : <Bell size={16} color="#d97706" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.itemTop}>
                      <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                        {b.title}
                      </Text>
                      <Badge text={isAnnouncement ? b.tag || 'Announcement' : 'Notice'} color={isAnnouncement ? '#8b5cf6' : '#d97706'} bg={colors.card} />
                    </View>
                    <Text style={{ color: colors.mutedForeground, fontSize: 11 }} numberOfLines={2}>
                      {b.content}
                    </Text>
                    <Text style={{ color: colors.mutedForeground, fontSize: 10, marginTop: 4 }}>
                      {isAnnouncement
                        ? `${b.authorName ? `${b.authorName} · ` : ''}${b.subjectName ? `${b.subjectName} · ` : ''}${formatRelative(b.createdAt)}`
                        : `System · ${formatRelative(b.createdAt)}`}
                    </Text>
                  </View>
                  {!b.isRead && <View style={[styles.unreadDot, { backgroundColor: isAnnouncement ? '#8b5cf6' : '#d97706' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  markAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  itemCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14 },
  itemIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
});