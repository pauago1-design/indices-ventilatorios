import { useState, useEffect, useRef } from "react";
import { db } from "./firebase";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

const FLUO = ["#39FF14","#FF6EC7","#FFD700","#00FFFF","#FF4500","#ADFF2F","#B44FFF"];
const INDICES_GRAF = [
  { key:"aA", label:"a/A", color:"#39FF14" },
  { key:"IO", label:"IO", color:"#FF6EC7" },
  { key:"IV", label:"IV", color:"#FFD700" },
  { key:"Aa", label:"A-a", color:"#00FFFF" },
  { key:"MAP", label:"MAP", color:"#FF4500" },
];

function calcEdad(fn, egSem) {
  if (!fn || !egSem) return { diasVida: null, egCorr: "-" };
  const diff = Math.floor((new Date() - new Date(fn)) / 86400000);
  const tot = parseInt(egSem) * 7 + diff;
  return { diasVida: diff, egCorr: `${Math.floor(tot / 7)}+${tot % 7} sem` };
}

const emptyReg = {
  fecha: new Date().toISOString().slice(0, 10),
  pim:"", peep:"", ti:"", fr:"", fio2:"",
  po2:"", pco2:"",
  Te:"", MAP:"", PAO2:"", IO:"", IV:"", Aa:"", aA:""
};
const emptyPac = { nombre:"", fn:"", egSem:"", color: FLUO[0] };
const DOC_REF = doc(db, "neonatologia", "pacientes");

