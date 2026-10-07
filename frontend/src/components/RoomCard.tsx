import type { ReactNode } from 'react'
import type { Room } from '../types'

export interface RoomCardProps {
  room: Room
  action?: ReactNode
}

function UsersIcon() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export default function RoomCard({ room, action }: RoomCardProps) {
  const seatsLabel = `${room.seats} ${room.seats === 1 ? 'Platz' : 'Plätze'}`

  return (
    <article className="room-card">
      <h3 className="room-card__name">{room.name}</h3>
      <p className="room-card__seats">
        <UsersIcon />
        <span>{seatsLabel}</span>
      </p>
      {room.amenities.length > 0 ? (
        <ul className="room-card__amenities" aria-label="Ausstattung">
          {room.amenities.map((amenity) => (
            <li key={amenity} className="amenity-tag">
              {amenity}
            </li>
          ))}
        </ul>
      ) : (
        <p className="room-card__empty">Keine Ausstattung angegeben</p>
      )}
      {action ? <div className="room-card__actions">{action}</div> : null}
    </article>
  )
}
