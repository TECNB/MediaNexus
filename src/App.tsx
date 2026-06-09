import { RouterProvider } from 'react-router-dom'

import { AuthProvider } from '@/lib/auth-session'
import { router } from '@/router'

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}

export default App
