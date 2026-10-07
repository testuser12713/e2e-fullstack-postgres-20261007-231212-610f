export interface Room {
  id: number
  name: string
  seats: number
  amenities: string[]
}

export interface Booking {
  id: number
  room_id: number
  room_name: string
  booked_by: string
  title: string
  start: string
  end: string
}
