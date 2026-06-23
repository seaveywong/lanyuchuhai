import{create}from'zustand';
function loadCart(){try{const value=JSON.parse(localStorage.getItem('cart')||'[]');return Array.isArray(value)?value:[]}catch{return[]}}
function saveCart(items){localStorage.setItem('cart',JSON.stringify(items))}
export const useCartStore=create((set,get)=>({
  items:loadCart(),
  addItem:(p,q=1)=>{const items=[...get().items];const e=items.find(i=>i.productId===p.id);const quantity=Math.max(1,Number(q)||1);if(e)e.quantity+=quantity;else items.push({productId:p.id,name:p.name,price:p.price,coverImage:p.coverImage,quantity});saveCart(items);set({items})},
  updateQuantity:(id,q)=>{const quantity=Math.max(1,Number(q)||1);const items=get().items.map(i=>i.productId===id?{...i,quantity}:i);saveCart(items);set({items})},
  removeItem:id=>{const items=get().items.filter(i=>i.productId!==id);saveCart(items);set({items})},
  clear:()=>{localStorage.removeItem('cart');set({items:[]})},
  getTotal:()=>get().items.reduce((s,i)=>s+parseFloat(i.price)*i.quantity,0),
  getOrderItems:()=>get().items.map(i=>({productId:i.productId,quantity:i.quantity})),
}));
