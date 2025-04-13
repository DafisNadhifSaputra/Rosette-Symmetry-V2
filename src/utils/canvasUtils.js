// Utility functions related to drawing on the canvas

// Helper to get mouse/touch position relative to canvas
export function getCanvasPoint(canvas, clientX, clientY) {
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scaleX = canvas.width / dpr / rect.width;
    const scaleY = canvas.height / dpr / rect.height;
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

// Applies current settings to a context
export function applyContextSettings(ctx, currentSettings, actionSettings = null) {
    if (!ctx) return;
    const settingsToUse = actionSettings || currentSettings;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = settingsToUse.lineWidth;
    ctx.strokeStyle = settingsToUse.color;
    ctx.fillStyle = settingsToUse.color; // For filled shapes
}

// Draws a single primitive shape (line, rect, oval) - exported for use elsewhere
export function drawPrimitive(ctx, x1, y1, x2, y2, tool, angle = 0) {
    ctx.save();
    const w = x2 - x1;
    const h = y2 - y1;

    switch (tool) {
        case 'line':
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            break;
        case 'rectangle':
        case 'filledRect': {
            if (Math.abs(w) > 0.1 || Math.abs(h) > 0.1) {
                // For rectangles, we'll use transformation to maintain orientation during rotation
                const centerX = x1 + w / 2;
                const centerY = y1 + h / 2;
                
                ctx.translate(centerX, centerY);
                ctx.rotate(angle);
                
                ctx.beginPath();
                ctx.rect(-Math.abs(w) / 2, -Math.abs(h) / 2, Math.abs(w), Math.abs(h));
                if (tool === 'filledRect') ctx.fill();
                else ctx.stroke();
            }
            break;
        }
        case 'oval':
        case 'filledOval': {
            const rX = Math.abs(w / 2);
            const rY = Math.abs(h / 2);
            if (rX > 0.1 || rY > 0.1) {
                // For ovals, we'll use transformation to maintain orientation during rotation
                const centerX = x1 + w / 2;
                const centerY = y1 + h / 2;
                
                ctx.translate(centerX, centerY);
                ctx.rotate(angle);
                
                ctx.beginPath();
                ctx.ellipse(0, 0, rX, rY, 0, 0, 2 * Math.PI);
                if (tool === 'filledOval') ctx.fill();
                else ctx.stroke();
            }
            break;
        }
    }
    ctx.restore();
}

// Draws a small dot
function drawDot(ctx, x, y) {
    const radius = Math.max(0.5, ctx.lineWidth / 2);
    const originalFill = ctx.fillStyle;
    ctx.fillStyle = ctx.strokeStyle; // Use stroke color for dot
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = originalFill;
}

// Draws a freehand path
function drawFreehandPath(ctx, path) {
    if (!path || path.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    if (path.length === 1) {
        drawDot(ctx, path[0].x, path[0].y);
    } else {
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(path[i].x, path[i].y);
        }
        ctx.stroke();
    }
}

// --- Symmetry Application ---

// Transform a single point based on rotation and reflection
function transformPoint(x, y, angle, doReflect, centerX, centerY) {
    let cX = x - centerX;
    let cY = y - centerY;
    if (doReflect) cX = -cX; // Reflect across Y-axis relative to center
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const rX = cX * cosA - cY * sinA;
    const rY = cX * sinA + cY * cosA;
    return { x: rX + centerX, y: rY + centerY };
}

// Apply symmetry transformations to start/end points for primitives - exported for use elsewhere
export function applySymmetryToPrimitive(action, settings, center) {
    const points = [];
    const { startX: x1, startY: y1, endX: x2, endY: y2 } = action;
    const N = settings.rotationOrder;
    const reflect = settings.reflectionEnabled;
    const angleInc = (N > 0) ? (2 * Math.PI) / N : 0;
    const centerX = center.x;
    const centerY = center.y;

    for (let i = 0; i < N; i++) {
        const angle = i * angleInc;
        const p1Rot = transformPoint(x1, y1, angle, false, centerX, centerY);
        const p2Rot = transformPoint(x2, y2, angle, false, centerX, centerY);
        points.push({ x1: p1Rot.x, y1: p1Rot.y, x2: p2Rot.x, y2: p2Rot.y });

        if (reflect && N > 0) {
            const p1RefRot = transformPoint(x1, y1, angle, true, centerX, centerY);
            const p2RefRot = transformPoint(x2, y2, angle, true, centerX, centerY);
            points.push({ x1: p1RefRot.x, y1: p1RefRot.y, x2: p2RefRot.x, y2: p2RefRot.y });
        }
    }
    // Special case D1
    if (N === 1 && reflect) {
        const p1Ref = transformPoint(x1, y1, 0, true, centerX, centerY);
        const p2Ref = transformPoint(x2, y2, 0, true, centerX, centerY);
        const isDifferent = Math.hypot(x1 - p1Ref.x, y1 - p1Ref.y) > 1e-6 ||
                            Math.hypot(x2 - p2Ref.x, y2 - p2Ref.y) > 1e-6;
        if (isDifferent) {
             points.push({ x1: p1Ref.x, y1: p1Ref.y, x2: p2Ref.x, y2: p2Ref.y });
        }
    }
    return points;
}

// Apply symmetry transformations to a freehand path
function applySymmetryToPath(path, settings, center) {
    if (!path || path.length === 0) return [];
    const transformedPaths = [];
    const N = settings.rotationOrder;
    const reflect = settings.reflectionEnabled;
    const angleInc = (N > 0) ? (2 * Math.PI) / N : 0;
    const centerX = center.x;
    const centerY = center.y;

    const applyTransform = (originalPath, angle, doReflect) => {
        return originalPath.map(p => transformPoint(p.x, p.y, angle, doReflect, centerX, centerY));
    };

    for (let i = 0; i < N; i++) {
        const angle = i * angleInc;
        transformedPaths.push(applyTransform(path, angle, false));
        if (reflect && N > 0) {
            transformedPaths.push(applyTransform(path, angle, true));
        }
    }
     // Special case D1
     if (N === 1 && reflect) {
         const reflectedPath = applyTransform(path, 0, true);
         const isDifferent = path.some((p, index) => {
             const rp = reflectedPath[index];
             return Math.hypot(p.x - rp.x, p.y - rp.y) > 1e-6;
         });
         if(isDifferent) {
             transformedPaths.push(reflectedPath);
         }
     }
    return transformedPaths;
}

// Main function to draw an action with symmetry applied
export function drawActionWithSymmetry(ctx, action, settings, center) {
    if (!ctx || !action || !action.tool) return;

    // Special case for freehand drawing - keep using path-based approach
    if (action.tool === 'freehand') {
        if (action.path && action.path.length > 0) {
            const transformedPaths = applySymmetryToPath(action.path, settings, center);
            transformedPaths.forEach(p => drawFreehandPath(ctx, p));
        }
        return;
    }

    // For primitive shapes (line, rectangle, oval), we'll use canvas transformations
    // for more accurate rotational symmetry
    const N = settings.rotationOrder;
    const reflect = settings.reflectionEnabled;
    const angleInc = (N > 0) ? (2 * Math.PI) / N : 0;
    const centerX = center.x;
    const centerY = center.y;
    const isClickLike = Math.hypot(action.startX - action.endX, action.startY - action.endY) < 1.0;

    // Draw the shape N times with rotation
    for (let i = 0; i < N; i++) {
        const angle = i * angleInc;

        // Instance 1: Original shape with rotation
        if ((action.tool === 'filledRect' || action.tool === 'filledOval') && isClickLike) {
            // For click-like actions on filled shapes, just draw dots
            const rotatedPt = transformPoint(action.startX, action.startY, angle, false, centerX, centerY);
            drawDot(ctx, rotatedPt.x, rotatedPt.y);
        } else {
            // For regular shapes, use canvas transformation for rotation
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);
            ctx.translate(-centerX, -centerY);
            drawShapeDirectly(ctx, action);
            ctx.restore();
        }

        // Instance 2: Reflected shape with rotation (if reflection is enabled)
        if (reflect) {
            if ((action.tool === 'filledRect' || action.tool === 'filledOval') && isClickLike) {
                // For click-like actions on filled shapes, just draw dots for reflection
                const reflectedRotatedPt = transformPoint(action.startX, action.startY, angle, true, centerX, centerY);
                drawDot(ctx, reflectedRotatedPt.x, reflectedRotatedPt.y);
            } else {
                // For regular shapes, use canvas transformation for reflection + rotation
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.scale(-1, 1); // Reflect across Y-axis
                ctx.rotate(angle);
                ctx.translate(-centerX, -centerY);
                drawShapeDirectly(ctx, action);
                ctx.restore();
            }
        }
    }
}

