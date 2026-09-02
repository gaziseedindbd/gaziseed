import './animated-shell.css';
import './order-success-force.css';
import styles from './animated-pro-safe.module.css';
import successStyles from './order-success.module.css';
import successFixStyles from './order-success-fix-v2.module.css';

export default function AnimatedLandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${styles.scope} ${successStyles.scope} ${successFixStyles.scope} animated-pro-scope`}>{children}</div>;
}
