// numberlink-generate.js — 유효한 퍼즐 생성 + 솔버 검증
// isConnected 핵심 수정: 빈 칸 연결성을 "경로 헤드에서 BFS"로 검사

const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

// ── 솔버 ─────────────────────────────────────────────────────
function solve(level, timeoutMs = 10000) {
  const { size, endpoints } = level;
  const grid = Array.from({length:size}, () => new Array(size).fill(0));
  for (const [num,r1,c1,r2,c2] of endpoints) { grid[r1][c1]=num; grid[r2][c2]=num; }

  const state = {};
  for (const [num,r1,c1,r2,c2] of endpoints)
    state[num] = { path:[[r1,c1]], target:[r2,c2], done:false };

  const totalCells = size*size;
  const startTime = Date.now();

  function countFilled() {
    let n=0;
    for (let r=0;r<size;r++) for (let c=0;c<size;c++) if (grid[r][c]) n++;
    return n;
  }

  // 수정된 연결성 체크: 모든 빈 칸이 "어떤 경로 헤드" 에서 도달 가능한지 확인
  function isConnected() {
    let emptyCount = 0;
    for (let r=0;r<size;r++) for (let c=0;c<size;c++) if (!grid[r][c]) emptyCount++;
    if (emptyCount === 0) return true;

    // 미완성 경로 헤드의 인접 빈 칸을 BFS 시작점으로
    const vis = new Set();
    const q = [];
    for (const [num] of endpoints) {
      if (state[num].done) continue;
      const [hr,hc] = state[num].path[state[num].path.length-1];
      for (const [dr,dc] of DIRS) {
        const nr=hr+dr, nc=hc+dc;
        if (nr<0||nr>=size||nc<0||nc>=size) continue;
        if (!grid[nr][nc]) {
          const k=`${nr},${nc}`;
          if (!vis.has(k)) { vis.add(k); q.push([nr,nc]); }
        }
      }
    }
    // BFS로 빈 칸 전파
    while (q.length) {
      const [r,c] = q.shift();
      for (const [dr,dc] of DIRS) {
        const nr=r+dr, nc=c+dc;
        if (nr<0||nr>=size||nc<0||nc>=size) continue;
        const k=`${nr},${nc}`;
        if (!grid[nr][nc] && !vis.has(k)) { vis.add(k); q.push([nr,nc]); }
      }
    }
    return vis.size === emptyCount;
  }

  // MRV: 선택지 가장 적은 미완성 경로 반환
  function getMostConstrained() {
    let best=null, bestOpts=Infinity;
    for (const [num] of endpoints) {
      if (state[num].done) continue;
      const [hr,hc] = state[num].path[state[num].path.length-1];
      const [tr,tc] = state[num].target;
      let opts=0;
      for (const [dr,dc] of DIRS) {
        const nr=hr+dr, nc=hc+dc;
        if (nr<0||nr>=size||nc<0||nc>=size) continue;
        if (!grid[nr][nc] || (nr===tr&&nc===tc)) opts++;
      }
      if (opts < bestOpts) { bestOpts=opts; best=num; }
    }
    return best;
  }

  function bt() {
    if (Date.now()-startTime > timeoutMs) return 'timeout';

    const num = getMostConstrained();
    // 모든 경로 완료 → 전체 채움 여부 확인
    if (num === null) return countFilled() === totalCells;

    const st = state[num];
    const [hr,hc] = st.path[st.path.length-1];
    const [tr,tc] = st.target;

    for (const [dr,dc] of DIRS) {
      const nr=hr+dr, nc=hc+dc;
      if (nr<0||nr>=size||nc<0||nc>=size) continue;

      if (nr===tr && nc===tc) {
        st.path.push([nr,nc]); st.done=true;
        if (isConnected()) { const r=bt(); if (r===true||r==='timeout') return r; }
        st.path.pop(); st.done=false;
      } else if (!grid[nr][nc]) {
        grid[nr][nc]=num; st.path.push([nr,nc]);
        if (isConnected()) { const r=bt(); if (r===true||r==='timeout') return r; }
        st.path.pop(); grid[nr][nc]=0;
      }
    }
    return false;
  }

  const r = bt();
  return r===true ? true : (r==='timeout' ? 'timeout' : false);
}

// ── 퍼즐 생성기 ──────────────────────────────────────────────
function makeSeed(n) {
  let s = n*1234567+9876543;
  return () => { s=Math.imul(s,1664525)+1013904223|0; return (s>>>0)/4294967296; };
}