// Helper function to draw a shape directly without symmetry
function drawShapeDirectly(ctx, action) {
    const { startX: x1, startY: y1, endX: x2, endY: y2, tool } = action;
    const w = x2 - x1;
    const h = y2 - y1;
    
    ctx.beginPath();
    
    switch (tool) {
        case 'line':
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            break;
            
        case 'rectangle':
        case 'filledRect': {
            ctx.rect(x1, y1, w, h);
            if (tool === 'filledRect') ctx.fill();
            else ctx.stroke();
            break;
        }
            
        case 'oval':
        case 'filledOval': {
            // Use ellipse centered within the bounding box
            const rX = Math.abs(w / 2);
            const rY = Math.abs(h / 2);
            const cX = x1 + w / 2; // Center X
            const cY = y1 + h / 2; // Center Y
            
            ctx.ellipse(cX, cY, rX, rY, 0, 0, 2 * Math.PI);
            if (tool === 'filledOval') ctx.fill();
            else ctx.stroke();
            break;
        }
    }
}

// --- Grid/Guide Drawing ---
export function drawGuides(gridCtx, settings, center, canvasSize) {
    if (!gridCtx || !canvasSize) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvasSize.width;
    const logicalHeight = canvasSize.height;

    // Clear previous guides completely
    gridCtx.clearRect(0, 0, gridCtx.canvas.width, gridCtx.canvas.height);

    // Check if guides should be shown
    if (!settings.showGuides) return;

    console.log("Drawing guides: rotation=" + settings.rotationOrder + ", reflection=" + settings.reflectionEnabled);

    const N = settings.rotationOrder;
    const reflect = settings.reflectionEnabled;
    const cx = center.x;
    const cy = center.y;

    // No guides for rotation order 1 without reflection
    if (N <= 0 || (N === 1 && !reflect)) return;

    gridCtx.save();

    // Helper to find intersection with canvas bounds
    const calculateEndPoint = (angle) => {
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        let t = Infinity;
        const epsilon = 1e-9;

        if (Math.abs(cosA) > epsilon) {
            const t_x0 = -cx / cosA;
            const t_xW = (logicalWidth - cx) / cosA;
            if (t_x0 >= -epsilon) t = Math.min(t, t_x0);
            if (t_xW >= -epsilon) t = Math.min(t, t_xW);
        }
        if (Math.abs(sinA) > epsilon) {
            const t_y0 = -cy / sinA;
            const t_yH = (logicalHeight - cy) / sinA;
            if (t_y0 >= -epsilon) t = Math.min(t, t_y0);
            if (t_yH >= -epsilon) t = Math.min(t, t_yH);
        }
        t = (t === Infinity || t < epsilon) ? Math.max(logicalWidth, logicalHeight) * 1.5 : t;
        return { x: cx + t * cosA, y: cy + t * sinA };
    };

    // Get colors from CSS (ensure computed style is accessible)
    const styles = getComputedStyle(document.documentElement);
    const sliceColor = styles.getPropertyValue('--grid-slice-color').trim() || '#adb5bd';
    const reflectColor = styles.getPropertyValue('--grid-reflect-line-color').trim() || '#fd7e14';

    if (reflect) {
        // Draw Dihedral (Dn) reflection lines (solid orange)
        gridCtx.strokeStyle = reflectColor;
        gridCtx.setLineDash([]);
        gridCtx.lineWidth = Math.max(1.5, 1.8 / dpr); // Thicker lines
        const angleIncrement = Math.PI / N;
        for (let i = 0; i < N; i++) {
            const angle = i * angleIncrement;
            const endPoint = calculateEndPoint(angle);
            gridCtx.beginPath();
            gridCtx.moveTo(cx, cy);
            gridCtx.lineTo(endPoint.x, endPoint.y);
            gridCtx.stroke();
        }
    } else {
        // Draw Cyclic (Cn) rotation sector lines (dashed gray)
        if (N > 1) {
            gridCtx.strokeStyle = sliceColor;
            const dash = 6 / dpr; // Longer dash for better visibility
            gridCtx.setLineDash([dash, dash]);
            gridCtx.lineWidth = Math.max(1.2, 1.5 / dpr); // Slightly thicker lines
            const angleIncrement = (2 * Math.PI) / N;
            for (let i = 0; i < N; i++) {
                const angle = i * angleIncrement;
                const endPoint = calculateEndPoint(angle);
                gridCtx.beginPath();
                gridCtx.moveTo(cx, cy);
                gridCtx.lineTo(endPoint.x, endPoint.y);
                gridCtx.stroke();
            }
        }
    }
    
    // Draw center point for better visibility
    gridCtx.setLineDash([]);
    gridCtx.beginPath();
    gridCtx.arc(cx, cy, 3, 0, Math.PI * 2);
    gridCtx.fillStyle = reflectColor;
    gridCtx.fill();
    
    gridCtx.restore();
}