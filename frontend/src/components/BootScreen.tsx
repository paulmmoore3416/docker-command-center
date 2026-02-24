import { useEffect, useRef, useState } from 'react'

interface BootScreenProps {
  onComplete: () => void
}

export function BootScreen({ onComplete }: BootScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleEnded = () => {
      setFading(true)
      setTimeout(onComplete, 600)
    }

    video.addEventListener('ended', handleEnded)

    // Fallback: if video fails to load or errors, skip after 3 s
    const fallback = setTimeout(() => {
      setFading(true)
      setTimeout(onComplete, 600)
    }, 30_000)

    video.onerror = () => {
      clearTimeout(fallback)
      setFading(true)
      setTimeout(onComplete, 600)
    }

    return () => {
      video.removeEventListener('ended', handleEnded)
      clearTimeout(fallback)
    }
  }, [onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.6s ease',
      }}
    >
      <video
        ref={videoRef}
        src="/boot.mp4"
        autoPlay
        muted
        playsInline
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
      />
    </div>
  )
}
