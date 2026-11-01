import { CARD_COUNT, TABLEAU_COUNT, SolitaireSession, rankOf, suitOf, type Card, type SolitaireSnapshot } from "./solitaire.js";

export const SAVE_FORMAT = "ksu.game.save";
export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_APP_ID = "solitaire";
export const DEFAULT_MAX_SAVE_BYTES = 8 * 1024 * 1024;

export interface SolitaireSaveEnvelope {
  format: typeof SAVE_FORMAT;
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  appId: typeof SAVE_APP_ID;
  kind: "logical-snapshot";
  gameBuild: "rules-1";
  contentVersion: "1";
  payload: SolitaireSnapshot;
}

export class SaveError extends Error {
  constructor(readonly reason: string) {
    super(`solitaire save rejected: ${reason}`);
    this.name = "SaveError";
  }
}

function fail(reason: string): never {
  throw new SaveError(reason);
}

function isCard(value: unknown): value is Card {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < CARD_COUNT;
}

function isInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function cardsOf(pile: {cards: Card[]}): Card[] {
  return pile.cards;
}

function assertUniqueCards(cards: Card[], label: string): void {
  if (cards.length !== CARD_COUNT || new Set(cards).size !== CARD_COUNT) fail(`${label} must contain 52 unique cards`);
}

function validatePiles(s: Record<string, unknown>, label: string): void {
  if (!Array.isArray(s.stock) || !s.stock.every(isCard)) fail(`${label} stock`);
  if (!Array.isArray(s.waste) || !s.waste.every(isCard)) fail(`${label} waste`);
  if (!isInteger(s.wasteVisibleFrom, 0, s.waste.length)) fail(`${label} waste visibility`);
  if (!Array.isArray(s.tableau) || s.tableau.length !== TABLEAU_COUNT) fail(`${label} tableau`);
  for (const pile of s.tableau) {
    if (!pile || !Array.isArray(pile.cards) || !pile.cards.every(isCard) || !isInteger(pile.faceUpCount, 0, pile.cards.length)) {
      fail(`${label} tableau pile`);
    }
  }
  if (!Array.isArray(s.foundations) || s.foundations.length !== 4 || !s.foundations.every((pile) => Array.isArray(pile) && pile.every(isCard))) {
    fail(`${label} foundations`);
  }
  for (const foundation of s.foundations as Card[][]) {
    if (foundation.some((card, index) => (index > 0 && suitOf(card) !== suitOf(foundation[0])) || rankOf(card) !== index)) {
      fail(`${label} foundation order`);
    }
  }
  const cards = [
    ...(s.stock as Card[]),
    ...(s.waste as Card[]),
    ...(s.tableau as {cards: Card[]}[]).flatMap(cardsOf),
    ...(s.foundations as Card[][]).flat(),
  ];
  assertUniqueCards(cards, label);
}

function validateUndoEntry(value: unknown, index: number): void {
  if (typeof value !== "object" || value === null) fail(`invalid undo entry ${index}`);
  const entry = value as Record<string, unknown>;
  validatePiles(entry, `undo entry ${index}`);
  if (!isInteger(entry.score, -1000000, 1000000)) fail(`invalid undo score ${index}`);
  if (!isInteger(entry.moves) || !isInteger(entry.redeals) || typeof entry.won !== "boolean") fail(`invalid undo counters ${index}`);
}

export function validateSnapshot(value: unknown): asserts value is SolitaireSnapshot {
  if (typeof value !== "object" || value === null) fail("payload is not an object");
  const s = value as Record<string, unknown>;
  if (s.drawMode !== 1 && s.drawMode !== 3) fail("invalid draw mode");
  validatePiles(s, "payload");
  if (!isInteger(s.score, -1000000, 1000000)) fail("invalid score");
  if (!isInteger(s.moves) || !isInteger(s.redeals)) fail("invalid counters");
  if (typeof s.elapsedMs !== "number" || !Number.isFinite(s.elapsedMs) || s.elapsedMs < 0) fail("invalid elapsed time");
  if (!isInteger(s.rngState, 1, 0xffffffff)) fail("invalid RNG state");
  if (!Array.isArray(s.undoStack) || s.undoStack.length > 100) fail("invalid undo stack");
  s.undoStack.forEach(validateUndoEntry);
  if (typeof s.won !== "boolean" || typeof s.paused !== "boolean") fail("invalid flags");
}

export function encodeSave(session: SolitaireSession): string {
  const envelope: SolitaireSaveEnvelope = {
    format: SAVE_FORMAT,
    schemaVersion: SAVE_SCHEMA_VERSION,
    appId: SAVE_APP_ID,
    kind: "logical-snapshot",
    gameBuild: "rules-1",
    contentVersion: "1",
    payload: session.snapshot(),
  };
  return JSON.stringify(envelope);
}

export function decodeSave(text: string, maxBytes: number = DEFAULT_MAX_SAVE_BYTES): SolitaireSaveEnvelope {
  if (new TextEncoder().encode(text).byteLength > maxBytes) fail("document exceeds the size limit");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail("document is not valid JSON");
  }
  if (typeof parsed !== "object" || parsed === null) fail("document is not an object");
  const envelope = parsed as Record<string, unknown>;
  if (envelope.format !== SAVE_FORMAT) fail("unknown format");
  if (envelope.schemaVersion !== SAVE_SCHEMA_VERSION) fail("unsupported schema version");
  if (envelope.appId !== SAVE_APP_ID) fail("wrong app id");
  if (envelope.kind !== "logical-snapshot") fail("unexpected kind");
  if (envelope.gameBuild !== "rules-1" || envelope.contentVersion !== "1") fail("unsupported rules version");
  validateSnapshot(envelope.payload);
  return envelope as unknown as SolitaireSaveEnvelope;
}

export function sessionFromSave(envelope: SolitaireSaveEnvelope): SolitaireSession {
  return new SolitaireSession("restore", envelope.payload.drawMode, envelope.payload);
}
