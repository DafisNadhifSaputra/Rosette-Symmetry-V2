import React, { useEffect, useRef, useState } from 'react';
import iro from '@jaames/iro';
import styles from './ColorPicker.module.css';

function ColorPicker({ initialColor, onChange, theme }) {
    const pickerRef = useRef(null); // Ref for the container element
    const iroPickerRef = useRef(null); // Ref for the iro.js instance
    const [pickerWidth, setPickerWidth] = useState(260); // Default/max width

    // Calculate picker width based on container
    useEffect(() => {
        if (pickerRef.current) {
            const containerWidth = pickerRef.current.clientWidth;
            // Ensure container has a width before calculating
            if (containerWidth > 0) {
                 // Adjust max width based on container, with a minimum
                 const newWidth = Math.max(160, Math.min(280, containerWidth > 40 ? containerWidth - 10 : 180));
                 setPickerWidth(newWidth);
            }
        }
    }, []); // Run once on mount, maybe also on resize if needed

    // Initialize iro.js
    useEffect(() => {
        if (pickerRef.current && !iroPickerRef.current && pickerWidth > 0) {
            const initialBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--picker-border-color').trim();
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
                    handleRadius: 7,
                    padding: 5,
                    sliderMargin: 12,
                    sliderSize: 18,
                });

                // Attach the change listener
                iroPickerRef.current.on('color:change', (color) => {
                    onChange(color.hexString); // Pass hex string up
                });

            } catch (error) {
                console.error("Gagal menginisialisasi color picker:", error);
                 pickerRef.current.innerHTML = '<p class="error-message">Pemilih warna gagal dimuat.</p>'; // Basic error display
            }
        }

        // Capture the ref value for the cleanup function
        const currentPickerRef = pickerRef.current;

        // Cleanup function to destroy the picker on unmount
        return () => {
            if (iroPickerRef.current) {
                // iro.js doesn't have a built-in destroy method,
                // removing listeners and clearing container is usually enough
                iroPickerRef.current.off('color:change'); // Remove listener
                if (currentPickerRef) {
                    currentPickerRef.innerHTML = ''; // Clear container using the captured ref value
                }
                iroPickerRef.current = null;
            }
        };
    }, [initialColor, onChange, pickerWidth]); // Re-run if initialColor or callback changes, or width calculated

    // Effect to update picker color if prop changes externally (e.g., load file)
    useEffect(() => {
        if (iroPickerRef.current && iroPickerRef.current.color.hexString !== initialColor) {
             // Check if color actually changed to prevent loops
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
              // Use setTimeout to ensure CSS variables have updated
             const timer = setTimeout(() => {
                 const newBorderColor = getComputedStyle(document.documentElement).getPropertyValue('--picker-border-color').trim();
                 // iro.js v5 doesn't directly support updating borderColor via setOptions.
                 // We might need to reconstruct or manually style if this is critical.
                 // For now, we'll log it. In a real app, might need a workaround.
                 // console.log("Theme changed, picker border should be:", newBorderColor);
                 // A potential workaround (if CSS overrides work):
                 if (pickerRef.current) {
                     pickerRef.current.style.setProperty('--iro-picker-border-color', newBorderColor);
                     // Need corresponding CSS using this variable on the picker elements.
                 }
             }, 50);
             return () => clearTimeout(timer);
         }
     }, [theme]);

     // Effect to resize picker if width changes
     useEffect(() => {
         if (iroPickerRef.current && pickerWidth > 0) {
            try {
                iroPickerRef.current.resize(pickerWidth);
            } catch(e) {
                console.error("Error resizing color picker:", e);
            }
         }
     }, [pickerWidth]);


    return (
         <div className={styles.colorPickerContainer}>
            {/* The ref is attached here, iro.js will populate it */}
            <div ref={pickerRef} className={styles.iroColorPicker}></div>
        </div>
    );
}

export default ColorPicker;