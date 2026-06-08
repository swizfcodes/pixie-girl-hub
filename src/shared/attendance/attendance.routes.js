/**
 * Attendance routes (V2.2 §6.11.1). Mounted at /api/v1/attendance, gated on
 * `attendance`. Geofences are admin CRUD; /clock records a geolocated event
 * (append-only); /events is the read-only history.
 */
"use strict";
const express = require("express");
const c = require("./attendance.controller");
const v = require("./attendance.validator");
const { requirePermission } = require("../../middleware/rbac");
const router = express.Router();
const P = (a) => requirePermission("attendance", a);

// ── Geofences (admin CRUD) ─────────────────────────────────
router.get("/geofences", P("view"), c.listGeofences);
router.post("/geofences", P("create"), v.geofenceCreate, c.createGeofence);
router.get("/geofences/:id", P("view"), c.getGeofence);
router.patch("/geofences/:id", P("edit"), v.geofenceUpdate, c.updateGeofence);
router.delete("/geofences/:id", P("delete"), c.deleteGeofence);

// ── Clock in/out (geolocated, append-only) ─────────────────
router.post("/clock", P("create"), v.clock, c.clock);
router.get("/events", P("view"), c.listEvents);

module.exports = router;
