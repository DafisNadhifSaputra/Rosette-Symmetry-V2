import React from 'react';
import styles from './Input.module.css'; // Shared CSS module for inputs

function CheckboxInput({ name, label, checked, onChange, id }) {
    const inputId = id || name;
    return (
        <label htmlFor={inputId} className={`${styles.label} ${checked ? styles.selected : ''}`}>
            <input
                type="checkbox"
                id={inputId}
                name={name}
                checked={checked}
                onChange={onChange}
                className={styles.hiddenInput} // Hide default checkbox
            />
            <span className={styles.customCheckbox}></span>
            <span>{label}</span>
        </label>
    );
}

export default CheckboxInput;