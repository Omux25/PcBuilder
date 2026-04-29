import styles from './Skeleton.module.css';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ className, width, height, borderRadius, style }: SkeletonProps) {
  return (
    <div
      className={`${styles.skeleton} ${className || ''}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={`${styles.skeletonTextContainer} ${className || ''}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="1.2rem"
          width={i === lines - 1 && lines > 1 ? '70%' : '100%'}
          style={{ marginBottom: i === lines - 1 ? 0 : '0.5rem' }}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`${styles.skeletonCard} ${className || ''}`}>
      <Skeleton height={180} borderRadius="var(--radius) var(--radius) 0 0" />
      <div className={styles.skeletonCardBody}>
        <Skeleton height="1.4rem" width="80%" style={{ marginBottom: '1rem' }} />
        <SkeletonText lines={2} />
        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton height="2rem" width="40%" />
          <Skeleton height="2rem" width="30%" />
        </div>
      </div>
    </div>
  );
}
