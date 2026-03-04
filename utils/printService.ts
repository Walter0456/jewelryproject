const esc = (s: any): string => {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#39;');
};

export const printFullReport = (
  title: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  metadata?: { branch?: string; verifiedBy?: string }
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <html>
      <head>
        <title>${esc(title)}</title>
        <style>
          @page { size: auto; margin: 20mm; }
          body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; color: #333; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
          .header h1 { margin: 0; text-transform: uppercase; font-size: 20px; }
          .header p { margin: 5px 0; font-size: 12px; color: #666; }

          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f8fafc; color: #64748b; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; padding: 12px 8px; border: 1px solid #e2e8f0; }
          td { padding: 10px 8px; border: 1px solid #e2e8f0; font-size: 11px; }

          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }

          .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; }
          .verified-box { margin-top: 40px; display: flex; justify-content: flex-end; }
          .signature { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 5px; font-weight: bold; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Rodriguez Jewelry</h1>
          <p>${esc(metadata?.branch || 'Main')} Branch - ${esc(title)}</p>
          <p>Generated on: ${new Date().toLocaleString()}</p>
        </div>

        <table>
          <thead>
            <tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>

        <div class="verified-box">
          <div>
            <p style="font-size: 10px; color: #666; margin-bottom: 40px;">Verified By:</p>
            <div class="signature">${esc(metadata?.verifiedBy || '________________')}</div>
          </div>
        </div>

        <div class="footer">
          <p>JewelAdmin Pro Audit System - Page-to-Page Continuity Guaranteed</p>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
};
