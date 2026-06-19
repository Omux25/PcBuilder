import { useEffect, useState } from 'react';
import { X, Copy, Check, QrCode, Share2, Clipboard, ExternalLink } from 'lucide-react';
import { useClipboard } from '../hooks/useClipboard';
import styles from './ShareModal.module.css';
import { shareBuild } from '../api';
import { formatToReddit, formatToDiscord, formatToBBCode } from '../utils/exportFormatter';
import type { BuildConfig } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  build: BuildConfig;
  totalPrice: number;
}

type TabType = 'link' | 'social' | 'reddit' | 'discord' | 'bbcode';

export function ShareModal({ isOpen, onClose, build, totalPrice }: ShareModalProps) {
  const [shortUrl, setShortUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('link');
  const { copied: copiedText, copy: handleCopy } = useClipboard();

  useEffect(() => {
    if (!isOpen) return;

    // Reset state
    setShortUrl('');
    setError('');
    setActiveTab('link');

    async function generateLink() {
      setLoading(true);
      try {
        const buildIds: Record<string, number> = {};
        for (const [key, comp] of Object.entries(build)) {
          if (comp) buildIds[key] = comp.id;
        }

        const res = await shareBuild(buildIds);
        setShortUrl(`${window.location.origin}/b/${res.id}`);
      } catch (err) {
        console.error('Failed to generate shared link:', err);
        setError('Impossible de générer le lien de partage. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    }

    generateLink();
  }, [isOpen, build]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getTemplateContent = (): string => {
    switch (activeTab) {
      case 'reddit':
        return formatToReddit(build, totalPrice);
      case 'discord':
        return formatToDiscord(build, totalPrice);
      case 'bbcode':
        return formatToBBCode(build, totalPrice);
      default:
        return '';
    }
  };

  const textToCopy = getTemplateContent();

  const shareTexts = {
    whatsapp: `Découvrez ma configuration PC : ${shortUrl}`,
    twitter: `Découvrez ma configuration PC : ${shortUrl}`
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h3 className={styles.title}>Partager la configuration</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loaderContainer}>
              <div className={styles.spinner} />
              <span>Génération du lien court...</span>
            </div>
          ) : error ? (
            <div className={styles.loaderContainer}>
              <span className={styles.errorText}>{error}</span>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <nav className={styles.tabs} aria-label="Share options">
                <button
                  className={`${styles.tab} ${activeTab === 'link' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('link')}
                >
                  <QrCode size={15} /> Lien & QR
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'social' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('social')}
                >
                  <Share2 size={15} /> Réseaux
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'reddit' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('reddit')}
                >
                  Reddit
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'discord' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('discord')}
                >
                  Discord / Texte
                </button>
                <button
                  className={`${styles.tab} ${activeTab === 'bbcode' ? styles.activeTab : ''}`}
                  onClick={() => setActiveTab('bbcode')}
                >
                  BBCode
                </button>
              </nav>

              {/* Tab Content Panel */}
              <div className={styles.panel}>
                {activeTab === 'link' && (
                  <>
                    <div className={styles.linkContainer}>
                      <input
                        type="text"
                        className={styles.urlInput}
                        value={shortUrl}
                        readOnly
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        className={`${styles.copyBtn} ${copiedText ? styles.copiedBtn : ''}`}
                        onClick={() => handleCopy(shortUrl)}
                      >
                        {copiedText ? (
                          <>
                            <Check size={16} /> Copié !
                          </>
                        ) : (
                          <>
                            <Copy size={16} /> Copier
                          </>
                        )}
                      </button>
                    </div>

                    <div className={styles.qrWrapper}>
                      <div className={styles.qrCodeContainer}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shortUrl)}`}
                          alt="QR Code de configuration"
                          className={styles.qrCode}
                          loading="lazy"
                        />
                      </div>
                      <span className={styles.qrLabel}>Scannez pour ouvrir sur mobile</span>
                    </div>
                  </>
                )}

                {activeTab === 'social' && (
                  <div className={styles.socialGrid}>
                    <a
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareTexts.whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.socialBtn} ${styles.whatsappBtn}`}
                    >
                      WhatsApp <ExternalLink size={14} />
                    </a>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTexts.twitter)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${styles.socialBtn} ${styles.twitterBtn}`}
                    >
                      Twitter / X <ExternalLink size={14} />
                    </a>
                  </div>
                )}

                {(activeTab === 'reddit' || activeTab === 'discord' || activeTab === 'bbcode') && (
                  <div className={styles.templateWrapper}>
                    <textarea
                      className={styles.textarea}
                      value={textToCopy}
                      readOnly
                      onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    />
                    <button
                      className={`${styles.copyBtn} ${copiedText ? styles.copiedBtn : ''}`}
                      onClick={() => handleCopy(textToCopy)}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      {copiedText ? (
                        <>
                          <Check size={16} /> Copié !
                        </>
                      ) : (
                        <>
                          <Clipboard size={16} /> Copier le modèle
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
