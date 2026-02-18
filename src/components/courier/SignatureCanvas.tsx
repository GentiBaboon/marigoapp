'use client';
import React, {
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Button } from '@/components/ui/button';

const SignatureCanvas = forwardRef((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.lineCap = 'round';
    context.strokeStyle = 'black';
    context.lineWidth = 3;

    const startDrawing = (event: MouseEvent | TouchEvent) => {
      isDrawing.current = true;
      const { offsetX, offsetY } = getCoords(event);
      context.beginPath();
      context.moveTo(offsetX, offsetY);
    };

    const draw = (event: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) return;
      const { offsetX, offsetY } = getCoords(event);
      context.lineTo(offsetX, offsetY);
      context.stroke();
    };

    const stopDrawing = () => {
      isDrawing.current = false;
      context.closePath();
    };

    const getCoords = (event: MouseEvent | TouchEvent) => {
      if (event instanceof MouseEvent) {
        return { offsetX: event.offsetX, offsetY: event.offsetY };
      }
      if (event.touches[0] && canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
          offsetX: event.touches[0].clientX - rect.left,
          offsetY: event.touches[0].clientY - rect.top,
        };
      }
      return { offsetX: 0, offsetY: 0 };
    };

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const toDataURL = () => {
    const canvas = canvasRef.current;
    return canvas ? canvas.toDataURL('image/png') : '';
  };

  useImperativeHandle(ref, () => ({
    toDataURL,
    clear: clearCanvas,
  }));

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={200}
        className="border border-input rounded-md w-full"
      />
      <Button type="button" variant="outline" onClick={clearCanvas}>
        Clear Signature
      </Button>
    </div>
  );
});

SignatureCanvas.displayName = 'SignatureCanvas';

export { SignatureCanvas };
