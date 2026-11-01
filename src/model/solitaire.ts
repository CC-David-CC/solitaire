import { Rng } from "./rng.js";

export type Card = number;
export type Suit = 0 | 1 | 2 | 3;
export type SourcePile = "waste" | "tableau" | "foundation";
export type DestPile = "tableau" | "foundation";

export const CARD_COUNT = 52;
export const TABLEAU_COUNT = 7;

export interface PileState {
  cards: Card[];
  faceUpCount: number;
}

export interface MoveRequest {
  from: SourcePile;
  fromIndex: number;
  count: number;
  to: DestPile;
  toIndex: number;
}

export interface MoveResult {
  ok: boolean;
  reason: string | null;
}

export interface UndoEntry {
  stock: Card[];
  waste: Card[];
  wasteVisibleFrom: number;
  tableau: PileState[];
  foundations: Card[][];
  score: number;
  moves: number;
  redeals: number;
  won: boolean;
}

export interface SolitaireSnapshot {
  drawMode: 1 | 3;
  stock: Card[];
  waste: Card[];
  wasteVisibleFrom: number;
  tableau: PileState[];
  foundations: Card[][];
  score: number;
  moves: number;
  redeals: number;
  elapsedMs: number;
  undoStack: UndoEntry[];
  rngState: number;
  won: boolean;
  paused: boolean;
}

export function rankOf(card: Card): number {
  return card % 13;
}

export function suitOf(card: Card): Suit {
  return Math.floor(card / 13) as Suit;
}

export function isRed(card: Card): boolean {
  const suit = suitOf(card);
  return suit === 0 || suit === 2;
}

export function cardKey(card: Card): string {
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  return `${ranks[rankOf(card)]}${["H", "C", "D", "S"][suitOf(card)]}`;
}

export class SolitaireSession {
  readonly rng: Rng;
  drawMode: 1 | 3 = 3;
  stock: Card[] = [];
  waste: Card[] = [];
  wasteVisibleFrom = 0;
  tableau: PileState[] = [];
  foundations: Card[][] = [[], [], [], []];
  score = 0;
  moves = 0;
  redeals = 0;
  elapsedMs = 0;
  undoStack: UndoEntry[] = [];
  won = false;
  paused = false;

  constructor(seed: string | number = "solitaire", drawMode: 1 | 3 = 3, snapshot?: SolitaireSnapshot) {
    this.rng = new Rng(seed);
    this.drawMode = drawMode;
    if (snapshot !== undefined) {
      this.applySnapshot(snapshot);
      return;
    }
    this.deal();
  }

