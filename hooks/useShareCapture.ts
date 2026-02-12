import { useCallback } from 'react';
import html2canvas from 'html2canvas';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { AnalyticsService } from '../services/analyticsService';
import { Language } from '../translations';

interface UseShareCaptureOptions {
  darkMode: boolean;
  lang: Language;
  t: (key: string, ...args: any[]) => string;
  setIsSharing: (v: string | null) => void;
  setShowReviewPrompt: (v: boolean) => void;
}

export const useShareCapture = ({ darkMode, lang, t, setIsSharing, setShowReviewPrompt }: UseShareCaptureOptions) => {
  const downloadImage = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${fileName}.png`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const logShareEvent = useCallback((type: string) => {
    AnalyticsService.logEvent('share_result', { type });
  }, []);

  const triggerReviewPrompt = useCallback(() => {
    const cooldown = localStorage.getItem('app_review_cooldown');
    if (cooldown !== 'DONE') {
      const now = new Date();
      if (!cooldown || now > new Date(cooldown)) {
        setTimeout(() => setShowReviewPrompt(true), 1500);
      }
    }
  }, [setShowReviewPrompt]);

  const handleShare = useCallback(async (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    setIsSharing(elementId);
    const rect = element.getBoundingClientRect();

    try {
      const bgColor = darkMode ? '#020617' : '#fdfcf9';
      const canvas = await html2canvas(element, {
        scale: 3, backgroundColor: bgColor, logging: false, useCORS: true, allowTaint: true,
        scrollX: 0, scrollY: 0, x: 0, y: 0,
        ignoreElements: (el) => el.hasAttribute('data-capture-ignore'),
        onclone: (clonedDoc, clonedElement) => {
          const html = clonedDoc.documentElement;
          if (darkMode) {
            html.classList.add('dark');
            clonedDoc.body.style.backgroundColor = '#020617';
            clonedElement.style.backgroundColor = '#020617';
            clonedElement.style.color = '#f1f5f9';
          } else {
            html.classList.remove('dark');
            clonedDoc.body.style.backgroundColor = '#FFFFFF';
            clonedElement.style.backgroundColor = '#FFFFFF';
            clonedElement.style.color = '#202124';
          }
          clonedElement.style.width = `${rect.width}px`;
          clonedElement.style.display = 'block';
          clonedElement.style.position = 'relative';

          const style = clonedDoc.createElement('style');
          style.innerHTML = `
          * { transition: none !important; animation: none !important; -webkit-print-color-adjust: exact;
            font-family: ${lang === 'ja' ? '"Pretendard JP Variable", "Pretendard JP"' : '"Pretendard Variable", Pretendard'}, sans-serif !important; }
          .truncate { overflow: visible !important; white-space: normal !important; text-overflow: clip !important; }
          .overflow-hidden { overflow: visible !important; }
          span, p, h1, h2, h3, h4 { -webkit-print-color-adjust: exact; font-family: inherit !important; }
          .animate-in {opacity: 1 !important; transform: none !important; animation: none !important; visibility: visible !important; }
          [data-capture-ignore] {display: none !important; visibility: hidden !important; }
          `;
          clonedDoc.head.appendChild(style);
          clonedElement.style.opacity = '1';
          clonedElement.style.transform = 'none';

          const promoFooter = clonedElement.querySelector('[data-promo-footer]');
          if (promoFooter) { (promoFooter as HTMLElement).style.display = 'flex'; }
        }
      });

      if (Capacitor.isNativePlatform()) {
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1];
              try {
                const savedFile = await Filesystem.writeFile({ path: `${fileName}_${Date.now()}.png`, data: base64data, directory: Directory.Cache });
                await Share.share({ files: [savedFile.uri], dialogTitle: t('shareDialogTitle') });
                triggerReviewPrompt();
              } catch (err) { console.error('Share failed:', err); downloadImage(blob, fileName); }
              logShareEvent('native_share');
            };
            reader.readAsDataURL(blob);
          } catch (err) { console.error('File system error:', err); downloadImage(blob, fileName); }
        }, 'image/png');
      } else {
        canvas.toBlob((blob) => {
          if (!blob) return;
          const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: t('shareTitle') }).then(() => {
              triggerReviewPrompt();
            });
          } else { downloadImage(blob, fileName); }
          logShareEvent('web_share');
        }, 'image/png');
      }
    } catch (err) { console.error('Capture failed:', err); } finally { setIsSharing(null); }
  }, [darkMode, lang, t, setIsSharing, downloadImage, logShareEvent, triggerReviewPrompt]);

  return { handleShare };
};
