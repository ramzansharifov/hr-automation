import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

interface AnimatedNumberProps {
  value: number;
}

export function AnimatedNumber({ value }: AnimatedNumberProps): JSX.Element {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const [displayValue, setDisplayValue] = useState(
    reduceMotion ? value : 0,
  );

  useMotionValueEvent(motionValue, "change", (latest) => {
    setDisplayValue(Math.round(latest));
  });

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      setDisplayValue(value);
      return;
    }

    const controls = animate(motionValue, value, {
      duration: 0.68,
      ease: [0.22, 1, 0.36, 1],
    });

    return () => controls.stop();
  }, [motionValue, reduceMotion, value]);

  return <>{displayValue.toLocaleString("ru-RU")}</>;
}
