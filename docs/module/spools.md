# Modul spools – Funktionssteckbriefe

Stufe 1. Reihenfolge = empfohlene Bau-Reihenfolge. Status siehe jeweilige Tabelle.

## SP-01 Spulenliste

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – Sortierung (Nr. / wenigster Rest, gemerkt) und Ziehen zum Aktualisieren ergänzt |
| Ziel | Alle aktiven Spulen auf einen Blick, durchsuchbar und gruppierbar. |
| Ablauf | Tab „Spulen“ → Liste; Suche oben; Gruppierung Alle / Material / Lagerort / Hersteller (wird gemerkt) |
| Seite | Liste: Suchleiste, Segment, `SpoolCard` (ColorRing, MaterialBadge, Badge, FillBar) |
| Daten | `GET /inventory/spools`, `/inventory/locations`, `/inventory/assignments` |
| Plattform | – |
| Zustände | lädt: Spinner · leer: „Noch nichts da“ · Fehler/offline: Hinweis + „Erneut versuchen“ |
| Rechte | INVENTORY_READ |
| Akzeptanz | Spule #4 zeigt „PLA BASIC“, „AMS 2-2“, 454 g · 45 %; Suche „pla black“ findet #4; archivierte Spulen fehlen |
| Offen | Desktop: Liste + Detail nebeneinander |

## SP-02 QR-Code scannen

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – Kamera am Gerät (iPhone Safari, Chrome) von Hand prüfen |
| Ziel | Etikett scannen und sofort die Spule offen haben. |
| Ablauf | Tab „Scannen“ → Kamera startet → Treffer → Spulendetail |
| Seite | Scan: Kamerabild, Zielrahmen, Treffer als Karte; Fallback Code-Eingabe |
| Daten | Parser `core/qr/codes.ts`; Scan-Verteiler `app/scan.ts` → `manifest.scan` |
| Plattform | `scanner`; Web: Kamera + JS-Bibliothek (Kandidaten: `zxing-wasm`, `qr-scanner`; Safari hat keinen BarcodeDetector) – Adapter in `core/platform/scanner/`; nativ später ML Kit/Vision |
| Zustände | keine Kamera-Berechtigung → Hinweis + Code-Eingabe; unbekannter Code → Hinweis |
| Rechte | INVENTORY_READ |
| Akzeptanz | `bm:s:4`, Bambuddy-Etikett `…/inventory?spool=4` und Einrichtungs-QR werden erkannt; iPhone Safari (HTTPS) und Chrome Desktop |
| Technik | `core/platform/scanner.ts`: getUserMedia (Rückkamera) + `BarcodeDetector`; wo er fehlt (Safari, Chrome/Windows) Ponyfill `barcode-detector` (zxing-wasm, .wasm selbst ausgeliefert – kein CDN, offline). Kamera nur bei sichtbarem Scan-Tab; Licht-Knopf, wenn die Kamera Taschenlampe kann; Haptik bei Treffer |
| Geprüft | zxing-wasm liest gerenderte Etiketten auch verkleinert/unscharf; lädt in ~30 ms |
| Offen | – |

## SP-03 Spule ins AMS legen

| Feld | Inhalt |
| --- | --- |
| Status | entwurf |
| Ziel | Nach dem Scan die Spule mit max. 3 Tipps einem AMS-Slot zuweisen. |
| Ablauf | Detail → „Ins AMS“ → Sheet: Drucker (falls mehrere) → AMS → Slot (belegte Slots zeigen aktuelle Spule) → Bestätigen |
| Seite | Aktions-Sheet |
| Daten | `GET /printers/` (Drucker/AMS-Aufbau), `GET/POST /inventory/assignments` |
| Plattform | – |
| Zustände | Fehler beim Speichern → Sheet bleibt offen, Hinweis |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | nach Bestätigen zeigt die Karte das neue AMS-Badge; vorherige Spule im Slot erhält ihren Lagerort zurück |
| Offen | Bambuddy-Verhalten bei belegtem Slot; AMS-Aufbau des X2D aus `/printers/{id}/status` lesen |

