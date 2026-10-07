import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

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
    expect(within(nav).getByRole('link', { name: 'Räume' })).toHaveAttribute('href', '/rooms')
    expect(within(nav).getByRole('link', { name: 'Freie Räume' })).toHaveAttribute('href', '/free')
  })

  it('renders the wordmark linking home and a main landmark', () => {
    renderApp()

    expect(screen.getByRole('link', { name: 'Raumbuchung' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('main')).toBeInTheDocument()
  })
})
