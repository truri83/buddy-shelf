# Konzept – buddy-shelf

Stand 11.10.2026. Das lebende, ausführliche Konzept (mit Diagramm, Recherche und Kommentaren) liegt hier:
https://claude.ai/code/artifact/7b50d3e7-e99b-45e7-a6c7-590fe6fbb3c4
Diese Datei ist die verbindliche Kurzfassung im Repo. Bei Abweichungen gilt das Repo.

## Ziel
Bambuddy aufs Handy bringen, wo es bisher fehlt. Modular aufgebaut; erstes Modul ist die
Spulenverwaltung mit der Bedienqualität von Spooly: QR-Code scannen, Spule zuweisen, Etikett direkt
auf dem Etikettendrucker drucken.

| Punkt | Festlegung |
| --- | --- |
| Datenbasis | Bambuddy (selbst gehostet, Unraid) über REST-API – kein Fork, kein Spoolman, keine eigene DB |
| Zielgeräte | Plattformneutral: iOS, Android, Windows, macOS – iPhone und Windows-PC zuerst |
| Stufe 1 | Web-App (PWA), installierbar auf dem Homescreen |
| Stufe 2 | Native Apps iOS/Android aus derselben Codebasis (Capacitor); Desktop als PWA, bei Bedarf Tauri |
| Etikettendrucker | über Druckerprofile; aktuell Niimbot B1 Pro (300 dpi, 567 px = 48 mm, schwarz/rot, Bluetooth oder USB-C) |
| Erreichbarkeit | eigenes Netz bzw. Tailscale, HTTPS über *.ts.net |
| Entwicklung | VS Code + Claude Code, dieses Repo |

Nicht-Ziele: Cloud-Betrieb, Gamification, Aufträge/Rechnungen, Slicen, Profil- und Benutzerverwaltung
(bleibt in der Bambuddy-Weboberfläche).

## Abgrenzung zu vorhandenen Apps (Recherche 11.10.2026)
Es gibt sechs Community-Apps für Bambuddy, aber **keine druckt auf Niimbot** und **keine deckt iOS und
Android aus einer Codebasis ab** – das ist der Platz dieser App.

| App | Plattform | Schwerpunkt | Status | Lizenz |
| --- | --- | --- | --- | --- |
| Bambuddy Mobile (DoYouHost) | Android, Wear OS (Flutter) | fast alles inkl. Inventar mit QR-Scan | sehr aktiv, kein iOS | AGPL-3.0 |
| Sprout | iOS/macOS 26+ (SwiftUI) | Dashboard, Live Activities, Inventar, Trocknung | nur TestFlight | MIT |
| BamPocket | iOS 18+ | sehr breit | v0.1, ruhig, Sideload | AGPL-3.0 |
| BambuMan | Android, Windows | Bambu-RFID per NFC einlesen | aktiv | AGPL-3.0 |
| BuddyDash | Android | Mehrdrucker-Dashboard | ruhend | MIT |
| notify-bambuddy | Server + iOS-App Notify! | Live Activities | wird durch eingebauten Notify!-Provider abgelöst | AGPL-3.0 |

Folgerungen:
- Spulen-Ablauf mit Niimbot-Druck und guter iOS-Bedienung kommt zuerst und wird am besten gemacht.
- Stufen 4–6 erst nach Test von DoYouHost und Sprout entscheiden; nur bauen, was fehlt.
- Push/Live Activities auf dem iPhone zuerst über den eingebauten Notify!-Provider von Bambuddy.
- Kein AGPL-Code übernehmen, solange die Lizenz dieser App nicht entschieden ist.

## Phasen

| Phase | Inhalt |
| --- | --- |
| 1 | Spulenliste, Detail, Scannen (QR), ins AMS legen, verschieben, wiegen, Spule anlegen/duplizieren, **Etikett gestalten und drucken** (Windows-Chrome per Bluetooth/USB direkt) |
| 2 | Etikettendruck vom iPhone (Druckdienst niimblue-node am Server), Mehrfachdruck |
| 3 | Prognose „reicht noch x Tage“, Trocknung, Inventur, Foto-Import (KI), Einkaufsliste |
| 4–6 | Drucker live, Benachrichtigungen, Warteschlange, Archiv, Wartung, Statistik – nur was nach Test der vorhandenen Apps fehlt |
| nativ | Capacitor-Hülle iOS/Android: Bluetooth-Druck vom iPhone, NFC, Push, Widgets |

## Kernabläufe (höchstens drei Tipps nach dem Scan)
- **A – Spulenwechsel am AMS (Hauptablauf):** Slot-Etikett am AMS scannen → neue Spule scannen → fertig. Bambuddy stellt den Slot selbst ein; die alte Spule bekommt ihren Lagerort zurück (SP-08). Alternativ ohne Slot-Etikett: Spule scannen → „Ins AMS“ → Slot wählen (SP-03).
- **B – Zurück ins Regal:** Scannen → „Verschieben“ → Lagerort (zuletzt genutzter oben) → optional Trockenbox.
- **C – Neue Spule:** Plus → Spule hinzufügen → aus Katalog oder duplizieren → Speichern → Etikett-Vorschau → Drucken.
- **D – Wiegen:** Scannen → „Wiegen“ → Bruttogewicht → App zieht Leergewicht ab → speichert.
- **E – Mehrere Etiketten:** Liste → Mehrfachauswahl → Etiketten drucken.
- **F – Einrichten:** In Bambuddy API-Schlüssel anlegen → QR anzeigen → in der App scannen (alternativ Login).
- **G – Umzug von Spooly (einmalig):** Spooly-CSV-Export → Bambuddy-Import (Nummern übernehmen) → alle neu etikettieren.

## Offene Punkte
- [ ] Endgültiger App-Name („Bambuddy Mobile“ ist vergeben; Repo heißt buddy-shelf)
- [ ] Lizenz: MIT oder AGPL
- [ ] Umfang Stufen 4–6 nach Test von DoYouHost und Sprout
- [ ] Standort des B1 Pro und Rechner mit Bluetooth/USB in Reichweite (Druckdienst Phase 2)
- [ ] Restgewicht per PATCH `weight_used` oder als Verbrauchseintrag? (siehe BAMBUDDY-API.md)
- [ ] Endpunkt für die Bambuddy-Version (Regel 14)
- [ ] Eigener API-Schlüssel für die App mit Rechten „Inventar verwalten“ + „Status lesen“
