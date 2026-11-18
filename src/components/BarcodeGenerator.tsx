import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'CODE39';
  height?: number;
  width?: number;
  fontSize?: number;
  displayValue?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  format = 'CODE39',
  height = 36,
  width = 1.4,
  fontSize = 11,
  displayValue = true,
  className = '',
  style
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      const normalizedValue =
        format === 'CODE39'
          ? String(value)
              .trim()
              .toUpperCase()
              .replace(/[^0-9A-Z\-\.\ \$\/\+\%]/g, '')
          : String(value);

      if (!normalizedValue) return;

      try {
        JsBarcode(svgRef.current, normalizedValue, {
          format,
          height,
          width,
          fontSize,
          displayValue,
          margin: 0,
          background: 'transparent',
          lineColor: '#000000',
          font: 'monospace'
        });
      } catch (err) {
        console.warn('JsBarcode render error for value:', normalizedValue, err);
      }
    }
  }, [value, format, height, width, fontSize, displayValue]);

  if (!value) return null;

  return (
    <svg
      ref={svgRef}
      className={`max-w-full max-h-full ${className}`}
      style={style}
    />
  );
};
