import type { SourceSnapshot } from "@/lib/types/price";
import { formatJPY } from "@/lib/pricing";

export function MarketTable({ rows }: { rows: SourceSnapshot[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Type</th>
            <th>Price</th>
            <th>Status</th>
            <th>Buy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const soldOut = row.priceJpy === null;

            return (
              <tr key={row.sourceName}>
                <td>{row.sourceName}</td>
                <td>{row.sourceType}</td>
                <td>
                  {soldOut ? "-" : formatJPY(row.priceJpy ?? 0)}
                </td>
                <td>
                  <span className={`badge ${soldOut ? "warn" : "neutral"}`}>
                    {soldOut ? "Sold Out" : "Live"}
                  </span>
                </td>
                <td>
                  <a className="buy-link" href={row.buyUrl} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
