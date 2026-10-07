import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Room } from '../types'
import BookingFormPage from './BookingFormPage'

const ROOMS: Room[] = [
  { id: 1, name: 'Besprechung Nord', seats: 8, amenities: ['WLAN', 'TV'] },
  { id: 2, name: 'Konferenzraum', seats: 12, amenities: [] },
]

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
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

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

function renderPage(initialEntry = '/book') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/book" element={<BookingFormPage />} />
        <Route path="/rooms/:roomId" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockRoomsOnly() {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    if (String(input) === '/api/rooms') return Promise.resolve(jsonResponse(ROOMS))
    return Promise.resolve(jsonResponse({ code: 'not_found', message: 'nicht gefunden' }, 404))
  })
}

describe('BookingFormPage', () => {
  it('shows no validation message on the untouched form', async () => {
    mockRoomsOnly()
    renderPage('/book?roomId=1')

    await screen.findByRole('option', { name: /Besprechung Nord/ })

    expect(screen.queryByText('Bitte wähle einen Raum.')).not.toBeInTheDocument()
    expect(screen.queryByText('Bitte gib an, wer den Raum bucht.')).not.toBeInTheDocument()
    expect(screen.queryByText('Bitte gib einen Titel an.')).not.toBeInTheDocument()
    expect(screen.queryByText('Bitte gib einen Beginn an.')).not.toBeInTheDocument()
    expect(screen.queryByText('Bitte gib ein Ende an.')).not.toBeInTheDocument()
  })

  it('reveals required messages only after a submit attempt', async () => {
    mockRoomsOnly()
    renderPage('/book')

    await screen.findByRole('option', { name: /Besprechung Nord/ })
    const save = screen.getByRole('button', { name: 'Buchung speichern' })

    expect(screen.queryByText('Bitte wähle einen Raum.')).not.toBeInTheDocument()

    fireEvent.click(save)

    expect(await screen.findByText('Bitte wähle einen Raum.')).toBeInTheDocument()
    expect(screen.getByText('Bitte gib an, wer den Raum bucht.')).toBeInTheDocument()
    expect(screen.getByText('Bitte gib einen Titel an.')).toBeInTheDocument()
    expect(screen.getByText('Bitte gib einen Beginn an.')).toBeInTheDocument()
    expect(screen.getByText('Bitte gib ein Ende an.')).toBeInTheDocument()
  })

  it('reveals a field message only after that field was edited', async () => {
    mockRoomsOnly()
    renderPage('/book?roomId=1')

    await screen.findByRole('option', { name: /Besprechung Nord/ })
    const bookedBy = screen.getByLabelText('Gebucht von')

    fireEvent.change(bookedBy, { target: { value: 'Anna' } })
    fireEvent.change(bookedBy, { target: { value: '' } })

    expect(screen.queryByText('Bitte gib an, wer den Raum bucht.')).not.toBeInTheDocument()

    fireEvent.blur(bookedBy)

    expect(await screen.findByText('Bitte gib an, wer den Raum bucht.')).toBeInTheDocument()
    expect(screen.queryByText('Bitte gib einen Titel an.')).not.toBeInTheDocument()
  })

  it('rejects an end that is not after the start', async () => {
    mockRoomsOnly()
    renderPage('/book?roomId=1')

    await screen.findByRole('option', { name: /Besprechung Nord/ })
    fireEvent.change(screen.getByLabelText('Beginn'), { target: { value: '2026-03-11T10:00' } })
    const end = screen.getByLabelText('Ende')
    fireEvent.change(end, { target: { value: '2026-03-11T09:00' } })
    fireEvent.blur(end)

    expect(await screen.findByText('Das Ende muss nach dem Beginn liegen.')).toBeInTheDocument()
  })

  it('rejects a duration above eight hours but accepts exactly eight', async () => {
    mockRoomsOnly()
    renderPage('/book?roomId=1')

    await screen.findByRole('option', { name: /Besprechung Nord/ })
    fireEvent.change(screen.getByLabelText('Beginn'), { target: { value: '2026-03-11T09:00' } })
    const end = screen.getByLabelText('Ende')

    fireEvent.change(end, { target: { value: '2026-03-11T17:30' } })
    fireEvent.blur(end)
    expect(await screen.findByText('Eine Buchung darf höchstens 8 Stunden dauern.')).toBeInTheDocument()

    fireEvent.change(end, { target: { value: '2026-03-11T17:00' } })
    fireEvent.blur(end)
    await waitFor(() =>
      expect(
        screen.queryByText('Eine Buchung darf höchstens 8 Stunden dauern.'),
      ).not.toBeInTheDocument(),
    )
  })

  it('shows the API conflict message and keeps the sheet open on 409', async () => {
    const conflictMessage =
      'Der Raum „Besprechung Nord“ ist in diesem Zeitraum bereits gebucht: „Sprint Planning“ (09:00 – 11:00).'
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/rooms') return Promise.resolve(jsonResponse(ROOMS))
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({ code: 'booking_overlap', message: conflictMessage, fields: null }, 409),
        )
      }
      return Promise.resolve(jsonResponse({ code: 'not_found', message: 'nicht gefunden' }, 404))
    })

    renderPage('/book?roomId=1&start=2026-03-11T09:00:00%2B01:00&end=2026-03-11T10:00:00%2B01:00')

    await screen.findByRole('option', { name: /Besprechung Nord/ })
    fireEvent.change(screen.getByLabelText('Gebucht von'), { target: { value: 'Anna' } })
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Sprint Planning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buchung speichern' }))

    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent(conflictMessage)
    expect(screen.getByRole('heading', { name: 'Buchung' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buchung speichern' })).toBeEnabled()
  })

  it('navigates to the room day view after a successful booking', async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/rooms') return Promise.resolve(jsonResponse(ROOMS))
      if (url === '/api/bookings' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              id: 5,
              room_id: 1,
              room_name: 'Besprechung Nord',
              booked_by: 'Anna',
              title: 'Sprint Planning',
              start: '2026-03-11T08:00:00+00:00',
              end: '2026-03-11T09:00:00+00:00',
            },
            201,
          ),
        )
      }
      return Promise.resolve(jsonResponse({ code: 'not_found', message: 'nicht gefunden' }, 404))
    })

    renderPage('/book?roomId=1&start=2026-03-11T09:00:00%2B01:00&end=2026-03-11T10:00:00%2B01:00')

    await screen.findByRole('option', { name: /Besprechung Nord/ })
    fireEvent.change(screen.getByLabelText('Gebucht von'), { target: { value: 'Anna' } })
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: 'Sprint Planning' } })
    fireEvent.click(screen.getByRole('button', { name: 'Buchung speichern' }))

    await waitFor(
      () =>
        expect(screen.getByTestId('location')).toHaveTextContent('/rooms/1?date=2026-03-11'),
      { timeout: 2000 },
    )
  })
})
