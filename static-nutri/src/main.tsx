import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root 엘리먼트를 찾을 수 없어요');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
