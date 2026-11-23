import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import './index.css'
import { rutas } from './rutas'

const clienteQuery = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
})

const router = createBrowserRouter(rutas)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={clienteQuery}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
