# buddy-shelf – Hinweise für Claude Code

PWA (React/Ionic, Vite, später Capacitor/Tauri) mit Fastify-Server `server/`: bringt Bambuddy aufs Handy; erstes Modul Spulen scannen, zuweisen, wiegen, Niimbot-Etiketten. Läuft als Docker-Container auf Unraid. Code und Bezeichner Englisch; App-Texte, Doku, Commits Deutsch. Repo ist öffentlich: keine Schlüssel, Tokens, Passwörter. Push nur nach Torstens Okay, je Steckbrief ein Branch/PR.

## Zuerst lesen (gezielt per Suche, nie ganz)
- `docs/ARCHITEKTUR.md`: Schichten, Modulvertrag, verbindliche Regeln 1–14, Deploy und Betrieb, Etiketten-QR
- `docs/KONZEPT.md`: Ziel, Umfang, Phasen. `docs/BAMBUDDY-API.md`: genutzte Endpunkte, QR-Formate
- `docs/DESIGN-SYSTEM.md`: Tokens, Seitenvorlagen, UI-Regeln 1–6. `docs/adr/`: Entscheidungen
- `docs/module/<modul>.md`: Steckbriefe (Vorlage `_VORLAGE.md`); gebaut wird nur, was einen hat
- `docs/analyse/INDEX.md`: vorhandene Erhebungen
- Arbeitsdateien (`docs/uebergabe/`, `docs/superpowers/plans/`, `docs/analyse/`, `docs/bugs.md`, `docs/ideen.md`, `.local/`) bleiben lokal, nicht in Git (`.git/info/exclude`)

## Befehle
- Prüfen vor Abschluss: `npm run typecheck && npm run lint && npm test && npm run build` (`tsc -p .` prüft hier nichts)
- Starten: `npm run dev:mock` (Beispieldaten, kein Server), `npm run dev` (echte Instanz, `BAMBUDDY_URL` in `.env.local`)
- Produktion lokal: `npm run build && npm run server`
- Typen aus Bambuddy: `npm run api:types` (nach `src/core/api/bambuddy.gen.ts`)
- Deploy: nach Push auf `main` und grüner CI `scripts/deploy.sh`; Ablauf in `docs/ARCHITEKTUR.md`
- Tower: `ssh -i ~/.ssh/unraid_claude root@100.101.172.117` oder LAN `root@192.168.178.50` (Tailscale bei NordVPN-Killswitch gesperrt); nur Einrichtung/Notfall

## Nie
- Bambuddy verändern: Übergangslösung in `server/`, Vorschlag an Bambuddy.
- `BUDDY_SHELF_ADMIN_TOKEN` oder `BAMBUDDY_API_KEY` ausgeben; Token nur aus der Windows-Benutzer-Variable lesen.
- Bambuddy-Feldnamen raten.

## Arbeitsregeln
- Wenn eine neue Funktion kommt, dann zuerst Steckbrief mit Skizze (Seitenvorlage + Bausteine), erst danach bauen; am Ende Status „umgesetzt“.
- Wenn ein Bambuddy-Feldname gebraucht wird, dann in github.com/maziggy/bambuddy (`backend/app/schemas/`, `backend/app/api/routes/`) nachsehen oder `npm run api:types`.
- Wenn die App einen neuen Endpunkt nutzt, dann in `docs/BAMBUDDY-API.md` und `mocks/handlers.ts` nachtragen.
- Wenn UI geändert wird, dann im Mock prüfen: iPhone-Breite hell und dunkel, Desktop-Breite.
- Wenn etwas einstellbar ist, dann als gemeinsame Einstellung `/prefs/<bereich>` bauen; speichern nur auf frisch gelesenem Server-Stand. Genutzt wird nur zu Hause.

## Lehren (neu)
