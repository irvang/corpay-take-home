import type { DatabaseSync } from 'node:sqlite';

export function seed(db: DatabaseSync) {
  const insertCompany = db.prepare('INSERT INTO companies (name) VALUES (?)');
  const insertUser = db.prepare('INSERT INTO users (company_id, name, role) VALUES (?, ?, ?)');
  const insertInvoice = db.prepare(
    "INSERT INTO invoices (company_id, vendor_name, total_minor_units, currency, due_date, status, version, submitted_by) VALUES (?, ?, ?, ?, ?, 'PENDING', 1, ?)",
  );

  const company = (name: string, requester: string, approver: string, admin: string) => {
    const companyId = Number(insertCompany.run(name).lastInsertRowid);
    return {
      companyId,
      requesterId: Number(insertUser.run(companyId, requester, 'requester').lastInsertRowid),
      approverId: Number(insertUser.run(companyId, approver, 'approver').lastInsertRowid),
      adminId: Number(insertUser.run(companyId, admin, 'admin').lastInsertRowid),
      invoiceIds: [] as number[],
    };
  };

  const northwind = company('Northwind Supply Co.', 'Nina Reyes', 'Omar Hale', 'Ada Brooks');
  const bluefin = company('Bluefin Logistics LLC', 'Ben Carter', 'Lena Ortiz', 'Sam Wu');

  const invoices: [typeof northwind, string, number, string, string][] = [
    [northwind, 'Harbor Point Packaging', 125000, 'USD', '2026-11-20'],
    [bluefin, 'Granite Ridge Freight', 48250, 'USD', '2026-11-21'],
    [northwind, 'Lumen Office Supply', 98000, 'EUR', '2026-11-27'],
    [bluefin, 'Kestrel Fuel Services', 350000, 'JPY', '2026-11-30'],
    [northwind, 'Sakura Components', 1200000, 'JPY', '2026-12-04'],
    [bluefin, 'Alder & Finch Consulting', 275050, 'EUR', '2026-12-08'],
    [northwind, 'Pinecrest Janitorial', 34999, 'USD', '2026-12-11'],
    [bluefin, 'Tidewater Dock Rentals', 1500000, 'USD', '2026-12-15'],
  ];
  for (const [c, vendor, minorUnits, currency, dueDate] of invoices) {
    c.invoiceIds.push(Number(insertInvoice.run(c.companyId, vendor, minorUnits, currency, dueDate, c.requesterId).lastInsertRowid));
  }

  return { northwind, bluefin };
}
