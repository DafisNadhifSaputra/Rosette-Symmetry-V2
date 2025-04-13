import React, { useEffect, useRef } from 'react';
import styles from './InfoModal.module.css';

function InfoModal({ isOpen, onClose }) {
    const modalRef = useRef(null);
    const closeButtonRef = useRef(null);

    // Handle Escape key press
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    // Focus close button when modal opens
    useEffect(() => {
        if (isOpen && closeButtonRef.current) {
            // Timeout helps ensure the element is visible and focusable after animation
            const timer = setTimeout(() => {
                closeButtonRef.current.focus();
            }, 50); // Adjust delay if needed
            return () => clearTimeout(timer);
        }
    }, [isOpen]);


    // Handle clicking outside the modal content
    const handleOverlayClick = (event) => {
        if (modalRef.current && event.target === modalRef.current) {
            onClose();
        }
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div
            ref={modalRef}
            className={`${styles.modal} ${isOpen ? styles.isOpen : ''}`}
            onClick={handleOverlayClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby="infoModalTitle"
        >
            <div className={styles.modalContent}>
                <button
                    ref={closeButtonRef}
                    className={styles.modalClose}
                    onClick={onClose}
                    title="Tutup (Esc)"
                    type="button"
                    aria-label="Tutup"
                >×</button>
                <h2 id="infoModalTitle">Info & Instruksi Simetri Roset</h2>
                <p>Aplikasi ini mendemonstrasikan simetri roset, di mana pola diulang di sekitar titik pusat menggunakan rotasi dan refleksi opsional.</p>
                <ul>
                    <li><strong>Tipe Simetri & Warna (Panel Kanan):</strong> Atur jumlah <strong>Rotasi (n)</strong>, centang <strong>Aktifkan Refleksi</strong> (untuk D<sub>n</sub>), dan pilih <strong>Warna</strong>.</li>
                    <li><strong>Alat & Gaya (Di Bawah Kanvas):</strong> Pilih <strong>Alat</strong> gambar (Goresan, Garis, dll.), <strong>Lebar Garis</strong>, dan <strong>Gaya Kursor</strong>.</li>
                    <li><strong>Menggambar:</strong> Klik dan seret (atau sentuh) pada kanvas putih untuk menggambar. Simetri diterapkan secara instan.</li>
                    <li><strong>Tampilkan Panduan:</strong> Centang di bawah kanvas untuk menampilkan garis bantu rotasi (putus-putus C<sub>n</sub>) atau refleksi (solid oranye D<sub>n</sub>).</li>
                    <li><strong>Kontrol Footer (di bawah bar alat):</strong> Gunakan Urungkan/Ulangi, Bersihkan, Simpan/Muat (data JSON), Unduh Gambar (PNG), dan ganti Mode Terang/Gelap.</li>
                </ul>
                <p><strong>Tips:</strong> Bereksperimenlah dengan urutan rotasi (n) yang berbeda dan aktifkan/nonaktifkan refleksi. Gambar bentuk sederhana agak jauh dari pusat untuk melihat efeknya paling jelas.</p>

            </div>
        </div>
    );
}

export default InfoModal;