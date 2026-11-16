import { Room, type Client } from "colyseus";
import { PickupState, PlayerState, WildTrailsState, type GameMode, type MapId } from "../state.js";
import {
  allPlayersReady,
  chooseWinner,
  getMapBounds,
  getMatchDurationSeconds,
  getSafeSpawn,
  getScoreLimit,
  normalizeMap,
  normalizeMode,
  normalizeMoveVector,
  normalizeSkinId,
  sanitizePlayerName
} from "../rules.js";

interface CreateRoomOptions {
  mode?: unknown;
  map?: unknown;
  visibility?: unknown;
}

interface JoinOptions {
  name?: unknown;
  skinId?: unknown;
}

interface InputMessage {
  x?: unknown;
  z?: unknown;
}

interface PlayerInput {
  x: number;
  z: number;
  receivedAt: number;
}

const COUNTDOWN_MS = 3_000;
const ROOM_TICK_MS = 50;
const PLAYER_SPEED = 7.0;
const FOOD_TARGET = 16;
const COIN_TARGET = 6;
const PICKUP_RADIUS = 1.25;
const PLAYER_CONTACT_RADIUS = 1.35;

export class WildTrailsRoom extends Room<{ state: WildTrailsState }> {
  override state = new WildTrailsState();
  override maxClients = 4;
  override maxMessagesPerSecond = 30;
  override patchRate = 50;

  private movementInputs = new Map<string, PlayerInput>();
  private nextPickupId = 1;
  private lastCountdownValue = 0;
  private lastPickupSpawnAt = 0;
  private previousPlayerCount = 0;

  override messages = {
    "player:ready": (client: Client, payload: unknown) => this.handleReady(client, payload),
    "lobby:settings": (client: Client, payload: unknown) => this.handleSettings(client, payload),
    "match:start": (client: Client) => this.handleStart(client),
    "player:input": (client: Client, payload: InputMessage) => this.handleInput(client, payload)
  };

  override async onCreate(options: CreateRoomOptions = {}) {
    this.state.mode = normalizeMode(options.mode);
    this.state.map = normalizeMap(options.map);
    this.state.isPrivate = options.visibility === "private";
    this.state.maxPlayers = this.maxClients;
    this.state.matchDurationSeconds = getMatchDurationSeconds(this.state.mode);
    this.state.scoreLimit = getScoreLimit(this.state.mode);

    await this.setMatchmaking({
      private: this.state.isPrivate,
      unlisted: this.state.isPrivate,
      maxClients: this.maxClients,
      metadata: {
        mode: this.state.mode,
        map: this.state.map,
        phase: this.state.phase,
        visibility: this.state.isPrivate ? "private" : "public"
      }
    });

    this.setSimulationInterval((deltaTime) => this.update(deltaTime), ROOM_TICK_MS);
  }

  override onJoin(client: Client, options: JoinOptions = {}) {
    if (this.state.phase !== "lobby") {
      client.leave(4011);
      return;
    }

    const player = new PlayerState();
    player.name = sanitizePlayerName(options.name);
    player.skinId = normalizeSkinId(options.skinId);
    player.isHost = this.state.hostSessionId === "";

    const spawn = getSafeSpawn(this.state.map, this.state.players.size);
    player.x = spawn.x;
    player.z = spawn.z;
    player.yaw = 0;

    this.state.players.set(client.sessionId, player);
    if (!this.state.hostSessionId) this.state.hostSessionId = client.sessionId;
    this.previousPlayerCount = this.state.players.size;

    client.send("lobby:welcome", {
      roomId: this.roomId,
      sessionId: client.sessionId,
      isHost: player.isHost,
      mode: this.state.mode,
      map: this.state.map,
      visibility: this.state.isPrivate ? "private" : "public"
    });
    this.broadcast("lobby:player-joined", {
      sessionId: client.sessionId,
      name: player.name,
      playerCount: this.state.players.size
    }, { except: client });
    void this.refreshListing();
  }

