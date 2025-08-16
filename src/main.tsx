import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ListPage from './routes/ListPage.tsx'
import SettingsPage from './routes/SettingsPage.tsx'
import ReaderPage from './routes/ReaderPage.tsx'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/list/:id', element: <ListPage /> },
  { path: '/settings', element: <SettingsPage /> },
  { path: '/reader/:fileId', element: <ReaderPage /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
