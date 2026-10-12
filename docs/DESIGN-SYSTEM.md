# Oberfläche und Design-System

Ein Design-System für alle Plattformen: eigene Farben, Schrift-Skala und Bausteine überall gleich;
Bedienmuster (Navigation, Zurück, Sheets, Schalter, Schrift) so, wie die Plattform es erwartet.
Ionic schaltet automatisch zwischen iOS- und Material-Stil um.

## Grundlage
| Baustein | Wahl |
| --- | --- |
| Bediengerüst | Ionic Framework für React (`@ionic/react`, `@ionic/react-router`) |
| Eigene Bausteine | `src/core/ui/components`, gestylt nur über Tokens |
| Tokens | CSS-Variablen in `src/core/ui/tokens.css`, mappen auch die Ionic-Variablen |
| Schrift | Systemschrift (`system-ui`): SF Pro / Roboto / Segoe UI; Zahlen mit `tabular-nums` (`.bs-num`) |
| Symbole | Ionicons |
| Bausteinkatalog | Storybook (noch einzurichten) |

## Informationsarchitektur
Höchstens fünf Hauptbereiche; Tabs entstehen aus den Modul-Manifesten.

| Platz | Bereich | Ab Stufe |
| --- | --- | --- |
| 1 | Übersicht („Aufmerksamkeit nötig“) | 1 |
| 2 | Spulen | 1 |
| Mitte | Scannen | 1 |
| 3 | Drucker | 4 |
| 4 | Mehr (Einstellungen, Wartung, Statistik, Link zu Bambuddy) | 1 |

Handy: Tab-Leiste unten. Tablet/Desktop: Seitenleiste links, Liste und Detail nebeneinander (gleiche Bausteine).

## Plattformgerechte Muster
| Muster | iOS | Android | Windows / macOS |
| --- | --- | --- | --- |
| Hauptnavigation | Tab-Leiste unten | Navigationsleiste unten | Seitenleiste |
| Seitenkopf | großer Titel, schrumpft beim Scrollen | Top-App-Bar | Kopfzeile mit Suche |
| Zurück | Wischen vom Rand | System-Geste | Pfeil, Escape |
| Aktionen am Objekt | Action/Bottom Sheet | Bottom Sheet | Kontextmenü + Menüknopf |
| Auswahl (Slot, Ort) | Sheet mit Liste | Bottom Sheet mit Radio | Dropdown |
| Rückmeldung | Haptik + Hinweis | Snackbar | Toast |
| Tastenkürzel | – | – | `/` Suche, `S` Scannen, `N` neue Spule |

## Design-Tokens (`tokens.css`)
| Gruppe | Vorgabe |
| --- | --- |
| Farbmodus | hell und dunkel nach System, dunkel ist Referenz |
| Akzent | `--bs-accent`, nur Hauptaktion und Auswahl |
| Status | `--bs-good`, `--bs-warn`, `--bs-critical` – nur für Zustände |
| Materialfarben | `--bs-mat-pla/petg/asa/abs/tpu/pa/other` (Badges) |
| Filamentfarbe | nur im Farbring/Farbfeld (`ColorRing`), nie als Flächen- oder Textfarbe |
| Schrift | 5 Stufen: `--bs-fs-largetitle/title/body/caption/number` |
| Abstände | 4-Punkt-Raster `--bs-s1…s6` (4, 8, 12, 16, 24, 32) |
| Radien | `--bs-r-sm/md/lg` |
| Tippfläche | `--bs-touch` ≥ 44 pt (iOS) bzw. 48 dp (Android) |
| Bewegung | Ionic-Übergänge; „Bewegung reduzieren“ beachten |
| Barrierefreiheit | dynamische Schriftgröße, Kontrast ≥ 4,5:1, Beschriftung für VoiceOver/TalkBack |

## Seitenvorlagen
| Vorlage | Aufbau | Beispiel |
| --- | --- | --- |
| Liste | Kopf mit Suche, Filter-Chips, gruppierte Karten, Leer-Zustand | `SpoolListPage` |
| Detail | Kopf-Karte mit Kennzahl, Aktionsleiste, Abschnitte | `SpoolDetailPage` |
| Aktions-Sheet | Titel, Objektzeile, Optionen, Bestätigen | Ins AMS, Lagerort |
| Formular | gruppierte Felder, Speichern oben rechts (iOS) bzw. unten (Android) | Spule anlegen |
| Scan | Kamerabild, Zielrahmen, Treffer als Karte | `ScanPage` |

Kern-Bausteine Stufe 1: Spulenkarte, Farbring ✅, Füllbalken ✅, Material-Badge ✅, Status-Badge ✅,
Kennzahl-Kachel, Abschnittskopf, Objektzeile, Leer-/Fehler-/Offline-Hinweis ✅, Etikett-Vorschau.

## UI-Regeln
1. Farben, Schrift, Abstände, Radien nur über Tokens; keine festen Werte im Modul.
2. Neue Bausteine entstehen in `core/ui` (+ Storybook), nicht im Modul.
3. Jede Seite nutzt eine der fünf Vorlagen.
4. Plattformunterschiede in der Bedienung regelt Ionic bzw. `core/ui`, nie das Modul.
5. Jeder Steckbrief enthält eine Skizze (Vorlage + Bausteine), bevor gebaut wird.
6. Abnahme jeder Seite auf iPhone (hell + dunkel), Android-Größe und Desktop-Breite.

## Bausteine und Regeln (Stand 12.10.2026)

| Baustein (`src/core/ui`) | Wofür |
| --- | --- |
| `EditSheet` | jede Eingabe/Bearbeitung: Handy Blatt von unten, ab 768 px mittiger Dialog; Kopf Abbrechen · Titel · Speichern |
| `FieldRow`, `NumberInput`, `RangeInput`, `TextRow` | Formularzeilen mit Symbol (Statusfarbe), Beschriftung, Hinweis und Einheit |
| `MetaChip` | kleine Werte mit Symbol in Listenzeilen (🌡 45–55 °C · ⏱ 4–8 h · 🔔 alle 30 Tage) |
| `StatTile` | Kennzahl mit Symbol, Statusfarbe, optional Link |
| `ColorRing` | **nur** Filamentfarbe (Spulen-Symbol mit Nabe) – nie Status |
| `FillBar` | **nur** Füllstand in Statusfarbe: grün ok · gelb niedrig · rot fast leer (≤ 5 %) |
| `ChoiceChip` in `.bs-chip-row` | wischbare Filter-/Auswahlreihen |
| `useMediaQuery`, `SPLIT_QUERY` | Breitenstufen; ab 1000 px Liste links + Detail rechts |

Regeln:
- Kein `IonAlert` mit Eingabefeldern (iOS zeigt dort keine Beschriftungen) – nur für Ja/Nein-Rückfragen.
- Farbe des Filaments und Status nie vermischen (siehe ColorRing/FillBar).
- Statusfarben nur aus Tokens (`--bs-good`, `--bs-warn`, `--bs-critical`), Akzent für Aktionen.
- Jede Seite hell + dunkel, Handy/Tablet (hoch + quer)/Desktop prüfen. Breite über `--bs-page-max`, `.bs-medium`, `.bs-wide`, `.bs-card-grid`, Container-Abfragen (`.bs-detail`).
- Werte, die man anpassen will, per Oberfläche pflegbar (Server `/prefs/<bereich>`), Datei nur als Startwerte.
