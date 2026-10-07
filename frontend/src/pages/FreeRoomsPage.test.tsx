import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import FreeRoomsPage from './FreeRoomsPage'
import type { Room } from '../types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const rooms: Room[] = [
  { id: 1, name: 'Besprechung Nord', seats: 8, amenities: ['Beamer', 'Whiteboard'] },
  { id: 2, name: 'Meetingbox', seats: 4, amenities: ['Whiteboard'] },
]

function jsonResponse(body: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/free']}>
      <FreeRoomsPage />
    </MemoryRouter>,
  )
}

function fillRange(startValue: string, endValue: string) {
  fireEvent.change(screen.getByTestId('free-rooms-start-date-input'), {
    target: { value: startValue.slice(0, 10) },
  })
  fireEvent.change(screen.getByTestId('free-rooms-start-time-input'), {
    target: { value: startValue.slice(11, 16) },
  })
  fireEvent.change(screen.getByTestId('free-rooms-end-date-input'), {
    target: { value: endValue.slice(0, 10) },
  })
  fireEvent.change(screen.getByTestId('free-rooms-end-time-input'), {
    target: { value: endValue.slice(11, 16) },
  })
}

function requestUrl(fetchMock: ReturnType<typeof vi.fn>): URL {
  const called = fetchMock.mock.calls[0][0]
  return new URL(String(called), 'http://localhost')
}

describe('FreeRoomsPage', () => {
  it('renders the search form and shows no validation on first render', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Freie Räume' })).toBeInTheDocument()
    expect(screen.getByLabelText('Beginn')).toBeInTheDocument()
    expect(screen.getByLabelText('Ende')).toBeInTheDocument()
    expect(screen.getByLabelText('Mindestzahl Plätze')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Freie Räume suchen' })).toBeInTheDocument()
    expect(
      screen.queryByText('Das Ende muss nach dem Beginn liegen.'),
    ).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows German 24-hour date and time and never a US-formatted value', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillRange('2026-03-11T09:00', '2026-03-11T10:00')

    expect(screen.getByTestId('free-rooms-start-date')).toHaveTextContent('Mi, 11.03.2026')
    expect(screen.getByTestId('free-rooms-start-time')).toHaveTextContent('09:00')
    expect(screen.getByTestId('free-rooms-end-date')).toHaveTextContent('Mi, 11.03.2026')
    expect(screen.getByTestId('free-rooms-end-time')).toHaveTextContent('10:00')
    expect(screen.queryByText(/AM|PM/)).not.toBeInTheDocument()
  })

  it('prefills start at the next full hour and end exactly one hour later', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPage()

    const startDate = screen.getByTestId('free-rooms-start-date').textContent ?? ''
    const startTime = screen.getByTestId('free-rooms-start-time').textContent ?? ''
    const endDate = screen.getByTestId('free-rooms-end-date').textContent ?? ''
    const endTime = screen.getByTestId('free-rooms-end-time').textContent ?? ''

    expect(startTime).toMatch(/^\d{2}:00$/)

    const parse = (dateLabel: string, time: string): number => {
      const [day, month, year] = dateLabel.replace(/^\w+, /, '').split('.').map(Number)
      const [hours, minutes] = time.split(':').map(Number)
      return Date.UTC(year, month - 1, day, hours, minutes)
    }

    expect(parse(endDate, endTime) - parse(startDate, startTime)).toBe(60 * 60 * 1000)
  })

  it('requests free rooms for the chosen range and lists exactly the matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rooms))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillRange('2026-03-11T09:00', '2026-03-11T10:00')
    fireEvent.click(screen.getByRole('button', { name: 'Freie Räume suchen' }))

    await waitFor(() => expect(screen.getByText('Besprechung Nord')).toBeInTheDocument())

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = requestUrl(fetchMock)
    expect(url.pathname).toBe('/api/free-rooms')
    expect(url.searchParams.get('start')).toBe('2026-03-11T08:00:00.000Z')
    expect(url.searchParams.get('end')).toBe('2026-03-11T09:00:00.000Z')
    expect(url.searchParams.get('min_seats')).toBe('2')

    expect(screen.getByText('Meetingbox')).toBeInTheDocument()
    expect(screen.getAllByText('Frei')).toHaveLength(2)
    expect(screen.getByText('2 Räume')).toBeInTheDocument()
  })

  it('links each match into the prefilled booking form carrying room and period', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(rooms))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillRange('2026-03-11T09:00', '2026-03-11T10:00')
    fireEvent.click(screen.getByRole('button', { name: 'Freie Räume suchen' }))

    await waitFor(() => expect(screen.getByText('Besprechung Nord')).toBeInTheDocument())

    const buttons = screen.getAllByRole('link', { name: 'Buchen' })
    expect(buttons).toHaveLength(2)

    const href = buttons[0].getAttribute('href')
    expect(href).toBeTruthy()
    const query = new URL(String(href), 'http://localhost').searchParams
    expect(query.get('roomId')).toBe('1')
    expect(query.get('start')).toBe('2026-03-11T08:00:00.000Z')
    expect(query.get('end')).toBe('2026-03-11T09:00:00.000Z')
  })

  it('guards an end before the start without issuing a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillRange('2026-03-11T10:00', '2026-03-11T09:00')
    fireEvent.click(screen.getByRole('button', { name: 'Freie Räume suchen' }))

    expect(
      await screen.findByText('Das Ende muss nach dem Beginn liegen.'),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('guards a duration over 8 hours without issuing a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillRange('2026-03-11T09:00', '2026-03-11T18:00')
    fireEvent.click(screen.getByRole('button', { name: 'Freie Räume suchen' }))

    expect(
      await screen.findByText('Eine Buchung darf höchstens 8 Stunden dauern.'),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the empty state when no room matches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillRange('2026-03-11T09:00', '2026-03-11T10:00')
    fireEvent.click(screen.getByRole('button', { name: 'Freie Räume suchen' }))

    expect(await screen.findByText('Keine freien Räume gefunden')).toBeInTheDocument()
    expect(screen.getByText('0 Räume')).toBeInTheDocument()
  })

  it('shows a readable error state when the API fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ code: 'not_found', message: 'Nicht gefunden.' }, 404))
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillRange('2026-03-11T09:00', '2026-03-11T10:00')
    fireEvent.click(screen.getByRole('button', { name: 'Freie Räume suchen' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Nicht gefunden.')
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument()
  })
})
