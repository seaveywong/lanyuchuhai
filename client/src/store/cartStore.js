import{create}from'zustand';
export const useCartStore=create((set,get)=>({
  items:JSON.parse(localStorage.getItem('cart')||'[]'),
  addItem:(p,q=1)=>{const items=[...get().items];const e=items.find(i=>i.productId===p.id);if(e)e.quantity+=q;else items.push({productId:p.id,name:p.name,price:p.price,coverImage:p.coverImage,quantity:q});localStorage.setItem('cart',JSON.stringify(items));set({items})},
  updateQuantity:(id,q)=>{const items=get().items.map(i=>i.productId===id?{...i,quantity:Math.max(1,q)}:i);localStorage.setItem('cart',JSON.stringify(items));set({items})},
  removeItem:id=>{const items=get().items.filter(i=>i.productId!==id);localStorage.setItem('cart',JSON.stringify(items));set({items})},
  clear:()=>{localStorage.removeItem('cart');set({items:[]})},
  getTotal:()=>get().items.reduce((s,i)=>s+parseFloat(i.price)*i.quantity,0),
  getOrderItems:()=>get().items.map(i=>({productId:i.productId,quantity:i.quantity})),
}));
