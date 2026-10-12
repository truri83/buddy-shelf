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
| Status | umgesetzt – mit echtem Drucker in Bambuddy noch zu prüfen (Instanz hat noch keinen Drucker) |
| Ziel | Nach dem Scan die Spule mit max. 3 Tipps einem AMS-Slot zuweisen. |
| Ablauf | Detail → „Ins AMS“ → Sheet: Drucker (falls mehrere) → AMS → Slot (belegte Slots zeigen aktuelle Spule) → Bestätigen |
| Seite | `components/AmsSheet.tsx`: Slots aller Drucker (AMS + Extern L/R) mit Belegung; freier Slot = 1 Tipp, belegter = 1 Rückfrage; „Aus dem AMS nehmen“ |
| Daten | `GET /printers/`, `GET /printers/{id}/status` (`ams[].tray[]`, `vt_tray` 254/255 → ams 255, tray 0/1), `GET/POST /inventory/assignments`, `DELETE /inventory/assignments/{p}/{a}/{t}` |
| Plattform | – |
| Zustände | Fehler beim Speichern → Sheet bleibt offen, Hinweis |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | nach Bestätigen zeigt die Karte das neue AMS-Badge; vorherige Spule im Slot erhält ihren Lagerort zurück |
| Offen | Belegter Slot: Bambuddy ersetzt die alte Zuweisung selbst (geprüft im Code). Dieselbe Spule in zwei Slots erlaubt Bambuddy – die App entfernt deshalb vorher ihre alten Zuweisungen. Lagerort bleibt beim Einlegen erhalten (Bambuddy ändert ihn nicht), damit hat die Spule beim Herausnehmen „ihren“ Ort zurück. |

## SP-04 Lagerort setzen (Verschieben)

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Spule zurück ins Regal / in eine Drybox buchen. |
| Ablauf | Detail → „Verschieben“ → Sheet mit Lagerorten (zuletzt genutzter oben) → Tipp = gespeichert |
| Seite | `components/MoveSheet.tsx`: Lagerorte (zuletzt genutzter oben, ✓ = aktuell), „Ohne Lagerort“, neuen Lagerort direkt anlegen |
| Daten | `GET/POST /inventory/locations` (409 bei gleichem Namen), `PATCH /inventory/spools/{id}` `{ location_id }` (null = ohne) |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Ort erscheint sofort in Karte und Detail; offline → Fehlerhinweis, nichts geht verloren |
| Offen | Entschieden: Lagerorte lassen sich auch in der App anlegen (Instanz hatte noch keine). |

## SP-05 Wiegen

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Restgewicht per Küchenwaage korrigieren. |
| Ablauf | Detail → „Wiegen“ → Bruttogewicht eingeben (Zifferntastatur) → Vorschau Rest → Speichern |
| Seite | Aktions-Sheet mit Zahlenfeld und Kennzahl |
| Daten | `POST /spoolbuddy/scale/update-spool-weight` `{ spool_id, weight_grams }` (Bambuddys Waagen-Weg: rechnet `weight_used`, setzt `last_scale_weight`/`last_weighed_at`); Vorschau mit `weightUsedFromScale` |
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
| Offen | Druck am B1 Pro per Bluetooth und USB von Hand prüfen; Dichte/Etikettentyp einstellbar? Eigene Vorlagen von niim.blue importieren (Stufe 2/3, `parseTemplate` vorhanden); Mehrfachauswahl in der Liste (Ablauf E); iPhone-Druck über Druckdienst (Phase 2). Druck-Sheet ist allgemein (`core/printing/LabelPrintSheet`), Stapeldruck wird von SP-07 und den Slot-Etiketten genutzt. |

