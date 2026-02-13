import { useCallback } from 'react';
import { toPng } from 'html-to-image';
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

const prepareForCapture = (element: HTMLElement): (() => void) => {
  const restoreFns: (() => void)[] = [];

  // 1. Show promo footer
  const promoFooter = element.querySelector('[data-promo-footer]') as HTMLElement;
  if (promoFooter) {
    const orig = promoFooter.style.display;
    promoFooter.style.display = 'flex';
    restoreFns.push(() => { promoFooter.style.display = orig; });
  }

  // 2. Reduce bottom padding (pb-48 = 192px → 16px)
  const origPB = element.style.paddingBottom;
  element.style.paddingBottom = '16px';
  restoreFns.push(() => { element.style.paddingBottom = origPB; });

  // 3. fixed → relative for proper capture (ResultOverlay)
  if (getComputedStyle(element).position === 'fixed') {
    const origStyles = {
      position: element.style.position,
      overflow: element.style.overflow,
      inset: element.style.inset,
      height: element.style.height,
    };
    Object.assign(element.style, {
      position: 'relative',
      overflow: 'visible',
      inset: 'auto',
      height: 'auto',
    });
    restoreFns.push(() => Object.assign(element.style, origStyles));
  }

  return () => restoreFns.forEach(fn => fn());
};

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

    const restore = prepareForCapture(element);

    try {
      const bgColor = darkMode ? '#020617' : '#fdfcf9';
      const dataUrl = await toPng(element, {
        pixelRatio: 3,
        backgroundColor: bgColor,
        filter: (node) => {
          if (node instanceof Element && node.hasAttribute('data-capture-ignore')) return false;
          return true;
        },
      });

      const response = await fetch(dataUrl);
      const blob = await response.blob();

      if (Capacitor.isNativePlatform()) {
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
      } else {
        const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: t('shareTitle') }).then(() => {
            triggerReviewPrompt();
          });
        } else { downloadImage(blob, fileName); }
        logShareEvent('web_share');
      }
    } catch (err) { console.error('Capture failed:', err); } finally {
      restore();
      setIsSharing(null);
    }
  }, [darkMode, lang, t, setIsSharing, downloadImage, logShareEvent, triggerReviewPrompt]);

  return { handleShare };
};
