import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import styles from './DrawingCanvas.module.css';
import {
    drawActionWithSymmetry,
    drawGuides,
    getCanvasPoint,
    applyContextSettings
} from '../../utils/canvasUtils';
import { debounce } from 'lodash';
import { saveAs } from 'file-saver';

const CANVAS_TARGET_SIZE = 600; // Base size defined in CSS variable :root { --canvas-target-size: 600px; }

function DrawingCanvas({
    settings,
    actions,
    historyIndex,
    previewAction,
    onDrawStart,
    onDrawMove,
    onDrawEnd,
    onCanvasReady, // Callback with initial data URL
    onStateUpdate, // Callback with new data URL after action commit
    triggerDownload,
    theme,
    isLoading, // Added isLoading prop
}) {
    const drawingCanvasRef = useRef(null);
    const gridCanvasRef = useRef(null);
    const drawCtxRef = useRef(null);
    const gridCtxRef = useRef(null);
    const isDrawingRef = useRef(false);
    const startPosRef = useRef({ x: 0, y: 0 });
    const currentPosRef = useRef({ x: 0, y: 0 });
    const currentPathRef = useRef([]);
    const centerRef = useRef({ x: 0, y: 0 });
    const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 }); // Start small, will resize
    const [lastCommittedImageData, setLastCommittedImageData] = useState(null); // Store ImageData object


    // --- Clear Canvas --- (Moved up)
    const clearDrawingCanvas = useCallback((isInternal = false) => {
        const ctx = drawCtxRef.current;
        if (!ctx) return;
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
         if (!isInternal) {
            setLastCommittedImageData(ctx.getImageData(0, 0, canvasSize.width, canvasSize.height)); // Cache cleared state
             if (onCanvasReady && drawingCanvasRef.current) {
                 onCanvasReady(drawingCanvasRef.current.toDataURL()); // Notify App for history reset
             }
         }
    }, [canvasSize, onCanvasReady]);


    // --- Canvas Setup & Resize ---
    const setupCanvas = useCallback((forceRedraw = false) => {
        const canvas = drawingCanvasRef.current;
        const grid = gridCanvasRef.current;
        const container = canvas?.parentElement;
        if (!canvas || !grid || !container) return false;

        // Use CSS variable for target size
        const targetSizeStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas-target-size').trim() || '600px';
        const targetSize = parseInt(targetSizeStyle, 10) || 600;

        const containerWidth = container.clientWidth;
        if (containerWidth <= 0) return false; // Wait for layout

        const size = Math.min(containerWidth, targetSize);
        const dpr = window.devicePixelRatio || 1;
        const physicalSize = Math.floor(size * dpr);

        let resized = false;
        if (canvas.width !== physicalSize || canvas.height !== physicalSize) {
            resized = true;
            canvas.width = physicalSize;
            canvas.height = physicalSize;
            canvas.style.width = `${size}px`;
            canvas.style.height = `${size}px`;

            grid.width = physicalSize;
            grid.height = physicalSize;
            grid.style.width = `${size}px`;
            grid.style.height = `${size}px`;
        }

        // Update logical size state and center ref (always update center)
        setCanvasSize({ width: size, height: size });
        centerRef.current = { x: size / 2, y: size / 2 };

        // Get/update contexts if they don't exist or if canvas resized
        if (resized || !drawCtxRef.current || !gridCtxRef.current) {
            drawCtxRef.current = canvas.getContext('2d', { willReadFrequently: true });
            gridCtxRef.current = grid.getContext('2d');
        }

        // Scale contexts (always apply scaling after potential resize)
        drawCtxRef.current.resetTransform();
        gridCtxRef.current.resetTransform();
        drawCtxRef.current.scale(dpr, dpr);
        gridCtxRef.current.scale(dpr, dpr);

        // Apply current drawing settings
        applyContextSettings(drawCtxRef.current, settings);

        console.log("Canvas Setup/Resized:", size, "Resized:", resized);

        // Initial clear and readiness callback only on first setup or forced redraw
        if ((resized || forceRedraw) && !lastCommittedImageData) {
             clearDrawingCanvas(true); // Internal clear
             // Delay ready callback slightly to ensure clear is rendered
             setTimeout(() => {
                 if (onCanvasReady && drawingCanvasRef.current) {
                    const ctx = drawCtxRef.current;
                    if(ctx) {
                        setLastCommittedImageData(ctx.getImageData(0, 0, size, size)); // Store initial empty state
                        onCanvasReady(drawingCanvasRef.current.toDataURL()); // Send dataURL for history
                    }
                 }
             }, 0);
        }

        return resized; // Indicate if resize happened

     }, [settings, onCanvasReady, lastCommittedImageData, clearDrawingCanvas]); // Add clearDrawingCanvas


     // --- Redraw Guides --- (Moved up for dependency order)
     const redrawGuides = useCallback(() => {
          const gridCtx = gridCtxRef.current;
         if (gridCtx && canvasSize.width > 0) {
             drawGuides(gridCtx, settings, centerRef.current, canvasSize);
         }
     }, [settings, canvasSize]); // Include all relevant settings

     // --- Redraw Committed State --- (Moved up for dependency order)
     // Now redraws from `actions` array up to `historyIndex`
     const redrawCommittedState = useCallback(() => {
         const ctx = drawCtxRef.current;
         const canvas = drawingCanvasRef.current;
          if (!ctx || !canvas || isLoading) return; // Don't draw while loading

         // Clear canvas first
         ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

         // Redraw from actions array
          console.log("Redrawing from actions up to index:", historyIndex);
         const actionsToDraw = actions.slice(0, historyIndex + 1);
         actionsToDraw.forEach(action => {
             if (action) {
                 applyContextSettings(ctx, settings, action); // Use action's specific settings
                 drawActionWithSymmetry(ctx, action, settings, centerRef.current);
             }
         });

         applyContextSettings(ctx, settings); // Restore live settings

          // Update the ImageData cache after redrawing
         if (canvasSize.width > 0 && canvasSize.height > 0) {
              try {
                 setLastCommittedImageData(ctx.getImageData(0, 0, canvasSize.width, canvasSize.height));
              } catch (e) {
                   console.error("Error getting ImageData after redraw:", e);
                   setLastCommittedImageData(null); // Invalidate cache on error
              }
          } else {
              setLastCommittedImageData(null); // Invalidate if size is zero
          }

     }, [actions, historyIndex, canvasSize, settings, isLoading]); // Add isLoading


     // Debounced resize handler using useMemo
     const debouncedResize = useMemo(() => debounce(() => {
        console.log("Window Resizing...");
        if (setupCanvas(false)) { // Pass false: don't force redraw unless needed
            // Redraw guides and committed state *only if resize actually happened*
            console.log("Redrawing after resize...");
            redrawGuides();
            redrawCommittedState(); // Redraw from actions after resize
        } else {
             // Even if canvas size didn't change, container might have, redraw guides
            redrawGuides();
        }
     }, 150), [setupCanvas, redrawGuides, redrawCommittedState]); // Dependencies of the inner function

    // Initial setup and resize listener
    useEffect(() => {
        // Initial setup might need a slight delay for layout
        const timer = setTimeout(() => setupCanvas(true), 50); // Force setup on mount
        window.addEventListener('resize', debouncedResize);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', debouncedResize);
            debouncedResize.cancel();
        };
    }, [setupCanvas, debouncedResize]); // Only run on mount/unmount

    // --- Drawing Event Handlers ---

    // Memoize createActionObject
    const createActionObject = useCallback(() => ({
        tool: settings.tool,
        color: settings.color,
        lineWidth: settings.lineWidth,
        startX: startPosRef.current.x,
        startY: startPosRef.current.y,
        endX: currentPosRef.current.x,
        endY: currentPosRef.current.y,
        path: (settings.tool === 'freehand') ? [...currentPathRef.current] : null
    }), [settings.tool, settings.color, settings.lineWidth]);

    // Memoize handleMove logic
    const handleMoveCallback = useCallback((clientX, clientY) => {
        if (!isDrawingRef.current) return;
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;
        const pos = getCanvasPoint(canvas, clientX, clientY);
        currentPosRef.current = pos;
        if (settings.tool === 'freehand') {
            const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
            const distSq = (pos.x - lastPoint.x)**2 + (pos.y - lastPoint.y)**2;
            if (distSq > 4) {
                currentPathRef.current.push(pos);
            }
        }
        onDrawMove(createActionObject());
    }, [settings.tool, onDrawMove, createActionObject]);

    // Ref to hold the latest handleMoveCallback
    const handleMoveRef = useRef(handleMoveCallback);
    useEffect(() => { handleMoveRef.current = handleMoveCallback; }, [handleMoveCallback]);

    // Ref to hold the latest handleEndCallback
    const handleEndRef = useRef(); // Defined here, assigned after handleEndCallback definition

    // Define stable window handlers using refs (these functions are stable)
    const handleMouseMove = useCallback((e) => handleMoveRef.current(e.clientX, e.clientY), []);
    const handleTouchMove = useCallback((e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        handleMoveRef.current(e.touches[0].clientX, e.touches[0].clientY);
    }, []);
    const handleMouseUp = useCallback((e) => handleEndRef.current(e.clientX, e.clientY), []);
    const handleTouchEnd = useCallback((e) => {
        let finalX, finalY;
        if (e.changedTouches && e.changedTouches.length > 0) {
            finalX = e.changedTouches[0].clientX;
            finalY = e.changedTouches[0].clientY;
        }
        handleEndRef.current(finalX, finalY);
    }, []);

    // Memoize handleEnd logic
    const handleEndCallback = useCallback((clientX, clientY) => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;

        const canvas = drawingCanvasRef.current;
        const ctx = drawCtxRef.current;
        if (!canvas || !ctx) return;

        const finalPos = (clientX !== undefined && clientY !== undefined)
            ? getCanvasPoint(canvas, clientX, clientY)
            : currentPosRef.current;
        currentPosRef.current = finalPos;

        if (settings.tool === 'freehand' && currentPathRef.current.length > 0) {
            const last = currentPathRef.current[currentPathRef.current.length - 1];
            if (Math.hypot(last.x - finalPos.x, last.y - finalPos.y) > 0.1) {
                currentPathRef.current.push(finalPos);
            }
        }

        const completedAction = createActionObject();

        let addAction = false;
        const distSq = (startPosRef.current.x - finalPos.x)**2 + (startPosRef.current.y - finalPos.y)**2;
        if (settings.tool === 'freehand') {
            addAction = currentPathRef.current.length > 1;
        } else {
            addAction = distSq >= 4 || settings.tool.startsWith('filled');
        }

        if (addAction) {
            applyContextSettings(ctx, settings, completedAction);
            drawActionWithSymmetry(ctx, completedAction, settings, centerRef.current);
            applyContextSettings(ctx, settings);
            let newStateImageData = null;
            try {
                newStateImageData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
                setLastCommittedImageData(newStateImageData);
            } catch (e) {
                console.error("Error getting ImageData after commit:", e);
                setLastCommittedImageData(null);
            }
            onDrawEnd(completedAction);
            if (onStateUpdate && drawingCanvasRef.current) {
                onStateUpdate(drawingCanvasRef.current.toDataURL());
            }
        } else {
            onDrawEnd(null);
            redrawCommittedState();
        }

        currentPathRef.current = [];
        // Remove the stable handlers
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd);
    }, [
        settings, canvasSize, setLastCommittedImageData, onDrawEnd, onStateUpdate,
        redrawCommittedState, createActionObject,
        handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd // Depend on stable handlers
    ]);

    // Update handleEndRef with the latest callback
    useEffect(() => { handleEndRef.current = handleEndCallback; }, [handleEndCallback]);

    // Memoize handleStart logic
    const handleStartCallback = useCallback((clientX, clientY, isTouchEvent = false) => {
        if (!isTouchEvent && window.event?.button !== 0) return;
        const canvas = drawingCanvasRef.current;
        if (!canvas || !drawCtxRef.current || isLoading) return;
        isDrawingRef.current = true;
        const pos = getCanvasPoint(canvas, clientX, clientY);
        startPosRef.current = pos;
        currentPosRef.current = pos;
        if (settings.tool === 'freehand') {
            currentPathRef.current = [pos];
        }
        onDrawStart();
        // Add the stable handlers
        if (isTouchEvent) {
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);
            window.addEventListener('touchcancel', handleTouchEnd);
        } else {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
    }, [
        isLoading, settings.tool, onDrawStart,
        handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd // Depend on stable handlers
    ]);

    // Memoize canvas-specific handlers
    const handleMouseDown = useCallback((e) => handleStartCallback(e.clientX, e.clientY, false), [handleStartCallback]);
    const handleTouchStart = useCallback((e) => {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        handleStartCallback(e.touches[0].clientX, e.touches[0].clientY, true);
    }, [handleStartCallback]);


    // --- Attach/Detach Event Listeners ---
    useEffect(() => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

        // Define stable cleanup function
        const cleanup = () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('touchstart', handleTouchStart);
            // Clean up window listeners ONLY if drawing was in progress when unmounting
            if (isDrawingRef.current) {
                // console.warn("Cleaning up window listeners on unmount while drawing"); // For debugging
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleTouchEnd);
                window.removeEventListener('touchcancel', handleTouchEnd);
            }
        };

        return cleanup;
        // Dependencies are the stable callback handlers attached to the canvas
        // and the stable window handlers needed for cleanup logic.
    }, [handleMouseDown, handleTouchStart, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);


    // --- Effect for Cursor Style ---
    useEffect(() => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;
        canvas.classList.remove(styles.cursorPencil, styles.cursorCrosshair, styles.cursorDefault);
        canvas.style.cursor = ''; // Clear inline style
        if (settings.cursorStyle === 'pencil') {
             // Ensure cursor.png is in the public folder
             canvas.style.cursor = `url('/cursor.png') 0 16, crosshair`;
             canvas.classList.add(styles.cursorPencil);
         } else if (settings.cursorStyle === 'crosshair') {
             canvas.classList.add(styles.cursorCrosshair);
         } else {
             canvas.classList.add(styles.cursorDefault);
         }
    }, [settings.cursorStyle]);


    // --- Effect for Drawing Guides ---
    // redrawGuides moved up before debouncedResize which depends on it
    useEffect(() => {
        redrawGuides();
    }, [redrawGuides]); // Depend on the memoized redraw function

    // --- Effect for Preview Drawing Loop (using requestAnimationFrame) ---
    useEffect(() => {
        let rafId;
        const loop = () => {
            const ctx = drawCtxRef.current;
            // Only draw preview if actively drawing and have a preview action
            if (isDrawingRef.current && previewAction && ctx && lastCommittedImageData) {
                // 1. Restore base state from ImageData cache
                ctx.putImageData(lastCommittedImageData, 0, 0);
                // 2. Draw the temporary action on top
                applyContextSettings(ctx, settings, previewAction);
                drawActionWithSymmetry(ctx, previewAction, settings, centerRef.current);
                applyContextSettings(ctx, settings); // Restore live settings
            }
            // Continue loop only if drawing
            if (isDrawingRef.current) {
                 rafId = requestAnimationFrame(loop);
            }
        };

        if (isDrawingRef.current && previewAction && lastCommittedImageData) {
            rafId = requestAnimationFrame(loop); // Start loop if drawing and have data
        } else if (!isDrawingRef.current) {
             // If drawing stopped, ensure the final committed state is shown
            // This might be redundant if handleEnd already called redrawCommittedState, but ensures consistency
            redrawCommittedState();
        }

        return () => {
            cancelAnimationFrame(rafId); // Cleanup RAF on unmount or if effect re-runs
        };
        // Depend on previewAction to restart loop when it changes
        // Depend on lastCommittedImageData to ensure base is ready
    }, [previewAction, settings, redrawCommittedState, lastCommittedImageData, isDrawingRef]); // Added isDrawingRef as it's used in the effect


    // --- Effect for Downloading Image ---
    useEffect(() => {
        if (triggerDownload) {
            const canvas = drawingCanvasRef.current;
            const grid = gridCanvasRef.current;
            const ctx = drawCtxRef.current;
             if (!canvas || !ctx || !lastCommittedImageData) {
                 console.error("Download failed: Canvas or cached data not ready.");
                 alert("Gagal membuat gambar unduhan.");
                 // Reset trigger in App.jsx state even on failure? Yes.
                 return;
             };

             // Create a temporary canvas for compositing
             const tempCanvas = document.createElement('canvas');
             // Use logical size for temp canvas drawing, then scale up? No, use physical.
             tempCanvas.width = canvas.width;
             tempCanvas.height = canvas.height;
             const tempCtx = tempCanvas.getContext('2d');
             if (!tempCtx) return;

             // 1. Fill background
             const bgColor = theme === 'dark'
                 ? getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg-dark').trim()
                 : getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg-light').trim();
             tempCtx.fillStyle = bgColor || '#ffffff'; // Fallback white
             tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

             // 2. Draw main content from cached ImageData
            try {
                // Need to draw ImageData to a temporary canvas to get DataURL/Blob
                const tempDrawCanvas = document.createElement('canvas');
                tempDrawCanvas.width = lastCommittedImageData.width;
                tempDrawCanvas.height = lastCommittedImageData.height;
                const tempDrawCtx = tempDrawCanvas.getContext('2d');
                tempDrawCtx.putImageData(lastCommittedImageData, 0, 0);
                // Now draw this temp canvas onto the final download canvas
                tempCtx.drawImage(tempDrawCanvas, 0, 0);

                 // 3. Draw guides if visible
                 if (settings.showGuides && grid) {
                     tempCtx.drawImage(grid, 0, 0);
                 }

                 // 4. Trigger download
                 const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                 const symType = settings.reflectionEnabled ? 'D' : 'C';
                 const filename = `pola_roset_${symType}${settings.rotationOrder}_${timestamp}.png`;
                 tempCanvas.toBlob((blob) => {
                     if (blob) {
                         saveAs(blob, filename);
                     } else {
                         alert("Gagal membuat file gambar.");
                     }
                 }, 'image/png');

            } catch(e) {
                console.error("Download image composition error:", e);
                alert("Gagal membuat gambar unduhan.");
            }
        }
    }, [triggerDownload, settings, lastCommittedImageData, theme, canvasSize]);


    // --- Effect for Clearing Canvas on CLEAR action from reducer ---
    useEffect(() => {
        // If history index is -1 and actions are empty, it means CLEAR happened
        if (historyIndex === -1 && actions.length === 0 && !isLoading) {
             console.log("Clearing canvas due to state reset (CLEAR action)");
            clearDrawingCanvas(false); // External clear, will notify App
            redrawGuides(); // Redraw guides on cleared canvas
        }
    }, [historyIndex, actions, clearDrawingCanvas, redrawGuides, isLoading]);


    return (
        <div className={styles.canvasWrapper}>
             <div className={styles.canvasInstructions}>
                 Gambar di area putih. Simetri diterapkan secara langsung.
             </div>
            <div
                 className={styles.canvasContainer}
                 style={
                     {
                         // ... existing styles ...
                     }
                 }
            >
                {/* Loading Indicator - Apply isLoading class conditionally */}
                <div className={`${styles.loadingOverlay} ${isLoading ? styles.isLoading : ''}`}>
                    Memuat...
                </div>
                <canvas ref={drawingCanvasRef} className={styles.drawingCanvas}></canvas>
                <canvas ref={gridCanvasRef} className={styles.gridCanvas}></canvas>
            </div>
        </div>
    );
}

export default DrawingCanvas;