  deal(): void {
    const deck: Card[] = Array.from({ length: CARD_COUNT }, (_, index) => index);
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = this.rng.int(i + 1);
      const a = deck[i];
      deck[i] = deck[j];
      deck[j] = a;
    }
    this.tableau = Array.from({ length: TABLEAU_COUNT }, () => ({ cards: [], faceUpCount: 0 }));
    for (let pile = 0; pile < TABLEAU_COUNT; pile += 1) {
      for (let card = 0; card <= pile; card += 1) this.tableau[pile].cards.push(deck.pop() as Card);
      this.tableau[pile].faceUpCount = 1;
    }
    this.stock = deck;
    this.waste = [];
    this.wasteVisibleFrom = 0;
    this.foundations = [[], [], [], []];
    this.score = 0;
    this.moves = 0;
    this.redeals = 0;
    this.elapsedMs = 0;
    this.undoStack = [];
    this.won = false;
  }

  private sourceCards(request: MoveRequest): Card[] {
    if (request.from === "waste") return this.waste.slice(request.fromIndex);
    if (request.from === "foundation") return this.foundations[request.fromIndex].slice(-1);
    return this.tableau[request.fromIndex].cards.slice(-request.count);
  }

  isValidMove(request: MoveRequest): boolean {
    return this.validateMove(request) === null;
  }

  private validateMove(request: MoveRequest): string | null {
    if (request.count < 1 || !Number.isInteger(request.count)) return "invalid count";
    if (!Number.isInteger(request.fromIndex) || !Number.isInteger(request.toIndex) || request.fromIndex < 0 || request.toIndex < 0 || !['waste','foundation','tableau'].includes(request.from) || !['foundation','tableau'].includes(request.to)) return "invalid pile";
    if ((request.from === 'tableau' && request.fromIndex >= this.tableau.length) || (request.from === 'foundation' && request.fromIndex >= this.foundations.length) || (request.to === 'tableau' && request.toIndex >= this.tableau.length) || (request.to === 'foundation' && request.toIndex >= this.foundations.length)) return "invalid pile";
    if (request.from === 'tableau' && request.to === 'tableau' && request.fromIndex === request.toIndex) return "choose a different pile";
    const source = this.sourceCards(request);
    if (source.length < request.count) return "not enough cards";
    const run = source.slice(0, request.count);
    if (request.from === "waste") {
      if (request.fromIndex !== this.waste.length - 1) return "card is not exposed";
      if (request.count !== 1) return "waste moves one card";
    } else if (request.from === "foundation") {
      if (request.count !== 1) return "foundation moves one card";
      if (run[0] !== this.foundations[request.fromIndex].at(-1)) return "only the top card moves";
    } else {
      const pile = this.tableau[request.fromIndex];
      const faceUpStart = Math.max(0, pile.cards.length - pile.faceUpCount);
      if (pile.cards.length - request.count < faceUpStart) return "card is face down";
      if (request.to === "tableau") {
        for (let i = 1; i < run.length; i += 1) {
          const below = run[i];
          const above = run[i - 1];
          if (rankOf(above) !== rankOf(below) + 1 || isRed(above) === isRed(below)) {
            return "not a valid descending alternating run";
          }
        }
      } else if (request.count !== 1) return "only one card may move to a foundation";
    }
    if (request.to === "foundation") {
      const foundation = this.foundations[request.toIndex];
      const card = run[0];
      if (foundation.length === 0) return rankOf(card) === 0 ? null : "foundation starts with an ace";
      const top = foundation[foundation.length - 1];
      return suitOf(card) === suitOf(top) && rankOf(card) === rankOf(top) + 1
        ? null
        : "foundation needs the next rank of the same suit";
    }
    const destination = this.tableau[request.toIndex];
    const card = run[0];
    if (destination.cards.length === 0) return rankOf(card) === 12 ? null : "only a king may start a tableau pile";
    const top = destination.cards[destination.cards.length - 1];
    return rankOf(card) === rankOf(top) - 1 && isRed(card) !== isRed(top)
      ? null
      : "tableau needs a descending opposite-color card";
  }

  commitMove(request: MoveRequest): MoveResult {
    if (this.paused || this.won) return { ok: false, reason: "game is not accepting moves" };
    const reason = this.validateMove(request);
    if (reason !== null) return { ok: false, reason };
    this.pushUndo();
    const run = this.sourceCards(request).slice(0, request.count);
    if (request.from === "waste") {
      this.waste.splice(request.fromIndex, request.count);
      this.wasteVisibleFrom = Math.max(0, this.waste.length - this.drawMode);
      this.score += request.to === "foundation" ? 10 : 5;
    } else if (request.from === "foundation") {
      this.foundations[request.fromIndex].pop();
      this.score -= 15;
    } else {
      this.tableau[request.fromIndex].cards.splice(-request.count, request.count);
      if (request.to === "foundation") this.score += 10;
      const source = this.tableau[request.fromIndex];
      source.faceUpCount -= request.count;
      if (source.cards.length && source.faceUpCount === 0) source.faceUpCount = 1;
    }
    if (request.to === "tableau") { this.tableau[request.toIndex].cards.push(...run); this.tableau[request.toIndex].faceUpCount += run.length; }
    else this.foundations[request.toIndex].push(...run);
    this.moves += 1;
    this.won = this.foundations.reduce((sum, pile) => sum + pile.length, 0) === CARD_COUNT;
    return { ok: true, reason: null };
  }

  draw(): void {
    if (this.paused || this.won) return;
    if (this.stock.length > 0) {
      this.pushUndo();
      const count = Math.min(this.drawMode, this.stock.length);
      const drawn = this.stock.splice(-count, count).reverse();
      this.waste.push(...drawn);
      this.wasteVisibleFrom = this.waste.length - Math.min(this.drawMode, this.waste.length);
      this.moves += 1;
      return;
    }
    if (this.waste.length > 0) {
      this.pushUndo();
      this.stock.push(...this.waste.reverse());
      this.waste = [];
      this.wasteVisibleFrom = 0;
      this.redeals += 1;
      this.moves += 1;
    }
  }

  autoFoundation(): number {
    let moved = 0;
    let progress = true;
    while (progress && !this.won) {
      progress = false;
      const candidates: MoveRequest[] = [];
      if (this.waste.length > 0) {
        candidates.push({ from: "waste", fromIndex: this.waste.length-1, count: 1, to: "foundation", toIndex: suitOf(this.waste[this.waste.length-1]) });
      }
      for (let pile = 0; pile < TABLEAU_COUNT; pile += 1) {
        const cards = this.tableau[pile].cards;
        if (cards.length === 0) continue;
        const top = cards[cards.length - 1];
        candidates.push({ from: "tableau", fromIndex: pile, count: 1, to: "foundation", toIndex: suitOf(top) });
      }
      for (const candidate of candidates) {
        if (this.commitMove(candidate).ok) {
          moved += 1;
          progress = true;
          break;
        }
      }
    }
    return moved;
  }

  hint(): MoveRequest | null {
    const candidates: MoveRequest[] = [];
    if (this.waste.length > 0) {
      for (let pile = 0; pile < TABLEAU_COUNT; pile += 1) {
        candidates.push({ from: "waste", fromIndex: this.waste.length-1, count: 1, to: "tableau", toIndex: pile });
      }
      candidates.push({ from: "waste", fromIndex: this.waste.length-1, count: 1, to: "foundation", toIndex: suitOf(this.waste[this.waste.length-1]) });
    }
    for (let source = 0; source < TABLEAU_COUNT; source += 1) {
      const cards = this.tableau[source].cards;
      const faceUpStart = Math.max(0, cards.length - this.tableau[source].faceUpCount);
      for (let fromIndex = faceUpStart; fromIndex < cards.length; fromIndex += 1) {
        for (let dest = 0; dest < TABLEAU_COUNT; dest += 1) {
          if (dest !== source) candidates.push({ from: "tableau", fromIndex:source, count: cards.length - fromIndex, to: "tableau", toIndex: dest });
        }
        if (fromIndex === cards.length-1) candidates.push({ from: "tableau", fromIndex:source, count: 1, to: "foundation", toIndex: suitOf(cards[fromIndex]) });
      }
    }
    for (let suit = 0; suit < 4; suit += 1) {
      if (this.foundations[suit].length === 0) continue;
      for (let dest = 0; dest < TABLEAU_COUNT; dest += 1) {
        candidates.push({ from: "foundation", fromIndex: suit, count: 1, to: "tableau", toIndex: dest });
      }
    }
    return candidates.find((candidate) => this.isValidMove(candidate)) ?? null;
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (entry === undefined) return false;
    this.stock = [...entry.stock];
    this.waste = [...entry.waste];
    this.wasteVisibleFrom = entry.wasteVisibleFrom;
    this.tableau = entry.tableau.map((pile) => ({ cards: [...pile.cards], faceUpCount: pile.faceUpCount }));
    this.foundations = entry.foundations.map((pile) => [...pile]);
    this.score = entry.score;
    this.moves = entry.moves;
    this.redeals = entry.redeals;
    this.won = entry.won;
    return true;
  }

  private pushUndo(): void {
    this.undoStack.push(this.undoEntry());
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  private undoEntry(): UndoEntry {
    return {
      stock: [...this.stock],
      waste: [...this.waste],
      wasteVisibleFrom: this.wasteVisibleFrom,
      tableau: this.tableau.map((pile) => ({ cards: [...pile.cards], faceUpCount: pile.faceUpCount })),
      foundations: this.foundations.map((pile) => [...pile]),
      score: this.score,
      moves: this.moves,
      redeals: this.redeals,
      won: this.won,
    };
  }

  exposedCards(): { pile: number; index: number; card: Card }[] {
    const exposed: { pile: number; index: number; card: Card }[] = [];
    for (let pile = 0; pile < TABLEAU_COUNT; pile += 1) {
      const cards = this.tableau[pile].cards;
      const start = Math.max(0, cards.length - this.tableau[pile].faceUpCount);
      for (let index = start; index < cards.length; index += 1) exposed.push({ pile, index, card: cards[index] });
    }
    return exposed;
  }

  allCards(): Card[] {
    return [...this.stock, ...this.waste, ...this.tableau.flatMap((pile) => pile.cards), ...this.foundations.flat()];
  }

  advance(deltaMs: number): void {
    if (this.paused || this.won) return;
    this.elapsedMs += Math.min(Math.max(0, deltaMs), 250);
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    if (!this.won) this.paused = false;
  }

  snapshot(): SolitaireSnapshot {
    return {
      drawMode: this.drawMode,
      stock: [...this.stock],
      waste: [...this.waste],
      wasteVisibleFrom: this.wasteVisibleFrom,
      tableau: this.tableau.map((pile) => ({ cards: [...pile.cards], faceUpCount: pile.faceUpCount })),
      foundations: this.foundations.map((pile) => [...pile]),
      score: this.score,
      moves: this.moves,
      redeals: this.redeals,
      elapsedMs: this.elapsedMs,
      undoStack: this.undoStack.map((entry) => ({
        stock: [...entry.stock],
        waste: [...entry.waste],
        wasteVisibleFrom: entry.wasteVisibleFrom,
        tableau: entry.tableau.map((pile) => ({ cards: [...pile.cards], faceUpCount: pile.faceUpCount })),
        foundations: entry.foundations.map((pile) => [...pile]),
        score: entry.score,
        moves: entry.moves,
        redeals: entry.redeals,
        won: entry.won,
      })),
      rngState: this.rng.getState(),
      won: this.won,
      paused: this.paused,
    };
  }

  applySnapshot(snapshot: SolitaireSnapshot): void {
    this.drawMode = snapshot.drawMode;
    this.stock = [...snapshot.stock];
    this.waste = [...snapshot.waste];
    this.wasteVisibleFrom = snapshot.wasteVisibleFrom;
    this.tableau = snapshot.tableau.map((pile) => ({ cards: [...pile.cards], faceUpCount: pile.faceUpCount }));
    this.foundations = snapshot.foundations.map((pile) => [...pile]);
    this.score = snapshot.score;
    this.moves = snapshot.moves;
    this.redeals = snapshot.redeals;
    this.elapsedMs = snapshot.elapsedMs;
    this.undoStack = snapshot.undoStack.map((entry) => ({
      stock: [...entry.stock],
      waste: [...entry.waste],
      wasteVisibleFrom: entry.wasteVisibleFrom,
      tableau: entry.tableau.map((pile) => ({ cards: [...pile.cards], faceUpCount: pile.faceUpCount })),
      foundations: entry.foundations.map((pile) => [...pile]),
      score: entry.score,
      moves: entry.moves,
      redeals: entry.redeals,
      won: entry.won,
    }));
    this.rng.setState(snapshot.rngState);
    this.won = snapshot.won;
    this.paused = snapshot.paused;
  }
}
