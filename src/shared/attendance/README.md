# Attendance (V2.2 §6.11.1 — geolocated clock-in)

Module key: `attendance`. Mounted at `/api/v1/attendance`.

| Area      | Routes                 | Table                       |
| --------- | ---------------------- | --------------------------- |
| Geofences | `/geofences` (+`/:id`) | `shared.geofences` (CRUD)   |
| Clock     | `POST /clock`          | `shared.staff_clock_events` |
| History   | `GET /events`          | `shared.staff_clock_events` |

- **Geofences** are admin CRUD (map-based UI): a centre `latitude/longitude` +
  `radius_m` (10–5000), optionally tied to an `org_unit`. Business-scoped,
  `is_active` soft-delete.
- **Clock-in/out** is geolocated and **append-only**. `POST /clock` evaluates
  the device position against the brand's active geofences (`geo.calc`,
  haversine): within radius → `accepted`; otherwise the attempt is _still
  recorded_ with a reason from the schema's fixed set (`outside_geofence`,
  `accuracy_too_low`, `permission_denied`). Offline-queued events may pass
  their original `occurred_at`. Events are never edited or deleted.
- **Spatial math** lives in `geo.calc.js` (pure, unit-tested): haversine
  distance, nearest-geofence selection, and the accept/reject decision.
