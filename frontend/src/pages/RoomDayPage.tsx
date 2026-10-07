import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, apiFetch } from '../api/client'
import type { Booking, Room } from '../types'
import './RoomDayPage.css'

const OFFICE_TIME_ZONE = 'Europe/Berlin'
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function officeDateTimeParts(date: Date): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const map: Record<string, number> = {}
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = Number(part.value)
    }
  }
  return map
}

function todayInOffice(): string {
  const parts = officeDateTimeParts(new Date())
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function addDays(day: string, delta: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1, date))
  shifted.setUTCDate(shifted.getUTCDate() + delta)
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`
}

function formatDayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const noon = new Date(Date.UTC(year, month - 1, date, 12))
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(noon)
    .replace('.', '')
}

function formatTime(iso: string): string {
  const instant = new Date(iso)
  if (Number.isNaN(instant.getTime())) {
    return iso
  }
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: OFFICE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(instant)
}

function formatDuration(startIso: string, endIso: string): string {
  const milliseconds = new Date(endIso).getTime() - new Date(startIso).getTime()
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
    return ''
  }
  const totalMinutes = Math.round(milliseconds / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes} Min.`
  }
  if (minutes === 0) {
    return `${hours} Std.`
  }
  return `${hours} Std. ${minutes} Min.`
}

function officeOffsetMinutes(instant: Date): number {
  const parts = officeDateTimeParts(instant)
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour % 24,
    parts.minute,
    parts.second,
  )
  const truncated = Math.floor(instant.getTime() / 1000) * 1000
  return Math.round((asUtc - truncated) / 60000)
}

function officeWallClockToDate(day: string, hour: number): Date {
  const [year, month, date] = day.split('-').map(Number)
  const naive = new Date(Date.UTC(year, month - 1, date, hour, 0, 0))
  return new Date(naive.getTime() - officeOffsetMinutes(naive) * 60000)
}

/** Start of the prefilled booking: next full hour today, else 09:00 of that day. */
function bookingPrefill(day: string): { start: string; end: string } {
  let startMs: number
  if (day === todayInOffice()) {
    const now = new Date()
    const minute = officeDateTimeParts(now).minute
    const truncated = now.getTime() - (now.getTime() % 60000)
    startMs = truncated + (60 - minute) * 60000
  } else {
    startMs = officeWallClockToDate(day, 9).getTime()
  }
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + 60 * 60000).toISOString(),
  }
}

function isLocked(booking: Booking): boolean {
  const start = new Date(booking.start).getTime()
  return Number.isFinite(start) && start < Date.now()
}

