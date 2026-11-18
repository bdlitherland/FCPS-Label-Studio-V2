import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'CODE39';
  height?: number;
  width?: number;
  maxWidthPx?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  format = 'CODE128',
  height = 36,
  width = 2,
  maxWidthPx,
  fontSize = 11,
  displayValue = true,
  className = '',
  style
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !value) return;

    const cleanValue = String(value).trim();
    if (!cleanValue) return;

    const renderWithWidth = (modWidth: number) => {
      JsBarcode(svg, cleanValue, {
        format,
        height,
        width: modWidth,
        fontSize,
        displayValue,
        marginTop: 2,
        marginBottom: 2,
        marginLeft: 12,
        marginRight: 12,
        background: '#ffffff',
        lineColor: '#000000',
        font: 'monospace'
      });
      return {
        w: parseFloat(svg.getAttribute('width') || '0'),
        h: parseFloat(svg.getAttribute('height') || `${height}`)
      };
    };

    try {
      const startWidth = Math.max(1, Math.round(width));
      let dims = renderWithWidth(startWidth);

      if (maxWidthPx && dims.w > maxWidthPx && startWidth > 1) {
        dims = renderWithWidth(1);
      }

      if (maxWidthPx && dims.w > maxWidthPx) {
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.width = '100%';
        svg.style.height = `${dims.h}px`;
      } else {
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.style.width = `${dims.w}px`;
        svg.style.height = `${dims.h}px`;
      }
    } catch (err) {
      console.warn('JsBarcode render error for value:', cleanValue, err);
    }
  }, [value, format, height, width, maxWidthPx, fontSize, displayValue]);

  if (!value) return null;

  return (
    <svg
      ref={svgRef}
      className={`block bg-white shrink-0 ${className}`}
      style={style}
    />
  );
};
