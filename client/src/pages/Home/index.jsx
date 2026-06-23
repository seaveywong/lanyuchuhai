import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Drawer, Empty, Grid, Input, Space, Spin, Tag, message } from 'antd';
import { CustomerServiceOutlined, InfoCircleOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { publicApi } from '../../services/api';
import { useCartStore } from '../../store/cartStore';
import { cnyToUsdt } from '../../utils/format';
import LangSwitch from '../../components/LangSwitch';
import AccountMenu from '../../components/AccountMenu';

const accents = ['#2563eb', '#0f766e', '#c2410c', '#be123c', '#4f46e5', '#0f172a'];
const ui = {
  countSuffix: '\u4ef6\u5546\u54c1',
  compactHint: '\u70b9\u51fb\u8be6\u60c5\u67e5\u770b\u5b8c\u6574\u8bf4\u660e\uff0c\u5217\u8868\u4fdd\u6301\u7d27\u51d1\u3002',
  product: '\u5546\u54c1',
  category: '\u5206\u7c7b',
  stock: '\u5e93\u5b58',
  price: '\u4ef7\u683c',
  action: '\u64cd\u4f5c',
  detail: '\u8be6\u60c5',
  detailTitle: '\u5546\u54c1\u8be6\u60c5',
  description: '\u5546\u54c1\u8bf4\u660e',
  receivePrice: '\u5230\u624b\u4ef7',
  noDescription: '\u6682\u65e0\u66f4\u591a\u8bf4\u660e',
};

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
  return <button type="button" onClick={onClick} style={{ border: active ? '1px solid #2563eb' : '1px solid #dbe5f2', background: active ? '#2563eb' : '#fff', color: active ? '#fff' : '#0f172a', borderRadius: 999, padding: small ? '5px 11px' : '8px 15px', fontSize: small ? 12 : 14, fontWeight: active ? 800 : 650, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: active ? '0 10px 22px rgba(37,99,235,.18)' : '0 5px 14px rgba(15,23,42,.045)' }}>{children}</button>;
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
  const [detailProduct, setDetailProduct] = useState(null);
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
  const productDesc = (product) => (isEn && product.descriptionEn ? product.descriptionEn : product.description) || t('home.fallbackDesc');
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

  const renderActions = (product, compact = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr 1fr' : '1fr', gap: 8 }}>
      <Button icon={<InfoCircleOutlined />} onClick={() => setDetailProduct(product)} style={{ borderRadius: 12, height: 34 }}>{ui.detail}</Button>
      <Button disabled={!product.hasStock} onClick={() => addToCart(product)} style={{ borderRadius: 12, height: 34, fontWeight: 750 }}>{t('home.add')}</Button>
      <Button type="primary" disabled={!product.hasStock} onClick={() => buyNow(product)} style={{ borderRadius: 12, height: 34, fontWeight: 850 }}>{t('home.buy')}</Button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(circle at 18% -10%, rgba(37,99,235,.12), transparent 28%), linear-gradient(180deg,#f8fbff 0%,#eef3f8 100%)' }}>
      <header style={{ background: 'rgba(255,255,255,.9)', borderBottom: '1px solid rgba(226,232,240,.9)', position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(14px)' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto', padding: screens.md ? '0 22px' : '0 14px', minHeight: 66, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <img src="/brand-logo.svg" alt="BlueReach" style={{ width: screens.md ? 154 : 128, height: 45, objectFit: 'contain', display: 'block' }} />
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

      <main style={{ maxWidth: 1240, margin: '0 auto', padding: screens.md ? '18px 20px 42px' : '12px 12px 34px' }}>
        <section style={{ background: 'rgba(255,255,255,.96)', border: '1px solid #dbe5f2', borderRadius: 22, padding: screens.md ? 16 : 13, marginBottom: 12, boxShadow: '0 16px 38px rgba(15,23,42,.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: screens.md ? 'minmax(0,1fr) 320px' : '1fr', gap: 12, alignItems: 'start', marginBottom: 12 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 3 }}>
                <h1 style={{ margin: 0, fontSize: 'clamp(23px,3vw,32px)', color: '#071126', letterSpacing: '-.04em', lineHeight: 1.1 }}>{t('home.title')}</h1>
                <span style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', borderRadius: 999, padding: '3px 9px', fontSize: 12, fontWeight: 800 }}>{filteredProducts.length} {ui.countSuffix}</span>
              </div>
              <p style={{ margin: '5px 0 0', color: '#52637a', fontSize: 13 }}>{ui.compactHint}</p>
            </div>
            <Input allowClear prefix={<SearchOutlined />} placeholder={t('home.search')} value={search} onChange={(event) => setSearch(event.target.value)} style={{ width: '100%', borderRadius: 14, height: 38, boxShadow: '0 8px 22px rgba(15,23,42,.04)' }} />
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 2px 9px' }}>
            <CategoryPill active={mainCat === 'all'} onClick={() => { setMainCat('all'); setSubCat('all'); }}>{t('home.all')}</CategoryPill>
            {categories.map((category) => <CategoryPill key={category.id} active={mainCat === category.slug} onClick={() => { setMainCat(category.slug); setSubCat('all'); }}>{label(category)}</CategoryPill>)}
          </div>
          {subCategories.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 2px 1px' }}>
              <CategoryPill small active={subCat === 'all'} onClick={() => setSubCat('all')}>{t('home.allSub')}</CategoryPill>
              {subCategories.map((category) => <CategoryPill small key={category.id} active={subCat === category.slug} onClick={() => setSubCat(category.slug)}>{label(category)}</CategoryPill>)}
            </div>
          )}
        </section>

        {loading ? (
          <div style={{ padding: 90, textAlign: 'center' }}><Spin size="large" /></div>
        ) : filteredProducts.length === 0 ? (
          <Empty style={{ padding: 80, background: 'rgba(255,255,255,.78)', borderRadius: 22, border: '1px solid #e2e8f0' }} description={t('home.empty')} />
        ) : (
          <div style={{ background: 'rgba(255,255,255,.9)', border: '1px solid #dbe5f2', borderRadius: 22, overflow: 'hidden', boxShadow: '0 16px 40px rgba(15,23,42,.065)' }}>
            {screens.md && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) 180px 92px 132px 238px', gap: 0, padding: '10px 16px', background: '#f8fafc', color: '#64748b', fontSize: 12, fontWeight: 850, borderBottom: '1px solid #e2e8f0' }}><div>{ui.product}</div><div>{ui.category}</div><div>{ui.stock}</div><div>{ui.price}</div><div>{ui.action}</div></div>}
            <div style={{ display: 'grid' }}>
              {filteredProducts.map((product, index) => {
                const accent = accents[index % accents.length];
                const desc = productDesc(product);
                return screens.md ? (
                  <article key={product.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(300px,1fr) 180px 92px 132px 238px', alignItems: 'center', minHeight: 76, borderBottom: index === filteredProducts.length - 1 ? 'none' : '1px solid #eef2f7', opacity: product.hasStock ? 1 : .64 }}>
                    <div style={{ minWidth: 0, padding: '12px 16px', borderLeft: '7px solid ' + accent }}>
                      <div style={{ fontWeight: 900, color: '#071126', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(product)}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</div>
                    </div>
                    <div style={{ padding: '0 12px', minWidth: 0 }}>
                      <Space size={5} wrap>
                        {product.category?.parent && <Tag style={{ margin: 0, maxWidth: 92, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(product.category.parent)}</Tag>}
                        <Tag color="blue" style={{ margin: 0, maxWidth: 128, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(product.category || {})}</Tag>
                      </Space>
                    </div>
                    <div style={{ padding: '0 10px' }}><Tag color={product.hasStock ? 'green' : 'red'} style={{ margin: 0 }}>{product.hasStock ? t('home.inStock') : t('home.outStock')}</Tag></div>
                    <div style={{ padding: '0 12px' }}><strong style={{ display: 'block', fontSize: 18, color: '#071126', lineHeight: 1.1 }}>{'\u00a5'}{Number(product.price).toFixed(2)}</strong><span style={{ color: '#8aa0bd', fontSize: 12 }}>{cnyToUsdt(product.price, rate)} USDT</span></div>
                    <div style={{ padding: '0 16px 0 4px' }}>{renderActions(product, true)}</div>
                  </article>
                ) : (
                  <article key={product.id} style={{ borderBottom: index === filteredProducts.length - 1 ? 'none' : '1px solid #eef2f7', padding: '12px 12px 13px', borderLeft: '7px solid ' + accent, opacity: product.hasStock ? 1 : .64 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 900, color: '#071126', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(product)}</div><div style={{ color: '#64748b', fontSize: 12, marginTop: 4, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{desc}</div></div>
                      <Tag color={product.hasStock ? 'green' : 'red'} style={{ margin: 0, flexShrink: 0 }}>{product.hasStock ? t('home.inStock') : t('home.outStock')}</Tag>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 11 }}>
                      <div><strong style={{ display: 'block', fontSize: 20, color: '#071126', lineHeight: 1.05 }}>{'\u00a5'}{Number(product.price).toFixed(2)}</strong><span style={{ color: '#8aa0bd', fontSize: 12 }}>{cnyToUsdt(product.price, rate)} USDT</span></div>
                      <div style={{ minWidth: 210, flex: 1 }}>{renderActions(product, true)}</div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid #e2e8f0', background: 'rgba(255,255,255,.76)', padding: 20, color: '#94a3b8', fontSize: 12 }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}><span>{t('home.footerBrand')}</span></div>
      </footer>
      <SupportWidget contact={contact} />
      <Drawer width={screens.md ? 520 : '92vw'} open={Boolean(detailProduct)} onClose={() => setDetailProduct(null)} title={ui.detailTitle} extra={detailProduct && <Tag color={detailProduct.hasStock ? 'green' : 'red'}>{detailProduct.hasStock ? t('home.inStock') : t('home.outStock')}</Tag>}>
        {detailProduct && <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div><h2 style={{ margin: 0, color: '#071126', letterSpacing: '-.03em' }}>{label(detailProduct)}</h2><div style={{ marginTop: 8 }}><Space size={6} wrap>{detailProduct.category?.parent && <Tag>{label(detailProduct.category.parent)}</Tag>}<Tag color="blue">{label(detailProduct.category || {})}</Tag></Space></div></div>
          <div style={{ padding: 16, borderRadius: 16, background: '#f8fafc', border: '1px solid #e2e8f0' }}><div style={{ color: '#64748b', fontSize: 12, fontWeight: 800, marginBottom: 4 }}>{ui.receivePrice}</div><strong style={{ fontSize: 30, color: '#071126' }}>{'\u00a5'}{Number(detailProduct.price).toFixed(2)}</strong><span style={{ marginLeft: 8, color: '#8aa0bd' }}>{cnyToUsdt(detailProduct.price, rate)} USDT</span></div>
          <div><div style={{ color: '#64748b', fontSize: 12, fontWeight: 850, marginBottom: 8 }}>{ui.description}</div><p style={{ margin: 0, color: '#334155', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{productDesc(detailProduct) || ui.noDescription}</p></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Button disabled={!detailProduct.hasStock} onClick={() => addToCart(detailProduct)} style={{ height: 42, borderRadius: 12, fontWeight: 800 }}>{t('home.add')}</Button><Button type="primary" disabled={!detailProduct.hasStock} onClick={() => buyNow(detailProduct)} style={{ height: 42, borderRadius: 12, fontWeight: 850 }}>{t('home.buy')}</Button></div>
        </Space>}
      </Drawer>
    </div>
  );
}