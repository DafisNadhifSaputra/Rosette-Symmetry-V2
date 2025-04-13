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


// Consider moving CANVAS_TARGET_SIZE to a config file if used elsewhere
// const CANVAS_TARGET_SIZE = 600; // Base size defined in CSS variable :root { --canvas-target-size: 600px; }

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
    // Logical size state (CSS pixels)
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 }); // Start at 0
    // Cache of the last committed drawing state (ImageData)
    const [lastCommittedImageData, setLastCommittedImageData] = useState(null); // Store ImageData object
    // Flag to prevent drawing/actions before initial setup is complete
    const [isInitialized, setIsInitialized] = useState(false); // Track initial setup


    // --- Clear Canvas ---
    // Clears the drawing canvas and updates the history/state if not internal call
    const clearDrawingCanvas = useCallback((isInternal = false) => {
        const ctx = drawCtxRef.current;
        const canvas = drawingCanvasRef.current;
        // Ensure context and canvas are ready and have dimensions
        if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) {
            console.warn("ClearDrawingCanvas skipped: context or canvas not ready or size is zero.");
            return;
        }

        // Clear the canvas (physical coordinates)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Fill with white background for consistency before capturing state
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // If triggered externally (e.g., Clear button), update cache and notify parent
        if (!isInternal) {
            try {
                // Capture the cleared state (physical size)
                const clearedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setLastCommittedImageData(clearedImageData);
                console.log("Canvas cleared externally, updated cache.");

                // Notify parent (App) to reset history with the cleared state
                if (onCanvasReady && canvas) { // Check canvas ref again
                    onCanvasReady(canvas.toDataURL()); // Send dataURL for history reset
                    console.log("Notified parent (onCanvasReady) after external clear.");
                }
            } catch (e) {
                console.error("Error getting/setting ImageData on clear:", e);
                setLastCommittedImageData(null); // Invalidate cache on error
            }
        }
    }, [onCanvasReady]); // Dependency: only needs onCanvasReady


    // --- Redraw Guides ---
    // Redraws the symmetry guides based on current settings and canvas size
    const redrawGuides = useCallback(() => {
         const gridCtx = gridCtxRef.current;
         const gridCanvas = gridCanvasRef.current;
        // Use logical size for drawing guides, ensure context and canvas are ready
        if (gridCtx && gridCanvas && canvasSize.width > 0 && canvasSize.height > 0) {
            // Clear previous guides first (use physical size)
            gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
            // Draw new guides if enabled
            if (settings.showGuides) {
                drawGuides(gridCtx, settings, centerRef.current, canvasSize);
            }
        }
    }, [settings, canvasSize]); // Dependencies: settings (for guide type/visibility), canvasSize (for dimensions/center)

     // --- Redraw Committed State ---
     // Redraws the canvas based on the actions history up to the current historyIndex
     const redrawCommittedState = useCallback(() => {
         const ctx = drawCtxRef.current;
         const canvas = drawingCanvasRef.current;
         // Ensure context/canvas ready, not loading, and initialized
         if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0 || isLoading || !isInitialized) {
             // console.log("RedrawCommittedState skipped:", { ctx: !!ctx, canvas: !!canvas, w: canvas?.width, h: canvas?.height, isLoading, isInitialized });
             return;
         }

         console.log(`Redrawing committed state up to history index: ${historyIndex}`);

         // Clear using physical size
         ctx.clearRect(0, 0, canvas.width, canvas.height);

         // Add white background for consistency
         ctx.fillStyle = '#ffffff';
         ctx.fillRect(0, 0, canvas.width, canvas.height);

         // Determine actions to redraw based on history index
         const actionsToDraw = actions.slice(0, historyIndex + 1);

         // Only draw if there are actions in the relevant history
         if (actionsToDraw.length > 0) {
             console.log(`Redrawing ${actionsToDraw.length} actions.`);

             actionsToDraw.forEach((action, index) => {
                 if (action && action.tool) {
                     // Apply settings stored within the action itself
                     applyContextSettings(ctx, settings, action); // Use action's specific settings
                     // Draw the action with symmetry
                     drawActionWithSymmetry(ctx, action, settings, centerRef.current);
                 } else {
                     console.warn(`Skipping invalid action at index ${index} during redraw.`);
                 }
             });
         } else {
             console.log("No actions to redraw for current history index.");
         }

         // Restore live settings for potential subsequent operations (like preview)
         applyContextSettings(ctx, settings);

         // Update the ImageData cache after redrawing (use physical size)
         try {
             const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
             setLastCommittedImageData(newImageData);
             console.log("Updated lastCommittedImageData cache after redraw.");
         } catch (e) {
             console.error("Error getting ImageData after redraw:", e);
             setLastCommittedImageData(null); // Invalidate cache on error
         }

     }, [actions, historyIndex, settings, isLoading, isInitialized]); // Dependencies: state affecting what needs to be redrawn


     // --- Canvas Setup & Resize ---
     // Initializes or resizes the drawing and grid canvases
     const setupCanvas = useCallback((isInitialSetup = false) => {
         // Add debug output to track initialization attempts
         console.log(`setupCanvas called. isInitialSetup=${isInitialSetup}, isInitialized=${isInitialized}`);
         
         const canvas = drawingCanvasRef.current;
         const grid = gridCanvasRef.current;
         const container = canvas?.parentElement;
         if (!canvas || !grid || !container) {
             console.error("SetupCanvas failed: Canvas, grid, or container ref not available.");
             return false;
         }

         // Determine target logical size (e.g., from CSS variable or container)
         const targetSizeStyle = getComputedStyle(document.documentElement).getPropertyValue('--canvas-target-size').trim() || '600px';
         const targetSize = parseInt(targetSizeStyle, 10) || 600;

         let containerWidth = container.clientWidth;
         // Fallback if container width isn't available yet
         if (containerWidth <= 0) {
             console.warn("Container width is 0 or less, using offsetWidth or targetSize as fallback.");
             containerWidth = container.offsetWidth || targetSize;
             if (containerWidth <= 0) {
                 containerWidth = targetSize; // Final fallback
             }
         }

         const size = Math.min(containerWidth, targetSize); // Final logical size
         const dpr = window.devicePixelRatio || 1;
         const physicalSize = Math.floor(size * dpr); // Physical pixel size

         // Avoid resizing if physical size hasn't changed
         let resized = false;
         if (canvas.width !== physicalSize || canvas.height !== physicalSize) {
             resized = true;
             console.log(`Resizing canvas. Old: ${canvas.width}x${canvas.height}, New: ${physicalSize}x${physicalSize}, Logical: ${size}x${size}, DPR: ${dpr}`);

             // Set physical dimensions
             canvas.width = physicalSize;
             canvas.height = physicalSize;
             grid.width = physicalSize;
             grid.height = physicalSize;

             // Set logical dimensions (CSS)
             canvas.style.width = `${size}px`;
             canvas.style.height = `${size}px`;
             grid.style.width = `${size}px`;
             grid.style.height = `${size}px`;

             // Update logical size state
             setCanvasSize({ width: size, height: size });

             // Contexts become invalid on resize, need to get them again
             drawCtxRef.current = null;
             gridCtxRef.current = null;
         }

         // Always update center based on current logical size
         centerRef.current = { x: size / 2, y: size / 2 };

         // Get/update contexts if they don't exist or if canvas was resized
         if (!drawCtxRef.current || !gridCtxRef.current) {
             drawCtxRef.current = canvas.getContext('2d', { willReadFrequently: true });
             gridCtxRef.current = grid.getContext('2d');

             if (drawCtxRef.current && gridCtxRef.current) {
                 // Apply DPR scaling immediately after getting context
                 drawCtxRef.current.scale(dpr, dpr);
                 gridCtxRef.current.scale(dpr, dpr);

                 // Apply current drawing settings to the drawing context
                 applyContextSettings(drawCtxRef.current, settings);

                 console.log("Canvas contexts obtained and scaled by DPR:", dpr);
             } else {
                 console.error("Failed to get canvas contexts after resize or initial setup.");
                 // Reset refs if failed
                 drawCtxRef.current = null;
                 gridCtxRef.current = null;
                 return false; // Indicate failure
             }
         }

         console.log("Canvas Setup/Resized. Logical Size:", size, "Physical Size:", physicalSize, "Resized:", resized, "Initial:", isInitialSetup);

         // --- Initial Setup Logic ---
         // Force initialization on the first successful setup with valid size and context
         // Change this condition to ensure initialization happens regardless of isInitialSetup flag
         if (!isInitialized && physicalSize > 0 && drawCtxRef.current) {
             const ctx = drawCtxRef.current;
             console.log("Performing initial canvas setup...");
             try {
                 // Clear and fill with white background
                 ctx.clearRect(0, 0, physicalSize, physicalSize);
                 ctx.fillStyle = '#ffffff';
                 ctx.fillRect(0, 0, physicalSize, physicalSize);

                 // Capture initial blank state
                 const initialImageData = ctx.getImageData(0, 0, physicalSize, physicalSize);
                 setLastCommittedImageData(initialImageData);

                 // Notify parent (App) that canvas is ready with initial state
                 if (onCanvasReady) {
                     const dataUrl = canvas.toDataURL();
                     console.log("Canvas ready, sending initial dataURL to parent.");
                     onCanvasReady(dataUrl); // Send dataURL for history initialization
                 }

                 setIsInitialized(true); // Mark initialization complete
                 console.log("Canvas Initialized and Ready.");

                 // Draw initial guides after initialization
                 redrawGuides();

             } catch (e) {
                 console.error("Error during initial canvas setup:", e);
                 setLastCommittedImageData(null); // Invalidate cache on error
                 setIsInitialized(false); // Ensure it remains uninitialized on error
             }
         } else if (resized && isInitialized) {
             // --- Resize Logic (after initial setup) ---
             console.log("Canvas resized after initialization, redrawing state and guides.");
             // If resized later, redraw the existing committed state and guides
             redrawCommittedState(); // Redraw based on history
             redrawGuides();         // Redraw guides for new size
         } else if (!resized && isInitialized) {
             // If setup was called but no resize occurred (e.g., DPR change only, or container check)
             // ensure guides are still correct (settings might have changed)
             redrawGuides();
         }

         return resized; // Return whether a resize occurred

     }, [settings, onCanvasReady, isInitialized, redrawCommittedState, redrawGuides]); // Dependencies


     // Debounced resize handler using useMemo for stability
     const debouncedResizeHandler = useMemo(() => debounce((isInitial) => {
        console.log("Debounced resize/setup triggered. Initial:", isInitial);
        setupCanvas(isInitial); // Call setup, it handles redraw if needed
     }, 150), [setupCanvas]); // Recreate debounce only if setupCanvas changes

     // --- Effects ---

     // Effect: Initial setup and resize listener
     useEffect(() => {
         const container = drawingCanvasRef.current?.parentElement;
         if (!container) {
             console.error("Initial setup effect skipped: Canvas container not found.");
             return;
         }

         // Initial setup attempt (debounced)
         console.log("Queueing initial canvas setup via debounced handler.");
         debouncedResizeHandler(true); // Mark as initial

         // Use ResizeObserver to detect container size changes
         const resizeObserver = new ResizeObserver(entries => {
             if (entries[0]) {
                 console.log("ResizeObserver detected container resize.");
                 // Don't mark as initial setup on subsequent resizes
                 debouncedResizeHandler(false); // Mark as not initial
             }
         });

         resizeObserver.observe(container);

         // Cleanup function
         return () => {
             console.log("Cleaning up resize observer and debounced handler.");
             resizeObserver.disconnect();
             debouncedResizeHandler.cancel(); // Cancel any pending debounced calls
         };
         // Dependencies: setupCanvas (memoized), debouncedResizeHandler (memoized)
     }, [setupCanvas, debouncedResizeHandler]);


    // --- Drawing Event Handlers ---

    // Memoized function to create an action object from the current state
    const createActionObject = useCallback(() => ({
        tool: settings.tool,
        color: settings.color,
        lineWidth: settings.lineWidth,
        // Store coordinates relative to the logical canvas size
        startX: startPosRef.current.x,
        startY: startPosRef.current.y,
        endX: currentPosRef.current.x,
        endY: currentPosRef.current.y,
        // Clone path array for freehand tool
        path: (settings.tool === 'freehand') ? [...currentPathRef.current] : null
    }), [settings.tool, settings.color, settings.lineWidth]); // Dependencies: relevant settings


    // Memoized callback for handling mouse/touch move during drawing
    const handleMoveCallback = useCallback((clientX, clientY) => {
        if (!isDrawingRef.current) return; // Only run if drawing
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;

        const pos = getCanvasPoint(canvas, clientX, clientY); // Get logical coordinates
        currentPosRef.current = pos;

        if (settings.tool === 'freehand') {
            const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
            // Add point only if moved a minimum distance to avoid too many points
            if (lastPoint) {
                const distSq = (pos.x - lastPoint.x)**2 + (pos.y - lastPoint.y)**2;
                const minDistanceSq = 4; // Minimum squared distance threshold
                if (distSq > minDistanceSq) {
                    currentPathRef.current.push(pos);
                }
            } else {
                currentPathRef.current.push(pos); // Add first point
            }
        }

        // Notify parent about the move for preview rendering
        onDrawMove(createActionObject());

    }, [settings.tool, onDrawMove, createActionObject]); // Dependencies


    // Use refs to hold the latest callbacks for stable window event listeners
    const handleMoveRef = useRef(handleMoveCallback);
    useEffect(() => { handleMoveRef.current = handleMoveCallback; }, [handleMoveCallback]);

    const handleEndRef = useRef(); // Defined here, assigned after handleEndCallback definition


    // Define stable window event handlers using refs (these functions themselves are stable)
    const handleMouseMove = useCallback((e) => handleMoveRef.current(e.clientX, e.clientY), []);
    const handleTouchMove = useCallback((e) => {
        // Handle single touch move, prevent default scroll/zoom
        if (e.touches.length !== 1) return;
        e.preventDefault();
        handleMoveRef.current(e.touches[0].clientX, e.touches[0].clientY);
    }, []);
    const handleMouseUp = useCallback((e) => handleEndRef.current(e.clientX, e.clientY), []);
    const handleTouchEnd = useCallback((e) => {
        // Use changedTouches to get the final position
        let finalX, finalY;
        if (e.changedTouches && e.changedTouches.length > 0) {
            finalX = e.changedTouches[0].clientX;
            finalY = e.changedTouches[0].clientY;
        }
        // Call the end handler logic, potentially with undefined coords if touchcancel
        handleEndRef.current(finalX, finalY);
    }, []);


    // Memoized callback for handling mouse/touch end (commit the drawing action)
    const handleEndCallback = useCallback((clientX, clientY) => {
        if (!isDrawingRef.current) return; // Only run if drawing was active
        isDrawingRef.current = false; // Mark drawing as stopped

        const canvas = drawingCanvasRef.current;
        const ctx = drawCtxRef.current;
        // Ensure canvas/context are valid
        if (!canvas || !ctx || canvas.width === 0 || canvas.height === 0) {
            console.warn("handleEndCallback skipped: canvas or context not ready.");
            return;
        }

        // Determine final position (use last known if clientX/Y are undefined, e.g., touchcancel)
        const finalPos = (clientX !== undefined && clientY !== undefined)
            ? getCanvasPoint(canvas, clientX, clientY)
            : currentPosRef.current;
        currentPosRef.current = finalPos;

        // Add final point to freehand path if needed
        if (settings.tool === 'freehand' && currentPathRef.current.length > 0) {
            const last = currentPathRef.current[currentPathRef.current.length - 1];
            // Add if different from the last point added during move
            if (Math.hypot(last.x - finalPos.x, last.y - finalPos.y) > 0.1) {
                currentPathRef.current.push(finalPos);
            }
        }

        // Create the final action object
        const completedAction = createActionObject();

        // Determine if the action is significant enough to be added to history
        let addAction = false;
        const distSq = (startPosRef.current.x - finalPos.x)**2 + (startPosRef.current.y - finalPos.y)**2;
        const minDistanceSq = 4; // Threshold for line/shape tools (squared)

        if (settings.tool === 'freehand') {
            // Freehand needs at least two points (start and one move/end)
            addAction = currentPathRef.current.length > 1;
        } else {
            // Other tools: add if distance is significant OR it's a filled shape (allow clicks for filled shapes)
            addAction = distSq >= minDistanceSq || settings.tool.startsWith('filled');
        }

        if (addAction) {
            console.log("Committing action:", completedAction.tool);
            // 1. Apply settings for the completed action
            applyContextSettings(ctx, settings, completedAction);
            // 2. Draw the final action permanently onto the canvas
            drawActionWithSymmetry(ctx, completedAction, settings, centerRef.current);
            // 3. Restore live settings
            applyContextSettings(ctx, settings);
            // 4. Capture the new canvas state
            try {
                const newStateImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setLastCommittedImageData(newStateImageData); // Update cache
                console.log("Updated cache after committing action.");
            } catch (e) {
                console.error("Error getting ImageData after commit:", e);
                setLastCommittedImageData(null); // Invalidate cache
            }
            // 5. Notify parent: action completed
            onDrawEnd(completedAction);
            // 6. Notify parent: state updated (send new data URL for history)
            if (onStateUpdate && drawingCanvasRef.current) {
                onStateUpdate(drawingCanvasRef.current.toDataURL());
                console.log("Notified parent (onStateUpdate) after commit.");
            }
        } else {
            console.log("Action discarded (too small or invalid).");
            // Notify parent: action discarded
            onDrawEnd(null);
            // Redraw the previous committed state to erase any preview artifacts
            redrawCommittedState();
        }

        // Reset path for the next drawing action
        currentPathRef.current = [];

        // --- Crucial: Remove window listeners ---
        // These were added on mouse/touch down and must be removed on up/end
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
        window.removeEventListener('touchcancel', handleTouchEnd); // Also remove listener for cancel

    }, [
        settings, // Needed for tool type, applying settings
        setLastCommittedImageData, // To update cache
        onDrawEnd, // Callback for action completion
        onStateUpdate, // Callback for state update (history)
        redrawCommittedState, // To revert if action is discarded
        createActionObject, // To create the action payload
        // Stable window handlers (used for removal)
        handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd
    ]);

    // Update the handleEndRef with the latest memoized callback
    useEffect(() => { handleEndRef.current = handleEndCallback; }, [handleEndCallback]);


    // Memoized handler for canvas mousedown
    const handleMouseDown = useCallback((e) => {
        // Check if it's the main button (left-click)
        // Note: e.button might be undefined in some testing environments
        const button = e.button !== undefined ? e.button : 0; // Default to 0 if undefined
        if (button !== 0) return; // Ignore right/middle clicks

        e.preventDefault(); // Prevent text selection, etc.
        e.stopPropagation(); // Prevent triggering listeners on parent elements

        const canvas = drawingCanvasRef.current;
        // Ensure canvas is ready, not loading, and initialized
        if (!canvas || !drawCtxRef.current || isLoading || !isInitialized) {
            console.warn("handleMouseDown skipped: canvas not ready or loading/uninitialized.");
            return;
        }

        isDrawingRef.current = true; // Start drawing mode
        const pos = getCanvasPoint(canvas, e.clientX, e.clientY); // Get logical coordinates
        startPosRef.current = pos;
        currentPosRef.current = pos;

        // Initialize path for freehand tool
        if (settings.tool === 'freehand') {
            currentPathRef.current = [pos];
        }

        onDrawStart(); // Notify parent that drawing started

        // Add listeners to the window to track mouse movement and release
        // These listeners are removed in handleEndCallback
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

    }, [isLoading, settings.tool, onDrawStart, isInitialized, handleMouseMove, handleMouseUp]); // Dependencies


    // Memoized handler for canvas touchstart
    const handleTouchStart = useCallback((e) => {
        // Handle single touch only
        if (e.touches.length !== 1) return;

        e.preventDefault(); // Prevent default touch behaviors like scrolling/zooming

        const canvas = drawingCanvasRef.current;
        // Ensure canvas is ready, not loading, and initialized
        if (!canvas || !drawCtxRef.current || isLoading || !isInitialized) {
            console.warn("handleTouchStart skipped: canvas not ready or loading/uninitialized.");
            return;
        }

        isDrawingRef.current = true; // Start drawing mode
        const pos = getCanvasPoint(canvas, e.touches[0].clientX, e.touches[0].clientY); // Get logical coordinates
        startPosRef.current = pos;
        currentPosRef.current = pos;

        // Initialize path for freehand tool
        if (settings.tool === 'freehand') {
            currentPathRef.current = [pos];
        }

        onDrawStart(); // Notify parent that drawing started

        // Add listeners to the window to track touch movement and release
        // These listeners are removed in handleEndCallback
        // Use { passive: false } for touchmove to allow preventDefault()
        window.addEventListener('touchmove', handleTouchMove, { passive: false });
        window.addEventListener('touchend', handleTouchEnd);
        window.addEventListener('touchcancel', handleTouchEnd); // Handle cancellation

    }, [isLoading, settings.tool, onDrawStart, isInitialized, handleTouchMove, handleTouchEnd]); // Dependencies


    // Effect: Attach/Detach Event Listeners to the Canvas
    useEffect(() => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return; // Don't attach if canvas isn't rendered yet

        // Attach the memoized handlers
        canvas.addEventListener('mousedown', handleMouseDown);
        // Use { passive: false } for touchstart to allow preventDefault() inside handler
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });

        // Cleanup function: remove listeners from the canvas element
        const cleanup = () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('touchstart', handleTouchStart);
            // Note: Window listeners are removed in handleEndCallback, not here.
            // Removing them here could cause issues if the component unmounts
            // *during* a draw operation but *before* handleEndCallback runs.
            // handleEndCallback is the definitive place to clean up window listeners.
        };

        return cleanup;
        // Dependencies are the stable, memoized handlers attached to the canvas
    }, [handleMouseDown, handleTouchStart]);


    // Effect: Update Cursor Style
    useEffect(() => {
        const canvas = drawingCanvasRef.current;
        if (!canvas) return;

        // Clear previous cursor styles (classes and inline)
        canvas.classList.remove(styles.cursorPencil, styles.cursorCrosshair, styles.cursorDefault);
        canvas.style.cursor = ''; // Reset inline style

        // Update container's data attribute for potential parent styling
        const container = canvas.parentElement;
        if (container) {
            container.setAttribute('data-cursor', settings.cursorStyle || 'default');
        }

        // Apply the appropriate cursor style based on settings
        switch (settings.cursorStyle) {
            case 'pencil':
                canvas.classList.add(styles.cursorPencil); // Use CSS module class for custom cursor
                break;
            case 'crosshair':
                canvas.style.cursor = 'crosshair';
                break;
            default:
                canvas.style.cursor = 'default';
                canvas.classList.add(styles.cursorDefault); // Optional: Add default class if needed
                break;
        }
    }, [settings.cursorStyle]); // Dependency: cursorStyle setting


    // Effect: Redraw Guides when settings change or canvas resizes (via redrawGuides dependency)
    useEffect(() => {
        // This effect ensures guides are redrawn whenever the memoized
        // redrawGuides function changes (due to settings or canvasSize changes)
        // It's separated to avoid re-running the main setup/resize effect just for guides.
        if (isInitialized) { // Only draw guides after initial setup
             console.log("Redrawing guides due to settings or size change");
             redrawGuides();
        }
    }, [redrawGuides, isInitialized]); // Depend on the memoized redraw function and initialization status

    
    // Effect: Detect changes in symmetry settings (rotation/reflection) or showGuides toggle
    useEffect(() => {
        if (isInitialized) {
            console.log("Settings changed: showGuides=", settings.showGuides, 
                        "rotationOrder=", settings.rotationOrder, 
                        "reflectionEnabled=", settings.reflectionEnabled);
            // Always redraw the guides when any of these settings change
            redrawGuides();
            
            // Only redraw entire canvas for existing drawings when symmetry settings change
            if (actions.length > 0) {
                console.log("Symmetry settings changed, redrawing canvas with new settings");
                redrawCommittedState();
            }
        }
    }, [
        settings.rotationOrder, 
        settings.reflectionEnabled, 
        settings.showGuides, 
        isInitialized, 
        actions.length, 
        redrawCommittedState,
        redrawGuides
    ]);


    // Effect: Preview Drawing Loop (using requestAnimationFrame)
    useEffect(() => {
        let rafId; // To store the requestAnimationFrame ID

        const loop = () => {
            const ctx = drawCtxRef.current;
            const canvas = drawingCanvasRef.current;

            // Ensure all conditions are met for preview drawing
            if (isDrawingRef.current && previewAction && ctx && lastCommittedImageData && canvas && canvas.width > 0 && canvas.height > 0) {
                try {
                    // 1. Restore the last committed state from the ImageData cache
                    // Check dimensions match to prevent errors after resize during draw
                    if (lastCommittedImageData.width === canvas.width && lastCommittedImageData.height === canvas.height) {
                        ctx.putImageData(lastCommittedImageData, 0, 0);
                    } else {
                        console.warn("ImageData cache dimensions mismatch canvas during preview. Redrawing committed state.");
                        // Dimensions mismatch, likely due to resize during draw.
                        // Redraw the committed state based on history instead of using potentially invalid cache.
                        redrawCommittedState(); // This will also update the cache if successful
                        // We might lose the preview for this frame, but it prevents errors.
                    }

                    // 2. Draw the temporary preview action on top
                    applyContextSettings(ctx, settings, previewAction); // Use preview action's settings (usually same as live)
                    drawActionWithSymmetry(ctx, previewAction, settings, centerRef.current);

                    // 3. Restore live settings for the *next* frame or potential commit
                    applyContextSettings(ctx, settings);

                } catch (e) {
                    console.error("Error during preview drawing loop:", e);
                    // Attempt to recover by redrawing the committed state.
                    // This might happen if putImageData fails for other reasons.
                    redrawCommittedState();
                    // Invalidate cache just in case
                    setLastCommittedImageData(null);
                    // Stop the loop on error to prevent potential infinite error cycles
                    isDrawingRef.current = false; // Force stop drawing state
                    cancelAnimationFrame(rafId);
                    return; // Exit loop function
                }
            }

            // Continue the loop only if still drawing
            if (isDrawingRef.current) {
                 rafId = requestAnimationFrame(loop);
            }
        };

        // Start the loop only if currently drawing, have a preview action, and the base image cache is valid
        if (isDrawingRef.current && previewAction && lastCommittedImageData) {
            rafId = requestAnimationFrame(loop);
        } else if (!isDrawingRef.current && isInitialized) {
            // If drawing stopped, ensure the final committed state is displayed correctly.
            // This handles cases where the loop might not run a final time after mouseup/touchend.
            // console.log("Drawing stopped or no preview, ensuring committed state is drawn.");
            // redrawCommittedState(); // This might be redundant if handleEndCallback already called it. Test carefully.
            // Let's rely on handleEndCallback to call redrawCommittedState when needed.
        }

        // Cleanup function: cancel the animation frame when effect re-runs or component unmounts
        return () => {
            cancelAnimationFrame(rafId);
        };

    }, [previewAction, settings, lastCommittedImageData, isInitialized, redrawCommittedState]); // Dependencies


    // Effect: Handle Image Download Trigger
    useEffect(() => {
        if (triggerDownload) {
            console.log("Download triggered.");
            const canvas = drawingCanvasRef.current;
            const grid = gridCanvasRef.current;
            // Use lastCommittedImageData as the source of truth for the main drawing
            if (!canvas || !lastCommittedImageData || lastCommittedImageData.width === 0 || lastCommittedImageData.height === 0) {
                console.error("Download failed: Canvas or cached ImageData not ready or invalid.");
                alert("Gagal membuat gambar unduhan. Kanvas belum siap atau data gambar rusak.");
                // Parent component should reset the triggerDownload prop after showing the alert
                return;
            };

            // Create a temporary canvas for compositing the final image
            const tempCanvas = document.createElement('canvas');
            // Use physical size from the cached ImageData
            tempCanvas.width = lastCommittedImageData.width;
            tempCanvas.height = lastCommittedImageData.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (!tempCtx) {
                 console.error("Download failed: Could not create temporary canvas context.");
                 alert("Gagal membuat gambar unduhan (konteks sementara gagal).");
                 return;
            }

            try {
                // 1. Fill with a solid white background (ensures no transparency issues)
                tempCtx.fillStyle = '#ffffff';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

                // 2. Draw the main content from the cached ImageData onto the temporary canvas
                // No need to create a copy, putImageData works directly
                tempCtx.putImageData(lastCommittedImageData, 0, 0);

                // 3. Overlay guides if visible and grid canvas is valid and matches size
                if (settings.showGuides && grid && grid.width === tempCanvas.width && grid.height === tempCanvas.height) {
                    console.log("Adding guides overlay to download.");
                    tempCtx.drawImage(grid, 0, 0);
                } else if (settings.showGuides) {
                    console.warn("Grid canvas size mismatch or unavailable during download, skipping grid overlay.");
                }

                // 4. Generate filename and trigger download
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const symType = settings.reflectionEnabled ? 'D' : 'C'; // Dihedral or Cyclic
                const filename = `pola_roset_${symType}${settings.rotationOrder}_${timestamp}.png`;

                tempCanvas.toBlob((blob) => {
                    if (blob) {
                        saveAs(blob, filename);
                        console.log(`Image download initiated as ${filename}`);
                    } else {
                        console.error("Download failed: Blob creation failed.");
                        alert("Gagal membuat file gambar (blob creation failed).");
                    }
                    // Parent component should reset triggerDownload regardless of success/failure here
                }, 'image/png', 1.0); // Use PNG format, quality 1.0 (lossless for PNG)

            } catch(e) {
                console.error("Download image composition error:", e);
                alert("Gagal membuat gambar unduhan karena kesalahan komposisi.");
                // Parent component should reset triggerDownload
            }
        }
    }, [triggerDownload, settings, lastCommittedImageData]); // Dependencies


    // Effect: Handle CLEAR action from reducer (resets history)
    useEffect(() => {
        // Detect state reset: history index is -1, actions are empty, not loading, and canvas is initialized
        if (historyIndex === -1 && actions.length === 0 && !isLoading && isInitialized) {
             console.log("Clearing canvas due to detected state reset (CLEAR action).");
            // Perform an external clear (updates cache and notifies parent)
            clearDrawingCanvas(false);
            // Redraw guides on the now cleared canvas
            redrawGuides();
        }
    }, [historyIndex, actions, clearDrawingCanvas, redrawGuides, isLoading, isInitialized]); // Dependencies


    // Effect: Handle state loaded from file (redraw all actions)
    // This runs *after* App.jsx has loaded the state into `actions` and reset `historyIndex` to -1,
    // and after `isLoading` becomes false.
    useEffect(() => {
        // Check conditions: not loading, canvas initialized, actions array has content, historyIndex indicates a reset state (like after load)
        if (!isLoading && isInitialized && actions.length > 0 && historyIndex === -1) {
            console.log("Detected state loaded from file. Redrawing all", actions.length, "actions.");

            const ctx = drawCtxRef.current;
            const canvas = drawingCanvasRef.current;

            if (!ctx || !canvas || canvas.width === 0 || canvas.height === 0) {
                console.error("Cannot redraw loaded state: canvas or context not ready.");
                return;
            }

            // --- Redraw all loaded actions ---
            // 1. Clear canvas and set background
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Iterate and draw each loaded action
            actions.forEach((action, index) => {
                if (action && action.tool) {
                    applyContextSettings(ctx, settings, action); // Use action's settings
                    drawActionWithSymmetry(ctx, action, settings, centerRef.current);
                } else {
                     console.warn(`Skipping invalid loaded action at index ${index}.`);
                }
            });

            // 3. Restore live settings
            applyContextSettings(ctx, settings);

            // 4. Update the image data cache with the result of drawing all loaded actions
            try {
                const newImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                setLastCommittedImageData(newImageData);
                console.log("Updated cache after drawing loaded state.");

                // 5. IMPORTANT: Notify App.jsx to update the history with this newly drawn state.
                // This effectively sets the history to contain one entry: the fully rendered loaded state.
                // App.jsx's handleStateUpdate should dispatch UPDATE_HISTORY_STATE, which will set historyIndex to 0.
                if (onStateUpdate && canvas) {
                    onStateUpdate(canvas.toDataURL());
                    console.log("Notified parent (onStateUpdate) to initialize history after load.");
                }
            } catch (e) {
                console.error("Error updating state after drawing loaded actions:", e);
                setLastCommittedImageData(null); // Invalidate cache on error
            }
            // Also ensure guides are drawn correctly after loading state
            redrawGuides();
        }
    }, [isLoading, actions, historyIndex, isInitialized, settings, onStateUpdate, redrawGuides]); // Dependencies


    // --- Render ---
    return (
        <div className={styles.canvasWrapper}>
             {/* Optional: Instructions */}
             {/* <div className={styles.canvasInstructions}>
                 Gambar di area putih. Simetri diterapkan secara langsung.
             </div> */}
            <div
                 className={styles.canvasContainer}
                 // Cursor style is handled by effect and CSS classes/inline style on canvas elements
            >
                {/* Loading Indicator Overlay */}
                <div className={`${styles.loadingOverlay} ${isLoading ? styles.isLoading : ''}`}>
                    Memuat...
                </div>
                {/* Drawing Canvas (Top Layer) */}
                <canvas
                    ref={drawingCanvasRef}
                    className={styles.drawingCanvas}
                    // Width/Height attributes and style are set in setupCanvas
                ></canvas>
                {/* Grid Canvas (Bottom Layer) */}
                <canvas
                    ref={gridCanvasRef}
                    className={styles.gridCanvas}
                    // Width/Height attributes and style are set in setupCanvas
                ></canvas>
            </div>
        </div>
    );
}

export default DrawingCanvas;