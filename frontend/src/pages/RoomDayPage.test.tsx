import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Booking, Room } from '../types'
import RoomDayPage from './RoomDayPage'

const room: Room = {
  id: 5,
  name: 'Besprechung Nord',
  seats: 8,
  amenities: ['Beamer'],
}

function makeBooking(overrides: Partial<Booking>): Booking {
  return {
    id: 1,
    room_id: 5,
    room_name: 'Besprechung Nord',
    booked_by: 'Anna',
    title: 'Sprint Planning',
    start: '2099-03-11T09:00:00+01:00',
    end: '2099-03-11T11:00:00+01:00',
    ...overrides,
  }
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function renderPage(path = '/rooms/5?date=2099-03-11') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/rooms/:roomId" element={<RoomDayPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('RoomDayPage', () => {
  it('renders the day bookings in chronological order', async () => {
    const later = makeBooking({
      id: 42,
      title: 'Kunden-Workshop',
      booked_by: 'Jonas',
      start: '2099-03-11T15:00:00+01:00',
      end: '2099-03-11T17:00:00+01:00',
    })
    const earlier = makeBooking({
      id: 7,
      title: 'Sprint Planning',
      booked_by: 'Anna',
      start: '2099-03-11T09:00:00+01:00',
      end: '2099-03-11T11:00:00+01:00',
    })

    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes('/bookings')) {
        return Promise.resolve(jsonResponse([later, earlier]))
      }
      return Promise.resolve(jsonResponse(room))
    })

    renderPage()

    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Sprint Planning')).toBeInTheDocument()
    expect(within(items[0]).getByText('09:00 – 11:00')).toBeInTheDocument()
    expect(within(items[1]).getByText('Kunden-Workshop')).toBeInTheDocument()
    expect(within(items[0]).getByText('2 Std.')).toBeInTheDocument()
  })

  it('reloads the bookings when the date changes', async () => {
    const firstDay = makeBooking({
      id: 1,
      title: 'Sprint Planning',
      start: '2099-03-11T09:00:00+01:00',
      end: '2099-03-11T11:00:00+01:00',
    })
    const nextDay = makeBooking({
      id: 2,
      title: 'Onboarding',
      start: '2099-03-12T10:00:00+01:00',
      end: '2099-03-12T11:00:00+01:00',
    })

    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes('/bookings')) {
        const payload = url.includes('day=2099-03-12') ? [nextDay] : [firstDay]
        return Promise.resolve(jsonResponse(payload))
      }
      return Promise.resolve(jsonResponse(room))
    })

    renderPage('/rooms/5?date=2099-03-11')

    expect(await screen.findByText('Sprint Planning')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Nächster Tag' }))

    expect(await screen.findByText('Onboarding')).toBeInTheDocument()
    expect(screen.queryByText('Sprint Planning')).not.toBeInTheDocument()
    expect(screen.getByText(/12\.03\.2099/)).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('day=2099-03-12'),
        expect.anything(),
      )
    })
  })

  it('shows the empty state with a booking action when the day has no bookings', async () => {
    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes('/bookings')) {
        return Promise.resolve(jsonResponse([]))
      }
      return Promise.resolve(jsonResponse(room))
    })

    renderPage()

    expect(await screen.findByText('Keine Buchungen an diesem Tag')).toBeInTheDocument()
    const action = screen.getByRole('link', { name: 'Raum buchen' })
    expect(action).toHaveAttribute('href', expect.stringContaining('roomId=5'))
  })

  it('marks an already started booking as locked', async () => {
    const started = makeBooking({
      id: 9,
      title: 'Sprint Planning',
      start: '2020-01-01T09:00:00+01:00',
      end: '2020-01-01T11:00:00+01:00',
    })

    fetchMock.mockImplementation((input: unknown) => {
      const url = String(input)
      if (url.includes('/bookings')) {
        return Promise.resolve(jsonResponse([started]))
      }
      return Promise.resolve(jsonResponse(room))
    })

    renderPage('/rooms/5?date=2020-01-01')

    const item = await screen.findByRole('listitem')
    expect(item).toHaveClass('is-locked')
    expect(within(item).getByText('Bereits begonnen — nicht mehr änderbar')).toBeInTheDocument()
  })
})