## SP-04 Lagerort setzen (Verschieben)

| Feld | Inhalt |
| --- | --- |
| Status | entwurf |
| Ziel | Spule zurück ins Regal / in eine Drybox buchen. |
| Ablauf | Detail → „Verschieben“ → Sheet mit Lagerorten (zuletzt genutzter oben) → Tipp = gespeichert |
| Seite | Aktions-Sheet |
| Daten | `GET /inventory/locations`, `PATCH /inventory/spools/{id}` `{ location_id }` |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Ort erscheint sofort in Karte und Detail; offline → Fehlerhinweis, nichts geht verloren |
| Offen | Lagerorte anlegen in der App oder nur in Bambuddy? |

## SP-05 Wiegen

| Feld | Inhalt |
| --- | --- |
| Status | entwurf |
| Ziel | Restgewicht per Küchenwaage korrigieren. |
| Ablauf | Detail → „Wiegen“ → Bruttogewicht eingeben (Zifferntastatur) → Vorschau Rest → Speichern |
| Seite | Aktions-Sheet mit Zahlenfeld und Kennzahl |
| Daten | `PATCH /inventory/spools/{id}` – Berechnung `weightUsedFromScale` (`core/api/types.ts`, getestet) |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | 691 g brutto bei 237 g Leerspule → 454 g Rest |
| Offen | PATCH `weight_used` vs. Waagen-Endpunkt (siehe BAMBUDDY-API.md) |

## SP-06 Etikett gestalten und drucken

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt (Stufe 1: feste Vorlagen) – Druck am Gerät noch von Hand zu prüfen |
| Ziel | Etikett für eine Spule direkt auf dem Niimbot B1 Pro drucken; Stapeldruck vorbereitet. |
| Ablauf | Detail → „Etikett“ → Sheet: Vorschau, Vorlage, Anzahl → „Drucker per Bluetooth/USB“ (einmal koppeln) → „Drucken“; Ersatz „Als PNG speichern“ |
| Seite | `modules/spools/components/LabelSheet.tsx` (Detail-Sheet, Aktionen in der Daumenzone) |
| Vorlagen | Format = NiimBlue-Export (`ExportedLabelTemplate`: Fabric-JSON + Etikett in Druckpixeln), Platzhalter `{id} {code} {material} {color} {brand} {weight} {dt}`. Eingebaut (`core/printing/templates.ts`, 567×354 px = 48×30 mm @300 dpi): „Standard“, „Nummer rot“, „AMS-Slot“ (für SP-08). Gewählte Vorlage wird gemerkt. |
| Technik | `core/printing`: `template.ts` (Platzhalter, Import-Prüfung), `postprocess.ts` (Schwelle Weiß/Schwarz/Rot), `engine/` (nachgeladen, ~130 KB gz): Fabric 7 + QR-/Textbox-Objekte aus NiimBlue, `renderLabel` → Canvas, `printer.ts` → niimbluelib (`D110M_V4` beim B1 Pro, Rot = `DoubleColor`). `useLabelPrinter()` hält Verbindung und Status. |
| Plattform | `printer.bluetooth` / `printer.usb` (Chrome/Edge); sonst Hinweis + PNG |
| Rechte | INVENTORY_READ |
| Geprüft | QR aller Vorlagen per Decoder gelesen (`bm:s:1234`, `bm:t:1:0:2`); Druckbild nur exakte Farben; niimbluelib kodiert ein- und zweifarbig; Sheet hell/dunkel/Desktop; Produktions-Build lädt den Druckteil |
| Offen | Druck am B1 Pro per Bluetooth und USB von Hand prüfen; Dichte/Etikettentyp einstellbar? Eigene Vorlagen von niim.blue importieren (Stufe 2/3, `parseTemplate` vorhanden); Mehrfachauswahl in der Liste (Ablauf E); iPhone-Druck über Druckdienst (Phase 2) |

