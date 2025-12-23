import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '../style.css'

import { GameProvider } from './contexts/GameContext'
import PullToRefreshHandler from './components/PullToRefreshHandler'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GameProvider>
            <PullToRefreshHandler />
            <App />
        </GameProvider>
    </React.StrictMode>,
)
