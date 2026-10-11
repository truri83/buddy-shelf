# ADR 0001 – Stack: React + Ionic + Vite, PWA zuerst, Capacitor später

Status: angenommen (11.10.2026)

## Kontext
Eine Codebasis für iOS, Android, Windows und macOS; native Bedienung auf dem Handy; Etikettendruck
per Bluetooth/USB; Nutzer entwickelt mit Claude Code in VS Code; Bambuddy-Frontend ist React.

## Entscheidung
React 19 + TypeScript + Vite; Ionic React für plattformgerechte Bedienung; PWA (vite-plugin-pwa);
TanStack Query für Serverdaten; MSW für Mocks; Fastify als schlanker Server/Proxy; später Capacitor
(iOS/Android) und optional Tauri (Desktop). Etikettendruck über `@mmote/niimbluelib`.

## Alternativen
- Flutter: sehr gute native Apps, aber kein Web Bluetooth/Serial-Pfad im Browser und andere Sprache
  als Bambuddy; DoYouHost deckt Flutter/Android bereits ab.
- SwiftUI nativ: beste iOS-Qualität, aber nur Apple-Plattformen (Sprout, BamPocket existieren).
- Plain React + Tailwind ohne Ionic: mehr Eigenbau für native Muster (Wisch-Zurück, Sheets, Tab-Stacks).

## Folgen
Ionic-Komponenten bestimmen die Bedienmuster; eigenes Aussehen nur über Tokens. Native Funktionen
kommen über Capacitor-Plugins hinter den Plattform-Adaptern.
