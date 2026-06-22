import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Row, Col, Input, Spin, Empty, Badge, message, Button } from 'antd';
import { ShoppingCartOutlined, SearchOutlined } from '@ant-design/icons';
import { publicApi } from '../../services/api';
import { useCartStore } from '../../store/cartStore';
import { cnyToUsdt } from '../../utils/format';
import LangSwitch from '../../components/LangSwitch';

export default function Home() {
  const { t } = useTranslation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [rate, setRate] = useState(7);
  const [contact, setContact] = useState(null);
  const nav = useNavigate();
  const cnt = useCartStore(s => s.items.length);
  const add = useCartStore(s => s.addItem);

  useEffect(() => {
    Promise.all([publicApi.getProducts({limit:200}), publicApi.getPaymentConfig()])
      .then(([p,cfg]) => {
        setProducts(p.items||[]);
        if(cfg.exchangeRate) setRate(cfg.exchangeRate);
        if(cfg.contact) setContact(cfg.contact);
        const m = new Map(); p.items?.forEach(i=>{if(i.category) m.set(i.category.slug,i.category)});
        setCategories([...m.values()]);
      }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const toCart = p => { if(!p.hasStock) return message.warning('缺货'); add(p); message.success('已加入购物车'); };
  const buy = p => { if(!p.hasStock) return; add(p); nav('/cart'); };

  const list = products.filter(p => {
    if(cat!=='all'&&p.category?.slug!==cat)return false;
    if(search&&!p.name.includes(search)&&!(p.description||'').includes(search))return false;
    return true;
  });

  const cts = [{k:'all',l:t('product.all')}, ...categories.map(c=>({k:c.slug,l:c.name}))];

  return (
    <div style={{background:'#f8fafc',minHeight:'100vh'}}>
      {/* Nav */}
      <header style={{background:'#fff',borderBottom:'1px solid #e2e8f0',position:'sticky',top:0,zIndex:100}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:56}}>
          <Link to="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none'}}>
            <span style={{background:'#2563eb',color:'#fff',width:32,height:32,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700}}>蓝</span>
            <span style={{fontSize:17,fontWeight:700,color:'#0f172a'}}>蓝域出海</span>
            <span style={{fontSize:11,color:'#94a3b8',fontWeight:400}}>BlueReach</span>
          </Link>
          <div style={{display:'flex',alignItems:'center',gap:16}}>
            <LangSwitch/>
            <Link to="/lookup" style={{fontSize:13,color:'#64748b'}}>{t('nav.lookup')}</Link>
            <Badge count={cnt} size="small" offset={[-2,2]}>
              <Button icon={<ShoppingCartOutlined/>} onClick={()=>nav('/cart')} style={{borderRadius:8}}>{t('nav.cart')}</Button>
            </Badge>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{background:'linear-gradient(135deg,#eff6ff,#dbeafe)',padding:'56px 24px 48px',textAlign:'center'}}>
        <h1 style={{fontSize:'clamp(28px,4vw,40px)',fontWeight:800,color:'#0f172a',marginBottom:12}}>{t('hero.title')}</h1>
        <p style={{fontSize:16,color:'#64748b',maxWidth:500,margin:'0 auto 32px',lineHeight:1.7}}>{t('hero.sub')}</p>
        <button onClick={()=>{document.getElementById('products')?.scrollIntoView({behavior:'smooth'})}}
          style={{padding:'12px 36px',borderRadius:10,border:'none',background:'#2563eb',color:'#fff',fontSize:15,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 16px rgba(37,99,235,.3)'}}>
          {t('hero.cta')}
        </button>
      </section>

      {/* 卖点 */}
      <section style={{background:'#fff',borderBottom:'1px solid #e2e8f0',padding:'40px 24px'}}>
        <div style={{maxWidth:1000,margin:'0 auto'}}>
          <h2 style={{textAlign:'center',fontSize:20,fontWeight:700,marginBottom:32}}>{t('sell.why')}</h2>
          <Row gutter={[24,24]}>
            {t('sell.items',{returnObjects:true}).map((x,i)=>(
              <Col key={i} xs={24} sm={12} md={6}>
                <div style={{textAlign:'center',padding:'20px 16px',borderRadius:10,background:'#f8fafc'}}>
                  <div style={{fontSize:28,marginBottom:8}}>{['⚡','🛒','🔒','📦'][i]}</div>
                  <h4 style={{fontSize:14,fontWeight:600,marginBottom:4}}>{x.t}</h4>
                  <p style={{fontSize:12,color:'#94a3b8',lineHeight:1.6}}>{x.d}</p>
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </section>

      {/* Filter */}
      <div id="products" style={{background:'#fff',borderBottom:'1px solid #e2e8f0',position:'sticky',top:56,zIndex:50}}>
        <div style={{maxWidth:1240,margin:'0 auto',padding:'8px 24px',display:'flex',alignItems:'center',gap:8,overflowX:'auto'}}>
          {cts.map(c=>(<button key={c.k} onClick={()=>setCat(c.k)}
            style={{padding:'6px 16px',borderRadius:20,border:cat===c.k?'2px solid #2563eb':'2px solid transparent',background:cat===c.k?'#eff6ff':'transparent',color:cat===c.k?'#2563eb':'#64748b',fontSize:13,fontWeight:cat===c.k?600:400,cursor:'pointer',whiteSpace:'nowrap'}}>{c.l}</button>))}
          <div style={{flex:1}}/>
          <Input prefix={<SearchOutlined/>} placeholder={t('product.search')} value={search} onChange={e=>setSearch(e.target.value)} style={{width:200}} allowClear size="small"/>
        </div>
      </div>

      {/* Products */}
      <div style={{maxWidth:1240,margin:'0 auto',padding:'28px 24px'}}>
        {loading?<div style={{textAlign:'center',padding:80}}><Spin size="large"/></div>
        :list.length===0?<Empty style={{padding:80}}/>
        :<Row gutter={[16,16]}>
          {list.map(p=>(
            <Col key={p.id} xs={24} sm={12} md={8} lg={6}>
              <div style={{background:'#fff',borderRadius:12,overflow:'hidden',border:'1px solid #e2e8f0',transition:'all .2s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.1)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none'}}>
                <div style={{height:100,background:p.coverImage?`url(${p.coverImage}) center/cover`:`linear-gradient(135deg,${['#2563eb,#7c3aed','#0891b2,#06b6d4','#059669,#10b981','#d97706,#f59e0b','#dc2626,#ef4444','#4f46e5,#6366f1','#0f766e,#14b8a6','#b45309,#d97706'][p.id%8]})`,position:'relative'}}>
                  <div style={{position:'absolute',top:8,left:8,display:'flex',gap:4}}>
                    {p.category&&<span style={{background:'rgba(0,0,0,.35)',color:'#fff',padding:'2px 8px',borderRadius:4,fontSize:11}}>{p.category.name}</span>}
                  </div>
                  <div style={{position:'absolute',top:8,right:8}}>
                    <span style={{background:p.hasStock?'#16a34a':'#dc2626',color:'#fff',padding:'2px 8px',borderRadius:4,fontSize:11}}>{p.hasStock?t('product.instock'):t('product.out')}</span>
                  </div>
                </div>
                <div style={{padding:'14px 16px'}}>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{p.name}</div>
                  {p.description&&<div style={{color:'#94a3b8',fontSize:12,marginBottom:8,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.description}</div>}
                  <div style={{display:'flex',alignItems:'baseline',gap:6,marginBottom:12}}>
                    <span style={{fontSize:18,fontWeight:700}}>¥{parseFloat(p.price).toFixed(2)}</span>
                    <span style={{fontSize:11,color:'#94a3b8'}}>/ {cnyToUsdt(p.price,rate)} USDT</span>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>toCart(p)} disabled={!p.hasStock}
                      style={{flex:1,padding:'8px 0',borderRadius:8,border:'1px solid #d1d5db',background:'#fff',color:p.hasStock?'#374151':'#d1d5db',fontSize:13,cursor:p.hasStock?'pointer':'not-allowed'}}>{t('product.add')}</button>
                    <button onClick={()=>buy(p)} disabled={!p.hasStock}
                      style={{flex:1,padding:'8px 0',borderRadius:8,border:'none',background:p.hasStock?'#2563eb':'#e5e7eb',color:p.hasStock?'#fff':'#9ca3af',fontSize:13,fontWeight:600,cursor:p.hasStock?'pointer':'not-allowed'}}>{t('product.buy')}</button>
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>}
      </div>

      {/* Footer */}
      <footer style={{background:'#fff',borderTop:'1px solid #e2e8f0',padding:'24px',textAlign:'center',fontSize:12,color:'#94a3b8'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8,maxWidth:1240,margin:'0 auto'}}>
          <span>{t('footer.copy')}</span>
          <span style={{display:'flex',alignItems:'center',gap:12}}>
            {contact?.tgUsername&&<a href={contact.tgUrl||`https://t.me/${contact.tgUsername}`} target="_blank" rel="noreferrer" style={{color:'#2563eb'}}>{t('footer.support')} @{contact.tgUsername}</a>}
            <span>{t('footer.slogan')}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
