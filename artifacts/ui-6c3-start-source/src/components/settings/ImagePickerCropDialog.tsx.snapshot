import { useEffect, useRef, useState } from 'react';

const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EDITOR_WIDTH = 320;
const EDITOR_HEIGHT = 300;
const OUTPUT_WIDTH = 512;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
export const INITIAL_IMAGE_CROP_ZOOM = 2;

export function isSupportedAppearanceImage(file: File): boolean {
  return ACCEPTED_IMAGE_TYPES.has(file.type);
}

interface ImagePickerCropDialogProps {
  open: boolean;
  aspectRatio: number;
  title: string;
  previewGuide?: 'main-view-felt';
  preserveAlpha?: boolean;
  onConfirm: (blob: Blob) => void | Promise<void>;
  onClose: () => void;
}

type Offset = Readonly<{ x: number; y: number }>;

export function getImageCropFrame(aspectRatio: number, width: number, height: number) {
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const maxWidth = width - 24;
  const maxHeight = height - 24;
  const cropWidth = Math.min(maxWidth, maxHeight * safeAspect);
  const cropHeight = cropWidth / safeAspect;
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}

function drawImageInFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  frame: ReturnType<typeof getImageCropFrame>,
  zoom: number,
  offset: Offset,
  offsetScale = 1,
) {
  const cover = Math.max(frame.width / image.naturalWidth, frame.height / image.naturalHeight) * zoom;
  const width = image.naturalWidth * cover;
  const height = image.naturalHeight * cover;
  const x = frame.x + (frame.width - width) / 2 + offset.x * offsetScale;
  const y = frame.y + (frame.height - height) / 2 + offset.y * offsetScale;
  context.drawImage(image, x, y, width, height);
}

function drawEditor(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
  aspectRatio: number,
  zoom: number,
  offset: Offset,
  previewGuide?: ImagePickerCropDialogProps['previewGuide'],
) {
  canvas.width = EDITOR_WIDTH;
  canvas.height = EDITOR_HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) return;
  const frame = getImageCropFrame(aspectRatio, EDITOR_WIDTH, EDITOR_HEIGHT);
  context.fillStyle = 'rgba(7, 18, 14, 0.82)';
  context.fillRect(0, 0, EDITOR_WIDTH, EDITOR_HEIGHT);
  context.save();
  context.beginPath();
  context.rect(frame.x, frame.y, frame.width, frame.height);
  context.clip();
  context.fillStyle = '#e9eee9';
  context.fillRect(frame.x, frame.y, frame.width, frame.height);
  drawImageInFrame(context, image, frame, zoom, offset);
  context.restore();
  context.strokeStyle = 'rgba(255, 246, 220, 0.94)';
  context.lineWidth = 2;
  context.strokeRect(frame.x, frame.y, frame.width, frame.height);
  if (previewGuide === 'main-view-felt') {
    // A guide only: source pixels remain a rectangular texture and the camera
    // performs the real perspective projection once in WebGL.
    const topInset = frame.width * 0.16;
    context.save();
    context.setLineDash([6, 4]);
    context.strokeStyle = 'rgba(255, 224, 133, 0.95)';
    context.beginPath();
    context.moveTo(frame.x + topInset, frame.y + frame.height * 0.06);
    context.lineTo(frame.x + frame.width - topInset, frame.y + frame.height * 0.06);
    context.lineTo(frame.x + frame.width * 0.96, frame.y + frame.height * 0.94);
    context.lineTo(frame.x + frame.width * 0.04, frame.y + frame.height * 0.94);
    context.closePath();
    context.stroke();
    context.restore();
  }
}

