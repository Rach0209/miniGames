// 5x5 블록 폰트 (영문 대문자, 숫자, 일부 특수문자)
const BLOCK_FONT: Record<string, string[]> = {
  ' ': ['     ', '     ', '     ', '     ', '     '],
  'A': [' ███ ', '█   █', '█████', '█   █', '█   █'],
  'B': ['████ ', '█   █', '████ ', '█   █', '████ '],
  'C': [' ███ ', '█    ', '█    ', '█    ', ' ███ '],
  'D': ['████ ', '█   █', '█   █', '█   █', '████ '],
  'E': ['█████', '█    ', '████ ', '█    ', '█████'],
  'F': ['█████', '█    ', '████ ', '█    ', '█    '],
  'G': [' ███ ', '█    ', '█  ██', '█   █', ' ████'],
  'H': ['█   █', '█   █', '█████', '█   █', '█   █'],
  'I': ['█████', '  █  ', '  █  ', '  █  ', '█████'],
  'J': ['  ███', '    █', '    █', '█   █', ' ███ '],
  'K': ['█   █', '█  █ ', '███  ', '█  █ ', '█   █'],
  'L': ['█    ', '█    ', '█    ', '█    ', '█████'],
  'M': ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  'N': ['█   █', '██  █', '█ █ █', '█  ██', '█   █'],
  'O': [' ███ ', '█   █', '█   █', '█   █', ' ███ '],
  'P': ['████ ', '█   █', '████ ', '█    ', '█    '],
  'Q': [' ███ ', '█   █', '█ █ █', '█  ██', ' ████'],
  'R': ['████ ', '█   █', '████ ', '█  █ ', '█   █'],
  'S': [' ███ ', '█    ', ' ███ ', '    █', ' ███ '],
  'T': ['█████', '  █  ', '  █  ', '  █  ', '  █  '],
  'U': ['█   █', '█   █', '█   █', '█   █', ' ███ '],
  'V': ['█   █', '█   █', '█   █', ' █ █ ', '  █  '],
  'W': ['█   █', '█   █', '█ █ █', '██ ██', '█   █'],
  'X': ['█   █', ' █ █ ', '  █  ', ' █ █ ', '█   █'],
  'Y': ['█   █', ' █ █ ', '  █  ', '  █  ', '  █  '],
  'Z': ['█████', '   █ ', '  █  ', ' █   ', '█████'],
  '0': [' ███ ', '█  ██', '█ █ █', '██  █', ' ███ '],
  '1': ['  █  ', ' ██  ', '  █  ', '  █  ', '█████'],
  '2': [' ███ ', '█   █', '  ██ ', ' █   ', '█████'],
  '3': ['████ ', '    █', ' ███ ', '    █', '████ '],
  '4': ['█   █', '█   █', '█████', '    █', '    █'],
  '5': ['█████', '█    ', '████ ', '    █', '████ '],
  '6': [' ███ ', '█    ', '████ ', '█   █', ' ███ '],
  '7': ['█████', '    █', '   █ ', '  █  ', '  █  '],
  '8': [' ███ ', '█   █', ' ███ ', '█   █', ' ███ '],
  '9': [' ███ ', '█   █', ' ████', '    █', ' ███ '],
  '!': ['  █  ', '  █  ', '  █  ', '     ', '  █  '],
  '?': [' ███ ', '█   █', '   █ ', '     ', '  █  '],
  '.': ['     ', '     ', '     ', '     ', '  ██ '],
  ',': ['     ', '     ', '     ', '  █  ', ' █   '],
  '-': ['     ', '     ', '█████', '     ', '     '],
  '+': ['     ', '  █  ', '█████', '  █  ', '     '],
  '*': ['█ █ █', ' ███ ', '█████', ' ███ ', '█ █ █'],
  '#': [' █ █ ', '█████', ' █ █ ', '█████', ' █ █ '],
  '<': ['   █ ', '  █  ', ' █   ', '  █  ', '   █ '],
  '>': [' █   ', '  █  ', '   █ ', '  █  ', ' █   '],
};

export function toBlockText(text: string): string {
  const upper = text.toUpperCase();
  const rows = ['', '', '', '', ''];
  for (const char of upper) {
    const p = BLOCK_FONT[char] ?? BLOCK_FONT[' '];
    for (let r = 0; r < 5; r++) rows[r] += p[r] + ' ';
  }
  return rows.join('\n');
}

