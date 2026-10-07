import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiFetch } from '../api/client'
import RoomCard from '../components/RoomCard'
import type { Room } from '../types'
import './FreeRoomsPage.css'

const OFFICE_TIME_ZONE = 'Europe/Berlin'
const MAX_DURATION_MINUTES = 8 * 60
const MIN_SEATS = 1
const MAX_SEATS = 999

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function officeParts(base: Date): { date: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: OFFICE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(base)
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

function nextFullHourInput(now: Date = new Date()): string {
  const { date, hour, minute } = officeParts(now)
  if (minute === 0) {
    return `${date}T${pad(hour)}:00`
  }
  if (hour < 23) {
    return `${date}T${pad(hour + 1)}:00`
  }
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return `${next.toISOString().slice(0, 10)}T00:00`
}

function localToWallMs(local: string): number {
  const [datePart, timePart] = local.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  return Date.UTC(year, month - 1, day, hour, minute)
}

function wallMsToLocal(ms: number): string {
  const date = new Date(ms)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate(),
  )}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

function addHourInput(local: string): string {
  return wallMsToLocal(localToWallMs(local) + 60 * 60 * 1000)
}

/** Splits a wall-clock `YYYY-MM-DDTHH:mm` value into its date and time parts. */
function splitLocal(local: string): { date: string; time: string } {
  const [date = '', time = ''] = local.split('T')
  return { date, time: time.slice(0, 5) }
}

/** Renders a `YYYY-MM-DD` day as the office format 'Mi, 11.03.2026'. */
function formatDateLabel(datePart: string): string {
  const [year, month, day] = datePart.split('-').map(Number)
  if (!year || !month || !day) return ''
  const noon = new Date(Date.UTC(year, month - 1, day, 12))
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

function officeOffsetMinutes(instant: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: OFFICE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return (asUtc - instant.getTime()) / 60000
}

/** Converts an office wall-clock `datetime-local` value into a tz-aware ISO-8601 string. */
function toOfficeIso(local: string): string {
  const wallUtc = localToWallMs(local)
  const firstGuess = wallUtc - officeOffsetMinutes(new Date(wallUtc)) * 60000
  const secondGuess = wallUtc - officeOffsetMinutes(new Date(firstGuess)) * 60000
  return new Date(secondGuess).toISOString()
}

function clampSeats(value: number): number {
  if (Number.isNaN(value)) return MIN_SEATS
  return Math.min(MAX_SEATS, Math.max(MIN_SEATS, Math.trunc(value)))
}

interface FormErrors {
  start?: string
  end?: string
}

function validate(start: string, end: string): FormErrors {
  const errors: FormErrors = {}
  if (!start) errors.start = 'Bitte gib einen Beginn an.'
  if (!end) errors.end = 'Bitte gib ein Ende an.'
  if (start && end) {
    const startMs = localToWallMs(start)
    const endMs = localToWallMs(end)
    if (endMs <= startMs) {
      errors.end = 'Das Ende muss nach dem Beginn liegen.'
    } else if (endMs - startMs > MAX_DURATION_MINUTES * 60000) {
      errors.end = 'Eine Buchung darf höchstens 8 Stunden dauern.'
    }
  }
  return errors
}

type SearchStatus = 'idle' | 'loading' | 'success' | 'error'

interface ExecutedSearch {
  start: string
  end: string
}

function AlertIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      className="free-rooms__empty-icon"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
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

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

interface DateTimeFieldProps {
  id: string
  label: string
  value: string
  onChange(next: string): void
  onBlur(): void
  error?: string
  showError: boolean
}

/**
 * DESIGN.md DateTimeField shell. The visible date is always the office format
 * ('Mi, 11.03.2026') and the time is a zero-padded 24h value ('09:00'), so the
 * browser's locale-driven US formatting is never shown. A native date/time picker
 * is opened from each segment; the user-entered German-formatted value stays.
 */
function DateTimeField({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  showError,
}: DateTimeFieldProps) {
  const dateRef = useRef<HTMLInputElement>(null)
  const timeRef = useRef<HTMLInputElement>(null)
  const { date, time } = splitLocal(value)
  const errorId = `${id}-error`

  function openPicker(ref: React.RefObject<HTMLInputElement | null>): void {
    const input = ref.current
    if (!input) return
    if (typeof input.showPicker === 'function') {
      try {
        input.showPicker()
        return
      } catch {
        // Not allowed in this context — fall back to focusing the native control.
      }
    }
    input.focus()
  }

  return (
    <div className="form-field free-rooms__field free-rooms__field--grow">
      <span className="form-field__label">{label}</span>
      <div
        className="free-rooms__dt"
        role="group"
        aria-label={label}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            onBlur()
          }
        }}
      >
        <button
          type="button"
          className="free-rooms__dt-segment"
          onClick={() => openPicker(dateRef)}
          aria-label={`${label}: ${formatDateLabel(date)} (Datum ändern)`}
        >
          <CalendarIcon />
          <span className="free-rooms__dt-value" data-testid={`${id}-date`}>
            {formatDateLabel(date)}
          </span>
        </button>
        <span className="free-rooms__dt-divider" aria-hidden="true" />
        <button
          type="button"
          className="free-rooms__dt-segment"
          onClick={() => openPicker(timeRef)}
          aria-label={`${label}: ${time} (Uhrzeit ändern)`}
        >
          <ClockIcon />
          <span
            className="free-rooms__dt-value free-rooms__dt-value--time"
            data-testid={`${id}-time`}
          >
            {time}
          </span>
        </button>
        <input
          ref={dateRef}
          type="date"
          className="free-rooms__dt-native"
          value={date}
          tabIndex={-1}
          aria-hidden="true"
          data-testid={`${id}-date-input`}
          onChange={(event) => {
            const next = event.target.value
            if (next) onChange(`${next}T${time}`)
          }}
        />
        <input
          ref={timeRef}
          type="time"
          className="free-rooms__dt-native"
          value={time}
          tabIndex={-1}
          aria-hidden="true"
          data-testid={`${id}-time-input`}
          onChange={(event) => {
            const next = event.target.value
            if (next) onChange(`${date}T${next}`)
          }}
        />
      </div>
      {showError && error ? (
        <span className="form-field__message form-field__message--error" id={errorId}>
          <AlertIcon />
          {error}
        </span>
      ) : null}
    </div>
  )
}

