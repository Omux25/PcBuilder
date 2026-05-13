import { Link } from 'react-router-dom';
import styles from './NotFound.module.css';

export function NotFound() {
    return (
        <div className={styles.page}>
            <div className={styles.code}>404</div>
            <h1 className={styles.title}>Page introuvable</h1>
            <p className={styles.sub}>Cette page n'existe pas ou a été déplacée.</p>
            <Link to="/" className={styles.homeBtn}>Retour à l'accueil</Link>
        </div>
    );
}
