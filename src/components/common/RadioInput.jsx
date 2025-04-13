import React from 'react';
import styles from './Input.module.css'; // Shared CSS module for inputs

function RadioInput({ name, value, label, checked, onChange, id }) {
    const inputId = id || `${name}-${value}`;
    return (
        <label htmlFor={inputId} className={`${styles.label} ${checked ? styles.selected : ''}`}>
            <input
                type="radio"
                id={inputId}
                name={name}
                value={value}
                checked={checked}
                onChange={onChange}
                className={styles.hiddenInput} // Hide default radio
            />
            <span className={styles.customRadio}></span>
            <span>{label}</span>
        </label>
    );
}

export default RadioInput;