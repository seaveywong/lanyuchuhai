import{create}from'zustand';
export const useAuthStore=create(set=>({
  accessToken:localStorage.getItem('admin_token')||null,
  admin:null,
  setAuth:(t,a)=>{localStorage.setItem('admin_token',t);set({accessToken:t,admin:a})},
  setAdmin:a=>set({admin:a}),
  logout:()=>{localStorage.removeItem('admin_token');set({accessToken:null,admin:null})},
}));
