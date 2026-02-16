import { nextTick, type Ref } from 'vue';

export function useExport(svgRef: Ref<SVGSVGElement | null>) {
  function cloneAndCleanSvg(): SVGSVGElement | null {
    const svg = svgRef.value;
    if (!svg) return null;

    const clone = svg.cloneNode(true) as SVGSVGElement;

    // Remove non-exportable elements: cursors, resize handles, toolbox, text editor, grid, preview shapes
    const selectorsToRemove = [
      '[data-export-ignore]',
      'foreignObject',
    ];

    for (const sel of selectorsToRemove) {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    }

    // Set explicit dimensions
    const bbox = svg.getBoundingClientRect();
    clone.setAttribute('width', String(bbox.width));
    clone.setAttribute('height', String(bbox.height));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

    return clone;
  }

  function downloadFile(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportPng() {
    await nextTick();
    const clone = cloneAndCleanSvg();
    if (!clone) return;

    const width = parseInt(clone.getAttribute('width') || '1920', 10);
    const height = parseInt(clone.getAttribute('height') || '1080', 10);
    const scale = 2; // High-res export

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(clone);
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.scale(scale, scale);
        // Draw dark background
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) downloadFile(blob, `canvas-${Date.now()}.png`);
          resolve();
        }, 'image/png');
      };
      img.src = dataUrl;
    });
  }

  return { exportPng };
}
