
document.getElementById('analyze').addEventListener('click', async ()=>{
  const payload={sample:true};
  const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const data=await res.json();
  localStorage.setItem('lastResult',JSON.stringify(data));
  document.getElementById('output').textContent=JSON.stringify(data,null,2);
});

window.onload=()=>{
 const saved=localStorage.getItem('lastResult');
 if(saved){
   document.getElementById('output').textContent=saved;
 }
}