## SP-07 Spule anlegen / duplizieren

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Neue Spule mit wenigen Eingaben anlegen und gleich etikettieren. |
| Ablauf | Plus → „Spule hinzufügen“ → aus Katalog/Farbkatalog wählen oder bestehende duplizieren → Anzahl → Speichern → Etikett (SP-06) |
| Seite | `pages/SpoolNewPage.tsx` (`/spools/new`, Duplizieren `?from=<id>` aus dem Detail): Material-Chips, Sorte, Hersteller, Farbe aus Farbkatalog oder Farbwähler, Nettogewicht, Leerspule aus Katalog, Lagerort, Anzahl 1–20 → danach Etiketten-Sheet für alle neuen Spulen |
| Daten | `POST /inventory/spools/bulk` `{ spool, quantity }`, `GET /inventory/catalog` (Leerspulen), `GET /inventory/colors/search?manufacturer=&material=` |
| Rechte | INVENTORY_CREATE / UPDATE |
| Akzeptanz | 3 gleiche Spulen in einem Schritt angelegt, danach Mehrfachdruck möglich |
| Offen | Pflichtfeld ist nur `material` (geprüft). Anlegen braucht in Bambuddy `inventory:update`. |

## SP-08 Spulenwechsel per Doppelscan (Slot → Spule → fertig)

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – mit echtem Drucker noch zu prüfen |
| Ziel | Spulenwechsel am AMS in zwei Scans erledigen, ohne Menüs. |
| Ablauf | 1. Slot-Etikett am AMS scannen → Sheet „AMS 1 · Slot 3“ zeigt die Spule, die dort gerade zugewiesen ist. 2. Kamera bleibt offen: neue Spule scannen. 3. Zuweisung wird gespeichert, kurze Bestätigung (Haptik + Hinweis) – **fertig**. Die alte Spule bekommt ihren letzten Lagerort zurück (rückgängig machen per Hinweis-Knopf). Reihenfolge Spule → Slot funktioniert genauso. |
| Seite | `pages/SlotPage.tsx` (`/more/slots/:p/:a/:t`, vom Scan-Verteiler über `manifest.scan`): Treffer-Karte „Im Slot“, Kamera bleibt offen, Spule scannen → gespeichert + Hinweis mit „Rückgängig“; Ersatz Code/Nummer eingeben. `pages/SlotsPage.tsx` (`/more/slots`, unter Mehr): alle Slots + „Alle Slot-Etiketten drucken“ |
| Daten | `GET /inventory/assignments`, `POST /inventory/assignments` `{ spool_id, printer_id, ams_id, tray_id }`; alte Spule: `PATCH /inventory/spools/{id}` `{ location_id }`. Bambuddy stellt den AMS-Slot danach selbst per MQTT ein (Profil, Farbe, Material; bei leerem Slot sobald die Spule eingelegt ist). |
| QR-Format | Slot: `bm:t:<druckerId>:<amsId>:<slot>` (Bambuddy-IDs, 0-basiert; amsId 255 = externe Spule). Spule: `bm:s:<id>`. Parser + Tests in `src/core/qr/codes.ts`. |
| Plattform | `scanner` (SP-02); Haptik optional (`haptics`) |
| Zustände | Slot unbekannt (Drucker gelöscht) → Hinweis „Slot-Etikett neu drucken“; Spule archiviert → Rückfrage; offline → nichts speichern, Hinweis |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Vom Öffnen des Scanners bis zur gespeicherten Zuweisung höchstens 2 Scans und 0–1 Tipp; Karte der neuen Spule zeigt danach das AMS-Badge; alte Spule zeigt wieder ihren Lagerort |
| Offen | Reihenfolge Spule → Slot: über „Ins AMS“ im Spulen-Detail (SP-03). |

### Slot-Etiketten drucken (Teil von SP-08)
Unter **Mehr → Drucker & AMS**: alle Slots aller Drucker auflisten (aus `GET /printers/` + Status) und je Slot ein kleines Etikett drucken
(QR `bm:t:…` + Text „X2D · AMS 1 · 3“). Druck über SP-06 (Niimbot-Profil), Ersatz: PNG/PDF zum Ausdrucken. Wird ein Drucker in Bambuddy neu
angelegt (neue ID), müssen nur diese wenigen Slot-Etiketten neu gedruckt werden.

