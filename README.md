# Raumbuchung – Büro

Eine kleine Web-Anwendung zur Verwaltung von Besprechungsräumen und deren
Buchungen. Zwei Teile arbeiten zusammen: eine REST-API mit FastAPI, Pydantic v2
und SQLAlchemy 2.0 auf PostgreSQL sowie ein Vite/React/TypeScript-Frontend, das
diese API nutzt. Räume haben einen (ohne Beachtung der Groß-/Kleinschreibung)
eindeutigen Namen, eine Sitzplatzanzahl und Ausstattungs-Schlagwörter. Buchungen
verweisen auf einen Raum und tragen „gebucht von“, Titel, Beginn und Ende.

## Tech-Stack

- **Backend:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (typisiert)
- **Datenbank:** PostgreSQL 18 (echte Instanz, kein SQLite – auch nicht in Tests)
- **Backend-Tests:** pytest + FastAPI TestClient gegen PostgreSQL
- **Frontend:** Vite + React + TypeScript
- **Zeitzonen:** zeitzonenbehaftete ISO-8601-Werte, Büro-Zeitzone per Umgebungsvariable (Standard `Europe/Berlin`)

## Installation und Start

### 1. Datenbank starten

Für eine lokale Entwicklungsumgebung startet Docker Compose dieselbe PostgreSQL,
die auch die Pipeline verwendet:

```bash
docker compose up -d
```

Das legt die Datenbank `app` mit Benutzer `app` auf Port `5432` an.

### 2. Umgebungsvariablen

| Variable | Bedeutung | Beispiel |
| --- | --- | --- |
| `DATABASE_URL` | Verbindungs-URL zur PostgreSQL-Instanz | `postgresql://app:app@localhost:5432/app` |
| `TEST_DATABASE_URL` | Datenbank für die Test-Suite (fällt auf `DATABASE_URL` zurück) | `postgresql://app:app@localhost:5432/app` |
| `OFFICE_TZ` | Zeitzone des Büros (Standard `Europe/Berlin`) | `Europe/Berlin` |

`DATABASE_URL` ist Pflicht; fehlt sie, verweigert der Server den Start und nennt
die Variable. `TEST_DATABASE_URL` und `OFFICE_TZ` sind optional.

### 3. Backend installieren und starten

```bash
cd backend
python -m pip install .
DATABASE_URL=postgresql://app:app@localhost:5432/app \
  OFFICE_TZ=Europe/Berlin \
  python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Beim Start legt die Anwendung ihr Schema selbst an (`create_all`). Ein frisch
geklonter Server ist damit sofort benutzbar – es ist keine Migration von Hand
nötig.

Ein Produktions-Build ist für das Backend nicht erforderlich: es wird direkt mit
Uvicorn gestartet (siehe oben).

## Verwendung

Die API liegt unter dem Präfix `/api` und spricht JSON. Eine kurze Prüfung, dass
der Server läuft:

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

### Fehlerformat

Jede fehlgeschlagene Anfrage – egal mit welchem Status – liefert denselben Körper:

```json
{ "code": "validation_error", "message": "…", "fields": { "name": "…" } }
```

`fields` ist nur bei Validierungsfehlern gefüllt, sonst `null`. Folgende Codes
kommen vor: `validation_error`, `not_found`, `room_name_conflict`,
`room_has_future_bookings`, `booking_overlap`, `booking_already_started`.

### Endpunkte

| Methode | Pfad | Body | Antwort |
| --- | --- | --- | --- |
| GET | `/api/health` | – | `200 {"status":"ok"}` |
| GET | `/api/rooms` | – | `200 [RoomRead]` |
| POST | `/api/rooms` | `RoomCreate` | `201 RoomRead`, `409 room_name_conflict`, `422` |
| GET | `/api/rooms/{room_id}` | – | `200 RoomRead`, `404` |
| PUT | `/api/rooms/{room_id}` | `RoomCreate` | `200 RoomRead`, `404`, `409`, `422` |
| DELETE | `/api/rooms/{room_id}` | – | `204`, `409 room_has_future_bookings`, `404` |
| GET | `/api/rooms/{room_id}/bookings?day=YYYY-MM-DD` | – | `200 [BookingRead]` aufsteigend nach Start, `404` |
| GET | `/api/free-rooms?start=ISO&end=ISO&min_seats=int` | – | `200 [RoomRead]` |
| GET | `/api/bookings?room_id=int` | – | `200 [BookingRead]` |
| POST | `/api/bookings` | `BookingCreate` | `201 BookingRead`, `409 booking_overlap`, `422` |
| GET | `/api/bookings/{booking_id}` | – | `200 BookingRead`, `404` |
| PUT | `/api/bookings/{booking_id}` | `BookingCreate` | `200 BookingRead`, `404`, `409`, `422` |
| DELETE | `/api/bookings/{booking_id}` | – | `204`, `422 booking_already_started`, `404` |

`RoomCreate` = `{ "name": string, "seats": int, "amenities": [string] }`.
`RoomRead` ergänzt `"id": int`.
`BookingCreate` = `{ "room_id": int, "booked_by": string, "title": string, "start": string, "end": string }`.
`BookingRead` ergänzt `"id": int` und `"room_name": string`.
Zeitstempel sind zeitzonenbehaftete ISO-8601-Werte; `day=YYYY-MM-DD` meint den
lokalen Bürotag gemäß `OFFICE_TZ`.

### Buchungsregeln

- Ende muss nach Beginn liegen und darf höchstens 8 Stunden auseinanderliegen
  (sonst `422`).
- Zwei Buchungen im selben Raum dürfen sich nicht überschneiden; eine Buchung, die
  genau dann beginnt, wenn eine andere endet, ist erlaubt (`409 booking_overlap`
  sonst).
- Eine bereits begonnene Buchung kann nicht mehr geändert oder gelöscht werden
  (`422 booking_already_started`).

## Tests

Voraussetzung: eine laufende PostgreSQL (siehe oben) und gesetzte
`DATABASE_URL` (oder `TEST_DATABASE_URL`).

```bash
cd backend
python -m pip install .
PYTHONPATH=. python -m pytest
```

Die Test-Suite legt ihr Schema selbst an und wieder ab. Es wird ausschließlich
gegen die echte PostgreSQL getestet – kein SQLite.

## Funktionen

- Räume anlegen, auflisten, einzeln abrufen, ändern, löschen; Name eindeutig ohne
  Beachtung der Groß-/Kleinschreibung.
- Ausstattung als Liste von Schlagwörtern, beim Ändern ersetzbar.
- Buchungen anlegen, auflisten, einzeln abrufen, ändern, löschen – mit
  Raum-Verweis und Raumname in der Antwort.
- Überschneidungsprüfung, Höchstdauer von 8 Stunden und Sperre bereits
  begonnener Buchungen.
- Tagesansicht: Buchungen eines Raums für einen Bürotag, chronologisch sortiert.
- Freiraum-Suche: Räume ohne Überschneidung im Zeitraum mit Mindest-Sitzplätzen.
- Einheitlicher Fehlerkörper für jede fehlgeschlagene Anfrage.