## SP-07 Spule anlegen / duplizieren

| Feld | Inhalt |
| --- | --- |
| Status | entwurf |
| Ziel | Neue Spule mit wenigen Eingaben anlegen und gleich etikettieren. |
| Ablauf | Plus → „Spule hinzufügen“ → aus Katalog/Farbkatalog wählen oder bestehende duplizieren → Anzahl → Speichern → Etikett (SP-06) |
| Seite | Formular |
| Daten | `GET /inventory/catalog`, `/inventory/colors/*`, `POST /inventory/spools` bzw. `/spools/bulk` |
| Rechte | INVENTORY_CREATE / UPDATE |
| Akzeptanz | 3 gleiche Spulen in einem Schritt angelegt, danach Mehrfachdruck möglich |
| Offen | Welche Pflichtfelder verlangt Bambuddy minimal (material)? |

## SP-08 Spulenwechsel per Doppelscan (Slot → Spule → fertig)

| Feld | Inhalt |
| --- | --- |
| Status | bereit (QR-Format `bm:t:` erkannt, Ablauf offen) |
| Ziel | Spulenwechsel am AMS in zwei Scans erledigen, ohne Menüs. |
| Ablauf | 1. Slot-Etikett am AMS scannen → Sheet „AMS 1 · Slot 3“ zeigt die Spule, die dort gerade zugewiesen ist. 2. Kamera bleibt offen: neue Spule scannen. 3. Zuweisung wird gespeichert, kurze Bestätigung (Haptik + Hinweis) – **fertig**. Die alte Spule bekommt ihren letzten Lagerort zurück (rückgängig machen per Hinweis-Knopf). Reihenfolge Spule → Slot funktioniert genauso. |
| Seite | Scan-Vorlage mit Treffer-Karte oben (Slot), darunter Kamerabild für den zweiten Scan; Aktions-Sheet nur bei Rückfragen |
| Daten | `GET /inventory/assignments`, `POST /inventory/assignments` `{ spool_id, printer_id, ams_id, tray_id }`; alte Spule: `PATCH /inventory/spools/{id}` `{ location_id }`. Bambuddy stellt den AMS-Slot danach selbst per MQTT ein (Profil, Farbe, Material; bei leerem Slot sobald die Spule eingelegt ist). |
| QR-Format | Slot: `bm:t:<druckerId>:<amsId>:<slot>` (Bambuddy-IDs, 0-basiert; amsId 255 = externe Spule). Spule: `bm:s:<id>`. Parser + Tests in `src/core/qr/codes.ts`. |
| Plattform | `scanner` (SP-02); Haptik optional (`haptics`) |
| Zustände | Slot unbekannt (Drucker gelöscht) → Hinweis „Slot-Etikett neu drucken“; Spule archiviert → Rückfrage; offline → nichts speichern, Hinweis |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Vom Öffnen des Scanners bis zur gespeicherten Zuweisung höchstens 2 Scans und 0–1 Tipp; Karte der neuen Spule zeigt danach das AMS-Badge; alte Spule zeigt wieder ihren Lagerort |
| Offen | Verhalten von Bambuddy bei belegtem Slot (ersetzt POST die alte Zuweisung?); Lagerort der alten Spule: letzter Ort oder Rückfrage? |

### Slot-Etiketten drucken (Teil von SP-08)
Unter **Mehr → Drucker & AMS**: alle Slots aller Drucker auflisten (aus `GET /printers/` + Status) und je Slot ein kleines Etikett drucken
(QR `bm:t:…` + Text „X2D · AMS 1 · 3“). Druck über SP-06 (Niimbot-Profil), Ersatz: PNG/PDF zum Ausdrucken. Wird ein Drucker in Bambuddy neu
angelegt (neue ID), müssen nur diese wenigen Slot-Etiketten neu gedruckt werden.
