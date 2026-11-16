import test from "node:test";
import assert from "node:assert/strict";
import {
  allPlayersReady,
  chooseWinner,
  getMapBounds,
  getSafeSpawn,
  normalizeMap,
  normalizeMode,
  normalizeMoveVector,
  normalizeSkinId,
  sanitizePlayerName
} from "../src/rules.js";

test("mode and map inputs fall back safely", () => {
  assert.equal(normalizeMode("race"), "race");
  assert.equal(normalizeMode("admin-mode"), "collect-points");
  assert.equal(normalizeMap("station"), "station");
  assert.equal(normalizeMap("../outside"), "garden");
});

test("skin IDs and player names are allow-listed and sanitized", () => {
  assert.equal(normalizeSkinId("penguin"), "penguin");
  assert.equal(normalizeSkinId("external-model-url"), "snake");
  const safeName = sanitizePlayerName("<script>alert(1)</script>");
  assert.equal(safeName, "alert(1)");
  assert.ok(!safeName.includes("<") && !safeName.includes(">"));
  assert.equal(sanitizePlayerName("   "), "Player");
  assert.equal(sanitizePlayerName("A".repeat(40)).length, 16);
});

test("ready barrier requires two players and every player ready", () => {
  assert.equal(allPlayersReady([{ ready: true }], 2), false);
  assert.equal(allPlayersReady([{ ready: true }, { ready: false }], 2), false);
  assert.equal(allPlayersReady([{ ready: true }, { ready: true }], 2), true);
});

test("movement vector rejects invalid values and normalizes diagonal input", () => {
  assert.deepEqual(normalizeMoveVector({ x: Number.NaN, z: 1 }), { x: 0, z: 1 });
  const diagonal = normalizeMoveVector({ x: 1, z: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z) - 1) < 0.000001);
  assert.deepEqual(normalizeMoveVector(null), { x: 0, z: 0 });
});

test("map spawn points remain inside the declared bounds", () => {
  const maps = ["garden", "street", "station", "home", "night", "kitchen"] as const;
  for (const map of maps) {
    const bounds = getMapBounds(map);
    for (let index = 0; index < 4; index++) {
      const spawn = getSafeSpawn(map, index);
      assert.ok(spawn.x >= bounds.minX && spawn.x <= bounds.maxX, map + " spawn X out of bounds");
      assert.ok(spawn.z >= bounds.minZ && spawn.z <= bounds.maxZ, map + " spawn Z out of bounds");
    }
  }

  const station = getSafeSpawn("station", 0);
  assert.ok(Math.abs(station.x) > 2.6, "station spawn must be clear of the rail centerline");
  const kitchen = getSafeSpawn("kitchen", 0);
  assert.ok(!(kitchen.x >= -10.75 && kitchen.x <= 6.75 && kitchen.z >= -5.75 && kitchen.z <= 1.75),
    "kitchen spawn must avoid the central island");
});

test("winner selection is deterministic and prioritizes score then match coins", () => {
  assert.equal(chooseWinner([
    { id: "a", player: { score: 5, matchCoins: 8 } },
    { id: "b", player: { score: 6, matchCoins: 0 } },
    { id: "c", player: { score: 5, matchCoins: 8 } }
  ]), "b");

  assert.equal(chooseWinner([
    { id: "z", player: { score: 5, matchCoins: 8 } },
    { id: "a", player: { score: 5, matchCoins: 8 } }
  ]), "a");
});
