import React, { useState, useEffect, useCallback } from "react";
import { Layers, RotateCw, ArrowLeft, ArrowRight, Shuffle, CheckCircle2, Trash2, Sparkles, X } from "lucide-react";
import type { FlashcardDeck, Flashcard } from "../../types";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { authFetch } from "../../utils/authFetch";
import { Pagination, slicePage } from "../../components/Pagination";
import { DeleteFlashcardDeckModal } from "./DeleteFlashcardDeckModal";

interface FlashcardsPageProps {
  onNavigate: (tab: string, options?: { mode?: "flashcards" }) => void;
}

export const FlashcardsPage: React.FC<FlashcardsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [deckDone, setDeckDone] = useState(false);
  const [shuffled, setShuffled] = useState<Flashcard[] | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<FlashcardDeck | null>(null);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const [deckPage, setDeckPage] = useState(1);
  const [previewDeck, setPreviewDeck] = useState<FlashcardDeck | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewFlipped, setPreviewFlipped] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShuffled(null);
    setCardIndex(0);
    setDeckDone(false);
    setIsFlipped(false);
  }, [activeDeck?.id]);

  useEffect(() => {
    let isSubscribed = true;
    const fetchDecks = async () => {
      try {
        const res = await authFetch(`/api/flashcards?userId=${currentUser?.id || ""}`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed) {
            setDecks(data);
          }
        }
      } catch (err) {
        console.error("Fetch decks error:", err);
      }
    };

    fetchDecks();
    return () => {
      isSubscribed = false;
    };
  }, [currentUser?.id]);

  const toggleFlip = useCallback(() => {
    setIsFlipped((prev) => !prev);
  }, []);

  const handleNext = useCallback(() => {
    if (!activeDeck) return;
    setIsFlipped(false);
    if (cardIndex < activeDeck.cards.length - 1) {
      setCardIndex((prev) => prev + 1);
    } else {
      setDeckDone(true);
    }
  }, [activeDeck, cardIndex]);

  const restartDeck = useCallback(() => {
    setDeckDone(false);
    setCardIndex(0);
    setDeckDone(false);
    setIsFlipped(false);
  }, []);

  const handlePrev = useCallback(() => {
    if (!activeDeck) return;
    setIsFlipped(false);
    if (deckDone) {
      setDeckDone(false);
      return;
    }
    if (cardIndex > 0) {
      setCardIndex((prev) => prev - 1);
    }
  }, [activeDeck, cardIndex, deckDone]);

  const handleShuffle = useCallback(() => {
    if (!activeDeck) return;
    const copy = [...activeDeck.cards];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    setShuffled(copy);
    setCardIndex(0);
    setDeckDone(false);
    setIsFlipped(false);
    setIsShuffling(true);
    setTimeout(() => setIsShuffling(false), 450);
  }, [activeDeck]);

  // Handle Spacebar key for card flipping
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        toggleFlip();
      } else if (e.code === "ArrowRight") {
        handleNext();
      } else if (e.code === "ArrowLeft") {
        handlePrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFlip, handleNext, handlePrev]);

  // Keyboard controls for the deck preview modal.
  useEffect(() => {
    if (!previewDeck) return;
    const handlePreviewKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewDeck(null);
      } else if (e.key === "ArrowRight") {
        setPreviewIndex((prev) => Math.min(previewDeck.cards.length - 1, prev + 1));
        setPreviewFlipped(false);
      } else if (e.key === "ArrowLeft") {
        setPreviewIndex((prev) => Math.max(0, prev - 1));
        setPreviewFlipped(false);
      } else if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setPreviewFlipped((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handlePreviewKeyDown);
    return () => window.removeEventListener("keydown", handlePreviewKeyDown);
  }, [previewDeck]);

  const handleDeleteDeck = async (deckId: string) => {
    setDeletingDeck(true);
    try {
      const res = await authFetch(`/api/flashcards/${deckId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data?.error || "Could not delete the deck. Please try again.", "error");
        return;
      }
      setDecks((prev) => prev.filter((deck) => deck.id !== deckId));
      if (activeDeck?.id === deckId) {
        setActiveDeck(null);
        setCardIndex(0);
        setDeckDone(false);
        setIsFlipped(false);
      }
      if (previewDeck?.id === deckId) {
        setPreviewDeck(null);
      }
      setDeckToDelete(null);
      showToast("Deck deleted.");
    } catch (err) {
      console.error("Delete deck error:", err);
      showToast("Could not delete the deck. Please try again.", "error");
    } finally {
      setDeletingDeck(false);
    }
  };

  const enterDeck = (deck: FlashcardDeck) => {
    setActiveDeck(deck);
    setCardIndex(0);
    setDeckDone(false);
    setIsFlipped(false);
    setShuffled(null);
  };

  const openPreview = (deck: FlashcardDeck) => {
    setPreviewDeck(deck);
    setPreviewIndex(0);
    setPreviewFlipped(false);
  };

  const viewCards: Flashcard[] = shuffled ?? activeDeck?.cards ?? [];
  const activeCard: Flashcard | undefined = viewCards[cardIndex];
  const totalCards = viewCards.length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Library view — compact deck cards, user chooses which to study */}
      {!activeDeck ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-foreground">Flashcard Decks</h2>
                <p className="text-xs text-muted-foreground">{decks.length} deck{decks.length === 1 ? "" : "s"} available — choose a deck to start studying.</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("ai-assistant", { mode: "flashcards" })}
              className="px-4 py-2.5 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>AI Flashcard Generator</span>
            </button>
          </div>

          {decks.length === 0 ? (
            <div className="p-8 text-center bg-card rounded-2xl border border-border">
              <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-bold text-foreground">No flashcard decks yet</p>
              <p className="text-xs text-muted-foreground mt-1">Generate flashcards from your materials with the AI Flashcard Generator above.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {slicePage(decks, deckPage).map((d) => (
                  <div
                    key={d.id}
                    onClick={() => openPreview(d)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPreview(d);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Preview cards in ${d.title}`}
                    title="Click to preview the flashcards in this deck"
                    className="group bg-card p-4 rounded-2xl border border-border shadow-xs hover:border-primary/50 transition-all flex flex-col gap-3 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-foreground truncate" title={d.title}>{d.title}</h3>
                        <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold whitespace-nowrap">
                          {d.cards.length} Card{d.cards.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {(currentUser?.role === "teacher" || currentUser?.role === "admin" || d.createdById === currentUser?.id) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeckToDelete(d);
                          }}
                          title="Delete deck"
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        enterDeck(d);
                      }}
                      className="mt-auto w-full px-4 py-2.5 bg-structure hover:bg-structure-strong text-structure-foreground rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Start Studying</span>
                    </button>
                  </div>
                ))}
              </div>
              <Pagination
                page={deckPage}
                total={decks.length}
                onPageChange={setDeckPage}
              />
            </>
          )}
        </div>
      ) : activeCard ? (
        <div className="space-y-6">
          {/* Deck Header & Progress Bar */}
          <div className="bg-card p-4 rounded-xl border border-border shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <button
                  onClick={() => setActiveDeck(null)}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted transition-all shrink-0"
                  title="Back to decks"
                >
                  <ArrowLeft className="w-4 h-4 text-foreground" />
                </button>
                <h2 className="text-sm font-bold text-foreground truncate flex-1">{activeDeck.title}</h2>
                <span className="text-muted-foreground whitespace-nowrap text-xs truncate max-w-[38%]">{activeDeck.subjectName}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:shrink-0 min-w-0">
                <select
                  value={activeDeck.id}
                  onChange={(e) => {
                    const d = decks.find((dk) => dk.id === e.target.value);
                    if (d) {
                      setActiveDeck(d);
                      setCardIndex(0);
                      setDeckDone(false);
                      setIsFlipped(false);
                    }
                  }}
                  className="bg-card text-foreground border border-border rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none w-full sm:w-auto min-w-0 max-w-full"
                >
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.cards.length} cards)
                    </option>
                  ))}
                </select>

                {(currentUser?.role === "teacher" ||
                  currentUser?.role === "admin" ||
                  activeDeck.createdById === currentUser?.id) && (
                  <button
                    onClick={() => setDeckToDelete(activeDeck)}
                    title="Delete active deck"
                    className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Deck</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-primary font-bold whitespace-nowrap">
                Card {cardIndex + 1} / {totalCards}
              </span>
              <div
                className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={totalCards}
                aria-valuenow={cardIndex + 1}
              >
                <div
                  className="h-full bg-brand-gradient rounded-full transition-all duration-300"
                  style={{ width: `${totalCards ? ((cardIndex + 1) / totalCards) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {deckDone ? (
            <div className="w-full h-80 rounded-2xl border border-structure-strong bg-structure flex flex-col items-center justify-center gap-4 text-center p-8 animate-in fade-in zoom-in-95">
              <div className="h-14 w-14 rounded-2xl bg-cta-gradient text-white flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Deck complete</h2>
                <p className="text-sm text-muted-foreground mt-1">You reviewed all {totalCards} cards. Go again to lock them in.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={restartDeck} className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold cursor-pointer">Study again</button>
                <button onClick={() => { handleShuffle(); setDeckDone(false); }} className="px-4 py-2 bg-card border border-structure-strong text-structure-foreground hover:bg-structure-strong rounded-xl text-xs font-bold cursor-pointer">Shuffle and restart</button>
              </div>
            </div>
          ) : (
          <>
          {/* 3D Flip Card Container */}
          <div
            key={`card-${activeDeck.id}-${cardIndex}-${isFlipped}`}
            onClick={toggleFlip}
            className={`w-full h-80 perspective-1000 transform-style-3d cursor-pointer select-none group ${isShuffling ? "animate-in fade-in zoom-in-95" : ""}`}
          >
            <div
              className={`relative w-full h-full rounded-2xl border-2 transition-transform duration-500 transform-style-3d shadow-xl ${
                isFlipped ? "rotate-y-180 border-primary bg-card" : "border-border bg-card hover:border-primary/50"
              }`}
            >
              {/* FRONT SIDE (Question) */}
              <div className="absolute inset-0 backface-hidden p-8 flex flex-col rounded-2xl bg-card">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="uppercase text-[10px] tracking-wider font-bold text-primary">Question</span>
                  <span className="text-primary font-bold text-xs flex items-center space-x-1 opacity-80 group-hover:opacity-100">
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Click to flip</span>
                  </span>
                </div>

                <div className="flex flex-1 items-center justify-center text-center px-4">
                  <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
                    {activeCard.question}
                  </h2>
                </div>
              </div>

              {/* BACK SIDE (Answer) */}
              <div className="absolute inset-0 backface-hidden rotate-y-180 p-8 flex flex-col rounded-2xl bg-primary/5 dark:bg-card border border-primary/20">
                <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                  <span className="uppercase text-[10px] tracking-wider flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Answer</span>
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">Click to flip back</span>
                </div>

                <div className="flex flex-1 items-center justify-center text-center px-4">
                  <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">
                    {activeCard.answer}
                  </p>
                </div>
              </div>
            </div>
          </div>

          </>
          )}

          {/* Navigation */}
          <div className="bg-card p-5 rounded-2xl border border-border shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handlePrev}
                disabled={cardIndex === 0}
                className="px-4 py-2 bg-muted hover:bg-structure hover:text-structure-foreground text-foreground disabled:opacity-40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleShuffle}
                  className="px-3 py-2 bg-muted hover:bg-structure hover:text-structure-foreground text-foreground rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5"
                  title="Shuffle to a random card"
                >
                  <Shuffle className="w-4 h-4" />
                  <span className="hidden sm:inline">Shuffle</span>
                </button>
                <button
                  onClick={restartDeck}
                  className="px-3 py-2 bg-muted hover:bg-structure hover:text-structure-foreground text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Reset Deck
                </button>
              </div>

              <button
                onClick={handleNext}
                className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex justify-center pt-3">
              <button
                onClick={() => setActiveDeck(null)}
                className="text-xs text-muted-foreground hover:text-foreground font-semibold underline"
              >
                Back to Deck List
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-card rounded-2xl border border-border">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">No flashcards found in this deck.</p>
          <button onClick={() => setActiveDeck(null)} className="mt-3 text-xs text-primary font-semibold hover:underline">
            Back to Decks
          </button>
        </div>
      )}

      {/* DECK PREVIEW MODAL — flip through a deck before studying it */}
      {previewDeck && (() => {
        const cards = previewDeck.cards;
        const previewCard = cards[previewIndex] as Flashcard | undefined;
        const previewTotal = cards.length;
        const closePreview = () => setPreviewDeck(null);
        return (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closePreview();
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`Preview of ${previewDeck.title}`}
          >
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full shadow-xl my-8 animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-primary/10 text-primary rounded-xl shrink-0">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    {previewDeck.subjectName && (
                      <span className="inline-block px-2 py-0.5 bg-primary/10 text-primary font-mono text-[10px] font-bold rounded-md uppercase tracking-wider truncate max-w-[200px]">
                        {previewDeck.subjectName}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-foreground truncate mt-0.5">{previewDeck.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {previewTotal === 0 ? "No flashcards" : `Card ${previewIndex + 1} / ${previewTotal}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closePreview}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg cursor-pointer shrink-0"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {!previewCard ? (
                <div className="p-10 text-center space-y-2">
                  <Layers className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                  <p className="text-sm font-bold text-foreground">This deck has no flashcards yet.</p>
                  <p className="text-xs text-muted-foreground">Generate cards in the AI Study Assistant to fill this deck.</p>
                </div>
              ) : (
                <div className="p-5 space-y-4 overflow-y-auto">
                  <div
                    onClick={() => setPreviewFlipped((prev) => !prev)}
                    className="w-full h-64 perspective-1000 cursor-pointer select-none group"
                  >
                    <div
                      className={`relative w-full h-full rounded-2xl border-2 transition-transform duration-500 transform-style-3d shadow-md ${
                        previewFlipped ? "rotate-y-180 border-primary bg-card" : "border-border bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="absolute inset-0 backface-hidden p-6 flex flex-col rounded-2xl bg-card">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="uppercase text-[10px] tracking-wider font-bold text-primary">Question</span>
                          <span className="text-primary font-bold text-xs flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Click to flip</span>
                          </span>
                        </div>
                        <div className="flex flex-1 items-center justify-center text-center px-2">
                          <h4 className="text-lg sm:text-xl font-bold text-foreground leading-snug">{previewCard.question}</h4>
                        </div>
                      </div>

                      <div className="absolute inset-0 backface-hidden rotate-y-180 p-6 flex flex-col rounded-2xl bg-primary/5 dark:bg-card border border-primary/20">
                        <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                          <span className="uppercase text-[10px] tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Answer</span>
                          </span>
                          <span className="text-xs text-muted-foreground font-normal">Click to flip back</span>
                        </div>
                        <div className="flex flex-1 items-center justify-center text-center px-2">
                          <p className="text-base sm:text-lg font-semibold text-foreground leading-relaxed">{previewCard.answer}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setPreviewIndex((prev) => Math.max(0, prev - 1));
                        setPreviewFlipped(false);
                      }}
                      disabled={previewIndex === 0}
                      className="px-3 py-2 bg-muted hover:bg-structure hover:text-structure-foreground text-foreground disabled:opacity-40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Previous</span>
                    </button>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {previewIndex + 1} of {previewTotal}
                    </span>
                    <button
                      onClick={() => {
                        setPreviewIndex((prev) => Math.min(previewTotal - 1, prev + 1));
                        setPreviewFlipped(false);
                      }}
                      disabled={previewIndex >= previewTotal - 1}
                      className="px-3 py-2 bg-muted hover:bg-structure hover:text-structure-foreground text-foreground disabled:opacity-40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 p-5 border-t border-border">
                <button
                  onClick={closePreview}
                  className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const deck = previewDeck;
                    setPreviewDeck(null);
                    enterDeck(deck);
                  }}
                  disabled={previewTotal === 0}
                  className="px-4 py-2 bg-cta-gradient hover:brightness-110 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Start Studying</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {deckToDelete && <DeleteFlashcardDeckModal deck={deckToDelete} busy={deletingDeck} onClose={() => setDeckToDelete(null)} onConfirm={() => handleDeleteDeck(deckToDelete.id)} />}
    </div>
  );
};
