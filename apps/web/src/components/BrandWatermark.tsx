import styles from './BrandWatermark.module.css';

// Client-branding mark for the Concree deployment. Mounted once at the App
// root (outside AppInner's view switching) so it renders in the header
// position on every screen — entry views, an open project, settings dialogs
// — without threading it through each view's own chrome.
export function BrandWatermark() {
  return (
    <div className={styles.root} aria-hidden>
      <img src="/logo-concree.svg" alt="" />
    </div>
  );
}
