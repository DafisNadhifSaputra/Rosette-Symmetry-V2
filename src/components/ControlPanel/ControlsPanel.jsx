import React, { useCallback } from 'react';
import styles from './ControlPanel.module.css';
import ControlGroup from '../common/ControlGroup';
import RadioInput from '../common/RadioInput';
import CheckboxInput from '../common/CheckboxInput';
import ColorPicker from '../ColorPicker/ColorPicker'; // Import the standalone ColorPicker

function ControlsPanel({ settings, onSettingChange, theme }) {
    const handleOrderChange = useCallback((e) => {
        onSettingChange('rotationOrder', e.target.value);
    }, [onSettingChange]);

    const handleReflectionChange = useCallback((e) => {
        onSettingChange('reflectionEnabled', e.target.checked);
    }, [onSettingChange]);

    const handleColorChange = useCallback((newColor) => {
        onSettingChange('color', newColor);
    }, [onSettingChange]);

    // Create options for rotation order (1-24)
    const rotationOptions = Array.from({ length: 24 }, (_, i) => i + 1);

    return (
        <div className={styles.controlsPanel}>
            <ControlGroup legend="Tipe Simetri" className={styles.symmetryGroup}>
                <div className={styles.horizontalControls}>
                    <CheckboxInput
                        name="reflection"
                        label="Aktifkan Refleksi (Dihedral)"
                        checked={settings.reflectionEnabled}
                        onChange={handleReflectionChange}
                    />
                </div>
            </ControlGroup>

            <ControlGroup legend="Urutan Rotasi (n)" className={styles.rotationGroup}>
                <div className={styles.rotationsList}>
                    {rotationOptions.map((num) => (
                        <RadioInput
                            key={`rotation-${num}`}
                            name="rotation"
                            value={num}
                            label={num.toString()}
                            checked={settings.rotationOrder === num}
                            onChange={handleOrderChange}
                        />
                    ))}
                </div>
            </ControlGroup>

            <ControlGroup legend="Warna" className={styles.colorGroup}>
                <ColorPicker
                    initialColor={settings.color}
                    onChange={handleColorChange}
                    theme={theme}
                />
            </ControlGroup>
        </div>
    );
}

export default ControlsPanel;