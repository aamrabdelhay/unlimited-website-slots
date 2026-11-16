import { defineRoom, defineServer } from "colyseus";
import { WildTrailsRoom } from "./rooms/WildTrailsRoom.js";

const port = Number(process.env.PORT || 2567);

export const server = defineServer({
  rooms: {
    wild_trails: defineRoom(WildTrailsRoom).filterBy(["mode", "map"])
  },
  express: (app) => {
    app.get("/health", (_request: any, response: any) => {
      response.status(200).json({
        ok: true,
        service: "wild-trails-multiplayer",
        version: "0.1.0"
      });
    });
  }
});

server.listen(port);
console.log("Wild Trails multiplayer listening on port", port);