## SP-07b Filament-Katalog, Farb-Hex, Refill, Bearbeiten

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – geprüft im Mock; Katalog-Dienst gegen echte SpoolmanDB (67 Hersteller, Bambu PLA 148 Farben) |
| Ziel | Spulen schnell und richtig erfassen: Hersteller und Material aus Listen, Filament mit Farbe (Hex), Nettogewicht und Leerspule aus einer Datenbank; Refills; vorhandene Spulen bearbeiten. |
| Ablauf | Anlegen/Bearbeiten → Hersteller (Liste mit Suche) → Material (Liste) → Filament-Vorschläge mit Farbfeld → übernimmt Farbname, Hex, Nettogewicht, Leerspule. Hex jederzeit als `#RRGGBB` eintippbar oder per Farbwähler. Spulenart: Kunststoff / Pappe / Refill (Mehrwegspule, Gewicht wird gemerkt). |
| Seite | Formular (`SpoolFormPage`, Anlegen `/spools/new`, Bearbeiten `/spools/:id/edit`), Auswahl-Sheet mit Suche (`core/ui/PickerSheet`) |
| Daten | Filament-Datenbank **SpoolmanDB** (github.com/Donkie/SpoolmanDB, MIT, 8 000+ Filamente) über unseren Server: `GET /catalog/manufacturers`, `/catalog/materials`, `/catalog/filaments?manufacturer=&material=` (server/catalog.js lädt `filaments.json` täglich, liefert schlanke Auszüge). Zusätzlich Bambuddy-Farbkatalog. Speichern: `POST /inventory/spools/bulk` bzw. `PATCH /inventory/spools/{id}`; Refill → `category: "Refill"`, `core_weight` = Mehrwegspule. |
| Entscheidung | 3dfilamentprofiles.com hat keine API und blockt automatische Abrufe → nicht genutzt; SpoolmanDB ist offen lizenziert und wird auch von Bambuddy/Spoolman verwendet. |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | „Bambu Lab“ + „PLA“ zeigt Basic-Farben mit Farbfeld; Auswahl füllt Name, Hex, 1000 g, Leerspule; Hex `#00AE42` eintippen färbt die Vorschau; Refill zieht das gemerkte Mehrwegspulen-Gewicht ab |

## SP-09 Schnell-Wiegen und Inventur

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – ohne Waagen-Anbindung: Etikett scannen, Waagenwert eintippen, Enter |
| Ziel | Viele vorhandene Spulen nacheinander wiegen; bei der Inventur zusätzlich Lagerort bestätigen und sehen, welche Spulen fehlen. |
| Ablauf | Mehr/Spulenliste → „Wiegen & Inventur“ → Kamera bleibt offen → Spule scannen → Gewichtsfeld ist sofort aktiv → Zahl + Enter = gespeichert → nächste Spule. Inventur-Schalter: Ort für diese Runde wählen (jede gescannte Spule wird dorthin gebucht), am Ende „Nicht gesehen“ mit Liste; Archivieren nur mit Bestätigung. Sitzung bleibt bei Unterbrechung erhalten. |
| Seite | `pages/WeighSessionPage.tsx` (`/spools/weigh`): Scanner oben, aktuelle Spule mit Zahlenfeld, Liste „erledigt“ |
| Daten | `POST /spoolbuddy/scale/update-spool-weight`, `PATCH /inventory/spools/{id}` `{ location_id }`, `POST /inventory/spools/{id}/archive` |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Pro Spule: 1 Scan + Gewicht + Enter; 10 Spulen ohne einen weiteren Tipp; Inventur zeigt nicht gescannte Spulen des gewählten Orts |

