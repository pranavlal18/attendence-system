interface RateDisplayProps {
  rate: number;
  label?: string;
}

export function RateDisplay({ rate, label }: RateDisplayProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {label ? <span className="text-sm text-zinc-500">{label}:</span> : null}
      <span className="font-medium">₹{rate}</span>
    </span>
  );
}

export default RateDisplay;
