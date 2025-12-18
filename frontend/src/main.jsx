import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Correct import for react-router-dom v6+
import { BrowserRouter } from 'react-router-dom';

// OR if you're using a different setup
import * as ReactRouter from 'react-router-dom';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
