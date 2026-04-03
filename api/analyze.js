export async function onRequest(){
 return new Response(JSON.stringify({
  quickVerdict:[
    {domain:"Identity", verdict:"Mixed", meaning:"Early fluctuation stabilising later"},
    {domain:"Career", verdict:"Delayed", meaning:"Weak early improving later"}
  ],
  earlyLife:"Early life shows uneven growth with learning through adjustments.",
  laterLife:"Later life stabilises with better direction and consistency.",
  direction:"Mixed journey — early fluctuations improving toward stability.",
  table:[
    {domain:"Career", d1:"Weak", d9:"Strong", trend:"Improves later", final:"Delayed but Improving"}
  ]
 }),{headers:{'Content-Type':'application/json'}})
}
