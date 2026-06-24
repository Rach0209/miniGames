// numberlink-check.js — 최종 검증 (수정된 솔버)

const LEVELS = [
  { size: 5, endpoints: [[1,2,3,0,4],[2,3,1,0,1],[3,0,2,4,0],[4,4,4,3,4]] },
  { size: 5, endpoints: [[1,0,0,4,0],[2,2,1,0,1],[3,4,3,4,4],[4,2,4,4,2],[5,0,3,0,4]] },
  { size: 6, endpoints: [[1,0,3,2,5],[2,3,0,2,0],[3,2,2,2,3],[4,3,5,4,4],[5,5,1,5,2]] },
  { size: 6, endpoints: [[1,1,2,1,1],[2,5,3,4,0],[3,1,5,0,5],[4,0,0,3,2],[5,4,5,2,4],[6,5,0,5,2]] },
  { size: 7, endpoints: [[1,0,4,0,0],[2,3,1,4,4],[3,1,2,3,2],[4,5,2,5,1],[5,4,6,0,5],[6,6,0,1,0]] },
  { size: 7, endpoints: [[1,4,5,5,5],[2,6,2,6,3],[3,0,1,2,4],[4,3,3,3,6],[5,1,4,1,5],[6,5,0,2,0],[7,6,6,6,0]] },
  { size: 8, endpoints: [[1,4,4,0,6],[2,4,0,0,3],[3,6,5,3,6],[4,2,5,5,5],[5,1,3,1,2],[6,6,1,7,2],[7,7,3,5,7]] },
  { size: 8, endpoints: [[1,0,1,3,4],[2,1,7,0,7],[3,2,3,2,2],[4,6,6,4,5],[5,3,5,1,5],[6,0,5,0,2],[7,4,7,3,7],[8,4,2,6,3]] },
  { size: 9, endpoints: [[1,7,6,7,4],[2,3,2,3,3],[3,1,0,1,1],[4,6,8,3,8],[5,2,5,1,5],[6,7,1,8,4],[7,4,0,5,5],[8,5,4,4,6]] },
  { size: 9, endpoints: [[1,1,1,3,2],[2,7,6,8,8],[3,2,7,2,6],[4,5,4,6,5],[5,8,2,8,3],[6,5,1,0,2],[7,0,8,4,8],[8,6,8,6,3],[9,3,3,2,3]] },
];

const DIRS = [[-1,0],[1,0],[0,-1],[0,1]];

function solve(level, timeoutMs = 10000) {
  const { size, endpoints } = level;
  const grid = Array.from({length:size}, () => new Array(size).fill(0));
  for (const [num,r1,c1,r2,c2] of endpoints) { grid[r1][c1]=num; grid[r2][c2]=num; }
  const state = {};
  for (const [num,r1,c1,r2,c2] of endpoints)
    state[num] = { path:[[r1,c1]], target:[r2,c2], done:false };
  const totalCells = size*size, startTime = Date.now();

  function countFilled() {
    let n=0; for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(grid[r][c]) n++; return n;
  }
  function isConnected() {
    let e=0; for(let r=0;r<size;r++) for(let c=0;c<size;c++) if(!grid[r][c]) e++;
    if (!e) return true;
    const vis=new Set(), q=[];
    for (const [num] of endpoints) {
      if (state[num].done) continue;
      const [hr,hc]=state[num].path[state[num].path.length-1];
      for (const [dr,dc] of DIRS) {
        const nr=hr+dr,nc=hc+dc;
        if(nr<0||nr>=size||nc<0||nc>=size) continue;
        if(!grid[nr][nc]){const k=`${nr},${nc}`;if(!vis.has(k)){vis.add(k);q.push([nr,nc]);}}
      }
    }
    while(q.length){
      const[r,c]=q.shift();
      for(const[dr,dc]of DIRS){
        const nr=r+dr,nc=c+dc;
        if(nr<0||nr>=size||nc<0||nc>=size)continue;
        const k=`${nr},${nc}`;
        if(!grid[nr][nc]&&!vis.has(k)){vis.add(k);q.push([nr,nc]);}
      }
    }
    return vis.size===e;
  }
  function getMostConstrained() {
    let best=null,bestOpts=Infinity;
    for(const[num]of endpoints){
      if(state[num].done)continue;
      const[hr,hc]=state[num].path[state[num].path.length-1];
      const[tr,tc]=state[num].target;
      let opts=0;
      for(const[dr,dc]of DIRS){
        const nr=hr+dr,nc=hc+dc;
        if(nr<0||nr>=size||nc<0||nc>=size)continue;
        if(!grid[nr][nc]||(nr===tr&&nc===tc))opts++;
      }
      if(opts<bestOpts){bestOpts=opts;best=num;}
    }
    return best;
  }
  function bt(){
    if(Date.now()-startTime>timeoutMs)return'timeout';
    const num=getMostConstrained();
    if(num===null)return countFilled()===totalCells;
    const st=state[num];
    const[hr,hc]=st.path[st.path.length-1];
    const[tr,tc]=st.target;
    for(const[dr,dc]of DIRS){
      const nr=hr+dr,nc=hc+dc;
      if(nr<0||nr>=size||nc<0||nc>=size)continue;
      if(nr===tr&&nc===tc){
        st.path.push([nr,nc]);st.done=true;
        if(isConnected()){const r=bt();if(r===true||r==='timeout')return r;}
        st.path.pop();st.done=false;
      }else if(!grid[nr][nc]){
        grid[nr][nc]=num;st.path.push([nr,nc]);
        if(isConnected()){const r=bt();if(r===true||r==='timeout')return r;}
        st.path.pop();grid[nr][nc]=0;
      }
    }
    return false;
  }
  const r=bt();
  if(r===true)return{ok:true,grid};
  return{ok:false,reason:r==='timeout'?'timeout':'no solution'};
}

function printGrid(grid, size) {
  for(let r=0;r<size;r++)
    console.log('    '+grid[r].map(v=>String(v).padStart(2)).join(' '));
}

console.log('=== 새 퍼즐 최종 검증 ===\n');
let pass=0, fail=0;
LEVELS.forEach((level,i)=>{
  process.stdout.write(`레벨 ${i+1} (${level.size}×${level.size}) ... `);
  const res=solve(level);
  if(res.ok){
    console.log('✓');
    printGrid(res.grid, level.size);
    pass++;
  } else {
    console.log(`✗ (${res.reason})`);
    fail++;
  }
  console.log();
});
console.log(`결과: ${pass}/10 통과${fail?` (실패 ${fail}개)`:' 🎉'}`);
