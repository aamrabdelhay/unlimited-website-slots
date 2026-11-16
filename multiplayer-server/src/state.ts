import { MapSchema, Schema, type } from "@colyseus/schema";

export type GameMode = "race" | "eat-others" | "collect-points";
export type MapId = "garden" | "street" | "station" | "home" | "night" | "kitchen";
export type MatchPhase = "lobby" | "countdown" | "running" | "results";
export type PickupKind = "food" | "coin";

export class PlayerState extends Schema {
  @type("string") name = "Player";
  @type("string") skinId = "snake";
  @type("boolean") ready = false;
  @type("boolean") isHost = false;
  @type("boolean") connected = true;
  @type("boolean") alive = true;
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") yaw = 0;
  @type("number") score = 0;
  @type("number") length = 3;
  @type("number") matchCoins = 0;
  @type("number") respawnAt = 0;
}

export class PickupState extends Schema {
  @type("string") kind: PickupKind = "food";
  @type("number") x = 0;
  @type("number") z = 0;
  @type("number") value = 1;
}

export class WildTrailsState extends Schema {
  @type("string") mode: GameMode = "collect-points";
  @type("string") map: MapId = "garden";
  @type("string") phase: MatchPhase = "lobby";
  @type("boolean") isPrivate = false;
  @type("string") hostSessionId = "";
  @type("number") maxPlayers = 4;
  @type("number") countdownEndsAt = 0;
  @type("number") countdownValue = 0;
  @type("number") matchStartedAt = 0;
  @type("number") matchEndsAt = 0;
  @type("number") matchDurationSeconds = 180;
  @type("number") scoreLimit = 20;
  @type("string") winnerSessionId = "";
  @type("string") winnerName = "";
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: PickupState }) pickups = new MapSchema<PickupState>();
}
