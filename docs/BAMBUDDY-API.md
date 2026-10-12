# Bambuddy-API – was die App nutzt

Geprüft im Bambuddy-Code (github.com/maziggy/bambuddy, Stand 09.10.2026). Alle Pfade unter `/api/v1`.
Auth: Header `X-API-Key: bb_…` (alternativ `Authorization: Bearer bb_…`). Mit eingeschalteter
Bambuddy-Anmeldung gelten die Rechte des Schlüssels bzw. Nutzers.

## Phase 1 (Spulen) – geprüft im Code und gegen die Live-Instanz (v1.2.5.7, 11.10.2026)
| Zweck | Methode + Pfad | Hinweis |
| --- | --- | --- |
| Spulen | `GET /inventory/spools` | archivierte nur mit `?include_archived=true` |
| Spule | `GET /inventory/spools/{id}` | |
| Spule ändern | `PATCH /inventory/spools/{id}` | `SpoolUpdate`; `location_id` gewinnt vor `storage_location`; `weight_used` setzt `weight_locked` |
| Spulen anlegen | `POST /inventory/spools/bulk` | `{ spool: SpoolCreate, quantity 1–100 }`, Pflicht nur `material` |
| Wiegen | `POST /spoolbuddy/scale/update-spool-weight` | `{ spool_id, weight_grams }` brutto → `weight_used`, `last_scale_weight`, `last_weighed_at` |
| Dublette per NFC | `GET /inventory/spools/by-tag?tag_uid=…&tray_uuid=…` | |
| Lagerorte | `GET/POST /inventory/locations` | Create `{ name, identifier? }`, 409 bei gleichem Namen |
| Lagerort ändern/löschen | `PATCH/DELETE /inventory/locations/{id}` | Umbenennen überträgt den Namen auf die Spulen; Löschen nur ohne Spulen |
| AMS-Zuweisungen | `GET/POST /inventory/assignments`, `DELETE /inventory/assignments/{printer}/{ams}/{tray}` | POST ersetzt belegten Slot; dieselbe Spule darf in mehreren Slots stehen (App räumt vorher auf); Lagerort bleibt unverändert |
| Drucker | `GET /printers/`, `GET /printers/{id}/status` | `ams[].tray[]` (id, tray_color RRGGBBAA, tray_type, state 9/10/11), `vt_tray` id 254/255 → Zuweisung `ams_id 255, tray_id 0/1` |
| Katalog | `GET /inventory/catalog`, `GET /inventory/colors/search?manufacturer=&material=` | Leerspulen `{id,name,weight}`, Farben `{manufacturer,color_name,hex_color,material}` |
| Rechte | `GET /auth/me` | `permissions[]`, z. B. `inventory:read`, `inventory:update`, `inventory:view_assignments`, `printers:read` |
| Version | `GET /updates/version` | öffentlich, `{ version }` (Regel 14) |
| Etiketten (Bambuddy) | Labels-Router | QR auf Bambuddy-Etiketten: `<base>/inventory?spool=<id>` |

Gewichte: Restgewicht = `label_weight − weight_used`; Waage: `weight_used = label_weight − (brutto − core_weight)`
(`src/core/api/types.ts`). Schreibrechte: alle Inventar-Änderungen prüfen in Bambuddy `inventory:update`.

## Spoolman-Modus (Bambuddy `GET /spoolman/status` → `enabled: true`), geprüft im Quellcode (11.10.2026)

| Zweck | Methode + Pfad | Hinweis |
| --- | --- | --- |
| Spulen | `GET/POST /spoolman/inventory/spools`, `GET/PATCH/DELETE …/spools/{id}` | gleiches Format wie lokal; `category`, `low_stock_threshold_pct`, `core_weight_catalog_id`, `last_weighed_at` fehlen; `material_number` = `filament.article_number` (nur lesen); `location_id` über Bambuddys Lagerorte (nach Name mit Spoolman abgeglichen) |
| Anlegen | `POST /spoolman/inventory/spools/bulk` | `{ spool, quantity 1–50 }`, legt Hersteller/Filament bei Bedarf an |
| Stapel | `POST …/spools/bulk-update`, `…/bulk-archive` | Antwort `{ updated|archived, errors: [{ id, status, detail }] }` |
| Wiegen | `PATCH …/spools/{id}/weight` | `{ weight_grams }` brutto |
| AMS | `GET …/slot-assignments/all`, `POST …/slot-assignments` `{ spoolman_spool_id, printer_id, ams_id, tray_id }`, `DELETE …/slot-assignments/{spoolman_spool_id}` | POST überschreibt den Slot; DELETE entfernt alle Slots der Spule |
| RFID | `POST /spoolman/spools/from-slot` | `{ success, spool_id }`; Recht `filaments:update` |

Spoolman selbst (0.27, ohne Anmeldung; nur vom Server angesprochen): Zusatzfelder `POST /api/v1/field/spool/{key}`
`{ name, field_type }`, Werte als JSON-Text (`'"2026-10-11"'`), `PATCH /api/v1/spool/{id} { extra }` führt Schlüssel
zusammen, `null` löscht.

## Später
| Zweck | Pfad |
| --- | --- |
| Drucker, Status | `GET /printers/`, `GET /printers/{id}/status` |
| Kurzstatus für Widgets/Live Activity | `GET /webhook/printer/{id}/status` (layer_num, total_layers, subtask_id, remaining_seconds, hms_errors[].description) |
| Live-Updates | WebSocket `/ws` |
| Kamera | `GET /printers/{id}/camera/snapshot`, `/camera/stream` (+ `POST /printers/camera/stream-token`) |
| Steuerung | `POST /printers/{id}/print/pause` · `/resume` · `/stop` |
| Warteschlange | `/queue/*` |
| Archiv | `/archives/*` |
| Wartung | `/maintenance/*` |
| Benachrichtigungen | `/notifications/*` (ntfy, Pushover, Telegram, Discord, Webhook, Bark; Notify! im dev-Zweig) |
| Login für Apps | `/connect/authorize`, `/connect/token` (OAuth 2.0 + PKCE, nur mit aktivierter Anmeldung) |
| API-Beschreibung | `/openapi.json` → `npm run api:types` |

## QR- und Scan-Formate (`src/core/qr/codes.ts`)
| Inhalt | Bedeutung |
| --- | --- |
| `bm:s:<id>` | eigenes Spulen-Etikett, Version 1, ohne Serveradresse |
| `bm:t:<druckerId>:<amsId>:<slot>` | Slot-Etikett am AMS (Bambuddy-IDs, 0-basiert; amsId 255 = externe Spule, slot 0/1) |
| `bm:l:<id>` | Lagerort-Etikett (Bambuddy-Lagerort-ID) → „Einräumen“ (SP-17) |
| `<base>/inventory?spool=<id>` | Etikett aus Bambuddy |
| `bambuddy://config?v=1&url=…&key=…` | Einrichtungs-QR aus Bambuddy (API-Schlüssel) |

## Geklärt (11.10.2026)
- Wiegen: eigener Waagen-Endpunkt (SpoolBuddy) statt `PATCH weight_used`.
- Version: `GET /updates/version` ohne Schlüssel.
- Belegter Slot: POST ersetzt die alte Zuweisung.
- Rechte-Namen: siehe Tabelle; Module nutzen `useAllowed('inventory:update')`.
