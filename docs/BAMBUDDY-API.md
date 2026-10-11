# Bambuddy-API – was die App nutzt

Geprüft im Bambuddy-Code (github.com/maziggy/bambuddy, Stand 09.10.2026). Alle Pfade unter `/api/v1`.
Auth: Header `X-API-Key: bb_…` (alternativ `Authorization: Bearer bb_…`). Mit eingeschalteter
Bambuddy-Anmeldung gelten die Rechte des Schlüssels bzw. Nutzers.

## Phase 1 (Spulen)
| Zweck | Methode + Pfad | Hinweis |
| --- | --- | --- |
| Spulen | `GET /inventory/spools` | `SpoolResponse` (schemas/spool.py) |
| Spule | `GET /inventory/spools/{id}` | |
| Spule ändern | `PATCH /inventory/spools/{id}` | `SpoolUpdate`: u. a. `weight_used`, `location_id`, `storage_location`, `core_weight` |
| Spule anlegen | `POST /inventory/spools`, `POST /inventory/spools/bulk` | Bulk: `{ spool, quantity 1–100 }` |
| Dublette per NFC | `GET /inventory/spools/by-tag?tag_uid=…&tray_uuid=…` | Recht INVENTORY_READ oder _UPDATE |
| Lagerorte | `GET/POST /inventory/locations`, `PATCH /inventory/locations/{id}` | `{ id, name, identifier, spool_count }` |
| AMS-Zuweisungen | `GET/POST /inventory/assignments` | Create: `{ spool_id, printer_id, ams_id, tray_id }` (0-basiert) |
| Spule aus Slot | `POST /inventory/spools/from-slot` | |
| Verbrauch | `GET /inventory/spools/{id}/usage`, `GET /inventory/usage` | Phase 3 Prognose |
| Katalog | `GET /inventory/catalog`, `GET /inventory/colors/*` | Phase 1 Anlegen |
| Etiketten (Bambuddy) | Labels-Router | QR auf Bambuddy-Etiketten: `<base>/inventory?spool=<id>` |

Gewichte: Restgewicht = `label_weight − weight_used`; Waage: `weight_used = label_weight − (brutto − core_weight)`
(`src/core/api/types.ts`).

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
| `<base>/inventory?spool=<id>` | Etikett aus Bambuddy |
| `bambuddy://config?v=1&url=…&key=…` | Einrichtungs-QR aus Bambuddy (API-Schlüssel) |

## Offene API-Fragen
- [ ] Restgewicht nach Wiegen: `PATCH weight_used` direkt oder gibt es einen Waagen-Endpunkt
      (`last_scale_weight`, SpoolBuddy)? Ziel: Verbrauchshistorie nicht verfälschen.
- [ ] Endpunkt für die Bambuddy-Version (Regel 14) – `/system/info` braucht SYSTEM_READ.
- [ ] Assignments: Verhalten bei belegtem Slot (alte Zuweisung automatisch ersetzt?).
- [ ] Rechte-Namen für `requires.api` aus `backend/app/core/permissions` übernehmen.
