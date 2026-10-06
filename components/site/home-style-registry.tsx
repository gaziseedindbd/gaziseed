'use client';

import { useServerInsertedHTML } from 'next/navigation';

export default function HomeStyleRegistry({ css }: { css: string }) {
  useServerInsertedHTML(() => (
    <style data-gazi-home-styles dangerouslySetInnerHTML={{ __html: css }} />
  ));

  return null;
}
