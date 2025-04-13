import React from 'react';
import styles from './Header.module.css';

function Header({ onInfoClick }) {
    return (
        <header className={styles.header}>
            <h1>Simetri Roset</h1>
            <h2>(Grup Rotasi dan Dihedral)</h2>
            <div className={styles.infoLink}>
                 (<button onClick={onInfoClick} type="button">Klik di sini</button> untuk info & instruksi.)
            </div>
        </header>
    );
}

export default Header;