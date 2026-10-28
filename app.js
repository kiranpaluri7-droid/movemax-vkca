import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const GLYPHS = {wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
const PIECES = [{color:"w",type:"k"},{color:"w",type:"q"},{color:"w",type:"r"},{color:"w",type:"b"},{color:"w",type:"n"},{color:"w",type:"p"},{color:"b",type:"k"},{color:"b",type:"q"},{color:"b",type:"r"},{color:"b",type:"b"},{color:"b",type:"n"},{color:"b",type:"p"}];
let game = new Chess(), history = [], redoStack = [], flipped = false, selected = null, lastMove = null, pendingPromotion = null;
let setupBoard = emptyBoard(), setupSelected = {color:"w",type:"q"}, setupFlipped=false;
let analysisGame = new Chess(), analysisHistory=[], analysisRedo=[], analysisFlipped=false, analysisSelected=null, analysisLast=null;
let toastTimer;
function emptyBoard(){return Array.from({length:8},()=>Array(8).fill(null));}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2400);}
function sqName(r,c){return "abcdefgh"[c]+(8-r);}
function boardArray(chess){const b=emptyBoard();const rows=chess.board();rows.forEach((row,r)=>row.forEach((p,c)=>{if(p)b[r][c]={color:p.color,type:p.type};}));return b;}
function stateText(chess){
  if(chess.isCheckmate()) return `Checkmate — ${chess.turn()==="w"?"Black":"White"} wins.`;
  if(chess.isStalemate()) return "Draw — stalemate.";
  if(chess.isThreefoldRepetition()) return "Draw claim available — threefold repetition.";
  if(chess.isDraw()) return "Draw — game-ending draw condition.";
  return `${chess.turn()==="w"?"White":"Black"} to move${chess.isCheck()?" · Check":""}`;
}
function legalTargets(chess,from){return chess.moves({square:from,verbose:true}).map(m=>m.to);}
function renderBoard(el,chess,orientation,selection,last){
  const board=chess.board();el.innerHTML="";
  const checkedKing=chess.isCheck()?findKing(board,chess.turn()):null;
  for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){
    const r=orientation?7-vr:vr,c=orientation?7-vc:vc,p=board[r][c],sq=sqName(r,c);
    const btn=document.createElement("button");btn.type="button";btn.className="square "+(((r+c)%2===0)?"light":"dark");
    btn.dataset.square=sq;btn.setAttribute("aria-label",`${sq}${p?`, ${p.color==="w"?"White":"Black"} ${p.type}`:""}`);
    if(selection===sq)btn.classList.add("selected");
    if(last&&(last.from===sq||last.to===sq))btn.classList.add("last");
    if(checkedKing===sq)btn.classList.add("check");
    if(selection&&legalTargets(chess,selection).includes(sq)){const hint=document.createElement("span");hint.className=p?"capture-hint":"dot";btn.append(hint);}
    if(p){const span=document.createElement("span");span.className="piece "+(p.color==="w"?"white":"black");span.textContent=GLYPHS[p.color+p.type];btn.append(span);}
    if(vc===0){const co=document.createElement("span");co.className="coord rank";co.textContent=8-r;btn.append(co);}
    if(vr===7){const co=document.createElement("span");co.className="coord file";co.textContent="abcdefgh"[c];btn.append(co);}
    el.append(btn);
  }
}
function findKing(board,color){for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]?.type==="k"&&board[r][c].color===color)return sqName(r,c);return null;}
function currentSnapshot(){return {fen:game.fen(),pgn:game.pgn(),lastMove:lastMove?{...lastMove}:null};}
function pushSnapshot(snapshot=currentSnapshot()){history.push(snapshot);if(history.length>250)history.shift();redoStack=[];}
function renderPlay(){
  renderBoard($("#board"),game,flipped,selected,lastMove);
  $("#status").textContent=stateText(game);
  renderMoves();
  $("#undoBtn").disabled=history.length===0;
  $("#redoBtn").disabled=redoStack.length===0;
}
function renderMoves(){
 const list=$("#moves");const san=game.history();
 if(!san.length){list.textContent="No moves yet";return;}
 list.innerHTML="";
 for(let i=0;i<san.length;i+=2){const pair=document.createElement("span");pair.className="move-pair";const n=document.createElement("span");n.className="move-number";n.textContent=(Math.floor(i/2)+1)+". ";pair.append(n,document.createTextNode(san[i]));if(san[i+1])pair.append(document.createTextNode(" "+san[i+1]));list.append(pair);}
}
function maybePromotion(chess,from,to){const p=chess.get(from);return p?.type==="p"&&((p.color==="w"&&to[1]==="8")||(p.color==="b"&&to[1]==="1"));}
function openPromotion(color,callback){pendingPromotion={color,callback};const box=$("#promotionChoices");box.innerHTML="";for(const type of ["q","r","b","n"]){const b=document.createElement("button");b.className="promo-btn";b.type="button";b.textContent=GLYPHS[color+type];b.setAttribute("aria-label",({q:"Queen",r:"Rook",b:"Bishop",n:"Knight"})[type]);b.addEventListener("click",()=>{const pending=pendingPromotion;pendingPromotion=null;$("#promotionModal").classList.add("hidden");pending.callback(type);});box.append(b);}$("#promotionModal").classList.remove("hidden");}
function tryPlay(chess,from,to,onSuccess){
 const opts=chess.moves({square:from,verbose:true}).filter(m=>m.to===to);
 if(!opts.length){toast("That move is not legal.");return false;}
 if(maybePromotion(chess,from,to)){openPromotion(chess.get(from).color,(promotion)=>{const move=chess.move({from,to,promotion});if(move)onSuccess(move);});return true;}
 const move=chess.move({from,to});if(move)onSuccess(move);return !!move;
}
function boardClick(event){
 const btn=event.target.closest(".square");if(!btn)return;const to=btn.dataset.square;
 const p=game.get(to);
 if(selected){if(selected===to){selected=null;renderPlay();return;}
   const from=selected;
   const legal=game.moves({square:from,verbose:true}).some(m=>m.to===to);
   if(legal){const before=currentSnapshot();tryPlay(game,from,to,move=>{pushSnapshot(before);lastMove={from:move.from,to:move.to};selected=null;renderPlay();});return;}
 }
 if(p&&p.color===game.turn()){selected=to;}else selected=null;
 renderPlay();
}
function undoGame(){if(!history.length)return;redoStack.push({fen:game.fen(),pgn:game.pgn(),lastMove:lastMove?{...lastMove}:null});const snap=history.pop();game.load(snap.fen);lastMove=snap.lastMove;selected=null;renderPlay();}
function redoGame(){if(!redoStack.length)return;history.push({fen:game.fen(),pgn:game.pgn(),lastMove:lastMove?{...lastMove}:null});const snap=redoStack.pop();game.load(snap.fen);lastMove=snap.lastMove;selected=null;renderPlay();}
function setView(view){$$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===view));$("#playView").classList.toggle("hidden",view!=="play");$("#setupView").classList.toggle("hidden",view!=="setup");$("#analysisView").classList.toggle("hidden",view!=="analysis");if(view==="play")renderPlay();if(view==="setup")renderSetup();if(view==="analysis")renderAnalysis();}
$$(".tab").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
$("#board").addEventListener("click",boardClick);
$("#resetBtn").addEventListener("click",()=>{game.reset();history=[];redoStack=[];lastMove=null;selected=null;renderPlay();});
$("#flipBtn").addEventListener("click",()=>{flipped=!flipped;renderPlay();});
$("#undoBtn").addEventListener("click",undoGame);$("#redoBtn").addEventListener("click",redoGame);
$("#copyPgnBtn").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(game.pgn());toast("PGN copied.");}catch{toast("Clipboard access unavailable. Select and copy from your browser if needed.");}});
$("#themeBtn").addEventListener("click",()=>document.body.classList.toggle("light-mode"));

