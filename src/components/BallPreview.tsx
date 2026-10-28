import type { CSSProperties } from 'react';

interface Props {
  color: string;
  size?: number;
}

/** A glossy CSS ball that mirrors how the ball looks in the arena. */
export function BallPreview({ color, size = 34 }: Props) {
  const style = { '--ball': color, width: size, height: size } as CSSProperties;
  return <span className="ball-preview" style={style} aria-hidden="true" />;
}
