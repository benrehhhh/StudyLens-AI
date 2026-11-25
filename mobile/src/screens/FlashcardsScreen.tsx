import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { Layers, ChevronLeft, ChevronRight, RotateCw, Sparkles, Shuffle, Trash2 } from 'lucide-react-native';
import { fetchFlashcards, deleteFlashcardDeck, FlashcardDeck } from '../services/api';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Card, Badge, PrimaryButton, OutlineButton, LoadingView, EmptyState, Modal } from '../components/ui';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function FlashcardsScreen({
  onNavigate,
}: {
  onNavigate: (tab: string, params?: { initialMode?: 'flashcards' }) => void;
}) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewDeck, setPreviewDeck] = useState<FlashcardDeck | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewFlipped, setPreviewFlipped] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [explain, setExplain] = useState<string | null>(null);
  const flipAnim = useRef(new Animated.Value(0));
  const shuffleAnim = useRef(new Animated.Value(1));
  const previewFlipAnim = useRef(new Animated.Value(0));

  const flipCard = () => {
    setIsFlipped((v) => {
      const target = !v;
      Animated.timing(flipAnim.current, {
        toValue: target ? 1 : 0,
        duration: 500,
        useNativeDriver: false,
      }).start();
      return target;
    });
  };

  const flipFront = {
    transform: [{ perspective: 1000 }, { rotateY: flipAnim.current.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
  };
  const flipBack = {
    transform: [{ perspective: 1000 }, { rotateY: flipAnim.current.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }],
  };

  const openPreview = (deck: FlashcardDeck) => {
    setPreviewDeck(deck);
    setPreviewIndex(0);
    setPreviewFlipped(false);
    previewFlipAnim.current.setValue(0);
  };

  const flipPreview = () => {
    setPreviewFlipped((v) => {
      const target = !v;
      Animated.timing(previewFlipAnim.current, {
        toValue: target ? 1 : 0,
        duration: 500,
        useNativeDriver: false,
      }).start();
      return target;
    });
  };

  const previewFlipFront = {
    transform: [{ perspective: 1000 }, { rotateY: previewFlipAnim.current.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }],
  };
  const previewFlipBack = {
    transform: [{ perspective: 1000 }, { rotateY: previewFlipAnim.current.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }) }],
  };

  const changePreviewIndex = (next: number) => {
    if (!previewDeck) return;
    const clamped = Math.max(0, Math.min(previewDeck.cards.length - 1, next));
    setPreviewIndex(clamped);
    setPreviewFlipped(false);
    previewFlipAnim.current.setValue(0);
  };

  useEffect(() => {
    fetchFlashcards(currentUser?.id).then((data) => {
      setDecks(data);
      setLoading(false);
    });
  }, [currentUser?.id]);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || null;
  const orderedCards = selectedDeck ? order.map((id) => selectedDeck.cards.find((c) => c.id === id)).filter((c): c is NonNullable<typeof c> => !!c) : [];
  const card = orderedCards.length > 0 ? orderedCards[currentIndex] : selectedDeck?.cards[currentIndex] || null;

  const enterDeck = (deck: FlashcardDeck) => {
    setSelectedDeckId(deck.id);
    setOrder(shuffle(deck.cards.map((c) => c.id)));
    setCurrentIndex(0);
    setIsFlipped(false);
    flipAnim.current.setValue(0);
    setExplain(null);
  };

  const goNext = (deckId: string) => {
    setIsFlipped(false);
    flipAnim.current.setValue(0);
    setExplain(null);
    setCurrentIndex((i) => (i < orderedCards.length - 1 ? i + 1 : 0));
  };

  const goPrev = (deckId: string) => {
    setIsFlipped(false);
    flipAnim.current.setValue(0);
    setExplain(null);
    setCurrentIndex((i) => (i > 0 ? i - 1 : orderedCards.length - 1));
  };

  const showExplain = (question: string, answer: string) => {
    setExplain(
      `Socratic breakdown: ${answer} Remember to connect this back to the core concept ("${question}"). Review the related lecture notes for extra depth.`
    );
  };

  const reshuffle = (deck: FlashcardDeck) => {
    setOrder(shuffle(deck.cards.map((c) => c.id)));
    setCurrentIndex(0);
    setIsFlipped(false);
    flipAnim.current.setValue(0);
    setExplain(null);
    Animated.sequence([
      Animated.timing(shuffleAnim.current, { toValue: 0.94, duration: 100, useNativeDriver: true }),
      Animated.timing(shuffleAnim.current, { toValue: 1, duration: 140, useNativeDriver: true }),
    ]).start();
  };

  const handleDeleteDeck = async (deck: FlashcardDeck) => {
    try {
      await deleteFlashcardDeck(deck.id);
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
      if (selectedDeckId === deck.id) setSelectedDeckId(null);
      if (previewDeck?.id === deck.id) setPreviewDeck(null);
      setConfirmDeleteId(null);
      showToast('Deck deleted.');
    } catch (err) {
      showToast((err as Error).message || 'Could not delete the deck.', 'error');
      setConfirmDeleteId(null);
    }
  };

  const canDeleteDeck = (deck: FlashcardDeck) =>
    currentUser?.role === 'teacher' ||
    currentUser?.role === 'admin' ||
    deck.createdById === currentUser?.id;

  if (loading) return <LoadingView label="Loading flashcards..." />;

  // ---------------- PLAYER ----------------
  if (selectedDeck && card) {
    const deckId = selectedDeck.id;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.playerWrap}>
        <View style={styles.playerHead}>
          <View style={styles.playerTitleRow}>
            <TouchableOpacity onPress={() => setSelectedDeckId(null)} style={[styles.backBtn, { borderColor: colors.border }]}>
              <ChevronLeft size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.mutedForeground }}>
              {selectedDeck.title}
            </Text>
            <Badge text={`Card ${currentIndex + 1} / ${orderedCards.length}`} color={colors.primary} />
          </View>
        </View>

        {/* Flip card */}
        <TouchableOpacity activeOpacity={0.9} onPress={flipCard} style={[styles.flipPress, { backgroundColor: colors.card, borderColor: colors.border, transform: [{ scale: shuffleAnim.current }] }]}>
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.flipFace, flipFront, isFlipped && styles.hiddenFace]}>
              <View style={styles.faceWrap}>
                <Text style={[styles.faceLabel, { color: colors.mutedForeground }]}>Question</Text>
                <Text style={[styles.faceText, { color: colors.foreground }]}>{card.question}</Text>
                <View style={styles.tapHint}>
                  <RotateCw size={13} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Tap card to flip</Text>
                </View>
              </View>
            </Animated.View>
            <Animated.View style={[styles.flipFace, { backgroundColor: colors.primary }, flipBack, !isFlipped && styles.hiddenFace]}>
              <View style={styles.faceWrap}>
                <Text style={[styles.faceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Answer</Text>
                <Text style={[styles.faceText, { color: '#fff' }]}>{card.answer}</Text>
                <View style={styles.tapHint}>
                  <RotateCw size={13} color="rgba(255,255,255,0.8)" />
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Tap card to flip back</Text>
                </View>
              </View>
            </Animated.View>
          </View>
        </TouchableOpacity>

        {/* AI explain */}
        <View style={styles.explainZone}>
          {explain ? (
            <View style={[styles.explainBox, { backgroundColor: colors.indigoSoft, borderColor: colors.primary }]}>
              <Sparkles size={15} color={colors.primary} />
              <Text style={{ color: colors.primary, fontSize: 12, lineHeight: 17, flex: 1 }}>{explain}</Text>
            </View>
          ) : (
            isFlipped && (
              <TouchableOpacity onPress={() => showExplain(card.question, card.answer)} style={styles.explainBtn}>
                <Sparkles size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>AI Explain This Answer</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {/* Nav */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => goPrev(deckId)} style={[styles.navCircle, { borderColor: colors.border }]}>
            <ChevronLeft size={22} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => reshuffle(selectedDeck)} style={[styles.navCircle, { borderColor: colors.border, backgroundColor: colors.successSoft }]}>
            <Shuffle size={20} color={colors.success} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goNext(deckId)} style={[styles.navCircle, { backgroundColor: colors.primary }]}>
            <ChevronRight size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ---------------- LIBRARY ----------------
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.banner, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary }]}>
          <Layers size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Flashcard Decks</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
            {decks.length} deck{decks.length === 1 ? '' : 's'} available
          </Text>
        </View>
      </View>

      <PrimaryButton
        label="AI Flashcard Generator"
        onPress={() => onNavigate('ai-assistant', { initialMode: 'flashcards' })}
      />

      {decks.length === 0 ? (
        <EmptyState icon={<Layers size={36} color={colors.mutedForeground} />} title="No flashcard decks yet" subtitle="Generate flashcards from your materials with the AI Flashcard Generator above." />
      ) : (
        <View style={{ gap: 12 }}>
          {decks.map((d) => {
            return (
              <Card key={d.id} style={{ gap: 10 }} onPress={() => openPreview(d)}>
                <View style={styles.deckTop}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.deckTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <View style={styles.deckMeta}>
                      <Badge text={`${d.cards.length} Cards`} color={colors.primary} />
                    </View>
                  </View>
                  {confirmDeleteId !== d.id && canDeleteDeck(d) && (
                    <TouchableOpacity
                      onPress={() => setConfirmDeleteId(d.id)}
                      style={[styles.deleteBtn, { backgroundColor: 'rgba(239,68,68,0.12)' }]}
                      accessibilityLabel="Delete deck"
                    >
                      <Trash2 size={16} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>

                {confirmDeleteId === d.id ? (
                  <View style={styles.confirmRow}>
                    <TouchableOpacity
                      onPress={() => handleDeleteDeck(d)}
                      style={[styles.confirmBtn, { backgroundColor: colors.danger, flex: 1 }]}
                    >
                      <Trash2 size={14} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>Confirm Delete</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setConfirmDeleteId(null)}
                      style={[styles.confirmBtn, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
                    >
                      <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <PrimaryButton label="Start Studying" onPress={() => enterDeck(d)} />
                )}
              </Card>
            );
          })}
        </View>
      )}

      <Modal
        visible={!!previewDeck}
        onClose={() => setPreviewDeck(null)}
        title={previewDeck?.title}
        subtitle={
          previewDeck
            ? previewDeck.cards.length === 0
              ? 'No flashcards'
              : `Card ${previewIndex + 1} / ${previewDeck.cards.length}${previewDeck.subjectName ? ` · ${previewDeck.subjectName}` : ''}`
            : undefined
        }
      >
        {previewDeck && (() => {
          const cards = previewDeck.cards;
          const pc = cards[previewIndex];
          if (!pc) {
            return (
              <View style={{ paddingVertical: 24, alignItems: 'center', gap: 8 }}>
                <Layers size={32} color={colors.mutedForeground} />
                <Text style={{ color: colors.foreground, fontSize: 13, fontWeight: '700' }}>
                  This deck has no flashcards yet.
                </Text>
              </View>
            );
          }
          return (
            <View style={{ gap: 12 }}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={flipPreview}
                style={[styles.previewFlipPress, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={StyleSheet.absoluteFill}>
                  <Animated.View style={[styles.previewFlipFace, previewFlipFront, previewFlipped && styles.hiddenFace]}>
                    <View style={styles.previewFaceWrap}>
                      <Text style={[styles.faceLabel, { color: colors.mutedForeground }]}>Question</Text>
                      <Text style={[styles.previewFaceText, { color: colors.foreground }]}>{pc.question}</Text>
                      <View style={styles.tapHint}>
                        <RotateCw size={12} color={colors.mutedForeground} />
                        <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Tap card to flip</Text>
                      </View>
                    </View>
                  </Animated.View>
                  <Animated.View style={[styles.previewFlipFace, { backgroundColor: colors.primary }, previewFlipBack, !previewFlipped && styles.hiddenFace]}>
                    <View style={styles.previewFaceWrap}>
                      <Text style={[styles.faceLabel, { color: 'rgba(255,255,255,0.8)' }]}>Answer</Text>
                      <Text style={[styles.previewFaceText, { color: '#fff' }]}>{pc.answer}</Text>
                      <View style={styles.tapHint}>
                        <RotateCw size={12} color="rgba(255,255,255,0.8)" />
                        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>Tap card to flip back</Text>
                      </View>
                    </View>
                  </Animated.View>
                </View>
              </TouchableOpacity>

              <View style={styles.navRow}>
                <TouchableOpacity
                  onPress={() => changePreviewIndex(previewIndex - 1)}
                  disabled={previewIndex <= 0}
                  style={[styles.navCircle, { borderColor: colors.border }, previewIndex <= 0 && { opacity: 0.4 }]}
                >
                  <ChevronLeft size={22} color={colors.foreground} />
                </TouchableOpacity>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '700', alignSelf: 'center' }}>
                  {previewIndex + 1} / {cards.length}
                </Text>
                <TouchableOpacity
                  onPress={() => changePreviewIndex(previewIndex + 1)}
                  disabled={previewIndex >= cards.length - 1}
                  style={[styles.navCircle, { borderColor: colors.border }, previewIndex >= cards.length - 1 && { opacity: 0.4 }]}
                >
                  <ChevronRight size={22} color={colors.foreground} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <OutlineButton label="Close" onPress={() => setPreviewDeck(null)} style={{ flex: 1 }} />
                <PrimaryButton
                  label="Start Studying"
                  onPress={() => {
                    const deck = previewDeck;
                    setPreviewDeck(null);
                    enterDeck(deck);
                  }}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          );
        })()}
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16 },
  bannerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800' },
  deckTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deckTitle: { fontSize: 14, fontWeight: '800' },
  deckMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  confirmRow: { flexDirection: 'row', gap: 8 },
  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  deleteBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  playerWrap: { padding: 16, paddingBottom: 40, gap: 18, flexGrow: 1 },
  playerHead: { gap: 10 },
  playerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  flipPress: { flex: 1, minHeight: 320, borderWidth: 1, borderRadius: 28, overflow: 'hidden', boxShadow: '0 8px 14px rgba(0, 0, 0, 0.15)', elevation: 9 },
  previewFlipPress: { minHeight: 220, borderWidth: 1, borderRadius: 24, overflow: 'hidden', boxShadow: '0 6px 12px rgba(0, 0, 0, 0.12)', elevation: 6 },
  previewFlipFace: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  previewFaceWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderRadius: 24 },
  previewFaceText: { fontSize: 17, lineHeight: 24, fontWeight: '600', textAlign: 'center', maxWidth: '92%' },
  flipFace: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  hiddenFace: { opacity: 0 },
  faceWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 26, borderRadius: 28 },
  faceLabel: { position: 'absolute', top: 24, left: 26, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  faceText: { fontSize: 21, lineHeight: 29, fontWeight: '600', textAlign: 'center', maxWidth: '90%' },
  tapHint: { position: 'absolute', bottom: 20, flexDirection: 'row', alignItems: 'center', gap: 6 },
  explainZone: { minHeight: 40, justifyContent: 'center' },
  explainBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, borderWidth: 1, padding: 10 },
  explainBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center' },
  navRow: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  navCircle: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});