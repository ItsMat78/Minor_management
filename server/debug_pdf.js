
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse-fork');

const FILE_PATH = path.resolve(__dirname, '../MINOR Project-II (IV Semester)_2025-2026.pdf');

async function debugPDF() {
    try {
        const dataBuffer = fs.readFileSync(FILE_PATH);
        const data = await pdf(dataBuffer);
        fs.writeFileSync('pdf_debug_dump.txt', data.text);
        console.log('Dumped PDF text to pdf_debug_dump.txt');
    } catch (err) {
        console.error(err);
    }
}

debugPDF();
