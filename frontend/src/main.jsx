import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SystemConfigurationProvider } from './views/SystemConfiguration'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SystemConfigurationProvider><App /></SystemConfigurationProvider>
  </StrictMode>,
)