## SP-10 Leerspulen und Gewichte (angelehnt an Spooly)

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Gewichte stimmen: Leerspulen-Gewichte pflegen, beim Wiegen die richtige Leerspule sehen/ändern, Restgewicht wahlweise brutto (Waage mit Spule) oder netto (nur Filament) eintragen. |
| Ablauf | Mehr → „Leerspulen“ → Liste nach Hersteller, Suche, Eintrag tippen = ändern, + = neu, Wischen/Löschen mit Bestätigung; Vorschläge aus der Filament-Datenbank (Hersteller mit bekanntem Leerspulen-Gewicht, das noch fehlt) mit einem Tipp übernehmen. Wiegen (SP-05/SP-09): Zeile „Leerspule: Name · g“ → Auswahl-Sheet → speichert `core_weight` an der Spule; Umschalter Brutto/Netto. |
| Seite | `pages/CoreWeightsPage.tsx` (`/more/cores`), Leerspulen-Zeile + Brutto/Netto im Wiegen-Sheet und in „Wiegen & Inventur“ |
| Daten | `GET/POST /inventory/catalog`, `PUT/DELETE /inventory/catalog/{id}` (`{ name, weight }`); Spule: `PATCH { core_weight, core_weight_catalog_id }`; Netto wird als Brutto = Netto + Leerspule an den Waagen-Endpunkt gegeben (eine Rechenregel für beide Wege) |
| Vorbild | spooly.eu: Gesamt-/Restgewicht, Füllstand, QR-Wechsel – hier mit Bambuddy als Datenhaltung |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Leerspule „Sunlu – Kunststoff 160 g“ anlegen, beim Wiegen von #5 auswählen → Rest stimmt; Netto 400 g eintragen → Rest 400 g |

## SP-11 Packungs-Barcode scannen (EAN/GTIN) + Anvisierhilfe

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – mit echter Packung am iPhone prüfen |
| Ziel | Neue Spule durch Scannen des Barcodes auf Packung/Spule anlegen: Hersteller, Material, Sorte, Farbe (Hex), Gewicht, Refill und Artikelnummer werden vorausgefüllt. Kamera zeigt, wo QR/Barcode hingehört, und markiert den erkannten Code. |
| Ablauf | Scan-Tab oder „Spule hinzufügen“ → „Packung scannen“ → Barcode → Formular vorausgefüllt (Hinweis „aus Barcode“) → Anzahl → Anlegen → Etiketten. Unbekannter Barcode → Hinweis, Formular leer mit Barcode im Notizfeld. |
| Seite | Scan-Vorlage (Rahmen für QR quadratisch, für Barcodes breit mit Ziellinie; erkannter Code wird umrandet); Formular `SpoolFormPage` (`?gtin=`) |
| Daten | **Open Filament Database** (github.com/OpenFilamentCollective/open-filament-database, MIT): Barcode-Index `api.openfilamentdatabase.org/api/v1/gtin-index.json` (~5 600 Codes, 41 Marken) + Variante (`color_hex`, `sizes[].spool_refill`, `article_number`). Unser Server: `GET /catalog/gtin/{code}` (Index täglich, Varianten zwischengespeichert). Artikelnummer → Bambuddy `material_number`. |
| Plattform | `scanner` mit Formaten QR + EAN-13/8, UPC-A/E |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Bambu-PLA-Basic-Packung → „Bambu Lab · PLA · Basic · Silver · #A6A9AA · 1000 g“; Refill-Packung setzt Spulenart Refill |

## SP-12 Mehrfachauswahl in der Spulenliste (Ablauf E)

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Mehrere Spulen auf einmal etikettieren, verschieben oder archivieren (z. B. Neu-Etikettieren beim Umzug). |
| Ablauf | Liste → „Auswählen“ → Karten antippen (Haken) / „Alle“ → Aktionsleiste unten: Etiketten · Verschieben · Archivieren (mit Bestätigung) → fertig, Auswahl endet |
| Daten | Etiketten: Stapeldruck (SP-06); Verschieben: `POST /inventory/spools/bulk-update` `{ ids, update: { location_id } }`; Archivieren: `POST /inventory/spools/bulk-archive` `{ ids }` (Antwort mit `not_found`) |
| Rechte | INVENTORY_UPDATE (Etiketten: INVENTORY_READ) |
| Akzeptanz | 5 Spulen auswählen → 5 Etiketten in einem Druckauftrag; Verschieben setzt den Ort für alle; Archivieren fragt nach und blendet sie aus |

