
const fs = require('fs');
const pdf = require('pdf-parse');
const path = require('path');

const FILE_PATH = path.resolve(__dirname, '../MINOR Project-II (IV Semester)_2025-2026.pdf');

const main = async () => {
    try {
        if (!fs.existsSync(FILE_PATH)) {
            console.error('File not found:', FILE_PATH);
            return;
        }

        const dataBuffer = fs.readFileSync(FILE_PATH);
        const data = await pdf(dataBuffer);

        console.log('PDF Text Extract:');
        console.log(data.text);
    } catch (error) {
        console.error('Error:', error);
    }
};

main();
