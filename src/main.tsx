import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import ListPage from './routes/ListPage.tsx'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/list/:id', element: <ListPage /> },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
