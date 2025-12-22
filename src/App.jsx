import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import ConverterCard from './components/ConverterCard'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <ConverterCard />
    </>
  )
}

export default App
