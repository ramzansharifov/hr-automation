import { motion } from 'framer-motion'

interface HRLogoProps {
  className?: string
}

export function HRLogo({ className = '' }: HRLogoProps): JSX.Element {
  return (
    <motion.svg
      width="512"
      height="512"
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-labelledby="hr-automation-logo-title"
      initial={{ opacity: 0, scale: 0.88, rotate: -8 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ duration: 0.65, ease: 'easeOut' }}
      whileHover={{ scale: 1.06, rotate: 3 }}
    >
      <title id="hr-automation-logo-title">HR Automation Logo</title>

      <defs>
        <radialGradient id="hrLogoInnerBg" cx="50%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#2D2ACF" />
          <stop offset="58%" stopColor="#15107A" />
          <stop offset="100%" stopColor="#070733" />
        </radialGradient>

        <linearGradient
          id="hrLogoOuterRing"
          x1="92"
          y1="72"
          x2="420"
          y2="440"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#7B75FF" />
          <stop offset="45%" stopColor="#4A3EFF" />
          <stop offset="100%" stopColor="#1D1694" />
        </linearGradient>

        <linearGradient
          id="hrLogoOrbitStroke"
          x1="120"
          y1="120"
          x2="392"
          y2="392"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#E6EBFF" />
          <stop offset="45%" stopColor="#9EB2FF" />
          <stop offset="100%" stopColor="#4A6BFF" />
        </linearGradient>

        <linearGradient
          id="hrLogoHrFill"
          x1="170"
          y1="170"
          x2="340"
          y2="320"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#F4F6FF" />
          <stop offset="100%" stopColor="#C9D3FF" />
        </linearGradient>

        <linearGradient
          id="hrLogoCircuitFill"
          x1="185"
          y1="330"
          x2="328"
          y2="420"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#A9B9FF" />
          <stop offset="100%" stopColor="#5B73FF" />
        </linearGradient>

        <filter id="hrLogoShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="0"
            dy="18"
            stdDeviation="18"
            floodColor="#0C115C"
            floodOpacity="0.30"
          />
        </filter>

        <filter id="hrLogoNodeGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <motion.circle
        cx="256"
        cy="256"
        r="220"
        fill="url(#hrLogoOuterRing)"
        filter="url(#hrLogoShadow)"
        style={{ transformOrigin: '256px 256px' }}
        animate={{ scale: [1, 1.025, 1] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <circle cx="256" cy="256" r="186" fill="url(#hrLogoInnerBg)" />
      <circle cx="256" cy="256" r="186" stroke="white" strokeOpacity="0.08" strokeWidth="2" />

      <motion.circle
        cx="176"
        cy="132"
        r="112"
        fill="white"
        animate={{ opacity: [0.04, 0.085, 0.04] }}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.circle
        cx="364"
        cy="384"
        r="126"
        fill="#5B65FF"
        animate={{ opacity: [0.08, 0.16, 0.08] }}
        transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.g
        style={{ transformOrigin: '256px 256px' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      >
        <circle
          cx="256"
          cy="256"
          r="166"
          stroke="url(#hrLogoOrbitStroke)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray="720 330"
          transform="rotate(-135 256 256)"
          opacity="0.96"
        />
      </motion.g>

      <motion.g
        style={{ transformOrigin: '256px 256px' }}
        animate={{ rotate: -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
      >
        <circle
          cx="256"
          cy="256"
          r="146"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray="165 752"
          transform="rotate(-118 256 256)"
          opacity="0.22"
        />
      </motion.g>

      <motion.circle
        cx="373"
        cy="138"
        r="18"
        fill="white"
        filter="url(#hrLogoNodeGlow)"
        animate={{ scale: [1, 1.2, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '373px 138px' }}
      />

      <motion.circle
        cx="138"
        cy="373"
        r="18"
        fill="white"
        filter="url(#hrLogoNodeGlow)"
        animate={{ scale: [1, 1.2, 1], opacity: [0.9, 1, 0.9] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
        style={{ transformOrigin: '138px 373px' }}
      />

      <motion.text
        x="256"
        y="304"
        textAnchor="middle"
        fontFamily="Inter, Montserrat, Arial, sans-serif"
        fontSize="138"
        fontWeight="800"
        letterSpacing="-6"
        fill="url(#hrLogoHrFill)"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.18, ease: 'easeOut' }}
      >
        HR
      </motion.text>

      <g
        stroke="url(#hrLogoCircuitFill)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M256 412V366"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.35, ease: 'easeOut' }}
        />
        <motion.path
          d="M202 412V388L185 371V348"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: 'easeOut' }}
        />
        <motion.path
          d="M310 412V388L327 371V348"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: 'easeOut' }}
        />
      </g>

      <g fill="#C6D0FF">
        <motion.circle
          cx="256"
          cy="360"
          r="16"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '256px 360px' }}
        />
        <motion.circle
          cx="185"
          cy="342"
          r="16"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.25 }}
          style={{ transformOrigin: '185px 342px' }}
        />
        <motion.circle
          cx="327"
          cy="342"
          r="16"
          animate={{ scale: [1, 1.12, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          style={{ transformOrigin: '327px 342px' }}
        />
      </g>

      <g fill="#12125A">
        <circle cx="256" cy="360" r="6" />
        <circle cx="185" cy="342" r="6" />
        <circle cx="327" cy="342" r="6" />
      </g>
    </motion.svg>
  )
}