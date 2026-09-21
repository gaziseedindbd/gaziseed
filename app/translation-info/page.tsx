export default function TranslationInfoPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-2xl font-black text-slate-900">Hindi Translation Information</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Hindi content on the India website may be automatically translated from the original
          English or Bengali content using Google Cloud Translation. Translations are provided for
          convenience and may contain inaccuracies; the original source content remains the
          reference version.
        </p>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Translation technology is provided by Google. See{' '}
          <a
            href="https://translate.google.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="font-semibold text-emerald-700 underline underline-offset-2"
          >
            Google Translate
          </a>{' '}
          for more information.
        </p>
      </div>
    </main>
  );
}
