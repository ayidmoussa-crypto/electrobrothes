// Single-series bar chart in plain HTML: ink bars (one series = one brand colour, no legend),
// a tooltip on hover AND keyboard focus, a recessive baseline, and a table view for screen readers.

export function BarChart({
  title,
  data,
  formatLabel,
  formatValue = String,
}: {
  title: string;
  data: { key: string; value: number }[];
  formatLabel: (key: string) => string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  // Label every Nth bar so day labels never collide.
  const every = Math.ceil(data.length / 8);

  return (
    <figure className="rounded-xl border border-warm-200 bg-white p-4">
      <figcaption className="mb-4 text-sm font-bold text-ink">{title}</figcaption>
      <div className="flex h-48 items-end gap-0.5 border-b border-warm-300" role="img" aria-label={title}>
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full flex-1 items-end">
            <div
              tabIndex={0}
              aria-label={`${formatLabel(d.key)}: ${formatValue(d.value)}`}
              className={`w-full rounded-t-[4px] outline-offset-2 transition-colors ${d.value ? "bg-ink group-hover:bg-warm-700" : "bg-warm-200"}`}
              style={{ height: d.value ? `${Math.max(2, (d.value / max) * 100)}%` : "2px" }}
            />
            <span className="pointer-events-none absolute bottom-full start-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white shadow group-focus-within:block group-hover:block rtl:translate-x-1/2">
              {formatLabel(d.key)} · <b>{formatValue(d.value)}</b>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-0.5 text-[11px] text-warm-500" aria-hidden="true">
        {data.map((d, i) => (
          <span key={d.key} className="flex-1 truncate text-center">
            {i % every === 0 ? formatLabel(d.key) : ""}
          </span>
        ))}
      </div>
      {peak && peak.value > 0 ? (
        <p className="mt-2 text-xs text-warm-600">
          الذروة: {formatLabel(peak.key)} ({formatValue(peak.value)})
        </p>
      ) : null}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-warm-600">عرض كجدول</summary>
        <table className="mt-2 w-full text-start">
          <tbody>
            {data.map((d) => (
              <tr key={d.key} className="border-b border-warm-200">
                <th scope="row" className="py-1 text-start font-normal text-warm-600">
                  {formatLabel(d.key)}
                </th>
                <td className="py-1 font-semibold text-ink">{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
