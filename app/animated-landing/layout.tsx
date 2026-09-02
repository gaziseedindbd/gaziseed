import './animated-shell.css';
import styles from './animated-pro-safe.module.css';

export default function AnimatedLandingLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${styles.scope} animated-pro-scope`}>{children}</div>;
}
