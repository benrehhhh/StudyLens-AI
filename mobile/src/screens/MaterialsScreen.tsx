import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { downloadBlobOnWeb, saveTextFile, saveBytesFile } from '../utils/fileExport';
import { FileText, Download, UploadCloud, CheckCircle2, X } from 'lucide-react-native';
import { fetchMaterials, fetchSubjects, uploadMaterial, updateMaterialSubject, convertToPdf, downloadMaterialPdf, Material, Subject } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Card,
  LoadingView,
  EmptyState,
  Modal,
  Field,
  PrimaryButton,
  OutlineButton,
  SectionHeader,
  Badge,
} from '../components/ui';
import { STORAGE_KEYS, getStringSet, addToStringSet } from '../utils/storage';
import { MaterialFileViewer, materialViewerExt } from '../components/MaterialFileViewer';

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
];

export default function MaterialsScreen({ onNavigate, onCreateNotes }: { onNavigate: (tab: string) => void; onCreateNotes?: (material: Material) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const isTeacher = currentUser?.role === 'teacher';

  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [previewMaterial, setPreviewMaterial] = useState<Material | null>(null);
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => { setVisibleCount(20); }, [subjectFilter]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [pickedFile, setPickedFile] = useState<{ uri: string; name: string; type: string; size?: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchMaterials(), fetchSubjects()]).then(([mats, subs]) => {
      setMaterials(mats);
      setSubjects(subs);
      setLoading(false);
    });
    if (currentUser?.id) {
      getStringSet(STORAGE_KEYS.downloadedMaterials).then(setDownloadedIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true, multiple: false });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        setPickedFile({ uri: asset.uri, name: asset.name || 'lecture.pdf', type: asset.mimeType || 'application/octet-stream' });
      }
    } catch {
      setPickedFile(null);
    }
  };

  const handleUpload = async () => {
    if (!pickedFile || !currentUser) return;
    setIsUploading(true);
    setUploadMessage(null);
    try {
      if (Platform.OS === 'web') {
        throw new Error('File upload is not supported on web in this build.');
      }
      const mat = await uploadMaterial({
        uri: pickedFile.uri,
        name: pickedFile.name,
        type: pickedFile.type,
        title: title || undefined,
        description: description || undefined,
        subjectId,
        uploadedBy: currentUser.name,
        uploaderRole: currentUser.role,
        uploaderId: currentUser.id,
      });
      setMaterials((prev) => [mat, ...prev]);
      setUploadMessage('Material uploaded successfully and indexed for students!');
      showToast('Material uploaded successfully.');
      setTitle('');
      setDescription('');
      setPickedFile(null);
    } catch (err) {
      setUploadMessage((err as Error).message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadTxt = async (m: Material) => {
    const text = `================================================\n${m.title}\n================================================\n\n${m.extractedText || ''}`;
    try {
      if (Platform.OS === 'web') {
        downloadBlobOnWeb(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${m.title.replace(/[^\w\s]/g, '').slice(0, 40) || 'material'}.txt`);
      } else {
        const name = `${m.title.replace(/[^\w\s]/g, '').slice(0, 40) || 'material'}.txt`;
        const outcome = await saveTextFile(name, text, 'text/plain', m.title);
        if (outcome === 'saved') showToast(`Saved ${name} to the selected folder.`, 'success');
      }
      await addToStringSet(STORAGE_KEYS.downloadedMaterials, m.id);
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.add(m.id);
        return next;
      });
    } catch {
      showToast('Could not export the file.', 'error');
    }
  };

  const handleDownloadPdf = async (m: Material) => {
    const isWord = ['doc', 'docx'].includes((m.fileType || '').toLowerCase().replace(/^\./, ''));
    const fetchBytes = async (): Promise<Uint8Array> => {
      if (isWord) {
        return downloadMaterialPdf(m.id);
      }
      return convertToPdf({
        title: m.title,
        metaLine: [m.subjectName, m.uploadedBy || ''].filter(Boolean).join(' · '),
        content: m.extractedText || m.description || m.title,
        items: [],
      });
    };

    if (Platform.OS === 'web') {
      try {
        const bytes = await fetchBytes();
        downloadBlobOnWeb(new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }), `${m.title.replace(/[^\w\s]/g, '').slice(0, 40) || 'material'}.pdf`);
        await addToStringSet(STORAGE_KEYS.downloadedMaterials, m.id);
        setDownloadedIds((prev) => {
          const next = new Set(prev);
          next.add(m.id);
          return next;
        });
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not export the PDF.', 'error');
      }
      return;
    }
    try {
      const bytes = await fetchBytes();
      const name = `${m.title.replace(/[^\w\s]/g, '').slice(0, 40) || 'material'}.pdf`;
      const outcome = await saveBytesFile(name, bytes, 'application/pdf', m.title);
      if (outcome === 'saved') showToast(`Saved ${name} to the selected folder.`, 'success');
      await addToStringSet(STORAGE_KEYS.downloadedMaterials, m.id);
      setDownloadedIds((prev) => {
        const next = new Set(prev);
        next.add(m.id);
        return next;
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not export the PDF.', 'error');
    }
  };

  const canAssignSubject = (m: Material) =>
    (currentUser?.role === 'admin' || m.uploaderId === currentUser?.id) && m.uploaderRole !== 'student';

  // A subjectless resource (AI resource or personal note) is not scoped to any
  // subject, so it stays visible under every subject filter.
  // Newest first: the list is paged, so a newly saved resource must lead or it
  // lands on the last page and looks unsaved.
  const filteredMaterials = (
    subjectFilter === 'all'
      ? materials
      : materials.filter(
          (m) =>
            m.subjectId === subjectFilter ||
            (m.subjectId == null && m.materialType === 'personal'),
        )
  ).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  const filterOptions = (() => {
    const seen = new Map<string, string>();
    materials.forEach((m) => {
      if (m.subjectId && !seen.has(m.subjectId)) seen.set(m.subjectId, m.subjectName || m.subjectId);
    });
    return Array.from(seen.entries());
  })();

  const handleAssignSubject = async () => {
    if (!previewMaterial || !assignSubjectId) {
      setAssignError('Please select an assigned subject.');
      return;
    }
    setIsAssigning(true);
    setAssignError(null);
    try {
      const updated = await updateMaterialSubject(previewMaterial.id, assignSubjectId);
      setMaterials((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setPreviewMaterial(null);
      setAssignSubjectId('');
      showToast('Material updated.');
    } catch (err) {
      setAssignError((err as Error).message || 'Could not assign the subject. Please try again.');
    } finally {
      setIsAssigning(false);
    }
  };

  if (loading) return <LoadingView label="Loading materials..." />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {/* Role header */}
      {isTeacher ? (
        <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Upload Course Material</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Publish lecture files for your assigned students.</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerTitle, { color: colors.foreground }]}>Learning Materials</Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Course notes, reviewers, and self-study documents.</Text>
          </View>
        </View>
      )}

      <PrimaryButton label="Create Notes in AI Study Assistant" onPress={() => onNavigate('ai-assistant')} />

      {/* Teacher upload form */}
      {isTeacher && (
        <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
          <SectionHeader title="Upload New Material" subtitle="PDF, DOCX, PPTX, TXT supported" />
          <Field label="Document Title" value={title} onChangeText={setTitle} placeholder="e.g. Module 4: Relational Algebra & Normalization" />
          <View>
            <Text style={styles.fieldLabel}>Course Subject</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                key="no-subject"
                onPress={() => setSubjectId('')}
                style={[styles.chip, subjectId === '' ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: subjectId === '' ? '#fff' : colors.foreground }}>
                  No Subject
                </Text>
              </TouchableOpacity>
              {subjects.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setSubjectId(s.id)}
                  style={[styles.chip, subjectId === s.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: subjectId === s.id ? '#fff' : colors.foreground }}>
                    {s.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Field label="Description / Topic Notes" value={description} onChangeText={setDescription} placeholder="Brief notes for students" multiline />
          {pickedFile ? (
            <View style={[styles.fileChip, { backgroundColor: colors.successSoft, borderColor: colors.success }]}>
              <FileText size={16} color={colors.success} />
              <Text style={{ color: colors.success, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                {pickedFile.name}
              </Text>
              <TouchableOpacity onPress={() => setPickedFile(null)}>
                <X size={16} color={colors.success} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={pickFile} style={[styles.dropzone, { borderColor: colors.border }]} disabled={Platform.OS === 'web'}>
              <UploadCloud size={22} color={colors.primary} />
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>Tap to select a lecture file</Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>{Platform.OS === 'web' ? 'File upload is available in the native app.' : 'PDF, DOCX, PPTX, TXT format supported'}</Text>
            </TouchableOpacity>
          )}
          {uploadMessage && (
            <View style={[styles.uploadMsg, { backgroundColor: uploadMessage.includes('successfully') ? colors.successSoft : colors.dangerSoft }]}>
              {uploadMessage.includes('successfully') ? <CheckCircle2 size={16} color={colors.success} /> : <X size={16} color={colors.danger} />}
              <Text style={{ fontSize: 12, fontWeight: '600', color: uploadMessage.includes('successfully') ? colors.success : colors.danger, flex: 1 }}>
                {uploadMessage}
              </Text>
            </View>
          )}
          <PrimaryButton
            label={isUploading ? 'Uploading...' : 'Publish Course Material to Students'}
            onPress={handleUpload}
            loading={isUploading}
            disabled={!pickedFile || Platform.OS === 'web'}
          />
        </View>
      )}

      {/* Catalog */}
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, gap: 12 }]}>
        <SectionHeader title="Materials Catalog" subtitle={`${materials.length} document(s)`} />
        {filterOptions.length > 1 && (
          <View style={{ width: '100%' }}>
            <Text style={styles.fieldLabel}>Filter by Subject</Text>
            <TouchableOpacity
              onPress={() => setShowFilterDropdown(true)}
              style={[styles.dropdown, { width: '100%', borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            >
              <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700', flex: 1 }}>
                {subjectFilter === 'all' ? 'All Subjects' : filterOptions.find(([id]) => id === subjectFilter)?.[1] || 'All Subjects'}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>▾</Text>
            </TouchableOpacity>
          </View>
        )}
        {filteredMaterials.length === 0 ? (
          <EmptyState icon={<FileText size={36} color={colors.mutedForeground} />} title={materials.length === 0 ? 'No materials found' : 'No materials for this subject'} subtitle="Ask your teacher to publish notes, or generate resources in the AI Study Assistant." />
        ) : (
          <View style={{ gap: 12 }}>
            {filteredMaterials.slice(0, visibleCount).map((m) => (
              <TouchableOpacity
                  key={m.id}
                  onPress={() => setPreviewMaterial(m)}
                  activeOpacity={0.7}
                  style={[styles.matCard, { borderColor: colors.border }]}
                >
                  <Text style={[styles.matTitle, { color: colors.foreground }]} numberOfLines={1}>{m.title}</Text>
                  {m.description && <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 17 }} numberOfLines={2}>{m.description}</Text>}
                  {m.subjectName && (
                    <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '600' }}>{m.subjectName}</Text>
                  )}
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </Text>
                  <View style={styles.matActions}>
                    <TouchableOpacity onPress={() => handleDownloadTxt(m)} style={[styles.actionBtn, styles.actionBtnFull, { backgroundColor: colors.surfaceAlt }]}>
                      <Download size={15} color={colors.foreground} />
                      <Text style={{ color: colors.foreground, fontSize: 11, fontWeight: '700' }}>Download</Text>
                    </TouchableOpacity>
                    {onCreateNotes && (
                      <TouchableOpacity
                        onPress={() => onCreateNotes(m)}
                        style={[styles.actionBtn, styles.actionBtnFull, { backgroundColor: colors.primary, justifyContent: 'center' }]}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>Create Notes</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
            ))}
          </View>
        )}
        {visibleCount < filteredMaterials.length && (
          <TouchableOpacity
            onPress={() => setVisibleCount((c) => c + 20)}
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '700' }}>
              Load More ({filteredMaterials.length - visibleCount} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Preview modal */}
      <Modal
        visible={!!previewMaterial}
        onClose={() => setPreviewMaterial(null)}
        title={previewMaterial?.title}
        subtitle={[
          `${previewMaterial?.fileType?.toUpperCase() || 'DOC'} Document`,
          previewMaterial?.subjectName || '',
        ]
          .filter(Boolean)
          .join(' - ')}
      >
        <ScrollView style={{ maxHeight: 400 }}>
          <View style={[styles.previewPaper, { backgroundColor: colors.surfaceAlt }]}>
            {!isAiMaterial(previewMaterial) && (
              <>
                {/* Paper Header */}
                <View style={styles.previewHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {previewMaterial?.subjectName && (
                      <Badge text={previewMaterial.subjectName} color={colors.primary} />
                    )}
                    <Badge text={previewMaterial?.fileType?.toUpperCase() || 'DOC'} color={colors.warning} />
                  </View>
                  <Text style={[styles.previewTitle, { color: colors.foreground }]}>{previewMaterial?.title}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 10 }}>
                    {previewMaterial ? new Date(previewMaterial.createdAt).toLocaleString() : ''} · {previewMaterial?.uploadedBy}
                    {previewMaterial?.fileSize ? ` · ${previewMaterial.fileSize}` : ''}
                  </Text>
                </View>
                <View style={[styles.previewDivider, { backgroundColor: colors.border }]} />
              </>
            )}
            {isAiMaterial(previewMaterial) && (
              <Text style={[styles.previewTitle, { color: colors.foreground }]}>{previewMaterial?.title}</Text>
            )}
            {previewMaterial && materialViewerExt(previewMaterial) ? (
              <MaterialFileViewer material={previewMaterial} height={340} />
            ) : (
              <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 22 }}>{previewMaterial?.extractedText || previewMaterial?.title}</Text>
            )}
          </View>
        </ScrollView>

        {previewMaterial && canAssignSubject(previewMaterial) && (
          <View style={{ gap: 8, marginTop: 12 }}>
            <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '700' }}>
              {previewMaterial.subjectId ? 'Change Course Subject' : 'Assign Course Subject'}
            </Text>
            <Text style={{ color: colors.mutedForeground, fontSize: 10, lineHeight: 15 }}>
              Students of the selected subject will see this material.
            </Text>
            <View style={styles.chipWrap}>
              {subjects.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => setAssignSubjectId(s.id)}
                  style={[styles.chip, assignSubjectId === s.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: assignSubjectId === s.id ? '#fff' : colors.foreground }}>
                    {s.code} - {s.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {assignError && <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '600' }}>{assignError}</Text>}
            <PrimaryButton
              label={isAssigning ? 'Assigning...' : 'Assign Subject'}
              onPress={handleAssignSubject}
              loading={isAssigning}
              disabled={isAssigning || !assignSubjectId}
            />
          </View>
        )}

        <View style={styles.modalActions}>
          <OutlineButton label={(previewMaterial?.fileType || '').toLowerCase() === 'pdf' ? 'Download PDF' : 'Download as PDF'} onPress={() => previewMaterial && handleDownloadPdf(previewMaterial)} style={{ flex: 1 }} />
          <OutlineButton label="Download TXT" onPress={() => previewMaterial && handleDownloadTxt(previewMaterial)} style={{ flex: 1 }} />
        </View>
      </Modal>

      <Modal visible={showFilterDropdown} onClose={() => setShowFilterDropdown(false)} title="Filter by Subject">
        <View style={{ gap: 8 }}>
          <TouchableOpacity
            onPress={() => {
              setSubjectFilter('all');
              setShowFilterDropdown(false);
            }}
            style={[styles.dropdownOption, { backgroundColor: subjectFilter === 'all' ? colors.primary : colors.surfaceAlt, borderColor: subjectFilter === 'all' ? colors.primary : colors.border }]}
          >
            <Text style={{ color: subjectFilter === 'all' ? '#fff' : colors.foreground, fontSize: 13, fontWeight: '700' }}>All Subjects</Text>
          </TouchableOpacity>
          {filterOptions.map(([id, name]) => (
            <TouchableOpacity
              key={id}
              onPress={() => {
                setSubjectFilter(id);
                setShowFilterDropdown(false);
              }}
              style={[styles.dropdownOption, { backgroundColor: subjectFilter === id ? colors.primary : colors.surfaceAlt, borderColor: subjectFilter === id ? colors.primary : colors.border }]}
            >
              <Text style={{ color: subjectFilter === id ? '#fff' : colors.foreground, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </ScrollView>
  );
}

function isAiMaterial(m: Material | null): boolean {
  return !!m && (m.fileType || '').toLowerCase().startsWith('ai-');
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  fieldLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '700' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginTop: 6 },
  dropdownOption: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  dropzone: { borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', padding: 20, alignItems: 'center', gap: 6 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  uploadMsg: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12 },
  panel: { borderRadius: 16, borderWidth: 1, padding: 16 },
  matCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 },
  matTitle: { fontSize: 14, fontWeight: '800' },
  matActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  actionBtnFull: { flex: 1, justifyContent: 'center' },
  previewPaper: { borderRadius: 12, padding: 14 },
  previewHeader: { gap: 6, marginBottom: 10 },
  previewTitle: { fontSize: 16, fontWeight: '800' },
  previewDivider: { height: 1, marginBottom: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
});