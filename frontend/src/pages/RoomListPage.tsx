import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, apiFetch } from '../api/client'
import RoomCard from '../components/RoomCard'
import type { Room } from '../types'
import './RoomListPage.css'

/**
 * Canonical amenity vocabulary shown as filter chips (see the design mockup
 * `design/mockups/index.html`). Amenities that a loaded room carries but that
 * are not listed here are appended to the row, so every room stays filterable.
 */
const KNOWN_AMENITIES = [
  'Beamer',
  'Whiteboard',
  'Videokonferenz',
  'Konferenztelefon',
  'Flipchart',
  'Stehtisch',
  'Sofa',
  'Monitor',
  'Höhenverstellbarer Tisch',
  'Telefon',
]

type LoadStatus = 'loading' | 'ready' | 'error'

interface FilterChipProps {
  label: string
  selected: boolean
  onSelect: () => void
}

function FilterChip({ label, selected, onSelect }: FilterChipProps) {
  return (
    <button
      type="button"
      className="filter-chip"
      aria-pressed={selected}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

interface ComingSoonButtonProps {
  label: string
  title: string
}

/** DESIGN.md's ComingSoonButton: a disabled secondary Button with a "kommt bald" suffix. */
function ComingSoonButton({ label, title }: ComingSoonButtonProps) {
  return (
    <button
      type="button"
      className="button button--secondary room-list__coming-soon"
      disabled
      title={title}
    >
      <span>{label}</span>
      <span className="coming-soon__note">kommt bald</span>
    </button>
  )
}

interface ErrorBannerProps {
  title: string
  message: string
  action?: ReactNode
}

function ErrorBanner({ title, message, action }: ErrorBannerProps) {
  return (
    <div className="error-banner" role="alert">
      <p className="error-banner__title">{title}</p>
      <p className="error-banner__message">{message}</p>
      {action ? <div className="room-list__error-action">{action}</div> : null}
    </div>
  )
}

function EmptyStateIcon() {
  return (
    <svg
      className="room-list__empty-icon"
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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

interface EmptyStateProps {
  title: string
  body: string
  action?: ReactNode
}

function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <EmptyStateIcon />
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__body">{body}</p>
      {action ? <div className="room-list__empty-action">{action}</div> : null}
    </div>
  )
}

export default function RoomListPage() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [selectedAmenity, setSelectedAmenity] = useState<string | null>(null)

  const loadRooms = useCallback(async () => {
    setStatus('loading')
    try {
      const data = await apiFetch<Room[]>('/rooms')
      setRooms(Array.isArray(data) ? data : [])
      setStatus('ready')
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError && error.message
          ? error.message
          : 'Die Räume konnten nicht geladen werden.',
      )
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    void loadRooms()
  }, [loadRooms])

  const amenityOptions = useMemo(() => {
    const seen = new Set(KNOWN_AMENITIES)
    const options = [...KNOWN_AMENITIES]
    for (const room of rooms) {
      for (const amenity of room.amenities) {
        if (!seen.has(amenity)) {
          seen.add(amenity)
          options.push(amenity)
        }
      }
    }
    return options
  }, [rooms])

  const visibleRooms = useMemo(
    () =>
      selectedAmenity === null
        ? rooms
        : rooms.filter((room) => room.amenities.includes(selectedAmenity)),
    [rooms, selectedAmenity],
  )

  const resultLabel = `${visibleRooms.length} ${visibleRooms.length === 1 ? 'Raum' : 'Räume'}`

  return (
    <section className="room-list" aria-labelledby="room-list-title">
      <div className="room-list__header">
        <div>
          <h1 id="room-list-title" className="room-list__title">
            Räume
          </h1>
          <p className="room-list__subtitle">Alle Räume des Büros auf einen Blick.</p>
        </div>
        <ComingSoonButton
          label="Raum anlegen"
          title="Das Anlegen von Räumen ist noch nicht verfügbar."
        />
      </div>

      {status === 'loading' ? (
        <div className="room-list__skeletons" aria-hidden="true">
          <div className="room-list__skeleton" />
          <div className="room-list__skeleton" />
          <div className="room-list__skeleton" />
        </div>
      ) : null}

      {status === 'error' ? (
        <ErrorBanner
          title="Räume konnten nicht geladen werden"
          message={errorMessage}
          action={
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                void loadRooms()
              }}
            >
              Erneut versuchen
            </button>
          }
        />
      ) : null}

      {status === 'ready' ? (
        <>
          <section
            className="room-list__filter"
            aria-label="Räume nach Ausstattung filtern"
          >
            <div className="amenity-filter" role="group" aria-label="Ausstattung">
              <FilterChip
                label="Alle"
                selected={selectedAmenity === null}
                onSelect={() => setSelectedAmenity(null)}
              />
              {amenityOptions.map((amenity) => (
                <FilterChip
                  key={amenity}
                  label={amenity}
                  selected={selectedAmenity === amenity}
                  onSelect={() => setSelectedAmenity(amenity)}
                />
              ))}
            </div>
            <p className="result-count" aria-live="polite">
              {resultLabel}
            </p>
          </section>

          {visibleRooms.length > 0 ? (
            <section className="room-grid" aria-label="Raumliste">
              {visibleRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  action={
                    <>
                      <Link
                        className="button button--primary"
                        to={`/book?roomId=${room.id}`}
                      >
                        Buchen
                      </Link>
                      <Link
                        className="button button--secondary"
                        to={`/rooms/${room.id}`}
                      >
                        Tag ansehen
                      </Link>
                    </>
                  }
                />
              ))}
            </section>
          ) : rooms.length === 0 ? (
            <EmptyState
              title="Noch keine Räume"
              body="Es sind noch keine Räume angelegt. Sobald Räume existieren, erscheinen sie hier."
            />
          ) : (
            <EmptyState
              title="Keine Räume mit dieser Ausstattung"
              body="Für das gewählte Merkmal gibt es keine passenden Räume."
              action={
                <button
                  type="button"
                  className="button button--secondary"
                  onClick={() => setSelectedAmenity(null)}
                >
                  Filter zurücksetzen
                </button>
              }
            />
          )}
        </>
      ) : null}
    </section>
  )
}
