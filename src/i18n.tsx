import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Language = 'vi' | 'zh-CN';
type Translate = (vi: string, zh: string) => string;
const LanguageContext = createContext<{ language: Language; change: (value: Language) => void; t: Translate }>({
  language: 'vi', change: () => {}, t: (vi) => vi,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, change] = useState<Language>(() => {
    try { return localStorage.getItem('hoa-phu-language') === 'zh-CN' ? 'zh-CN' : 'vi'; }
    catch { return 'vi'; }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem('hoa-phu-language', language); } catch { /* Storage is optional. */ }
  }, [language]);

  return <LanguageContext.Provider value={{ language, change, t: (vi, zh) => language === 'vi' ? vi : zh }}>
    {children}
  </LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
