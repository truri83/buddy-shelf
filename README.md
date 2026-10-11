# buddy-shelf

Handy-App für [Bambuddy](https://github.com/maziggy/bambuddy): Spulen scannen, zuweisen, wiegen und
direkt auf Niimbot-Etikettendruckern etikettieren. Plattformneutral (iOS, Android, Windows, macOS),
zuerst als Web-App (PWA), später nativ über Capacitor.

> Arbeitstitel. Status: Grundgerüst steht, Phase 1 in Arbeit.

## Schnellstart

```bash
npm install
npm run dev:mock             # mit Beispieldaten, ohne Server
# oder gegen die echte Instanz:
cp .env.example .env.local   # BAMBUDDY_URL eintragen
npm run dev
```

In der App unter **Mehr** Bambuddy-Adresse (leer = über den eigenen Proxy) und API-Schlüssel
eintragen. Später: Einrichtungs-QR aus Bambuddy scannen.

## Docker / Unraid

```bash
docker build -t buddy-shelf .
docker run -p 8080:8080 -e BAMBUDDY_URL=http://<bambuddy>:8000 buddy-shelf
```

Unraid-Vorlage: `deploy/unraid/buddy-shelf.xml`. HTTPS (für Kamera und Bluetooth nötig) z. B. über
`tailscale serve`.

## Doku
- [Konzept](docs/KONZEPT.md) · [Architektur & Regeln](docs/ARCHITEKTUR.md) · [Design-System](docs/DESIGN-SYSTEM.md)
- [Bambuddy-API](docs/BAMBUDDY-API.md) · [Steckbriefe Spulen](docs/module/spools.md)
- Arbeitsanweisungen für Claude Code: [CLAUDE.md](CLAUDE.md)

Lizenz: noch offen (MIT oder AGPL), siehe `docs/KONZEPT.md`.
