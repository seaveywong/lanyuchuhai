import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Empty, Grid, Input, Spin, Tag, message } from 'antd';
import { CustomerServiceOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { publicApi } from '../../services/api';
import { useCartStore } from '../../store/cartStore';
import { cnyToUsdt } from '../../utils/format';
import LangSwitch from '../../components/LangSwitch';
import AccountMenu from '../../components/AccountMenu';

const gradients = [
  ['#2563eb', '#0f172a'],
  ['#0f766e', '#042f2e'],
  ['#c2410c', '#431407'],
  ['#be123c', '#4c0519'],
  ['#4f46e5', '#111827'],
];

function SupportWidget({ contact }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (!contact?.supportEnabled) return null;
  const links = [];
  if (contact.tgUsername || contact.tgUrl) links.push({ label: 'Telegram', href: contact.tgUrl || 'https://t.me/' + contact.tgUsername });
  if (contact.whatsapp) links.push({ label: 'WhatsApp', href: 'https://wa.me/' + contact.whatsapp.replace(/[^0-9]/g, '') });
  if (contact.email) links.push({ label: 'Email', href: 'mailto:' + contact.email });
  if (!links.length) return null;

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 200 }}>
      {open && (
        <div style={{ width: 300, background: '#fff', border: '1px solid #dbe3ef', boxShadow: '0 18px 50px rgba(15,23,42,.18)', borderRadius: 18, padding: 18, marginBottom: 10 }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{contact.supportTitle || t('support.title')}</div>
          <div style={{ color: '#64748b', fontSize: 13, lineHeight: 1.7, marginBottom: 12 }}>{contact.supportText || t('support.text')}</div>
          {contact.businessHours && <Tag color="blue" style={{ marginBottom: 12 }}>{contact.businessHours}</Tag>}
          <div style={{ display: 'grid', gap: 8 }}>
            {links.map((item) => <a key={item.label} href={item.href} target="_blank" rel="noreferrer" style={{ padding: '10px 12px', borderRadius: 12, background: '#f1f5f9', color: '#0f172a', fontWeight: 700 }}>{item.label}</a>)}
          </div>
        </div>
      )}
      <Button type="primary" size="large" icon={<CustomerServiceOutlined />} onClick={() => setOpen((value) => !value)} style={{ height: 48, borderRadius: 24, boxShadow: '0 12px 30px rgba(37,99,235,.32)' }}>{t('support.button')}</Button>
    </div>
  );
}

