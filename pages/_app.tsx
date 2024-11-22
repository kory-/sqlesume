import type { AppProps } from 'next/app'
import '../styles/console.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="bg-terminal-bg min-h-screen">
      <Component {...pageProps} />
    </div>
  )
} 