/* Custom Setup */
function renderTray(){const tray=$("#pieceTray");tray.innerHTML="";for(const p of PIECES){const b=document.createElement("button");b.type="button";b.className="tray-piece";b.textContent=GLYPHS[p.color+p.type];b.title=(p.color==="w"?"White ":"Black ")+p.type;b.classList.toggle("selected",setupSelected.color===p.color&&setupSelected.type===p.type);b.addEventListener("click",()=>{setupSelected={...p};renderTray();});tray.append(b);}const er=document.createElement("button");er.type="button";er.className="tray-piece";er.textContent="⌫";er.title="Eraser";er.classList.toggle("selected",setupSelected.type==="erase");er.addEventListener("click",()=>{setupSelected={color:"w",type:"erase"};renderTray();});tray.append(er);}
function renderSetup(){renderTray();const el=$("#setupBoard");el.innerHTML="";for(let vr=0;vr<8;vr++)for(let vc=0;vc<8;vc++){const r=setupFlipped?7-vr:vr,c=setupFlipped?7-vc:vc,sq=sqName(r,c),p=setupBoard[r][c];const btn=document.createElement("button");btn.type="button";btn.className="square "+(((r+c)%2===0)?"light":"dark");btn.dataset.square=sq;if(p){const span=document.createElement("span");span.className="piece "+(p.color==="w"?"white":"black");span.textContent=GLYPHS[p.color+p.type];btn.append(span);}if(vc===0){const co=document.createElement("span");co.className="coord rank";co.textContent=8-r;btn.append(co);}if(vr===7){const co=document.createElement("span");co.className="coord file";co.textContent="abcdefgh"[c];btn.append(co);}btn.addEventListener("click",()=>{const rr=8-Number(sq[1]),cc="abcdefgh".indexOf(sq[0]);setupBoard[rr][cc]=setupSelected.type==="erase"?null:{...setupSelected};$("#setupStatus").textContent=`Updated ${sq}. Remember to validate the position before starting.`;renderSetup();});el.append(btn);} }
function setupToFen(){const rows=[];for(let r=0;r<8;r++){let row="",empty=0;for(let c=0;c<8;c++){const p=setupBoard[r][c];if(!p){empty++;continue;}if(empty){row+=empty;empty=0;}row+=p.color==="w"?p.type.toUpperCase():p.type;}if(empty)row+=empty;rows.push(row);}return `${rows.join("/")} ${$("#sideToMove").value} - - 0 1`;}
function loadSetupFen(fen){try{const temp=new Chess(fen);setupBoard=boardArray(temp);$("#sideToMove").value=temp.turn();$("#fenBox").value=temp.fen();$("#setupStatus").textContent="FEN imported. Validate before starting play.";renderSetup();return true;}catch(e){$("#setupStatus").textContent="Invalid FEN: "+e.message;return false;}}
$("#clearBtn").addEventListener("click",()=>{setupBoard=emptyBoard();$("#setupStatus").textContent="Board cleared. Place both Kings before validating.";renderSetup();});
$("#standardBtn").addEventListener("click",()=>{const temp=new Chess();setupBoard=boardArray(temp);$("#sideToMove").value="w";$("#setupStatus").textContent="Standard starting position restored.";renderSetup();});
$("#flipSetupBtn").addEventListener("click",()=>{setupFlipped=!setupFlipped;renderSetup();});
$("#importFenBtn").addEventListener("click",()=>loadSetupFen($("#fenBox").value.trim()));
$("#exportFenBtn").addEventListener("click",()=>{const fen=setupToFen();$("#fenBox").value=fen;toast("FEN generated from the current piece layout.");});
$("#validateBtn").addEventListener("click",()=>{const fen=setupToFen();try{const temp=new Chess(fen);$("#setupStatus").textContent=temp.isCheckmate()?"Position is valid but already checkmate.":temp.isStalemate()?"Position is valid but already stalemate.":"FEN accepted by the chess rules library. Check the position visually before continuing.";$("#fenBox").value=fen;}catch(e){$("#setupStatus").textContent="Position cannot be loaded: "+e.message;}});
$("#startSetupBtn").addEventListener("click",()=>{const fen=setupToFen();try{game=new Chess(fen);history=[];redoStack=[];selected=null;lastMove=null;renderPlay();setView("play");toast("Custom position loaded.");}catch(e){$("#setupStatus").textContent="Cannot start from this position: "+e.message;}});
$("#analyseSetupBtn").addEventListener("click",()=>{const fen=setupToFen();try{analysisGame=new Chess(fen);analysisHistory=[];analysisRedo=[];analysisLast=null;analysisSelected=null;renderAnalysis();setView("analysis");}catch(e){$("#setupStatus").textContent="Cannot analyse this position: "+e.message;}});
$("#setupBoard").addEventListener("click",()=>{});
/* Analysis mode */
function renderAnalysis(){renderBoard($("#analysisBoard"),analysisGame,analysisFlipped,analysisSelected,analysisLast);$("#analysisStatus").textContent=stateText(analysisGame);$("#analysisFen").value=analysisGame.fen();}
$("#analysisBoard").addEventListener("click",e=>{const btn=e.target.closest(".square");if(!btn)return;const to=btn.dataset.square,p=analysisGame.get(to);if(analysisSelected){if(analysisSelected===to){analysisSelected=null;renderAnalysis();return;}if(analysisGame.moves({square:analysisSelected,verbose:true}).some(m=>m.to===to)){const from=analysisSelected;const before={fen:analysisGame.fen(),last:analysisLast?{...analysisLast}:null};tryPlay(analysisGame,from,to,move=>{analysisHistory.push(before);analysisRedo=[];analysisLast={from:move.from,to:move.to};analysisSelected=null;renderAnalysis();});return;}}analysisSelected=p&&p.color===analysisGame.turn()?to:null;renderAnalysis();});
$("#analysisUndoBtn").addEventListener("click",()=>{if(!analysisHistory.length)return;analysisRedo.push({fen:analysisGame.fen(),last:analysisLast});const s=analysisHistory.pop();analysisGame.load(s.fen);analysisLast=s.last;renderAnalysis();});
$("#analysisRedoBtn").addEventListener("click",()=>{if(!analysisRedo.length)return;analysisHistory.push({fen:analysisGame.fen(),last:analysisLast});const s=analysisRedo.pop();analysisGame.load(s.fen);analysisLast=s.last;renderAnalysis();});
$("#analysisFlipBtn").addEventListener("click",()=>{analysisFlipped=!analysisFlipped;renderAnalysis();});
$("#analysisResetBtn").addEventListener("click",()=>{analysisGame.reset();analysisHistory=[];analysisRedo=[];analysisLast=null;analysisSelected=null;renderAnalysis();});
$("#refreshAnalysisFen").addEventListener("click",()=>{$("#analysisFen").value=analysisGame.fen();toast("FEN refreshed.");});
$("#analysisToSetup").addEventListener("click",()=>{setupBoard=boardArray(analysisGame);$("#sideToMove").value=analysisGame.turn();$("#fenBox").value=analysisGame.fen();setView("setup");});
/* Initial state */
setupBoard=boardArray(new Chess());renderPlay();renderSetup();renderAnalysis();