// 테두리 박스
type BoxStyle = 'double' | 'single' | 'round' | 'bold';
const BORDERS = {
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  round:  { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  bold:   { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
};

export function toBoxed(text: string, style: BoxStyle = 'double'): string {
  const b = BORDERS[style];
  const lines = text.split('\n');
  const width = Math.max(...lines.map(l => [...l].length));
  const top = b.tl + b.h.repeat(width + 2) + b.tr;
  const bottom = b.bl + b.h.repeat(width + 2) + b.br;
  const mid = lines.map(l => b.v + ' ' + l + ' '.repeat(width - [...l].length + 1) + b.v);
  return [top, ...mid, bottom].join('\n');
}

// 이모지 국기
export function toEmojiFlag(text: string): string {
  return [...text.toUpperCase()].map(c => {
    const code = c.charCodeAt(0);
    return code >= 65 && code <= 90 ? String.fromCodePoint(0x1F1E6 + code - 65) : c;
  }).join('');
}

// 뒤집기
const FLIP_MAP: Record<string, string> = {
  a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ı',j:'ɾ',k:'ʞ',l:'l',
  m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',
  A:'∀',B:'ᗺ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'Ⅎ',G:'⅁',H:'H',I:'I',J:'ſ',K:'ʞ',L:'⅂',
  M:'W',N:'N',O:'O',P:'Ԁ',Q:'Q',R:'ᴚ',S:'S',T:'⊥',U:'∩',V:'Λ',W:'M',X:'X',Y:'⅄',Z:'Z',
  '0':'0','1':'Ɩ','2':'ᘔ','3':'Ɛ','4':'ᔭ','5':'ϛ','6':'9','7':'L','8':'8','9':'6',
  '!':'¡','?':'¿','.':'˙',',':'\'',' ':' ',
};
export function toUpsideDown(text: string): string {
  return [...text].reverse().map(c => FLIP_MAP[c] ?? c).join('');
}

// 작은 대문자
const SMALLCAPS_MAP: Record<string, string> = {
  a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',
  m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'q',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',
};
export function toSmallCaps(text: string): string {
  return [...text.toLowerCase()].map(c => SMALLCAPS_MAP[c] ?? c).join('');
}

// 수학 유니코드 폰트
function mathChar(c: string, upBase: number, loBase: number, exc: Record<string, string> = {}): string {
  if (exc[c]) return exc[c];
  if (c >= 'A' && c <= 'Z') return String.fromCodePoint(upBase + c.charCodeAt(0) - 65);
  if (c >= 'a' && c <= 'z') return String.fromCodePoint(loBase + c.charCodeAt(0) - 97);
  return c;
}

export function toBold(text: string): string {
  return [...text].map(c => mathChar(c, 0x1D400, 0x1D41A)).join('');
}
export function toScript(text: string): string {
  return [...text].map(c => mathChar(c, 0x1D49C, 0x1D4B6,
    { B:'ℬ',E:'ℰ',F:'ℱ',H:'ℋ',I:'ℐ',L:'ℒ',M:'ℳ',R:'ℛ',e:'ℯ',g:'ℊ' }
  )).join('');
}
export function toDoubleStruck(text: string): string {
  return [...text].map(c => mathChar(c, 0x1D538, 0x1D552,
    { C:'ℂ',H:'ℍ',N:'ℕ',P:'ℙ',Q:'ℚ',R:'ℝ',Z:'ℤ' }
  )).join('');
}
export function toFraktur(text: string): string {
  return [...text].map(c => mathChar(c, 0x1D504, 0x1D51E,
    { C:'ℭ',H:'ℌ',I:'ℑ',R:'ℜ',Z:'ℨ' }
  )).join('');
}

// 변환 목록 (UI용)
export interface ArtResult {
  id: string;
  label: string;
  value: string;
  mono?: boolean;
  scrollX?: boolean;
}

export function getArtResults(text: string): ArtResult[] {
  if (!text.trim()) return [];
  return [
    { id: 'block',   label: '🔡 블록 글자',    value: toBlockText(text),         mono: true, scrollX: true },
    { id: 'box-d',   label: '╔ 이중 테두리',   value: toBoxed(text, 'double'),   mono: true },
    { id: 'box-r',   label: '╭ 둥근 테두리',   value: toBoxed(text, 'round'),    mono: true },
    { id: 'box-b',   label: '┏ 굵은 테두리',   value: toBoxed(text, 'bold'),     mono: true },
    { id: 'emoji',   label: '🌐 이모지 플래그', value: toEmojiFlag(text) },
    { id: 'flip',    label: '🙃 뒤집기',        value: toUpsideDown(text) },
    { id: 'small',   label: 'ꜱᴍᴀʟʟ ᴄᴀᴘꜱ',    value: toSmallCaps(text) },
    { id: 'bold',    label: '𝐁𝐨𝐥𝐝',           value: toBold(text) },
    { id: 'script',  label: '𝒮𝒸𝓇𝒾𝓅𝓉',        value: toScript(text) },
    { id: 'double',  label: '𝔻𝕠𝕦𝕓𝕝𝕖',        value: toDoubleStruck(text) },
    { id: 'fraktur', label: '𝔉𝔯𝔞𝔨𝔱𝔲𝔯',       value: toFraktur(text) },
  ];
}
