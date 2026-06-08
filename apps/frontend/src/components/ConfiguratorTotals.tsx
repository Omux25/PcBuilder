import { Check, Printer, RefreshCw, Share2, Zap } from 'lucide-react';
import styles from './Configurator.module.css';
import { formatPrice } from '@shared/formatting/price.formatter';

interface ConfiguratorTotalsProps {
  hasComponents: boolean;
  tdp: number;
  psuPercent: number;
  psuStatus: string;
  recommendedWattage?: number;
  totalPrice: number;
  copied: boolean;
  confirmReset: boolean;
  onShare: () => void;
  onReset: () => void;
  onResetConfirm: () => void;
  onResetCancel: () => void;
}

export function ConfiguratorTotals({
  hasComponents,
  tdp,
  psuPercent,
  psuStatus,
  recommendedWattage,
  totalPrice,
  copied,
  confirmReset,
  onShare,
  onReset,
  onResetConfirm,
  onResetCancel,
}: ConfiguratorTotalsProps) {
  return (
    <>
      {hasComponents && (
        <div className={styles.powerSection}>
          <div className={styles.powerMain}>
            <div className={styles.powerInfo}>
              <div className={styles.powerLabel}>
                <Zap size={16} className={styles.zapIcon} />
                <span>Consommation</span>
              </div>
              <div className={styles.tdpVal}>{tdp}W</div>
            </div>
            <div className={styles.progressBar}>
              <div
                className={`${styles.progressFill} ${styles['psu_' + psuStatus]}`}
                style={{ width: `${psuPercent}%` }}
              />
            </div>
            <div className={styles.psuTarget}>
              Conseillé: <strong>{recommendedWattage ?? '—'}W</strong>
            </div>
          </div>
        </div>
      )}

      <div className={styles.totalSection}>
        <div className={styles.totalInfo}>
          <span className={styles.totalLabel}>Total estimé</span>
          <span className={styles.totalPrice}>{formatPrice(totalPrice)}</span>
        </div>
        {hasComponents && (
          <div className={styles.footerActions}>
            <button
              className={`${styles.shareBtn} ${copied ? styles.shareBtnDone : ''}`}
              onClick={onShare}
            >
              {copied ? <><Check size={18} /> Copié !</> : <><Share2 size={18} /> Partager</>}
            </button>

            <button
              className={styles.exportBtn}
              onClick={() => window.print()}
            >
              <Printer size={16} /> Exporter PDF
            </button>
            {confirmReset ? (
              <div className={styles.resetConfirm}>
                <button className={styles.resetConfirmYes} onClick={onResetConfirm}>
                  Vider ?
                </button>
                <button className={styles.resetConfirmNo} onClick={onResetCancel}>
                  Non
                </button>
              </div>
            ) : (
              <button className={styles.resetBtn} onClick={onReset}>
                <RefreshCw size={16} />
                Réinitialiser
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
