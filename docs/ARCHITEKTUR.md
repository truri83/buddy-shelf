# Architektur und verbindliche Regeln

Jede Funktion gehört zu genau einem Modul. Module sprechen Bambuddy und das Gerät nur über den
gemeinsamen Kern an und kennen einander nicht. Plattformunterschiede stecken ausschließlich in
Adaptern, damit dieselbe Codebasis auf iOS, Android, Windows und macOS läuft.

## Gesamtbild

```
Handy / PC (PWA, später native App)
   │ HTTPS (Tailscale)
   ▼
buddy-shelf-Container (Unraid)          ┌── Druckdienst niimblue-node (optional, Phase 2)
   server/index.js: liefert App aus,    │      └─ USB/Bluetooth → Niimbot B1 Pro
   leitet /api + /api/v1/ws weiter ─────┤
   ▼                                    └── /print
Bambuddy (unverändert) ── MQTT im LAN ── Bambu X2D
   │ Spoolman-Modus (Einstellung in Bambuddy)
   ▼
Spoolman ◄── /extras (Zusatzfelder: getrocknet, Etikett, Refill, Artikelnummer) ── buddy-shelf-Server

Direktdruck ohne Server: Chrome/Edge (Web Bluetooth / Web Serial) oder native App (Capacitor-BLE).
```

## Datenquelle: Bambuddy oder Spoolman

Bambuddy führt den Bestand selbst oder in Spoolman (`GET /spoolman/status` → `enabled`). `src/core/api/client.ts`
fragt das (1 Min. zwischengespeichert, ohne Antwort letzter bekannter Stand – nie raten) und nimmt dann die
Spoolman-Pfade von Bambuddy (`/spoolman/inventory/…`, gleiches Spulenformat). Module merken davon nichts.
Abweichungen im Spoolman-Modus, alle im Client gekapselt:

| Thema | Bambuddy lokal | Bambuddy mit Spoolman |
| --- | --- | --- |
| Wiegen | `POST /spoolbuddy/scale/update-spool-weight` | `PATCH /spoolman/inventory/spools/{id}/weight` (brutto, Tara nach Spoolman-Regel) |
| AMS-Zuweisung | `/inventory/assignments`, löschen je Slot | `/spoolman/inventory/slot-assignments`, löschen **je Spule** → erst lösen, dann belegen, bei Fehler zurücklegen |
| RFID übernehmen | Antwort = Spule | Antwort `{ spool_id }` → Spule nachladen |
| Refill, Artikelnummer | Felder in Bambuddy | Bambuddy reicht sie nicht durch → Spoolman-Zusatzfeld `category` bzw. `filament.article_number` über `/extras` |
| Getrocknet, Etikett gedruckt | Datei `/data/spools.json` | Spoolman-Zusatzfelder `dried_at`, `label_printed_at` |

Der Server wählt den Speicher der Zusatzdaten nach derselben Bambuddy-Einstellung (Spoolman-Adresse aus
Bambuddy, Überschreiben mit `SPOOLMAN_URL`). Spoolman hat keine Anmeldung: Buddy Shelf spricht es nur
serverseitig an, nie vom Handy aus.

## Schichten

| Schicht | Inhalt | Darf zugreifen auf |
| --- | --- | --- |
| App-Shell (`src/app`) | Routing, Tab-Leiste, Scan-Verteiler, Einstellungen, Modul-Registry | Manifeste, Kern |
| Module (`src/modules/*`) | Seiten, Komponenten, Abläufe eines Fachbereichs | nur Kern, nie andere Module |
| Kern (`src/core/*`) | Bambuddy-Client, Live-Verbindung, Plattform-Adapter, Design-System, Texte, QR, Druck | Proxy, Geräte-APIs |
| Proxy (`server/`) | Auslieferung, Weiterleitung an Bambuddy, WebSocket, Druckdienst, Etikett-Vorlagen (`/labels`), Zusatzdaten (`/extras`) | Bambuddy, Spoolman, niimblue-node, Datenordner `/data` |

## Ordnerstruktur

```
docs/                KONZEPT, ARCHITEKTUR, DESIGN-SYSTEM, BAMBUDDY-API, module/<modul>.md, adr/
mocks/               MSW-Handler + Beispieldaten im Bambuddy-Format
server/              Produktionsserver (Fastify): statisch + Proxy
src/
  app/               Shell: App.tsx, registry.ts, scan.ts, pages/ (Scan, Mehr)
  core/
    api/             Bambuddy-Client (client.ts), Typen (types.ts → später bambuddy.gen.ts)
    realtime/        eine WebSocket-Verbindung (Stufe 4)
    platform/        Fähigkeiten (can), Speicher, Adapter: scanner, printer, nfc, push, share, haptics
    printing/        Druckerprofile, Etiketten-Rasterung, Transporte (niimbluelib)
    qr/              Scan-Formate (bm:s:, Bambuddy-Etikett, bambuddy://config)
    ui/              tokens.css, Bausteine (ColorRing, FillBar, Badge, StateView …)
    i18n/            de.ts (+ en.ts)
    modules.ts       Modulvertrag (ModuleManifest)
  modules/
    overview/        Übersicht „Aufmerksamkeit nötig“
    spools/          manifest.ts, pages/, components/, hooks/, labels/, logic.ts, index.ts
    printers/        Stufe 4 (noch leer)
native/              Capacitor ios/ und android/ (ab nativer Stufe)
deploy/unraid/       Unraid-Vorlage
```

