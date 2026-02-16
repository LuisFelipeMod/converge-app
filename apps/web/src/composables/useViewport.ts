import { ref, computed } from 'vue';

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;
const ZOOM_FACTOR = 0.1;

export function useViewport() {
  const panX = ref(0);
  const panY = ref(0);
  const scale = ref(1);
  const isPanning = ref(false);
  const svgWidth = ref(window.innerWidth);
  const svgHeight = ref(window.innerHeight);

  const viewBox = computed(
    () => `${panX.value} ${panY.value} ${svgWidth.value / scale.value} ${svgHeight.value / scale.value}`,
  );

  let spaceDown = false;
  let panStart: { x: number; y: number; panX: number; panY: number } | null = null;

  function clampScale(s: number): number {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  }

  function toWorldCoords(clientX: number, clientY: number, svgEl: SVGSVGElement): { x: number; y: number } {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svgEl.getScreenCTM();
    if (ctm) {
      const worldPt = pt.matrixTransform(ctm.inverse());
      return { x: worldPt.x, y: worldPt.y };
    }
    // Fallback
    const rect = svgEl.getBoundingClientRect();
    return {
      x: panX.value + (clientX - rect.left) / scale.value,
      y: panY.value + (clientY - rect.top) / scale.value,
    };
  }

  function handleWheel(e: WheelEvent, svgEl: SVGSVGElement) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();

    const rect = svgEl.getBoundingClientRect();
    const oldScale = scale.value;
    const delta = e.deltaY > 0 ? -ZOOM_FACTOR : ZOOM_FACTOR;
    const newScale = clampScale(oldScale + delta * oldScale);

    // Zoom centered on cursor
    const worldX = panX.value + (e.clientX - rect.left) / oldScale;
    const worldY = panY.value + (e.clientY - rect.top) / oldScale;
    panX.value = worldX - (e.clientX - rect.left) / newScale;
    panY.value = worldY - (e.clientY - rect.top) / newScale;
    scale.value = newScale;
  }

  function startPan(e: MouseEvent) {
    // Middle mouse button or space+left click
    if (e.button === 1 || (spaceDown && e.button === 0)) {
      isPanning.value = true;
      panStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value };
      e.preventDefault();
      return true;
    }
    return false;
  }

  function onPan(e: MouseEvent) {
    if (!isPanning.value || !panStart) return false;
    const dx = (e.clientX - panStart.x) / scale.value;
    const dy = (e.clientY - panStart.y) / scale.value;
    panX.value = panStart.panX - dx;
    panY.value = panStart.panY - dy;
    return true;
  }

  function endPan() {
    if (!isPanning.value) return false;
    isPanning.value = false;
    panStart = null;
    return true;
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && !e.repeat) {
      spaceDown = true;
    }
  }

  function onKeyUp(e: KeyboardEvent) {
    if (e.code === 'Space') {
      spaceDown = false;
      if (isPanning.value) {
        endPan();
      }
    }
  }

  function isSpaceDown() {
    return spaceDown;
  }

  function zoomIn() {
    const oldScale = scale.value;
    const newScale = clampScale(oldScale + ZOOM_FACTOR * oldScale);
    // Zoom centered on viewport center
    const cx = svgWidth.value / 2;
    const cy = svgHeight.value / 2;
    const worldX = panX.value + cx / oldScale;
    const worldY = panY.value + cy / oldScale;
    panX.value = worldX - cx / newScale;
    panY.value = worldY - cy / newScale;
    scale.value = newScale;
  }

  function zoomOut() {
    const oldScale = scale.value;
    const newScale = clampScale(oldScale - ZOOM_FACTOR * oldScale);
    const cx = svgWidth.value / 2;
    const cy = svgHeight.value / 2;
    const worldX = panX.value + cx / oldScale;
    const worldY = panY.value + cy / oldScale;
    panX.value = worldX - cx / newScale;
    panY.value = worldY - cy / newScale;
    scale.value = newScale;
  }

  function resetView() {
    panX.value = 0;
    panY.value = 0;
    scale.value = 1;
  }

  function updateSize(width: number, height: number) {
    svgWidth.value = width;
    svgHeight.value = height;
  }

  return {
    panX,
    panY,
    scale,
    isPanning,
    viewBox,
    svgWidth,
    svgHeight,
    toWorldCoords,
    handleWheel,
    startPan,
    onPan,
    endPan,
    onKeyDown,
    onKeyUp,
    isSpaceDown,
    zoomIn,
    zoomOut,
    resetView,
    updateSize,
  };
}
