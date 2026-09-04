'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const HEADERS = ['type', 'sku', 'stock', 'reason', 'reference_id'];

function csvEscape(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"' && quoted && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }

    if (c === '"') {
      quoted = !quoted;
      continue;
    }

    if (c === ',' && !quoted) {
      row.push(cur);
      cur = '';
      continue;
    }

    if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && next === '\n') i += 1;
      row.push(cur);
      cur = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    cur += c;
  }

  if (cur !== '' || row.length) {
    row.push(cur);
    if (row.some((x) => x.trim() !== '')) rows.push(row);
  }

  return rows;
}

export default function InventoryImportExport() {
  const [country, setCountry] = useState('BD');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function exportCsv() {
    setMsg('');
    setErrors([]);

    const supabase = createClient();
    const [{ data: products, error: productError }, { data: variants, error: variantError }] =
      await Promise.all([
        supabase
          .from('products')
          .select('sku,stock')
          .eq('country', country)
          .order('sku')
          .limit(5000),
        supabase
          .from('product_variants')
          .select('sku,stock,products!inner(country)')
          .eq('products.country', country)
          .order('sku')
          .limit(5000),
      ]);

    if (productError || variantError) {
      setMsg((productError || variantError)?.message || 'Export failed');
      return;
    }

    const output = [
      ...(products || []).map((r) => ({ type: 'product', sku: r.sku, stock: r.stock })),
      ...(variants || []).map((r) => ({ type: 'variant', sku: r.sku, stock: r.stock })),
    ];

    const csv = [
      HEADERS.join(','),
      ...output.map((r) => [r.type, r.sku, r.stock, 'export', ''].map(csvEscape).join(',')),
    ].join('\n');

    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gaziseed-inventory-${country}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMsg(`Exported ${output.length} rows for ${country}.`);
  }

  function parseFile(file: File) {
    setMsg('');
    setErrors([]);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const matrix = parseCsv(String(reader.result || ''));
        if (matrix.length < 2) {
          setMsg('CSV must contain a header and at least one data row.');
          return;
        }

        const headers = matrix[0].map((x) => x.trim().toLowerCase());
        if (!HEADERS.every((key) => headers.includes(key))) {
          setMsg(`Required columns: ${HEADERS.join(', ')}`);
          return;
        }

        const data = matrix.slice(1).map((values) =>
          Object.fromEntries(headers.map((key, index) => [key, values[index] ?? ''])),
        );

        const validationErrors: string[] = [];
        const seen = new Set<string>();

        data.forEach((r, index) => {
          const type = String(r.type || 'product').trim().toLowerCase();
          const sku = String(r.sku || '').trim();
          const key = `${type}:${sku}`;
          const stock = Number(r.stock);

          if (seen.has(key)) validationErrors.push(`Row ${index + 2}: duplicate ${key}`);
          seen.add(key);
          if (!['product', 'variant'].includes(type)) {
            validationErrors.push(`Row ${index + 2}: type must be product or variant`);
          }
          if (!sku) validationErrors.push(`Row ${index + 2}: SKU required`);
          if (!Number.isFinite(stock) || stock < 0) {
            validationErrors.push(`Row ${index + 2}: stock must be a non-negative number`);
          }
          if (
            r.reference_id &&
            !/^[0-9a-f-]{36}$/i.test(String(r.reference_id).trim())
          ) {
            validationErrors.push(`Row ${index + 2}: invalid reference_id`);
          }
        });

        setRows(data);
        setErrors(validationErrors);
        setMsg(
          `Preview loaded: ${data.length} rows.${
            validationErrors.length ? ' Fix validation errors before applying.' : ''
          }`,
        );
      } catch (error) {
        setMsg(error instanceof Error ? error.message : 'Invalid CSV');
      }
    };
    reader.readAsText(file);
  }

  async function apply() {
    if (!rows.length || errors.length) {
      setMsg('Fix all CSV validation errors before applying.');
      return;
    }

    setBusy(true);
    setMsg('');

    const supabase = createClient();
    const payload = rows.map((r) => ({
      type: String(r.type || 'product').trim().toLowerCase(),
      sku: String(r.sku || '').trim(),
      stock: Number(r.stock),
      reason: String(r.reason || 'bulk_import').trim() || 'bulk_import',
      reference_id: String(r.reference_id || '').trim() || null,
    }));

    const { data, error } = await supabase.rpc('admin_bulk_import_inventory', {
      p_country: country,
      p_rows: payload,
    });

    setBusy(false);

    if (error) {
      setMsg(`Import failed: ${error.message}`);
      return;
    }

    setMsg(`Import successful: ${data?.updated ?? rows.length} rows updated transactionally.`);
    setRows([]);
    setErrors([]);
  }

  function downloadTemplate() {
    const csv = [HEADERS.join(','), 'product,SKU-001,100,bulk_import,'].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'gaziseed-inventory-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="p-5 md:p-8">
      <h1 className="text-3xl font-black">Inventory Import / Export</h1>
      <p className="mt-1 text-gray-500">
        Transactional bulk stock replacement by product or variant SKU. Negative stock and duplicate rows are rejected.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <select
          value={country}
          onChange={(event) => {
            setCountry(event.target.value);
            setRows([]);
            setErrors([]);
          }}
          className="rounded-xl border bg-white px-4 py-3"
        >
          <option value="BD">Bangladesh</option>
          <option value="IN">India</option>
        </select>

        <button onClick={downloadTemplate} className="rounded-xl border bg-white px-5 py-3">
          CSV Template
        </button>
        <button onClick={exportCsv} className="rounded-xl bg-black px-5 py-3 text-white">
          Export CSV
        </button>
        <label className="cursor-pointer rounded-xl border bg-white px-5 py-3">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) parseFile(file);
            }}
          />
        </label>
        {rows.length > 0 && (
          <button
            disabled={busy || errors.length > 0}
            onClick={apply}
            className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Importing…' : `Apply ${rows.length} rows`}
          </button>
        )}
      </div>

      {msg && <p className="mt-4 rounded-xl border bg-white p-4">{msg}</p>}

      {errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <b>Validation errors</b>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {errors.slice(0, 20).map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-6 overflow-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                {Object.keys(rows[0]).map((key) => (
                  <th key={key} className="px-4 py-3 text-left">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((row, rowIndex) => (
                <tr key={rowIndex} className="border-b">
                  {Object.values(row).map((value, valueIndex) => (
                    <td key={valueIndex} className="px-4 py-3">
                      {String(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
