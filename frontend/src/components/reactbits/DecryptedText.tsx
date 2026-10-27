import React, { useState, useEffect } from 'react';
import { useFX } from '../../context/FXContext';

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  characters?: string;
  className?: string;
  encryptedClassName?: string;
  animateOnHover?: boolean;
}

export const DecryptedText: React.FC<DecryptedTextProps> = ({
  text,
  speed = 30,
  maxIterations = 10,
  characters = '0123456789abcdefABCDEF!@#$%^&*<>[]{}',
  className = '',
  encryptedClassName = 'text-cyan-400',
  animateOnHover = false,
}) => {
  const [displayText, setDisplayText] = useState<string>(text);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const { fxLevel } = useFX();
  const isOff = fxLevel === 'off';

  useEffect(() => {
    if (isOff) {
      setDisplayText(text);
      return;
    }

    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(
        text
          .split('')
          .map((char, index) => {
            if (char === ' ' || char === '-' || char === ':' || char === '.') return char;
            if (index < (iteration / maxIterations) * text.length) {
              return text[index];
            }
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join('')
      );

      iteration++;
      if (iteration > maxIterations) {
        clearInterval(interval);
        setDisplayText(text);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, isOff, isHovering]);

  return (
    <span
      className={`font-mono ${className}`}
      onMouseEnter={() => animateOnHover && setIsHovering((h) => !h)}
    >
      {displayText}
    </span>
  );
};
