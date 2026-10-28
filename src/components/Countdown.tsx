interface Props {
  value: string | null;
}

export function Countdown({ value }: Props) {
  if (!value) return null;
  return (
    <div className="countdown" role="status" aria-live="assertive">
      <span key={value} className={value === 'GO!' ? 'countdown-value go' : 'countdown-value'}>
        {value}
      </span>
    </div>
  );
}