function LockIcon() {
  return (
    <svg
      className="booking-list-item__lock-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      className="empty-state__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

export default function RoomDayPage() {
  const { roomId } = useParams<{ roomId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get('date')
  const date = dateParam && DAY_PATTERN.test(dateParam) ? dateParam : todayInOffice()

  const [room, setRoom] = useState<Room | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!roomId) {
      setStatus('error')
      setErrorMessage('Der Raum wurde nicht gefunden.')
      return
    }

    let active = true
    setStatus('loading')
    setErrorMessage('')

    Promise.all([
      apiFetch<Room>(`/rooms/${roomId}`),
      apiFetch<Booking[]>(`/rooms/${roomId}/bookings?day=${encodeURIComponent(date)}`),
    ])
      .then(([roomResult, bookingResult]) => {
        if (!active) {
          return
        }
        setRoom(roomResult)
        setBookings(Array.isArray(bookingResult) ? bookingResult : [])
        setStatus('ready')
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }
        const message =
          error instanceof ApiError
            ? error.message
            : 'Die Buchungen konnten nicht geladen werden.'
        setErrorMessage(message)
        setStatus('error')
      })

    return () => {
      active = false
    }
  }, [roomId, date, reloadToken])

  const goToDate = useCallback(
    (next: string) => {
      setSearchParams({ date: next })
    },
    [setSearchParams],
  )

  const sortedBookings = [...bookings].sort(
    (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
  )

  const roomName = room?.name ?? sortedBookings[0]?.room_name ?? 'Raum'
  const seatsLabel = room ? `${room.seats} ${room.seats === 1 ? 'Platz' : 'Plätze'}` : null
  const prefill = bookingPrefill(date)

  return (
    <section className="room-day">
      <Link
        to="/rooms"
        className="button button--ghost button--compact room-day__back"
        data-od-id="back-to-rooms"
      >
        ‹ Zurück zur Raumliste
      </Link>

      <h1 className="room-day__title" data-od-id="day-room-title">
        {roomName}
      </h1>
      <p className="room-day__subtitle" data-od-id="day-subtitle">
        Tagesansicht{seatsLabel ? <> · <span className="num">{seatsLabel}</span></> : null}
      </p>

      <section className="day-view-header" aria-label="Tag wählen" data-od-id="day-view-header">
        <div className="day-view-header__controls">
          <button
            type="button"
            className="day-view-header__nav-btn"
            aria-label="Vorheriger Tag"
            onClick={() => goToDate(addDays(date, -1))}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <span
            className="day-view-header__label"
            aria-live="polite"
            data-od-id="date-label"
          >
            {formatDayLabel(date)}
          </span>
          <button
            type="button"
            className="day-view-header__nav-btn"
            aria-label="Nächster Tag"
            onClick={() => goToDate(addDays(date, 1))}
          >
            <span aria-hidden="true">›</span>
          </button>
          <div className="day-view-header__jump-group">
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => goToDate(todayInOffice())}
            >
              Heute
            </button>
            <input
              type="date"
              className="day-view-header__jump"
              aria-label="Zu Datum springen"
              value={date}
              onChange={(event) => {
                if (DAY_PATTERN.test(event.target.value)) {
                  goToDate(event.target.value)
                }
              }}
            />
          </div>
        </div>
        <p className="day-view-header__room-line" data-od-id="day-room-line">
          <span className="day-view-header__room-name">{roomName}</span>
          <span aria-hidden="true"> · </span>
          <span>Alle Zeiten in Europe/Berlin</span>
        </p>
      </section>

      <section className="room-day__list-card" aria-label="Buchungen des Tages" data-od-id="day-list-card">
        {status === 'loading' ? (
          <div className="room-day__skeleton" aria-hidden="true" data-od-id="day-loading">
            <div className="room-day__skeleton-row" />
            <div className="room-day__skeleton-row" />
            <div className="room-day__skeleton-row" />
          </div>
        ) : null}

        {status === 'error' ? (
          <div className="room-day__error" data-od-id="day-error">
            <div className="error-banner" role="alert">
              <p className="error-banner__title">Buchungen konnten nicht geladen werden</p>
              <p className="error-banner__message">{errorMessage}</p>
            </div>
            <button
              type="button"
              className="button button--secondary button--compact"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              Erneut versuchen
            </button>
          </div>
        ) : null}

        {status === 'ready' && sortedBookings.length === 0 ? (
          <div className="empty-state" data-od-id="day-empty">
            <CalendarIcon />
            <p className="empty-state__title">Keine Buchungen an diesem Tag</p>
            <p className="empty-state__body">Dieser Raum ist am gewählten Tag noch frei.</p>
            <Link
              to={`/book?roomId=${encodeURIComponent(roomId ?? '')}&start=${encodeURIComponent(
                prefill.start,
              )}&end=${encodeURIComponent(prefill.end)}`}
              className="button button--primary"
            >
              Raum buchen
            </Link>
          </div>
        ) : null}

        {status === 'ready' && sortedBookings.length > 0 ? (
          <ul className="booking-list">
            {sortedBookings.map((booking) => {
              const locked = isLocked(booking)
              return (
                <li
                  key={booking.id}
                  className={`booking-list-item${locked ? ' is-locked' : ''}`}
                  data-od-id={`booking-item-${booking.id}`}
                >
                  <span className="booking-list-item__time">
                    {formatTime(booking.start)} – {formatTime(booking.end)}
                  </span>
                  <div className="booking-list-item__info">
                    <span className="booking-list-item__title">{booking.title}</span>
                    {locked ? (
                      <span className="booking-list-item__lock">
                        <LockIcon />
                        Bereits begonnen — nicht mehr änderbar
                      </span>
                    ) : (
                      <span className="booking-list-item__by">
                        gebucht von {booking.booked_by}
                      </span>
                    )}
                  </div>
                  <span className="booking-list-item__duration">
                    {formatDuration(booking.start, booking.end)}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </section>
  )
}
