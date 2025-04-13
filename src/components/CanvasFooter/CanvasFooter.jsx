import React, { useRef } from 'react';
import styles from './CanvasFooter.module.css';
import Button from '../common/Button'; // Use the reusable button

function CanvasFooter({
    canUndo, canRedo, canClear, showGuides, theme,
    onUndo, onRedo, onClear, onToggleGuides,
    onSave, onLoad, onDownload, onToggleTheme
}) {
    const fileInputRef = useRef(null);

    const handleLoadClick = () => {
        fileInputRef.current?.click(); // Trigger hidden file input
    };

    const handleFileChange = (event) => {
        if (event.target.files && event.target.files.length > 0) {
            onLoad(event); // Pass the event object to the App handler
        }
        // Reset input value to allow loading the same file again
        if (fileInputRef.current) {
             fileInputRef.current.value = null;
        }
    };

    const handleGuidesChange = (event) => {
        onToggleGuides(event.target.checked);
    };

    return (
        <footer className={styles.canvasFooterControls}>
            <Button onClick={onUndo} disabled={!canUndo} title="Urungkan (Ctrl+Z)">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <path fillRule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2z"/> <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466"/> </svg>
                <span>Urungkan</span>
            </Button>
            <Button onClick={onRedo} disabled={!canRedo} title="Ulangi (Ctrl+Y)">
                 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/> <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/> </svg>
                <span>Ulangi</span>
            </Button>
            <Button onClick={onClear} disabled={!canClear} variant="danger" title="Bersihkan Kanvas">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <path d="M6.5 1h3a.5.5 0 0 1 .5.5v1H6v-1a.5.5 0 0 1 .5-.5M11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3A1.5 1.5 0 0 0 5 1.5v1H1.5a.5.5 0 0 0 0 1h.538l.853 10.66A2 2 0 0 0 4.885 16h6.23a2 2 0 0 0 1.994-1.84l.853-10.66h.538a.5.5 0 0 0 0-1zm-2.45 7.45c-.327.327-.86.327-1.187 0l-.02-.02-.02-.02c-.327-.327-.327-.86 0-1.187l.02-.02.02-.02c.327-.327.86-.327 1.187 0l.02.02.02.02c.327.327.327.86 0 1.187l-.02.02-.02.02zm2.235 0c-.327.327-.86.327-1.187 0l-.02-.02-.02-.02c-.327-.327-.327-.86 0-1.187l.02-.02.02-.02c.327-.327.86-.327 1.187 0l.02.02.02.02c.327.327.327.86 0 1.187l-.02.02-.02.02zm-4.61 0c-.327.327-.86.327-1.187 0l-.02-.02-.02-.02c-.327-.327-.327-.86 0-1.187l.02-.02.02-.02c.327-.327.86-.327 1.187 0l.02.02.02.02c.327.327.327.86 0 1.187l-.02.02-.02.02z"/> </svg>
                <span>Bersihkan</span>
            </Button>

            <label title="Tampilkan garis panduan rotasi/refleksi" className={styles.toggleLabel}>
                 <input
                     type="checkbox"
                     checked={showGuides}
                     onChange={handleGuidesChange}
                     className={styles.checkboxInput}
                 />
                 <span>Tampilkan Panduan</span>
             </label>

             <Button onClick={onSave} variant="success" title="Simpan data gambar sebagai JSON">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v4.5h2a.5.5 0 0 1 .354.854l-2.5 2.5a.5.5 0 0 1-.708 0l-2.5-2.5A.5.5 0 0 1 5.5 6.5h2V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1z"/> </svg>
                <span>Simpan</span>
             </Button>

             <Button onClick={handleLoadClick} title="Muat data gambar dari JSON">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.746 1.972 1.664l.122.516a.5.5 0 0 1-.972.23l-.122-.516A1.5 1.5 0 0 0 4.264 3H2.5a.5.5 0 0 0-.5.5v1a.5.5 0 0 0 .5.5h10.97l-1.71 6.837A1.5 1.5 0 0 1 10.26 13H1.5v-1a.5.5 0 0 0-.5-.5V3.5zM.5 5a.5.5 0 0 0 0 1h15a.5.5 0 0 0 0-1zM11.76 4a.5.5 0 0 0-.488.607l1.71 6.837a.5.5 0 0 0 .488.393H15.5a.5.5 0 0 0 .5-.5V5a.5.5 0 0 0-.5-.5z"/> </svg>
                <span>Muat...</span>
             </Button>
             <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                onChange={handleFileChange}
                style={{ display: 'none' }} // Keep hidden
                aria-hidden="true"
             />

            <Button onClick={onDownload} variant="info" title="Unduh gambar sebagai PNG">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"> <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0"/> <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1z"/> </svg>
                <span>Gambar</span>
             </Button>

             <Button
                 onClick={onToggleTheme}
                 title="Ganti Mode Terang/Gelap"
                 className={styles.darkModeToggle} // Use specific class from button module
             >
                 <svg className="icon-sun" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 0zm0 13a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-1 0v-2A.5.5 0 0 1 8 13zm8-5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1 0-1h2A.5.5 0 0 1 3 8zm10.657-5.657a.5.5 0 0 1 0 .707l-1.414 1.415a.5.5 0 1 1-.707-.708l1.414-1.414a.5.5 0 0 1 .707 0zm-9.193 9.193a.5.5 0 0 1 0 .707L3.05 13.657a.5.5 0 0 1-.707-.707l1.414-1.414a.5.5 0 0 1 .707 0zm9.193 0a.5.5 0 0 1-.707.707l-1.414-1.414a.5.5 0 0 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .707zM4.464 3.05a.5.5 0 0 1-.707.707L2.343 2.343a.5.5 0 1 1 .707-.707l1.414 1.414a.5.5 0 0 1 0 .708z"/></svg>
                 <svg className="icon-moon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278zM4.858 1.311A7.269 7.269 0 0 0 1.025 7.71c0 4.021 3.278 7.277 7.318 7.277a7.316 7.316 0 0 0 5.205-2.162c-.337.042-.68.063-1.029.063-4.61 0-8.343-3.714-8.343-8.29 0-1.167.242-2.278.681-3.286z"/></svg>
                 <span className="toggle-text">{theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
             </Button>
        </footer>
    );
}

export default CanvasFooter;