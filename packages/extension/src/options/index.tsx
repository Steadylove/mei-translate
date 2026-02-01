import { createRoot } from 'react-dom/client'
import Options from './Options'
import '@/globals.css'

const root = createRoot(document.getElementById('root')!)
root.render(<Options />)
