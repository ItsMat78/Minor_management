
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse-fork');

const FILE_PATH = path.resolve(__dirname, '../MINOR Project-II (IV Semester)_2025-2026.pdf');

try {
    const dataBuffer = fs.readFileSync(FILE_PATH);
    pdf(dataBuffer).then(function (data) {
        console.log('Text Content:');
        console.log(data.text);
    }).catch(function (error) {
        console.error('Error in promise:', error);
    });
} catch (e) {
    console.error('Error:', e);
}
