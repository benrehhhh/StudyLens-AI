import React from 'react';
import { Text } from 'react-native';

export const formatRelative = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const isNewUser = (createdAt?: string, thresholdDays = 7): boolean => {
  if (!createdAt) return true;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return true;
  const ageDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
  return ageDays <= thresholdDays;
};

// React component that renders a relative timestamp.
export const RelativeTime: React.FC<{ iso: string }> = ({ iso }) => <Text style={{ fontSize: 11, color: 'gray' }}>{formatRelative(iso)}</Text>;

// Readable absolute stamp for detail views, e.g. "Aug 25, 2026 · 2:45 PM"
export const formatExact = (iso?: string): string => {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
};
