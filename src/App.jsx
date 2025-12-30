import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import ConverterCard from './components/ConverterCard'
import Footer from './components/Footer';
import { Box } from "@mui/material";

function App() {
  const [count, setCount] = useState(0)

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column">
      <Box flexGrow={1}>
        <ConverterCard />
      </Box>

      <Footer />
    </Box>
  );
}

export default App
