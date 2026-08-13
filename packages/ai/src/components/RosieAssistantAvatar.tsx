type RosieAssistantAvatarProps = {
  className?: string
}

export default function RosieAssistantAvatar({ className = '' }: RosieAssistantAvatarProps) {
  return (
    <span
      role="img"
      aria-label="Rosie"
      className={`block shrink-0 bg-contain bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: "url('/brand/rosie-assistant-pink-v2.webp')" }}
    />
  )
}
