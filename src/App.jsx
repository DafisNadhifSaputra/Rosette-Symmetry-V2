import React, { useState, useEffect, useReducer, useCallback } from 'react';
import Header from './components/Header/Header';
import DrawingCanvas from './components/DrawingCanvas/DrawingCanvas';
import DrawingToolbar from './components/DrawingToolbar/DrawingToolbar';
import ControlsPanel from './components/ControlPanel/ControlsPanel'; // Corrected path
import CanvasFooter from './components/CanvasFooter/CanvasFooter';
import InfoModal from './components/InfoModal/InfoModal';
import styles from './App.module.css';
import { symmetryReducer, initialState } from './reducers/symmetryReducer';
import { saveAs } from 'file-saver';

function App() {
    const [state, dispatch] = useReducer(symmetryReducer, initialState);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [theme, setTheme] = useState('light');
    // State for the drawing currently in progress (preview)
    const [previewAction, setPreviewAction] = useState(null);

    // --- Theme Handling ---
    useEffect(() => {
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
        setTheme(initialTheme);
        // Update initial color setting based on theme *after* theme is set
         const rootStyle = getComputedStyle(document.documentElement);
         const initialColor = rootStyle.getPropertyValue('--primary-color').trim() || initialState.settings.color;
         dispatch({ type: 'UPDATE_SETTING', payload: { setting: 'color', value: initialColor } });

    }, []); // Run only once on mount

    useEffect(() => {
        document.body.classList.toggle('dark-mode', theme === 'dark');
        localStorage.setItem('theme', theme);
        // Update primary color based on theme change for new drawings
        const rootStyle = getComputedStyle(document.documentElement);
        const themeColor = rootStyle.getPropertyValue('--primary-color').trim();
        if (themeColor && themeColor !== state.settings.color) {
             // Only update if the color actually changes with the theme
             // This prevents overriding user selection just by toggling theme
             // console.log("Theme changed, updating potentially stale default color");
              // dispatch({ type: 'UPDATE_SETTING', payload: { setting: 'color', value: themeColor } });
              // Decided against this - keep user selected color unless they reset
         }
     }, [theme, state.settings.color]); // Added state.settings.color dependency

     const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // --- Modal Handling ---
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => setIsModalOpen(false);

    // --- Setting Changes ---
    const handleSettingChange = useCallback((setting, value) => {
        dispatch({ type: 'UPDATE_SETTING', payload: { setting, value } });
    }, []);

    // --- Drawing Actions ---
    const handleDrawStart = useCallback(() => {
        setPreviewAction(null); // Clear previous preview
    }, []);

    const handleDrawMove = useCallback((actionInProgress) => {
        setPreviewAction(actionInProgress);
    }, []);

    const handleDrawEnd = useCallback((completedAction) => {
        setPreviewAction(null); // Clear preview regardless of outcome
        if (completedAction) {
            // Action is added to state via reducer
            dispatch({ type: 'ADD_ACTION', payload: completedAction });
            // The DrawingCanvas will call onStateUpdate after drawing it
        }
    }, []);

    // --- Canvas State Management ---
    const handleCanvasReady = useCallback((initialDataUrl) => {
        // Called by DrawingCanvas when it's initially ready or cleared
        // Initialize history only if it's truly empty
        if (state.history.length === 0 && state.historyIndex === -1) {
            dispatch({ type: 'INITIALIZE_HISTORY', payload: initialDataUrl });
        }
    }, [state.history.length, state.historyIndex]); // Dependencies needed


    const handleStateUpdate = useCallback((newStateDataUrl) => {
         // Called by DrawingCanvas *after* a new action is fully drawn and committed
         // Update the history array in the reducer
         dispatch({ type: 'UPDATE_HISTORY_STATE', payload: newStateDataUrl });
    }, []);


    // --- Button Actions ---
    const handleUndo = useCallback(() => dispatch({ type: 'UNDO' }), []);
    const handleRedo = useCallback(() => dispatch({ type: 'REDO' }), []);
    const handleClear = useCallback(() => {
        if (window.confirm("Apakah Anda yakin ingin membersihkan seluruh gambar?\nTindakan ini tidak dapat diurungkan setelah dikosongkan.")) {
            dispatch({ type: 'CLEAR' });
            setPreviewAction(null); // Ensure preview is cleared if active during clear
        }
    }, []);
    const toggleGuides = useCallback((isChecked) => {
        dispatch({ type: 'UPDATE_SETTING', payload: { setting: 'showGuides', value: isChecked } });
    }, []);

    // --- Save/Load/Download ---
    const handleSaveJson = useCallback(() => {
        const dataToSave = {
            version: "react-1.0",
            // Save current settings and committed actions
            settings: state.settings,
            actions: state.actions.slice(0, state.historyIndex + 1),
        };
        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
        const t = new Date().toISOString().replace(/[:.]/g, '-');
        const s = state.settings.reflectionEnabled ? 'D' : 'C';
        saveAs(blob, `roset_${s}${state.settings.rotationOrder}_${t}.json`);
    }, [state.settings, state.actions, state.historyIndex]); // Depend on relevant state


    const handleLoadJson = useCallback((event) => {
        const file = event.target.files?.[0];
        if (!file || !file.type.match('application/json')) {
            if (file) alert("Silakan pilih file JSON yang valid (.json)."); // Alert only if a file was selected
            // No need to reset input value here, CanvasFooter handles it
            return;
        }
        dispatch({ type: 'LOAD_STATE_START' }); // Indicate loading
        setPreviewAction(null); // Clear preview during load

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const loadedData = JSON.parse(e.target.result);
                // Basic validation
                if (!loadedData || typeof loadedData.settings !== 'object' || !Array.isArray(loadedData.actions)) {
                    throw new Error("Format file JSON Roset tidak valid atau korup.");
                }
                // Further validation can be added here (e.g., check action structure)

                dispatch({ type: 'LOAD_STATE_SUCCESS', payload: loadedData });
                 // Canvas will redraw based on the new state passed via props
                alert(`Berhasil memuat data dari "${file.name}".`);
            } catch (err) {
                console.error("Load JSON error:", err);
                alert(`Gagal memuat file "${file.name}":\n${err.message}`);
                dispatch({ type: 'LOAD_STATE_ERROR' });
                dispatch({ type: 'CLEAR' }); // Reset state on critical error
            }
        };
        reader.onerror = () => {
            alert("Gagal membaca file.");
             dispatch({ type: 'LOAD_STATE_ERROR' });
        };
        reader.readAsText(file);
    }, []); // No dependencies needed as it reads from event


    const triggerDownloadImage = useCallback(() => {
        dispatch({ type: 'TRIGGER_DOWNLOAD' });
        // Reset the trigger after a short delay to allow canvas effect to run
        setTimeout(() => dispatch({ type: 'RESET_DOWNLOAD_TRIGGER' }), 100);
    }, []);

    // --- Keyboard Shortcuts ---
     useEffect(() => {
         const handleKeyDown = (e) => {
             // Ignore if typing in an input, or modal is open
             if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable || isModalOpen) {
                 return;
             }

             const isCtrl = e.ctrlKey || e.metaKey; // Meta for Mac

             if (isCtrl && e.key.toLowerCase() === 'z') {
                 e.preventDefault();
                 handleUndo();
             } else if (isCtrl && e.key.toLowerCase() === 'y') {
                 e.preventDefault();
                 handleRedo();
             } else if (isCtrl && e.key.toLowerCase() === 's') {
                 e.preventDefault();
                 handleSaveJson();
             } else if (isCtrl && e.key.toLowerCase() === 'o') {
                 e.preventDefault();
                 // Trigger the hidden file input in CanvasFooter
                 // This requires finding the input, maybe via ref passed up, or simulating click on the button
                 document.querySelector('input[type="file"][style*="display: none"]')?.click();
             } else if (e.key === 'Escape' && isModalOpen) {
                 // Modal escape handled in InfoModal component
             }
             // Add more shortcuts if needed (e.g., clear, tool selection)
         };

         window.addEventListener('keydown', handleKeyDown);
         return () => window.removeEventListener('keydown', handleKeyDown);
     }, [isModalOpen, handleUndo, handleRedo, handleSaveJson]); // Dependencies


    return (
        <div className={styles.appContainer}>
            <Header onInfoClick={openModal} />

            <div className={styles.mainLayout}>
                {/* Left Column: Canvas, Toolbar, Footer */}
                <div className={styles.leftColumn}>
                    <DrawingCanvas
                        settings={state.settings}
                        actions={state.actions}
                        historyIndex={state.historyIndex}
                        previewAction={previewAction}
                        onDrawStart={handleDrawStart}
                        onDrawMove={handleDrawMove}
                        onDrawEnd={handleDrawEnd}
                        onCanvasReady={handleCanvasReady}
                        onStateUpdate={handleStateUpdate}
                        triggerDownload={state.triggerDownload}
                        theme={theme}
                        isLoading={state.isLoading} // Pass loading state
                    />
                    <DrawingToolbar
                        settings={state.settings}
                        onSettingChange={handleSettingChange}
                    />
                    <CanvasFooter
                        canUndo={state.historyIndex > 0} // Can undo if not at the initial state
                        canRedo={state.historyIndex < state.actions.length - 1} // Can redo if not at the latest action
                        canClear={state.actions.length > 0} // Can clear if there are any actions
                        showGuides={state.settings.showGuides}
                        theme={theme}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onClear={handleClear}
                        onToggleGuides={toggleGuides}
                        onSave={handleSaveJson}
                        onLoad={handleLoadJson}
                        onDownload={triggerDownloadImage}
                        onToggleTheme={toggleTheme}
                    />
                </div>

                {/* Right Column: Symmetry Controls */}
                <div className={`${styles.rightColumn} ${styles.controlsPanel}`}>
                     <ControlsPanel
                        settings={state.settings}
                        onSettingChange={handleSettingChange}
                        theme={theme}
                    />
                </div>
            </div>

            <InfoModal isOpen={isModalOpen} onClose={closeModal} />
        </div>
    );
}

export default App;