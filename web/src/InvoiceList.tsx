import { formatMoney } from './money.ts';
import type { Invoice } from './types.ts';

type Props = {
  invoices: Invoice[];
  selectedId: number | null;
  onSelect: (invoiceId: number) => void;
};

export function InvoiceList({ invoices, selectedId, onSelect }: Props) {
  if (invoices.length === 0) return <p>No invoices.</p>;

  return (
    <table className="invoice-list">
      <thead>
        <tr>
          <th>Vendor</th>
          <th className="amount">Amount</th>
          <th>Due</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {invoices.map((invoice) => (
          <tr
            key={invoice.id}
            className={invoice.id === selectedId ? 'selected' : undefined}
            onClick={() => onSelect(invoice.id)}
          >
            <td>{invoice.vendor_name}</td>
            <td className="amount">{formatMoney(invoice.total_minor_units, invoice.currency)}</td>
            <td>{invoice.due_date}</td>
            <td>{invoice.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