export default function FreeRoomsPage() {
  const [start, setStart] = useState<string>(() => nextFullHourInput())
  const [end, setEnd] = useState<string>(() => addHourInput(nextFullHourInput()))
  const [minSeats, setMinSeats] = useState<number>(2)
  const [touched, setTouched] = useState<{ start: boolean; end: boolean }>({
    start: false,
    end: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [status, setStatus] = useState<SearchStatus>('idle')
  const [rooms, setRooms] = useState<Room[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState<ExecutedSearch | null>(null)

  const resultsRef = useRef<HTMLElement | null>(null)

  const errors = useMemo(() => validate(start, end), [start, end])
  const showStartError = (touched.start || submitted) && Boolean(errors.start)
  const showEndError = (touched.end || submitted) && Boolean(errors.end)

  useEffect(() => {
    if (status === 'success') {
      resultsRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    }
  }, [status])

  async function runSearch(): Promise<void> {
    const startIso = toOfficeIso(start)
    const endIso = toOfficeIso(end)
    const params = new URLSearchParams({
      start: startIso,
      end: endIso,
      min_seats: String(minSeats),
    })
    setStatus('loading')
    setError(null)
    try {
      const result = await apiFetch<Room[]>(`/free-rooms?${params.toString()}`)
      setRooms(Array.isArray(result) ? result : [])
      setSearch({ start: startIso, end: endIso })
      setStatus('success')
    } catch (caught) {
      setRooms([])
      setError(caught instanceof ApiError ? caught.message : 'Die Suche ist fehlgeschlagen.')
      setStatus('error')
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    setSubmitted(true)
    setTouched({ start: true, end: true })
    if (errors.start || errors.end) return
    void runSearch()
  }

  function handleSeatsInput(raw: string): void {
    if (raw === '') {
      setMinSeats(MIN_SEATS)
      return
    }
    setMinSeats(clampSeats(Number.parseInt(raw, 10)))
  }

  function setSeats(next: number): void {
    setMinSeats(clampSeats(next))
  }

  function bookHref(room: Room): string {
    const params = new URLSearchParams({ roomId: String(room.id) })
    if (search) {
      params.set('start', search.start)
      params.set('end', search.end)
    }
    return `/book?${params.toString()}`
  }

  const resultLabel =
    rooms.length === 1 ? '1 Raum' : `${rooms.length} Räume`

  return (
    <section className="free-rooms" aria-labelledby="free-rooms-title">
      <h1 id="free-rooms-title" className="free-rooms__title">
        Freie Räume
      </h1>
      <p className="free-rooms__subtitle">
        Zeitraum und Mindestplatzanzahl wählen, um freie Räume zu finden.
      </p>

      <section className="free-rooms__section" aria-label="Suchformular">
        <form id="free-rooms-form" noValidate onSubmit={handleSubmit}>
          <div className="free-rooms__search-row">
            <DateTimeField
              id="free-rooms-start"
              label="Beginn"
              value={start}
              onChange={setStart}
              onBlur={() => setTouched((prev) => ({ ...prev, start: true }))}
              error={errors.start}
              showError={showStartError}
            />

            <DateTimeField
              id="free-rooms-end"
              label="Ende"
              value={end}
              onChange={setEnd}
              onBlur={() => setTouched((prev) => ({ ...prev, end: true }))}
              error={errors.end}
              showError={showEndError}
            />

            <div className="form-field free-rooms__field free-rooms__field--fixed">
              <label className="form-field__label" htmlFor="free-rooms-seats">
                Mindestzahl Plätze
              </label>
              <div className="free-rooms__stepper">
                <button
                  type="button"
                  className="free-rooms__stepper-btn"
                  aria-label="Plätze verringern"
                  onClick={() => setSeats(minSeats - 1)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <input
                  id="free-rooms-seats"
                  className="free-rooms__stepper-input"
                  type="number"
                  min={MIN_SEATS}
                  max={MAX_SEATS}
                  step={1}
                  inputMode="numeric"
                  value={minSeats}
                  aria-label="Mindestzahl Plätze"
                  onChange={(event) => handleSeatsInput(event.target.value)}
                />
                <button
                  type="button"
                  className="free-rooms__stepper-btn"
                  aria-label="Plätze erhöhen"
                  onClick={() => setSeats(minSeats + 1)}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="form-field free-rooms__field free-rooms__field--fixed">
              <button
                type="submit"
                className="button button--primary free-rooms__submit"
                disabled={status === 'loading'}
                aria-label="Freie Räume suchen"
              >
                {status === 'loading' ? (
                  <span className="free-rooms__spinner" aria-hidden="true" />
                ) : (
                  'Freie Räume suchen'
                )}
              </button>
            </div>
          </div>

          <p className="free-rooms__hint">Zeiten in der Büro-Zeitzone (Europe/Berlin)</p>
        </form>
      </section>

      <section
        className="free-rooms__section"
        id="free-rooms-results"
        ref={resultsRef}
        aria-label="Suchergebnisse"
      >
        {status !== 'idle' ? (
          <h2 className="free-rooms__results-title">Freie Räume</h2>
        ) : null}

        {status === 'loading' ? (
          <div className="free-rooms__grid" aria-busy="true" aria-label="Suche läuft">
            <div className="free-rooms__skeleton" />
            <div className="free-rooms__skeleton" />
            <div className="free-rooms__skeleton" />
          </div>
        ) : null}

        {status === 'error' && error ? (
          <div className="free-rooms__error" role="alert">
            <div className="error-banner">
              <p className="error-banner__title">Suche nicht möglich</p>
              <p className="error-banner__message">{error}</p>
            </div>
            <button
              type="button"
              className="button button--secondary free-rooms__retry"
              onClick={() => void runSearch()}
            >
              Erneut versuchen
            </button>
          </div>
        ) : null}

        {status === 'success' ? (
          <>
            <p className="free-rooms__result-count" aria-live="polite">
              {resultLabel}
            </p>
            {rooms.length === 0 ? (
              <div className="empty-state">
                <SearchIcon />
                <p className="empty-state__title">Keine freien Räume gefunden</p>
                <p className="empty-state__body">
                  Für den gewählten Zeitraum und die Mindestplatzanzahl ist kein Raum frei.
                </p>
              </div>
            ) : (
              <div className="free-rooms__grid">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    action={
                      <>
                        <span className="free-rooms__badge">Frei</span>
                        <Link className="button button--primary" to={bookHref(room)}>
                          Buchen
                        </Link>
                      </>
                    }
                  />
                ))}
              </div>
            )}
          </>
        ) : null}
      </section>
    </section>
  )
}
