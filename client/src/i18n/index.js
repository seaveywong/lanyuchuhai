
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const zh = {
  lang: 'EN',
  nav: { lookup: '查订单', cart: '购物车' },
  home: {
    subtitle: '账号资源自助下单',
    title: '商品列表',
    desc: '选择分类，加入购物车，下单后按订单状态自动交付。',
    search: '搜索商品',
    all: '全部',
    allSub: '全部小类',
    inStock: '有库存',
    outStock: '缺货',
    add: '加入购物车',
    buy: '立即购买',
    empty: '没有匹配商品',
    fallbackDesc: '库存商品，下单后按订单状态交付。',
    loadFail: '商品加载失败',
    added: '已加入购物车',
    noStock: '当前缺货',
    footerBrand: '© 蓝域出海',
  },
  support: { button: '客服', title: '联系客服', text: '下单前后如需确认库存、支付或交付，请联系人工客服。' },
};

const en = {
  lang: '中文',
  nav: { lookup: 'Orders', cart: 'Cart' },
  home: {
    subtitle: 'Self-service account marketplace',
    title: 'Products',
    desc: 'Choose a category, add items to cart, and receive delivery based on order status.',
    search: 'Search products',
    all: 'All',
    allSub: 'All subcategories',
    inStock: 'In stock',
    outStock: 'Out',
    add: 'Add to cart',
    buy: 'Buy now',
    empty: 'No matching products',
    fallbackDesc: 'Inventory item. Delivery follows order status.',
    loadFail: 'Failed to load products',
    added: 'Added to cart',
    noStock: 'Out of stock',
    footerBrand: '© BlueReach',
  },
  support: { button: 'Support', title: 'Contact support', text: 'Contact support if you need help with stock, payment, or delivery.' },
};

i18n.use(initReactI18next).init({
  resources: { zh: { translation: zh }, en: { translation: en } },
  lng: localStorage.getItem('lang') || 'zh',
  fallbackLng: 'zh',
  interpolation: { escapeValue: false },
});

export default i18n;
