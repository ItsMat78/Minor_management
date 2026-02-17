
const xlsx = require('xlsx');
const path = require('path');

const FILE_PATH = path.resolve(__dirname, '../MINOR Project-II (IV Semester)_2025-2026.xlsx');

function inspectExcel() {
    const workbook = xlsx.readFile(FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with defval to see structure but wait, sheet_to_json default skips empty.
    // Let's use header:1 to get array of arrays, or just use default and see what's missing.
    const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

    console.log('Total Rows:', data.length);
    console.log('First 15 Rows:');
    console.log(JSON.stringify(data.slice(0, 15), null, 2));
}

inspectExcel();
