import React from 'react';
import styles from './Button.module.css';

function Button({
    children,
    onClick,
    title,
    variant = 'secondary', // 'danger', 'success', 'info', 'secondary'
    disabled = false,
    type = 'button',
    className = '',
    ...props
}) {
    const variantClass = styles[`btnOutline${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || styles.btnOutlineSecondary;

    return (
        <button
            type={type}
            className={`${styles.btn} ${variantClass} ${className}`}
            onClick={onClick}
            title={title}
            disabled={disabled}
            {...props}
        >
            {children}
        </button>
    );
}

export default Button;