function generatePuzzle(size, numPairs, seedN) {
  const rand = makeSeed(seedN);
  const ri = n => Math.floor(rand()*n);
  const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=ri(i+1);[a[i],a[j]]=[a[j],a[i]];}return a; };

  for (let attempt=0; attempt<500; attempt++) {
    const grid = Array.from({length:size}, () => new Array(size).fill(0));
    const paths = Array.from({length:numPairs}, (_,i) => ({num:i+1, cells:[]}));

    // 씨드 셀 배치 (너무 가까운 쌍 제외)
    const allCells = shuffle([...Array(size*size)].map((_,i) => [Math.floor(i/size), i%size]));
    const seeds = [];
    for (const [r,c] of allCells) {
      if (seeds.length >= numPairs) break;
      if (seeds.every(([sr,sc]) => Math.abs(sr-r)+Math.abs(sc-c) > 2))
        seeds.push([r,c]);
    }
    if (seeds.length < numPairs) continue;

    for (let i=0; i<numPairs; i++) {
      const [r,c] = seeds[i];
      grid[r][c] = i+1;
      paths[i].cells = [[r,c]];
    }

    // 경로 성장
    let safety = size*size*100;
    while (safety-- > 0) {
      const growable = paths.filter(p => {
        const [lr,lc] = p.cells[p.cells.length-1];
        return DIRS.some(([dr,dc]) => {
          const nr=lr+dr, nc=lc+dc;
          return nr>=0&&nr<size&&nc>=0&&nc<size&&!grid[nr][nc];
        });
      });
      if (!growable.length) break;
      const p = growable[ri(growable.length)];
      const [lr,lc] = p.cells[p.cells.length-1];
      const opts = [];
      for (const [dr,dc] of DIRS) {
        const nr=lr+dr, nc=lc+dc;
        if (nr>=0&&nr<size&&nc>=0&&nc<size&&!grid[nr][nc]) opts.push([nr,nc]);
      }
      if (opts.length) {
        const [nr,nc] = opts[ri(opts.length)];
        grid[nr][nc] = p.num;
        p.cells.push([nr,nc]);
      }
    }

    const allFilled = !grid.some(row => row.some(v => !v));
    if (!allFilled) continue;
    if (paths.some(p => p.cells.length < 2)) continue;

    const endpoints = paths.map(p => {
      const [r1,c1] = p.cells[0];
      const [r2,c2] = p.cells[p.cells.length-1];
      return [p.num, r1, c1, r2, c2];
    });

    const result = solve({size, endpoints}, 5000);
    if (result === true) return {size, endpoints, attempt};
  }
  return null;
}

// ── 솔버 테스트 (알려진 유효 퍼즐) ──────────────────────────
function testSolver() {
  // 수작업으로 만든 유효한 5×5 퍼즐
  // 정답: 1:(0,0)→(4,0), 2:(0,1)→(1,3), 3:(0,4)→(2,3), 4:(1,1)→(4,3), 5:(1,2)→(4,4)
  const known = {
    size: 5,
    endpoints: [[1,0,0,4,0],[2,0,1,1,3],[3,0,4,2,3],[4,1,1,4,3],[5,1,2,4,4]]
  };
  const r = solve(known, 5000);
  console.log(`솔버 자체 테스트: ${r===true?'✓ 통과':'✗ 실패 → 솔버 버그'}\n`);
  return r === true;
}

// ── 메인 ─────────────────────────────────────────────────────
const SPECS = [
  {size:5, pairs:4},
  {size:5, pairs:5},
  {size:6, pairs:5},
  {size:6, pairs:6},
  {size:7, pairs:6},
  {size:7, pairs:7},
  {size:8, pairs:7},
  {size:8, pairs:8},
  {size:9, pairs:8},
  {size:9, pairs:9},
];

console.log('=== 넘버링크 퍼즐 생성기 ===\n');

if (!testSolver()) {
  console.error('솔버 버그가 있어서 중단합니다.');
  process.exit(1);
}

const results = [];
SPECS.forEach(({size, pairs}, i) => {
  process.stdout.write(`레벨 ${i+1} (${size}×${size}, ${pairs}쌍) ... `);
  let puzzle = null;
  for (let t=0; t<30&&!puzzle; t++)
    puzzle = generatePuzzle(size, pairs, (i+1)*7919 + t*3333);
  if (puzzle) {
    console.log(`✓ (attempt ${puzzle.attempt+1})`);
    results.push(puzzle);
  } else {
    console.log('✗ 실패');
    results.push(null);
  }
});

console.log('\n=== LEVELS 배열 (index.tsx에 복사) ===\n');
console.log('const LEVELS: Level[] = [');
results.forEach((r, i) => {
  if (!r) { console.log(`  // 레벨 ${i+1}: 생성 실패`); return; }
  console.log(`  // 레벨 ${i+1} — ${r.size}×${r.size}, ${r.endpoints.length}쌍`);
  console.log(`  {\n    size: ${r.size},`);
  console.log(`    endpoints: [`);
  r.endpoints.forEach(ep => console.log(`      [${ep.join(', ')}],`));
  console.log(`    ],\n  },`);
});
console.log('];');