  override onLeave(client: Client) {
    this.movementInputs.delete(client.sessionId);
    const leavingPlayer = this.state.players.get(client.sessionId);
    this.state.players.delete(client.sessionId);

    if (this.state.hostSessionId === client.sessionId) {
      this.state.hostSessionId = "";
      this.state.players.forEach((player, sessionId) => {
        if (!this.state.hostSessionId) {
          this.state.hostSessionId = sessionId;
          player.isHost = true;
        }
      });
      this.broadcast("lobby:host-changed", {
        sessionId: this.state.hostSessionId,
        name: this.state.players.get(this.state.hostSessionId)?.name ?? ""
      });
    }

    if (this.state.phase === "countdown" && !allPlayersReady(this.connectedReadyPlayers(), 2)) {
      this.cancelCountdown("PLAYER_LEFT");
    }

    if (this.state.phase === "running" && this.state.players.size <= 1) {
      this.finishMatch(this.state.players.size === 1 ? this.firstPlayerSessionId() : "");
    }

    this.broadcast("lobby:player-left", {
      sessionId: client.sessionId,
      name: leavingPlayer?.name ?? "Player",
      playerCount: this.state.players.size
    });
    this.previousPlayerCount = this.state.players.size;
    void this.refreshListing();
  }

  private connectedReadyPlayers(): Array<{ ready: boolean }> {
    const players: Array<{ ready: boolean }> = [];
    this.state.players.forEach((player) => players.push({ ready: player.ready }));
    return players;
  }

  private firstPlayerSessionId(): string {
    let first = "";
    this.state.players.forEach((_player, sessionId) => {
      if (!first) first = sessionId;
    });
    return first;
  }

  private handleReady(client: Client, payload: unknown) {
    if (this.state.phase !== "lobby") return;
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const ready = Boolean(payload && typeof payload === "object" && (payload as { ready?: unknown }).ready === true);
    player.ready = ready;
    this.broadcast("lobby:ready-changed", {
      sessionId: client.sessionId,
      ready,
      allReady: allPlayersReady(this.connectedReadyPlayers(), 2)
    });
  }

  private handleSettings(client: Client, payload: unknown) {
    if (client.sessionId !== this.state.hostSessionId) {
      client.send("lobby:error", { code: "HOST_ONLY", message: "Only the room host can change match settings." });
      return;
    }
    if (this.state.phase !== "lobby") return;
    if (!payload || typeof payload !== "object") return;

    const options = payload as { mode?: unknown; map?: unknown };
    if (options.mode !== undefined) this.state.mode = normalizeMode(options.mode);
    if (options.map !== undefined) this.state.map = normalizeMap(options.map);

    this.state.matchDurationSeconds = getMatchDurationSeconds(this.state.mode);
    this.state.scoreLimit = getScoreLimit(this.state.mode);
    this.state.players.forEach((player, sessionId) => {
      player.ready = false;
      const index = Array.from(this.state.players.keys()).indexOf(sessionId);
      const spawn = getSafeSpawn(this.state.map, Math.max(0, index));
      player.x = spawn.x;
      player.z = spawn.z;
    });

    this.broadcast("lobby:settings-changed", {
      mode: this.state.mode,
      map: this.state.map
    });
    void this.refreshListing();
  }

  private handleStart(client: Client) {
    if (client.sessionId !== this.state.hostSessionId) {
      client.send("lobby:error", { code: "HOST_ONLY", message: "Only the room host can start the match." });
      return;
    }
    if (this.state.phase !== "lobby") return;

    const players = this.connectedReadyPlayers();
    if (players.length < 2) {
      client.send("lobby:error", { code: "NEED_PLAYERS", message: "At least two players are required." });
      return;
    }
    if (!allPlayersReady(players, 2)) {
      client.send("lobby:error", { code: "NOT_READY", message: "Every player must be ready first." });
      return;
    }

    this.state.phase = "countdown";
    this.state.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    this.state.countdownValue = 3;
    this.lastCountdownValue = 3;
    this.lock();
    this.broadcast("match:countdown", {
      seconds: 3,
      startsAt: this.state.countdownEndsAt
    });
    void this.refreshListing();
  }

  private handleInput(client: Client, payload: InputMessage) {
    if (this.state.phase !== "running") return;
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.alive) return;

