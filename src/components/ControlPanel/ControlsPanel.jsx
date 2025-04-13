import React from 'react';
import styles from './ControlPanel.module.css'; // Corrected filename
import ControlGroup from '../common/ControlGroup';
import CheckboxInput from '../common/CheckboxInput';
import RadioInput from '../common/RadioInput';
import ColorPicker from '../ColorPicker/ColorPicker'; // Import the ColorPicker

const rotationOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 20, 24];

function ControlsPanel({ settings, onSettingChange, theme }) {

    const handleCheckboxChange = (e) => {
        onSettingChange(e.target.name, e.target.checked);
    };

    const handleRadioChange = (e) => {
        onSettingChange(e.target.name, e.target.value);
    };

    const handleColorChange = (newColor) => {
        onSettingChange('color', newColor);
    };

    const getRotationLabel = (n) => {
        const prefix = settings.reflectionEnabled ? 'D' : 'C';
        // Use dangerouslySetInnerHTML for subscript (use with caution, ensure input is safe)
        // Or use CSS for subscripting if preferred
        return <span dangerouslySetInnerHTML={{ __html: `${n} (${prefix}<sub>${n}</sub>)` }} />;
    };


    return (
        <div className={styles.controlsPanel}>
            {/* New container for horizontal layout */}
            <div className={styles.horizontalControls}>
                 <ControlGroup legend="Tipe Simetri" className={styles.symmetryGroup}>
                      <CheckboxInput
                          name="reflectionEnabled"
                          label="Aktifkan Refleksi (Dn)"
                          checked={settings.reflectionEnabled}
                          onChange={handleCheckboxChange}
                          id="reflectionToggle" // Match original ID if needed elsewhere
                      />
                 </ControlGroup>

                 <ControlGroup legend="Rotasi (n)" className={styles.rotationGroup}>
                     <div className={styles.rotationsList}>
                         {rotationOptions.map(n => (
                             <RadioInput
                                 key={n}
                                 name="rotationOrder"
                                 value={n.toString()} // Value should be string for input
                                 label={getRotationLabel(n)}
                                 checked={settings.rotationOrder === n}
                                 onChange={handleRadioChange}
                             />
                         ))}
                     </div>
                 </ControlGroup>

                 <ControlGroup legend="Warna" className={`${styles.colorPickerGroup} ${styles.colorGroup}`}>
                       <ColorPicker
                           initialColor={settings.color}
                           onChange={handleColorChange}
                           theme={theme} // Pass theme for border styling
                        />
                  </ControlGroup>
            </div>
        </div>
    );
}

export default ControlsPanel;