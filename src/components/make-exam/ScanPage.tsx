import { useState, useRef, DragEvent, ChangeEvent, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { Upload, X, FileText, Sparkles, Image as ImageIcon, Camera, RefreshCw } from 'lucide-react';
import { useUserProfile } from '../../lib/UserContext';
import { fontSize } from '../../lib/utils';

import * as pdfjsLib from 'pdfjs-dist';

export interface ScannedFile {
  id: string;
  file: File;
  name: string;
  type: string;
  previewUrl?: string;
  pagesCount: number;
  subjectId?: string;
  subjectName?: string;
}

interface CropQueueItem {
  id: string;
  file: File;
  name: string;
  type: string;
  previewUrl: string;
}

interface ScanPageProps {
  onFilesChange: (files: ScannedFile[]) => void;
  maxPages?: number;
  selectedSubjects: { id: string; name: string }[];
}

export default function ScanPage({ onFilesChange, maxPages, selectedSubjects }: ScanPageProps) {
  const { userProfile } = useUserProfile();
  const [files, setFiles] = useState<ScannedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isPdfProcessing, setIsPdfProcessing] = useState(false);


  const [cropQueue, setCropQueue] = useState<CropQueueItem[]>([]);
  const [cropIndex, setCropIndex] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgDimensions, setImgDimensions] = useState({ baseW: 0, baseH: 0, origW: 0, origH: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropImgRef = useRef<HTMLImageElement>(null);


  useEffect(() => {
    onFilesChange(files);
  }, [files]);


  const getScanLimit = () => {
    if (maxPages) return maxPages;
    const premiumType = userProfile?.PremiumType || '';
    if (premiumType.toLowerCase().includes('peak')) return 25;
    if (premiumType.toLowerCase().includes('rise')) return 20;
    if (premiumType.toLowerCase().includes('lite')) return 15;
    return 10;
  };

  const scanLimit = getScanLimit();
  const totalPages = files.reduce((sum, f) => sum + f.pagesCount, 0);

  const getPdfPageCount = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          const typedarray = new Uint8Array(reader.result as ArrayBuffer);
          const loadingTask = pdfjsLib.getDocument({
            data: typedarray,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            wasmUrl: '/pdfjs/wasm/'
          });
          const pdfDoc = await loadingTask.promise;
          resolve(pdfDoc.numPages);
        } catch (e) {
          console.error('Error parsing PDF page count via pdfjs:', e);
          resolve(1);
        }
      };
      reader.onerror = () => resolve(1);
      reader.readAsArrayBuffer(file);
    });
  };

  const processPdfToPages = async (file: File): Promise<ScannedFile[]> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          const typedarray = new Uint8Array(reader.result as ArrayBuffer);
          const loadingTask = pdfjsLib.getDocument({
            data: typedarray,
            standardFontDataUrl: '/pdfjs/standard_fonts/',
            wasmUrl: '/pdfjs/wasm/'
          });
          const pdfDoc = await loadingTask.promise;
          const pages: ScannedFile[] = [];

          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
              await page.render({ canvasContext: ctx, viewport, canvas }).promise;

              await new Promise<void>((resBlob) => {
                canvas.toBlob((blob) => {
                  if (blob) {
                    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                    const pageFile = new File([blob], `${nameWithoutExt}_page_${i}.jpg`, { type: 'image/jpeg' });
                    pages.push({
                      id: Math.random().toString(36).substr(2, 9),
                      file: pageFile,
                      name: pageFile.name,
                      type: 'image/jpeg',
                      previewUrl: URL.createObjectURL(pageFile),
                      pagesCount: 1,
                    });
                  }
                  resBlob();
                }, 'image/jpeg', 0.80);
              });
            }
          }
          resolve(pages);
        } catch (e) {
          console.error('Error parsing PDF to pages:', e);
          resolve([]);
        }
      };
      reader.onerror = () => resolve([]);
      reader.readAsArrayBuffer(file);
    });
  };


  const handleFiles = async (fileList: FileList) => {
    const imagesToCrop: CropQueueItem[] = [];
    const directFiles: ScannedFile[] = [];
    let currentTotalPages = totalPages;
    let limitExceededMsg = null;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isImage = file.type.startsWith('image/') && file.type !== 'image/gif';
      const isPdf = file.type === 'application/pdf';

      if (!isImage && !isPdf) continue;


      if (isPdf && file.size > 10 * 1024 * 1024) {
        limitExceededMsg = `PDF "${file.name}" exceeds the 10MB limit.`;
        continue;
      }
      if (isImage && file.size > 5 * 1024 * 1024) {
        limitExceededMsg = `Image "${file.name}" exceeds the 5MB limit.`;
        continue;
      }

      if (isImage) {

        if (currentTotalPages + 1 > scanLimit) {
          limitExceededMsg = `Page limit of ${scanLimit} reached. Cannot add "${file.name}".`;
          break;
        }
        imagesToCrop.push({
          id: Math.random().toString(36).substr(2, 9),
          file,
          name: file.name,
          type: file.type,
          previewUrl: URL.createObjectURL(file),
        });
        currentTotalPages += 1;
      } else {
        setIsPdfProcessing(true);
        const estimatedPages = await getPdfPageCount(file);
        if (currentTotalPages + estimatedPages > scanLimit) {
          limitExceededMsg = `Page limit of ${scanLimit} reached. Cannot add "${file.name}" (${estimatedPages} pages).`;
          setIsPdfProcessing(false);
          break;
        }
        const pdfPages = await processPdfToPages(file);
        directFiles.push(...pdfPages);
        currentTotalPages += pdfPages.length;
        setIsPdfProcessing(false);
      }
    }

    if (limitExceededMsg) {
      setValidationError(limitExceededMsg);
      setTimeout(() => setValidationError(null), 5000);
    }

    if (directFiles.length > 0) {
      setFiles(prev => [...prev, ...directFiles]);
    }

    if (imagesToCrop.length > 0) {
      setCropQueue(prev => [...prev, ...imagesToCrop]);
      setCropIndex(0);
      setZoom(1);
    }
  };


  const onCropImageLoad = () => {
    if (cropImgRef.current) {
      const img = cropImgRef.current;
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      let baseW = 0;
      let baseH = 0;


      if (w > h) {
        baseH = 256;
        baseW = 256 * (w / h);
      } else {
        baseW = 256;
        baseH = 256 * (h / w);
      }

      setImgDimensions({ baseW, baseH, origW: w, origH: h });
      setOffset({
        x: (256 - baseW) / 2,
        y: (256 - baseH) / 2
      });
      setZoom(1);
    }
  };

  const constrainOffset = (x: number, y: number, currentZoom: number) => {
    const scaledW = imgDimensions.baseW * currentZoom;
    const scaledH = imgDimensions.baseH * currentZoom;

    const minX = 256 - scaledW;
    const maxX = 0;
    const minY = 256 - scaledH;
    const maxY = 0;

    return {
      x: Math.min(maxX, Math.max(minX, x)),
      y: Math.min(maxY, Math.max(minY, y))
    };
  };


  const handleDragStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const rawX = clientX - dragStart.x;
    const rawY = clientY - dragStart.y;
    setOffset(constrainOffset(rawX, rawY, zoom));
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };


  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom);

    setOffset(prev => constrainOffset(prev.x, prev.y, newZoom));
  };


  const cropImage = () => {
    const currentItem = cropQueue[cropIndex];
    if (currentItem && cropImgRef.current && canvasRef.current) {
      const img = cropImgRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        canvas.width = 512;
        canvas.height = 512;

        const scaledW = imgDimensions.baseW * zoom;
        const scaleFactor = imgDimensions.origW / scaledW;

        const srcX = -offset.x * scaleFactor;
        const srcY = -offset.y * scaleFactor;
        const srcSize = 256 * scaleFactor;

        ctx.drawImage(
          img,
          srcX, srcY, srcSize, srcSize,
          0, 0, 512, 512
        );

        canvas.toBlob((blob) => {
          if (blob) {
            const croppedFile = new File([blob], currentItem.name, { type: 'image/jpeg' });
            const scannedFile: ScannedFile = {
              id: currentItem.id,
              file: croppedFile,
              name: currentItem.name,
              type: 'image/jpeg',
              previewUrl: URL.createObjectURL(croppedFile),
              pagesCount: 1,
            };

            setFiles(prev => [...prev, scannedFile]);
          }
        }, 'image/jpeg', 0.95);
      }
    }


    URL.revokeObjectURL(currentItem.previewUrl);

    if (cropIndex + 1 < cropQueue.length) {
      setCropIndex(cropIndex + 1);
    } else {

      setCropQueue([]);
      setCropIndex(0);
    }
  };

  const cancelCrop = () => {

    cropQueue.forEach(item => URL.revokeObjectURL(item.previewUrl));
    setCropQueue([]);
    setCropIndex(0);
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode, width: { ideal: 1024 }, height: { ideal: 1024 } },
        audio: false
      });

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Error starting webcam:', err);
      setCameraError('Unable to access camera. Please drop files instead.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (cameraActive) {
      startCamera();
    }
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        const size = Math.min(video.videoWidth, video.videoHeight);
        canvas.width = 512;
        canvas.height = 512;

        const startX = (video.videoWidth - size) / 2;
        const startY = (video.videoHeight - size) / 2;

        context.drawImage(video, startX, startY, size, size, 0, 0, 512, 512);

        canvas.toBlob((blob) => {
          if (blob) {
            const timestamp = new Date().getTime();
            const file = new File([blob], `scan_capture_${timestamp}.jpg`, { type: 'image/jpeg' });

            if (totalPages + 1 <= scanLimit) {
              const scannedFile: ScannedFile = {
                id: Math.random().toString(36).substr(2, 9),
                file,
                name: file.name,
                type: file.type,
                previewUrl: URL.createObjectURL(file),
                pagesCount: 1,
              };
              setFiles(prev => [...prev, scannedFile]);
            } else {
              setValidationError(`Page limit of ${scanLimit} reached. Cannot capture photo.`);
              setTimeout(() => setValidationError(null), 5000);
            }
          }
        }, 'image/jpeg', 0.95);
      }
    }
    stopCamera();
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    const fileToRemove = files.find(f => f.id === id);
    if (fileToRemove?.previewUrl) {
      URL.revokeObjectURL(fileToRemove.previewUrl);
    }
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const updatePages = (id: string, count: number) => {
    const fileToUpdate = files.find(f => f.id === id);
    if (!fileToUpdate) return;

    const pageDifference = count - fileToUpdate.pagesCount;
    if (totalPages + pageDifference > scanLimit) {
      return;
    }

    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, pagesCount: Math.max(1, count) } : f
    ));
  };

  const updateFileSubject = (id: string, subjectId: string, subjectName: string) => {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, subjectId, subjectName } : f
    ));
  };

  const applySubjectToAll = (subjectId: string, subjectName: string) => {
    setFiles(prev => prev.map(f => ({ ...f, subjectId, subjectName })));
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const extraCreditsCost = Math.ceil(totalPages / 2);
  const useOwnKey = localStorage.getItem('use_own_key') === 'true';
  const currentCropItem = cropQueue[cropIndex];

  return (
    <div className="bg-white/40 dark:bg-gray-900/40 border border-black/15 dark:border-white/20 p-5 space-y-4 transition-all">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-zinc-900 dark:text-white text-base">Upload the study material</h4>
        <span className="text-zinc-450 dark:text-gray-500 font-medium text-xs">
          {totalPages}/{scanLimit} pages
        </span>
      </div>
      {validationError && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="font-medium text-xs">{validationError}</span>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {currentCropItem && (
        <div className="relative border border-black/15 dark:border-white/20 rounded-2xl bg-zinc-950 flex flex-col items-center p-4 gap-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-white font-semibold text-xs">
              crop
            </p>
            <button type="button" onClick={cancelCrop} className="text-zinc-400 hover:text-white transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            className="relative w-full max-w-[256px] aspect-square rounded-xl overflow-hidden bg-black border border-zinc-800 cursor-move select-none"
            onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
            onMouseMove={(e) => handleDragMove(e.clientX, e.clientY)}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientX, e.touches[0].clientY)}
            onTouchEnd={handleDragEnd}
          >
            <img
              ref={cropImgRef}
              src={currentCropItem.previewUrl}
              alt="Cropper target"
              onLoad={onCropImageLoad}
              style={{
                position: 'absolute',
                left: `${offset.x}px`,
                top: `${offset.y}px`,
                width: `${imgDimensions.baseW * zoom}px`,
                height: `${imgDimensions.baseH * zoom}px`,
                maxWidth: 'none',
                maxHeight: 'none',
                pointerEvents: 'none',
                userSelect: 'none'
              }}
            />
            <div className="absolute inset-0 border-2 border-dashed border-blue-500/50 rounded-xl pointer-events-none flex items-center justify-center" />
          </div>

          <div className="w-full max-w-[256px] space-y-1">
            <div className="flex justify-between text-zinc-400" style={{ fontSize: '0.65rem' }}>
              <span>Scale zoom:</span>
              <span className="text-blue-500 font-bold">{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="w-full accent-blue-500 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={cropImage}
            className="px-6 py-2 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl font-semibold transition-all cursor-pointer mx-auto block w-fit text-xs">
            Apply Crop
          </button>
        </div>
      )}
      {!cameraActive && !currentCropItem && (
        <div className="flex flex-col gap-2">
          {isPdfProcessing ? (
            <div className="border-2 border-dashed border-blue-500/40 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 bg-blue-500/5">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-blue-500 text-xs">Processing PDF…</p>
                <p className="text-zinc-400 dark:text-gray-500 mt-1" style={{ fontSize: '0.65rem' }}>Rendering pages, this may take a moment</p>
              </div>
            </div>
          ) : (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${dragActive
                  ? 'border-blue-500 bg-blue-500/5'
                  : 'border-zinc-300 dark:border-gray-800 hover:border-zinc-400 dark:hover:border-gray-700 hover:bg-zinc-50 dark:hover:bg-white/5'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/jpg,application/pdf"
                onChange={handleChange}
                className="hidden"
              />
              <div className="p-3 bg-blue-500/10 rounded-full text-blue-500">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="font-medium text-zinc-700 dark:text-gray-300 text-xs">
                  Drag & drop files here, or <span className="text-blue-500 underline">browse</span>
                </p>
                <p className="text-zinc-400 dark:text-gray-550 mt-1" style={{ fontSize: '0.65rem' }}>
                  Supports PDF documents and Images (JPG, PNG)
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={startCamera}
            disabled={isPdfProcessing}
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-xl font-semibold border border-blue-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs">
            <Camera className="w-4 h-4" />
            Take Photo with Camera
          </button>
        </div>
      )}
      {cameraActive && !currentCropItem && (
        <div className="relative border border-zinc-200 dark:border-gray-800 rounded-2xl bg-black overflow-hidden flex flex-col items-center justify-center p-4 min-h-[340px]">
          <div className="relative w-full max-w-[280px] aspect-square rounded-xl overflow-hidden bg-zinc-950 border border-zinc-800">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 border-2 border-dashed border-blue-500/60 rounded-xl pointer-events-none flex items-center justify-center">
              <div className="text-white/50 text-[10px] font-medium bg-black/50 px-2 py-0.5 rounded backdrop-blur-[2px]">
                512 x 512 Crop Frame
              </div>
            </div>
          </div>


          {cameraError && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 text-center text-red-400 gap-2">
              <X className="w-8 h-8" />
              <p className="font-semibold text-sm">{cameraError}</p>
              <button
                type="button"
                onClick={stopCamera}
                className="mt-2 px-4 py-2 bg-zinc-800 text-white rounded-lg text-xs"
              >
                Close
              </button>
            </div>
          )}

          {!cameraError && (
            <div className="flex items-center justify-between w-full mt-3 px-2 gap-4">
              <button
                type="button"
                onClick={stopCamera}
                className="p-2.5 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                aria-label="Close camera"
              >
                <X className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={capturePhoto}
                className="w-12 h-12 rounded-full border-4 border-white bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg active:scale-95 transition-all cursor-pointer"
                aria-label="Capture photo"
              />

              <button
                type="button"
                onClick={toggleFacingMode}
                className="p-2 hover:bg-white/10 text-white rounded-xl transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
      {files.length > 0 && !currentCropItem && (
        <div className="space-y-3">
          <div className="grid gap-2 max-h-48 overflow-y-auto pr-1 animate-fadeIn">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between gap-3 bg-zinc-50 dark:bg-gray-950/40 border border-zinc-200 dark:border-gray-800 rounded-xl p-2.5 transition-all"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {file.previewUrl ? (
                    <img
                      src={file.previewUrl}
                      alt="preview"
                      className="w-10 h-10 rounded-lg object-cover border border-zinc-200 dark:border-gray-800 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 bg-red-500/10 text-red-500 rounded-lg flex items-center justify-center border border-red-500/20 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-zinc-700 dark:text-gray-300 font-medium truncate text-xs">
                      {file.name}
                    </p>
                    <p className="text-zinc-400 dark:text-gray-550 shrink-0" style={{ fontSize: '0.65rem' }}>
                      {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>

                <select
                  value={file.subjectId || ''}
                  onChange={(e) => {
                    const subId = e.target.value;
                    const subName = selectedSubjects.find(s => s.id === subId)?.name || '';
                    updateFileSubject(file.id, subId, subName);
                  }}
                  className="bg-zinc-100 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-lg px-2 py-1 text-zinc-700 dark:text-gray-300 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 shrink-0"
                  style={{ maxWidth: '120px' }}
                >
                  <option value="">Select Subject...</option>
                  {selectedSubjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>

                {file.type === 'application/pdf' && (
                  <div className="flex items-center gap-1.5 bg-zinc-200/50 dark:bg-gray-900/60 rounded-lg px-2 py-1 shrink-0">
                    <span className="text-zinc-500 dark:text-gray-400 font-medium" style={{ fontSize: '0.65rem' }}>Pages:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={file.pagesCount}
                      onChange={(e) => updatePages(file.id, parseInt(e.target.value) || 1)}
                      className="w-8 bg-transparent text-center font-semibold text-blue-500 focus:outline-none text-xs" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="p-1 hover:bg-zinc-200 dark:hover:bg-gray-800 rounded-lg text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 transition-all shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {selectedSubjects.length > 0 && files.length > 1 && (
            <div className="flex items-center justify-between gap-3 p-3 bg-violet-500/5 dark:bg-violet-500/10 border border-violet-500/10 dark:border-violet-500/20 rounded-xl">
              <span className="text-zinc-600 dark:text-gray-300 font-medium" style={{ fontSize: '0.75rem' }}>
                Set subject for all pages together:
              </span>
              <select
                onChange={(e) => {
                  const subId = e.target.value;
                  if (!subId) return;
                  const subName = selectedSubjects.find(s => s.id === subId)?.name || '';
                  applySubjectToAll(subId, subName);
                  e.target.value = '';
                }}
                className="bg-zinc-100 dark:bg-gray-900 border border-zinc-200 dark:border-gray-800 rounded-lg px-2 py-1 text-zinc-700 dark:text-gray-300 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                style={{ maxWidth: '140px' }}
              >
                <option value="">Select subject...</option>
                {selectedSubjects.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
          )}

          <div
            className="text-center text-zinc-400 dark:text-zinc-500 font-medium py-1 text-xs">
            every 2 pages will increase 1 credit , +{extraCreditsCost} credits will increase {useOwnKey && '(ignore if using own key)'}
          </div>
        </div>
      )}
    </div>
  );
}