## SP-13 Bambu-Spule aus dem AMS übernehmen (RFID)

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – mit X2D in Bambuddy zu prüfen (Bambuddy hat noch keinen Drucker) |
| Ziel | Neue Bambu-Spule ins AMS legen → App erkennt sie (RFID) → ein Tipp: anlegen, dem Slot zuweisen, Etikett drucken. |
| Ablauf | Spulenliste zeigt Hinweis „n neue Bambu-Spulen im AMS“ → AMS-Slots → Slot mit „Neu erkannt“ → „Übernehmen“ → Etikett-Sheet |
| Daten | `GET /printers/{id}/status` (`ams[].tray[].tag_uid/tray_uuid/tray_type/tray_sub_brands/tray_color`), neu = Chip vorhanden, keine Spule mit diesem `tag_uid`/`tray_uuid`, Slot ohne Zuweisung; `POST /inventory/spools/from-slot` `{ printer_id, ams_id, tray_id }` (legt an + weist zu; ohne Chip 400) |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Mock: Slot mit unbekanntem Chip zeigt „Neu erkannt“, Übernehmen legt Spule an, Slot zeigt sie, Etikett-Sheet öffnet |

## Zusatzdaten außerhalb von Bambuddy

Bambuddy kennt keine Felder für „getrocknet am“ und „Etikett gedruckt“. Mit Spoolman (empfohlen) liegen sie dort als Zusatzfelder (`dried_at`, `label_printed_at`, dazu `category` für Refill), sichtbar in Spoolmans Oberfläche und mitgesichert. Ohne Spoolman: Datei `/data/spools.json` (Unraid `appdata/buddy-shelf`). Endpunkte unseres Servers: `GET /extras/spools`, `PATCH /extras/spools/{id}`, `POST /extras/spools/bulk` (`server/extras.js`). Fehlen die Zusatzdaten (Server weg), zeigt die App „unbekannt“ statt „nie“.

## SP-15 Trocknung

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Sehen, wann eine Spule zuletzt getrocknet wurde, und wie heiß/lange sie in den Dörrautomaten soll. Timer kommt später mit der iOS-App. |
| Ablauf | Detail → Karte „Trocknung“: Empfehlung je Material („PETG: 60–65 °C · 4–8 h“, darunter Bambuddys AMS-2-Pro-Wert) + „Getrocknet am …“ → „Heute getrocknet“ / Datum ändern / entfernen. ⋮-Menü der Karte: „Heute getrocknet“. Karte in der Liste zeigt Tropfen-Symbol mit „vor n Tagen“. |
| Daten | Datum: Zusatzdaten `driedAt` (siehe oben). Empfehlungen: `src/modules/spools/drying.json` (übliche Herstellerangaben, z. B. Bambu Lab Wiki, Sunlu, Polymaker; Spannen statt Einzelwert; Dörrautomaten schaffen meist nur ~70 °C – Hinweis bei höheren Werten) |
| Rechte | INVENTORY_UPDATE zum Setzen |
| Akzeptanz | #5 PETG → Empfehlung 60–65 °C · 4–8 h; „Heute getrocknet“ → Detail und Liste zeigen das Datum, auch auf einem zweiten Gerät |

## SP-16 Etiketten-Status

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – Anzahl je Etikett wird gemerkt (einmal 2 wählen) |
| Ziel | Wissen, welche Spulen schon ein Etikett haben; alle ohne Etikett auf einmal drucken (z. B. 2 je Spule). |
| Ablauf | Drucken oder PNG speichern setzt „Etikett gedruckt am“. Liste: Filter „Ohne Etikett (n)“ → Auswählen → Alle → Etiketten mit Anzahl 2. Detail: Status mit „als etikettiert markieren“/zurücksetzen (für schon beklebte Spulen). |
| Daten | Zusatzdaten `labelPrintedAt`, Stapel per `POST /extras/spools/bulk` |
| Akzeptanz | 3 Spulen ohne Etikett → Filter zeigt 3 → Druck mit Anzahl 2 = 6 Etiketten → Filter leer |

## SP-17 QR-Abläufe: Schnellmenü und Lagerort-Codes

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt – Lagerorte unter Mehr → Lagerorte (anlegen, Etiketten); Code-Eingabe für PC ohne Kamera |
| Ziel | Ein Scan startet die Arbeit: Spulen-Etikett → Schnellmenü; Lagerort-Etikett → danach gescannte Spulen landen dort. |
| Ablauf | Scan Spule → Sheet mit Wiegen · Getrocknet · Ins AMS · Verschieben · Etikett · Details. Scan Lagerort (`bm:l:<id>`) → Modus „Einräumen in …“: jede weitere gescannte Spule wird dorthin verschoben (Ton + Liste), Ende per Knopf. Lagerort-Etiketten drucken unter Lagerorte. |
| Daten | `PATCH /inventory/spools/{id}` `{ location_id }`; Vorlagen-Art `location` |
| Akzeptanz | Ort „Trockenbox“ scannen, 3 Spulen scannen → alle 3 dort; Spule scannen → Schnellmenü in < 1 s |

