
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Empty, Grid, Input, Spin, Tag, message } from 'antd';
import { CustomerServiceOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { publicApi } from '../../services/api';
import { useCartStore } from '../../store/cartStore';
import { cnyToUsdt } from '../../utils/format';
import LangSwitch from '../../components/LangSwitch';

const gradients = ['#1d4ed8,#0f172a', '#0f766e,#042f2e', '#b45309,#431407', '#be123c,#4c0519', '#4338ca,#111827'];

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
    <div style={{ minHeight: '100vh', background: '#f6f8fb' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px', minHeight: 68, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <img src="/brand-logo.svg" alt="蓝域 BlueReach" style={{ width: 154, height: 45, objectFit: 'contain', display: 'block' }} />
            <span style={{ color: '#64748b', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{t('home.subtitle')}</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <LangSwitch />
            <Link to="/lookup" style={{ color: '#475569', fontWeight: 700 }}>{t('nav.lookup')}</Link>
            <Badge count={cartCount} size="small"><Button icon={<ShoppingCartOutlined />} onClick={() => navigate('/cart')} style={{ borderRadius: 12 }}>{t('nav.cart')}</Button></Badge>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 20px 40px' }}>
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 22, padding: 18, marginBottom: 16, boxShadow: '0 12px 35px rgba(15,23,42,.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 'clamp(22px,3vw,32px)', color: '#0f172a' }}>{t('home.title')}</h1>
              <p style={{ margin: '6px 0 0', color: '#64748b' }}>{t('home.desc')}</p>
            </div>
            <Input allowClear prefix={<SearchOutlined />} placeholder={t('home.search')} value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: 280, borderRadius: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
            <Button type={mainCat === 'all' ? 'primary' : 'default'} shape="round" onClick={() => { setMainCat('all'); setSubCat('all'); }}>{t('home.all')}</Button>
            {categories.map((category) => (
              <Button key={category.id} type={mainCat === category.slug ? 'primary' : 'default'} shape="round" onClick={() => { setMainCat(category.slug); setSubCat('all'); }}>{label(category)}</Button>
            ))}
          </div>
          {subCategories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 4 }}>
              <Button size="small" type={subCat === 'all' ? 'primary' : 'default'} shape="round" onClick={() => setSubCat('all')}>{t('home.allSub')}</Button>
              {subCategories.map((category) => <Button key={category.id} size="small" type={subCat === category.slug ? 'primary' : 'default'} shape="round" onClick={() => setSubCat(category.slug)}>{label(category)}</Button>)}
            </div>
          )}
        </section>

        {loading ? (
          <div style={{ padding: 90, textAlign: 'center' }}><Spin size="large" /></div>
        ) : filteredProducts.length === 0 ? (
          <Empty style={{ padding: 80 }} description={t('home.empty')} />
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            {filteredProducts.map((product, index) => (
              <article key={product.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden', display: 'grid', gridTemplateColumns: screens.md ? '8px minmax(0, 1fr) auto' : '6px minmax(0, 1fr)', boxShadow: '0 8px 20px rgba(15,23,42,.045)' }}>
                <div aria-hidden="true" style={{ background: product.coverImage ? 'url(' + product.coverImage + ') center/cover' : 'linear-gradient(180deg,' + gradients[index % gradients.length] + ')' }} />
                <div style={{ minWidth: 0, padding: screens.md ? '14px 0 14px 16px' : '14px 14px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                      {product.category?.parent && <Tag color="default" style={{ marginInlineEnd: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(product.category.parent)}</Tag>}
                      <Tag color="blue" style={{ marginInlineEnd: 0, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(product.category || {})}</Tag>
                    </div>
                    <Tag color={product.hasStock ? 'green' : 'red'} style={{ marginInlineEnd: 0, flexShrink: 0 }}>{product.hasStock ? t('home.inStock') : t('home.outStock')}</Tag>
                  </div>
                  <h3 style={{ margin: '8px 0 0', fontSize: 16, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(product)}</h3>
                  <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13, lineHeight: 1.6, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{(isEn && product.descriptionEn ? product.descriptionEn : product.description) || t('home.fallbackDesc')}</p>
                </div>
                <div style={{ gridColumn: screens.md ? 'auto' : '2', minWidth: 0, width: screens.md ? 310 : 'auto', padding: screens.md ? '14px 16px' : '12px 14px 14px', display: 'flex', alignItems: screens.md ? 'center' : 'stretch', justifyContent: 'space-between', gap: 14, borderLeft: screens.md ? '1px solid #eef2f7' : 'none' }}>
                  <div style={{ whiteSpace: 'nowrap' }}>
                    <strong style={{ display: 'block', fontSize: 21, color: '#0f172a', lineHeight: 1.2 }}>¥{Number(product.price).toFixed(2)}</strong>
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>{cnyToUsdt(product.price, rate)} USDT</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flex: screens.md ? 0 : 1 }}>
                    <Button disabled={!product.hasStock} onClick={() => addToCart(product)} style={{ borderRadius: 10, minWidth: screens.md ? 104 : 0, flex: screens.md ? 0 : 1 }}>{t('home.add')}</Button>
                    <Button type="primary" disabled={!product.hasStock} onClick={() => buyNow(product)} style={{ borderRadius: 10, minWidth: screens.md ? 104 : 0, flex: screens.md ? 0 : 1 }}>{t('home.buy')}</Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #e2e8f0', background: '#fff', padding: 20, color: '#94a3b8', fontSize: 12 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}><span>{t('home.footerBrand')}</span></div>
      </footer>
      <SupportWidget contact={contact} />
    </div>
  );
}
