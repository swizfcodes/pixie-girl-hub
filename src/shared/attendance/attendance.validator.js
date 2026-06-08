/** Attendance validators (V2.2 §6.11.1) — Zod. */
"use strict";
const { z } = require("zod");
const uuid = z.string().uuid();
const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

const geofenceCreateSchema = z.object({
  name: z.string().min(1).max(120),
  latitude: lat,
  longitude: lng,
  radius_m: z.number().int().min(10).max(5000),
  unit_id: uuid.nullable().optional(),
  address: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
});
const geofenceUpdateSchema = geofenceCreateSchema
  .partial()
  .refine((o) => Object.keys(o).length > 0, "No fields to update");

const clockSchema = z
  .object({
    profile_id: uuid,
    event_type: z.enum(["clock_in", "clock_out"]),
    latitude: lat.optional(),
    longitude: lng.optional(),
    accuracy_m: z.number().min(0).optional(),
    device_fingerprint: z.string().max(200).optional(),
    occurred_at: z.string().datetime().optional(),
  })
  .refine(
    (o) => (o.latitude === null) === (o.longitude === null),
    "latitude and longitude must be provided together",
  );

const make = (s) => (req, _res, next) => {
  req.body = s.parse(req.body || {});
  next();
};
module.exports = {
  geofenceCreate: make(geofenceCreateSchema),
  geofenceUpdate: make(geofenceUpdateSchema),
  clock: make(clockSchema),
  schemas: { geofenceCreateSchema, clockSchema },
};
