/**
 * Socket.io connection lifecycle + room subscription.
 *
 * Client emits:
 *   'join'   { room: string }
 *   'leave'  { room: string }
 *
 * Server emits events INTO rooms via the service layer (events.js files
 * in each module). Direct emit from a controller is discouraged — emit
 * via the module's events.js so other subscribers (AI insights, audit)
 * can also react.
 */

"use strict";

const { logger } = require("../config/logger");
//const { ROOMS } = require("./rooms");

// Whitelist: room patterns that any authenticated user can subscribe to.
// More sensitive rooms (system:ai_usage_meter, payroll-related) are gated below.
function canJoinRoom(socket, room) {
  if (!room || typeof room !== "string") return false;
  const user = socket.user;
  if (!user) return false;

  // CEO can join anything
  if (user.is_ceo) return true;

  // user:<own-id>:* always allowed for self
  if (room.startsWith(`user:${user.user_id}:`)) return true;

  // brand:<brand>:* allowed if user has access to that brand
  const brandMatch = room.match(/^brand:([a-z_]+):/);
  if (brandMatch && user.available_businesses.includes(brandMatch[1]))
    return true;

  // system:* requires CEO (already returned above)
  return false;
}

function bindHandlers(io) {
  io.on("connection", (socket) => {
    logger.debug(
      { socketId: socket.id, userId: socket.user?.user_id },
      "socket connected",
    );

    socket.on("join", ({ room }) => {
      if (!canJoinRoom(socket, room)) {
        socket.emit("error", { code: "ROOM_FORBIDDEN", room });
        return;
      }
      socket.join(room);
      socket.emit("joined", { room });
    });

    socket.on("leave", ({ room }) => {
      socket.leave(room);
      socket.emit("left", { room });
    });

    socket.on("disconnect", (reason) => {
      logger.debug({ socketId: socket.id, reason }, "socket disconnected");
    });
  });
}

module.exports = { bindHandlers };
