
import React from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import Home from './pages/Home'
import Chat from './pages/Chat'
import './styles/index.css'

const router = createBrowserRouter([
  { path: '/', element: <Home/> },
  { path: '/chat', element: <Chat/> },
])

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />)
