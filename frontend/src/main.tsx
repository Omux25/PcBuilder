import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { BuildProvider } from './context/BuildContext'
import { CompareProvider } from './context/CompareContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <BuildProvider>
          <CompareProvider>
            <App />
          </CompareProvider>
        </BuildProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
