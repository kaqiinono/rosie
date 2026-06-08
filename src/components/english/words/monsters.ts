export interface MonsterDef {
  /** SVG inner markup; will be placed inside <svg viewBox="0 0 200 200">. Includes mouth-closed/open groups. */
  body: string
  color: string
  name: string
  /** Mouth center coordinates in viewBox 200x200, used for flying-word target */
  mouth: { x: number; y: number }
}

export const MONSTERS: MonsterDef[] = [
  {
    name: '毛毛',
    color: '#AFA9EC',
    mouth: { x: 100, y: 158 },
    body: `
      <circle cx="100" cy="120" r="70" fill="#AFA9EC"/>
      <circle cx="100" cy="120" r="70" fill="url(#belly)" opacity=".3"/>
      <!-- eyes -->
      <circle cx="78" cy="100" r="12" fill="#fff"/>
      <circle cx="122" cy="100" r="12" fill="#fff"/>
      <circle cx="81" cy="103" r="6" fill="#3C3489"/>
      <circle cx="125" cy="103" r="6" fill="#3C3489"/>
      <circle cx="83" cy="101" r="2" fill="#fff"/>
      <circle cx="127" cy="101" r="2" fill="#fff"/>
      <!-- horns -->
      <polygon points="70,55 60,25 82,50" fill="#7F77DD"/>
      <polygon points="130,55 140,25 118,50" fill="#7F77DD"/>
      <!-- arms -->
      <ellipse cx="35" cy="130" rx="18" ry="10" fill="#AFA9EC" transform="rotate(-20 35 130)"/>
      <ellipse cx="165" cy="130" rx="18" ry="10" fill="#AFA9EC" transform="rotate(20 165 130)"/>
      <!-- feet -->
      <ellipse cx="75" cy="183" rx="20" ry="10" fill="#7F77DD"/>
      <ellipse cx="125" cy="183" rx="20" ry="10" fill="#7F77DD"/>
      <!-- mouth closed -->
      <g id="mouth-closed"><path d="M72 138 Q100 155 128 138" stroke="#3C3489" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <!-- mouth open (hidden) -->
      <g id="mouth-open" display="none">
        <path d="M68 132 Q100 178 132 132" fill="#FF6B6B"/>
        <path d="M68 132 Q100 178 132 132" stroke="#3C3489" stroke-width="2.5" fill="none"/>
        <!-- tongue -->
        <ellipse cx="100" cy="162" rx="18" ry="10" fill="#FF9999"/>
        <!-- teeth top -->
        <rect x="76" y="132" width="14" height="10" rx="3" fill="#fff"/>
        <rect x="93" y="132" width="14" height="10" rx="3" fill="#fff"/>
        <rect x="110" y="132" width="14" height="10" rx="3" fill="#fff"/>
      </g>
      <defs><radialGradient id="belly" cx="50%" cy="60%"><stop offset="0%" stop-color="#fff"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    `,
  },
  {
    name: '刺刺',
    color: '#97C459',
    mouth: { x: 100, y: 162 },
    body: `
      <ellipse cx="100" cy="125" rx="65" ry="60" fill="#97C459"/>
      <!-- spikes -->
      <polygon points="100,45 90,68 110,68" fill="#639922"/>
      <polygon points="130,55 115,72 135,75" fill="#639922"/>
      <polygon points="70,55 65,75 85,72" fill="#639922"/>
      <!-- eyes -->
      <circle cx="80" cy="105" r="13" fill="#fff"/>
      <circle cx="120" cy="105" r="13" fill="#fff"/>
      <circle cx="83" cy="108" r="7" fill="#3B6D11"/>
      <circle cx="123" cy="108" r="7" fill="#3B6D11"/>
      <circle cx="85" cy="106" r="2.5" fill="#fff"/>
      <circle cx="125" cy="106" r="2.5" fill="#fff"/>
      <!-- arms -->
      <ellipse cx="38" cy="128" rx="20" ry="11" fill="#97C459" transform="rotate(-15 38 128)"/>
      <ellipse cx="162" cy="128" rx="20" ry="11" fill="#97C459" transform="rotate(15 162 128)"/>
      <!-- feet -->
      <ellipse cx="78" cy="180" rx="22" ry="11" fill="#639922"/>
      <ellipse cx="122" cy="180" rx="22" ry="11" fill="#639922"/>
      <!-- mouth closed -->
      <g id="mouth-closed"><path d="M75 145 Q100 160 125 145" stroke="#3B6D11" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <!-- mouth open -->
      <g id="mouth-open" display="none">
        <path d="M72 138 Q100 182 128 138" fill="#FF6B6B"/>
        <path d="M72 138 Q100 182 128 138" stroke="#3B6D11" stroke-width="2.5" fill="none"/>
        <ellipse cx="100" cy="167" rx="18" ry="9" fill="#FF9999"/>
        <rect x="78" y="137" width="13" height="9" rx="3" fill="#fff"/>
        <rect x="94" y="137" width="13" height="9" rx="3" fill="#fff"/>
        <rect x="110" y="137" width="13" height="9" rx="3" fill="#fff"/>
      </g>
    `,
  },
  {
    name: '橙橙',
    color: '#EF9F27',
    mouth: { x: 100, y: 156 },
    body: `
      <circle cx="100" cy="118" r="68" fill="#EF9F27"/>
      <!-- ears -->
      <ellipse cx="55" cy="65" rx="18" ry="25" fill="#EF9F27" transform="rotate(-15 55 65)"/>
      <ellipse cx="145" cy="65" rx="18" ry="25" fill="#EF9F27" transform="rotate(15 145 65)"/>
      <ellipse cx="55" cy="65" rx="10" ry="16" fill="#FAC775" transform="rotate(-15 55 65)"/>
      <ellipse cx="145" cy="65" rx="10" ry="16" fill="#FAC775" transform="rotate(15 145 65)"/>
      <!-- belly -->
      <ellipse cx="100" cy="130" rx="40" ry="35" fill="#FAC775" opacity=".5"/>
      <!-- eyes -->
      <circle cx="80" cy="100" r="13" fill="#fff"/>
      <circle cx="120" cy="100" r="13" fill="#fff"/>
      <circle cx="83" cy="103" r="7" fill="#633806"/>
      <circle cx="123" cy="103" r="7" fill="#633806"/>
      <circle cx="85" cy="101" r="2.5" fill="#fff"/>
      <circle cx="125" cy="101" r="2.5" fill="#fff"/>
      <!-- tail -->
      <path d="M168 140 Q190 120 175 100" stroke="#EF9F27" stroke-width="8" fill="none" stroke-linecap="round"/>
      <!-- mouth closed -->
      <g id="mouth-closed"><path d="M75 140 Q100 155 125 140" stroke="#854F0B" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <!-- mouth open -->
      <g id="mouth-open" display="none">
        <path d="M70 133 Q100 177 130 133" fill="#FF6B6B"/>
        <path d="M70 133 Q100 177 130 133" stroke="#854F0B" stroke-width="2.5" fill="none"/>
        <ellipse cx="100" cy="162" rx="19" ry="10" fill="#FF9999"/>
        <rect x="76" y="133" width="13" height="9" rx="3" fill="#fff"/>
        <rect x="93" y="133" width="13" height="9" rx="3" fill="#fff"/>
        <rect x="110" y="133" width="13" height="9" rx="3" fill="#fff"/>
      </g>
    `,
  },
  {
    name: '粉粉',
    color: '#ED93B1',
    mouth: { x: 100, y: 162 },
    body: `
      <path d="M35 185 Q35 80 100 55 Q165 80 165 185 Q148 175 132 185 Q115 175 100 185 Q85 175 68 185 Q52 175 35 185Z" fill="#ED93B1"/>
      <!-- eyes -->
      <circle cx="80" cy="115" r="13" fill="#fff"/>
      <circle cx="120" cy="115" r="13" fill="#fff"/>
      <circle cx="83" cy="118" r="7" fill="#993556"/>
      <circle cx="123" cy="118" r="7" fill="#993556"/>
      <circle cx="85" cy="116" r="2.5" fill="#fff"/>
      <circle cx="125" cy="116" r="2.5" fill="#fff"/>
      <!-- blush -->
      <ellipse cx="65" cy="130" rx="14" ry="8" fill="#F4C0D1" opacity=".7"/>
      <ellipse cx="135" cy="130" rx="14" ry="8" fill="#F4C0D1" opacity=".7"/>
      <!-- mouth closed -->
      <g id="mouth-closed"><path d="M78 145 Q100 158 122 145" stroke="#993556" stroke-width="3" fill="none" stroke-linecap="round"/></g>
      <!-- mouth open -->
      <g id="mouth-open" display="none">
        <path d="M74 138 Q100 180 126 138" fill="#FF6B6B"/>
        <path d="M74 138 Q100 180 126 138" stroke="#993556" stroke-width="2.5" fill="none"/>
        <ellipse cx="100" cy="166" rx="18" ry="9" fill="#FF9999"/>
        <rect x="79" y="137" width="12" height="9" rx="3" fill="#fff"/>
        <rect x="95" y="137" width="12" height="9" rx="3" fill="#fff"/>
        <rect x="111" y="137" width="12" height="9" rx="3" fill="#fff"/>
      </g>
    `,
  },
]