export function drawOutput(image: HTMLImageElement, canvas: HTMLCanvasElement, aspectRatio: number, zoom: number, offset: Offset, preserveAlpha = false) {
  const safeAspect = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 1;
  const height = Math.max(1, Math.round(OUTPUT_WIDTH / safeAspect));
  canvas.width = OUTPUT_WIDTH;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return;
  const editorFrame = getImageCropFrame(safeAspect, EDITOR_WIDTH, EDITOR_HEIGHT);
  const outputFrame = { x: 0, y: 0, width: OUTPUT_WIDTH, height };
  if (!preserveAlpha) {
    context.fillStyle = '#e9eee9';
    context.fillRect(0, 0, OUTPUT_WIDTH, height);
  }
  drawImageInFrame(context, image, outputFrame, zoom, offset, OUTPUT_WIDTH / editorFrame.width);
}

/** Shared local image picker/cropper. Other appearance consumers can reuse it later. */
export function ImagePickerCropDialog({ open, aspectRatio, title, previewGuide, preserveAlpha = false, onConfirm, onClose }: ImagePickerCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [imageRevision, setImageRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(INITIAL_IMAGE_CROP_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => () => {
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
  }, []);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!image || !canvas) return;
    drawEditor(image, canvas, aspectRatio, zoom, offset, previewGuide);
  }, [aspectRatio, imageRevision, offset, previewGuide, zoom]);

  if (!open) return null;

  const loadFile = (file: File | undefined) => {
    if (!file) return;
    if (!isSupportedAppearanceImage(file)) {
      setError('仅支持 PNG、JPEG 或 WebP 图片。');
      return;
    }
    if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    const source = URL.createObjectURL(file);
    sourceUrlRef.current = source;
    const image = new Image();
    image.onload = () => {
      imageRef.current = image;
      setZoom(INITIAL_IMAGE_CROP_ZOOM);
      setOffset({ x: 0, y: 0 });
      setError(null);
      setImageRevision((value) => value + 1);
    };
    image.onerror = () => setError('图片无法解码，请选择其他文件。');
    image.src = source;
  };

  const finish = async () => {
    const image = imageRef.current;
    if (!image) {
      setError('请先选择图片。');
      return;
    }
    const canvas = document.createElement('canvas');
    drawOutput(image, canvas, aspectRatio, zoom, offset, preserveAlpha);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) {
      setError('无法生成裁切后的图片。');
      return;
    }
    setSaving(true);
    try {
      await onConfirm(blob);
      onClose();
    } catch {
      setError('保存图片失败，请重试。');
    } finally {
      setSaving(false);
    }
  };

  const startDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setOffset({ x: drag.offsetX + event.clientX - drag.x, y: drag.offsetY + event.clientY - drag.y });
  };

  return (
    <div className="result-backdrop" role="presentation">
      <section className="result-dialog image-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="image-picker-dialog-title">
        <header className="result-header"><div><h2 id="image-picker-dialog-title">{title}</h2><p>{previewGuide === 'main-view-felt' ? '拖动和缩放图片；虚线梯形仅提示主视角桌面可见区域。' : '请选择图片后拖动和缩放，裁切框以目标资源比例显示。'}</p></div></header>
        <div className="image-picker-dialog__body">
          <label className="settings-field">
            <span>本地图片</span>
            <input aria-label="选择本地图片" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => loadFile(event.target.files?.[0])} />
          </label>
          <canvas
            ref={canvasRef}
            className="image-crop-preview"
            width={EDITOR_WIDTH}
            height={EDITOR_HEIGHT}
            aria-label="图片裁切预览"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
          />
          <label className="settings-field image-picker-dialog__zoom">
            <span>缩放</span>
            <input aria-label="裁切缩放" type="range" min={MIN_ZOOM} max={MAX_ZOOM} step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} disabled={!imageRef.current} />
          </label>
          {error ? <p className="image-picker-dialog__error" role="alert">{error}</p> : null}
        </div>
        <footer className="result-actions">
          <button type="button" onClick={onClose} disabled={saving}>取消</button>
          <button type="button" onClick={() => void finish()} disabled={saving}>{saving ? '保存中…' : '确认保存'}</button>
        </footer>
      </section>
    </div>
  );
}
