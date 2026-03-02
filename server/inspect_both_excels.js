const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const files = [
    '../MINOR Project-II (IV Semester)_2025-2026.xlsx',
    '../UG Research Work-I (VI Semester)_2025-2026.xlsx'
];

let result = {};

files.forEach(f => {
    const fp = path.resolve(__dirname, f);
    const wb = xlsx.readFile(fp);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: null });

    result[f] = {
        totalRows: data.length,
        first2: data.slice(0, 2),
        thirdRow: data[2]
    };
});

fs.writeFileSync(path.resolve(__dirname, 'excel_data.json'), JSON.stringify(result, null, 2));
