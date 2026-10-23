import type { Metadata } from 'next';
import ProductSeoLayout, { generateMetadata as generateProductMetadata } from '../../../product/[slug]/layout';

type ProductRouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductRouteProps): Promise<Metadata> {
  return generateProductMetadata({ params });
}

export default ProductSeoLayout;
