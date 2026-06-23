
import { useTranslation } from 'react-i18next';

export default function LangSwitch() {
  const { i18n, t } = useTranslation();
  const isZh = i18n.language?.startsWith('zh');
  const next = isZh ? 'en' : 'zh';

  return (
    <button
      type="button"
      onClick={() => {
        i18n.changeLanguage(next);
        localStorage.setItem('lang', next);
      }}
      style={{
        border: '1px solid #dbe3ef',
        background: '#fff',
        color: '#0f172a',
        height: 36,
        padding: '0 12px',
        borderRadius: 12,
        fontSize: 13,
        fontWeight: 800,
        cursor: 'pointer',
        boxShadow: '0 6px 16px rgba(15,23,42,.06)',
      }}
      aria-label="Switch language"
    >
      {t('lang')}
    </button>
  );
}
