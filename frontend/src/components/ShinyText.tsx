import { useId, useState } from 'react'

export interface ShinyTextProps {
  text: string
  speed?: number
  delay?: number
  color?: string
  shineColor?: string
  spread?: number
  direction?: 'left' | 'right'
  yoyo?: boolean
  pauseOnHover?: boolean
  disabled?: boolean
  className?: string
}

export default function ShinyText({
  text = '',
  speed = 2,
  delay = 0,
  color = '#b5b5b5',
  shineColor = '#ffffff',
  spread = 120,
  direction = 'left',
  yoyo = false,
  pauseOnHover = false,
  disabled = false,
  className = '',
}: ShinyTextProps) {
  const id = useId().replace(/:/g, '')
  const [isPaused, setIsPaused] = useState(false)
  const duration = 1 / speed
  const gradientAngle = direction === 'left' ? 90 + spread / 2 : 90 - spread / 2
  const gradient = `linear-gradient(${gradientAngle}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`
  const gradientSize = 300

  const animationName = `shiny-${id}`
  const keyframes = `
    @keyframes ${animationName} {
      0% { background-position: ${direction === 'left' ? `${gradientSize}%` : `-${gradientSize}%`} 50%; }
      100% { background-position: ${direction === 'left' ? `-${gradientSize}%` : `${gradientSize}%`} 50%; }
    }
  `

  if (disabled) {
    return <span className={className} style={{ color }}>{text}</span>
  }

  return (
    <>
      <style>{keyframes}</style>
      <span
        className={`inline-block ${className}`}
        style={{
          background: gradient,
          backgroundSize: `${gradientSize * 2}% 100%`,
          backgroundPosition: `${direction === 'left' ? gradientSize : -gradientSize}% 50%`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          animation: isPaused && pauseOnHover ? 'none' : `${animationName} ${duration}s linear ${delay}s infinite`,
          animationDirection: yoyo ? 'alternate' : 'normal',
        }}
        onMouseEnter={() => pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => pauseOnHover && setIsPaused(false)}
      >
        {text}
      </span>
    </>
  )
}