    const vector = normalizeMoveVector(payload);
    this.movementInputs.set(client.sessionId, {
      x: vector.x,
      z: vector.z,
      receivedAt: Date.now()
    });
  }

  private cancelCountdown(reason: string) {
    if (this.state.phase !== "countdown") return;
    this.state.phase = "lobby";
    this.state.countdownEndsAt = 0;
    this.state.countdownValue = 0;
    this.lastCountdownValue = 0;
    this.unlock();
    this.broadcast("match:countdown-cancelled", { reason });
    void this.refreshListing();
  }

  private beginMatch() {
    const now = Date.now();
    this.state.phase = "running";
    this.state.matchStartedAt = now;
    this.state.matchEndsAt = now + this.state.matchDurationSeconds * 1000;
    this.state.countdownEndsAt = 0;
    this.state.countdownValue = 0;
    this.state.winnerSessionId = "";
    this.state.winnerName = "";
    this.state.players.forEach((player, sessionId) => {
      const index = Array.from(this.state.players.keys()).indexOf(sessionId);
      const spawn = getSafeSpawn(this.state.map, index);
      player.x = spawn.x;
      player.z = spawn.z;
      player.yaw = 0;
      player.score = 0;
      player.length = 3;
      player.matchCoins = 0;
      player.alive = true;
      player.respawnAt = 0;
      this.movementInputs.set(sessionId, { x: 0, z: 0, receivedAt: now });
    });
    this.state.pickups.clear();
    this.spawnPickups(FOOD_TARGET, "food");
    this.spawnPickups(COIN_TARGET, "coin");
    this.broadcast("match:started", {
      startsAt: now,
      endsAt: this.state.matchEndsAt,
      mode: this.state.mode,
      map: this.state.map
    });
    void this.refreshListing();
  }

  private update(deltaTime: number) {
    const now = Date.now();

    if (this.state.phase === "countdown") {
      const seconds = Math.max(0, Math.ceil((this.state.countdownEndsAt - now) / 1000));
      if (seconds !== this.lastCountdownValue) {
        this.lastCountdownValue = seconds;
        this.state.countdownValue = seconds;
        if (seconds > 0) this.broadcast("match:countdown-tick", { seconds });
      }
      if (now >= this.state.countdownEndsAt) this.beginMatch();
      return;
    }

    if (this.state.phase !== "running") return;

    const dt = Math.min(0.05, Math.max(0, deltaTime / 1000));
    this.movePlayers(dt, now);
    this.resolvePickups();
    if (this.state.mode === "eat-others") this.resolvePlayerContacts(now);

    if (this.state.mode === "race") {
      let winner = "";
      this.state.players.forEach((player, sessionId) => {
        if (player.score >= this.state.scoreLimit && !winner) winner = sessionId;
      });
      if (winner) {
        this.finishMatch(winner);
        return;
      }
    }

    if (now >= this.state.matchEndsAt) this.finishMatch(this.chooseCurrentWinner());
    if (now - this.lastPickupSpawnAt >= 1000) {
      this.ensurePickupCounts();
      this.lastPickupSpawnAt = now;
    }
  }

  private movePlayers(dt: number, now: number) {
    const bounds = getMapBounds(this.state.map);
    this.state.players.forEach((player, sessionId) => {
      if (!player.alive) {
        if (player.respawnAt > 0 && now >= player.respawnAt) this.respawnPlayer(sessionId, player);
        return;
      }

      const input = this.movementInputs.get(sessionId);
      const fresh = input && now - input.receivedAt <= 350;
      const x = fresh ? input.x : 0;
      const z = fresh ? input.z : 0;
      const speed = PLAYER_SPEED * (player.length > 12 ? 0.92 : 1);
      const nextX = player.x + x * speed * dt;
      const nextZ = player.z + z * speed * dt;

      player.x = Math.max(bounds.minX, Math.min(bounds.maxX, nextX));
      player.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, nextZ));
      if (Math.hypot(x, z) > 0.05) player.yaw = Math.atan2(x, -z);
      if (player.x !== nextX && input) input.x = 0;
      if (player.z !== nextZ && input) input.z = 0;
    });
  }

  private resolvePickups() {
    const remove: string[] = [];
    this.state.pickups.forEach((pickup, pickupId) => {
      this.state.players.forEach((player, sessionId) => {
        if (!player.alive || remove.includes(pickupId)) return;
        if (Math.hypot(player.x - pickup.x, player.z - pickup.z) > PICKUP_RADIUS) return;

        if (pickup.kind === "food") {
          player.score += pickup.value;
          player.length = Math.min(30, player.length + 1);
        } else {
          player.matchCoins += pickup.value;
        }
        remove.push(pickupId);
        this.broadcast("match:pickup", {
          sessionId,
          pickupId,
          kind: pickup.kind,
          value: pickup.value,
          score: player.score,
          matchCoins: player.matchCoins
        });
      });
    });
    for (const pickupId of remove) this.state.pickups.delete(pickupId);
  }

  private resolvePlayerContacts(now: number) {
    const players = Array.from(this.state.players.entries());
    for (let i = 0; i < players.length; i++) {
      const [leftId, left] = players[i]!;
      if (!left.alive) continue;
      for (let j = i + 1; j < players.length; j++) {
        const [rightId, right] = players[j]!;
        if (!right.alive) continue;
        if (Math.hypot(left.x - right.x, left.z - right.z) > PLAYER_CONTACT_RADIUS) continue;
        if (left.length === right.length) continue;

        const winnerId = left.length > right.length ? leftId : rightId;
        const loserId = winnerId === leftId ? rightId : leftId;
        const winner = this.state.players.get(winnerId);
        const loser = this.state.players.get(loserId);
        if (!winner || !loser || !loser.alive) continue;

        winner.score += 3;
        winner.length = Math.min(30, winner.length + 2);
        loser.alive = false;
        loser.respawnAt = now + 2000;
        this.broadcast("match:player-eaten", {
          winnerSessionId: winnerId,
          loserSessionId: loserId
        });
      }
    }
  }

  private respawnPlayer(sessionId: string, player: PlayerState) {
    const index = Array.from(this.state.players.keys()).indexOf(sessionId);
    const spawn = getSafeSpawn(this.state.map, Math.max(0, index));
    player.x = spawn.x;
    player.z = spawn.z;
    player.length = 3;
    player.alive = true;
    player.respawnAt = 0;
    this.movementInputs.set(sessionId, { x: 0, z: 0, receivedAt: Date.now() });
    this.broadcast("match:player-respawned", { sessionId });
  }

  private spawnPickups(count: number, kind: "food" | "coin") {
    const bounds = getMapBounds(this.state.map);
    let created = 0;
    let attempts = 0;
    while (created < count && attempts < count * 20) {
      attempts += 1;
      const x = bounds.minX + 4 + Math.random() * Math.max(1, bounds.maxX - bounds.minX - 8);
      const z = bounds.minZ + 4 + Math.random() * Math.max(1, bounds.maxZ - bounds.minZ - 8);
      if (this.isSpawnCrowded(x, z)) continue;

      const pickup = new PickupState();
      pickup.kind = kind;
      pickup.x = x;
      pickup.z = z;
      pickup.value = kind === "coin" ? 2 + Math.floor(Math.random() * 3) : 1;
      this.state.pickups.set(String(this.nextPickupId++), pickup);
      created += 1;
    }
  }

  private isSpawnCrowded(x: number, z: number): boolean {
    let crowded = false;
    this.state.players.forEach((player) => {
      if (Math.hypot(player.x - x, player.z - z) < 4) crowded = true;
    });
    this.state.pickups.forEach((pickup) => {
      if (Math.hypot(pickup.x - x, pickup.z - z) < 3) crowded = true;
    });
    return crowded;
  }

  private ensurePickupCounts() {
    let foods = 0;
    let coins = 0;
    this.state.pickups.forEach((pickup) => {
      if (pickup.kind === "food") foods += 1;
      if (pickup.kind === "coin") coins += 1;
    });
    if (foods < FOOD_TARGET) this.spawnPickups(FOOD_TARGET - foods, "food");
    if (coins < COIN_TARGET) this.spawnPickups(COIN_TARGET - coins, "coin");
  }

  private chooseCurrentWinner(): string {
    const entries: Array<{ id: string; player: PlayerState }> = [];
    this.state.players.forEach((player, id) => entries.push({ id, player }));
    return chooseWinner(entries);
  }

  private finishMatch(winnerSessionId: string) {
    if (this.state.phase !== "running") return;
    const winner = this.state.players.get(winnerSessionId);
    this.state.phase = "results";
    this.state.winnerSessionId = winnerSessionId;
    this.state.winnerName = winner?.name ?? "";
    this.broadcast("match:finished", {
      winnerSessionId,
      winnerName: this.state.winnerName,
      mode: this.state.mode
    });
    void this.refreshListing();
    this.clock.setTimeout(() => void this.disconnect(), 30_000);
  }

  private async refreshListing() {
    await this.setMatchmaking({
      private: this.state.isPrivate,
      unlisted: this.state.isPrivate,
      metadata: {
        mode: this.state.mode,
        map: this.state.map,
        phase: this.state.phase,
        playerCount: this.state.players.size,
        visibility: this.state.isPrivate ? "private" : "public"
      }
    });
  }
}
