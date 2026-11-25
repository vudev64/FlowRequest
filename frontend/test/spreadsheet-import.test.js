import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';

test('patched SheetJS preserves HR import columns, Vietnamese text and CSV/XLSX values', () => {
  assert.equal(XLSX.version, '0.20.3');
  const rows = [{ Fullname: 'Nguyễn Thị Ánh', Email: 'anh@example.invalid', Password: 'FixtureOnly123!', Role: 'EMPLOYEE', Department: 'Kế toán', ManagerEmail: 'manager@example.invalid' }];
  const sheet = XLSX.utils.json_to_sheet(rows), book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Nhân sự');
  for (const bookType of ['xlsx', 'csv']) {
    const bytes = XLSX.write(book, { type: 'array', bookType });
    const decoded = XLSX.read(bytes, { type: 'array', sheetRows: 502 });
    const imported = XLSX.utils.sheet_to_json(decoded.Sheets[decoded.SheetNames[0]], { defval: '', raw: false });
    assert.deepEqual(imported, rows, bookType);
  }
});
