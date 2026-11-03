// The Kanvio icon: two bars and two pills on a yellow rounded square
export default function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <rect width="120" height="120" rx="30" fill="#fcd34d" />
      <rect x="29" y="30" width="27" height="9" rx="4.5" fill="#1f2937" />
      <rect x="64" y="30" width="27" height="9" rx="4.5" fill="#1f2937" />
      <rect x="31.5" y="50.5" width="22" height="39" rx="11" fill="#fcd34d" stroke="#1f2937" strokeWidth="5" />
      <rect x="66.5" y="56.5" width="22" height="33" rx="11" fill="#fcd34d" stroke="#1f2937" strokeWidth="5" />
    </svg>
  );
}