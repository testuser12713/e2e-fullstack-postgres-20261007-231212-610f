import { NavLink, Route, Routes } from 'react-router-dom'
import BookingFormPage from './pages/BookingFormPage'
import FreeRoomsPage from './pages/FreeRoomsPage'
import HomePage from './pages/HomePage'
import RoomDayPage from './pages/RoomDayPage'
import RoomListPage from './pages/RoomListPage'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'app-nav__link is-active' : 'app-nav__link'
}

function wordmarkClass(): string {
  return 'app-header__wordmark'
}

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="container app-header__inner">
          <NavLink to="/" className={wordmarkClass}>
            Raumbuchung
          </NavLink>
          <nav className="app-nav" aria-label="Hauptnavigation">
            <NavLink to="/rooms" className={navLinkClass}>
              Räume
            </NavLink>
            <NavLink to="/free" className={navLinkClass}>
              Freie Räume
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="app-main container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/rooms" element={<RoomListPage />} />
          <Route path="/rooms/:roomId" element={<RoomDayPage />} />
          <Route path="/free" element={<FreeRoomsPage />} />
          <Route path="/book" element={<BookingFormPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
    </div>
  )
}
