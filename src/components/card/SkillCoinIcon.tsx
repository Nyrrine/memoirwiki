const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
interface SkillCoinIconProps {
    number: number;
    size?: number;
}
export function SkillCoinIcon({ number, size = 24 }: SkillCoinIconProps) {
    const numeral = ROMAN[Math.min(Math.max(number - 1, 0), 7)];
    const h = size * (35 / 36);
    return (<svg width={size} height={h} viewBox="-1 -1 36 35" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      
      <path fillRule="evenodd" clipRule="evenodd" d="M16.9381 32.5731L29.9673 26.4928L33.8761 11.7263L24.7556 0H9.12047L0 11.7264L3.90877 26.4928L16.938 32.5732Z" fill="#202018" stroke="#E3D4CD" strokeWidth={1.74}/>
      
      <path fillRule="evenodd" clipRule="evenodd" d="M16.938 28.8147L26.9605 24.1375L29.9673 12.7787L22.9515 3.75842H10.9245L3.90875 12.7787L6.9155 24.1375L16.938 28.8147Z" fill="none" stroke="#E3D4CD" strokeWidth={0.87}/>
      
      <text x="17" y="17" textAnchor="middle" dominantBaseline="central" fill="#E3D4CD" fontSize="13" fontWeight="700" fontFamily="var(--font-heading)">
        {numeral}
      </text>
    </svg>);
}
