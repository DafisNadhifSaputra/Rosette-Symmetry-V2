import React, { useEffect, useRef, useState, useMemo } from 'react';
import iro from '@jaames/iro';
import styles from './ColorPicker.module.css';
import { throttle, debounce } from 'lodash'; // Import throttle and debounce

function ColorPicker({ initialColor, onChange, theme }) {
    const pickerRef = useRef(null); // Ref for the container element
    const iroPickerRef = useRef(null); // Ref for the iro.js instance
    const [pickerWidth, setPickerWidth] = useState(180); // Start with a minimum reasonable width

    // Debounced width update function
    const updatePickerWidth = useMemo(() => debounce((containerElement) => {
        if (containerElement) {
            const containerWidth = containerElement.clientWidth;
            if (containerWidth > 0) {
                const newWidth = Math.max(160, Math.min(280, containerWidth > 40 ? containerWidth - 10 : 180));
                // Only update state if the width actually changes
                setPickerWidth(prevWidth => {
                    if (newWidth !== prevWidth) {
                        // console.log("Updating picker width:", newWidth); // For debugging
                        return newWidth;
                    }
                    return prevWidth;
                });
            }
        }
    }, 150), []); // Debounce resize checks

    // Effect to observe container size changes
    useEffect(() => {
        const containerElement = pickerRef.current;
        if (!containerElement) return;

        // Initial width calculation
        updatePickerWidth(containerElement);

        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                if (entry.target === containerElement) {
                    updatePickerWidth(containerElement);
                }
            }
        });

        resizeObserver.observe(containerElement);

        return () => {
            resizeObserver.disconnect();
            updatePickerWidth.cancel(); // Cancel any pending debounced calls
        };
    }, [updatePickerWidth]); // Rerun if updatePickerWidth changes (it shouldn't)


    // Throttled onChange handler
    const throttledOnChange = useMemo(
        () => throttle((colorHexString) => {
            onChange(colorHexString);
        }, 100, { leading: true, trailing: true }), // Throttle to max 1 update per 100ms, ensure leading/trailing calls
        [onChange] // Recreate if onChange prop changes
    );

    // Initialize or update iro.js instance
    useEffect(() => {
        if (pickerRef.current && pickerWidth > 0) {
            const initialBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--picker-border-color').trim();

            if (!iroPickerRef.current) {
                // Initialize
                try {
                    iroPickerRef.current = new iro.ColorPicker(pickerRef.current, {
                        width: pickerWidth,
                        color: initialColor || '#007aff', // Fallback initial color
                        borderWidth: 1,
                        borderColor: initialBorderColor,
                        layout: [
                            { component: iro.ui.Box, options: { boxLightness: false } },
                            { component: iro.ui.Slider, options: { sliderType: 'hue' } }
                        ],
                        handleRadius: 8, // Increased handle radius
                        padding: 5,
                        sliderMargin: 12,
                        sliderSize: 18,
                    });

                    // Attach the throttled change listener
                    iroPickerRef.current.on('color:change', (color) => {
                        throttledOnChange(color.hexString); // Use throttled handler
                    });

                    // Also call immediately on interaction end for final value
                    iroPickerRef.current.on('input:end', (color) => {
                        throttledOnChange.cancel(); // Cancel any pending throttled calls
                        onChange(color.hexString); // Send final value immediately
                    });

                } catch (error) {
                    console.error("Gagal menginisialisasi color picker:", error);
                    if (pickerRef.current) {
                         pickerRef.current.innerHTML = '<p class="error-message">Pemilih warna gagal dimuat.</p>'; // Basic error display
                    }
                }
            } else {
                 // Instance exists, try resizing if width changed
                 try {
                     iroPickerRef.current.resize(pickerWidth);
                 } catch(e) {
                     console.error("Error resizing color picker:", e);
                 }
            }
        }

        // Cleanup listeners on unmount
        return () => {
            if (iroPickerRef.current) {
                // Detach listeners when effect cleans up or re-runs before destroying
                iroPickerRef.current.off('color:change');
                iroPickerRef.current.off('input:end');
                throttledOnChange.cancel();
            }
        };
        // Re-run if initialColor, onChange, or pickerWidth changes
    }, [initialColor, onChange, pickerWidth, throttledOnChange]);

    // Effect to update picker color if prop changes externally (e.g., load file)
    useEffect(() => {
        if (iroPickerRef.current && initialColor && iroPickerRef.current.color.hexString !== initialColor) {
            try {
                 iroPickerRef.current.color.hexString = initialColor;
            } catch (e) {
                 console.error("Error setting color picker color:", e);
            }
        }
    }, [initialColor]);

     // Effect to update picker border color on theme change
     useEffect(() => {
         if (iroPickerRef.current) {
             const timer = setTimeout(() => {
                 const newBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--picker-border-color').trim();
                 // Update border color via CSS variable override if possible
                 if (pickerRef.current) {
                     pickerRef.current.style.setProperty('--iro-picker-border-color', newBorderColor);
                 }
             }, 50);
             return () => clearTimeout(timer);
         }
     }, [theme]);

    // Cleanup iro instance fully on unmount
    useEffect(() => {
        // Capture the ref value for the cleanup function
        const currentPickerRef = pickerRef.current;
        const currentIroInstance = iroPickerRef.current;

        return () => {
            if (currentIroInstance) {
                // Listeners should already be off from the main effect's cleanup
                // iro.js doesn't have a destroy method, clear the container
                if (currentPickerRef) {
                    currentPickerRef.innerHTML = '';
                }
                iroPickerRef.current = null; // Clear the ref
            }
        };
    }, []); // Empty dependency array ensures this runs only on unmount


    return (
         <div className={styles.colorPickerContainer}>
            {/* The ref is attached here, iro.js will populate it */}
            <div ref={pickerRef} className={styles.iroColorPicker}></div>
        </div>
    );
}

export default ColorPicker;
