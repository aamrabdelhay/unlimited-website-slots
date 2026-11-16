import type { GameMode, MapId } from "./state.js";

export const GAME_MODES = ["race", "eat-others", "collect-points"] as const;
export const GAME_MAPS = ["garden", "street", "station", "home", "night", "kitchen"] as const;
export const CHARACTER_IDS = [
  "snake", "worm", "bird", "chicken", "duck", "owl", "cat", "deer",
  "croc", "falcon", "lion", "panda", "fish", "fox", "rabbit", "turtle", "penguin"
] as const;

export interface SpawnPoint {
  x: number;
  z: number;
}

export interface ReadyPlayer {
  ready: boolean;
}

export interface MoveVector {
  x: number;
  z: number;
}

export function normalizeMode(value: unknown): GameMode {
  return GAME_MODES.includes(value as GameMode) ? value as GameMode : "collect-points";
}

export function normalizeMap(value: unknown): MapId {
  return GAME_MAPS.includes(value as MapId) ? value as MapId : "garden";
}

export function normalizeSkinId(value: unknown): string {
  return CHARACTER_IDS.includes(value as (typeof CHARACTER_IDS)[number]) ? value as string : "snake";
}

export function sanitizePlayerName(value: unknown): string {
  if (typeof value !== "string") return "Player";
  const safe = value
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16);
  return safe || "Player";
}

export function normalizeMoveVector(value: unknown): MoveVector {
  if (!value || typeof value !== "object") return { x: 0, z: 0 };
  const candidate = value as Record<string, unknown>;
  const rawX = typeof candidate.x === "number" && Number.isFinite(candidate.x) ? candidate.x : 0;
  const rawZ = typeof candidate.z === "number" && Number.isFinite(candidate.z) ? candidate.z : 0;
  const x = Math.max(-1, Math.min(1, rawX));
  const z = Math.max(-1, Math.min(1, rawZ));
  const length = Math.hypot(x, z);
  if (length <= 0.0001) return { x: 0, z: 0 };
  const scale = length > 1 ? 1 / length : 1;
  return { x: x * scale, z: z * scale };
}

export function allPlayersReady(players: Iterable<ReadyPlayer>, minimumPlayers = 2): boolean {
  const list = Array.from(players);
  return list.length >= minimumPlayers && list.every((player) => player.ready === true);
}

export function getMapBounds(map: MapId): { minX: number; maxX: number; minZ: number; maxZ: number } {
  if (map === "home" || map === "kitchen") {
    return { minX: -29, maxX: 29, minZ: -24, maxZ: 24 };
  }
  if (map === "station") {
    return { minX: -13.2, maxX: 13.2, minZ: -92, maxZ: 92 };
  }
  return { minX: -90, maxX: 90, minZ: -90, maxZ: 90 };
}

export function getSafeSpawn(map: MapId, playerIndex: number): SpawnPoint {
  const index = Math.max(0, Math.floor(playerIndex));
  const indoorSpawns: SpawnPoint[] = [
    { x: 18, z: 12 }, { x: -25, z: 12 }, { x: 18, z: -15 }, { x: -25, z: -14 }
  ];
  const stationSpawns: SpawnPoint[] = [
    { x: -8.8, z: -28 }, { x: 8.8, z: -28 }, { x: -8.8, z: 28 }, { x: 8.8, z: 28 }
  ];
  const outdoorSpawns: SpawnPoint[] = [
    { x: -9, z: -9 }, { x: 9, z: -9 }, { x: -9, z: 9 }, { x: 9, z: 9 }
  ];

  if (map === "station") return stationSpawns[index % stationSpawns.length]!;
  if (map === "home" || map === "kitchen") return indoorSpawns[index % indoorSpawns.length]!;
  return outdoorSpawns[index % outdoorSpawns.length]!;
}

export function getMatchDurationSeconds(mode: GameMode): number {
  return mode === "race" ? 150 : 180;
}

export function getScoreLimit(mode: GameMode): number {
  return mode === "race" ? 20 : Number.MAX_SAFE_INTEGER;
}

export function chooseWinner<T extends { score: number; matchCoins: number }>(
  entries: Array<{ id: string; player: T }>
): string {
  const sorted = [...entries].sort((a, b) =>
    b.player.score - a.player.score || b.player.matchCoins - a.player.matchCoins || a.id.localeCompare(b.id)
  );
  return sorted[0]?.id ?? "";
}
