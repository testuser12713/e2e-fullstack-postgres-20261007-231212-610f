# Raumbuchung – Frontend

Das Frontend der Raumbuchung für ein kleines Büro. Es ist eine
Single-Page-Anwendung auf Basis von Vite, React und TypeScript, die die
REST-API des Backends unter `/api` konsumiert. Diese Ausbaustufe liefert das
laufende Grundgerüst: das App-Gerüst mit Kopfzeile und Navigation, den
Router, den API-Client, die Typen und die Präsentationskomponente `RoomCard`.
Die fünf Seiten sind bewusst noch Platzhalter („kommt bald“) – jede wird von
einem eigenen Ticket mit Verhalten gefüllt.

## Tech-Stack

- Vite 8 + React 19 + TypeScript
- React Router (Client-Routing)
- Vitest + Testing Library (jsdom) für Tests

## Voraussetzungen

- Node.js ≥ 22.12 (getestet mit Node 24) und npm
- Für die echten Daten: das laufende Backend unter `http://localhost:8000`;
  die Vite-Entwicklungsumgebung leitet `/api` dorthin weiter.

## Installation

```bash
npm ci
```

## Entwicklung starten

```bash
npm run dev
```

Der Dev-Server läuft dann standardmäßig auf `http://localhost:5173`. Der
Pfad `/api` wird an das Backend weitergereicht; die Zieladresse kommt aus
`API_PROXY_TARGET` und fällt ohne die Variable auf `http://localhost:8000`
zurück.

## Produktions-Build

```bash
npm run build
```

Der Build schreibt die statischen Dateien nach `dist/`. Mit
`npm run preview` kann er lokal ausgeliefert werden.

## Tests und Typprüfung

```bash
npm test          # Vitest (mit --run einmalig ausführen)
npm run typecheck # tsc --noEmit
```

## Verwendung

Die Anwendung ist über folgende Routen erreichbar:

| Route | Seite | Inhalt |
| --- | --- | --- |
| `/` | Startseite | Einstieg (Platzhalter) |
| `/rooms` | Raumliste | Liste aller Räume (Platzhalter) |
| `/rooms/:roomId` | Tagesansicht | Buchungen eines Raums an einem Tag (Platzhalter) |
| `/free` | Freie Räume | Freiraumsuche (Platzhalter) |
| `/book` | Buchung | Anlegen/Bearbeiten einer Buchung (Platzhalter) |

Die Kopfzeile verlinkt „Räume“ und „Freie Räume“; das Wortzeichen
„Raumbuchung“ führt zur Startseite. Jede noch nicht implementierte Seite
zeigt den Hinweis „kommt bald“.

### API-Client

`src/api/client.ts` stellt `apiFetch<T>(path, init?)` bereit. Der Pfad ist
relativ zur API-Basis `/api`, also lädt `apiFetch<Room[]>('/rooms')` von
`/api/rooms`. Ist die Antwort kein Erfolg, wirft der Aufruf einen `ApiError`
mit `status`, `code`, `message` und `fields` gemäß dem einheitlichen
Fehlerkörper der API.

```ts
import { apiFetch } from './api/client'
import type { Room } from './types'

const rooms = await apiFetch<Room[]>('/rooms')
```

### RoomCard

`src/components/RoomCard.tsx` rendert Name, Platzzahl und
Ausstattungs-Schlagwörter eines Raums. Eine optionale `action`-Prop nimmt
beliebige Bedienelemente (z. B. einen „Buchen“-Button) unten in der Karte auf.

```tsx
<RoomCard room={room} action={<button className="button button--primary">Buchen</button>} />
```

## Feature-Umfang dieser Stufe

- App-Gerüst mit Kopfzeile, Wortzeichen und Navigation
- Routing-Tabelle für `/rooms`, `/rooms/:roomId`, `/free` und `/book`
- Design-Tokens und gemeinsame Komponenten-Klassen in `src/styles.css`
- Typen `Room` und `Booking` sowie API-Client `apiFetch` / `ApiError`
- Präsentationskomponente `RoomCard`
- Platzhalterseiten mit „kommt bald“
- Test-Gerüst (Vitest + Testing Library, jsdom) mit Shell-Test
