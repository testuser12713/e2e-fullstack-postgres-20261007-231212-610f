import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError, apiFetch } from '../api/client'
import type { Booking, Room } from '../types'
import './BookingFormPage.css'

const OFFICE_TZ = 'Europe/Berlin'
const MAX_DURATION_MINUTES = 8 * 60
const SUCCESS_REDIRECT_MS = 600
const TIMEZONE_HINT = 'Zeiten in der Büro-Zeitzone (Europe/Berlin)'

type FieldKey = 'room' | 'bookedBy' | 'title' | 'start' | 'end'
type FieldErrors = Record<FieldKey, string | null>

interface BannerState {
  variant: 'error' | 'success'
  title: string
  message: string
  fields: Record<string, string> | null
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function zonedParts(date: Date): Record<string, number> {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts: Record<string, number> = {}
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value)
    }
  }
  return parts
}

function officeOffsetMinutes(date: Date): number {
  const parts = zonedParts(date)
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  )
  const flooredSeconds = Math.floor(date.getTime() / 1000) * 1000
  return Math.round((asUTC - flooredSeconds) / 60000)
}

function dateToOfficeInput(date: Date): string {
  const parts = zonedParts(date)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

/** Converts a timezone-aware ISO string into a datetime-local value in the office timezone. */
function isoToOfficeInput(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return dateToOfficeInput(date)
}

/** Converts a datetime-local value (office wall time) into a timezone-aware ISO string. */
function officeInputToIso(value: string): string | null {
  if (!value) return null
  const asUTC = new Date(`${value}:00Z`)
  if (Number.isNaN(asUTC.getTime())) return null
  let offset = officeOffsetMinutes(asUTC)
  let instant = new Date(asUTC.getTime() - offset * 60000)
  const offsetAtInstant = officeOffsetMinutes(instant)
  if (offsetAtInstant !== offset) {
    offset = offsetAtInstant
    instant = new Date(asUTC.getTime() - offset * 60000)
  }
  return instant.toISOString()
}

function officeDayFromInput(value: string): string | null {
  const iso = officeInputToIso(value)
  if (!iso) return null
  const parts = zonedParts(new Date(iso))
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

function roomOptionLabel(room: Room): string {
  const seats = `${room.seats} ${room.seats === 1 ? 'Platz' : 'Plätze'}`
  const amenities = room.amenities.length > 0 ? ` · ${room.amenities.join(', ')}` : ''
  return `${room.name} · ${seats}${amenities}`
}

function computeErrors(values: {
  roomId: string
  bookedBy: string
  title: string
  start: string
  end: string
}): FieldErrors {
  const errors: FieldErrors = { room: null, bookedBy: null, title: null, start: null, end: null }

  if (!values.roomId) errors.room = 'Bitte wähle einen Raum.'
  if (!values.bookedBy.trim()) errors.bookedBy = 'Bitte gib an, wer den Raum bucht.'
  if (!values.title.trim()) errors.title = 'Bitte gib einen Titel an.'
  if (!values.start) errors.start = 'Bitte gib einen Beginn an.'

  if (!values.end) {
    errors.end = 'Bitte gib ein Ende an.'
  } else if (values.start) {
    const startIso = officeInputToIso(values.start)
    const endIso = officeInputToIso(values.end)
    if (startIso && endIso) {
      const minutes = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
      if (minutes <= 0) {
        errors.end = 'Das Ende muss nach dem Beginn liegen.'
      } else if (minutes > MAX_DURATION_MINUTES) {
        errors.end = 'Eine Buchung darf höchstens 8 Stunden dauern.'
      }
    }
  }

  return errors
}

function AlertIcon() {
  return (
    <svg
      className="booking-field__icon"
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

function SuccessIcon() {
  return (
    <svg
      className="booking-banner__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

interface FieldMessageProps {
  id: string
  message: string | null
}

function FieldMessage({ id, message }: FieldMessageProps) {
  if (!message) return null
  return (
    <span className="booking-field__message" id={id}>
      <AlertIcon />
      <span>{message}</span>
    </span>
  )
}

export default function BookingFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const bookingId = searchParams.get('bookingId')
  const isEdit = bookingId !== null

  const [roomId, setRoomId] = useState(() => searchParams.get('roomId') ?? '')
  const [bookedBy, setBookedBy] = useState('')
  const [title, setTitle] = useState('')
  const [start, setStart] = useState(() => isoToOfficeInput(searchParams.get('start')) ?? '')
  const [end, setEnd] = useState(() => isoToOfficeInput(searchParams.get('end')) ?? '')

  const [touched, setTouched] = useState<Record<FieldKey, boolean>>({
    room: false,
    bookedBy: false,
    title: false,
    start: false,
    end: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [banner, setBanner] = useState<BannerState | null>(null)

  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsError, setRoomsError] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(Boolean(bookingId))
  const [editError, setEditError] = useState<string | null>(null)

  const dirtyRef = useRef(false)
  const bannerRef = useRef<HTMLDivElement | null>(null)
  const redirectTimer = useRef<number | null>(null)

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true)
    setRoomsError(null)
    try {
      const data = await apiFetch<Room[]>('/rooms')
      setRooms(Array.isArray(data) ? data : [])
    } catch (error) {
      setRooms([])
      setRoomsError(
        error instanceof ApiError ? error.message : 'Die Räume konnten nicht geladen werden.',
      )
    } finally {
      setRoomsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRooms()
  }, [loadRooms])

  useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    setEditLoading(true)
    setEditError(null)
    apiFetch<Booking>(`/bookings/${bookingId}`)
      .then((booking) => {
        if (cancelled) return
        setRoomId(String(booking.room_id))
        setBookedBy(booking.booked_by)
        setTitle(booking.title)
        setStart(isoToOfficeInput(booking.start) ?? '')
        setEnd(isoToOfficeInput(booking.end) ?? '')
      })
      .catch((error) => {
        if (cancelled) return
        setEditError(
          error instanceof ApiError ? error.message : 'Die Buchung konnte nicht geladen werden.',
        )
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bookingId])

  useEffect(() => {
    if (banner) bannerRef.current?.focus()
  }, [banner])

  const closeSheet = useCallback(() => {
    if (dirtyRef.current) {
      let proceed = true
      try {
        proceed = window.confirm('Änderungen verwerfen?')
      } catch {
        proceed = true
      }
      if (!proceed) return
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/rooms')
    }
  }, [navigate])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeSheet()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeSheet])

  useEffect(
    () => () => {
      if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current)
    },
    [],
  )

  const errors = useMemo(
    () => computeErrors({ roomId, bookedBy, title, start, end }),
    [roomId, bookedBy, title, start, end],
  )
  const hasErrors = (Object.keys(errors) as FieldKey[]).some((key) => errors[key] !== null)

  const visibleError = (field: FieldKey): string | null =>
    submitted || touched[field] ? errors[field] : null

  const markTouched = (field: FieldKey) =>
    setTouched((previous) => (previous[field] ? previous : { ...previous, [field]: true }))

  const markDirty = () => {
    dirtyRef.current = true
  }

  function handleRoomChange(event: ChangeEvent<HTMLSelectElement>) {
    setRoomId(event.target.value)
    markTouched('room')
    markDirty()
  }

  function handleBookedByChange(event: ChangeEvent<HTMLInputElement>) {
    setBookedBy(event.target.value)
    markDirty()
  }

  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    setTitle(event.target.value)
    markDirty()
  }

  function handleStartChange(event: ChangeEvent<HTMLInputElement>) {
    setStart(event.target.value)
    markTouched('start')
    markDirty()
  }

  function handleEndChange(event: ChangeEvent<HTMLInputElement>) {
    setEnd(event.target.value)
    markTouched('end')
    markDirty()
  }

  function applyQuickFill() {
    const now = new Date()
    const nextHour = new Date(now)
    nextHour.setMinutes(0, 0, 0)
    nextHour.setHours(nextHour.getHours() + 1)
    const plusOneHour = new Date(nextHour.getTime() + 60 * 60000)
    setStart(dateToOfficeInput(nextHour))
    setEnd(dateToOfficeInput(plusOneHour))
    markTouched('start')
    markTouched('end')
    markDirty()
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saved) return
    setSubmitted(true)
    setBanner(null)
    if (redirectTimer.current !== null) {
      window.clearTimeout(redirectTimer.current)
      redirectTimer.current = null
    }
    if (hasErrors) return

    const startIso = officeInputToIso(start)
    const endIso = officeInputToIso(end)
    if (!startIso || !endIso) {
      setBanner({
        variant: 'error',
        title: 'Buchung nicht möglich',
        message: 'Bitte prüfe Beginn und Ende.',
        fields: null,
      })
      return
    }

    setSubmitting(true)
    const payload = {
      room_id: Number(roomId),
      booked_by: bookedBy.trim(),
      title: title.trim(),
      start: startIso,
      end: endIso,
    }

    try {
      if (isEdit && bookingId) {
        await apiFetch<Booking>(`/bookings/${bookingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        })
      } else {
        await apiFetch<Booking>('/bookings', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      }
      dirtyRef.current = false
      setSaved(true)
      setBanner({
        variant: 'success',
        title: isEdit ? 'Buchung aktualisiert' : 'Buchung gespeichert',
        message: isEdit
          ? 'Die Änderungen wurden gespeichert und erscheinen in der Tagesansicht des Raums.'
          : 'Die Buchung wurde angelegt und erscheint in der Tagesansicht des Raums.',
        fields: null,
      })
      const day = officeDayFromInput(start)
      redirectTimer.current = window.setTimeout(() => {
        navigate(`/rooms/${roomId}${day ? `?date=${day}` : ''}`)
      }, SUCCESS_REDIRECT_MS)
    } catch (error) {
      setBanner({
        variant: 'error',
        title: 'Buchung nicht möglich',
        message:
          error instanceof ApiError
            ? error.message
            : 'Die Buchung konnte nicht gespeichert werden.',
        fields: error instanceof ApiError ? error.fields : null,
      })
    } finally {
      setSubmitting(false)
    }
  }

  const roomsUnavailable = roomsLoading || roomsError !== null
  const saveDisabled = submitting || saved || roomsUnavailable || editLoading

  return (
    <>
      <div className="booking-backdrop" onClick={closeSheet} aria-hidden="true" />
      <section
        className="booking-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-sheet-title"
      >
        <header className="booking-sheet__header">
          <h2 className="booking-sheet__title" id="booking-sheet-title">
            {isEdit ? 'Buchung bearbeiten' : 'Buchung'}
          </h2>
          <button
            type="button"
            className="booking-icon-btn"
            aria-label="Schließen"
            onClick={closeSheet}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="booking-sheet__body">
          {banner ? (
            <div
              className={`booking-banner booking-banner--${banner.variant}`}
              role={banner.variant === 'error' ? 'alert' : 'status'}
              tabIndex={-1}
              ref={bannerRef}
            >
              <span className="booking-banner__icon-wrap">
                {banner.variant === 'error' ? <AlertIcon /> : <SuccessIcon />}
              </span>
              <div className="booking-banner__body">
                <p className="booking-banner__title">{banner.title}</p>
                <p className="booking-banner__message">{banner.message}</p>
                {banner.fields ? (
                  <ul className="booking-banner__fields">
                    {Object.entries(banner.fields).map(([field, message]) => (
                      <li key={field}>
                        <span className="booking-banner__field-key">{field}:</span> {message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <button
                type="button"
                className="booking-icon-btn booking-banner__dismiss"
                aria-label="Meldung schließen"
                onClick={() => setBanner(null)}
              >
                <CloseIcon />
              </button>
            </div>
          ) : null}

          {roomsError ? (
            <div className="booking-banner booking-banner--error" role="alert">
              <span className="booking-banner__icon-wrap">
                <AlertIcon />
              </span>
              <div className="booking-banner__body">
                <p className="booking-banner__title">Räume nicht verfügbar</p>
                <p className="booking-banner__message">{roomsError}</p>
                <button
                  type="button"
                  className="booking-btn booking-btn--secondary booking-btn--compact"
                  onClick={() => void loadRooms()}
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          ) : null}

          {editError ? (
            <div className="booking-banner booking-banner--error" role="alert">
              <span className="booking-banner__icon-wrap">
                <AlertIcon />
              </span>
              <div className="booking-banner__body">
                <p className="booking-banner__title">Buchung nicht verfügbar</p>
                <p className="booking-banner__message">{editError}</p>
              </div>
            </div>
          ) : null}

          <form id="booking-form" className="booking-form" noValidate onSubmit={handleSubmit}>
            <div className="booking-field">
              <label className="booking-field__label" htmlFor="room">
                Raum
              </label>
              <select
                id="room"
                className={
                  visibleError('room') ? 'booking-control booking-control--invalid' : 'booking-control'
                }
                value={roomId}
                disabled={roomsUnavailable || editLoading}
                aria-invalid={visibleError('room') ? true : undefined}
                aria-describedby={visibleError('room') ? 'booking-msg-room' : undefined}
                onChange={handleRoomChange}
                onBlur={() => markTouched('room')}
              >
                <option value="">
                  {roomsLoading
                    ? 'Räume werden geladen …'
                    : roomsError
                      ? 'Räume nicht verfügbar'
                      : 'Bitte wählen'}
                </option>
                {rooms.map((room) => (
                  <option key={room.id} value={String(room.id)}>
                    {roomOptionLabel(room)}
                  </option>
                ))}
              </select>
              <FieldMessage id="booking-msg-room" message={visibleError('room')} />
            </div>

            <div className="booking-field">
              <label className="booking-field__label" htmlFor="booked-by">
                Gebucht von
              </label>
              <input
                id="booked-by"
                className={
                  visibleError('bookedBy')
                    ? 'booking-control booking-control--invalid'
                    : 'booking-control'
                }
                type="text"
                value={bookedBy}
                placeholder="z. B. Anna Müller"
                autoComplete="name"
                disabled={editLoading}
                aria-invalid={visibleError('bookedBy') ? true : undefined}
                aria-describedby={visibleError('bookedBy') ? 'booking-msg-booked-by' : undefined}
                onChange={handleBookedByChange}
                onBlur={() => markTouched('bookedBy')}
              />
              <FieldMessage id="booking-msg-booked-by" message={visibleError('bookedBy')} />
            </div>

            <div className="booking-field">
              <label className="booking-field__label" htmlFor="title">
                Titel
              </label>
              <input
                id="title"
                className={
                  visibleError('title')
                    ? 'booking-control booking-control--invalid'
                    : 'booking-control'
                }
                type="text"
                value={title}
                placeholder="z. B. Sprint Planning"
                disabled={editLoading}
                aria-invalid={visibleError('title') ? true : undefined}
                aria-describedby={visibleError('title') ? 'booking-msg-title' : undefined}
                onChange={handleTitleChange}
                onBlur={() => markTouched('title')}
              />
              <FieldMessage id="booking-msg-title" message={visibleError('title')} />
            </div>

            <div className="booking-datetime-pair">
              <div className="booking-field">
                <label className="booking-field__label" htmlFor="start">
                  Beginn
                </label>
                <input
                  id="start"
                  className={
                    visibleError('start')
                      ? 'booking-control booking-control--invalid'
                      : 'booking-control'
                  }
                  type="datetime-local"
                  value={start}
                  disabled={editLoading}
                  aria-invalid={visibleError('start') ? true : undefined}
                  aria-describedby={visibleError('start') ? 'booking-msg-start' : undefined}
                  onChange={handleStartChange}
                  onBlur={() => markTouched('start')}
                />
                <FieldMessage id="booking-msg-start" message={visibleError('start')} />
              </div>

              <div className="booking-field">
                <label className="booking-field__label" htmlFor="end">
                  Ende
                </label>
                <input
                  id="end"
                  className={
                    visibleError('end')
                      ? 'booking-control booking-control--invalid'
                      : 'booking-control'
                  }
                  type="datetime-local"
                  value={end}
                  disabled={editLoading}
                  aria-invalid={visibleError('end') ? true : undefined}
                  aria-describedby={visibleError('end') ? 'booking-msg-end' : undefined}
                  onChange={handleEndChange}
                  onBlur={() => markTouched('end')}
                />
                <FieldMessage id="booking-msg-end" message={visibleError('end')} />
              </div>
            </div>

            <div className="booking-quick-fill">
              <button type="button" className="booking-chip" onClick={applyQuickFill}>
                Heute
              </button>
            </div>

            <p className="booking-hint">{TIMEZONE_HINT}</p>
          </form>
        </div>

        <footer className="booking-sheet__footer">
          <button
            type="button"
            className="booking-btn booking-btn--secondary"
            onClick={closeSheet}
          >
            Abbrechen
          </button>
          <button
            type="submit"
            form="booking-form"
            className="booking-btn booking-btn--primary"
            disabled={saveDisabled}
            aria-busy={submitting || undefined}
          >
            {submitting ? <span className="booking-spinner" aria-hidden="true" /> : null}
            <span
              className={
                submitting ? 'booking-btn__label booking-btn__label--hidden' : 'booking-btn__label'
              }
            >
              Buchung speichern
            </span>
          </button>
        </footer>
      </section>
    </>
  )
}
