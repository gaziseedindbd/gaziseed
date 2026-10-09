// Public combo detail pages enforce active status and visitor-country scoping
// in their data queries. Do not hide the entire page while feature flags load.
export default function ComboLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
