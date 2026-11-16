# Wild Trails Multiplayer Server

Separate Colyseus 0.18 service for Wild Trails. This service is intentionally independent from the Vercel-hosted browser page; the game page connects to it over WebSocket after a server URL is configured.

## Requirements

- Node.js 22 or newer
- npm

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`

The room server listens on port \`2567\` by default. Override it with \`PORT\`. The health endpoint is \`http://localhost:2567/health\`.

## First multiplayer milestone

- Room type: \`wild_trails\`
- Room capacity: 4 players
- Modes: \`race\`, \`eat-others\`, \`collect-points\`
- Maps: \`garden\`, \`street\`, \`station\`, \`home\`, \`night\`, \`kitchen\`
- Public rooms are match-made by mode and map.
- Private rooms are unlisted and joined by the room ID shared by the host.
- Players join the lobby, select a character, and mark themselves ready.
- Only the host can change room settings and start the match.
- The host can start only after at least two players have joined and every connected player is ready.
- The server sends a single shared 3-second countdown and then starts the match.
- Server state owns player positions, scores, match coins, food/coin pickups, match timing and winner selection.
- Inputs are normalized and rate-limited; clients cannot directly award themselves food, coins or score.

## Protocol

Room creation options:

\`\`\`ts
{
  mode: "race" | "eat-others" | "collect-points",
  map: "garden" | "street" | "station" | "home" | "night" | "kitchen",
  visibility: "public" | "private"
}
\`\`\`

Join options:

\`\`\`ts
{ name: string, skinId: string }
\`\`\`

Client messages:

| Message | Payload | Permission / effect |
| --- | --- | --- |
| \`player:ready\` | \`{ ready: boolean }\` | Toggle the player's ready status in the lobby |
| \`lobby:settings\` | \`{ mode?, map? }\` | Host only; changes settings and clears all ready flags |
| \`match:start\` | none | Host only; requires 2+ players and all players ready |
| \`player:input\` | \`{ x: number, z: number }\` | Running match only; sends a normalized direction vector |

Server messages include \`lobby:welcome\`, \`lobby:player-joined\`, \`lobby:player-left\`, \`lobby:ready-changed\`, \`lobby:settings-changed\`, \`lobby:error\`, \`match:countdown\`, \`match:countdown-tick\`, \`match:countdown-cancelled\`, \`match:started\`, \`match:pickup\`, \`match:player-eaten\`, \`match:player-respawned\` and \`match:finished\`. The synchronized schema is the source of truth for lobby and match state.

## Current boundaries

This is the server-side foundation, not yet the full client integration:
- The existing Three.js page has not yet been wired to this room protocol.
- The server uses an authoritative rectangular play-area boundary. Exact collision proxies for the existing six detailed maps still need to be ported before competitive release.
- Race currently ends at a server-owned food score target; a physical finish-line route is a later gameplay pass.
- Eat Others currently uses server-checked head contact and length comparison; full snake-body segment collision is still pending.
- Match coins are round-scoped. Persistent account currency, purchases, authentication and anti-abuse storage need a trusted profile/database service.
- No public server URL is configured, and nothing is deployed from this repository.

## Quality checks

\`\`\`bash
npm run typecheck
npm test
\`\`\`
