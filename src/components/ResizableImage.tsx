import { Image } from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, mergeAttributes } from '@tiptap/react';
import React, { useState, useRef, useEffect } from 'react';
import { Check, GripVertical } from 'lucide-react';

const ImageNodeView = (props: any) => {
  const { node, updateAttributes, selected } = props;
  const { src, width, height, align, clipTop = 0, clipLeft = 0, clipRight = 0, clipBottom = 0, isCropping = false } = node.attrs;
  const imageRef = useRef<HTMLImageElement>(null);
  const [panning, setPanning] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [startSize, setStartSize] = useState({ width: 0, height: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [activeHandle, setActiveHandle] = useState<string | null>(null);

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing(true);
    setStartSize({
      width: imageRef.current?.parentElement?.clientWidth || 0,
      height: imageRef.current?.parentElement?.clientHeight || 0
    });
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const startCrop = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const startPan = (e: React.MouseEvent) => {
    if (!isCropping) return;
    
    // If not selected, let the event pass through so the editor can select it
    if (!selected) return;

    e.preventDefault();
    e.stopPropagation();
    setPanning(true);
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const clipRefs = useRef({ top: clipTop, left: clipLeft, right: clipRight, bottom: clipBottom });
  useEffect(() => {
    clipRefs.current = { top: clipTop, left: clipLeft, right: clipRight, bottom: clipBottom };
  }, [clipTop, clipLeft, clipRight, clipBottom]);

  useEffect(() => {
    if (!resizing && !activeHandle && !panning) return;

    const onMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;

      if (resizing) {
        // Calculate the maximum allowed width based on the editor's current width
        const parentWidth = imageRef.current?.closest('.ProseMirror')?.clientWidth || 800;
        const newWidth = Math.min(parentWidth, Math.max(50, startSize.width + dx));
        updateAttributes({ width: newWidth, height: 'auto' });
      } else if (panning) {
        const imgWidth = imageRef.current?.clientWidth || 1;
        const imgHeight = imageRef.current?.clientHeight || 1;
        
        const moveX = (dx / imgWidth) * 100;
        const moveY = (dy / imgHeight) * 100;
        
        const { top, left, right, bottom } = clipRefs.current;
        const windowSize = left + right;
        const windowSizeY = top + bottom;
        
        let newLeft = left - moveX;
        let newRight = right + moveX;
        let newTop = top - moveY;
        let newBottom = bottom + moveY;

        // Clamp to prevent "zooming" at edges by keeping window size constant
        if (newLeft < 0) { newLeft = 0; newRight = windowSize; }
        if (newRight < 0) { newRight = 0; newLeft = windowSize; }
        if (newTop < 0) { newTop = 0; newBottom = windowSizeY; }
        if (newBottom < 0) { newBottom = 0; newTop = windowSizeY; }
        
        updateAttributes({
          clipLeft: newLeft,
          clipRight: newRight,
          clipTop: newTop,
          clipBottom: newBottom,
        });
        
        setStartPos({ x: e.clientX, y: e.clientY });
      } else if (activeHandle) {
        const imgWidth = imageRef.current?.clientWidth || 1;
        const imgHeight = imageRef.current?.clientHeight || 1;
        const { top, left, right, bottom } = clipRefs.current;

        const update = (h: string, dX: number, dY: number) => {
          if (h.includes('left')) {
            const delta = (dX / imgWidth) * 100;
            const newLeft = Math.max(0, left + delta);
            updateAttributes({ clipLeft: newLeft, width: (width || imgWidth) - dX });
            clipRefs.current.left = newLeft;
          }
          if (h.includes('right')) {
            const delta = (dX / imgWidth) * 100;
            const newRight = Math.max(0, right - delta);
            updateAttributes({ clipRight: newRight, width: (width || imgWidth) + dX });
            clipRefs.current.right = newRight;
          }
          if (h.includes('top')) {
            const delta = (dY / imgHeight) * 100;
            const newTop = Math.max(0, top + delta);
            updateAttributes({ clipTop: newTop });
            clipRefs.current.top = newTop;
          }
          if (h.includes('bottom')) {
            const delta = (dY / imgHeight) * 100;
            const newBottom = Math.max(0, bottom - delta);
            updateAttributes({ clipBottom: newBottom });
            clipRefs.current.bottom = newBottom;
          }
        };

        update(activeHandle, dx, dy);
        setStartPos({ x: e.clientX, y: e.clientY });
      }
    };

    const onMouseUp = () => {
      setResizing(false);
      setActiveHandle(null);
      setPanning(false);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizing, activeHandle, panning, startPos.x, startPos.y, startSize.width, startSize.height, updateAttributes, width]);

  // Calculations for masking crop that doesn't stretch
  const visibleWidthRatio = 1 - (clipLeft + clipRight) / 100;
  const visibleHeightRatio = 1 - (clipTop + clipBottom) / 100;

  return (
    <NodeViewWrapper
      contentEditable={false}
      className={`resizable-image-container flex flex-col my-4 transition-all ${
        align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center'
      }`}
    >
      <div 
        className={`relative group inline-block resizable-image-wrapper transition-shadow ${selected ? 'selected ring-2 ring-accent ring-offset-2 ring-offset-[var(--bg-app)]' : ''}`}
        style={{ maxWidth: '100%' }}
        data-drag-handle={!isCropping ? "" : undefined}
        onMouseDown={() => {
          // If not selected, force selection
          if (!selected && props.editor) {
            props.editor.commands.setNodeSelection(props.getPos());
          }
        }}
      >
        <div 
          className="relative overflow-hidden rounded-lg pointer-events-auto"
          style={{
            width: width || 'auto',
            maxWidth: '100%',
            height: height || 'auto',
            cursor: isCropping ? 'grab' : (selected ? 'default' : 'pointer')
          }}
          onMouseDown={startPan}
        >
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            // If height is auto, we need to maintain aspect ratio
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img
              ref={imageRef}
              src={src}
              alt=""
              draggable={false}
              style={{
                width: `${100 / visibleWidthRatio}%`,
                height: 'auto',
                position: 'absolute',
                left: `${-clipLeft / visibleWidthRatio}%`,
                top: `${-clipTop / visibleHeightRatio}%`, // THIS IS STILL RISKY with height:auto
                display: 'block',
                maxWidth: 'none',
              }}
              className={`block transition-shadow ${
                selected ? 'shadow-xl' : 'ring-1 ring-[var(--border-glass)]'
              }`}
            />
            {/* Transparent placeholder to maintain height if height is auto */}
            <img src={src} draggable={false} style={{ width: '100%', height: 'auto', visibility: 'hidden' }} />
          </div>
        </div>

        {/* Resize Handle */}
        {selected && !isCropping && (
          <div
            className="absolute bottom-[-1px] right-[-1px] w-4 h-4 bg-accent rounded-sm cursor-nwse-resize z-10 shadow-lg border border-[var(--border-glass)] hover:scale-125 transition-transform"
            onMouseDown={(e) => startResize(e)}
          />
        )}

        {/* Move Handle Overlay */}
        {selected && !isCropping && (
          <div 
            className="absolute top-2 left-2 p-1 bg-accent text-white rounded shadow-xl cursor-grab active:cursor-grabbing z-50 hover:scale-110 transition-transform flex items-center justify-center"
            data-drag-handle
          >
            <GripVertical size={12} strokeWidth={3} />
          </div>
        )}

        {/* Professional Crop Handles (Bars) */}
        {selected && isCropping && (
          <>
            {/* Edge Bars */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-2 crop-handle-bar cursor-ns-resize rounded-b-sm" onMouseDown={(e) => startCrop(e, 'top')} />
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-2 crop-handle-bar cursor-ns-resize rounded-t-sm" onMouseDown={(e) => startCrop(e, 'bottom')} />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-12 w-2 crop-handle-bar cursor-ew-resize rounded-r-sm" onMouseDown={(e) => startCrop(e, 'left')} />
            <div className="absolute right-0 top-1/2 -translate-y-1/2 h-12 w-2 crop-handle-bar cursor-ew-resize rounded-l-sm" onMouseDown={(e) => startCrop(e, 'right')} />
            
            {/* Corner Markers (L-shapes) */}
            <div className="absolute top-0 left-0 w-5 h-5 border-t-[3px] border-l-[3px] border-[var(--text-main)] z-40 cursor-nw-resize" onMouseDown={(e) => startCrop(e, 'top-left')} />
            <div className="absolute top-0 right-0 w-5 h-5 border-t-[3px] border-r-[3px] border-[var(--text-main)] z-40 cursor-ne-resize" onMouseDown={(e) => startCrop(e, 'top-right')} />
            <div className="absolute bottom-0 left-0 w-5 h-5 border-b-[3px] border-l-[3px] border-[var(--text-main)] z-40 cursor-sw-resize" onMouseDown={(e) => startCrop(e, 'bottom-left')} />
            <div className="absolute bottom-0 right-0 w-5 h-5 border-b-[3px] border-r-[3px] border-[var(--text-main)] z-40 cursor-se-resize" onMouseDown={(e) => startCrop(e, 'bottom-right')} />

            {/* Done Button Overlay */}
            <div className="absolute top-[-40px] left-1/2 -translate-x-1/2 z-50">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  updateAttributes({ isCropping: false });
                }}
                className="bg-accent text-white px-3 py-1.5 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform active:scale-95 font-medium text-[11px] whitespace-nowrap"
              >
                <Check size={14} strokeWidth={3} />
                Done Cropping
              </button>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
};

export const ResizableImage = Image.extend({
  name: 'resizableImage',
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { 
        default: null,
        renderHTML: attributes => ({ width: attributes.width }),
        parseHTML: element => element.getAttribute('width'),
      },
      height: { 
        default: null,
        renderHTML: attributes => ({ height: attributes.height }),
        parseHTML: element => element.getAttribute('height'),
      },
      align: { 
        default: 'center',
        renderHTML: attributes => ({ 'data-align': attributes.align }),
        parseHTML: element => element.getAttribute('data-align'),
      },
      clipTop: { 
        default: 0,
        renderHTML: attributes => ({ 'data-clip-top': attributes.clipTop }),
        parseHTML: element => element.getAttribute('data-clip-top'),
      },
      clipLeft: { 
        default: 0,
        renderHTML: attributes => ({ 'data-clip-left': attributes.clipLeft }),
        parseHTML: element => element.getAttribute('data-clip-left'),
      },
      clipRight: { 
        default: 0,
        renderHTML: attributes => ({ 'data-clip-right': attributes.clipRight }),
        parseHTML: element => element.getAttribute('data-clip-right'),
      },
      clipBottom: { 
        default: 0,
        renderHTML: attributes => ({ 'data-clip-bottom': attributes.clipBottom }),
        parseHTML: element => element.getAttribute('data-clip-bottom'),
      },
      isCropping: { 
        default: false,
        renderHTML: attributes => ({ 'data-is-cropping': attributes.isCropping }),
        parseHTML: element => element.getAttribute('data-is-cropping') === 'true',
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },
  inline: false,
  group: 'block',
  draggable: true,
  selectable: true,
  atom: true,
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
