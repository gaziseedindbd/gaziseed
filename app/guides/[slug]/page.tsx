import { redirect } from 'next/navigation';

export default function GuideDetailPage({ params }: { params: { slug: string } }) {
  redirect(`/blog/${params.slug}`);
}
