// Initial State Definition
export const initialState = {
    settings: {
        tool: 'freehand',
        lineWidth: 3,
        color: '#007aff', // Default color, will be updated by picker later
        rotationOrder: 1,
        reflectionEnabled: false,
        cursorStyle: 'crosshair',
        showGuides: false,
    },
    actions: [], // Array of completed drawing action objects { tool, color, lineWidth, startX, ... }
    history: [], // Array of canvas data URLs for undo/redo
    historyIndex: -1, // Points to the current state in history array
    triggerDownload: false, // Flag to signal canvas download
    isLoading: false, // Flag to indicate loading state
};

const MAX_HISTORY_SIZE = 50; // Max undo steps

// Reducer Function
export function symmetryReducer(state, action) {
    // console.log("Reducer Action:", action.type, action.payload); // For debugging
    switch (action.type) {
        case 'UPDATE_SETTING': {
            const { setting, value } = action.payload;
            // Special handling for rotation order (ensure it's a number)
            if (setting === 'rotationOrder' || setting === 'lineWidth') {
                 const numValue = parseInt(value, 10);
                 if (!isNaN(numValue)) {
                     return { ...state, settings: { ...state.settings, [setting]: numValue } };
                 }
                 return state; // Ignore if not a valid number
            }
             // Special handling for color (ensure it's a string)
             if (setting === 'color' && typeof value !== 'string') {
                  console.warn("Invalid color value received:", value);
                  return state;
             }
            return { ...state, settings: { ...state.settings, [setting]: value } };
        }

        case 'ADD_ACTION': {
            const newAction = action.payload;
            // Prune future history if undoing
            const nextHistoryIndex = state.historyIndex + 1;
            let nextActions = state.actions.slice(0, nextHistoryIndex);
            nextActions.push(newAction);

            // Limit action history size (sync with canvas history size limit)
             if (nextActions.length > MAX_HISTORY_SIZE) {
                  nextActions.splice(0, nextActions.length - MAX_HISTORY_SIZE);
                  // The historyIndex will be adjusted when UPDATE_HISTORY_STATE runs
             }

            // History (canvas states) is updated separately by `UPDATE_HISTORY_STATE` after drawing
            return {
                ...state,
                actions: nextActions,
                // historyIndex will be updated when history state arrives
            };
        }

         case 'INITIALIZE_HISTORY': {
             const initialDataUrl = action.payload;
             // Only initialize if history is truly empty
             if (state.history.length === 0 && state.historyIndex === -1) {
                return {
                    ...state,
                    history: [initialDataUrl],
                    historyIndex: 0,
                    actions: [], // Ensure actions are also empty on init
                };
             }
             return state; // No change if already initialized
         }


         case 'UPDATE_HISTORY_STATE': {
             const newDataUrl = action.payload;
             // Should always correspond to adding the latest action
             const nextHistoryIndex = state.actions.length - 1; // Index should match the latest action index
             let nextHistory = state.history.slice(0, nextHistoryIndex); // Slice up to where the new state should go
             nextHistory.push(newDataUrl);

             // Limit history size
             if (nextHistory.length > MAX_HISTORY_SIZE) {
                 nextHistory.splice(0, nextHistory.length - MAX_HISTORY_SIZE);
                 // Ensure historyIndex points to the last valid item
                 return {
                     ...state,
                     history: nextHistory,
                     historyIndex: MAX_HISTORY_SIZE - 1,
                 };
             } else {
                 return {
                     ...state,
                     history: nextHistory,
                     historyIndex: nextHistory.length - 1, // Point to the newly added state
                 };
             }
         }


        case 'UNDO': {
            if (state.historyIndex <= 0) return state; // Cannot undo initial state
            return {
                ...state,
                historyIndex: state.historyIndex - 1,
            };
        }

        case 'REDO': {
            // Can redo if historyIndex is less than the last index of *committed actions*
            if (state.historyIndex >= state.actions.length - 1 || state.historyIndex >= state.history.length - 1) {
                 return state; // Cannot redo further
            }
            return {
                ...state,
                historyIndex: state.historyIndex + 1,
            };
        }

        case 'CLEAR': {
            return {
                ...initialState, // Reset almost everything
                settings: { // Keep some settings like theme, potentially cursor/guides choice
                    ...initialState.settings,
                    color: state.settings.color, // Keep current color maybe? Or reset? Let's keep.
                    showGuides: state.settings.showGuides,
                    cursorStyle: state.settings.cursorStyle,
                },
                history: [], // History will be repopulated with initial clear state by canvas
                historyIndex: -1,
            };
        }

        case 'LOAD_STATE_START': {
            return { ...state, isLoading: true };
        }

        case 'LOAD_STATE_SUCCESS': {
            const { settings, actions } = action.payload;
             // Filter potentially invalid actions during load
            const validActions = actions.filter(a => a && typeof a === 'object' && a.tool);

            return {
                ...state,
                settings: { ...state.settings, ...settings }, // Merge, keeping potentially unsaved ones like cursor
                actions: validActions, // Use the loaded (and potentially filtered) actions
                history: [], // History will be rebuilt by canvas redraw after load
                historyIndex: -1, // Will be set after first redraw+state save
                isLoading: false,
            };
        }
        case 'LOAD_STATE_ERROR': {
             return { ...state, isLoading: false }; // Reset loading flag on error
        }


        case 'TRIGGER_DOWNLOAD':
            return { ...state, triggerDownload: true };

        case 'RESET_DOWNLOAD_TRIGGER':
            return { ...state, triggerDownload: false };

        default:
             console.warn("Unhandled reducer action type:", action.type);
            return state;
    }
}