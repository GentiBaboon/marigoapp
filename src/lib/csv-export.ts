interface CSVColumn<T> {
  key: string;
  header: string;
  transform?: (value: any, row: T) => string;
}

export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: CSVColumn<T>[],
  filename: string
): void {
  const headers = columns.map(c => c.header);
  const rows = data.map(row =>
    columns.map(col => {
      const val = row[col.key];
      const transformed = col.transform ? col.transform(val, row) : String(val ?? '');
      // Escape CSV values
      return `"${transformed.replace(/"/g, '""')}"`;
    })
  );

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
