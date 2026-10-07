import '@testing-library/jest-dom/vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiFetch } from '../api/client'
import type { Room } from '../types'
import RoomListPage from './RoomListPage'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return { ...actual, apiFetch: vi.fn() }
})

const mockApiFetch = vi.mocked(apiFetch)

const ROOMS: Room[] = [
  {
    id: 1,
    name: 'Besprechung Nord',
    seats: 8,
    amenities: ['Beamer', 'Whiteboard', 'Konferenztelefon'],
  },
  {
    id: 2,
    name: 'Konferenzraum',
    seats: 12,
    amenities: ['Beamer', 'Videokonferenz', 'Whiteboard', 'Flipchart'],
  },
  {
    id: 3,
    name: 'Meetingbox',
    seats: 4,
    amenities: ['Whiteboard', 'Stehtisch'],
  },
]

function renderPage() {
  return render(
    <MemoryRouter>
      <RoomListPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockApiFetch.mockReset()
})

afterEach(cleanup)

describe('RoomListPage', () => {
  it('loads rooms from /rooms and shows name, seat count and amenity tags', async () => {
    mockApiFetch.mockResolvedValue(ROOMS)
    renderPage()

    await screen.findByText('Besprechung Nord')
    expect(mockApiFetch).toHaveBeenCalledWith('/rooms')

    const card = screen.getByText('Besprechung Nord').closest('article')
    expect(card).not.toBeNull()
    const scope = within(card as HTMLElement)
    expect(scope.getByText('8 Plätze')).toBeInTheDocument()
    expect(scope.getByText('Beamer')).toBeInTheDocument()
    expect(scope.getByText('Whiteboard')).toBeInTheDocument()
    expect(scope.getByText('Konferenztelefon')).toBeInTheDocument()

    expect(screen.getByText('Konferenzraum')).toBeInTheDocument()
    expect(screen.getByText('12 Plätze')).toBeInTheDocument()
    expect(screen.getByText('Meetingbox')).toBeInTheDocument()
    expect(screen.getByText('4 Plätze')).toBeInTheDocument()
  })

  it('links every room to its day view', async () => {
    mockApiFetch.mockResolvedValue(ROOMS)
    renderPage()

    await screen.findByText('Besprechung Nord')
    const card = screen.getByText('Konferenzraum').closest('article') as HTMLElement
    expect(within(card).getByRole('link', { name: 'Tag ansehen' })).toHaveAttribute(
      'href',
      '/rooms/2',
    )
  })

  it('offers a disabled create-room control marked "kommt bald"', async () => {
    mockApiFetch.mockResolvedValue(ROOMS)
    renderPage()

    await screen.findByText('Besprechung Nord')
    const create = screen.getByRole('button', { name: /Raum anlegen/ })
    expect(create).toBeDisabled()
    expect(create).toHaveTextContent('kommt bald')
  })

  it('filters the visible list by the selected amenity and updates the count', async () => {
    mockApiFetch.mockResolvedValue(ROOMS)
    renderPage()

    await screen.findByText('Besprechung Nord')
    expect(screen.getByText('3 Räume')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Flipchart' }))
    expect(screen.getByText('Konferenzraum')).toBeInTheDocument()
    expect(screen.queryByText('Besprechung Nord')).not.toBeInTheDocument()
    expect(screen.queryByText('Meetingbox')).not.toBeInTheDocument()
    expect(screen.getByText('1 Raum')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Alle' }))
    expect(screen.getByText('Besprechung Nord')).toBeInTheDocument()
    expect(screen.getByText('Meetingbox')).toBeInTheDocument()
    expect(screen.getByText('3 Räume')).toBeInTheDocument()
  })

  it('shows the filter empty state and resets the filter from it', async () => {
    mockApiFetch.mockResolvedValue([
      { id: 7, name: 'Fokusraum', seats: 2, amenities: ['Monitor'] },
    ])
    renderPage()

    await screen.findByText('Fokusraum')
    fireEvent.click(screen.getByRole('button', { name: 'Beamer' }))

    expect(screen.getByText('Keine Räume mit dieser Ausstattung')).toBeInTheDocument()
    expect(screen.queryByText('Fokusraum')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }))
    expect(screen.getByText('Fokusraum')).toBeInTheDocument()
    expect(screen.queryByText('Keine Räume mit dieser Ausstattung')).not.toBeInTheDocument()
  })

  it('shows an empty state when the API returns no rooms', async () => {
    mockApiFetch.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Noch keine Räume')).toBeInTheDocument()
  })

  it('shows an error banner and retries the request', async () => {
    mockApiFetch.mockRejectedValue(
      new ApiError(500, 'internal_error', 'Der Server ist nicht erreichbar.'),
    )
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Räume konnten nicht geladen werden')
    expect(alert).toHaveTextContent('Der Server ist nicht erreichbar.')

    mockApiFetch.mockResolvedValue(ROOMS)
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }))

    await waitFor(() => {
      expect(screen.getByText('Besprechung Nord')).toBeInTheDocument()
    })
  })
})
