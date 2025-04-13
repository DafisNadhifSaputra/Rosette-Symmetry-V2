import React from 'react';
import styles from './DrawingToolbar.module.css';
import ControlGroup from '../common/ControlGroup';
import RadioInput from '../common/RadioInput';
import inputStyles from '../common/Input.module.css'; // For toolbar specific label style

const tools = [
    { value: 'freehand', label: 'Goresan' },
    { value: 'line', label: 'Garis' },
    { value: 'rectangle', label: 'Persegi' },
    { value: 'oval', label: 'Oval' },
    { value: 'filledRect', label: 'Persegi Isi' },
    { value: 'filledOval', label: 'Oval Isi' },
];

const lineWidths = [1, 2, 3, 5, 8, 13, 21];

const cursorStyles = [
    { value: 'crosshair', label: 'Crosshair' },
    { value: 'pencil', label: 'Pensil' },
    { value: 'default', label: 'Default' },
];

function DrawingToolbar({ settings, onSettingChange }) {
    const handleRadioChange = (e) => {
        onSettingChange(e.target.name, e.target.value);
    };

    return (
        <div className={styles.drawingToolsBar}>
             <ControlGroup legend="Alat" legendStyle="toolbar">
                 {tools.map(tool => (
                     <RadioInput
                         key={tool.value}
                         name="tool"
                         value={tool.value}
                         label={tool.label}
                         checked={settings.tool === tool.value}
                         onChange={handleRadioChange}
                         // Add toolbar-specific class to the label via the RadioInput component if needed
                         // Or apply styles globally via .drawingToolsBar .label in CSS
                         className={inputStyles.toolbarLabel} // Pass class to label if component supports it
                     />
                 ))}
             </ControlGroup>

             <ControlGroup legend="Lebar Garis" legendStyle="toolbar">
                 {lineWidths.map(width => (
                      <RadioInput
                         key={width}
                         name="lineWidth"
                         value={width.toString()}
                         label={`${width} px`}
                         checked={settings.lineWidth === width}
                         onChange={handleRadioChange}
                         className={inputStyles.toolbarLabel}
                     />
                 ))}
             </ControlGroup>

             <ControlGroup legend="Gaya Kursor" legendStyle="toolbar">
                 {cursorStyles.map(cursor => (
                      <RadioInput
                         key={cursor.value}
                         name="cursorStyle"
                         value={cursor.value}
                         label={cursor.label}
                         checked={settings.cursorStyle === cursor.value}
                         onChange={handleRadioChange}
                         className={inputStyles.toolbarLabel}
                     />
                 ))}
             </ControlGroup>
        </div>
    );
}

export default DrawingToolbar;