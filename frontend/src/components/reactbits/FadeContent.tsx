import React from 'react';
import { motion } from 'framer-motion';
import { useFX } from '../../context/FXContext';

interface FadeContentProps {
  children: React.ReactNode;
  blur?: boolean;
  duration?: number;
  delay?: number;
  className?: string;
}

export const FadeContent: React.FC<FadeContentProps> = ({
  children,
  blur = true,
  duration = 0.5,
  delay = 0,
  className = '',
}) => {
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  if (isOff) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 12,
        filter: blur && fxLevel === 'max' ? 'blur(4px)' : 'none',
      }}
      animate={{
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
      }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
