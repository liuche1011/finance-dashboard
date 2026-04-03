import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://isfalwpheehhuzpqhmjw.supabase.co",
  "sb_publishable_hphOtmKSy5cJIXvITDpQYw_sSlZYtG-"
);

const COLORS = ["#378ADD","#1D9E75","#EF9F27","#D4537E","#7F77DD","#639922","#D85A30","#888780"];

const initialTx = [
  { id:1, date:"2026-03-01", type:"income", category:"薪資", desc:"三月薪資", amount:65000 },
  { id:2, date:"2026-03-05", type:"expense", category:"餐飲", desc:"超市購物", amount:3200 },
  { id:3, date:"2026-03-10", type:"expense", category:"交通", desc:"悠遊卡加值", amount:1000 },
  { id:4, date:"2026-03-12", type:"expense", category:"娛樂", desc:"Netflix", amount:390 },
  { id:5, date:"2026-03-15", type:"expense", category:"住房", desc:"房租", amount:18000 },
  { id:6, date:"2026-02-01", type:"income", category:"薪資", desc:"二月薪資", amount:65000 },
  { id:7, date:"2026-02-08", type:"expense", category:"餐飲", desc:"餐廳聚餐", amount:2800 },
  { id:8, date:"2026-02-15", type:"expense", category:"住房", desc:"房租", amount:18000 },
  { id:9, date:"2026-01-01", type:"income", category:"薪資", desc:"一月薪資", amount:65000 },
  { id:10, date:"2026-01-15", type:"expense", category:"住房", desc:"房租", amount:18000 },
];

const initialDebts = [
  { id:1, name:"信用卡A", balance:85000, rate:15, minPay:2500 },
  { id:2, name:"信用卡B", balance:32000, rate:18, minPay:1000 },
  { id:3, name:"個人貸款", balance:250000, rate:6.5, minPay:5000 },
];

const initialGoals = [
  { id:1, name:"緊急預備金", target:200000, saved:80000 },
  { id:2, name:"出國旅遊基金", target:50000, saved:22000 },
];

const fmt = n => "NT$" + Math.round(n).toLocaleString();
const months = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];