export default function App() {
  const [pacs, setPacs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sel, setSel] = useState(null);
  const [vista, setVista] = useState("mapa");
  const [tab, setTab] = useState("carga");
  const [formReg, setFormReg] = useState(emptyReg);
  const [formPac, setFormPac] = useState(emptyPac);
  const [formSurf, setFormSurf] = useState({ fecha: new Date().toISOString().slice(0,10), indiceDis:"" });
  const [idxSelec, setIdxSelec] = useState(["aA","IO"]);
  const [lastSync, setLastSync] = useState(null);
  const canvasRef = useRef(null);

  const pac = pacs.find(p => p.id === sel);

  useEffect(() => {
    const unsub = onSnapshot(DOC_REF, snap => {
      if (snap.exists()) setPacs(snap.data().lista || []);
      setLoading(false);
      setLastSync(new Date());
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (tab === "grafico" && pac) setTimeout(() => dibujarGrafico(), 50);
  }, [tab, sel, pacs, idxSelec]);

  async function guardarDatos(nuevos) {
    setSaving(true);
    try {
      await setDoc(DOC_REF, { lista: nuevos });
      setLastSync(new Date());
    } catch(e) { console.error("Error guardando:", e); }
    setSaving(false);
  }

  async function updatePacs(fn) {
    const nuevos = fn(pacs);
    setPacs(nuevos);
    await guardarDatos(nuevos);
  }

  function dibujarGrafico() {
    const canvas = canvasRef.current;
    if (!canvas || !pac) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0,0,W,H);
    const regs = [...pac.registros].sort((a,b) => a.fecha.localeCompare(b.fecha));
    if (!regs.length) {
      ctx.fillStyle="#333"; ctx.font="12px monospace";
      ctx.fillText("Sin datos", W/2-35, H/2); return;
    }
    const pad={t:24,r:12,b:44,l:48};
    const gW=W-pad.l-pad.r, gH=H-pad.t-pad.b, n=regs.length;
    const xOf=i=>pad.l+(n>1?i*(gW/(n-1)):gW/2);
    ctx.strokeStyle="#1e1e1e"; ctx.lineWidth=1;
    for(let i=0;i<=4;i++){const y=pad.t+gH/4*i;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(W-pad.r,y);ctx.stroke();}
    ctx.fillStyle="#444"; ctx.font="9px monospace"; ctx.textAlign="center";
    regs.forEach((r,i)=>ctx.fillText(r.fecha.slice(5),xOf(i),H-6));
    if (pac.surfactante?.fecha) {
      const si=regs.findIndex(r=>r.fecha===pac.surfactante.fecha);
      if(si>=0){
        const sx=xOf(si);
        ctx.save(); ctx.strokeStyle="#FFD700"; ctx.lineWidth=1.5; ctx.setLineDash([4,3]);
        ctx.beginPath(); ctx.moveTo(sx,pad.t); ctx.lineTo(sx,H-pad.b); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle="#FFD700"; ctx.font="9px monospace";
        ctx.fillText("SURF",sx,pad.t-6); ctx.restore();
      }
    }
    idxSelec.forEach(key=>{
      const cfg=INDICES_GRAF.find(i=>i.key===key); if(!cfg) return;
      const vals=regs.map(r=>{const v=parseFloat(r[key]);return isNaN(v)?null:v;});
      const clean=vals.filter(v=>v!==null); if(!clean.length) return;
      const mn=Math.min(...clean),mx=Math.max(...clean),rng=mx-mn||1;
      const yOf=v=>pad.t+gH-((v-mn)/rng)*gH*0.85-gH*0.075;
      ctx.strokeStyle=cfg.color; ctx.lineWidth=2; ctx.lineJoin="round";
      ctx.beginPath(); let first=true;
      vals.forEach((v,i)=>{if(v===null)return;first?(ctx.moveTo(xOf(i),yOf(v)),first=false):ctx.lineTo(xOf(i),yOf(v));});
      ctx.stroke();
      ctx.fillStyle=cfg.color;
      vals.forEach((v,i)=>{if(v===null)return;ctx.beginPath();ctx.arc(xOf(i),yOf(v),3,0,Math.PI*2);ctx.fill();});
      ctx.font="9px monospace"; ctx.textAlign="center";
      vals.forEach((v,i)=>{if(v===null)return;ctx.fillText(v,xOf(i),yOf(v)-7);});
    });
  }

  function openNewPac(){setFormPac({...emptyPac,color:FLUO[pacs.length%FLUO.length]});setVista("newPac");}
  function openEditPac(){setFormPac({nombre:pac.nombre,fn:pac.fn,egSem:pac.egSem,color:pac.color});setVista("editPac");}

  async function guardarNuevoPac(){
    if(!formPac.nombre)return;
    await updatePacs(prev=>[...prev,{...formPac,id:Date.now(),registros:[],surfactante:null}]);
    setVista("mapa");
  }
  async function guardarEditPac(){
    await updatePacs(prev=>prev.map(p=>p.id===sel?{...p,...formPac}:p));
    setVista("ficha");
  }
  async function borrarPac(id){
    await updatePacs(prev=>prev.filter(p=>p.id!==id));
    setSel(null); setVista("mapa");
  }
  async function guardarReg(){
    const reg={...formReg};
    await updatePacs(prev=>prev.map(p=>p.id===sel
      ?{...p,registros:[...p.registros.filter(r=>r.fecha!==reg.fecha),reg].sort((a,b)=>a.fecha.localeCompare(b.fecha))}
      :p));
    setFormReg({...emptyReg,fecha:formReg.fecha});
  }
  async function guardarSurf(){
    await updatePacs(prev=>prev.map(p=>p.id===sel?{...p,surfactante:{...formSurf}}:p));
  }
  async function borrarSurf(){
    await updatePacs(prev=>prev.map(p=>p.id===sel?{...p,surfactante:null}:p));
  }

  function toggleIdx(key){setIdxSelec(prev=>prev.includes(key)?prev.filter(k=>k!==key):[...prev,key]);}
  const setR=(f,v)=>setFormReg(r=>({...r,[f]:v}));
  const syncStr=lastSync?`${lastSync.getHours()}:${String(lastSync.getMinutes()).padStart(2,"0")}`:"-";

  const inp={background:"#111",border:"1px solid #2a2a2a",color:"#fff",padding:"6px 10px",borderRadius:6,width:"100%",fontSize:13,boxSizing:"border-box"};

  if(loading) return(
    <div style={{background:"#0a0a0a",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"monospace"}}>
      <div style={{color:"#39FF14",fontSize:22,marginBottom:12}}>🫁</div>
      <div style={{color:"#39FF14",fontSize:14,letterSpacing:2}}>Conectando...</div>
      <div style={{color:"#333",fontSize:11,marginTop:8}}>Firebase Firestore</div>
    </div>
  );

  if(vista==="newPac"||vista==="editPac"){
    const esNuevo=vista==="newPac";
    return(
      <div style={{background:"#0a0a0a",minHeight:"100vh",padding:16,fontFamily:"monospace"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
          <button onClick={()=>setVista(esNuevo?"mapa":"ficha")} style={{background:"none",border:"none",color:"#aaa",fontSize:20,cursor:"pointer"}}>←</button>
          <span style={{color:formPac.color||"#39FF14",fontWeight:"bold",fontSize:16}}>{esNuevo?"Nuevo paciente":"Editar paciente"}</span>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><div style={{color:"#888",fontSize:11,marginBottom:3}}>Nombre / ID</div>
            <input value={formPac.nombre||""} onChange={e=>setFormPac(fp=>({...fp,nombre:e.target.value}))} style={inp}/></div>
          <div><div style={{color:"#888",fontSize:11,marginBottom:3}}>Fecha de nacimiento</div>
            <input type="date" value={formPac.fn||""} onChange={e=>setFormPac(fp=>({...fp,fn:e.target.value}))} style={inp}/></div>
          <div><div style={{color:"#888",fontSize:11,marginBottom:3}}>EG semanas</div>
            <input type="number" value={formPac.egSem||""} onChange={e=>setFormPac(fp=>({...fp,egSem:e.target.value}))} style={inp}/></div>
          <div><div style={{color:"#888",fontSize:11,marginBottom:6}}>Color</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {FLUO.map(c=><div key={c} onClick={()=>setFormPac(fp=>({...fp,color:c}))}
                style={{width:30,height:30,borderRadius:"50%",background:c,cursor:"pointer",border:formPac.color===c?"3px solid #fff":"3px solid #0a0a0a",boxSizing:"border-box"}}/>)}
            </div></div>
          <button onClick={esNuevo?guardarNuevoPac:guardarEditPac} disabled={saving}
            style={{background:saving?"#333":formPac.color,color:"#000",border:"none",padding:11,borderRadius:8,fontWeight:"bold",fontSize:15,cursor:"pointer"}}>
            {saving?"Guardando...":(esNuevo?"Agregar paciente":"Guardar cambios")}
          </button>
          {!esNuevo&&<button onClick={()=>borrarPac(sel)}
            style={{background:"none",border:"1px solid #FF4500",color:"#FF4500",padding:9,borderRadius:8,fontSize:13,cursor:"pointer"}}>
            Eliminar paciente
          </button>}
        </div>
      </div>
    );
  }

  if(vista==="mapa") return(
    <div style={{background:"#0a0a0a",minHeight:"100vh",padding:14,fontFamily:"monospace"}}>
      <div style={{textAlign:"center",marginBottom:14}}>
        <div style={{color:"#39FF14",fontSize:20,fontWeight:"bold",letterSpacing:2}}>🫁 ÍNDICES VENT.</div>
        <div style={{color:"#333",fontSize:10}}>Neonatología · sync {syncStr}</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        {pacs.map(p=>{
          const{diasVida,egCorr}=calcEdad(p.fn,p.egSem);
          const ult=p.registros[p.registros.length-1];
          return(
            <div key={p.id} onClick={()=>{setSel(p.id);setVista("ficha");setTab("carga");}}
              style={{background:"#111",border:`2px solid ${p.color}`,borderRadius:10,padding:11,cursor:"pointer"}}>
              <div style={{color:p.color,fontWeight:"bold",fontSize:14,marginBottom:1}}>{p.nombre||"—"}</div>
              <div style={{color:"#444",fontSize:10,marginTop:4}}>
                <div>Días: <span style={{color:"#aaa"}}>{diasVida??"-"}</span></div>
                <div>EGc: <span style={{color:"#aaa"}}>{egCorr}</span></div>
              </div>
              {ult&&<div style={{marginTop:6,borderTop:"1px solid #222",paddingTop:5,display:"flex",gap:8}}>
                <span style={{color:"#39FF14",fontSize:11}}>a/A {ult.aA||"-"}</span>
                <span style={{color:"#FF6EC7",fontSize:11}}>IO {ult.IO||"-"}</span>
              </div>}
              {p.surfactante?.fecha&&<div style={{marginTop:4}}>
                <span style={{background:"#FFD70022",color:"#FFD700",fontSize:9,padding:"2px 6px",borderRadius:4}}>SURF ✓</span>
              </div>}
            </div>
          );
        })}
        <div onClick={openNewPac}
          style={{background:"#111",border:"2px dashed #2a2a2a",borderRadius:10,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",minHeight:90}}>
          <span style={{color:"#333",fontSize:32}}>+</span>
        </div>
      </div>
      <div style={{color:"#2a2a2a",fontSize:10,textAlign:"center"}}>{pacs.length} paciente{pacs.length!==1?"s":""} · tiempo real</div>
    </div>
  );

  if(!pac) return null;
  const{diasVida,egCorr}=calcEdad(pac.fn,pac.egSem);

  const numIn=(field,label,color="#666",unit="")=>(
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:7}}>
      <label style={{color,fontSize:12,width:90,flexShrink:0}}>{label}</label>
      <input type="number" value={formReg[field]} onChange={e=>setR(field,e.target.value)}
        style={{background:"#111",border:`1px solid ${color}44`,color:"#fff",padding:"5px 8px",borderRadius:6,width:80,fontSize:13}}/>
      {unit&&<span style={{color:"#333",fontSize:11}}>{unit}</span>}
    </div>
  );

  return(
    <div style={{background:"#0a0a0a",minHeight:"100vh",padding:12,fontFamily:"monospace"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <button onClick={()=>setVista("mapa")} style={{background:"none",border:"none",color:"#aaa",fontSize:20,cursor:"pointer"}}>←</button>
        <div style={{flex:1}}>
          <span style={{color:pac.color,fontWeight:"bold",fontSize:16}}>{pac.nombre}</span>
        </div>
        {saving&&<span style={{color:"#555",fontSize:10}}>Guardando...</span>}
        <button onClick={openEditPac} style={{background:"none",border:`1px solid ${pac.color}44`,color:pac.color,padding:"4px 10px",borderRadius:6,fontSize:11,cursor:"pointer"}}>Editar</button>
      </div>

      <div style={{background:"#111",borderRadius:8,padding:10,marginBottom:10,display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        <div><div style={{color:"#444",fontSize:10}}>Días de vida</div><div style={{color:"#39FF14",fontSize:18,fontWeight:"bold"}}>{diasVida??"-"}</div></div>
        <div><div style={{color:"#444",fontSize:10}}>EG corregida</div><div style={{color:"#00FFFF",fontSize:14,fontWeight:"bold"}}>{egCorr}</div></div>
        <div><div style={{color:"#444",fontSize:10}}>EG al nacer</div><div style={{color:"#aaa",fontSize:13}}>{pac.egSem} sem</div></div>
        <div><div style={{color:"#444",fontSize:10}}>FN</div><div style={{color:"#aaa",fontSize:12}}>{pac.fn||"-"}</div></div>
      </div>

      <div style={{display:"flex",background:"#111",borderRadius:8,overflow:"hidden",marginBottom:12}}>
        {[["carga","Carga"],["grafico","Gráfico"],["surf","Surfactante"]].map(([t,l])=>(
          <button key={t} onClick={()=>setTab(t)}
            style={{flex:1,padding:"8px 0",background:tab===t?pac.color:"transparent",color:tab===t?"#000":"#555",border:"none",cursor:"pointer",fontSize:11,fontWeight:tab===t?"bold":"normal"}}>
            {l}
          </button>
        ))}
      </div>

      {tab==="carga"&&(
        <div>
          <div style={{marginBottom:10}}>
            <div style={{color:"#555",fontSize:11,marginBottom:3}}>Fecha</div>
            <input type="date" value={formReg.fecha} onChange={e=>setR("fecha",e.target.value)} style={inp}/>
          </div>
          <div style={{color:pac.color,fontSize:11,fontWeight:"bold",marginBottom:8,letterSpacing:1}}>— ARM —</div>
          {numIn("pim","PIM",pac.color,"cmH₂O")}
          {numIn("peep","PEEP",pac.color,"cmH₂O")}
          {numIn("ti","Ti",pac.color,"seg")}
          {numIn("fr","Fr",pac.color,"rpm")}
          {numIn("fio2","FiO₂",pac.color,"%")}
          <div style={{color:"#FF6EC7",fontSize:11,fontWeight:"bold",marginBottom:8,marginTop:12,letterSpacing:1}}>— GASES —</div>
          {numIn("po2","PO₂","#FF6EC7","mmHg")}
          {numIn("pco2","PCO₂","#FF6EC7","mmHg")}
          <div style={{color:"#FFD700",fontSize:11,fontWeight:"bold",marginBottom:8,marginTop:12,letterSpacing:1}}>— ÍNDICES (manual) —</div>
          <div style={{background:"#111",borderRadius:8,padding:12,border:"1px solid #FFD70033"}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["Te","Te","#00FFFF","seg"],["MAP","MAP","#FF4500",""],["PAO2","PAO₂","#ADFF2F","mmHg"],["IO","IO","#FF6EC7",""],["IV","IV","#FFD700",""],["Aa","A-a","#00FFFF",""],["aA","a/A","#39FF14",""]].map(([field,label,color,unit])=>(
                <div key={field}>
                  <div style={{color,fontSize:10,marginBottom:3}}>{label}{unit?` (${unit})`:""}</div>
                  <input type="number" value={formReg[field]} onChange={e=>setR(field,e.target.value)}
                    style={{background:"#0a0a0a",border:`1px solid ${color}55`,color,padding:"6px 8px",borderRadius:6,width:"100%",fontSize:14,fontWeight:"bold",boxSizing:"border-box"}}/>
                </div>
              ))}
            </div>
          </div>
          <button onClick={guardarReg} disabled={saving}
            style={{background:saving?"#333":pac.color,color:"#000",border:"none",padding:11,borderRadius:8,fontWeight:"bold",fontSize:14,cursor:"pointer",marginTop:14,width:"100%"}}>
            {saving?"Guardando...":"Guardar registro"}
          </button>
        </div>
      )}

      {tab==="grafico"&&(
        <div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
            {INDICES_GRAF.map(idx=>(
              <button key={idx.key} onClick={()=>toggleIdx(idx.key)}
                style={{background:idxSelec.includes(idx.key)?idx.color+"22":"#111",border:`1px solid ${idxSelec.includes(idx.key)?idx.color:"#333"}`,color:idxSelec.includes(idx.key)?idx.color:"#555",padding:"4px 10px",borderRadius:20,fontSize:11,cursor:"pointer"}}>
                {idx.label}
              </button>
            ))}
          </div>
          <canvas ref={canvasRef} width={340} height={210}
            style={{background:"#0a0a0a",borderRadius:8,border:"1px solid #1e1e1e",display:"block",width:"100%",marginBottom:10}}/>
          {pac.surfactante?.fecha&&(
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
              <div style={{width:20,borderTop:"2px dashed #FFD700"}}/>
              <span style={{color:"#FFD700",fontSize:11}}>Surfactante {pac.surfactante.fecha}</span>
            </div>
          )}
          <div style={{overflowX:"auto",borderRadius:8,border:"1px solid #1e1e1e"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,minWidth:340}}>
              <thead>
                <tr style={{background:"#111"}}>
                  {["Fecha","FiO₂","PO₂","PCO₂","MAP","a/A","IO","A-a","IV"].map(h=>(
                    <th key={h} style={{color:"#555",padding:"6px 8px",textAlign:"center",borderBottom:"1px solid #1e1e1e",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...pac.registros].sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(r=>{
                  const aAv=parseFloat(r.aA),IOv=parseFloat(r.IO);
                  const cAA=aAv<0.1?"#FF4500":aAv<0.22?"#FF6EC7":aAv<0.7?"#FFD700":"#39FF14";
                  const cIO=IOv>40?"#FF4500":IOv>25?"#FF6EC7":IOv>10?"#FFD700":"#39FF14";
                  const esSurf=pac.surfactante?.fecha===r.fecha;
                  return(
                    <tr key={r.fecha} style={{borderBottom:"1px solid #141414",background:esSurf?"#FFD70011":"transparent"}}>
                      <td style={{color:esSurf?"#FFD700":"#aaa",padding:"5px 8px",textAlign:"center",whiteSpace:"nowrap"}}>{r.fecha.slice(5)}{esSurf?" 💉":""}</td>
                      <td style={{color:"#aaa",padding:"5px 8px",textAlign:"center"}}>{r.fio2||"-"}</td>
                      <td style={{color:"#aaa",padding:"5px 8px",textAlign:"center"}}>{r.po2||"-"}</td>
                      <td style={{color:"#aaa",padding:"5px 8px",textAlign:"center"}}>{r.pco2||"-"}</td>
                      <td style={{color:"#FF4500",padding:"5px 8px",textAlign:"center"}}>{r.MAP||"-"}</td>
                      <td style={{color:isNaN(aAv)?"#555":cAA,padding:"5px 8px",textAlign:"center",fontWeight:"bold"}}>{r.aA||"-"}</td>
                      <td style={{color:isNaN(IOv)?"#555":cIO,padding:"5px 8px",textAlign:"center",fontWeight:"bold"}}>{r.IO||"-"}</td>
                      <td style={{color:"#00FFFF",padding:"5px 8px",textAlign:"center"}}>{r.Aa||"-"}</td>
                      <td style={{color:"#FFD700",padding:"5px 8px",textAlign:"center"}}>{r.IV||"-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab==="surf"&&(
        <div>
          {pac.surfactante?.fecha&&(
            <div style={{background:"#FFD70015",border:"1px solid #FFD70066",borderRadius:10,padding:14,marginBottom:16}}>
              <div style={{color:"#FFD700",fontWeight:"bold",marginBottom:8}}>✓ Surfactante registrado</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <div><div style={{color:"#555",fontSize:10}}>Fecha</div><div style={{color:"#fff",fontSize:13}}>{pac.surfactante.fecha}</div></div>
                <div><div style={{color:"#555",fontSize:10}}>Índice</div><div style={{color:"#fff",fontSize:13}}>{pac.surfactante.indiceDis||"-"}</div></div>
              </div>
              <button onClick={borrarSurf}
                style={{marginTop:10,background:"none",border:"1px solid #444",color:"#555",padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11}}>
                Borrar registro
              </button>
            </div>
          )}
          <div style={{color:"#FF6EC7",fontSize:11,fontWeight:"bold",marginBottom:10,letterSpacing:1}}>— REGISTRAR SURFACTANTE —</div>
          <div style={{marginBottom:8}}>
            <div style={{color:"#666",fontSize:11,marginBottom:3}}>Fecha de indicación</div>
            <input type="date" value={formSurf.fecha} onChange={e=>setFormSurf(f=>({...f,fecha:e.target.value}))} style={inp}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{color:"#666",fontSize:11,marginBottom:3}}>Índice disparador</div>
            <select value={formSurf.indiceDis} onChange={e=>setFormSurf(f=>({...f,indiceDis:e.target.value}))}
              style={{...inp,padding:"6px 10px"}}>
              <option value="">Seleccionar...</option>
              <option>IO</option><option>a/A</option><option>A-a</option><option>IV</option><option>MAP</option>
            </select>
          </div>
          <button onClick={guardarSurf} disabled={saving}
            style={{background:saving?"#333":"#FFD700",color:"#000",border:"none",padding:11,borderRadius:8,fontWeight:"bold",fontSize:14,cursor:"pointer",width:"100%"}}>
            {saving?"Guardando...":"Guardar surfactante"}
          </button>
        </div>
      )}
    </div>
  );
}