## SP-18 Lagerorte bearbeiten

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Lagerorte wie in Spooly pflegen: Symbol, Standard-Ort für neue Spulen, umbenennen, löschen. |
| Ablauf | Mehr → Lagerorte → Stift: Name, Symbol (12 Vorschläge oder eigenes Emoji), „Als Standard“, Löschen (nur wenn leer, sonst Hinweis „erst umlagern“). Neue Spule: Standard-Ort ist vorausgewählt, „Ohne Lagerort“ bleibt wählbar. Symbol erscheint in Karte, Detail, Verschieben, Einräumen, Gruppierung und Formular. |
| Daten | Name: Bambuddy `PATCH /inventory/locations/{id}` (überträgt auf die Spulen), `DELETE …/{id}` (nur leer). Symbol und Standard: `/prefs/locations` `{ icons: { <id>: "📦" }, defaultId }` – gilt auf allen Geräten. Beim Löschen werden beide mit aufgeräumt. |
| Rechte | INVENTORY_UPDATE |
| Akzeptanz | Drybox 1 → 🔥 + Standard → Liste zeigt „🔥 Drybox 1 ★ Standard“, neue Spule hat Drybox 1 vorausgewählt; Ort mit Spulen lässt sich nicht löschen |

## SP-19 Spulen-Anzeige

| Feld | Inhalt |
| --- | --- |
| Status | umgesetzt |
| Ziel | Selbst festlegen, ab wann eine Spule niedrig oder fast leer ist, und was Karten zeigen (angelehnt an Spooly). |
| Ablauf | Mehr → Spulen-Anzeige: Vorschau der drei Stufen; Warnschwellen „Niedrig unter“ (Standard 25 %) und „Fast leer ab“ (8 %); je Materialfamilie eigene Werte (PLA gilt auch für PLA+, PLA Matte …); Schalter Signalfarben, Preis zeigen, Trocknung zeigen; Standard-Spulengröße für neue Spulen. Fast leer = rotes Abzeichen und im Detail „Zeit zum Nachkaufen“. |
| Daten | `/prefs/display` (`lowPct`, `emptyPct`, `materials`, `signalColors`, `defaultWeight`, `showPrice`, `showDrying`), Logik `core/filament/display.ts` (`stockLevel`) – Übersicht und Spulen nutzen dieselbe. Reihenfolge: Schwelle an der Spule (Bambuddy) → Familie → global. |
| Rechte | INVENTORY_UPDATE zum Ändern |
| Akzeptanz | PLA auf 40/15 % → PLA-Spule mit 13 % zeigt „Fast leer“ rot, PETG mit 30 % bleibt grün; Signalfarben aus → alle Balken in Akzentfarbe |

## SP-14 Umzug von Spooly (Ablauf G)

| Feld | Inhalt |
| --- | --- |
| Status | zurückgestellt (auf Wunsch ans Ende) – wartet auf eine Beispiel-Exportdatei aus Spooly |
| Ziel | Spooly-CSV einmalig in Bambuddy übernehmen (Nummern behalten), danach alles neu etikettieren (SP-12). |

## Als Nächstes (Wünsche des Nutzers, 12.10.2026)

| Paket | Inhalt |
| --- | --- |
| Rest aus dem UX-Review | einheitliche Fehler-/Rechte-Zustände (ein Baustein), `useNotify` statt kopierter Toasts, Scan-Knopf mittig bei gerader Tab-Zahl, ungenutzte Texte entfernen |
| Später | Multi-Color/Verlauf (Spoolman `multi_color_hexes`), Nachkaufen-Links, „reicht noch x Tage“, Druckdienst fürs iPhone, native iOS-App (Push für Trocknungs-Erinnerung) |