export default function App() {
  const [tab, setTab] = useState("總覽");
  const [txs, setTxs] = useState([]);
  const [debts, setDebts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTx, setNewTx] = useState({ date: new Date().toISOString().slice(0,10), type:"expense", category:"餐飲", desc:"", amount:"" });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [t, d, g] = await Promise.all([
        supabase.from("transactions").select("*").order("date", { ascending: false }),
        supabase.from("debts").select("*").order("created_at"),
        supabase.from("goals").select("*").order("created_at"),
      ]);
      if (t.data) setTxs(t.data.map(r => ({ ...r, desc: r.description })));
      if (d.data) setDebts(d.data.map(r => ({ ...r, minPay: r.min_pay, rate: Number(r.rate) })));
      if (g.data) setGoals(g.data);
      setLoading(false);
    }
    loadData();
  }, []);
  const [newDebt, setNewDebt] = useState({ name:"", balance:"", rate:"", minPay:"" });
  const [newGoal, setNewGoal] = useState({ name:"", target:"", saved:"" });
  const [debtMethod, setDebtMethod] = useState("avalanche");
  const [extraPay, setExtraPay] = useState(5000);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState("");
  const [showAiModal, setShowAiModal] = useState(false);

  const tabs = ["總覽","收支記錄","儲蓄目標","負債管理","AI財務建議"];

  const thisMon = txs.filter(t => t.date.startsWith("2026-03"));
  const income = thisMon.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense = thisMon.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const totalDebt = debts.reduce((s,d)=>s+d.balance,0);

  const catData = useMemo(()=>{
    const map = {};
    thisMon.filter(t=>t.type==="expense").forEach(t=>{
      map[t.category]=(map[t.category]||0)+t.amount;
    });
    return Object.entries(map).map(([name,value])=>({name,value}));
  },[txs]);

  const trendData = useMemo(()=>{
    const arr = [];
    for(let m=1;m<=3;m++){
      const ms = `2026-0${m}`;
      const inc = txs.filter(t=>t.date.startsWith(ms)&&t.type==="income").reduce((s,t)=>s+t.amount,0);
      const exp = txs.filter(t=>t.date.startsWith(ms)&&t.type==="expense").reduce((s,t)=>s+t.amount,0);
      arr.push({ name:months[m-1], 收入:inc, 支出:exp });
    }
    return arr;
  },[txs]);

  const sortedDebts = useMemo(()=>{
    const d = [...debts];
    return debtMethod==="avalanche" ? d.sort((a,b)=>b.rate-a.rate) : d.sort((a,b)=>a.balance-b.balance);
  },[debts, debtMethod]);

  function calcPayoff(debt, extra=0) {
    let bal = debt.balance;
    const monthlyRate = debt.rate/100/12;
    const pay = debt.minPay + extra;
    let months = 0;
    while(bal > 0 && months < 600) {
      bal = bal * (1+monthlyRate) - pay;
      months++;
    }
    return months;
  }

  async function addTx() {
    if(!newTx.desc||!newTx.amount) return;
    const { data } = await supabase.from("transactions").insert([{ date: newTx.date, type: newTx.type, category: newTx.category, description: newTx.desc, amount: parseFloat(newTx.amount) }]).select();
    if (data) setTxs([...data.map(r=>({...r,desc:r.description})), ...txs]);
    setNewTx({ date: new Date().toISOString().slice(0,10), type:"expense", category:"餐飲", desc:"", amount:"" });
  }

  async function addDebt() {
    if(!newDebt.name||!newDebt.balance) return;
    const { data } = await supabase.from("debts").insert([{ name: newDebt.name, balance: parseFloat(newDebt.balance), rate: parseFloat(newDebt.rate)||0, min_pay: parseFloat(newDebt.minPay)||0 }]).select();
    if (data) setDebts([...debts, ...data.map(r=>({...r,minPay:r.min_pay}))]);
    setNewDebt({ name:"", balance:"", rate:"", minPay:"" });
  }

  async function addGoal() {
    if(!newGoal.name||!newGoal.target) return;
    const { data } = await supabase.from("goals").insert([{ name: newGoal.name, target: parseFloat(newGoal.target), saved: parseFloat(newGoal.saved)||0 }]).select();
    if (data) setGoals([...goals, ...data]);
    setNewGoal({ name:"", target:"", saved:"" });
  }

  async function getAiAdvice() {
    setAiLoading(true);
    setShowAiModal(true);
    setAiAdvice("");
    const summary = `
本月收入: ${fmt(income)}
本月支出: ${fmt(expense)}
本月結餘: ${fmt(income-expense)}
總負債: ${fmt(totalDebt)}
負債明細: ${debts.map(d=>`${d.name} 餘額${fmt(d.balance)} 年利率${d.rate}%`).join("、")}
儲蓄目標: ${goals.map(g=>`${g.name} 目標${fmt(g.target)} 已存${fmt(g.saved)}`).join("、")}
支出分類: ${catData.map(c=>`${c.name} ${fmt(c.value)}`).join("、")}
    `;
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:1000,
          system:"你是一位專業的台灣個人財務顧問，請用繁體中文給出具體、實用、友善的財務建議。格式：先給整體評估（2句），再列出3個具體行動建議（每項50字以內），最後給一句鼓勵。",
          messages:[{ role:"user", content:`請根據我的財務狀況給建議：\n${summary}` }]
        })
      });
      const data = await res.json();
      setAiAdvice(data.content?.[0]?.text || "無法取得建議，請稍後再試。");
    } catch(e) {
      setAiAdvice("連線失敗，請稍後再試。");
    }
    setAiLoading(false);
  }

  const s = {
    wrap: { fontFamily:"system-ui,sans-serif", padding:"0 0 2rem" },
    tabBar: { display:"flex", gap:4, borderBottom:"1px solid #e5e7eb", marginBottom:24, overflowX:"auto" },
    tab: (active) => ({ padding:"8px 14px", fontSize:13, fontWeight:active?500:400, color: active?"#111":"#6b7280", borderBottom: active?"2px solid #111":"2px solid transparent", background:"none", border:"none", borderRadius:0, cursor:"pointer", whiteSpace:"nowrap" }),
    card: { background:"#fff", border:"1px solid #e5e7eb", borderRadius:12, padding:"1rem 1.25rem", marginBottom:12 },
    metric: { background:"#f9fafb", borderRadius:8, padding:"1rem", flex:1, minWidth:120 },
    metricLabel: { fontSize:12, color:"#6b7280", marginBottom:4 },
    metricVal: { fontSize:22, fontWeight:500 },
    row: { display:"flex", gap:12, flexWrap:"wrap", marginBottom:16 },
    input: { padding:"6px 10px", fontSize:13, borderRadius:8, border:"1px solid #d1d5db", outline:"none" },
    btn: { padding:"7px 16px", fontSize:13, borderRadius:8, border:"1px solid #d1d5db", background:"#fff", cursor:"pointer" },
    sec: { fontSize:15, fontWeight:500, marginBottom:12 },
    overlay: { position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 },
    modal: { background:"#fff", borderRadius:16, padding:"1.5rem", maxWidth:480, width:"90%", border:"1px solid #e5e7eb" },
  };

  return (
    <div style={s.wrap}>
      <div style={{ padding:"1rem 1rem 0" }}>
        <div style={{ fontSize:18, fontWeight:500, marginBottom:16 }}>個人財務儀表板</div>
        <div style={s.tabBar}>
          {tabs.map(t=>(
            <button key={t} style={s.tab(tab===t)} onClick={()=>setTab(t)}>{t}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:"0 1rem" }}>

        {tab==="總覽" && (
          <>
            <div style={s.row}>
              {[["本月收入", fmt(income), "#1D9E75"],["本月支出", fmt(expense), "#D85A30"],["本月結餘", fmt(income-expense), income-expense>=0?"#1D9E75":"#D85A30"],["總負債", fmt(totalDebt), "#D4537E"]].map(([l,v,c])=>(
                <div key={l} style={s.metric}>
                  <div style={s.metricLabel}>{l}</div>
                  <div style={{...s.metricVal, color:c}}>{v}</div>
                </div>
              ))}
            </div>
            <div style={s.card}>
              <div style={s.sec}>收支趨勢</div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData}>
                  <XAxis dataKey="name" tick={{fontSize:12}} />
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>"$"+(v/1000)+"k"} />
                  <Tooltip formatter={v=>fmt(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="收入" stroke="#1D9E75" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="支出" stroke="#D85A30" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={s.card}>
              <div style={s.sec}>本月支出分類</div>
              {catData.length===0 ? <div style={{color:"#6b7280",fontSize:13}}>本月尚無支出記錄</div> : (
                <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                  <PieChart width={160} height={160}>
                    <Pie data={catData} cx={75} cy={75} innerRadius={45} outerRadius={70} dataKey="value">
                      {catData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                  <div style={{fontSize:13,display:"flex",flexDirection:"column",gap:6}}>
                    {catData.map((d,i)=>(
                      <div key={d.name} style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{width:10,height:10,borderRadius:2,background:COLORS[i%COLORS.length],display:"inline-block"}}></span>
                        <span style={{color:"#6b7280"}}>{d.name}</span>
                        <span style={{fontWeight:500}}>{fmt(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {tab==="收支記錄" && (
          <>
            <div style={s.card}>
              <div style={s.sec}>新增交易</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:8}}>
                <input style={{...s.input,width:130}} type="date" value={newTx.date} onChange={e=>setNewTx({...newTx,date:e.target.value})} />
                <select style={s.input} value={newTx.type} onChange={e=>setNewTx({...newTx,type:e.target.value})}>
                  <option value="income">收入</option>
                  <option value="expense">支出</option>
                </select>
                <select style={s.input} value={newTx.category} onChange={e=>setNewTx({...newTx,category:e.target.value})}>
                  {["薪資","餐飲","交通","住房","娛樂","醫療","購物","其他"].map(c=><option key={c}>{c}</option>)}
                </select>
                <input style={{...s.input,flex:1,minWidth:100}} placeholder="描述" value={newTx.desc} onChange={e=>setNewTx({...newTx,desc:e.target.value})} />
                <input style={{...s.input,width:100}} type="number" placeholder="金額" value={newTx.amount} onChange={e=>setNewTx({...newTx,amount:e.target.value})} />
                <button style={{...s.btn,background:"#eff6ff",color:"#1d4ed8"}} onClick={addTx}>新增</button>
              </div>
            </div>
            <div style={s.card}>
              <div style={s.sec}>交易記錄</div>
              <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{color:"#6b7280"}}>
                    {["日期","類型","分類","描述","金額",""].map(h=><th key={h} style={{textAlign:"left",padding:"6px 4px",borderBottom:"1px solid #e5e7eb",fontWeight:400}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...txs].sort((a,b)=>b.date.localeCompare(a.date)).map(t=>(
                    <tr key={t.id}>
                      <td style={{padding:"6px 4px",color:"#6b7280"}}>{t.date}</td>
                      <td style={{padding:"6px 4px"}}><span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:t.type==="income"?"#f0fdf4":"#fef2f2",color:t.type==="income"?"#15803d":"#dc2626"}}>{t.type==="income"?"收入":"支出"}</span></td>
                      <td style={{padding:"6px 4px"}}>{t.category}</td>
                      <td style={{padding:"6px 4px"}}>{t.desc}</td>
                      <td style={{padding:"6px 4px",fontWeight:500,color:t.type==="income"?"#1D9E75":"#D85A30"}}>{t.type==="income"?"+":"-"}{fmt(t.amount)}</td>
                      <td><button style={{...s.btn,padding:"2px 8px",fontSize:12}} onClick={async()=>{ await supabase.from('transactions').delete().eq('id',t.id); setTxs(txs.filter(x=>x.id!==t.id)); }}>刪除</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab==="儲蓄目標" && (
          <>
            <div style={s.card}>
              <div style={s.sec}>新增目標</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input style={{...s.input,flex:1,minWidth:120}} placeholder="目標名稱" value={newGoal.name} onChange={e=>setNewGoal({...newGoal,name:e.target.value})} />
                <input style={{...s.input,width:120}} type="number" placeholder="目標金額" value={newGoal.target} onChange={e=>setNewGoal({...newGoal,target:e.target.value})} />
                <input style={{...s.input,width:120}} type="number" placeholder="已儲蓄" value={newGoal.saved} onChange={e=>setNewGoal({...newGoal,saved:e.target.value})} />
                <button style={{...s.btn,background:"#eff6ff",color:"#1d4ed8"}} onClick={addGoal}>新增</button>
              </div>
            </div>
            {goals.map(g=>{
              const pct = Math.round((g.saved/g.target)*100);
              return (
                <div key={g.id} style={s.card}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
                    <span style={{fontWeight:500}}>{g.name}</span>
                    <button style={{...s.btn,padding:"2px 8px",fontSize:12}} onClick={async()=>{ await supabase.from('goals').delete().eq('id',g.id); setGoals(goals.filter(x=>x.id!==g.id)); }}>刪除</button>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#6b7280",marginBottom:8}}>
                    <span>已存：{fmt(g.saved)}</span>
                    <span>目標：{fmt(g.target)}</span>
                    <span style={{fontWeight:500,color:"#111"}}>{pct}%</span>
                  </div>
                  <div style={{height:8,borderRadius:4,background:"#e5e7eb",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(pct,100)}%`,background:pct>=100?"#1D9E75":"#378ADD",borderRadius:4}}></div>
                  </div>
                  <div style={{fontSize:12,color:"#6b7280",marginTop:6}}>距目標還差 {fmt(Math.max(0,g.target-g.saved))}</div>
                  <div style={{display:"flex",gap:8,marginTop:8}}>
                    <input style={{...s.input,width:100}} type="number" placeholder="追加金額" id={`add-${g.id}`} />
                    <button style={s.btn} onClick={()=>{
                      const el = document.getElementById(`add-${g.id}`);
                      const v = parseFloat(el.value)||0;
                      const newSaved = g.saved + v; await supabase.from('goals').update({ saved: newSaved }).eq('id', g.id); setGoals(goals.map(x=>x.id===g.id?{...x,saved:newSaved}:x));
                      el.value="";
                    }}>追加存款</button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {tab==="負債管理" && (
          <>
            <div style={s.card}>
              <div style={s.sec}>還款策略</div>
              <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                {[["avalanche","雪崩法（高利率優先）"],["snowball","雪球法（低餘額優先）"]].map(([v,l])=>(
                  <button key={v} style={{...s.btn,background:debtMethod===v?"#eff6ff":"#fff",color:debtMethod===v?"#1d4ed8":"#111"}} onClick={()=>setDebtMethod(v)}>{l}</button>
                ))}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12,fontSize:13}}>
                <span style={{color:"#6b7280"}}>每月額外還款：</span>
                <input style={{...s.input,width:100}} type="number" value={extraPay} onChange={e=>setExtraPay(parseFloat(e.target.value)||0)} />
                <span style={{color:"#6b7280"}}>元</span>
              </div>
            </div>
            {sortedDebts.map((d,i)=>{
              const mos = calcPayoff(d, i===0?extraPay:0);
              return (
                <div key={d.id} style={s.card}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div>
                      <span style={{fontWeight:500}}>{d.name}</span>
                      {i===0 && <span style={{fontSize:11,padding:"2px 8px",borderRadius:12,background:"#eff6ff",color:"#1d4ed8",marginLeft:8}}>優先還款</span>}
                    </div>
                    <button style={{...s.btn,padding:"2px 8px",fontSize:12}} onClick={async()=>{ await supabase.from('debts').delete().eq('id',d.id); setDebts(debts.filter(x=>x.id!==d.id)); }}>刪除</button>
                  </div>
                  <div style={{display:"flex",gap:16,fontSize:13,color:"#6b7280",marginBottom:8,flexWrap:"wrap"}}>
                    <span>餘額：<strong style={{color:"#111"}}>{fmt(d.balance)}</strong></span>
                    <span>年利率：<strong style={{color:"#D85A30"}}>{d.rate}%</strong></span>
                    <span>最低還款：<strong style={{color:"#111"}}>{fmt(d.minPay)}/月</strong></span>
                    <span>預估還清：<strong style={{color:"#1D9E75"}}>{mos<600?`${mos}個月 (${Math.round(mos/12*10)/10}年)`:"超過50年"}</strong></span>
                  </div>
                  <div style={{height:8,borderRadius:4,background:"#e5e7eb",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${Math.min(Math.round((1-d.balance/300000)*100),100)}%`,background:"#D4537E",borderRadius:4}}></div>
                  </div>
                </div>
              );
            })}
            <div style={s.card}>
              <div style={s.sec}>新增負債</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <input style={{...s.input,flex:1,minWidth:100}} placeholder="名稱" value={newDebt.name} onChange={e=>setNewDebt({...newDebt,name:e.target.value})} />
                <input style={{...s.input,width:110}} type="number" placeholder="餘額" value={newDebt.balance} onChange={e=>setNewDebt({...newDebt,balance:e.target.value})} />
                <input style={{...s.input,width:90}} type="number" placeholder="年利率%" value={newDebt.rate} onChange={e=>setNewDebt({...newDebt,rate:e.target.value})} />
                <input style={{...s.input,width:110}} type="number" placeholder="最低還款" value={newDebt.minPay} onChange={e=>setNewDebt({...newDebt,minPay:e.target.value})} />
                <button style={{...s.btn,background:"#eff6ff",color:"#1d4ed8"}} onClick={addDebt}>新增</button>
              </div>
            </div>
          </>
        )}

        {tab==="AI財務建議" && (
          <div style={s.card}>
            <div style={s.sec}>AI 個人化財務建議</div>
            <p style={{fontSize:13,color:"#6b7280",marginBottom:16}}>根據你目前的收支、負債與儲蓄目標，AI 將為你提供個人化建議。</p>
            <div style={{...s.row,marginBottom:16}}>
              {[["本月結餘",fmt(income-expense)],["負債總額",fmt(totalDebt)],["儲蓄目標",goals.length+"個"]].map(([l,v])=>(
                <div key={l} style={s.metric}>
                  <div style={s.metricLabel}>{l}</div>
                  <div style={{fontSize:18,fontWeight:500}}>{v}</div>
                </div>
              ))}
            </div>
            <button style={{...s.btn,background:"#eff6ff",color:"#1d4ed8",padding:"10px 20px",fontSize:14}} onClick={getAiAdvice}>
              取得 AI 財務建議
            </button>
          </div>
        )}
      </div>

      {showAiModal && (
        <div style={s.overlay} onClick={()=>setShowAiModal(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <span style={{fontSize:16,fontWeight:500}}>AI 財務建議</span>
              <button style={{...s.btn,padding:"4px 10px"}} onClick={()=>setShowAiModal(false)}>關閉</button>
            </div>
            {aiLoading ? (
              <div style={{color:"#6b7280",fontSize:14,padding:"2rem 0",textAlign:"center"}}>正在分析你的財務狀況...</div>
            ) : (
              <div style={{fontSize:14,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{aiAdvice}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
