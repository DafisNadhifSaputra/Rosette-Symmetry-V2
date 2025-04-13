import React from 'react';
import styles from './ControlGroup.module.css';

function ControlGroup({ legend, children, legendStyle = 'default' }) {
    const legendClass = legendStyle === 'toolbar' ? styles.toolbarLegend : styles.panelLegend;
    return (
        <fieldset className={styles.controlGroup}>
            {legend && <legend className={legendClass}>{legend}</legend>}
            <div className={styles.controlsContent}>
                {children}
            </div>
        </fieldset>
    );
}

export default ControlGroup;