function CategoryPill({ active, children, onClick, small }) {
  return (
    <button type="button" onClick={onClick} style={{ border: active ? '1px solid #2563eb' : '1px solid #dbe5f2', background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#0f172a', borderRadius: 999, padding: small ? '5px 12px' : '8px 16px', fontSize: small ? 12 : 14, fontWeight: active ? 800 : 650, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: active ? '0 10px 22px rgba(37,99,235,.2)' : '0 6px 16px rgba(15,23,42,.05)' }}>{children}</button>
  );
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mainCat, setMainCat] = useState('all');
  const [subCat, setSubCat] = useState('all');
  const [rate, setRate] = useState(7);
  const [contact, setContact] = useState(null);
  const navigate = useNavigate();
  const cartCount = useCartStore((state) => state.items.length);
  const addItem = useCartStore((state) => state.addItem);
  const isEn = i18n.language?.startsWith('en');
  const screens = Grid.useBreakpoint();

  useEffect(() => {
    Promise.all([publicApi.getProducts({ limit: 200 }), publicApi.getCategories(), publicApi.getPaymentConfig()])
      .then(([productResult, categoryResult, paymentConfig]) => {
        setProducts(productResult.items || []);
        setCategories(categoryResult || []);
        if (paymentConfig.exchangeRate) setRate(paymentConfig.exchangeRate);
        setContact(paymentConfig.contact || null);
      })
      .catch(() => message.error(t('home.loadFail')))
      .finally(() => setLoading(false));
  }, [t]);

  const label = (item) => (isEn && item.nameEn ? item.nameEn : item.name);
  const activeMain = categories.find((item) => item.slug === mainCat);
  const subCategories = activeMain?.children || [];
  const filteredProducts = useMemo(() => products.filter((product) => {
    const parentSlug = product.category?.parent?.slug || product.category?.slug;
    const childSlug = product.category?.slug;
    const keyword = search.trim().toLowerCase();
    const haystack = [product.name, product.nameEn, product.description, product.descriptionEn].filter(Boolean).join(' ').toLowerCase();
    if (mainCat !== 'all' && parentSlug !== mainCat) return false;
    if (subCat !== 'all' && childSlug !== subCat) return false;
    if (keyword && !haystack.includes(keyword)) return false;
    return true;
  }), [products, mainCat, subCat, search]);

  const addToCart = (product) => {
    if (!product.hasStock) return message.warning(t('home.noStock'));
    addItem(product);
    message.success(t('home.added'));
  };

  const buyNow = (product) => {
    if (!product.hasStock) return message.warning(t('home.noStock'));
    addItem(product);
    navigate('/cart');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 18% -10%, rgba(37,99,235,.12), transparent 28%), linear-gradient(180deg,#f8fbff 0%,#eef3f8 100%)' }}>
      <header style={{ background: 'rgba(255,255,255,.88)', borderBottom: '1px solid rgba(226,232,240,.9)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(14px)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: screens.md ? '0 22px' : '0 14px', minHeight: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <img src="/brand-logo.svg" alt="閽冩繂鐓欓崙鐑樻崳 BlueReach" style={{ width: screens.md ? 154 : 128, height: 45, objectFit: 'contain', display: 'block' }} />
            {screens.md && <span style={{ color: '#64748b', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{t('home.subtitle')}</span>}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: screens.md ? 10 : 6, flexShrink: 0 }}>
            <LangSwitch />
            {screens.md && <Link to="/lookup" style={{ color: '#475569', fontWeight: 800 }}>{t('nav.lookup')}</Link>}
            <AccountMenu />
            <Badge count={cartCount} size="small"><Button icon={<ShoppingCartOutlined />} onClick={() => navigate('/cart')} style={{ borderRadius: 14, fontWeight: 700 }}>{screens.md ? t('nav.cart') : ''}</Button></Badge>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: screens.md ? '20px 20px 42px' : '14px 12px 34px' }}>
        <section style={{ background: 'linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,251,255,.94))', border: '1px solid #dbe5f2', borderRadius: 24, padding: screens.md ? 18 : 14, marginBottom: 16, boxShadow: '0 18px 45px rgba(15,23,42,.07)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: screens.md ? 'minmax(0,1fr) 320px' : '1fr', gap: 14, alignItems: 'start', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <h1 style={{ margin: 0, fontSize: 'clamp(24px,3vw,34px)', color: '#071126', letterSpacing: '-.04em', lineHeight: 1.1 }}>{t('home.title')}</h1>
                <span style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 800 }}>{filteredProducts.length} {'\u4ef6\u5546\u54c1'}</span>
              </div>
              <p style={{ margin: '6px 0 0', color: '#52637a', fontSize: 14 }}>{t('home.desc')}</p>
            </div>
            <Input allowClear prefix={<SearchOutlined />} placeholder={t('home.search')} value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: '100%', borderRadius: 14, height: 38, boxShadow: '0 8px 22px rgba(15,23,42,.04)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 2px 10px' }}>
            <CategoryPill active={mainCat === 'all'} onClick={() => { setMainCat('all'); setSubCat('all'); }}>{t('home.all')}</CategoryPill>
            {categories.map((category) => (
              <CategoryPill key={category.id} active={mainCat === category.slug} onClick={() => { setMainCat(category.slug); setSubCat('all'); }}>{label(category)}</CategoryPill>
            ))}
          </div>
          {subCategories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 2px 2px' }}>
              <CategoryPill small active={subCat === 'all'} onClick={() => setSubCat('all')}>{t('home.allSub')}</CategoryPill>
              {subCategories.map((category) => <CategoryPill small key={category.id} active={subCat === category.slug} onClick={() => setSubCat(category.slug)}>{label(category)}</CategoryPill>)}
            </div>
          )}
        </section>

        {loading ? (
          <div style={{ padding: 90, textAlign: 'center' }}><Spin size="large" /></div>
        ) : filteredProducts.length === 0 ? (
          <Empty style={{ padding: 80, background: 'rgba(255,255,255,.78)', borderRadius: 24, border: '1px solid #e2e8f0' }} description={t('home.empty')} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredProducts.map((product, index) => {
              const colors = gradients[index % gradients.length];
              const description = (isEn && product.descriptionEn ? product.descriptionEn : product.description) || t('home.fallbackDesc');
              return (
                <article key={product.id} style={{ background: 'rgba(255,255,255,.96)', border: '1px solid #dfe7f1', borderRadius: 22, overflow: 'hidden', display: 'grid', gridTemplateColumns: screens.md ? '10px minmax(0,1fr) 286px' : '7px minmax(0,1fr)', boxShadow: '0 14px 34px rgba(15,23,42,.065)', minHeight: screens.md ? 128 : 'auto' }}>
                  <div aria-hidden="true" style={{ background: product.coverImage ? 'url(' + product.coverImage + ') center/cover' : `linear-gradient(180deg,${colors[0]},${colors[1]})` }} />
                  <div style={{ minWidth: 0, padding: screens.md ? '18px 18px 16px' : '15px 14px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
                        {product.category?.parent && <span style={{ border: '1px solid #dbe5f2', background: '#fff', color: '#0f172a', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 750, maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(product.category.parent)}</span>}
                        <span style={{ border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', borderRadius: 8, padding: '3px 8px', fontSize: 12, fontWeight: 800, maxWidth: 190, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(product.category || {})}</span>
                      </div>
                      <span style={{ border: product.hasStock ? '1px solid #86efac' : '1px solid #fecaca', background: product.hasStock ? '#f0fdf4' : '#fff1f2', color: product.hasStock ? '#15803d' : '#dc2626', borderRadius: 999, padding: '4px 10px', fontSize: 12, fontWeight: 850, flexShrink: 0 }}>{product.hasStock ? t('home.inStock') : t('home.outStock')}</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: screens.md ? 18 : 16, color: '#071126', letterSpacing: '-.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(product)}</h3>
                    <p style={{ margin: '8px 0 0', color: '#52637a', fontSize: 13, lineHeight: 1.75, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: screens.md ? 2 : 3, overflow: 'hidden' }}>{description}</p>
                  </div>
                  <div style={{ gridColumn: screens.md ? 'auto' : '2', minWidth: 0, padding: screens.md ? '16px' : '12px 14px 15px', display: 'flex', flexDirection: screens.md ? 'column' : 'row', justifyContent: 'center', gap: 12, borderLeft: screens.md ? '1px solid #edf2f7' : 'none', background: screens.md ? 'linear-gradient(180deg,#fbfdff,#f8fafc)' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: screens.md ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 10 }}>
                      <div>
                        <div style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{isEn ? 'Price' : '\u5230\u624b\u4ef7'}</div>
                        <strong style={{ display: 'block', fontSize: 24, color: '#071126', lineHeight: 1.08, letterSpacing: '-.04em' }}>{'\u00a5'}{Number(product.price).toFixed(2)}</strong>
                        <span style={{ color: '#8aa0bd', fontSize: 12 }}>{cnyToUsdt(product.price, rate)} USDT</span>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: screens.md ? '1fr' : 'repeat(2,minmax(0,1fr))', gap: 8, minWidth: screens.md ? 0 : 210 }}>
                      <Button disabled={!product.hasStock} onClick={() => addToCart(product)} style={{ borderRadius: 12, height: 36, fontWeight: 750 }}>{t('home.add')}</Button>
                      <Button type="primary" disabled={!product.hasStock} onClick={() => buyNow(product)} style={{ borderRadius: 12, height: 36, fontWeight: 850, boxShadow: product.hasStock ? '0 10px 20px rgba(37,99,235,.22)' : 'none' }}>{t('home.buy')}</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #e2e8f0', background: 'rgba(255,255,255,.76)', padding: 20, color: '#94a3b8', fontSize: 12 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}><span>{t('home.footerBrand')}</span></div>
      </footer>
      <SupportWidget contact={contact} />
    </div>
  );
}
