// import html2pdf from 'html2pdf.js';
const html2pdf = require('html2pdf.js');

export default function LayoutExportButtons({ layout }: { layout: any[] }) {
  const exportJson = () => {
    const blob = new Blob([JSON.stringify(layout, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'branding-layout.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const el = document.getElementById('wysiwyg-preview');
    if (el) {
      html2pdf()
        .set({
          filename: 'branding-preview.pdf',
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'mm', format: 'a4' },
        })
        .from(el)
        .save();
    }
  };

  return (
    <div className="flex gap-4 mt-4">
      <button onClick={exportJson} className="text-sm underline text-blue-600">
        Export JSON
      </button>
      <button onClick={exportPdf} className="text-sm underline text-green-600">
        Export PDF
      </button>
    </div>
  );
}