## Modulvertrag
Jedes Modul exportiert über `index.ts` genau ein `ModuleManifest` (`src/core/modules.ts`) und wird in
`src/app/registry.ts` eingetragen. Die Shell baut daraus Routen, Tabs, Schnellaktionen und die
Scan-Zuordnung. Felder: `id`, `title` (i18n), `icon`, `stage`, `routes`, `tab`, `quickActions`,
`scan(result) → route | null`, `requires { api, platform, optional }`, `events { listens, emits }`.

## Plattform-Adapter
Module fragen Fähigkeiten ab (`can('printer.bluetooth')`) und rufen einheitliche Schnittstellen auf.

| Fähigkeit | iOS Web-App (Safari) | Android/Windows/macOS Web-App (Chrome/Edge) | iOS + Android nativ (Capacitor) | Desktop nativ (Tauri, optional) |
| --- | --- | --- | --- | --- |
| QR-Scanner | Kamera + JS-Bibliothek | Kamera + BarcodeDetector bzw. JS | nativer Scanner (ML Kit / Vision) | Webcam + JS |
| Etikettendruck | Druckdienst am Server, alternativ Bluefy | Web Bluetooth oder Web Serial (USB) | Capacitor-BLE, USB auf Android | Bluetooth oder USB |
| NFC | – | nur Chrome Android (NTAG) | NTAG beide; Bambu-RFID (MIFARE Classic) nur Android | – |
| Benachrichtigungen | Notify!-Provider in Bambuddy; Web Push nur Homescreen | Web Push | APNs / FCM | Systembenachrichtigung |
| Speicher | localStorage/IndexedDB | localStorage/IndexedDB | Preferences, Schlüssel im Keychain/Keystore | Dateisystem |

Etikettendrucker sind **Profile** (`src/core/printing/profiles.ts`): Modell, dpi, Druckkopf-Pixel,
Farben, Verbindungen. Layouts rechnen in mm und werden beim Druck gerastert; Zweitfarbe (Rot) wird
auf einfarbigen Druckern schwarz. Bibliothek: `@mmote/niimbluelib` (Bluetooth-, Seriell- und
Capacitor-Client, unterstützt B1 Pro inkl. Rot).

## Verbindliche Regeln
1. Ein Modul ist ein Ordner unter `src/modules` und wird nur über sein Manifest registriert.
2. Module importieren nie aus anderen Modulen. Zusammenarbeit über Ereignisse, Deep Links und den Kern. *(ESLint)*
3. Bambuddy nur über `core/api`, Gerätefunktionen nur über `core/platform`. Kein `fetch`, kein Plugin-Aufruf im Modul. *(ESLint für fetch)*
4. Keine Plattformweichen im Modul. Fehlt eine Fähigkeit, blendet das Modul die Funktion aus oder zeigt den Ersatzweg.
5. Serverdaten nur über Query-Hooks (TanStack Query) mit Zwischenspeicher; Schreibvorgänge zeigen Erfolg oder Fehler sofort.
6. Live-Daten nur über `core/realtime`; genau eine WebSocket-Verbindung.
7. Jede Seite hat die Zustände lädt, leer, Fehler, offline (`StateView`).
8. Bedienung: wichtige Knöpfe in der Daumenzone, Auswahl in Bottom-Sheets, höchstens drei Tipps nach einem Scan.
9. Alle Texte über `core/i18n`, alle Farben/Abstände über Tokens aus `core/ui`.
10. Bambuddy wird nicht verändert. Fehlt ein Endpunkt: Übergangslösung in `server/` und Vorschlag an Bambuddy.
11. Jede neue Funktion beginnt mit einem Steckbrief in `docs/module/<modul>.md`.
12. Alles für mehrere Drucker, AMS-Einheiten und Lagerorte auslegen.
13. Gefährliche Aktionen (Stopp, Löschen, Archivieren) nur mit Bestätigung und passendem Bambuddy-Recht.
14. Beim Start Bambuddy-Version prüfen; unbekannte Versionen → Hinweis, kein Fehler.

## Sicherheit
- Server-Schlüssel (Entscheidung 11.10.2026, Nutzerwunsch): `BAMBUDDY_API_KEY` im Container; der Proxy setzt
  ihn bei Anfragen ohne eigenen Schlüssel ein, damit nicht jedes Gerät einen Schlüssel braucht. Folge: Wer die
  App erreicht (LAN/Tailscale), hat dessen Rechte → Schlüssel nur mit nötigen Rechten anlegen, App nicht ins
  Internet stellen. Ein im Gerät eingetragener Schlüssel geht vor; später Login über Bambuddy „Connected Apps“.
- Schlüssel nativ nur im sicheren Speicher; im Browser so kurzlebig wie möglich.
- Rechte kommen aus Bambuddy; Module blenden Funktionen ohne Recht aus (`requires.api`).

## Fertig heißt
- Steckbrief erfüllt, Akzeptanzsätze von Hand geprüft
- läuft im Mock und gegen echte Instanz; iPhone (Safari) und Chrome Desktop
- Regeln 1–14 eingehalten, `typecheck`, `lint`, `test`, `build` grün
- Tests für Logik (Kern bzw. `logic.ts` des Moduls)
- Steckbrief-Status „umgesetzt“
