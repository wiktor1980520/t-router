import { useState } from 'react';
import { MessageCircle, X, Mail, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function FloatingContact() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('service@t-router.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-gray-900 rounded-2xl shadow-2xl border border-gray-800 overflow-hidden">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">{t('contact.title')}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <p className="text-sm text-gray-400 mb-2">{t('contact.feishu_desc')}</p>
              <div className="flex justify-center bg-white rounded-lg p-4">
                <img
                  src="/feishu-qr.png"
                  alt={t('contact.feishu_qr_alt')}
                  className="w-48 h-48 object-contain"
                />
              </div>
            </div>
            <div className="pt-4 border-t border-gray-800">
              <p className="text-sm text-gray-400 mb-2">{t('contact.email_desc')}</p>
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-3">
                <Mail className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <span className="text-sm text-gray-200 flex-1">service@t-router.com</span>
                <button
                  onClick={handleCopyEmail}
                  className="p-2 text-gray-400 hover:text-white rounded-md hover:bg-gray-700 transition-colors"
                  title={t('contact.copy_email')}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copied && (
                <p className="text-xs text-green-400 mt-2">{t('contact.copied')}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        title={t('contact.open')}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
