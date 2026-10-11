# CLAUDE.md – buddy-shelf

Plattformneutrale App (PWA → später Capacitor iOS/Android, Desktop als PWA/Tauri), die Bambuddy
aufs Handy bringt. Erstes Modul: Spulen scannen, zuweisen, wiegen und auf Niimbot-Etikettendruckern
etikettieren. Bambuddy ist die einzige Datenhaltung; diese App hat keine eigene Datenbank.

Sprache: Code und Bezeichner Englisch; Texte in der App, Doku und Commit-Beschreibungen Deutsch.

## Vor jeder Arbeit lesen
- `docs/KONZEPT.md` – Ziel, Umfang, Phasen, Abgrenzung zu vorhandenen Apps
- `docs/ARCHITEKTUR.md` – Schichten, Ordner, Modulvertrag, **verbindliche Regeln 1–14**
- `docs/DESIGN-SYSTEM.md` – Tokens, Seitenvorlagen, Bausteine, **UI-Regeln 1–6**
- `docs/BAMBUDDY-API.md` – genutzte Endpunkte, QR-Formate, offene API-Fragen
- `docs/module/<modul>.md` – Funktionssteckbriefe; **gebaut wird nur, was einen Steckbrief hat**

## Arbeitsweise
1. Neue Funktion → zuerst Steckbrief in `docs/module/<modul>.md` (Vorlage `docs/module/_VORLAGE.md`),
   inkl. Skizze aus Seitenvorlage + Bausteinen. Erst bauen, wenn der Steckbrief steht.
2. Kleine Schritte, je Steckbrief ein Branch/PR. Steckbrief-Status am Ende auf „umgesetzt“.
3. Vor dem Abschluss immer: `npm run typecheck && npm run lint && npm test && npm run build`.
4. UI immer im Mock prüfen (`npm run dev:mock`): iPhone-Breite hell + dunkel, Desktop-Breite.
5. Bambuddy-Feldnamen nie raten: im Bambuddy-Code nachsehen (github.com/maziggy/bambuddy,
   `backend/app/schemas/`, `backend/app/api/routes/`) oder `npm run api:types` gegen die laufende Instanz.
6. Neue Endpunkte, die die App nutzt, in `docs/BAMBUDDY-API.md` und `mocks/handlers.ts` nachtragen.

## Harte Regeln (Kurzfassung, Details in docs/ARCHITEKTUR.md)
- Module importieren nie aus anderen Modulen (ESLint erzwingt das). Gemeinsames gehört nach `src/core`.
- Kein `fetch` außerhalb `src/core` (ESLint erzwingt das). Bambuddy nur über `@/core/api`.
- Keine Plattformweichen in Modulen; nur `can('…')` aus `@/core/platform`.
- Keine festen Farben/Abstände in Modulen; nur Tokens (`var(--bs-…)`) und Bausteine aus `@/core/ui`.
- Alle Texte über `t()` aus `@/core/i18n`.
- Gefährliche Aktionen nur mit Bestätigung und passendem Bambuddy-Recht.
- Alles für mehrere Drucker, AMS-Einheiten und Lagerorte auslegen.
- Etiketten-QR enthält `bm:s:<id>` (keine Serveradresse). Parser: `src/core/qr/codes.ts`.
- Etikettendrucker nur über Profile (`src/core/printing/profiles.ts`), Layouts in Millimetern.
- Bambuddy wird nie verändert. Fehlt etwas: Übergangslösung in `server/`, Vorschlag an Bambuddy.

## Befehle
- `npm run dev:mock` – App mit Beispieldaten (MSW), kein Server nötig
- `npm run dev` – App gegen echte Bambuddy-Instanz (`BAMBUDDY_URL` in `.env.local`)
- `npm test` – Vitest (`src/**/*.test.ts`)
- `npm run api:types` – Typen aus Bambuddys `openapi.json` → `src/core/api/bambuddy.gen.ts`
- `npm run build && npm run server` – Produktionsbuild + Server (Proxy /api → Bambuddy)

## Deploy (Unraid, Ablauf wie SeestarManager)
- Prod: `http://100.101.172.117:8096` (Container `buddy-shelf`, Vorlage `deploy/unraid/buddy-shelf.xml`).
- Push auf `main` → CI baut `ghcr.io/truri83/buddy-shelf:latest` + `:<sha>` (mit `BUILD_SHA`).
- Dann `scripts/deploy.sh`: wartet auf CI, ruft `POST /api/admin/self-recreate` (Bearer-Token), pollt
  `/healthz` bis `sha` = HEAD. Code: `server/admin.js` (übernommen aus Seestar `admin-api.ts`).
- Token nur aus der Windows-Benutzer-Variable `BUDDY_SHELF_ADMIN_TOKEN` lesen, nie in Chat oder Kommandozeile.
- Zugriff auf den Tower: `ssh -i ~/.ssh/unraid_claude root@100.101.172.117` (nur für Einrichtung/Notfall).

## Umgebung des Nutzers
- Bambuddy selbst gehostet auf Unraid, erreichbar über Tailscale.
- Drucker: Bambu Lab X2D mit AMS. Etikettendrucker: Niimbot B1 Pro (300 dpi, 48 mm, schwarz/rot,
  Bluetooth oder USB-C).
- Testgeräte zuerst: iPhone (Safari, Homescreen-PWA) und Windows-PC (Chrome/Edge).
