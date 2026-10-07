import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch } from './api/client'
import App from './App'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return { ...actual, apiFetch: vi.fn() }
})

const mockApiFetch = vi.mocked(apiFetch)

afterEach(cleanup)

beforeEach(() => {
  mockApiFetch.mockReset()
  mockApiFetch.mockResolvedValue([])
})

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App shell', () => {
  it('renders the header navigation with links to the contract routes', () => {
    renderApp()

    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(within(nav).getByRole('link', { name: 'Räume' })).toHaveAttribute('href', '/')
    expect(within(nav).getByRole('link', { name: 'Freie Räume' })).toHaveAttribute('href', '/free')
  })

  it('renders the wordmark linking home and a main landmark', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'Raumbuchung' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders the room list on the start route instead of the placeholder page', async () => {
    renderApp('/')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Räume' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Alle Räume des Büros auf einen Blick.')).toBeInTheDocument()
    expect(screen.queryByText('Startseite – kommt bald')).not.toBeInTheDocument()
  })
})
